/**
 * AccessControl.gs — strict user-key RBAC with hashed keys and escalation lockout.
 * 
 * Core principles:
 * - Primary identity: Session.getTemporaryActiveUserKey() hashed via SHA-256
 * - ACCESS is the single source of truth for user access
 * - Lockout escalation: 15 min → 30 min → 60 min → 24 h
 * - Clean separation of auth failures (lead to lockout) and role denials (log only)
 * - Header-based safe reads and writes to prevent data corruption
 */

const AccessControl_ = (function () {
  const ACCESS_SHEET = appGetCore('ACCESS_SHEET', 'ACCESS');

  // Runtime-local caches (per single Apps Script execution).
  let _sheetCache = null;
  let _entriesCache = null;
  let _policyCache = null;

  function _invalidateAccessCaches_(options) {
    const opts = options || {};
    _entriesCache = null;
    _policyCache = null;
    if (opts.resetSheet) _sheetCache = null;
  }

  // Script properties keys
  const LOCKOUT_PROP_PREFIX = 'WASB_ACCESS_LOCKOUT_V1__';
  const MIGRATION_EMAIL_BRIDGE_PROP = 'WASB_ACCESS_MIGRATION_EMAIL_BRIDGE';
  const SELF_BIND_LOGIN_PROP_PREFIX = 'WASB_ACCESS_SELF_BIND_LOGIN_V1__';

  // Lockout configuration
  const MINUTE_MS = 60 * 1000;
  const HOUR_MS = 60 * MINUTE_MS;

  const LOCKOUT_DURATION_MS = 15 * MINUTE_MS;
  const SELF_BIND_LOCK_DURATION_MS = 30 * MINUTE_MS;
  const MAX_SELF_BIND_LOGIN_ATTEMPTS = 5;
  const LOCKOUT_ESCALATION_MS = Object.freeze([
    LOCKOUT_DURATION_MS,
    30 * MINUTE_MS,
    60 * MINUTE_MS,
    24 * HOUR_MS
  ]);

  const MAX_FAILED_ATTEMPTS_SHEET = 5;
  const MAX_SHEET_ROWS = 30;
  const ROTATION_PERIOD_DAYS = 30;

  const ROLE_VALUES = Object.freeze([
    'guest',
    'viewer',
    'operator',
    'maintainer',
    'admin',
    'sysadmin',
    'owner'
  ]);

  const ROLE_ORDER = Object.freeze({
    guest: 0,
    viewer: 1,
    operator: 2,
    maintainer: 3,
    admin: 4,
    sysadmin: 5,
    owner: 6
  });

  const ROLE_METADATA = Object.freeze({
    guest: Object.freeze({ label: 'Гість', note: 'Гість • лише безпечний перегляд' }),
    viewer: Object.freeze({ label: 'Спостерігач', note: 'Спостерігач • тільки своя картка' }),
    operator: Object.freeze({ label: 'Оператор', note: 'Оператор • робочий доступ до карток, зведень' }),
    maintainer: Object.freeze({ label: 'Редактор', note: 'Редактор • розширений робочий доступ, перевірка і супровід' }),
    admin: Object.freeze({ label: 'Адмін', note: 'Адмін • керування доступом, журналами і системними інструментами' }),
    sysadmin: Object.freeze({ label: 'Сисадмін', note: 'Сисадмін • повне технічне обслуговування, repair і тригери' }),
    owner: Object.freeze({ label: 'Власник', note: 'Власник • повний root-доступ до всієї системи' })
  });

  const SHEET_HEADERS = Object.freeze([
    'email',
    'phone',
    'role',
    'enabled',
    'note',
    'display_name',
    'person_callsign',
    'self_bind_allowed',
    'user_key_current_hash',
    'user_key_prev_hash',
    'last_seen_at',
    'last_rotated_at',
    'failed_attempts',
    'locked_until_ms'
  ]);

  // ==================== REASON CODES ====================
  const REASON_CODES = Object.freeze({
    OK: 'access.ok',
    OK_BOOTSTRAP: 'access.ok.bootstrap',
    DENIED_UNREGISTERED_KEY: 'access.denied.unregistered_key',
    DENIED_KEY_UNAVAILABLE: 'access.denied.key_unavailable',
    DENIED_ADMIN_DISABLED: 'access.denied.admin_disabled',
    DENIED_TIMED_LOCKOUT: 'access.denied.timed_lockout',
    DENIED_ROLE_INSUFFICIENT: 'access.denied.role_insufficient',
    DENIED_UNKNOWN_USER: 'access.denied.unknown_user',
    DENIED_BRIDGE_NOT_ALLOWED: 'access.denied.bridge_not_allowed',
    DENIED_LEGACY_FALLBACK_DISABLED: 'access.denied.legacy_fallback_disabled',
    SELF_BIND_KEY_UNAVAILABLE: 'access.self_bind.key_unavailable',
    SELF_BIND_CALLSIGN_NOT_FOUND: 'access.self_bind.callsign_not_found',
    SELF_BIND_CALLSIGN_DISABLED: 'access.self_bind.callsign_disabled',
    SELF_BIND_CALLSIGN_NOT_ALLOWED: 'access.self_bind.callsign_not_allowed',
    SELF_BIND_CALLSIGN_OCCUPIED: 'access.self_bind.callsign_occupied',
    SELF_BIND_KEY_ALREADY_BOUND: 'access.self_bind.key_already_bound',
    SELF_BIND_IDENTIFIER_REQUIRED: 'access.self_bind.identifier_required',
    SELF_BIND_IDENTIFIER_NOT_FOUND: 'access.self_bind.identifier_not_found',
    SELF_BIND_IDENTIFIER_MISMATCH: 'access.self_bind.identifier_mismatch',
    SELF_BIND_LOGIN_BLOCKED: 'access.self_bind.login_blocked'
  });

  // ==================== UTILITIES ====================

  function normalizeEmail_(value) {
    return String(value || '').trim().toLowerCase();
  }

  function normalizeRole_(value) {
    const role = String(value || '').trim().toLowerCase();
    return ROLE_VALUES.indexOf(role) !== -1 ? role : 'guest';
  }

  function normalizeStoredHash_(value) {
    return String(value || '').trim();
  }

  function isEnabledValue_(value) {
    const raw = String(value === '' || value === null ? 'TRUE' : value).trim().toLowerCase();
    return !(raw === 'false' || raw === '0' || raw === 'no' || raw === 'ні');
  }

  function parseBoolean_(value, defaultValue) {
    const raw = String(value === undefined || value === null ? '' : value).trim().toLowerCase();
    if (!raw) return !!defaultValue;
    return ['1', 'true', 'yes', 'y', 'так', 'on'].indexOf(raw) !== -1;
  }

  function normalizeCallsign_(value) {
    return String(value || '').trim().toUpperCase();
  }

  function normalizePhone_(value) {
    return String(value || '').replace(/^'+/, '').replace(/\D+/g, '').trim();
  }

  function detectIdentifierType_(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    return raw.indexOf('@') !== -1 ? 'email' : 'phone';
  }

  function normalizeIdentifierValue_(value) {
    const type = detectIdentifierType_(value);
    if (type === 'email') return normalizeEmail_(value);
    if (type === 'phone') return normalizePhone_(value);
    return '';
  }

  function defaultSelfBindAllowedForRole_(role) {
    const normalizedRole = normalizeRole_(role);
    return ['viewer', 'operator', 'maintainer'].indexOf(normalizedRole) !== -1;
  }

  function isSelfBindAllowedValue_(value, role) {
    const raw = String(value === undefined || value === null ? '' : value).trim().toLowerCase();
    if (!raw) return defaultSelfBindAllowedForRole_(role);
    return !(raw === 'false' || raw === '0' || raw === 'no' || raw === 'ні' || raw === 'off');
  }

  function getPrimarySupportEmail_() {
    const admins = listNotificationEmails();
    if (admins && admins.length) return String(admins[0] || '').trim();
    return safeGetUserEmail_() || '';
  }

  function getPrimarySupportCallsign_() {
    return 'ШАХТАР';
  }

  function getSelfBindHelpText_() {
    return 'Зверніться за допомогою до ШАХТАРЯ';
  }

  function _normalizeLoginMeta_(meta) {
    const raw = meta && typeof meta === 'object' ? meta : {};
    const geo = raw.geo && typeof raw.geo === 'object' ? raw.geo : {};
    const coords = geo.coords && typeof geo.coords === 'object' ? geo.coords : null;

    return {
      enteredAtIso: String(raw.enteredAtIso || '').trim(),
      enteredAtText: String(raw.enteredAtText || '').trim() || 'Невідомий час входу',
      utcOffset: String(raw.utcOffset || '').trim(),
      loginPointText: String(raw.loginPointText || '').trim() || 'Точка входу: GPS недоступна',
      geo: {
        ok: !!geo.ok,
        text: String(geo.text || '').trim(),
        reason: String(geo.reason || '').trim(),
        coords: coords ? {
          lat: Number(coords.lat || 0),
          lng: Number(coords.lng || 0),
          accuracy: Number(coords.accuracy || 0)
        } : null
      }
    };
  }

  function _selfBindLoginPropKey_(currentKeyHash) {
    const keyHash = normalizeStoredHash_(currentKeyHash);
    return keyHash ? (SELF_BIND_LOGIN_PROP_PREFIX + keyHash) : '';
  }

  function _readSelfBindLoginState_(currentKeyHash) {
    const base = {
      attempts: 0,
      lockedUntilMs: 0,
      lastIdentifierType: '',
      lastIdentifierValue: '',
      lastCallsign: '',
      lastReason: ''
    };
    const propKey = _selfBindLoginPropKey_(currentKeyHash);
    if (!propKey) return base;
    const raw = _getProperties_().getProperty(propKey);
    if (!raw) return base;
    try {
      const parsed = JSON.parse(raw);
      return {
        attempts: parseInt(parsed && parsed.attempts || '0', 10) || 0,
        lockedUntilMs: parseInt(parsed && parsed.lockedUntilMs || '0', 10) || 0,
        lastIdentifierType: String(parsed && parsed.lastIdentifierType || ''),
        lastIdentifierValue: String(parsed && parsed.lastIdentifierValue || ''),
        lastCallsign: String(parsed && parsed.lastCallsign || ''),
        lastReason: String(parsed && parsed.lastReason || '')
      };
    } catch (_) {
      return base;
    }
  }

  function _writeSelfBindLoginState_(currentKeyHash, state) {
    const propKey = _selfBindLoginPropKey_(currentKeyHash);
    if (!propKey) return;
    _getProperties_().setProperty(propKey, JSON.stringify({
      attempts: parseInt(state && state.attempts || '0', 10) || 0,
      lockedUntilMs: parseInt(state && state.lockedUntilMs || '0', 10) || 0,
      lastIdentifierType: String(state && state.lastIdentifierType || ''),
      lastIdentifierValue: String(state && state.lastIdentifierValue || ''),
      lastCallsign: String(state && state.lastCallsign || ''),
      lastReason: String(state && state.lastReason || '')
    }));
  }

  function _clearSelfBindLoginState_(currentKeyHash) {
    const propKey = _selfBindLoginPropKey_(currentKeyHash);
    if (propKey) _getProperties_().deleteProperty(propKey);
  }

  function _isSelfBindLoginLocked_(currentKeyHash) {
    const state = _readSelfBindLoginState_(currentKeyHash);
    return !!state.lockedUntilMs && state.lockedUntilMs > _nowMs_();
  }

  function _getSelfBindLoginPublicState_(currentKeyHash) {
    const state = _readSelfBindLoginState_(currentKeyHash);
    const remainingMs = state.lockedUntilMs > _nowMs_() ? Math.max(state.lockedUntilMs - _nowMs_(), 0) : 0;
    return {
      locked: remainingMs > 0,
      remainingMs: remainingMs,
      remainingMinutes: _minutesText_(remainingMs),
      attempts: remainingMs > 0 ? MAX_SELF_BIND_LOGIN_ATTEMPTS : state.attempts,
      maxAttempts: MAX_SELF_BIND_LOGIN_ATTEMPTS
    };
  }

  function _reportSelfBindViolation_(actionName, details, descriptorOpt) {
    try {
      if (typeof AccessEnforcement_ === 'object' && typeof AccessEnforcement_.reportViolation === 'function') {
        AccessEnforcement_.reportViolation(actionName, details || {}, descriptorOpt || describe({ includeSensitiveDebug: false }));
      }
    } catch (error) {
      Logger.log('[AccessControl] self-bind violation report failed: ' + (error && error.message ? error.message : String(error)));
    }
  }

  function _registerSelfBindFailure_(currentKeyHash, context) {
    const existing = _readSelfBindLoginState_(currentKeyHash);
    const nextAttempts = Math.max(0, Number(existing.attempts || 0)) + 1;
    const locked = nextAttempts >= MAX_SELF_BIND_LOGIN_ATTEMPTS;
    const nextState = {
      attempts: locked ? 0 : nextAttempts,
      lockedUntilMs: locked ? (_nowMs_() + SELF_BIND_LOCK_DURATION_MS) : 0,
      lastIdentifierType: String(context && context.identifierType || ''),
      lastIdentifierValue: String(context && context.identifierValue || ''),
      lastCallsign: String(context && context.callsign || ''),
      lastReason: String(context && context.reasonCode || '')
    };
    _writeSelfBindLoginState_(currentKeyHash, nextState);

    const publicState = _getSelfBindLoginPublicState_(currentKeyHash);
    const remainingAttempts = Math.max(MAX_SELF_BIND_LOGIN_ATTEMPTS - nextAttempts, 0);
    const loginMeta = _normalizeLoginMeta_(context && context.loginMeta);

    _reportSelfBindViolation_(locked ? 'selfBindLoginBlocked' : 'selfBindLoginDenied', {
      reasonCode: String(context && context.reasonCode || ''),
      reasonMessage: String(context && context.reasonMessage || ''),
      identifierType: String(context && context.identifierType || ''),
      identifierValue: String(context && context.identifierValue || ''),
      enteredCallsign: String(context && context.callsign || ''),
      attemptNumber: nextAttempts,
      remainingAttempts: remainingAttempts,
      blocked: locked,
      blockDurationMinutes: _minutesText_(SELF_BIND_LOCK_DURATION_MS),
      enteredAtIso: loginMeta.enteredAtIso,
      enteredAtText: loginMeta.enteredAtText,
      utcOffset: loginMeta.utcOffset,
      loginPointText: loginMeta.loginPointText,
      geo: loginMeta.geo
    });

    return {
      blocked: locked || publicState.locked,
      attempts: locked ? MAX_SELF_BIND_LOGIN_ATTEMPTS : nextAttempts,
      remainingAttempts: remainingAttempts,
      remainingMinutes: locked ? _minutesText_(SELF_BIND_LOCK_DURATION_MS) : publicState.remainingMinutes,
      lockedUntilMs: locked ? nextState.lockedUntilMs : 0,
      loginMeta: loginMeta
    };
  }

  function _failureMessageForSelfBind_(reasonCode, callsign, failureState) {
    const normalizedCallsign = normalizeCallsign_(callsign);
    const blocked = !!(failureState && failureState.blocked);
    if (blocked) {
      return 'Ваш вхід тимчасово заблоковано на ' + (failureState.remainingMinutes || _minutesText_(SELF_BIND_LOCK_DURATION_MS)) + ' хв. ' + getSelfBindHelpText_() + '.';
    }

    if (reasonCode === REASON_CODES.SELF_BIND_CALLSIGN_OCCUPIED) {
      return 'Цей позивний уже зайнятий. Якщо це ваш позивний — ' + getSelfBindHelpText_().toLowerCase() + '. Залишилось спроб: ' + Math.max(Number(failureState && failureState.remainingAttempts || 0), 0) + '.';
    }

    return 'Дані не збігаються. Перевірте email або телефон і позивний. Залишилось спроб: ' + Math.max(Number(failureState && failureState.remainingAttempts || 0), 0) + '. Якщо це ваш позивний — ' + getSelfBindHelpText_().toLowerCase() + '.';
  }

  function _timezone_() {
    try { return Session.getScriptTimeZone() || 'Etc/GMT'; } catch (_) { return 'Etc/GMT'; }
  }

  function _nowText_() {
    return Utilities.formatDate(new Date(), _timezone_(), 'yyyy-MM-dd HH:mm:ss');
  }

  function _nowMs_() {
    return Date.now();
  }

  function _getProperties_() {
    return PropertiesService.getScriptProperties();
  }

  function _clampLevel_(value) {
    const lastIndex = Math.max(LOCKOUT_ESCALATION_MS.length - 1, 0);
    const parsed = parseInt(value || '0', 10);
    if (!isFinite(parsed) || parsed < 0) return 0;
    return Math.min(parsed, lastIndex);
  }

  function _minutesText_(durationMs) {
    return Math.round(Number(durationMs || 0) / 60000);
  }

  // ==================== HASHING ====================

  function hashRawUserKey_(rawKey) {
    const raw = String(rawKey || '').trim();
    if (!raw) return '';
    try {
      const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw);
      return hash.map(function (byte) {
        return ('0' + (byte & 0xFF).toString(16)).slice(-2);
      }).join('');
    } catch (e) {
      Logger.log('[AccessControl] Hash error: ' + e.message);
      return '';
    }
  }

  function maskSensitiveValue_(value) {
    const key = String(value || '').trim();
    if (!key) return '';
    if (key.length <= 10) return key;
    return key.slice(0, 6) + '…' + key.slice(-4);
  }

  function getCurrentRawUserKey_() {
    try {
      return String(Session.getTemporaryActiveUserKey() || '').trim();
    } catch (_) {
      return '';
    }
  }

  function getCurrentUserKeyHash_() {
    const raw = getCurrentRawUserKey_();
    return raw ? hashRawUserKey_(raw) : '';
  }

  function safeGetUserEmail_() {
    const candidates = [];
    try { candidates.push(Session.getActiveUser().getEmail()); } catch (_) { }
    try { candidates.push(Session.getEffectiveUser().getEmail()); } catch (_) { }

    for (let i = 0; i < candidates.length; i++) {
      const normalized = normalizeEmail_(candidates[i]);
      if (normalized && normalized.indexOf('@') !== -1) return normalized;
    }
    return '';
  }

  // ==================== SHEET OPERATIONS (HEADER-BASED SAFE READS/WRITES) ====================

  function _getSheet_(createIfMissing) {
    if (_sheetCache && _sheetCache.getParent()) {
      return _sheetCache;
    }

    const ss = SpreadsheetApp.getActive();
    let sh = ss.getSheetByName(ACCESS_SHEET);
    if (!sh && createIfMissing) {
      sh = ss.insertSheet(ACCESS_SHEET);
      Logger.log('[AccessControl] Created ACCESS sheet');
      _invalidateAccessCaches_({ resetSheet: true });
    }
    if (sh) _ensureSheetSchema_(sh);
    _sheetCache = sh || null;
    return _sheetCache;
  }

  function _getHeaderMap_(sh) {
    const lastColumn = Math.max(sh.getLastColumn(), SHEET_HEADERS.length);
    const headers = sh.getRange(1, 1, 1, lastColumn).getValues()[0];
    const map = {};
    for (let i = 0; i < headers.length; i++) {
      const key = String(headers[i] || '').trim().toLowerCase();
      if (key) map[key] = i + 1;
    }
    return map;
  }

  function _ensureSheetSchema_(sh) {
    const lastColumn = Math.max(sh.getLastColumn(), 1);
    const existingHeaders = sh.getLastRow() >= 1
      ? sh.getRange(1, 1, 1, lastColumn).getValues()[0].map(function (v) { return String(v || '').trim(); })
      : [];

    let changed = false;

    if (!existingHeaders.length || existingHeaders.every(function (v) { return !v; })) {
      sh.getRange(1, 1, 1, SHEET_HEADERS.length).setValues([SHEET_HEADERS]);
      changed = true;
    } else {
      const existingMap = {};
      existingHeaders.forEach(function (v, idx) {
        const normalized = String(v || '').trim().toLowerCase();
        if (normalized) existingMap[normalized] = idx + 1;
      });

      SHEET_HEADERS.forEach(function (header) {
        if (existingMap[header]) return;
        const targetColumn = sh.getLastColumn() + 1;
        sh.insertColumnAfter(sh.getLastColumn());
        sh.getRange(1, targetColumn).setValue(header);
        changed = true;
      });
    }

    if (changed || sh.getFrozenRows() < 1) {
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), SHEET_HEADERS.length))
        .setFontWeight('bold')
        .setBackground('#e8eaed');
    }

    _applyRoleValidation_(sh);
    _applyEmailValidation_(sh);
    _applyEnabledValidation_(sh);
  }

  function _buildRoleValidationRule_() {
    return SpreadsheetApp.newDataValidation()
      .requireValueInList(ROLE_VALUES.slice(), true)
      .setAllowInvalid(false)
      .setHelpText('Оберіть роль: ' + ROLE_VALUES.join(', '))
      .build();
  }

  function _applyRoleValidation_(sh) {
    const headerMap = _getHeaderMap_(sh);
    const roleCol = headerMap.role;
    if (!roleCol) return;
    sh.getRange(2, roleCol, MAX_SHEET_ROWS - 1, 1).setDataValidation(_buildRoleValidationRule_());
  }

  function _applyEmailValidation_(sh) {
    const headerMap = _getHeaderMap_(sh);
    const emailCol = headerMap.email;
    if (!emailCol) return;
    const rule = SpreadsheetApp.newDataValidation()
      .requireTextIsEmail()
      .setAllowInvalid(false)
      .setHelpText('Введіть коректну email адресу')
      .build();
    sh.getRange(2, emailCol, MAX_SHEET_ROWS - 1, 1).setDataValidation(rule);
  }

  function _applyEnabledValidation_(sh) {
    const headerMap = _getHeaderMap_(sh);
    const enabledCol = headerMap.enabled;
    if (!enabledCol) return;
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['TRUE', 'FALSE'], true)
      .setAllowInvalid(false)
      .setHelpText('TRUE - активний, FALSE - заблокований адміністратором')
      .build();
    sh.getRange(2, enabledCol, MAX_SHEET_ROWS - 1, 1).setDataValidation(rule);
  }

  function _syncRoleNoteForRow_(sh, rowNumber) {
    if (!sh || rowNumber < 2) return;
    const headerMap = _getHeaderMap_(sh);
    const roleCol = headerMap.role;
    const noteCol = headerMap.note;
    if (!roleCol || !noteCol) return;
    const rawRole = String(sh.getRange(rowNumber, roleCol).getValue() || '').trim();
    if (!rawRole) return;
    sh.getRange(rowNumber, noteCol).setValue(getRoleNoteTemplate_(rawRole));
  }

  function _rowToEntry_(row, rowNumber, headerMap) {
    function read(header) {
      const column = headerMap[header];
      if (!column) return '';
      return row[column - 1];
    }

    return {
      email: normalizeEmail_(read('email')),
      phone: normalizePhone_(read('phone')),
      role: normalizeRole_(read('role')),
      enabled: isEnabledValue_(read('enabled')),
      note: String(read('note') || ''),
      displayName: String(read('display_name') || ''),
      personCallsign: normalizeCallsign_(read('person_callsign')),
      selfBindAllowed: isSelfBindAllowedValue_(read('self_bind_allowed'), read('role')),
      userKeyCurrentHash: normalizeStoredHash_(read('user_key_current_hash')),
      userKeyPrevHash: normalizeStoredHash_(read('user_key_prev_hash')),
      lastSeenAt: String(read('last_seen_at') || ''),
      lastRotatedAt: String(read('last_rotated_at') || ''),
      failedAttempts: parseInt(read('failed_attempts') || '0', 10) || 0,
      lockedUntilMs: parseInt(read('locked_until_ms') || '0', 10) || 0,
      source: ACCESS_SHEET,
      sheetRow: rowNumber
    };
  }

  function _readSheetEntries_() {
    if (_entriesCache) return _entriesCache.slice();

    const sh = _getSheet_(false);
    if (!sh || sh.getLastRow() < 2) {
      _entriesCache = [];
      return [];
    }

    const headerMap = _getHeaderMap_(sh);
    const rowCount = sh.getLastRow() - 1;
    const colCount = sh.getLastColumn();
    const values = sh.getRange(2, 1, rowCount, colCount).getValues();
    const result = [];
    for (let i = 0; i < values.length; i++) {
      result.push(_rowToEntry_(values[i], i + 2, headerMap));
    }
    _entriesCache = result;
    return result.slice();
  }

  function _getEntryBySheetRow_(sheetRow) {
    const sh = _getSheet_(false);
    if (!sh || !sheetRow || sheetRow < 2 || sheetRow > sh.getLastRow()) return null;
    const headerMap = _getHeaderMap_(sh);
    const colCount = sh.getLastColumn();
    const row = sh.getRange(sheetRow, 1, 1, colCount).getValues()[0];
    return _rowToEntry_(row, sheetRow, headerMap);
  }

  function _readRawSheetEntries_() {
    const sh = _getSheet_(false);
    if (!sh || sh.getLastRow() < 2) return [];
    const headerMap = _getHeaderMap_(sh);
    const rowCount = sh.getLastRow() - 1;
    const colCount = sh.getLastColumn();
    const values = sh.getRange(2, 1, rowCount, colCount).getValues();
    const result = [];
    for (let i = 0; i < values.length; i++) {
      result.push({
        rawRow: values[i],
        rowNumber: i + 2,
        headerMap: headerMap
      });
    }
    return result;
  }

  function _setEntryField_(sheetRow, header, value) {
    const sh = _getSheet_(false);
    if (!sh || !sheetRow || sheetRow < 2) return false;
    const headerMap = _getHeaderMap_(sh);
    const column = headerMap[header];
    if (!column) {
      Logger.log(`[AccessControl] Header "${header}" not found, cannot update field.`);
      return false;
    }
    sh.getRange(sheetRow, column).setValue(value);
    _invalidateAccessCaches_();
    return true;
  }

  function _setEntryFields_(sheetRow, updatesByHeader) {
    const sh = _getSheet_(false);
    if (!sh || !sheetRow || sheetRow < 2) return false;
    const headerMap = _getHeaderMap_(sh);
    for (const [header, value] of Object.entries(updatesByHeader)) {
      const column = headerMap[header];
      if (!column) {
        Logger.log(`[AccessControl] Header "${header}" not found, skipping field update.`);
        continue;
      }
      sh.getRange(sheetRow, column).setValue(value);
    }
    _invalidateAccessCaches_();
    return true;
  }

  function _writeEntryByHeaderMap_(sheetRow, entry) {
    const updates = {};
    if (entry.email !== undefined) updates.email = entry.email;
    if (entry.phone !== undefined) updates.phone = normalizePhone_(entry.phone);
    if (entry.role !== undefined) updates.role = normalizeRole_(entry.role);
    if (entry.enabled !== undefined) updates.enabled = entry.enabled ? 'TRUE' : 'FALSE';
    if (entry.note !== undefined) updates.note = entry.note;
    if (entry.displayName !== undefined) updates.display_name = entry.displayName;
    if (entry.personCallsign !== undefined) updates.person_callsign = normalizeCallsign_(entry.personCallsign);
    if (entry.selfBindAllowed !== undefined) updates.self_bind_allowed = entry.selfBindAllowed ? 'TRUE' : 'FALSE';
    if (entry.userKeyCurrentHash !== undefined) updates.user_key_current_hash = entry.userKeyCurrentHash;
    if (entry.userKeyPrevHash !== undefined) updates.user_key_prev_hash = entry.userKeyPrevHash;
    if (entry.lastSeenAt !== undefined) updates.last_seen_at = entry.lastSeenAt;
    if (entry.lastRotatedAt !== undefined) updates.last_rotated_at = entry.lastRotatedAt;
    if (entry.failedAttempts !== undefined) updates.failed_attempts = entry.failedAttempts;
    if (entry.lockedUntilMs !== undefined) updates.locked_until_ms = entry.lockedUntilMs;

    return _setEntryFields_(sheetRow, updates);
  }

  function _updateEntryFields_(sheetRow, updates) {
    const sh = _getSheet_(false);
    if (!sh || !sheetRow || sheetRow < 2) return null;

    const headerMap = _getHeaderMap_(sh);
    const colCount = sh.getLastColumn();
    const currentRow = sh.getRange(sheetRow, 1, 1, colCount).getValues()[0];
    const currentEntry = _rowToEntry_(currentRow, sheetRow, headerMap);

    const mapped = Object.assign({}, currentEntry);

    if (Object.prototype.hasOwnProperty.call(updates, 'email')) mapped.email = normalizeEmail_(updates.email);
    if (Object.prototype.hasOwnProperty.call(updates, 'phone')) mapped.phone = normalizePhone_(updates.phone);
    if (Object.prototype.hasOwnProperty.call(updates, 'role')) mapped.role = normalizeRole_(updates.role);
    if (Object.prototype.hasOwnProperty.call(updates, 'enabled')) mapped.enabled = !!updates.enabled;
    if (Object.prototype.hasOwnProperty.call(updates, 'note')) mapped.note = String(updates.note || '');
    if (Object.prototype.hasOwnProperty.call(updates, 'display_name')) mapped.displayName = String(updates.display_name || '');
    if (Object.prototype.hasOwnProperty.call(updates, 'displayName')) mapped.displayName = String(updates.displayName || '');
    if (Object.prototype.hasOwnProperty.call(updates, 'person_callsign')) mapped.personCallsign = normalizeCallsign_(updates.person_callsign);
    if (Object.prototype.hasOwnProperty.call(updates, 'personCallsign')) mapped.personCallsign = normalizeCallsign_(updates.personCallsign);
    if (Object.prototype.hasOwnProperty.call(updates, 'self_bind_allowed')) mapped.selfBindAllowed = isSelfBindAllowedValue_(updates.self_bind_allowed, mapped.role);
    if (Object.prototype.hasOwnProperty.call(updates, 'selfBindAllowed')) mapped.selfBindAllowed = !!updates.selfBindAllowed;
    if (Object.prototype.hasOwnProperty.call(updates, 'user_key_current_hash')) mapped.userKeyCurrentHash = normalizeStoredHash_(updates.user_key_current_hash);
    if (Object.prototype.hasOwnProperty.call(updates, 'user_key_prev_hash')) mapped.userKeyPrevHash = normalizeStoredHash_(updates.user_key_prev_hash);
    if (Object.prototype.hasOwnProperty.call(updates, 'last_seen_at')) mapped.lastSeenAt = String(updates.last_seen_at || '');
    if (Object.prototype.hasOwnProperty.call(updates, 'last_rotated_at')) mapped.lastRotatedAt = String(updates.last_rotated_at || '');
    if (Object.prototype.hasOwnProperty.call(updates, 'failed_attempts')) mapped.failedAttempts = parseInt(updates.failed_attempts || '0', 10) || 0;
    if (Object.prototype.hasOwnProperty.call(updates, 'locked_until_ms')) mapped.lockedUntilMs = parseInt(updates.locked_until_ms || '0', 10) || 0;

    _writeEntryByHeaderMap_(sheetRow, mapped);
    return mapped;
  }

  // ==================== ENTRY STATUS ====================

  function _isAdminDisabled_(entry) {
    return !!(entry && entry.enabled === false);
  }

  function _isTimedLocked_(entry) {
    if (!entry || entry.enabled === false) return false;
    if (!entry.lockedUntilMs || entry.lockedUntilMs <= 0) return false;
    return entry.lockedUntilMs > _nowMs_();
  }

  function _isEntryLocked_(entry) {
    return _isAdminDisabled_(entry) || _isTimedLocked_(entry);
  }

  // ==================== LOCKOUT STATE ====================

  function _lockoutIdentity_(entry, fallbackEmail, fallbackKeyHash) {
    const email = normalizeEmail_(entry && entry.email || fallbackEmail || '');
    if (email) return 'email::' + email;

    const keyHash = normalizeStoredHash_(
      entry && (entry.userKeyCurrentHash || entry.userKeyPrevHash) || fallbackKeyHash || ''
    );
    if (keyHash) return 'key::' + keyHash;

    if (entry && entry.sheetRow) return 'row::' + String(entry.sheetRow);
    return '';
  }

  function _lockoutPropKey_(entry, fallbackEmail, fallbackKeyHash) {
    const identity = _lockoutIdentity_(entry, fallbackEmail, fallbackKeyHash);
    return identity ? LOCKOUT_PROP_PREFIX + identity : '';
  }

  function _readLockoutMeta_(entry, fallbackEmail, fallbackKeyHash) {
    const propKey = _lockoutPropKey_(entry, fallbackEmail, fallbackKeyHash);
    const base = {
      nextLevel: 0,
      lastAppliedLevel: 0,
      updatedAtMs: 0,
      lastReason: ''
    };

    if (!propKey) return base;

    const raw = _getProperties_().getProperty(propKey);
    if (!raw) return base;

    try {
      const parsed = JSON.parse(raw);
      return {
        nextLevel: _clampLevel_(parsed && parsed.nextLevel),
        lastAppliedLevel: _clampLevel_(parsed && parsed.lastAppliedLevel),
        updatedAtMs: parseInt(parsed && parsed.updatedAtMs || '0', 10) || 0,
        lastReason: String(parsed && parsed.lastReason || '')
      };
    } catch (_) {
      return base;
    }
  }

  function _writeLockoutMeta_(entry, meta, fallbackEmail, fallbackKeyHash) {
    const propKey = _lockoutPropKey_(entry, fallbackEmail, fallbackKeyHash);
    if (!propKey) return;

    _getProperties_().setProperty(propKey, JSON.stringify({
      nextLevel: _clampLevel_(meta && meta.nextLevel),
      lastAppliedLevel: _clampLevel_(meta && meta.lastAppliedLevel),
      updatedAtMs: parseInt(meta && meta.updatedAtMs || '0', 10) || 0,
      lastReason: String(meta && meta.lastReason || '')
    }));
  }

  function _clearLockoutMeta_(entry, fallbackEmail, fallbackKeyHash) {
    const propKey = _lockoutPropKey_(entry, fallbackEmail, fallbackKeyHash);
    if (propKey) _getProperties_().deleteProperty(propKey);
  }

  function _getPublicLockoutState_(entry, fallbackEmail, fallbackKeyHash) {
    const timedLocked = _isTimedLocked_(entry);
    const disabledByAdmin = _isAdminDisabled_(entry);
    const meta = _readLockoutMeta_(entry, fallbackEmail, fallbackKeyHash);

    const remainingMs = timedLocked
      ? Math.max(Number(entry && entry.lockedUntilMs || 0) - _nowMs_(), 0)
      : 0;

    return {
      locked: timedLocked,
      disabledByAdmin: disabledByAdmin,
      remainingMs: remainingMs,
      remainingMinutes: _minutesText_(remainingMs),
      nextEscalationLevel: meta.nextLevel,
      lastAppliedLevel: meta.lastAppliedLevel,
      lastReason: meta.lastReason
    };
  }

  // ==================== UNIFIED MUTATION OPERATIONS ====================

  function _applySuccessfulAuth_(entry, userKeyHash) {
    if (!entry || !entry.sheetRow) return entry;

    const now = _nowText_();
    const updates = {
      last_seen_at: now,
      failed_attempts: 0,
      locked_until_ms: 0
    };

    let rotated = false;

    if (userKeyHash && entry.userKeyPrevHash === userKeyHash) {
      const pair = _sanitizeKeyPair_(userKeyHash, entry.userKeyCurrentHash || entry.userKeyPrevHash || '');
      updates.user_key_current_hash = pair.current;
      updates.user_key_prev_hash = pair.previous;
      updates.last_rotated_at = now;
      rotated = true;
    }

    const updated = _updateEntryFields_(entry.sheetRow, updates) || Object.assign({}, entry, {
      lastSeenAt: now,
      failedAttempts: 0,
      lockedUntilMs: 0
    });

    _clearLockoutMeta_(updated);

    if (rotated) {
      updated.source = 'ACCESS-user-key-rotated';
      updated.matchedBy = 'user_key_prev_hash';
      _auditKeyRotation_(updated, {
        matchedBy: 'user_key_prev_hash',
        lastRotatedAt: now
      });
    } else {
      updated.source = entry.source || 'ACCESS-user-key-current';
      updated.matchedBy = entry.matchedBy || 'user_key_current_hash';
    }

    return updated;
  }

  function _applyFailedAuth_(entry, violationType, reason) {
    if (!entry || !entry.sheetRow || !entry.enabled) return entry;
    if (_isAdminDisabled_(entry) || _isTimedLocked_(entry)) return entry;

    const lock = LockService.getScriptLock();
    lock.waitLock(5000);

    try {
      const fresh = _getEntryBySheetRow_(entry.sheetRow) || entry;
      if (!fresh.enabled || _isAdminDisabled_(fresh) || _isTimedLocked_(fresh)) return fresh;

      const nowMs = _nowMs_();
      const nowText = _nowText_();
      const newFailedCount = (fresh.failedAttempts || 0) + 1;
      const updates = {
        failed_attempts: newFailedCount,
        last_seen_at: nowText
      };

      let justLocked = false;
      let appliedDurationMs = 0;
      let appliedLevel = 0;

      if (newFailedCount >= MAX_FAILED_ATTEMPTS_SHEET) {
        const meta = _readLockoutMeta_(fresh);
        appliedLevel = _clampLevel_(meta.nextLevel);
        appliedDurationMs = LOCKOUT_ESCALATION_MS[appliedLevel] || LOCKOUT_DURATION_MS;

        updates.failed_attempts = 0;
        updates.locked_until_ms = nowMs + appliedDurationMs;

        _writeLockoutMeta_(fresh, {
          nextLevel: _clampLevel_(appliedLevel + 1),
          lastAppliedLevel: appliedLevel,
          updatedAtMs: nowMs,
          lastReason: String(reason || violationType || '')
        });

        justLocked = true;
      }

      const updated = _updateEntryFields_(fresh.sheetRow, updates) || Object.assign({}, fresh, {
        failedAttempts: updates.failed_attempts,
        lockedUntilMs: updates.locked_until_ms || 0,
        lastSeenAt: nowText
      });

      if (justLocked) {
        Logger.log(
          '[AccessControl] Lockout applied for ' + (updated.email || ('row:' + updated.sheetRow)) +
          ' for ' + _minutesText_(appliedDurationMs) + ' min (level ' + appliedLevel + ' → ' + (appliedLevel + 1) + ')'
        );
      }

      return updated;
    } finally {
      lock.releaseLock();
    }
  }

  function _applyEmailBridgeBind_(entry, currentKeyHash) {
    if (!entry || !entry.sheetRow || !entry.enabled) return null;
    if (_isTimedLocked_(entry)) return entry;

    const updates = {
      last_seen_at: _nowText_(),
      failed_attempts: 0,
      locked_until_ms: 0
    };

    if (currentKeyHash) {
      const pair = _sanitizeKeyPair_(
        currentKeyHash,
        entry.userKeyCurrentHash && entry.userKeyCurrentHash !== currentKeyHash
          ? entry.userKeyCurrentHash
          : entry.userKeyPrevHash
      );
      updates.user_key_current_hash = pair.current;
      updates.user_key_prev_hash = pair.previous;
      if (entry.userKeyCurrentHash && entry.userKeyCurrentHash !== currentKeyHash) {
        updates.last_rotated_at = _nowText_();
      }
    }

    const updated = _updateEntryFields_(entry.sheetRow, updates) || entry;
    _clearLockoutMeta_(updated);

    return Object.assign({}, updated, {
      source: currentKeyHash ? 'ACCESS-email-bound-key' : 'ACCESS-email-bridge',
      matchedBy: 'email-bridge'
    });
  }

  /**
   * Unified operation for prev-key match with rotation
   * Preserves matchSource as 'ACCESS-user-key-rotated'
   */
  function _applyPrevKeyMatch_(entry, matchedKeyHash) {
    if (!entry || !entry.sheetRow) return entry;
    if (entry.userKeyPrevHash !== matchedKeyHash) return entry;
    if (_isAdminDisabled_(entry) || _isTimedLocked_(entry)) return entry;

    const now = _nowText_();

    const pair = _sanitizeKeyPair_(matchedKeyHash, entry.userKeyCurrentHash || entry.userKeyPrevHash || '');

    const updates = {
      user_key_current_hash: pair.current,
      user_key_prev_hash: pair.previous,
      last_rotated_at: now,
      last_seen_at: now,
      failed_attempts: 0,
      locked_until_ms: 0
    };

    const updated = _updateEntryFields_(entry.sheetRow, updates) || Object.assign({}, entry, updates);

    _clearLockoutMeta_(updated);

    updated.source = 'ACCESS-user-key-rotated';
    updated.matchedBy = 'user_key_prev_hash';

    _auditKeyRotation_(updated, {
      matchedBy: 'user_key_prev_hash',
      lastRotatedAt: now
    });

    return updated;
  }

  function _sanitizeKeyPair_(currentKeyHash, previousKeyHash) {
    const current = normalizeStoredHash_(currentKeyHash);
    let previous = normalizeStoredHash_(previousKeyHash);
    if (current && previous && current === previous) previous = '';
    return { current: current, previous: previous };
  }

  function _auditKeyRotation_(entry, payload) {
    try {
      if (typeof Stage7AuditTrail_ !== 'object' || typeof Stage7AuditTrail_.record !== 'function') return;
      Stage7AuditTrail_.record({
        timestamp: new Date(),
        operationId: typeof stage7UniqueId_ === 'function' ? stage7UniqueId_('access_key_rotation') : String(Date.now()),
        scenario: 'access.user_key_rotation',
        level: 'AUDIT',
        status: 'COMMITTED',
        initiator: 'access-control',
        dryRun: false,
        partial: false,
        affectedSheets: [ACCESS_SHEET],
        affectedEntities: [
          String(entry && entry.email || ''),
          String(entry && entry.displayName || ''),
          String(entry && entry.personCallsign || '')
        ].filter(Boolean),
        payload: payload || {},
        message: 'User key rotated and promoted from previous to current'
      });
    } catch (e) {
      Logger.log('[AccessControl] audit key rotation error: ' + (e && e.message ? e.message : String(e)));
    }
  }

  // ==================== ACCESS POLICY ====================

  function _getAccessPolicy_() {
    if (_policyCache) return Object.assign({}, _policyCache);

    const entries = _readSheetEntries_();
    const hasAdminConfigured = entries.some(function(e) { return e.enabled && ['admin', 'sysadmin', 'owner'].includes(e.role); });
    const migrationModeEnabled = parseBoolean_(_getProperties_().getProperty(MIGRATION_EMAIL_BRIDGE_PROP), false);
    const accessSheetPresent = !!_getSheet_(false);

    _policyCache = {
      mode: migrationModeEnabled ? 'user-key+email-bridge' : 'strict-user-key',
      strictUserKeyMode: !migrationModeEnabled,
      migrationModeEnabled: migrationModeEnabled,
      allowEmailBridge: migrationModeEnabled,
      allowScriptPropertiesFallback: false,
      bootstrapAllowed: !hasAdminConfigured && (accessSheetPresent ? entries.length === 0 : true),
      adminConfigured: hasAdminConfigured,
      accessSheetPresent: accessSheetPresent,
      registeredKeysCount: entries.filter(function(e) { return e.userKeyCurrentHash || e.userKeyPrevHash; }).length
    };

    return Object.assign({}, _policyCache);
  }

  // ==================== UNIFIED USER RESOLVER ====================

  function _resolveAccessSubject_(context, options = {}) {
    const policy = _getAccessPolicy_();
    const currentKeyHash = context.currentKeyHash;
    const sessionEmail = context.sessionEmail;

    let match = null;
    let sourceType = null;
    let matchedBy = null;
    let matchSource = null;

    // 1. Strict priority: ACCESS by current key
    if (currentKeyHash) {
      match = _findByUserKey_(currentKeyHash, { includeLocked: true, includeDisabled: true });
      if (match) {
        sourceType = 'access';
        matchedBy = 'user_key_current_hash';
        matchSource = match.source;
        if (!_isEntryLocked_(match)) {
          match = _applySuccessfulAuth_(match, currentKeyHash);
          matchSource = match.source;
        }
        return _buildDescriptorFromMatch_(match, sourceType, matchedBy, matchSource, policy, context);
      }
    }

    // 2. ACCESS by previous key - using unified operation
    if (currentKeyHash) {
      match = _findByUserKey_(currentKeyHash, { includeLocked: true, includeDisabled: true, matchPrev: true });
      if (match) {
        sourceType = 'access';
        matchedBy = 'user_key_prev_hash';
        matchSource = match.source;
        if (!_isEntryLocked_(match)) {
          match = _applyPrevKeyMatch_(match, currentKeyHash);
          matchSource = match.source;
        }
        return _buildDescriptorFromMatch_(match, sourceType, matchedBy, matchSource, policy, context);
      }
    }

    // 3. Email bridge (only if policy allows)
    if (policy.allowEmailBridge && sessionEmail) {
      match = _findByEmailInSheet_(sessionEmail, { includeLocked: true, includeDisabled: true });
      if (match) {
        sourceType = 'access';
        matchedBy = 'email-bridge';
        matchSource = match.source;
        if (!_isEntryLocked_(match) && currentKeyHash) {
          match = _applyEmailBridgeBind_(match, currentKeyHash);
          matchSource = match.source;
        } else if (!_isEntryLocked_(match)) {
          match = _updateEntryFields_(match.sheetRow, { last_seen_at: _nowText_() }) || match;
        }
        return _buildDescriptorFromMatch_(match, sourceType, matchedBy, matchSource, policy, context);
      }
    }

    // 4. Bootstrap mode
    if (policy.bootstrapAllowed && (currentKeyHash || sessionEmail)) {
      return _buildBootstrapDescriptor_(context, policy);
    }

    // 5. No match found
    return _buildUnknownDescriptor_(context, policy);
  }

  function _resolveAccessSubjectReadOnly_(context) {
    const policy = _getAccessPolicy_();
    const currentKeyHash = context.currentKeyHash;
    const sessionEmail = context.sessionEmail;

    let match = null;

    if (currentKeyHash) {
      match = _findByUserKey_(currentKeyHash, { includeLocked: true, includeDisabled: true });
      if (match) {
        return _buildDescriptorFromMatch_(match, 'access', 'user_key_current_hash', match.source, policy, context);
      }
    }

    if (currentKeyHash) {
      match = _findByUserKey_(currentKeyHash, { includeLocked: true, includeDisabled: true, matchPrev: true });
      if (match) {
        return _buildDescriptorFromMatch_(match, 'access', 'user_key_prev_hash', match.source, policy, context);
      }
    }

    if (policy.allowEmailBridge && sessionEmail) {
      match = _findByEmailInSheet_(sessionEmail, { includeLocked: true, includeDisabled: true });
      if (match) {
        return _buildDescriptorFromMatch_(match, 'access', 'email-bridge', match.source, policy, context);
      }
    }

    if (policy.bootstrapAllowed && (currentKeyHash || sessionEmail)) {
      return _buildBootstrapDescriptor_(context, policy);
    }

    return _buildUnknownDescriptor_(context, policy);
  }

  function _buildDescriptorFromMatch_(entry, sourceType, matchedBy, matchSource, policy, context) {
    const role = normalizeRole_(entry.role);
    const roleLevel = ROLE_ORDER[role] || 0;
    const enabled = entry.enabled && !_isTimedLocked_(entry);
    const timedLocked = _isTimedLocked_(entry);
    const adminDisabled = _isAdminDisabled_(entry);
    const registered = true;
    const knownUser = true;

    let reasonCode = REASON_CODES.OK;
    let reasonMessage = '';

    if (adminDisabled) {
      reasonCode = REASON_CODES.DENIED_ADMIN_DISABLED;
      reasonMessage = 'Користувача вимкнено адміністратором.';
    } else if (timedLocked) {
      reasonCode = REASON_CODES.DENIED_TIMED_LOCKOUT;
      const remainingMinutes = entry.lockedUntilMs ? Math.ceil((entry.lockedUntilMs - _nowMs_()) / 60000) : 0;
      reasonMessage = `Доступ тимчасово заблоковано через повторні помилки. Залишилось ${remainingMinutes} хв.`;
    }

    return {
      matchFound: true,
      sourceType: sourceType,
      matchSource: matchSource,
      matchedBy: matchedBy,
      entry: entry,
      role: role,
      roleLevel: roleLevel,
      enabled: enabled,
      timedLocked: timedLocked,
      adminDisabled: adminDisabled,
      registered: registered,
      knownUser: knownUser,
      resolutionMode: policy.mode,
      reasonCode: reasonCode,
      reasonMessage: reasonMessage,
      lockoutState: _getPublicLockoutState_(entry, context.sessionEmail, context.currentKeyHash)
    };
  }

  function _buildBootstrapDescriptor_(context, policy) {
    return {
      matchFound: true,
      sourceType: 'bootstrap',
      matchSource: 'bootstrap-owner',
      matchedBy: 'bootstrap-owner',
      entry: null,
      role: 'owner',
      roleLevel: ROLE_ORDER.owner,
      enabled: true,
      timedLocked: false,
      adminDisabled: false,
      registered: false,
      knownUser: true,
      resolutionMode: 'bootstrap-owner',
      reasonCode: REASON_CODES.OK_BOOTSTRAP,
      reasonMessage: 'RBAC не налаштовано. Тимчасовий доступ як власник.',
      lockoutState: { locked: false, disabledByAdmin: false, remainingMs: 0, remainingMinutes: 0, nextEscalationLevel: 0, lastAppliedLevel: 0, lastReason: '' }
    };
  }

  function _buildUnknownDescriptor_(context, policy) {
    let reasonCode = REASON_CODES.DENIED_UNKNOWN_USER;
    let reasonMessage = 'Користувача не знайдено в системі.';

    if (context.currentKeyHash && policy.strictUserKeyMode) {
      reasonCode = REASON_CODES.DENIED_UNREGISTERED_KEY;
      reasonMessage = 'Ключ не зареєстровано в ACCESS. Строгий режим.';
    } else if (context.currentKeyHash && !policy.strictUserKeyMode) {
      reasonCode = REASON_CODES.DENIED_BRIDGE_NOT_ALLOWED;
      reasonMessage = 'Ключ не зареєстровано, а email-міст не підтвердив користувача.';
    } else if (!context.currentKeyHash && context.sessionEmail) {
      reasonCode = REASON_CODES.DENIED_KEY_UNAVAILABLE;
      reasonMessage = 'Ключ користувача недоступний. Email-міст може допомогти, якщо увімкнено.';
    }

    return {
      matchFound: false,
      sourceType: null,
      matchSource: null,
      matchedBy: null,
      entry: null,
      role: 'guest',
      roleLevel: ROLE_ORDER.guest,
      enabled: false,
      timedLocked: false,
      adminDisabled: false,
      registered: false,
      knownUser: false,
      resolutionMode: policy.mode,
      reasonCode: reasonCode,
      reasonMessage: reasonMessage,
      lockoutState: { locked: false, disabledByAdmin: false, remainingMs: 0, remainingMinutes: 0, nextEscalationLevel: 0, lastAppliedLevel: 0, lastReason: '' }
    };
  }

  function _findByUserKey_(userKeyHash, options = {}) {
    const normalizedKey = normalizeStoredHash_(userKeyHash);
    if (!normalizedKey) return null;

    const includeLocked = options.includeLocked || false;
    const includeDisabled = options.includeDisabled || false;
    const matchPrev = options.matchPrev || false;

    const entries = _readSheetEntries_();
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (!includeDisabled && _isAdminDisabled_(entry)) continue;
      if (!includeLocked && _isTimedLocked_(entry)) continue;

      if (entry.userKeyCurrentHash === normalizedKey) {
        return Object.assign({}, entry, {
          source: 'ACCESS-user-key-current',
          matchedBy: 'user_key_current_hash'
        });
      }

      if (matchPrev && entry.userKeyPrevHash === normalizedKey) {
        return Object.assign({}, entry, {
          source: 'ACCESS-user-key-prev',
          matchedBy: 'user_key_prev_hash'
        });
      }
    }
    return null;
  }

  function _findByEmailInSheet_(email, options = {}) {
    const normalizedEmail = normalizeEmail_(email);
    if (!normalizedEmail) return null;

    const includeLocked = options.includeLocked || false;
    const includeDisabled = options.includeDisabled || false;

    const entries = _readSheetEntries_();
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (!includeDisabled && _isAdminDisabled_(entry)) continue;
      if (!includeLocked && _isTimedLocked_(entry)) continue;
      if (entry.email === normalizedEmail) {
        return Object.assign({}, entry, {
          source: ACCESS_SHEET,
          matchedBy: 'email'
        });
      }
    }
    return null;
  }

  function _findEntriesByIdentifier_(identifierType, identifierValue, options = {}) {
    const type = String(identifierType || '').trim().toLowerCase();
    const normalizedValue = type === 'email' ? normalizeEmail_(identifierValue) : normalizePhone_(identifierValue);
    if (!normalizedValue) return [];

    const includeLocked = options.includeLocked || false;
    const includeDisabled = options.includeDisabled || false;

    return _readSheetEntries_().filter(function (entry) {
      if (!includeDisabled && _isAdminDisabled_(entry)) return false;
      if (!includeLocked && _isTimedLocked_(entry)) return false;
      if (type === 'email') return normalizeEmail_(entry.email) === normalizedValue;
      if (type === 'phone') return normalizePhone_(entry.phone) === normalizedValue;
      return false;
    }).map(function (entry) {
      return Object.assign({}, entry, {
        source: ACCESS_SHEET,
        matchedBy: type
      });
    });
  }

  function _findByCallsign_(callsign, options = {}) {
    const normalizedCallsign = normalizeCallsign_(callsign);
    if (!normalizedCallsign) return null;

    const includeLocked = options.includeLocked || false;
    const includeDisabled = options.includeDisabled || false;
    const requireSelfBindAllowed = options.requireSelfBindAllowed || false;

    const entries = _readSheetEntries_();
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (!includeDisabled && _isAdminDisabled_(entry)) continue;
      if (!includeLocked && _isTimedLocked_(entry)) continue;
      if (requireSelfBindAllowed && !entry.selfBindAllowed) continue;
      if (normalizeCallsign_(entry.personCallsign) === normalizedCallsign) {
        return Object.assign({}, entry, {
          source: ACCESS_SHEET,
          matchedBy: 'person_callsign'
        });
      }
    }
    return null;
  }

  function listBindableCallsigns() {
    const entries = _readSheetEntries_();
    return entries
      .filter(function (entry) {
        return entry.enabled && entry.selfBindAllowed && !!normalizeCallsign_(entry.personCallsign);
      })
      .map(function (entry) {
        return normalizeCallsign_(entry.personCallsign);
      })
      .filter(function (value, index, arr) {
        return arr.indexOf(value) === index;
      })
      .sort();
  }

  function loginByIdentifierAndCallsign(identifierOrPayload, callsignMaybe, loginMetaMaybe) {
    const payload = (identifierOrPayload && typeof identifierOrPayload === 'object' && !Array.isArray(identifierOrPayload))
      ? Object.assign({}, identifierOrPayload)
      : { identifier: identifierOrPayload, callsign: callsignMaybe, loginMeta: loginMetaMaybe };

    const currentKeyHash = getCurrentUserKeyHash_();
    const supportCallsign = getPrimarySupportCallsign_();
    const identifier = String(payload.identifier || '').trim();
    const callsign = String(payload.callsign || '').trim();
    const loginMeta = _normalizeLoginMeta_(payload.loginMeta || {});
    const identifierType = detectIdentifierType_(identifier);
    const normalizedIdentifier = normalizeIdentifierValue_(identifier);
    const normalizedCallsign = normalizeCallsign_(callsign);

    if (!currentKeyHash) {
      return {
        success: false,
        code: REASON_CODES.SELF_BIND_KEY_UNAVAILABLE,
        message: 'Не вдалося визначити ключ користувача. Оновіть панель і спробуйте ще раз.',
        supportCallsign: supportCallsign,
        loginMeta: loginMeta
      };
    }

    const loginState = _getSelfBindLoginPublicState_(currentKeyHash);
    if (loginState.locked) {
      return {
        success: false,
        code: REASON_CODES.SELF_BIND_LOGIN_BLOCKED,
        message: 'Ваш вхід тимчасово заблоковано на ' + loginState.remainingMinutes + ' хв. ' + getSelfBindHelpText_() + '.',
        supportCallsign: supportCallsign,
        loginLockout: loginState,
        loginMeta: loginMeta
      };
    }

    if (!normalizedIdentifier || !identifierType) {
      return {
        success: false,
        code: REASON_CODES.SELF_BIND_IDENTIFIER_REQUIRED,
        message: 'Введіть email або телефон.',
        supportCallsign: supportCallsign,
        loginMeta: loginMeta
      };
    }

    if (!normalizedCallsign) {
      return {
        success: false,
        code: REASON_CODES.SELF_BIND_CALLSIGN_NOT_FOUND,
        message: 'Введіть свій позивний.',
        supportCallsign: supportCallsign,
        loginMeta: loginMeta
      };
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(5000);
    try {
      const alreadyBound = _findByUserKey_(currentKeyHash, { includeLocked: true, includeDisabled: true, matchPrev: true });
      const matchedEntries = _findEntriesByIdentifier_(identifierType, normalizedIdentifier, { includeLocked: true, includeDisabled: true });
      const matchedEntry = matchedEntries.find(function (entry) {
        return normalizeCallsign_(entry.personCallsign) === normalizedCallsign;
      }) || null;

      if (alreadyBound) {
        const currentCallsign = normalizeCallsign_(alreadyBound.personCallsign);
        const identifierMatches = (identifierType === 'email')
          ? normalizeEmail_(alreadyBound.email) === normalizedIdentifier
          : normalizePhone_(alreadyBound.phone) === normalizedIdentifier;

        if (currentCallsign === normalizedCallsign && identifierMatches) {
          _clearSelfBindLoginState_(currentKeyHash);
          _applySuccessfulAuth_(alreadyBound, currentKeyHash);
          return {
            success: true,
            code: REASON_CODES.OK,
            message: 'Вхід підтверджено для позивного ' + currentCallsign + '.',
            supportCallsign: supportCallsign,
            descriptor: describe({ includeSensitiveDebug: false }),
            loginMeta: loginMeta
          };
        }
      }

      if (!matchedEntries.length) {
        const failure = _registerSelfBindFailure_(currentKeyHash, {
          identifierType: identifierType,
          identifierValue: normalizedIdentifier,
          callsign: normalizedCallsign,
          reasonCode: REASON_CODES.SELF_BIND_IDENTIFIER_NOT_FOUND,
          reasonMessage: 'Не знайдено жодного доступного запису для вказаного ідентифікатора.',
          loginMeta: loginMeta
        });
        return {
          success: false,
          code: failure.blocked ? REASON_CODES.SELF_BIND_LOGIN_BLOCKED : REASON_CODES.SELF_BIND_IDENTIFIER_NOT_FOUND,
          message: _failureMessageForSelfBind_(REASON_CODES.SELF_BIND_IDENTIFIER_NOT_FOUND, normalizedCallsign, failure),
          supportCallsign: supportCallsign,
          loginLockout: failure,
          loginMeta: loginMeta
        };
      }

      if (!matchedEntry) {
        const failure = _registerSelfBindFailure_(currentKeyHash, {
          identifierType: identifierType,
          identifierValue: normalizedIdentifier,
          callsign: normalizedCallsign,
          reasonCode: REASON_CODES.SELF_BIND_IDENTIFIER_MISMATCH,
          reasonMessage: 'Позивний не збігається з указаним email або телефоном.',
          loginMeta: loginMeta
        });
        return {
          success: false,
          code: failure.blocked ? REASON_CODES.SELF_BIND_LOGIN_BLOCKED : REASON_CODES.SELF_BIND_IDENTIFIER_MISMATCH,
          message: _failureMessageForSelfBind_(REASON_CODES.SELF_BIND_IDENTIFIER_MISMATCH, normalizedCallsign, failure),
          supportCallsign: supportCallsign,
          loginLockout: failure,
          loginMeta: loginMeta
        };
      }

      if (!matchedEntry.enabled || _isAdminDisabled_(matchedEntry)) {
        return {
          success: false,
          code: REASON_CODES.SELF_BIND_CALLSIGN_DISABLED,
          message: 'Цей позивний тимчасово вимкнено. ' + getSelfBindHelpText_() + '.',
          supportCallsign: supportCallsign,
          loginMeta: loginMeta
        };
      }

      if (!matchedEntry.selfBindAllowed) {
        return {
          success: false,
          code: REASON_CODES.SELF_BIND_CALLSIGN_NOT_ALLOWED,
          message: 'Для цього позивного самостійний вхід вимкнено. ' + getSelfBindHelpText_() + '.',
          supportCallsign: supportCallsign,
          loginMeta: loginMeta
        };
      }

      if (_isTimedLocked_(matchedEntry)) {
        return {
          success: false,
          code: REASON_CODES.DENIED_TIMED_LOCKOUT,
          message: 'Цей позивний тимчасово заблоковано. ' + getSelfBindHelpText_() + '.',
          supportCallsign: supportCallsign,
          loginMeta: loginMeta
        };
      }

      const occupantHash = normalizeStoredHash_(matchedEntry.userKeyCurrentHash);
      if (occupantHash && occupantHash !== currentKeyHash) {
        const failure = _registerSelfBindFailure_(currentKeyHash, {
          identifierType: identifierType,
          identifierValue: normalizedIdentifier,
          callsign: normalizedCallsign,
          reasonCode: REASON_CODES.SELF_BIND_CALLSIGN_OCCUPIED,
          reasonMessage: 'Позивний уже зайнятий іншим ключем.',
          loginMeta: loginMeta
        });
        return {
          success: false,
          code: failure.blocked ? REASON_CODES.SELF_BIND_LOGIN_BLOCKED : REASON_CODES.SELF_BIND_CALLSIGN_OCCUPIED,
          message: _failureMessageForSelfBind_(REASON_CODES.SELF_BIND_CALLSIGN_OCCUPIED, normalizedCallsign, failure),
          supportCallsign: supportCallsign,
          loginLockout: failure,
          loginMeta: loginMeta
        };
      }

      const nowText = _nowText_();
      const updates = {
        user_key_current_hash: currentKeyHash,
        last_seen_at: nowText,
        failed_attempts: 0,
        locked_until_ms: 0
      };
      if (!matchedEntry.lastRotatedAt) {
        updates.last_rotated_at = nowText;
      }
      _updateEntryFields_(matchedEntry.sheetRow, updates);
      _clearSelfBindLoginState_(currentKeyHash);

      return {
        success: true,
        code: REASON_CODES.OK,
        message: 'Вхід підтверджено для позивного ' + normalizedCallsign + '.',
        supportCallsign: supportCallsign,
        descriptor: describe({ includeSensitiveDebug: false }),
        loginMeta: loginMeta
      };
    } finally {
      lock.releaseLock();
    }
  }

  function bindCurrentKeyToCallsign(callsign) {
    return loginByIdentifierAndCallsign('', callsign || '');
  }

  function _rotationState_(source, keyAvailable, registered) {
    if (source === 'ACCESS-user-key-rotated') return 'rotated-and-promoted';
    if (source === 'ACCESS-user-key-current') return 'current-key-active';
    if (source === 'ACCESS-user-key-prev') return 'matched-previous-key';
    if (!registered && keyAvailable) return 'key-not-registered';
    if (!keyAvailable) return 'key-unavailable';
    return 'unknown';
  }

  function _buildPublicAccessResponse_(descriptor, context, policy, options) {
    const entry = descriptor.entry;
    const opts = options || {};
    const role = descriptor.role;
    const roleLevel = descriptor.roleLevel;
    const enabled = descriptor.enabled;
    const timedLocked = descriptor.timedLocked;
    const adminDisabled = descriptor.adminDisabled;
    const registered = descriptor.registered;
    const knownUser = descriptor.knownUser;

    const auditSource = descriptor.matchSource || descriptor.sourceType || 'unknown';

    return {
      identity: {
        email: context.sessionEmail || (entry && entry.email) || '',
        displayName: entry && entry.displayName ? String(entry.displayName) : '',
        personCallsign: entry && entry.personCallsign ? String(entry.personCallsign) : '',
        currentKeyHashFull: opts.includeSensitiveDebug ? (context.currentKeyHash || '') : '',
        currentKeyHashMasked: context.currentKeyHash ? maskSensitiveValue_(context.currentKeyHash) : ''
      },
      access: {
        role: role,
        enabled: enabled,
        registered: registered,
        knownUser: knownUser,
        readOnly: role === 'guest' || role === 'viewer' || timedLocked || adminDisabled,
        isAdmin: roleLevel >= ROLE_ORDER.admin && enabled,
        isMaintainer: roleLevel >= ROLE_ORDER.maintainer && enabled,
        isOperator: roleLevel >= ROLE_ORDER.operator && enabled
      },
      lockout: descriptor.lockoutState,
      login: {
        keyAvailable: !!context.currentKeyHash,
        selfBindRequired: !!context.currentKeyHash && !registered,
        canSelfBind: !!context.currentKeyHash && !registered,
        supportEmail: getPrimarySupportEmail_(),
        supportCallsign: getPrimarySupportCallsign_(),
        lockout: _getSelfBindLoginPublicState_(context.currentKeyHash)
      },
      policy: {
        mode: policy.mode,
        strictUserKeyMode: policy.strictUserKeyMode,
        migrationModeEnabled: policy.migrationModeEnabled,
        rotationPeriodDays: ROTATION_PERIOD_DAYS,
        automaticPromotionOnPreviousKeyMatch: true
      },
      audit: {
        source: auditSource,
        matchedBy: descriptor.matchedBy,
        lastSeenAt: entry && entry.lastSeenAt ? String(entry.lastSeenAt) : '',
        lastRotatedAt: entry && entry.lastRotatedAt ? String(entry.lastRotatedAt) : '',
        failedAttempts: entry && entry.failedAttempts ? entry.failedAttempts : 0
      },
      reason: {
        code: descriptor.reasonCode,
        message: descriptor.reasonMessage
      },
      reasonString: descriptor.reasonMessage,
      // Legacy compatibility fields (deprecated)
      email: context.sessionEmail || (entry && entry.email) || '',
      role: role,
      enabled: enabled,
      knownUser: knownUser,
      registered: registered,
      mode: policy.mode,
      strictUserKeyMode: policy.strictUserKeyMode,
      migrationModeEnabled: policy.migrationModeEnabled,
      readOnly: role === 'guest' || role === 'viewer' || timedLocked || adminDisabled,
      isAdmin: roleLevel >= ROLE_ORDER.admin && enabled,
      isOperator: roleLevel >= ROLE_ORDER.operator && enabled,
      isMaintainer: roleLevel >= ROLE_ORDER.maintainer && enabled,
      source: auditSource,
      matchedBy: descriptor.matchedBy,
      lastSeenAt: entry && entry.lastSeenAt ? String(entry.lastSeenAt) : '',
      lastRotatedAt: entry && entry.lastRotatedAt ? String(entry.lastRotatedAt) : '',
      failedAttempts: entry && entry.failedAttempts ? entry.failedAttempts : 0,
      keyAvailable: !!context.currentKeyHash,
      supportEmail: getPrimarySupportEmail_(),
      supportCallsign: getPrimarySupportCallsign_(),
      selfBindRequired: !!context.currentKeyHash && !registered,
      canSelfBind: !!context.currentKeyHash && !registered,
      loginLockout: _getSelfBindLoginPublicState_(context.currentKeyHash),
      rotationState: _rotationState_(auditSource, context.keyAvailable, registered),
      rotationPolicy: {
        rotationPeriodDays: ROTATION_PERIOD_DAYS,
        previousKeyColumn: 'user_key_prev_hash',
        currentKeyColumn: 'user_key_current_hash',
        emailBridgeEnabled: policy.migrationModeEnabled,
        automaticPromotionOnPreviousKeyMatch: true
      },
      allowedActions: listAllowedActionsForRole_(role)
    };
  }

  // ==================== MAIN DESCRIBE FUNCTION ====================

  function describe(emailOrOptions, maybeOptions) {
    const opts = (emailOrOptions && typeof emailOrOptions === 'object' && !Array.isArray(emailOrOptions))
      ? Object.assign({}, emailOrOptions)
      : Object.assign({}, maybeOptions || {});
    const email = (emailOrOptions && typeof emailOrOptions === 'object' && !Array.isArray(emailOrOptions))
      ? ''
      : emailOrOptions;

    const currentKeyHash = getCurrentUserKeyHash_();
    const sessionEmail = normalizeEmail_(email) || safeGetUserEmail_();
    const context = {
      currentKeyHash: currentKeyHash,
      sessionEmail: sessionEmail,
      keyAvailable: !!currentKeyHash,
      emailAvailable: !!sessionEmail
    };

    const policy = _getAccessPolicy_();
    const descriptor = _resolveAccessSubjectReadOnly_(context);

    return _buildPublicAccessResponse_(descriptor, context, policy, opts);
  }

  function _resolveEntryForAccessFailure_(context) {
    if (context.currentKeyHash) {
      const byKey = _findByUserKey_(context.currentKeyHash, { includeLocked: true, includeDisabled: true });
      if (byKey) return byKey;
    }
    if (context.sessionEmail) {
      const byEmail = _findByEmailInSheet_(context.sessionEmail, { includeLocked: true, includeDisabled: true });
      if (byEmail) return byEmail;
    }
    return null;
  }

  // ==================== ASSERT / ENFORCEMENT ====================

  function assertRoleAtLeast(requiredRole, actionLabel) {
    const descriptor = describe();
    const need = normalizeRole_(requiredRole || 'viewer');
    const currentRole = descriptor.role;
    const currentRoleLevel = ROLE_ORDER[currentRole] || 0;
    const requiredLevel = ROLE_ORDER[need] || 0;

    if (!descriptor.enabled || currentRoleLevel < requiredLevel) {
      Logger.log(`[AccessControl] Role denied: required ${need}, current ${currentRole}, action: ${actionLabel || 'unspecified'}`);

      if (typeof AccessEnforcement_ === 'object' && AccessEnforcement_.reportViolation) {
        AccessEnforcement_.reportViolation('roleDenied', {
          requiredRole: need,
          actionLabel: String(actionLabel || 'ця дія'),
          currentRole: currentRole,
          currentRoleLabel: getRoleLabel_(currentRole),
          locked: descriptor.lockout.locked,
          disabledByAdmin: descriptor.lockout.disabledByAdmin
        }, descriptor);
      }

      if (descriptor.lockout.disabledByAdmin) {
        throw new Error('Користувача вимкнено адміністратором.');
      }

      if (descriptor.lockout.locked) {
        throw new Error(
          'Доступ тимчасово заблоковано.' +
          (descriptor.lockout.remainingMinutes ? ` Залишилось ${descriptor.lockout.remainingMinutes} хв.` : '')
        );
      }

      throw new Error(
        'Недостатньо прав для дії: ' + (actionLabel || 'ця дія') +
        '. Поточна роль: ' + currentRole + '.'
      );
    }

    return descriptor;
  }

  // ==================== EMAIL ROLE LISTS ====================

  function listEmailsByRole(role) {
    const normalizedRole = normalizeRole_(role);
    const entries = _readSheetEntries_();
    return entries
      .filter(e => e.enabled && e.role === normalizedRole)
      .map(e => e.email);
  }

  function listAdminEmails() {
    const entries = _readSheetEntries_();
    return entries
      .filter(e => e.enabled && ['owner', 'sysadmin', 'admin'].includes(e.role))
      .map(e => e.email);
  }

  function listNotificationEmails() {
    const entries = _readSheetEntries_();
    return entries
      .filter(e => e.enabled && ['owner', 'sysadmin', 'admin'].includes(e.role))
      .map(e => e.email);
  }

  function getAccessRowByEmail(email) {
    const normalizedEmail = normalizeEmail_(email);
    if (!normalizedEmail) return null;
    return _findByEmailInSheet_(normalizedEmail, { includeLocked: true, includeDisabled: true });
  }

  // ==================== ROLE HELPERS ====================

  function getRoleMeta_(role) {
    return ROLE_METADATA[normalizeRole_(role)] || ROLE_METADATA.guest;
  }

  function getRoleLabel_(role) {
    return getRoleMeta_(role).label;
  }

  function getRoleNoteTemplate_(role) {
    return getRoleMeta_(role).note;
  }

  function listAllowedActionsForRole_(role) {
    switch (normalizeRole_(role)) {
      case 'guest': return ['безпечний перегляд'];
      case 'viewer': return ['власна картка'];
      case 'operator': return ['усі картки', 'коротке зведення', 'детальне зведення'];
      case 'maintainer': return ['усі дії operator', 'SEND_PANEL', 'робочі дії', 'діагностика'];
      case 'admin': return ['усі дії maintainer', 'керування ACCESS', 'журнали порушень'];
      case 'sysadmin': return ['усі дії admin', 'repair', 'protections', 'triggers'];
      case 'owner': return ['повний доступ до всієї системи'];
      default: return ['безпечний перегляд'];
    }
  }

  // ==================== VALIDATION & DIAGNOSTICS ====================

  function validateAccessSheet() {
    const entries = _readSheetEntries_();
    const rawEntries = _readRawSheetEntries_();
    const issues = [];

    const emailRows = {};
    const currentKeyRows = {};
    const prevKeyRows = {};

    entries.forEach(function (entry, index) {
      const rowNum = index + 2;

      if (entry.email) {
        if (!emailRows[entry.email]) emailRows[entry.email] = [];
        emailRows[entry.email].push(rowNum);
      }
      if (entry.userKeyCurrentHash) {
        if (!currentKeyRows[entry.userKeyCurrentHash]) currentKeyRows[entry.userKeyCurrentHash] = [];
        currentKeyRows[entry.userKeyCurrentHash].push(rowNum);
      }
      if (entry.userKeyPrevHash) {
        if (!prevKeyRows[entry.userKeyPrevHash]) prevKeyRows[entry.userKeyPrevHash] = [];
        prevKeyRows[entry.userKeyPrevHash].push(rowNum);
      }
    });

    entries.forEach(function (entry, index) {
      const rowNum = index + 2;

      if (entry.email) {
        if (!entry.email.includes('@')) {
          issues.push('Рядок ' + rowNum + ': некоректний email "' + entry.email + '"');
        }
        if ((emailRows[entry.email] || []).length > 1) {
          issues.push('Рядок ' + rowNum + ': дубль email "' + entry.email + '" (рядки ' + emailRows[entry.email].join(', ') + ')');
        }
      }

      if (entry.userKeyCurrentHash && (currentKeyRows[entry.userKeyCurrentHash] || []).length > 1) {
        issues.push('Рядок ' + rowNum + ': дубль current_key (рядки ' + currentKeyRows[entry.userKeyCurrentHash].join(', ') + ')');
      }

      if (entry.userKeyPrevHash && (prevKeyRows[entry.userKeyPrevHash] || []).length > 1) {
        issues.push('Рядок ' + rowNum + ': дубль prev_key (рядки ' + prevKeyRows[entry.userKeyPrevHash].join(', ') + ')');
      }

      if (entry.userKeyCurrentHash && entry.userKeyPrevHash && entry.userKeyCurrentHash === entry.userKeyPrevHash) {
        issues.push('Рядок ' + rowNum + ': current_key === prev_key');
      }

      if (entry.userKeyPrevHash && currentKeyRows[entry.userKeyPrevHash] && currentKeyRows[entry.userKeyPrevHash].length) {
        issues.push('Рядок ' + rowNum + ': prev_key збігається з current_key рядків ' + currentKeyRows[entry.userKeyPrevHash].join(', '));
      }

      if (entry.userKeyCurrentHash && prevKeyRows[entry.userKeyCurrentHash] && prevKeyRows[entry.userKeyCurrentHash].length) {
        issues.push('Рядок ' + rowNum + ': current_key збігається з prev_key рядків ' + prevKeyRows[entry.userKeyCurrentHash].join(', '));
      }
    });

    for (const raw of rawEntries) {
      const rowNum = raw.rowNumber;

      const roleCol = raw.headerMap.role;
      const rawRole = roleCol ? String(raw.rawRow[roleCol - 1] || '').trim().toLowerCase() : '';
      if (rawRole && !ROLE_VALUES.includes(rawRole)) {
        issues.push('Рядок ' + rowNum + ': некоректна роль "' + rawRole + '"');
      }

      const enabledCol = raw.headerMap.enabled;
      const rawEnabled = enabledCol ? String(raw.rawRow[enabledCol - 1] || '').trim().toLowerCase() : 'true';
      const isValidEnabled = ['true', 'false', '1', '0', 'yes', 'no', 'так', 'ні', ''].includes(rawEnabled);
      if (!isValidEnabled) {
        issues.push('Рядок ' + rowNum + ': некоректне значення enabled "' + rawEnabled + '"');
      }
    }

    return { valid: issues.length === 0, issues: issues };
  }

  function runAccessDiagnostics() {
    const policy = _getAccessPolicy_();
    const entries = _readSheetEntries_();
    const rawEntries = _readRawSheetEntries_();
    const sh = _getSheet_(false);
    const headerMap = sh ? _getHeaderMap_(sh) : {};

    const diagnostics = {
      schema: {
        exists: !!sh,
        headersPresent: SHEET_HEADERS.every(h => headerMap[h] !== undefined),
        missingHeaders: SHEET_HEADERS.filter(h => headerMap[h] === undefined),
        headersCanonical: sh ? sh.getRange(1, 1, 1, SHEET_HEADERS.length).getValues()[0].every((v, i) => v === SHEET_HEADERS[i]) : false
      },
      dataIntegrity: {
        duplicateEmails: [],
        duplicateCurrentKeys: [],
        duplicatePrevKeys: [],
        currentEqualsPrev: [],
        prevCollidesWithCurrent: [],
        emptyIdentifierWithActiveRole: [],
        invalidRoleValues: [],
        invalidEnabledValues: [],
        brokenLockedUntil: []
      },
      policy: {
        strictUserKeyMode: policy.strictUserKeyMode,
        migrationModeEnabled: policy.migrationModeEnabled,
        bootstrapAllowed: policy.bootstrapAllowed,
        adminConfigured: policy.adminConfigured,
        accessSheetPresent: policy.accessSheetPresent
      },
      runtime: {
        registeredKeysCount: entries.filter(e => e.userKeyCurrentHash || e.userKeyPrevHash).length,
        lockedUsersCount: entries.filter(e => _isTimedLocked_(e)).length,
        adminDisabledUsersCount: entries.filter(e => _isAdminDisabled_(e)).length,
        usersWithoutCurrentKey: entries.filter(e => !e.userKeyCurrentHash).length,
        usersWithOnlyIdentifierAccess: entries.filter(e => !e.userKeyCurrentHash && !e.userKeyPrevHash && (e.email || e.phone)).length,
        selfBindableUsersCount: entries.filter(e => e.enabled && e.selfBindAllowed && !!normalizeCallsign_(e.personCallsign)).length
      }
    };

    const emailMap = new Map();
    const currentKeyMap = new Map();
    const prevKeyMap = new Map();
    entries.forEach((e, idx) => {
      const row = idx + 2;
      if (e.email) {
        if (!emailMap.has(e.email)) emailMap.set(e.email, []);
        emailMap.get(e.email).push(row);
      }
      if (e.userKeyCurrentHash) {
        if (!currentKeyMap.has(e.userKeyCurrentHash)) currentKeyMap.set(e.userKeyCurrentHash, []);
        currentKeyMap.get(e.userKeyCurrentHash).push(row);
      }
      if (e.userKeyPrevHash) {
        if (!prevKeyMap.has(e.userKeyPrevHash)) prevKeyMap.set(e.userKeyPrevHash, []);
        prevKeyMap.get(e.userKeyPrevHash).push(row);
      }
    });

    entries.forEach((e, idx) => {
      const row = idx + 2;

      if (e.email && emailMap.get(e.email).length > 1) diagnostics.dataIntegrity.duplicateEmails.push({ email: e.email, rows: emailMap.get(e.email) });
      if (e.userKeyCurrentHash && currentKeyMap.get(e.userKeyCurrentHash).length > 1) diagnostics.dataIntegrity.duplicateCurrentKeys.push({ hash: e.userKeyCurrentHash, rows: currentKeyMap.get(e.userKeyCurrentHash) });
      if (e.userKeyPrevHash && prevKeyMap.get(e.userKeyPrevHash).length > 1) diagnostics.dataIntegrity.duplicatePrevKeys.push({ hash: e.userKeyPrevHash, rows: prevKeyMap.get(e.userKeyPrevHash) });
      if (e.userKeyCurrentHash && e.userKeyPrevHash && e.userKeyCurrentHash === e.userKeyPrevHash) diagnostics.dataIntegrity.currentEqualsPrev.push(row);
      if (e.userKeyPrevHash && currentKeyMap.has(e.userKeyPrevHash)) diagnostics.dataIntegrity.prevCollidesWithCurrent.push({ row: row, prevHash: e.userKeyPrevHash, collidesWithRows: currentKeyMap.get(e.userKeyPrevHash) });
      if (!e.email && !e.phone && e.role !== 'guest') diagnostics.dataIntegrity.emptyIdentifierWithActiveRole.push(row);
      if (e.lockedUntilMs && e.lockedUntilMs < _nowMs_() && e.lockedUntilMs > 0) diagnostics.dataIntegrity.brokenLockedUntil.push({ row: row, lockedUntilMs: e.lockedUntilMs });
    });

    for (const raw of rawEntries) {
      const rowNum = raw.rowNumber;

      const roleCol = raw.headerMap.role;
      const rawRole = roleCol ? String(raw.rawRow[roleCol - 1] || '').trim().toLowerCase() : '';
      if (rawRole && !ROLE_VALUES.includes(rawRole)) {
        diagnostics.dataIntegrity.invalidRoleValues.push({ row: rowNum, role: rawRole });
      }

      const enabledCol = raw.headerMap.enabled;
      const rawEnabled = enabledCol ? String(raw.rawRow[enabledCol - 1] || '').trim().toLowerCase() : 'true';
      const isValidEnabled = ['true', 'false', '1', '0', 'yes', 'no', 'так', 'ні', ''].includes(rawEnabled);
      if (!isValidEnabled) {
        diagnostics.dataIntegrity.invalidEnabledValues.push({ row: rowNum, enabled: rawEnabled });
      }
    }

    return diagnostics;
  }

  function getReadinessStatus() {
    const diag = runAccessDiagnostics();
    const policy = _getAccessPolicy_();

    const critical = [];
    const warnings = [];

    if (!diag.schema.exists) critical.push('ACCESS sheet missing');
    if (!diag.schema.headersPresent) critical.push('Missing headers: ' + diag.schema.missingHeaders.join(', '));
    if (diag.dataIntegrity.duplicateEmails.length) critical.push('Duplicate emails found');
    if (diag.dataIntegrity.duplicateCurrentKeys.length) critical.push('Duplicate current keys found');
    if (diag.dataIntegrity.invalidRoleValues.length) critical.push('Invalid role values found');
    if (!policy.adminConfigured && diag.schema.exists && diag.runtime.registeredKeysCount > 0) {
      warnings.push('No admin configured, but ACCESS has keys. Bootstrap will NOT activate.');
    }
    if (diag.runtime.usersWithoutCurrentKey > 0) {
      warnings.push(diag.runtime.usersWithoutCurrentKey + ' users have no current key');
    }

    return {
      ready: critical.length === 0,
      criticalIssues: critical,
      warnings: warnings,
      summary: {
        totalUsers: diag.runtime.registeredKeysCount,
        locked: diag.runtime.lockedUsersCount,
        adminDisabled: diag.runtime.adminDisabledUsersCount,
        mode: policy.strictUserKeyMode ? 'strict' : 'migration',
        bootstrapAvailable: policy.bootstrapAllowed
      }
    };
  }

  // ==================== SHEET UI ====================

  function bootstrapSheet() {
    const existed = !!_getSheet_(false);
    const sh = _getSheet_(true);
    _applyRoleValidation_(sh);
    _applyEmailValidation_(sh);
    _applyEnabledValidation_(sh);
    _invalidateAccessCaches_();
    return {
      success: true,
      sheet: ACCESS_SHEET,
      created: !existed,
      headers: SHEET_HEADERS.slice(),
      roleValues: ROLE_VALUES.slice()
    };
  }

  function refreshAccessSheetUi() {
    const sh = _getSheet_(true);
    _applyRoleValidation_(sh);
    _applyEmailValidation_(sh);
    _applyEnabledValidation_(sh);
    _invalidateAccessCaches_();
    return {
      success: true,
      sheet: ACCESS_SHEET,
      message: 'ACCESS schema updated',
      roleValues: ROLE_VALUES.slice()
    };
  }

  function handleAccessSheetEdit(e) {
    const range = e && e.range ? e.range : null;
    if (!range) return;

    const sh = range.getSheet();
    if (!sh || sh.getName() !== ACCESS_SHEET) return;

    const row = range.getRow();
    const column = range.getColumn();
    if (row < 2 || row > MAX_SHEET_ROWS) return;

    const headerMap = _getHeaderMap_(sh);
    const roleCol = headerMap.role;
    const emailCol = headerMap.email;

    if (roleCol && column === roleCol && range.getNumColumns() === 1 && range.getNumRows() === 1) {
      const rawRole = String(range.getValue() || '').trim();
      if (rawRole) range.setValue(normalizeRole_(rawRole));
      _syncRoleNoteForRow_(sh, row);
    }

    if (emailCol && column === emailCol && range.getNumColumns() === 1 && range.getNumRows() === 1) {
      const email = normalizeEmail_(range.getValue());
      if (email && email.indexOf('@') === -1) {
        range.setValue('');
        SpreadsheetApp.getActive().toast('Некоректний email', 'Помилка', 3);
      }
    }

    _invalidateAccessCaches_();
  }

  // ==================== TESTS ====================

  function _testAccessControl_() {
    const results = {
      passed: [],
      failed: [],
      summary: {}
    };

    function assert(condition, testName, details) {
      if (condition) {
        results.passed.push({ test: testName, details: details });
      } else {
        results.failed.push({ test: testName, details: details });
      }
    }

    // 1. Policy tests
    const policy = _getAccessPolicy_();
    assert(typeof policy.strictUserKeyMode === 'boolean', 'Policy has strictUserKeyMode', policy.strictUserKeyMode);
    assert(typeof policy.migrationModeEnabled === 'boolean', 'Policy has migrationModeEnabled', policy.migrationModeEnabled);
    assert(typeof policy.bootstrapAllowed === 'boolean', 'Policy has bootstrapAllowed', policy.bootstrapAllowed);
    assert(typeof policy.adminConfigured === 'boolean', 'Policy has adminConfigured', policy.adminConfigured);

    // 2. Role constants
    assert(ROLE_VALUES.length === 7, 'ROLE_VALUES has 7 items', ROLE_VALUES);
    assert(ROLE_ORDER.owner === 6, 'ROLE_ORDER.owner is 6', ROLE_ORDER.owner);
    assert(ROLE_ORDER.guest === 0, 'ROLE_ORDER.guest is 0', ROLE_ORDER.guest);

    // 3. Header constants
    assert(SHEET_HEADERS.includes('email'), 'SHEET_HEADERS includes email');
    assert(SHEET_HEADERS.includes('phone'), 'SHEET_HEADERS includes phone');
    assert(SHEET_HEADERS.includes('user_key_current_hash'), 'SHEET_HEADERS includes user_key_current_hash');
    assert(SHEET_HEADERS.length === 14, 'SHEET_HEADERS has 14 columns');

    // 4. Utility functions
    const hashed = hashRawUserKey_('test-key');
    assert(hashed && hashed.length === 64, 'hashRawUserKey returns 64-char hex', hashed);

    const masked = maskSensitiveValue_('1234567890abcdef');
    assert(masked.includes('…'), 'maskSensitiveValue masks long strings', masked);

    const normalized = normalizeRole_('ADMIN');
    assert(normalized === 'admin', 'normalizeRole converts to lowercase', normalized);

    const emailNorm = normalizeEmail_(' USER@DOMAIN.COM ');
    assert(emailNorm === 'user@domain.com', 'normalizeEmail trims and lowercases', emailNorm);

    // 5. Describe returns structured response
    const desc = describe();
    assert(desc.hasOwnProperty('identity'), 'describe returns identity block');
    assert(desc.hasOwnProperty('access'), 'describe returns access block');
    assert(desc.hasOwnProperty('lockout'), 'describe returns lockout block');
    assert(desc.hasOwnProperty('policy'), 'describe returns policy block');
    assert(desc.hasOwnProperty('audit'), 'describe returns audit block');
    assert(desc.hasOwnProperty('reason'), 'describe returns reason block');
    assert(desc.lockout.hasOwnProperty('locked'), 'lockout block has locked field');
    assert(!desc.lockout.hasOwnProperty('propKey'), 'lockout block does NOT contain propKey');
    assert(desc.reason.hasOwnProperty('code'), 'reason is an object with code');
    assert(desc.hasOwnProperty('reasonString'), 'reasonString exists for compatibility');

    // 6. ValidateAccessSheet returns structure
    const validation = validateAccessSheet();
    assert(validation.hasOwnProperty('valid'), 'validateAccessSheet returns valid flag');
    assert(validation.hasOwnProperty('issues'), 'validateAccessSheet returns issues array');

    // 7. Diagnostics returns structure
    const diag = runAccessDiagnostics();
    assert(diag.hasOwnProperty('schema'), 'diagnostics has schema');
    assert(diag.hasOwnProperty('dataIntegrity'), 'diagnostics has dataIntegrity');
    assert(diag.hasOwnProperty('policy'), 'diagnostics has policy');
    assert(diag.hasOwnProperty('runtime'), 'diagnostics has runtime');

    // 8. getReadinessStatus returns structure
    const readiness = getReadinessStatus();
    assert(readiness.hasOwnProperty('ready'), 'getReadinessStatus returns ready flag');
    assert(readiness.hasOwnProperty('criticalIssues'), 'getReadinessStatus returns criticalIssues');
    assert(readiness.hasOwnProperty('summary'), 'getReadinessStatus returns summary');

    results.summary = {
      total: results.passed.length + results.failed.length,
      passed: results.passed.length,
      failed: results.failed.length
    };

    Logger.log('=== ACCESS CONTROL TEST RESULTS ===');
    Logger.log('Passed:', results.passed.length);
    Logger.log('Failed:', results.failed.length);
    if (results.failed.length) {
      Logger.log('Failed tests:', results.failed);
    } else {
      Logger.log('✅ All tests passed!');
    }

    return results;
  }

  // ==================== EXPORTS ====================

  return {
    // Constants
    ROLE_ORDER: ROLE_ORDER,
    ROLE_VALUES: ROLE_VALUES,
    ROLE_METADATA: ROLE_METADATA,
    SHEET_HEADERS: SHEET_HEADERS,
    LOCKOUT_DURATION_MS: LOCKOUT_DURATION_MS,
    LOCKOUT_ESCALATION_MS: LOCKOUT_ESCALATION_MS,
    LOCKOUT_PROP_PREFIX: LOCKOUT_PROP_PREFIX,
    MAX_FAILED_ATTEMPTS_SHEET: MAX_FAILED_ATTEMPTS_SHEET,
    ROTATION_PERIOD_DAYS: ROTATION_PERIOD_DAYS,

    // Public API
    describe: describe,
    assertRoleAtLeast: assertRoleAtLeast,
    listBindableCallsigns: listBindableCallsigns,
    bindCurrentKeyToCallsign: bindCurrentKeyToCallsign,
    loginByIdentifierAndCallsign: loginByIdentifierAndCallsign,

    // Sheet management
    bootstrapSheet: bootstrapSheet,
    refreshAccessSheetUi: refreshAccessSheetUi,
    handleAccessSheetEdit: handleAccessSheetEdit,
    validateAccessSheet: validateAccessSheet,
    runAccessDiagnostics: runAccessDiagnostics,
    getReadinessStatus: getReadinessStatus,

    // Role/email helpers
    getAccessRowByEmail: getAccessRowByEmail,
    listAdminEmails: listAdminEmails,
    listNotificationEmails: listNotificationEmails,
    listEmailsByRole: listEmailsByRole,
    listAllowedActionsForRole: listAllowedActionsForRole_,

    // Role metadata
    getRoleLabel: getRoleLabel_,
    getRoleNoteTemplate: getRoleNoteTemplate_,
    normalizeRole: normalizeRole_,
    normalizeEmail: normalizeEmail_,
    normalizePhone: normalizePhone_,
    isMigrationBridgeEnabled: function () { return _getAccessPolicy_().migrationModeEnabled; },

    // Utilities
    hashRawUserKey: hashRawUserKey_,
    maskSensitiveValue: maskSensitiveValue_,

    // Internal (exposed for testing only)
    _getAccessPolicy: _getAccessPolicy_,
    _testAccessControl: _testAccessControl_
  };
})();

// ==================== GLOBAL WRAPPERS ====================

function bootstrapWasbAccessSheet() {
  return AccessControl_.bootstrapSheet();
}

function validateWasbAccessSheet() {
  return AccessControl_.validateAccessSheet();
}

function getWasbAccessReadiness() {
  return AccessControl_.getReadinessStatus();
}

function testWasbAccessControl() {
  if (AccessControl_._testAccessControl) {
    return AccessControl_._testAccessControl();
  }
  return { error: 'Test function not available' };
}

function testDiagnostics() {
  const diag = AccessControl_.runAccessDiagnostics();
  console.log(JSON.stringify(diag, null, 2));
}

// ==================== TEST HELPERS (for development only) ====================

function testAccessControl_() {
  const results = {
    passed: [],
    failed: [],
    summary: {}
  };

  // Helper to run test and collect results
  function assert(condition, testName, details) {
    if (condition) {
      results.passed.push({ test: testName, details: details });
    } else {
      results.failed.push({ test: testName, details: details });
    }
  }

  // 1. Policy tests
  const policy = AccessControl_._getAccessPolicy_();
  assert(typeof policy.strictUserKeyMode === 'boolean', 'Policy has strictUserKeyMode', policy.strictUserKeyMode);
  assert(typeof policy.migrationModeEnabled === 'boolean', 'Policy has migrationModeEnabled', policy.migrationModeEnabled);
  assert(typeof policy.bootstrapAllowed === 'boolean', 'Policy has bootstrapAllowed', policy.bootstrapAllowed);
  assert(typeof policy.adminConfigured === 'boolean', 'Policy has adminConfigured', policy.adminConfigured);

  // 2. Role constants
  assert(AccessControl_.ROLE_VALUES.length === 7, 'ROLE_VALUES has 7 items', AccessControl_.ROLE_VALUES);
  assert(AccessControl_.ROLE_ORDER.owner === 6, 'ROLE_ORDER.owner is 6', AccessControl_.ROLE_ORDER.owner);
  assert(AccessControl_.ROLE_ORDER.guest === 0, 'ROLE_ORDER.guest is 0', AccessControl_.ROLE_ORDER.guest);

  // 3. Header constants
  assert(AccessControl_.SHEET_HEADERS.includes('email'), 'SHEET_HEADERS includes email');
  assert(AccessControl_.SHEET_HEADERS.includes('phone'), 'SHEET_HEADERS includes phone');
  assert(AccessControl_.SHEET_HEADERS.includes('user_key_current_hash'), 'SHEET_HEADERS includes user_key_current_hash');
  assert(AccessControl_.SHEET_HEADERS.length === 14, 'SHEET_HEADERS has 14 columns');

  // 4. Utility functions
  const hashed = AccessControl_.hashRawUserKey('test-key');
  assert(hashed && hashed.length === 64, 'hashRawUserKey returns 64-char hex', hashed);

  const masked = AccessControl_.maskSensitiveValue('1234567890abcdef');
  assert(masked.includes('…'), 'maskSensitiveValue masks long strings', masked);

  const normalized = AccessControl_.normalizeRole('ADMIN');
  assert(normalized === 'admin', 'normalizeRole converts to lowercase', normalized);

  const emailNorm = AccessControl_.normalizeEmail(' USER@DOMAIN.COM ');
  assert(emailNorm === 'user@domain.com', 'normalizeEmail trims and lowercases', emailNorm);

  // 5. Describe returns structured response
  const desc = AccessControl_.describe();
  assert(desc.hasOwnProperty('identity'), 'describe returns identity block');
  assert(desc.hasOwnProperty('access'), 'describe returns access block');
  assert(desc.hasOwnProperty('lockout'), 'describe returns lockout block');
  assert(desc.hasOwnProperty('policy'), 'describe returns policy block');
  assert(desc.hasOwnProperty('audit'), 'describe returns audit block');
  assert(desc.hasOwnProperty('reason'), 'describe returns reason block');
  assert(desc.lockout.hasOwnProperty('locked'), 'lockout block has locked field');
  assert(!desc.lockout.hasOwnProperty('propKey'), 'lockout block does NOT contain propKey');

  // 6. Bootstrap condition
  const hasAdmin = policy.adminConfigured;
  const accessEmpty = policy.accessSheetPresent && AccessControl_.runAccessDiagnostics().runtime.registeredKeysCount === 0;
  const bootstrapShouldBe = (!hasAdmin && (accessEmpty || !policy.accessSheetPresent));
  assert(policy.bootstrapAllowed === bootstrapShouldBe, 'Bootstrap condition correct', {
    hasAdmin, accessEmpty, bootstrapAllowed: policy.bootstrapAllowed, expected: bootstrapShouldBe
  });

  // 7. ValidateAccessSheet returns structure
  const validation = AccessControl_.validateAccessSheet();
  assert(validation.hasOwnProperty('valid'), 'validateAccessSheet returns valid flag');
  assert(validation.hasOwnProperty('issues'), 'validateAccessSheet returns issues array');

  // 8. Diagnostics returns structure
  const diag = AccessControl_.runAccessDiagnostics();
  assert(diag.hasOwnProperty('schema'), 'diagnostics has schema');
  assert(diag.hasOwnProperty('dataIntegrity'), 'diagnostics has dataIntegrity');
  assert(diag.hasOwnProperty('policy'), 'diagnostics has policy');
  assert(diag.hasOwnProperty('runtime'), 'diagnostics has runtime');

  results.summary = {
    total: results.passed.length + results.failed.length,
    passed: results.passed.length,
    failed: results.failed.length
  };

  console.log('=== ACCESS CONTROL TEST RESULTS ===');
  console.log('Passed:', results.passed.length);
  console.log('Failed:', results.failed.length);
  if (results.failed.length) {
    console.log('Failed tests:', results.failed);
  } else {
    console.log('All tests passed!');
  }

  return results;
}

// Smoke test for critical path
function smokeTestAccessControl_() {
  const results = {
    describe: null,
    bootstrapSheet: null,
    validate: null,
    diagnostics: null
  };

  try {
    results.describe = AccessControl_.describe();
    results.validate = AccessControl_.validateAccessSheet();
    results.diagnostics = AccessControl_.runAccessDiagnostics();
    results.bootstrapSheet = AccessControl_.bootstrapSheet();
    results.allPassed = true;
  } catch (e) {
    results.allPassed = false;
    results.error = e.message;
  }

  console.log('=== SMOKE TEST ===');
  console.log('All functions executed:', results.allPassed);
  if (!results.allPassed) {
    console.error('Error:', results.error);
  }
  return results;
}

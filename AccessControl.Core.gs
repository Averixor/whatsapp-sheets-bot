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

// IIFE opener removed during runtime modularization
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
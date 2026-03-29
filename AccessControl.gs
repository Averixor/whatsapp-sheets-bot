/**
 * AccessControl.gs — strict user-key RBAC for WASB maintenance/admin actions.
 *
 * Active identity model:
 * - primary identity: Session.getTemporaryActiveUserKey()
 * - ACCESS stores current/previous user keys per user row
 * - email is not used as a normal fallback
 * - optional emergency migration bridge by email exists only behind an explicit script property
 */

const AccessControl_ = (function() {
  const ACCESS_SHEET = appGetCore('ACCESS_SHEET', 'ACCESS');
  const OWNER_PROP = 'WASB_ACCESS_OWNER_EMAILS';
  const SYSADMIN_PROP = 'WASB_ACCESS_SYSADMIN_EMAILS';
  const ADMIN_PROP = 'WASB_ACCESS_ADMIN_EMAILS';
  const MAINTAINER_PROP = 'WASB_ACCESS_MAINTAINER_EMAILS';
  const OPERATOR_PROP = 'WASB_ACCESS_OPERATOR_EMAILS';
  const VIEWER_PROP = 'WASB_ACCESS_VIEWER_EMAILS';
  const GUEST_PROP = 'WASB_ACCESS_GUEST_EMAILS';
  const MIGRATION_EMAIL_BRIDGE_PROP = 'WASB_ACCESS_MIGRATION_EMAIL_BRIDGE';

  function _legacyPropKey_(value) {
    return String(value || '').replace(/^WAS/, 'WAP');
  }

  function _getScriptPropertyCompat_(name) {
    const props = _getProperties_();
    const direct = props.getProperty(name);
    if (direct !== null && direct !== '') return direct;
    return props.getProperty(_legacyPropKey_(name));
  }
  const ROLE_ORDER = Object.freeze({ guest: 0, viewer: 1, operator: 2, maintainer: 3, admin: 4, sysadmin: 5, owner: 6 });
  const ROLE_VALUES = Object.freeze(['guest', 'viewer', 'operator', 'maintainer', 'admin', 'sysadmin', 'owner']);
  const ROLE_METADATA = Object.freeze({
    guest: Object.freeze({ label: 'Гість', note: 'Гість / Спостерігач • лише безпечний перегляд' }),
    viewer: Object.freeze({ label: 'Перегляд', note: 'Перегляд • тільки своя картка, без детального зведення' }),
    operator: Object.freeze({ label: 'Оператор', note: 'Оператор • робочий доступ до карток, зведень і SEND_PANEL' }),
    maintainer: Object.freeze({ label: 'Редактор', note: 'Редактор • розширений робочий доступ, перевірка і супровід' }),
    admin: Object.freeze({ label: 'Адмін', note: 'Адмін • керування доступом, журналами і системними інструментами' }),
    sysadmin: Object.freeze({ label: 'Сис. адмін', note: 'Сис. адмін • повне технічне обслуговування, repair і тригери' }),
    owner: Object.freeze({ label: 'Власник', note: 'Власник • повний root-доступ до всієї системи' })
  });
  const SHEET_HEADERS = Object.freeze([
    'email',
    'role',
    'enabled',
    'note',
    'display_name',
    'person_callsign',
    'user_key_current',
    'user_key_prev',
    'last_seen_at',
    'last_rotated_at'
  ]);
  const ROTATION_PERIOD_DAYS = 30;

  function normalizeEmail_(value) {
    return String(value || '').trim().toLowerCase();
  }

  function normalizeRole_(value) {
    const role = String(value || '').trim().toLowerCase();
    return ROLE_VALUES.indexOf(role) !== -1 ? role : 'guest';
  }

  function getRoleMeta_(role) {
    return ROLE_METADATA[normalizeRole_(role)] || ROLE_METADATA.guest;
  }

  function getRoleLabel_(role) {
    return getRoleMeta_(role).label;
  }

  function getRoleNoteTemplate_(role) {
    return getRoleMeta_(role).note;
  }

  function normalizeUserKey_(value) {
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

  function safeGetUserEmail_() {
    const candidates = [];
    try { candidates.push(Session.getActiveUser().getEmail()); } catch (_) {}
    try { candidates.push(Session.getEffectiveUser().getEmail()); } catch (_) {}
    for (let i = 0; i < candidates.length; i++) {
      const normalized = normalizeEmail_(candidates[i]);
      if (normalized && normalized.indexOf('@') !== -1) return normalized;
    }
    return '';
  }

  function safeGetUserKey_() {
    try {
      return normalizeUserKey_(Session.getTemporaryActiveUserKey());
    } catch (_) {
      return '';
    }
  }

  function _getProperties_() {
    return PropertiesService.getScriptProperties();
  }

  function _timezone_() {
    try { return Session.getScriptTimeZone() || 'Etc/GMT'; } catch (_) { return 'Etc/GMT'; }
  }

  function _nowText_() {
    return Utilities.formatDate(new Date(), _timezone_(), 'yyyy-MM-dd HH:mm:ss');
  }

  function _parseEmailsList_(value) {
    return String(value || '')
      .split(/[;,\s]+/)
      .map(normalizeEmail_)
      .filter(Boolean);
  }

  function listEmailsByRole(role) {
    const normalizedRole = normalizeRole_(role);
    const map = {
      owner: OWNER_PROP,
      sysadmin: SYSADMIN_PROP,
      admin: ADMIN_PROP,
      maintainer: MAINTAINER_PROP,
      operator: OPERATOR_PROP,
      viewer: VIEWER_PROP,
      guest: GUEST_PROP
    };
    return _parseEmailsList_(_getScriptPropertyCompat_(map[normalizedRole] || GUEST_PROP));
  }

  function listAdminEmails() {
    return listEmailsByRole('owner').concat(listEmailsByRole('sysadmin')).concat(listEmailsByRole('admin'));
  }

  function listNotificationEmails() {
    const seen = Object.create(null);
    const result = [];

    function push(email) {
      const normalized = normalizeEmail_(email);
      if (!normalized || seen[normalized]) return;
      seen[normalized] = true;
      result.push(normalized);
    }

    listAdminEmails().forEach(push);
    _readSheetEntries_().forEach(function(entry) {
      if (!entry.enabled) return;
      if (['admin', 'sysadmin', 'owner'].indexOf(entry.role) === -1) return;
      push(entry.email);
    });

    return result;
  }

  function getAccessRowByEmail(email) {
    const normalizedEmail = normalizeEmail_(email);
    if (!normalizedEmail) return null;
    return _findByEmailInSheet_(normalizedEmail) || _findInProperties_(normalizedEmail);
  }

  function _getSheet_(createIfMissing) {
    const ss = SpreadsheetApp.getActive();
    let sh = ss.getSheetByName(ACCESS_SHEET);
    if (!sh && createIfMissing) {
      sh = ss.insertSheet(ACCESS_SHEET);
    }
    if (sh) _ensureSheetSchema_(sh);
    return sh;
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
      ? sh.getRange(1, 1, 1, lastColumn).getValues()[0].map(function(value) { return String(value || '').trim(); })
      : [];

    let changed = false;
    if (!existingHeaders.length || existingHeaders.every(function(value) { return !value; })) {
      sh.getRange(1, 1, 1, SHEET_HEADERS.length).setValues([SHEET_HEADERS]);
      changed = true;
    } else {
      const existingMap = {};
      existingHeaders.forEach(function(value, index) {
        const normalized = String(value || '').trim().toLowerCase();
        if (normalized) existingMap[normalized] = index + 1;
      });
      SHEET_HEADERS.forEach(function(header) {
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
  }

  function _buildRoleValidationRule_() {
    return SpreadsheetApp.newDataValidation()
      .requireValueInList(ROLE_VALUES.slice(), true)
      .setAllowInvalid(false)
      .setHelpText('Оберіть роль: ' + ROLE_VALUES.join(', '))
      .build();
  }

  function _applyRoleValidation_(sh) {
    const startRow = 2;
    const endRow = 40;
    const roleCol = 2;
    const rule = _buildRoleValidationRule_();
    sh.getRange(startRow, roleCol, endRow - startRow + 1, 1).setDataValidation(rule);
    const maxRows = sh.getMaxRows();
    if (maxRows > endRow) {
      sh.getRange(endRow + 1, roleCol, maxRows - endRow, 1).clearDataValidations();
    }
  }

  function _syncRoleNoteForRow_(sh, rowNumber, clearWhenEmpty) {
    if (!sh || rowNumber < 2) return;
    const headerMap = _getHeaderMap_(sh);
    const roleCol = headerMap.role || 2;
    const noteCol = headerMap.note || 4;
    const role = normalizeRole_(sh.getRange(rowNumber, roleCol).getValue());
    const rawRole = String(sh.getRange(rowNumber, roleCol).getValue() || '').trim();
    const noteCell = sh.getRange(rowNumber, noteCol);
    if (!rawRole) {
      if (clearWhenEmpty) noteCell.clearContent();
      return;
    }
    noteCell.setValue(getRoleNoteTemplate_(role));
  }

  function _syncAllRoleNotes_(sh, forceRewrite) {
    if (!sh || sh.getLastRow() < 2) return;
    const headerMap = _getHeaderMap_(sh);
    const roleCol = headerMap.role || 2;
    const noteCol = headerMap.note || 4;
    const lastRow = Math.min(sh.getLastRow(), 40);
    const rowCount = Math.max(lastRow - 1, 0);
    if (!rowCount) return;
    const roles = sh.getRange(2, roleCol, rowCount, 1).getValues();
    const notesRange = sh.getRange(2, noteCol, rowCount, 1);
    const existingNotes = notesRange.getValues();
    const output = [];
    for (let i = 0; i < rowCount; i++) {
      const rawRole = String(roles[i][0] || '').trim();
      if (!rawRole) {
        output.push([forceRewrite ? '' : existingNotes[i][0]]);
        continue;
      }
      const normalizedRole = normalizeRole_(rawRole);
      const template = getRoleNoteTemplate_(normalizedRole);
      output.push([forceRewrite || !String(existingNotes[i][0] || '').trim() ? template : existingNotes[i][0]]);
    }
    notesRange.setValues(output);
  }

  function refreshAccessSheetUi(options) {
    const sh = _getSheet_(true);
    _applyRoleValidation_(sh);
    _syncAllRoleNotes_(sh, !!(options && options.forceRewriteNotes));
    return {
      success: true,
      sheet: ACCESS_SHEET,
      message: 'ACCESS оновлено: ролі, dropdown і службові описи синхронізовано',
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
    if (row < 2 || row > 40) return;
    if (column === 2 && range.getNumColumns() === 1 && range.getNumRows() === 1) {
      const rawRole = String(range.getValue() || '').trim();
      if (rawRole) range.setValue(normalizeRole_(rawRole));
      _syncRoleNoteForRow_(sh, row, true);
    }
  }

  function bootstrapSheet() {
    const existed = !!_getSheet_(false);
    const sh = _getSheet_(true);
    _applyRoleValidation_(sh);
    _syncAllRoleNotes_(sh, true);
    return {
      success: true,
      sheet: ACCESS_SHEET,
      created: !existed,
      message: existed
        ? 'Лист ACCESS перевірено, ролі оновлено, dropdown і службові описи застосовано'
        : 'Лист ACCESS створено, ролі оновлено, dropdown і службові описи застосовано',
      headers: SHEET_HEADERS.slice(),
      roleValues: ROLE_VALUES.slice()
    };
  }

  function _rowToEntry_(row, rowNumber, headerMap) {
    function read(header) {
      const column = headerMap[header];
      if (!column) return '';
      return row[column - 1];
    }

    return {
      email: normalizeEmail_(read('email')),
      role: normalizeRole_(read('role')),
      enabled: isEnabledValue_(read('enabled')),
      note: String(read('note') || ''),
      displayName: String(read('display_name') || ''),
      personCallsign: String(read('person_callsign') || '').trim(),
      userKeyCurrent: normalizeUserKey_(read('user_key_current')),
      userKeyPrev: normalizeUserKey_(read('user_key_prev')),
      lastSeenAt: String(read('last_seen_at') || ''),
      lastRotatedAt: String(read('last_rotated_at') || ''),
      source: ACCESS_SHEET,
      sheetRow: rowNumber
    };
  }

  function _readSheetEntries_() {
    const sh = _getSheet_(false);
    if (!sh || sh.getLastRow() < 2) return [];
    const headerMap = _getHeaderMap_(sh);
    const rowCount = sh.getLastRow() - 1;
    const colCount = Math.max(sh.getLastColumn(), SHEET_HEADERS.length);
    const values = sh.getRange(2, 1, rowCount, colCount).getValues();
    const result = [];

    for (let i = 0; i < values.length; i++) {
      result.push(_rowToEntry_(values[i], i + 2, headerMap));
    }
    return result;
  }

  function _writeEntryFields_(sheetRow, updates) {
    const sh = _getSheet_(false);
    if (!sh || !sheetRow || sheetRow < 2) return;
    const headerMap = _getHeaderMap_(sh);
    Object.keys(updates || {}).forEach(function(header) {
      const column = headerMap[header];
      if (!column) return;
      sh.getRange(sheetRow, column).setValue(updates[header]);
    });
  }

  function _findByUserKey_(userKey) {
    const normalizedKey = normalizeUserKey_(userKey);
    if (!normalizedKey) return null;
    const entries = _readSheetEntries_();
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (!entry.enabled) continue;
      if (entry.userKeyCurrent === normalizedKey) {
        return Object.assign({}, entry, { source: 'ACCESS-user-key-current', matchedBy: 'user_key_current' });
      }
      if (entry.userKeyPrev === normalizedKey) {
        return Object.assign({}, entry, { source: 'ACCESS-user-key-prev', matchedBy: 'user_key_prev' });
      }
    }
    return null;
  }

  function _findByEmailInSheet_(email) {
    const normalizedEmail = normalizeEmail_(email);
    if (!normalizedEmail) return null;
    const entries = _readSheetEntries_();
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (!entry.enabled) continue;
      if (entry.email === normalizedEmail) {
        return Object.assign({}, entry, { source: ACCESS_SHEET, matchedBy: 'email' });
      }
    }
    return null;
  }

  function _findInProperties_(email) {
    const normalizedEmail = normalizeEmail_(email);
    if (!normalizedEmail) return null;
    for (let i = ROLE_VALUES.length - 1; i >= 0; i--) {
      const role = ROLE_VALUES[i];
      if (listEmailsByRole(role).indexOf(normalizedEmail) !== -1) {
        return { email: normalizedEmail, role: role, enabled: true, note: getRoleNoteTemplate_(role), source: 'scriptProperties', matchedBy: 'email' };
      }
    }
    return null;
  }

  function _registeredKeysCount_() {
    return _readSheetEntries_().filter(function(entry) {
      return !!(entry.userKeyCurrent || entry.userKeyPrev);
    }).length;
  }

  function _configuredEntriesCount_() {
    let count = 0;
    ROLE_VALUES.forEach(function(role) {
      count += listEmailsByRole(role).length;
    });
    _readSheetEntries_().forEach(function(entry) {
      if (entry.email || entry.userKeyCurrent || entry.userKeyPrev || entry.displayName || entry.personCallsign) count += 1;
    });
    return count;
  }

  function _touchLastSeen_(entry, userKey) {
    if (!entry || !entry.sheetRow) return entry;
    const now = _nowText_();
    const updates = { last_seen_at: now };
    let source = entry.source || ACCESS_SHEET;

    if (userKey && entry.userKeyCurrent === userKey) {
      // last_seen_at only
    } else if (userKey && entry.userKeyPrev === userKey) {
      updates.user_key_prev = entry.userKeyCurrent || entry.userKeyPrev || '';
      updates.user_key_current = userKey;
      updates.last_rotated_at = now;
      source = 'ACCESS-user-key-rotated';
    }

    _writeEntryFields_(entry.sheetRow, updates);
    return Object.assign({}, entry, {
      userKeyCurrent: updates.user_key_current !== undefined ? updates.user_key_current : entry.userKeyCurrent,
      userKeyPrev: updates.user_key_prev !== undefined ? updates.user_key_prev : entry.userKeyPrev,
      lastSeenAt: now,
      lastRotatedAt: updates.last_rotated_at !== undefined ? updates.last_rotated_at : entry.lastRotatedAt,
      source: source
    });
  }

  function _bindCurrentUserKeyByEmail_(sessionEmail, currentKey) {
    const entry = _findByEmailInSheet_(sessionEmail);
    if (!entry || !entry.sheetRow || !entry.enabled) return null;
    const now = _nowText_();
    const updates = { last_seen_at: now };

    if (currentKey) {
      updates.user_key_current = currentKey;
      if (entry.userKeyCurrent && entry.userKeyCurrent !== currentKey) {
        updates.user_key_prev = entry.userKeyCurrent;
        updates.last_rotated_at = now;
      }
    }

    _writeEntryFields_(entry.sheetRow, updates);
    return Object.assign({}, entry, {
      userKeyCurrent: updates.user_key_current !== undefined ? updates.user_key_current : entry.userKeyCurrent,
      userKeyPrev: updates.user_key_prev !== undefined ? updates.user_key_prev : entry.userKeyPrev,
      lastSeenAt: now,
      lastRotatedAt: updates.last_rotated_at !== undefined ? updates.last_rotated_at : entry.lastRotatedAt,
      source: currentKey ? 'ACCESS-email-bound-key' : 'ACCESS-email-bridge',
      matchedBy: 'email-bridge'
    });
  }

  function isMigrationBridgeEnabled() {
    return parseBoolean_(_getScriptPropertyCompat_(MIGRATION_EMAIL_BRIDGE_PROP), false);
  }

  function listAllowedActionsForRole_(role) {
    switch (normalizeRole_(role)) {
      case 'guest':
        return ['безпечний перегляд'];
      case 'viewer':
        return ['список особового складу', 'власна картка', 'коротке зведення'];
      case 'operator':
        return ['усі картки', 'коротке зведення', 'детальне зведення', 'SEND_PANEL', 'робочі дії'];
      case 'maintainer':
        return ['усі дії operator', 'діагностика', 'перевірка стану системи', 'перегляд pending repairs'];
      case 'admin':
        return ['усі дії maintainer', 'керування ACCESS', 'журнали порушень', 'адмін-дії'];
      case 'sysadmin':
        return ['усі дії admin', 'repair', 'protections', 'triggers', 'кеші', 'технічне обслуговування'];
      case 'owner':
        return ['повний доступ до всієї системи'];
      default:
        return ['безпечний перегляд'];
    }
  }

  function _rotationState_(source, keyAvailable, registered) {
    if (source === 'ACCESS-user-key-rotated') return 'rotated-and-promoted';
    if (source === 'ACCESS-user-key-current') return 'current-key-active';
    if (source === 'ACCESS-user-key-prev') return 'matched-previous-key';
    if (!registered && keyAvailable) return 'key-not-registered';
    if (!keyAvailable) return 'key-unavailable';
    return 'unknown';
  }

  function describe(email) {
    const currentKey = safeGetUserKey_();
    const sessionEmail = normalizeEmail_(email) || safeGetUserEmail_();
    const keyAvailable = !!currentKey;
    const emailAvailable = !!sessionEmail;
    const registeredKeysCount = _registeredKeysCount_();
    const configuredEntries = _configuredEntriesCount_();
    const migrationModeEnabled = isMigrationBridgeEnabled();
    const userKeyModeEnabled = configuredEntries > 0;

    let match = null;
    let mode = migrationModeEnabled ? 'user-key+email-bridge' : 'strict-user-key';

    if (keyAvailable) {
      match = _findByUserKey_(currentKey);
      if (match) match = _touchLastSeen_(match, currentKey);
    }

    if (!match && migrationModeEnabled && emailAvailable) {
      if (keyAvailable) {
        match = _bindCurrentUserKeyByEmail_(sessionEmail, currentKey);
      }
      if (!match) {
        const sheetEntry = _findByEmailInSheet_(sessionEmail);
        const propEntry = !sheetEntry ? _findInProperties_(sessionEmail) : null;
        match = sheetEntry || propEntry;
        if (match && match.sheetRow) {
          match = _touchLastSeen_(match, currentKey || '');
          match.source = match.source === ACCESS_SHEET ? 'ACCESS-email-bridge' : match.source;
          match.matchedBy = 'email-bridge';
        } else if (match) {
          match = Object.assign({}, match, { source: 'scriptProperties-email-bridge', matchedBy: 'email-bridge' });
        }
      }
    }

    if (!match && configuredEntries === 0 && (keyAvailable || emailAvailable)) {
      return {
        email: sessionEmail,
        currentKey: currentKey,
        role: 'owner',
        enabled: true,
        knownUser: true,
        registered: false,
        keyAvailable: keyAvailable,
        emailAvailable: emailAvailable,
        readOnly: false,
        isAdmin: true,
        isOperator: true,
        isMaintainer: true,
        source: 'bootstrap-owner',
        note: '',
        displayName: '',
        personCallsign: '',
        accessSheet: ACCESS_SHEET,
        reason: 'RBAC ще не налаштовано. Поточний користувач тимчасово працює як bootstrap-owner, поки ACCESS порожній.',
        adminEmailsConfigured: 0,
        availableRoles: ROLE_VALUES.slice(),
        userKeyModeEnabled: false,
        migrationModeEnabled: migrationModeEnabled,
        mode: 'bootstrap-owner',
        registeredKeysCount: registeredKeysCount,
        rotationState: 'bootstrap',
        rotationPolicy: {
          rotationPeriodDays: ROTATION_PERIOD_DAYS,
          previousKeyColumn: 'user_key_prev',
          currentKeyColumn: 'user_key_current',
          emailBridgeEnabled: migrationModeEnabled,
          automaticPromotionOnPreviousKeyMatch: true
        },
        allowedActions: listAllowedActionsForRole_('owner')
      };
    }

    const role = match ? normalizeRole_(match.role) : 'guest';
    const enabled = match ? match.enabled !== false : true;
    const registered = !!match && (match.source !== 'bootstrap-owner');
    const knownUser = !!match;
    const readOnly = (role === 'guest' || role === 'viewer');

    let reason = '';
    if (!registered && userKeyModeEnabled && !keyAvailable) {
      reason = migrationModeEnabled
        ? 'Сеанс не віддав temporary user key, а аварійний email-міст не підтвердив користувача. Доступ знижено до safe-mode.'
        : 'Ключ поточного користувача недоступний; strict user key-режим не може підтвердити доступ.';
    } else if (!registered && userKeyModeEnabled && keyAvailable) {
      reason = migrationModeEnabled
        ? 'Поточний user key не знайдено в ACCESS, а аварійний email-міст не підтвердив користувача. Доступ знижено до safe-mode.'
        : 'Поточний user key не зареєстровано в ACCESS. Неявні fallback-схеми вимкнено.';
    } else if (!registered && !userKeyModeEnabled) {
      reason = 'ACCESS ще не налаштовано або в ньому немає жодного активного запису.';
    }

    return {
      email: sessionEmail || (match && match.email) || '',
      currentKey: currentKey,
      role: role,
      enabled: enabled,
      knownUser: knownUser,
      registered: registered,
      keyAvailable: keyAvailable,
      emailAvailable: emailAvailable,
      readOnly: readOnly,
      isAdmin: (ROLE_ORDER[role] || 0) >= ROLE_ORDER.admin && enabled,
      isOperator: (ROLE_ORDER[role] || 0) >= ROLE_ORDER.operator && enabled,
      isMaintainer: (ROLE_ORDER[role] || 0) >= ROLE_ORDER.maintainer && enabled,
      source: match ? match.source : (userKeyModeEnabled ? 'ACCESS-user-key-unregistered' : 'default'),
      note: match && match.note ? String(match.note) : (registered ? getRoleNoteTemplate_(role) : ''),
      displayName: match && match.displayName ? String(match.displayName) : '',
      personCallsign: match && match.personCallsign ? String(match.personCallsign) : '',
      accessSheet: ACCESS_SHEET,
      reason: reason,
      adminEmailsConfigured: listAdminEmails().length,
      availableRoles: ROLE_VALUES.slice(),
      userKeyModeEnabled: userKeyModeEnabled,
      migrationModeEnabled: migrationModeEnabled,
      strictUserKeyMode: userKeyModeEnabled && !migrationModeEnabled,
      mode: mode,
      registeredKeysCount: registeredKeysCount,
      lastSeenAt: match && match.lastSeenAt ? String(match.lastSeenAt) : '',
      lastRotatedAt: match && match.lastRotatedAt ? String(match.lastRotatedAt) : '',
      rotationState: _rotationState_(match && match.source, keyAvailable, registered),
      rotationPolicy: {
        rotationPeriodDays: ROTATION_PERIOD_DAYS,
        previousKeyColumn: 'user_key_prev',
        currentKeyColumn: 'user_key_current',
        emailBridgeEnabled: migrationModeEnabled,
        automaticPromotionOnPreviousKeyMatch: true
      },
      allowedActions: listAllowedActionsForRole_(role)
    };
  }

  function assertRoleAtLeast(requiredRole, actionLabel) {
    const descriptor = describe();
    const need = normalizeRole_(requiredRole || 'viewer');
    const current = normalizeRole_(descriptor.role);
    if (!descriptor.enabled || (ROLE_ORDER[current] || 0) < (ROLE_ORDER[need] || 0)) {
      try {
        if (typeof AccessEnforcement_ === 'object' && AccessEnforcement_.reportViolation) {
          AccessEnforcement_.reportViolation('roleDenied', {
            requiredRole: need,
            actionLabel: String(actionLabel || 'ця дія'),
            currentRole: current,
            currentRoleLabel: getRoleLabel_(current)
          }, descriptor);
        }
      } catch (_) {}
      const label = String(actionLabel || 'ця дія');
      throw new Error('Недостатньо прав для дії: ' + label + '. Поточна роль: ' + current + '.');
    }
    return descriptor;
  }

  return {
    ROLE_ORDER: ROLE_ORDER,
    ROLE_VALUES: ROLE_VALUES,
    ROLE_METADATA: ROLE_METADATA,
    SHEET_HEADERS: SHEET_HEADERS,
    describe: describe,
    assertRoleAtLeast: assertRoleAtLeast,
    bootstrapSheet: bootstrapSheet,
    refreshAccessSheetUi: refreshAccessSheetUi,
    handleAccessSheetEdit: handleAccessSheetEdit,
    listAdminEmails: listAdminEmails,
    listNotificationEmails: listNotificationEmails,
    listEmailsByRole: listEmailsByRole,
    listAllowedActionsForRole: listAllowedActionsForRole_,
    getAccessRowByEmail: getAccessRowByEmail,
    getRoleLabel: getRoleLabel_,
    getRoleNoteTemplate: getRoleNoteTemplate_,
    normalizeRole: normalizeRole_,
    normalizeEmail: normalizeEmail_,
    normalizeUserKey: normalizeUserKey_,
    safeGetUserEmail: safeGetUserEmail_,
    safeGetUserKey: safeGetUserKey_,
    isMigrationBridgeEnabled: isMigrationBridgeEnabled
  };
})();

function bootstrapWapbAccessSheet() {
  return AccessControl_.bootstrapSheet();
}

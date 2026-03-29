/**
 * AccessControl.gs — lightweight RBAC for WAPB maintenance/admin actions.
 *
 * Stage 7.1 user-key access model:
 * - primary identity: Session.getTemporaryActiveUserKey()
 * - ACCESS stores current/previous user keys per user row
 * - legacy email-based behavior is retained only as a migration bridge while
 *   ACCESS does not contain any registered user keys yet.
 */

const AccessControl_ = (function() {
  const ACCESS_SHEET = appGetCore('ACCESS_SHEET', 'ACCESS');
  const SYSADMIN_PROP = 'WAPB_ACCESS_SYSADMIN_EMAILS';
  const ADMIN_PROP = 'WAPB_ACCESS_ADMIN_EMAILS';
  const OPERATOR_PROP = 'WAPB_ACCESS_OPERATOR_EMAILS';
  const VIEWER_PROP = 'WAPB_ACCESS_VIEWER_EMAILS';
  const ROLE_ORDER = Object.freeze({ viewer: 0, operator: 1, admin: 2, sysadmin: 3 });
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

  function normalizeEmail_(value) {
    return String(value || '').trim().toLowerCase();
  }

  function normalizeRole_(value) {
    const role = String(value || '').trim().toLowerCase();
    if (role === 'sysadmin' || role === 'admin' || role === 'operator' || role === 'viewer') return role;
    return 'viewer';
  }

  function normalizeUserKey_(value) {
    return String(value || '').trim();
  }

  function isEnabledValue_(value) {
    const raw = String(value === '' || value === null ? 'TRUE' : value).trim().toLowerCase();
    return !(raw === 'false' || raw === '0' || raw === 'no' || raw === 'ні');
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

  function _parseEmailsList_(value) {
    return String(value || '')
      .split(/[;,\s]+/)
      .map(normalizeEmail_)
      .filter(Boolean);
  }

  function listEmailsByRole(role) {
    const normalizedRole = normalizeRole_(role);
    const propName = normalizedRole === 'sysadmin'
      ? SYSADMIN_PROP
      : (normalizedRole === 'admin' ? ADMIN_PROP : (normalizedRole === 'operator' ? OPERATOR_PROP : VIEWER_PROP));
    return _parseEmailsList_(_getProperties_().getProperty(propName));
  }

  function listAdminEmails() {
    return listEmailsByRole('sysadmin').concat(listEmailsByRole('admin'));
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
      if (entry.role !== 'admin' && entry.role !== 'sysadmin') return;
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

  function bootstrapSheet() {
    const existed = !!_getSheet_(false);
    const sh = _getSheet_(true);
    return {
      success: true,
      sheet: ACCESS_SHEET,
      created: !existed,
      message: existed
        ? 'Лист ACCESS перевірено й оновлено під user key-доступ'
        : 'Лист ACCESS створено та підготовлено під user key-доступ',
      headers: SHEET_HEADERS.slice()
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
    if (listEmailsByRole('sysadmin').indexOf(normalizedEmail) !== -1) {
      return { email: normalizedEmail, role: 'sysadmin', enabled: true, note: '', source: 'scriptProperties', matchedBy: 'email' };
    }
    if (listEmailsByRole('admin').indexOf(normalizedEmail) !== -1) {
      return { email: normalizedEmail, role: 'admin', enabled: true, note: '', source: 'scriptProperties', matchedBy: 'email' };
    }
    if (listEmailsByRole('operator').indexOf(normalizedEmail) !== -1) {
      return { email: normalizedEmail, role: 'operator', enabled: true, note: '', source: 'scriptProperties', matchedBy: 'email' };
    }
    if (listEmailsByRole('viewer').indexOf(normalizedEmail) !== -1) {
      return { email: normalizedEmail, role: 'viewer', enabled: true, note: '', source: 'scriptProperties', matchedBy: 'email' };
    }
    return null;
  }

  function _registeredKeysCount_() {
    return _readSheetEntries_().filter(function(entry) {
      return !!(entry.userKeyCurrent || entry.userKeyPrev);
    }).length;
  }

  function _configuredEntriesCount_() {
    let count = listEmailsByRole('sysadmin').length + listEmailsByRole('admin').length + listEmailsByRole('operator').length + listEmailsByRole('viewer').length;
    _readSheetEntries_().forEach(function(entry) {
      if (entry.email || entry.userKeyCurrent || entry.userKeyPrev || entry.displayName || entry.personCallsign) count += 1;
    });
    return count;
  }

  function _listEnabledSheetEntries_() {
    return _readSheetEntries_().filter(function(entry) { return entry.enabled; });
  }

  function _resolveLegacyFallback_() {
    const sheetEntries = _listEnabledSheetEntries_();

    const sysadmins = sheetEntries.filter(function(item) { return item.role === 'sysadmin'; });
    if (sysadmins.length === 1) {
      return Object.assign({}, sysadmins[0], { source: 'ACCESS-fallback-sysadmin' });
    }

    const admins = sheetEntries.filter(function(item) { return item.role === 'admin'; });
    if (admins.length === 1) {
      return Object.assign({}, admins[0], { source: 'ACCESS-fallback-admin' });
    }

    return null;
  }

  function _touchLastSeen_(entry, userKey) {
    if (!entry || !entry.sheetRow) return entry;
    const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Etc/GMT', 'yyyy-MM-dd HH:mm:ss');
    const updates = { last_seen_at: now };
    let source = entry.source || ACCESS_SHEET;

    if (userKey && entry.userKeyCurrent === userKey) {
      // only update last seen
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
    if (!entry || !entry.sheetRow || !currentKey || !entry.enabled) return null;
    const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Etc/GMT', 'yyyy-MM-dd HH:mm:ss');
    const updates = {
      user_key_current: currentKey,
      last_seen_at: now
    };
    if (entry.userKeyCurrent && entry.userKeyCurrent !== currentKey) {
      updates.user_key_prev = entry.userKeyCurrent;
      updates.last_rotated_at = now;
    }
    _writeEntryFields_(entry.sheetRow, updates);
    return Object.assign({}, entry, {
      userKeyCurrent: currentKey,
      userKeyPrev: updates.user_key_prev !== undefined ? updates.user_key_prev : entry.userKeyPrev,
      lastSeenAt: now,
      lastRotatedAt: updates.last_rotated_at !== undefined ? updates.last_rotated_at : entry.lastRotatedAt,
      source: 'ACCESS-email-bound-key',
      matchedBy: 'email'
    });
  }

  function describe(email) {
    const currentKey = safeGetUserKey_();
    const sessionEmail = normalizeEmail_(email) || safeGetUserEmail_();
    const keyAvailable = !!currentKey;
    const emailAvailable = !!sessionEmail;
    const registeredKeysCount = _registeredKeysCount_();
    const configuredEntries = _configuredEntriesCount_();
    const userKeyModeEnabled = registeredKeysCount > 0;

    let match = null;
    let mode = userKeyModeEnabled ? 'user-key' : 'legacy-email';

    if (keyAvailable) {
      match = _findByUserKey_(currentKey);
      if (match) {
        match = _touchLastSeen_(match, currentKey);
      }
    }

    if (!match && keyAvailable && emailAvailable) {
      match = _bindCurrentUserKeyByEmail_(sessionEmail, currentKey);
      if (match) {
        mode = 'user-key';
      }
    }

    if (!match && !userKeyModeEnabled) {
      const sheetEntry = emailAvailable ? _findByEmailInSheet_(sessionEmail) : null;
      const propEntry = !sheetEntry && emailAvailable ? _findInProperties_(sessionEmail) : null;
      match = sheetEntry || propEntry;
      if (!match && !emailAvailable) {
        match = _resolveLegacyFallback_();
      }
      mode = 'legacy-email';
    }

    if (!match && configuredEntries === 0 && (keyAvailable || emailAvailable)) {
      return {
        email: sessionEmail,
        currentKey: currentKey,
        role: 'sysadmin',
        enabled: true,
        knownUser: true,
        registered: false,
        keyAvailable: keyAvailable,
        emailAvailable: emailAvailable,
        readOnly: false,
        isAdmin: true,
        isOperator: true,
        source: 'bootstrap-admin',
        note: '',
        displayName: '',
        personCallsign: '',
        accessSheet: ACCESS_SHEET,
        reason: 'RBAC ще не налаштовано. Поточний користувач тимчасово працює як bootstrap-admin, поки не буде заповнено ACCESS.',
        adminEmailsConfigured: 0,
        availableRoles: Object.keys(ROLE_ORDER),
        userKeyModeEnabled: userKeyModeEnabled,
        mode: mode,
        registeredKeysCount: registeredKeysCount
      };
    }

    const role = match ? normalizeRole_(match.role) : 'viewer';
    const enabled = match ? match.enabled !== false : true;
    const registered = !!match;
    const knownUser = registered;
    const readOnly = role === 'viewer';

    let reason = '';
    if (!registered && userKeyModeEnabled && !keyAvailable) {
      reason = 'Ключ поточного користувача недоступний; доступ переведено в safe-mode перегляду.';
    } else if (!registered && userKeyModeEnabled && keyAvailable) {
      reason = 'Поточний ключ користувача не зареєстровано в ACCESS. Доступ переведено в safe-mode перегляду.';
    } else if (!registered && !userKeyModeEnabled && !emailAvailable) {
      reason = 'Email користувача недоступний; небезпечні дії переведені в safe-mode.';
    } else if (!registered && !userKeyModeEnabled) {
      reason = 'Роль не налаштовано. Доступ до maintenance-операцій заборонено.';
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
      isAdmin: (role === 'admin' || role === 'sysadmin') && enabled,
      isOperator: (ROLE_ORDER[role] || 0) >= ROLE_ORDER.operator && enabled,
      source: match ? match.source : (userKeyModeEnabled ? 'ACCESS-user-key-unregistered' : 'default'),
      note: match && match.note ? String(match.note) : '',
      displayName: match && match.displayName ? String(match.displayName) : '',
      personCallsign: match && match.personCallsign ? String(match.personCallsign) : '',
      accessSheet: ACCESS_SHEET,
      reason: reason,
      adminEmailsConfigured: listAdminEmails().length,
      availableRoles: Object.keys(ROLE_ORDER),
      userKeyModeEnabled: userKeyModeEnabled,
      mode: mode,
      registeredKeysCount: registeredKeysCount,
      lastSeenAt: match && match.lastSeenAt ? String(match.lastSeenAt) : '',
      lastRotatedAt: match && match.lastRotatedAt ? String(match.lastRotatedAt) : ''
    };
  }

  function assertRoleAtLeast(requiredRole, actionLabel) {
    const descriptor = describe();
    const need = normalizeRole_(requiredRole || 'viewer');
    const current = normalizeRole_(descriptor.role);
    if (!descriptor.enabled || (ROLE_ORDER[current] || 0) < (ROLE_ORDER[need] || 0)) {
      const label = String(actionLabel || 'ця дія');
      throw new Error('Недостатньо прав для дії: ' + label + '. Поточна роль: ' + current + '.');
    }
    return descriptor;
  }

  return {
    ROLE_ORDER: ROLE_ORDER,
    SHEET_HEADERS: SHEET_HEADERS,
    describe: describe,
    assertRoleAtLeast: assertRoleAtLeast,
    bootstrapSheet: bootstrapSheet,
    listAdminEmails: listAdminEmails,
    listNotificationEmails: listNotificationEmails,
    listEmailsByRole: listEmailsByRole,
    getAccessRowByEmail: getAccessRowByEmail,
    normalizeRole: normalizeRole_,
    normalizeEmail: normalizeEmail_,
    normalizeUserKey: normalizeUserKey_,
    safeGetUserEmail: safeGetUserEmail_,
    safeGetUserKey: safeGetUserKey_
  };
})();

function bootstrapWapbAccessSheet() {
  return AccessControl_.bootstrapSheet();
}

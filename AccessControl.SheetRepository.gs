// ==================== AccessControl.SheetRepository.gs ====================

/**
 * Безпечний варіант для WASB без повторного оголошення глобальних ідентифікаторів.
 * Очікує, що в проєкті вже існують:
 * ACCESS_SHEET, SHEET_HEADERS, ROLE_VALUES,
 * normalizeEmail_, normalizePhone_, normalizeRole_, normalizeCallsign_,
 * isEnabledValue_, isSelfBindAllowedValue_, normalizeStoredHash_,
 * getRoleNoteTemplate_, _invalidateAccessCaches_
*/

function _accessRepoGlobal_() {
  try {
    if (typeof globalThis !== 'undefined') return globalThis;
  } catch (e) {}
  try {
    return this;
  } catch (e) {}
  return {};
}

function _accessRepoState_() {
  var root = _accessRepoGlobal_();
  if (!root.__WASB_ACCESS_REPO_STATE__ || typeof root.__WASB_ACCESS_REPO_STATE__ !== 'object') {
    root.__WASB_ACCESS_REPO_STATE__ = {
      sheetCache: null,
      entriesCache: null
    };
  }
  return root.__WASB_ACCESS_REPO_STATE__;
}

function _accessRepoGetSheetCache_() {
  return _accessRepoState_().sheetCache || null;
}

function _accessRepoSetSheetCache_(value) {
  _accessRepoState_().sheetCache = value || null;
}

function _accessRepoGetEntriesCache_() {
  return _accessRepoState_().entriesCache || null;
}

function _accessRepoSetEntriesCache_(value) {
  _accessRepoState_().entriesCache = value || null;
}

function _accessRepoResetLocalCaches_() {
  _accessRepoSetSheetCache_(null);
  _accessRepoSetEntriesCache_(null);
}

function _accessRepoMaxSheetRows_() {
  try {
    if (typeof MAX_SHEET_ROWS !== 'undefined') {
      var configured = Number(MAX_SHEET_ROWS);
      if (isFinite(configured) && configured > 0) return configured;
    }
  } catch (e) {}
  return 1000;
}

function _getExpectedHeaders_() {
  return Array.isArray(SHEET_HEADERS) ? SHEET_HEADERS.slice() : [];
}

function _getSafeMaxSheetRows_(sh) {
  if (!sh) return 0;

  var configured = _accessRepoMaxSheetRows_();
  var actual = Number(sh.getMaxRows()) || 0;

  if (configured > 0 && actual > 0) return Math.min(configured, actual);
  if (configured > 0) return configured;
  return actual;
}

function _logAccessRepo_(message, error) {
  try {
    if (error) {
      Logger.log('[AccessControl.SheetRepository] ' + message + ': ' + (error && error.message ? error.message : error));
    } else {
      Logger.log('[AccessControl.SheetRepository] ' + message);
    }
  } catch (e) {}
}

function _invalidateAccessRepoCachesSafe_(options) {
  _accessRepoResetLocalCaches_();

  try {
    if (typeof _invalidateAccessCaches_ === 'function') {
      _invalidateAccessCaches_(options || {});
    }
  } catch (e) {
    _logAccessRepo_('Cache invalidation warning', e);
  }
}

// ==================== SHEET OPERATIONS (HEADER-BASED SAFE READS/WRITES) ====================

function _getSheet_(createIfMissing) {
  var cached = _accessRepoGetSheetCache_();
  if (cached) {
    try {
      if (cached.getParent()) return cached;
    } catch (e) {
      _accessRepoSetSheetCache_(null);
    }
  }

  var ss = SpreadsheetApp.getActive();
  if (!ss) return null;

  var sh = ss.getSheetByName(ACCESS_SHEET);

  if (!sh && createIfMissing) {
    sh = ss.insertSheet(ACCESS_SHEET);
    _logAccessRepo_('Created ACCESS sheet');
    _ensureSheetSchema_(sh);
    _invalidateAccessRepoCachesSafe_({ resetSheet: true });
  } else if (sh && createIfMissing) {
    _ensureSheetSchema_(sh);
  }

  _accessRepoSetSheetCache_(sh || null);
  return _accessRepoGetSheetCache_();
}

function _getHeaderMap_(sh) {
  if (!sh) return {};

  var lastColumn = Number(sh.getLastColumn()) || 0;
  if (lastColumn < 1) return {};

  var expectedHeaders = _getExpectedHeaders_();
  var columnsToRead = Math.max(lastColumn, expectedHeaders.length, 1);
  var headers = sh.getRange(1, 1, 1, columnsToRead).getValues()[0];

  var map = {};
  for (var i = 0; i < headers.length; i++) {
    var key = String(headers[i] || '').trim().toLowerCase();
    if (key) map[key] = i + 1;
  }
  return map;
}

function _ensureSheetSchema_(sh) {
  if (!sh) return;

  var expectedHeaders = _getExpectedHeaders_();
  if (!expectedHeaders.length) return;

  var currentLastColumn = Number(sh.getLastColumn()) || 0;
  var currentLastRow = Number(sh.getLastRow()) || 0;

  if (currentLastColumn < expectedHeaders.length) {
    var missingCols = expectedHeaders.length - currentLastColumn;
    if (missingCols > 0) {
      if (currentLastColumn > 0) {
        sh.insertColumnsAfter(currentLastColumn, missingCols);
      } else {
        try {
          sh.getRange(1, 1, 1, expectedHeaders.length);
        } catch (e) {}
      }
    }
  }

  var readColumns = Math.max(expectedHeaders.length, 1);
  var currentHeaders = currentLastRow >= 1
    ? sh.getRange(1, 1, 1, readColumns).getValues()[0]
    : [];

  var hasAnyHeaders = false;
  for (var i = 0; i < currentHeaders.length; i++) {
    if (String(currentHeaders[i] || '').trim() !== '') {
      hasAnyHeaders = true;
      break;
    }
  }

  var changed = false;

  if (!hasAnyHeaders) {
    sh.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
    changed = true;
  } else {
    for (var j = 0; j < expectedHeaders.length; j++) {
      var existing = String(currentHeaders[j] || '').trim();
      if (!existing) {
        sh.getRange(1, j + 1).setValue(expectedHeaders[j]);
        changed = true;
      }
    }
  }

  if (changed || sh.getFrozenRows() < 1) {
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, Math.max(expectedHeaders.length, sh.getLastColumn(), 1))
      .setFontWeight('bold')
      .setBackground('#e8eaed');
  }

  _applyRoleValidation_(sh);
  _applyEmailValidation_(sh);
  _applyEnabledValidation_(sh);
}

// ==================== VALIDATIONS ====================

function _buildRoleValidationRule_() {
  var roleValues = Array.isArray(ROLE_VALUES) ? ROLE_VALUES.slice() : [];
  if (!roleValues.length) return null;

  return SpreadsheetApp.newDataValidation()
    .requireValueInList(roleValues, true)
    .setAllowInvalid(false)
    .setHelpText('Оберіть роль: ' + roleValues.join(', '))
    .build();
}

function _applyRoleValidation_(sh) {
  if (!sh) return;

  var headerMap = _getHeaderMap_(sh);
  var roleCol = headerMap.role;
  if (!roleCol) return;

  var maxRows = _getSafeMaxSheetRows_(sh);
  if (maxRows < 2) return;

  var rule = _buildRoleValidationRule_();
  if (!rule) return;

  sh.getRange(2, roleCol, maxRows - 1, 1).setDataValidation(rule);
}

function _applyEmailValidation_(sh) {
  if (!sh) return;

  var headerMap = _getHeaderMap_(sh);
  var emailCol = headerMap.email;
  if (!emailCol) return;

  var maxRows = _getSafeMaxSheetRows_(sh);
  if (maxRows < 2) return;

  var rule = SpreadsheetApp.newDataValidation()
    .requireTextIsEmail()
    .setAllowInvalid(false)
    .setHelpText('Введіть коректну email адресу')
    .build();

  sh.getRange(2, emailCol, maxRows - 1, 1).setDataValidation(rule);
}

function _applyEnabledValidation_(sh) {
  if (!sh) return;

  var headerMap = _getHeaderMap_(sh);
  var enabledCol = headerMap.enabled;
  if (!enabledCol) return;

  var maxRows = _getSafeMaxSheetRows_(sh);
  if (maxRows < 2) return;

  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['TRUE', 'FALSE'], true)
    .setAllowInvalid(false)
    .setHelpText('TRUE - активний, FALSE - заблокований адміністратором')
    .build();

  sh.getRange(2, enabledCol, maxRows - 1, 1).setDataValidation(rule);
}

// ==================== ROW MAPPING ====================

function _syncRoleNoteForRow_(sh, rowNumber) {
  if (!sh || rowNumber < 2) return;
  if (typeof getRoleNoteTemplate_ !== 'function') return;

  var headerMap = _getHeaderMap_(sh);
  var roleCol = headerMap.role;
  var noteCol = headerMap.note;
  if (!roleCol || !noteCol) return;

  var rawRole = String(sh.getRange(rowNumber, roleCol).getValue() || '').trim();
  if (!rawRole) return;

  sh.getRange(rowNumber, noteCol).setValue(getRoleNoteTemplate_(rawRole));
}

function _rowToEntry_(row, rowNumber, headerMap) {
  function read(header) {
    var column = headerMap[header];
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

// ==================== READ OPERATIONS ====================

function _readSheetEntries_() {
  var cached = _accessRepoGetEntriesCache_();
  if (cached) return cached.slice();

  var sh = _getSheet_(false);
  if (!sh || sh.getLastRow() < 2) {
    _accessRepoSetEntriesCache_([]);
    return [];
  }

  var headerMap = _getHeaderMap_(sh);
  var rowCount = sh.getLastRow() - 1;
  var colCount = sh.getLastColumn();

  if (rowCount < 1 || colCount < 1) {
    _accessRepoSetEntriesCache_([]);
    return [];
  }

  var values = sh.getRange(2, 1, rowCount, colCount).getValues();
  var result = [];

  for (var i = 0; i < values.length; i++) {
    result.push(_rowToEntry_(values[i], i + 2, headerMap));
  }

  _accessRepoSetEntriesCache_(result);
  return result.slice();
}

function _getEntryBySheetRow_(sheetRow) {
  var sh = _getSheet_(false);
  if (!sh || !sheetRow || sheetRow < 2 || sheetRow > sh.getLastRow()) return null;

  var headerMap = _getHeaderMap_(sh);
  var colCount = sh.getLastColumn();
  if (colCount < 1) return null;

  var row = sh.getRange(sheetRow, 1, 1, colCount).getValues()[0];
  return _rowToEntry_(row, sheetRow, headerMap);
}

function _readRawSheetEntries_() {
  var sh = _getSheet_(false);
  if (!sh || sh.getLastRow() < 2) return [];

  var headerMap = _getHeaderMap_(sh);
  var rowCount = sh.getLastRow() - 1;
  var colCount = sh.getLastColumn();
  if (rowCount < 1 || colCount < 1) return [];

  var values = sh.getRange(2, 1, rowCount, colCount).getValues();
  var result = [];

  for (var i = 0; i < values.length; i++) {
    result.push({
      rawRow: values[i],
      rowNumber: i + 2,
      headerMap: headerMap
    });
  }

  return result;
}

// ==================== WRITE OPERATIONS ====================

function _setEntryField_(sheetRow, header, value) {
  var sh = _getSheet_(false);
  if (!sh || !sheetRow || sheetRow < 2) return false;

  var headerMap = _getHeaderMap_(sh);
  var column = headerMap[header];
  if (!column) {
    _logAccessRepo_('Header "' + header + '" not found, cannot update field.');
    return false;
  }

  sh.getRange(sheetRow, column).setValue(value);
  _invalidateAccessRepoCachesSafe_();
  return true;
}

function _setEntryFields_(sheetRow, updatesByHeader) {
  var sh = _getSheet_(false);
  if (!sh || !sheetRow || sheetRow < 2) return false;

  var headerMap = _getHeaderMap_(sh);

  Object.keys(updatesByHeader || {}).forEach(function(header) {
    var column = headerMap[header];
    if (!column) {
      _logAccessRepo_('Header "' + header + '" not found, skipping field update.');
      return;
    }
    sh.getRange(sheetRow, column).setValue(updatesByHeader[header]);
  });

  _invalidateAccessRepoCachesSafe_();
  return true;
}

function _writeEntryByHeaderMap_(sheetRow, entry) {
  var updates = {};

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
  var sh = _getSheet_(false);
  if (!sh || !sheetRow || sheetRow < 2) return null;

  var headerMap = _getHeaderMap_(sh);
  var colCount = sh.getLastColumn();
  if (colCount < 1) return null;

  var currentRow = sh.getRange(sheetRow, 1, 1, colCount).getValues()[0];
  var currentEntry = _rowToEntry_(currentRow, sheetRow, headerMap);
  var mapped = Object.assign({}, currentEntry);

  if (Object.prototype.hasOwnProperty.call(updates, 'email')) {
    mapped.email = normalizeEmail_(updates.email);
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'phone')) {
    mapped.phone = normalizePhone_(updates.phone);
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'role')) {
    mapped.role = normalizeRole_(updates.role);
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'enabled')) {
    mapped.enabled = !!updates.enabled;
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'note')) {
    mapped.note = String(updates.note || '');
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'display_name')) {
    mapped.displayName = String(updates.display_name || '');
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'displayName')) {
    mapped.displayName = String(updates.displayName || '');
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'person_callsign')) {
    mapped.personCallsign = normalizeCallsign_(updates.person_callsign);
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'personCallsign')) {
    mapped.personCallsign = normalizeCallsign_(updates.personCallsign);
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'self_bind_allowed')) {
    mapped.selfBindAllowed = isSelfBindAllowedValue_(updates.self_bind_allowed, mapped.role);
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'selfBindAllowed')) {
    mapped.selfBindAllowed = !!updates.selfBindAllowed;
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'user_key_current_hash')) {
    mapped.userKeyCurrentHash = normalizeStoredHash_(updates.user_key_current_hash);
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'userKeyCurrentHash')) {
    mapped.userKeyCurrentHash = normalizeStoredHash_(updates.userKeyCurrentHash);
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'user_key_prev_hash')) {
    mapped.userKeyPrevHash = normalizeStoredHash_(updates.user_key_prev_hash);
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'userKeyPrevHash')) {
    mapped.userKeyPrevHash = normalizeStoredHash_(updates.userKeyPrevHash);
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'last_seen_at')) {
    mapped.lastSeenAt = String(updates.last_seen_at || '');
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'lastSeenAt')) {
    mapped.lastSeenAt = String(updates.lastSeenAt || '');
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'last_rotated_at')) {
    mapped.lastRotatedAt = String(updates.last_rotated_at || '');
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'lastRotatedAt')) {
    mapped.lastRotatedAt = String(updates.lastRotatedAt || '');
  }
  
  if (Object.prototype.hasOwnProperty.call(updates, 'failed_attempts')) {
    mapped.failedAttempts = parseInt(updates.failed_attempts || '0', 10) || 0;
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'failedAttempts')) {
    mapped.failedAttempts = parseInt(updates.failedAttempts || '0', 10) || 0;
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'locked_until_ms')) {
    mapped.lockedUntilMs = parseInt(updates.locked_until_ms || '0', 10) || 0;
  }
  
  if (Object.prototype.hasOwnProperty.call(updates, 'lockedUntilMs')) {
    mapped.lockedUntilMs = parseInt(updates.lockedUntilMs || '0', 10) || 0;
  }

  _writeEntryByHeaderMap_(sheetRow, mapped);
  return mapped;
}
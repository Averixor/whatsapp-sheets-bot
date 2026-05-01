// ==================== AccessControl.SheetRepository.gs ====================

/** Header-based ACCESS repository. */
function _accessRepoGlobal_() { try { if (typeof globalThis !== 'undefined') return globalThis; } catch (e) {} try { return this; } catch (e) {} return {}; }
function _accessRepoState_() { var root = _accessRepoGlobal_(); if (!root.__WASB_ACCESS_REPO_STATE__ || typeof root.__WASB_ACCESS_REPO_STATE__ !== 'object') root.__WASB_ACCESS_REPO_STATE__ = { sheetCache: null, entriesCache: null }; return root.__WASB_ACCESS_REPO_STATE__; }
function _accessRepoGetSheetCache_() { return _accessRepoState_().sheetCache || null; }
function _accessRepoSetSheetCache_(value) { _accessRepoState_().sheetCache = value || null; }
function _accessRepoGetEntriesCache_() { return _accessRepoState_().entriesCache || null; }
function _accessRepoSetEntriesCache_(value) { _accessRepoState_().entriesCache = value || null; }
function _accessRepoResetLocalCaches_() { _accessRepoSetSheetCache_(null); _accessRepoSetEntriesCache_(null); }
function _accessRepoMaxSheetRows_() { try { if (typeof MAX_SHEET_ROWS !== 'undefined') { var configured = Number(MAX_SHEET_ROWS); if (isFinite(configured) && configured > 0) return configured; } } catch (e) {} return 1000; }
function _getExpectedHeaders_() { return Array.isArray(SHEET_HEADERS) ? SHEET_HEADERS.slice() : []; }
function _getSafeMaxSheetRows_(sh) { if (!sh) return 0; var configured = _accessRepoMaxSheetRows_(); var actual = Number(sh.getMaxRows()) || 0; if (configured > 0 && actual > 0) return Math.min(configured, actual); if (configured > 0) return configured; return actual; }
function _logAccessRepo_(message, error) { try { Logger.log('[AccessControl.SheetRepository] ' + message + (error ? ': ' + (error && error.message ? error.message : error) : '')); } catch (e) {} }
function _invalidateAccessRepoCachesSafe_(options) { _accessRepoResetLocalCaches_(); try { if (typeof _invalidateAccessCaches_ === 'function') _invalidateAccessCaches_(options || {}); } catch (e) { _logAccessRepo_('Cache invalidation warning', e); } }

// ==================== HUMAN HEADER ALIASES ====================
function _getAccessHeaderDisplayLabels_() { return {
  email: 'електронна пошта', phone: 'телефон', role: 'роль', enabled: 'активний', note: 'примітка', display_name: 'імʼя, що відображається', person_callsign: 'позивний користувача', self_bind_allowed: 'дозволена самостійна привʼязка', user_key_current_hash: 'хеш поточного ключа', user_key_prev_hash: 'хеш попереднього ключа', last_seen_at: 'час останнього візиту', last_rotated_at: 'час останнього оновлення', failed_attempts: 'невдалих спроб', locked_until_ms: 'заблоковано до (мс)', login: 'логін', password_hash: 'хеш пароля', password_salt: 'сіль пароля', registration_status: 'статус реєстрації', preferred_contact: 'бажаний спосіб звʼязку', surname: 'прізвище', first_name: 'імʼя', request_user_key_hash: 'хеш ключа із запиту', request_created_at: 'час створення запиту', temporary_password_plain: 'тимчасовий пароль (текст)', temporary_password_hash: 'хеш тимчасового пароля', temporary_password_salt: 'сіль тимчасового пароля', temporary_password_expires_at: 'тимчасовий пароль діє до', temporary_password_used_at: 'час використання тимчасового пароля', approved_by: 'ким схвалено', approved_at: 'час схвалення', activated_at: 'час активації', telegram_username: 'імʼя користувача Telegram'
}; }
function _getAccessHeaderAliasMap_() { var labels = _getAccessHeaderDisplayLabels_(); var aliases = {}; Object.keys(labels).forEach(function(key) { aliases[String(labels[key] || '').trim().toLowerCase()] = key; }); aliases.email='email'; aliases['пошта']='email'; aliases['телефон']='phone'; aliases['номер телефону']='phone'; aliases['роль доступу']='role'; aliases['активний користувач']='enabled'; aliases['позивний']='person_callsign'; aliases['по батькові']='patronymic'; aliases['отчество']='patronymic'; aliases['посада']='position_title'; aliases['должность']='position_title'; aliases.position_title='position_title'; return aliases; }
function _resolveAccessHeaderKey_(value) { var raw = String(value || '').trim().toLowerCase(); if (!raw) return ''; var expected = _getExpectedHeaders_(); if (expected.indexOf(raw) !== -1) return raw; return _getAccessHeaderAliasMap_()[raw] || raw; }
function _applyAccessHeaderDisplayLabels_(sh) { if (!sh) return; var expectedHeaders = _getExpectedHeaders_(); if (!expectedHeaders.length) return; var labels = _getAccessHeaderDisplayLabels_(); var values = expectedHeaders.map(function(header) { return labels[header] || header; }); sh.getRange(1, 1, 1, expectedHeaders.length).setValues([values]); for (var i = 0; i < expectedHeaders.length; i++) { try { sh.getRange(1, i + 1).setNote(expectedHeaders[i]); } catch (e) {} } }
function _removeAccessObsoleteColumns_(sh) { if (!sh) return 0; var obsolete = { patronymic:true, 'по батькові':true, 'отчество':true, 'по баткові':true, position_title:true, 'посада':true, 'должность':true }; var lastColumn = Number(sh.getLastColumn()) || 0; if (lastColumn < 1) return 0; var headers = sh.getRange(1,1,1,lastColumn).getValues()[0]; var removed = 0; for (var i = headers.length - 1; i >= 0; i--) { var key = _resolveAccessHeaderKey_(headers[i]); var raw = String(headers[i] || '').trim().toLowerCase(); if (obsolete[key] || obsolete[raw]) { sh.deleteColumn(i+1); removed++; } } return removed; }

// ==================== SHEET OPERATIONS ====================
function _getSheet_(createIfMissing) { var cached = _accessRepoGetSheetCache_(); if (cached) { try { if (cached.getParent()) return cached; } catch (e) { _accessRepoSetSheetCache_(null); } } var ss = SpreadsheetApp.getActive(); if (!ss) return null; var sh = ss.getSheetByName(ACCESS_SHEET); if (!sh && createIfMissing) { sh = ss.insertSheet(ACCESS_SHEET); _ensureSheetSchema_(sh); _invalidateAccessRepoCachesSafe_({resetSheet:true}); } else if (sh && createIfMissing) _ensureSheetSchema_(sh); _accessRepoSetSheetCache_(sh || null); return _accessRepoGetSheetCache_(); }
function _getHeaderMap_(sh) { if (!sh) return {}; var lastColumn = Number(sh.getLastColumn()) || 0; if (lastColumn < 1) return {}; var expectedHeaders = _getExpectedHeaders_(); var columnsToRead = Math.max(lastColumn, expectedHeaders.length, 1); var headers = sh.getRange(1,1,1,columnsToRead).getValues()[0]; var map = {}; for (var i = 0; i < headers.length; i++) { var rawKey = String(headers[i] || '').trim().toLowerCase(); var canonical = _resolveAccessHeaderKey_(rawKey); if (rawKey) map[rawKey] = i+1; if (canonical) map[canonical] = i+1; } return map; }
function _ensureSheetSchema_(sh) { if (!sh) return; _removeAccessObsoleteColumns_(sh); var expectedHeaders = _getExpectedHeaders_(); if (!expectedHeaders.length) return; var currentLastColumn = Number(sh.getLastColumn()) || 0; var currentLastRow = Number(sh.getLastRow()) || 0; if (currentLastColumn < expectedHeaders.length) { var missingCols = expectedHeaders.length - currentLastColumn; if (missingCols > 0 && currentLastColumn > 0) sh.insertColumnsAfter(currentLastColumn, missingCols); } var currentHeaders = currentLastRow >= 1 ? sh.getRange(1,1,1,Math.max(expectedHeaders.length,1)).getValues()[0] : []; var hasAnyHeaders = currentHeaders.some(function(v) { return String(v || '').trim() !== ''; }); if (!hasAnyHeaders) sh.getRange(1,1,1,expectedHeaders.length).setValues([expectedHeaders]); else { var headerMap = _getHeaderMap_(sh); for (var j = 0; j < expectedHeaders.length; j++) if (!headerMap[expectedHeaders[j]]) sh.getRange(1, j+1).setValue(expectedHeaders[j]); } sh.setFrozenRows(1); sh.getRange(1,1,1,Math.max(expectedHeaders.length, sh.getLastColumn(), 1)).setFontWeight('bold').setBackground('#e8eaed'); _applyAccessHeaderDisplayLabels_(sh); _applyRoleValidation_(sh); _applyEmailValidation_(sh); _applyEnabledValidation_(sh); _applySelfBindAllowedValidation_(sh); _applyRegistrationStatusValidation_(sh); }

// ==================== VALIDATIONS ====================
  var maxRows = Number(sh.getMaxRows()) || 0;
  if (maxRows < 2) return 0;
  return maxRows - 1;
}
function _buildRoleValidationRule_() { var roleValues = Array.isArray(ROLE_VALUES) ? ROLE_VALUES.slice() : []; if (!roleValues.length) return null; return SpreadsheetApp.newDataValidation().requireValueInList(roleValues, true).setAllowInvalid(false).setHelpText('Оберіть роль: ' + roleValues.join(', ')).build(); }
function _applyRoleValidation_(sh) { var col = _getHeaderMap_(sh).role; if (!col) return; _setSingleRowValidation_(sh, col, _buildRoleValidationRule_()); }
function _applyEmailValidation_(sh) { var col = _getHeaderMap_(sh).email; if (!col) return; var maxRows = _getSafeMaxSheetRows_(sh); if (maxRows < 2) return; var rule = SpreadsheetApp.newDataValidation().requireTextIsEmail().setAllowInvalid(false).setHelpText('Введіть коректну email адресу').build(); sh.getRange(2, col, maxRows - 1, 1).setDataValidation(rule); }
function _applyEnabledValidation_(sh) { var col = _getHeaderMap_(sh).enabled; if (!col) return; var rule = SpreadsheetApp.newDataValidation().requireValueInList(['TRUE','FALSE'], true).setAllowInvalid(false).setHelpText('TRUE - активний, FALSE - заблокований').build(); _setSingleRowValidation_(sh, col, rule); }
function _applySelfBindAllowedValidation_(sh) { var col = _getHeaderMap_(sh).self_bind_allowed; if (!col) return; var rule = SpreadsheetApp.newDataValidation().requireValueInList(['TRUE','FALSE'], true).setAllowInvalid(false).setHelpText('TRUE — користувач може сам завершити реєстрацію').build(); _setSingleRowValidation_(sh, col, rule); }
function _getAccessRegistrationStatusValues_() { return ['pending_review','approved','key_sent','active','rejected','blocked','expired']; }
function _applyRegistrationStatusValidation_(sh) { var col = _getHeaderMap_(sh).registration_status; if (!col) return; var rule = SpreadsheetApp.newDataValidation().requireValueInList(_getAccessRegistrationStatusValues_(), true).setAllowInvalid(false).setHelpText('Зазвичай статус змінює система: pending_review → key_sent → active').build(); _setSingleRowValidation_(sh, col, rule); }

// ==================== AUTO SYNC ====================
function _syncRoleNoteForRow_(sh, rowNumber) { if (!sh || rowNumber < 2) return false; if (typeof getRoleNoteTemplate_ !== 'function') return false; var headerMap = _getHeaderMap_(sh); var roleCol = headerMap.role, noteCol = headerMap.note; if (!roleCol || !noteCol) return false; var role = normalizeRole_(sh.getRange(rowNumber, roleCol).getValue()); var note = role ? String(getRoleNoteTemplate_(role) || '') : ''; sh.getRange(rowNumber, noteCol).setValue(note); return true; }
function _syncAllRoleNotes_(sh) { if (!sh) return 0; var headerMap = _getHeaderMap_(sh); var roleCol = headerMap.role, noteCol = headerMap.note; if (!roleCol || !noteCol) return 0; var lastRow = Number(sh.getLastRow()) || 0; if (lastRow < 2) return 0; var rowCount = lastRow - 1; var roleValues = sh.getRange(2, roleCol, rowCount, 1).getValues(); var noteValues = []; var changed = 0; for (var i=0;i<roleValues.length;i++) { var role = normalizeRole_(roleValues[i][0]); var note = role ? String(getRoleNoteTemplate_(role) || '') : ''; noteValues.push([note]); if (note) changed++; } sh.getRange(2, noteCol, rowCount, 1).setValues(noteValues); return changed; }
function _isAccessRegistrationFinalStatus_(status) { var s = String(status || '').trim().toLowerCase(); return s === 'active' || s === 'rejected' || s === 'blocked' || s === 'expired'; }
function _isAccessEnabledStrict_(value) { var raw = String(value === undefined || value === null ? '' : value).trim().toLowerCase(); return raw === 'true' || raw === '1' || raw === 'yes' || raw === 'так' || raw === 'on'; }
function _syncRegistrationStatusForRow_(sh, rowNumber) {
  if (!sh || rowNumber < 2) return false;

  var headerMap = _getHeaderMap_(sh);

  var roleCol = _getAccessColumnByAny_(sh, headerMap, ['role', 'роль']);
  var enabledCol = _getAccessColumnByAny_(sh, headerMap, ['enabled', 'активний']);
  var statusCol = _getAccessColumnByAny_(sh, headerMap, ['registration_status', 'статус реєстрації']);
  var approvedByCol = _getAccessColumnByAny_(sh, headerMap, ['approved_by', 'ким схвалено']);
  var approvedAtCol = _getAccessColumnByAny_(sh, headerMap, ['approved_at', 'час схвалення']);

  if (!roleCol || !enabledCol || !statusCol) return false;

  var role = normalizeRole_(sh.getRange(rowNumber, roleCol).getValue());
  var enabledRaw = String(sh.getRange(rowNumber, enabledCol).getValue() || '').trim().toLowerCase();
  var enabled = enabledRaw === 'true' || enabledRaw === '1' || enabledRaw === 'yes' || enabledRaw === 'так' || enabledRaw === 'on';

  var statusCell = sh.getRange(rowNumber, statusCol);
  var currentStatus = String(statusCell.getValue() || '').trim().toLowerCase();

  if (currentStatus === 'active' || currentStatus === 'rejected' || currentStatus === 'blocked' || currentStatus === 'expired') {
    return false;
  }

  var nextStatus = currentStatus || 'pending_review';

  if (role && role !== 'guest' && enabled) {
    nextStatus = 'key_sent';
  } else if (!currentStatus) {
    nextStatus = 'pending_review';
  }

  var changed = false;

  if (String(statusCell.getValue() || '').trim().toLowerCase() !== nextStatus) {
    statusCell.setValue(nextStatus);
    changed = true;
  }

  if ((nextStatus === 'approved' || nextStatus === 'key_sent') && approvedByCol && approvedAtCol) {
    var approvedByCell = sh.getRange(rowNumber, approvedByCol);
    var approvedAtCell = sh.getRange(rowNumber, approvedAtCol);

    if (!String(approvedByCell.getValue() || '').trim()) {
      var actor = '';
      try {
        actor = safeGetUserEmail_();
      } catch (_) {}

      approvedByCell.setValue(actor || 'admin');
      changed = true;
    }

    if (!String(approvedAtCell.getValue() || '').trim()) {
      approvedAtCell.setValue(_nowText_('long'));
      changed = true;
    }

    if (_ensureTemporaryAccessPasswordForRow_(sh, rowNumber)) {
      changed = true;
    }
  }

  return changed;
}
function _syncAllRegistrationStatuses_(sh) {
  if (!sh) return 0;

  var lastRow = Number(sh.getLastRow()) || 0;
  if (lastRow < 2) return 0;

  var changed = 0;

  for (var row = 2; row <= lastRow; row++) {
    if (_syncRegistrationStatusForRow_(sh, row)) {
      changed++;
    }
  }

  return changed;
}

// ==================== ROW MAPPING ====================
function _rowToEntry_(row, rowNumber, headerMap) { function read(header) { var col = headerMap[header]; return col ? row[col - 1] : ''; } return { email:normalizeEmail_(read('email')), phone:normalizePhone_(read('phone')), role:normalizeRole_(read('role')), enabled:isEnabledValue_(read('enabled')), note:String(read('note') || ''), displayName:normalizeHumanName_(read('display_name')), personCallsign:normalizeCallsign_(read('person_callsign')), selfBindAllowed:isSelfBindAllowedValue_(read('self_bind_allowed'), read('role')), userKeyCurrentHash:normalizeStoredHash_(read('user_key_current_hash')), userKeyPrevHash:normalizeStoredHash_(read('user_key_prev_hash')), lastSeenAt:String(read('last_seen_at') || ''), lastRotatedAt:String(read('last_rotated_at') || ''), failedAttempts:parseInt(read('failed_attempts') || '0',10) || 0, lockedUntilMs:parseInt(read('locked_until_ms') || '0',10) || 0, login:String(read('login') || '').trim(), passwordHash:String(read('password_hash') || '').trim(), passwordSalt:String(read('password_salt') || '').trim(), registrationStatus:String(read('registration_status') || '').trim().toLowerCase(), preferredContact:String(read('preferred_contact') || '').trim().toLowerCase(), surname:normalizeHumanName_(read('surname')), firstName:normalizeHumanName_(read('first_name')), requestUserKeyHash:normalizeStoredHash_(read('request_user_key_hash')), requestCreatedAt:String(read('request_created_at') || ''), temporaryPasswordPlain:String(read('temporary_password_plain') || '').trim(), temporaryPasswordHash:String(read('temporary_password_hash') || '').trim(), temporaryPasswordSalt:String(read('temporary_password_salt') || '').trim(), temporaryPasswordExpiresAt:String(read('temporary_password_expires_at') || ''), temporaryPasswordUsedAt:String(read('temporary_password_used_at') || ''), approvedBy:String(read('approved_by') || '').trim(), approvedAt:String(read('approved_at') || ''), activatedAt:String(read('activated_at') || ''), telegramUsername:String(read('telegram_username') || '').trim(), source:ACCESS_SHEET, sheetRow:rowNumber }; }
function _readSheetEntries_() { var cached = _accessRepoGetEntriesCache_(); if (cached) return cached.slice(); var sh = _getSheet_(false); if (!sh || sh.getLastRow() < 2) { _accessRepoSetEntriesCache_([]); return []; } var headerMap = _getHeaderMap_(sh); var rowCount = sh.getLastRow() - 1, colCount = sh.getLastColumn(); if (rowCount < 1 || colCount < 1) { _accessRepoSetEntriesCache_([]); return []; } var values = sh.getRange(2,1,rowCount,colCount).getValues(); var result = []; for (var i=0;i<values.length;i++) result.push(_rowToEntry_(values[i], i+2, headerMap)); _accessRepoSetEntriesCache_(result); return result.slice(); }
function _getEntryBySheetRow_(sheetRow) { var sh = _getSheet_(false); if (!sh || !sheetRow || sheetRow < 2 || sheetRow > sh.getLastRow()) return null; var headerMap = _getHeaderMap_(sh); var row = sh.getRange(sheetRow,1,1,sh.getLastColumn()).getValues()[0]; return _rowToEntry_(row, sheetRow, headerMap); }
function _readRawSheetEntries_() { var sh = _getSheet_(false); if (!sh || sh.getLastRow() < 2) return []; var headerMap = _getHeaderMap_(sh); var rowCount = sh.getLastRow() - 1, colCount = sh.getLastColumn(); var values = sh.getRange(2,1,rowCount,colCount).getValues(); var result = []; for (var i=0;i<values.length;i++) result.push({rawRow:values[i], rowNumber:i+2, headerMap:headerMap}); return result; }
function _setEntryField_(sheetRow, header, value) { var sh = _getSheet_(false); if (!sh || !sheetRow || sheetRow < 2) return false; var col = _getHeaderMap_(sh)[header]; if (!col) return false; sh.getRange(sheetRow,col).setValue(value); _invalidateAccessRepoCachesSafe_(); return true; }
function _setEntryFields_(sheetRow, updatesByHeader) { var sh = _getSheet_(false); if (!sh || !sheetRow || sheetRow < 2) return false; var headerMap = _getHeaderMap_(sh); Object.keys(updatesByHeader || {}).forEach(function(header) { var col = headerMap[header]; if (col) sh.getRange(sheetRow,col).setValue(updatesByHeader[header]); }); _invalidateAccessRepoCachesSafe_(); return true; }
function _entryToHeaderUpdates_(entry) { var e = entry || {}, updates = {}; if (e.email !== undefined) updates.email = normalizeEmail_(e.email); if (e.phone !== undefined) updates.phone = normalizePhone_(e.phone); if (e.role !== undefined) updates.role = normalizeRole_(e.role); if (e.enabled !== undefined) updates.enabled = e.enabled ? 'TRUE' : 'FALSE'; if (e.note !== undefined) updates.note = String(e.note || ''); if (e.displayName !== undefined) updates.display_name = normalizeHumanName_(e.displayName); if (e.personCallsign !== undefined) updates.person_callsign = normalizeCallsign_(e.personCallsign); if (e.selfBindAllowed !== undefined) updates.self_bind_allowed = e.selfBindAllowed ? 'TRUE' : 'FALSE'; if (e.userKeyCurrentHash !== undefined) updates.user_key_current_hash = normalizeStoredHash_(e.userKeyCurrentHash); if (e.userKeyPrevHash !== undefined) updates.user_key_prev_hash = normalizeStoredHash_(e.userKeyPrevHash); if (e.lastSeenAt !== undefined) updates.last_seen_at = e.lastSeenAt; if (e.lastRotatedAt !== undefined) updates.last_rotated_at = e.lastRotatedAt; if (e.failedAttempts !== undefined) updates.failed_attempts = e.failedAttempts; if (e.lockedUntilMs !== undefined) updates.locked_until_ms = e.lockedUntilMs; if (e.login !== undefined) updates.login = String(e.login || '').trim(); if (e.passwordHash !== undefined) updates.password_hash = String(e.passwordHash || '').trim(); if (e.passwordSalt !== undefined) updates.password_salt = String(e.passwordSalt || '').trim(); if (e.registrationStatus !== undefined) updates.registration_status = String(e.registrationStatus || '').trim().toLowerCase(); if (e.preferredContact !== undefined) updates.preferred_contact = String(e.preferredContact || '').trim().toLowerCase(); if (e.surname !== undefined) updates.surname = normalizeHumanName_(e.surname); if (e.firstName !== undefined) updates.first_name = normalizeHumanName_(e.firstName); if (e.requestUserKeyHash !== undefined) updates.request_user_key_hash = normalizeStoredHash_(e.requestUserKeyHash); if (e.requestCreatedAt !== undefined) updates.request_created_at = e.requestCreatedAt; if (e.temporaryPasswordPlain !== undefined) updates.temporary_password_plain = e.temporaryPasswordPlain; if (e.temporaryPasswordHash !== undefined) updates.temporary_password_hash = e.temporaryPasswordHash; if (e.temporaryPasswordSalt !== undefined) updates.temporary_password_salt = e.temporaryPasswordSalt; if (e.temporaryPasswordExpiresAt !== undefined) updates.temporary_password_expires_at = e.temporaryPasswordExpiresAt; if (e.temporaryPasswordUsedAt !== undefined) updates.temporary_password_used_at = e.temporaryPasswordUsedAt; if (e.approvedBy !== undefined) updates.approved_by = e.approvedBy; if (e.approvedAt !== undefined) updates.approved_at = e.approvedAt; if (e.activatedAt !== undefined) updates.activated_at = e.activatedAt; if (e.telegramUsername !== undefined) updates.telegram_username = e.telegramUsername; return updates; }
function _writeEntryByHeaderMap_(sheetRow, entry) { return _setEntryFields_(sheetRow, _entryToHeaderUpdates_(entry)); }
function _appendEntryByHeaderMap_(entry) { var sh = _getSheet_(true); if (!sh) return null; _ensureSheetSchema_(sh); var headers = _getExpectedHeaders_(); var updates = _entryToHeaderUpdates_(entry || {}); var rowValues = headers.map(function(header) { return updates[header] !== undefined ? updates[header] : ''; }); var nextRow = Math.max(Number(sh.getLastRow()) || 1, 1) + 1; sh.getRange(nextRow,1,1,headers.length).setValues([rowValues]); _invalidateAccessRepoCachesSafe_(); return _getEntryBySheetRow_(nextRow); }
function _updateEntryFields_(sheetRow, updates) { var current = _getEntryBySheetRow_(sheetRow); if (!current) return null; var mapped = Object.assign({}, current); updates = updates || {}; if (Object.prototype.hasOwnProperty.call(updates,'email')) mapped.email = normalizeEmail_(updates.email); if (Object.prototype.hasOwnProperty.call(updates,'phone')) mapped.phone = normalizePhone_(updates.phone); if (Object.prototype.hasOwnProperty.call(updates,'role')) mapped.role = normalizeRole_(updates.role); if (Object.prototype.hasOwnProperty.call(updates,'enabled')) mapped.enabled = !!updates.enabled; if (Object.prototype.hasOwnProperty.call(updates,'note')) mapped.note = String(updates.note || ''); if (Object.prototype.hasOwnProperty.call(updates,'display_name')) mapped.displayName = normalizeHumanName_(updates.display_name); if (Object.prototype.hasOwnProperty.call(updates,'displayName')) mapped.displayName = normalizeHumanName_(updates.displayName); if (Object.prototype.hasOwnProperty.call(updates,'person_callsign')) mapped.personCallsign = normalizeCallsign_(updates.person_callsign); if (Object.prototype.hasOwnProperty.call(updates,'personCallsign')) mapped.personCallsign = normalizeCallsign_(updates.personCallsign); if (Object.prototype.hasOwnProperty.call(updates,'self_bind_allowed')) mapped.selfBindAllowed = isSelfBindAllowedValue_(updates.self_bind_allowed, mapped.role); if (Object.prototype.hasOwnProperty.call(updates,'selfBindAllowed')) mapped.selfBindAllowed = !!updates.selfBindAllowed; if (Object.prototype.hasOwnProperty.call(updates,'user_key_current_hash')) mapped.userKeyCurrentHash = normalizeStoredHash_(updates.user_key_current_hash); if (Object.prototype.hasOwnProperty.call(updates,'userKeyCurrentHash')) mapped.userKeyCurrentHash = normalizeStoredHash_(updates.userKeyCurrentHash); if (Object.prototype.hasOwnProperty.call(updates,'user_key_prev_hash')) mapped.userKeyPrevHash = normalizeStoredHash_(updates.user_key_prev_hash); if (Object.prototype.hasOwnProperty.call(updates,'last_seen_at')) mapped.lastSeenAt = String(updates.last_seen_at || ''); if (Object.prototype.hasOwnProperty.call(updates,'last_rotated_at')) mapped.lastRotatedAt = String(updates.last_rotated_at || ''); if (Object.prototype.hasOwnProperty.call(updates,'failed_attempts')) mapped.failedAttempts = parseInt(updates.failed_attempts || '0',10) || 0; if (Object.prototype.hasOwnProperty.call(updates,'locked_until_ms')) mapped.lockedUntilMs = parseInt(updates.locked_until_ms || '0',10) || 0; if (Object.prototype.hasOwnProperty.call(updates,'login')) mapped.login = String(updates.login || '').trim(); if (Object.prototype.hasOwnProperty.call(updates,'password_hash')) mapped.passwordHash = String(updates.password_hash || '').trim(); if (Object.prototype.hasOwnProperty.call(updates,'password_salt')) mapped.passwordSalt = String(updates.password_salt || '').trim(); if (Object.prototype.hasOwnProperty.call(updates,'registration_status')) mapped.registrationStatus = String(updates.registration_status || '').trim().toLowerCase(); if (Object.prototype.hasOwnProperty.call(updates,'preferred_contact')) mapped.preferredContact = String(updates.preferred_contact || '').trim().toLowerCase(); if (Object.prototype.hasOwnProperty.call(updates,'surname')) mapped.surname = normalizeHumanName_(updates.surname); if (Object.prototype.hasOwnProperty.call(updates,'first_name')) mapped.firstName = normalizeHumanName_(updates.first_name); if (Object.prototype.hasOwnProperty.call(updates,'firstName')) mapped.firstName = normalizeHumanName_(updates.firstName); if (Object.prototype.hasOwnProperty.call(updates,'request_user_key_hash')) mapped.requestUserKeyHash = normalizeStoredHash_(updates.request_user_key_hash); if (Object.prototype.hasOwnProperty.call(updates,'requestUserKeyHash')) mapped.requestUserKeyHash = normalizeStoredHash_(updates.requestUserKeyHash); if (Object.prototype.hasOwnProperty.call(updates,'request_created_at')) mapped.requestCreatedAt = String(updates.request_created_at || ''); if (Object.prototype.hasOwnProperty.call(updates,'temporary_password_plain')) mapped.temporaryPasswordPlain = String(updates.temporary_password_plain || '').trim(); if (Object.prototype.hasOwnProperty.call(updates,'temporary_password_hash')) mapped.temporaryPasswordHash = String(updates.temporary_password_hash || '').trim(); if (Object.prototype.hasOwnProperty.call(updates,'temporary_password_salt')) mapped.temporaryPasswordSalt = String(updates.temporary_password_salt || '').trim(); if (Object.prototype.hasOwnProperty.call(updates,'temporary_password_expires_at')) mapped.temporaryPasswordExpiresAt = String(updates.temporary_password_expires_at || ''); if (Object.prototype.hasOwnProperty.call(updates,'temporary_password_used_at')) mapped.temporaryPasswordUsedAt = String(updates.temporary_password_used_at || ''); if (Object.prototype.hasOwnProperty.call(updates,'approved_by')) mapped.approvedBy = String(updates.approved_by || ''); if (Object.prototype.hasOwnProperty.call(updates,'approved_at')) mapped.approvedAt = String(updates.approved_at || ''); if (Object.prototype.hasOwnProperty.call(updates,'activated_at')) mapped.activatedAt = String(updates.activated_at || ''); if (Object.prototype.hasOwnProperty.call(updates,'telegram_username')) mapped.telegramUsername = String(updates.telegram_username || '').trim(); _writeEntryByHeaderMap_(sheetRow, mapped); return _getEntryBySheetRow_(sheetRow) || mapped; }


function _getAccessValidationRowCount_(sh) {
  if (!sh) return 0;


function _getAccessColumnByAny_(sh, headerMap, keys) {
  keys = keys || [];

  for (var i = 0; i < keys.length; i++) {
    var key = String(keys[i] || '').trim();
    if (!key) continue;

    if (headerMap[key]) return headerMap[key];

    var lowerKey = key.toLowerCase();
    if (headerMap[lowerKey]) return headerMap[lowerKey];
  }

  var lastColumn = Number(sh.getLastColumn()) || 0;
  if (lastColumn < 1) return 0;

  var headers = sh.getRange(1, 1, 1, lastColumn).getValues()[0];

  for (var col = 0; col < headers.length; col++) {
    var header = String(headers[col] || '').trim().toLowerCase();

    for (var j = 0; j < keys.length; j++) {
      var candidate = String(keys[j] || '').trim().toLowerCase();
      if (header === candidate) return col + 1;
    }
  }

  return 0;
}


function _hashAccessTextFallback_(value) {
  var digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(value || ''),
    Utilities.Charset.UTF_8
  );

  return digest.map(function(byte) {
    return ('0' + (byte & 0xff).toString(16)).slice(-2);
  }).join('');
}


function _generateAccessTemporaryPasswordPlainFallback_(seed) {
  var alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var source = _hashAccessTextFallback_([
    'WASB_ACCESS_TEMP_PASSWORD_FALLBACK',
    String(seed || ''),
    Utilities.getUuid(),
    String(Date.now()),
    String(Math.random())
  ].join('|'));

  var chars = '';

  for (var i = 0; i < source.length; i += 2) {
    var part = source.slice(i, i + 2);
    var n = parseInt(part, 16);
    if (isNaN(n)) continue;

    chars += alphabet.charAt(n % alphabet.length);
    if (chars.length >= 12) break;
  }

  while (chars.length < 12) {
    chars += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }

  return 'WASB-' + chars.slice(0, 4) + '-' + chars.slice(4, 8) + '-' + chars.slice(8, 12);
}


function _ensureTemporaryAccessPasswordForRow_(sh, rowNumber) {
  if (!sh || rowNumber < 2) return false;

  var headerMap = _getHeaderMap_(sh);

  var tempPlainCol = _getAccessColumnByAny_(sh, headerMap, [
    'temporary_password_plain',
    'тимчасовий пароль (текст)'
  ]);

  var tempHashCol = _getAccessColumnByAny_(sh, headerMap, [
    'temporary_password_hash',
    'хеш тимчасового пароля'
  ]);

  var tempSaltCol = _getAccessColumnByAny_(sh, headerMap, [
    'temporary_password_salt',
    'сіль тимчасового пароля'
  ]);

  var tempExpiresCol = _getAccessColumnByAny_(sh, headerMap, [
    'temporary_password_expires_at',
    'тимчасовий пароль діє до',
    'термін дії тимчасового пароля'
  ]);

  var tempUsedCol = _getAccessColumnByAny_(sh, headerMap, [
    'temporary_password_used_at',
    'час використання тимчасового пароля'
  ]);

  if (!tempPlainCol || !tempHashCol || !tempSaltCol || !tempExpiresCol) {
    return false;
  }

  var usedAt = tempUsedCol ? String(sh.getRange(rowNumber, tempUsedCol).getValue() || '').trim() : '';
  if (usedAt) return false;

  var existingPlain = String(sh.getRange(rowNumber, tempPlainCol).getValue() || '').trim();
  var existingHash = String(sh.getRange(rowNumber, tempHashCol).getValue() || '').trim();
  var existingSalt = String(sh.getRange(rowNumber, tempSaltCol).getValue() || '').trim();

  // Если есть и текст, и хеш, и соль — ключ уже выдан.
  if (existingPlain && existingHash && existingSalt) {
    return false;
  }

  var emailCol = _getAccessColumnByAny_(sh, headerMap, ['email', 'електронна пошта']);
  var phoneCol = _getAccessColumnByAny_(sh, headerMap, ['phone', 'телефон']);
  var callsignCol = _getAccessColumnByAny_(sh, headerMap, ['person_callsign', 'позивний користувача', 'позивний']);
  var currentHashCol = _getAccessColumnByAny_(sh, headerMap, ['user_key_current_hash', 'хеш поточного ключа']);
  var requestHashCol = _getAccessColumnByAny_(sh, headerMap, ['request_user_key_hash', 'хеш ключа із запиту']);

  var email = emailCol ? String(sh.getRange(rowNumber, emailCol).getValue() || '').trim() : '';
  var phone = phoneCol ? String(sh.getRange(rowNumber, phoneCol).getValue() || '').trim() : '';
  var callsign = callsignCol ? String(sh.getRange(rowNumber, callsignCol).getValue() || '').trim() : '';
  var currentHash = currentHashCol ? String(sh.getRange(rowNumber, currentHashCol).getValue() || '').trim() : '';
  var requestHash = requestHashCol ? String(sh.getRange(rowNumber, requestHashCol).getValue() || '').trim() : '';

  var seed = [currentHash, requestHash, email, phone, callsign, String(rowNumber)].join('|');

  var plain = typeof generateAccessTemporaryPassword_ === 'function'
    ? generateAccessTemporaryPassword_(seed)
    : _generateAccessTemporaryPasswordPlainFallback_(seed);

  var salt = typeof generateAccessSalt_ === 'function'
    ? generateAccessSalt_()
    : _hashAccessTextFallback_([Utilities.getUuid(), Date.now(), Math.random()].join('|'));

  var hash = typeof hashAccessPasswordWithSalt_ === 'function'
    ? hashAccessPasswordWithSalt_(plain, salt)
    : _hashAccessTextFallback_(['WASB_ACCESS_PASSWORD_V1', salt, plain].join('|'));

  var expiresAt = typeof getAccessTemporaryPasswordExpiresAt_ === 'function'
    ? getAccessTemporaryPasswordExpiresAt_(24)
    : Utilities.formatDate(new Date(Date.now() + 24 * 60 * 60 * 1000), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

  sh.getRange(rowNumber, tempPlainCol).setValue(plain);
  sh.getRange(rowNumber, tempHashCol).setValue(hash);
  sh.getRange(rowNumber, tempSaltCol).setValue(salt);
  sh.getRange(rowNumber, tempExpiresCol).setValue(expiresAt);

  return true;
}


function apiStage7NormalizeAccessSheetFormatting() {
  var sh = _getSheet_(false);
  if (!sh) {
    return {
      success: false,
      message: 'ACCESS sheet not found'
    };
  }

  var headerMap = _getHeaderMap_(sh);
  var lastRow = Number(sh.getLastRow()) || 0;

  if (lastRow < 2) {
    return {
      success: true,
      message: 'ACCESS has no data rows',
      changedRows: 0
    };
  }

  function col(keys) {
    keys = keys || [];

    for (var i = 0; i < keys.length; i++) {
      var key = String(keys[i] || '').trim();
      if (!key) continue;

      if (headerMap[key]) return headerMap[key];
      if (headerMap[key.toLowerCase()]) return headerMap[key.toLowerCase()];
    }

    return 0;
  }

  var nameCols = [
    col(['display_name', 'імʼя, що відображається']),
    col(['surname', 'прізвище']),
    col(['first_name', 'імʼя'])
  ].filter(Boolean);

  var dateCols = [
    col(['last_seen_at', 'час останнього візиту']),
    col(['last_rotated_at', 'час останнього оновлення']),
    col(['request_created_at', 'час створення запиту']),
    col(['temporary_password_expires_at', 'тимчасовий пароль діє до', 'термін дії тимчасового пароля']),
    col(['temporary_password_used_at', 'час використання тимчасового пароля']),
    col(['approved_at', 'час схвалення']),
    col(['activated_at', 'час активації'])
  ].filter(Boolean);

  var changedRows = 0;

  dateCols.forEach(function(dateCol) {
    sh.getRange(2, dateCol, Math.max(lastRow - 1, 1), 1).setNumberFormat('@');
  });

  for (var row = 2; row <= lastRow; row++) {
    var rowChanged = false;

    nameCols.forEach(function(nameCol) {
      var cell = sh.getRange(row, nameCol);
      var current = String(cell.getValue() || '');
      var normalized = normalizeHumanName_(current);

      if (current !== normalized) {
        cell.setValue(normalized);
        rowChanged = true;
      }
    });

    dateCols.forEach(function(dateCol) {
      var cell = sh.getRange(row, dateCol);
      var currentValue = cell.getValue();
      var normalizedDate = formatAccessDateTime_(currentValue);

      if (String(currentValue || '').trim() !== String(normalizedDate || '').trim()) {
        cell.setValue(normalizedDate);
        rowChanged = true;
      }
    });

    if (rowChanged) changedRows++;
  }

  _invalidateAccessCaches_();

  return {
    success: true,
    message: 'ACCESS formatting normalized',
    changedRows: changedRows,
    dateFormat: 'dd.MM.yyyy HH:mm:ss'
  };
}

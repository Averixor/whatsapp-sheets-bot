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

// ==================== ACCESS HEADER NOTES ====================

function _getAccessHeaderNotes_() {
  return {
    email: 'електронна пошта',
    phone: 'телефон',
    role: 'роль доступу в системі',
    enabled: 'активний користувач: TRUE/FALSE',
    note: 'примітка до ролі або доступу',
    display_name: 'ім\'я, що відображається',
    person_callsign: 'позивний користувача',
    self_bind_allowed: 'дозволена самостійна прив\'язка',
    user_key_current_hash: 'хеш поточного ключа користувача',
    user_key_prev_hash: 'хеш попереднього ключа користувача',
    last_seen_at: 'час останнього візиту',
    last_rotated_at: 'час останнього оновлення ключа',
    failed_attempts: 'кількість невдалих спроб входу',
    locked_until_ms: 'заблоковано до, unix-час у мілісекундах',
    login: 'логін користувача',
    password_hash: 'хеш постійного пароля',
    password_salt: 'сіль постійного пароля',
    registration_status: 'статус реєстрації: pending_review / approved / key_sent / active / rejected / blocked',
    preferred_contact: 'бажаний спосіб зв\'язку: WhatsApp / Telegram / Signal / Email',
    surname: 'прізвище',
    first_name: 'ім\'я',
    position_title: 'посада / должность користувача',
    request_user_key_hash: 'хеш ключа із заявки',
    request_created_at: 'час створення заявки',
    temporary_password_plain: 'тимчасовий пароль / код доступу у відкритому вигляді для надсилання користувачу',
    temporary_password_hash: 'хеш тимчасового пароля',
    temporary_password_salt: 'сіль тимчасового пароля',
    temporary_password_expires_at: 'термін дії тимчасового пароля',
    temporary_password_used_at: 'час використання тимчасового пароля',
    approved_by: 'ким схвалено заявку',
    approved_at: 'час схвалення заявки',
    activated_at: 'час активації доступу',
    telegram_username: 'ім\'я користувача Telegram'
  };
}

function _applyAccessHeaderNotes_(sh) {
  if (!sh) return;

  var headerMap = _getHeaderMap_(sh);
  var notes = _getAccessHeaderNotes_();

  Object.keys(notes).forEach(function(header) {
    var col = headerMap[header];
    if (!col) return;
    try {
      sh.getRange(1, col).setNote(notes[header]);
    } catch (e) {}
  });
}

// ==================== ACCESS HUMAN-READABLE HEADERS ====================

function _getAccessHeaderDisplayLabels_() {
  return {
    email: 'електронна пошта',
    phone: 'телефон',
    role: 'роль',
    enabled: 'активний',
    note: 'примітка',
    display_name: 'ім\'я, що відображається',
    person_callsign: 'позивний користувача',
    self_bind_allowed: 'дозволена самостійна прив\'язка',
    user_key_current_hash: 'хеш поточного ключа',
    user_key_prev_hash: 'хеш попереднього ключа',
    last_seen_at: 'час останнього візиту',
    last_rotated_at: 'час останнього оновлення',
    failed_attempts: 'невдалих спроб',
    locked_until_ms: 'заблоковано до (мс)',
    login: 'логін',
    password_hash: 'хеш пароля',
    password_salt: 'сіль пароля',
    registration_status: 'статус реєстрації',
    preferred_contact: 'бажаний спосіб зв\'язку',
    surname: 'прізвище',
    first_name: 'ім\'я',
    position_title: 'посада',
    request_user_key_hash: 'хеш ключа із запиту',
    request_created_at: 'час створення запиту',
    temporary_password_plain: 'тимчасовий пароль (текст)',
    temporary_password_hash: 'хеш тимчасового пароля',
    temporary_password_salt: 'сіль тимчасового пароля',
    temporary_password_expires_at: 'термін дії тимчасового пароля',
    temporary_password_used_at: 'час використання тимчасового пароля',
    approved_by: 'ким схвалено',
    approved_at: 'час схвалення',
    activated_at: 'час активації',
    telegram_username: 'ім\'я користувача Telegram'
  };
}

function _getAccessHeaderAliasMap_() {
  var labels = _getAccessHeaderDisplayLabels_();
  var aliases = {};

  Object.keys(labels).forEach(function(key) {
    aliases[String(labels[key] || '').trim().toLowerCase()] = key;
  });

  // Додаткові варіанти, щоб не впасти від дрібних змін у назвах.
  aliases['пошта'] = 'email';
  aliases['email'] = 'email';
  aliases['номер телефону'] = 'phone';
  aliases['телефон'] = 'phone';
  aliases['роль доступу'] = 'role';
  aliases['активний користувач'] = 'enabled';
  aliases['позивний'] = 'person_callsign';
  aliases['посада / должность'] = 'position_title';
  aliases['должность'] = 'position_title';

  return aliases;
}

function _resolveAccessHeaderKey_(value) {
  var raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';

  var expected = _getExpectedHeaders_();
  if (expected.indexOf(raw) !== -1) return raw;

  var aliases = _getAccessHeaderAliasMap_();
  return aliases[raw] || raw;
}

function _applyAccessHeaderDisplayLabels_(sh) {
  if (!sh) return;

  var expectedHeaders = _getExpectedHeaders_();
  if (!expectedHeaders.length) return;

  var labels = _getAccessHeaderDisplayLabels_();
  var values = expectedHeaders.map(function(header) {
    return labels[header] || header;
  });

  sh.getRange(1, 1, 1, expectedHeaders.length).setValues([values]);

  for (var i = 0; i < expectedHeaders.length; i++) {
    try {
      sh.getRange(1, i + 1).setNote(expectedHeaders[i]);
    } catch (e) {}
  }
}

// ==================== ACCESS OBSOLETE COLUMNS CLEANUP ====================

function _removeAccessObsoleteColumns_(sh) {
  if (!sh) return 0;

  var obsolete = {
    patronymic: true,
    'по батькові': true,
    'отчество': true,
    'по баткові': true
  };

  var lastColumn = Number(sh.getLastColumn()) || 0;
  if (lastColumn < 1) return 0;

  var headers = sh.getRange(1, 1, 1, lastColumn).getValues()[0];
  var removed = 0;

  for (var i = headers.length - 1; i >= 0; i--) {
    var header = String(headers[i] || '').trim().toLowerCase();
    if (!header) continue;

    if (obsolete[header]) {
      sh.deleteColumn(i + 1);
      removed++;
    }
  }

  return removed;
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
    var rawKey = String(headers[i] || '').trim().toLowerCase();
    var canonicalKey = _resolveAccessHeaderKey_(rawKey);

    if (rawKey) map[rawKey] = i + 1;
    if (canonicalKey) map[canonicalKey] = i + 1;
  }

  return map;
}

function _ensureSheetSchema_(sh) {
  if (!sh) return;

  _removeAccessObsoleteColumns_(sh);

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

  _applyAccessHeaderDisplayLabels_(sh);
  _applyRoleValidation_(sh);
  _applyEmailValidation_(sh);
  _applyEnabledValidation_(sh);
  _applySelfBindAllowedValidation_(sh);
  _applyRegistrationStatusValidation_(sh);
  _applyPositionTitleValidation_(sh);
  _applyAccessHeaderNotes_(sh);
}

// ==================== ACCESS VALIDATION RANGE HELPERS ====================

function _clearColumnValidationBelowRow2_(sh, col) {
  if (!sh || !col) return;

  var maxRows = Number(sh.getMaxRows()) || 0;
  if (maxRows <= 2) return;

  sh.getRange(3, col, maxRows - 2, 1).clearDataValidations();
}

function _setSingleRowValidation_(sh, col, rule) {
  if (!sh || !col || !rule) return;

  _clearColumnValidationBelowRow2_(sh, col);
  sh.getRange(2, col, 1, 1).setDataValidation(rule);
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

  var rule = _buildRoleValidationRule_();
  if (!rule) return;

  // Только строка 2. Ниже админ растягивает вручную при необходимости.
  _setSingleRowValidation_(sh, roleCol, rule);
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

  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['TRUE', 'FALSE'], true)
    .setAllowInvalid(false)
    .setHelpText('TRUE - активний, FALSE - заблокований адміністратором')
    .build();

  // Только строка 2. Ниже админ растягивает вручную при необходимости.
  _setSingleRowValidation_(sh, enabledCol, rule);
}

// ==================== ACCESS REGISTRATION VALIDATIONS ====================

function _getAccessRegistrationStatusValues_() {
  return [
    'pending_review',
    'approved',
    'key_sent',
    'active',
    'rejected',
    'blocked',
    'expired'
  ];
}

function _getAccessPositionTitleValues_() {
  return [
    'Командир взводу',
    'Головний сержант взводу',
    'Командир відділення',
    'Старший стрілець',
    'Стрілець',
    'Стрілець-санітар',
    'Оператор',
    'Водій',
    'Водій-електрик',
    'Діловод',
    'Інше'
  ];
}

function _applySelfBindAllowedValidation_(sh) {
  if (!sh) return;

  var headerMap = _getHeaderMap_(sh);
  var col = headerMap.self_bind_allowed;
  if (!col) return;

  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['TRUE', 'FALSE'], true)
    .setAllowInvalid(false)
    .setHelpText('TRUE — користувач може сам завершити реєстрацію')
    .build();

  // Только строка 2. Ниже админ растягивает вручную при необходимости.
  _setSingleRowValidation_(sh, col, rule);
}

function _applyRegistrationStatusValidation_(sh) {
  if (!sh) return;

  var headerMap = _getHeaderMap_(sh);
  var col = headerMap.registration_status;
  if (!col) return;

  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(_getAccessRegistrationStatusValues_(), true)
    .setAllowInvalid(false)
    .setHelpText('Зазвичай статус змінює система: pending_review → key_sent → active')
    .build();

  // Только строка 2. Ниже админ растягивает вручную при необходимости.
  _setSingleRowValidation_(sh, col, rule);
}

function _applyPositionTitleValidation_(sh) {
  if (!sh) return;

  var headerMap = _getHeaderMap_(sh);
  var col = headerMap.position_title;
  if (!col) return;

  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(_getAccessPositionTitleValues_(), true)
    .setAllowInvalid(true)
    .setHelpText('Оберіть посаду зі списку або введіть свою вручну')
    .build();

  // Только строка 2. Ниже админ растягивает вручную при необходимости.
  _setSingleRowValidation_(sh, col, rule);
}

function _syncAccessApprovalForRow_(sh, rowNumber) {
  if (!sh || rowNumber < 2) return false;

  var headerMap = _getHeaderMap_(sh);
  var statusCol = headerMap.registration_status;
  var approvedByCol = headerMap.approved_by;
  var approvedAtCol = headerMap.approved_at;

  if (!statusCol || !approvedByCol || !approvedAtCol) return false;

  var status = String(sh.getRange(rowNumber, statusCol).getValue() || '').trim().toLowerCase();
  if (status !== 'approved' && status !== 'key_sent') return false;

  var approvedByCell = sh.getRange(rowNumber, approvedByCol);
  var approvedAtCell = sh.getRange(rowNumber, approvedAtCol);

  var approvedBy = String(approvedByCell.getValue() || '').trim();
  var approvedAt = String(approvedAtCell.getValue() || '').trim();

  if (!approvedBy) {
    var actor = '';
    try {
      actor = safeGetUserEmail_();
    } catch (_) {}
    approvedByCell.setValue(actor || 'admin');
  }

  if (!approvedAt) {
    approvedAtCell.setValue(_nowText_('long'));
  }

  return true;
}

// ==================== ACCESS ADMIN FLOW VALIDATIONS ====================

function _getAccessValidationRowCount_(sh) {
  if (!sh) return 0;
  var lastRow = Math.max(Number(sh.getLastRow()) || 1, 2);
  return Math.max(lastRow - 1, 1);
}

function _getAccessRegistrationStatusValues_() {
  return [
    'pending_review',
    'approved',
    'key_sent',
    'active',
    'rejected',
    'blocked',
    'expired'
  ];
}

function _isAccessRegistrationFinalStatus_(status) {
  var value = String(status || '').trim().toLowerCase();
  return value === 'active' || value === 'rejected' || value === 'blocked' || value === 'expired';
}

function _isAccessEnabledStrict_(value) {
  var raw = String(value === undefined || value === null ? '' : value).trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes' || raw === 'так' || raw === 'on';
}

function _setCellValueIfDifferent_(range, value) {
  if (!range) return false;
  var current = String(range.getValue() || '').trim();
  var next = String(value || '').trim();
  if (current === next) return false;
  range.setValue(value);
  return true;
}

function _applySelfBindAllowedValidation_(sh) {
  if (!sh) return;

  var headerMap = _getHeaderMap_(sh);
  var col = headerMap.self_bind_allowed;
  if (!col) return;

  var maxRows = _getSafeMaxSheetRows_(sh);
  if (maxRows > 1) {
    sh.getRange(2, col, maxRows - 1, 1).clearDataValidations();
  }

  var rowCount = _getAccessValidationRowCount_(sh);
  if (rowCount < 1) return;

  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['TRUE', 'FALSE'], true)
    .setAllowInvalid(false)
    .setHelpText('TRUE — користувач може сам завершити реєстрацію')
    .build();

  sh.getRange(2, col, rowCount, 1).setDataValidation(rule);
}

function _applyRegistrationStatusValidation_(sh) {
  if (!sh) return;

  var headerMap = _getHeaderMap_(sh);
  var col = headerMap.registration_status;
  if (!col) return;

  var maxRows = _getSafeMaxSheetRows_(sh);
  if (maxRows > 1) {
    sh.getRange(2, col, maxRows - 1, 1).clearDataValidations();
  }

  var rowCount = _getAccessValidationRowCount_(sh);
  if (rowCount < 1) return;

  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(_getAccessRegistrationStatusValues_(), true)
    .setAllowInvalid(false)
    .setHelpText('Зазвичай статус змінює система: pending_review → key_sent → active')
    .build();

  sh.getRange(2, col, rowCount, 1).setDataValidation(rule);
}

function _syncRegistrationStatusForRow_(sh, rowNumber) {
  if (!sh || rowNumber < 2) return false;

  var headerMap = _getHeaderMap_(sh);
  var roleCol = headerMap.role;
  var enabledCol = headerMap.enabled;
  var statusCol = headerMap.registration_status;
  var approvedByCol = headerMap.approved_by;
  var approvedAtCol = headerMap.approved_at;

  if (!roleCol || !enabledCol || !statusCol) return false;

  var role = normalizeRole_(sh.getRange(rowNumber, roleCol).getValue());
  var enabled = _isAccessEnabledStrict_(sh.getRange(rowNumber, enabledCol).getValue());
  var statusCell = sh.getRange(rowNumber, statusCol);
  var currentStatus = String(statusCell.getValue() || '').trim().toLowerCase();

  if (_isAccessRegistrationFinalStatus_(currentStatus)) {
    return false;
  }

  var nextStatus = currentStatus || 'pending_review';

  // Главное правило:
  // выбрали реальную роль + включили enabled TRUE = заявка подтверждена, код можно отправлять.
  if (role && role !== 'guest' && enabled) {
    nextStatus = 'key_sent';
  } else if (!currentStatus) {
    nextStatus = 'pending_review';
  }

  if (_getAccessRegistrationStatusValues_().indexOf(nextStatus) === -1) {
    nextStatus = 'pending_review';
  }

  var changed = _setCellValueIfDifferent_(statusCell, nextStatus);

  if ((nextStatus === 'approved' || nextStatus === 'key_sent') && approvedByCol && approvedAtCol) {
    var approvedByCell = sh.getRange(rowNumber, approvedByCol);
    var approvedAtCell = sh.getRange(rowNumber, approvedAtCol);

    if (!String(approvedByCell.getValue() || '').trim()) {
      var actor = '';
      try { actor = safeGetUserEmail_(); } catch (_) {}
      approvedByCell.setValue(actor || 'admin');
      changed = true;
    }

    if (!String(approvedAtCell.getValue() || '').trim()) {
      approvedAtCell.setValue(_nowText_('long'));
      changed = true;
    }
  }

  return changed;
}


// ==================== ROW MAPPING ====================

function _syncRoleNoteForRow_(sh, rowNumber) {
  if (!sh || rowNumber < 2) return false;
  if (typeof getRoleNoteTemplate_ !== 'function') return false;

  var headerMap = _getHeaderMap_(sh);
  var roleCol = headerMap.role;
  var noteCol = headerMap.note;
  if (!roleCol || !noteCol) return false;

  var rawRole = String(sh.getRange(rowNumber, roleCol).getValue() || '').trim();
  var role = rawRole && typeof normalizeRole_ === 'function' ? normalizeRole_(rawRole) : rawRole.toLowerCase();
  var note = role ? String(getRoleNoteTemplate_(role) || '') : '';

  sh.getRange(rowNumber, noteCol).setValue(note);
  return true;
}

function _syncAllRoleNotes_(sh) {
  if (!sh) return 0;
  if (typeof getRoleNoteTemplate_ !== 'function') return 0;

  var headerMap = _getHeaderMap_(sh);
  var roleCol = headerMap.role;
  var noteCol = headerMap.note;
  if (!roleCol || !noteCol) return 0;

  var lastRow = Number(sh.getLastRow()) || 0;
  if (lastRow < 2) return 0;

  var rowCount = lastRow - 1;
  var roleValues = sh.getRange(2, roleCol, rowCount, 1).getValues();
  var noteValues = [];
  var changedCount = 0;

  for (var i = 0; i < roleValues.length; i++) {
    var rawRole = String(roleValues[i][0] || '').trim();
    var role = rawRole && typeof normalizeRole_ === 'function' ? normalizeRole_(rawRole) : rawRole.toLowerCase();
    var note = role ? String(getRoleNoteTemplate_(role) || '') : '';
    noteValues.push([note]);
    if (note) changedCount++;
  }

  sh.getRange(2, noteCol, rowCount, 1).setValues(noteValues);
  return changedCount;
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
    displayName: normalizeHumanName_(read('display_name')),
    personCallsign: normalizeCallsign_(read('person_callsign')),
    selfBindAllowed: isSelfBindAllowedValue_(read('self_bind_allowed'), read('role')),
    userKeyCurrentHash: normalizeStoredHash_(read('user_key_current_hash')),
    userKeyPrevHash: normalizeStoredHash_(read('user_key_prev_hash')),
    lastSeenAt: String(read('last_seen_at') || ''),
    lastRotatedAt: String(read('last_rotated_at') || ''),
    login: String(read('login') || '').trim(),
    passwordHash: String(read('password_hash') || '').trim(),
    passwordSalt: String(read('password_salt') || '').trim(),
    registrationStatus: String(read('registration_status') || '').trim().toLowerCase(),
    preferredContact: String(read('preferred_contact') || '').trim(),
    surname: normalizeHumanName_(read('surname')),
    firstName: normalizeHumanName_(read('first_name')),
    positionTitle: String(read('position_title') || '').trim(),
    requestUserKeyHash: normalizeStoredHash_(read('request_user_key_hash')),
    requestCreatedAt: String(read('request_created_at') || ''),
    temporaryPasswordPlain: String(read('temporary_password_plain') || '').trim(),
    temporaryPasswordHash: String(read('temporary_password_hash') || '').trim(),
    temporaryPasswordSalt: String(read('temporary_password_salt') || '').trim(),
    temporaryPasswordExpiresAt: String(read('temporary_password_expires_at') || ''),
    temporaryPasswordUsedAt: String(read('temporary_password_used_at') || ''),
    approvedBy: String(read('approved_by') || '').trim(),
    approvedAt: String(read('approved_at') || ''),
    activatedAt: String(read('activated_at') || ''),
    telegramUsername: String(read('telegram_username') || '').trim(),
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

function _appendEntryByHeaderMap_(entry) {
  var sh = _getSheet_(true);
  var removedObsoleteColumns = _removeAccessObsoleteColumns_(sh);
  if (!sh) return null;

  _ensureSheetSchema_(sh);

  var headerMap = _getHeaderMap_(sh);
  var headers = _getExpectedHeaders_();
  var nextRow = Math.max(Number(sh.getLastRow()) || 1, 1) + 1;
  var normalized = Object.assign({}, entry || {});

  var rowValues = headers.map(function(header) {
    switch (header) {
      case 'email': return normalizeEmail_(normalized.email);
      case 'phone': return normalizePhone_(normalized.phone);
      case 'role': return normalizeRole_(normalized.role || 'guest');
      case 'enabled': return normalized.enabled ? 'TRUE' : 'FALSE';
      case 'note': return normalized.note !== undefined ? normalized.note : getRoleNoteTemplate_(normalized.role || 'guest');
      case 'display_name': return normalizeHumanName_(normalized.displayName || normalized.display_name || '');
      case 'person_callsign': return normalizeCallsign_(normalized.personCallsign || normalized.person_callsign || '');
      case 'self_bind_allowed': return normalized.selfBindAllowed === false || normalized.self_bind_allowed === false ? 'FALSE' : 'TRUE';
      case 'user_key_current_hash': return normalizeStoredHash_(normalized.userKeyCurrentHash || normalized.user_key_current_hash || '');
      case 'user_key_prev_hash': return normalizeStoredHash_(normalized.userKeyPrevHash || normalized.user_key_prev_hash || '');
      case 'last_seen_at': return normalized.lastSeenAt || normalized.last_seen_at || '';
      case 'last_rotated_at': return normalized.lastRotatedAt || normalized.last_rotated_at || '';
      case 'failed_attempts': return normalized.failedAttempts || normalized.failed_attempts || 0;
      case 'locked_until_ms': return normalized.lockedUntilMs || normalized.locked_until_ms || 0;
      case 'login': return normalized.login || '';
      case 'password_hash': return normalized.passwordHash || normalized.password_hash || '';
      case 'password_salt': return normalized.passwordSalt || normalized.password_salt || '';
      case 'registration_status': return normalized.registrationStatus || normalized.registration_status || '';
      case 'preferred_contact': return normalized.preferredContact || normalized.preferred_contact || '';
      case 'surname': return normalizeHumanName_(normalized.surname || '');
      case 'first_name': return normalizeHumanName_(normalized.firstName || normalized.first_name || '');
      case 'position_title': return normalized.positionTitle || normalized.position_title || '';
      case 'request_user_key_hash': return normalizeStoredHash_(normalized.requestUserKeyHash || normalized.request_user_key_hash || '');
      case 'request_created_at': return normalized.requestCreatedAt || normalized.request_created_at || '';
      case 'temporary_password_plain': return normalized.temporaryPasswordPlain || normalized.temporary_password_plain || '';
      case 'temporary_password_hash': return normalized.temporaryPasswordHash || normalized.temporary_password_hash || '';
      case 'temporary_password_salt': return normalized.temporaryPasswordSalt || normalized.temporary_password_salt || '';
      case 'temporary_password_expires_at': return normalized.temporaryPasswordExpiresAt || normalized.temporary_password_expires_at || '';
      case 'temporary_password_used_at': return normalized.temporaryPasswordUsedAt || normalized.temporary_password_used_at || '';
      case 'approved_by': return normalized.approvedBy || normalized.approved_by || '';
      case 'approved_at': return normalized.approvedAt || normalized.approved_at || '';
      case 'activated_at': return normalized.activatedAt || normalized.activated_at || '';
      case 'telegram_username': return normalized.telegramUsername || normalized.telegram_username || '';
      default: return '';
    }
  });

  sh.getRange(nextRow, 1, 1, headers.length).setValues([rowValues]);
  _invalidateAccessRepoCachesSafe_();
  return _getEntryBySheetRow_(nextRow);
}

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
  if (entry.displayName !== undefined) updates.display_name = normalizeHumanName_(entry.displayName);
  if (entry.personCallsign !== undefined) updates.person_callsign = normalizeCallsign_(entry.personCallsign);
  if (entry.selfBindAllowed !== undefined) updates.self_bind_allowed = entry.selfBindAllowed ? 'TRUE' : 'FALSE';
  if (entry.userKeyCurrentHash !== undefined) updates.user_key_current_hash = entry.userKeyCurrentHash;
  if (entry.userKeyPrevHash !== undefined) updates.user_key_prev_hash = entry.userKeyPrevHash;
  if (entry.lastSeenAt !== undefined) updates.last_seen_at = entry.lastSeenAt;
  if (entry.lastRotatedAt !== undefined) updates.last_rotated_at = entry.lastRotatedAt;
  if (entry.failedAttempts !== undefined) updates.failed_attempts = entry.failedAttempts;
  if (entry.lockedUntilMs !== undefined) updates.locked_until_ms = entry.lockedUntilMs;
  if (entry.surname !== undefined) updates.surname = normalizeHumanName_(entry.surname);
  if (entry.login !== undefined) updates.login = entry.login;
  if (entry.passwordHash !== undefined) updates.password_hash = entry.passwordHash;
  if (entry.passwordSalt !== undefined) updates.password_salt = entry.passwordSalt;
  if (entry.firstName !== undefined) updates.first_name = normalizeHumanName_(entry.firstName);
  if (entry.positionTitle !== undefined) updates.position_title = entry.positionTitle;
  if (entry.requestUserKeyHash !== undefined) updates.request_user_key_hash = normalizeStoredHash_(entry.requestUserKeyHash);
  if (entry.requestCreatedAt !== undefined) updates.request_created_at = entry.requestCreatedAt;
  if (entry.temporaryPasswordPlain !== undefined) updates.temporary_password_plain = entry.temporaryPasswordPlain;
  if (entry.temporaryPasswordHash !== undefined) updates.temporary_password_hash = entry.temporaryPasswordHash;
  if (entry.temporaryPasswordSalt !== undefined) updates.temporary_password_salt = entry.temporaryPasswordSalt;
  if (entry.temporaryPasswordExpiresAt !== undefined) updates.temporary_password_expires_at = entry.temporaryPasswordExpiresAt;
  if (entry.temporaryPasswordUsedAt !== undefined) updates.temporary_password_used_at = entry.temporaryPasswordUsedAt;
  if (entry.approvedBy !== undefined) updates.approved_by = entry.approvedBy;
  if (entry.approvedAt !== undefined) updates.approved_at = entry.approvedAt;
  if (entry.activatedAt !== undefined) updates.activated_at = entry.activatedAt;
  if (entry.telegramUsername !== undefined) updates.telegram_username = entry.telegramUsername;

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
    mapped.displayName = normalizeHumanName_(updates.display_name);
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'displayName')) {
    mapped.displayName = normalizeHumanName_(updates.displayName);
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

  if (Object.prototype.hasOwnProperty.call(updates, 'login')) {
    mapped.login = String(updates.login || '').trim();
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'password_hash')) {
    mapped.passwordHash = String(updates.password_hash || '').trim();
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'password_salt')) {
    mapped.passwordSalt = String(updates.password_salt || '').trim();
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'registration_status')) {
    mapped.registrationStatus = String(updates.registration_status || '').trim().toLowerCase();
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'activated_at')) {
    mapped.activatedAt = String(updates.activated_at || '');
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'temporary_password_plain')) {
    mapped.temporaryPasswordPlain = String(updates.temporary_password_plain || '').trim();
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'temporary_password_used_at')) {
    mapped.temporaryPasswordUsedAt = String(updates.temporary_password_used_at || '');
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'surname')) {
    mapped.surname = normalizeHumanName_(updates.surname);
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'first_name')) {
    mapped.firstName = normalizeHumanName_(updates.first_name);
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'firstName')) {
    mapped.firstName = normalizeHumanName_(updates.firstName);
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'position_title')) {
    mapped.positionTitle = String(updates.position_title || '').trim();
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'positionTitle')) {
    mapped.positionTitle = String(updates.positionTitle || '').trim();
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'request_user_key_hash')) {
    mapped.requestUserKeyHash = normalizeStoredHash_(updates.request_user_key_hash);
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'requestUserKeyHash')) {
    mapped.requestUserKeyHash = normalizeStoredHash_(updates.requestUserKeyHash);
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'request_created_at')) {
    mapped.requestCreatedAt = String(updates.request_created_at || '');
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'temporary_password_plain')) {
    mapped.temporaryPasswordPlain = String(updates.temporary_password_plain || '').trim();
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'temporary_password_hash')) {
    mapped.temporaryPasswordHash = String(updates.temporary_password_hash || '').trim();
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'temporary_password_salt')) {
    mapped.temporaryPasswordSalt = String(updates.temporary_password_salt || '').trim();
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'temporary_password_expires_at')) {
    mapped.temporaryPasswordExpiresAt = String(updates.temporary_password_expires_at || '');
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'temporary_password_used_at')) {
    mapped.temporaryPasswordUsedAt = String(updates.temporary_password_used_at || '');
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'approved_by')) {
    mapped.approvedBy = String(updates.approved_by || '').trim();
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'approved_at')) {
    mapped.approvedAt = String(updates.approved_at || '');
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'activated_at')) {
    mapped.activatedAt = String(updates.activated_at || '');
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'telegram_username')) {
    mapped.telegramUsername = String(updates.telegram_username || '').trim();
  }

  _writeEntryByHeaderMap_(sheetRow, mapped);
  return mapped;
}


function handleAccessSheetEdit(e) {
  var range = e && e.range ? e.range : null;
  if (!range) return;

  var sh = range.getSheet();
  if (!sh || sh.getName() !== ACCESS_SHEET) return;

  var row = range.getRow();
  var column = range.getColumn();
  var numRows = Number(range.getNumRows()) || 1;
  var numColumns = Number(range.getNumColumns()) || 1;
  if (row < 2) return;

  var headerMap = _getHeaderMap_(sh);
  var roleCol = headerMap.role;
  var enabledCol = headerMap.enabled;
  var statusCol = headerMap.registration_status;
  var emailCol = headerMap.email;

  var humanNameColumns = {};
  if (headerMap.display_name) humanNameColumns[headerMap.display_name] = true;
  if (headerMap.surname) humanNameColumns[headerMap.surname] = true;
  if (headerMap.first_name) humanNameColumns[headerMap.first_name] = true;

  if (numRows >= 1 && numColumns >= 1) {
    var values = range.getValues();
    var changed = false;

    for (var r = 0; r < values.length; r++) {
      for (var c = 0; c < values[r].length; c++) {
        var absoluteColumn = column + c;
        if (!humanNameColumns[absoluteColumn]) continue;

        var normalizedName = normalizeHumanName_(values[r][c]);
        if (String(values[r][c] || '') !== normalizedName) {
          values[r][c] = normalizedName;
          changed = true;
        }
      }
    }

    if (changed) {
      range.setValues(values);
    }
  }

  var includesRoleColumn = !!roleCol && column <= roleCol && roleCol < (column + numColumns);
  var includesEnabledColumn = !!enabledCol && column <= enabledCol && enabledCol < (column + numColumns);
  var includesStatusColumn = !!statusCol && column <= statusCol && statusCol < (column + numColumns);

  if (includesRoleColumn) {
    var roleRange = sh.getRange(row, roleCol, numRows, 1);
    var roleValues = roleRange.getValues();
    var roleChanged = false;

    for (var rr = 0; rr < roleValues.length; rr++) {
      var rawRole = String(roleValues[rr][0] || '').trim();
      var normalizedRole = rawRole ? normalizeRole_(rawRole) : '';
      if (String(roleValues[rr][0] || '') !== normalizedRole) {
        roleValues[rr][0] = normalizedRole;
        roleChanged = true;
      }
    }

    if (roleChanged) {
      roleRange.setValues(roleValues);
    }

    for (var syncOffset = 0; syncOffset < numRows; syncOffset++) {
      _syncRoleNoteForRow_(sh, row + syncOffset);
    }
  }

  if (includesStatusColumn) {
    var statusRange = sh.getRange(row, statusCol, numRows, 1);
    var statusValues = statusRange.getValues();
    var statusChanged = false;
    var allowedStatuses = _getAccessRegistrationStatusValues_();

    for (var sr = 0; sr < statusValues.length; sr++) {
      var rawStatus = String(statusValues[sr][0] || '').trim().toLowerCase();
      if (rawStatus && allowedStatuses.indexOf(rawStatus) === -1) {
        rawStatus = 'pending_review';
      }

      if (String(statusValues[sr][0] || '') !== rawStatus) {
        statusValues[sr][0] = rawStatus;
        statusChanged = true;
      }
    }

    if (statusChanged) {
      statusRange.setValues(statusValues);
    }
  }

  if (includesRoleColumn || includesEnabledColumn || includesStatusColumn) {
    for (var statusOffset = 0; statusOffset < numRows; statusOffset++) {
      _syncRegistrationStatusForRow_(sh, row + statusOffset);
    }
  }

  if (emailCol && column === emailCol && numColumns === 1 && numRows === 1) {
    var email = normalizeEmail_(range.getValue());
    if (email && email.indexOf('@') === -1) {
      range.setValue('');
      SpreadsheetApp.getActive().toast('Некоректний email', 'Помилка', 3);
    }
  }

  _invalidateAccessCaches_();
}

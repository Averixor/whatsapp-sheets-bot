// ==================== ГОЛОВНА ФУНКЦІЯ DESCRIBE ====================

/**
 * Отримує дескриптор доступу для поточного користувача.
 * @param {string|Object} emailOrOptions - Email або об'єкт опцій.
 * @param {Object} maybeOptions - Опції, якщо перший параметр не є об'єктом.
 * @returns {Object}
 */
function describe(emailOrOptions, maybeOptions) {
  var opts;
  var email;

  if (emailOrOptions && typeof emailOrOptions === 'object' && !Array.isArray(emailOrOptions)) {
    opts = Object.assign({}, emailOrOptions);
    email = '';
  } else {
    opts = Object.assign({}, maybeOptions || {});
    email = emailOrOptions;
  }

  var currentKeyHash = getCurrentUserKeyHash_();
  var sessionEmail = normalizeEmail_(email) || safeGetUserEmail_();

  var context = {
    currentKeyHash: currentKeyHash,
    sessionEmail: sessionEmail,
    keyAvailable: !!currentKeyHash,
    emailAvailable: !!sessionEmail
  };

  var policy = _getAccessPolicy_();
  var descriptor = _resolveAccessSubjectReadOnly_(context);

  return _buildPublicAccessResponse_(descriptor, context, policy, opts);
}

/**
 * Шукає запис користувача для повідомлення про помилку доступу.
 * @param {Object} context
 * @returns {Object|null}
 */
function _resolveEntryForAccessFailure_(context) {
  if (context && context.currentKeyHash) {
    var byKey = _findByUserKey_(context.currentKeyHash, {
      includeLocked: true,
      includeDisabled: true
    });
    if (byKey) return byKey;
  }

  if (context && context.sessionEmail) {
    var byEmail = _findByEmailInSheet_(context.sessionEmail, {
      includeLocked: true,
      includeDisabled: true
    });
    if (byEmail) return byEmail;
  }

  return null;
}

// ==================== ПЕРЕВІРКА РОЛЕЙ ТА ДОСТУПУ ====================

/**
 * Перевіряє, чи має поточний користувач роль не нижче заданої.
 * @param {string} requiredRole
 * @param {string} actionLabel
 * @returns {Object}
 * @throws {Error}
 */
function assertRoleAtLeast(requiredRole, actionLabel) {
  var descriptor = describe();
  var required = normalizeRole_(requiredRole || 'viewer');
  var currentRole = descriptor.role;
  var currentRoleLevel = ROLE_ORDER[currentRole] || 0;
  var requiredLevel = ROLE_ORDER[required] || 0;

  if (descriptor.enabled && currentRoleLevel >= requiredLevel) {
    return descriptor;
  }

  Logger.log(
    '[AccessControl] Role denied: required ' +
    required +
    ', current ' +
    currentRole +
    ', action: ' +
    String(actionLabel || 'unspecified')
  );

  if (
    typeof AccessEnforcement_ === 'object' &&
    AccessEnforcement_ &&
    typeof AccessEnforcement_.reportViolation === 'function'
  ) {
    AccessEnforcement_.reportViolation('roleDenied', {
      requiredRole: required,
      actionLabel: String(actionLabel || 'ця дія'),
      currentRole: currentRole,
      currentRoleLabel: getRoleLabel_(currentRole),
      locked: !!(descriptor.lockout && descriptor.lockout.locked),
      disabledByAdmin: !!(descriptor.lockout && descriptor.lockout.disabledByAdmin)
    }, descriptor);
  }

  if (descriptor.lockout && descriptor.lockout.disabledByAdmin) {
    throw new Error('Користувача вимкнено адміністратором.');
  }

  if (descriptor.lockout && descriptor.lockout.locked) {
    var msg = 'Доступ тимчасово заблоковано.';
    if (descriptor.lockout.remainingMinutes) {
      msg += ' Залишилось ' + descriptor.lockout.remainingMinutes + ' хв.';
    }
    throw new Error(msg);
  }

  throw new Error(
    'Недостатньо прав для дії: ' +
    String(actionLabel || 'ця дія') +
    '. Поточна роль: ' +
    currentRole +
    '.'
  );
}

// ==================== EMAIL-СПИСКИ ЗА РОЛЯМИ ====================

function listEmailsByRole(role) {
  var normalizedRole = normalizeRole_(role);
  var entries = _readSheetEntries_();
  var out = [];
  var i;
  var entry;

  for (i = 0; i < entries.length; i++) {
    entry = entries[i];
    if (entry.enabled && entry.role === normalizedRole && entry.email) {
      out.push(entry.email);
    }
  }

  return out;
}

function listAdminEmails() {
  var entries = _readSheetEntries_();
  var out = [];
  var i;
  var entry;

  for (i = 0; i < entries.length; i++) {
    entry = entries[i];
    if (
      entry.enabled &&
      entry.email &&
      (entry.role === 'owner' || entry.role === 'sysadmin' || entry.role === 'admin')
    ) {
      out.push(entry.email);
    }
  }

  return out;
}

function listNotificationEmails() {
  return listAdminEmails();
}

function getAccessRowByEmail(email) {
  var normalizedEmail = normalizeEmail_(email);
  if (!normalizedEmail) return null;

  return _findByEmailInSheet_(normalizedEmail, {
    includeLocked: true,
    includeDisabled: true
  });
}

// ==================== ДОПОМІЖНІ ФУНКЦІЇ ДЛЯ РОЛЕЙ ====================

function getRoleMeta_(role) {
  var normalized = normalizeRole_(role);
  return ROLE_METADATA[normalized] || ROLE_METADATA.guest;
}

function getRoleLabel_(role) {
  return getRoleMeta_(role).label;
}

function getRoleNoteTemplate_(role) {
  return getRoleMeta_(role).note;
}

function listAllowedActionsForRole_(role) {
  switch (normalizeRole_(role)) {
    case 'guest':
      return ['безпечний перегляд'];
    case 'viewer':
      return ['власна картка'];
    case 'operator':
      return ['усі картки', 'коротке зведення', 'детальне зведення'];
    case 'maintainer':
      return ['усі дії operator', 'SEND_PANEL', 'робочі дії', 'діагностика'];
    case 'admin':
      return ['усі дії maintainer', 'керування ACCESS', 'журнали порушень'];
    case 'sysadmin':
      return ['усі дії admin', 'repair', 'protections', 'triggers'];
    case 'owner':
      return ['повний доступ до всієї системи'];
    default:
      return ['безпечний перегляд'];
  }
}

// ==================== ВАЛІДАЦІЯ ТА ДІАГНОСТИКА ====================

function _pushRowToBucket_(bucket, key, rowNum) {
  if (!key) return;
  if (!bucket[key]) bucket[key] = [];
  bucket[key].push(rowNum);
}

function validateAccessSheet() {
  var entries = _readSheetEntries_();
  var rawEntries = _readRawSheetEntries_();
  var issues = [];

  var emailRows = {};
  var currentKeyRows = {};
  var prevKeyRows = {};

  var i;
  var rowNum;
  var entry;
  var raw;
  var roleCol;
  var rawRole;
  var enabledCol;
  var rawEnabled;
  var validEnabled;

  for (i = 0; i < entries.length; i++) {
    entry = entries[i];
    rowNum = i + 2;

    _pushRowToBucket_(emailRows, entry.email, rowNum);
    _pushRowToBucket_(currentKeyRows, entry.userKeyCurrentHash, rowNum);
    _pushRowToBucket_(prevKeyRows, entry.userKeyPrevHash, rowNum);
  }

  for (i = 0; i < entries.length; i++) {
    entry = entries[i];
    rowNum = i + 2;

    if (entry.email) {
      if (entry.email.indexOf('@') === -1) {
        issues.push('Рядок ' + rowNum + ': некоректний email "' + entry.email + '"');
      }
      if ((emailRows[entry.email] || []).length > 1) {
        issues.push(
          'Рядок ' + rowNum + ': дубль email "' + entry.email + '" (рядки ' + emailRows[entry.email].join(', ') + ')'
        );
      }
    }

    if (entry.userKeyCurrentHash && (currentKeyRows[entry.userKeyCurrentHash] || []).length > 1) {
      issues.push(
        'Рядок ' + rowNum + ': дубль current_key (рядки ' + currentKeyRows[entry.userKeyCurrentHash].join(', ') + ')'
      );
    }

    if (entry.userKeyPrevHash && (prevKeyRows[entry.userKeyPrevHash] || []).length > 1) {
      issues.push(
        'Рядок ' + rowNum + ': дубль prev_key (рядки ' + prevKeyRows[entry.userKeyPrevHash].join(', ') + ')'
      );
    }

    if (
      entry.userKeyCurrentHash &&
      entry.userKeyPrevHash &&
      entry.userKeyCurrentHash === entry.userKeyPrevHash
    ) {
      issues.push('Рядок ' + rowNum + ': current_key === prev_key');
    }

    if (entry.userKeyPrevHash && currentKeyRows[entry.userKeyPrevHash] && currentKeyRows[entry.userKeyPrevHash].length) {
      issues.push(
        'Рядок ' + rowNum + ': prev_key збігається з current_key рядків ' +
        currentKeyRows[entry.userKeyPrevHash].join(', ')
      );
    }

    if (entry.userKeyCurrentHash && prevKeyRows[entry.userKeyCurrentHash] && prevKeyRows[entry.userKeyCurrentHash].length) {
      issues.push(
        'Рядок ' + rowNum + ': current_key збігається з prev_key рядків ' +
        prevKeyRows[entry.userKeyCurrentHash].join(', ')
      );
    }
  }

  for (i = 0; i < rawEntries.length; i++) {
    raw = rawEntries[i];
    rowNum = raw.rowNumber;

    roleCol = raw.headerMap.role;
    rawRole = roleCol ? String(raw.rawRow[roleCol - 1] || '').trim().toLowerCase() : '';
    if (rawRole && ROLE_VALUES.indexOf(rawRole) === -1) {
      issues.push('Рядок ' + rowNum + ': некоректна роль "' + rawRole + '"');
    }

    enabledCol = raw.headerMap.enabled;
    rawEnabled = enabledCol ? String(raw.rawRow[enabledCol - 1] || '').trim().toLowerCase() : 'true';
    validEnabled = (
      rawEnabled === 'true' ||
      rawEnabled === 'false' ||
      rawEnabled === '1' ||
      rawEnabled === '0' ||
      rawEnabled === 'yes' ||
      rawEnabled === 'no' ||
      rawEnabled === 'так' ||
      rawEnabled === 'ні' ||
      rawEnabled === ''
    );

    if (!validEnabled) {
      issues.push('Рядок ' + rowNum + ': некоректне значення enabled "' + rawEnabled + '"');
    }
  }

  return {
    valid: issues.length === 0,
    issues: issues
  };
}

function _hasAccessIdentifierForDiagnostics_(entry) {
  if (!entry) return false;
  return !!(
    entry.email ||
    entry.phone ||
    entry.userKeyCurrentHash ||
    entry.userKeyPrevHash ||
    entry.personCallsign
  );
}

function runAccessDiagnostics() {
  var policy = _getAccessPolicy_();
  var entries = _readSheetEntries_();
  var rawEntries = _readRawSheetEntries_();
  var sh = _getSheet_(false);
  var headerMap = sh ? _getHeaderMap_(sh) : {};

  var diagnostics = {
    schema: {
      exists: !!sh,
      headersPresent: true,
      missingHeaders: [],
      headersCanonical: false
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
      registeredKeysCount: 0,
      lockedUsersCount: 0,
      adminDisabledUsersCount: 0,
      usersWithoutCurrentKey: 0,
      usersWithOnlyIdentifierAccess: 0,
      selfBindableUsersCount: 0
    }
  };

  var missing = [];
  var i;
  var j;
  var rowNum;
  var firstRow;
  var canonical;
  var entry;
  var raw;
  var roleCol;
  var rawRole;
  var enabledCol;
  var rawEnabled;
  var isValid;
  var emailRows = {};
  var currentKeyRows = {};
  var prevKeyRows = {};

  for (i = 0; i < SHEET_HEADERS.length; i++) {
    if (headerMap[SHEET_HEADERS[i]] === undefined) {
      missing.push(SHEET_HEADERS[i]);
    }
  }

  diagnostics.schema.missingHeaders = missing;
  diagnostics.schema.headersPresent = missing.length === 0;

  if (sh) {
    firstRow = sh.getRange(1, 1, 1, SHEET_HEADERS.length).getValues()[0];
    canonical = true;

    for (i = 0; i < SHEET_HEADERS.length; i++) {
      if (firstRow[i] !== SHEET_HEADERS[i]) {
        canonical = false;
        break;
      }
    }

    diagnostics.schema.headersCanonical = canonical;
  }

  for (i = 0; i < entries.length; i++) {
    entry = entries[i];
    rowNum = i + 2;

    _pushRowToBucket_(emailRows, entry.email, rowNum);
    _pushRowToBucket_(currentKeyRows, entry.userKeyCurrentHash, rowNum);
    _pushRowToBucket_(prevKeyRows, entry.userKeyPrevHash, rowNum);
  }

  for (i = 0; i < entries.length; i++) {
    entry = entries[i];
    rowNum = i + 2;

    if (entry.email && (emailRows[entry.email] || []).length > 1) {
      diagnostics.dataIntegrity.duplicateEmails.push({
        email: entry.email,
        rows: emailRows[entry.email]
      });
    }

    if (entry.userKeyCurrentHash && (currentKeyRows[entry.userKeyCurrentHash] || []).length > 1) {
      diagnostics.dataIntegrity.duplicateCurrentKeys.push({
        hash: entry.userKeyCurrentHash,
        rows: currentKeyRows[entry.userKeyCurrentHash]
      });
    }

    if (entry.userKeyPrevHash && (prevKeyRows[entry.userKeyPrevHash] || []).length > 1) {
      diagnostics.dataIntegrity.duplicatePrevKeys.push({
        hash: entry.userKeyPrevHash,
        rows: prevKeyRows[entry.userKeyPrevHash]
      });
    }

    if (
      entry.userKeyCurrentHash &&
      entry.userKeyPrevHash &&
      entry.userKeyCurrentHash === entry.userKeyPrevHash
    ) {
      diagnostics.dataIntegrity.currentEqualsPrev.push(rowNum);
    }

    if (entry.userKeyPrevHash && currentKeyRows[entry.userKeyPrevHash]) {
      diagnostics.dataIntegrity.prevCollidesWithCurrent.push({
        row: rowNum,
        prevHash: entry.userKeyPrevHash,
        collidesWithRows: currentKeyRows[entry.userKeyPrevHash]
      });
    }

    if (!_hasAccessIdentifierForDiagnostics_(entry) && entry.role !== 'guest') {
      diagnostics.dataIntegrity.emptyIdentifierWithActiveRole.push(rowNum);
    }

    if (entry.lockedUntilMs && entry.lockedUntilMs > 0 && entry.lockedUntilMs < _nowMs_()) {
      diagnostics.dataIntegrity.brokenLockedUntil.push({
        row: rowNum,
        lockedUntilMs: entry.lockedUntilMs
      });
    }

    if (entry.userKeyCurrentHash || entry.userKeyPrevHash) diagnostics.runtime.registeredKeysCount++;
    if (_isTimedLocked_(entry)) diagnostics.runtime.lockedUsersCount++;
    if (_isAdminDisabled_(entry)) diagnostics.runtime.adminDisabledUsersCount++;
    if (!entry.userKeyCurrentHash) diagnostics.runtime.usersWithoutCurrentKey++;
    if (!entry.userKeyCurrentHash && !entry.userKeyPrevHash && (entry.email || entry.phone)) {
      diagnostics.runtime.usersWithOnlyIdentifierAccess++;
    }
    if (entry.enabled && entry.selfBindAllowed && normalizeCallsign_(entry.personCallsign)) {
      diagnostics.runtime.selfBindableUsersCount++;
    }
  }

  for (j = 0; j < rawEntries.length; j++) {
    raw = rawEntries[j];
    rowNum = raw.rowNumber;

    roleCol = raw.headerMap.role;
    rawRole = roleCol ? String(raw.rawRow[roleCol - 1] || '').trim().toLowerCase() : '';
    if (rawRole && ROLE_VALUES.indexOf(rawRole) === -1) {
      diagnostics.dataIntegrity.invalidRoleValues.push({
        row: rowNum,
        role: rawRole
      });
    }

    enabledCol = raw.headerMap.enabled;
    rawEnabled = enabledCol ? String(raw.rawRow[enabledCol - 1] || '').trim().toLowerCase() : 'true';
    isValid = (
      rawEnabled === 'true' ||
      rawEnabled === 'false' ||
      rawEnabled === '1' ||
      rawEnabled === '0' ||
      rawEnabled === 'yes' ||
      rawEnabled === 'no' ||
      rawEnabled === 'так' ||
      rawEnabled === 'ні' ||
      rawEnabled === ''
    );

    if (!isValid) {
      diagnostics.dataIntegrity.invalidEnabledValues.push({
        row: rowNum,
        enabled: rawEnabled
      });
    }
  }

  return diagnostics;
}

function getReadinessStatus() {
  var diag = runAccessDiagnostics();
  var policy = _getAccessPolicy_();

  var critical = [];
  var warnings = [];

  if (!diag.schema.exists) {
    critical.push('ACCESS sheet missing');
  }

  if (!diag.schema.headersPresent) {
    critical.push('Missing headers: ' + diag.schema.missingHeaders.join(', '));
  }

  if (diag.dataIntegrity.duplicateEmails.length) {
    critical.push('Duplicate emails found');
  }

  if (diag.dataIntegrity.duplicateCurrentKeys.length) {
    critical.push('Duplicate current keys found');
  }

  if (diag.dataIntegrity.invalidRoleValues.length) {
    critical.push('Invalid role values found');
  }

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

// ==================== UI ТАБЛИЦІ ACCESS ====================

function bootstrapSheet() {
  var existed = !!_getSheet_(false);
  var sh = _getSheet_(true);
  _applyRoleValidation_(sh);
  _applyEmailValidation_(sh);
  _applyEnabledValidation_(sh);
  _applySelfBindAllowedValidation_(sh);
  _applyRegistrationStatusValidation_(sh);
  _syncAllRoleNotes_(sh);
  _syncAllRegistrationStatuses_(sh);
  _invalidateAccessCaches_();
  return { success: true, sheet: ACCESS_SHEET, created: !existed, headers: SHEET_HEADERS.slice(), roleValues: ROLE_VALUES.slice(), registrationStatusValues: _getAccessRegistrationStatusValues_() };
}

/**
 * Оновлює UI таблиці ACCESS.
 * @returns {Object}
 */
function refreshAccessSheetUi() {
  var sh = _getSheet_(true);
  if (typeof _removeAccessObsoleteColumns_ === 'function') _removeAccessObsoleteColumns_(sh);
  _applyRoleValidation_(sh);
  _applyEmailValidation_(sh);
  _applyEnabledValidation_(sh);
  _applySelfBindAllowedValidation_(sh);
  _applyRegistrationStatusValidation_(sh);
  var syncedNotes = _syncAllRoleNotes_(sh);
  var syncedStatuses = _syncAllRegistrationStatuses_(sh);
  _invalidateAccessCaches_();
  return { success: true, sheet: ACCESS_SHEET, message: 'ACCESS schema updated', roleValues: ROLE_VALUES.slice(), registrationStatusValues: _getAccessRegistrationStatusValues_(), syncedNotes: syncedNotes, syncedStatuses: syncedStatuses };
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
    var changedNames = false;
    for (var r = 0; r < values.length; r++) {
      for (var c = 0; c < values[r].length; c++) {
        var absoluteColumn = column + c;
        if (!humanNameColumns[absoluteColumn]) continue;
        var normalizedName = normalizeHumanName_(values[r][c]);
        if (String(values[r][c] || '') !== normalizedName) { values[r][c] = normalizedName; changedNames = true; }
      }
    }
    if (changedNames) range.setValues(values);
  }
  var includesRoleColumn = !!roleCol && column <= roleCol && roleCol < (column + numColumns);
  var includesEnabledColumn = !!enabledCol && column <= enabledCol && enabledCol < (column + numColumns);
  var includesStatusColumn = !!statusCol && column <= statusCol && statusCol < (column + numColumns);
  if (includesRoleColumn) {
    var roleRange = sh.getRange(row, roleCol, numRows, 1);
    var roleValues = roleRange.getValues();
    var roleChanged = false;
    for (var rr = 0; rr < roleValues.length; rr++) { var rawRole = String(roleValues[rr][0] || '').trim(); var normalizedRole = rawRole ? normalizeRole_(rawRole) : ''; if (String(roleValues[rr][0] || '') !== normalizedRole) { roleValues[rr][0] = normalizedRole; roleChanged = true; } }
    if (roleChanged) roleRange.setValues(roleValues);
    for (var noteOffset = 0; noteOffset < numRows; noteOffset++) _syncRoleNoteForRow_(sh, row + noteOffset);
  }
  if (includesStatusColumn) {
    var statusRange = sh.getRange(row, statusCol, numRows, 1);
    var statusValues = statusRange.getValues();
    var statusChanged = false;
    var allowedStatuses = _getAccessRegistrationStatusValues_();
    for (var sr = 0; sr < statusValues.length; sr++) { var rawStatus = String(statusValues[sr][0] || '').trim().toLowerCase(); if (rawStatus && allowedStatuses.indexOf(rawStatus) === -1) rawStatus = 'pending_review'; if (String(statusValues[sr][0] || '') !== rawStatus) { statusValues[sr][0] = rawStatus; statusChanged = true; } }
    if (statusChanged) statusRange.setValues(statusValues);
  }
  if (includesRoleColumn || includesEnabledColumn || includesStatusColumn) {
    for (var statusOffset = 0; statusOffset < numRows; statusOffset++) _syncRegistrationStatusForRow_(sh, row + statusOffset);
  }
  if (emailCol && column === emailCol && numColumns === 1 && numRows === 1) {
    var email = normalizeEmail_(range.getValue());
    if (email && email.indexOf('@') === -1) { range.setValue(''); SpreadsheetApp.getActive().toast('Некоректний email', 'Помилка', 3); }
  }
  _invalidateAccessCaches_();
}


// ==================== ТЕСТИ ====================

function _testAccessControl_() {
  var results = {
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

  var policy = _getAccessPolicy_();

  assert(typeof policy.strictUserKeyMode === 'boolean', 'Policy has strictUserKeyMode', policy.strictUserKeyMode);
  assert(typeof policy.migrationModeEnabled === 'boolean', 'Policy has migrationModeEnabled', policy.migrationModeEnabled);
  assert(typeof policy.bootstrapAllowed === 'boolean', 'Policy has bootstrapAllowed', policy.bootstrapAllowed);
  assert(typeof policy.adminConfigured === 'boolean', 'Policy has adminConfigured', policy.adminConfigured);

  assert(ROLE_VALUES.length === 7, 'ROLE_VALUES has 7 items', ROLE_VALUES);
  assert(ROLE_ORDER.owner === 6, 'ROLE_ORDER.owner is 6', ROLE_ORDER.owner);
  assert(ROLE_ORDER.guest === 0, 'ROLE_ORDER.guest is 0', ROLE_ORDER.guest);

  assert(SHEET_HEADERS.indexOf('email') !== -1, 'SHEET_HEADERS includes email');
  assert(SHEET_HEADERS.indexOf('phone') !== -1, 'SHEET_HEADERS includes phone');
  assert(SHEET_HEADERS.indexOf('user_key_current_hash') !== -1, 'SHEET_HEADERS includes user_key_current_hash');
  var requiredAccessHeaders = [
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
    'locked_until_ms',
    'login',
    'password_hash',
    'password_salt',
    'registration_status',
    'preferred_contact',
    'surname',
    'first_name',
    'request_user_key_hash',
    'request_created_at',
    'temporary_password_plain',
    'temporary_password_hash',
    'temporary_password_salt',
    'temporary_password_expires_at',
    'temporary_password_used_at',
    'approved_by',
    'approved_at',
    'activated_at',
    'telegram_username'
  ];

  var missingAccessHeaders = requiredAccessHeaders.filter(function(header) {
    return SHEET_HEADERS.indexOf(header) === -1;
  });

  assert(
    missingAccessHeaders.length === 0,
    'SHEET_HEADERS supports current ACCESS registration schema',
    {
      count: SHEET_HEADERS.length,
      required: requiredAccessHeaders.length,
      missing: missingAccessHeaders
    }
  );

  var hashed = hashRawUserKey_('test-key');
  assert(hashed && hashed.length === 64, 'hashRawUserKey returns 64-char hex', hashed);

  var masked = maskSensitiveValue_('1234567890abcdef');
  assert(masked.indexOf('…') !== -1, 'maskSensitiveValue masks long strings', masked);

  var normalized = normalizeRole_('ADMIN');
  assert(normalized === 'admin', 'normalizeRole converts to lowercase', normalized);

  var emailNorm = normalizeEmail_(' USER@DOMAIN.COM ');
  assert(emailNorm === 'user@domain.com', 'normalizeEmail trims and lowercases', emailNorm);

  var desc = describe();
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

  var diag = runAccessDiagnostics();
  var hasAdmin = policy.adminConfigured;
  var accessEmpty = policy.accessSheetPresent && diag.runtime.registeredKeysCount === 0;
  var bootstrapShouldBe = (!hasAdmin && (accessEmpty || !policy.accessSheetPresent));

  assert(policy.bootstrapAllowed === bootstrapShouldBe, 'Bootstrap condition correct', {
    hasAdmin: hasAdmin,
    accessEmpty: accessEmpty,
    bootstrapAllowed: policy.bootstrapAllowed,
    expected: bootstrapShouldBe
  });

  var validation = validateAccessSheet();
  assert(validation.hasOwnProperty('valid'), 'validateAccessSheet returns valid flag');
  assert(validation.hasOwnProperty('issues'), 'validateAccessSheet returns issues array');

  assert(diag.hasOwnProperty('schema'), 'diagnostics has schema');
  assert(diag.hasOwnProperty('dataIntegrity'), 'diagnostics has dataIntegrity');
  assert(diag.hasOwnProperty('policy'), 'diagnostics has policy');
  assert(diag.hasOwnProperty('runtime'), 'diagnostics has runtime');

  var readiness = getReadinessStatus();
  assert(readiness.hasOwnProperty('ready'), 'getReadinessStatus returns ready flag');
  assert(readiness.hasOwnProperty('criticalIssues'), 'getReadinessStatus returns criticalIssues');
  assert(readiness.hasOwnProperty('summary'), 'getReadinessStatus returns summary');

  results.summary = {
    total: results.passed.length + results.failed.length,
    passed: results.passed.length,
    failed: results.failed.length
  };

  Logger.log('=== ACCESS CONTROL TEST RESULTS ===');
  Logger.log('Passed: ' + results.passed.length);
  Logger.log('Failed: ' + results.failed.length);

  if (results.failed.length) {
    Logger.log('Failed tests: ' + results.failed.map(function(item) {
      return item.test + ': ' + String(item.details || '');
    }).join('; '));
  } else {
    Logger.log('✓ All tests passed!');
  }

  return results;
}

// ==================== ЕКСПОРТ ОБ'ЄКТУ ====================

var AccessControl_ = Object.freeze({
  // Константи
  ROLE_ORDER: ROLE_ORDER,
  ROLE_VALUES: ROLE_VALUES,
  ROLE_METADATA: ROLE_METADATA,
  SHEET_HEADERS: SHEET_HEADERS,
  LOCKOUT_DURATION_MS: LOCKOUT_DURATION_MS,
  LOCKOUT_ESCALATION_MS: LOCKOUT_ESCALATION_MS,
  LOCKOUT_PROP_PREFIX: LOCKOUT_PROP_PREFIX,
  MAX_FAILED_ATTEMPTS_SHEET: MAX_FAILED_ATTEMPTS_SHEET,
  ROTATION_PERIOD_DAYS: ROTATION_PERIOD_DAYS,

  describe: describe,
  assertRoleAtLeast: assertRoleAtLeast,
  listBindableCallsigns: listBindableCallsigns,
  bindCurrentKeyToCallsign: bindCurrentKeyToCallsign,
  submitAccessKeyRequest: submitAccessKeyRequest,
  loginByIdentifierAndCallsign: loginByIdentifierAndCallsign,
  registerAccessWithTemporaryPassword: registerAccessWithTemporaryPassword,

  bootstrapSheet: bootstrapSheet,
  refreshAccessSheetUi: refreshAccessSheetUi,
  handleAccessSheetEdit: handleAccessSheetEdit,
  validateAccessSheet: validateAccessSheet,
  runAccessDiagnostics: runAccessDiagnostics,
  getReadinessStatus: getReadinessStatus,

  getAccessRowByEmail: getAccessRowByEmail,
  listAdminEmails: listAdminEmails,
  listNotificationEmails: listNotificationEmails,
  listEmailsByRole: listEmailsByRole,
  listAllowedActionsForRole: listAllowedActionsForRole_,

  getRoleLabel: getRoleLabel_,
  getRoleNoteTemplate: getRoleNoteTemplate_,
  normalizeRole: normalizeRole_,
  normalizeEmail: normalizeEmail_,
  normalizePhone: normalizePhone_,
  isMigrationBridgeEnabled: function () {
    return _getAccessPolicy_().migrationModeEnabled;
  },

  hashRawUserKey: hashRawUserKey_,
  maskSensitiveValue: maskSensitiveValue_,

  _getAccessPolicy: _getAccessPolicy_,
  _testAccessControl: _testAccessControl_
});

// ==================== ГЛОБАЛЬНІ ОБГОРТКИ ====================

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
  if (AccessControl_ && typeof AccessControl_._testAccessControl === 'function') {
    return AccessControl_._testAccessControl();
  }
  return { error: 'Test function not available' };
}

function testDiagnostics() {
  var diag = AccessControl_.runAccessDiagnostics();

  Logger.log('=== ACCESS DIAGNOSTICS ===');
  Logger.log(
    'Schema: exists=' + !!(diag.schema && diag.schema.exists) +
    '; headersPresent=' + !!(diag.schema && diag.schema.headersPresent) +
    '; headersCanonical=' + !!(diag.schema && diag.schema.headersCanonical)
  );

  Logger.log(
    'Data integrity: duplicateEmails=' + ((diag.dataIntegrity && diag.dataIntegrity.duplicateEmails || []).length) +
    '; duplicateCurrentKeys=' + ((diag.dataIntegrity && diag.dataIntegrity.duplicateCurrentKeys || []).length) +
    '; duplicatePrevKeys=' + ((diag.dataIntegrity && diag.dataIntegrity.duplicatePrevKeys || []).length) +
    '; emptyIdentifierWithActiveRole=' + ((diag.dataIntegrity && diag.dataIntegrity.emptyIdentifierWithActiveRole || []).join(', ') || 'немає')
  );

  Logger.log(
    'Policy: strictUserKeyMode=' + !!(diag.policy && diag.policy.strictUserKeyMode) +
    '; migrationModeEnabled=' + !!(diag.policy && diag.policy.migrationModeEnabled) +
    '; bootstrapAllowed=' + !!(diag.policy && diag.policy.bootstrapAllowed) +
    '; adminConfigured=' + !!(diag.policy && diag.policy.adminConfigured)
  );

  Logger.log(
    'Runtime: registeredKeys=' + ((diag.runtime && diag.runtime.registeredKeysCount) || 0) +
    '; lockedUsers=' + ((diag.runtime && diag.runtime.lockedUsersCount) || 0) +
    '; adminDisabled=' + ((diag.runtime && diag.runtime.adminDisabledUsersCount) || 0) +
    '; usersWithoutCurrentKey=' + ((diag.runtime && diag.runtime.usersWithoutCurrentKey) || 0)
  );

  return diag;
}

// ==================== ТЕСТОВІ ХЕЛПЕРИ (ДЛЯ РОЗРОБКИ) ====================

function testAccessControl_() {
  if (AccessControl_ && typeof AccessControl_._testAccessControl === 'function') {
    return AccessControl_._testAccessControl();
  }
  return { error: 'Internal test function not available' };
}

function smokeTestAccessControl_() {
  var results = {
    describe: null,
    bootstrapSheet: null,
    validate: null,
    diagnostics: null,
    allPassed: false,
    error: null
  };

  try {
    results.describe = AccessControl_.describe();
    results.validate = AccessControl_.validateAccessSheet();
    results.diagnostics = AccessControl_.runAccessDiagnostics();
    results.bootstrapSheet = AccessControl_.bootstrapSheet();
    results.allPassed = true;
  } catch (e) {
    results.allPassed = false;
    results.error = e && e.message ? e.message : String(e);
  }

  Logger.log('=== SMOKE TEST ===');
  Logger.log('All functions executed: ' + results.allPassed);
  if (!results.allPassed) {
    Logger.log('Error: ' + results.error);
  }

  return results;
}

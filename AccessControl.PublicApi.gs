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

const AccessControl_ = Object.freeze({
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
});


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

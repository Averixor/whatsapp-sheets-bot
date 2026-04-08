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

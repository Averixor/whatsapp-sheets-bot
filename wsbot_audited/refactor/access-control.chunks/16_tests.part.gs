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
      Logger.log('✓ All tests passed!');
    }

    return results;
  }


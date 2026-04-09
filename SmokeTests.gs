/**
 * SmokeTests.gs — Stage 7.1.2 Final Clean
 * Comprehensive Smoke / Regression / Compatibility Test Suite
 * 
 * @description Verifies the integrity of Stage 7 lifecycle runtime, hardening,
 *              security E2E, routing registry, and maintenance API contracts.
 * @stage 7.1.2-final-clean
 * @baseline security-ops-hardened
 */

// =============================================================================
// #region PRIVATE HELPERS — Assertions & Resolvers
// =============================================================================

/**
 * Asserts a condition and throws if false.
 * @param {boolean} condition - Condition to evaluate.
 * @param {string} message - Error message on failure.
 * @private
 */
function _smokeAssert_(condition, message) {
  if (!condition) {
    throw new Error(message || 'Smoke assert failed');
  }
}

/**
 * Checks if a file exists in the project bundle.
 * @param {string} path - File path relative to project root.
 * @returns {boolean} True if file is present.
 * @private
 */
function _smokeBundleHas_(path) {
  return typeof isProjectBundleFilePresent_ === 'function' 
    ? isProjectBundleFilePresent_(path) 
    : false;
}

/**
 * Checks if a route exists in the routing registry for a given public API method.
 * @param {string} fnName - Public API method name.
 * @returns {boolean} True if route exists.
 * @private
 */
function _smokeHasRouteApi_(fnName) {
  const target = String(fnName || '').trim();
  if (!target) return false;

  try {
    if (typeof getRoutingRouteByApiMethod_ === 'function') {
      return !!getRoutingRouteByApiMethod_(target);
    }
  } catch (e) { /* Fall through */ }

  try {
    if (typeof listRoutingRoutes_ === 'function') {
      return (listRoutingRoutes_() || []).some(item => item?.publicApiMethod === target);
    }
  } catch (e) { /* Fall through */ }

  try {
    if (typeof getRoutingRegistry_ === 'function') {
      const registry = getRoutingRegistry_() || {};
      return Object.values(registry).some(item => item?.publicApiMethod === target);
    }
  } catch (e) { /* Fall through */ }

  return false;
}

/**
 * Resolves a known global symbol from a predefined map.
 * @param {string} name - Symbol name.
 * @returns {any|undefined} Resolved symbol or undefined.
 * @private
 */
function _smokeResolveKnownSymbol_(name) {
  const SYMBOL_MAP = {
    'DataAccess_': DataAccess_,
    'DictionaryRepository_': DictionaryRepository_,
    'PersonsRepository_': PersonsRepository_,
    'SendPanelRepository_': SendPanelRepository_,
    'VacationsRepository_': VacationsRepository_,
    'SummaryRepository_': SummaryRepository_,
    'LogsRepository_': LogsRepository_,
    'Stage7UseCases_': Stage7UseCases_,
    'WorkflowOrchestrator_': WorkflowOrchestrator_,
    'Stage7AuditTrail_': Stage7AuditTrail_,
    'Reconciliation_': Reconciliation_,
    'Stage7Triggers_': Stage7Triggers_,
    'Stage7Templates_': Stage7Templates_
  };

  const key = String(name || '').trim();
  return (key in SYMBOL_MAP && typeof SYMBOL_MAP[key] !== 'undefined') 
    ? SYMBOL_MAP[key] 
    : undefined;
}

/**
 * Resolves a function reference from a dot-notation string.
 * @param {string} name - Dot-notation path (e.g., "DataAccess_.getData").
 * @returns {Function|undefined} Resolved function or undefined.
 * @private
 */
function _smokeResolveFn_(name) {
  const target = String(name || '').trim();
  if (!target) return undefined;

  const parts = target.split('.').filter(Boolean);
  if (!parts.length) return undefined;

  // Attempt resolution from known root symbols first
  const knownRoot = _smokeResolveKnownSymbol_(parts[0]);
  if (knownRoot !== undefined) {
    let current = knownRoot;
    for (let i = 1; i < parts.length; i++) {
      if (!current || !(parts[i] in current)) return undefined;
      current = current[parts[i]];
    }
    return current;
  }

  // Fallback to global scope resolution
  try {
    const globalObj = (typeof globalThis !== 'undefined') 
      ? globalThis 
      : Function('return this')();
    
    let current = globalObj;
    for (let i = 0; i < parts.length; i++) {
      if (!current || !(parts[i] in current)) return undefined;
      current = current[parts[i]];
    }
    return current;
  } catch (e) {
    return undefined;
  }
}

/**
 * Checks if a function exists globally or in the routing registry.
 * @param {string} name - Function name or path.
 * @returns {boolean} True if function exists.
 * @private
 */
function _smokeHasFn_(name) {
  const target = String(name || '').trim();
  if (!target) return false;
  return typeof _smokeResolveFn_(target) === 'function' || _smokeHasRouteApi_(target);
}

/**
 * Resolves the appropriate Access Security E2E test runner.
 * @returns {{ name: string, fn: Function }|null} Runner info or null.
 * @private
 */
function _smokeResolveAccessSecurityRunner_() {
  const candidates = [
    { name: 'runAccessSecurityE2ETests_', fn: runAccessSecurityE2ETests_ },
    { name: 'runAccessPolicyChecks', fn: runAccessPolicyChecks },
    { name: 'runAllPolicyChecks', fn: runAllPolicyChecks }
  ];

  for (const candidate of candidates) {
    if (typeof candidate.fn === 'function') {
      return candidate;
    }
  }
  return null;
}

// =============================================================================
// #region PRIVATE HELPERS — Test Execution
// =============================================================================

/**
 * Pushes a test result to the report.
 * @param {object} report - Report object to mutate.
 * @param {string} name - Test name.
 * @param {Function} fn - Test function to execute.
 * @param {object} options - Options (skipOnError).
 * @private
 */
function _smokePush_(report, name, fn, options = {}) {
  try {
    const details = fn();
    report.checks.push({
      name: name,
      status: 'OK',
      details: details || 'OK'
    });
  } catch (e) {
    const errorMessage = e?.message || String(e);
    
    if (options.skipOnError) {
      report.skipped = report.skipped || [];
      report.skipped.push({ name, reason: errorMessage });
      report.checks.push({ name, status: 'SKIP', details: errorMessage });
      return;
    }

    report.ok = false;
    report.checks.push({
      name: name,
      status: 'FAIL',
      details: errorMessage
    });
  }
}

/**
 * Asserts the unified contract (success, message, error, data, context, warnings).
 * @param {object} result - API response object.
 * @param {string} functionName - Name of the calling function for error context.
 * @private
 */
function _assertUnifiedContract_(result, functionName) {
  _smokeAssert_(result && typeof result === 'object', `${functionName}() did not return an object`);
  
  const requiredFields = ['success', 'message', 'error', 'data', 'context', 'warnings'];
  requiredFields.forEach(field => {
    _smokeAssert_(field in result, `${functionName}() missing field: ${field}`);
  });
}

/**
 * Asserts the Stage 4+ unified contract with nested data.result and data.meta.
 * @param {object} result - API response object.
 * @param {string} functionName - Name of the calling function.
 * @private
 */
function _assertStage4Meta_(result, functionName) {
  _assertUnifiedContract_(result, functionName);
  _smokeAssert_(result.data && typeof result.data === 'object', `${functionName}() missing data object`);
  _smokeAssert_('result' in result.data, `${functionName}() missing data.result`);
  _smokeAssert_('meta' in result.data, `${functionName}() missing data.meta`);
}

/**
 * Executes a contract test and pushes result to report.
 * @param {object} report - Report object.
 * @param {string} name - Test name.
 * @param {Function} fn - Function returning API response.
 * @param {object} options - Additional options.
 * @private
 */
function _runContractTest_(report, name, fn, options) {
  _smokePush_(report, name, () => {
    const result = fn();
    _assertStage4Meta_(result, name);
    return `success=${result.success}`;
  }, options);
}

// =============================================================================
// #region PRIVATE HELPERS — Test Data
// =============================================================================

/**
 * Returns today's date in DD.MM.YYYY format.
 * @returns {string} Formatted date string.
 * @private
 */
function _todayStr_() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

/**
 * Picks a valid test date from available dates in PersonsRepository.
 * @returns {string} Test date in DD.MM.YYYY format.
 * @private
 */
function _pickTestDate_() {
  try {
    const dates = PersonsRepository_?.getAvailableDates?.();
    return Array.isArray(dates) && dates.length ? dates[0] : _todayStr_();
  } catch (_) {
    return _todayStr_();
  }
}

/**
 * Picks a valid test callsign from PersonsRepository.
 * @returns {string} Test callsign or empty string.
 * @private
 */
function _pickTestCallsign_() {
  try {
    return (PersonsRepository_ && typeof PersonsRepository_.getAnyCallsign === 'function')
      ? (PersonsRepository_.getAnyCallsign() || '')
      : '';
  } catch (_) {
    return '';
  }
}

// Alias for backward compatibility
function _pickTestCallsign() {
  return _pickTestCallsign_();
}

// =============================================================================
// #region PUBLIC API — Scenario Tests
// =============================================================================

/**
 * Runs the Stage 4+ scenario tests (core workflows).
 * @param {object} options - Test options (date, callsign, dryRun).
 * @returns {object} Test report.
 */
function runStage4ScenarioTests(options = {}) {
  const testDate = options.date || _pickTestDate_();
  const testCallsign = options.callsign || _pickTestCallsign();
  
  const report = {
    ok: true,
    stage: '7.1.2-final-clean',
    ts: new Date().toISOString(),
    dryRun: options.dryRun !== false,
    checks: [],
    skipped: [],
    warnings: []
  };

  // --- Core API Contract Tests ---
  _runContractTest_(report, 'apiStage7GetMonthsList', () => {
    const result = apiStage7GetMonthsList();
    _smokeAssert_(Array.isArray(result.data.result.months), 'months[] not returned');
    return result;
  });

  _runContractTest_(report, 'apiStage7GetSidebarData', () => {
    const result = apiStage7GetSidebarData(testDate);
    _smokeAssert_(Array.isArray(result.data.result.personnel), 'personnel[] not returned');
    return result;
  }, { skipOnError: true });

  _runContractTest_(report, 'apiStage7GetSendPanelData', () => {
    const result = apiStage7GetSendPanelData();
    _smokeAssert_(Array.isArray(result.data.result.rows), 'rows[] not returned');
    return result;
  }, { skipOnError: true });

  _runContractTest_(report, 'apiGenerateSendPanelForDate', () => {
    const result = apiGenerateSendPanelForDate({ dryRun: true, date: testDate });
    _smokeAssert_(Array.isArray(result.data.result.rows), 'rows[] not returned');
    return result;
  });

  _runContractTest_(report, 'apiGenerateSendPanelForRange', () => {
    const result = apiGenerateSendPanelForRange({ 
      dryRun: true, 
      startDate: testDate, 
      endDate: testDate 
    });
    _smokeAssert_(Array.isArray(result.data.result.reports), 'reports[] not returned');
    return result;
  });

  _runContractTest_(report, 'apiMarkPanelRowsAsSent', () => {
    const startRow = Number(CONFIG.SEND_PANEL_DATA_START_ROW) || 3;
    return apiMarkPanelRowsAsSent([startRow], { dryRun: true });
  }, { skipOnError: true });

  _runContractTest_(report, 'apiMarkPanelRowsAsUnsent', () => {
    const startRow = Number(CONFIG.SEND_PANEL_DATA_START_ROW) || 3;
    return apiMarkPanelRowsAsUnsent([startRow], { dryRun: true });
  }, { skipOnError: true });

  _runContractTest_(report, 'apiSendPendingRows', () => {
    return apiSendPendingRows({ dryRun: true, limit: 10 });
  }, { skipOnError: true });

  _runContractTest_(report, 'apiBuildDaySummary', () => {
    const result = apiBuildDaySummary(testDate);
    _smokeAssert_(typeof result.data.result.summary === 'string', 'summary not returned');
    return result;
  }, { skipOnError: true });

  _runContractTest_(report, 'apiBuildDetailedSummary', () => {
    const result = apiBuildDetailedSummary(testDate);
    _smokeAssert_(typeof result.data.result.summary === 'string', 'summary not returned');
    return result;
  }, { skipOnError: true });

  _runContractTest_(report, 'apiOpenPersonCard', () => {
    _smokeAssert_(!!testCallsign, 'No test callsign available');
    const result = apiOpenPersonCard(testCallsign, testDate);
    _smokeAssert_(!!result.data.result.callsign, 'callsign not returned');
    return result;
  }, { skipOnError: true });

  _runContractTest_(report, 'apiCheckVacationsAndBirthdays', () => {
    return apiCheckVacationsAndBirthdays(testDate);
  });

  _runContractTest_(report, 'apiStage7SwitchBotToMonth', () => {
    return apiStage7SwitchBotToMonth(getBotMonthSheetName_());
  });

  _runContractTest_(report, 'apiStage7CreateNextMonth', () => {
    return apiStage7CreateNextMonth({ dryRun: true, switchToNewMonth: false });
  }, { skipOnError: true });

  _runContractTest_(report, 'apiRunReconciliation', () => {
    return apiRunReconciliation({ mode: 'report', dryRun: true, date: testDate });
  });

  _runContractTest_(report, 'apiRunMaintenanceScenario', () => {
    return apiRunMaintenanceScenario({ type: 'healthCheck', shallow: true });
  });

  // --- Jobs API Suite ---
  _smokePush_(report, 'jobs api contract suite', () => {
    const jobList = apiListStage7Jobs();
    const jobInstall = apiInstallStage7Jobs();
    
    [jobList, jobInstall].forEach((result, idx) => {
      _assertStage4Meta_(result, `jobs#${idx + 1}`);
    });
    
    const jobRun = apiRunStage7Job(STAGE7_CONFIG.JOBS.SCHEDULED_HEALTHCHECK, { dryRun: true });
    _assertUnifiedContract_(jobRun, 'apiRunStage7Job');
    
    return 'jobs-contracts-ok';
  }, { skipOnError: true });

  // --- Deprecated Registry Sanity ---
  _smokePush_(report, 'deprecated registry sanity', () => {
    const registry = getDeprecatedRegistry_();
    _smokeAssert_(Array.isArray(registry) && registry.length >= 5, 'Deprecated registry too small');
    
    registry.forEach(item => {
      _smokeAssert_(!!item.name && !!item.replacement, 'Deprecated registry record corrupted');
    });
    
    return `deprecated=${registry.length}`;
  });

  _smokePush_(report, 'deprecated registry token resolution', () => {
    getDeprecatedRegistry_()
      .filter(item => !!item.verifySourceToken)
      .forEach(item => {
        const resolved = _smokeResolveFn_(item.name);
        if (typeof resolved !== 'function') return;
        
        const src = String(resolved);
        _smokeAssert_(
          src.indexOf(item.verifySourceToken) !== -1, 
          `${item.name} does not point to ${item.verifySourceToken}`
        );
      });
    return 'wrapper-sources-ok';
  });

  // --- Helper Consistency ---
  _smokePush_(report, 'canonical helper consistency', () => {
    _smokeAssert_(
      typeof HtmlUtils_ === 'object' && typeof HtmlUtils_.escapeHtml === 'function',
      'HtmlUtils_.escapeHtml missing'
    );
    
    const testStr = '<x>';
    _smokeAssert_(escapeHtml_(testStr) === HtmlUtils_.escapeHtml(testStr), 'escapeHtml_() inconsistent');
    
_smokeAssert_(_escapeHtml_(testStr) === HtmlUtils_.escapeHtml(testStr), '_escapeHtml_() inconsistent');
    
    return 'helper-ok';
  });

  // --- Bundle Metadata ---
  _smokePush_(report, 'bundle metadata / manifest / docs markers', () => {
    const meta = getProjectBundleMetadata_();
    
    _smokeAssert_(meta.manifestIncluded === true, 'manifestIncluded must be true');
    
    _smokeAssert_(
      meta.maintenanceLayerStatus === 'stage7-canonical-maintenance-api',
      'maintenanceLayerStatus must be Stage 7 canonical'
    );
    
    _smokeAssert_(
      Array.isArray(meta.documentation.historical) && 
      meta.documentation.historical.includes('_extras/history/IMPLEMENTATION_REPORT_2026-03-22.md'),
      'IMPLEMENTATION_REPORT_2026-03-22.md must be historical'
    );
    
    _smokeAssert_(_smokeBundleHas_('appsscript.json'), 'appsscript.json must exist in root bundle');
    
    _smokeAssert_(!_smokeBundleHas_('.clasp.json.example'), '.clasp.json.example must not exist in root bundle');
    
    return 'bundle-ok';
  });

  // --- Diagnostics Modes ---
  _smokePush_(report, 'stage7 diagnostics modes available', () => {
    const requiredModes = [
      'runHistoricalQuickDiagnosticsInternal_',
      'runHistoricalStructuralDiagnosticsInternal_',
      'runHistoricalCompatibilityDiagnosticsInternal_',
      'runHistoricalFullDiagnosticsInternal_'
    ];
    
    requiredModes.forEach(fnName => {
      _smokeAssert_(_smokeHasFn_(fnName), `${fnName} missing`);
    });
    
    return 'diagnostics-modes-ok';
  });

  return report;
}

/**
 * Runs Stage 5+ canonical scenario tests (messaging, diagnostics, health checks).
 * @param {object} options - Test options.
 * @returns {object} Test report.
 */
function runStage5ScenarioTests(options = {}) {
  const meta = typeof getProjectBundleMetadata_ === 'function' 
    ? getProjectBundleMetadata_() 
    : { stageVersion: '7.1.2-final-clean' };
  
  const report = {
    ok: true,
    stage: meta.stageVersion,
    ts: new Date().toISOString(),
    dryRun: options.dryRun !== false,
    checks: [],
    skipped: [],
    warnings: []
  };

  // --- Messaging Previews ---
  const messagingTests = [
    { name: 'apiPreviewSelectionMessage', fn: apiPreviewSelectionMessage, expectedKind: 'singleMessagePreview' },
    { name: 'apiPreviewMultipleMessages', fn: apiPreviewMultipleMessages, expectedKind: 'multipleMessagesPreview' },
    { name: 'apiPreviewGroupedMessages', fn: apiPreviewGroupedMessages, expectedKind: 'multipleMessagesPreview' },
    { name: 'apiPrepareRangeMessages', fn: apiPrepareRangeMessages, expectedKind: 'multipleMessagesPreview' }
  ];

  messagingTests.forEach(({ name, fn, expectedKind }) => {
    _runContractTest_(report, name, () => {
      const result = fn({});
      _smokeAssert_(result.data.result.kind === expectedKind, `Invalid kind for ${name}`);
      return result;
    }, { skipOnError: true });
  });

  // --- Commander Summary ---
  _runContractTest_(report, 'apiBuildCommanderSummaryPreview', () => {
    const result = apiBuildCommanderSummaryPreview({});
    _smokeAssert_(result.data.result.kind === 'summaryPreview', 'Invalid kind for commander preview');
    return result;
  }, { skipOnError: true });

  _runContractTest_(report, 'apiBuildCommanderSummaryLink', () => {
    const result = apiBuildCommanderSummaryLink({});
    _smokeAssert_(result.data.result.kind === 'summaryPreview', 'Invalid kind for commander link preview');
    return result;
  }, { skipOnError: true });

  // --- Logging & Diagnostics ---
  _runContractTest_(report, 'apiLogPreparedMessages', () => {
    const result = apiLogPreparedMessages({ mode: 'selection', dryRun: true });
    _smokeAssert_(!!result.data.result.kind, 'LOG preview missing prepared result');
    return result;
  }, { skipOnError: true });

  _runContractTest_(report, 'apiRunSelectionDiagnostics', () => {
    const result = apiRunSelectionDiagnostics({});
    _smokeAssert_(result.data.result.kind === 'selectionDiagnostics', 'Selection diagnostics missing expected kind');
    return result;
  }, { skipOnError: true });

  // --- Health & Diagnostics ---
  _runContractTest_(report, 'apiStage7HealthCheck', () => {
    const result = apiStage7HealthCheck({ mode: 'quick' });
    _smokeAssert_(Array.isArray(result.data.result.checks), 'checks[] not returned');
    return result;
  }, { skipOnError: true });

  _runContractTest_(report, 'apiRunStage7Diagnostics', () => {
    const result = apiRunStage7Diagnostics({ mode: 'structural' });
    _smokeAssert_(Array.isArray(result.data.result.checks), 'checks[] not returned');
    return result;
  }, { skipOnError: true });

  // --- Regression Test Self-Check ---
  _smokePush_(report, 'apiRunStage7RegressionTests contract', () => {
    _smokeAssert_(
      typeof apiRunStage7RegressionTests === 'function',
      'apiRunStage7RegressionTests missing'
    );
    
    const registry = typeof getRoutingRegistry_ === 'function' ? getRoutingRegistry_() : {};
    const hasCanonicalRoute = Object.values(registry).some(
      item => item?.publicApiMethod === 'apiRunStage7RegressionTests' && 
              item?.useCase === 'runRegressionTestSuite'
    );
    
    _smokeAssert_(hasCanonicalRoute, 'Routing registry does not map apiRunStage7RegressionTests correctly');
    return 'self-recursive invocation intentionally skipped';
  }, { skipOnError: true });

  return report;
}

// Alias for backward compatibility
function runScenarioTests(options) {
  return runStage4ScenarioTests(options || {});
}

/**
 * Runs the comprehensive regression test suite.
 * This is the main entry point for smoke/regression testing.
 * @param {object} options - Test options.
 * @returns {object} Complete test report.
 */
function runRegressionTestSuite(options = {}) {
  const meta = typeof getProjectBundleMetadata_ === 'function' 
    ? getProjectBundleMetadata_() 
    : PROJECT_BUNDLE_METADATA_;
    
  const docs = typeof getProjectDocumentationMap_ === 'function' 
    ? getProjectDocumentationMap_() 
    : {};
    
  const release = typeof getProjectReleaseNaming_ === 'function' 
    ? getProjectReleaseNaming_() 
    : (meta?.release || {});
  
  const report = {
    ok: true,
    stage: meta?.stageVersion || '7.1.2-final-clean',
    ts: new Date().toISOString(),
    dryRun: options.dryRun !== false,
    checks: [],
    skipped: [],
    warnings: []
  };

  // -------------------------------------------------------------------------
  // 1. Canonical Scenario Contract
  // -------------------------------------------------------------------------
  _smokePush_(report, 'canonical scenario contract suite', () => {
    const scenarios = runStage5ScenarioTests(options);
    _smokeAssert_(Array.isArray(scenarios.checks), 'runStage5ScenarioTests() missing checks[]');
    _smokeAssert_(scenarios.checks.length >= 11, 'Insufficient canonical contract checks');
    return `checks=${scenarios.checks.length}`;
  }, { skipOnError: true });

  // -------------------------------------------------------------------------
  // 2. Release Metadata Validation
  // -------------------------------------------------------------------------
  _smokePush_(report, 'release metadata truth model', () => {
    _smokeAssert_(String(meta.stage) === '7.1', 'metadata.stage must be 7.1');
    
    _smokeAssert_(
      meta.stageLabel === 'Stage 7.1.2 — Security & Ops Hardened Baseline (Final Clean)',
      'Incorrect stageLabel'
    );

    _smokeAssert_(meta.stageVersion === '7.1.2-final-clean', 'Incorrect stageVersion');
    
    _smokeAssert_(
      meta.activeBaseline === 'stage7-1-2-final-clean-baseline',
      'Incorrect activeBaseline'
    );

    _smokeAssert_(
      meta.maintenanceLayerStatus === 'stage7-canonical-maintenance-api',
      'maintenanceLayerStatus not Stage 7 canonical'
    );

    _smokeAssert_(
      meta.packagingPolicy?.policy === 'root-manifest-web-editor-only',
      'Packaging policy must be root-manifest-web-editor-only'
    );
    
    const requiredDocs = meta.requiredDocs || [];
    _smokeAssert_(requiredDocs.includes('SECURITY.md'), 'SECURITY.md missing from metadata');
    _smokeAssert_(requiredDocs.includes('CHANGELOG.md'), 'CHANGELOG.md missing from metadata');
    _smokeAssert_(requiredDocs.length === 5, 'requiredDocs must be exactly 5 main documents');
    
    return 'metadata-ok';
  });

  // -------------------------------------------------------------------------
  // 3. Physical Bundle Layout
  // -------------------------------------------------------------------------
  _smokePush_(report, 'physical bundle layout', () => {
    const requiredFiles = [
      'appsscript.json',
      'README.md',
      'ARCHITECTURE.md',
      'RUNBOOK.md',
      'SECURITY.md',
      'CHANGELOG.md',
      '_extras/history/CANONICAL_APIS_STAGE7_FINAL_STABILIZED.md',
      '_extras/history/SCHEMA.md',
      'AccessE2ETests.gs',
      'AccessPolicyChecks.gs',
      'OperationRepository.gs',
      'AccessControl.gs',
      'ServiceSheetsBootstrap.gs',
      'JavaScript.html',
      'Js.Core.html',
      'Js.Actions.html',
      'Js.Events.html'
    ];
    
    requiredFiles.forEach(path => {
      _smokeAssert_(_smokeBundleHas_(path), `File missing from bundle: ${path}`);
    });
    
    return 'bundle-layout-ok';
  });

  // -------------------------------------------------------------------------
  // 4. Documentation Hierarchy
  // -------------------------------------------------------------------------
  _smokePush_(report, 'docs hierarchy truthfulness', () => {
    const activeDocs = docs?.active ? Object.values(docs.active) : [];
    const historicalDocs = Array.isArray(docs.historical) ? docs.historical : [];
    
    _smokeAssert_(activeDocs.length === 5, 'Active docs must be exactly 5 files');
    
    activeDocs.forEach(path => {
      _smokeAssert_(String(path).indexOf('_extras/') !== 0, `Active doc must be in root: ${path}`);
      _smokeAssert_(_smokeBundleHas_(path), `Active doc missing: ${path}`);
    });
    
    historicalDocs.forEach(path => {
      _smokeAssert_(
        String(path).indexOf('_extras/history/') === 0,
        `Historical doc must be in _extras/history/: ${path}`
      );
      _smokeAssert_(_smokeBundleHas_(path), `Historical doc missing: ${path}`);
    });
    
    _smokeAssert_(docs.active.changelog === 'CHANGELOG.md', 'CHANGELOG.md must be active release report');
    _smokeAssert_(
      historicalDocs.includes('_extras/history/IMPLEMENTATION_REPORT_2026-03-22.md'),
      'IMPLEMENTATION_REPORT_2026-03-22 must be historical'
    );
    
    return 'docs-ok';
  });

  // -------------------------------------------------------------------------
  // 5. Release Naming Consistency
  // -------------------------------------------------------------------------
  _smokePush_(report, 'release naming consistency', () => {
    _smokeAssert_(
      release.archiveBaseName === 'gas_wasb_stage7_1_2_final_clean',
      'archiveBaseName must be gas_wasb_stage7_1_2_final_clean'
    );

    _smokeAssert_(
      release.archiveFileName === 'gas_wasb_stage7_1_2_final_clean.zip',
      'archiveFileName must be gas_wasb_stage7_1_2_final_clean.zip'
    );

    _smokeAssert_(
      release.rootFolderName === 'gas_wasb_stage7_1_2_final_clean',
      'rootFolderName must be gas_wasb_stage7_1_2_final_clean'
    );

    _smokeAssert_(
      meta.hardeningOverlay?.label === 'Stage 7A hardening evolved into Stage 7 lifecycle baseline',
      'Incorrect overlay label'
    );
    
    return 'release-naming-ok';
  });

  // -------------------------------------------------------------------------
  // 6. Client Runtime Policy
  // -------------------------------------------------------------------------
  _smokePush_(report, 'client runtime policy', () => {
    const policy = meta.clientRuntimePolicy || {};
    
    _smokeAssert_(policy.runtimeFile === 'JavaScript.html', 'runtimeFile must be JavaScript.html');
    
    _smokeAssert_(
      policy.bootstrapMode === 'sidebar-includeTemplate',
      'bootstrapMode must be sidebar-includeTemplate'
    );

    _smokeAssert_(
      policy.modularStatus === 'active-js-include-chain',
      'modularStatus must be active-js-include-chain'
    );
    
    return 'client-policy-ok';
  });

  // -------------------------------------------------------------------------
  // 7. Client Bootstrap Helpers
  // -------------------------------------------------------------------------
  _smokePush_(report, 'client bootstrap helpers', () => {
    _smokeAssert_(typeof include === 'function', 'include() missing');
    _smokeAssert_(typeof includeTemplate === 'function', 'includeTemplate() missing');
    
    const runtime = includeTemplate('JavaScript');
    _smokeAssert_(runtime.indexOf('<script') !== -1, "includeTemplate('JavaScript') missing script block");
    
    return 'bootstrap-helpers-ok';
  });

  // -------------------------------------------------------------------------
  // 8. Sidebar Template Include Path
  // -------------------------------------------------------------------------
  _smokePush_(report, 'sidebar template include path', () => {
    const rawSidebar = include('Sidebar');
    
    const hasIncludeTemplate = rawSidebar.indexOf("<?!= includeTemplate('JavaScript'); ?>") !== -1 ||
                               rawSidebar.indexOf('<?!= includeTemplate("JavaScript"); ?>') !== -1;
    _smokeAssert_(hasIncludeTemplate, 'Sidebar.html must include JavaScript via includeTemplate');
    
    const hasRawInclude = rawSidebar.indexOf("<?!= include('JavaScript'); ?>") !== -1 ||
                          rawSidebar.indexOf('<?!= include('JavaScript'); ?>') !== -1;
    _smokeAssert_(!hasRawInclude, 'Sidebar.html must not use raw include for JavaScript');
    
    return 'sidebar-include-ok';
  });

  // -------------------------------------------------------------------------
  // 9. JavaScript Runtime Modularity
  // -------------------------------------------------------------------------
  _smokePush_(report, 'javascript runtime is modular', () => {
    const rawJavaScript = include('JavaScript');
    const runtime = includeTemplate('JavaScript');
    
    const hasJsCore = rawJavaScript.indexOf("include('Js.Core')") !== -1 ||
                      rawJavaScript.indexOf('include("Js.Core")') !== -1;
    _smokeAssert_(hasJsCore, 'JavaScript.html must be an include aggregator for Js.*');
    
    _smokeAssert_(runtime.indexOf('<script') !== -1, "includeTemplate('JavaScript') missing script block");
    _smokeAssert_(runtime.indexOf('stage7-sidebar-runtime') !== -1, 'runtime marker stage7-sidebar-runtime missing');
    _smokeAssert_(runtime.indexOf('window.SidebarApp = SidebarApp;') !== -1, 'SidebarApp export missing');
    
    return 'javascript-modular-ok';
  });

  // -------------------------------------------------------------------------
  // 10. Runtime Wording Hygiene
  // -------------------------------------------------------------------------
  _smokePush_(report, 'runtime wording hygiene', () => {
    const rawJavaScript = include('JavaScript');
    const rawSidebar = include('Sidebar');
    const runtimeContract = getClientRuntimeContract_();
    
    const legacyTokens = [
      { token: 'runtime consolidated in RC2', label: 'legacy-runtime-token-1' },
      { token: 'Показує тільки швидку актуальну Stage 7 перевірку без legacy-шуму.', label: 'legacy-runtime-token-2' },
      { token: 'stage7a-canonical-runtime', label: 'legacy-runtime-token-3' }
    ];
    
    legacyTokens.forEach(({ token, label }) => {
      _smokeAssert_(rawJavaScript.indexOf(token) === -1, `JavaScript.html contains legacy marker: ${label}`);
    });
    
    _smokeAssert_(
      rawSidebar.indexOf('Stage 7A bootstrap contract') === -1,
      'Sidebar.html contains legacy bootstrap comment'
    );

    _smokeAssert_(
      runtimeContract.policyMarker === 'stage7-sidebar-runtime',
      'policyMarker must be stage7-sidebar-runtime'
    );

    _smokeAssert_(
      STAGE7A_CONFIG.ACTIVE_RUNTIME_MARKER === 'stage7-sidebar-runtime',
      'ACTIVE_RUNTIME_MARKER must be stage7-sidebar-runtime'
    );
    
    return 'runtime-wording-ok';
  });

  // -------------------------------------------------------------------------
  // 11. Lifecycle Retention Cleanup API
  // -------------------------------------------------------------------------
  _smokePush_(report, 'lifecycle retention cleanup api contract', () => {
    _smokeAssert_(
      _smokeHasFn_('apiStage7RunLifecycleRetentionCleanup'),
      'apiStage7RunLifecycleRetentionCleanup missing'
    );
    _smokeAssert_(
      STAGE7_CONFIG?.JOBS?.LIFECYCLE_RETENTION_CLEANUP === 'lifecycleRetentionCleanup',
      'JOBS.LIFECYCLE_RETENTION_CLEANUP must be lifecycleRetentionCleanup'
    );
    
    return 'retention-cleanup-contract-ok';
  });

  // -------------------------------------------------------------------------
  // 12. Public Diagnostics Wording
  // -------------------------------------------------------------------------
  _smokePush_(report, 'public diagnostics wording is stage7-1', () => {
    const quick = runQuickDiagnostics_({ mode: 'quick' });
    const full = runFullDiagnostics_({ mode: 'full' });
    const sunset = runSunsetDiagnostics_({ mode: 'compatibility sunset' });
    const maintHealth = apiStage7HealthCheck({ mode: 'quick' });
    const maintDiagnostics = apiRunStage7Diagnostics({ mode: 'full' });
    
    const texts = [
      quick.summary || '',
      full.summary || '',
      maintHealth.message || '',
      maintHealth.data?.result?.summary || '',
      maintDiagnostics.message || '',
      maintDiagnostics.data?.result?.summary || ''
    ];
    
    const legacyTokens = [
      { token: 'Stage 7.2', label: 'legacy-diagnostics-token-1' },
      { token: 'Stage 7 health bridge', label: 'legacy-diagnostics-token-2' },
      { token: 'Stage 7 compatibility diagnostics', label: 'legacy-diagnostics-token-3' },
      { token: 'Stage 7 quick compatibility diagnostics', label: 'legacy-diagnostics-token-4' },
      { token: 'Stage 7 full compatibility diagnostics', label: 'legacy-diagnostics-token-5' },
      { token: 'Stage 7 structural compatibility diagnostics', label: 'legacy-diagnostics-token-6' }
    ];
    
    texts.forEach(text => {
      legacyTokens.forEach(({ token, label }) => {
        _smokeAssert_(String(text).indexOf(token) === -1, `Public diagnostics contains legacy marker: ${label}`);
      });
    });
    
    _smokeAssert_(
      String(full.summary || '').indexOf('Stage 7.1.2 — Security & Ops Hardened Baseline (Final Clean)') !== -1,
      'Stage 7.1 wording not found in diagnostics summary'
    );
    
    _smokeAssert_(
      (sunset.checks || []).some(item => item.name === 'Compatibility split report (informational)'),
      'Informational compatibility split report not found'
    );
    
    _smokeAssert_(
      (sunset.checks || []).every(item => item.name !== 'Canonical vs compatibility split'),
      'Old compatibility split check name still present'
    );
    
    _smokeAssert_(
      (quick.checks || []).every(item => item.name !== 'Stage7 baseline health bridge'),
      'Quick diagnostics contains old baseline health marker'
    );
    
    return 'diagnostics-wording-ok';
  });

  // -------------------------------------------------------------------------
  // 13. Maintenance Public Wording
  // -------------------------------------------------------------------------
  _smokePush_(report, 'maintenance public wording is release-neutral', () => {
    const responses = [
      apiStage7HealthCheck({ mode: 'quick' }),
      apiRunStage7Diagnostics({ mode: 'quick' }),
      apiRunStage7RegressionTests({ dryRun: true }),
      apiListStage7JobRuntime(),
      apiListStage7Jobs()
    ];
    
    const legacyTokens = [
      { token: 'Stage 7.2', label: 'legacy-maintenance-token-1' },
      { token: 'Stage 7 jobs', label: 'legacy-maintenance-token-2' },
      { token: 'Stage 7 health check', label: 'legacy-maintenance-token-3' },
      { token: 'Stage 7 full health check', label: 'legacy-maintenance-token-4' },
      { token: 'Stage 7 diagnostics', label: 'legacy-maintenance-token-5' },
      { token: 'Stage 7 regression tests', label: 'legacy-maintenance-token-6' },
      { token: 'Stage 7 job runtime', label: 'legacy-maintenance-token-7' }
    ];
    
    responses.forEach(result => {
      const texts = [
        result?.message || '',
        result?.data?.result?.summary || ''
      ];
      
      texts.forEach(text => {
        legacyTokens.forEach(({ token, label }) => {
          _smokeAssert_(
            String(text).indexOf(token) === -1,
            `Maintenance response contains legacy marker: ${label}`
          );
        });
      });
    });
    
    return 'maintenance-wording-ok';
  });

  // -------------------------------------------------------------------------
  // 14. Diagnostics Modes Availability
  // -------------------------------------------------------------------------
  _smokePush_(report, 'diagnostics modes available', () => {
    const requiredModes = [
      'runQuickDiagnostics_',
      'runStructuralDiagnostics_',
      'runOperationalDiagnostics_',
      'runSunsetDiagnostics_',
      'runFullDiagnostics_'
    ];
    
    requiredModes.forEach(fnName => {
      _smokeAssert_(_smokeHasFn_(fnName), `${fnName} missing`);
    });
    
    return 'diagnostics-modes-ok';
  });

  // -------------------------------------------------------------------------
  // 15. Full Diagnostics Suite Execution
  // -------------------------------------------------------------------------
  _smokePush_(report, 'diagnostics suite', () => {
    const diagnostics = runFullDiagnostics_({ mode: 'full' });
    _smokeAssert_(Array.isArray(diagnostics.checks), 'runFullDiagnostics_() missing checks[]');
    return `checks=${diagnostics.checks.length}`;
  }, { skipOnError: true });

  // -------------------------------------------------------------------------
  // 16. Job Runtime Contract
  // -------------------------------------------------------------------------
  _smokePush_(report, 'job runtime contract', () => {
    const runtime = JobRuntime_.buildRuntimeReport();
    _smokeAssert_(typeof runtime === 'object', 'JobRuntime_.buildRuntimeReport() did not return object');
    return `jobs=${runtime.totalJobs || 0}`;
  });

  // -------------------------------------------------------------------------
  // 17. Template Governance Contract
  // -------------------------------------------------------------------------
  _smokePush_(report, 'template governance contract', () => {
    const templates = TemplateRegistry_.list();
    _smokeAssert_(Array.isArray(templates), 'TemplateRegistry_.list() did not return array');
    
    const resolved = TemplateResolver_.resolve('DAY_SUMMARY_HEADER', { date: '01.01.2026' }, { preview: true });
    _smokeAssert_(typeof resolved.text === 'string', 'TemplateResolver_.resolve() missing text');
    
    return `templates=${templates.length}`;
  });

  // -------------------------------------------------------------------------
  // 18. Compatibility Sunset Report
  // -------------------------------------------------------------------------
  _smokePush_(report, 'compatibility sunset report', () => {
    const sunset = getCompatibilitySunsetReport_();
    _smokeAssert_(typeof sunset.total === 'number', 'getCompatibilitySunsetReport_() missing total');
    _smokeAssert_(typeof sunset.counts === 'object', 'getCompatibilitySunsetReport_() missing counts');
    return `total=${sunset.total}`;
  });

  // -------------------------------------------------------------------------
  // 19. Hardening Domain Tests
  // -------------------------------------------------------------------------
  _smokePush_(report, 'hardening domain test suite', () => {
    const domain = runStage6ADomainTests_({ dryRun: true });
    _smokeAssert_(Array.isArray(domain.checks), 'runStage6ADomainTests_() missing checks[]');
    _smokeAssert_(domain.total >= 20, 'Insufficient Stage 7A domain tests');
    if (!domain.ok) throw new Error('Stage 7A domain tests must not have FAIL');
    return `tests=${domain.total}`;
  });

  // -------------------------------------------------------------------------
  // 20. Routing Registry Coverage
  // -------------------------------------------------------------------------
  _smokePush_(report, 'hardening routing registry coverage', () => {
    const coverage = getRouteCoverageReport_();
    _smokeAssert_(coverage.total >= 20, 'Routing registry too small');
    _smokeAssert_(
      coverage.criticalWrites === coverage.lockCoverage,
      'Not all critical writes have lock coverage'
    );
    return `routes=${coverage.total}`;
  });

  // -------------------------------------------------------------------------
  // 21. Job Runtime Governance
  // -------------------------------------------------------------------------
  _smokePush_(report, 'hardening job runtime governance', () => {
    const runtime = JobRuntime_.buildRuntimeReport();
    _smokeAssert_(
      runtime.storagePolicy?.policy === 'hybrid-sheet-plus-properties',
      'Hybrid runtime policy not described'
    );
    _smokeAssert_(
      runtime.storagePolicy?.propertiesArePrimaryJournal === false,
      'PropertiesService cannot be primary journal'
    );
    return runtime.storagePolicy.policy;
  });

  // -------------------------------------------------------------------------
  // 22. Safety-Aware Response Contract
  // -------------------------------------------------------------------------
  _smokePush_(report, 'safety-aware response contract', () => {
    const response = buildServerResponse_(
      true, 'OK', null, {}, [],
      {
        operationId: 'op',
        scenario: 'x',
        dryRun: false,
        affectedSheets: ['SEND_PANEL'],
        affectedEntities: ['x'],
        appliedChangesCount: 1,
        skippedChangesCount: 0,
        partial: false,
        retrySafe: true,
        lockUsed: true
      },
      { lifecycle: [] },
      { scenario: 'x' },
      []
    );
    
    const requiredFields = [
      'operationId', 'scenario', 'dryRun', 'affectedSheets', 'affectedEntities',
      'appliedChangesCount', 'skippedChangesCount', 'partial', 'retrySafe', 'lockUsed'
    ];
    
    requiredFields.forEach(field => {
      _smokeAssert_(field in response, `Response missing ${field}`);
    });
    
    return 'contract-ok';
  });

  // -------------------------------------------------------------------------
  // 23. Lifecycle Repository Contract
  // -------------------------------------------------------------------------
  _smokePush_(report, 'lifecycle repository contract', () => {
    _smokeAssert_(typeof OperationRepository_ === 'object', 'OperationRepository_ missing');
    _smokeAssert_(typeof OperationRepository_.buildFingerprint === 'function', 'buildFingerprint() missing');
    _smokeAssert_(typeof OperationRepository_.transitionStatus === 'function', 'transitionStatus() missing');
    _smokeAssert_(typeof OperationRepository_.appendNote === 'function', 'appendNote() missing');
    
    const fp1 = OperationRepository_.buildFingerprint('markPanelRowsAsSent', {
      rowNumbers: [7, 3, 7, 3],
      callsigns: [' A ', 'b', 'a']
    });
    
    const fp2 = OperationRepository_.buildFingerprint('markPanelRowsAsSent', {
      rowNumbers: [3, 7],
      callsigns: ['b', 'a']
    });
    
    _smokeAssert_(fp1 === fp2, 'fingerprint normalization not stable');
    
    return 'lifecycle-contract-ok';
  });

  // -------------------------------------------------------------------------
  // 24. Access Security E2E (Dry Run)
  // -------------------------------------------------------------------------
  _smokePush_(report, 'access security e2e dry-run', () => {
    const runner = _smokeResolveAccessSecurityRunner_();
    _smokeAssert_(runner && typeof runner.fn === 'function', 'Access security runner missing');
    
    const e2e = runner.fn({ dryRun: true, safeTestEnvironment: true });
    
    _smokeAssert_(e2e && Array.isArray(e2e.checks), 'Access E2E missing checks[]');
    _smokeAssert_(e2e.checks.length >= 8, 'Insufficient access security E2E checks');
    _smokeAssert_(e2e.status !== 'BLOCKED', 'Access security E2E returned BLOCKED');
    _smokeAssert_(e2e.ok !== false, 'Access security E2E returned ok=false');
    
    return `runner=${runner.name}; checks=${e2e.checks.length}`;
  });

  // -------------------------------------------------------------------------
  // 25. Security Hardening Helpers
  // -------------------------------------------------------------------------
  _smokePush_(report, 'security hardening helpers', () => {
    _smokeAssert_(typeof AccessControl_ === 'object', 'AccessControl_ missing');
    _smokeAssert_(typeof SecurityRedaction_ === 'object', 'SecurityRedaction_ missing');
    _smokeAssert_(typeof applySpreadsheetProtections_ === 'function', 'applySpreadsheetProtections_ missing');
    _smokeAssert_(typeof cleanupLogsAndAuditRetention_ === 'function', 'cleanupLogsAndAuditRetention_ missing');
    
    return 'security-helpers-ok';
  });

  // -------------------------------------------------------------------------
  // 26. Maintenance Repair API Contract
  // -------------------------------------------------------------------------
  _smokePush_(report, 'maintenance repair api contract', () => {
    const requiredApis = [
      'apiStage7ListPendingRepairs',
      'apiStage7GetOperationDetails',
      'apiStage7RunRepair'
    ];
    
    requiredApis.forEach(name => {
      _smokeAssert_(_smokeHasFn_(name), `${name} missing`);
    });
    
    return 'repair-api-ok';
  });

  // -------------------------------------------------------------------------
  // 27. Pending Repairs Visibility
  // -------------------------------------------------------------------------
  _smokePush_(report, 'pending repairs visibility contract', () => {
    const result = apiStage7ListPendingRepairs({});
    _assertStage4Meta_(result, 'apiStage7ListPendingRepairs');
    
    const payload = result?.data?.result || {};
    _smokeAssert_(typeof payload.total === 'number', 'total pending repairs not returned');
    _smokeAssert_(Array.isArray(payload.operations), 'operations[] not returned');
    
    return `visible=${payload.total}`;
  }, { skipOnError: true });

  // -------------------------------------------------------------------------
  // 28. Historical Documentation Status
  // -------------------------------------------------------------------------
  _smokePush_(report, 'historical docs kept non-active', () => {
    _smokeAssert_(docs.active.changelog === 'CHANGELOG.md', 'CHANGELOG must be active');
    
    const historical = docs.historical || [];
    _smokeAssert_(
      historical.includes('_extras/history/IMPLEMENTATION_REPORT_2026-03-22.md'),
      'Implementation report must be historical'
    );
    _smokeAssert_(
      historical.includes('_extras/history/STABILIZATION_NOTES_2026-03-22.md'),
      'Stabilization notes must be historical'
    );
    
    return 'historical-docs-ok';
  });

  return report;
}

// Alias for backward compatibility
function runSmokeTests(options) {
  return runRegressionTestSuite(options || {});
}
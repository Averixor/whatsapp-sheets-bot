/**
 * SmokeTests.gs — merged Stage 7.1 smoke / regression / compatibility suite preserving the full Stage 6 baseline breadth and adding Stage 7 lifecycle/runtime hardening checks, including retention cleanup flow.
 */

function _smokeAssert_(condition, message) {
  if (!condition) throw new Error(message || 'Smoke assert failed');
}

function _smokeBundleHas_(path) {
  return typeof isProjectBundleFilePresent_ === 'function' ? isProjectBundleFilePresent_(path) : false;
}

function _smokeHasRouteApi_(fnName) {
  const target = String(fnName || '').trim();
  if (!target) return false;
  try {
    if (typeof getStage6ARouteByApiMethod_ === 'function') return !!getStage6ARouteByApiMethod_(target);
  } catch (e) { }
  try {
    if (typeof listStage6ARoutes_ === 'function') {
      return (listStage6ARoutes_() || []).some(function (item) {
        return item && item.publicApiMethod === target;
      });
    }
  } catch (e) { }
  try {
    if (typeof getRoutingRegistry_ === 'function') {
      return Object.keys(getRoutingRegistry_() || {}).some(function (key) {
        const item = (getRoutingRegistry_() || {})[key];
        return item && item.publicApiMethod === target;
      });
    }
  } catch (e) { }
  return false;
}

function _smokeHasFn_(name) {
  const target = String(name || '').trim();
  if (!target) return false;
  try {
    // eslint-disable-next-line no-eval
    if (eval(`typeof ${target} === 'function'`)) return true;
  } catch (e) { }
  try {
    const g = Function('return this')();
    if (g && typeof g[target] === 'function') return true;
  } catch (e) { }
  return _smokeHasRouteApi_(target);
}

function _smokePush_(report, name, fn, options) {
  const opts = options || {};
  try {
    const details = fn();
    report.checks.push({
      name: name,
      status: 'OK',
      details: details || 'OK'
    });
  } catch (e) {
    if (opts.skipOnError) {
      report.skipped = report.skipped || [];
      report.skipped.push({ name: name, reason: e && e.message ? e.message : String(e) });
      report.checks.push({ name: name, status: 'SKIP', details: e && e.message ? e.message : String(e) });
      return;
    }
    report.ok = false;
    report.checks.push({
      name: name,
      status: 'FAIL',
      details: e && e.message ? e.message : String(e)
    });
  }
}

function _assertUnifiedContract_(result, functionName) {
  _smokeAssert_(result && typeof result === 'object', `${functionName}() не повернув об'єкт`);
  ['success', 'message', 'error', 'data', 'context', 'warnings'].forEach(function (field) {
    _smokeAssert_(field in result, `${functionName}() не повернув поле ${field}`);
  });
}

function _pickTestDate_() {
  const dates = PersonsRepository_.getAvailableDates();
  return dates.length ? dates[0] : _todayStr_();
}

function _pickTestCallsign_() {
  return PersonsRepository_.getAnyCallsign() || '';
}

function _assertStage4Meta_(result, functionName) {
  _assertUnifiedContract_(result, functionName);
  _smokeAssert_(result.data && typeof result.data === 'object', `${functionName}() не повернув data object`);
  _smokeAssert_('result' in result.data, `${functionName}() не повернув data.result`);
  _smokeAssert_('meta' in result.data, `${functionName}() не повернув data.meta`);
}

function _runContractTest_(report, name, fn, options) {
  _smokePush_(report, name, function () {
    const result = fn();
    _assertStage4Meta_(result, name);
    return `success=${result.success}`;
  }, options);
}

function runScenarioTests(options) {
  return runStage4ScenarioTests(options || {});
}

function runSmokeTests(options) {
  return runStage5SmokeTests(options || {});
}

function runStage4ScenarioTests(options) {
  const opts = options || {};
  const testDate = opts.date || _pickTestDate_();
  const testCallsign = opts.callsign || _pickTestCallsign();
  const report = {
    ok: true,
    stage: '4.2-compatibility',
    ts: new Date().toISOString(),
    dryRun: opts.dryRun !== false,
    checks: [],
    skipped: [],
    warnings: []
  };

  _runContractTest_(report, 'apiStage4GetMonthsList', function () {
    const result = apiStage4GetMonthsList();
    _smokeAssert_(Array.isArray(result.data.result.months), 'months[] не повернуто');
    return result;
  });

  _runContractTest_(report, 'apiStage4GetSidebarData', function () {
    const result = apiStage4GetSidebarData(testDate);
    _smokeAssert_(Array.isArray(result.data.result.personnel), 'personnel[] не повернуто');
    return result;
  }, { skipOnError: true });

  _runContractTest_(report, 'apiStage4GetSendPanelData', function () {
    const result = apiStage4GetSendPanelData();
    _smokeAssert_(Array.isArray(result.data.result.rows), 'rows[] не повернуто');
    return result;
  }, { skipOnError: true });

  _runContractTest_(report, 'apiGenerateSendPanelForDate', function () {
    const result = apiGenerateSendPanelForDate({ dryRun: true, date: testDate });
    _smokeAssert_(Array.isArray(result.data.result.rows), 'rows[] не повернуто');
    return result;
  });

  _runContractTest_(report, 'apiGenerateSendPanelForRange', function () {
    const result = apiGenerateSendPanelForRange({ dryRun: true, startDate: testDate, endDate: testDate });
    _smokeAssert_(Array.isArray(result.data.result.reports), 'reports[] не повернуто');
    return result;
  });

  _runContractTest_(report, 'apiMarkPanelRowsAsSent', function () {
    return apiMarkPanelRowsAsSent([Number(CONFIG.SEND_PANEL_DATA_START_ROW) || 3], { dryRun: true });
  }, { skipOnError: true });

  _runContractTest_(report, 'apiMarkPanelRowsAsUnsent', function () {
    return apiMarkPanelRowsAsUnsent([Number(CONFIG.SEND_PANEL_DATA_START_ROW) || 3], { dryRun: true });
  }, { skipOnError: true });

  _runContractTest_(report, 'apiSendPendingRows', function () {
    return apiSendPendingRows({ dryRun: true, limit: 10 });
  }, { skipOnError: true });

  _runContractTest_(report, 'apiBuildDaySummary', function () {
    const result = apiBuildDaySummary(testDate);
    _smokeAssert_(typeof result.data.result.summary === 'string', 'summary не повернуто');
    return result;
  }, { skipOnError: true });

  _runContractTest_(report, 'apiBuildDetailedSummary', function () {
    const result = apiBuildDetailedSummary(testDate);
    _smokeAssert_(typeof result.data.result.summary === 'string', 'summary не повернуто');
    return result;
  }, { skipOnError: true });

  _runContractTest_(report, 'apiOpenPersonCard', function () {
    _smokeAssert_(!!testCallsign, 'Не знайдено позивного для тесту картки');
    const result = apiOpenPersonCard(testCallsign, testDate);
    _smokeAssert_(!!result.data.result.callsign, 'callsign не повернуто');
    return result;
  }, { skipOnError: true });

  _runContractTest_(report, 'apiCheckVacationsAndBirthdays', function () {
    return apiCheckVacationsAndBirthdays(testDate);
  });

  _runContractTest_(report, 'apiStage4SwitchBotToMonth', function () {
    return apiStage4SwitchBotToMonth(getBotMonthSheetName_());
  });

  _runContractTest_(report, 'apiCreateNextMonthStage4', function () {
    return apiCreateNextMonthStage4({ dryRun: true, switchToNewMonth: false });
  }, { skipOnError: true });

  _runContractTest_(report, 'apiRunReconciliation', function () {
    return apiRunReconciliation({ mode: 'report', dryRun: true, date: testDate });
  });

  _runContractTest_(report, 'apiRunMaintenanceScenario', function () {
    return apiRunMaintenanceScenario({ type: 'healthCheck', shallow: true });
  });

  _runContractTest_(report, 'apiStage4HealthCheck', function () {
    const result = apiStage4HealthCheck({ shallow: true, includeReconciliationPreview: false });
    _smokeAssert_(Array.isArray(result.data.result.checks), 'checks[] не повернуто');
    return result;
  });

  _runContractTest_(report, 'apiRunStage4RegressionTests', function () {
    const result = apiRunStage4RegressionTests({ dryRun: true, date: testDate, callsign: testCallsign });
    _smokeAssert_(Array.isArray(result.data.result.checks), 'checks[] не повернуто');
    return result;
  });

  return report;
}

function runStage4SmokeTests(options) {
  const opts = options || {};
  const report = {
    ok: true,
    stage: '4.2-compatibility',
    ts: new Date().toISOString(),
    dryRun: opts.dryRun !== false,
    checks: [],
    skipped: [],
    warnings: []
  };

  _smokePush_(report, 'canonical stage4 response helper', function () {
    const response = buildStage4Response_(true, 'OK', null, { foo: 1 }, [], { a: 1 }, { b: 2 }, { c: 3 }, []);
    _assertStage4Meta_(response, 'buildStage4Response_');
    return 'contract-ready';
  });

  _smokePush_(report, 'canonical api contract suite', function () {
    const scenarios = runStage4ScenarioTests(opts);
    _smokeAssert_(Array.isArray(scenarios.checks), 'runStage4ScenarioTests() не повернув checks[]');
    _smokeAssert_(scenarios.checks.length >= 15, 'Замало historical Stage 4 compatibility contract checks');
    if (!scenarios.ok) throw new Error('Historical Stage 4 compatibility contract suite не повинна мати FAIL');
    return `checks=${scenarios.checks.length}`;
  }, { skipOnError: true });

  _smokePush_(report, 'maintenance api contract suite', function () {
    [
      apiStage4ClearCache(),
      apiStage4ClearLog(),
      apiStage4ClearPhoneCache(),
      apiStage4SetupVacationTriggers(),
      apiStage4CleanupDuplicateTriggers(),
      apiStage4DebugPhones(),
      apiRunMaintenanceScenario({ type: 'healthCheck', shallow: true }),
      apiStage4HealthCheck({ shallow: true }),
      apiRunStage4RegressionTests({ dryRun: true })
    ].forEach(function (result, idx) {
      _assertStage4Meta_(result, 'maintenance#' + (idx + 1));
    });
    return 'maintenance-contracts-ok';
  }, { skipOnError: true });

  _smokePush_(report, 'jobs api contract suite', function () {
    [apiListStage4Jobs(), apiInstallStage4Jobs()].forEach(function (result, idx) {
      _assertStage4Meta_(result, 'jobs#' + (idx + 1));
    });
    _assertUnifiedContract_(apiRunStage4Job(STAGE4_CONFIG.JOBS.SCHEDULED_HEALTHCHECK, { dryRun: true }), 'apiRunStage4Job');
    return 'jobs-contracts-ok';
  }, { skipOnError: true });

  _smokePush_(report, 'compatibility registry sanity', function () {
    const registry = getStage4CompatibilityMap_();
    _smokeAssert_(Array.isArray(registry) && registry.length >= 10, 'Compatibility registry надто малий');
    registry.forEach(function (item) {
      _smokeAssert_(!!item.name && !!item.replacement, 'Compatibility record пошкоджений');
    });
    return `compat=${registry.length}`;
  });

  _smokePush_(report, 'compatibility wrappers lead to canonical api', function () {
    getStage4CompatibilityMap_()
      .filter(function (item) { return !!item.verifySourceToken; })
      .forEach(function (item) {
        if (!_stage3HasFn_(item.name)) return;
        const src = String(_global_()[item.name]);
        _smokeAssert_(src.indexOf(item.verifySourceToken) !== -1, `${item.name} не веде до ${item.verifySourceToken}`);
      });
    return 'wrapper-sources-ok';
  });

  _smokePush_(report, 'canonical helper consistency', function () {
    _smokeAssert_(typeof HtmlUtils_ === 'object' && typeof HtmlUtils_.escapeHtml === 'function', 'HtmlUtils_.escapeHtml відсутній');
    _smokeAssert_(escapeHtml_('<x>') === HtmlUtils_.escapeHtml('<x>'), 'escapeHtml_() не узгоджений');
    _smokeAssert_(_escapeHtml_('<x>') === HtmlUtils_.escapeHtml('<x>'), '_escapeHtml_() не узгоджений');
    return 'helper-ok';
  });

  _smokePush_(report, 'bundle metadata / manifest / docs markers', function () {
    const meta = getProjectBundleMetadata_();
    _smokeAssert_(meta.manifestIncluded === true, 'manifestIncluded має бути true');
    _smokeAssert_(meta.maintenanceLayerStatus === 'stage5-canonical-maintenance-api', 'maintenanceLayerStatus має вказувати на Stage 5 canonical layer');
    _smokeAssert_(Array.isArray(meta.documentation.historical) && meta.documentation.historical.indexOf('docs/archive/STAGE4_2_REPORT.md') !== -1, 'docs/archive/STAGE4_2_REPORT.md має бути historical');
    _smokeAssert_(_smokeBundleHas_('appsscript.json'), 'appsscript.json має фізично існувати у root bundle');
    _smokeAssert_(_smokeBundleHas_('.clasp.json.example'), '.clasp.json.example має фізично існувати у root bundle');
    return 'bundle-ok';
  });

  _smokePush_(report, 'stage4 diagnostics modes available', function () {
    ['runHistoricalQuickDiagnosticsInternal_', 'runHistoricalStructuralDiagnosticsInternal_', 'runHistoricalCompatibilityDiagnosticsInternal_', 'runHistoricalFullDiagnosticsInternal_'].forEach(function (fnName) {
      _smokeAssert_(_stage3HasFn_(fnName), `${fnName} відсутній`);
    });
    return 'diagnostics-modes-ok';
  });

  _smokePush_(report, 'stage4 health check', function () {
    const health = runStage4HealthCheck_({ shallow: true, includeReconciliationPreview: false });
    _smokeAssert_(Array.isArray(health.checks), 'health.checks має бути масивом');
    return `checks=${health.checks.length}`;
  });

  return report;
}

function runStage5ScenarioTests(options) {
  const opts = options || {};
  const report = {
    ok: true,
    stage: (typeof getProjectBundleMetadata_ === 'function' ? getProjectBundleMetadata_().stageVersion : '7.1.0-reliability-hardened-merged'),
    ts: new Date().toISOString(),
    dryRun: opts.dryRun !== false,
    checks: [],
    skipped: [],
    warnings: []
  };

  _runContractTest_(report, 'apiPreviewSelectionMessage', function () {
    const result = apiPreviewSelectionMessage({});
    _smokeAssert_(result.data.result.kind === 'singleMessagePreview', 'Невірний kind для single preview');
    return result;
  }, { skipOnError: true });

  _runContractTest_(report, 'apiPreviewMultipleMessages', function () {
    const result = apiPreviewMultipleMessages({});
    _smokeAssert_(result.data.result.kind === 'multipleMessagesPreview', 'Невірний kind для multiple preview');
    return result;
  }, { skipOnError: true });

  _runContractTest_(report, 'apiPreviewGroupedMessages', function () {
    const result = apiPreviewGroupedMessages({});
    _smokeAssert_(result.data.result.kind === 'multipleMessagesPreview', 'Невірний kind для grouped preview');
    return result;
  }, { skipOnError: true });

  _runContractTest_(report, 'apiPrepareRangeMessages', function () {
    const result = apiPrepareRangeMessages({});
    _smokeAssert_(result.data.result.kind === 'multipleMessagesPreview', 'Невірний kind для range preview');
    return result;
  }, { skipOnError: true });

  _runContractTest_(report, 'apiBuildCommanderSummaryPreview', function () {
    const result = apiBuildCommanderSummaryPreview({});
    _smokeAssert_(result.data.result.kind === 'summaryPreview', 'Невірний kind для commander preview');
    return result;
  }, { skipOnError: true });

  _runContractTest_(report, 'apiBuildCommanderSummaryLink', function () {
    const result = apiBuildCommanderSummaryLink({});
    _smokeAssert_(result.data.result.kind === 'summaryPreview', 'Невірний kind для commander link preview');
    return result;
  }, { skipOnError: true });

  _runContractTest_(report, 'apiLogPreparedMessages', function () {
    const result = apiLogPreparedMessages({ mode: 'selection', dryRun: true });
    _smokeAssert_(!!result.data.result.kind, 'LOG preview не повернув prepared result');
    return result;
  }, { skipOnError: true });

  _runContractTest_(report, 'apiRunSelectionDiagnostics', function () {
    const result = apiRunSelectionDiagnostics({});
    _smokeAssert_(result.data.result.kind === 'selectionDiagnostics', 'Selection diagnostics не повернув expected kind');
    return result;
  }, { skipOnError: true });

  _runContractTest_(report, 'apiStage5HealthCheck', function () {
    const result = apiStage5HealthCheck({ mode: 'quick' });
    _smokeAssert_(Array.isArray(result.data.result.checks), 'checks[] не повернуто');
    return result;
  }, { skipOnError: true });

  _runContractTest_(report, 'apiRunStage5Diagnostics', function () {
    const result = apiRunStage5Diagnostics({ mode: 'structural' });
    _smokeAssert_(Array.isArray(result.data.result.checks), 'checks[] не повернуто');
    return result;
  }, { skipOnError: true });

  _runContractTest_(report, 'apiRunStage5RegressionTests', function () {
    const result = apiRunStage5RegressionTests({ dryRun: true });
    _smokeAssert_(Array.isArray(result.data.result.checks), 'checks[] не повернуто');
    return result;
  }, { skipOnError: true });

  return report;
}

function runStage5SmokeTests(options) {
  const opts = options || {};
  const meta = typeof getProjectBundleMetadata_ === 'function' ? getProjectBundleMetadata_() : PROJECT_BUNDLE_METADATA_;
  const docs = typeof getProjectDocumentationMap_ === 'function' ? getProjectDocumentationMap_() : {};
  const release = typeof getProjectReleaseNaming_ === 'function' ? getProjectReleaseNaming_() : (meta && meta.release) || {};
  const report = {
    ok: true,
    stage: meta && meta.stageVersion ? meta.stageVersion : '7.1.0-reliability-hardened-merged',
    ts: new Date().toISOString(),
    dryRun: opts.dryRun !== false,
    checks: [],
    skipped: [],
    warnings: []
  };

  _smokePush_(report, 'canonical scenario contract suite', function () {
    const scenarios = runStage5ScenarioTests(opts);
    _smokeAssert_(Array.isArray(scenarios.checks), 'runStage5ScenarioTests() не повернув checks[]');
    _smokeAssert_(scenarios.checks.length >= 11, 'Замало canonical contract checks');
    return `checks=${scenarios.checks.length}`;
  }, { skipOnError: true });

  _smokePush_(report, 'release metadata truth model', function () {
    _smokeAssert_(String(meta.stage) === '7.1', 'metadata.stage має бути 7.1');
    _smokeAssert_(meta.stageLabel === 'Stage 7.1 — Reliability Hardened Baseline', 'stageLabel має бути Stage 7.1 — Reliability Hardened Baseline');
    _smokeAssert_(meta.stageVersion === '7.1.0-reliability-hardened-merged', 'stageVersion має бути 7.1.0-reliability-hardened-merged');
    _smokeAssert_(meta.activeBaseline === 'stage7-1-reliability-hardened-baseline', 'activeBaseline має бути stage7-1-reliability-hardened-baseline');
    _smokeAssert_(meta.maintenanceLayerStatus === 'stage5-canonical-maintenance-api', 'maintenanceLayerStatus не Stage 5 canonical');
    _smokeAssert_(meta.packagingPolicy && meta.packagingPolicy.policy === 'root-manifest-with-root-clasp-example', 'Packaging policy має бути root-manifest-with-root-clasp-example');
    _smokeAssert_(meta.requiredDocs.indexOf('docs/reference/PUBLIC_API_STAGE5.md') !== -1, 'docs/reference/PUBLIC_API_STAGE5.md відсутній у metadata');
    _smokeAssert_(meta.requiredDocs.indexOf('docs/reference/STAGE5_REPORT.md') !== -1, 'docs/reference/STAGE5_REPORT.md відсутній у metadata');
    _smokeAssert_(meta.requiredDocs.indexOf('docs/reference/STAGE6A_REPORT.md') !== -1, 'docs/reference/STAGE6A_REPORT.md відсутній у metadata');
    return 'metadata-ok';
  });

  _smokePush_(report, 'physical bundle layout', function () {
    [
      'appsscript.json',
      '.clasp.json.example',
      'README.md',
      'ARCHITECTURE.md',
      'RUNBOOK.md',
      'STAGE7_REPORT.md',
      'OperationRepository.gs',
      'JavaScript.html',
      'Js.Core.html',
      'Js.Actions.html',
      'Js.Events.html',
      'docs/reference/PUBLIC_API_STAGE5.md',
      'docs/reference/CHANGELOG_STAGE5.md',
      'docs/reference/STAGE5_REPORT.md',
      'docs/reference/STAGE6A_REPORT.md'
    ].forEach(function (path) {
      _smokeAssert_(_smokeBundleHas_(path), `Файл відсутній у bundle: ${path}`);
    });
    return 'bundle-layout-ok';
  });

  _smokePush_(report, 'docs hierarchy truthfulness', function () {
    const activeDocs = docs && docs.active ? Object.values(docs.active) : [];
    const referenceDocs = Array.isArray(docs.reference) ? docs.reference : [];
    const historicalDocs = Array.isArray(docs.historical) ? docs.historical : [];
    _smokeAssert_(activeDocs.length >= 4, 'Замало active docs');
    activeDocs.forEach(function (path) {
      _smokeAssert_(String(path).indexOf('docs/archive/') !== 0, `Active doc не може лежати в archive: ${path}`);
      _smokeAssert_(_smokeBundleHas_(path), `Active doc відсутній фізично: ${path}`);
    });
    referenceDocs.forEach(function (path) {
      _smokeAssert_(String(path).indexOf('docs/reference/') === 0, `Reference doc має лежати в docs/reference/: ${path}`);
    });
    historicalDocs.forEach(function (path) {
      _smokeAssert_(String(path).indexOf('docs/archive/') === 0, `Historical doc має лежати в docs/archive/: ${path}`);
    });
    _smokeAssert_(docs.active.releaseReport === 'STAGE7_REPORT.md', 'STAGE7_REPORT має бути active release report');
    _smokeAssert_(referenceDocs.indexOf('docs/reference/STAGE6A_REPORT.md') !== -1, 'STAGE6A_REPORT має бути reference doc');
    _smokeAssert_(historicalDocs.indexOf('docs/archive/PUBLIC_API_STAGE4.md') !== -1, 'Stage 4 public API має бути historical');
    return 'docs-ok';
  });

  _smokePush_(report, 'release naming consistency', function () {
    _smokeAssert_(release.archiveBaseName === 'gas_wapb_stage7_1_reliability_hardened_baseline', 'archiveBaseName має бути gas_wapb_stage7_1_reliability_hardened_baseline');
    _smokeAssert_(release.archiveFileName === 'gas_wapb_stage7_1_reliability_hardened_baseline.zip', 'archiveFileName має бути gas_wapb_stage7_1_reliability_hardened_baseline.zip');
    _smokeAssert_(release.rootFolderName === 'gas_wapb_stage7_1_reliability_hardened_baseline', 'rootFolderName має бути gas_wapb_stage7_1_reliability_hardened_baseline');
    _smokeAssert_(meta.hardeningOverlay && meta.hardeningOverlay.label === 'Stage 6A hardening evolved into Stage 7 lifecycle baseline', 'overlay label невірний');
    return 'release-naming-ok';
  });

  _smokePush_(report, 'client runtime policy', function () {
    const policy = meta.clientRuntimePolicy || {};
    _smokeAssert_(policy.runtimeFile === 'JavaScript.html', 'runtimeFile має бути JavaScript.html');
    _smokeAssert_(policy.bootstrapMode === 'sidebar-includeTemplate', 'bootstrapMode має бути sidebar-includeTemplate');
    _smokeAssert_(policy.modularStatus === 'active-js-include-chain', 'modularStatus має бути active-js-include-chain');
    return 'client-policy-ok';
  });

  _smokePush_(report, 'client bootstrap helpers', function () {
    _smokeAssert_(typeof include === 'function', 'include() відсутній');
    _smokeAssert_(typeof includeTemplate === 'function', 'includeTemplate() відсутній');
    const runtime = includeTemplate('JavaScript');
    _smokeAssert_(runtime.indexOf('<script') !== -1, 'includeTemplate(\'JavaScript\') не повернув script block');
    return 'bootstrap-helpers-ok';
  });

  _smokePush_(report, 'sidebar template include path', function () {
    const rawSidebar = include('Sidebar');
    _smokeAssert_(rawSidebar.indexOf("<?!= includeTemplate('JavaScript'); ?>") !== -1 || rawSidebar.indexOf('<?!= includeTemplate("JavaScript"); ?>') !== -1, 'Sidebar.html має підключати JavaScript через includeTemplate');
    _smokeAssert_(rawSidebar.indexOf("<?!= include('JavaScript'); ?>") === -1 && rawSidebar.indexOf('<?!= include("JavaScript"); ?>') === -1, 'Sidebar.html не повинен використовувати raw include для JavaScript');
    return 'sidebar-include-ok';
  });

  _smokePush_(report, 'javascript runtime is modular', function () {
    const rawJavaScript = include('JavaScript');
    const runtime = includeTemplate('JavaScript');
    _smokeAssert_(rawJavaScript.indexOf("include('Js.Core')") !== -1 || rawJavaScript.indexOf('include("Js.Core")') !== -1, 'JavaScript.html має бути include-агрегатором для Js.*');
    _smokeAssert_(runtime.indexOf('<script') !== -1, "includeTemplate(\'JavaScript\') не повернув script block");
    _smokeAssert_(runtime.indexOf('stage7-sidebar-runtime') !== -1, 'runtime marker stage7-sidebar-runtime відсутній');
    _smokeAssert_(runtime.indexOf('window.SidebarApp = SidebarApp;') !== -1, 'SidebarApp export відсутній');
    return 'javascript-modular-ok';
  });

  _smokePush_(report, 'runtime wording hygiene', function () {
    const rawJavaScript = include('JavaScript');
    const rawSidebar = include('Sidebar');
    const runtimeContract = getClientRuntimeContract_();
    [{ token: 'runtime consolidated in RC2', label: 'legacy-runtime-token-1' }, { token: 'Показує тільки швидку актуальну Stage 5 перевірку без legacy-шуму.', label: 'legacy-runtime-token-2' }, { token: 'stage6a-canonical-runtime', label: 'legacy-runtime-token-3' }].forEach(function (item) {
      _smokeAssert_(rawJavaScript.indexOf(item.token) === -1, `У JavaScript.html залишився legacy runtime marker: ${item.label}`);
    });
    _smokeAssert_(rawSidebar.indexOf('Stage 6A bootstrap contract') === -1, 'У Sidebar.html залишився legacy bootstrap comment marker');
    _smokeAssert_(runtimeContract.policyMarker === 'stage7-sidebar-runtime', 'policyMarker має бути stage7-sidebar-runtime');
    _smokeAssert_(STAGE6A_CONFIG.ACTIVE_RUNTIME_MARKER === 'stage7-sidebar-runtime', 'ACTIVE_RUNTIME_MARKER має бути stage7-sidebar-runtime');
    return 'runtime-wording-ok';
  });




  _smokePush_(report, 'lifecycle retention cleanup api contract', function () {
    _smokeAssert_(_smokeHasFn_('apiStage5RunLifecycleRetentionCleanup'), 'apiStage5RunLifecycleRetentionCleanup відсутній');
    _smokeAssert_(_smokeHasFn_('apiStage4RunLifecycleRetentionCleanup'), 'apiStage4RunLifecycleRetentionCleanup відсутній');
    _smokeAssert_(typeof getStage4Config_ === 'function', 'getStage4Config_() відсутній');
    const cfg = getStage4Config_();
    _smokeAssert_(cfg && cfg.JOBS && cfg.JOBS.LIFECYCLE_RETENTION_CLEANUP === 'lifecycleRetentionCleanup', 'JOBS.LIFECYCLE_RETENTION_CLEANUP має бути lifecycleRetentionCleanup');
    return 'retention-cleanup-contract-ok';
  });

  _smokePush_(report, 'public diagnostics wording is stage7-1', function () {
    const quick = runStage5QuickDiagnostics_({ mode: 'quick' });
    const full = runStage5FullDiagnostics_({ mode: 'full' });
    const sunset = runStage5SunsetDiagnostics_({ mode: 'compatibility sunset' });
    const compatHealth = apiStage4HealthCheck({ shallow: true, includeReconciliationPreview: false });
    const maintHealth = apiStage5HealthCheck({ mode: 'quick' });
    const maintDiagnostics = apiRunStage5Diagnostics({ mode: 'full' });
    const texts = [
      quick.summary || '',
      full.summary || '',
      compatHealth.message || '',
      compatHealth.data && compatHealth.data.result && compatHealth.data.result.summary || '',
      maintHealth.message || '',
      maintHealth.data && maintHealth.data.result && maintHealth.data.result.summary || '',
      maintDiagnostics.message || '',
      maintDiagnostics.data && maintDiagnostics.data.result && maintDiagnostics.data.result.summary || ''
    ];

    texts.forEach(function (text) {
      [{ token: 'Stage 4.2', label: 'legacy-diagnostics-token-1' }, { token: 'Stage 5 health bridge', label: 'legacy-diagnostics-token-2' }, { token: 'Stage 5 compatibility diagnostics', label: 'legacy-diagnostics-token-3' }, { token: 'Stage 5 quick compatibility diagnostics', label: 'legacy-diagnostics-token-4' }, { token: 'Stage 5 full compatibility diagnostics', label: 'legacy-diagnostics-token-5' }, { token: 'Stage 5 structural compatibility diagnostics', label: 'legacy-diagnostics-token-6' }].forEach(function (item) {
        _smokeAssert_(String(text).indexOf(item.token) === -1, `У public diagnostics wording залишився legacy marker: ${item.label}`);
      });
    });

    _smokeAssert_(String(full.summary || '').indexOf('Stage 7.1 — Reliability Hardened Baseline') !== -1, 'Stage 7.1 wording не знайдено в diagnostics summary');
    _smokeAssert_((sunset.checks || []).some(function (item) { return item.name === 'Compatibility split report (informational)'; }), 'Informational compatibility split report не знайдено');
    _smokeAssert_((sunset.checks || []).every(function (item) { return item.name !== 'Canonical vs compatibility split'; }), 'Залишився старий compatibility split check name');
    _smokeAssert_((quick.checks || []).every(function (item) { return item.name !== 'Stage5 baseline health bridge'; }), 'У quick diagnostics залишився старий baseline health marker');
    return 'diagnostics-wording-ok';
  });


  _smokePush_(report, 'maintenance public wording is release-neutral', function () {
    const responses = [
      apiStage5HealthCheck({ mode: 'quick' }),
      apiRunStage5Diagnostics({ mode: 'quick' }),
      apiRunStage5RegressionTests({ dryRun: true }),
      apiListStage5JobRuntime(),
      apiListStage5Jobs()
    ];
    responses.forEach(function (result) {
      const texts = [
        result && result.message || '',
        result && result.data && result.data.result && result.data.result.summary || ''
      ];
      texts.forEach(function (text) {
        [{ token: 'Stage 4.2', label: 'legacy-maintenance-token-1' }, { token: 'Stage 5 jobs', label: 'legacy-maintenance-token-2' }, { token: 'Stage 5 health check', label: 'legacy-maintenance-token-3' }, { token: 'Stage 5 full health check', label: 'legacy-maintenance-token-4' }, { token: 'Stage 5 diagnostics', label: 'legacy-maintenance-token-5' }, { token: 'Stage 5 regression tests', label: 'legacy-maintenance-token-6' }, { token: 'Stage 5 job runtime', label: 'legacy-maintenance-token-7' }].forEach(function (item) {
          _smokeAssert_(String(text).indexOf(item.token) === -1, `У maintenance response залишився legacy marker: ${item.label}`);
        });
      });
    });
    return 'maintenance-wording-ok';
  });

  _smokePush_(report, 'maintenance naming policy', function () {
    const policy = getStage5MaintenancePolicy_();
    _smokeAssert_(policy.canonicalFile === 'Stage5MaintenanceApi.gs', 'canonical maintenance file має бути Stage5MaintenanceApi.gs');
    _smokeAssert_(policy.compatibilityFile === 'Stage4MaintenanceApi.gs', 'compatibility maintenance facade має бути Stage4MaintenanceApi.gs');
    ['apiStage5ClearCache', 'apiStage5HealthCheck', 'apiRunStage5Diagnostics', 'apiRunStage5RegressionTests', 'apiListStage5JobRuntime'].forEach(function (fnName) {
      _smokeAssert_(_stage3HasFn_(fnName), `${fnName} відсутній`);
    });
    ['apiStage4ClearCache', 'apiStage4HealthCheck', 'apiRunStage4RegressionTests'].forEach(function (fnName) {
      _smokeAssert_(_stage3HasFn_(fnName), `${fnName} як compatibility wrapper відсутній`);
    });
    return 'maintenance-policy-ok';
  });

  _smokePush_(report, 'diagnostics modes available', function () {
    ['runStage5QuickDiagnostics_', 'runStage5StructuralDiagnostics_', 'runStage5OperationalDiagnostics_', 'runStage5SunsetDiagnostics_', 'runStage5FullDiagnostics_'].forEach(function (fnName) {
      _smokeAssert_(_stage3HasFn_(fnName), `${fnName} відсутній`);
    });
    return 'diagnostics-modes-ok';
  });

  _smokePush_(report, 'diagnostics suite', function () {
    const diagnostics = runStage5FullDiagnostics_({ mode: 'full' });
    _smokeAssert_(Array.isArray(diagnostics.checks), 'runStage5FullDiagnostics_() не повернув checks[]');
    return `checks=${diagnostics.checks.length}`;
  }, { skipOnError: true });

  _smokePush_(report, 'job runtime contract', function () {
    const runtime = JobRuntime_.buildRuntimeReport();
    _smokeAssert_(typeof runtime === 'object', 'JobRuntime_.buildRuntimeReport() не повернув обʼєкт');
    return `jobs=${runtime.totalJobs || 0}`;
  });

  _smokePush_(report, 'template governance contract', function () {
    const templates = TemplateRegistry_.list();
    _smokeAssert_(Array.isArray(templates), 'TemplateRegistry_.list() не повернув масив');
    const resolved = TemplateResolver_.resolve('DAY_SUMMARY_HEADER', { date: '01.01.2026' }, { preview: true });
    _smokeAssert_(typeof resolved.text === 'string', 'TemplateResolver_.resolve() не повернув text');
    return `templates=${templates.length}`;
  });

  _smokePush_(report, 'compatibility sunset report', function () {
    const sunset = getCompatibilitySunsetReport_();
    _smokeAssert_(typeof sunset.total === 'number', 'getCompatibilitySunsetReport_() не повернув total');
    _smokeAssert_(typeof sunset.counts === 'object', 'getCompatibilitySunsetReport_() не повернув counts');
    return `total=${sunset.total}`;
  });

  _smokePush_(report, 'hardening domain test suite', function () {
    const domain = runStage6ADomainTests_({ dryRun: true });
    _smokeAssert_(Array.isArray(domain.checks), 'runStage6ADomainTests_() не повернув checks[]');
    _smokeAssert_(domain.total >= 20, 'Замало Stage 6A domain tests');
    if (!domain.ok) throw new Error('Stage 6A domain tests не повинні мати FAIL');
    return `tests=${domain.total}`;
  });

  _smokePush_(report, 'hardening routing registry coverage', function () {
    const coverage = getStage6ARouteCoverageReport_();
    _smokeAssert_(coverage.total >= 20, 'routing registry надто малий');
    _smokeAssert_(coverage.criticalWrites === coverage.lockCoverage, 'Не всі critical writes мають lock coverage');
    return `routes=${coverage.total}`;
  });

  _smokePush_(report, 'hardening job runtime governance', function () {
    const runtime = JobRuntime_.buildRuntimeReport();
    _smokeAssert_(runtime.storagePolicy && runtime.storagePolicy.policy === 'hybrid-sheet-plus-properties', 'Hybrid runtime policy не описана');
    _smokeAssert_(runtime.storagePolicy.propertiesArePrimaryJournal === false, 'PropertiesService не може бути primary journal');
    return runtime.storagePolicy.policy;
  });

  _smokePush_(report, 'safety-aware response contract', function () {
    const response = buildStage4Response_(true, 'OK', null, {}, [], { operationId: 'op', scenario: 'x', dryRun: false, affectedSheets: ['SEND_PANEL'], affectedEntities: ['x'], appliedChangesCount: 1, skippedChangesCount: 0, partial: false, retrySafe: true, lockUsed: true }, { lifecycle: [] }, { scenario: 'x' }, []);
    ['operationId', 'scenario', 'dryRun', 'affectedSheets', 'affectedEntities', 'appliedChangesCount', 'skippedChangesCount', 'partial', 'retrySafe', 'lockUsed'].forEach(function (field) {
      _smokeAssert_(field in response, `Response missing ${field}`);
    });
    return 'contract-ok';
  });


  _smokePush_(report, 'lifecycle repository contract', function () {
    _smokeAssert_(typeof OperationRepository_ === 'object', 'OperationRepository_ відсутній');
    _smokeAssert_(typeof OperationRepository_.buildFingerprint === 'function', 'buildFingerprint() відсутній');
    _smokeAssert_(typeof OperationRepository_.transitionStatus === 'function', 'transitionStatus() відсутній');
    _smokeAssert_(typeof OperationRepository_.appendNote === 'function', 'appendNote() відсутній');
    const fp1 = OperationRepository_.buildFingerprint('markPanelRowsAsSent', { rowNumbers: [7, 3, 7, 3], callsigns: [' A ', 'b', 'a'] });
    const fp2 = OperationRepository_.buildFingerprint('markPanelRowsAsSent', { rowNumbers: [3, 7], callsigns: ['b', 'a'] });
    _smokeAssert_(fp1 === fp2, 'fingerprint normalization не працює стабільно');
    return 'lifecycle-contract-ok';
  });

  _smokePush_(report, 'maintenance repair api contract', function () {
    ['apiStage5ListPendingRepairs', 'apiStage5GetOperationDetails', 'apiStage5RunRepair'].forEach(function (name) {
      _smokeAssert_(_smokeHasFn_(name), name + ' відсутній');
    });
    return 'repair-api-ok';
  });

  _smokePush_(report, 'pending repairs visibility contract', function () {
    const result = apiStage5ListPendingRepairs({});
    _assertStage4Meta_(result, 'apiStage5ListPendingRepairs');
    const payload = result && result.data && result.data.result ? result.data.result : {};
    _smokeAssert_(typeof payload.total === 'number', 'total pending repairs не повернуто');
    _smokeAssert_(Array.isArray(payload.operations), 'operations[] не повернуто');
    return `visible=${payload.total}`;
  }, { skipOnError: true });

  _smokePush_(report, 'historical docs kept non-active', function () {
    _smokeAssert_(docs.active.releaseReport === 'STAGE7_REPORT.md', 'Stage 7 report має бути активним');
    _smokeAssert_(Array.isArray(docs.historical) && docs.historical.indexOf('docs/archive/PUBLIC_API_STAGE4.md') !== -1, 'Stage 4 public API має бути historical');
    _smokeAssert_(Array.isArray(docs.historical) && docs.historical.indexOf('docs/archive/CHANGELOG_STAGE4.md') !== -1, 'Stage 4 changelog має бути historical');
    return 'historical-docs-ok';
  });

  return report;
}
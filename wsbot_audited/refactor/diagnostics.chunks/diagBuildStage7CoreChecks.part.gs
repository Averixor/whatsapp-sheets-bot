function _diagBuildStage7CoreChecks_(options) {
  var opts = options || {};
  var checks = [];
  var meta = typeof getProjectBundleMetadata_ === 'function' ? getProjectBundleMetadata_() : {};
  var release = typeof getProjectReleaseNaming_ === 'function' ? getProjectReleaseNaming_() : {};
  var docs = typeof getProjectDocumentationMap_ === 'function' ? getProjectDocumentationMap_() : {};
  var policy = meta && meta.clientRuntimePolicy ? meta.clientRuntimePolicy : {};
  var runtimeContract = typeof getClientRuntimeContract_ === 'function' ? getClientRuntimeContract_() : {};

  _stage7PushCheck_(checks, 'Release stage marker', String(meta && meta.stage || '') === '7.1' ? 'OK' : 'FAIL', 'stage=' + (meta && meta.stage || 'n/a') + ', label=' + (meta && meta.stageLabel || 'n/a'), 'Оновіть ProjectMetadata.gs під Stage 7.1');
  _stage7PushCheck_(checks, 'Active baseline marker', meta && meta.activeBaseline === 'stage7-1-2-final-clean-baseline' ? 'OK' : 'FAIL', 'activeBaseline=' + (meta && meta.activeBaseline || 'n/a'), 'Оновіть activeBaseline');
  _stage7PushCheck_(checks, 'Release naming aligned', release && release.archiveBaseName === 'gas_wasb_stage7_1_2_final_clean' && release.rootFolderName === 'gas_wasb_stage7_1_2_final_clean' ? 'OK' : 'FAIL', (release && release.archiveBaseName || 'n/a') + ' / ' + (release && release.rootFolderName || 'n/a'), 'Вирівняйте archive/root naming');
  _stage7PushCheck_(checks, 'Stage7 report active', docs && docs.active && docs.active.changelog === 'CHANGELOG.md' ? 'OK' : 'FAIL', docs && docs.active && docs.active.changelog ? docs.active.changelog : 'Не задано', 'Зафіксуйте CHANGELOG.md як active release report');
  _stage7PushCheck_(checks, 'Modular runtime policy', policy && policy.runtimeStatus === 'canonical-modular-runtime' ? 'OK' : 'FAIL', policy && policy.runtimeStatus ? policy.runtimeStatus : 'Не задано', 'Оновіть clientRuntimePolicy.runtimeStatus');
  _stage7PushCheck_(checks, 'Active Js include chain', policy && policy.modularStatus === 'active-js-include-chain' ? 'OK' : 'FAIL', policy && policy.modularStatus ? policy.modularStatus : 'Не задано', 'Оновіть clientRuntimePolicy.modularStatus');
  _stage7PushCheck_(checks, 'Runtime contract marker', runtimeContract && runtimeContract.policyMarker === 'stage7-sidebar-runtime' ? 'OK' : 'FAIL', runtimeContract && runtimeContract.policyMarker ? runtimeContract.policyMarker : 'Не задано', 'Оновіть getClientRuntimeContract_()');
  _stage7PushCheck_(checks, 'OperationRepository available', typeof OperationRepository_ === 'object' ? 'OK' : 'FAIL', typeof OperationRepository_, 'Підключіть OperationRepository.gs');
  _stage7PushCheck_(checks, 'WorkflowOrchestrator available', typeof WorkflowOrchestrator_ === 'object' ? 'OK' : 'FAIL', typeof WorkflowOrchestrator_, 'Перевірте WorkflowOrchestrator.gs');

  var hasList = _stage7HasFn_('apiStage7ListPendingRepairs');
  var hasRepair = _stage7HasFn_('apiStage7RunRepair');
  var hasRetentionCleanup = _stage7HasFn_('apiStage7RunLifecycleRetentionCleanup');
  _stage7PushCheck_(checks, 'Lifecycle maintenance API', hasList && hasRepair ? 'OK' : 'FAIL', 'list=' + hasList + ', repair=' + hasRepair, 'Додайте maintenance API для repair flow');
  _stage7PushCheck_(checks, 'Lifecycle retention cleanup API', hasRetentionCleanup ? 'OK' : 'WARN', 'cleanup=' + hasRetentionCleanup, 'Додайте окремий maintenance flow для lifecycle retention cleanup');
  _stage7PushCheck_(checks, 'Stage7 compatibility facade declared', _stage7HasFn_('apiStage4ClearCache') && _stage7HasFn_('apiStage4HealthCheck') ? 'OK' : 'WARN', 'wrappers preserved=' + (_stage7HasFn_('apiStage4ClearCache') && _stage7HasFn_('apiStage4HealthCheck')), 'Compatibility wrappers можуть лишатися лише для зовнішніх історичних викликів');

  ['OPS_LOG', 'ACTIVE_OPERATIONS', 'CHECKPOINTS'].forEach(function(name) {
    _diagServiceSheetCheck_(checks, name);
  });

  if (opts.includeRuntimeTemplate !== false) {
    try {
      var rawSidebar = include('Sidebar');
      var rawJavaScript = includeTemplate('JavaScript');
      _stage7PushCheck_(checks, 'Sidebar uses includeTemplate(JavaScript)', rawSidebar.indexOf("includeTemplate('JavaScript')") !== -1 || rawSidebar.indexOf('includeTemplate("JavaScript")') !== -1 ? 'OK' : 'FAIL', 'Sidebar bootstrap include chain checked', 'Поверніть includeTemplate(JavaScript) у Sidebar.html');
      var modularOk = rawJavaScript.indexOf('stage7-sidebar-runtime') !== -1 && rawJavaScript.indexOf('window.SidebarApp = SidebarApp;') !== -1 && rawJavaScript.indexOf('<script') !== -1;
      _stage7PushCheck_(checks, 'JavaScript runtime is modular', modularOk ? 'OK' : 'FAIL', 'JavaScript.html include chain evaluated', 'Зберіть JavaScript.html як модульний агрегатор');
    } catch (e) {
      _stage7PushCheck_(checks, 'Runtime template evaluation', 'FAIL', e && e.message ? e.message : String(e), 'Перевірте JavaScript.html і Sidebar.html');
    }
  }

  try {
    var runtime = typeof JobRuntime_ === 'object' && typeof JobRuntime_.buildRuntimeReport === 'function' ? JobRuntime_.buildRuntimeReport() : null;
    _stage7PushCheck_(checks, 'Job runtime report', runtime ? 'OK' : 'WARN', runtime ? ('jobs=' + (runtime.totalJobs || 0) + ', failed=' + (runtime.failedJobs || 0) + ', stale=' + (runtime.staleJobs || 0)) : 'Недоступний', runtime ? '' : 'Перевірте JobRuntime.gs');
  } catch (e) {
    _stage7PushCheck_(checks, 'Job runtime report', 'FAIL', e && e.message ? e.message : String(e), 'Перевірте JobRuntime.gs');
  }

  return _diagNormalizeReportChecks_({ checks: checks });
}

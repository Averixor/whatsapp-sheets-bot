/**
 * ProjectMetadata.gs — truthful release metadata for Stage 7.1 Reliability Hardened Baseline.
 */

const PROJECT_RELEASE_NAMING_ = Object.freeze({
  stage: '7.1',
  stageLabel: 'Stage 7.1 — Reliability Hardened Baseline',
  stageVersion: '7.1.1-reliability-hardened-merged',
  archiveBaseName: 'gas_wapb_stage7_1_reliability_hardened_baseline',
  archiveFileName: 'gas_wapb_stage7_1_reliability_hardened_baseline.zip',
  rootFolderName: 'gas_wapb_stage7_1_reliability_hardened_baseline',
  releaseKind: 'reliability-hardened-merged-baseline',
  selfDescription: 'Stage 7.1 merges the fuller diagnostics/smoke baseline of the earlier 7.1 build with the stronger lifecycle hardening improvements of the later 7.2 iteration into a baseline-preserving GAS-first release with repair flow, stale detection, retention cleanup, and modular sidebar runtime.',
  lineage: Object.freeze({
    functionalBaseline: 'stage6-final',
    hardeningOverlay: 'stage6a-operational-hardening',
    runtimeEvolution: 'sidebar-first-modular-runtime',
    operationsModel: 'sheet-backed-operation-lifecycle'
  })
});

const PROJECT_BUNDLE_FILE_INDEX_ = Object.freeze([
  '.clasp.json.example',
  'ARCHITECTURE.md',
  'Actions.gs',
  'AuditTrail.gs',
  'Code.gs',
  'DataAccess.gs',
  'DateUtils.gs',
  'DeprecatedRegistry.gs',
  'Diagnostics.gs',
  'DialogPresenter.gs',
  'DialogTemplates.gs',
  'Dialogs.gs',
  'DictionaryRepository.gs',
  'DomainTests.gs',
  'HtmlUtils.gs',
  'JavaScript.html',
  'JobRuntime.gs',
  'JobRuntimeRepository.gs',
  'Js.Actions.html',
  'Js.Api.html',
  'Js.Core.html',
  'Js.Diagnostics.html',
  'Js.Events.html',
  'Js.Helpers.html',
  'Js.Render.html',
  'Js.State.html',
  'Log.gs',
  'LogsRepository.gs',
  'MonthSheets.gs',
  'OperationRepository.gs',
  'OperationSafety.gs',
  'PersonCalendar.html',
  'PersonCards.gs',
  'PersonsRepository.gs',
  'PreviewLinkService.gs',
  'ProjectMetadata.gs',
  'README.md',
  'RUNBOOK.md',
  'Reconciliation.gs',
  'RoutingRegistry.gs',
  'SelectionActionService.gs',
  'SendPanel.gs',
  'SendPanelRepository.gs',
  'SendPanelService.gs',
  'ServerResponse.gs',
  'SheetSchemas.gs',
  'SheetStandards.gs',
  'Sidebar.html',
  'SidebarServer.gs',
  'SmokeTests.gs',
  'SpreadsheetActionsApi.gs',
  'Stage3ServerApi.gs',
  'Stage4Config.gs',
  'Stage4MaintenanceApi.gs',
  'Stage4ServerApi.gs',
  'Stage5MaintenanceApi.gs',
  'STAGE7_REPORT.md',
  'Styles.html',
  'Summaries.gs',
  'SummaryRepository.gs',
  'SummaryService.gs',
  'TemplateRegistry.gs',
  'TemplateResolver.gs',
  'Templates.gs',
  'Triggers.gs',
  'UseCases.gs',
  'Utils.gs',
  'VacationEngine.gs',
  'VacationService.gs',
  'VacationsRepository.gs',
  'Validation.gs',
  'WorkflowOrchestrator.gs',
  'appsscript.json',
  'docs/archive/CHANGELOG_STAGE3.md',
  'docs/archive/CHANGELOG_STAGE4.md',
  'docs/archive/FINAL_BUILD_NOTES.md',
  'docs/archive/MERGE_NOTES.md',
  'docs/archive/PUBLIC_API_STAGE3.md',
  'docs/archive/PUBLIC_API_STAGE4.md',
  'docs/archive/REFRACTOR_REPORT.md',
  'docs/archive/STAGE3_REPORT.md',
  'docs/archive/STAGE4_1_REPORT.md',
  'docs/archive/STAGE4_2_REPORT.md',
  'docs/archive/STAGE4_REPORT.md',
  'docs/archive/stage_4_1_tz.md',
  'docs/reference/CHANGELOG_STAGE5.md',
  'docs/reference/JOBS_RUNTIME.md',
  'docs/reference/PUBLIC_API_STAGE5.md',
  'docs/reference/SPREADSHEET_ACTION_API.md',
  'docs/reference/STAGE5_REPORT.md',
  'docs/reference/STAGE6A_REPORT.md',
  'docs/reference/SUNSET_POLICY.md'
]);

const PROJECT_BUNDLE_METADATA_ = Object.freeze({
  stage: '7.1',
  stageLabel: PROJECT_RELEASE_NAMING_.stageLabel,
  stageVersion: PROJECT_RELEASE_NAMING_.stageVersion,
  release: PROJECT_RELEASE_NAMING_,
  activeBaseline: 'stage7-1-reliability-hardened-baseline',
  gasFirst: true,
  manifestIncluded: true,
  claspReady: true,
  packagingPolicy: Object.freeze({
    policy: 'root-manifest-with-root-clasp-example',
    manifestPath: 'appsscript.json',
    claspExamplePath: '.clasp.json.example',
    activeDocsRoot: '.',
    referenceDocsRoot: 'docs/reference/',
    historicalDocsRoot: 'docs/archive/'
  }),
  hardeningOverlay: Object.freeze({
    stage: '6A+',
    label: 'Stage 6A hardening evolved into Stage 7 lifecycle baseline',
    routingRegistry: 'RoutingRegistry.gs',
    safetyLayer: 'OperationSafety.gs',
    operationRepository: 'OperationRepository.gs',
    report: 'STAGE7_REPORT.md'
  }),
  canonicalLayers: Object.freeze({
    sidebarApplicationApi: 'Stage4ServerApi.gs',
    spreadsheetActionApi: 'SpreadsheetActionsApi.gs',
    maintenanceApi: 'Stage5MaintenanceApi.gs',
    useCases: 'UseCases.gs',
    workflow: 'WorkflowOrchestrator.gs',
    operationRepository: 'OperationRepository.gs',
    diagnostics: 'Diagnostics.gs',
    tests: 'SmokeTests.gs',
    metadata: 'ProjectMetadata.gs',
    compatibilityFacade: 'Stage4MaintenanceApi.gs'
  }),
  layerMap: Object.freeze({
    application: Object.freeze({
      sidebarApi: 'Stage4ServerApi.gs',
      spreadsheetActions: 'SpreadsheetActionsApi.gs',
      maintenance: 'Stage5MaintenanceApi.gs'
    }),
    orchestration: Object.freeze({
      useCases: 'UseCases.gs',
      workflow: 'WorkflowOrchestrator.gs',
      validation: 'Validation.gs',
      audit: 'AuditTrail.gs',
      operationRepository: 'OperationRepository.gs'
    }),
    presentation: Object.freeze({
      sidebar: ['Sidebar.html', 'Styles.html', 'JavaScript.html'],
      clientRuntime: Object.freeze({
        bootstrapTemplate: 'Sidebar.html',
        styleInclude: 'Styles.html',
        runtimeScript: 'JavaScript.html',
        runtimeScriptLoadMode: 'includeTemplate',
        bootstrapStatus: 'canonical-modular-runtime',
        runtimeModules: ['Js.Core.html', 'Js.State.html', 'Js.Api.html', 'Js.Render.html', 'Js.Diagnostics.html', 'Js.Helpers.html', 'Js.Events.html', 'Js.Actions.html'],
        notes: 'Stage 7 uses JavaScript.html as a modular include aggregator over Js.* runtime fragments.'
      })
    }),
    runtime: Object.freeze({
      jobs: ['JobRuntime.gs', 'JobRuntimeRepository.gs', 'Triggers.gs'],
      reconciliation: 'Reconciliation.gs',
      templates: ['TemplateRegistry.gs', 'TemplateResolver.gs', 'Templates.gs']
    }),
    compatibility: Object.freeze({
      wrappers: ['Stage4MaintenanceApi.gs', 'SidebarServer.gs', 'Stage3ServerApi.gs', 'Actions.gs', 'Dialogs.gs'],
      registry: 'DeprecatedRegistry.gs'
    })
  }),
  maintenanceLayerStatus: 'stage5-canonical-maintenance-api',
  maintenanceLayerPolicy: Object.freeze({
    policy: 'canonical-stage5-maintenance-with-stage4-compat-facade',
    canonicalFile: 'Stage5MaintenanceApi.gs',
    compatibilityFile: 'Stage4MaintenanceApi.gs'
  }),
  compatibilityPolicyMarker: 'stage7-compatible',
  sunsetPolicyMarker: 'stage7-sunset-governed',
  diagnosticsPolicy: Object.freeze({
    wording: 'stage7-1-reliability-hardened-baseline',
    publicOutputPolicy: 'stage7-release-wording-with-stage5-api-lineage'
  }),
  clientRuntimePolicy: Object.freeze({
    runtimeFile: 'JavaScript.html',
    bootstrapTemplate: 'Sidebar.html',
    bootstrapMode: 'sidebar-includeTemplate',
    styleInclude: 'Styles.html',
    runtimeStatus: 'canonical-modular-runtime',
    modularStatus: 'active-js-include-chain',
    runtimeModules: Object.freeze(['Js.Core.html', 'Js.State.html', 'Js.Api.html', 'Js.Render.html', 'Js.Diagnostics.html', 'Js.Helpers.html', 'Js.Events.html', 'Js.Actions.html']),
    diagnosticsWording: 'stage7-1-reliability-hardened-baseline'
  }),
  documentation: Object.freeze({
    active: Object.freeze({
      entry: 'README.md',
      architecture: 'ARCHITECTURE.md',
      runbook: 'RUNBOOK.md',
      releaseReport: 'STAGE7_REPORT.md'
    }),
    canonicalReference: Object.freeze({
      publicApi: 'docs/reference/PUBLIC_API_STAGE5.md',
      changelog: 'docs/reference/CHANGELOG_STAGE5.md',
      baselineReport: 'docs/reference/STAGE5_REPORT.md',
      hardeningReport: 'docs/reference/STAGE6A_REPORT.md'
    }),
    reference: Object.freeze([
      'docs/reference/PUBLIC_API_STAGE5.md',
      'docs/reference/CHANGELOG_STAGE5.md',
      'docs/reference/STAGE5_REPORT.md',
      'docs/reference/STAGE6A_REPORT.md',
      'docs/reference/SPREADSHEET_ACTION_API.md',
      'docs/reference/JOBS_RUNTIME.md',
      'docs/reference/SUNSET_POLICY.md'
    ]),
    historical: Object.freeze([
      'docs/archive/CHANGELOG_STAGE3.md',
      'docs/archive/CHANGELOG_STAGE4.md',
      'docs/archive/FINAL_BUILD_NOTES.md',
      'docs/archive/MERGE_NOTES.md',
      'docs/archive/PUBLIC_API_STAGE3.md',
      'docs/archive/PUBLIC_API_STAGE4.md',
      'docs/archive/REFRACTOR_REPORT.md',
      'docs/archive/STAGE3_REPORT.md',
      'docs/archive/STAGE4_1_REPORT.md',
      'docs/archive/STAGE4_2_REPORT.md',
      'docs/archive/STAGE4_REPORT.md',
      'docs/archive/stage_4_1_tz.md'
    ]),
    referenceRoot: 'docs/reference/',
    historicalRoot: 'docs/archive/'
  }),
  requiredDocs: Object.freeze([
    'README.md',
    'ARCHITECTURE.md',
    'RUNBOOK.md',
    'STAGE7_REPORT.md',
    'docs/reference/PUBLIC_API_STAGE5.md',
    'docs/reference/CHANGELOG_STAGE5.md',
    'docs/reference/STAGE5_REPORT.md',
    'docs/reference/STAGE6A_REPORT.md'
  ]),
  serviceSheets: Object.freeze(['OPS_LOG', 'ACTIVE_OPERATIONS', 'CHECKPOINTS', 'JOB_RUNTIME_LOG', 'AUDIT_LOG']),
  canonicalApplicationApi: Object.freeze([
    'apiStage4GetMonthsList', 'apiStage4GetSidebarData', 'apiStage4GetSendPanelData',
    'apiGenerateSendPanelForDate', 'apiGenerateSendPanelForRange', 'apiMarkPanelRowsAsSent',
    'apiMarkPanelRowsAsUnsent', 'apiSendPendingRows', 'apiBuildDaySummary', 'apiBuildDetailedSummary',
    'apiOpenPersonCard', 'apiCheckVacationsAndBirthdays', 'apiStage4SwitchBotToMonth',
    'apiCreateNextMonthStage4', 'apiRunReconciliation'
  ]),
  canonicalSpreadsheetApi: Object.freeze([
    'apiPreviewSelectionMessage', 'apiPreviewMultipleMessages', 'apiPreviewGroupedMessages',
    'apiPrepareRangeMessages', 'apiBuildCommanderSummaryPreview', 'apiBuildCommanderSummaryLink',
    'apiLogPreparedMessages', 'apiRunSelectionDiagnostics'
  ]),
  canonicalMaintenanceApi: Object.freeze([
    'apiStage5ClearCache', 'apiStage5ClearLog', 'apiStage5ClearPhoneCache', 'apiStage5RestartBot',
    'apiStage5SetupVacationTriggers', 'apiStage5CleanupDuplicateTriggers', 'apiStage5DebugPhones',
    'apiStage5BuildBirthdayLink', 'apiRunStage5MaintenanceScenario', 'apiInstallStage5Jobs',
    'apiListStage5Jobs', 'apiRunStage5Job', 'apiStage5HealthCheck', 'apiRunStage5Diagnostics',
    'apiRunStage5RegressionTests', 'apiListStage5JobRuntime', 'apiStage5ListPendingRepairs',
    'apiStage5GetOperationDetails', 'apiStage5RunRepair', 'apiStage5RunLifecycleRetentionCleanup'
  ]),
  compatibilityApi: Object.freeze([
    'apiStage4ClearCache', 'apiStage4ClearLog', 'apiStage4ClearPhoneCache', 'apiStage4RestartBot',
    'apiStage4SetupVacationTriggers', 'apiStage4CleanupDuplicateTriggers', 'apiStage4DebugPhones',
    'apiStage4BuildBirthdayLink', 'apiRunMaintenanceScenario', 'apiInstallStage4Jobs', 'apiListStage4Jobs',
    'apiRunStage4Job', 'apiStage4HealthCheck', 'apiRunStage4RegressionTests'
  ]),
  clientRoutingPolicy: Object.freeze({
    sidebar: Object.freeze({
      generatePanel: 'apiGenerateSendPanelForDate',
      generatePanelRange: 'apiGenerateSendPanelForRange',
      sendPendingRows: 'apiSendPendingRows',
      markPanelRowsAsSent: 'apiMarkPanelRowsAsSent',
      markPanelRowsAsUnsent: 'apiMarkPanelRowsAsUnsent',
      buildDaySummary: 'apiBuildDaySummary',
      buildDetailedSummary: 'apiBuildDetailedSummary',
      openPersonCard: 'apiOpenPersonCard',
      checkVacationsAndBirthdays: 'apiCheckVacationsAndBirthdays',
      switchBotToMonth: 'apiStage4SwitchBotToMonth',
      createNextMonth: 'apiCreateNextMonthStage4',
      runReconciliation: 'apiRunReconciliation'
    }),
    maintenance: Object.freeze({
      clearCache: 'apiStage5ClearCache',
      clearLog: 'apiStage5ClearLog',
      clearPhoneCache: 'apiStage5ClearPhoneCache',
      restartBot: 'apiStage5RestartBot',
      setupVacationTriggers: 'apiStage5SetupVacationTriggers',
      cleanupDuplicateTriggers: 'apiStage5CleanupDuplicateTriggers',
      debugPhones: 'apiStage5DebugPhones',
      buildBirthdayLink: 'apiStage5BuildBirthdayLink',
      runMaintenanceScenario: 'apiRunStage5MaintenanceScenario',
      installJobs: 'apiInstallStage5Jobs',
      listJobs: 'apiListStage5Jobs',
      runJob: 'apiRunStage5Job',
      healthCheck: 'apiStage5HealthCheck',
      runDiagnostics: 'apiRunStage5Diagnostics',
      runRegressionTests: 'apiRunStage5RegressionTests',
      listJobRuntime: 'apiListStage5JobRuntime',
      listPendingRepairs: 'apiStage5ListPendingRepairs',
      getOperationDetails: 'apiStage5GetOperationDetails',
      runRepair: 'apiStage5RunRepair',
      runLifecycleRetentionCleanup: 'apiStage5RunLifecycleRetentionCleanup'
    })
  })
});

function getProjectBundleMetadata_() { return PROJECT_BUNDLE_METADATA_; }
function getProjectReleaseNaming_() { return Object.assign({}, PROJECT_RELEASE_NAMING_, { lineage: Object.assign({}, PROJECT_RELEASE_NAMING_.lineage || {}) }); }
function getProjectPackagingPolicy_() { return Object.assign({}, PROJECT_BUNDLE_METADATA_.packagingPolicy || {}); }
function getProjectBundleFileIndex_() { return PROJECT_BUNDLE_FILE_INDEX_.slice(); }
function isProjectBundleFilePresent_(path) {
  const target = String(path || '').trim().replace(/^\.\//, '');
  return !!target && PROJECT_BUNDLE_FILE_INDEX_.indexOf(target) !== -1;
}
function getMissingProjectBundleFiles_(paths) { return (paths || []).filter(function(path) { return !isProjectBundleFilePresent_(path); }); }
function getProjectRequiredDocs_() { return PROJECT_BUNDLE_METADATA_.requiredDocs.slice(); }
function getProjectActiveDocs_() { return Object.values(PROJECT_BUNDLE_METADATA_.documentation.active || {}); }
function getProjectHistoricalDocs_() { return (PROJECT_BUNDLE_METADATA_.documentation && PROJECT_BUNDLE_METADATA_.documentation.historical || []).slice(); }
function getProjectDocumentationMap_() {
  return {
    active: Object.assign({}, PROJECT_BUNDLE_METADATA_.documentation.active || {}),
    canonicalReference: Object.assign({}, PROJECT_BUNDLE_METADATA_.documentation.canonicalReference || {}),
    reference: (PROJECT_BUNDLE_METADATA_.documentation.reference || []).slice(),
    historical: (PROJECT_BUNDLE_METADATA_.documentation.historical || []).slice(),
    referenceRoot: PROJECT_BUNDLE_METADATA_.documentation.referenceRoot || '',
    historicalRoot: PROJECT_BUNDLE_METADATA_.documentation.historicalRoot || ''
  };
}
function getStage5LayerMap_() { return JSON.parse(JSON.stringify(PROJECT_BUNDLE_METADATA_.layerMap || {})); }
function getStage5CanonicalApiMap_() {
  return {
    application: PROJECT_BUNDLE_METADATA_.canonicalApplicationApi.slice(),
    spreadsheet: PROJECT_BUNDLE_METADATA_.canonicalSpreadsheetApi.slice(),
    maintenance: PROJECT_BUNDLE_METADATA_.canonicalMaintenanceApi.slice(),
    compatibility: PROJECT_BUNDLE_METADATA_.compatibilityApi.slice()
  };
}
function getStage5ClientRoutingPolicy_() { return JSON.parse(JSON.stringify(PROJECT_BUNDLE_METADATA_.clientRoutingPolicy || {})); }
function getStage5MaintenancePolicy_() { return Object.assign({}, PROJECT_BUNDLE_METADATA_.maintenanceLayerPolicy || {}); }
function getStage4CanonicalApiMap_() {
  return {
    application: PROJECT_BUNDLE_METADATA_.canonicalApplicationApi.slice(),
    maintenance: PROJECT_BUNDLE_METADATA_.compatibilityApi.slice(),
    compatibility: PROJECT_BUNDLE_METADATA_.compatibilityApi.slice()
  };
}
function getStage4ClientRoutingPolicy_() {
  const routing = (typeof getStage5ClientRoutingPolicy_ === 'function' ? getStage5ClientRoutingPolicy_() : PROJECT_BUNDLE_METADATA_.clientRoutingPolicy) || {};
  return Object.assign({}, routing.sidebar || {}, {
    clearCache: 'apiStage4ClearCache',
    clearLog: 'apiStage4ClearLog',
    clearPhoneCache: 'apiStage4ClearPhoneCache',
    restartBot: 'apiStage4RestartBot',
    runLifecycleRetentionCleanup: 'apiStage4RunLifecycleRetentionCleanup',
    setupVacationTriggers: 'apiStage4SetupVacationTriggers',
    cleanupDuplicateTriggers: 'apiStage4CleanupDuplicateTriggers',
    debugPhones: 'apiStage4DebugPhones',
    buildBirthdayLink: 'apiStage4BuildBirthdayLink',
    healthCheck: 'apiStage4HealthCheck',
    runRegressionTests: 'apiRunStage4RegressionTests'
  });
}

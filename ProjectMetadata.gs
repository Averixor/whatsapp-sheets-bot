/**
 * ProjectMetadata.gs — truthful release metadata for the active Stage 7.1 baseline.
 */

function _projectMetaDeepCopy_(value) {
  return JSON.parse(JSON.stringify(value));
}

const PROJECT_RELEASE_NAMING_ = Object.freeze({
  stage: '7.1',
  stageLabel: 'Stage 7.1 — Reliability Hardened Baseline',
  stageVersion: '7.1.0-reliability-hardened-merged',
  activeBaseline: 'stage7-1-reliability-hardened-baseline',
  archiveBaseName: 'gas_wapb_stage7_1_reliability_hardened_baseline',
  archiveFileName: 'gas_wapb_stage7_1_reliability_hardened_baseline.zip',
  rootFolderName: 'gas_wapb_stage7_1_reliability_hardened_baseline'
});

const PROJECT_DOCUMENTATION_MAP_ = Object.freeze({
  active: Object.freeze({
    readme: 'README.md',
    architecture: 'ARCHITECTURE.md',
    runbook: 'RUNBOOK.md',
    releaseReport: 'STAGE7_REPORT.md'
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
    'docs/archive/PUBLIC_API_STAGE4.md',
    'docs/archive/CHANGELOG_STAGE4.md',
    'docs/archive/STAGE4_REPORT.md',
    'docs/archive/STAGE6A_TRANSITION_NOTES.md'
  ])
});

const PROJECT_CANONICAL_LAYERS_ = Object.freeze({
  applicationApi: 'Stage4ServerApi.gs',
  sidebarApplicationApi: 'Stage4ServerApi.gs',
  spreadsheetActionApi: 'SpreadsheetActionsApi.gs',
  maintenanceApi: 'Stage5MaintenanceApi.gs',
  useCases: 'UseCases.gs',
  workflow: 'WorkflowOrchestrator.gs',
  compatibility: 'SidebarServer.gs',
  compatibilityFacade: 'SidebarServer.gs',
  diagnostics: 'Diagnostics.gs',
  tests: 'SmokeTests.gs',
  metadata: 'ProjectMetadata.gs',
  dialogPresentation: 'DialogPresenter.gs',
  dialogTemplates: 'DialogTemplates.gs'
});

const PROJECT_STAGE4_CANONICAL_API_MAP_ = Object.freeze({
  application: Object.freeze([
    'apiStage4GetMonthsList',
    'apiStage4GetSidebarData',
    'apiGenerateSendPanelForDate',
    'apiGenerateSendPanelForRange',
    'apiStage4GetSendPanelData',
    'apiMarkPanelRowsAsSent',
    'apiMarkPanelRowsAsUnsent',
    'apiSendPendingRows',
    'apiBuildDaySummary',
    'apiBuildDetailedSummary',
    'apiOpenPersonCard',
    'apiCheckVacationsAndBirthdays',
    'apiStage4SwitchBotToMonth',
    'apiCreateNextMonthStage4',
    'apiRunReconciliation'
  ]),
  maintenance: Object.freeze([
    'apiStage5ClearCache',
    'apiStage5ClearLog',
    'apiStage5ClearPhoneCache',
    'apiStage5RestartBot',
    'apiStage5SetupVacationTriggers',
    'apiStage5CleanupDuplicateTriggers',
    'apiStage5DebugPhones',
    'apiStage5BuildBirthdayLink',
    'apiRunStage5MaintenanceScenario',
    'apiInstallStage5Jobs',
    'apiListStage5Jobs',
    'apiRunStage5Job',
    'apiStage5HealthCheck',
    'apiRunStage5Diagnostics',
    'apiRunStage5RegressionTests',
    'apiListStage5JobRuntime',
    'apiStage5ListPendingRepairs',
    'apiStage5GetOperationDetails',
    'apiStage5RunRepair',
    'apiStage5RunLifecycleRetentionCleanup'
  ]),
  compatibility: Object.freeze([
    'getMonthsList',
    'getSidebarData',
    'generateSendPanelSidebar',
    'getSendPanelSidebarData',
    'getDaySummaryByDate',
    'getDetailedDaySummaryByDate',
    'checkVacationsAndNotifySidebar',
    'createNextMonthSheetSidebar',
    'switchBotToMonthSidebar',
    'markMultipleAsSentFromSidebar',
    'markMultipleAsUnsentFromSidebar',
    'apiGetMonthsList',
    'apiGetSidebarData',
    'apiGenerateSendPanel',
    'apiGetSendPanelData',
    'apiMarkSendPanelRowsAsSent',
    'apiGetDaySummary',
    'apiGetDetailedDaySummary',
    'apiCheckVacations',
    'apiGetBirthdays',
    'apiBuildBirthdayLink',
    'apiGetPersonCardData',
    'apiSwitchBotToMonth',
    'apiCreateNextMonth',
    'apiSetupVacationTriggers',
    'apiCleanupDuplicateTriggers',
    'apiDebugPhones',
    'apiClearCache',
    'apiClearPhoneCache',
    'apiClearLog',
    'apiHealthCheck',
    'apiRunRegressionTests',
    '_parseUaDate_',
    'normalizeDate_',
    '_parseDate_',
    'escapeHtml_',
    '_escapeHtml_'
  ])
});

const PROJECT_STAGE5_PUBLIC_API_MAP_ = Object.freeze({
  application: PROJECT_STAGE4_CANONICAL_API_MAP_.application,
  spreadsheet: Object.freeze([
    'apiPreviewSelectionMessage',
    'apiPreviewMultipleMessages',
    'apiPreviewGroupedMessages',
    'apiPrepareRangeMessages',
    'apiBuildCommanderSummaryPreview',
    'apiBuildCommanderSummaryLink',
    'apiLogPreparedMessages',
    'apiRunSelectionDiagnostics'
  ]),
  maintenance: PROJECT_STAGE4_CANONICAL_API_MAP_.maintenance,
  compatibility: PROJECT_STAGE4_CANONICAL_API_MAP_.compatibility
});

const PROJECT_STAGE4_CLIENT_ROUTING_POLICY_ = Object.freeze({
  getMonthsList: 'apiStage4GetMonthsList',
  getSidebarData: 'apiStage4GetSidebarData',
  getSendPanelData: 'apiStage4GetSendPanelData',
  generatePanel: 'apiGenerateSendPanelForDate',
  daySummary: 'apiBuildDaySummary',
  detailedDay: 'apiBuildDetailedSummary',
  openPersonCard: 'apiOpenPersonCard',
  vacationReminder: 'apiCheckVacationsAndBirthdays',
  birthdayCheck: 'apiCheckVacationsAndBirthdays',
  switchMonth: 'apiStage4SwitchBotToMonth',
  createNextMonth: 'apiCreateNextMonthStage4',
  markPanelRowsAsSent: 'apiMarkPanelRowsAsSent',
  markSendPanelRowsAsSent: 'apiMarkPanelRowsAsSent',
  markPanelRowsAsUnsent: 'apiMarkPanelRowsAsUnsent',
  sendUnsent: 'apiSendPendingRows',
  runReconciliation: 'apiRunReconciliation',
  healthCheck: 'apiStage5HealthCheck',
  clearCache: 'apiStage5ClearCache',
  clearLog: 'apiStage5ClearLog',
  clearPhoneCache: 'apiStage5ClearPhoneCache',
  restartBot: 'apiStage5RestartBot',
  setupTrigger: 'apiStage5SetupVacationTriggers',
  cleanupTriggers: 'apiStage5CleanupDuplicateTriggers',
  debugPhones: 'apiStage5DebugPhones',
  pendingRepairs: 'apiStage5ListPendingRepairs',
  operationDetails: 'apiStage5GetOperationDetails',
  runRepair: 'apiStage5RunRepair',
  lifecycleRetentionCleanup: 'apiStage5RunLifecycleRetentionCleanup'
});

const PROJECT_STAGE5_CLIENT_ROUTING_POLICY_ = Object.freeze({
  sidebar: Object.freeze({
    getMonthsList: 'apiStage4GetMonthsList',
    getSidebarData: 'apiStage4GetSidebarData',
    getSendPanelData: 'apiStage4GetSendPanelData',
    generatePanel: 'apiGenerateSendPanelForDate',
    daySummary: 'apiBuildDaySummary',
    detailedDay: 'apiBuildDetailedSummary',
    openPersonCard: 'apiOpenPersonCard',
    vacationReminder: 'apiCheckVacationsAndBirthdays',
    birthdayCheck: 'apiCheckVacationsAndBirthdays',
    switchMonth: 'apiStage4SwitchBotToMonth',
    createNextMonth: 'apiCreateNextMonthStage4',
    markPanelRowsAsSent: 'apiMarkPanelRowsAsSent',
    markSendPanelRowsAsSent: 'apiMarkPanelRowsAsSent',
    markPanelRowsAsUnsent: 'apiMarkPanelRowsAsUnsent',
    sendUnsent: 'apiSendPendingRows',
    runReconciliation: 'apiRunReconciliation'
  }),
  spreadsheet: Object.freeze({
    previewSelectionMessage: 'apiPreviewSelectionMessage',
    previewMultipleMessages: 'apiPreviewMultipleMessages',
    previewGroupedMessages: 'apiPreviewGroupedMessages',
    prepareRangeMessages: 'apiPrepareRangeMessages',
    buildCommanderSummaryPreview: 'apiBuildCommanderSummaryPreview',
    buildCommanderSummaryLink: 'apiBuildCommanderSummaryLink',
    logPreparedMessages: 'apiLogPreparedMessages',
    runSelectionDiagnostics: 'apiRunSelectionDiagnostics'
  }),
  maintenance: Object.freeze({
    clearCache: 'apiStage5ClearCache',
    clearLog: 'apiStage5ClearLog',
    clearPhoneCache: 'apiStage5ClearPhoneCache',
    restartBot: 'apiStage5RestartBot',
    setupTrigger: 'apiStage5SetupVacationTriggers',
    cleanupTriggers: 'apiStage5CleanupDuplicateTriggers',
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
    pendingRepairs: 'apiStage5ListPendingRepairs',
    operationDetails: 'apiStage5GetOperationDetails',
    runRepair: 'apiStage5RunRepair',
    lifecycleRetentionCleanup: 'apiStage5RunLifecycleRetentionCleanup'
  })
});

const PROJECT_MAINTENANCE_POLICY_ = Object.freeze({
  policy: 'canonical-stage5-maintenance-with-stage4-compat-facade',
  canonicalMaintenanceApi: 'Stage5MaintenanceApi.gs',
  compatibilityFacade: 'Stage4MaintenanceApi.gs',
  diagnosticsEntrypoint: 'apiRunStage5Diagnostics',
  healthEntrypoint: 'apiStage5HealthCheck'
});

const PROJECT_HARDENING_OVERLAY_ = Object.freeze({
  label: 'Stage 6A hardening evolved into Stage 7 lifecycle baseline',
  lineage: 'stage6a-to-stage7-lifecycle-overlay'
});

const PROJECT_CLIENT_RUNTIME_POLICY_ = Object.freeze({
  runtimeFile: 'JavaScript.html',
  bootstrapTemplate: 'Sidebar.html',
  bootstrapMode: 'sidebar-includeTemplate',
  runtimeStatus: 'canonical-modular-runtime',
  modularStatus: 'active-js-include-chain',
  policyMarker: 'stage7-sidebar-runtime',
  activeRuntimeChain: Object.freeze([
    'Js.Core.html',
    'Js.State.html',
    'Js.Api.html',
    'Js.Render.html',
    'Js.Diagnostics.html',
    'Js.Helpers.html',
    'Js.Events.html',
    'Js.Actions.html'
  ])
});

const PROJECT_BUNDLE_FILE_INDEX_ = Object.freeze([
  ".clasp.json.example",
  "ARCHITECTURE.md",
  "AUDIT_REPORT_2026-03-24.md",
  "Actions.gs",
  "AuditTrail.gs",
  "COMMANDS_TERMINAL.md",
  "Code.gs",
  "DataAccess.gs",
  "DateUtils.gs",
  "DeprecatedRegistry.gs",
  "Diagnostics.gs",
  "DialogPresenter.gs",
  "DialogTemplates.gs",
  "Dialogs.gs",
  "DictionaryRepository.gs",
  "DomainTests.gs",
  "FILES_TO_CREATE_IN_GAS_WEB_EDITOR.txt",
  "GAS_WEB_EDITOR_IMPORT_GUIDE.md",
  "HtmlUtils.gs",
  "IMPLEMENTATION_REPORT_2026-03-22.md",
  "JavaScript.html",
  "JobRuntime.gs",
  "JobRuntimeRepository.gs",
  "Js.Actions.html",
  "Js.Api.html",
  "Js.Core.html",
  "Js.Diagnostics.html",
  "Js.Events.html",
  "Js.Helpers.html",
  "Js.Render.html",
  "Js.State.html",
  "Log.gs",
  "LogsRepository.gs",
  "MonthSheets.gs",
  "OperationRepository.gs",
  "OperationSafety.gs",
  "PersonCalendar.html",
  "PersonCards.gs",
  "PersonsRepository.gs",
  "PreviewLinkService.gs",
  "ProjectMetadata.gs",
  "README.md",
  "RUNBOOK.md",
  "Reconciliation.gs",
  "RoutingRegistry.gs",
  "STABILIZATION_NOTES_2026-03-22.md",
  "STAGE7_REPORT.md",
  "SelectionActionService.gs",
  "SendPanel.gs",
  "SendPanelConstants.gs",
  "SendPanelRepository.gs",
  "SendPanelService.gs",
  "ServerResponse.gs",
  "SheetSchemas.gs",
  "SheetStandards.gs",
  "Sidebar.html",
  "SidebarServer.gs",
  "SmokeTests.gs",
  "SpreadsheetActionsApi.gs",
  "Stage3ServerApi.gs",
  "Stage4Config.gs",
  "Stage4MaintenanceApi.gs",
  "Stage4ServerApi.gs",
  "Stage5MaintenanceApi.gs",
  "Styles.html",
  "Summaries.gs",
  "SummaryRepository.gs",
  "SummaryService.gs",
  "TemplateRegistry.gs",
  "TemplateResolver.gs",
  "Templates.gs",
  "Triggers.gs",
  "UseCases.gs",
  "Utils.gs",
  "VacationEngine.gs",
  "VacationService.gs",
  "VacationsRepository.gs",
  "Validation.gs",
  "WorkflowOrchestrator.gs",
  "appsscript.json",
  "docs/archive/CHANGELOG_STAGE4.md",
  "docs/archive/PUBLIC_API_STAGE4.md",
  "docs/archive/STAGE4_REPORT.md",
  "docs/archive/STAGE6A_TRANSITION_NOTES.md",
  "docs/reference/CHANGELOG_STAGE5.md",
  "docs/reference/JOBS_RUNTIME.md",
  "docs/reference/PUBLIC_API_STAGE5.md",
  "docs/reference/SPREADSHEET_ACTION_API.md",
  "docs/reference/STAGE5_REPORT.md",
  "docs/reference/STAGE6A_REPORT.md",
  "docs/reference/SUNSET_POLICY.md",
]);

const PROJECT_BUNDLE_METADATA_ = Object.freeze({
  stage: PROJECT_RELEASE_NAMING_.stage,
  stageLabel: PROJECT_RELEASE_NAMING_.stageLabel,
  stageVersion: PROJECT_RELEASE_NAMING_.stageVersion,
  activeBaseline: PROJECT_RELEASE_NAMING_.activeBaseline,
  release: PROJECT_RELEASE_NAMING_,
  canonicalLayers: PROJECT_CANONICAL_LAYERS_,
  gasFirst: true,
  packagingPolicy: Object.freeze({
    policy: 'root-manifest-with-root-clasp-example',
    manifestFile: 'appsscript.json',
    claspConfigFile: '.clasp.json',
    claspExampleFile: '.clasp.json.example',
    manifestPath: 'appsscript.json',
    claspExamplePath: '.clasp.json.example',
    localWorkflowOptional: true,
    notes: ['The release zip must not include .git or node_modules.', 'This web-ready repack omits local PowerShell and Node tooling.', '.clasp.json.example is kept only as an optional future sync example.']
  }),
  maintenanceLayerStatus: 'stage5-canonical-maintenance-api',
  maintenanceLayerPolicy: PROJECT_MAINTENANCE_POLICY_,
  clientRuntimePolicy: PROJECT_CLIENT_RUNTIME_POLICY_,
  hardeningOverlay: PROJECT_HARDENING_OVERLAY_,
  requiredDocs: Object.freeze([
    'README.md',
    'ARCHITECTURE.md',
  'AUDIT_REPORT_2026-03-24.md',
    'RUNBOOK.md',
    'STAGE7_REPORT.md',
    'docs/reference/PUBLIC_API_STAGE5.md',
    'docs/reference/CHANGELOG_STAGE5.md',
    'docs/reference/STAGE5_REPORT.md',
    'docs/reference/STAGE6A_REPORT.md'
  ]),
  notes: Object.freeze([
    'Metadata is aligned to the active Stage 7.1 release identity.',
    'Historical Stage 4 compatibility remains intentionally preserved.',
    'Stage 5 maintenance naming remains canonical in the active release.'
  ])
});

function getProjectReleaseNaming_() {
  return _projectMetaDeepCopy_(PROJECT_RELEASE_NAMING_);
}

function getProjectBundleMetadata_() {
  return _projectMetaDeepCopy_(PROJECT_BUNDLE_METADATA_);
}

function getProjectDocumentationMap_() {
  return _projectMetaDeepCopy_(PROJECT_DOCUMENTATION_MAP_);
}

function getStage5MaintenancePolicy_() {
  return _projectMetaDeepCopy_(PROJECT_MAINTENANCE_POLICY_);
}

function getStage4CanonicalApiMap_() {
  return _projectMetaDeepCopy_(PROJECT_STAGE4_CANONICAL_API_MAP_);
}

function getStage5PublicApiMap_() {
  return _projectMetaDeepCopy_(PROJECT_STAGE5_PUBLIC_API_MAP_);
}

function getStage4ClientRoutingPolicy_() {
  return _projectMetaDeepCopy_(PROJECT_STAGE4_CLIENT_ROUTING_POLICY_);
}

function getStage5ClientRoutingPolicy_() {
  return _projectMetaDeepCopy_(PROJECT_STAGE5_CLIENT_ROUTING_POLICY_);
}

function getStage5CanonicalLayerMap_() {
  return _projectMetaDeepCopy_(PROJECT_CANONICAL_LAYERS_);
}

function isProjectBundleFilePresent_(path) {
  const target = String(path || '').trim();
  if (!target) return false;
  return PROJECT_BUNDLE_FILE_INDEX_.indexOf(target) !== -1;
}

function getMissingProjectBundleFiles_(paths) {
  return (paths || []).filter(function(path) {
    return !isProjectBundleFilePresent_(path);
  });
}

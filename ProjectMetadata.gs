/**
 * ProjectMetadata.gs — truthful release metadata for the active Stage 7.1.2 baseline.
 */

function _projectMetaDeepCopy_(value) {
  return JSON.parse(JSON.stringify(value));
}

const PROJECT_RELEASE_NAMING_ = Object.freeze({
  stage: '7.1',
  stageLabel: 'Stage 7.1.2 — Security & Ops Hardened Baseline',
  stageVersion: '7.1.2-security-ops-hardened',
  activeBaseline: 'stage7-1-2-security-ops-hardened-baseline',
  archiveBaseName: 'gas_wasb_stage7_1_2_security_ops_hardened',
  archiveFileName: 'gas_wasb_stage7_1_2_security_ops_hardened.zip',
  rootFolderName: 'gas_wasb_stage7_1_2_security_ops_hardened'
});

const PROJECT_DOCUMENTATION_MAP_ = Object.freeze({
  active: Object.freeze({
    readme: '_extras/README.md',
    architecture: '_extras/ARCHITECTURE.md',
    runbook: '_extras/RUNBOOK.md',
    releaseReport: '_extras/CHANGELOG.md'
  }),
  reference: Object.freeze([
    '_extras/history/CANONICAL_APIS_STAGE7_FINAL_STABILIZED.md',
    '_extras/history/CHANGELOG_STAGE7_FINAL_STABILIZED.md',
    '_extras/history/COMPATIBILITY_ALIASES_STAGE7_FINAL_STABILIZED.md',
    '_extras/history/FINAL_STABILIZATION_REPORT_2026-03-26.md',
    '_extras/history/SCHEMA.md',
    '_extras/history/SEND_PANEL_TZ_IMPLEMENTATION_2026-03-26.md',
    '_extras/history/ACCESS_VIEWER_RESTRICTIONS_2026-03-29.md'
  ]),
  historical: Object.freeze([
    '_extras/history/IMPLEMENTATION_REPORT_2026-03-22.md',
    '_extras/history/STABILIZATION_NOTES_2026-03-22.md',
    '_extras/history/AUDIT_REPORT_2026-03-24.md',
    '_extras/history/COMPARISON_AND_MERGE_REPORT_2026-03-26.md',
    '_extras/history/RELEASE_NAMING_HOTFIX_2026-03-26.md',
    '_extras/history/RESOLVER_HOTFIX_2026-03-26.md',
    '_extras/history/STABILIZATION_CHECK_REPORT_STAGE7_FINAL.md',
    '_extras/history/TZ_EXECUTION_REPORT_2026-03-28.md'
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
    'apiStage5RunLifecycleRetentionCleanup',
    'apiStage5GetAccessDescriptor',
    'apiStage5ApplyProtections',
    'apiStage5BootstrapRuntimeAndAlertsSheets',
    'apiStage5BootstrapAccessSheet'
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
    lifecycleRetentionCleanup: 'apiStage5RunLifecycleRetentionCleanup',
    getAccessDescriptor: 'apiStage5GetAccessDescriptor',
    applyProtections: 'apiStage5ApplyProtections',
    bootstrapAccessSheet: 'apiStage5BootstrapAccessSheet',
    bootstrapRuntimeAndAlertsSheets: 'apiStage5BootstrapRuntimeAndAlertsSheets'
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
  "AccessControl.gs",
  "AccessE2ETests.gs",
  "AccessEnforcement.gs",
  "AccessSheetTriggers.gs",
  "Actions.gs",
  "AlertsRepository.gs",
  "AuditTrail.gs",
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
  "HtmlUtils.gs",
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
  "LifecycleRetention.gs",
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
  "Reconciliation.gs",
  "RoutingRegistry.gs",
  "SecurityRedaction.gs",
  "SelectionActionService.gs",
  "SendPanel.gs",
  "SendPanelConstants.gs",
  "SendPanelRepository.gs",
  "SendPanelService.gs",
  "ServerResponse.gs",
  "ServiceSheetsBootstrap.gs",
  "SheetSchemas.gs",
  "SheetStandards.gs",
  "Sidebar.html",
  "SidebarServer.gs",
  "SmokeTests.gs",
  "SpreadsheetActionsApi.gs",
  "SpreadsheetProtection.gs",
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
  "_extras/ARCHITECTURE.md",
  "_extras/CHANGELOG.md",
  "_extras/README.md",
  "_extras/RUNBOOK.md",
  "_extras/SECURITY.md",
  "_extras/history/ACCESS_VIEWER_RESTRICTIONS_2026-03-29.md",
  "_extras/history/AUDIT_REPORT_2026-03-24.md",
  "_extras/history/CANONICAL_APIS_STAGE7_FINAL_STABILIZED.md",
  "_extras/history/CHANGELOG_STAGE7_FINAL_STABILIZED.md",
  "_extras/history/COMMANDS_TERMINAL.md",
  "_extras/history/COMPARISON_AND_MERGE_REPORT_2026-03-26.md",
  "_extras/history/COMPATIBILITY_ALIASES_STAGE7_FINAL_STABILIZED.md",
  "_extras/history/FILES_TO_CREATE_IN_GAS_WEB_EDITOR.txt",
  "_extras/history/FINAL_DELIVERY_REPORT_2026-03-29.md",
  "_extras/history/FINAL_STABILIZATION_REPORT_2026-03-26.md",
  "_extras/history/GAS_WEB_EDITOR_IMPORT_GUIDE.md",
  "_extras/history/IMPLEMENTATION_REPORT_2026-03-22.md",
  "_extras/history/RELEASE_NAMING_HOTFIX_2026-03-26.md",
  "_extras/history/RESOLVER_HOTFIX_2026-03-26.md",
  "_extras/history/SCHEMA.md",
  "_extras/history/SEND_PANEL_TZ_IMPLEMENTATION_2026-03-26.md",
  "_extras/history/STABILIZATION_CHECK_REPORT_STAGE7_FINAL.md",
  "_extras/history/STABILIZATION_NOTES_2026-03-22.md",
  "_extras/history/STAGE7_REPORT.md",
  "_extras/history/TZ_EXECUTION_REPORT_2026-03-28.md",
  "_extras/tools/package.json",
  "_extras/tools/static-checks.js",
  "_extras/tools/validate-gs-syntax.js",
  "appsscript.json",
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
    policy: 'root-manifest-web-editor-only',
    manifestFile: 'appsscript.json',
    claspConfigFile: '',
    claspExampleFile: '',
    manifestPath: 'appsscript.json',
    claspExamplePath: '',
    localWorkflowOptional: true,
    notes: ['The release zip must not include .git or node_modules.', 'Non-runtime documentation and import helpers live under _extras/.', 'No .clasp files are required or shipped for the web-editor workflow.']
  }),
  maintenanceLayerStatus: 'stage5-canonical-maintenance-api',
  manifestIncluded: true,
  documentation: PROJECT_DOCUMENTATION_MAP_,
  diagnosticsPolicy: Object.freeze({ wording: 'stage7-1-2-security-ops-hardened-baseline' }),
  maintenanceLayerPolicy: PROJECT_MAINTENANCE_POLICY_,
  clientRuntimePolicy: PROJECT_CLIENT_RUNTIME_POLICY_,
  hardeningOverlay: PROJECT_HARDENING_OVERLAY_,
  requiredDocs: Object.freeze([
    '_extras/README.md',
    '_extras/ARCHITECTURE.md',
    '_extras/RUNBOOK.md',
    '_extras/SECURITY.md',
    '_extras/CHANGELOG.md'
  ]),
  notes: Object.freeze([
    'Metadata is aligned to the active Stage 7.1.2 release identity.',
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

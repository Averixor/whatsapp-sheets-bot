/**
 * ProjectMetadata.gs — truthful release metadata for the active Stage 7.1.2 baseline.
 */

function _projectMetaDeepCopy_(value) {
  return JSON.parse(JSON.stringify(value));
}

const PROJECT_RELEASE_NAMING_ = Object.freeze({
  stage: '7.1',
  stageLabel: 'Stage 7.1.2 — Security & Ops Hardened Baseline (Final Clean)',
  stageVersion: '7.1.2-final-clean',
  activeBaseline: 'stage7-1-2-final-clean-baseline',
  archiveBaseName: 'gas_wasb_stage7_1_2_final_clean',
  archiveFileName: 'gas_wasb_stage7_1_2_final_clean.zip',
  rootFolderName: 'gas_wasb_stage7_1_2_final_clean'
});

const PROJECT_DOCUMENTATION_MAP_ = Object.freeze({
  active: Object.freeze({
    readme: 'README.md',
    architecture: 'ARCHITECTURE.md',
    runbook: 'RUNBOOK.md',
    security: 'SECURITY.md',
    changelog: 'CHANGELOG.md'
  }),
  
  historical: Object.freeze([
    '_extras/history/README.md',
    '_extras/history/ACCESS_VIEWER_RESTRICTIONS_2026-03-29.md',
    '_extras/history/AUDIT_REPORT_2026-03-24.md',
    '_extras/history/CANONICALIZATION_AUDIT_2026-03-29.md',
    '_extras/history/CANONICAL_APIS_STAGE7_FINAL_STABILIZED.md',
    '_extras/history/CHANGELOG_STAGE7_FINAL_STABILIZED.md',
    '_extras/history/COMMANDS_TERMINAL.md',
    '_extras/history/COMPARISON_AND_MERGE_REPORT_2026-03-26.md',
    '_extras/history/COMPATIBILITY_ALIASES_STAGE7_FINAL_STABILIZED.md',
    '_extras/history/FILES_TO_CREATE_IN_GAS_WEB_EDITOR.txt',
    '_extras/history/FINAL_DELIVERY_REPORT_2026-03-29.md',
    '_extras/history/FINAL_STABILIZATION_REPORT_2026-03-26.md',
    '_extras/history/GAS_WEB_EDITOR_IMPORT_GUIDE.md',
    '_extras/history/IMPLEMENTATION_REPORT_2026-03-22.md',
    '_extras/history/PATCH_NOTES_ACCESS_LOGIN_BY_CALLSIGN_2026-04-05.txt',
    '_extras/history/PATCH_NOTES_LOGIN_IDENTIFIER_CALLSIGN_2026-04-05.txt',
    '_extras/history/PATCH_NOTES_LOGIN_IDENTIFIER_CALLSIGN_GPS_LOADING_2026-04-05.txt',
    '_extras/history/RELEASE_NAMING_HOTFIX_2026-03-26.md',
    '_extras/history/RESOLVER_HOTFIX_2026-03-26.md',
    '_extras/history/SCHEMA.md',
    '_extras/history/SELF_CONTAINMENT_AUDIT_2026-03-29.md',
    '_extras/history/SELF_CONTAINMENT_VERIFICATION_REPORT_2026-03-29.md',
    '_extras/history/SEND_PANEL_TZ_IMPLEMENTATION_2026-03-26.md',
    '_extras/history/STABILIZATION_CHECK_REPORT_STAGE7_FINAL.md',
    '_extras/history/STABILIZATION_NOTES_2026-03-22.md',
    '_extras/history/STAGE7_REPORT.md',
    '_extras/history/TZ_EXECUTION_REPORT_2026-03-28.md'
  ])
});

const PROJECT_CANONICAL_LAYERS_ = Object.freeze({
  applicationApi: 'Stage7ServerApi.gs',
  sidebarApplicationApi: 'Stage7ServerApi.gs',
  spreadsheetActionApi: 'SpreadsheetActionsApi.gs',
  maintenanceApi: 'Stage7MaintenanceApi.gs',
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

const PROJECT_STAGE7_CANONICAL_API_MAP_ = Object.freeze({
  application: Object.freeze([
    'apiStage7GetMonthsList',
    'apiStage7GetSidebarData',
    'apiGenerateSendPanelForDate',
    'apiGenerateSendPanelForRange',
    'apiStage7GetSendPanelData',
    'apiMarkPanelRowsAsSent',
    'apiMarkPanelRowsAsUnsent',
    'apiSendPendingRows',
    'apiBuildDaySummary',
    'apiBuildDetailedSummary',
    'apiOpenPersonCard',
    'apiCheckVacationsAndBirthdays',
    'apiStage7SwitchBotToMonth',
    'apiStage7CreateNextMonth',
    'apiRunReconciliation'
  ]),

  maintenance: Object.freeze([
    'apiStage7ClearCache',
    'apiStage7ClearLog',
    'apiStage7ClearPhoneCache',
    'apiStage7RestartBot',
    'apiStage7SetupVacationTriggers',
    'apiStage7CleanupDuplicateTriggers',
    'apiStage7DebugPhones',
    'apiStage7BuildBirthdayLink',
    'apiRunStage7MaintenanceScenario',
    'apiInstallStage7Jobs',
    'apiListStage7Jobs',
    'apiRunStage7Job',
    'apiStage7HealthCheck',
    'apiRunStage7Diagnostics',
    'apiRunStage7RegressionTests',
    'apiRunStage7AllProjectTests',
    'apiListStage7JobRuntime',
    'apiStage7ListPendingRepairs',
    'apiStage7GetOperationDetails',
    'apiStage7RunRepair',
    'apiStage7RunLifecycleRetentionCleanup',
    'apiStage7GetAccessDescriptor',
    'apiStage7ApplyProtections',
    'apiStage7BootstrapRuntimeAndAlertsSheets',
    'apiStage7BootstrapAccessSheet'
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

const PROJECT_STAGE7_PUBLIC_API_MAP_ = Object.freeze({
  application: PROJECT_STAGE7_CANONICAL_API_MAP_.application,
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
  maintenance: PROJECT_STAGE7_CANONICAL_API_MAP_.maintenance,
  compatibility: PROJECT_STAGE7_CANONICAL_API_MAP_.compatibility
});

const PROJECT_STAGE7_CLIENT_ROUTING_POLICY_ = Object.freeze({
  getMonthsList: 'apiStage7GetMonthsList',
  getSidebarData: 'apiStage7GetSidebarData',
  getSendPanelData: 'apiStage7GetSendPanelData',
  generatePanel: 'apiGenerateSendPanelForDate',
  daySummary: 'apiBuildDaySummary',
  detailedDay: 'apiBuildDetailedSummary',
  openPersonCard: 'apiOpenPersonCard',
  vacationReminder: 'apiCheckVacationsAndBirthdays',
  birthdayCheck: 'apiCheckVacationsAndBirthdays',
  switchMonth: 'apiStage7SwitchBotToMonth',
  createNextMonth: 'apiStage7CreateNextMonth',
  markPanelRowsAsSent: 'apiMarkPanelRowsAsSent',
  markSendPanelRowsAsSent: 'apiMarkPanelRowsAsSent',
  markPanelRowsAsUnsent: 'apiMarkPanelRowsAsUnsent',
  sendUnsent: 'apiSendPendingRows',
  runReconciliation: 'apiRunReconciliation',
  healthCheck: 'apiStage7HealthCheck',
  clearCache: 'apiStage7ClearCache',
  clearLog: 'apiStage7ClearLog',
  clearPhoneCache: 'apiStage7ClearPhoneCache',
  restartBot: 'apiStage7RestartBot',
  setupTrigger: 'apiStage7SetupVacationTriggers',
  cleanupTriggers: 'apiStage7CleanupDuplicateTriggers',
  debugPhones: 'apiStage7DebugPhones',
  pendingRepairs: 'apiStage7ListPendingRepairs',
  operationDetails: 'apiStage7GetOperationDetails',
  runRepair: 'apiStage7RunRepair',
  lifecycleRetentionCleanup: 'apiStage7RunLifecycleRetentionCleanup'
});

const PROJECT_STAGE7_CLIENT_ROUTING_GROUPS_ = Object.freeze({
  sidebar: Object.freeze({
    getMonthsList: 'apiStage7GetMonthsList',
    getSidebarData: 'apiStage7GetSidebarData',
    getSendPanelData: 'apiStage7GetSendPanelData',
    generatePanel: 'apiGenerateSendPanelForDate',
    daySummary: 'apiBuildDaySummary',
    detailedDay: 'apiBuildDetailedSummary',
    openPersonCard: 'apiOpenPersonCard',
    vacationReminder: 'apiCheckVacationsAndBirthdays',
    birthdayCheck: 'apiCheckVacationsAndBirthdays',
    switchMonth: 'apiStage7SwitchBotToMonth',
    createNextMonth: 'apiStage7CreateNextMonth',
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
    clearCache: 'apiStage7ClearCache',
    clearLog: 'apiStage7ClearLog',
    clearPhoneCache: 'apiStage7ClearPhoneCache',
    restartBot: 'apiStage7RestartBot',
    setupTrigger: 'apiStage7SetupVacationTriggers',
    cleanupTriggers: 'apiStage7CleanupDuplicateTriggers',
    debugPhones: 'apiStage7DebugPhones',
    buildBirthdayLink: 'apiStage7BuildBirthdayLink',
    runMaintenanceScenario: 'apiRunStage7MaintenanceScenario',
    installJobs: 'apiInstallStage7Jobs',
    listJobs: 'apiListStage7Jobs',
    runJob: 'apiRunStage7Job',
    healthCheck: 'apiStage7HealthCheck',
    runDiagnostics: 'apiRunStage7Diagnostics',
    runRegressionTests: 'apiRunStage7RegressionTests',
    runAllProjectTests: 'apiRunStage7AllProjectTests',
    listJobRuntime: 'apiListStage7JobRuntime',
    pendingRepairs: 'apiStage7ListPendingRepairs',
    operationDetails: 'apiStage7GetOperationDetails',
    runRepair: 'apiStage7RunRepair',
    lifecycleRetentionCleanup: 'apiStage7RunLifecycleRetentionCleanup',
    getAccessDescriptor: 'apiStage7GetAccessDescriptor',
    applyProtections: 'apiStage7ApplyProtections',
    bootstrapAccessSheet: 'apiStage7BootstrapAccessSheet',
    bootstrapRuntimeAndAlertsSheets: 'apiStage7BootstrapRuntimeAndAlertsSheets'
  })
});

const PROJECT_MAINTENANCE_POLICY_ = Object.freeze({
  policy: 'canonical-stage7-maintenance-with-stage7-compat-facade',
  canonicalFile: 'Stage7MaintenanceApi.gs',
  compatibilityFile: 'LegacyMaintenanceAliases.gs',
  canonicalMaintenanceApi: 'Stage7MaintenanceApi.gs',
  compatibilityFacade: 'LegacyMaintenanceAliases.gs',
  diagnosticsEntrypoint: 'apiRunStage7Diagnostics',
  healthEntrypoint: 'apiStage7HealthCheck'
});

const PROJECT_HARDENING_OVERLAY_ = Object.freeze({
  label: 'Stage 7A hardening evolved into Stage 7 lifecycle baseline',
  lineage: 'stage7a-to-stage7-lifecycle-overlay'
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
    'Js.Security.html',
    'Js.Events.html',
    'Js.Actions.html'
  ])
});

const PROJECT_BUNDLE_FILE_INDEX_ = Object.freeze([
  "ARCHITECTURE.md",
  "AccessControl.gs",
  "AccessE2ETests.gs",
  "AccessEnforcement.gs",
  "AccessSheetTriggers.gs",
  "AlertsRepository.gs",
  "AuditTrail.gs",
  "CHANGELOG.md",
  "Code.gs",
  "DataAccess.gs",
  "DateUtils.gs",
  "DeprecatedRegistry.gs",
  "Diagnostics.gs",
  "DialogPresenter.gs",
  "DialogTemplates.gs",
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
  "Js.Security.html",
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
  "README.md",
  "RUNBOOK.md",
  "Reconciliation.gs",
  "RoutingRegistry.gs",
  "SECURITY.md",
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
  "Stage7Config.gs",
  "Stage7MaintenanceApi.gs",
  "Stage7ServerApi.gs",
  "Stage7MaintenanceApi.gs",
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
  "AccessPolicyChecks.gs",
  "Actions.gs",
  "Dialogs.gs",
  "SendPanelFastPaths.gs",
  "LegacyApiAliases.gs",
  "LegacyMaintenanceAliases.gs",
  "_extras/README.md",
  "_extras/backups/AccessControl.gs.bak",
  "_extras/history/CANONICALIZATION_AUDIT_2026-03-29.md",
  "_extras/history/PATCH_NOTES_ACCESS_LOGIN_BY_CALLSIGN_2026-04-05.txt",
  "_extras/history/PATCH_NOTES_LOGIN_IDENTIFIER_CALLSIGN_2026-04-05.txt",
  "_extras/history/PATCH_NOTES_LOGIN_IDENTIFIER_CALLSIGN_GPS_LOADING_2026-04-05.txt",
  "_extras/history/README.md",
  "_extras/history/SELF_CONTAINMENT_AUDIT_2026-03-29.md",
  "_extras/history/SELF_CONTAINMENT_VERIFICATION_REPORT_2026-03-29.md",
  "_extras/package.json",
  "_extras/static-checks.js",
  "_extras/validate-gs-syntax.js",
  "appsscript.json"
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

  maintenanceLayerStatus: 'stage7-canonical-maintenance-api',
  compatibilityPolicyMarker: 'stage7-compatible',
  sunsetPolicyMarker: 'stage7-sunset-governed',
  manifestIncluded: true,
  documentation: PROJECT_DOCUMENTATION_MAP_,
  diagnosticsPolicy: Object.freeze({ wording: 'stage7-1-2-final-clean-baseline' }),
  maintenanceLayerPolicy: PROJECT_MAINTENANCE_POLICY_,
  clientRuntimePolicy: PROJECT_CLIENT_RUNTIME_POLICY_,
  hardeningOverlay: PROJECT_HARDENING_OVERLAY_,
  requiredDocs: Object.freeze([
    'README.md',
    'ARCHITECTURE.md',
    'RUNBOOK.md',
    'SECURITY.md',
    'CHANGELOG.md'
  ]),

  notes: Object.freeze([
    'Metadata is aligned to the active Stage 7.1.2 final clean release identity.',
    'Root documentation is reduced to five active markdown files.',
    'Historical notes live only under _extras/history/.'
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

function getMaintenancePolicy_() {
  return _projectMetaDeepCopy_(PROJECT_MAINTENANCE_POLICY_);
}

function getCanonicalApiMap_() {
  return _projectMetaDeepCopy_(PROJECT_STAGE7_CANONICAL_API_MAP_);
}

function getPublicApiMap_() {
  return _projectMetaDeepCopy_(PROJECT_STAGE7_PUBLIC_API_MAP_);
}

function getClientRoutingPolicy_() {
  return _projectMetaDeepCopy_(PROJECT_STAGE7_CLIENT_ROUTING_POLICY_);
}

function getCanonicalLayerMap_() {
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

/**
 * ProjectMetadata.gs — truthful release metadata for the active Stage 7 baseline.
 */

function _projectMetaDeepCopy_(value) {
  return JSON.parse(JSON.stringify(value));
}

const PROJECT_RELEASE_NAMING_ = Object.freeze({
  stage: "7.1",
  stageLabel: "Stage 7 — Maintenance & repository hygiene",
  stageVersion: "7",
  activeBaseline: "stage7-1-5-maintenance-baseline",
  archiveBaseName: "gas_wasb_stage7_1_5_maintenance",
  archiveFileName: "gas_wasb_stage7_1_5_maintenance.zip",
  rootFolderName: "gas_wasb_stage7_1_5_maintenance",
});

const PROJECT_DOCUMENTATION_MAP_ = Object.freeze({
  active: Object.freeze({
    readme: "README.md",
    architecture: "ARCHITECTURE.md",
    runbook: "RUNBOOK.md",
    security: "SECURITY.md",
    changelog: "CHANGELOG.md",
  }),

  historical: Object.freeze([]),
});

const PROJECT_CANONICAL_LAYERS_ = Object.freeze({
  applicationApi: "Stage7ServerApi.gs",
  sidebarApplicationApi: "Stage7ServerApi.gs",
  spreadsheetActionApi: "SpreadsheetActionsApi.gs",
  maintenanceApi: "Stage7MaintenanceApi.gs",
  useCases: "UseCases.gs",
  workflow: "WorkflowOrchestrator.gs",
  compatibility: "SidebarServer.gs",
  compatibilityFacade: "SidebarServer.gs",
  diagnostics: "Diagnostics.Core.gs",
  tests: "SmokeTests.gs",
  metadata: "ProjectMetadata.gs",
  dialogPresentation: "DialogPresenter.gs",
  dialogTemplates: "DialogTemplates.gs",
});

const PROJECT_STAGE7_CANONICAL_API_MAP_ = Object.freeze({
  application: Object.freeze([
    "apiStage7GetAccessDescriptorLite",
    "apiStage7BootstrapSidebar",
    "apiStage7ListPersonnelCallsigns",
    "apiStage7ReportClientAccessSignal",
    "apiStage7GetMonthsList",
    "apiStage7GetSidebarData",
    "apiGenerateSendPanelForDate",
    "apiGenerateSendPanelForRange",
    "apiStage7GetSendPanelData",
    "apiMarkPanelRowsAsSent",
    "apiMarkPanelRowsAsUnsent",
    "apiSendPendingRows",
    "apiBuildDaySummary",
    "apiBuildDetailedSummary",
    "apiOpenPersonCard",
    "apiCheckVacationsAndBirthdays",
    "apiStage7SwitchBotToMonth",
    "apiStage7CreateNextMonth",
    "apiRunReconciliation",
  ]),

  maintenance: Object.freeze([
    "apiStage7ClearCache",
    "apiStage7ClearLog",
    "apiStage7ClearPhoneCache",
    "apiStage7RestartBot",
    "apiStage7SetupVacationTriggers",
    "apiStage7CleanupDuplicateTriggers",
    "apiStage7DebugPhones",
    "apiStage7BuildBirthdayLink",
    "apiRunStage7MaintenanceScenario",
    "apiInstallStage7Jobs",
    "apiListStage7Jobs",
    "apiRunStage7Job",
    "apiStage7HealthCheck",
    "apiRunStage7Diagnostics",
    "apiRunStage7RegressionTests",
    "apiRunStage7AllProjectTests",
    "apiRunStage7ProjectTestChunk",
    "apiListStage7JobRuntime",
    "apiStage7ListPendingRepairs",
    "apiStage7GetOperationDetails",
    "apiStage7RunRepair",
    "apiStage7RunLifecycleRetentionCleanup",
    "apiStage7GetAccessDescriptor",
    "apiStage7DebugAccess",
    "apiStage7ReportAccessViolation",
    "apiStage7ListBindableCallsigns",
    "apiStage7LoginByIdentifierAndCallsign",
    "apiStage7SubmitAccessKeyRequest",
    "apiStage7RegisterAccessWithTemporaryPassword",
    "apiStage7NormalizeAccessSheetFormatting",
    "apiStage7ApplyProtections",
    "apiStage7BootstrapRuntimeAndAlertsSheets",
    "apiStage7BootstrapAccessSheet",
  ]),

  compatibility: Object.freeze([]),
});

const PROJECT_STAGE7_ACCESS_API_ROLE_POLICY_ = Object.freeze({
  apiStage7GetAccessDescriptorLite: Object.freeze({
    guestAllowed: true,
  }),
  apiStage7BootstrapSidebar: Object.freeze({
    guestAllowed: true,
  }),
  apiStage7ReportClientAccessSignal: Object.freeze({
    guestAllowed: true,
  }),
  apiStage7GetAccessDescriptor: Object.freeze({
    guestAllowed: true,
  }),
  apiStage7DebugAccess: Object.freeze({
    guestAllowed: true,
  }),
  apiStage7ListBindableCallsigns: Object.freeze({
    guestAllowed: true,
  }),
  apiStage7LoginByIdentifierAndCallsign: Object.freeze({
    guestAllowed: true,
  }),
  apiStage7SubmitAccessKeyRequest: Object.freeze({
    guestAllowed: true,
  }),
  apiStage7RegisterAccessWithTemporaryPassword: Object.freeze({
    guestAllowed: true,
  }),
  apiStage7ReportAccessViolation: Object.freeze({
    guestAllowed: false,
    minRole: "sysadmin",
  }),
  apiStage7NormalizeAccessSheetFormatting: Object.freeze({
    guestAllowed: false,
    minRole: "admin",
  }),
  apiStage7BootstrapAccessSheet: Object.freeze({
    guestAllowed: false,
    minRole: "admin",
  }),
  apiStage7ApplyProtections: Object.freeze({
    guestAllowed: false,
    minRole: "sysadmin",
  }),
});

const PROJECT_STAGE7_PUBLIC_API_MAP_ = Object.freeze({
  application: PROJECT_STAGE7_CANONICAL_API_MAP_.application,
  spreadsheet: Object.freeze([
    "apiPreviewSelectionMessage",
    "apiPreviewMultipleMessages",
    "apiPreviewGroupedMessages",
    "apiPrepareRangeMessages",
    "apiBuildCommanderSummaryPreview",
    "apiBuildCommanderSummaryLink",
    "apiLogPreparedMessages",
    "apiRunSelectionDiagnostics",
  ]),
  maintenance: PROJECT_STAGE7_CANONICAL_API_MAP_.maintenance,
  compatibility: PROJECT_STAGE7_CANONICAL_API_MAP_.compatibility,
});

const PROJECT_STAGE7_CLIENT_ROUTING_POLICY_ = Object.freeze({
  getMonthsList: "apiStage7GetMonthsList",
  getSidebarData: "apiStage7GetSidebarData",
  getSendPanelData: "apiStage7GetSendPanelData",
  generatePanel: "apiGenerateSendPanelForDate",
  daySummary: "apiBuildDaySummary",
  detailedDay: "apiBuildDetailedSummary",
  openPersonCard: "apiOpenPersonCard",
  vacationReminder: "apiCheckVacationsAndBirthdays",
  birthdayCheck: "apiCheckVacationsAndBirthdays",
  switchMonth: "apiStage7SwitchBotToMonth",
  createNextMonth: "apiStage7CreateNextMonth",
  markPanelRowsAsSent: "apiMarkPanelRowsAsSent",
  markSendPanelRowsAsSent: "apiMarkPanelRowsAsSent",
  markPanelRowsAsUnsent: "apiMarkPanelRowsAsUnsent",
  sendUnsent: "apiSendPendingRows",
  runReconciliation: "apiRunReconciliation",
  healthCheck: "apiStage7HealthCheck",
  clearCache: "apiStage7ClearCache",
  clearLog: "apiStage7ClearLog",
  clearPhoneCache: "apiStage7ClearPhoneCache",
  restartBot: "apiStage7RestartBot",
  setupTrigger: "apiStage7SetupVacationTriggers",
  cleanupTriggers: "apiStage7CleanupDuplicateTriggers",
  debugPhones: "apiStage7DebugPhones",
  pendingRepairs: "apiStage7ListPendingRepairs",
  operationDetails: "apiStage7GetOperationDetails",
  runRepair: "apiStage7RunRepair",
  lifecycleRetentionCleanup: "apiStage7RunLifecycleRetentionCleanup",
});

const PROJECT_STAGE7_CLIENT_ROUTING_GROUPS_ = Object.freeze({
  sidebar: Object.freeze({
    getMonthsList: "apiStage7GetMonthsList",
    getSidebarData: "apiStage7GetSidebarData",
    getSendPanelData: "apiStage7GetSendPanelData",
    generatePanel: "apiGenerateSendPanelForDate",
    daySummary: "apiBuildDaySummary",
    detailedDay: "apiBuildDetailedSummary",
    openPersonCard: "apiOpenPersonCard",
    vacationReminder: "apiCheckVacationsAndBirthdays",
    birthdayCheck: "apiCheckVacationsAndBirthdays",
    switchMonth: "apiStage7SwitchBotToMonth",
    createNextMonth: "apiStage7CreateNextMonth",
    markPanelRowsAsSent: "apiMarkPanelRowsAsSent",
    markSendPanelRowsAsSent: "apiMarkPanelRowsAsSent",
    markPanelRowsAsUnsent: "apiMarkPanelRowsAsUnsent",
    sendUnsent: "apiSendPendingRows",
    runReconciliation: "apiRunReconciliation",
  }),

  spreadsheet: Object.freeze({
    previewSelectionMessage: "apiPreviewSelectionMessage",
    previewMultipleMessages: "apiPreviewMultipleMessages",
    previewGroupedMessages: "apiPreviewGroupedMessages",
    prepareRangeMessages: "apiPrepareRangeMessages",
    buildCommanderSummaryPreview: "apiBuildCommanderSummaryPreview",
    buildCommanderSummaryLink: "apiBuildCommanderSummaryLink",
    logPreparedMessages: "apiLogPreparedMessages",
    runSelectionDiagnostics: "apiRunSelectionDiagnostics",
  }),

  maintenance: Object.freeze({
    clearCache: "apiStage7ClearCache",
    clearLog: "apiStage7ClearLog",
    clearPhoneCache: "apiStage7ClearPhoneCache",
    restartBot: "apiStage7RestartBot",
    setupTrigger: "apiStage7SetupVacationTriggers",
    cleanupTriggers: "apiStage7CleanupDuplicateTriggers",
    debugPhones: "apiStage7DebugPhones",
    buildBirthdayLink: "apiStage7BuildBirthdayLink",
    runMaintenanceScenario: "apiRunStage7MaintenanceScenario",
    installJobs: "apiInstallStage7Jobs",
    listJobs: "apiListStage7Jobs",
    runJob: "apiRunStage7Job",
    healthCheck: "apiStage7HealthCheck",
    runDiagnostics: "apiRunStage7Diagnostics",
    runRegressionTests: "apiRunStage7RegressionTests",
    runAllProjectTests: "apiRunStage7AllProjectTests",
    runProjectTestChunk: "apiRunStage7ProjectTestChunk",
    listJobRuntime: "apiListStage7JobRuntime",
    pendingRepairs: "apiStage7ListPendingRepairs",
    operationDetails: "apiStage7GetOperationDetails",
    runRepair: "apiStage7RunRepair",
    lifecycleRetentionCleanup: "apiStage7RunLifecycleRetentionCleanup",
    getAccessDescriptor: "apiStage7GetAccessDescriptor",
    applyProtections: "apiStage7ApplyProtections",
    bootstrapAccessSheet: "apiStage7BootstrapAccessSheet",
    bootstrapRuntimeAndAlertsSheets: "apiStage7BootstrapRuntimeAndAlertsSheets",
  }),
});

const PROJECT_MAINTENANCE_POLICY_ = Object.freeze({
  policy: "canonical-stage7-maintenance-only",
  canonicalFile: "Stage7MaintenanceApi.gs",
  compatibilityFile: null,
  canonicalMaintenanceApi: "Stage7MaintenanceApi.gs",
  compatibilityFacade: "SidebarServer.gs",
  diagnosticsEntrypoint: "apiRunStage7Diagnostics",
  healthEntrypoint: "apiStage7HealthCheck",
});

const PROJECT_HARDENING_OVERLAY_ = Object.freeze({
  label: "Stage 7A hardening evolved into Stage 7 lifecycle baseline",
  lineage: "stage7a-to-stage7-lifecycle-overlay",
});

const PROJECT_CLIENT_ROUTING_POLICY_ = Object.freeze({
  apiStage7GetMonthsList: Object.freeze({
    client: "Stage7Api.getMonths",
    server: "apiStage7GetMonthsList",
    useCase: "Stage7UseCases_.listMonths",
    status: "canonical",
    uiAllowed: true,
  }),
  apiStage7BootstrapSidebar: Object.freeze({
    client: "Stage7Api.bootstrapSidebar",
    server: "apiStage7BootstrapSidebar",
    useCase: "Stage7UseCases_.bootstrapSidebar",
    status: "canonical",
    uiAllowed: true,
  }),
  apiStage7GetSidebarData: Object.freeze({
    client: "Stage7Api.getSidebarData",
    server: "apiStage7GetSidebarData",
    useCase: "Stage7UseCases_.loadCalendarDay",
    status: "canonical",
    uiAllowed: true,
  }),
  apiStage7GetSendPanelData: Object.freeze({
    client: "Stage7Api.getSendPanelData",
    server: "apiStage7GetSendPanelData",
    useCase: "Stage7UseCases_.getSendPanelData",
    status: "canonical",
    uiAllowed: true,
  }),
  apiGenerateSendPanelForDate: Object.freeze({
    client: "Stage7Api.generatePanelForDate",
    server: "apiGenerateSendPanelForDate",
    useCase: "Stage7UseCases_.generateSendPanelForDate",
    status: "canonical",
    uiAllowed: true,
  }),
  apiGenerateSendPanelForRange: Object.freeze({
    client: "Stage7Api.generatePanelForRange",
    server: "apiGenerateSendPanelForRange",
    useCase: "Stage7UseCases_.generateSendPanelForRange",
    status: "canonical",
    uiAllowed: true,
  }),
  apiMarkPanelRowsAsSent: Object.freeze({
    client: "Stage7Api.markAsSent",
    server: "apiMarkPanelRowsAsSent",
    useCase: "Stage7UseCases_.markPanelRowsAsSent",
    status: "canonical",
    uiAllowed: true,
  }),
  apiMarkPanelRowsAsUnsent: Object.freeze({
    client: "Stage7Api.markAsUnsent",
    server: "apiMarkPanelRowsAsUnsent",
    useCase: "Stage7UseCases_.markPanelRowsAsUnsent",
    status: "canonical",
    uiAllowed: true,
  }),
  apiMarkPanelRowsAsPending: Object.freeze({
    client: "Stage7Api.markAsPending",
    server: "apiMarkPanelRowsAsPending",
    useCase: "Stage7UseCases_.markPanelRowsAsPending",
    status: "canonical",
    uiAllowed: true,
  }),
  apiSendPendingRows: Object.freeze({
    client: "Stage7Api.sendPendingRows",
    server: "apiSendPendingRows",
    useCase: "Stage7UseCases_.sendPendingRows",
    status: "canonical",
    uiAllowed: true,
  }),
  apiBuildDaySummary: Object.freeze({
    client: "Stage7Api.buildDaySummary",
    server: "apiBuildDaySummary",
    useCase: "Stage7UseCases_.buildDaySummary",
    status: "canonical",
    uiAllowed: true,
  }),
  apiBuildDetailedSummary: Object.freeze({
    client: "Stage7Api.buildDetailedSummary",
    server: "apiBuildDetailedSummary",
    useCase: "Stage7UseCases_.buildDetailedSummary",
    status: "canonical",
    uiAllowed: true,
  }),
  apiOpenPersonCard: Object.freeze({
    client: "Stage7Api.openPersonCard",
    server: "apiOpenPersonCard",
    useCase: "Stage7UseCases_.openPersonCard",
    status: "canonical",
    uiAllowed: true,
  }),
  apiCheckVacationsAndBirthdays: Object.freeze({
    client: "Stage7Api.checkVacationsAndBirthdays",
    server: "apiCheckVacationsAndBirthdays",
    useCase: "Stage7UseCases_.checkVacationsAndBirthdays",
    status: "canonical",
    uiAllowed: true,
  }),
  apiStage7SwitchBotToMonth: Object.freeze({
    client: "Stage7Api.switchBotToMonth",
    server: "apiStage7SwitchBotToMonth",
    useCase: "Stage7UseCases_.switchBotToMonth",
    status: "canonical",
    uiAllowed: true,
  }),
  apiStage7CreateNextMonth: Object.freeze({
    client: "Stage7Api.createNextMonth",
    server: "apiStage7CreateNextMonth",
    useCase: "Stage7UseCases_.createNextMonth",
    status: "canonical",
    uiAllowed: true,
  }),
  apiRunReconciliation: Object.freeze({
    client: "Stage7Api.runReconciliation",
    server: "apiRunReconciliation",
    useCase: "Stage7UseCases_.runReconciliation",
    status: "canonical",
    uiAllowed: true,
  }),
});

const PROJECT_CLIENT_RUNTIME_POLICY_ = Object.freeze({
  runtimeFile: "JavaScript.html",
  bootstrapTemplate: "Sidebar.html",
  bootstrapMode: "sidebar-includeTemplate",
  runtimeStatus: "canonical-modular-runtime",
  modularStatus: "active-js-include-chain",
  policyMarker: "stage7-sidebar-runtime",
  activeRuntimeChain: Object.freeze([
    "Js.Core.html",
    "Js.Theme.html",
    "Js.State.html",
    "Js.Api.html",
    "Js.Render.Panel.html",
    "Js.Render.Calendar.html",
    "Js.Render.Results.html",
    "Js.Diagnostics.html",
    "Js.Security.Boot.html",
    "Js.Security.Util.html",
    "Js.Security.Access.html",
    "Js.Security.Debug.html",
    "Js.Security.Login.html",
    "Js.Security.DebugView.html",
    "Js.Security.Policy.html",
    "Js.Security.Guards.html",
    "Js.Security.Forms.html",
    "Js.Security.Exports.html",
    "Js.Helpers.html",
    "Js.Events.html",
    "Js.Actions.html",
  ]),
});

const PROJECT_BUNDLE_FILE_INDEX_ = Object.freeze([
  "ARCHITECTURE.md",
  "AccessControl.AuthResolver.gs",
  "AccessControl.Core.gs",
  "AccessControl.Lockout.gs",
  "AccessControl.Mutations.gs",
  "AccessControl.PublicApi.gs",
  "AccessControl.SheetRepository.gs",
  "AccessE2ETests.gs",
  "AccessEnforcement.gs",
  "AccessPolicyChecks.gs",
  "AccessSheetTriggers.gs",
  "Actions.gs",
  "AlertsRepository.gs",
  "AuditTrail.gs",
  "CHANGELOG.md",
  "Code.gs",
  "DataAccess.gs",
  "DateUtils.gs",
  "DeprecatedRegistry.gs",
  "Diagnostics.BasicChecks.gs",
  "Diagnostics.Core.gs",
  "Diagnostics.Debug.gs",
  "Diagnostics.Health.gs",
  "Diagnostics.Stage7.Baseline.gs",
  "Diagnostics.Stage7.Core.gs",
  "Diagnostics.Stage7.Historical.gs",
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
  "Js.Theme.html",
  "Js.Diagnostics.html",
  "Js.Events.html",
  "Js.Helpers.html",
  "Js.Render.html",
  "Js.Render.Calendar.html",
  "Js.Render.Panel.html",
  "Js.Render.Results.html",
  "Js.Security.Boot.html",
  "Js.Security.Util.html",
  "Js.Security.Access.html",
  "Js.Security.Debug.html",
  "Js.Security.Login.html",
  "Js.Security.DebugView.html",
  "Js.Security.Policy.html",
  "Js.Security.Guards.html",
  "Js.Security.Forms.html",
  "Js.Security.Exports.html",
  "Js.Security.html",
  "Js.State.html",
  "LifecycleRetention.gs",
  "LockHelpers.gs",
  "Log.gs",
  "LogsRepository.gs",
  "MonthSheets.gs",
  "OperationRepository.gs",
  "OperationSafety.gs",
  "PersonCalendar.html",
  "PersonCards.gs",
  "PersonnelRepository.gs",
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
  "SendPanelFastPaths.gs",
  "SendPanelRepository.gs",
  "SendPanelService.gs",
  "ServerResponse.gs",
  "ServiceSheetsBootstrap.gs",
  "SheetSchemas.gs",
  "SheetStandards.gs",
  "Sidebar.html",
  "SidebarServer.gs",
  "SmokeTests.gs",
  "SmokeTests.Helpers.gs",
  "SpreadsheetActionsApi.gs",
  "SpreadsheetProtection.gs",
  "Stage7CompatConfig.gs",
  "Stage7Config.gs",
  "Stage7GlobalDependencyAliases.gs",
  "Stage7MaintenanceApi.gs",
  "Stage7ServerApi.gs",
  "Stage7TestRunner.gs",
  "Stage7TestRunner.Helpers.gs",
  "Stage7TestRunner.Registry.gs",
  "Stage7TestRunner.Reporting.gs",
  "Stage7TestRunner.Sheet.gs",
  "Stage7TestRunner.Ui.gs",
  "Stage7TestRunner.Api.gs",
  "Stage7TestRunner.Access.gs",
  "Stage7TestRunner.Maintenance.gs",
  "Stage7TestRunner.SendPanel.gs",
  "Stage7TestRunner.Summaries.gs",
  "Styles.html",
  "Styles_01_Themes.html",
  "Styles_00_Base.html",
  "Styles_30_Personnel.html",
  "Styles_40_SystemPanels.html",
  "Styles_50_Modals.html",
  "Styles_60_Health.html",
  "Styles_99_Responsive.html",
  "Summaries.gs",
  "SummaryRepository.gs",
  "SummaryService.gs",
  "SystemSheetsSelfHeal.gs",
  "TemplateRegistry.gs",
  "TemplateResolver.gs",
  "Templates.gs",
  "Triggers.gs",
  "UseCaseTracing.gs",
  "UseCases.Calendar.gs",
  "UseCases.Maintenance.gs",
  "UseCases.MonthOps.gs",
  "UseCases.PanelHelpers.gs",
  "UseCases.SendPanel.gs",
  "UseCases.Summaries.gs",
  "UseCases.gs",
  "Utils.gs",
  "VacationEngine.gs",
  "VacationService.gs",
  "VacationsRepository.gs",
  "Validation.gs",
  "WorkflowOrchestrator.gs",
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
    policy: "root-manifest-web-editor-only",
    manifestFile: "appsscript.json",
    claspConfigFile: "",
    claspExampleFile: "",
    manifestPath: "appsscript.json",
    claspExamplePath: "",
    localWorkflowOptional: true,
    notes: [
      "The release zip must not include .git or node_modules.",
      "This archive contains only the root GAS/runtime files and five active markdown documents.",
      "No .clasp files are required or shipped for the web-editor workflow.",
    ],
  }),

  maintenanceLayerStatus: "stage7-canonical-maintenance-api",
  compatibilityPolicyMarker: "stage7-canonical-only",
  sunsetPolicyMarker: "stage7-sunset-governed",
  manifestIncluded: true,
  documentation: PROJECT_DOCUMENTATION_MAP_,
  diagnosticsPolicy: Object.freeze({
    wording: "stage7-1-5-maintenance-baseline",
  }),
  maintenanceLayerPolicy: PROJECT_MAINTENANCE_POLICY_,
  clientRuntimePolicy: PROJECT_CLIENT_RUNTIME_POLICY_,
  clientRoutingPolicy: PROJECT_CLIENT_ROUTING_POLICY_,
  routingPolicy: PROJECT_STAGE7_CLIENT_ROUTING_POLICY_,
  clientRoutingGroups: PROJECT_STAGE7_CLIENT_ROUTING_GROUPS_,
  hardeningOverlay: PROJECT_HARDENING_OVERLAY_,
  requiredDocs: Object.freeze([
    "README.md",
    "ARCHITECTURE.md",
    "RUNBOOK.md",
    "SECURITY.md",
    "CHANGELOG.md",
  ]),

  notes: Object.freeze([
    "Metadata is aligned to the active Stage 7 maintenance release identity.",
    "Root documentation is reduced to five active markdown files.",
    "Historical notes are intentionally not shipped in this compact release archive.",
  ]),
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

function getAccessApiEndpointRolePolicy_() {
  return _projectMetaDeepCopy_(PROJECT_STAGE7_ACCESS_API_ROLE_POLICY_);
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
  const target = String(path || "").trim();
  if (!target) return false;
  return PROJECT_BUNDLE_FILE_INDEX_.indexOf(target) !== -1;
}

function getMissingProjectBundleFiles_(paths) {
  return (paths || []).filter(function (path) {
    return !isProjectBundleFilePresent_(path);
  });
}

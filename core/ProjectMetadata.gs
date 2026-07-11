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
  applicationApi: "api/Stage7ServerApi.gs",
  sidebarApplicationApi: "api/Stage7ServerApi.gs",
  spreadsheetActionApi: "api/SpreadsheetActionsApi.gs",
  maintenanceApi: "api/Stage7MaintenanceApi.gs",
  useCases: "usecases/UseCases.gs",
  workflow: "core/WorkflowOrchestrator.gs",
  compatibility: "ui-server/SidebarServer.gs",
  compatibilityFacade: "ui-server/SidebarServer.gs",
  diagnostics: "Diagnostics.Core.gs",
  tests: "smoke/SmokeTests.gs",
  metadata: "core/ProjectMetadata.gs",
  dialogPresentation: "ui-server/DialogPresenter.gs",
  dialogTemplates: "ui-server/DialogTemplates.gs",
});

const PROJECT_STAGE7_CANONICAL_API_MAP_ = Object.freeze({
  application: Object.freeze([
    "apiStage7GetAccessDescriptorLite",
    "apiStage7BootstrapSidebar",
    "apiGetActiveProjects",
    "apiSubmitRequest",
    "apiStage7ListPersonnelCallsigns",
    "apiStage7ReportClientAccessSignal",
    "apiStage7GetMonthsList",
    "apiStage7GetSidebarData",
    "apiGenerateSendPanelForDate",
    "apiGenerateSendPanelForRange",
    "apiStage7GetSendPanelData",
    "apiStage7GetPhoneDirectory",
    "apiStage7GetCarsRegister",
    "apiStage7GetWeaponsRegister",
    "apiStage7GetInventoryReconciliation",
    "apiStage7SyncInventoryReconciliation",
    "apiStage7SetInventoryReconciliationFolder",
    "apiStage7GetSelectedInventoryReconciliation",
    "apiMarkPanelRowsAsPending",
    "apiMarkPanelRowsAsSent",
    "apiMarkPanelRowsAsSentFast",
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
    "apiStage7MaterializeComputedData",
    "apiStage7MaterializeMonthJournal",
    "apiStage7RestartBot",
    "apiStage7SetupVacationTriggers",
    "apiStage7CleanupDuplicateTriggers",
    "apiStage7DebugPhones",
    "apiStage7BuildBirthdayLink",
    "apiRunStage7MaintenanceScenario",
    "apiInstallStage7Jobs",
    "apiListStage7Jobs",
    "apiRunStage7Job",
    "apiStage7QuickHealthCheck",
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
    "apiStage7LoginByAccessKey",
    "apiStage7SubmitAccessKeyRequest",
    "apiStage7RegisterAccessWithTemporaryPassword",
    "apiStage7NormalizeAccessSheetFormatting",
    "apiStage7ApplyProtections",
    "apiStage7RepairSystemSheets",
    "apiStage7NormalizeAllSheetHeadersToEnglish",
    "apiStage7BootstrapRuntimeAndAlertsSheets",
    "apiStage7BootstrapAccessSheet",
    "apiScanManualFormatRules",
    "apiApplyFormatRulesRegistry",
    "apiExportAdoptedFormatRules",
  ]),

  compatibility: Object.freeze(["apiLoadCalendarDay"]),
});

const PROJECT_STAGE7_ACCESS_API_ROLE_POLICY_ = Object.freeze({
  apiStage7GetAccessDescriptorLite: Object.freeze({
    guestAllowed: true,
  }),
  apiStage7BootstrapSidebar: Object.freeze({
    guestAllowed: true,
  }),
  apiGetActiveProjects: Object.freeze({
    guestAllowed: true,
  }),
  apiSubmitRequest: Object.freeze({
    guestAllowed: false,
    minRole: "viewer",
  }),
  apiStage7ListPersonnelCallsigns: Object.freeze({
    guestAllowed: false,
    minRole: "viewer",
  }),
  apiStage7ReportClientAccessSignal: Object.freeze({
    guestAllowed: true,
  }),
  apiStage7GetMonthsList: Object.freeze({
    guestAllowed: true,
  }),
  apiStage7GetSidebarData: Object.freeze({
    guestAllowed: false,
    minRole: "viewer",
  }),
  apiGenerateSendPanelForDate: Object.freeze({
    guestAllowed: false,
    minRole: "maintainer",
  }),
  apiGenerateSendPanelForRange: Object.freeze({
    guestAllowed: false,
    minRole: "maintainer",
  }),
  apiStage7GetSendPanelData: Object.freeze({
    guestAllowed: false,
    minRole: "maintainer",
  }),
  apiStage7GetPhoneDirectory: Object.freeze({
    guestAllowed: false,
    minRole: "maintainer",
  }),
  apiStage7GetCarsRegister: Object.freeze({
    guestAllowed: false,
    minRole: "maintainer",
  }),
  apiStage7GetWeaponsRegister: Object.freeze({
    guestAllowed: false,
    minRole: "maintainer",
  }),
  apiStage7GetInventoryReconciliation: Object.freeze({
    guestAllowed: false,
    minRole: "maintainer",
  }),
  apiStage7SyncInventoryReconciliation: Object.freeze({
    guestAllowed: false,
    minRole: "maintainer",
  }),
  apiStage7SetInventoryReconciliationFolder: Object.freeze({
    guestAllowed: false,
    minRole: "sysadmin",
  }),
  apiStage7GetSelectedInventoryReconciliation: Object.freeze({
    guestAllowed: false,
    minRole: "maintainer",
  }),
  apiMarkPanelRowsAsPending: Object.freeze({
    guestAllowed: false,
    minRole: "maintainer",
  }),
  apiMarkPanelRowsAsSent: Object.freeze({
    guestAllowed: false,
    minRole: "maintainer",
  }),
  apiMarkPanelRowsAsSentFast: Object.freeze({
    guestAllowed: false,
    minRole: "maintainer",
  }),
  apiMarkPanelRowsAsUnsent: Object.freeze({
    guestAllowed: false,
    minRole: "maintainer",
  }),
  apiSendPendingRows: Object.freeze({
    guestAllowed: false,
    minRole: "maintainer",
  }),
  apiBuildDaySummary: Object.freeze({
    guestAllowed: false,
    minRole: "operator",
  }),
  apiBuildDetailedSummary: Object.freeze({
    guestAllowed: false,
    minRole: "operator",
  }),
  apiOpenPersonCard: Object.freeze({
    guestAllowed: false,
    minRole: "viewer",
    policy: "viewer-own-or-operator",
  }),
  apiCheckVacationsAndBirthdays: Object.freeze({
    guestAllowed: false,
    minRole: "admin",
  }),
  apiStage7SwitchBotToMonth: Object.freeze({
    guestAllowed: false,
    minRole: "maintainer",
  }),
  apiStage7CreateNextMonth: Object.freeze({
    guestAllowed: false,
    minRole: "maintainer",
  }),
  apiRunReconciliation: Object.freeze({
    guestAllowed: false,
    minRole: "maintainer",
  }),
  apiPreviewSelectionMessage: Object.freeze({
    guestAllowed: false,
    minRole: "viewer",
  }),
  apiPreviewMultipleMessages: Object.freeze({
    guestAllowed: false,
    minRole: "viewer",
  }),
  apiPreviewGroupedMessages: Object.freeze({
    guestAllowed: false,
    minRole: "viewer",
  }),
  apiPrepareRangeMessages: Object.freeze({
    guestAllowed: false,
    minRole: "maintainer",
  }),
  apiBuildCommanderSummaryPreview: Object.freeze({
    guestAllowed: false,
    minRole: "operator",
  }),
  apiBuildCommanderSummaryLink: Object.freeze({
    guestAllowed: false,
    minRole: "maintainer",
  }),
  apiLogPreparedMessages: Object.freeze({
    guestAllowed: false,
    minRole: "operator",
    policy: "maintainer-for-range",
  }),
  apiRunSelectionDiagnostics: Object.freeze({
    guestAllowed: false,
    minRole: "maintainer",
  }),
  apiStage7ClearCache: Object.freeze({
    guestAllowed: false,
    minRole: "sysadmin",
  }),
  apiStage7ClearLog: Object.freeze({
    guestAllowed: false,
    minRole: "admin",
  }),
  apiStage7ClearPhoneCache: Object.freeze({
    guestAllowed: false,
    minRole: "sysadmin",
  }),
  apiStage7MaterializeComputedData: Object.freeze({
    guestAllowed: false,
    minRole: "maintainer",
  }),
  apiStage7MaterializeMonthJournal: Object.freeze({
    guestAllowed: false,
    minRole: "maintainer",
  }),
  apiStage7RestartBot: Object.freeze({
    guestAllowed: false,
    minRole: "sysadmin",
  }),
  apiStage7SetupVacationTriggers: Object.freeze({
    guestAllowed: false,
    minRole: "sysadmin",
  }),
  apiStage7CleanupDuplicateTriggers: Object.freeze({
    guestAllowed: false,
    minRole: "sysadmin",
  }),
  apiStage7DebugPhones: Object.freeze({
    guestAllowed: false,
    minRole: "maintainer",
  }),
  apiStage7BuildBirthdayLink: Object.freeze({
    guestAllowed: false,
    minRole: "viewer",
  }),
  apiRunStage7MaintenanceScenario: Object.freeze({
    guestAllowed: false,
    minRole: "admin",
  }),
  apiInstallStage7Jobs: Object.freeze({
    guestAllowed: false,
    minRole: "sysadmin",
  }),
  apiListStage7Jobs: Object.freeze({
    guestAllowed: false,
    minRole: "sysadmin",
  }),
  apiRunStage7Job: Object.freeze({
    guestAllowed: false,
    minRole: "sysadmin",
  }),
  apiStage7QuickHealthCheck: Object.freeze({
    guestAllowed: false,
    minRole: "maintainer",
  }),
  apiStage7HealthCheck: Object.freeze({
    guestAllowed: false,
    minRole: "maintainer",
  }),
  apiRunStage7Diagnostics: Object.freeze({
    guestAllowed: false,
    minRole: "maintainer",
  }),
  apiRunStage7RegressionTests: Object.freeze({
    guestAllowed: false,
    minRole: "admin",
  }),
  apiRunStage7AllProjectTests: Object.freeze({
    guestAllowed: false,
    minRole: "admin",
  }),
  apiRunStage7ProjectTestChunk: Object.freeze({
    guestAllowed: false,
    minRole: "admin",
  }),
  apiListStage7JobRuntime: Object.freeze({
    guestAllowed: false,
    minRole: "admin",
  }),
  apiStage7ListPendingRepairs: Object.freeze({
    guestAllowed: false,
    minRole: "maintainer",
  }),
  apiStage7GetOperationDetails: Object.freeze({
    guestAllowed: false,
    minRole: "maintainer",
  }),
  apiStage7RunRepair: Object.freeze({
    guestAllowed: false,
    minRole: "sysadmin",
  }),
  apiStage7RunLifecycleRetentionCleanup: Object.freeze({
    guestAllowed: false,
    minRole: "sysadmin",
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
  apiStage7LoginByAccessKey: Object.freeze({
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
  apiStage7RepairSystemSheets: Object.freeze({
    guestAllowed: false,
    minRole: "admin",
  }),
  apiStage7NormalizeAllSheetHeadersToEnglish: Object.freeze({
    guestAllowed: false,
    minRole: "sysadmin",
  }),
  apiStage7BootstrapRuntimeAndAlertsSheets: Object.freeze({
    guestAllowed: false,
    minRole: "admin",
  }),
  apiScanManualFormatRules: Object.freeze({
    guestAllowed: false,
    minRole: "maintainer",
  }),
  apiApplyFormatRulesRegistry: Object.freeze({
    guestAllowed: false,
    minRole: "maintainer",
  }),
  apiExportAdoptedFormatRules: Object.freeze({
    guestAllowed: false,
    minRole: "sysadmin",
  }),
  apiLoadCalendarDay: Object.freeze({
    guestAllowed: false,
    minRole: "viewer",
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
  bootstrapSidebar: "apiStage7BootstrapSidebar",
  getMonthsList: "apiStage7GetMonthsList",
  getSidebarData: "apiStage7GetSidebarData",
  getSendPanelData: "apiStage7GetSendPanelData",
  getPhoneDirectory: "apiStage7GetPhoneDirectory",
  getCarsRegister: "apiStage7GetCarsRegister",
  getWeaponsRegister: "apiStage7GetWeaponsRegister",
  getInventoryReconciliation: "apiStage7GetInventoryReconciliation",
  syncInventoryReconciliation: "apiStage7SyncInventoryReconciliation",
  setInventoryReconciliationFolder: "apiStage7SetInventoryReconciliationFolder",
  getSelectedInventoryReconciliation:
    "apiStage7GetSelectedInventoryReconciliation",
  generatePanel: "apiGenerateSendPanelForDate",
  daySummary: "apiBuildDaySummary",
  detailedDay: "apiBuildDetailedSummary",
  openPersonCard: "apiOpenPersonCard",
  vacationReminder: "apiCheckVacationsAndBirthdays",
  birthdayCheck: "apiCheckVacationsAndBirthdays",
  switchMonth: "apiStage7SwitchBotToMonth",
  createNextMonth: "apiStage7CreateNextMonth",
  markPanelRowsAsPending: "apiMarkPanelRowsAsPending",
  markPanelRowsAsSent: "apiMarkPanelRowsAsSent",
  markPanelRowsAsSentFast: "apiMarkPanelRowsAsSentFast",
  markSendPanelRowsAsSent: "apiMarkPanelRowsAsSent",
  markPanelRowsAsUnsent: "apiMarkPanelRowsAsUnsent",
  sendUnsent: "apiSendPendingRows",
  runReconciliation: "apiRunReconciliation",
  healthCheck: "apiStage7HealthCheck",
  clearCache: "apiStage7ClearCache",
  clearLog: "apiStage7ClearLog",
  clearPhoneCache: "apiStage7ClearPhoneCache",
  materializeComputedData: "apiStage7MaterializeComputedData",
  materializeMonthJournal: "apiStage7MaterializeMonthJournal",
  restartBot: "apiStage7RestartBot",
  setupTrigger: "apiStage7SetupVacationTriggers",
  cleanupTriggers: "apiStage7CleanupDuplicateTriggers",
  debugPhones: "apiStage7DebugPhones",
  pendingRepairs: "apiStage7ListPendingRepairs",
  operationDetails: "apiStage7GetOperationDetails",
  runRepair: "apiStage7RunRepair",
  lifecycleRetentionCleanup: "apiStage7RunLifecycleRetentionCleanup",
  quickHealthCheck: "apiStage7QuickHealthCheck",
});

const PROJECT_STAGE7_CLIENT_ROUTING_GROUPS_ = Object.freeze({
  sidebar: Object.freeze({
    bootstrapSidebar: "apiStage7BootstrapSidebar",
    getMonthsList: "apiStage7GetMonthsList",
    getSidebarData: "apiStage7GetSidebarData",
    getSendPanelData: "apiStage7GetSendPanelData",
    getPhoneDirectory: "apiStage7GetPhoneDirectory",
    getCarsRegister: "apiStage7GetCarsRegister",
    getWeaponsRegister: "apiStage7GetWeaponsRegister",
    getInventoryReconciliation: "apiStage7GetInventoryReconciliation",
    syncInventoryReconciliation: "apiStage7SyncInventoryReconciliation",
    setInventoryReconciliationFolder:
      "apiStage7SetInventoryReconciliationFolder",
    getSelectedInventoryReconciliation:
      "apiStage7GetSelectedInventoryReconciliation",
    generatePanel: "apiGenerateSendPanelForDate",
    daySummary: "apiBuildDaySummary",
    detailedDay: "apiBuildDetailedSummary",
    openPersonCard: "apiOpenPersonCard",
    vacationReminder: "apiCheckVacationsAndBirthdays",
    birthdayCheck: "apiCheckVacationsAndBirthdays",
    switchMonth: "apiStage7SwitchBotToMonth",
    createNextMonth: "apiStage7CreateNextMonth",
    markPanelRowsAsPending: "apiMarkPanelRowsAsPending",
    markPanelRowsAsSent: "apiMarkPanelRowsAsSent",
    markPanelRowsAsSentFast: "apiMarkPanelRowsAsSentFast",
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
    materializeComputedData: "apiStage7MaterializeComputedData",
    materializeMonthJournal: "apiStage7MaterializeMonthJournal",
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
    quickHealthCheck: "apiStage7QuickHealthCheck",
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

  compatibility: Object.freeze({
    loadCalendarDay: "apiLoadCalendarDay",
  }),
});

const PROJECT_MAINTENANCE_POLICY_ = Object.freeze({
  policy: "canonical-stage7-maintenance-only",
  canonicalFile: "api/Stage7MaintenanceApi.gs",
  compatibilityFile: null,
  canonicalMaintenanceApi: "api/Stage7MaintenanceApi.gs",
  compatibilityFacade: "ui-server/SidebarServer.gs",
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
    useCase: "Stage7ServerApi.apiStage7BootstrapSidebar",
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
  apiStage7GetPhoneDirectory: Object.freeze({
    client: "Stage7Api.getPhoneDirectory",
    server: "apiStage7GetPhoneDirectory",
    useCase: "ReferenceSheetsRepository_.readPhoneDirectory",
    status: "canonical",
    uiAllowed: true,
  }),
  apiStage7GetCarsRegister: Object.freeze({
    client: "Stage7Api.getCarsRegister",
    server: "apiStage7GetCarsRegister",
    useCase: "ReferenceSheetsRepository_.readCarsRegister",
    status: "canonical",
    uiAllowed: true,
  }),
  apiStage7GetWeaponsRegister: Object.freeze({
    client: "Stage7Api.getWeaponsRegister",
    server: "apiStage7GetWeaponsRegister",
    useCase: "ReferenceSheetsRepository_.readWeaponsRegister",
    status: "canonical",
    uiAllowed: true,
  }),
  apiStage7GetInventoryReconciliation: Object.freeze({
    client: "Stage7Api.getInventoryReconciliation",
    server: "apiStage7GetInventoryReconciliation",
    useCase: "InventoryReconciliation_.getDashboard",
    status: "canonical",
    uiAllowed: true,
  }),
  apiStage7SyncInventoryReconciliation: Object.freeze({
    client: "Stage7Api.syncInventoryReconciliation",
    server: "apiStage7SyncInventoryReconciliation",
    useCase: "InventoryReconciliation_.syncFiles",
    status: "canonical",
    uiAllowed: true,
  }),
  apiStage7SetInventoryReconciliationFolder: Object.freeze({
    client: "Stage7Api.setInventoryReconciliationFolder",
    server: "apiStage7SetInventoryReconciliationFolder",
    useCase: "InventoryReconciliation_.setFolder",
    status: "canonical",
    uiAllowed: true,
  }),
  apiStage7GetSelectedInventoryReconciliation: Object.freeze({
    client: "Stage7Api.getSelectedInventoryReconciliation",
    server: "apiStage7GetSelectedInventoryReconciliation",
    useCase: "InventoryReconciliation_.getSelected",
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
  apiMarkPanelRowsAsSentFast: Object.freeze({
    client: "Stage7Api.markAsSentFast",
    server: "apiMarkPanelRowsAsSentFast",
    useCase: "SendPanelRepository_.markRowsAsSent",
    status: "canonical-fast-path",
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
  apiStage7QuickHealthCheck: Object.freeze({
    client: "MaintenanceApi.quickHealthCheck",
    server: "apiStage7QuickHealthCheck",
    useCase: "runDiagnosticsByMode_",
    status: "canonical",
    uiAllowed: true,
  }),
  apiLoadCalendarDay: Object.freeze({
    client: null,
    server: "apiLoadCalendarDay",
    useCase: "apiStage7GetSidebarData",
    status: "compatibility-alias",
    uiAllowed: false,
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
    "Js.State.html",
    "Js.Modals.html",
    "Js.Api.html",
    "Js.Render.Panel.html",
    "Js.Render.Calendar.html",
    "Js.Render.Results.html",
    "Js.Vacations.Constants.html",
    "Js.Vacations.Formatters.html",
    "Js.Vacations.Render.Problems.html",
    "Js.Vacations.Render.Calendar.html",
    "Js.Vacations.Render.Main.html",
    "Js.Vacations.Actions.html",
    "Js.Vacations.Module.html",
    "Js.VacationSync.html",
    "Js.InventoryReconciliation.html",
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
  "access/AccessControl.AuthResolver.gs",
  "access/AccessControl.Core.gs",
  "access/AccessControl.Lockout.gs",
  "access/AccessControl.Mutations.gs",
  "access/AccessControl.PublicApi.gs",
  "access/AccessControl.SheetRepository.gs",
  "tests/AccessE2ETests.gs",
  "access/AccessEnforcement.gs",
  "access/AccessPolicyChecks.gs",
  "access/AccessSheetTriggers.gs",
  "operations/Actions.gs",
  "personnel/AlertsRepository.gs",
  "security/AuditTrail.gs",
  "CHANGELOG.md",
  "core/Code.gs",
  "maintenance/ConditionalFormatAdoptedRules.gs",
  "maintenance/ConditionalFormatGovernance.gs",
  "maintenance/ConditionalFormatRegistry.gs",
  "data/DataAccess.gs",
  "core/DateUtils.gs",
  "core/DeprecatedRegistry.gs",
  "diagnostics/Diagnostics.BasicChecks.gs",
  "diagnostics/Diagnostics.Core.gs",
  "tests/Diagnostics.Debug.gs",
  "diagnostics/Diagnostics.Health.gs",
  "diagnostics/Diagnostics.Stage7.Baseline.gs",
  "diagnostics/Diagnostics.Stage7.Core.gs",
  "diagnostics/Diagnostics.Stage7.Historical.gs",
  "ui-server/DialogPresenter.gs",
  "ui-server/DialogTemplates.gs",
  "ui-server/Dialogs.gs",
  "data/DictionaryRepository.gs",
  "tests/DomainTests.gs",
  "ui-server/HtmlUtils.gs",
  "ui/JavaScript.html",
  "maintenance/JobRuntime.gs",
  "maintenance/JobRuntimeRepository.gs",
  "ui/Js.Actions.html",
  "ui/Js.Api.html",
  "ui/Js.Core.html",
  "ui/Js.Diagnostics.html",
  "ui/Js.Events.html",
  "ui/Js.Helpers.html",
  "ui/Js.Modals.html",
  "ui/Js.Render.Calendar.html",
  "ui/Js.Render.Panel.html",
  "ui/Js.Render.Results.html",
  "ui/Js.Vacations.Actions.html",
  "ui/Js.Vacations.Constants.html",
  "ui/Js.Vacations.Formatters.html",
  "ui/Js.Vacations.Module.html",
  "ui/Js.Vacations.Render.Calendar.html",
  "ui/Js.Vacations.Render.Main.html",
  "ui/Js.Vacations.Render.Problems.html",
  "ui/Js.VacationSync.html",
  "ui/Js.Security.Boot.html",
  "ui/Js.Security.Util.html",
  "ui/Js.Security.Access.html",
  "ui/Js.Security.Debug.html",
  "ui/Js.Security.Login.html",
  "ui/Js.Security.DebugView.html",
  "ui/Js.Security.Policy.html",
  "ui/Js.Security.Guards.html",
  "ui/Js.Security.Forms.html",
  "ui/Js.Security.Exports.html",
  "ui/Js.Security.html",
  "ui/Js.State.html",
  "maintenance/LifecycleRetention.gs",
  "core/LockHelpers.gs",
  "core/Log.gs",
  "data/LogsRepository.gs",
  "sheets/MonthSheets.gs",
  "data/OperationRepository.gs",
  "core/OperationSafety.gs",
  "ui/PersonCalendar.html",
  "personnel/PersonCards.gs",
  "personnel/PersonnelRepository.gs",
  "personnel/PersonsRepository.gs",
  "ui-server/PreviewLinkService.gs",
  "core/ProjectMetadata.gs",
  "README.md",
  "RUNBOOK.md",
  "operations/Reconciliation.gs",
  "inventory/InventoryReconciliation.gs",
  "core/RoutingRegistry.gs",
  "SECURITY.md",
  "security/SecurityRedaction.gs",
  "sendpanel/SelectionActionService.gs",
  "sendpanel/SendPanel.gs",
  "sendpanel/SendPanelConstants.gs",
  "sendpanel/SendPanelFastPaths.gs",
  "sendpanel/SendPanelRepository.gs",
  "sendpanel/SendPanelService.gs",
  "core/ServerResponse.gs",
  "sheets/ServiceSheetsBootstrap.gs",
  "sheets/SheetSchemas.gs",
  "sheets/SheetStandards.gs",
  "ui/Sidebar.html",
  "ui/Js.InventoryReconciliation.html",
  "ui-server/SidebarServer.gs",
  "smoke/SmokeTests.gs",
  "smoke/SmokeTests.Helpers.gs",
  "api/SpreadsheetActionsApi.gs",
  "sheets/SpreadsheetProtection.gs",
  "core/Stage7Config.gs",
  "core/Stage7GlobalDependencyAliases.gs",
  "api/Stage7MaintenanceApi.gs",
  "api/Stage7ServerApi.gs",
  "tests/Stage7TestRunner.gs",
  "tests/Stage7TestRunner.Helpers.gs",
  "tests/Stage7TestRunner.Registry.gs",
  "tests/Stage7TestRunner.Reporting.gs",
  "tests/Stage7TestRunner.Sheet.gs",
  "tests/Stage7TestRunner.Ui.gs",
  "tests/Stage7TestRunner.Api.gs",
  "tests/Stage7TestRunner.Access.gs",
  "tests/Stage7TestRunner.Maintenance.gs",
  "tests/Stage7TestRunner.SendPanel.gs",
  "tests/Stage7TestRunner.Summaries.gs",
  "ui/Styles.html",
  "ui/Styles_00_Base.html",
  "ui/Styles_30_Personnel.html",
  "ui/Styles_35_InventoryReconciliation.html",
  "ui/Styles_40_SystemPanels.html",
  "ui/Styles_50_Modals.html",
  "ui/Styles_60_Health.html",
  "ui/Styles_99_Responsive.html",
  "reports/Summaries.gs",
  "reports/SummaryRepository.gs",
  "reports/SummaryService.gs",
  "sheets/SystemSheetsSelfHeal.gs",
  "maintenance/TemplateRegistry.gs",
  "maintenance/TemplateResolver.gs",
  "maintenance/Templates.gs",
  "operations/Triggers.gs",
  "core/UseCaseTracing.gs",
  "usecases/UseCases.Calendar.gs",
  "usecases/UseCases.Maintenance.gs",
  "usecases/UseCases.MonthOps.gs",
  "usecases/UseCases.PanelHelpers.gs",
  "sendpanel/UseCases.SendPanel.gs",
  "usecases/UseCases.Summaries.gs",
  "usecases/UseCases.gs",
  "core/Utils.gs",
  "vacations/VacationEngine.gs",
  "vacations/VacationOptionsWriter.gs",
  "vacations/VacationPlannerConfig.gs",
  "vacations/VacationPlannerService.gs",
  "vacations/VacationPlannerTypes.gs",
  "vacations/VacationService.gs",
  "ui/VacationSidebar.html",
  "vacations/VacationSidebarService.gs",
  "vacations/VacationsRepository.gs",
  "sheets/Validation.gs",
  "core/WorkflowOrchestrator.gs",
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

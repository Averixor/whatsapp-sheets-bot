/**
 * RoutingRegistry.gs — canonical Stage 7 routing / safety registry.
 *
 * This file is the single source of truth for active route metadata:
 * - canonical route name
 * - public API entrypoint
 * - underlying use case / service
 * - category and compatibility status
 * - read/write mode
 * - lock requirement
 * - dry-run support
 * - UI eligibility
 */

var WAPB_STAGE7_ROUTING_REGISTRY_STORE_ = (typeof WAPB_STAGE7_ROUTING_REGISTRY_STORE_ !== 'undefined' && WAPB_STAGE7_ROUTING_REGISTRY_STORE_) || Object.freeze({

  sidebar: Object.freeze({
    getMonthsList: Object.freeze({
      routeName: 'sidebar.getMonthsList',
      publicApiMethod: 'apiStage4GetMonthsList',
      useCase: 'Stage4UseCases_.listMonths',
      category: 'sidebar',
      compatibilityStatus: 'canonical',
      mode: 'read',
      lockRequired: false,
      dryRunSupported: false,
      uiAllowed: true,
      clientActionAliases: [],
      verifyAfterWrite: false
    }),

    getSidebarData: Object.freeze({
      routeName: 'sidebar.getSidebarData',
      publicApiMethod: 'apiStage4GetSidebarData',
      useCase: 'Stage4UseCases_.loadCalendarDay',
      category: 'sidebar',
      compatibilityStatus: 'canonical',
      mode: 'read',
      lockRequired: false,
      dryRunSupported: false,
      uiAllowed: true,
      clientActionAliases: [],
      verifyAfterWrite: false
    }),

    getSendPanelData: Object.freeze({
      routeName: 'sidebar.getSendPanelData',
      publicApiMethod: 'apiStage4GetSendPanelData',
      useCase: 'Stage4UseCases_.getSendPanelData',
      category: 'sidebar',
      compatibilityStatus: 'canonical',
      mode: 'read',
      lockRequired: false,
      dryRunSupported: false,
      uiAllowed: true,
      clientActionAliases: [],
      verifyAfterWrite: false
    }),

    generateSendPanelForDate: Object.freeze({
      routeName: 'sidebar.generateSendPanelForDate',
      publicApiMethod: 'apiGenerateSendPanelForDate',
      useCase: 'Stage4UseCases_.generateSendPanelForDate',
      category: 'sidebar',
      compatibilityStatus: 'canonical',
      mode: 'write',
      lockRequired: true,
      dryRunSupported: true,
      uiAllowed: true,
      clientActionAliases: ['generatePanel'],
      verifyAfterWrite: true
    }),

    generateSendPanelForRange: Object.freeze({
      routeName: 'sidebar.generateSendPanelForRange',
      publicApiMethod: 'apiGenerateSendPanelForRange',
      useCase: 'Stage4UseCases_.generateSendPanelForRange',
      category: 'sidebar',
      compatibilityStatus: 'canonical',
      mode: 'write',
      lockRequired: true,
      dryRunSupported: true,
      uiAllowed: false,
      clientActionAliases: [],
      verifyAfterWrite: true
    }),

    markPanelRowsAsSent: Object.freeze({
      routeName: 'sidebar.markPanelRowsAsSent',
      publicApiMethod: 'apiMarkPanelRowsAsSent',
      useCase: 'Stage4UseCases_.markPanelRowsAsSent',
      category: 'sidebar',
      compatibilityStatus: 'canonical',
      mode: 'write',
      lockRequired: true,
      dryRunSupported: true,
      uiAllowed: true,
      clientActionAliases: ['markPanelRowsAsSent', 'markSendPanelRowsAsSent'],
      verifyAfterWrite: true
    }),

    markPanelRowsAsUnsent: Object.freeze({
      routeName: 'sidebar.markPanelRowsAsUnsent',
      publicApiMethod: 'apiMarkPanelRowsAsUnsent',
      useCase: 'Stage4UseCases_.markPanelRowsAsUnsent',
      category: 'sidebar',
      compatibilityStatus: 'canonical',
      mode: 'write',
      lockRequired: true,
      dryRunSupported: true,
      uiAllowed: true,
      clientActionAliases: ['markPanelRowsAsUnsent'],
      verifyAfterWrite: true
    }),

    sendPendingRows: Object.freeze({
      routeName: 'sidebar.sendPendingRows',
      publicApiMethod: 'apiSendPendingRows',
      useCase: 'Stage4UseCases_.sendPendingRows',
      category: 'sidebar',
      compatibilityStatus: 'canonical',
      mode: 'write',
      lockRequired: true,
      dryRunSupported: true,
      uiAllowed: true,
      clientActionAliases: ['sendUnsent'],
      verifyAfterWrite: true
    }),

    buildDaySummary: Object.freeze({
      routeName: 'sidebar.buildDaySummary',
      publicApiMethod: 'apiBuildDaySummary',
      useCase: 'Stage4UseCases_.buildDaySummary',
      category: 'sidebar',
      compatibilityStatus: 'canonical',
      mode: 'read',
      lockRequired: false,
      dryRunSupported: false,
      uiAllowed: true,
      clientActionAliases: ['daySummary'],
      verifyAfterWrite: false
    }),

    buildDetailedSummary: Object.freeze({
      routeName: 'sidebar.buildDetailedSummary',
      publicApiMethod: 'apiBuildDetailedSummary',
      useCase: 'Stage4UseCases_.buildDetailedSummary',
      category: 'sidebar',
      compatibilityStatus: 'canonical',
      mode: 'read',
      lockRequired: false,
      dryRunSupported: false,
      uiAllowed: true,
      clientActionAliases: ['detailedDay'],
      verifyAfterWrite: false
    }),

    openPersonCard: Object.freeze({
      routeName: 'sidebar.openPersonCard',
      publicApiMethod: 'apiOpenPersonCard',
      useCase: 'Stage4UseCases_.openPersonCard',
      category: 'sidebar',
      compatibilityStatus: 'canonical',
      mode: 'read',
      lockRequired: false,
      dryRunSupported: false,
      uiAllowed: true,
      clientActionAliases: [],
      verifyAfterWrite: false
    }),

    checkVacationsAndBirthdays: Object.freeze({
      routeName: 'sidebar.checkVacationsAndBirthdays',
      publicApiMethod: 'apiCheckVacationsAndBirthdays',
      useCase: 'Stage4UseCases_.checkVacationsAndBirthdays',
      category: 'sidebar',
      compatibilityStatus: 'canonical',
      mode: 'read',
      lockRequired: false,
      dryRunSupported: false,
      uiAllowed: true,
      clientActionAliases: ['vacationReminder', 'birthdayCheck'],
      verifyAfterWrite: false
    }),

    switchBotToMonth: Object.freeze({
      routeName: 'sidebar.switchBotToMonth',
      publicApiMethod: 'apiStage4SwitchBotToMonth',
      useCase: 'Stage4UseCases_.switchBotToMonth',
      category: 'sidebar',
      compatibilityStatus: 'canonical',
      mode: 'write',
      lockRequired: true,
      dryRunSupported: false,
      uiAllowed: true,
      clientActionAliases: ['switchMonth'],
      verifyAfterWrite: false
    }),

    createNextMonth: Object.freeze({
      routeName: 'sidebar.createNextMonth',
      publicApiMethod: 'apiCreateNextMonthStage4',
      useCase: 'Stage4UseCases_.createNextMonth',
      category: 'sidebar',
      compatibilityStatus: 'canonical',
      mode: 'write',
      lockRequired: true,
      dryRunSupported: true,
      uiAllowed: true,
      clientActionAliases: ['createNextMonth'],
      verifyAfterWrite: true
    }),

    runReconciliation: Object.freeze({
      routeName: 'sidebar.runReconciliation',
      publicApiMethod: 'apiRunReconciliation',
      useCase: 'Stage4UseCases_.runReconciliation',
      category: 'sidebar',
      compatibilityStatus: 'canonical',
      mode: 'write-conditional',
      lockRequired: true,
      dryRunSupported: true,
      uiAllowed: true,
      clientActionAliases: ['runReconciliation'],
      verifyAfterWrite: true
    })
  }),

  spreadsheet: Object.freeze({
    previewSelectionMessage: Object.freeze({ routeName: 'spreadsheet.previewSelectionMessage', publicApiMethod: 'apiPreviewSelectionMessage', useCase: 'SelectionActionService_', category: 'spreadsheet', compatibilityStatus: 'canonical', mode: 'read', lockRequired: false, dryRunSupported: true, uiAllowed: false, clientActionAliases: [], verifyAfterWrite: false }),
    previewMultipleMessages: Object.freeze({ routeName: 'spreadsheet.previewMultipleMessages', publicApiMethod: 'apiPreviewMultipleMessages', useCase: 'SelectionActionService_', category: 'spreadsheet', compatibilityStatus: 'canonical', mode: 'read', lockRequired: false, dryRunSupported: true, uiAllowed: false, clientActionAliases: [], verifyAfterWrite: false }),
    previewGroupedMessages: Object.freeze({ routeName: 'spreadsheet.previewGroupedMessages', publicApiMethod: 'apiPreviewGroupedMessages', useCase: 'SelectionActionService_', category: 'spreadsheet', compatibilityStatus: 'canonical', mode: 'read', lockRequired: false, dryRunSupported: true, uiAllowed: false, clientActionAliases: [], verifyAfterWrite: false }),
    prepareRangeMessages: Object.freeze({ routeName: 'spreadsheet.prepareRangeMessages', publicApiMethod: 'apiPrepareRangeMessages', useCase: 'SelectionActionService_', category: 'spreadsheet', compatibilityStatus: 'canonical', mode: 'read', lockRequired: false, dryRunSupported: true, uiAllowed: false, clientActionAliases: [], verifyAfterWrite: false }),
    buildCommanderSummaryPreview: Object.freeze({ routeName: 'spreadsheet.buildCommanderSummaryPreview', publicApiMethod: 'apiBuildCommanderSummaryPreview', useCase: 'SummaryService_.buildCommanderPreview', category: 'spreadsheet', compatibilityStatus: 'canonical', mode: 'read', lockRequired: false, dryRunSupported: true, uiAllowed: false, clientActionAliases: [], verifyAfterWrite: false }),
    buildCommanderSummaryLink: Object.freeze({ routeName: 'spreadsheet.buildCommanderSummaryLink', publicApiMethod: 'apiBuildCommanderSummaryLink', useCase: 'SummaryService_.buildCommanderLink', category: 'spreadsheet', compatibilityStatus: 'canonical', mode: 'read', lockRequired: false, dryRunSupported: true, uiAllowed: false, clientActionAliases: [], verifyAfterWrite: false }),
    logPreparedMessages: Object.freeze({ routeName: 'spreadsheet.logPreparedMessages', publicApiMethod: 'apiLogPreparedMessages', useCase: 'SelectionActionService_', category: 'spreadsheet', compatibilityStatus: 'canonical', mode: 'write', lockRequired: true, dryRunSupported: true, uiAllowed: false, clientActionAliases: [], verifyAfterWrite: false }),
    runSelectionDiagnostics: Object.freeze({ routeName: 'spreadsheet.runSelectionDiagnostics', publicApiMethod: 'apiRunSelectionDiagnostics', useCase: 'SelectionActionService_', category: 'spreadsheet', compatibilityStatus: 'canonical', mode: 'read', lockRequired: false, dryRunSupported: true, uiAllowed: false, clientActionAliases: [], verifyAfterWrite: false })
  }),

  maintenance: Object.freeze({
    clearCache: Object.freeze({ routeName: 'maintenance.clearCache', publicApiMethod: 'apiStage5ClearCache', useCase: 'Stage4UseCases_.runMaintenanceScenario', category: 'maintenance', compatibilityStatus: 'canonical', mode: 'write', lockRequired: true, dryRunSupported: false, uiAllowed: true, clientActionAliases: ['clearCache'], verifyAfterWrite: false }),
    clearLog: Object.freeze({ routeName: 'maintenance.clearLog', publicApiMethod: 'apiStage5ClearLog', useCase: 'Stage4UseCases_.runMaintenanceScenario', category: 'maintenance', compatibilityStatus: 'canonical', mode: 'write', lockRequired: true, dryRunSupported: false, uiAllowed: true, clientActionAliases: ['clearLog'], verifyAfterWrite: false }),
    clearPhoneCache: Object.freeze({ routeName: 'maintenance.clearPhoneCache', publicApiMethod: 'apiStage5ClearPhoneCache', useCase: 'Stage4UseCases_.runMaintenanceScenario', category: 'maintenance', compatibilityStatus: 'canonical', mode: 'write', lockRequired: true, dryRunSupported: false, uiAllowed: true, clientActionAliases: ['clearPhoneCache'], verifyAfterWrite: false }),
    restartBot: Object.freeze({ routeName: 'maintenance.restartBot', publicApiMethod: 'apiStage5RestartBot', useCase: 'Stage4UseCases_.runMaintenanceScenario', category: 'maintenance', compatibilityStatus: 'canonical', mode: 'write', lockRequired: true, dryRunSupported: false, uiAllowed: true, clientActionAliases: ['restartBot'], verifyAfterWrite: false }),
    setupVacationTriggers: Object.freeze({ routeName: 'maintenance.setupVacationTriggers', publicApiMethod: 'apiStage5SetupVacationTriggers', useCase: 'Stage4UseCases_.runMaintenanceScenario', category: 'maintenance', compatibilityStatus: 'canonical', mode: 'write', lockRequired: true, dryRunSupported: false, uiAllowed: true, clientActionAliases: ['setupTrigger'], verifyAfterWrite: false }),
    cleanupDuplicateTriggers: Object.freeze({ routeName: 'maintenance.cleanupDuplicateTriggers', publicApiMethod: 'apiStage5CleanupDuplicateTriggers', useCase: 'Stage4UseCases_.runMaintenanceScenario', category: 'maintenance', compatibilityStatus: 'canonical', mode: 'write', lockRequired: true, dryRunSupported: false, uiAllowed: true, clientActionAliases: ['cleanupTriggers'], verifyAfterWrite: false }),
    debugPhones: Object.freeze({ routeName: 'maintenance.debugPhones', publicApiMethod: 'apiStage5DebugPhones', useCase: 'Stage4UseCases_.runMaintenanceScenario', category: 'maintenance', compatibilityStatus: 'canonical', mode: 'read', lockRequired: false, dryRunSupported: false, uiAllowed: true, clientActionAliases: ['debugPhones'], verifyAfterWrite: false }),
    buildBirthdayLink: Object.freeze({ routeName: 'maintenance.buildBirthdayLink', publicApiMethod: 'apiStage5BuildBirthdayLink', useCase: 'apiStage5BuildBirthdayLink', category: 'maintenance', compatibilityStatus: 'canonical', mode: 'read', lockRequired: false, dryRunSupported: false, uiAllowed: true, clientActionAliases: [], verifyAfterWrite: false }),
    runMaintenanceScenario: Object.freeze({ routeName: 'maintenance.runMaintenanceScenario', publicApiMethod: 'apiRunStage5MaintenanceScenario', useCase: 'Stage4UseCases_.runMaintenanceScenario', category: 'maintenance', compatibilityStatus: 'canonical', mode: 'write-conditional', lockRequired: true, dryRunSupported: true, uiAllowed: true, clientActionAliases: [], verifyAfterWrite: false }),
    installJobs: Object.freeze({ routeName: 'maintenance.installJobs', publicApiMethod: 'apiInstallStage5Jobs', useCase: 'Stage4Triggers_.installManagedTriggers', category: 'maintenance', compatibilityStatus: 'canonical', mode: 'write', lockRequired: true, dryRunSupported: false, uiAllowed: true, clientActionAliases: [], verifyAfterWrite: false }),
    listJobs: Object.freeze({ routeName: 'maintenance.listJobs', publicApiMethod: 'apiListStage5Jobs', useCase: 'Stage4Triggers_.listJobs', category: 'maintenance', compatibilityStatus: 'canonical', mode: 'read', lockRequired: false, dryRunSupported: false, uiAllowed: true, clientActionAliases: [], verifyAfterWrite: false }),
    runJob: Object.freeze({ routeName: 'maintenance.runJob', publicApiMethod: 'apiRunStage5Job', useCase: 'Stage4Triggers_.runJob', category: 'maintenance', compatibilityStatus: 'canonical', mode: 'write-conditional', lockRequired: true, dryRunSupported: true, uiAllowed: true, clientActionAliases: [], verifyAfterWrite: true }),
    healthCheck: Object.freeze({ routeName: 'maintenance.healthCheck', publicApiMethod: 'apiStage5HealthCheck', useCase: 'runStage5DiagnosticsByMode_', category: 'maintenance', compatibilityStatus: 'canonical', mode: 'read', lockRequired: false, dryRunSupported: true, uiAllowed: true, clientActionAliases: ['healthCheck'], verifyAfterWrite: false }),
    runDiagnostics: Object.freeze({ routeName: 'maintenance.runDiagnostics', publicApiMethod: 'apiRunStage5Diagnostics', useCase: 'runStage5DiagnosticsByMode_', category: 'maintenance', compatibilityStatus: 'canonical', mode: 'read', lockRequired: false, dryRunSupported: true, uiAllowed: true, clientActionAliases: [], verifyAfterWrite: false }),
    runRegressionTests: Object.freeze({ routeName: 'maintenance.runRegressionTests', publicApiMethod: 'apiRunStage5RegressionTests', useCase: 'runStage5SmokeTests', category: 'maintenance', compatibilityStatus: 'canonical', mode: 'read', lockRequired: false, dryRunSupported: true, uiAllowed: true, clientActionAliases: [], verifyAfterWrite: false }),
    listJobRuntime: Object.freeze({ routeName: 'maintenance.listJobRuntime', publicApiMethod: 'apiListStage5JobRuntime', useCase: 'JobRuntime_.buildRuntimeReport', category: 'maintenance', compatibilityStatus: 'canonical', mode: 'read', lockRequired: false, dryRunSupported: false, uiAllowed: true, clientActionAliases: [], verifyAfterWrite: false }),
    listPendingRepairs: Object.freeze({ routeName: 'maintenance.listPendingRepairs', publicApiMethod: 'apiStage5ListPendingRepairs', useCase: 'OperationRepository_.listPendingRepairs', category: 'maintenance', compatibilityStatus: 'canonical', mode: 'read', lockRequired: false, dryRunSupported: false, uiAllowed: true, clientActionAliases: ['pendingRepairs'], verifyAfterWrite: false }),
    getOperationDetails: Object.freeze({ routeName: 'maintenance.getOperationDetails', publicApiMethod: 'apiStage5GetOperationDetails', useCase: 'OperationRepository_.getOperationDetails', category: 'maintenance', compatibilityStatus: 'canonical', mode: 'read', lockRequired: false, dryRunSupported: false, uiAllowed: true, clientActionAliases: ['operationDetails'], verifyAfterWrite: false }),
    runRepair: Object.freeze({ routeName: 'maintenance.runRepair', publicApiMethod: 'apiStage5RunRepair', useCase: 'OperationRepository_.runRepair', category: 'maintenance', compatibilityStatus: 'canonical', mode: 'write-conditional', lockRequired: true, dryRunSupported: true, uiAllowed: true, clientActionAliases: ['runRepair'], verifyAfterWrite: true }),
    runLifecycleRetentionCleanup: Object.freeze({ routeName: 'maintenance.runLifecycleRetentionCleanup', publicApiMethod: 'apiStage5RunLifecycleRetentionCleanup', useCase: 'Stage4UseCases_.runMaintenanceScenario', category: 'maintenance', compatibilityStatus: 'canonical', mode: 'write', lockRequired: true, dryRunSupported: false, uiAllowed: true, clientActionAliases: ['lifecycleRetentionCleanup'], verifyAfterWrite: false })
  })
});

function _stage6ADeepCopy_(value) {
  return JSON.parse(JSON.stringify(value));
}

function getStage6ARoutingRegistry_() {
  return _stage6ADeepCopy_(WAPB_STAGE7_ROUTING_REGISTRY_STORE_);
}

function getRoutingRegistry_() {
  return listStage6ARoutes_();
}

function listStage6ARoutes_() {
  const groups = WAPB_STAGE7_ROUTING_REGISTRY_STORE_ || {};
  const out = [];
  Object.keys(groups).forEach(function (group) {
    Object.keys(groups[group] || {}).forEach(function (key) {
      out.push(Object.assign({ group: group, action: key }, groups[group][key] || {}));
    });
  });
  return out;
}

function getStage6ARouteByName_(routeName) {
  const target = String(routeName || '').trim();
  return listStage6ARoutes_().find(function (item) { return item.routeName === target; }) || null;
}

function getStage6ARouteByApiMethod_(methodName) {
  const target = String(methodName || '').trim();
  return listStage6ARoutes_().find(function (item) { return item.publicApiMethod === target; }) || null;
}

function getStage6AUiActionMap_() {
  const map = {};
  listStage6ARoutes_().forEach(function (item) {
    (item.clientActionAliases || []).forEach(function (alias) {
      map[String(alias)] = item.routeName;
    });
  });
  return map;
}

function normalizeStage6AUiAction_(action) {
  const safe = String(action || '').trim();
  const map = getStage6AUiActionMap_();
  return map[safe] || safe;
}

function getStage6ACriticalWriteRoutes_() {
  return listStage6ARoutes_().filter(function (item) {
    return String(item.mode || '').indexOf('write') === 0;
  });
}

function getStage6ARouteCoverageReport_() {
  const routes = listStage6ARoutes_();
  const critical = getStage6ACriticalWriteRoutes_();
  return {
    total: routes.length,
    groups: [...new Set(routes.map(function (item) { return item.group; }))],
    criticalWrites: critical.length,
    lockCoverage: critical.filter(function (item) { return item.lockRequired; }).length,
    dryRunCoverage: critical.filter(function (item) { return item.dryRunSupported; }).length,
    uiAllowedRoutes: routes.filter(function (item) { return item.uiAllowed; }).length,
    missingLockCoverage: critical.filter(function (item) { return !item.lockRequired; }).map(function (item) { return item.routeName; })
  };
}

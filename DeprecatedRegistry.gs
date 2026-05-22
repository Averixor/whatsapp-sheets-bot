/**
 * DeprecatedRegistry.gs — inventory of removed legacy globals (must stay absent after deploy).
 */

const REMOVED_LEGACY_GLOBAL_API_NAMES_ = Object.freeze([
  "apiStage4ClearCache",
  "apiStage4ClearLog",
  "apiStage4ClearPhoneCache",
  "apiStage4RestartBot",
  "apiStage4SetupVacationTriggers",
  "apiStage4CleanupDuplicateTriggers",
  "apiStage4DebugPhones",
  "apiStage4BuildBirthdayLink",
  "apiStage4HealthCheck",
  "apiRunStage4RegressionTests",
  "apiStage4ListPendingRepairs",
  "apiStage4GetOperationDetails",
  "apiStage4RunRepair",
  "apiStage4RunLifecycleRetentionCleanup",
  "apiStage4GetAccessDescriptor",
  "apiStage4ApplyProtections",
  "apiStage4BootstrapAccessSheet",
  "apiGetMonthsList",
  "apiGetSidebarData",
  "apiGenerateSendPanel",
  "apiGetSendPanelData",
  "apiMarkSendPanelRowsAsSent",
  "apiGetDaySummary",
  "apiGetDetailedDaySummary",
  "apiCheckVacations",
  "apiGetBirthdays",
  "apiGetPersonCardData",
  "apiSwitchBotToMonth",
  "apiCreateNextMonth",
  "apiSetupVacationTriggers",
  "apiCleanupDuplicateTriggers",
  "apiDebugPhones",
  "apiClearCache",
  "apiClearPhoneCache",
  "apiClearLog",
  "apiHealthCheck",
  "apiRunRegressionTests",
  "apiRunMaintenanceScenario",
  "apiInstallStage4Jobs",
  "apiListStage4Jobs",
  "apiRunStage4Job",
  "getMonthsList",
  "getSidebarData",
  "generateSendPanelSidebar",
  "getSendPanelSidebarData",
  "getDaySummaryByDate",
  "getDetailedDaySummaryByDate",
  "checkVacationsAndNotifySidebar",
  "createNextMonthSheetSidebar",
  "switchBotToMonthSidebar",
  "markMultipleAsSentFromSidebar",
  "markMultipleAsUnsentFromSidebar",
]);

const REMOVED_LEGACY_HELPER_NAMES_ = Object.freeze([
  "_parseUaDate_",
  "normalizeDate_",
  "_parseDate_",
  "escapeHtml_",
  "_escapeHtml_",
]);

function _deprecatedRegistryFnExists_(name) {
  if (typeof _stage7HasFn_ === "function") return _stage7HasFn_(name);
  if (typeof _fnExists_ === "function") return _fnExists_(name);
  try {
    var g = typeof globalThis !== "undefined" ? globalThis : this;
    return typeof g[name] === "function";
  } catch (e) {
    return false;
  }
}

function getRemovedLegacyApiNames_() {
  return REMOVED_LEGACY_GLOBAL_API_NAMES_.slice();
}

function findPresentLegacyApiGlobals_() {
  return REMOVED_LEGACY_GLOBAL_API_NAMES_.filter(_deprecatedRegistryFnExists_);
}

function findPresentLegacyHelperGlobals_() {
  return REMOVED_LEGACY_HELPER_NAMES_.filter(_deprecatedRegistryFnExists_);
}

function getDeprecatedRegistry_() {
  return [];
}

/** @deprecated compatibility map removed — returns [] */
function getStage4CompatibilityMap_() {
  return [];
}

function getCompatibilitySunsetReport_() {
  const presentLegacy = findPresentLegacyApiGlobals_();
  const presentHelpers = findPresentLegacyHelperGlobals_();

  return {
    total: 0,
    presentHelpers: presentHelpers.length,
    presentLegacyApis: presentLegacy.length,
    presentLegacyApiNames: presentLegacy,
    presentHelperNames: presentHelpers,
    counts: {
      "legacy-api-removed": REMOVED_LEGACY_GLOBAL_API_NAMES_.length,
      "legacy-helper-removed": REMOVED_LEGACY_HELPER_NAMES_.length,
    },
    missingSunsetMarkers: 0,
  };
}

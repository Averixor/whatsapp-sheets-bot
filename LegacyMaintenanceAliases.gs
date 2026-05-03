/**
 * LegacyMaintenanceAliases.gs — canonical maintenance compatibility aliases.
 *
 * This file intentionally centralizes:
 * 1) historical Stage 4 maintenance aliases;
 * 2) historical Stage 5 maintenance aliases;
 * 3) legacy non-staged maintenance aliases.
 *
 * Goal: keep exactly one compatibility surface for maintenance/admin routes,
 * without duplicating the same public function names across multiple files.
 */

// -----------------------------------------------------------------------------
// Historical Stage 4 maintenance aliases -> canonical Stage 7 maintenance API
// -----------------------------------------------------------------------------

function apiStage4ClearCache() { 
  return apiStage7ClearCache(); 
}

function apiStage4ClearLog() { 
  return apiStage7ClearLog(); 
}

function apiStage4ClearPhoneCache() { 
  return apiStage7ClearPhoneCache(); 
}

function apiStage4RestartBot() { 
  return apiStage7RestartBot(); 
}

function apiStage4SetupVacationTriggers() { 
  return apiStage7SetupVacationTriggers(); 
}

function apiStage4CleanupDuplicateTriggers(functionName) { 
  return apiStage7CleanupDuplicateTriggers(functionName || ''); 
}
function apiStage4DebugPhones() { 
  return apiStage7DebugPhones(); 
}

function apiStage4BuildBirthdayLink(phone, name) { 
  return apiStage7BuildBirthdayLink(phone || '', name || ''); 
}

function apiRunMaintenanceScenario(options) { 
  return apiRunStage7MaintenanceScenario(options || {}); 
}

function apiInstallStage4Jobs() { 
  return apiInstallStage7Jobs(); 
}

function apiListStage4Jobs() { return apiListStage7Jobs(); }
function apiRunStage4Job(jobName, options) { 
  return apiRunStage7Job(jobName, Object.assign({}, options || {}, { entryPoint: 'apiRunStage4Job' })); 
}

function apiStage4HealthCheck(options) { 
  return apiStage7HealthCheck(options || {}); 
}

function apiRunStage4RegressionTests(options) { 
  return apiRunStage7RegressionTests(options || {}); 
}

function apiStage4ListPendingRepairs(filters) { 
  return apiStage7ListPendingRepairs(filters || {}); 
}

function apiStage4GetOperationDetails(operationId) { 
  return apiStage7GetOperationDetails(operationId || ''); 
}

function apiStage4RunRepair(operationId, options) { 
  return apiStage7RunRepair(operationId || '', options || {}); 
}

function apiStage4RunLifecycleRetentionCleanup() { 
  return apiStage7RunLifecycleRetentionCleanup(); 
}

function apiStage4GetAccessDescriptor() { 
  return apiStage7GetAccessDescriptor(); 
}

function apiStage4ApplyProtections(options) { 
  return apiStage7ApplyProtections(options || {}); 
}

function apiStage4BootstrapAccessSheet() { 
  return apiStage7BootstrapAccessSheet(); 
}

// -----------------------------------------------------------------------------
// Historical Stage 5 maintenance aliases -> canonical Stage 7 maintenance API
// -----------------------------------------------------------------------------

function apiStage5BootstrapAccessSheet() { 
  return apiStage7BootstrapAccessSheet(); 
}

function apiStage5GetAccessDescriptor() { 
  return apiStage7GetAccessDescriptor(); 
}

function apiStage5DebugAccess() { 
  return apiStage7DebugAccess(); 
}

function apiStage5ReportAccessViolation(actionName, details) { 
  return apiStage7ReportAccessViolation(actionName || '', details || {}); 
}

function apiStage5ApplyProtections(options) { 
  return apiStage7ApplyProtections(options || {}); 
}

function apiStage5ClearCache() { 
  return apiStage7ClearCache(); 
}

function apiStage5ClearLog() { 
  return apiStage7ClearLog(); 
}

function apiStage5ClearPhoneCache() { 
  return apiStage7ClearPhoneCache(); 
}

function apiStage5RestartBot() { 
  return apiStage7RestartBot(); 
}

function apiStage5SetupVacationTriggers() { 
  return apiStage7SetupVacationTriggers(); 
}

function apiStage5CleanupDuplicateTriggers(functionName) { 
  return apiStage7CleanupDuplicateTriggers(functionName || ''); 
}

function apiStage5DebugPhones() { 
  return apiStage7DebugPhones(); 
}

function apiStage5BuildBirthdayLink(phone, name) { 
  return apiStage7BuildBirthdayLink(phone || '', name || ''); 
}

function apiRunStage5MaintenanceScenario(options) { 
  return apiRunStage7MaintenanceScenario(options || {}); 
}

function apiInstallStage5Jobs() { 
  return apiInstallStage7Jobs(); 
}

function apiListStage5Jobs() { 
  return apiListStage7Jobs(); 
}

function apiRunStage5Job(jobName, options) { 
  return apiRunStage7Job(jobName, Object.assign({}, options || {}, { entryPoint: 'apiRunStage5Job' })); 
}

function apiStage5HealthCheck(options) { 
  return apiStage7HealthCheck(options || {}); 
}

function apiRunStage5Diagnostics(options) { 
  return apiRunStage7Diagnostics(options || {}); 
}

function apiRunStage5RegressionTests(options) { 
  return apiRunStage7RegressionTests(options || {}); 
}

function apiListStage5JobRuntime() { 
  return apiListStage7JobRuntime(); 
}

function apiStage5ListPendingRepairs(filters) { 
  return apiStage7ListPendingRepairs(filters || {}); 
}

function apiStage5GetOperationDetails(operationId) { 
  return apiStage7GetOperationDetails(operationId || ''); 
}

function apiStage5RunRepair(operationId, options) { 
  return apiStage7RunRepair(operationId || '', options || {}); 
}

function apiStage5RunLifecycleRetentionCleanup() { 
  return apiStage7RunLifecycleRetentionCleanup(); 
}

function apiStage5BootstrapRuntimeAndAlertsSheets() { 
  return apiStage7BootstrapRuntimeAndAlertsSheets(); 
}

// -----------------------------------------------------------------------------
// Legacy non-staged maintenance aliases
// -----------------------------------------------------------------------------

function apiSetupVacationTriggers() { 
  return apiStage7SetupVacationTriggers(); 
}

function apiCleanupDuplicateTriggers(functionName) { 
  return apiStage7CleanupDuplicateTriggers(functionName || ''); 
}

function apiDebugPhones() { 
  return apiStage7DebugPhones(); 
}

function apiClearCache() { 
  return apiStage7ClearCache(); 
}

function apiClearPhoneCache() { 
  return apiStage7ClearPhoneCache(); 
}

function apiClearLog() { 
  return apiStage7ClearLog(); 
}

function apiHealthCheck(options) { 
  return apiStage7HealthCheck(options || {}); 
}

function apiRunRegressionTests(options) { 
  return apiRunStage7RegressionTests(options || {}); 
}


// -----------------------------------------------------------------------------
// Thin helper shim retained for historical diagnostics callers
// -----------------------------------------------------------------------------

function runStage5DiagnosticsByMode_(options) {
  return runDiagnosticsByMode_(options || {});
}

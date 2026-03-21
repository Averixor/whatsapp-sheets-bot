/**
 * Stage4MaintenanceApi.gs — compatibility-only facade for historical Stage 4.x maintenance callers.
 *
 * Canonical maintenance entrypoints live in Stage5MaintenanceApi.gs.
 * This file intentionally keeps thin wrappers only.
 */

function apiStage4ClearCache() {
  return apiStage5ClearCache();
}

function apiStage4ClearLog() {
  return apiStage5ClearLog();
}

function apiStage4ClearPhoneCache() {
  return apiStage5ClearPhoneCache();
}

function apiStage4RestartBot() {
  return apiStage5RestartBot();
}

function apiStage4SetupVacationTriggers() {
  return apiStage5SetupVacationTriggers();
}

function apiStage4CleanupDuplicateTriggers(functionName) {
  return apiStage5CleanupDuplicateTriggers(functionName || '');
}

function apiStage4DebugPhones() {
  return apiStage5DebugPhones();
}

function apiStage4BuildBirthdayLink(phone, name) {
  return apiStage5BuildBirthdayLink(phone || '', name || '');
}

function apiRunMaintenanceScenario(options) {
  return apiRunStage5MaintenanceScenario(options || {});
}

function apiInstallStage4Jobs() {
  return apiInstallStage5Jobs();
}

function apiListStage4Jobs() {
  return apiListStage5Jobs();
}

function apiRunStage4Job(jobName, options) {
  return apiRunStage5Job(jobName, options || {});
}

function apiStage4HealthCheck(options) {
  return apiStage5HealthCheck(options || {});
}

function apiRunStage4RegressionTests(options) {
  return apiRunStage5RegressionTests(options || {});
}


function apiStage4ListPendingRepairs(filters) {
  return apiStage5ListPendingRepairs(filters || {});
}

function apiStage4GetOperationDetails(operationId) {
  return apiStage5GetOperationDetails(operationId || '');
}

function apiStage4RunRepair(operationId, options) {
  return apiStage5RunRepair(operationId || '', options || {});
}


function apiStage4RunLifecycleRetentionCleanup() {
  return apiStage5RunLifecycleRetentionCleanup();
}
/**
 * Stage7Config.gs — canonical config + shared app/stage7 helpers.
 */

var APP_CONFIG = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG) ? APP_CONFIG : null;
var STAGE7_CONFIG = (typeof STAGE7_CONFIG !== 'undefined' && STAGE7_CONFIG) ? STAGE7_CONFIG : null;

function buildAppConfig_() {
  return Object.freeze({
    CURRENT_VERSION: '7.1.2-final-clean',
    CORE: Object.freeze({
      AUDIT_LOG_SHEET: 'AUDIT_LOG',
      AUDIT_HEADER_ROW: 1,
      RUNTIME_SHEET: 'JOB_RUNTIME_LOG',
      OPS_LOG_SHEET: 'OPS_LOG',
      ACTIVE_OPERATIONS_SHEET: 'ACTIVE_OPERATIONS',
      CHECKPOINTS_SHEET: 'CHECKPOINTS',
      ACCESS_SHEET: 'ACCESS',
      ALERTS_LOG_SHEET: 'ALERTS_LOG',
      OPS_HOT_RETENTION_DAYS: 180,
      ACTIVE_STALE_GRACE_HOURS: 48,
      LOG_RETENTION_DAYS: 60,
      AUDIT_RETENTION_DAYS: 180,
      JOB_BACKOFF_MINUTES: 30,
      JOB_FAILURE_ALERT_THRESHOLD: 3,
      MAX_BATCH_ROWS: 250,
      MAX_RANGE_DAYS: 31,
      MAX_REPAIR_ITEMS: 500,
      MAX_REPAIR_ITEMS_SAFE: 250,
      MAX_RUNTIME_HISTORY: 50,
      MAX_RUNTIME_LOG_ROWS: 500,
      LOCK_TIMEOUT_MS: 15000,
      IDEMPOTENCY_TTL_SEC: 1000,
      SAFETY_TTL_SEC: 1000,
      TEMPLATE_PREVIEW_LIMIT: 3800,
      ACTIVE_RUNTIME_MARKER: 'stage7-sidebar-runtime'
    }),

    FLAGS: Object.freeze({
      stage7UseCases: true,
      auditTrail: true,
      reconciliation: true,
      managedTriggers: true,
      canonicalMaintenanceApi: true,
      safeRepair: true,
      dryRunByDefaultForRepair: true,
      spreadsheetActionApi: true,
      dialogPresentationLayer: true,
      clientModularIncludes: true,
      clientMonolithicRuntime: false,
      domainServices: true,
      reconciliation2: true,
      jobRuntime: true,
      templateGovernance: true,
      compatibilitySunset: true,
      diagnostics3: true,
      stage7OperationLifecycle: true,
      stage7SidebarFirst: true,
      stage7StaleDetector: true,
      stage7RepairFlow: true,
      routingRegistry: true,
      safetyRegistry: true,
      enrichedWriteContract: true,
      hybridJobRuntimePolicy: true,
      stage7ADomainTests: true,
      fullVerboseDiagnostics: true
    }),
    
    JOBS: Object.freeze({
      DAILY_VACATIONS_AND_BIRTHDAYS: 'dailyVacationsAndBirthdays',
      SCHEDULED_RECONCILIATION: 'scheduledReconciliation',
      SCHEDULED_HEALTHCHECK: 'scheduledHealthCheck',
      CLEANUP_CACHES: 'cleanupCaches',
      POST_CREATE_MONTH_CHECK: 'postCreateMonthCheck',
      STALE_OPERATION_DETECTOR: 'staleOperationDetector',
      LIFECYCLE_RETENTION_CLEANUP: 'lifecycleRetentionCleanup',
      ACCESS_AUDIT_EDIT: 'accessAuditEdit',
      ACCESS_AUDIT_CHANGE: 'accessAuditChange'
    })
  });
}

function ensureAppConfig_() {
  var config = APP_CONFIG;
  if (!config || typeof config !== 'object' || !config.CORE || !config.FLAGS || !config.JOBS) {
    APP_CONFIG = buildAppConfig_();
    config = APP_CONFIG;
  }
  return config;
}

function getAppConfig_() {
  return ensureAppConfig_();
}

function appGetFlag(flagName, defaultValue) {
  if (!flagName) return !!defaultValue;
  const flags = getAppConfig_().FLAGS || {};
  if (Object.prototype.hasOwnProperty.call(flags, flagName)) return !!flags[flagName];
  return !!defaultValue;
}

function appGetCore(key, defaultValue) {
  if (!key) return defaultValue;
  const core = getAppConfig_().CORE || {};
  if (Object.prototype.hasOwnProperty.call(core, key)) return core[key];
  return defaultValue;
}

function appGetJob(key, defaultValue) {
  if (!key) return defaultValue;
  const jobs = getAppConfig_().JOBS || {};
  if (Object.prototype.hasOwnProperty.call(jobs, key)) return jobs[key];
  return defaultValue;
}

function appGetIdempotencyTtlSec() {
  return Number(appGetCore('IDEMPOTENCY_TTL_SEC', 1000)) || 1000;
}

function appGetSafetyTtlSec() {
  return Number(appGetCore('SAFETY_TTL_SEC', 1000)) || 1000;
}

function buildStage7Config_() {
  const app = getAppConfig_();
  return Object.freeze({
    VERSION: '7.1.2-final-clean',
    CURRENT_VERSION: app.CURRENT_VERSION,
    AUDIT_LOG_SHEET: app.CORE.AUDIT_LOG_SHEET,
    AUDIT_HEADER_ROW: app.CORE.AUDIT_HEADER_ROW,
    JOB_RUNTIME_LOG_SHEET: app.CORE.RUNTIME_SHEET,
    RUNTIME_SHEET: app.CORE.RUNTIME_SHEET,
    OPS_LOG_SHEET: app.CORE.OPS_LOG_SHEET,
    ACTIVE_OPERATIONS_SHEET: app.CORE.ACTIVE_OPERATIONS_SHEET,
    CHECKPOINTS_SHEET: app.CORE.CHECKPOINTS_SHEET,
    ACCESS_SHEET: app.CORE.ACCESS_SHEET,
    ALERTS_LOG_SHEET: app.CORE.ALERTS_LOG_SHEET,
    OPS_HOT_RETENTION_DAYS: app.CORE.OPS_HOT_RETENTION_DAYS,
    ACTIVE_STALE_GRACE_HOURS: app.CORE.ACTIVE_STALE_GRACE_HOURS,
    LOG_RETENTION_DAYS: app.CORE.LOG_RETENTION_DAYS,
    AUDIT_RETENTION_DAYS: app.CORE.AUDIT_RETENTION_DAYS,
    JOB_BACKOFF_MINUTES: app.CORE.JOB_BACKOFF_MINUTES,
    JOB_FAILURE_ALERT_THRESHOLD: app.CORE.JOB_FAILURE_ALERT_THRESHOLD,
    MAX_BATCH_ROWS: app.CORE.MAX_BATCH_ROWS,
    MAX_RANGE_DAYS: app.CORE.MAX_RANGE_DAYS,
    MAX_REPAIR_ITEMS: app.CORE.MAX_REPAIR_ITEMS,
    MAX_SAFE_REPAIR_ITEMS: app.CORE.MAX_REPAIR_ITEMS_SAFE,
    MAX_RUNTIME_HISTORY: app.CORE.MAX_RUNTIME_HISTORY,
    MAX_RUNTIME_LOG_ROWS: app.CORE.MAX_RUNTIME_LOG_ROWS,
    LOCK_TIMEOUT_MS: app.CORE.LOCK_TIMEOUT_MS,
    IDEMPOTENCY_TTL_SEC: app.CORE.IDEMPOTENCY_TTL_SEC,
    SAFETY_TTL_SEC: app.CORE.SAFETY_TTL_SEC,
    TEMPLATE_PREVIEW_LIMIT: app.CORE.TEMPLATE_PREVIEW_LIMIT,
    ACTIVE_RUNTIME_MARKER: app.CORE.ACTIVE_RUNTIME_MARKER,
    FEATURE_FLAGS: Object.freeze(Object.assign({}, app.FLAGS)),
    JOBS: Object.freeze(Object.assign({}, app.JOBS)),
    APP: app
  });
}

function ensureStage7Config_() {
  if (!STAGE7_CONFIG || typeof STAGE7_CONFIG !== 'object' || !STAGE7_CONFIG.FEATURE_FLAGS || !STAGE7_CONFIG.JOBS) {
    STAGE7_CONFIG = buildStage7Config_();
  }
  return STAGE7_CONFIG;
}

function getStage7Config_() {
  return ensureStage7Config_();
}

APP_CONFIG = ensureAppConfig_();
STAGE7_CONFIG = ensureStage7Config_();

function stage7GetFeatureFlag_(flagName, defaultValue) {
  if (!flagName) return !!defaultValue;
  const flags = getStage7Config_().FEATURE_FLAGS || {};
  if (Object.prototype.hasOwnProperty.call(flags, flagName)) return !!flags[flagName];
  return !!defaultValue;
}

function stage7NowIso_() {
  return new Date().toISOString();
}

function stage7UniqueId_(prefix) {
  const left = String(prefix || 'op').replace(/[^\w.-]+/g, '_');
  return [
    left,
    Utilities.getUuid().slice(0, 8),
    Utilities.formatDate(
      new Date(),
      (typeof getTimeZone_ === 'function' ? getTimeZone_() : Session.getScriptTimeZone()),
      'yyyyMMdd_HHmmss'
    )
  ].join('_');
}

function stage7SafeStringify_(value, maxLen) {
  const hasExplicitLimit = maxLen !== undefined && maxLen !== null && maxLen !== '';
  const limit = hasExplicitLimit ? Math.max(Number(maxLen) || 0, 0) : 512;
  try {
    const text = JSON.stringify(value === undefined ? null : value);
    return limit > 0 && text.length > limit ? text.slice(0, limit) + '…' : text;
  } catch (e) {
    const fallback = String(value);
    return limit > 0 && fallback.length > limit ? fallback.slice(0, limit) + '…' : fallback;
  }
}

function stage7AsArray_(value) {
  if (Array.isArray(value)) return value.slice();
  if (value === null || value === undefined || value === '') return [];
  return [value];
}

function stage7MergeWarnings_() {
  const merged = [];
  Array.prototype.slice.call(arguments).forEach(function(part) {
    stage7AsArray_(part).forEach(function(item) {
      if (!item) return;
      merged.push(String(item));
    });
  });
  return Array.from(new Set(merged));
}

var AppUtils = (typeof AppUtils !== 'undefined' && AppUtils) ? AppUtils : Object.freeze({
  nowIso: function() { return new Date().toISOString(); },
  generateId: function(prefix) { return stage7UniqueId_(prefix || 'op'); },
  safeStringify: function(value, maxLen) { return stage7SafeStringify_(value, maxLen); },
  asArray: function(value) { return stage7AsArray_(value); },
  mergeWarnings: function() { return stage7MergeWarnings_.apply(null, arguments); }
});

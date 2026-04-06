/**
 * Stage7CompatConfig.gs — legacy compatibility config views and aliases.
 */

var STAGE7_COMPAT_STAGE4_CONFIG = (typeof STAGE7_COMPAT_STAGE4_CONFIG !== 'undefined' && STAGE7_COMPAT_STAGE4_CONFIG) ? STAGE7_COMPAT_STAGE4_CONFIG : null;
var STAGE7_COMPAT_STAGE5_CONFIG = (typeof STAGE7_COMPAT_STAGE5_CONFIG !== 'undefined' && STAGE7_COMPAT_STAGE5_CONFIG) ? STAGE7_COMPAT_STAGE5_CONFIG : null;
var STAGE7A_CONFIG = (typeof STAGE7A_CONFIG !== 'undefined' && STAGE7A_CONFIG) ? STAGE7A_CONFIG : null;

function buildStage4Config_() {
  return Object.freeze({
    VERSION: '4.2.0-compat',
    AUDIT_SHEET: appGetCore('AUDIT_SHEET', 'AUDIT_LOG'),
    AUDIT_HEADER_ROW: appGetCore('AUDIT_HEADER_ROW', 1),
    MAX_BATCH_ROWS: appGetCore('MAX_BATCH_ROWS', 250),
    MAX_RANGE_DAYS: appGetCore('MAX_RANGE_DAYS', 31),
    MAX_REPAIR_ITEMS: appGetCore('MAX_REPAIR_ITEMS', 500),
    LOCK_TIMEOUT_MS: appGetCore('LOCK_TIMEOUT_MS', 15000),
    IDEMPOTENCY_TTL_SEC: appGetIdempotencyTtlSec(),
    TEMPLATE_PREVIEW_LIMIT: appGetCore('TEMPLATE_PREVIEW_LIMIT', 3800),
    FEATURE_FLAGS: Object.freeze({
      stage7UseCases: appGetFlag('stage7UseCases', true),
      auditTrail: appGetFlag('auditTrail', true),
      reconciliation: appGetFlag('reconciliation', true),
      managedTriggers: appGetFlag('managedTriggers', true),
      canonicalMaintenanceApi: appGetFlag('canonicalMaintenanceApi', true),
      safeRepair: appGetFlag('safeRepair', true),
      dryRunByDefaultForRepair: appGetFlag('dryRunByDefaultForRepair', true)
    }),
    JOBS: Object.freeze({
      DAILY_VACATIONS_AND_BIRTHDAYS: appGetJob('DAILY_VACATIONS_AND_BIRTHDAYS', 'dailyVacationsAndBirthdays'),
      SCHEDULED_RECONCILIATION: appGetJob('SCHEDULED_RECONCILIATION', 'scheduledReconciliation'),
      SCHEDULED_HEALTHCHECK: appGetJob('SCHEDULED_HEALTHCHECK', 'scheduledHealthCheck'),
      CLEANUP_CACHES: appGetJob('CLEANUP_CACHES', 'cleanupCaches'),
      POST_CREATE_MONTH_CHECK: appGetJob('POST_CREATE_MONTH_CHECK', 'postCreateMonthCheck'),
      STALE_OPERATION_DETECTOR: appGetJob('STALE_OPERATION_DETECTOR', 'staleOperationDetector'),
      LIFECYCLE_RETENTION_CLEANUP: appGetJob('LIFECYCLE_RETENTION_CLEANUP', 'lifecycleRetentionCleanup'),
      ACCESS_AUDIT_EDIT: appGetJob('ACCESS_AUDIT_EDIT', 'accessAuditEdit'),
      ACCESS_AUDIT_CHANGE: appGetJob('ACCESS_AUDIT_CHANGE', 'accessAuditChange')
    })
  });
}

function getStage4Config_() {
  if (!STAGE7_COMPAT_STAGE4_CONFIG || typeof STAGE7_COMPAT_STAGE4_CONFIG !== 'object' || !STAGE7_COMPAT_STAGE4_CONFIG.FEATURE_FLAGS) {
    STAGE7_COMPAT_STAGE4_CONFIG = buildStage4Config_();
  }
  return STAGE7_COMPAT_STAGE4_CONFIG;
}

function buildStage5Config_() {
  return Object.freeze({
    VERSION: '5.0.2-final-rc2-compat',
    JOB_RUNTIME_SHEET: appGetCore('RUNTIME_SHEET', 'JOB_RUNTIME_LOG'),
    MAX_RUNTIME_HISTORY: appGetCore('MAX_RUNTIME_HISTORY', 50),
    MAX_RUNTIME_LOG_ROWS: appGetCore('MAX_RUNTIME_LOG_ROWS', 500),
    MAX_SAFE_REPAIR_ITEMS: appGetCore('MAX_REPAIR_ITEMS_SAFE', 250),
    AUDIT_SHEET: appGetCore('AUDIT_SHEET', 'AUDIT_LOG'),
    AUDIT_HEADER_ROW: appGetCore('AUDIT_HEADER_ROW', 1),
    LOCK_TIMEOUT_MS: appGetCore('LOCK_TIMEOUT_MS', 15000),
    IDEMPOTENCY_TTL_SEC: appGetIdempotencyTtlSec(),
    MAX_BATCH_ROWS: appGetCore('MAX_BATCH_ROWS', 250),
    MAX_RANGE_DAYS: appGetCore('MAX_RANGE_DAYS', 31),
    MAX_REPAIR_ITEMS: appGetCore('MAX_REPAIR_ITEMS', 500),
    TEMPLATE_PREVIEW_LIMIT: appGetCore('TEMPLATE_PREVIEW_LIMIT', 3800),
    FEATURE_FLAGS: Object.freeze({
      spreadsheetActionApi: appGetFlag('spreadsheetActionApi', true),
      dialogPresentationLayer: appGetFlag('dialogPresentationLayer', true),
      clientModularIncludes: appGetFlag('clientModularIncludes', true),
      clientMonolithicRuntime: appGetFlag('clientMonolithicRuntime', false),
      domainServices: appGetFlag('domainServices', true),
      reconciliation2: appGetFlag('reconciliation2', true),
      jobRuntime: appGetFlag('jobRuntime', true),
      templateGovernance: appGetFlag('templateGovernance', true),
      compatibilitySunset: appGetFlag('compatibilitySunset', true),
      diagnostics3: appGetFlag('diagnostics3', true)
    }),
    JOBS: Object.freeze(Object.assign({}, getStage7Config_().JOBS))
  });
}

function getStage5Config_() {
  if (!STAGE7_COMPAT_STAGE5_CONFIG || typeof STAGE7_COMPAT_STAGE5_CONFIG !== 'object' || !STAGE7_COMPAT_STAGE5_CONFIG.FEATURE_FLAGS) {
    STAGE7_COMPAT_STAGE5_CONFIG = buildStage5Config_();
  }
  return STAGE7_COMPAT_STAGE5_CONFIG;
}

function buildStage6AConfig_() {
  return Object.freeze({
    VERSION: '6A.0.0-hardening',
    SAFETY_TTL_SEC: appGetSafetyTtlSec(),
    ACTIVE_RUNTIME_MARKER: appGetCore('ACTIVE_RUNTIME_MARKER', 'stage7-sidebar-runtime'),
    FEATURE_FLAGS: Object.freeze({
      routingRegistry: appGetFlag('routingRegistry', true),
      safetyRegistry: appGetFlag('safetyRegistry', true),
      enrichedWriteContract: appGetFlag('enrichedWriteContract', true),
      hybridJobRuntimePolicy: appGetFlag('hybridJobRuntimePolicy', true),
      stage7ADomainTests: appGetFlag('stage7ADomainTests', true),
      fullVerboseDiagnostics: appGetFlag('fullVerboseDiagnostics', true)
    })
  });
}

function getStage6AConfig_() {
  if (!STAGE7A_CONFIG || typeof STAGE7A_CONFIG !== 'object' || !STAGE7A_CONFIG.FEATURE_FLAGS) {
    STAGE7A_CONFIG = buildStage6AConfig_();
  }
  return STAGE7A_CONFIG;
}

STAGE7_COMPAT_STAGE4_CONFIG = getStage4Config_();
STAGE7_COMPAT_STAGE5_CONFIG = getStage5Config_();
STAGE7A_CONFIG = getStage6AConfig_();

function stage7AGetFeatureFlag_(flagName, defaultValue) {
  if (!flagName) return !!defaultValue;
  const flags = getStage6AConfig_().FEATURE_FLAGS || {};
  if (Object.prototype.hasOwnProperty.call(flags, flagName)) return !!flags[flagName];
  return !!defaultValue;
}

// -----------------------------------------------------------------------------
// Legacy Stage 4 / Stage 5 / Stage 6A helper aliases
// -----------------------------------------------------------------------------

var STAGE4_CONFIG = (typeof STAGE4_CONFIG !== 'undefined' && STAGE4_CONFIG) ? STAGE4_CONFIG : null;
var STAGE5_CONFIG = (typeof STAGE5_CONFIG !== 'undefined' && STAGE5_CONFIG) ? STAGE5_CONFIG : null;
var STAGE6A_CONFIG = (typeof STAGE6A_CONFIG !== 'undefined' && STAGE6A_CONFIG) ? STAGE6A_CONFIG : null;

function stage4NowIso_() {
  return stage7NowIso_();
}

function stage4UniqueId_(prefix) {
  return stage7UniqueId_(prefix);
}

function stage4SafeStringify_(value) {
  return stage7SafeStringify_(value);
}

function stage4AsArray_(value) {
  return stage7AsArray_(value);
}

function stage4MergeWarnings_() {
  return stage7MergeWarnings_.apply(null, arguments);
}

function stage4GetFeatureFlag_(flagName, fallback) {
  return stage7GetFeatureFlag_(flagName, fallback);
}

function stage5GetFeatureFlag_(flagName, fallback) {
  return stage7GetFeatureFlag_(flagName, fallback);
}

function stage6AGetFeatureFlag_(flagName, fallback) {
  return stage7AGetFeatureFlag_(flagName, fallback);
}

function ensureLegacyStageConfigAliases_() {
  if (!STAGE4_CONFIG) STAGE4_CONFIG = getStage4Config_();
  if (!STAGE5_CONFIG) STAGE5_CONFIG = getStage5Config_();
  if (!STAGE6A_CONFIG) STAGE6A_CONFIG = getStage6AConfig_();
  return true;
}

ensureLegacyStageConfigAliases_();
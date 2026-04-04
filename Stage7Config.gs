/**
 * Stage7Config.gs — unified application configuration for the canonical Stage 7 baseline.
 *
 * APP_CONFIG is the source of truth.
 * STAGE7_CONFIG is the canonical flattened runtime view used by the current code.
 * STAGE7_COMPAT_STAGE4_CONFIG / STAGE7_COMPAT_STAGE5_CONFIG / STAGE7A_CONFIG are compatibility views.
 */

var APP_CONFIG = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG) ? APP_CONFIG : null;
var STAGE7_CONFIG = (typeof STAGE7_CONFIG !== 'undefined' && STAGE7_CONFIG) ? STAGE7_CONFIG : null;
var STAGE7_COMPAT_STAGE4_CONFIG = (typeof STAGE7_COMPAT_STAGE4_CONFIG !== 'undefined' && STAGE7_COMPAT_STAGE4_CONFIG) ? STAGE7_COMPAT_STAGE4_CONFIG : null;
var STAGE7_COMPAT_STAGE5_CONFIG = (typeof STAGE7_COMPAT_STAGE5_CONFIG !== 'undefined' && STAGE7_COMPAT_STAGE5_CONFIG) ? STAGE7_COMPAT_STAGE5_CONFIG : null;
var STAGE7A_CONFIG = (typeof STAGE7A_CONFIG !== 'undefined' && STAGE7A_CONFIG) ? STAGE7A_CONFIG : null;

function buildAppConfig_() {
  return Object.freeze({
    CURRENT_VERSION: '7.1.2-canonical-selfcontained',
    CORE: Object.freeze({
      AUDIT_SHEET: 'AUDIT_LOG',
      AUDIT_HEADER_ROW: 1,
      RUNTIME_SHEET: 'JOB_RUNTIME_LOG',
      OPS_LOG_SHEET: 'OPS_LOG',
      ACTIVE_OPERATIONS_SHEET: 'ACTIVE_OPERATIONS',
      CHECKPOINTS_SHEET: 'CHECKPOINTS',
      ACCESS_SHEET: 'ACCESS',
      ALERTS_SHEET: 'ALERTS_LOG',
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
    VERSION: '7.1.2-canonical-selfcontained',
    CURRENT_VERSION: app.CURRENT_VERSION,
    AUDIT_SHEET: app.CORE.AUDIT_SHEET,
    AUDIT_HEADER_ROW: app.CORE.AUDIT_HEADER_ROW,
    JOB_RUNTIME_SHEET: app.CORE.RUNTIME_SHEET,
    RUNTIME_SHEET: app.CORE.RUNTIME_SHEET,
    OPS_LOG_SHEET: app.CORE.OPS_LOG_SHEET,
    ACTIVE_OPERATIONS_SHEET: app.CORE.ACTIVE_OPERATIONS_SHEET,
    CHECKPOINTS_SHEET: app.CORE.CHECKPOINTS_SHEET,
    ACCESS_SHEET: app.CORE.ACCESS_SHEET,
    ALERTS_SHEET: app.CORE.ALERTS_SHEET,
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

APP_CONFIG = ensureAppConfig_();
STAGE7_CONFIG = ensureStage7Config_();
STAGE7_COMPAT_STAGE4_CONFIG = getStage4Config_();
STAGE7_COMPAT_STAGE5_CONFIG = getStage5Config_();
STAGE7A_CONFIG = getStage6AConfig_();

function stage7GetFeatureFlag_(flagName, defaultValue) {
  if (!flagName) return !!defaultValue;
  const flags = getStage7Config_().FEATURE_FLAGS || {};
  if (Object.prototype.hasOwnProperty.call(flags, flagName)) return !!flags[flagName];
  return !!defaultValue;
}

function stage7AGetFeatureFlag_(flagName, defaultValue) {
  if (!flagName) return !!defaultValue;
  const flags = getStage6AConfig_().FEATURE_FLAGS || {};
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

var LOCK_KEY_PREFIX = (typeof LOCK_KEY_PREFIX !== 'undefined' && LOCK_KEY_PREFIX) ? LOCK_KEY_PREFIX : 'app_lock_';

function getFullLockKey_(lockKey) {
  if (!lockKey || typeof lockKey !== 'string') {
    throw new Error('Невірний ключ блокування');
  }
  return LOCK_KEY_PREFIX + lockKey;
}

function safeAlert_(message) {
  try {
    SpreadsheetApp.getUi().alert(message);
  } catch (e) {
    Logger.log(String(message));
  }
}

function checkLockStore_(store, fullKey, label) {
  const value = store.getProperty(fullKey);
  if (value === null) return false;

  try {
    const parsed = JSON.parse(value);
    const expiresAt = Number(parsed && parsed.expiresAt) || 0;

    if (expiresAt > Date.now()) {
      return true;
    }

    store.deleteProperty(fullKey);
    return false;
  } catch (parseError) {
    store.deleteProperty(fullKey);
    Logger.log('isLocked: видалено битий marker з ' + label + ' ' + fullKey);
    return false;
  }
}

/**
 * Встановлює marker-lock у CacheService, ScriptProperties і DocumentProperties.
 * Це marker-based helper для сумісності, а не повноцінний mutex.
 *
 * @param {string} lockKey
 * @param {number=} ttlSec
 * @returns {boolean}
 */
function setLock(lockKey, ttlSec) {
  try {
    const fullKey = getFullLockKey_(lockKey);
    const effectiveTtl = Math.max(Number(ttlSec) || appGetSafetyTtlSec(), 1);
    const expiresAt = Date.now() + effectiveTtl * 1000;
    const payload = JSON.stringify({
      key: lockKey,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt
    });

    CacheService.getScriptCache().put(fullKey, payload, effectiveTtl);
    PropertiesService.getScriptProperties().setProperty(fullKey, payload);
    PropertiesService.getDocumentProperties().setProperty(fullKey, payload);

    return true;
  } catch (e) {
    Logger.log('Помилка при встановленні блокування ' + lockKey + ': ' + e.message);
    return false;
  }
}

/**
 * Очищує marker-lock у CacheService, ScriptProperties і DocumentProperties.
 *
 * @param {string} lockKey
 * @returns {boolean} true, якщо marker існував і був очищений; false — якщо не існував або сталася помилка.
 */
function releaseLock(lockKey) {
  try {
    const fullKey = getFullLockKey_(lockKey);
    const cache = CacheService.getScriptCache();
    const scriptProps = PropertiesService.getScriptProperties();
    const docProps = PropertiesService.getDocumentProperties();

    const existed =
      cache.get(fullKey) !== null ||
      scriptProps.getProperty(fullKey) !== null ||
      docProps.getProperty(fullKey) !== null;

    cache.remove(fullKey);
    scriptProps.deleteProperty(fullKey);
    docProps.deleteProperty(fullKey);

    Logger.log('Блокування ' + lockKey + ' очищено');
    return existed;
  } catch (e) {
    Logger.log('Помилка при очищенні блокування ' + lockKey + ': ' + e.message);
    return false;
  }
}

/**
 * Перевіряє, чи існує активний marker-lock.
 * Якщо в ScriptProperties або DocumentProperties залишився прострочений
 * або битий marker, він буде автоматично прибраний.
 *
 * @param {string} lockKey
 * @returns {boolean}
 */
function isLocked(lockKey) {
  try {
    const fullKey = getFullLockKey_(lockKey);
    const cache = CacheService.getScriptCache();
    const scriptProps = PropertiesService.getScriptProperties();
    const docProps = PropertiesService.getDocumentProperties();

    if (cache.get(fullKey) !== null) {
      return true;
    }

    if (checkLockStore_(scriptProps, fullKey, 'ScriptProperties')) return true;
    if (checkLockStore_(docProps, fullKey, 'DocumentProperties')) return true;

    return false;
  } catch (e) {
    Logger.log('Помилка при перевірці блокування ' + lockKey + ': ' + e.message);
    return false;
  }
}

/**
 * Намагається встановити marker-lock.
 * Увага: для справжньої атомарності критичних write-операцій все одно потрібен LockService.
 *
 * @param {string} lockKey
 * @param {number=} ttlSec
 * @returns {boolean}
 */
function tryAcquireLock(lockKey, ttlSec) {
  try {
    if (isLocked(lockKey)) return false;
    return setLock(lockKey, ttlSec);
  } catch (e) {
    Logger.log('Помилка при спробі отримати блокування ' + lockKey + ': ' + e.message);
    return false;
  }
}

/**
 * Канонічний helper для справжнього взаємовиключення через LockService.
 * Рекомендований для критичних write-операцій.
 *
 * @param {Function} callback
 * @param {number=} timeoutMs
 * @returns {*}
 */
function withScriptLock_(callback, timeoutMs) {
  const lock = LockService.getScriptLock();
  const waitMs = Math.max(Number(timeoutMs) || appGetCore('LOCK_TIMEOUT_MS', 15000), 1);

  if (!lock.tryLock(waitMs)) {
    throw new Error('Не вдалося отримати script lock за ' + waitMs + ' мс');
  }

  try {
    return callback();
  } finally {
    lock.releaseLock();
  }
}

// ==========================================================
// СЕРВІСНІ ФУНКЦІЇ ДЛЯ ОЧИЩЕННЯ ЗАЛИПЛИХ КЛЮЧІВ
// ==========================================================

/**
 * Повертає true, якщо ключ схожий саме на month-related lock/safety/idempotency marker,
 * який може заважати createNextMonth / switchBotToMonth.
 *
 * @param {string} key
 * @returns {boolean}
 */
function isKnownBlockingKey_(key) {
  if (!key) return false;

  const k = String(key);

  return (
    k.indexOf('createNextMonth') !== -1 ||
    k.indexOf('switchBotToMonth') !== -1 ||
    k.indexOf('STAGE7A:SAFETY:createNextMonth') !== -1 ||
    k.indexOf('STAGE7A:SAFETY:switchBotToMonth') !== -1 ||
    k.indexOf('STAGE7:SAFETY:createNextMonth') !== -1 ||
    k.indexOf('STAGE7:SAFETY:switchBotToMonth') !== -1 ||
    k.indexOf('IDEMPOTENCY:createNextMonth') !== -1 ||
    k.indexOf('IDEMPOTENCY:switchBotToMonth') !== -1 ||
    k.indexOf('app_lock_createNextMonth') === 0 ||
    k.indexOf('app_lock_switchBotToMonth') === 0
  );
}

/**
 * Показує список знайдених потенційно проблемних ключів без видалення.
 *
 * @returns {Object}
 */
function inspectKnownBlockingKeysNow() {
  const scriptProps = PropertiesService.getScriptProperties();
  const docProps = PropertiesService.getDocumentProperties();

  const scriptKeys = Object.keys(scriptProps.getProperties()).filter(isKnownBlockingKey_);
  const docKeys = Object.keys(docProps.getProperties()).filter(isKnownBlockingKey_);

  const lines = []
    .concat(['SCRIPT PROPERTIES:'])
    .concat(scriptKeys.length ? scriptKeys : ['(немає)'])
    .concat(['', 'DOCUMENT PROPERTIES:'])
    .concat(docKeys.length ? docKeys : ['(немає)']);

  Logger.log(lines.join('\n'));

  safeAlert_(
    'Знайдено ключів:\n' +
    'ScriptProperties: ' + scriptKeys.length + '\n' +
    'DocumentProperties: ' + docKeys.length + '\n\n' +
    'Деталі — у Logger.'
  );

  return {
    success: true,
    scriptCount: scriptKeys.length,
    documentCount: docKeys.length,
    scriptKeys: scriptKeys,
    documentKeys: docKeys
  };
}

/**
 * Очищає відомі month-related lock/safety/idempotency ключі,
 * які можуть блокувати створення нового місяця або перемикання бота.
 *
 * @returns {Object}
 */
function clearCreateNextMonthLocksNow() {
  const scriptProps = PropertiesService.getScriptProperties();
  const docProps = PropertiesService.getDocumentProperties();

  const allScript = scriptProps.getProperties();
  const allDoc = docProps.getProperties();

  const removedScript = [];
  const removedDoc = [];

  Object.keys(allScript).forEach(function(key) {
    if (isKnownBlockingKey_(key)) {
      scriptProps.deleteProperty(key);
      removedScript.push(key);
    }
  });

  Object.keys(allDoc).forEach(function(key) {
    if (isKnownBlockingKey_(key)) {
      docProps.deleteProperty(key);
      removedDoc.push(key);
    }
  });

  const total = removedScript.length + removedDoc.length;

  Logger.log(
    [
      '=== clearCreateNextMonthLocksNow ===',
      'Removed from ScriptProperties: ' + removedScript.length,
      removedScript.join('\n') || '(none)',
      '',
      'Removed from DocumentProperties: ' + removedDoc.length,
      removedDoc.join('\n') || '(none)',
      '',
      'Total removed: ' + total
    ].join('\n')
  );

  safeAlert_(
    'Очищено ключів блокування: ' + total +
    '\nScriptProperties: ' + removedScript.length +
    '\nDocumentProperties: ' + removedDoc.length +
    '\n\nДеталі — у Logger.'
  );

  return {
    success: true,
    removed: total,
    removedScript: removedScript,
    removedDocument: removedDoc
  };
}

function clearKnownBlockingCacheLocksNow() {
  const cache = CacheService.getScriptCache();
  const knownKeys = [
    'app_lock_createNextMonth',
    'app_lock_switchBotToMonth'
  ];

  knownKeys.forEach(function(key) {
    cache.remove(key);
  });

  safeAlert_(
    'Очищено cache-lock ключі: ' + knownKeys.length +
    '\n' + knownKeys.join('\n')
  );

  return {
    success: true,
    removedCacheKeys: knownKeys
  };
}

// -----------------------------------------------------------------------------
// Legacy Stage 4 / Stage 5 / Stage 6A helper aliases kept for wider-project
// compatibility when the old config files are removed.
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

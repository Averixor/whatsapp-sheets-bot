/**
 * Stage4Config.gs — уніфікована конфігурація застосунку
 *
 * APP_CONFIG - єдине джерело правди
 * STAGE4_CONFIG / STAGE5_CONFIG / STAGE6A_CONFIG - містки сумісності
 *
 * Оновлено: додано функції для роботи з блокуваннями (marker-based + LockService)
 * Рекомендована схема для критичних операцій:
 *
 * function criticalOperation() {
 *   return withScriptLock_(function() {
 *     if (!tryAcquireLock('opName', ttlSec)) throw new Error('Вже виконується');
 *     try {
 *       // логіка
 *     } finally {
 *       releaseLock('opName');
 *     }
 *   }, timeoutMs);
 * }
 */

// ==========================================================
// КАНОНІЧНА КОНФІГУРАЦІЯ
// ==========================================================

var APP_CONFIG = (typeof APP_CONFIG !== 'undefined') ? APP_CONFIG : null;
var STAGE4_CONFIG = (typeof STAGE4_CONFIG !== 'undefined') ? STAGE4_CONFIG : null;
var STAGE5_CONFIG = (typeof STAGE5_CONFIG !== 'undefined') ? STAGE5_CONFIG : null;
var STAGE6A_CONFIG = (typeof STAGE6A_CONFIG !== 'undefined') ? STAGE6A_CONFIG : null;

function buildAppConfig_() {
  return Object.freeze({
    CURRENT_VERSION: '7.1.1-reliability-hardened-merged',

    CORE: Object.freeze({
      AUDIT_SHEET: 'AUDIT_LOG',
      AUDIT_HEADER_ROW: 1,
      RUNTIME_SHEET: 'JOB_RUNTIME_LOG',

      OPS_LOG_SHEET: 'OPS_LOG',
      ACTIVE_OPERATIONS_SHEET: 'ACTIVE_OPERATIONS',
      CHECKPOINTS_SHEET: 'CHECKPOINTS',
      OPS_HOT_RETENTION_DAYS: 180,
      ACTIVE_STALE_GRACE_HOURS: 48,

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
      // Stage 4
      stage4UseCases: true,
      auditTrail: true,
      reconciliation: true,
      managedTriggers: true,
      canonicalMaintenanceApi: true,
      safeRepair: true,
      dryRunByDefaultForRepair: true,

      // Stage 5
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

      // Stage 7
      stage7OperationLifecycle: true,
      stage7SidebarFirst: true,
      stage7StaleDetector: true,
      stage7RepairFlow: true,

      // Stage 6A
      routingRegistry: true,
      safetyRegistry: true,
      enrichedWriteContract: true,
      hybridJobRuntimePolicy: true,
      stage6ADomainTests: true,
      fullVerboseDiagnostics: true
    }),

    JOBS: Object.freeze({
      DAILY_VACATIONS_AND_BIRTHDAYS: 'dailyVacationsAndBirthdays',
      SCHEDULED_RECONCILIATION: 'scheduledReconciliation',
      SCHEDULED_HEALTHCHECK: 'scheduledHealthCheck',
      CLEANUP_CACHES: 'cleanupCaches',
      POST_CREATE_MONTH_CHECK: 'postCreateMonthCheck',
      STALE_OPERATION_DETECTOR: 'staleOperationDetector',
      LIFECYCLE_RETENTION_CLEANUP: 'lifecycleRetentionCleanup'
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

// ==========================================================
// ФУНКЦІЇ ДОСТУПУ
// ==========================================================

function appGetFlag(flagName, defaultValue) {
  if (!flagName) return !!defaultValue;

  const flags = getAppConfig_().FLAGS || {};
  if (Object.prototype.hasOwnProperty.call(flags, flagName)) {
    return !!flags[flagName];
  }

  return !!defaultValue;
}

function appGetCore(key, defaultValue) {
  if (!key) return defaultValue;

  const core = getAppConfig_().CORE || {};
  if (Object.prototype.hasOwnProperty.call(core, key)) {
    return core[key];
  }

  return defaultValue;
}

function appGetJob(key, defaultValue) {
  if (!key) return defaultValue;

  const jobs = getAppConfig_().JOBS || {};
  if (Object.prototype.hasOwnProperty.call(jobs, key)) {
    return jobs[key];
  }

  return defaultValue;
}

function appGetIdempotencyTtlSec() {
  return Number(appGetCore('IDEMPOTENCY_TTL_SEC', 1000)) || 1000;
}

function appGetSafetyTtlSec() {
  return Number(appGetCore('SAFETY_TTL_SEC', 1000)) || 1000;
}

// ==========================================================
// МІСТКИ СУМІСНОСТІ
// ==========================================================

function buildStage4Config_() {
  return Object.freeze({
    VERSION: '4.2.0',
    AUDIT_SHEET: appGetCore('AUDIT_SHEET', 'AUDIT_LOG'),
    AUDIT_HEADER_ROW: appGetCore('AUDIT_HEADER_ROW', 1),
    MAX_BATCH_ROWS: appGetCore('MAX_BATCH_ROWS', 250),
    MAX_RANGE_DAYS: appGetCore('MAX_RANGE_DAYS', 31),
    MAX_REPAIR_ITEMS: appGetCore('MAX_REPAIR_ITEMS', 500),
    LOCK_TIMEOUT_MS: appGetCore('LOCK_TIMEOUT_MS', 15000),
    IDEMPOTENCY_TTL_SEC: appGetIdempotencyTtlSec(),
    TEMPLATE_PREVIEW_LIMIT: appGetCore('TEMPLATE_PREVIEW_LIMIT', 3800),

    FEATURE_FLAGS: Object.freeze({
      stage4UseCases: appGetFlag('stage4UseCases', true),
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
      LIFECYCLE_RETENTION_CLEANUP: appGetJob('LIFECYCLE_RETENTION_CLEANUP', 'lifecycleRetentionCleanup')
    })
  });
}

function buildStage5Config_() {
  return Object.freeze({
    VERSION: '5.0.2-final-rc2',
    JOB_RUNTIME_SHEET: appGetCore('RUNTIME_SHEET', 'JOB_RUNTIME_LOG'),
    MAX_RUNTIME_HISTORY: appGetCore('MAX_RUNTIME_HISTORY', 50),
    MAX_RUNTIME_LOG_ROWS: appGetCore('MAX_RUNTIME_LOG_ROWS', 500),
    MAX_SAFE_REPAIR_ITEMS: appGetCore('MAX_REPAIR_ITEMS_SAFE', 250),

    FEATURE_FLAGS: Object.freeze({
      spreadsheetActionApi: appGetFlag('spreadsheetActionApi', true),
      dialogPresentationLayer: appGetFlag('dialogPresentationLayer', true),
      clientModularIncludes: appGetFlag('clientModularIncludes', false),
      clientMonolithicRuntime: appGetFlag('clientMonolithicRuntime', true),
      domainServices: appGetFlag('domainServices', true),
      reconciliation2: appGetFlag('reconciliation2', true),
      jobRuntime: appGetFlag('jobRuntime', true),
      templateGovernance: appGetFlag('templateGovernance', true),
      compatibilitySunset: appGetFlag('compatibilitySunset', true),
      diagnostics3: appGetFlag('diagnostics3', true)
    })
  });
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
      stage6ADomainTests: appGetFlag('stage6ADomainTests', true),
      fullVerboseDiagnostics: appGetFlag('fullVerboseDiagnostics', true)
    })
  });
}

function getStage4Config_() {
  if (!STAGE4_CONFIG || typeof STAGE4_CONFIG !== 'object' || !STAGE4_CONFIG.JOBS || !STAGE4_CONFIG.FEATURE_FLAGS) {
    STAGE4_CONFIG = buildStage4Config_();
  }
  return STAGE4_CONFIG;
}

function getStage5Config_() {
  if (!STAGE5_CONFIG || typeof STAGE5_CONFIG !== 'object' || !STAGE5_CONFIG.FEATURE_FLAGS) {
    STAGE5_CONFIG = buildStage5Config_();
  }
  return STAGE5_CONFIG;
}

function getStage6AConfig_() {
  if (!STAGE6A_CONFIG || typeof STAGE6A_CONFIG !== 'object' || !STAGE6A_CONFIG.FEATURE_FLAGS) {
    STAGE6A_CONFIG = buildStage6AConfig_();
  }
  return STAGE6A_CONFIG;
}

STAGE4_CONFIG = getStage4Config_();
STAGE5_CONFIG = getStage5Config_();
STAGE6A_CONFIG = getStage6AConfig_();

// ==========================================================
// ФУНКЦІЇ ДОСТУПУ ДЛЯ СУМІСНОСТІ
// ==========================================================

function stage4GetFeatureFlag_(flagName, defaultValue) {
  if (!flagName) return !!defaultValue;
  const flags = getStage4Config_().FEATURE_FLAGS || {};
  if (Object.prototype.hasOwnProperty.call(flags, flagName)) return !!flags[flagName];
  return !!defaultValue;
}

function stage5GetFeatureFlag_(flagName, defaultValue) {
  if (!flagName) return !!defaultValue;
  const flags = getStage5Config_().FEATURE_FLAGS || {};
  if (Object.prototype.hasOwnProperty.call(flags, flagName)) return !!flags[flagName];
  return !!defaultValue;
}

function stage6AGetFeatureFlag_(flagName, defaultValue) {
  if (!flagName) return !!defaultValue;
  const flags = getStage6AConfig_().FEATURE_FLAGS || {};
  if (Object.prototype.hasOwnProperty.call(flags, flagName)) return !!flags[flagName];
  return !!defaultValue;
}

// ==========================================================
// ЗАСТАРІЛІ УТИЛІТИ (ЗБЕРЕЖЕНІ ДЛЯ СУМІСНОСТІ)
// ==========================================================

function stage4NowIso_() {
  return new Date().toISOString();
}

function stage4UniqueId_(prefix) {
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

function stage4SafeStringify_(value, maxLen) {
  const hasExplicitLimit =
    maxLen !== undefined &&
    maxLen !== null &&
    maxLen !== '';

  const limit = hasExplicitLimit
    ? Math.max(Number(maxLen) || 0, 0)
    : 512;

  try {
    const text = JSON.stringify(value === undefined ? null : value);
    return limit > 0 && text.length > limit
      ? text.slice(0, limit) + '…'
      : text;
  } catch (e) {
    const fallback = String(value);
    return limit > 0 && fallback.length > limit
      ? fallback.slice(0, limit) + '…'
      : fallback;
  }
}

function stage4AsArray_(value) {
  if (Array.isArray(value)) return value.slice();
  if (value === null || value === undefined || value === '') return [];
  return [value];
}

function stage4MergeWarnings_() {
  const merged = [];

  Array.prototype.slice.call(arguments).forEach(function(part) {
    stage4AsArray_(part).forEach(function(item) {
      if (!item) return;
      merged.push(String(item));
    });
  });

  return Array.from(new Set(merged));
}

// ==========================================================
// КАНОНІЧНІ УТИЛІТИ
// ==========================================================

var AppUtils = (typeof AppUtils !== 'undefined' && AppUtils) ? AppUtils : Object.freeze({
  nowIso: function() {
    return new Date().toISOString();
  },

  generateId: function(prefix) {
    return stage4UniqueId_(prefix || 'op');
  },

  safeStringify: function(value, maxLen) {
    return stage4SafeStringify_(value, maxLen);
  },

  asArray: function(value) {
    return stage4AsArray_(value);
  },

  mergeWarnings: function() {
    return stage4MergeWarnings_.apply(null, arguments);
  }
});

// ==========================================================
// ФУНКЦІЇ ДЛЯ РОБОТИ З БЛОКУВАННЯМИ
// ==========================================================

/** Префікс для ключів marker-lock у кеші/сховищі. */
var LOCK_KEY_PREFIX = (typeof LOCK_KEY_PREFIX !== 'undefined' && LOCK_KEY_PREFIX) ? LOCK_KEY_PREFIX : 'app_lock_';

/**
 * Нормалізує повний ключ marker-lock.
 *
 * @param {string} lockKey
 * @returns {string}
 * @private
 */
function getFullLockKey_(lockKey) {
  if (!lockKey || typeof lockKey !== 'string') {
    throw new Error('Невірний ключ блокування');
  }
  return LOCK_KEY_PREFIX + lockKey;
}

/**
 * Безпечний alert: у ручному UI показує alert, без UI — пише у Logger.
 *
 * @param {string} message
 */
function safeAlert_(message) {
  try {
    SpreadsheetApp.getUi().alert(message);
  } catch (e) {
    Logger.log(String(message));
  }
}

/**
 * Перевіряє marker-lock у вказаному store.
 * Якщо marker прострочений або битий — автоматично видаляє.
 *
 * @param {*} store
 * @param {string} fullKey
 * @param {string} label
 * @returns {boolean}
 * @private
 */
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
    k.indexOf('STAGE6A:SAFETY:createNextMonth') !== -1 ||
    k.indexOf('STAGE6A:SAFETY:switchBotToMonth') !== -1 ||
    k.indexOf('STAGE4:SAFETY:createNextMonth') !== -1 ||
    k.indexOf('STAGE4:SAFETY:switchBotToMonth') !== -1 ||
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
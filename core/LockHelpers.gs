/**
 * LockHelpers.gs — marker locks, script lock, and stuck-key cleanup helpers.
 */

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
 * Для справжньої атомарності критичних write-операцій потрібен LockService.
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
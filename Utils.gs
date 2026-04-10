/**
 * Utils.gs — спільні утиліти для WhatsAppBot
 */

function getTimeZone_() {
  return DateUtils_.getTimeZone();
}

function _todayStr_() {
  return DateUtils_.todayStr();
}

/** @deprecated Використовуйте DateUtils_.parseUaDate() */
function _parseUaDate_(dateStr) {
  return DateUtils_.parseUaDate(dateStr);
}

/** @deprecated Використовуйте DateUtils_.normalizeDate() */
function normalizeDate_(value, displayValue) {
  return DateUtils_.normalizeDate(value, displayValue);
}

/** @deprecated Використовуйте DateUtils_.parseDateAny() */
function _parseDate_(value) {
  if (typeof _veParseDate_ === 'function') {
    return _veParseDate_(value);
  }
  return DateUtils_.parseDateAny(value);
}

function _vacationWordToNumber_(word) {
  if (typeof _veVacationWordToNumber_ === 'function') {
    return _veVacationWordToNumber_(word);
  }
  return String(word || '').trim();
}

function _numberToVacationWord_(num) {
  if (typeof _veNumberToVacationWord_ === 'function') {
    return _veNumberToVacationWord_(num);
  }
  return String(num || '').trim();
}

function normalizeFIO_(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/['’ʼ`"]/g, '')
    .replace(/\s+/g, ' ');
}

function _normCallsignKey_(callsign) {
  return String(callsign || '').trim().toUpperCase();
}

function _normFio_(s) {
  if (!s) return '';
  return String(s)
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase()
    .replace(/[’'`"ʼ]/g, "'");
}

function _normFioForProfiles_(s) {
  return _normFio_(s);
}

function _normFioVac_(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[’'`"]/g, '')
    .replace(/\s+/g, ' ');
}

function normalizePhone_(v) {
  let s = String(v == null ? '' : v).replace(/\D/g, '');
  if (!s) return '';
  if (s.length === 10 && s[0] === '0') s = '38' + s;
  if (s.length === 12 && s.startsWith('380')) return '+' + s;
  return s ? ('+' + s.replace(/^\+/, '')) : '';
}

function loadPhonesProfiles_() {
  const empty = { byCallsign: {}, byFio: {}, byNorm: {}, byRole: {}, items: [], versionMarker: 'stage7-phones-profiles-v3' };
  if (typeof loadPhonesIndex_ !== 'function') {
    return empty;
  }

  const cache = CacheService.getScriptCache();
  const primaryKey = cacheKeyPhonesProfiles_();
  const legacyKeys = [primaryKey, 'PHONES_PROFILES_v4'].filter(Boolean);

  for (let i = 0; i < legacyKeys.length; i++) {
    const key = legacyKeys[i];
    const cached = cache.get(key);
    if (!cached) continue;
    try {
      const parsed = JSON.parse(cached);
      if (parsed && typeof parsed === 'object' && parsed.byFio && parsed.byNorm && parsed.byRole && parsed.byCallsign) {
        return parsed;
      }
    } catch (e) {}
  }

  const index = loadPhonesIndex_();
  const out = {
    byCallsign: {},
    byFio: {},
    byNorm: {},
    byRole: {},
    items: Array.isArray(index.items) ? index.items.slice() : [],
    versionMarker: 'stage7-phones-profiles-v3'
  };

  (index.items || []).forEach(function(item) {
    if (!item || typeof item !== 'object') return;
    const fioKey = _normFioForProfiles_(item.fio || '');
    const normKey = normalizeFIO_(item.fio || '');
    const callsignKey = _normCallsignKey_(item.callsign || item.role || '');
    const roleKey = _normCallsignKey_(item.role || item.callsign || '');

    if (fioKey) out.byFio[fioKey] = item;
    if (normKey) out.byNorm[normKey] = item;
    if (callsignKey) out.byCallsign[callsignKey] = item;
    if (roleKey) out.byRole[roleKey] = item;
  });

  try {
    const ttl = (typeof CONFIG !== 'undefined' && CONFIG && Number(CONFIG.CACHE_TTL_SEC)) ? Number(CONFIG.CACHE_TTL_SEC) : 300;
    const json = JSON.stringify(out);
    if (json.length < 90000) {
      cache.put(primaryKey, json, ttl);
    }
  } catch (e) {}

  return out;
}

function getDisplayName_(personOrName) {
  try {
    if (!personOrName) return '';
    if (typeof personOrName === 'string') {
      const fio = personOrName.trim();
      const parts = fio.split(/\s+/).filter(Boolean);
      return parts[1] || parts[0] || '';
    }
    const person = personOrName;
    if (person.callsign && String(person.callsign).trim()) return String(person.callsign).trim();
    if (person.role && String(person.role).trim()) return String(person.role).trim();
    const fio = String(person.fio || '').trim();
    if (!fio) return '';
    const parts = fio.split(/\s+/).filter(Boolean);
    return parts[1] || parts[0] || '';
  } catch (e) {
    console.error('Помилка getDisplayName_:', e);
    return '';
  }
}



function trimToEncoded_(text, maxLen) {
  const source = String(text || '');
  if (!source) return '';
  if (encodeURIComponent(source).length <= maxLen) return source;
  let result = '';
  for (const ch of source) {
    const candidate = result + ch;
    if (encodeURIComponent(candidate).length > maxLen) break;
    result = candidate;
  }
  return result;
}

function unique_(arr) {
  return [...new Set((arr || []).map(String))];
}

function a1FromRowCol_(row, col) {
  let letters = '';
  let c = col;
  while (c > 0) {
    const rem = (c - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    c = Math.floor((c - 1) / 26);
  }
  return letters + row;
}

function rangesIntersect_(r1, r2) {
  return r1.getLastRow() >= r2.getRow() &&
    r1.getRow() <= r2.getLastRow() &&
    r1.getLastColumn() >= r2.getColumn() &&
    r1.getColumn() <= r2.getLastColumn();
}

function ensureSheet_(name) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}

function ensureLogHeader_(sheet) {
  if (sheet.getLastRow() > 0) return;
  sheet.appendRow(['Час', 'Дата звіту', 'Аркуш', 'Клітинка', 'ПІБ', 'Телефон', 'Код', 'Послуга', 'Місце', 'Завдання', 'Повідомлення', 'Посилання']);
  sheet.getRange(1, 1, 1, 12).setFontWeight('bold').setBackground('#f0f0f0');
}

function cacheKeyPhones_() { return `PHONES_FLAT_V2_${SpreadsheetApp.getActive().getId()}`; }
function cacheKeyPhonesIndex_() { return `PHONES_INDEX_V2_${SpreadsheetApp.getActive().getId()}`; }
function cacheKeyPhonesProfiles_() { return `PHONES_PROFILES_V2_${SpreadsheetApp.getActive().getId()}`; }
function cacheKeyDict_() { return `DICT_${SpreadsheetApp.getActive().getId()}`; }
function cacheKeyDictSum_() { return `DICT_SUM_${SpreadsheetApp.getActive().getId()}`; }
function cacheKeyTemplates_() { return `TEMPLATES_${SpreadsheetApp.getActive().getId()}`; }

function _safeLoadPhonesMap_() {
  try {
    if (typeof loadPhonesMap_ === 'function') return loadPhonesMap_();
  } catch (e) {
    console.error('Помилка loadPhonesMap_:', e);
  }
  return {};
}

function _getPhoneByFio_(fio) {
  if (!fio) return '';
  try {
    if (typeof findPhone_ === 'function') {
      return findPhone_({ fio: fio });
    }
    const phonesMap = _safeLoadPhonesMap_();
    const raw = String(fio || '').trim();
    const norm = normalizeFIO_(raw);
    return phonesMap[raw] || phonesMap[norm] || '';
  } catch (e) {
    console.error('Помилка _getPhoneByFio_:', e);
    return '';
  }
}

function _getCallsignByFio_(fio) {
  if (!fio) return '';
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const phonesSheet = ss.getSheetByName(CONFIG.PHONES_SHEET);
    if (!phonesSheet || phonesSheet.getLastRow() < 2) return '';
    const data = phonesSheet.getRange(2, 1, phonesSheet.getLastRow() - 1, 3).getValues();
    const normFio = normalizeFIO_(fio);
    for (const row of data) {
      const rowFio = normalizeFIO_(row[0] || '');
      if (rowFio === normFio) return String(row[2] || '').trim();
    }
  } catch (e) {
    console.error('Помилка _getCallsignByFio_:', e);
  }
  return '';
}

function clearCacheCore_() {
  CacheService.getScriptCache().removeAll([
    'PHONES_' + SpreadsheetApp.getActive().getId(),
    cacheKeyPhones_(),
    cacheKeyPhonesIndex_(),
    cacheKeyPhonesProfiles_(),
    cacheKeyDict_(),
    cacheKeyDictSum_(),
    cacheKeyTemplates_(),
    'PHONES_PROFILES_v4',
    'TPL_MAP_V1'
  ]);
}

function waClearCache() {
  clearCacheCore_();
  SpreadsheetApp.getUi().alert('✓ Кеш очищено');
}

function _clearSheetDataPreserveHeaders_(sheetName, headerRows, ensureFn) {
  const sh = SpreadsheetApp.getActive().getSheetByName(sheetName);
  if (!sh) {
    return { sheet: sheetName, cleared: false, exists: false, rowsCleared: 0 };
  }
  const keepRows = Math.max(Number(headerRows) || 1, 1);
  const lastRow = sh.getLastRow();
  const lastCol = Math.max(sh.getLastColumn(), 1);
  const rowsCleared = Math.max(lastRow - keepRows, 0);
  if (rowsCleared > 0) {
    sh.getRange(keepRows + 1, 1, rowsCleared, lastCol).clearContent();
  }
  if (typeof ensureFn === 'function') {
    try { ensureFn(sh); } catch (_) {}
  }
  return { sheet: sheetName, cleared: true, exists: true, rowsCleared: rowsCleared };
}

function clearLogCore_() {
  const targets = [
    { name: CONFIG.LOG_SHEET || 'LOG', headerRows: 1, ensure: function(sh) { try { ensureLogHeader_(sh); } catch (_) {} } },
    { name: (typeof STAGE7_CONFIG !== 'undefined' ? (STAGE7_CONFIG.AUDIT_SHEET || 'AUDIT_LOG') : 'AUDIT_LOG'), headerRows: (typeof STAGE7_CONFIG !== 'undefined' ? (STAGE7_CONFIG.AUDIT_HEADER_ROW || 1) : 1), ensure: function() { try { ensureAuditTrailSheet_(); } catch (_) {} } },
    { name: (typeof appGetCore === 'function' ? appGetCore('ALERTS_SHEET', 'ALERTS_LOG') : 'ALERTS_LOG'), headerRows: 1, ensure: function() { try { AlertsRepository_.ensureSheet(); } catch (_) {} } },
    { name: (typeof STAGE7_CONFIG !== 'undefined' ? (STAGE7_CONFIG.JOB_RUNTIME_SHEET || 'JOB_RUNTIME_LOG') : 'JOB_RUNTIME_LOG'), headerRows: 1, ensure: function() { try { JobRuntimeRepository_.ensureSheet(); } catch (_) {} } },
    { name: (typeof appGetCore === 'function' ? appGetCore('OPS_LOG_SHEET', 'OPS_LOG') : 'OPS_LOG'), headerRows: 1 },
    { name: (typeof appGetCore === 'function' ? appGetCore('ACTIVE_OPERATIONS_SHEET', 'ACTIVE_OPERATIONS') : 'ACTIVE_OPERATIONS'), headerRows: 1 },
    { name: (typeof appGetCore === 'function' ? appGetCore('CHECKPOINTS_SHEET', 'CHECKPOINTS') : 'CHECKPOINTS'), headerRows: 1 }
  ];

  const clearedSheets = [];
  const missingSheets = [];
  const details = [];
  targets.forEach(function(target) {
    const item = _clearSheetDataPreserveHeaders_(target.name, target.headerRows, target.ensure);
    details.push(item);
    if (item.cleared) clearedSheets.push(item.sheet);
    else missingSheets.push(item.sheet);
  });

  let runtimeStorage = null;
  try {
    if (typeof JobRuntimeRepository_ === 'object' && JobRuntimeRepository_ && typeof JobRuntimeRepository_.clearStorage === 'function') {
      runtimeStorage = JobRuntimeRepository_.clearStorage();
    }
  } catch (_) {
    runtimeStorage = { success: false };
  }

  return {
    cleared: clearedSheets.length > 0,
    clearedSheets: clearedSheets,
    missingSheets: missingSheets,
    details: details,
    runtimeStorage: runtimeStorage
  };
}

function clearLogSheet() {
  const ui = SpreadsheetApp.getUi();
  if (ui.alert('🧹 Очистити LOG?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  const result = clearLogCore_();
  if (result && result.cleared) ui.alert('✓ Логи очищено');
  else ui.alert('✕ Жоден лог-аркуш не знайдено');
}

function clearPhoneCache() {
  try {
    CacheService.getScriptCache().removeAll([
      cacheKeyPhones_(),
      cacheKeyPhonesIndex_(),
      cacheKeyPhonesProfiles_(),
      'PHONES_PROFILES_v4',
      'TPL_MAP_V1'
    ]);
    return { success: true, message: 'Кеш телефонів очищено' };
  } catch (e) {
    return { success: false, error: e && e.message ? e.message : String(e) };
  }
}

function clearCacheSidebar() {
  try {
    clearCacheCore_();
    return { success: true, message: 'Кеш очищено' };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function clearLogSidebar() {
  try {
    const result = clearLogCore_();
    if (!result || !result.cleared) throw new Error('Жоден лог-аркуш не знайдено');
    return { success: true, message: 'Логи очищено', data: result };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

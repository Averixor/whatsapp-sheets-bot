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
  const cache = CacheService.getScriptCache();
  const key = 'PHONES_PROFILES_v4';
  const cached = cache.get(key);
  if (cached) {
    try { return JSON.parse(cached); } catch (e) { }
  }

  const out = { byCallsign: {}, byFio: {} };
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(CONFIG.PHONES_SHEET);
  if (!sh || sh.getLastRow() < 2) return out;

  const values = sh.getDataRange().getValues();
  const head = values[0].map(v => String(v || '').trim().toLowerCase());
  const findCol = pred => {
    const idx = head.findIndex(pred);
    return idx >= 0 ? idx + 1 : null;
  };

  const cFio = findCol(h => h.includes('піб') || h.includes('фіо') || h.includes('фио')) || 1;
  const cPhone = findCol(h => h.includes('тел') || h.includes('phone')) || 2;
  const cRole = findCol(h => h.includes('роль') || h.includes('позив') || h.includes('callsign')) || 3;
  const cBirth = findCol(h => h.includes('дн') || h.includes('д.н') || h.includes('дата народ') || h.includes('день народ') || h.includes('birthday')) || 4;

  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const fio = String(row[cFio - 1] || '').trim();
    const rawPhone = String(row[cPhone - 1] || '').trim();
    const role = String(row[cRole - 1] || '').trim();
    const birthRaw = row[cBirth - 1];
    if (!fio && !role) continue;

    const phone = normalizePhone_(rawPhone);
    let birthday = '';

    if (birthRaw instanceof Date && !isNaN(birthRaw.getTime())) {
      birthday = Utilities.formatDate(birthRaw, getTimeZone_(), 'dd.MM.yyyy');
    } else {
      const s = String(birthRaw || '').trim();
      if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(s)) {
        const parts = s.split('.');
        birthday = `${String(parts[0]).padStart(2, '0')}.${String(parts[1]).padStart(2, '0')}.${parts[2]}`;
      } else if (/^\d{1,2}\.\d{1,2}$/.test(s)) {
        const parts = s.split('.');
        birthday = `${String(parts[0]).padStart(2, '0')}.${String(parts[1]).padStart(2, '0')}`;
      }
    }

    const item = { fio, phone, role, birthday };
    const fioKey = _normFioForProfiles_(fio);
    const roleKey = _normCallsignKey_(role);

    if (fioKey) out.byFio[fioKey] = item;
    if (roleKey) out.byCallsign[roleKey] = item;
  }

  const json = JSON.stringify(out);
  if (json.length < 90000) cache.put(key, json, (CONFIG && CONFIG.CACHE_TTL_SEC) ? CONFIG.CACHE_TTL_SEC : 300);
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

function cacheKeyPhones_() { return `PHONES_${SpreadsheetApp.getActive().getId()}`; }
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
    cacheKeyPhones_(),
    cacheKeyDict_(),
    cacheKeyDictSum_(),
    cacheKeyTemplates_(),
    'PHONES_PROFILES_v4'
  ]);
}

function waClearCache() {
  clearCacheCore_();
  SpreadsheetApp.getUi().alert('✅ Кеш очищено');
}

function clearLogCore_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(CONFIG.LOG_SHEET);
  if (!sh) return false;
  const lastRow = sh.getLastRow();
  const lastCol = Math.max(sh.getLastColumn(), 1);
  if (lastRow > 1) sh.getRange(2, 1, lastRow - 1, lastCol).clearContent();
  ensureLogHeader_(sh);
  return true;
}

function clearLogSheet() {
  const ui = SpreadsheetApp.getUi();
  if (ui.alert('🧹 Очистити LOG?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  if (clearLogCore_()) ui.alert('✅ Лог очищено');
  else ui.alert('❌ LOG не знайдено');
}

function clearPhoneCache() {
  try {
    CacheService.getScriptCache().removeAll([cacheKeyPhones_(), 'PHONES_PROFILES_v4']);
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
    if (!clearLogCore_()) throw new Error('LOG не знайдено');
    return { success: true, message: 'Лог очищено' };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}
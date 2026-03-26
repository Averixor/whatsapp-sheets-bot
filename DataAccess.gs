/**
 * DataAccess.gs — canonical data-access layer для stage 3.
 */

const DataAccess_ = (function() {
  function getSpreadsheet() {
    return SpreadsheetApp.getActive();
  }

  function getSheet(schemaKey, explicitSheetName, required) {
    const name = SheetSchemas_.resolveSheetName(schemaKey, explicitSheetName);
    const sheet = getSpreadsheet().getSheetByName(name);
    if (!sheet && required !== false) {
      throw new Error(`Аркуш "${name}" (${schemaKey}) не знайдено`);
    }
    return sheet || null;
  }

  function ensureSheet(schemaKey, explicitSheetName) {
    const ss = getSpreadsheet();
    const name = SheetSchemas_.resolveSheetName(schemaKey, explicitSheetName);
    let sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    return sheet;
  }

  function getLastDataRow(sheet, schema) {
    if (!sheet) return 0;
    const start = Number(schema.dataStartRow) || 2;
    const last = sheet.getLastRow();
    return last >= start ? last : 0;
  }

  function getDataRowCount(sheet, schema) {
    const last = getLastDataRow(sheet, schema);
    return last ? (last - (schema.dataStartRow - 1)) : 0;
  }

  function getMaxSchemaColumn(schema) {
    return Math.max.apply(null, Object.keys(schema.columns || {}).map(function(key) {
      return Number(schema.columns[key]) || 0;
    }).concat([1]));
  }

  function readRows(schemaKey, options) {
    const opts = options || {};
    const schema = SheetSchemas_.get(schemaKey);
    const sheet = getSheet(schemaKey, opts.sheetName, opts.required !== false && schema.required !== false);
    if (!sheet) return [];

    const count = getDataRowCount(sheet, schema);
    if (!count) return [];

    const width = Math.max(Number(opts.width) || 0, getMaxSchemaColumn(schema));
    const values = opts.displayValues
      ? sheet.getRange(schema.dataStartRow, 1, count, width).getDisplayValues()
      : sheet.getRange(schema.dataStartRow, 1, count, width).getValues();

    return values.map(function(row, idx) {
      return {
        rowNumber: schema.dataStartRow + idx,
        values: row
      };
    });
  }

  function readObjects(schemaKey, options) {
    const opts = options || {};
    const schema = SheetSchemas_.get(schemaKey);
    const rows = readRows(schemaKey, Object.assign({}, opts, {
      width: Math.max(Number(opts.width) || 0, getMaxSchemaColumn(schema))
    }));

    return rows.map(function(item) {
      const obj = {};
      Object.keys(schema.columns || {}).forEach(function(field) {
        obj[field] = item.values[(schema.columns[field] || 1) - 1];
      });
      obj._meta = {
        schema: schema.key,
        rowNumber: item.rowNumber,
        sheetName: opts.sheetName || schema.name || ''
      };
      return obj;
    });
  }

  function readRangeValues(sheet, row, col, numRows, numCols, displayValues) {
    if (!sheet) throw new Error('Sheet is required');
    const range = sheet.getRange(row, col, numRows, numCols);
    return displayValues ? range.getDisplayValues() : range.getValues();
  }

  function updateRowFields(schemaKey, rowNumber, valuesByField, options) {
    const opts = options || {};
    const schema = SheetSchemas_.get(schemaKey);
    const sheet = getSheet(schemaKey, opts.sheetName, true);
    Object.keys(valuesByField || {}).forEach(function(field) {
      if (!(field in schema.columns)) {
        throw new Error(`Поле "${field}" відсутнє у схемі ${schemaKey}`);
      }
      sheet.getRange(Number(rowNumber), schema.columns[field]).setValue(valuesByField[field]);
    });
    return true;
  }

  function appendObjects(schemaKey, items, options) {
    const opts = options || {};
    const list = Array.isArray(items) ? items : [];
    if (!list.length) return 0;

    const schema = SheetSchemas_.get(schemaKey);
    const sheet = ensureSheet(schemaKey, opts.sheetName);
    const width = getMaxSchemaColumn(schema);
    const rows = list.map(function(item) {
      const out = new Array(width).fill('');
      Object.keys(schema.columns || {}).forEach(function(field) {
        out[schema.columns[field] - 1] = item[field] === undefined ? '' : item[field];
      });
      return out;
    });

    const startRow = Math.max(sheet.getLastRow() + 1, schema.dataStartRow);
    sheet.getRange(startRow, 1, rows.length, width).setValues(rows);
    return rows.length;
  }

  return {
    getSpreadsheet: getSpreadsheet,
    getSheet: getSheet,
    ensureSheet: ensureSheet,
    readRows: readRows,
    readObjects: readObjects,
    readRangeValues: readRangeValues,
    updateRowFields: updateRowFields,
    appendObjects: appendObjects,
    getMaxSchemaColumn: getMaxSchemaColumn
  };
})();


/************ ЗАВАНТАЖЕННЯ ДАНИХ З КЕШЕМ ************/

function _phonesFindColumnIndex_(headers, predicates, fallbackIndex) {
  const normalized = Array.isArray(headers)
    ? headers.map(function(value) { return String(value || '').trim().toLowerCase(); })
    : [];

  const idx = normalized.findIndex(function(header) {
    return predicates.some(function(predicate) {
      return predicate(header);
    });
  });

  return idx >= 0 ? idx : fallbackIndex;
}

function _phonesFormatBirthday_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, getTimeZone_(), 'dd.MM.yyyy');
  }

  const source = String(value || '').trim();
  if (!source) return '';

  let match = source.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (match) {
    return [match[1], match[2], match[3]]
      .map(function(part, idx) { return idx < 2 ? String(part).padStart(2, '0') : part; })
      .join('.');
  }

  match = source.match(/^(\d{1,2})\.(\d{1,2})$/);
  if (match) {
    return [match[1], match[2]].map(function(part) { return String(part).padStart(2, '0'); }).join('.');
  }

  return source;
}

function loadPhonesIndex_() {
  const cache = CacheService.getScriptCache();
  const key = cacheKeyPhonesIndex_();
  const cached = cache.get(key);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) { }
  }

  const out = {
    byFio: {},
    byNorm: {},
    byRole: {},
    byCallsign: {},
    items: [],
    meta: {
      sheetName: CONFIG.PHONES_SHEET,
      rowCount: 0,
      versionMarker: 'stage7-phone-index-v2'
    }
  };

  try {
    const sh = SpreadsheetApp.getActive().getSheetByName(CONFIG.PHONES_SHEET);
    if (!sh || sh.getLastRow() < 2) {
      return out;
    }

    const values = sh.getDataRange().getValues();
    const headers = values[0] || [];
    const cFio = _phonesFindColumnIndex_(headers, [
      function(h) { return h.includes('піб'); },
      function(h) { return h.includes('фіо'); },
      function(h) { return h.includes('фио'); },
      function(h) { return h.includes('fio'); }
    ], 0);
    const cPhone = _phonesFindColumnIndex_(headers, [
      function(h) { return h.includes('тел'); },
      function(h) { return h.includes('phone'); },
      function(h) { return h.includes('номер'); }
    ], 1);
    const cRole = _phonesFindColumnIndex_(headers, [
      function(h) { return h.includes('роль'); },
      function(h) { return h.includes('посада'); },
      function(h) { return h.includes('role'); }
    ], 2);
    const cCallsign = _phonesFindColumnIndex_(headers, [
      function(h) { return h.includes('позив'); },
      function(h) { return h.includes('callsign'); }
    ], cRole);
    const cBirth = _phonesFindColumnIndex_(headers, [
      function(h) { return h.includes('день народ'); },
      function(h) { return h.includes('дата народ'); },
      function(h) { return h.includes('birthday'); },
      function(h) { return h === 'дн' || h === 'д.н'; }
    ], 3);

    for (let r = 1; r < values.length; r++) {
      const row = values[r] || [];
      const fio = String(row[cFio] || '').trim();
      const phone = normalizePhone_(row[cPhone]);
      const role = String(row[cRole] || '').trim();
      const callsign = String(row[cCallsign] || '').trim() || role;
      const birthday = _phonesFormatBirthday_(row[cBirth]);

      if (!fio && !role && !callsign) continue;

      const fioNorm = normalizeFIO_(fio);
      const roleNorm = _normCallsignKey_(role);
      const callsignNorm = _normCallsignKey_(callsign);
      const item = {
        fio: fio,
        fioNorm: fioNorm,
        phone: phone,
        role: role,
        roleNorm: roleNorm,
        callsign: callsign,
        callsignNorm: callsignNorm,
        birthday: birthday,
        rowNumber: r + 1
      };

      out.items.push(item);

      if (phone) {
        if (fio) out.byFio[fio] = phone;
        if (fioNorm) out.byNorm[fioNorm] = phone;
        if (role) out.byRole[role] = phone;
        if (roleNorm) out.byRole[roleNorm] = phone;
        if (callsign) out.byCallsign[callsign] = phone;
        if (callsignNorm) out.byCallsign[callsignNorm] = phone;
      }
    }

    out.meta.rowCount = out.items.length;
  } catch (e) {
    console.error('Помилка читання PHONES:', e);
  }

  const json = JSON.stringify(out);
  if (json.length < 90000) {
    cache.put(key, json, CONFIG.CACHE_TTL_SEC);
  }

  return out;
}

function loadPhonesMap_() {
  const cache = CacheService.getScriptCache();
  const key = cacheKeyPhones_();
  const cached = cache.get(key);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) { }
  }

  const map = {};
  const index = loadPhonesIndex_();

  Object.keys(index.byFio || {}).forEach(function(keyName) {
    map[keyName] = index.byFio[keyName];
  });
  Object.keys(index.byNorm || {}).forEach(function(keyName) {
    map[keyName] = index.byNorm[keyName];
  });
  Object.keys(index.byRole || {}).forEach(function(keyName) {
    map[keyName] = index.byRole[keyName];
    map['role:' + keyName] = index.byRole[keyName];
  });
  Object.keys(index.byCallsign || {}).forEach(function(keyName) {
    map[keyName] = index.byCallsign[keyName];
  });

  const jsonStr = JSON.stringify(map);
  if (jsonStr.length < 90000) {
    cache.put(key, jsonStr, CONFIG.CACHE_TTL_SEC);
  }

  return map;
}

function _normalizePhonesLookupSource_(source) {
  if (source && typeof source === 'object' && source.byFio && source.byNorm && source.byRole && source.byCallsign) {
    return source;
  }

  if (source && typeof source === 'object') {
    return {
      byFio: {},
      byNorm: {},
      byRole: {},
      byCallsign: {},
      legacyMap: source,
      items: []
    };
  }

  return loadPhonesIndex_();
}

function _legacyPhoneLookup_(legacyMap, criteria) {
  const map = legacyMap || {};
  const fio = String(criteria && criteria.fio || '').trim();
  const fioNorm = String(criteria && criteria.fioNorm || '').trim();
  const role = String(criteria && criteria.role || '').trim();
  const roleNorm = _normCallsignKey_(role);
  const callsign = String(criteria && criteria.callsign || '').trim();
  const callsignNorm = _normCallsignKey_(callsign);

  const candidates = [
    fio,
    fioNorm,
    callsign,
    callsignNorm,
    role,
    'role:' + role,
    roleNorm,
    'role:' + roleNorm
  ].filter(Boolean);

  for (let i = 0; i < candidates.length; i++) {
    if (map[candidates[i]]) return map[candidates[i]];
  }

  return '';
}

function findPhone_(criteria, options) {
  const opts = options || {};
  const index = _normalizePhonesLookupSource_(opts.index || opts.phones || loadPhonesIndex_());
  const request = (criteria && typeof criteria === 'object') ? criteria : { role: criteria };
  const fio = String(request.fio || '').trim();
  const fioNorm = String(request.fioNorm || normalizeFIO_(fio)).trim();
  const role = String(request.role || '').trim();
  const roleNorm = _normCallsignKey_(role);
  const callsign = String(request.callsign || '').trim();
  const callsignNorm = _normCallsignKey_(callsign);

  const candidates = [
    index.byCallsign && index.byCallsign[callsign],
    index.byCallsign && index.byCallsign[callsignNorm],
    index.byRole && index.byRole[role],
    index.byRole && index.byRole[roleNorm],
    index.byFio && index.byFio[fio],
    index.byNorm && index.byNorm[fioNorm],
    _legacyPhoneLookup_(index.legacyMap, { fio: fio, fioNorm: fioNorm, role: role, callsign: callsign })
  ];

  for (let i = 0; i < candidates.length; i++) {
    const phone = normalizePhone_(candidates[i]);
    if (phone) return phone;
  }

  if (roleNorm) {
    const fuzzyKeywords = ['КОМАНДИР', 'КВ', 'ГРАФ', roleNorm];
    const items = Array.isArray(index.items) ? index.items : [];
    const fuzzy = items.find(function(item) {
      const probe = [item.roleNorm, item.callsignNorm, _normCallsignKey_(item.role), _normCallsignKey_(item.callsign)]
        .filter(Boolean)
        .join(' ');
      return fuzzyKeywords.some(function(keyword) {
        return keyword && probe.indexOf(keyword) !== -1;
      });
    });
    if (fuzzy && fuzzy.phone) return normalizePhone_(fuzzy.phone);
  }

  return '';
}

function findPhoneByFio_(fio, options) {
  return findPhone_({ fio: fio }, options || {});
}

function findPhoneByCallsign_(callsign, options) {
  return findPhone_({ callsign: callsign }, options || {});
}

function loadDictMap_() {
  const cache = CacheService.getScriptCache();
  const key = cacheKeyDict_();
  const cached = cache.get(key);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) { }
  }

  const sh = SpreadsheetApp.getActive().getSheetByName(CONFIG.DICT_SHEET);
  if (!sh) throw new Error(`Аркуш ${CONFIG.DICT_SHEET} не знайдено`);

  const map = {};
  const lastRow = sh.getLastRow();
  if (lastRow >= 2) {
    const data = sh.getRange(2, 1, lastRow - 1, 4).getValues();
    for (const row of data) {
      const code = String(row[0] || '').trim();
      if (!code) continue;
      map[code] = {
        service: String(row[1] || '').trim(),
        place: String(row[2] || '').trim(),
        tasks: String(row[3] || '').trim()
      };
    }
  }

  const jsonStr = JSON.stringify(map);
  if (jsonStr.length < 90000) {
    cache.put(key, jsonStr, CONFIG.CACHE_TTL_SEC);
  }

  return map;
}

function readDictSum_() {
  const cache = CacheService.getScriptCache();
  const key = cacheKeyDictSum_();
  const cached = cache.get(key);
  if (cached) {
    try { return JSON.parse(cached); } catch (e) { }
  }

  const sh = SpreadsheetApp.getActive().getSheetByName(CONFIG.DICT_SUM_SHEET);
  if (!sh) throw new Error(`Аркуш ${CONFIG.DICT_SUM_SHEET} не знайдено`);

  const lastRow = sh.getLastRow();
  const raw = [];

  if (lastRow >= 2) {
    const data = sh.getRange(2, 1, lastRow - 1, 4).getValues();

    for (const row of data) {
      let code = String(row[0] || '').trim();
      let label = String(row[1] || '').trim();
      const order = Number(row[2]);
      const showZero = String(row[3] || '').trim().toUpperCase() === 'TRUE';

      // нормализация от мусора типа пробелов/табов/двойных пробелов
      code = code.replace(/\s+/g, ' ').trim();
      label = label.replace(/\s+/g, ' ').trim();

      if (!code) continue;
      if (!label) label = code;
      if (isNaN(order)) continue;

      raw.push({ code, label, order, showZero });
    }
  }

  raw.sort((a, b) => a.order - b.order);

  const seenCode = new Set();
  const rules = [];
  for (const r of raw) {
    const k = r.code;
    if (seenCode.has(k)) continue;
    seenCode.add(k);
    rules.push(r);
  }

  const json = JSON.stringify(rules);
  if (json.length < 90000) cache.put(key, json, CONFIG.CACHE_TTL_SEC);

  return rules;
}

// ==================== ОСНОВНА ФУНКЦІЯ ПОШУКУ ТЕЛЕФОНУ ====================
function findPhoneByRole_(role) {
  return findPhone_({ role: role });
}

function buildPayloadForCell_(sheet, row, col, phonesMap, dictMap) {
  const codeRef = sheet.getRange(CONFIG.CODE_RANGE_A1);
  const a1 = a1FromRowCol_(row, col);
  const baseContext = {
    sheet: sheet ? sheet.getName() : '',
    row: row,
    col: col,
    a1: a1
  };

  if (row < codeRef.getRow() || row > codeRef.getLastRow() || col < codeRef.getColumn() || col > codeRef.getLastColumn()) {
    throw buildContextError_('buildPayloadForCell_', baseContext, `Клітинка поза межами матриці ${CONFIG.CODE_RANGE_A1}`);
  }

  const fioRaw = String(sheet.getRange(row, CONFIG.FIO_COL).getDisplayValue() || '').trim();
  if (!fioRaw) {
    throw buildContextError_('buildPayloadForCell_', baseContext, 'ПІБ порожнє');
  }
  const fioNorm = normalizeFIO_(fioRaw);

  const dateCell = sheet.getRange(Number(CONFIG.DATE_ROW) || 1, col);
  const reportDate = DateUtils_.normalizeDate(dateCell.getValue(), dateCell.getDisplayValue());

  const brRaw = String(sheet.getRange(row, 6).getDisplayValue() || '').trim();
  const brDays = brRaw ? (Number(brRaw.replace(',', '.')) || 0) : 0;

  const cellValue = String(sheet.getRange(row, col).getDisplayValue() || '').trim();
  const isEmptyCell = !cellValue;

  const phoneSource = phonesMap || loadPhonesIndex_();
  let phone = findPhone_({ fio: fioRaw, fioNorm: fioNorm }, { index: phoneSource }) || '';
  const phoneDigits = phone ? String(phone).replace(/[^\d+]/g, '') : '';
  const waPhone = phoneDigits ? (phoneDigits.startsWith('+') ? phoneDigits : '+' + phoneDigits) : '';

  let service = '';
  let place = '';
  let tasks = '';
  let code = '';

  if (!isEmptyCell) {
    code = cellValue;
    const dict = dictMap ? dictMap[cellValue] : null;
    if (dict) {
      service = dict.service || '';
      place = dict.place || '';
      tasks = dict.tasks || '';
    }
  }

  const msg = buildMessage_({
    reportDate,
    service,
    place,
    tasks,
    brDays: isEmptyCell ? 0 : brDays,
    minimal: isEmptyCell
  });

  const safeMessage = trimToEncoded_(msg, CONFIG.MAX_WA_TEXT);

  const out = {
    timestamp: new Date(),
    sheet: sheet.getName(),
    cell: a1,
    row, col,
    fio: fioRaw,
    phone: waPhone,
    code,
    service,
    place,
    tasks,
    brDays: isEmptyCell ? 0 : brDays,
    message: msg,
    reportDateStr: reportDate
  };

  if (waPhone) {
    out.link = `https://wa.me/${waPhone.replace('+', '')}?text=${encodeURIComponent(safeMessage)}`;
  } else {
    out.link = '';
  }

  return out;
}

/************ РОБОТА З ВИДІЛЕНИМИ ДІАПАЗОНАМИ ************/
function getSelectedRanges_(sheet) {
  const ss = SpreadsheetApp.getActive();
  const rl = ss.getActiveRangeList();
  if (rl && rl.getRanges().length > 0) return rl.getRanges().filter(r => r.getSheet().getName() === sheet.getName());
  const ar = sheet.getActiveRange();
  return ar ? [ar] : [];
}

function collectPayloads_(sheet, ranges) {
  const codeRef = sheet.getRange(CONFIG.CODE_RANGE_A1);
  const rMin = codeRef.getRow(), rMax = codeRef.getLastRow();
  const cMin = codeRef.getColumn(), cMax = codeRef.getLastColumn();

  const phonesMap = loadPhonesIndex_();
  const dictMap = loadDictMap_();

  const payloads = [], errors = [], seen = new Set();
  let limited = false;

  const processCell = (row, col, value) => {
    if (row < rMin || row > rMax || col < cMin || col > cMax) return false;
    const code = String(value || '').trim();
    if (!code) return false;
    const a1 = a1FromRowCol_(row, col);
    if (seen.has(a1)) return false;
    seen.add(a1);
    try {
      payloads.push(buildPayloadForCell_(sheet, row, col, phonesMap, dictMap));
      if (payloads.length >= CONFIG.MAX_PAYLOADS) {
        limited = true;
        errors.push(`⁈ Ліміт ${CONFIG.MAX_PAYLOADS} досягнуто`);
        return true;
      }
    } catch (e) {
      errors.push(`${a1}: ${e.message}`);
    }
    return false;
  };

  outer: for (const range of ranges) {
    const values = range.getDisplayValues();
    const r0 = range.getRow(), c0 = range.getColumn();
    for (let i = 0; i < values.length; i++) {
      for (let j = 0; j < values[i].length; j++) {
        if (processCell(r0 + i, c0 + j, values[i][j])) break outer;
      }
    }
  }
  return { payloads, errors, limited };
}

/************ ГРУПУВАННЯ ЗА ТЕЛЕФОНОМ ************/
function groupPayloadsByPhone_(payloads) {
  const groups = {};
  for (const p of payloads) {
    if (!p || !p.phone) continue;
    if (!groups[p.phone]) groups[p.phone] = [];
    groups[p.phone].push(p);
  }
  return Object.entries(groups).map(([phone, items]) => ({ phone, items }));
}

function splitTextIntoParts_(header, blocks, footer, maxLen) {
  const parts = [];
  let current = header;
  const encLen = t => encodeURIComponent(String(t)).length;

  const pushCurrent = () => {
    const msg = (current + footer).trim();
    if (msg) parts.push(msg);
    current = header;
  };

  for (const block of blocks) {
    let candidate = current + (current.endsWith('\n') ? '' : '\n') + block + '\n\n';
    if (encLen(candidate + footer) <= maxLen) {
      current = candidate;
      continue;
    }

    if (current.trim() !== header.trim()) pushCurrent();

    let temp = header;
    const lines = block.split('\n');
    for (const line of lines) {
      const testLine = temp + (temp.endsWith('\n') ? '' : '\n') + line + '\n';
      if (encLen(testLine + footer) <= maxLen) temp = testLine;
      else {
        if (temp.trim() !== header.trim()) parts.push((temp + footer).trim());
        temp = header + line + '\n';
      }
    }
    if (temp.trim() !== header.trim()) parts.push((temp + footer).trim());
    current = header;
  }
  if (current.trim() !== header.trim()) pushCurrent();
  return parts.length ? parts : [(header + footer).trim()];
}

function buildAggregatedPayloadsForPhone_(phone, items) {
  if (!items || items.length === 0) return [];

  items.sort((a, b) => (a.row - b.row) || (a.col - b.col));
  const dates = unique_(items.map(x => x.reportDateStr));
  const dateLine = dates.length === 1 ? dates[0] : `Дати: ${dates.join(', ')}`;

  const header = [dateLine, '', `📋 Зведення по ${items.length} записах:`, ''].join('\n');
  const footer = ['', '*(´ ｡_ ｡｀)*   *⨥*   *(´｡ _｡ ｀)*'].join('\n');

  const blocks = items.map(item => {
    const lines = [`• ${item.fio}`];
    if (item.service) lines.push(`  Вид служби: ${item.service}`);
    if (item.place) lines.push(`  Місце: ${item.place}`);
    if (item.tasks) lines.push(`  Завдання: ${item.tasks}`);
    return lines.join('\n');
  });

  const parts = splitTextIntoParts_(header, blocks, footer, CONFIG.MAX_WA_TEXT);

  return parts.map((msg, idx) => {
    const partNo = parts.length > 1 ? ` (частина ${idx + 1}/${parts.length})` : '';
    const safeMsg = trimToEncoded_(msg, CONFIG.MAX_WA_TEXT);
    return {
      timestamp: new Date(),
      sheet: getBotMonthSheetName_(),
      cell: 'MULTI',
      row: '', col: '',
      fio: `ГРУПА (${items.length} записів)${partNo}`,
      phone,
      code: 'MULTI',
      service: '', place: '', tasks: '',
      message: msg,
      link: `https://wa.me/${phone.replace('+', '')}?text=${encodeURIComponent(safeMsg)}`,
      reportDateStr: dates.length === 1 ? dates[0] : dates.join(', ')
    };
  });
}
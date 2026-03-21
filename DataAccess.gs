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

  console.log('🔍 Завантаження телефонів з локального листа PHONES...');

  try {
    const localSheet = SpreadsheetApp.getActive().getSheetByName(CONFIG.PHONES_SHEET);
    if (localSheet) {
      console.log('📊 Локальний лист PHONES знайдено');
      const lastRow = localSheet.getLastRow();
      console.log('📊 Рядків у листі:', lastRow);

      if (lastRow > 1) {
        const data = localSheet.getDataRange().getValues();
        for (let i = 1; i < data.length; i++) {
          const fio = String(data[i][0] || '').trim();
          let phone = String(data[i][1] || '').trim();
          const role = String(data[i][2] || '').trim();

          if (fio && phone) {
            phone = phone.replace(/[^\d+]/g, '');
            if (phone && !phone.startsWith('+')) {
              phone = '+' + phone;
            }

            map[fio] = phone;

            const norm = normalizeFIO_(fio);
            if (norm !== fio) map[norm] = phone;

            if (role) {
              map[`role:${role}`] = phone;
              map[role] = phone;
            }
          }
        }
        console.log(`✅ Завантажено ${Object.keys(map).length} телефонів`);
      } else {
        console.log('⚠️ Лист PHONES порожній');
      }
    } else {
      console.log('❌ Лист PHONES не знайдено!');
    }
  } catch (e) {
    console.error('Помилка читання PHONES:', e);
  }

  const jsonStr = JSON.stringify(map);
  if (jsonStr.length < 90000) {
    cache.put(key, jsonStr, CONFIG.CACHE_TTL_SEC);
    console.log('💾 Дані закешовано');
  }

  return map;
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
  const phonesMap = loadPhonesMap_();

  const roleKey = `role:${role}`;
  if (phonesMap[roleKey]) {
    console.log(`✅ Знайдено телефон за роллю "${roleKey}": ${phonesMap[roleKey]}`);
    return phonesMap[roleKey];
  }

  if (phonesMap[role]) {
    console.log(`✅ Знайдено телефон за прямим співпадінням: ${phonesMap[role]}`);
    return phonesMap[role];
  }

  const upperRole = role.toUpperCase();
  for (const [key, value] of Object.entries(phonesMap)) {
    const upperKey = key.toUpperCase();
    if (upperKey === upperRole || upperKey === `ROLE:${upperRole}`) {
      console.log(`✅ Знайдено телефон (збіг після нормалізації): ${value}`);
      return value;
    }
  }

  const keywords = ['КОМАНДИР', 'КВ', 'ГРАФ', upperRole];
  for (const [key, value] of Object.entries(phonesMap)) {
    for (const keyword of keywords) {
      if (key.toUpperCase().includes(keyword)) {
        console.log(`⚠️ Знайдено альтернативний телефон (ключ "${key}"): ${value}`);
        return value;
      }
    }
  }

  console.log(`❌ Телефон для ролі "${role}" не знайдено`);
  return '';
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
  const reportDate = normalizeDate_(dateCell.getValue(), dateCell.getDisplayValue());

  const brRaw = String(sheet.getRange(row, 6).getDisplayValue() || '').trim();
  const brDays = brRaw ? (Number(brRaw.replace(',', '.')) || 0) : 0;

  const cellValue = String(sheet.getRange(row, col).getDisplayValue() || '').trim();
  const isEmptyCell = !cellValue;

  let phone = (phonesMap && (phonesMap[fioRaw] || phonesMap[fioNorm])) || '';
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

  const phonesMap = loadPhonesMap_();
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
        errors.push(`⚠️ Ліміт ${CONFIG.MAX_PAYLOADS} досягнуто`);
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
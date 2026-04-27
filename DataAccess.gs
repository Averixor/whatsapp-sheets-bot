/**
 * DataAccess.gs — WASB / Stage 7 canonical data-access layer.
 *
 * Призначення:
 * - заміна старого DataAccess.gs одним файлом;
 * - без власного CONFIG, SheetSchemas_ і onOpen, щоб не ламати Stage 7;
 * - сумісність із наявним CONFIG/SheetSchemas_, якщо вони вже є у проєкті;
 * - резервні значення під WASB, якщо CONFIG ще не завантажений.
 *
 * Важливо:
 * - цей файл потрібно ставити замість старого DataAccess.gs;
 * - не тримай поруч старий DataAccess.gs / DataAccess(22).gs / 1DataAccess.gs.
 */

var DataAccess_ = (function() {
  function getSpreadsheet() {
    return SpreadsheetApp.getActive();
  }

  function getSheet(schemaKey, explicitSheetName, required) {
    var schema = dataAccessGetSheetSchema_(schemaKey);
    var name = explicitSheetName || dataAccessResolveSheetName_(schemaKey, explicitSheetName);
    var sheet = getSpreadsheet().getSheetByName(name);

    if (!sheet && required !== false && schema.required !== false) {
      throw new Error('Аркуш "' + name + '" (' + schemaKey + ') не знайдено');
    }

    return sheet || null;
  }

  function ensureSheet(schemaKey, explicitSheetName) {
    var ss = getSpreadsheet();
    var name = explicitSheetName || dataAccessResolveSheetName_(schemaKey, explicitSheetName);
    var sheet = ss.getSheetByName(name);

    if (!sheet) {
      sheet = ss.insertSheet(name);
    }

    return sheet;
  }

  function getLastDataRow(sheet, schema) {
    if (!sheet) return 0;
    var start = Number(schema && schema.dataStartRow) || 2;
    var last = sheet.getLastRow();
    return last >= start ? last : 0;
  }

  function getDataRowCount(sheet, schema) {
    var last = getLastDataRow(sheet, schema);
    var start = Number(schema && schema.dataStartRow) || 2;
    return last ? (last - start + 1) : 0;
  }

  function getMaxSchemaColumn(schema) {
    var cols = (schema && schema.columns) || {};
    var keys = Object.keys(cols);
    if (!keys.length) return 1;

    return Math.max.apply(null, keys.map(function(key) {
      return Number(cols[key]) || 0;
    }).concat([1]));
  }

  function readRows(schemaKey, options) {
    var opts = options || {};
    var schema = dataAccessGetSheetSchema_(schemaKey);
    var required = opts.required !== false && schema.required !== false;
    var sheet = getSheet(schemaKey, opts.sheetName, required);

    if (!sheet) return [];

    var count = getDataRowCount(sheet, schema);
    if (count <= 0) return [];

    var width = Math.max(Number(opts.width) || 0, getMaxSchemaColumn(schema));
    var range = sheet.getRange(schema.dataStartRow || 2, 1, count, width);
    var values = opts.displayValues ? range.getDisplayValues() : range.getValues();

    return values.map(function(row, idx) {
      return {
        rowNumber: (schema.dataStartRow || 2) + idx,
        values: row
      };
    });
  }

  function readObjects(schemaKey, options) {
    var opts = options || {};
    var schema = dataAccessGetSheetSchema_(schemaKey);
    var readOpts = dataAccessCloneObject_(opts);
    readOpts.width = Math.max(Number(opts.width) || 0, getMaxSchemaColumn(schema));

    var rows = readRows(schemaKey, readOpts);

    return rows.map(function(item) {
      var obj = {};

      Object.keys(schema.columns || {}).forEach(function(field) {
        obj[field] = item.values[(Number(schema.columns[field]) || 1) - 1];
      });

      obj._meta = {
        schema: schema.key || schemaKey,
        rowNumber: item.rowNumber,
        sheetName: opts.sheetName || schema.name || ''
      };

      return obj;
    });
  }

  function readRangeValues(sheet, row, col, numRows, numCols, displayValues) {
    if (!sheet || typeof sheet.getRange !== 'function') {
      throw new Error('Sheet is required');
    }

    var range = sheet.getRange(Number(row), Number(col), Number(numRows), Number(numCols));
    return displayValues ? range.getDisplayValues() : range.getValues();
  }

  function updateRowFields(schemaKey, rowNumber, valuesByField, options) {
    var opts = options || {};
    var schema = dataAccessGetSheetSchema_(schemaKey);
    var sheet = getSheet(schemaKey, opts.sheetName, true);
    var values = valuesByField || {};

    Object.keys(values).forEach(function(field) {
      if (!(field in (schema.columns || {}))) {
        throw new Error('Поле "' + field + '" відсутнє у схемі ' + schemaKey);
      }

      sheet.getRange(Number(rowNumber), Number(schema.columns[field])).setValue(values[field]);
    });

    return true;
  }

  function appendObjects(schemaKey, items, options) {
    var opts = options || {};
    var list = Array.isArray(items) ? items : [];
    if (!list.length) return 0;

    var schema = dataAccessGetSheetSchema_(schemaKey);
    var sheet = ensureSheet(schemaKey, opts.sheetName);
    var width = getMaxSchemaColumn(schema);

    var rows = list.map(function(item) {
      var out = new Array(width).fill('');

      Object.keys(schema.columns || {}).forEach(function(field) {
        out[Number(schema.columns[field]) - 1] = item[field] === undefined ? '' : item[field];
      });

      return out;
    });

    var startRow = Math.max(sheet.getLastRow() + 1, schema.dataStartRow || 2);
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

/************ CONFIG / SCHEMA COMPATIBILITY ************/

function dataAccessGetConfig_() {
  var projectConfig = {};

  try {
    projectConfig = (typeof CONFIG !== 'undefined' && CONFIG) ? CONFIG : {};
  } catch (e) {
    projectConfig = {};
  }

  var defaults = {
    TARGET_SHEET: '03',
    PHONES_SHEET: 'PHONES',
    DICT_SHEET: 'DICT',
    DICT_SUM_SHEET: 'DICT_SUM',
    SEND_PANEL_SHEET: 'SEND_PANEL',
    LOG_SHEET: 'LOG',
    SUMMARY_HISTORY_SHEET: 'ІСТОРІЯ_ЗВЕДЕНЬ',

    OS_FIO_RANGE_A1: 'G2:G40',
    CODE_RANGE_A1: 'H2:AL40',

    PHONE_COL: 1,
    CALLSIGN_COL: 2,
    FIO_COL: 7,
    FML_COL: 7,
    DATE_ROW: 1,
    BR_COL: 6,

    MAX_PAYLOADS: 300,
    MAX_WA_TEXT: 3800,
    CACHE_TTL_SEC: 300,
    COMMANDER_ROLE: 'ГРАФ',
    DEFAULT_TIMEZONE: 'Europe/Kyiv',
    TZ: 'Europe/Kyiv'
  };

  var cfg = dataAccessCloneObject_(defaults);

  Object.keys(projectConfig || {}).forEach(function(key) {
    if (projectConfig[key] !== undefined && projectConfig[key] !== null && projectConfig[key] !== '') {
      cfg[key] = projectConfig[key];
    }
  });

  cfg.PHONES_SHEET = String(cfg.PHONES_SHEET || 'PHONES');
  cfg.DICT_SHEET = String(cfg.DICT_SHEET || 'DICT');
  cfg.DICT_SUM_SHEET = String(cfg.DICT_SUM_SHEET || 'DICT_SUM');
  cfg.SEND_PANEL_SHEET = String(cfg.SEND_PANEL_SHEET || 'SEND_PANEL');
  cfg.CODE_RANGE_A1 = String(cfg.CODE_RANGE_A1 || 'H2:AL40');

  cfg.PHONE_COL = Number(cfg.PHONE_COL) || 1;
  cfg.CALLSIGN_COL = Number(cfg.CALLSIGN_COL) || 2;
  cfg.FIO_COL = Number(cfg.FIO_COL) || 7;
  cfg.FML_COL = Number(cfg.FML_COL || cfg.FIO_COL) || 7;
  cfg.DATE_ROW = Number(cfg.DATE_ROW) || 1;
  cfg.BR_COL = Number(cfg.BR_COL) || 6;
  cfg.MAX_PAYLOADS = Number(cfg.MAX_PAYLOADS) || 300;
  cfg.MAX_WA_TEXT = Number(cfg.MAX_WA_TEXT) || 3800;
  cfg.CACHE_TTL_SEC = Number(cfg.CACHE_TTL_SEC) || 300;
  cfg.DEFAULT_TIMEZONE = String(cfg.TZ || cfg.DEFAULT_TIMEZONE || 'Europe/Kyiv');

  return cfg;
}

function dataAccessCloneObject_(obj) {
  var out = {};
  Object.keys(obj || {}).forEach(function(key) {
    out[key] = obj[key];
  });
  return out;
}

function dataAccessGetSheetSchema_(schemaKey) {
  var key = String(schemaKey || '').trim();

  try {
    if (typeof SheetSchemas_ !== 'undefined' && SheetSchemas_ && typeof SheetSchemas_.get === 'function') {
      var external = SheetSchemas_.get(key);
      if (external && typeof external === 'object') {
        return external;
      }
    }
  } catch (e) { }

  var cfg = dataAccessGetConfig_();
  var schemas = {
    phones: {
      key: 'phones',
      name: cfg.PHONES_SHEET,
      dataStartRow: 2,
      required: false,
      columns: {
        phone: cfg.PHONE_COL || 1,
        callsign: cfg.CALLSIGN_COL || 2,
        fml: 3,
        role: 4,
        birthday: 5
      }
    },
    dict: {
      key: 'dict',
      name: cfg.DICT_SHEET,
      dataStartRow: 2,
      required: false,
      columns: {
        code: 1,
        service: 2,
        place: 3,
        tasks: 4
      }
    },
    dictSum: {
      key: 'dictSum',
      name: cfg.DICT_SUM_SHEET,
      dataStartRow: 2,
      required: false,
      columns: {
        code: 1,
        label: 2,
        order: 3,
        showZero: 4
      }
    },
    sendPanel: {
      key: 'sendPanel',
      name: cfg.SEND_PANEL_SHEET,
      dataStartRow: 2,
      required: false,
      columns: {
        timestamp: 1,
        sheet: 2,
        cell: 3,
        fml: 4,
        phone: 5,
        code: 6,
        message: 7,
        link: 8
      }
    },
    log: {
      key: 'log',
      name: cfg.LOG_SHEET || 'LOG',
      dataStartRow: 2,
      required: false,
      columns: {
        timestamp: 1,
        level: 2,
        message: 3,
        context: 4
      }
    }
  };

  return schemas[key] || {
    key: key,
    name: key,
    dataStartRow: 2,
    required: false,
    columns: {}
  };
}

function dataAccessResolveSheetName_(schemaKey, explicitName) {
  if (explicitName) return explicitName;

  try {
    if (typeof SheetSchemas_ !== 'undefined' && SheetSchemas_ && typeof SheetSchemas_.resolveSheetName === 'function') {
      var resolved = SheetSchemas_.resolveSheetName(schemaKey, explicitName);
      if (resolved) return resolved;
    }
  } catch (e) { }

  var schema = dataAccessGetSheetSchema_(schemaKey);
  return schema.name || String(schemaKey || '');
}

/************ BASIC HELPERS ************/

function dataAccessGetTimeZone_() {
  var cfg = dataAccessGetConfig_();

  try {
    var scriptTz = Session.getScriptTimeZone();
    if (scriptTz) return scriptTz;
  } catch (e) { }

  return cfg.DEFAULT_TIMEZONE || 'Europe/Kyiv';
}

function dataAccessNormalizePhone_(value) {
  if (value === null || value === undefined) return '';

  var raw = String(value).trim();
  if (!raw) return '';

  var digits = raw.replace(/\D/g, '');
  if (!digits) return '';

  if (digits.length === 9) digits = '380' + digits;
  if (digits.length === 10 && digits.charAt(0) === '0') digits = '38' + digits;
  if (digits.length === 11 && digits.charAt(0) === '8') digits = '3' + digits;

  if (digits.length < 10) return '';

  return '+' + digits;
}

function dataAccessNormalizeFML_(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/\s+/g, ' ');
}

function dataAccessNormCallsignKey_(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-zа-яіїєґ0-9]/gi, '');
}

function dataAccessA1FromRowCol_(row, col) {
  row = Number(row);
  col = Number(col);

  var letter = '';
  var temp;
  var c = col;

  while (c > 0) {
    temp = (c - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    c = (c - temp - 1) / 26;
  }

  return letter + row;
}

function dataAccessTrimToEncoded_(text, limit) {
  var max = Number(limit) || dataAccessGetConfig_().MAX_WA_TEXT || 3800;
  var source = String(text || '');

  if (encodeURIComponent(source).length <= max) {
    return source;
  }

  var suffix = '...';
  var result = source;

  while (result.length > 0 && encodeURIComponent(result + suffix).length > max) {
    result = result.substring(0, Math.max(0, result.length - 10));
  }

  return result + suffix;
}

function dataAccessUnique_(arr) {
  var seen = {};
  var out = [];

  (arr || []).forEach(function(value) {
    var key = String(value || '');
    if (!key || seen[key]) return;
    seen[key] = true;
    out.push(value);
  });

  return out;
}

function dataAccessGetBotMonthSheetName_() {
  var cfg = dataAccessGetConfig_();
  var now = new Date();

  if (cfg.TARGET_SHEET) {
    return String(cfg.TARGET_SHEET);
  }

  return Utilities.formatDate(now, dataAccessGetTimeZone_(), 'MM.yyyy');
}

function dataAccessBuildContextError_(fnName, context, message) {
  var error = new Error('[' + fnName + '] ' + message);
  error.context = context || {};
  return error;
}

function normalizeDateForDataAccess_(value, displayValue) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, dataAccessGetTimeZone_(), 'dd.MM');
  }

  var display = String(displayValue || '').trim();
  if (display) return display;

  var raw = String(value || '').trim();
  if (!raw) return '';

  return raw;
}

function dataAccessBuildMessage_(params) {
  params = params || {};

  var reportDate = String(params.reportDate || '').trim();
  var service = String(params.service || '').trim();
  var place = String(params.place || '').trim();
  var tasks = String(params.tasks || '').trim();
  var brDays = params.brDays === undefined || params.brDays === null ? '' : String(params.brDays).trim();

  if (params.minimal) {
    return ['Дата: ' + reportDate, 'Дані відсутні.'].filter(Boolean).join('\n');
  }

  var lines = [];
  if (reportDate) lines.push('Дата: ' + reportDate);
  if (service) lines.push('Вид служби: ' + service);
  if (place) lines.push('Місце: ' + place);
  if (tasks) lines.push('Завдання: ' + tasks);
  if (brDays && brDays !== '0') lines.push('БР: ' + brDays);

  return lines.join('\n') || ('Дата: ' + reportDate);
}

/************ CACHE KEYS ************/

function dataAccessCacheKeyPhonesIndex_() {
  return 'wasb_dataaccess_phones_index_v3';
}

function dataAccessCacheKeyPhones_() {
  return 'wasb_dataaccess_phones_map_v3';
}

function dataAccessCacheKeyDict_() {
  return 'wasb_dataaccess_dict_map_v3';
}

function dataAccessCacheKeyDictSum_() {
  return 'wasb_dataaccess_dict_sum_v3';
}

/************ PHONES ************/

function _phonesFindColumnIndex_(headers, predicates, fallbackIndex) {
  var row = Array.isArray(headers && headers[0]) ? headers[0] : (headers || []);
  var normalized = row.map(function(value) {
    return String(value || '').trim().toLowerCase();
  });

  var idx = normalized.findIndex(function(header) {
    return predicates.some(function(predicate) {
      return predicate(header);
    });
  });

  return idx >= 0 ? idx : fallbackIndex;
}

function _phonesFormatBirthday_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, dataAccessGetTimeZone_(), 'dd.MM.yyyy');
  }

  var source = String(value || '').trim();
  if (!source) return '';

  var match = source.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (match) {
    return String(match[1]).padStart(2, '0') + '.' + String(match[2]).padStart(2, '0') + '.' + match[3];
  }

  match = source.match(/^(\d{1,2})\.(\d{1,2})$/);
  if (match) {
    return String(match[1]).padStart(2, '0') + '.' + String(match[2]).padStart(2, '0');
  }

  return source;
}

function dataAccessLooksLikePhone_(value) {
  var phone = dataAccessNormalizePhone_(value);
  return !!phone && phone.replace(/\D/g, '').length >= 10;
}

function dataAccessDetectPhoneColumn_(values, fallbackIndex) {
  var rows = values || [];
  var width = rows.length ? rows[0].length : 0;
  var bestIdx = fallbackIndex;
  var bestScore = 0;

  for (var c = 0; c < width; c++) {
    var score = 0;

    for (var r = 1; r < Math.min(rows.length, 30); r++) {
      if (dataAccessLooksLikePhone_(rows[r][c])) score++;
    }

    if (score > bestScore) {
      bestScore = score;
      bestIdx = c;
    }
  }

  return bestIdx;
}

function dataAccessAddPhoneAlias_(out, alias, phone, bucketName) {
  var raw = String(alias || '').trim();
  if (!raw || !phone) return;

  var normFml = dataAccessNormalizeFML_(raw);
  var normCallsign = dataAccessNormCallsignKey_(raw);

  out.byAlias[raw] = phone;
  if (normFml) out.byNorm[normFml] = phone;
  if (normCallsign) out.byAlias[normCallsign] = phone;

  if (bucketName && out[bucketName]) {
    out[bucketName][raw] = phone;
    if (normCallsign) out[bucketName][normCallsign] = phone;
    if (normFml) out.byNorm[normFml] = phone;
  }
}

function loadPhonesIndex_() {
  var cfg = dataAccessGetConfig_();
  var cache = CacheService.getScriptCache();
  var key = dataAccessCacheKeyPhonesIndex_();
  var cached = cache.get(key);

  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) { }
  }

  var out = {
    byFml: {},
    byNorm: {},
    byRole: {},
    byCallsign: {},
    byAlias: {},
    items: [],
    meta: {
      sheetName: cfg.PHONES_SHEET,
      rowCount: 0,
      versionMarker: 'wasb-dataaccess-phone-index-v3'
    }
  };

  try {
    var sheet = SpreadsheetApp.getActive().getSheetByName(cfg.PHONES_SHEET);
    if (!sheet || sheet.getLastRow() < 2) {
      return out;
    }

    var values = sheet.getDataRange().getValues();
    var headers = values[0] || [];

    var fallbackPhoneIdx = Math.max(0, Number(cfg.PHONE_COL || 1) - 1);
    var fallbackCallsignIdx = Math.max(0, Number(cfg.CALLSIGN_COL || 2) - 1);

    var cPhone = _phonesFindColumnIndex_(headers, [
      function(h) { return h.includes('тел'); },
      function(h) { return h.includes('phone'); },
      function(h) { return h.includes('номер'); },
      function(h) { return h === 'моб'; }
    ], fallbackPhoneIdx);

    cPhone = dataAccessDetectPhoneColumn_(values, cPhone);

    var cFml = _phonesFindColumnIndex_(headers, [
      function(h) { return h.includes('піб'); },
      function(h) { return h.includes('фіо'); },
      function(h) { return h.includes('фио'); },
      function(h) { return h.includes('fml'); },
      function(h) { return h.includes('fio'); },
      function(h) { return h.includes('прізвище'); }
    ], cPhone === 0 ? 1 : 0);

    var cRole = _phonesFindColumnIndex_(headers, [
      function(h) { return h.includes('роль'); },
      function(h) { return h.includes('посада'); },
      function(h) { return h.includes('role'); },
      function(h) { return h.includes('recipient'); }
    ], 2);

    var cCallsign = _phonesFindColumnIndex_(headers, [
      function(h) { return h.includes('позив'); },
      function(h) { return h.includes('callsign'); },
      function(h) { return h.includes('call sign'); }
    ], fallbackCallsignIdx);

    var cBirth = _phonesFindColumnIndex_(headers, [
      function(h) { return h.includes('день народ'); },
      function(h) { return h.includes('дата народ'); },
      function(h) { return h.includes('birthday'); },
      function(h) { return h === 'дн' || h === 'д.н' || h === 'д.н.'; }
    ], 4);

    for (var r = 1; r < values.length; r++) {
      var row = values[r] || [];
      var phone = dataAccessNormalizePhone_(row[cPhone]);
      if (!phone) continue;

      var fml = String(row[cFml] || '').trim();
      var role = String(row[cRole] || '').trim();
      var callsign = String(row[cCallsign] || '').trim();
      var birthday = _phonesFormatBirthday_(row[cBirth]);

      if (!callsign && fallbackCallsignIdx !== cPhone) {
        callsign = String(row[fallbackCallsignIdx] || '').trim();
      }

      if (!fml) {
        for (var fc = 0; fc < row.length; fc++) {
          if (fc === cPhone) continue;
          var maybeName = String(row[fc] || '').trim();
          if (maybeName && maybeName.indexOf(' ') > 0 && !dataAccessLooksLikePhone_(maybeName)) {
            fml = maybeName;
            break;
          }
        }
      }

      var fmlNorm = dataAccessNormalizeFML_(fml);
      var roleNorm = dataAccessNormCallsignKey_(role);
      var callsignNorm = dataAccessNormCallsignKey_(callsign);

      var item = {
        fml: fml,
        fmlNorm: fmlNorm,
        phone: phone,
        role: role,
        roleNorm: roleNorm,
        callsign: callsign,
        callsignNorm: callsignNorm,
        birthday: birthday,
        rowNumber: r + 1
      };

      out.items.push(item);

      dataAccessAddPhoneAlias_(out, fml, phone, 'byFml');
      dataAccessAddPhoneAlias_(out, role, phone, 'byRole');
      dataAccessAddPhoneAlias_(out, callsign, phone, 'byCallsign');

      for (var c = 0; c < row.length; c++) {
        if (c === cPhone) continue;
        dataAccessAddPhoneAlias_(out, row[c], phone, 'byAlias');
      }
    }

    out.meta.rowCount = out.items.length;
  } catch (e) {
    console.error('Помилка читання ' + cfg.PHONES_SHEET + ':', e);
  }

  try {
    var json = JSON.stringify(out);
    if (json.length < 90000) {
      cache.put(key, json, cfg.CACHE_TTL_SEC);
    }
  } catch (e) { }

  return out;
}

function loadPhonesMap_() {
  var cfg = dataAccessGetConfig_();
  var cache = CacheService.getScriptCache();
  var key = dataAccessCacheKeyPhones_();
  var cached = cache.get(key);

  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) { }
  }

  var map = {};
  var index = loadPhonesIndex_();

  ['byFml', 'byNorm', 'byRole', 'byCallsign', 'byAlias'].forEach(function(bucketName) {
    var bucket = index[bucketName] || {};
    Object.keys(bucket).forEach(function(alias) {
      map[alias] = bucket[alias];
      map[dataAccessNormalizeFML_(alias)] = bucket[alias];
      map[dataAccessNormCallsignKey_(alias)] = bucket[alias];
    });
  });

  try {
    var json = JSON.stringify(map);
    if (json.length < 90000) {
      cache.put(key, json, cfg.CACHE_TTL_SEC);
    }
  } catch (e) { }

  return map;
}

function _normalizePhonesLookupSource_(source) {
  if (!source) return loadPhonesIndex_();

  if (source.items || source.byFml || source.byNorm || source.byRole || source.byCallsign || source.byAlias) {
    return source;
  }

  return {
    legacyMap: source,
    items: [],
    byFml: {},
    byNorm: {},
    byRole: {},
    byCallsign: {},
    byAlias: {}
  };
}

function _legacyPhoneLookup_(legacyMap, criteria) {
  var map = legacyMap || {};
  var req = criteria || {};
  var candidates = [];

  ['fml', 'fmlNorm', 'role', 'roleNorm', 'callsign', 'callsignNorm', 'alias'].forEach(function(field) {
    if (req[field]) candidates.push(req[field]);
  });

  for (var i = 0; i < candidates.length; i++) {
    var raw = String(candidates[i] || '').trim();
    var norm = dataAccessNormalizeFML_(raw);
    var call = dataAccessNormCallsignKey_(raw);

    var value = map[raw] || map[norm] || map[call] || map['role:' + raw] || map['role:' + call];
    var phone = dataAccessNormalizePhone_(value);
    if (phone) return phone;
  }

  return '';
}

function findPhone_(criteria, options) {
  var opts = options || {};
  var source = _normalizePhonesLookupSource_(opts.index || opts.map || opts.phonesMap || null);
  var req = (criteria && typeof criteria === 'object') ? dataAccessCloneObject_(criteria) : { role: criteria };

  req.fml = String(req.fml || '').trim();
  req.fmlNorm = req.fmlNorm || dataAccessNormalizeFML_(req.fml);
  req.role = String(req.role || '').trim();
  req.roleNorm = req.roleNorm || dataAccessNormCallsignKey_(req.role);
  req.callsign = String(req.callsign || '').trim();
  req.callsignNorm = req.callsignNorm || dataAccessNormCallsignKey_(req.callsign);
  req.alias = String(req.alias || '').trim();

  if (source.legacyMap) {
    var legacyPhone = _legacyPhoneLookup_(source.legacyMap, req);
    if (legacyPhone) return legacyPhone;
  }

  var direct = [
    source.byCallsign && source.byCallsign[req.callsign],
    source.byCallsign && source.byCallsign[req.callsignNorm],
    source.byFml && source.byFml[req.fml],
    source.byNorm && source.byNorm[req.fmlNorm],
    source.byRole && source.byRole[req.role],
    source.byRole && source.byRole[req.roleNorm],
    source.byAlias && source.byAlias[req.alias],
    source.byAlias && source.byAlias[dataAccessNormCallsignKey_(req.alias)],
    source.byAlias && source.byAlias[dataAccessNormalizeFML_(req.alias)]
  ];

  for (var i = 0; i < direct.length; i++) {
    var phone = dataAccessNormalizePhone_(direct[i]);
    if (phone) return phone;
  }

  var targets = [req.callsignNorm, req.roleNorm, req.fmlNorm, dataAccessNormCallsignKey_(req.fml)].filter(Boolean);
  var items = source.items || [];

  for (var t = 0; t < targets.length; t++) {
    var target = targets[t];
    if (!target) continue;

    for (var j = 0; j < items.length; j++) {
      var item = items[j] || {};
      var haystack = [
        item.fmlNorm,
        item.roleNorm,
        item.callsignNorm,
        dataAccessNormCallsignKey_(item.fml || ''),
        dataAccessNormCallsignKey_(item.role || ''),
        dataAccessNormCallsignKey_(item.callsign || '')
      ].join(' ');

      if (haystack && haystack.indexOf(target) !== -1) {
        var fuzzyPhone = dataAccessNormalizePhone_(item.phone);
        if (fuzzyPhone) return fuzzyPhone;
      }
    }
  }

  return '';
}

function findPhoneByFml_(fml, options) {
  return findPhone_({ fml: fml }, options);
}

function findPhoneByCallsign_(callsign, options) {
  return findPhone_({ callsign: callsign }, options);
}

function findPhoneByRole_(role, options) {
  return findPhone_({ role: role }, options);
}

/************ DICTIONARIES ************/

function dataAccessFindDictColumn_(headers, predicates, fallbackIndex) {
  return _phonesFindColumnIndex_(headers, predicates, fallbackIndex);
}

function dataAccessDictEntry_(row, indexes) {
  var code = String(row[indexes.code] || '').trim().replace(/\s+/g, ' ');
  if (!code) return null;

  var service = String(row[indexes.service] || '').trim();
  var place = String(row[indexes.place] || '').trim();
  var tasks = String(row[indexes.tasks] || '').trim();
  var label = String(row[indexes.label] || '').trim();

  if (!service && label) service = label;

  return {
    code: code,
    label: label || service || code,
    service: service,
    place: place,
    tasks: tasks
  };
}

function loadDictMap_() {
  var cfg = dataAccessGetConfig_();
  var cache = CacheService.getScriptCache();
  var key = dataAccessCacheKeyDict_();
  var cached = cache.get(key);

  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) { }
  }

  var map = {};

  try {
    var sheet = SpreadsheetApp.getActive().getSheetByName(cfg.DICT_SHEET);
    if (!sheet || sheet.getLastRow() < 2) {
      return map;
    }

    var values = sheet.getDataRange().getValues();
    var headers = values[0] || [];
    var width = values[0] ? values[0].length : 4;

    var indexes = {
      code: dataAccessFindDictColumn_(headers, [
        function(h) { return h === 'code' || h === 'код'; }
      ], 0),
      service: dataAccessFindDictColumn_(headers, [
        function(h) { return h.includes('служ'); },
        function(h) { return h.includes('service'); },
        function(h) { return h.includes('label'); },
        function(h) { return h.includes('назва'); }
      ], Math.min(1, width - 1)),
      place: dataAccessFindDictColumn_(headers, [
        function(h) { return h.includes('місц'); },
        function(h) { return h.includes('мест'); },
        function(h) { return h.includes('place'); }
      ], Math.min(2, width - 1)),
      tasks: dataAccessFindDictColumn_(headers, [
        function(h) { return h.includes('завдан'); },
        function(h) { return h.includes('задач'); },
        function(h) { return h.includes('task'); }
      ], Math.min(3, width - 1)),
      label: dataAccessFindDictColumn_(headers, [
        function(h) { return h.includes('label'); },
        function(h) { return h.includes('назва'); },
        function(h) { return h.includes('підпис'); }
      ], Math.min(1, width - 1))
    };

    for (var r = 1; r < values.length; r++) {
      var entry = dataAccessDictEntry_(values[r] || [], indexes);
      if (!entry) continue;

      map[entry.code] = entry;
      map[entry.code.toLowerCase()] = entry;
      map[entry.code.replace(/\s+/g, '')] = entry;
      map[entry.code.toLowerCase().replace(/\s+/g, '')] = entry;
    }
  } catch (e) {
    console.error('Помилка читання ' + cfg.DICT_SHEET + ':', e);
  }

  try {
    var json = JSON.stringify(map);
    if (json.length < 90000) {
      cache.put(key, json, cfg.CACHE_TTL_SEC);
    }
  } catch (e) { }

  return map;
}

function readDictSum_() {
  var cfg = dataAccessGetConfig_();
  var cache = CacheService.getScriptCache();
  var key = dataAccessCacheKeyDictSum_();
  var cached = cache.get(key);

  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) { }
  }

  var rules = [];

  try {
    var sheet = SpreadsheetApp.getActive().getSheetByName(cfg.DICT_SUM_SHEET);
    if (!sheet || sheet.getLastRow() < 2) {
      return [];
    }

    var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, Math.max(4, sheet.getLastColumn())).getValues();
    var raw = [];

    for (var i = 0; i < values.length; i++) {
      var row = values[i] || [];
      var code = String(row[0] || '').trim().replace(/\s+/g, ' ');
      if (!code) continue;

      var label = String(row[1] || '').trim().replace(/\s+/g, ' ') || code;
      var order = row[2] === '' || row[2] === null || isNaN(Number(row[2])) ? 999 : Number(row[2]);
      var showZero = row[3] === true || String(row[3] || '').trim().toUpperCase() === 'TRUE';

      raw.push({
        code: code,
        label: label,
        order: order,
        showZero: showZero
      });
    }

    raw.sort(function(a, b) {
      return a.order - b.order;
    });

    var seen = {};
    raw.forEach(function(rule) {
      var normalized = rule.code.toLowerCase();
      if (seen[normalized]) return;
      seen[normalized] = true;
      rules.push(rule);
    });
  } catch (e) {
    console.error('Помилка читання ' + cfg.DICT_SUM_SHEET + ':', e);
  }

  try {
    var json = JSON.stringify(rules);
    if (json.length < 90000) {
      cache.put(key, json, cfg.CACHE_TTL_SEC);
    }
  } catch (e) { }

  return rules;
}

function dataAccessFindDictEntry_(dictMap, code) {
  var raw = String(code || '').trim();
  if (!raw) return {};

  var normalized = raw.toLowerCase();
  var compact = raw.replace(/\s+/g, '');
  var compactLower = compact.toLowerCase();

  return (dictMap && (dictMap[raw] || dictMap[normalized] || dictMap[compact] || dictMap[compactLower])) || {};
}

/************ PAYLOADS ************/

function _normalizeBuildPayloadRequest_(sheetOrRequest, row, col, phonesMap, dictMap) {
  var request = (sheetOrRequest && typeof sheetOrRequest === 'object' && typeof sheetOrRequest.getRange !== 'function')
    ? sheetOrRequest
    : null;

  if (!request) {
    return {
      sheet: sheetOrRequest || null,
      row: Number(row),
      col: Number(col),
      phonesMap: phonesMap || null,
      dictMap: dictMap || null
    };
  }

  var resolvedSheet = request.sheet || null;

  if (!resolvedSheet && request.sheetName) {
    resolvedSheet = SpreadsheetApp.getActive().getSheetByName(String(request.sheetName));
  }

  return {
    sheet: resolvedSheet || null,
    row: Number(request.row),
    col: Number(request.col),
    phonesMap: request.phonesMap || phonesMap || null,
    dictMap: request.dictMap || dictMap || null
  };
}

function buildPayloadForCell_(sheet, row, col, phonesMap, dictMap) {
  var cfg = dataAccessGetConfig_();
  var request = _normalizeBuildPayloadRequest_(sheet, row, col, phonesMap, dictMap);

  sheet = request.sheet;
  row = Number(request.row);
  col = Number(request.col);
  phonesMap = request.phonesMap || loadPhonesIndex_();
  dictMap = request.dictMap || loadDictMap_();

  if (!sheet || typeof sheet.getRange !== 'function') {
    throw dataAccessBuildContextError_('buildPayloadForCell_', { row: row, col: col }, 'Не вдалося визначити аркуш для побудови payload');
  }

  var a1 = dataAccessA1FromRowCol_(row, col);
  var context = {
    sheet: sheet.getName(),
    row: row,
    col: col,
    a1: a1
  };

  var codeRef = sheet.getRange(cfg.CODE_RANGE_A1);
  if (row < codeRef.getRow() || row > codeRef.getLastRow() || col < codeRef.getColumn() || col > codeRef.getLastColumn()) {
    throw dataAccessBuildContextError_('buildPayloadForCell_', context, 'Клітинка поза межами матриці ' + cfg.CODE_RANGE_A1);
  }

  var fmlRaw = String(sheet.getRange(row, cfg.FML_COL).getDisplayValue() || '').trim();
  if (!fmlRaw) {
    throw dataAccessBuildContextError_('buildPayloadForCell_', context, 'ПІБ порожнє');
  }

  var callsignRaw = '';
  try {
    if (cfg.CALLSIGN_COL && cfg.CALLSIGN_COL > 0) {
      callsignRaw = String(sheet.getRange(row, cfg.CALLSIGN_COL).getDisplayValue() || '').trim();
    }
  } catch (e) { }

  var cellValue = String(sheet.getRange(row, col).getDisplayValue() || '').trim();
  var isEmptyCell = !cellValue;

  var brRaw = '';
  try {
    brRaw = String(sheet.getRange(row, cfg.BR_COL).getDisplayValue() || '').trim();
  } catch (e) { }

  var brDays = brRaw ? (Number(brRaw.replace(',', '.')) || 0) : 0;
  var dateCell = sheet.getRange(cfg.DATE_ROW, col);
  var reportDate = normalizeDateForDataAccess_(dateCell.getValue(), dateCell.getDisplayValue());

  var phone = findPhone_({
    fml: fmlRaw,
    fmlNorm: dataAccessNormalizeFML_(fmlRaw),
    callsign: callsignRaw,
    alias: callsignRaw || fmlRaw
  }, {
    index: phonesMap
  });

  var code = '';
  var service = '';
  var place = '';
  var tasks = '';
  var label = '';

  if (!isEmptyCell) {
    code = cellValue;
    var dict = dataAccessFindDictEntry_(dictMap, cellValue);
    service = String(dict.service || '').trim();
    place = String(dict.place || '').trim();
    tasks = String(dict.tasks || '').trim();
    label = String(dict.label || '').trim();
  }

  var message = dataAccessBuildMessage_({
    reportDate: reportDate,
    service: service || label,
    place: place,
    tasks: tasks,
    brDays: isEmptyCell ? 0 : brDays,
    minimal: isEmptyCell
  });

  var safeMessage = dataAccessTrimToEncoded_(message, cfg.MAX_WA_TEXT);
  var waPhone = phone ? (String(phone).charAt(0) === '+' ? String(phone) : '+' + String(phone).replace(/\D/g, '')) : '';

  return {
    timestamp: new Date(),
    sheet: sheet.getName(),
    cell: a1,
    row: row,
    col: col,
    fml: fmlRaw,
    callsign: callsignRaw,
    phone: waPhone,
    code: code,
    label: label,
    service: service,
    place: place,
    tasks: tasks,
    brDays: isEmptyCell ? 0 : brDays,
    message: message,
    reportDateStr: reportDate,
    link: waPhone ? ('https://wa.me/' + waPhone.replace('+', '') + '?text=' + encodeURIComponent(safeMessage)) : ''
  };
}

function getSelectedRanges_(sheet) {
  var ss = SpreadsheetApp.getActive();
  var rangeList = ss.getActiveRangeList();

  if (rangeList && rangeList.getRanges && rangeList.getRanges().length > 0) {
    return rangeList.getRanges().filter(function(range) {
      return !sheet || range.getSheet().getName() === sheet.getName();
    });
  }

  var activeRange = sheet ? sheet.getActiveRange() : ss.getActiveRange();
  return activeRange ? [activeRange] : [];
}

function collectPayloads_(sheet, ranges) {
  var cfg = dataAccessGetConfig_();
  var activeSheet = sheet || SpreadsheetApp.getActiveSheet();
  var selectedRanges = Array.isArray(ranges) && ranges.length ? ranges : getSelectedRanges_(activeSheet);
  var codeRef = activeSheet.getRange(cfg.CODE_RANGE_A1);

  var rMin = codeRef.getRow();
  var rMax = codeRef.getLastRow();
  var cMin = codeRef.getColumn();
  var cMax = codeRef.getLastColumn();

  var phonesIndex = loadPhonesIndex_();
  var dictMap = loadDictMap_();

  var payloads = [];
  var errors = [];
  var seen = {};
  var limited = false;

  function processCell(row, col, value) {
    if (row < rMin || row > rMax || col < cMin || col > cMax) return false;

    var code = String(value || '').trim();
    if (!code) return false;

    var a1 = dataAccessA1FromRowCol_(row, col);
    if (seen[a1]) return false;
    seen[a1] = true;

    try {
      payloads.push(buildPayloadForCell_(activeSheet, row, col, phonesIndex, dictMap));

      if (payloads.length >= cfg.MAX_PAYLOADS) {
        limited = true;
        errors.push('⚠ Ліміт ' + cfg.MAX_PAYLOADS + ' досягнуто');
        return true;
      }
    } catch (e) {
      errors.push(a1 + ': ' + (e && e.message ? e.message : String(e)));
    }

    return false;
  }

  outer:
  for (var i = 0; i < selectedRanges.length; i++) {
    var range = selectedRanges[i];
    var values = range.getDisplayValues();
    var r0 = range.getRow();
    var c0 = range.getColumn();

    for (var r = 0; r < values.length; r++) {
      for (var c = 0; c < values[r].length; c++) {
        if (processCell(r0 + r, c0 + c, values[r][c])) {
          break outer;
        }
      }
    }
  }

  return {
    payloads: payloads,
    errors: errors,
    limited: limited
  };
}

/************ GROUPING / WA TEXT SPLIT ************/

function groupPayloadsByPhone_(payloads) {
  var groups = {};

  (payloads || []).forEach(function(payload) {
    if (!payload || !payload.phone) return;
    if (!groups[payload.phone]) groups[payload.phone] = [];
    groups[payload.phone].push(payload);
  });

  return Object.keys(groups).map(function(phone) {
    return {
      phone: phone,
      items: groups[phone]
    };
  });
}

function splitTextIntoParts_(header, blocks, footer, maxLen) {
  var parts = [];
  var max = Number(maxLen) || dataAccessGetConfig_().MAX_WA_TEXT || 3800;
  var start = String(header || '');
  var end = String(footer || '');
  var current = start;

  function encodedLength(text) {
    return encodeURIComponent(String(text || '')).length;
  }

  function pushCurrent() {
    var msg = (current + end).trim();
    if (msg) parts.push(msg);
    current = start;
  }

  (blocks || []).forEach(function(block) {
    block = String(block || '').trim();
    if (!block) return;

    var separator = current && !current.endsWith('\n') ? '\n' : '';
    var candidate = current + separator + block + '\n\n';

    if (encodedLength(candidate + end) <= max) {
      current = candidate;
      return;
    }

    if (current.trim() !== start.trim()) {
      pushCurrent();
    }

    var temp = start;
    var lines = block.split('\n');

    lines.forEach(function(line) {
      var lineSeparator = temp && !temp.endsWith('\n') ? '\n' : '';
      var test = temp + lineSeparator + line + '\n';

      if (encodedLength(test + end) <= max) {
        temp = test;
      } else {
        if (temp.trim() !== start.trim()) {
          parts.push((temp + end).trim());
        }
        temp = start + line + '\n';
      }
    });

    if (temp.trim() !== start.trim()) {
      parts.push((temp + end).trim());
    }

    current = start;
  });

  if (current.trim() !== start.trim()) {
    pushCurrent();
  }

  return parts.length ? parts : [(start + end).trim()].filter(Boolean);
}

function buildAggregatedPayloadsForPhone_(phone, items) {
  var cfg = dataAccessGetConfig_();
  var list = Array.isArray(items) ? items.slice() : [];
  if (!list.length) return [];

  list.sort(function(a, b) {
    return (Number(a.row) - Number(b.row)) || (Number(a.col) - Number(b.col));
  });

  var dates = dataAccessUnique_(list.map(function(item) {
    return item.reportDateStr;
  }));

  var dateLine = dates.length === 1 ? ('Дата: ' + dates[0]) : ('Дати: ' + dates.join(', '));
  var header = [dateLine, '', 'Зведення по ' + list.length + ' записах:', ''].join('\n');
  var footer = '';

  var blocks = list.map(function(item) {
    var lines = [];
    lines.push('- ' + item.fml);
    if (item.callsign) lines.push('  Позивний: ' + item.callsign);
    if (item.service || item.label) lines.push('  Вид служби: ' + (item.service || item.label));
    if (item.place) lines.push('  Місце: ' + item.place);
    if (item.tasks) lines.push('  Завдання: ' + item.tasks);
    if (item.brDays) lines.push('  БР: ' + item.brDays);
    return lines.join('\n');
  });

  var parts = splitTextIntoParts_(header, blocks, footer, cfg.MAX_WA_TEXT);

  return parts.map(function(message, idx) {
    var suffix = parts.length > 1 ? ' (частина ' + (idx + 1) + '/' + parts.length + ')' : '';
    var safeMessage = dataAccessTrimToEncoded_(message, cfg.MAX_WA_TEXT);
    var normalizedPhone = String(phone || '').charAt(0) === '+' ? String(phone) : dataAccessNormalizePhone_(phone);

    return {
      timestamp: new Date(),
      sheet: list[0].sheet || dataAccessGetBotMonthSheetName_(),
      cell: 'MULTI',
      row: '',
      col: '',
      fml: 'ГРУПА (' + list.length + ' записів)' + suffix,
      phone: normalizedPhone,
      code: 'MULTI',
      service: '',
      place: '',
      tasks: '',
      message: message,
      link: normalizedPhone ? ('https://wa.me/' + normalizedPhone.replace('+', '') + '?text=' + encodeURIComponent(safeMessage)) : '',
      reportDateStr: dates.join(', ')
    };
  });
}

/************ CACHE REFRESH HELPERS ************/

function refreshPhonesCache() {
  var cache = CacheService.getScriptCache();
  cache.remove(dataAccessCacheKeyPhonesIndex_());
  cache.remove(dataAccessCacheKeyPhones_());
  var index = loadPhonesIndex_();

  try {
    SpreadsheetApp.getUi().alert('Кеш телефонів оновлено. Записів: ' + ((index.meta && index.meta.rowCount) || 0));
  } catch (e) { }

  return index;
}

function refreshDictCache() {
  var cache = CacheService.getScriptCache();
  cache.remove(dataAccessCacheKeyDict_());
  cache.remove(dataAccessCacheKeyDictSum_());
  var dict = loadDictMap_();
  var rules = readDictSum_();

  try {
    SpreadsheetApp.getUi().alert('Кеш словників оновлено. DICT: ' + Object.keys(dict || {}).length + ', DICT_SUM: ' + rules.length);
  } catch (e) { }

  return {
    dictSize: Object.keys(dict || {}).length,
    dictSumSize: rules.length
  };
}

function refreshDataAccessCaches_() {
  return {
    phones: refreshPhonesCache(),
    dict: refreshDictCache()
  };
}

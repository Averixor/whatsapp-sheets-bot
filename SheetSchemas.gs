/**
 * SheetSchemas.gs
 * Повна безпечна версія для Google Apps Script / WASB.
 */

function _ssHasObject_(value) {
  return !!value && typeof value === 'object';
}

function _ssHasFunction_(value) {
  return typeof value === 'function';
}

function _ssSafeString_(value, fallback) {
  if (value === null || typeof value === 'undefined') return fallback || '';
  return String(value);
}

function _ssTrimmedString_(value, fallback) {
  return _ssSafeString_(value, fallback).trim();
}

function _ssConfigObject_() {
  try {
    if (typeof CONFIG !== 'undefined' && _ssHasObject_(CONFIG)) return CONFIG;
  } catch (e) {}
  return {};
}

function _ssVacationConfigObject_() {
  try {
    if (typeof VACATION_ENGINE_CONFIG !== 'undefined' && _ssHasObject_(VACATION_ENGINE_CONFIG)) {
      return VACATION_ENGINE_CONFIG;
    }
  } catch (e) {}
  return {};
}

function _ssConfigValue_(key, fallback) {
  var cfg = _ssConfigObject_();
  if (Object.prototype.hasOwnProperty.call(cfg, key) && cfg[key] !== null && typeof cfg[key] !== 'undefined' && cfg[key] !== '') {
    return cfg[key];
  }
  return fallback;
}

function _ssVacationConfigValue_(key, fallback) {
  var cfg = _ssVacationConfigObject_();
  if (Object.prototype.hasOwnProperty.call(cfg, key) && cfg[key] !== null && typeof cfg[key] !== 'undefined' && cfg[key] !== '') {
    return cfg[key];
  }
  return fallback;
}

function _ssBotMonthSheetName_() {
  try {
    if (typeof getBotMonthSheetName_ === 'function') {
      return _ssTrimmedString_(getBotMonthSheetName_(), '') || _ssCurrentMonth_();
    }
  } catch (e) {}
  return _ssCurrentMonth_();
}

function _ssCurrentMonth_() {
  var month = new Date().getMonth() + 1;
  return String(month).padStart(2, '0');
}

function _ssParseNumber_(value, fallback) {
  var num = Number(value);
  return isFinite(num) && !isNaN(num) ? num : fallback;
}

function _ssFreeze_(value) {
  try {
    return Object.freeze(value);
  } catch (e) {
    return value;
  }
}

function _columnLetterToNumber_(letters) {
  var text = _ssTrimmedString_(letters, '').toUpperCase();
  if (!text) {
    throw new Error('Порожній рядок літер стовпця');
  }

  var out = 0;
  for (var i = 0; i < text.length; i++) {
    var code = text.charCodeAt(i);
    if (code < 65 || code > 90) {
      throw new Error('Некоректні літери стовпця: ' + text);
    }
    out = out * 26 + (code - 64);
  }

  return out;
}

function _parseA1RangeRef_(a1) {
  var text = _ssTrimmedString_(a1, '');
  var match = text.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);

  if (!match) {
    throw new Error('Непідтримуваний A1-діапазон: ' + text);
  }

  var startCol = _columnLetterToNumber_(match[1]);
  var startRow = Number(match[2]);
  var endCol = _columnLetterToNumber_(match[3]);
  var endRow = Number(match[4]);

  if (startCol < 1 || startRow < 1 || endCol < 1 || endRow < 1) {
    throw new Error('Некоректні координати діапазону: ' + text);
  }

  if (endCol < startCol || endRow < startRow) {
    throw new Error('Кінцева координата менша за початкову: ' + text);
  }

  return {
    startCol: startCol,
    startRow: startRow,
    endCol: endCol,
    endRow: endRow
  };
}

function _monthlyMatrix_() {
  return _parseA1RangeRef_(_ssConfigValue_('CODE_RANGE_A1', 'H2:AL40'));
}

function _vacationSheetName_() {
  return _ssTrimmedString_(_ssVacationConfigValue_('VACATIONS_SHEET', 'VACATIONS'), 'VACATIONS');
}

function _ssBuildMonthlySchema_() {
  var codeRangeA1 = _ssTrimmedString_(_ssConfigValue_('CODE_RANGE_A1', 'H2:AL40'), 'H2:AL40');
  var matrix = _parseA1RangeRef_(codeRangeA1);
  var dateRow = _ssParseNumber_(_ssConfigValue_('DATE_ROW', 1), 1);

  return _ssFreeze_({
    key: 'monthly',
    legacyKey: 'MONTHLY',
    type: 'monthly',
    title: 'Monthly sheet',
    dynamicName: true,
    required: true,
    sheetNamePattern: /^\d{2}$/,
    headerRow: dateRow,
    dateRow: dateRow,
    codeRangeA1: codeRangeA1,
    osFmlRangeA1: _ssTrimmedString_(_ssConfigValue_('OS_FML_RANGE', 'G2:G40'), 'G2:G40'),
    dataStartRow: matrix.startRow,
    dataEndRow: matrix.endRow,
    matrix: matrix,
    fields: _ssFreeze_({
      phone:    _ssFreeze_({ col: 1, type: 'string', required: false, allowBlank: true,  label: 'Телефон' }),
      callsign: _ssFreeze_({ col: 2, type: 'string', required: true,  allowBlank: false, label: 'Позивний' }),
      position: _ssFreeze_({ col: 3, type: 'string', required: false, allowBlank: true,  label: 'Посада' }),
      oshs:     _ssFreeze_({ col: 4, type: 'string', required: false, allowBlank: true,  label: 'ОШС' }),
      rank:     _ssFreeze_({ col: 5, type: 'string', required: false, allowBlank: true,  label: 'Звання' }),
      brDays:   _ssFreeze_({ col: 6, type: 'number|string', required: false, allowBlank: true, label: 'Дні БР' }),
      fml:      _ssFreeze_({ col: 7, type: 'string', required: true,  allowBlank: false, label: 'ПІБ' })
    }),

    keyFields: ['callsign', 'fml'],
    requiredFields: ['callsign', 'fml'],
    nullableFields: ['phone', 'position', 'oshs', 'rank', 'brDays'],
    searchableFields: ['callsign', 'fml'],
    notes: 'Канонічне джерело щоденних кодів і статусів для sidebar/SEND_PANEL/зведень.'
  });
}

function _ssBuildPhonesSchema_() {
  return _ssFreeze_({
    key: 'phones',
    legacyKey: 'PHONES',
    type: 'table',
    title: 'PHONES',
    name: _ssTrimmedString_(_ssConfigValue_('PHONES_SHEET', 'PHONES'), 'PHONES'),
    headerRow: 1,
    dataStartRow: 2,
    required: true,
    fields: _ssFreeze_({
      fml:      _ssFreeze_({ col: 1, type: 'string', required: true,  allowBlank: false, label: 'ПІБ' }),
      phone:    _ssFreeze_({ col: 2, type: 'string', required: false, allowBlank: true,  label: 'Телефон' }),
      role:     _ssFreeze_({ col: 3, type: 'string', required: false, allowBlank: true,  label: 'Роль' }),
      birthday: _ssFreeze_({ col: 4, type: 'date|string', required: false, allowBlank: true, label: 'День народження' })
    }),

    headerAliases: _ssFreeze_({
      fml: ['ПІБ', 'ПІБ/ФІО', 'ФІО', 'FML'],
      phone: ['Телефон', 'Phone'],
      role: ['Роль', 'Role'],
      birthday: ['День народження', 'Birthday']
    }),

    keyFields: ['fml', 'role'],
    requiredFields: ['fml'],
    nullableFields: ['phone', 'role', 'birthday'],
    searchableFields: ['fml', 'role', 'phone']
  });
}

function _ssBuildDictSchema_() {
  return _ssFreeze_({
    key: 'dict',
    legacyKey: 'DICT',
    type: 'table',
    title: 'DICT',
    name: _ssTrimmedString_(_ssConfigValue_('DICT_SHEET', 'DICT'), 'DICT'),
    headerRow: 1,
    dataStartRow: 2,
    required: true,
    fields: _ssFreeze_({
      code:    _ssFreeze_({ col: 1, type: 'string', required: true,  allowBlank: false, label: 'Код' }),
      service: _ssFreeze_({ col: 2, type: 'string', required: false, allowBlank: true,  label: 'Служба' }),
      place:   _ssFreeze_({ col: 3, type: 'string', required: false, allowBlank: true,  label: 'Місце' }),
      tasks:   _ssFreeze_({ col: 4, type: 'string', required: false, allowBlank: true,  label: 'Завдання' })
    }),

    headerAliases: _ssFreeze_({
      code: ['Код', 'Code'],
      service: ['Служба', 'Service'],
      place: ['Місце', 'Place'],
      tasks: ['Завдання', 'Tasks']
    }),

    keyFields: ['code'],
    requiredFields: ['code'],
    nullableFields: ['service', 'place', 'tasks'],
    searchableFields: ['code', 'service', 'place', 'tasks']
  });
}

function _ssBuildDictSumSchema_() {
  return _ssFreeze_({
    key: 'dictSum',
    legacyKey: 'DICT_SUM',
    type: 'table',
    title: 'DICT_SUM',
    name: _ssTrimmedString_(_ssConfigValue_('DICT_SUM_SHEET', 'DICT_SUM'), 'DICT_SUM'),
    headerRow: 1,
    dataStartRow: 2,
    required: true,
    fields: _ssFreeze_({
      code:     _ssFreeze_({ col: 1, type: 'string', required: true,  allowBlank: false, label: 'Код' }),
      label:    _ssFreeze_({ col: 2, type: 'string', required: false, allowBlank: true,  label: 'Назва' }),
      order:    _ssFreeze_({ col: 3, type: 'number|string', required: true, allowBlank: false, label: 'Порядок' }),
      showZero: _ssFreeze_({ col: 4, type: 'boolean|string', required: false, allowBlank: true, label: 'Показувати 0' })
    }),

    headerAliases: _ssFreeze_({
      code: ['Код', 'Code'],
      label: ['Назва', 'Label'],
      order: ['Порядок', 'Order'],
      showZero: ['Показувати 0', 'ShowZero', 'Show zero']
    }),

    keyFields: ['code'],
    requiredFields: ['code', 'order'],
    nullableFields: ['label', 'showZero'],
    searchableFields: ['code', 'label']
  });
}

function _ssBuildSendPanelSchema_() {
  return _ssFreeze_({
    key: 'sendPanel',
    legacyKey: 'SEND_PANEL',
    type: 'table',
    title: 'SEND_PANEL',
    name: _ssTrimmedString_(_ssConfigValue_('SEND_PANEL_SHEET', 'SEND_PANEL'), 'SEND_PANEL'),
    titleRows: _ssParseNumber_(_ssConfigValue_('SEND_PANEL_TITLE_ROWS', 1), 1),
    headerRow: _ssParseNumber_(_ssConfigValue_('SEND_PANEL_HEADER_ROW', 2), 2),
    dataStartRow: _ssParseNumber_(_ssConfigValue_('SEND_PANEL_DATA_START_ROW', 3), 3),
    required: false,
    fields: _ssFreeze_({
      fml:    _ssFreeze_({ col: 1, type: 'string', required: true,  allowBlank: false, label: 'FML' }),
      phone:  _ssFreeze_({ col: 2, type: 'string', required: false, allowBlank: true,  label: 'Phone' }),
      code:   _ssFreeze_({ col: 3, type: 'string', required: true,  allowBlank: false, label: 'Code' }),
      tasks:  _ssFreeze_({ col: 4, type: 'string', required: false, allowBlank: true,  label: 'Tasks' }),
      status: _ssFreeze_({ col: 5, type: 'string', required: false, allowBlank: true,  label: 'Status' }),
      sent:   _ssFreeze_({ col: 6, type: 'string', required: false, allowBlank: true,  label: 'Sent' }),
      action: _ssFreeze_({ col: 7, type: 'string', required: false, allowBlank: true,  label: 'Action' })
    }),

    headerAliases: _ssFreeze_({
      fml: ['ПІБ', 'ФІО', 'FML'],
      phone: ['Телефон', 'Phone'],
      code: ['Код', 'Code'],
      tasks: ['Завдання', 'Tasks'],
      status: ['Статус', 'Status'],
      sent: ['Відправлено', 'Sent'],
      action: ['Дія', 'Action']
    }),

    keyFields: ['fml', 'phone', 'code'],
    requiredFields: ['fml', 'code'],
    nullableFields: ['phone', 'tasks', 'status', 'sent', 'action'],
    searchableFields: ['fml', 'phone', 'code', 'status']
  });
}

function _ssBuildVacationsSchema_() {
  return _ssFreeze_({
    key: 'vacations',
    legacyKey: 'VACATIONS',
    type: 'table',
    title: 'VACATIONS',
    name: _vacationSheetName_(),
    headerRow: 1,
    dataStartRow: 2,
    required: false,
    fields: _ssFreeze_({
      fml:        _ssFreeze_({ col: _ssParseNumber_(_ssVacationConfigValue_('NAME_COL', 1), 1), type: 'string', required: true,  allowBlank: false, label: 'ПІБ' }),
      startDate:  _ssFreeze_({ col: _ssParseNumber_(_ssVacationConfigValue_('START_COL', 2), 2), type: 'date|string', required: true, allowBlank: false, label: 'Початок' }),
      endDate:    _ssFreeze_({ col: _ssParseNumber_(_ssVacationConfigValue_('END_COL', 3), 3), type: 'date|string', required: true, allowBlank: false, label: 'Кінець' }),
      vacationNo: _ssFreeze_({ col: _ssParseNumber_(_ssVacationConfigValue_('NUM_COL', 4), 4), type: 'string', required: false, allowBlank: true, label: 'Номер' }),
      active:     _ssFreeze_({ col: _ssParseNumber_(_ssVacationConfigValue_('ACTIVE_COL', 5), 5), type: 'boolean|string', required: false, allowBlank: true, label: 'Активна' }),
      notify:     _ssFreeze_({ col: _ssParseNumber_(_ssVacationConfigValue_('NOTIFY_COL', 6), 6), type: 'boolean|string', required: false, allowBlank: true, label: 'Notify' })
    }),

    keyFields: ['fml', 'startDate', 'endDate'],
    requiredFields: ['fml', 'startDate', 'endDate'],
    nullableFields: ['vacationNo', 'active', 'notify'],
    searchableFields: ['fml', 'vacationNo', 'active']
  });
}

function _ssBuildLogSchema_() {
  return _ssFreeze_({
    key: 'log',
    legacyKey: 'LOG',
    type: 'table',
    title: 'LOG',
    name: _ssTrimmedString_(_ssConfigValue_('LOG_SHEET', 'LOG'), 'LOG'),
    headerRow: 1,
    dataStartRow: 2,
    required: false,
    fields: _ssFreeze_({
      timestamp:     _ssFreeze_({ col: 1, type: 'date|string', required: true,  allowBlank: false, label: 'Мітка часу' }),
      reportDateStr: _ssFreeze_({ col: 2, type: 'string', required: false, allowBlank: true, label: 'Дата звіту' }),
      sheet:         _ssFreeze_({ col: 3, type: 'string', required: false, allowBlank: true, label: 'Аркуш' }),
      cell:          _ssFreeze_({ col: 4, type: 'string', required: false, allowBlank: true, label: 'Клітинка' }),
      fml:           _ssFreeze_({ col: 5, type: 'string', required: false, allowBlank: true, label: 'ПІБ' }),
      phone:         _ssFreeze_({ col: 6, type: 'string', required: false, allowBlank: true, label: 'Телефон' }),
      code:          _ssFreeze_({ col: 7, type: 'string', required: false, allowBlank: true, label: 'Код' }),
      service:       _ssFreeze_({ col: 8, type: 'string', required: false, allowBlank: true, label: 'Служба' }),
      place:         _ssFreeze_({ col: 9, type: 'string', required: false, allowBlank: true, label: 'Місце' }),
      tasks:         _ssFreeze_({ col: 10, type: 'string', required: false, allowBlank: true, label: 'Завдання' }),
      message:       _ssFreeze_({ col: 11, type: 'string', required: false, allowBlank: true, label: 'Повідомлення' }),
      link:          _ssFreeze_({ col: 12, type: 'string', required: false, allowBlank: true, label: 'Посилання' })
    }),
    
    keyFields: ['timestamp', 'fml', 'code'],
    requiredFields: ['timestamp'],
    nullableFields: ['reportDateStr', 'sheet', 'cell', 'fml', 'phone', 'code', 'service', 'place', 'tasks', 'message', 'link'],
    searchableFields: ['fml', 'phone', 'code', 'sheet']
  });
}

function _ssBuildSchemas_() {
  return _ssFreeze_({
    monthly: _ssBuildMonthlySchema_(),
    phones: _ssBuildPhonesSchema_(),
    dict: _ssBuildDictSchema_(),
    dictSum: _ssBuildDictSumSchema_(),
    sendPanel: _ssBuildSendPanelSchema_(),
    vacations: _ssBuildVacationsSchema_(),
    log: _ssBuildLogSchema_()
  });
}

var SHEET_SCHEMAS = _ssBuildSchemas_();

function _canonicalSchemaMap_() {
  return {
    MONTHLY: SHEET_SCHEMAS.monthly,
    monthly: SHEET_SCHEMAS.monthly,
    PHONES: SHEET_SCHEMAS.phones,
    phones: SHEET_SCHEMAS.phones,
    DICT: SHEET_SCHEMAS.dict,
    dict: SHEET_SCHEMAS.dict,
    DICT_SUM: SHEET_SCHEMAS.dictSum,
    dictSum: SHEET_SCHEMAS.dictSum,
    dictsum: SHEET_SCHEMAS.dictSum,
    SEND_PANEL: SHEET_SCHEMAS.sendPanel,
    sendPanel: SHEET_SCHEMAS.sendPanel,
    sendpanel: SHEET_SCHEMAS.sendPanel,
    VACATIONS: SHEET_SCHEMAS.vacations,
    vacations: SHEET_SCHEMAS.vacations,
    LOG: SHEET_SCHEMAS.log,
    log: SHEET_SCHEMAS.log
  };
}

function getRequiredSchemaKeys_() {
  return ['monthly', 'phones', 'dict', 'dictSum', 'sendPanel', 'vacations', 'log'];
}

function _toLegacySchema_(canonical, explicitSheetName) {
  if (!canonical || typeof canonical !== 'object') {
    throw new Error('Не передано канонічну схему');
  }

  var name = explicitSheetName ? _ssTrimmedString_(explicitSheetName, '') : (canonical.name || null);

  var out = Object.assign({}, canonical, {
    key: canonical.legacyKey || canonical.key,
    name: name,
    dynamicName: !!canonical.dynamicName,
    fields: canonical.fields,
    legacyKey: canonical.legacyKey || canonical.key
  });

  if (!out.columns && out.fields) {
    var cols = {};
    for (var f in out.fields) {
      if (Object.prototype.hasOwnProperty.call(out.fields, f)) {
        cols[f] = out.fields[f].col;
      }
    }
    out.columns = cols;
  }

  return out;
}

function getMonthlySheetSchema_(sheetName) {
  return _toLegacySchema_(SHEET_SCHEMAS.monthly, _ssTrimmedString_(sheetName, '') || _ssBotMonthSheetName_());
}

var SheetSchemas_ = (function() {
  function get(schemaKeyOrSheetName) {
    var key = _ssTrimmedString_(schemaKeyOrSheetName, '');
    if (!key) {
      throw new Error('Не передано ключ схеми листа');
    }

    if (/^\d{2}$/.test(key)) {
      return getMonthlySheetSchema_(key);
    }

    var map = _canonicalSchemaMap_();
    var schema = map[key] || map[key.toUpperCase()] || map[key.toLowerCase()];

    if (!schema) {
      throw new Error('Схема "' + schemaKeyOrSheetName + '" не знайдена');
    }

    if (schema === SHEET_SCHEMAS.monthly) {
      return getMonthlySheetSchema_(_ssBotMonthSheetName_());
    }

    return _toLegacySchema_(schema);
  }

  function getAll() {
    return {
      MONTHLY: getMonthlySheetSchema_(_ssBotMonthSheetName_()),
      PHONES: _toLegacySchema_(SHEET_SCHEMAS.phones),
      DICT: _toLegacySchema_(SHEET_SCHEMAS.dict),
      DICT_SUM: _toLegacySchema_(SHEET_SCHEMAS.dictSum),
      SEND_PANEL: _toLegacySchema_(SHEET_SCHEMAS.sendPanel),
      VACATIONS: _toLegacySchema_(SHEET_SCHEMAS.vacations),
      LOG: _toLegacySchema_(SHEET_SCHEMAS.log)
    };
  }

  function resolveSheetName(schemaKey, explicitName) {
    if (explicitName) return _ssTrimmedString_(explicitName, '');
    var schema = get(schemaKey);
    return _ssTrimmedString_(schema.name, '');
  }

  return {
    get: get,
    getAll: getAll,
    resolveSheetName: resolveSheetName
  };
})();

function getSheetSchema_(schemaKeyOrSheetName) {
  return SheetSchemas_.get(schemaKeyOrSheetName);
}

function getSchemaFieldNames_(schemaOrKey) {
  var schema = typeof schemaOrKey === 'string' ? getSheetSchema_(schemaOrKey) : schemaOrKey;
  return Object.keys((schema && schema.fields) || {});
}

function getSchemaFieldColumn_(schemaOrKey, fieldName) {
  var schema = typeof schemaOrKey === 'string' ? getSheetSchema_(schemaOrKey) : schemaOrKey;
  var field = _ssTrimmedString_(fieldName, '');

  if (!schema) throw new Error('Schema not found');
  if (!field) throw new Error('Field name is required');
  if (schema.fields && schema.fields[field]) return Number(schema.fields[field].col);

  throw new Error('Поле "' + fieldName + '" не описане у схемі ' + (schema.key || ''));
}

function getSchemaLastColumn_(schemaOrKey) {
  var schema = typeof schemaOrKey === 'string' ? getSheetSchema_(schemaOrKey) : schemaOrKey;
  var fieldNames = getSchemaFieldNames_(schema);

  if (!fieldNames.length) return 1;

  var maxCol = Math.max.apply(null, fieldNames.map(function(name) {
    return getSchemaFieldColumn_(schema, name);
  }));

  return isFinite(maxCol) ? maxCol : 1;
}

function getSchemaSheetName_(schemaOrKey, options) {
  var schema = typeof schemaOrKey === 'string' ? getSheetSchema_(schemaOrKey) : schemaOrKey;

  if (schema.type === 'monthly' || schema.dynamicName) {
    if (options && options.sheetName) return _ssTrimmedString_(options.sheetName, '');
    return _ssTrimmedString_(schema.name, '') || _ssBotMonthSheetName_();
  }

  return _ssTrimmedString_(schema.name, '');
}

function validateSheetHeadersBySchema_(sheet, schemaOrKey) {
  var schema = typeof schemaOrKey === 'string' ? getSheetSchema_(schemaOrKey) : schemaOrKey;
  var report = {
    ok: true,
    schema: schema ? schema.key : '',
    sheet: sheet && _ssHasFunction_(sheet.getName) ? sheet.getName() : '',
    missing: [],
    mismatches: [],
    warnings: []
  };

  if (!sheet) {
    report.ok = false;
    report.missing.push('sheet');
    return report;
  }

  if (schema.type === 'monthly' || schema.dynamicName) {
    try {
      var monthlyRangeA1 = _ssTrimmedString_(schema.codeRangeA1, '') || _ssTrimmedString_(_ssConfigValue_('CODE_RANGE_A1', 'H2:AL40'), 'H2:AL40');
      var codeRange = sheet.getRange(monthlyRangeA1);

      if (codeRange.getNumRows() <= 0 || codeRange.getNumColumns() <= 0) {
        report.ok = false;
        report.mismatches.push('Некоректний codeRange ' + monthlyRangeA1);
      }
    } catch (e) {
      report.ok = false;
      report.mismatches.push(e && e.message ? e.message : String(e));
    }

    return report;
  }

  var headerRow = _ssParseNumber_(schema.headerRow, 1);
  var lastCol = Math.max(Number(sheet.getLastColumn()) || 0, getSchemaLastColumn_(schema));
  var headers = lastCol > 0 ? sheet.getRange(headerRow, 1, 1, lastCol).getDisplayValues()[0] : [];

  getSchemaFieldNames_(schema).forEach(function(fieldName) {
    var field = schema.fields[fieldName];
    var col = Number(field.col) || 0;

    if (!col || col > headers.length) {
      if (field.required) {
        report.ok = false;
        report.missing.push(fieldName);
      }
      return;
    }

    var actual = _ssTrimmedString_(headers[col - 1], '');
    var aliases = (schema.headerAliases && Array.isArray(schema.headerAliases[fieldName]) && schema.headerAliases[fieldName].length)
      ? schema.headerAliases[fieldName]
      : [field.label || fieldName];

    if (!actual) {
      if (field.required) {
        report.ok = false;
        report.missing.push(fieldName);
      } else {
        report.warnings.push('Порожній header для ' + fieldName);
      }
      return;
    }

    if (aliases.indexOf(actual) === -1) {
      report.mismatches.push(fieldName + ': actual="' + actual + '", expected one of [' + aliases.join(', ') + ']');
    }
  });

  if (report.mismatches.length) report.ok = false;
  return report;
}
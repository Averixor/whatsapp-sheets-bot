/**
 * SheetSchemas.gs — hybrid canonical contract для stage 3.
 *
 * База: сильний stage 3 API/data-access каркас.
 * Підсилення: richer schema metadata, header aliases, helper getters,
 * але без зламу сумісності зі старим SheetSchemas_.get(...).
 */

function _columnLetterToNumber_(letters) {
  const text = String(letters || '').trim().toUpperCase();
  let out = 0;
  for (let i = 0; i < text.length; i++) {
    out = out * 26 + (text.charCodeAt(i) - 64);
  }
  return out;
}

function _parseA1RangeRef_(a1) {
  const text = String(a1 || '').trim();
  const match = text.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
  if (!match) {
    throw new Error(`Непідтримуваний A1-діапазон: ${text}`);
  }

  return {
    startCol: _columnLetterToNumber_(match[1]),
    startRow: Number(match[2]),
    endCol: _columnLetterToNumber_(match[3]),
    endRow: Number(match[4])
  };
}

function _monthlyMatrix_() {
  return _parseA1RangeRef_(CONFIG.CODE_RANGE_A1);
}

function _vacationSheetName_() {
  return (typeof VACATION_ENGINE_CONFIG !== 'undefined' && VACATION_ENGINE_CONFIG && VACATION_ENGINE_CONFIG.VACATIONS_SHEET)
    ? VACATION_ENGINE_CONFIG.VACATIONS_SHEET
    : 'VACATIONS';
}

const SHEET_SCHEMAS = Object.freeze({
  monthly: Object.freeze({
    key: 'monthly',
    legacyKey: 'MONTHLY',
    type: 'monthly',
    title: 'Monthly sheet',
    dynamicName: true,
    required: true,
    sheetNamePattern: /^\d{2}$/,
    headerRow: Number(CONFIG.DATE_ROW) || 1,
    dateRow: Number(CONFIG.DATE_ROW) || 1,
    codeRangeA1: CONFIG.CODE_RANGE_A1,
    osFioRangeA1: CONFIG.OS_FIO_RANGE,
    dataStartRow: _monthlyMatrix_().startRow,
    dataEndRow: _monthlyMatrix_().endRow,
    matrix: _monthlyMatrix_(),
    columns: Object.freeze({
      phone: 1,
      callsign: 2,
      position: 3,
      oshs: 4,
      rank: 5,
      brDays: 6,
      fio: 7
    }),
    fields: Object.freeze({
      phone:    { col: 1, type: 'string', required: false, allowBlank: true, label: 'Телефон' },
      callsign: { col: 2, type: 'string', required: true,  allowBlank: false, label: 'Позивний' },
      position: { col: 3, type: 'string', required: false, allowBlank: true, label: 'Посада' },
      oshs:     { col: 4, type: 'string', required: false, allowBlank: true, label: 'ОШС' },
      rank:     { col: 5, type: 'string', required: false, allowBlank: true, label: 'Звання' },
      brDays:   { col: 6, type: 'number|string', required: false, allowBlank: true, label: 'Дні БР' },
      fio:      { col: 7, type: 'string', required: true,  allowBlank: false, label: 'ПІБ' }
    }),
    keyFields: ['callsign', 'fio'],
    requiredFields: ['callsign', 'fio'],
    nullableFields: ['phone', 'position', 'oshs', 'rank', 'brDays'],
    searchableFields: ['callsign', 'fio'],
    notes: 'Канонічне джерело щоденних кодів і статусів для sidebar/SEND_PANEL/зведень.'
  }),

  phones: Object.freeze({
    key: 'phones',
    legacyKey: 'PHONES',
    type: 'table',
    title: 'PHONES',
    name: CONFIG.PHONES_SHEET,
    headerRow: 1,
    dataStartRow: 2,
    required: true,
    columns: Object.freeze({ fio: 1, phone: 2, role: 3, birthday: 4 }),
    fields: Object.freeze({
      fio:      { col: 1, type: 'string', required: true,  allowBlank: false, label: 'ПІБ' },
      phone:    { col: 2, type: 'string', required: false, allowBlank: true,  label: 'Телефон' },
      role:     { col: 3, type: 'string', required: false, allowBlank: true,  label: 'Роль' },
      birthday: { col: 4, type: 'date|string', required: false, allowBlank: true, label: 'День народження' }
    }),
    headerAliases: Object.freeze({
      fio: ['ПІБ', 'ПІБ/ФІО', 'ФІО', 'FIO'],
      phone: ['Телефон', 'Phone'],
      role: ['Роль', 'Role'],
      birthday: ['День народження', 'Birthday']
    }),
    keyFields: ['fio', 'role'],
    requiredFields: ['fio'],
    nullableFields: ['phone', 'role', 'birthday'],
    searchableFields: ['fio', 'role', 'phone']
  }),

  dict: Object.freeze({
    key: 'dict',
    legacyKey: 'DICT',
    type: 'table',
    title: 'DICT',
    name: CONFIG.DICT_SHEET,
    headerRow: 1,
    dataStartRow: 2,
    required: true,
    columns: Object.freeze({ code: 1, service: 2, place: 3, tasks: 4 }),
    fields: Object.freeze({
      code:    { col: 1, type: 'string', required: true,  allowBlank: false, label: 'Код' },
      service: { col: 2, type: 'string', required: false, allowBlank: true,  label: 'Служба' },
      place:   { col: 3, type: 'string', required: false, allowBlank: true,  label: 'Місце' },
      tasks:   { col: 4, type: 'string', required: false, allowBlank: true,  label: 'Завдання' }
    }),
    headerAliases: Object.freeze({
      code: ['Код', 'Code'],
      service: ['Служба', 'Service'],
      place: ['Місце', 'Place'],
      tasks: ['Завдання', 'Tasks']
    }),
    keyFields: ['code'],
    requiredFields: ['code'],
    nullableFields: ['service', 'place', 'tasks'],
    searchableFields: ['code', 'service', 'place', 'tasks']
  }),

  dictSum: Object.freeze({
    key: 'dictSum',
    legacyKey: 'DICT_SUM',
    type: 'table',
    title: 'DICT_SUM',
    name: CONFIG.DICT_SUM_SHEET,
    headerRow: 1,
    dataStartRow: 2,
    required: true,
    columns: Object.freeze({ code: 1, label: 2, order: 3, showZero: 4 }),
    fields: Object.freeze({
      code:     { col: 1, type: 'string', required: true,  allowBlank: false, label: 'Код' },
      label:    { col: 2, type: 'string', required: false, allowBlank: true,  label: 'Назва' },
      order:    { col: 3, type: 'number|string', required: true, allowBlank: false, label: 'Порядок' },
      showZero: { col: 4, type: 'boolean|string', required: false, allowBlank: true, label: 'Показувати 0' }
    }),
    headerAliases: Object.freeze({
      code: ['Код', 'Code'],
      label: ['Назва', 'Label'],
      order: ['Порядок', 'Order'],
      showZero: ['Показувати 0', 'ShowZero', 'Show zero']
    }),
    keyFields: ['code'],
    requiredFields: ['code', 'order'],
    nullableFields: ['label', 'showZero'],
    searchableFields: ['code', 'label']
  }),

  sendPanel: Object.freeze({
    key: 'sendPanel',
    legacyKey: 'SEND_PANEL',
    type: 'table',
    title: 'SEND_PANEL',
    name: CONFIG.SEND_PANEL_SHEET,
    titleRows: Number(CONFIG.SEND_PANEL_TITLE_ROWS) || 1,
    headerRow: Number(CONFIG.SEND_PANEL_HEADER_ROW) || 2,
    dataStartRow: Number(CONFIG.SEND_PANEL_DATA_START_ROW) || 3,
    required: false,
    columns: Object.freeze({ fio: 1, phone: 2, code: 3, tasks: 4, status: 5, action: 6, sent: 7 }),
    fields: Object.freeze({
      fio:    { col: 1, type: 'string', required: true,  allowBlank: false, label: 'ПІБ' },
      phone:  { col: 2, type: 'string', required: false, allowBlank: true,  label: 'Телефон' },
      code:   { col: 3, type: 'string', required: true,  allowBlank: false, label: 'Код' },
      tasks:  { col: 4, type: 'string', required: false, allowBlank: true,  label: 'Завдання' },
      status: { col: 5, type: 'string', required: false, allowBlank: true,  label: 'Статус' },
      action: { col: 6, type: 'string', required: false, allowBlank: true,  label: 'Дія' },
      sent:   { col: 7, type: 'boolean|string', required: false, allowBlank: true, label: 'Відправлено' }
    }),
    headerAliases: Object.freeze({
      fio: ['ПІБ', 'ФІО'],
      phone: ['Телефон'],
      code: ['Код'],
      tasks: ['Завдання'],
      status: ['Статус'],
      action: ['Дія'],
      sent: ['Відправлено']
    }),
    keyFields: ['fio', 'phone', 'code'],
    requiredFields: ['fio', 'code'],
    nullableFields: ['phone', 'tasks', 'status', 'action', 'sent'],
    searchableFields: ['fio', 'phone', 'code', 'status']
  }),

  vacations: Object.freeze({
    key: 'vacations',
    legacyKey: 'VACATIONS',
    type: 'table',
    title: 'VACATIONS',
    name: _vacationSheetName_(),
    headerRow: 1,
    dataStartRow: 2,
    required: false,
    columns: Object.freeze({
      fio: ((typeof VACATION_ENGINE_CONFIG !== 'undefined' && VACATION_ENGINE_CONFIG && VACATION_ENGINE_CONFIG.NAME_COL) || 1),
      startDate: ((typeof VACATION_ENGINE_CONFIG !== 'undefined' && VACATION_ENGINE_CONFIG && VACATION_ENGINE_CONFIG.START_COL) || 2),
      endDate: ((typeof VACATION_ENGINE_CONFIG !== 'undefined' && VACATION_ENGINE_CONFIG && VACATION_ENGINE_CONFIG.END_COL) || 3),
      vacationNo: ((typeof VACATION_ENGINE_CONFIG !== 'undefined' && VACATION_ENGINE_CONFIG && VACATION_ENGINE_CONFIG.NUM_COL) || 4),
      active: ((typeof VACATION_ENGINE_CONFIG !== 'undefined' && VACATION_ENGINE_CONFIG && VACATION_ENGINE_CONFIG.ACTIVE_COL) || 5),
      notify: ((typeof VACATION_ENGINE_CONFIG !== 'undefined' && VACATION_ENGINE_CONFIG && VACATION_ENGINE_CONFIG.NOTIFY_COL) || 6)
    }),
    fields: Object.freeze({
      fio:        { col: ((typeof VACATION_ENGINE_CONFIG !== 'undefined' && VACATION_ENGINE_CONFIG && VACATION_ENGINE_CONFIG.NAME_COL) || 1), type: 'string', required: true,  allowBlank: false, label: 'ПІБ' },
      startDate:  { col: ((typeof VACATION_ENGINE_CONFIG !== 'undefined' && VACATION_ENGINE_CONFIG && VACATION_ENGINE_CONFIG.START_COL) || 2), type: 'date|string', required: true, allowBlank: false, label: 'Початок' },
      endDate:    { col: ((typeof VACATION_ENGINE_CONFIG !== 'undefined' && VACATION_ENGINE_CONFIG && VACATION_ENGINE_CONFIG.END_COL) || 3), type: 'date|string', required: true, allowBlank: false, label: 'Кінець' },
      vacationNo: { col: ((typeof VACATION_ENGINE_CONFIG !== 'undefined' && VACATION_ENGINE_CONFIG && VACATION_ENGINE_CONFIG.NUM_COL) || 4), type: 'string', required: false, allowBlank: true, label: 'Номер' },
      active:     { col: ((typeof VACATION_ENGINE_CONFIG !== 'undefined' && VACATION_ENGINE_CONFIG && VACATION_ENGINE_CONFIG.ACTIVE_COL) || 5), type: 'boolean|string', required: false, allowBlank: true, label: 'Активна' },
      notify:     { col: ((typeof VACATION_ENGINE_CONFIG !== 'undefined' && VACATION_ENGINE_CONFIG && VACATION_ENGINE_CONFIG.NOTIFY_COL) || 6), type: 'boolean|string', required: false, allowBlank: true, label: 'Notify' }
    }),
    keyFields: ['fio', 'startDate', 'endDate'],
    requiredFields: ['fio', 'startDate', 'endDate'],
    nullableFields: ['vacationNo', 'active', 'notify'],
    searchableFields: ['fio', 'vacationNo', 'active']
  }),

  log: Object.freeze({
    key: 'log',
    legacyKey: 'LOG',
    type: 'table',
    title: 'LOG',
    name: CONFIG.LOG_SHEET,
    headerRow: 1,
    dataStartRow: 2,
    required: false,
    columns: Object.freeze({
      timestamp: 1,
      reportDateStr: 2,
      sheet: 3,
      cell: 4,
      fio: 5,
      phone: 6,
      code: 7,
      service: 8,
      place: 9,
      tasks: 10,
      message: 11,
      link: 12
    }),
    fields: Object.freeze({
      timestamp:     { col: 1, type: 'date|string', required: true,  allowBlank: false, label: 'Timestamp' },
      reportDateStr: { col: 2, type: 'string', required: false, allowBlank: true, label: 'ReportDate' },
      sheet:         { col: 3, type: 'string', required: false, allowBlank: true, label: 'Sheet' },
      cell:          { col: 4, type: 'string', required: false, allowBlank: true, label: 'Cell' },
      fio:           { col: 5, type: 'string', required: false, allowBlank: true, label: 'FIO' },
      phone:         { col: 6, type: 'string', required: false, allowBlank: true, label: 'Phone' },
      code:          { col: 7, type: 'string', required: false, allowBlank: true, label: 'Code' },
      service:       { col: 8, type: 'string', required: false, allowBlank: true, label: 'Service' },
      place:         { col: 9, type: 'string', required: false, allowBlank: true, label: 'Place' },
      tasks:         { col: 10, type: 'string', required: false, allowBlank: true, label: 'Tasks' },
      message:       { col: 11, type: 'string', required: false, allowBlank: true, label: 'Message' },
      link:          { col: 12, type: 'string', required: false, allowBlank: true, label: 'Link' }
    }),
    keyFields: ['timestamp', 'fio', 'code'],
    requiredFields: ['timestamp'],
    nullableFields: ['reportDateStr', 'sheet', 'cell', 'fio', 'phone', 'code', 'service', 'place', 'tasks', 'message', 'link'],
    searchableFields: ['fio', 'phone', 'code', 'sheet']
  })
});

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
  const name = explicitSheetName ? String(explicitSheetName).trim() : (canonical.name || null);
  const out = Object.assign({}, canonical, {
    key: canonical.legacyKey || canonical.key,
    name: name,
    dynamicName: !!canonical.dynamicName,
    fields: canonical.fields,
    columns: canonical.columns,
    legacyKey: canonical.legacyKey || canonical.key
  });
  return out;
}

function getMonthlySheetSchema_(sheetName) {
  return _toLegacySchema_(SHEET_SCHEMAS.monthly, String(sheetName || '').trim() || getBotMonthSheetName_());
}

const SheetSchemas_ = (function() {
  function get(schemaKeyOrSheetName) {
    const key = String(schemaKeyOrSheetName || '').trim();
    if (!key) throw new Error('Не передано ключ схеми листа');
    if (/^\d{2}$/.test(key)) return getMonthlySheetSchema_(key);
    const schema = _canonicalSchemaMap_()[key] || _canonicalSchemaMap_()[key.toUpperCase()];
    if (!schema) throw new Error(`Схема "${schemaKeyOrSheetName}" не знайдена`);
    if (schema === SHEET_SCHEMAS.monthly) return getMonthlySheetSchema_(getBotMonthSheetName_());
    return _toLegacySchema_(schema);
  }

  function getAll() {
    return {
      MONTHLY: getMonthlySheetSchema_(getBotMonthSheetName_()),
      PHONES: _toLegacySchema_(SHEET_SCHEMAS.phones),
      DICT: _toLegacySchema_(SHEET_SCHEMAS.dict),
      DICT_SUM: _toLegacySchema_(SHEET_SCHEMAS.dictSum),
      SEND_PANEL: _toLegacySchema_(SHEET_SCHEMAS.sendPanel),
      VACATIONS: _toLegacySchema_(SHEET_SCHEMAS.vacations),
      LOG: _toLegacySchema_(SHEET_SCHEMAS.log)
    };
  }

  function resolveSheetName(schemaKey, explicitName) {
    if (explicitName) return String(explicitName).trim();
    const schema = get(schemaKey);
    return schema.name || '';
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
  const schema = typeof schemaOrKey === 'string' ? getSheetSchema_(schemaOrKey) : schemaOrKey;
  return Object.keys((schema && schema.fields) || (schema && schema.columns) || {});
}

function getSchemaFieldColumn_(schemaOrKey, fieldName) {
  const schema = typeof schemaOrKey === 'string' ? getSheetSchema_(schemaOrKey) : schemaOrKey;
  if (!schema) throw new Error('Schema not found');
  if (schema.fields && schema.fields[fieldName]) return Number(schema.fields[fieldName].col);
  if (schema.columns && fieldName in schema.columns) return Number(schema.columns[fieldName]);
  throw new Error(`Поле "${fieldName}" не описане у схемі ${schema.key || ''}`);
}

function getSchemaLastColumn_(schemaOrKey) {
  const schema = typeof schemaOrKey === 'string' ? getSheetSchema_(schemaOrKey) : schemaOrKey;
  return Math.max.apply(null, getSchemaFieldNames_(schema).map(function(name) {
    return getSchemaFieldColumn_(schema, name);
  }).concat([1]));
}

function getSchemaSheetName_(schemaOrKey, options) {
  const schema = typeof schemaOrKey === 'string' ? getSheetSchema_(schemaOrKey) : schemaOrKey;
  if (schema.type === 'monthly' || schema.dynamicName) {
    if (options && options.sheetName) return String(options.sheetName).trim();
    return String(schema.name || getBotMonthSheetName_()).trim();
  }
  return String(schema.name || '').trim();
}

function validateSheetHeadersBySchema_(sheet, schemaOrKey) {
  const schema = typeof schemaOrKey === 'string' ? getSheetSchema_(schemaOrKey) : schemaOrKey;
  const report = {
    ok: true,
    schema: schema.key,
    sheet: sheet ? sheet.getName() : '',
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
      const codeRange = sheet.getRange(schema.codeRangeA1 || CONFIG.CODE_RANGE_A1);
      if (codeRange.getNumRows() <= 0 || codeRange.getNumColumns() <= 0) {
        report.ok = false;
        report.mismatches.push(`Некоректний codeRange ${schema.codeRangeA1 || CONFIG.CODE_RANGE_A1}`);
      }
    } catch (e) {
      report.ok = false;
      report.mismatches.push(e && e.message ? e.message : String(e));
    }
    return report;
  }

  const headerRow = Number(schema.headerRow) || 1;
  const lastCol = Math.max(sheet.getLastColumn(), getSchemaLastColumn_(schema));
  const headers = lastCol > 0 ? sheet.getRange(headerRow, 1, 1, lastCol).getDisplayValues()[0] : [];

  getSchemaFieldNames_(schema).forEach(function(fieldName) {
    const field = (schema.fields && schema.fields[fieldName]) || { col: getSchemaFieldColumn_(schema, fieldName), label: fieldName };
    const actual = String(headers[field.col - 1] || '').trim();
    const aliases = (schema.headerAliases && schema.headerAliases[fieldName]) || [field.label || fieldName];
    if (!actual) {
      if (field.required) {
        report.ok = false;
        report.missing.push(fieldName);
      } else {
        report.warnings.push(`Порожній header для ${fieldName}`);
      }
      return;
    }
    if (aliases.length && aliases.indexOf(actual) === -1) {
      report.mismatches.push(`${fieldName}: actual="${actual}", expected one of [${aliases.join(', ')}]`);
    }
  });

  if (report.mismatches.length) report.ok = false;
  return report;
}
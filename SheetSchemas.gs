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

function _columnNumberToLetter_(colNumber) {
  var n = Number(colNumber) || 0;
  if (n < 1) return 'A';
  var letters = '';
  while (n > 0) {
    var rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

function _looksLikeMonthlyDateHeader_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return true;
  var s = String(value || '').trim();
  if (!s) return false;
  if (/^\d{4,5}(\.\d+)?$/.test(s)) return true;
  if (/^\d{1,2}[.\-/]\d{1,2}([.\-/]\d{2,4})?$/.test(s)) return true;
  return false;
}

function _monthlyLayoutHeaderNorm_(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[’'`"ʼ]/g, '')
    .replace(/\s+/g, ' ');
}

function _monthlyDataEndRowFromSheet_(sheet, fallbackRow, markerCols, requireAllMarkers) {
  var configuredDataEndRow = _ssParseNumber_(
    (typeof MONTHLY_CONFIG !== 'undefined' &&
      MONTHLY_CONFIG &&
      MONTHLY_CONFIG.LAST_DATA_ROW) ||
      _ssConfigValue_('LAST_DATA_ROW', fallbackRow || 44),
    fallbackRow || 44,
  );
  var sheetLastRow = 0;
  try {
    sheetLastRow = Number(sheet.getLastRow()) || 0;
  } catch (e) {}

  var scanLastRow = Math.min(
    Math.max(sheetLastRow, configuredDataEndRow, 2),
    1000,
  );
  var cols = Array.isArray(markerCols) && markerCols.length ? markerCols : [2];
  var columnsValues = [];
  for (var i = 0; i < cols.length; i++) {
    var col = Number(cols[i]) || 0;
    if (col < 1 || scanLastRow < 2) {
      columnsValues.push([]);
      continue;
    }
    try {
      columnsValues.push(
        sheet.getRange(2, col, scanLastRow - 1, 1).getDisplayValues(),
      );
    } catch (e) {
      columnsValues.push([]);
    }
  }

  for (var r = scanLastRow - 2; r >= 0; r--) {
    var filled = 0;
    for (var c = 0; c < columnsValues.length; c++) {
      if (_ssTrimmedString_((columnsValues[c][r] || [])[0], '')) filled++;
    }

    if (requireAllMarkers ? filled === columnsValues.length : filled > 0) {
      return r + 2;
    }
  }

  return Math.max(2, configuredDataEndRow);
}

function _monthlyLastDateColFromRow_(rowValues, firstDateCol) {
  var lastDateCol = firstDateCol;
  for (var c = firstDateCol - 1; c < rowValues.length; c++) {
    if (_looksLikeMonthlyDateHeader_(rowValues[c])) {
      lastDateCol = c + 1;
      continue;
    }
    if (lastDateCol >= firstDateCol) break;
  }
  return lastDateCol;
}

function _monthlyCodeRangeA1_(firstDateCol, lastDateCol, dataEndRow) {
  return (
    _columnNumberToLetter_(firstDateCol) +
    '2:' +
    _columnNumberToLetter_(lastDateCol) +
    dataEndRow
  );
}

/**
 * Визначає геометрію місячного листа з шапки (еталон 1.xlsx):
 * - standard (02–05): ТЕЛЕФОН у A, дати з H
 * - compact (06): Позивний у B, БР у A, дати з C
 */
function detectMonthlyLayoutFromSheet_(sheet) {
  if (!sheet || typeof sheet.getRange !== 'function') return null;

  var dateRow = _ssParseNumber_(_ssConfigValue_('DATE_ROW', 1), 1);
  var lastCol = Math.max(Number(sheet.getLastColumn()) || 0, 1);
  var row1 = sheet.getRange(dateRow, 1, 1, lastCol).getDisplayValues()[0] || [];

  var colA = _monthlyLayoutHeaderNorm_(row1[0]);
  var colB = _monthlyLayoutHeaderNorm_(row1[1]);
  var isPhoneHeaderA =
    colA.indexOf('тел') !== -1 || colA.indexOf('phone') !== -1;
  var isCallsignB =
    colB.indexOf('позивн') !== -1 || colB === 'callsign';
  var firstDateCol = 3;
  var cIsDate = _looksLikeMonthlyDateHeader_(row1[firstDateCol - 1]);

  if (isCallsignB && cIsDate && !isPhoneHeaderA) {
    var compactDataEndRow = _monthlyDataEndRowFromSheet_(
      sheet,
      30,
      [1, 2],
      true,
    );
    var compactLastDateCol = _monthlyLastDateColFromRow_(row1, firstDateCol);
    var compactRangeA1 = _monthlyCodeRangeA1_(
      firstDateCol,
      compactLastDateCol,
      compactDataEndRow,
    );

    return {
      layout: 'compact',
      codeRangeA1: compactRangeA1,
      matrix: _parseA1RangeRef_(compactRangeA1),
      fields: {
        phone: 0,
        callsign: 2,
        position: 0,
        oshs: 0,
        rank: 0,
        brDays: 1,
        fml: 0,
      },
    };
  }

  firstDateCol = 8;
  var hIsDate = _looksLikeMonthlyDateHeader_(row1[firstDateCol - 1]);
  if (!isPhoneHeaderA || !isCallsignB || !hIsDate) return null;

  var standardDataEndRow = _monthlyDataEndRowFromSheet_(sheet, 44, [2], false);
  var standardLastDateCol = _monthlyLastDateColFromRow_(row1, firstDateCol);
  var standardRangeA1 = _monthlyCodeRangeA1_(
    firstDateCol,
    standardLastDateCol,
    standardDataEndRow,
  );

  return {
    layout: 'standard',
    codeRangeA1: standardRangeA1,
    matrix: _parseA1RangeRef_(standardRangeA1),
    fields: {
      phone: 1,
      callsign: 2,
      position: 3,
      oshs: 4,
      rank: 5,
      brDays: 6,
      fml: 7,
    },
  };
}

function _applyMonthlyLayoutToSchema_(baseSchema, layout) {
  if (!layout || !baseSchema) return baseSchema;

  var fields = _ssFreeze_({
    phone: _ssFreeze_({
      col: layout.fields.phone || 0,
      type: 'string',
      required: false,
      allowBlank: true,
      label: 'Phone (legacy display only)',
    }),
    callsign: _ssFreeze_({
      col: layout.fields.callsign,
      type: 'string',
      required: true,
      allowBlank: false,
      label: 'Callsign',
    }),
    position: _ssFreeze_({
      col: layout.fields.position || 0,
      type: 'string',
      required: false,
      allowBlank: true,
      label: 'Position (legacy display only)',
    }),
    oshs: _ssFreeze_({
      col: layout.fields.oshs || 0,
      type: 'string',
      required: false,
      allowBlank: true,
      label: 'OSHS (legacy display only)',
    }),
    rank: _ssFreeze_({
      col: layout.fields.rank || 0,
      type: 'string',
      required: false,
      allowBlank: true,
      label: 'Rank (legacy display only)',
    }),
    brDays: _ssFreeze_({
      col: layout.fields.brDays,
      type: 'number|string',
      required: false,
      allowBlank: true,
      label: 'BRDays',
    }),
    fml: _ssFreeze_({
      col: layout.fields.fml || 0,
      type: 'string',
      required: false,
      allowBlank: true,
      label: 'FML (legacy display only)',
    }),
  });

  var cols = {};
  for (var f in fields) {
    if (Object.prototype.hasOwnProperty.call(fields, f)) {
      cols[f] = fields[f].col;
    }
  }

  return Object.assign({}, baseSchema, {
    layout: layout.layout,
    codeRangeA1: layout.codeRangeA1,
    matrix: layout.matrix,
    dataStartRow: layout.matrix.startRow,
    dataEndRow: layout.matrix.endRow,
    fields: fields,
    columns: cols,
    notes:
      (baseSchema.notes || '') +
      (layout.layout === 'compact'
        ? ' Compact monthly layout (callsign B, BR A, dates from C).'
        : ' Standard monthly layout (dates from H).'),
  });
}

function getMonthlyCodeRangeA1ForSheet_(sheet) {
  var sheetName =
    sheet && typeof sheet.getName === 'function' ? sheet.getName() : '';
  try {
    if (sheet && typeof sheet.getRange === 'function') {
      var directLayout = detectMonthlyLayoutFromSheet_(sheet);
      if (directLayout && directLayout.codeRangeA1) {
        return directLayout.codeRangeA1;
      }
    }
    var schema = getMonthlySheetSchema_(sheetName);
    if (schema && schema.codeRangeA1) return schema.codeRangeA1;
  } catch (e) {}
  return String(
    (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.CODE_RANGE_A1) ||
      'H2:AL40',
  ).trim();
}

function getMonthlyCallsignColForSheet_(sheet) {
  var sheetName =
    sheet && typeof sheet.getName === 'function' ? sheet.getName() : '';
  try {
    if (sheet && typeof sheet.getRange === 'function') {
      var directLayout = detectMonthlyLayoutFromSheet_(sheet);
      if (directLayout && directLayout.fields && directLayout.fields.callsign) {
        return Number(directLayout.fields.callsign) || 2;
      }
    }
    var schema = getMonthlySheetSchema_(sheetName);
    if (schema && schema.columns && schema.columns.callsign) {
      return Number(schema.columns.callsign) || 2;
    }
  } catch (e) {}
  return Number(
    (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.CALLSIGN_COL) || 2,
  );
}

function getMonthlyBrDaysColForSheet_(sheet) {
  var sheetName =
    sheet && typeof sheet.getName === 'function' ? sheet.getName() : '';
  try {
    if (sheet && typeof sheet.getRange === 'function') {
      var directLayout = detectMonthlyLayoutFromSheet_(sheet);
      if (directLayout && directLayout.fields && directLayout.fields.brDays) {
        return Number(directLayout.fields.brDays) || 6;
      }
    }
    var schema = getMonthlySheetSchema_(sheetName);
    if (schema && schema.columns && schema.columns.brDays) {
      return Number(schema.columns.brDays) || 6;
    }
  } catch (e) {}
  return Number(
    (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.BR_COL) || 6,
  );
}

function getMonthlyFmlColForSheet_(sheet) {
  var sheetName =
    sheet && typeof sheet.getName === 'function' ? sheet.getName() : '';
  try {
    if (sheet && typeof sheet.getRange === 'function') {
      var directLayout = detectMonthlyLayoutFromSheet_(sheet);
      if (directLayout && directLayout.fields) {
        return Number(directLayout.fields.fml) || 0;
      }
    }
    var schema = getMonthlySheetSchema_(sheetName);
    if (schema && schema.columns) {
      return Number(schema.columns.fml) || 0;
    }
  } catch (e) {}
  return Number(
    (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.FML_COL) || 7,
  );
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
    osFmlRangeA1: _ssTrimmedString_(_ssConfigValue_('OS_FML_RANGE_A1', 'G2:G40'), 'G2:G40'),
    dataStartRow: matrix.startRow,
    dataEndRow: matrix.endRow,
    matrix: matrix,
    fields: _ssFreeze_({
      phone:    _ssFreeze_({ col: 1, type: 'string', required: false, allowBlank: true,  label: 'Phone (legacy display only)' }),
      callsign: _ssFreeze_({ col: 2, type: 'string', required: true,  allowBlank: false, label: 'Callsign' }),
      position: _ssFreeze_({ col: 3, type: 'string', required: false, allowBlank: true,  label: 'Position (legacy display only)' }),
      oshs:     _ssFreeze_({ col: 4, type: 'string', required: false, allowBlank: true,  label: 'OSHS (legacy display only)' }),
      rank:     _ssFreeze_({ col: 5, type: 'string', required: false, allowBlank: true,  label: 'Rank (legacy display only)' }),
      brDays:   _ssFreeze_({ col: 6, type: 'number|string', required: false, allowBlank: true, label: 'BRDays' }),
      fml:      _ssFreeze_({ col: 7, type: 'string', required: false, allowBlank: true,  label: 'FML (legacy display only)' })
    }),

    keyFields: ['callsign'],
    requiredFields: ['callsign'],
    nullableFields: ['phone', 'position', 'oshs', 'rank', 'brDays', 'fml'],
    searchableFields: ['callsign'],
    notes: 'Робочий графік: ідентифікатор/позивний рядка, БР і щоденні коди. Персональні дані читаються з PERSONNEL.'
  });
}

function _ssBuildPersonnelSchema_() {
  return _ssFreeze_({
    key: 'personnel',
    legacyKey: 'PERSONNEL',
    type: 'table',
    title: 'PERSONNEL',
    name: _ssTrimmedString_(_ssConfigValue_('PERSONNEL_SHEET', 'PERSONNEL'), 'PERSONNEL'),
    headerRow: 1,
    dataStartRow: 2,
    required: true,
    headerBased: true,
    requiredHeaders: [
      'FML', 'Birthday', 'Phone', 'Callsign', 'Position', 'OSH_4', 'Status'
    ],
    optionalHeaders: [
      'ID', 'Age', 'Days_until_birthday', 'Unit',
      '2_Phone', 'Title', 'Rank', 'TEMPLATE'
    ],
    canonicalHeaderOrder: [
      'ID', 'FML', 'Birthday', 'Age', 'Days_until_birthday',
      'Phone', '2_Phone', 'Callsign', 'TEMPLATE', 'Rank', 'Position',
      'OSH_4', 'Unit', 'Status'
    ],
    notes: 'Єдине джерело даних людини. Місячний графік: Callsign. Status: канон або значення з книги (В наявності, Відпустка, …).'
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
      callsign: _ssFreeze_({ col: 1, type: 'string', required: true,  allowBlank: false, label: 'Callsign' }),
      phone:    _ssFreeze_({ col: 2, type: 'string', required: false, allowBlank: true,  label: 'Phone' }),
      phone2:   _ssFreeze_({ col: 3, type: 'string', required: false, allowBlank: true,  label: 'Phone 2' }),
      role:     _ssFreeze_({ col: 1, type: 'string', required: false, allowBlank: true,  label: 'Callsign' })
    }),

    headerAliases: _ssFreeze_({
      fml: ['FML', 'FullName', 'ПІБ'],
      phone: ['Phone', 'Телефон'],
      phone2: ['Phone 2', '2 Phone', '2_Phone', 'Телефон 2'],
      callsign: ['Callsign', 'Позивний'],
      role: ['Role', 'Роль', 'Позивний', 'Callsign'],
      birthday: ['Birthday', 'День народження']
    }),

    keyFields: ['callsign', 'role'],
    requiredFields: ['callsign'],
    nullableFields: ['phone', 'phone2', 'role'],
    searchableFields: ['callsign', 'role', 'phone']
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
      service: _ssFreeze_({ col: 2, type: 'string', required: false, allowBlank: true,  label: 'Вид служби' }),
      place:   _ssFreeze_({ col: 3, type: 'string', required: false, allowBlank: true,  label: 'Місце' }),
      tasks:   _ssFreeze_({ col: 4, type: 'string', required: false, allowBlank: true,  label: 'Завдання' })
    }),

    headerAliases: _ssFreeze_({
      code: ['Code', 'Код'],
      service: ['Service Type', 'Service', 'Служба', 'Вид служби'],
      place: ['Location', 'Place', 'Місце'],
      tasks: ['Task', 'Tasks', 'Завдання']
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
      order:    _ssFreeze_({ col: 3, type: 'number|string', required: true, allowBlank: false, label: 'Порядок' })
    }),

    headerAliases: _ssFreeze_({
      code: ['Code', 'Код'],
      label: ['Label', 'Назва', 'Name'],
      order: ['Queue', 'SortOrder', 'Order', 'Порядок']
    }),

    keyFields: ['code'],
    requiredFields: ['code', 'order'],
    nullableFields: ['label'],
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
      fml: ['FML', 'FullName', 'ПІБ'], phone: ['Phone', 'Телефон'], code: ['Code', 'Код'], tasks: ['Tasks', 'Завдання'], status: ['Status', 'Статус'], sent: ['Sent', 'Відправлено'], action: ['Action', 'Дія']
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
      fml:        _ssFreeze_({ col: _ssParseNumber_(_ssVacationConfigValue_('NAME_COL', 1), 1), type: 'string', required: true,  allowBlank: false, label: 'FML' }),
      startDate:  _ssFreeze_({ col: _ssParseNumber_(_ssVacationConfigValue_('START_COL', 2), 2), type: 'date|string', required: true, allowBlank: false, label: 'Start date' }),
      endDate:    _ssFreeze_({ col: _ssParseNumber_(_ssVacationConfigValue_('END_COL', 3), 3), type: 'date|string', required: true, allowBlank: false, label: 'End date' }),
      vacationNo: _ssFreeze_({ col: _ssParseNumber_(_ssVacationConfigValue_('NUM_COL', 4), 4), type: 'string', required: false, allowBlank: true, label: 'Vacation №' }),
      active:     _ssFreeze_({ col: _ssParseNumber_(_ssVacationConfigValue_('ACTIVE_COL', 5), 5), type: 'boolean|string', required: false, allowBlank: true, label: 'Active' }),
      notify:     _ssFreeze_({ col: _ssParseNumber_(_ssVacationConfigValue_('NOTIFY_COL', 6), 6), type: 'boolean|string', required: false, allowBlank: true, label: 'Notify' })
    }),

    headerAliases: _ssFreeze_({
      fml: ['FML', 'FullName', 'ПІБ'],
      startDate: [
        'StartDate',
        'Start date',
        'Початок',
        'Початок включно',
        'Початок відпустки включно'
      ],
      endDate: [
        'EndDate',
        'End Date',
        'End date',
        'Кінець',
        'Кінець включно',
        'Кінець відпустки включно'
      ],
      vacationNo: ['Vacation №', 'VacationNo', 'Vacation number', 'Номер'],
      active: ['Active', 'Активна'],
      notify: ['Notify', 'Сповістити', 'Сповіщення']
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
      timestamp:     _ssFreeze_({ col: 1, type: 'date|string', required: true,  allowBlank: false, label: 'Timestamp' }),
      reportDateStr: _ssFreeze_({ col: 2, type: 'string', required: false, allowBlank: true, label: 'ReportDate' }),
      sheet:         _ssFreeze_({ col: 3, type: 'string', required: false, allowBlank: true, label: 'Sheet' }),
      cell:          _ssFreeze_({ col: 4, type: 'string', required: false, allowBlank: true, label: 'Cell' }),
      fml:           _ssFreeze_({ col: 5, type: 'string', required: false, allowBlank: true, label: 'FML' }),
      phone:         _ssFreeze_({ col: 6, type: 'string', required: false, allowBlank: true, label: 'Phone' }),
      code:          _ssFreeze_({ col: 7, type: 'string', required: false, allowBlank: true, label: 'Code' }),
      service:       _ssFreeze_({ col: 8, type: 'string', required: false, allowBlank: true, label: 'Service' }),
      place:         _ssFreeze_({ col: 9, type: 'string', required: false, allowBlank: true, label: 'Place' }),
      tasks:         _ssFreeze_({ col: 10, type: 'string', required: false, allowBlank: true, label: 'Tasks' }),
      message:       _ssFreeze_({ col: 11, type: 'string', required: false, allowBlank: true, label: 'Message' }),
      link:          _ssFreeze_({ col: 12, type: 'string', required: false, allowBlank: true, label: 'Link' })
    }),
    
    headerAliases: _ssFreeze_({
      timestamp: ['Timestamp', 'Мітка часу'], reportDateStr: ['ReportDate', 'Дата звіту'], sheet: ['Sheet', 'Аркуш'], cell: ['Cell', 'Клітинка'], fml: ['FML', 'FullName', 'ПІБ'], phone: ['Phone', 'Телефон'], code: ['Code', 'Код'], service: ['Service', 'Служба', 'Послуга'], place: ['Place', 'Місце'], tasks: ['Tasks', 'Завдання'], message: ['Message', 'Повідомлення'], link: ['Link', 'Посилання']
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
    personnel: _ssBuildPersonnelSchema_(),
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
    PERSONNEL: SHEET_SCHEMAS.personnel,
    personnel: SHEET_SCHEMAS.personnel,
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
  return ['monthly', 'personnel', 'phones', 'dict', 'dictSum', 'sendPanel', 'vacations', 'log'];
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
  var name = _ssTrimmedString_(sheetName, '') || _ssBotMonthSheetName_();
  var base = _toLegacySchema_(SHEET_SCHEMAS.monthly, name);

  try {
    var ss =
      typeof getWasbSpreadsheet_ === 'function' ? getWasbSpreadsheet_() : null;
    var sh = ss && name ? ss.getSheetByName(name) : null;
    var layout = sh ? detectMonthlyLayoutFromSheet_(sh) : null;
    if (layout) {
      return _applyMonthlyLayoutToSchema_(base, layout);
    }
  } catch (e) {}

  return base;
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

    if (key.toUpperCase() === 'MONTHLY') {
      return getMonthlySheetSchema_(_ssBotMonthSheetName_());
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
      PERSONNEL: _toLegacySchema_(SHEET_SCHEMAS.personnel),
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
  if (schema && schema.headerBased && Array.isArray(schema.canonicalHeaderOrder) && schema.canonicalHeaderOrder.length) {
    return schema.canonicalHeaderOrder.length;
  }

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

function _ssCanonicalHeaderKey_(value) {
  var text = _ssTrimmedString_(value, '');
  if (!text) return '';

  var lower = text
    .toLowerCase()
    .replace(/[’'`"ʼ]/g, '')
    .replace(/\s+/g, ' ');

  var aliases = {
    id: 'ID',
    fml: 'FML',
    full_name: 'FML',
    fullname: 'FML',
    'піб': 'FML',
    birthday: 'Birthday',
    'день народження': 'Birthday',
    age: 'Age',
    'вік': 'Age',
    days_until_birthday: 'Days_until_birthday',
    'days until birthday': 'Days_until_birthday',
    phone: 'Phone',
    'телефон': 'Phone',
    '2_phone': '2_Phone',
    '2 phone': '2_Phone',
    'телефон 2': '2_Phone',
    callsign: 'Callsign',
    'позивний': 'Callsign',
    title: 'Title',
    'звання': 'Title',
    rank: 'Rank',
    template: 'TEMPLATE',
    'phone 2': '2_Phone',
    position: 'Position',
    'посада': 'Position',
    osh_4: 'OSH_4',
    'osh 4': 'OSH_4',
    'ошс 4': 'OSH_4',
    oshs: 'OSH_4',
    unit: 'Unit',
    'підрозділ': 'Unit',
    status: 'Status',
    'статус': 'Status'
  };

  if (aliases[lower]) return aliases[lower];
  if (text === '2_Phone' || text === '2 Phone') return '2_Phone';
  if (text === 'Days_until_birthday') return 'Days_until_birthday';
  if (text === 'OSH_4') return 'OSH_4';
  return text;
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

  if (schema.headerBased) {
    var headerBasedRow = _ssParseNumber_(schema.headerRow, 1);
    var headerBasedLastCol = Math.max(Number(sheet.getLastColumn()) || 0, getSchemaLastColumn_(schema));
    var headerBasedHeaders = headerBasedLastCol > 0 ? sheet.getRange(headerBasedRow, 1, 1, headerBasedLastCol).getDisplayValues()[0] : [];
    var seenHeaders = {};

    headerBasedHeaders.forEach(function(header) {
      var canonical = _ssCanonicalHeaderKey_(header);
      if (!canonical) return;
      if (seenHeaders[canonical] === undefined) seenHeaders[canonical] = header;
    });

    (schema.requiredHeaders || []).forEach(function(headerName) {
      if (seenHeaders[headerName] === undefined) {
        report.ok = false;
        report.missing.push(headerName);
      }
    });

    (schema.optionalHeaders || []).forEach(function(headerName) {
      if (seenHeaders[headerName] === undefined) {
        report.warnings.push('Опційний header відсутній або не розпізнаний: ' + headerName);
      }
    });

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

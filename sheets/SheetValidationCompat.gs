/**
 * SheetValidationCompat.gs
 *
 * Сумісний helper для старих викликів:
 *   _setSingleRowValidation_(sheet, row, column, ruleOrValues, options)
 *   _setSingleRowValidation_(sheet, row, headerMap, key, ruleOrValues, options)
 *
 * Виправлення:
 * - перед sheet.getRange(row, col) гарантує, що аркуш має потрібну
 *   кількість рядків і колонок;
 * - не падає з "Координати діапазону перебувають за межами розміру аркуша".
 */

function _setSingleRowValidation_(sheet, row, columnOrMap, keyOrRuleOrValues, ruleOrValuesMaybe, optionsMaybe) {
  if (!sheet || typeof sheet.getRange !== 'function') {
    throw new Error('_setSingleRowValidation_: sheet is required');
  }

  var rowNum = Number(row);

  if (!rowNum || rowNum < 1) {
    throw new Error('_setSingleRowValidation_: invalid row: ' + row);
  }

  var colNum;
  var payload;
  var options;

  if (_svIsPlainObject_(columnOrMap) && typeof keyOrRuleOrValues === 'string' && arguments.length >= 5) {
    colNum = _svResolveColumnFromMap_(columnOrMap, keyOrRuleOrValues);
    payload = ruleOrValuesMaybe;
    options = optionsMaybe;
  } else {
    colNum = _svResolveColumn_(sheet, columnOrMap);
    payload = keyOrRuleOrValues;
    options = ruleOrValuesMaybe;
  }

  if (!colNum || colNum < 1) {
    throw new Error('_setSingleRowValidation_: column not found: ' + columnOrMap);
  }

  _svEnsureSheetSize_(sheet, rowNum, colNum);

  var range = sheet.getRange(rowNum, colNum);

  if (
    payload === null ||
    payload === undefined ||
    payload === false ||
    (Array.isArray(payload) && payload.length === 0)
  ) {
    range.clearDataValidations();
    return range;
  }

  var rule = _svBuildValidationRule_(payload, options);

  if (!rule) {
    range.clearDataValidations();
    return range;
  }

  range.setDataValidation(rule);
  return range;
}

function _svEnsureSheetSize_(sheet, rowNum, colNum) {
  var maxRows = sheet.getMaxRows();
  var maxColumns = sheet.getMaxColumns();

  if (rowNum > maxRows) {
    sheet.insertRowsAfter(maxRows, rowNum - maxRows);
  }

  if (colNum > maxColumns) {
    sheet.insertColumnsAfter(maxColumns, colNum - maxColumns);
  }
}

function _svBuildValidationRule_(payload, options) {
  if (payload && typeof payload.copy === 'function') {
    return payload;
  }

  var opts = _svNormalizeOptions_(options);
  var builder = SpreadsheetApp.newDataValidation();

  if (payload && typeof payload.getA1Notation === 'function') {
    builder.requireValueInRange(payload, opts.showDropdown);
    builder.setAllowInvalid(opts.allowInvalid);

    if (opts.helpText) {
      builder.setHelpText(opts.helpText);
    }

    return builder.build();
  }

  if (_svIsPlainObject_(payload)) {
    var type = String(payload.type || payload.kind || '').toLowerCase();

    if (type === 'checkbox' || payload.checkbox === true) {
      builder.requireCheckbox();
      builder.setAllowInvalid(opts.allowInvalid);

      if (payload.helpText || opts.helpText) {
        builder.setHelpText(String(payload.helpText || opts.helpText));
      }

      return builder.build();
    }

    var values = payload.values ||
      payload.allowedValues ||
      payload.options ||
      payload.list ||
      payload.items ||
      null;

    var objectOptions = {
      allowInvalid: payload.allowInvalid !== undefined ? payload.allowInvalid : opts.allowInvalid,
      showDropdown: payload.showDropdown !== undefined ? payload.showDropdown : opts.showDropdown,
      helpText: payload.helpText || opts.helpText
    };

    if (values && Array.isArray(values)) {
      return _svBuildListValidation_(values, objectOptions);
    }

    if (payload.range && typeof payload.range.getA1Notation === 'function') {
      builder.requireValueInRange(payload.range, objectOptions.showDropdown !== false);
      builder.setAllowInvalid(!!objectOptions.allowInvalid);

      if (objectOptions.helpText) {
        builder.setHelpText(String(objectOptions.helpText));
      }

      return builder.build();
    }
  }

  if (Array.isArray(payload)) {
    return _svBuildListValidation_(payload, opts);
  }

  if (typeof payload === 'string') {
    var text = payload.trim();

    if (!text) {
      return null;
    }

    if (text.toLowerCase() === 'checkbox') {
      builder.requireCheckbox();
      builder.setAllowInvalid(opts.allowInvalid);

      if (opts.helpText) {
        builder.setHelpText(opts.helpText);
      }

      return builder.build();
    }

    return _svBuildListValidation_([text], opts);
  }

  return _svBuildListValidation_([payload], opts);
}

function _svBuildListValidation_(values, options) {
  var opts = _svNormalizeOptions_(options);

  var cleanValues = values
    .filter(function(value) {
      return value !== null && value !== undefined && value !== '';
    })
    .map(function(value) {
      return String(value);
    });

  if (!cleanValues.length) {
    return null;
  }

  var builder = SpreadsheetApp.newDataValidation()
    .requireValueInList(cleanValues, opts.showDropdown)
    .setAllowInvalid(opts.allowInvalid);

  if (opts.helpText) {
    builder.setHelpText(opts.helpText);
  }

  return builder.build();
}

function _svNormalizeOptions_(options) {
  if (typeof options === 'boolean') {
    return {
      allowInvalid: options,
      showDropdown: true,
      helpText: ''
    };
  }

  options = options || {};

  return {
    allowInvalid: options.allowInvalid !== undefined ? !!options.allowInvalid : false,
    showDropdown: options.showDropdown !== undefined ? !!options.showDropdown : true,
    helpText: options.helpText ? String(options.helpText) : ''
  };
}

function _svResolveColumn_(sheet, column) {
  if (typeof column === 'number') {
    return column;
  }

  var raw = String(column || '').trim();

  if (!raw) {
    return 0;
  }

  if (/^\d+$/.test(raw)) {
    return Number(raw);
  }

  if (/^[A-Za-z]+$/.test(raw)) {
    return _svColumnLettersToNumber_(raw);
  }

  return _svFindHeaderColumn_(sheet, raw);
}

function _svResolveColumnFromMap_(map, key) {
  if (!map || !key) {
    return 0;
  }

  var rawKey = String(key).trim();

  if (map[rawKey] !== undefined) {
    return _svColumnValueToNumber_(map[rawKey]);
  }

  if (map.byCanonical && map.byCanonical[rawKey] !== undefined) {
    return _svColumnValueToNumber_(map.byCanonical[rawKey]);
  }

  if (map.byNormalized && map.byNormalized[_svNormalizeHeader_(rawKey)] !== undefined) {
    return _svColumnValueToNumber_(map.byNormalized[_svNormalizeHeader_(rawKey)]);
  }

  var normalizedKey = _svNormalizeHeader_(rawKey);
  var keys = Object.keys(map);

  for (var i = 0; i < keys.length; i++) {
    if (_svNormalizeHeader_(keys[i]) === normalizedKey) {
      return _svColumnValueToNumber_(map[keys[i]]);
    }
  }

  return 0;
}

function _svColumnValueToNumber_(value) {
  if (typeof value === 'number') {
    return value;
  }

  if (_svIsPlainObject_(value)) {
    if (typeof value.col === 'number') return value.col;
    if (typeof value.column === 'number') return value.column;
    if (typeof value.index === 'number') return value.index;
  }

  var raw = String(value || '').trim();

  if (/^\d+$/.test(raw)) {
    return Number(raw);
  }

  if (/^[A-Za-z]+$/.test(raw)) {
    return _svColumnLettersToNumber_(raw);
  }

  return 0;
}

function _svFindHeaderColumn_(sheet, headerName) {
  var lastColumn = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  var target = _svNormalizeHeader_(headerName);

  for (var i = 0; i < headers.length; i++) {
    if (_svNormalizeHeader_(headers[i]) === target) {
      return i + 1;
    }
  }

  return 0;
}

function _svColumnLettersToNumber_(letters) {
  var value = String(letters || '').toUpperCase().replace(/[^A-Z]/g, '');
  var result = 0;

  for (var i = 0; i < value.length; i++) {
    result = result * 26 + (value.charCodeAt(i) - 64);
  }

  return result;
}

function _svNormalizeHeader_(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[ʼ’']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function _svIsPlainObject_(value) {
  return value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === '[object Object]';
}

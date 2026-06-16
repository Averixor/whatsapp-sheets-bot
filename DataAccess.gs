/**
 * Canonical spreadsheet resolver: Script Property WASB_SPREADSHEET_ID → openById,
 * інакше привʼязана активна таблиця. Жорсткий ID у коді не зберігаємо —
 * для старих інсталяцій один раз задайте властивість WASB_SPREADSHEET_ID у
 * налаштуваннях проєкту Apps Script або працюйте з відкритою таблицею контейнера.
 */

function getWasbSpreadsheetId_() {
  var props = PropertiesService.getScriptProperties();
  return String(props.getProperty("WASB_SPREADSHEET_ID") || "").trim();
}

function getWasbOwnerEmail_() {
  var value =
    PropertiesService.getScriptProperties().getProperty("WASB_OWNER_EMAIL");
  return String(value || "")
    .trim()
    .toLowerCase();
}

function getWasbOwnerEmailDiagnostics_() {
  var raw = String(
    PropertiesService.getScriptProperties().getProperty("WASB_OWNER_EMAIL") ||
      "",
  ).trim();
  var email = raw.toLowerCase();
  var configured = !!email;
  var looksLikeEmail = !!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  return {
    ownerEmailConfigured: configured && looksLikeEmail,
    configured: configured,
    looksLikeEmail: looksLikeEmail,
    warning: configured
      ? looksLikeEmail
        ? ""
        : "WASB_OWNER_EMAIL заданий, але не схожий на email"
      : "WASB_OWNER_EMAIL не заданий у Script Properties (security-листи без повного user key)",
  };
}

function getWasbSpreadsheet_() {
  var id = getWasbSpreadsheetId_();
  if (id) {
    return SpreadsheetApp.openById(id);
  }

  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) {
    return active;
  }

  throw new Error(
    "WASB_SPREADSHEET_ID не задано в Script Properties і активна таблиця недоступна.",
  );
}

/**
 * DataAccess.gs — canonical data-access layer для stage 7.
 */

const DataAccess_ = (function () {
  function getSpreadsheet() {
    return getWasbSpreadsheet_();
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
    return last ? last - (schema.dataStartRow - 1) : 0;
  }

  function getMaxSchemaColumn(schema) {
    return Math.max.apply(
      null,
      Object.keys(schema.columns || {})
        .map(function (key) {
          return Number(schema.columns[key]) || 0;
        })
        .concat([1]),
    );
  }

  function readRows(schemaKey, options) {
    const opts = options || {};
    const schema = SheetSchemas_.get(schemaKey);
    const sheet = getSheet(
      schemaKey,
      opts.sheetName,
      opts.required !== false && schema.required !== false,
    );
    if (!sheet) return [];

    const count = getDataRowCount(sheet, schema);
    if (!count) return [];

    const width = Math.max(Number(opts.width) || 0, getMaxSchemaColumn(schema));
    const values = opts.displayValues
      ? sheet.getRange(schema.dataStartRow, 1, count, width).getDisplayValues()
      : sheet.getRange(schema.dataStartRow, 1, count, width).getValues();

    return values.map(function (row, idx) {
      return {
        rowNumber: schema.dataStartRow + idx,
        values: row,
      };
    });
  }

  function readObjects(schemaKey, options) {
    const opts = options || {};
    const schema = SheetSchemas_.get(schemaKey);
    const rows = readRows(
      schemaKey,
      Object.assign({}, opts, {
        width: Math.max(Number(opts.width) || 0, getMaxSchemaColumn(schema)),
      }),
    );

    return rows.map(function (item) {
      const obj = {};
      Object.keys(schema.columns || {}).forEach(function (field) {
        obj[field] = item.values[(schema.columns[field] || 1) - 1];
      });
      obj._meta = {
        schema: schema.key,
        rowNumber: item.rowNumber,
        sheetName: opts.sheetName || schema.name || "",
      };
      return obj;
    });
  }

  function readRangeValues(sheet, row, col, numRows, numCols, displayValues) {
    if (!sheet) throw new Error("Sheet is required");
    const range = sheet.getRange(row, col, numRows, numCols);
    return displayValues ? range.getDisplayValues() : range.getValues();
  }

  function updateRowFields(schemaKey, rowNumber, valuesByField, options) {
    const opts = options || {};
    const schema = SheetSchemas_.get(schemaKey);
    const sheet = getSheet(schemaKey, opts.sheetName, true);
    const fields = Object.keys(valuesByField || {});
    if (!fields.length) return true;

    fields.forEach(function (field) {
      if (!(field in schema.columns)) {
        throw new Error(`Поле "${field}" відсутнє у схемі ${schemaKey}`);
      }
    });

    const cols = fields.map(function (field) {
      return Number(schema.columns[field]);
    });
    const minCol = Math.min.apply(null, cols);
    const maxCol = Math.max.apply(null, cols);
    const width = maxCol - minCol + 1;
    const rowNum = Number(rowNumber);
    const range = sheet.getRange(rowNum, minCol, 1, width);
    const rowValues = range.getValues()[0];

    fields.forEach(function (field) {
      rowValues[Number(schema.columns[field]) - minCol] = valuesByField[field];
    });

    range.setValues([rowValues]);
    return true;
  }

  function appendObjects(schemaKey, items, options) {
    const opts = options || {};
    const list = Array.isArray(items) ? items : [];
    if (!list.length) return 0;

    const schema = SheetSchemas_.get(schemaKey);
    const sheet = ensureSheet(schemaKey, opts.sheetName);
    const width = getMaxSchemaColumn(schema);
    const rows = list.map(function (item) {
      const out = new Array(width).fill("");
      Object.keys(schema.columns || {}).forEach(function (field) {
        out[schema.columns[field] - 1] =
          item[field] === undefined ? "" : item[field];
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
    getMaxSchemaColumn: getMaxSchemaColumn,
  };
})();

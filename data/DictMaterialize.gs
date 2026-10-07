/**
 * DictMaterialize.gs — mirror DICT columns A:B from DICT_SUM.
 * Replaces ARRAYFORMULA(DICT_SUM!A1:A) and ARRAYFORMULA(DICT_SUM!B1:B).
 */

var DICT_MATERIALIZE_MANAGED_COLUMN_COUNT_ = 2;
var DICT_MATERIALIZE_START_ROW_ = 1;

function _dictMaterializeSheetName_() {
  try {
    if (typeof CONFIG !== "undefined" && CONFIG && CONFIG.DICT_SHEET) {
      return CONFIG.DICT_SHEET;
    }
  } catch (_) {}
  return "DICT";
}

function _dictSumMaterializeSheetName_() {
  try {
    if (typeof CONFIG !== "undefined" && CONFIG && CONFIG.DICT_SUM_SHEET) {
      return CONFIG.DICT_SUM_SHEET;
    }
  } catch (_) {}
  return "DICT_SUM";
}

function _dictMaterializeManagedEndRow_(dictSheet, sourceRowCount) {
  var startRow = DICT_MATERIALIZE_START_ROW_;
  var fromLast = Math.max(
    Number(dictSheet && dictSheet.getLastRow()) || startRow,
    startRow,
  );
  return Math.max(fromLast, startRow + Math.max(Number(sourceRowCount) || 0, 0) - 1);
}

function _dictMaterializeHasArrayFormula_(sheet, row, col) {
  try {
    var range = sheet.getRange(row, col);
    var formula =
      typeof range.getFormula === "function"
        ? range.getFormula()
        : "";
    return /^=ARRAYFORMULA/i.test(String(formula || "").trim());
  } catch (_) {}
  return false;
}

function _dictMaterializeClearFormulas_(sheet) {
  for (var col = 1; col <= DICT_MATERIALIZE_MANAGED_COLUMN_COUNT_; col++) {
    if (_dictMaterializeHasArrayFormula_(sheet, DICT_MATERIALIZE_START_ROW_, col)) {
      sheet.getRange(DICT_MATERIALIZE_START_ROW_, col).clearContent();
    }
  }
}

function _dictMaterializeInvalidateCache_() {
  try {
    if (typeof cacheKeyDict_ === "function") {
      CacheService.getScriptCache().remove(cacheKeyDict_());
    }
  } catch (_) {}
}

function readDictSumMirrorValues_(dictSumSheet) {
  if (!dictSumSheet) return [];

  var startRow = DICT_MATERIALIZE_START_ROW_;
  var lastRow = Math.max(Number(dictSumSheet.getLastRow()) || 0, startRow);
  if (lastRow < startRow) return [];

  var numRows = lastRow - startRow + 1;
  return dictSumSheet.getRange(startRow, 1, numRows, 2).getDisplayValues();
}

function materializeDictFromDictSum_(dictSheet, dictSumSheet, options) {
  dictSumSheet =
    dictSumSheet ||
    (typeof DataAccess_ === "object" &&
    DataAccess_ &&
    typeof DataAccess_.getSheet === "function"
      ? DataAccess_.getSheet("dictSum", null, false)
      : null);

  if (!dictSumSheet) {
    return { ok: false, reason: "dict_sum sheet missing", rowsWritten: 0 };
  }

  dictSheet =
    dictSheet ||
    (typeof DataAccess_ === "object" &&
    DataAccess_ &&
    typeof DataAccess_.getSheet === "function"
      ? DataAccess_.getSheet("dict", null, false)
      : null);

  if (!dictSheet) {
    return { ok: false, reason: "dict sheet missing", rowsWritten: 0 };
  }

  var sourceValues = readDictSumMirrorValues_(dictSumSheet);
  var rowCount = sourceValues.length;
  var startRow = DICT_MATERIALIZE_START_ROW_;
  var endRow = _dictMaterializeManagedEndRow_(dictSheet, rowCount);

  _dictMaterializeClearFormulas_(dictSheet);

  if (rowCount > 0) {
    dictSheet.getRange(startRow, 1, rowCount, 2).clearContent();
    dictSheet.getRange(startRow, 1, rowCount, 2).setValues(sourceValues);
  } else {
    dictSheet
      .getRange(startRow, 1, Math.max(endRow - startRow + 1, 1), 2)
      .clearContent();
  }

  if (rowCount < endRow) {
    var tailRows = endRow - rowCount;
    dictSheet.getRange(rowCount + 1, 1, tailRows, 2).clearContent();
  }

  if (!options || options.invalidateCache !== false) {
    _dictMaterializeInvalidateCache_();
  }

  return {
    ok: true,
    rowsWritten: rowCount,
    sheet: dictSheet.getName(),
    sourceSheet: dictSumSheet.getName(),
    endRow: endRow,
  };
}

function isDictMirrorManaged_() {
  return typeof materializeDictFromDictSum_ === "function";
}

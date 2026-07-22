/**
 * PersonnelMaterialize.gs — computed PERSONNEL helper columns and derived sheets.
 * Replaces manual ARRAYFORMULA on PERSONNEL (Age, Days_until_birthday).
 * Callsign on PERSONNEL is not materialized; derived sheets (PHONES, BIRTHDAY, active month) use Callsign → Last name via resolvePersonnelDisplayCallsign_.
 */

var PERSONNEL_MATERIALIZE_MANAGED_ROW_COUNT_ = 31;

function _personnelMaterializeRange_(sheet, startRow, endRow, startCol, endCol) {
  if (!sheet) return null;
  var rowStart = Number(startRow) || 1;
  var rowEnd = Number(endRow) || rowStart;
  var colStart = Number(startCol) || 1;
  var colEnd = Number(endCol) || colStart;
  if (rowEnd < rowStart || colEnd < colStart) return null;
  return sheet.getRange(
    sheet.getRange(rowStart, colStart).getA1Notation() +
      ":" +
      sheet.getRange(rowEnd, colEnd).getA1Notation(),
  );
}

function _personnelMaterializeCellHasArrayFormula_(sheet, row, col) {
  if (!sheet || !row || !col) return false;
  try {
    var formula =
      typeof sheet.getRange(row, col).getFormula === "function"
        ? sheet.getRange(row, col).getFormula()
        : "";
    return /^=ARRAYFORMULA/i.test(String(formula || "").trim());
  } catch (_) {}
  return false;
}

function _personnelMaterializeClearHelperColumnFormulas_(sheet, startRow, endRow, colIndex) {
  if (!sheet || colIndex === undefined || colIndex < 0) return;
  var col = colIndex + 1;
  [1, startRow].forEach(function (row) {
    if (row >= 1 && _personnelMaterializeCellHasArrayFormula_(sheet, row, col)) {
      sheet.getRange(row, col).clearContent();
    }
  });

  var numRows = Math.max(Number(endRow) - Number(startRow) + 1, 0);
  if (numRows <= 0) return;

  try {
    var formulaRange = _personnelMaterializeRange_(sheet, startRow, endRow, col, col);
    if (!formulaRange) return;
    var formulas = formulaRange.getFormulas();
    var formulaCount = 0;
    for (var i = 0; i < formulas.length; i++) {
      if (String((formulas[i] && formulas[i][0]) || "").trim()) {
        formulaCount++;
      }
    }
    if (formulaCount === formulas.length && formulaCount > 0) {
      formulaRange.clearContent();
      return;
    }
    for (var j = 0; j < formulas.length; j++) {
      var cellFormula = String((formulas[j] && formulas[j][0]) || "").trim();
      if (cellFormula) {
        sheet.getRange(startRow + j, col).clearContent();
      }
    }
  } catch (_) {}
}

function _personnelMaterializeClearHelperFormulas_(sheet, startRow, endRow, col) {
  if (!col) return;
  _personnelMaterializeClearHelperColumnFormulas_(sheet, startRow, endRow, col.Birthday);
  _personnelMaterializeClearHelperColumnFormulas_(sheet, startRow, endRow, col.Age);
  _personnelMaterializeClearHelperColumnFormulas_(
    sheet,
    startRow,
    endRow,
    col.Days_until_birthday,
  );
}

function stripTime_(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) return null;
  var d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  return d;
}

function diffDays_(later, earlier) {
  var end = stripTime_(later);
  var start = stripTime_(earlier);
  if (!end || !start) return "";
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

function calcAge_(birthday, today) {
  if (!birthday) return "";
  var bday = stripTime_(birthday);
  var now = stripTime_(today);
  if (!bday || !now) return "";
  if (bday.getTime() > now.getTime()) return 0;

  var age = now.getFullYear() - bday.getFullYear();
  var hasBirthdayPassed =
    now.getMonth() > bday.getMonth() ||
    (now.getMonth() === bday.getMonth() && now.getDate() >= bday.getDate());

  return hasBirthdayPassed ? age : age - 1;
}

function normalizeBirthdayText_(value) {
  var text = String(value || "").trim();
  text = text.replace(/\s*р\.?\s*н\.?\s*$/i, "").trim();
  while (/р\.$/.test(text)) {
    text = text.replace(/р\.$/, "").trim();
  }
  return text;
}

function normalizeAgeText_(value) {
  var text = String(value || "").trim();
  while (/р\.$/.test(text)) {
    text = text.replace(/р\.$/, "").trim();
  }
  return text;
}

function parseBirthdayValue_(value) {
  if (value === null || typeof value === "undefined" || value === "") {
    return null;
  }

  if (value instanceof Date && !isNaN(value.getTime())) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  var text = normalizeBirthdayText_(value);
  if (!text) return null;

  if (typeof DateUtils_ !== "undefined" && DateUtils_ && DateUtils_.parseUaDate) {
    var parsed = DateUtils_.parseUaDate(text);
    if (parsed instanceof Date && !isNaN(parsed.getTime())) {
      return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    }
  }

  var match = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!match) return null;

  var day = Number(match[1]);
  var month = Number(match[2]);
  var year = Number(match[3]);
  var date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function formatBirthdayCell_(value) {
  var date = parseBirthdayValue_(value);
  if (!date) return "";

  var day = String(date.getDate()).padStart(2, "0");
  var month = String(date.getMonth() + 1).padStart(2, "0");
  var year = date.getFullYear();

  return day + "." + month + "." + year + " р. н.";
}

function formatAgeCell_(value) {
  if (value === null || typeof value === "undefined" || value === "") {
    return "";
  }

  var clean = normalizeAgeText_(value);
  if (!clean) return "";

  return clean + " р.";
}

function formatBirthdayCountdownDisplay_(months, days) {
  months = Number(months) || 0;
  days = Number(days) || 0;

  if (months === 0 && days === 0) {
    return "Сьогодні";
  }
  if (months === 0) {
    return days + " д.";
  }
  if (days === 0) {
    return months + " м.";
  }
  return months + " м. " + days + " д.";
}

function calculateBirthdayCountdownUa_(birthdayValue, todayValue) {
  var birthDate = parseBirthdayValue_(birthdayValue);
  if (!birthDate) return "";

  var todayRaw = todayValue ? new Date(todayValue) : new Date();
  var today = stripTime_(todayRaw);
  if (!today) return "";

  var nextBirthday = stripTime_(
    new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate()),
  );
  if (!nextBirthday) return "";

  if (nextBirthday.getTime() < today.getTime()) {
    nextBirthday = stripTime_(
      new Date(
        today.getFullYear() + 1,
        birthDate.getMonth(),
        birthDate.getDate(),
      ),
    );
  }
  if (!nextBirthday) return "";

  var months = nextBirthday.getMonth() - today.getMonth();
  var days = nextBirthday.getDate() - today.getDate();

  if (days < 0) {
    var daysInPreviousMonth = new Date(
      nextBirthday.getFullYear(),
      nextBirthday.getMonth(),
      0,
    ).getDate();
    days += daysInPreviousMonth;
    months -= 1;
  }

  if (months < 0) {
    months += 12;
  }

  return formatBirthdayCountdownDisplay_(months, days);
}

function _personnelMaterializeResolveBirthdayInput_(rawValue, displayValue) {
  if (rawValue instanceof Date && !isNaN(rawValue.getTime())) {
    return rawValue;
  }
  var display = String(displayValue || "").trim();
  if (display) return display;
  if (rawValue === null || typeof rawValue === "undefined" || rawValue === "") {
    return "";
  }
  return rawValue;
}

function _personnelMaterializeEffectiveCallsign_(rawRow, col) {
  var callsignRaw =
    col.Callsign >= 0
      ? String(_personnelReadCell_(rawRow, col.Callsign) || "").trim()
      : "";
  var lastName =
    col.LastName !== undefined && col.LastName >= 0
      ? String(_personnelReadCell_(rawRow, col.LastName) || "").trim()
      : "";
  return resolvePersonnelDisplayCallsign_(callsignRaw, lastName);
}

function getPersonnelMaterializeStartRow_() {
  var schema =
    typeof SheetSchemas_ !== "undefined" &&
    SheetSchemas_ &&
    typeof SheetSchemas_.get === "function"
      ? SheetSchemas_.get("personnel")
      : null;
  var startRow = schema && schema.dataStartRow ? Number(schema.dataStartRow) : 2;
  return isFinite(startRow) && startRow > 0 ? startRow : 2;
}

function getPersonnelMaterializeEndRow_(sheet, startRow) {
  var start = Number(startRow) || 2;
  var fromLast = Math.max(Number(sheet && sheet.getLastRow()) || start, start);
  var fromMonthly =
    (typeof MONTHLY_CONFIG !== "undefined" &&
      Number(MONTHLY_CONFIG.LAST_DATA_ROW)) ||
    30;
  return Math.max(
    fromLast,
    start + PERSONNEL_MATERIALIZE_MANAGED_ROW_COUNT_ - 1,
    fromMonthly + 1,
  );
}

function _personnelMaterializeToday_() {
  if (typeof DateUtils_ !== "undefined" && DateUtils_.toDayStart) {
    var parsed = DateUtils_.toDayStart(new Date());
    if (parsed) return parsed;
  }
  return stripTime_(new Date());
}

function _personnelMaterializeParseBirthday_(rawValue, displayValue) {
  return parseBirthdayValue_(
    _personnelMaterializeResolveBirthdayInput_(rawValue, displayValue),
  );
}

function _personnelMaterializeSynthesizeFml_(row, col) {
  var fml =
    col.FML >= 0
      ? String(_personnelReadCell_(row, col.FML) || "").trim()
      : "";
  if (fml) return fml;

  var ln =
    col.LastName !== undefined && col.LastName >= 0
      ? String(_personnelReadCell_(row, col.LastName) || "").trim()
      : "";
  var fn =
    col.FirstName !== undefined && col.FirstName >= 0
      ? String(_personnelReadCell_(row, col.FirstName) || "").trim()
      : "";
  var pn =
    col.Patronymic !== undefined && col.Patronymic >= 0
      ? String(_personnelReadCell_(row, col.Patronymic) || "").trim()
      : "";
  if (!ln && !fn && !pn) return "";

  return [ln, fn, pn]
    .filter(function (part) {
      return !!part;
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function _personnelMaterializeBuildSourceRows_(sheet) {
  var startRow = getPersonnelMaterializeStartRow_();
  var endRow = getPersonnelMaterializeEndRow_(sheet, startRow);
  var rowCount = Math.max(endRow - startRow + 1, 0);
  if (!rowCount) return { rows: [], col: {}, startRow: startRow, endRow: endRow };

  var lastCol = Math.max(sheet.getLastColumn(), 1);
  if (typeof ensurePersonnelStatusColumnHeader_ === "function") {
    ensurePersonnelStatusColumnHeader_(sheet);
    lastCol = Math.max(sheet.getLastColumn(), 1);
  }
  var headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  var col = _personnelBuildHeaderColIndex_(headers);
  var dataRange = _personnelMaterializeRange_(sheet, startRow, endRow, 1, lastCol);
  if (!dataRange) {
    return { rows: [], col: col, startRow: startRow, endRow: endRow };
  }
  var values = dataRange.getValues();
  var displays = dataRange.getDisplayValues();
  var today = _personnelMaterializeToday_();
  var rows = [];

  for (var i = 0; i < rowCount; i++) {
    var rawRow = values[i] || [];
    var displayRow = displays[i] || [];
    var fml = _personnelMaterializeSynthesizeFml_(rawRow, col);
    var template =
      col.TEMPLATE >= 0
        ? String(_personnelReadCell_(rawRow, col.TEMPLATE) || "").trim()
        : "";
    var birthdayRaw = col.Birthday >= 0 ? rawRow[col.Birthday] : "";
    var birthdayDisplay =
      col.Birthday >= 0 ? displayRow[col.Birthday] : "";
    var birthdayInput = _personnelMaterializeResolveBirthdayInput_(
      birthdayRaw,
      birthdayDisplay,
    );
    var parsedBirthday = parseBirthdayValue_(birthdayInput);
    var callsign = _personnelMaterializeEffectiveCallsign_(rawRow, col);
    var ageNumeric = parsedBirthday ? calcAge_(parsedBirthday, today) : "";
    var birthdayFormatted = parsedBirthday
      ? formatBirthdayCell_(parsedBirthday)
      : "";
    var ageFormatted =
      ageNumeric === "" || ageNumeric === null || typeof ageNumeric === "undefined"
        ? ""
        : formatAgeCell_(ageNumeric);
    var daysFormatted = parsedBirthday
      ? calculateBirthdayCountdownUa_(parsedBirthday, today)
      : "";
    var phone =
      col.Phone >= 0
        ? String(_personnelReadCell_(rawRow, col.Phone) || "").trim()
        : "";
    var phone2 =
      col["2_Phone"] >= 0
        ? String(_personnelReadCell_(rawRow, col["2_Phone"]) || "").trim()
        : "";
    var lastName =
      col.LastName !== undefined && col.LastName >= 0
        ? String(_personnelReadCell_(rawRow, col.LastName) || "").trim()
        : "";
    var firstName =
      col.FirstName !== undefined && col.FirstName >= 0
        ? String(_personnelReadCell_(rawRow, col.FirstName) || "").trim()
        : "";
    var patronymic =
      col.Patronymic !== undefined && col.Patronymic >= 0
        ? String(_personnelReadCell_(rawRow, col.Patronymic) || "").trim()
        : "";
    var rank =
      col.Rank !== undefined && col.Rank >= 0
        ? String(_personnelReadCell_(rawRow, col.Rank) || "").trim()
        : "";
    var title =
      col.Title !== undefined && col.Title >= 0
        ? String(_personnelReadCell_(rawRow, col.Title) || "").trim()
        : "";

    rows.push({
      fml: fml,
      template: template,
      callsign: callsign,
      age: ageFormatted,
      daysUntilBirthday: daysFormatted,
      birthdayDisplay: birthdayFormatted,
      birthdayValue: parsedBirthday,
      phone: phone,
      phone2: phone2,
      lastName: lastName,
      firstName: firstName,
      patronymic: patronymic,
      rank: rank,
      title: title,
    });
  }

  return { rows: rows, col: col, startRow: startRow, endRow: endRow };
}

function _personnelMaterializeCellKey_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return "d:" + value.getTime();
  }
  if (typeof value === "boolean") {
    return value ? "1" : "0";
  }
  if (typeof value === "number" && isFinite(value)) {
    return "n:" + value;
  }
  return String(value == null ? "" : value).trim();
}

function _personnelMaterializeColumnEqual_(current, next) {
  var left = Array.isArray(current) ? current : [];
  var right = Array.isArray(next) ? next : [];
  if (left.length !== right.length) return false;
  for (var i = 0; i < left.length; i++) {
    var leftCell = left[i];
    var rightCell = right[i];
    var leftValue = Array.isArray(leftCell) ? leftCell[0] : leftCell;
    var rightValue = Array.isArray(rightCell) ? rightCell[0] : rightCell;
    if (
      _personnelMaterializeCellKey_(leftValue) !==
      _personnelMaterializeCellKey_(rightValue)
    ) {
      return false;
    }
  }
  return true;
}

function _personnelMaterializeWriteColumnIfChanged_(
  sheet,
  startRow,
  endRow,
  colIndex,
  values,
) {
  if (!sheet || colIndex === undefined || colIndex < 0) return 0;
  var safeValues = Array.isArray(values) ? values : [];
  var rowCount = safeValues.length;
  if (!rowCount) return 0;

  var col = colIndex + 1;
  var writeEndRow = Math.min(
    Number(endRow) || startRow + rowCount - 1,
    startRow + rowCount - 1,
  );
  var range = _personnelMaterializeRange_(sheet, startRow, writeEndRow, col, col);
  if (!range) return 0;

  var nextValues = safeValues.slice(0, writeEndRow - startRow + 1).map(function (value) {
    return [value];
  });
  var currentValues = range.getDisplayValues();
  if (_personnelMaterializeColumnEqual_(currentValues, nextValues)) {
    return 0;
  }

  range.setValues(nextValues);
  return writeEndRow - startRow + 1;
}

function _personnelMaterializeWriteMatrixIfChanged_(sheet, startRow, values) {
  var safeValues = Array.isArray(values) ? values : [];
  if (!safeValues.length) return 0;

  var width = (safeValues[0] || []).length;
  if (!width) return 0;

  var range = sheet.getRange(startRow, 1, safeValues.length, width);
  var currentValues = range.getDisplayValues();
  if (_personnelMaterializeRowsEqualDisplay_(currentValues, safeValues)) {
    return 0;
  }
  range.setValues(safeValues);
  return safeValues.length;
}

function _personnelMaterializeRowsEqualDisplay_(left, right) {
  var a = Array.isArray(left) ? left : [];
  var b = Array.isArray(right) ? right : [];
  if (a.length !== b.length) return false;
  for (var r = 0; r < a.length; r++) {
    var leftRow = a[r] || [];
    var rightRow = b[r] || [];
    if (leftRow.length !== rightRow.length) return false;
    for (var c = 0; c < leftRow.length; c++) {
      if (
        _personnelMaterializeCellKey_(leftRow[c]) !==
        _personnelMaterializeCellKey_(rightRow[c])
      ) {
        return false;
      }
    }
  }
  return true;
}

function _personnelMaterializeWriteColumn_(sheet, startRow, endRow, colIndex, values) {
  if (!sheet || colIndex === undefined || colIndex < 0) return 0;
  var safeValues = Array.isArray(values) ? values : [];
  var rowCount = safeValues.length;
  if (!rowCount) return 0;

  var col = colIndex + 1;
  var writeEndRow = Math.min(Number(endRow) || startRow + rowCount - 1, startRow + rowCount - 1);
  var range = _personnelMaterializeRange_(sheet, startRow, writeEndRow, col, col);
  if (!range) return 0;
  range.setValues(
    safeValues.slice(0, writeEndRow - startRow + 1).map(function (value) {
      return [value];
    }),
  );
  return writeEndRow - startRow + 1;
}

function _personnelMaterializeClearColumnTail_(sheet, startRow, endRow, colIndex, rowsWritten) {
  if (!sheet || colIndex === undefined || colIndex < 0) return;
  var tailStart = startRow + Number(rowsWritten || 0);
  if (tailStart > endRow) return;
  var tailRange = _personnelMaterializeRange_(sheet, tailStart, endRow, colIndex + 1, colIndex + 1);
  if (tailRange) tailRange.clearContent();
}

function materializePersonnelHelperColumns_(sheet, builtArg) {
  sheet = sheet || _personnelGetSheet_(false);
  if (!sheet) {
    return { ok: false, reason: "personnel sheet missing", rowsWritten: 0 };
  }

  var built = builtArg;
  if (!built) {
    try {
      built = _personnelMaterializeBuildSourceRows_(sheet);
    } catch (e) {
      return {
        ok: false,
        reason: e && e.message ? e.message : String(e),
        rowsWritten: 0,
      };
    }
  }

  var col = built.col;
  var startRow = built.startRow;
  var endRow = built.endRow;
  var sourceRows = built.rows;
  if (!sourceRows.length) {
    return { ok: true, rowsWritten: 0, sheet: sheet.getName() };
  }

  var missingColumns = [];
  if (col.Birthday < 0) missingColumns.push("Birthday");
  if (col.Age < 0) missingColumns.push("Age");
  if (col.Days_until_birthday < 0) {
    missingColumns.push("Days until birthday");
  }
  if (missingColumns.length) {
    return {
      ok: false,
      reason:
        "На аркуші особового складу не знайдено колонки: " +
        missingColumns.join(", "),
      rowsWritten: 0,
    };
  }

  var birthdayValues = sourceRows.map(function (row) {
    return row.birthdayDisplay;
  });
  var ageValues = sourceRows.map(function (row) {
    return row.age;
  });
  var daysValues = sourceRows.map(function (row) {
    return row.daysUntilBirthday;
  });
  var rowsWritten = 0;
  var birthdayColumnsFormattedRows = 0;

  _personnelMaterializeClearHelperFormulas_(sheet, startRow, endRow, col);

  rowsWritten = Math.max(
    rowsWritten,
    _personnelMaterializeWriteColumnIfChanged_(
      sheet,
      startRow,
      endRow,
      col.Birthday,
      birthdayValues,
    ),
  );
  _personnelMaterializeClearColumnTail_(
    sheet,
    startRow,
    endRow,
    col.Birthday,
    sourceRows.length,
  );
  if (col.Age >= 0) {
    rowsWritten = Math.max(
      rowsWritten,
      _personnelMaterializeWriteColumnIfChanged_(
        sheet,
        startRow,
        endRow,
        col.Age,
        ageValues,
      ),
    );
    _personnelMaterializeClearColumnTail_(
      sheet,
      startRow,
      endRow,
      col.Age,
      sourceRows.length,
    );
  }
  if (col.Days_until_birthday >= 0) {
    rowsWritten = Math.max(
      rowsWritten,
      _personnelMaterializeWriteColumnIfChanged_(
        sheet,
        startRow,
        endRow,
        col.Days_until_birthday,
        daysValues,
      ),
    );
    _personnelMaterializeClearColumnTail_(
      sheet,
      startRow,
      endRow,
      col.Days_until_birthday,
      sourceRows.length,
    );
  }
  birthdayColumnsFormattedRows = sourceRows.length;
  return {
    ok: true,
    rowsWritten: sourceRows.length,
    birthdayColumnsFormattedRows: birthdayColumnsFormattedRows,
    sheet: sheet.getName(),
    endRow: endRow,
  };
}

function _phonesMaterializeStartRow_() {
  var schema =
    typeof SheetSchemas_ !== "undefined" &&
    SheetSchemas_ &&
    typeof SheetSchemas_.get === "function"
      ? SheetSchemas_.get("phones")
      : null;
  var startRow = schema && schema.dataStartRow ? Number(schema.dataStartRow) : 2;
  return isFinite(startRow) && startRow > 0 ? startRow : 2;
}

function _phonesMaterializeHeaders_() {
  return ["Callsign", "Phone", "Phone 2"];
}

function _phonesMaterializeHeaderColIndex_(headersRow) {
  var headers = headersRow || [];
  var normalized = headers.map(function (header) {
    return _personnelCanonicalHeaderKey_(header);
  });
  var col = { Callsign: -1, Phone: -1, "2_Phone": -1 };

  for (var i = 0; i < normalized.length; i++) {
    var key = normalized[i];
    if (key === "Callsign" && col.Callsign < 0) col.Callsign = i;
    if (key === "Phone" && col.Phone < 0) col.Phone = i;
    if (key === "2_Phone" && col["2_Phone"] < 0) col["2_Phone"] = i;
  }

  return col;
}

function materializePhonesSheet_(sheet, sourceRows, options) {
  var ss = getWasbSpreadsheet_();
  var phonesName =
    typeof CONFIG !== "undefined" && CONFIG && CONFIG.PHONES_SHEET
      ? CONFIG.PHONES_SHEET
      : "PHONES";
  sheet = sheet || ss.getSheetByName(phonesName);
  if (!sheet) {
    return { ok: false, reason: "phones sheet missing", rowsWritten: 0 };
  }

  var startRow = _phonesMaterializeStartRow_();
  var endRow = getPersonnelMaterializeEndRow_(sheet, startRow);
  var managedRows = Math.max(endRow - startRow + 1, 0);
  var rows = (sourceRows || []).map(function (row) {
    return [row.callsign || "", row.phone || "", row.phone2 || ""];
  });

  while (rows.length < managedRows) {
    rows.push(["", "", ""]);
  }
  if (rows.length > managedRows) {
    rows = rows.slice(0, managedRows);
  }

  var forceHeaders = !!(options && options.forceHeaders);
  var expectedHeaders = _phonesMaterializeHeaders_();
  var headerColCount = Math.max(
    expectedHeaders.length,
    sheet.getLastColumn(),
    1,
  );
  var currentHeaders = sheet
    .getRange(1, 1, 1, headerColCount)
    .getDisplayValues()[0];
  var headerMismatch = false;
  for (var h = 0; h < expectedHeaders.length; h++) {
    if (
      String(currentHeaders[h] || "").trim() !== String(expectedHeaders[h]).trim()
    ) {
      headerMismatch = true;
      break;
    }
  }
  if (forceHeaders || headerMismatch || sheet.getLastRow() < 1) {
    sheet
      .getRange(1, 1, 1, expectedHeaders.length)
      .setValues([expectedHeaders]);
  }

  if (rows.length) {
    _personnelMaterializeWriteMatrixIfChanged_(sheet, startRow, rows);
  }

  return {
    ok: true,
    rowsWritten: rows.length,
    sheet: sheet.getName(),
    endRow: endRow,
  };
}

function getBirthdayHelperSheetName_() {
  if (typeof CONFIG !== "undefined" && CONFIG && CONFIG.BIRTHDAY_HELPER_SHEET) {
    return String(CONFIG.BIRTHDAY_HELPER_SHEET).trim();
  }
  return "Birthday";
}

function _birthdayHelperHeadersMatch_(headersRow) {
  var headers = headersRow || [];
  var normalized = headers.map(function (header) {
    return _personnelCanonicalHeaderKey_(header);
  });
  return (
    normalized.indexOf("Callsign") !== -1 &&
    normalized.indexOf("Birthday") !== -1 &&
    normalized.indexOf("Age") !== -1 &&
    normalized.indexOf("Days_until_birthday") !== -1
  );
}

function _birthdayHelperCanonicalHeaders_() {
  return ["Callsign", "Birthday", "Age", "Days_until_birthday"];
}

function findBirthdayHelperSheet_(ss) {
  ss = ss || getWasbSpreadsheet_();
  var preferred = getBirthdayHelperSheetName_();
  var direct = ss.getSheetByName(preferred);
  if (direct) return direct;

  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var candidate = sheets[i];
    if (!candidate || candidate.getLastRow() < 1) continue;
    var lastCol = Math.max(candidate.getLastColumn(), 1);
    var headers = candidate.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
    if (_birthdayHelperHeadersMatch_(headers)) return candidate;
  }

  return null;
}

function materializeBirthdayHelperSheet_(sheet, sourceRows, options) {
  var ss = getWasbSpreadsheet_();
  sheet = sheet || findBirthdayHelperSheet_(ss);
  if (!sheet) {
    return { ok: false, reason: "birthday helper sheet missing", rowsWritten: 0 };
  }

  var startRow = getPersonnelMaterializeStartRow_();
  var endRow = getPersonnelMaterializeEndRow_(sheet, startRow);
  var managedRows = Math.max(endRow - startRow + 1, 0);
  var expectedHeaders = _birthdayHelperCanonicalHeaders_();
  var rows = (sourceRows || []).map(function (row) {
    return [
      row.callsign || "",
      row.birthdayDisplay || "",
      row.age,
      row.daysUntilBirthday,
    ];
  });

  while (rows.length < managedRows) {
    rows.push(["", "", "", ""]);
  }
  if (rows.length > managedRows) {
    rows = rows.slice(0, managedRows);
  }

  var forceHeaders = !!(options && options.forceHeaders);
  var lastCol = Math.max(sheet.getLastColumn(), expectedHeaders.length, 1);
  var currentHeaders = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  if (forceHeaders || !_birthdayHelperHeadersMatch_(currentHeaders)) {
    var headerRow = expectedHeaders.slice();
    while (headerRow.length < lastCol) headerRow.push("");
    sheet.getRange(1, 1, 1, lastCol).setValues([headerRow]);
  }

  var col = _phonesMaterializeHeaderColIndex_(expectedHeaders);
  if (col.Callsign < 0) col = { Callsign: 0, Birthday: 1, Age: 2, Days_until_birthday: 3 };

  if (rows.length) {
    _personnelMaterializeWriteMatrixIfChanged_(sheet, startRow, rows);
  }

  return {
    ok: true,
    rowsWritten: rows.length,
    sheet: sheet.getName(),
    endRow: endRow,
  };
}


function _personnelAssignmentSyncNormFml_(value) {
  if (typeof _normFml_ === "function") return _normFml_(value);
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function _personnelAssignmentSyncNormPhone_(value) {
  if (typeof normalizePhone_ === "function") return normalizePhone_(value) || "";
  var digits = String(value || "").replace(/\D/g, "");
  return digits ? "+" + digits : "";
}

function _personnelAssignmentSyncSplitFml_(fml) {
  var parts = String(fml || "").trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  return {
    lastName: parts[0] || "",
    firstName: parts[1] || "",
    patronymic: parts.slice(2).join(" "),
  };
}

function _personnelRowsFromBuiltSource_(built) {
  return (built && built.rows ? built.rows : [])
    .filter(function (row) {
      return row && (row.fml || row.callsign);
    })
    .map(function (row) {
      return {
        fml: row.fml || "",
        callsign: row.callsign || "",
        phone: row.phone || "",
        phone2: row.phone2 || "",
        lastName: row.lastName || "",
        firstName: row.firstName || "",
        patronymic: row.patronymic || "",
        rank: row.rank || "",
        title: row.title || "",
      };
    });
}

function _personnelAssignmentSyncRows_(built) {
  if (built && Array.isArray(built.rows) && built.rows.length) {
    return _personnelRowsFromBuiltSource_(built);
  }
  if (typeof invalidatePersonnelCache_ === "function") {
    invalidatePersonnelCache_();
  }
  if (typeof getPersonnelRows_ !== "function") return [];
  return getPersonnelRows_() || [];
}

function _personnelAssignmentSyncNormCallsign_(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toUpperCase();
}

function _personnelAssignmentSyncFind_(rows, fml, phone, callsign) {
  var callsignKey = _personnelAssignmentSyncNormCallsign_(callsign);
  var fmlKey = _personnelAssignmentSyncNormFml_(fml);
  var phoneKey = _personnelAssignmentSyncNormPhone_(phone);
  var list = rows || [];

  if (callsignKey) {
    for (var c = 0; c < list.length; c += 1) {
      if (_personnelAssignmentSyncNormCallsign_(list[c] && list[c].callsign) === callsignKey) {
        return list[c];
      }
    }
  }

  if (fmlKey) {
    for (var i = 0; i < list.length; i += 1) {
      if (_personnelAssignmentSyncNormFml_(list[i] && list[i].fml) === fmlKey) {
        return list[i];
      }
    }
  }

  if (phoneKey) {
    for (var j = 0; j < list.length; j += 1) {
      var row = list[j] || {};
      if (
        _personnelAssignmentSyncNormPhone_(row.phone) === phoneKey ||
        _personnelAssignmentSyncNormPhone_(row.phone2) === phoneKey
      ) {
        return row;
      }
    }
  }

  return null;
}

function _personnelAssignmentEnsureColumn_(sheet, col, header, hide) {
  if (!sheet || !col) return;
  try {
    var maxColumns = typeof sheet.getMaxColumns === "function" ? sheet.getMaxColumns() : 0;
    if (maxColumns < col && typeof sheet.insertColumnsAfter === "function") {
      sheet.insertColumnsAfter(Math.max(maxColumns, 1), col - maxColumns);
    }
  } catch (_) {}
  try {
    var headerRange = sheet.getRange(1, col);
    var currentHeader = String(headerRange.getDisplayValue ? headerRange.getDisplayValue() : "").trim();
    if (!currentHeader && header) headerRange.setValue(header);
  } catch (_) {}
  if (hide && typeof sheet.hideColumns === "function") {
    try {
      sheet.hideColumns(col);
    } catch (_) {}
  }
}

function _personnelAssignmentSameRow_(a, b) {
  var left = a || [];
  var right = b || [];
  var len = Math.max(left.length, right.length);
  for (var i = 0; i < len; i += 1) {
    if (String(left[i] || "").trim() !== String(right[i] || "").trim()) {
      return false;
    }
  }
  return true;
}

function materializeCarOwnersFromPersonnel_(personnelRows) {
  var ss = getWasbSpreadsheet_();
  var sheetName =
    typeof CONFIG !== "undefined" && CONFIG && CONFIG.CAR_SHEET
      ? CONFIG.CAR_SHEET
      : "CAR";
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) {
    return { ok: true, sheet: sheetName, rowsMatched: 0, rowsChanged: 0, helperColumn: "H" };
  }

  _personnelAssignmentEnsureColumn_(sheet, 8, "Callsign", true);

  var rowCount = sheet.getLastRow() - 1;
  var range = sheet.getRange(2, 1, rowCount, 8);
  var values = range.getDisplayValues();
  var out = [];
  var rowsMatched = 0;
  var rowsChanged = 0;
  var helperFilled = 0;

  for (var i = 0; i < values.length; i += 1) {
    var row = values[i] || [];
    var owner = String(row[0] || "").trim();
    var helperCallsign = String(row[7] || "").trim();
    var matched = _personnelAssignmentSyncFind_(personnelRows, owner, "", helperCallsign);
    var next = row.slice(0, 8);

    if (matched) {
      rowsMatched += 1;
      next[0] = matched.fml || owner;
      next[7] = matched.callsign || helperCallsign;
      if (next[7]) helperFilled += 1;
    }

    if (!_personnelAssignmentSameRow_(row, next)) rowsChanged += 1;
    out.push(next);
  }

  if (rowsChanged > 0) {
    range.setValues(out);
  }

  return {
    ok: true,
    sheet: sheet.getName(),
    rowsMatched: rowsMatched,
    rowsChanged: rowsChanged,
    helperColumn: "H",
    helperFilled: helperFilled,
  };
}

function materializeWeaponOwnersFromPersonnel_(personnelRows) {
  var ss = getWasbSpreadsheet_();
  var sheetName =
    typeof CONFIG !== "undefined" && CONFIG && CONFIG.WEAPON_SHEET
      ? CONFIG.WEAPON_SHEET
      : "WEAPON";
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) {
    return { ok: true, sheet: sheetName, rowsMatched: 0, rowsChanged: 0, helperColumn: "AA" };
  }

  _personnelAssignmentEnsureColumn_(sheet, 27, "Callsign", true);

  var rowCount = sheet.getLastRow() - 1;
  var identityRange = sheet.getRange(2, 1, rowCount, 5);
  var identityValues = identityRange.getDisplayValues();
  var callsignRange = sheet.getRange(2, 27, rowCount, 1);
  var callsignValues = callsignRange.getDisplayValues();
  var identityOut = [];
  var callsignOut = [];
  var identityChanged = 0;
  var callsignChanged = 0;
  var rowsMatched = 0;
  var helperFilled = 0;

  for (var i = 0; i < identityValues.length; i += 1) {
    var row = identityValues[i] || [];
    var rawFml = [row[0], row[1], row[2]]
      .map(function (part) {
        return String(part || "").trim();
      })
      .filter(Boolean)
      .join(" ");
    var helperCallsign = String((callsignValues[i] && callsignValues[i][0]) || "").trim();
    var matched = _personnelAssignmentSyncFind_(personnelRows, rawFml, row[4], helperCallsign);
    var nextIdentity = [
      String(row[0] || "").trim(),
      String(row[1] || "").trim(),
      String(row[2] || "").trim(),
      String(row[3] || "").trim(),
      String(row[4] || "").trim(),
    ];
    var nextCallsign = helperCallsign;

    if (matched) {
      rowsMatched += 1;
      var parts = _personnelAssignmentSyncSplitFml_(matched.fml || rawFml);
      nextIdentity = [
        matched.lastName || parts.lastName,
        matched.firstName || parts.firstName,
        matched.patronymic || parts.patronymic,
        matched.rank || matched.title || "",
        matched.phone || "",
      ];
      nextCallsign = matched.callsign || helperCallsign;
      if (nextCallsign) helperFilled += 1;
    }

    if (!_personnelAssignmentSameRow_(row, nextIdentity)) identityChanged += 1;
    if (String(nextCallsign || "").trim() !== helperCallsign) callsignChanged += 1;
    identityOut.push(nextIdentity);
    callsignOut.push([nextCallsign]);
  }

  if (identityChanged > 0) {
    identityRange.setValues(identityOut);
  }
  if (callsignChanged > 0) {
    callsignRange.setValues(callsignOut);
  }

  return {
    ok: true,
    sheet: sheet.getName(),
    rowsMatched: rowsMatched,
    rowsChanged: identityChanged,
    helperColumn: "AA",
    helperChanged: callsignChanged,
    helperFilled: helperFilled,
  };
}

function materializeAssignmentIdentitySheetsFromPersonnel_(built) {
  var rows = _personnelAssignmentSyncRows_(built);
  var car = null;
  var weapon = null;
  try {
    car = materializeCarOwnersFromPersonnel_(rows);
  } catch (carErr) {
    car = {
      ok: false,
      error: carErr && carErr.message ? carErr.message : String(carErr),
    };
  }
  try {
    weapon = materializeWeaponOwnersFromPersonnel_(rows);
  } catch (weaponErr) {
    weapon = {
      ok: false,
      error: weaponErr && weaponErr.message ? weaponErr.message : String(weaponErr),
    };
  }
  return {
    ok: !!(car && car.ok !== false && weapon && weapon.ok !== false),
    car: car,
    weapon: weapon,
  };
}

function materializePersonnelDerivedSheets_(options) {
  var personnelSheet = _personnelGetSheet_(false);
  if (!personnelSheet) {
    return {
      ok: false,
      reason: "personnel sheet missing",
      personnel: null,
      phones: null,
      birthday: null,
    };
  }

  if (typeof ensurePersonnelStatusColumn_ === "function") {
    ensurePersonnelStatusColumn_(personnelSheet);
  }

  var built;
  try {
    built = _personnelMaterializeBuildSourceRows_(personnelSheet);
  } catch (e) {
    return {
      ok: false,
      reason: e && e.message ? e.message : String(e),
      personnel: null,
      phones: null,
      birthday: null,
    };
  }

  var personnelResult = materializePersonnelHelperColumns_(personnelSheet, built);
  var phonesResult = materializePhonesSheet_(null, built.rows, options || {});
  var birthdayResult = materializeBirthdayHelperSheet_(null, built.rows, options || {});

  var monthlySync = null;
  try {
    if (typeof syncMonthlyCallsignsForPersonnelUpdate_ === "function") {
      monthlySync = syncMonthlyCallsignsForPersonnelUpdate_(options || {});
    } else if (typeof syncActiveMonthlyCallsignsFromPersonnel_ === "function") {
      monthlySync = syncActiveMonthlyCallsignsFromPersonnel_();
    } else if (typeof syncMonthlyCallsignsFromPersonnel_ === "function") {
      monthlySync = syncMonthlyCallsignsFromPersonnel_();
    } else {
      monthlySync = {
        ok: false,
        error:
          "Синхронізація позивних на місячний графік недоступна — оновіть скрипт проєкту",
      };
    }
  } catch (syncErr) {
    monthlySync = {
      ok: false,
      error: syncErr && syncErr.message ? syncErr.message : String(syncErr),
    };
  }

  var equipmentAssignments = null;
  try {
    equipmentAssignments = materializeAssignmentIdentitySheetsFromPersonnel_(built);
  } catch (equipmentErr) {
    equipmentAssignments = {
      ok: false,
      error: equipmentErr && equipmentErr.message ? equipmentErr.message : String(equipmentErr),
    };
  }

  if (typeof invalidatePersonnelCache_ === "function") {
    invalidatePersonnelCache_();
  }

  return {
    ok: !!(personnelResult && personnelResult.ok),
    source: options && options.source ? String(options.source) : "",
    personnel: personnelResult,
    phones: phonesResult,
    birthday: birthdayResult,
    rowsWritten: built.rows.length,
    monthlyCallsigns: monthlySync,
    assignmentIdentity: equipmentAssignments,
  };
}

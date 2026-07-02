/**
 * PersonnelMaterialize.gs — computed PERSONNEL helper columns and derived sheets.
 * Replaces manual ARRAYFORMULA on PERSONNEL (Age, Days_until_birthday).
 * Callsign on PERSONNEL is not materialized; derived sheets (PHONES, BIRTHDAY, months 01–12) use Callsign → Last name via resolvePersonnelDisplayCallsign_.
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
    for (var i = 0; i < formulas.length; i++) {
      var formula = String((formulas[i] && formulas[i][0]) || "").trim();
      if (formula) {
        sheet.getRange(startRow + i, col).clearContent();
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

  return day + "." + month + "." + year + " р.н.";
}

function formatAgeCell_(value) {
  if (value === null || typeof value === "undefined" || value === "") {
    return "";
  }

  var clean = normalizeAgeText_(value);
  if (!clean) return "";

  return clean + "р.";
}

function formatBirthdayCountdownDisplay_(months, days) {
  months = Number(months) || 0;
  days = Number(days) || 0;

  if (months === 0 && days === 0) {
    return "Сьогодні";
  }
  if (months === 0) {
    return days + "д.";
  }
  if (days === 0) {
    return months + "м.";
  }
  return months + "м. " + days + "д.";
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
    });
  }

  return { rows: rows, col: col, startRow: startRow, endRow: endRow };
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
  range.clearContent();
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
    _personnelMaterializeWriteColumn_(
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
      _personnelMaterializeWriteColumn_(sheet, startRow, endRow, col.Age, ageValues),
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
      _personnelMaterializeWriteColumn_(
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

  sheet
    .getRange(startRow, 1, managedRows, expectedHeaders.length)
    .clearContent();
  if (rows.length) {
    sheet.getRange(startRow, 1, rows.length, expectedHeaders.length).setValues(rows);
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

  sheet
    .getRange(startRow, 1, managedRows, expectedHeaders.length)
    .clearContent();
  if (rows.length) {
    sheet.getRange(startRow, 1, rows.length, expectedHeaders.length).setValues(rows);
  }

  return {
    ok: true,
    rowsWritten: rows.length,
    sheet: sheet.getName(),
    endRow: endRow,
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

  if (typeof invalidatePersonnelCache_ === "function") {
    invalidatePersonnelCache_();
  }

  var monthlySync = null;
  try {
    if (typeof syncAllMonthlyCallsignsFromPersonnel_ === "function") {
      monthlySync = syncAllMonthlyCallsignsFromPersonnel_();
    } else if (typeof syncActiveMonthlyCallsignsFromPersonnel_ === "function") {
      monthlySync = syncActiveMonthlyCallsignsFromPersonnel_();
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

  return {
    ok: !!(personnelResult && personnelResult.ok),
    source: options && options.source ? String(options.source) : "",
    personnel: personnelResult,
    phones: phonesResult,
    birthday: birthdayResult,
    rowsWritten: built.rows.length,
    monthlyCallsigns: monthlySync,
  };
}

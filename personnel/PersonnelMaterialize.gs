/**
 * PersonnelMaterialize.gs — computed PERSONNEL helper columns and derived sheets.
 * Replaces manual ARRAYFORMULA on PERSONNEL (Age, Days_until_birthday, Callsign),
 * PHONES, and the Birthday helper sheet.
 */

var PERSONNEL_MATERIALIZE_MANAGED_ROW_COUNT_ = 31;

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

function calcDaysUntilBirthday_(birthday, today) {
  if (!birthday) return "";
  var bday = stripTime_(birthday);
  var now = stripTime_(today);
  if (!bday || !now) return "";

  var next = new Date(now.getFullYear(), bday.getMonth(), bday.getDate());
  if (next.getTime() < now.getTime()) {
    next = new Date(now.getFullYear() + 1, bday.getMonth(), bday.getDate());
  }

  return diffDays_(next, now);
}

function calcPersonnelCallsign_(templateValue, fml) {
  var direct = String(templateValue || "").trim();
  if (direct) return direct;

  var name = String(fml || "").trim();
  if (!name) return "";

  var match = name.match(/^(\S+)/);
  return match ? match[1] : name;
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
  if (typeof DateUtils_ !== "undefined" && DateUtils_.parseDateAny) {
    return DateUtils_.parseDateAny(rawValue, displayValue);
  }
  return null;
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

function _personnelMaterializeBirthdayDisplay_(rawValue, displayValue, parsed) {
  var display = String(displayValue || "").trim();
  if (display) return display;
  if (parsed instanceof Date && !isNaN(parsed.getTime())) {
    if (typeof DateUtils_ !== "undefined" && DateUtils_.formatUaDate) {
      try {
        return DateUtils_.formatUaDate(parsed);
      } catch (_) {}
    }
  }
  if (rawValue === null || typeof rawValue === "undefined" || rawValue === "") {
    return "";
  }
  return String(rawValue).trim();
}

function _personnelMaterializeBuildSourceRows_(sheet) {
  var startRow = getPersonnelMaterializeStartRow_();
  var endRow = getPersonnelMaterializeEndRow_(sheet, startRow);
  var rowCount = Math.max(endRow - startRow + 1, 0);
  if (!rowCount) return { rows: [], col: {}, startRow: startRow, endRow: endRow };

  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  var col = _personnelBuildHeaderColIndex_(headers);
  var values = sheet.getRange(startRow, 1, rowCount, lastCol).getValues();
  var displays = sheet.getRange(startRow, 1, rowCount, lastCol).getDisplayValues();
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
    var parsedBirthday = _personnelMaterializeParseBirthday_(
      birthdayRaw,
      birthdayDisplay,
    );
    var callsign = calcPersonnelCallsign_(template, fml);
    var age = calcAge_(parsedBirthday, today);
    var daysUntil = calcDaysUntilBirthday_(parsedBirthday, today);
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
      age: age,
      daysUntilBirthday: daysUntil,
      birthdayDisplay: _personnelMaterializeBirthdayDisplay_(
        birthdayRaw,
        birthdayDisplay,
        parsedBirthday,
      ),
      birthdayValue: parsedBirthday,
      phone: phone,
      phone2: phone2,
    });
  }

  return { rows: rows, col: col, startRow: startRow, endRow: endRow };
}

function _personnelMaterializeWriteColumn_(sheet, startRow, colIndex, values) {
  if (!sheet || colIndex === undefined || colIndex < 0) return 0;
  var safeValues = Array.isArray(values) ? values : [];
  var rowCount = safeValues.length;
  if (!rowCount) return 0;

  var col = colIndex + 1;
  var range = sheet.getRange(startRow, col, rowCount, 1);
  range.clearContent();
  range.setValues(
    safeValues.map(function (value) {
      return [value];
    }),
  );
  return rowCount;
}

function _personnelMaterializeClearColumnTail_(sheet, startRow, colIndex, rowsWritten, endRow) {
  if (!sheet || colIndex === undefined || colIndex < 0) return;
  var tailStart = startRow + Number(rowsWritten || 0);
  if (tailStart > endRow) return;
  sheet
    .getRange(tailStart, colIndex + 1, endRow - tailStart + 1, 1)
    .clearContent();
}

function materializePersonnelHelperColumns_(sheet) {
  sheet = sheet || _personnelGetSheet_(false);
  if (!sheet) {
    return { ok: false, reason: "personnel sheet missing", rowsWritten: 0 };
  }

  var built;
  try {
    built = _personnelMaterializeBuildSourceRows_(sheet);
  } catch (e) {
    return {
      ok: false,
      reason: e && e.message ? e.message : String(e),
      rowsWritten: 0,
    };
  }

  var col = built.col;
  var startRow = built.startRow;
  var endRow = built.endRow;
  var sourceRows = built.rows;
  if (!sourceRows.length) {
    return { ok: true, rowsWritten: 0, sheet: sheet.getName() };
  }

  var ageValues = sourceRows.map(function (row) {
    return row.age;
  });
  var daysValues = sourceRows.map(function (row) {
    return row.daysUntilBirthday;
  });
  var callsignValues = sourceRows.map(function (row) {
    return row.callsign;
  });

  var rowsWritten = 0;
  if (col.Age >= 0) {
    rowsWritten = Math.max(
      rowsWritten,
      _personnelMaterializeWriteColumn_(sheet, startRow, col.Age, ageValues),
    );
    _personnelMaterializeClearColumnTail_(
      sheet,
      startRow,
      col.Age,
      sourceRows.length,
      endRow,
    );
  }
  if (col.Days_until_birthday >= 0) {
    rowsWritten = Math.max(
      rowsWritten,
      _personnelMaterializeWriteColumn_(
        sheet,
        startRow,
        col.Days_until_birthday,
        daysValues,
      ),
    );
    _personnelMaterializeClearColumnTail_(
      sheet,
      startRow,
      col.Days_until_birthday,
      sourceRows.length,
      endRow,
    );
  }
  if (col.Callsign >= 0) {
    rowsWritten = Math.max(
      rowsWritten,
      _personnelMaterializeWriteColumn_(
        sheet,
        startRow,
        col.Callsign,
        callsignValues,
      ),
    );
    _personnelMaterializeClearColumnTail_(
      sheet,
      startRow,
      col.Callsign,
      sourceRows.length,
      endRow,
    );
  }

  return {
    ok: true,
    rowsWritten: sourceRows.length,
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

  var personnelResult = materializePersonnelHelperColumns_(personnelSheet);
  var phonesResult = materializePhonesSheet_(null, built.rows, options || {});
  var birthdayResult = materializeBirthdayHelperSheet_(null, built.rows, options || {});

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
  };
}

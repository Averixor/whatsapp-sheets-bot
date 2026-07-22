/**
 * MonthlyCallsignSync.gs — fill monthly «Позивні» column from PERSONNEL (callsign → last name fallback).
 */

function monthlyCallsignValueFromPersonnelRow_(callsignRaw, lastNameRaw) {
  return resolvePersonnelDisplayCallsign_(callsignRaw, lastNameRaw);
}

function _monthlyHeaderIsCallsignColumn_(normalizedHeader) {
  var norm = String(normalizedHeader || "").trim();
  if (!norm) return false;
  if (norm === "callsign") return true;
  if (norm.indexOf("позивн") !== -1) return true;
  if (norm.indexOf("\u043f\u043e\u0437\u044b\u0432\u043d") !== -1) return true;
  return false;
}

function findMonthlyCallsignColumn_(sheet) {
  if (!sheet || typeof sheet.getRange !== "function") {
    throw new Error("Місячний аркуш недоступний для синхронізації позивних");
  }

  var dateRow =
    Number(
      (typeof MONTHLY_CONFIG !== "undefined" &&
        MONTHLY_CONFIG &&
        MONTHLY_CONFIG.DATE_ROW) ||
        (typeof CONFIG !== "undefined" && CONFIG && CONFIG.DATE_ROW),
    ) || 1;
  var lastCol = Math.max(Number(sheet.getLastColumn()) || 0, 1);
  var headers = sheet.getRange(dateRow, 1, 1, lastCol).getDisplayValues()[0] || [];

  for (var i = 0; i < headers.length; i++) {
    if (_monthlyHeaderIsCallsignColumn_(_monthlyLayoutHeaderNorm_(headers[i]))) {
      return i + 1;
    }
  }

  try {
    var fallback = Number(getMonthlyCallsignColForSheet_(sheet)) || 0;
    if (fallback > 0) return fallback;
  } catch (_) {}

  throw new Error(
    'На місячному аркуші не знайдено колонку «Позивні» / «Позивний» / Callsign',
  );
}

function _personnelResolveSheetForMonthlySync_() {
  var ss = getWasbSpreadsheet_();
  var candidates = [];
  if (typeof CONFIG !== "undefined" && CONFIG && CONFIG.PERSONNEL_SHEET) {
    candidates.push(String(CONFIG.PERSONNEL_SHEET).trim());
  }
  candidates.push("PERSONNEL", "Персонал");

  var seen = {};
  for (var i = 0; i < candidates.length; i++) {
    var name = candidates[i];
    if (!name || seen[name]) continue;
    seen[name] = true;
    var sh = ss.getSheetByName(name);
    if (sh) return sh;
  }

  throw new Error("Не знайдено аркуш PERSONNEL / Персонал");
}

function _monthlyResolveTargetSheet_(targetSheetOrName) {
  var ss = getWasbSpreadsheet_();
  if (targetSheetOrName && typeof targetSheetOrName.getRange === "function") {
    return targetSheetOrName;
  }

  var name = String(
    targetSheetOrName ||
      (typeof getBotMonthSheetName_ === "function"
        ? getBotMonthSheetName_()
        : ""),
  ).trim();

  if (!/^\d{2}$/.test(name)) {
    throw new Error(
      'Цільовий місячний аркуш має назву виду "01"…"12", отримано: "' +
        name +
        '"',
    );
  }

  var sh = ss.getSheetByName(name);
  if (!sh) {
    throw new Error('Місячний аркуш "' + name + '" не знайдено');
  }
  return sh;
}

function _personnelBuildMonthlyCallsignValues_(personnelSheet) {
  var lastCol = Math.max(Number(personnelSheet.getLastColumn()) || 0, 1);
  var headers = personnelSheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  var colIndex = _personnelBuildHeaderColIndex_(headers);

  if (colIndex.Callsign === undefined || colIndex.Callsign < 0) {
    throw new Error(
      "Не знайдено колонку позивного (callsign) на аркуші особового складу",
    );
  }
  if (colIndex.LastName === undefined || colIndex.LastName < 0) {
    throw new Error(
      'Не знайдено колонку "Last name" / "Прізвище" на аркуші особового складу',
    );
  }

  var startRow =
    typeof getPersonnelMaterializeStartRow_ === "function"
      ? getPersonnelMaterializeStartRow_()
      : 2;
  var personnelLastRow = Math.max(Number(personnelSheet.getLastRow()) || 0, 1);
  if (personnelLastRow < startRow) {
    return { values: [], personnelRows: 0, startRow: startRow };
  }

  var personnelRows = personnelLastRow - startRow + 1;
  var callsignCol = colIndex.Callsign + 1;
  var lastNameCol = colIndex.LastName + 1;

  var callsignValues = personnelSheet
    .getRange(startRow, callsignCol, personnelRows, 1)
    .getDisplayValues();
  var lastNameValues = personnelSheet
    .getRange(startRow, lastNameCol, personnelRows, 1)
    .getDisplayValues();

  var values = [];
  for (var i = 0; i < personnelRows; i++) {
    values.push([
      monthlyCallsignValueFromPersonnelRow_(
        callsignValues[i][0],
        lastNameValues[i][0],
      ),
    ]);
  }

  return {
    values: values,
    personnelRows: personnelRows,
    startRow: startRow,
  };
}

function syncMonthlyCallsignsFromPersonnel_(targetSheetOrName) {
  var personnelSheet = _personnelResolveSheetForMonthlySync_();
  var monthSheet = _monthlyResolveTargetSheet_(targetSheetOrName);
  var built = _personnelBuildMonthlyCallsignValues_(personnelSheet);
  var values = built.values || [];

  var codeRef = monthSheet.getRange(getMonthlyCodeRangeA1ForSheet_(monthSheet));
  var startRow = codeRef.getRow();
  var maxRows = codeRef.getNumRows();
  var callsignCol = findMonthlyCallsignColumn_(monthSheet);
  var warnings = [];

  if (!values.length) {
    return {
      ok: true,
      sheet: monthSheet.getName(),
      personnelSheet: personnelSheet.getName(),
      rowsWritten: 0,
      callsignColumn: callsignCol,
      warnings: warnings,
    };
  }

  if (values.length > maxRows) {
    warnings.push(
      "Лист " +
        monthSheet.getName() +
        ": у PERSONNEL " +
        values.length +
        " рядок, слотів графіка " +
        maxRows +
        "; синхронізовано перші " +
        maxRows +
        ".",
    );
  }

  var output = values.slice(0, maxRows);
  while (output.length < maxRows) {
    output.push([""]);
  }

  var targetRange = monthSheet.getRange(startRow, callsignCol, output.length, 1);
  var currentValues = targetRange.getDisplayValues();
  var callsignChanged = false;
  for (var v = 0; v < output.length; v++) {
    if (
      String((currentValues[v] && currentValues[v][0]) || "").trim() !==
      String((output[v] && output[v][0]) || "").trim()
    ) {
      callsignChanged = true;
      break;
    }
  }
  if (callsignChanged) {
    targetRange.setValues(output);
  }

  return {
    ok: true,
    sheet: monthSheet.getName(),
    personnelSheet: personnelSheet.getName(),
    rowsWritten: callsignChanged ? Math.min(values.length, maxRows) : 0,
    skippedWrite: !callsignChanged,
    personnelRows: built.personnelRows,
    callsignColumn: callsignCol,
    startRow: startRow,
    warnings: warnings,
  };
}

function syncActiveMonthlyCallsignsFromPersonnel_() {
  return syncMonthlyCallsignsFromPersonnel_(
    typeof getBotMonthSheetName_ === "function" ? getBotMonthSheetName_() : "",
  );
}

function _monthlyCallsignSyncModeFromOptions_(options) {
  var opts = options || {};
  if (
    opts.includeHistory === true ||
    opts.monthlySyncMode === "all" ||
    opts.mode === "history"
  ) {
    return "all";
  }
  var monthSheet = String(opts.monthSheet || opts.month || "").trim();
  if (/^\d{2}$/.test(monthSheet)) {
    return "sheet";
  }
  return "current";
}

/**
 * Default personnel update: current bot month only.
 * History: monthlySyncMode=all | includeHistory=true | mode=history.
 * Single archive month: monthSheet="06".
 */
function syncMonthlyCallsignsForPersonnelUpdate_(options) {
  var mode = _monthlyCallsignSyncModeFromOptions_(options);
  if (mode === "all") {
    return syncAllMonthlyCallsignsFromPersonnel_();
  }
  if (mode === "sheet") {
    var month = String(
      (options && options.monthSheet) || (options && options.month) || "",
    ).trim();
    return syncMonthlyCallsignsFromPersonnel_(month);
  }
  return syncActiveMonthlyCallsignsFromPersonnel_();
}

function syncAllMonthlyCallsignsFromPersonnel_() {
  var ss = getWasbSpreadsheet_();
  var sheets = [];
  var rowsWritten = 0;
  var warnings = [];

  for (var month = 1; month <= 12; month++) {
    var name = (month < 10 ? "0" : "") + month;
    if (!ss.getSheetByName(name)) continue;
    try {
      var result = syncMonthlyCallsignsFromPersonnel_(name);
      sheets.push(result);
      rowsWritten += Number(result && result.rowsWritten) || 0;
      if (result && Array.isArray(result.warnings)) {
        warnings = warnings.concat(result.warnings);
      }
    } catch (syncErr) {
      sheets.push({
        ok: false,
        sheet: name,
        error: syncErr && syncErr.message ? syncErr.message : String(syncErr),
      });
    }
  }

  var failed = sheets.filter(function (item) {
    return item && item.ok === false;
  });

  return {
    ok: failed.length === 0,
    sheets: sheets,
    rowsWritten: rowsWritten,
    sheetCount: sheets.length,
    failedCount: failed.length,
    warnings: warnings,
  };
}

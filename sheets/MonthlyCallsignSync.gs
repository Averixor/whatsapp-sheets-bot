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

function _monthlyCopyPersonnelRowTemplate_(
  sheet,
  sourceRow,
  targetStartRow,
  rowCount,
) {
  if (!sheet || rowCount <= 0 || targetStartRow <= sourceRow) return;

  var lastCol = Math.max(Number(sheet.getLastColumn()) || 0, 1);
  var sourceRange = sheet.getRange(sourceRow, 1, 1, lastCol);
  var targetRange = sheet.getRange(targetStartRow, 1, rowCount, lastCol);

  sourceRange.copyTo(
    targetRange,
    SpreadsheetApp.CopyPasteType.PASTE_FORMAT,
    false,
  );
  sourceRange.copyTo(
    targetRange,
    SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION,
    false,
  );
  // Never paste conditional-formatting via CopyPasteType here: on real Google
  // Sheets workbooks that path corrupts/drops sheet-level rule lists (observed
  // loss of ~13 monthly CF rules). Extend existing rule ranges instead.
  if (typeof extendConditionalFormatRulesThroughRow_ === "function") {
    extendConditionalFormatRulesThroughRow_(
      sheet,
      sourceRow,
      targetStartRow + rowCount - 1,
    );
  }

  var rowHeight = Number(sheet.getRowHeight(sourceRow)) || 0;
  if (rowHeight > 0) {
    if (typeof sheet.setRowHeights === "function") {
      sheet.setRowHeights(targetStartRow, rowCount, rowHeight);
    } else {
      for (var row = targetStartRow; row < targetStartRow + rowCount; row++) {
        sheet.setRowHeight(row, rowHeight);
      }
    }
  }

  var formulaSource = sheet.getRange(sourceRow, 1);
  var formulaR1C1 =
    typeof formulaSource.getFormulaR1C1 === "function"
      ? String(formulaSource.getFormulaR1C1() || "")
      : "";
  if (formulaR1C1) {
    formulaSource.copyTo(
      sheet.getRange(targetStartRow, 1, rowCount, 1),
      SpreadsheetApp.CopyPasteType.PASTE_FORMULA,
      false,
    );
  }
}

function _monthlyEnsurePersonnelCapacity_(monthSheet, requiredRows) {
  var codeRangeA1 = getMonthlyCodeRangeA1ForSheet_(monthSheet);
  var codeRef = monthSheet.getRange(codeRangeA1);
  var startRow = codeRef.getRow();
  var currentDataEndRow = codeRef.getLastRow();
  var summaryBlock = findMonthlySummaryBlockLocation_(monthSheet);

  if (!summaryBlock || summaryBlock.startRow <= startRow) {
    throw new Error(
      'На місячному аркуші "' +
        monthSheet.getName() +
        '" не знайдено формульний блок зведення «За штатом» / «За списком»; ' +
        "синхронізацію зупинено без змін.",
    );
  }

  var separatorRows = _monthlySheetRowIsBlank_(
    monthSheet,
    summaryBlock.startRow - 1,
  )
    ? 1
    : 0;
  var capacityEndRow = summaryBlock.startRow - separatorRows - 1;
  currentDataEndRow = Math.min(currentDataEndRow, capacityEndRow);

  var requiredEndRow = startRow + Math.max(Number(requiredRows) || 0, 0) - 1;
  var rowsInserted = Math.max(requiredEndRow - capacityEndRow, 0);
  if (rowsInserted > 0) {
    monthSheet.insertRowsBefore(summaryBlock.startRow, rowsInserted);
    capacityEndRow += rowsInserted;
    summaryBlock = findMonthlySummaryBlockLocation_(monthSheet);
    if (!summaryBlock || summaryBlock.startRow <= requiredEndRow) {
      throw new Error(
        'Не вдалося безпечно змістити формульний блок зведення на аркуші "' +
          monthSheet.getName() +
          '".',
      );
    }
  }

  var formatStartRow = currentDataEndRow + 1;
  if (formatStartRow <= requiredEndRow) {
    _monthlyCopyPersonnelRowTemplate_(
      monthSheet,
      currentDataEndRow,
      formatStartRow,
      requiredEndRow - formatStartRow + 1,
    );
  }

  return {
    startRow: startRow,
    capacityEndRow: capacityEndRow,
    capacityRows: Math.max(capacityEndRow - startRow + 1, 0),
    rowsInserted: rowsInserted,
    separatorRows: separatorRows,
    summaryStartRow: summaryBlock.startRow,
    codeRangeA1: getMonthlyCodeRangeA1ForSheet_(monthSheet),
  };
}

function syncMonthlyCallsignsFromPersonnel_(targetSheetOrName) {
  var personnelSheet = _personnelResolveSheetForMonthlySync_();
  var monthSheet = _monthlyResolveTargetSheet_(targetSheetOrName);
  var built = _personnelBuildMonthlyCallsignValues_(personnelSheet);
  var values = built.values || [];

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

  var capacity = _monthlyEnsurePersonnelCapacity_(monthSheet, values.length);
  var startRow = capacity.startRow;
  var maxRows = capacity.capacityRows;
  var output = values.slice();
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
    rowsWritten: callsignChanged ? values.length : 0,
    skippedWrite: !callsignChanged,
    personnelRows: built.personnelRows,
    callsignColumn: callsignCol,
    startRow: startRow,
    capacityRows: maxRows,
    rowsInserted: capacity.rowsInserted,
    separatorRows: capacity.separatorRows,
    summaryStartRow: capacity.summaryStartRow,
    codeRangeA1: getMonthlyCodeRangeA1ForSheet_(monthSheet),
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

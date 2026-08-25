/**
 * MonthlyCallsignSync.gs — fill monthly «Позивні» column from PERSONNEL
 * (Callsign → Last name → First name).
 */

function monthlyCallsignValueFromPersonnelRow_(
  callsignRaw,
  lastNameRaw,
  firstNameRaw,
) {
  return resolvePersonnelDisplayCallsign_(
    callsignRaw,
    lastNameRaw,
    firstNameRaw,
  );
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

  // Inclusive: header + N people ⇒ lastRow = startRow + N - 1; numRows = N.
  // Never use lastRow as numRows when startRow > 1 (that skips the final person).
  var personnelRows = personnelLastRow - startRow + 1;
  var callsignCol = colIndex.Callsign + 1;
  var lastNameCol = colIndex.LastName + 1;
  var hasFirstName =
    colIndex.FirstName !== undefined && colIndex.FirstName >= 0;
  var firstNameCol = hasFirstName ? colIndex.FirstName + 1 : 0;

  var callsignValues = personnelSheet
    .getRange(startRow, callsignCol, personnelRows, 1)
    .getDisplayValues();
  var lastNameValues = personnelSheet
    .getRange(startRow, lastNameCol, personnelRows, 1)
    .getDisplayValues();
  var firstNameValues = hasFirstName
    ? personnelSheet
        .getRange(startRow, firstNameCol, personnelRows, 1)
        .getDisplayValues()
    : null;

  if (
    !callsignValues ||
    callsignValues.length < personnelRows ||
    !lastNameValues ||
    lastNameValues.length < personnelRows ||
    (hasFirstName &&
      (!firstNameValues || firstNameValues.length < personnelRows))
  ) {
    throw new Error(
      "Не вдалося прочитати всі рядки особового складу для синхронізації позивних (" +
        "очікувано " +
        personnelRows +
        ", прочитано " +
        Math.min(
          (callsignValues && callsignValues.length) || 0,
          (lastNameValues && lastNameValues.length) || 0,
          hasFirstName
            ? (firstNameValues && firstNameValues.length) || 0
            : personnelRows,
        ) +
        ")",
    );
  }

  var values = [];
  for (var i = 0; i < personnelRows; i++) {
    values.push([
      monthlyCallsignValueFromPersonnelRow_(
        callsignValues[i][0],
        lastNameValues[i][0],
        hasFirstName ? firstNameValues[i][0] : "",
      ),
    ]);
  }

  var activeRowsCount = 0;
  if (typeof getPersonnelActiveRows_ === "function") {
    try {
      activeRowsCount = (getPersonnelActiveRows_() || []).length;
    } catch (_) {
      activeRowsCount = 0;
    }
  }

  return {
    values: values,
    personnelRows: personnelRows,
    activeRowsCount: activeRowsCount,
    startRow: startRow,
    personnelLastRow: personnelLastRow,
  };
}

function _monthlyCodeBoundsFromSheet_(sheet) {
  if (!sheet || typeof getMonthlyCodeRangeA1ForSheet_ !== "function") {
    return null;
  }
  var codeRangeA1 = getMonthlyCodeRangeA1ForSheet_(sheet);
  var codeRef = sheet.getRange(codeRangeA1);
  return {
    a1: codeRangeA1,
    startRow: Number(codeRef.getRow()) || 2,
    endRow: Number(codeRef.getLastRow()) || 2,
    startCol: Number(codeRef.getColumn()) || 1,
    endCol: Number(codeRef.getLastColumn()) || 1,
  };
}

/**
 * Force schedule bounds to include capacityEndRow (after personnel expand).
 * Detection can lag when marker columns are incomplete on brand-new rows.
 */
function _monthlyBoundsWithEndRow_(bounds, endRow) {
  if (!bounds) return null;
  var nextEnd = Math.max(Number(endRow) || 0, Number(bounds.endRow) || 0);
  if (nextEnd <= (Number(bounds.endRow) || 0)) {
    return bounds;
  }
  var startCol = Number(bounds.startCol) || 1;
  var endCol = Number(bounds.endCol) || startCol;
  var startRow = Number(bounds.startRow) || 2;
  var a1 =
    typeof _monthlyCodeRangeA1_ === "function"
      ? _monthlyCodeRangeA1_(startCol, endCol, nextEnd)
      : bounds.a1;
  return {
    a1: a1,
    startRow: startRow,
    endRow: nextEnd,
    startCol: startCol,
    endCol: endCol,
  };
}

function _monthlyFormatA1Cell_(col, row, absCol, absRow) {
  var letter =
    typeof _columnNumberToLetter_ === "function"
      ? _columnNumberToLetter_(col)
      : String.fromCharCode(64 + Number(col));
  return (
    (absCol ? "$" : "") +
    letter +
    (absRow ? "$" : "") +
    String(Number(row) || 1)
  );
}

function _monthlyParseFlexibleA1Token_(token) {
  var match = String(token || "").match(
    /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)(?::(\$?)([A-Za-z]{1,3})(\$?)(\d+))?$/,
  );
  if (!match) return null;
  var startCol = _columnLetterToNumber_(match[2]);
  var startRow = Number(match[4]) || 0;
  var endCol = match[6] ? _columnLetterToNumber_(match[6]) : startCol;
  var endRow = match[8] ? Number(match[8]) || 0 : startRow;
  if (startCol < 1 || startRow < 1 || endCol < 1 || endRow < 1) return null;
  return {
    startCol: startCol,
    startRow: startRow,
    endCol: endCol,
    endRow: endRow,
    absStartCol: match[1] === "$",
    absStartRow: match[3] === "$",
    absEndCol: match[6] ? match[5] === "$" : match[1] === "$",
    absEndRow: match[8] ? match[7] === "$" : match[3] === "$",
    isRange: !!match[6],
  };
}

function _monthlyRemapScheduleA1RangeToken_(token, before, after) {
  if (!before || !after) return token;
  var parsed = _monthlyParseFlexibleA1Token_(token);
  if (!parsed) return token;

  var startCol = parsed.startCol;
  var startRow = parsed.startRow;
  var endCol = parsed.endCol;
  var endRow = parsed.endRow;
  var changed = false;

  // Same spirit as CF schedule remap: edges that matched the old grid follow the new grid.
  if (
    endRow === before.endRow &&
    startRow >= 1 &&
    startRow <= before.endRow &&
    (startRow === before.startRow ||
      (startCol >= before.startCol && startCol <= before.endCol))
  ) {
    endRow = after.endRow;
    if (!parsed.isRange) startRow = after.endRow;
    changed = true;
  }

  if (endCol === before.endCol) {
    if (startCol === before.startCol) {
      endCol = after.endCol;
      if (!parsed.isRange) startCol = after.endCol;
      changed = true;
    } else if (
      startRow === endRow &&
      startCol >= before.startCol &&
      startCol <= before.endCol
    ) {
      // Same-row day span, e.g. H2:AL2 / COUNTIF across the date grid.
      endCol = after.endCol;
      changed = true;
    }
  }

  if (!changed) return token;
  if (!parsed.isRange) {
    return _monthlyFormatA1Cell_(
      startCol,
      startRow,
      parsed.absStartCol,
      parsed.absStartRow,
    );
  }
  return (
    _monthlyFormatA1Cell_(
      startCol,
      startRow,
      parsed.absStartCol,
      parsed.absStartRow,
    ) +
    ":" +
    _monthlyFormatA1Cell_(endCol, endRow, parsed.absEndCol, parsed.absEndRow)
  );
}

function _monthlyRemapScheduleFormulaText_(formula, before, after) {
  var text = String(formula == null ? "" : formula);
  if (!text || !before || !after) return text;
  if (
    before.endRow === after.endRow &&
    before.endCol === after.endCol &&
    before.startRow === after.startRow &&
    before.startCol === after.startCol
  ) {
    return text;
  }

  return text.replace(
    /(^|[^A-Za-z0-9_])((?:\$?[A-Za-z]{1,3}\$?\d+)(?::\$?[A-Za-z]{1,3}\$?\d+)?)/g,
    function (full, prefix, token) {
      if (prefix === "!") return full;
      return prefix + _monthlyRemapScheduleA1RangeToken_(token, before, after);
    },
  );
}

/**
 * Rewrite on-sheet formulas whose A1 ranges ended at the previous schedule
 * bounds so they match the current code grid (row + day-column edges).
 * Skips sheet-qualified refs (PERSONNEL!, DICT_SUM!).
 */
function rewriteMonthlyScheduleFormulasToCodeRange_(
  sheet,
  beforeBounds,
  afterBoundsOverride,
) {
  if (!sheet || typeof sheet.getRange !== "function") {
    return { ok: false, rewritten: 0 };
  }
  var before = beforeBounds || null;
  var after =
    afterBoundsOverride ||
    _monthlyCodeBoundsFromSheet_(sheet);
  if (!before || !after) {
    return {
      ok: false,
      rewritten: 0,
      before: before,
      after: after,
    };
  }
  if (
    before.endRow === after.endRow &&
    before.endCol === after.endCol &&
    before.startRow === after.startRow &&
    before.startCol === after.startCol
  ) {
    return { ok: true, rewritten: 0, before: before, after: after };
  }

  var summaryBlock =
    typeof findMonthlySummaryBlockLocation_ === "function"
      ? findMonthlySummaryBlockLocation_(sheet)
      : null;
  var lastRow = Math.max(
    Number(after.endRow) || 1,
    summaryBlock && summaryBlock.endRow ? Number(summaryBlock.endRow) : 0,
    Number(sheet.getLastRow()) || 1,
  );
  var lastCol = Math.max(
    Number(after.endCol) || 1,
    Number(sheet.getLastColumn()) || 1,
  );
  var range = sheet.getRange(1, 1, lastRow, lastCol);
  if (typeof range.getFormulas !== "function") {
    return { ok: false, rewritten: 0, before: before, after: after };
  }

  var formulas = range.getFormulas();
  var rewritten = 0;
  var formulaUpdates = [];
  for (var r = 0; r < formulas.length; r++) {
    var row = formulas[r] || [];
    for (var c = 0; c < row.length; c++) {
      var current = String(row[c] || "");
      if (!current) continue;
      var next = _monthlyRemapScheduleFormulaText_(current, before, after);
      if (next !== current) {
        formulaUpdates.push({
          row: r + 1,
          col: c + 1,
          formula: next,
        });
        rewritten++;
      }
    }
  }
  // Never range.setFormulas() on the mixed grid: empty formula slots wipe
  // values (callsigns, dates) — new months looked blank after create.
  for (var u = 0; u < formulaUpdates.length; u++) {
    sheet
      .getRange(formulaUpdates[u].row, formulaUpdates[u].col)
      .setFormula(formulaUpdates[u].formula);
  }
  return {
    ok: true,
    rewritten: rewritten,
    before: before,
    after: after,
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

function _monthlyEnsurePersonnelCapacity_(monthSheet, requiredRows, options) {
  var opts = options || {};
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

  var rowsDeleted = 0;
  if (
    opts.allowShrink === true &&
    requiredEndRow >= startRow &&
    requiredEndRow < capacityEndRow &&
    typeof monthSheet.deleteRows === "function"
  ) {
    var deleteCount = capacityEndRow - requiredEndRow;
    monthSheet.deleteRows(requiredEndRow + 1, deleteCount);
    rowsDeleted = deleteCount;
    capacityEndRow = requiredEndRow;
    summaryBlock = findMonthlySummaryBlockLocation_(monthSheet);
    if (!summaryBlock || summaryBlock.startRow <= capacityEndRow) {
      throw new Error(
        'Не вдалося безпечно стиснути зону графіка на аркуші "' +
          monthSheet.getName() +
          '".',
      );
    }
    currentDataEndRow = Math.min(currentDataEndRow, capacityEndRow);
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
    rowsDeleted: rowsDeleted,
    separatorRows: separatorRows,
    summaryStartRow: summaryBlock.startRow,
    codeRangeA1: getMonthlyCodeRangeA1ForSheet_(monthSheet),
  };
}

function syncMonthlyCallsignsFromPersonnel_(targetSheetOrName, options) {
  var opts = options || {};
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

  var beforeBounds = _monthlyCodeBoundsFromSheet_(monthSheet);
  var capacity = _monthlyEnsurePersonnelCapacity_(
    monthSheet,
    values.length,
    opts,
  );
  var startRow = capacity.startRow;
  var maxRows = capacity.capacityRows;
  var capacityEndRow = capacity.capacityEndRow;
  var output = values.slice();
  while (output.length < maxRows) {
    output.push([""]);
  }

  // numRows must equal capacityRows so the final PERSONNEL person is included.
  var targetRange = monthSheet.getRange(
    startRow,
    callsignCol,
    maxRows,
    1,
  );
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

  var detectedBounds = _monthlyCodeBoundsFromSheet_(monthSheet);
  var scheduleBounds = _monthlyBoundsWithEndRow_(
    detectedBounds,
    capacityEndRow,
  );

  var formulaSync = null;
  if (
    opts.skipFormulaRewrite !== true &&
    beforeBounds &&
    (Number(capacity.rowsInserted) > 0 || Number(capacity.rowsDeleted) > 0)
  ) {
    formulaSync = rewriteMonthlyScheduleFormulasToCodeRange_(
      monthSheet,
      beforeBounds,
      scheduleBounds,
    );
  }

  var activeRowsCount = Number(built.activeRowsCount) || 0;
  if (
    activeRowsCount > 0 &&
    values.length < activeRowsCount
  ) {
    warnings.push(
      "Лист " +
        monthSheet.getName() +
        ": активних у PERSONNEL " +
        activeRowsCount +
        ", а для графіка прочитано лише " +
        values.length +
        " рядків — можливий збій getLastRow/діапазону.",
    );
  }

  return {
    ok: true,
    sheet: monthSheet.getName(),
    personnelSheet: personnelSheet.getName(),
    rowsWritten: callsignChanged ? values.length : 0,
    skippedWrite: !callsignChanged,
    personnelRows: built.personnelRows,
    activeRowsCount: activeRowsCount,
    callsignColumn: callsignCol,
    startRow: startRow,
    capacityRows: maxRows,
    capacityEndRow: capacityEndRow,
    rowsInserted: capacity.rowsInserted,
    rowsDeleted: capacity.rowsDeleted,
    separatorRows: capacity.separatorRows,
    summaryStartRow: capacity.summaryStartRow,
    codeRangeA1:
      (scheduleBounds && scheduleBounds.a1) ||
      getMonthlyCodeRangeA1ForSheet_(monthSheet),
    scheduleBounds: scheduleBounds,
    formulaSync: formulaSync,
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

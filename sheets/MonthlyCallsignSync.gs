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

function _monthlyNormCallsignKey_(value) {
  if (typeof _normCallsignKey_ === "function") {
    return _normCallsignKey_(value) || "";
  }
  return String(value || "")
    .trim()
    .toUpperCase();
}

/**
 * Shift relative A1 row references by (toRow - fromRow). Absolute rows ($5) stay.
 */
function _monthlyAdjustFormulaRowDelta_(formula, fromRow, toRow) {
  var text = String(formula == null ? "" : formula);
  var from = Number(fromRow) || 0;
  var to = Number(toRow) || 0;
  var delta = to - from;
  if (!text || !delta) return text;

  return text.replace(
    /(^|[^A-Za-z0-9_])((?:\$?[A-Za-z]{1,3}\$?\d+)(?::\$?[A-Za-z]{1,3}\$?\d+)?)/g,
    function (full, prefix, token) {
      if (prefix === "!") return full;
      var parsed = _monthlyParseFlexibleA1Token_(token);
      if (!parsed) return full;
      var startRow = parsed.startRow;
      var endRow = parsed.endRow;
      var changed = false;
      if (!parsed.absStartRow) {
        startRow = startRow + delta;
        changed = true;
      }
      if (!parsed.absEndRow) {
        endRow = endRow + delta;
        changed = true;
      }
      if (!changed || startRow < 1 || endRow < 1) return full;
      if (!parsed.isRange) {
        return (
          prefix +
          _monthlyFormatA1Cell_(
            parsed.startCol,
            startRow,
            parsed.absStartCol,
            parsed.absStartRow,
          )
        );
      }
      return (
        prefix +
        _monthlyFormatA1Cell_(
          parsed.startCol,
          startRow,
          parsed.absStartCol,
          parsed.absStartRow,
        ) +
        ":" +
        _monthlyFormatA1Cell_(
          parsed.endCol,
          endRow,
          parsed.absEndCol,
          parsed.absEndRow,
        )
      );
    },
  );
}

function _monthlyPersonBoundEndCol_(sheet, callsignCol) {
  var startCol = Math.max(Number(callsignCol) || 1, 1);
  var notesCol = 0;
  try {
    if (typeof findMonthlyNotesCol_ === "function") {
      notesCol = Number(findMonthlyNotesCol_(sheet)) || 0;
    }
  } catch (_) {}
  var bounds = _monthlyCodeBoundsFromSheet_(sheet);
  var codeEnd = bounds && bounds.endCol ? Number(bounds.endCol) : 0;
  return Math.max(startCol, notesCol, codeEnd);
}

/**
 * Write value-only and formula-only contiguous runs separately so formulas are
 * never replaced by evaluated values (and values are never wiped by setFormulas).
 */
function _monthlyWriteSeparatedValuesAndFormulas_(
  sheet,
  startRow,
  startCol,
  values,
  formulas,
) {
  if (!sheet || !values || !values.length) {
    return { ok: true, valueRuns: 0, formulaRuns: 0 };
  }
  var valueRuns = 0;
  var formulaRuns = 0;
  var numCols = values[0].length;

  for (var r = 0; r < values.length; r++) {
    var sheetRow = startRow + r;
    var valueRow = values[r] || [];
    var formulaRow = (formulas && formulas[r]) || [];
    var c = 0;
    while (c < numCols) {
      var hasFormula = !!String(formulaRow[c] || "").trim();
      var runStart = c;
      if (hasFormula) {
        while (c < numCols && String(formulaRow[c] || "").trim()) c++;
        var formulaWidth = c - runStart;
        var formulaMatrix = [formulaRow.slice(runStart, c)];
        sheet
          .getRange(sheetRow, startCol + runStart, 1, formulaWidth)
          .setFormulas(formulaMatrix);
        formulaRuns++;
      } else {
        while (c < numCols && !String(formulaRow[c] || "").trim()) c++;
        var valueWidth = c - runStart;
        var valueMatrix = [valueRow.slice(runStart, c)];
        sheet
          .getRange(sheetRow, startCol + runStart, 1, valueWidth)
          .setValues(valueMatrix);
        valueRuns++;
      }
    }
  }

  return { ok: true, valueRuns: valueRuns, formulaRuns: formulaRuns };
}

function _monthlyBlankPersonBoundRow_(numCols, callsignOffset, callsign) {
  var values = [];
  var formulas = [];
  for (var i = 0; i < numCols; i++) {
    values.push(i === callsignOffset ? String(callsign || "") : "");
    formulas.push("");
  }
  return { values: values, formulas: formulas };
}

/**
 * Remap person-bound month rows (callsign…notes/schedule) to follow target
 * callsign order. Carries schedule/notes across renames (1↔1 orphan) and
 * adjusts relative formula row refs. Rejects remap when active callsigns duplicate.
 */
function _monthlyRemapPersonRowsByCallsign_(monthSheet, targetCallsigns, options) {
  var opts = options || {};
  var warnings = [];
  var targets = targetCallsigns || [];
  if (!monthSheet || !targets.length) {
    return { ok: true, remapped: false, moved: 0, warnings: warnings };
  }

  if (typeof getPersonnelReadOnlyStatus_ === "function") {
    try {
      var status = getPersonnelReadOnlyStatus_() || {};
      if (Number(status.duplicateActiveCallsigns || 0) > 0) {
        warnings.push(
          "Перенесення графіка зупинено: у активному особовому складі є дублікати позивних.",
        );
        return {
          ok: false,
          remapped: false,
          reason: "duplicate_active_callsigns",
          duplicateActiveCallsigns: Number(status.duplicateActiveCallsigns) || 0,
          warnings: warnings,
        };
      }
    } catch (_) {}
  }

  var startRow = Math.max(Number(opts.startRow) || 2, 1);
  var numRows = Math.max(Number(opts.numRows) || targets.length, 0);
  var callsignCol = Math.max(Number(opts.callsignCol) || 1, 1);
  var endCol =
    Math.max(Number(opts.endCol) || 0, callsignCol) ||
    _monthlyPersonBoundEndCol_(monthSheet, callsignCol);
  var numCols = endCol - callsignCol + 1;
  if (numRows <= 0 || numCols <= 0) {
    return { ok: true, remapped: false, moved: 0, warnings: warnings };
  }

  var block = monthSheet.getRange(startRow, callsignCol, numRows, numCols);
  var values = block.getValues();
  var formulas =
    typeof block.getFormulas === "function" ? block.getFormulas() : [];
  var callsignOffset = 0;

  var queues = Object.create(null);
  var sourceEntries = [];
  for (var i = 0; i < values.length; i++) {
    var rowValues = (values[i] || []).slice(0, numCols);
    while (rowValues.length < numCols) rowValues.push("");
    var rowFormulas = ((formulas && formulas[i]) || []).slice(0, numCols);
    while (rowFormulas.length < numCols) rowFormulas.push("");
    var rawCallsign = String(rowValues[callsignOffset] || "").trim();
    var key = _monthlyNormCallsignKey_(rawCallsign);
    var entry = {
      values: rowValues,
      formulas: rowFormulas,
      fromRow: startRow + i,
      key: key,
    };
    sourceEntries.push(entry);
    if (!key) continue;
    if (!Object.prototype.hasOwnProperty.call(queues, key)) {
      queues[key] = [];
    }
    queues[key].push(entry);
  }

  var targetKeySet = Object.create(null);
  for (var t = 0; t < targets.length; t++) {
    var tKey = _monthlyNormCallsignKey_(targets[t]);
    if (tKey) targetKeySet[tKey] = true;
  }

  var assigned = [];
  var needsOrphanIndexes = [];
  var exactMatches = 0;
  for (var s = 0; s < numRows; s++) {
    var target = s < targets.length ? String(targets[s] || "").trim() : "";
    var targetKey = _monthlyNormCallsignKey_(target);
    if (
      targetKey &&
      Object.prototype.hasOwnProperty.call(queues, targetKey) &&
      queues[targetKey].length
    ) {
      assigned[s] = {
        target: target,
        entry: queues[targetKey].shift(),
      };
      exactMatches++;
    } else if (targetKey) {
      needsOrphanIndexes.push(s);
      assigned[s] = { target: target, entry: null };
    } else {
      assigned[s] = { target: "", entry: null };
    }
  }

  // Orphans: queued rows whose callsign is no longer in the PERSONNEL target set.
  var orphans = [];
  for (var orphanKey in queues) {
    if (!Object.prototype.hasOwnProperty.call(queues, orphanKey)) continue;
    if (Object.prototype.hasOwnProperty.call(targetKeySet, orphanKey)) continue;
    var bucket = queues[orphanKey] || [];
    for (var b = 0; b < bucket.length; b++) orphans.push(bucket[b]);
  }

  var renamePaired = false;
  if (needsOrphanIndexes.length === 1 && orphans.length === 1) {
    assigned[needsOrphanIndexes[0]].entry = orphans[0];
    orphans = [];
    needsOrphanIndexes = [];
    renamePaired = true;
  }

  // Full label replacement with no shared identity: keep schedules in place and
  // let the caller rewrite the callsign column only (positional sync).
  if (exactMatches === 0 && !renamePaired) {
    return {
      ok: true,
      remapped: false,
      reason: "no_safe_identity_overlap",
      moved: 0,
      warnings: warnings,
    };
  }

  if (needsOrphanIndexes.length > 0) {
    if (orphans.length > 0 || needsOrphanIndexes.length > 1) {
      warnings.push(
        "Неоднозначне перейменування позивних на аркуші " +
          monthSheet.getName() +
          ": нових без рядка " +
          needsOrphanIndexes.length +
          ", старих рядків без пари " +
          orphans.length +
          ". Графік для неоднозначних слотів очищено.",
      );
      try {
        console.warn(warnings[warnings.length - 1]);
      } catch (_) {}
    }
  }

  var nextValues = [];
  var nextFormulas = [];
  var moved = 0;
  for (var n = 0; n < numRows; n++) {
    var slot = assigned[n] || { target: "", entry: null };
    var destRow = startRow + n;
    if (slot.entry) {
      var movedValues = slot.entry.values.slice();
      var movedFormulas = [];
      for (var fc = 0; fc < numCols; fc++) {
        var srcFormula = String(slot.entry.formulas[fc] || "");
        movedFormulas.push(
          srcFormula
            ? _monthlyAdjustFormulaRowDelta_(
                srcFormula,
                slot.entry.fromRow,
                destRow,
              )
            : "",
        );
      }
      movedValues[callsignOffset] = slot.target;
      // Callsign cell is always a value, never a carried formula.
      movedFormulas[callsignOffset] = "";
      nextValues.push(movedValues);
      nextFormulas.push(movedFormulas);
      if (slot.entry.fromRow !== destRow) moved++;
    } else {
      var blank = _monthlyBlankPersonBoundRow_(
        numCols,
        callsignOffset,
        slot.target,
      );
      nextValues.push(blank.values);
      nextFormulas.push(blank.formulas);
    }
  }

  var write = _monthlyWriteSeparatedValuesAndFormulas_(
    monthSheet,
    startRow,
    callsignCol,
    nextValues,
    nextFormulas,
  );

  return {
    ok: !!write.ok,
    remapped: true,
    moved: moved,
    valueRuns: write.valueRuns,
    formulaRuns: write.formulaRuns,
    warnings: warnings,
  };
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

  // Fail closed before capacity mutations when remap would be unsafe.
  if (
    opts.skipPersonRemap !== true &&
    typeof getPersonnelReadOnlyStatus_ === "function"
  ) {
    try {
      var dupStatus = getPersonnelReadOnlyStatus_() || {};
      if (Number(dupStatus.duplicateActiveCallsigns || 0) > 0) {
        warnings.push(
          "Синхронізацію позивних зупинено: у активному особовому складі є дублікати позивних.",
        );
        return {
          ok: false,
          sheet: monthSheet.getName(),
          personnelSheet: personnelSheet.getName(),
          rowsWritten: 0,
          skippedWrite: true,
          reason: "duplicate_active_callsigns",
          duplicateActiveCallsigns:
            Number(dupStatus.duplicateActiveCallsigns) || 0,
          callsignColumn: callsignCol,
          warnings: warnings,
        };
      }
    } catch (_) {}
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

  var personRemap = null;
  if (callsignChanged && opts.skipPersonRemap !== true) {
    var targetCallsigns = [];
    for (var tc = 0; tc < output.length; tc++) {
      targetCallsigns.push(String((output[tc] && output[tc][0]) || "").trim());
    }
    personRemap = _monthlyRemapPersonRowsByCallsign_(monthSheet, targetCallsigns, {
      startRow: startRow,
      numRows: maxRows,
      callsignCol: callsignCol,
      endCol: _monthlyPersonBoundEndCol_(monthSheet, callsignCol),
    });
    if (personRemap && personRemap.warnings && personRemap.warnings.length) {
      warnings = warnings.concat(personRemap.warnings);
    }
    if (personRemap && personRemap.ok === false) {
      return {
        ok: false,
        sheet: monthSheet.getName(),
        personnelSheet: personnelSheet.getName(),
        rowsWritten: 0,
        skippedWrite: true,
        reason: personRemap.reason || "person_remap_failed",
        personRemap: personRemap,
        personnelRows: built.personnelRows,
        activeRowsCount: Number(built.activeRowsCount) || 0,
        callsignColumn: callsignCol,
        startRow: startRow,
        capacityRows: maxRows,
        capacityEndRow: capacityEndRow,
        rowsInserted: capacity.rowsInserted,
        rowsDeleted: capacity.rowsDeleted,
        warnings: warnings,
      };
    }
  }

  // Callsign-only write when remap did not rewrite the person-bound block
  // (no identity overlap, skipPersonRemap, or remap unavailable).
  if (
    callsignChanged &&
    !(personRemap && personRemap.remapped === true)
  ) {
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
    personRemap: personRemap,
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

/**
 * Rename a partially created month tab so it is not treated as a finished month.
 * @returns {string} new sheet name
 */
function _markIncompleteMonthSheet_(sheet, intendedName) {
  if (!sheet || typeof sheet.setName !== "function") {
    throw new Error("_markIncompleteMonthSheet_: sheet is required");
  }
  var base = String(intendedName || sheet.getName() || "XX").trim() || "XX";
  base = base.replace(/_НЕЗАВЕРШЕНО(_\d+)*$/u, "");
  var stamp = "";
  try {
    stamp = Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      "HHmmss",
    );
  } catch (_) {
    stamp = String(Date.now()).slice(-6);
  }
  var ss = typeof sheet.getParent === "function" ? sheet.getParent() : null;
  var candidate = base + "_НЕЗАВЕРШЕНО_" + stamp;
  var n = 0;
  while (
    ss &&
    typeof ss.getSheetByName === "function" &&
    ss.getSheetByName(candidate) &&
    n < 20
  ) {
    n++;
    candidate = base + "_НЕЗАВЕРШЕНО_" + stamp + "_" + n;
  }
  sheet.setName(candidate);
  return candidate;
}

/**
 * Fail createNextMonth when callsign or formula sync did not succeed.
 * Marks the partial sheet incomplete and throws — caller must not switch active month.
 */
function _assertCreateNextMonthSyncSucceeded_(opts) {
  opts = opts || {};
  var newSheet = opts.sheet;
  var intendedName = String(opts.intendedName || "").trim();
  var callsignSync = opts.callsignSync;
  var formulaSync = opts.formulaSync;
  var problems = [];

  if (!callsignSync) {
    problems.push("синхронізація позивних не виконана");
  } else if (callsignSync.ok === false) {
    problems.push(
      callsignSync.message
        ? String(callsignSync.message)
        : "помилка синхронізації позивних",
    );
  }

  if (!formulaSync) {
    problems.push("переписування формул не виконане");
  } else if (formulaSync.ok === false) {
    problems.push(
      formulaSync.message
        ? String(formulaSync.message)
        : "помилка переписування формул",
    );
  }

  var capacityEnd =
    callsignSync && callsignSync.capacityEndRow
      ? Number(callsignSync.capacityEndRow) || 0
      : 0;
  var formulaEnd = 0;
  if (formulaSync && formulaSync.after && formulaSync.after.endRow) {
    formulaEnd = Number(formulaSync.after.endRow) || 0;
  } else if (
    callsignSync &&
    callsignSync.scheduleBounds &&
    callsignSync.scheduleBounds.endRow
  ) {
    formulaEnd = Number(callsignSync.scheduleBounds.endRow) || 0;
  }
  if (capacityEnd > 0 && formulaEnd > 0 && capacityEnd > formulaEnd) {
    problems.push(
      "останній рядок PERSONNEL (" +
        capacityEnd +
        ") поза діапазоном формул зведення (кінець " +
        formulaEnd +
        ")",
    );
  }

  if (!problems.length) {
    return { ok: true };
  }

  if (newSheet && intendedName && typeof _markIncompleteMonthSheet_ === "function") {
    try {
      _markIncompleteMonthSheet_(newSheet, intendedName);
    } catch (markErr) {
      console.error(markErr);
    }
  }

  throw new Error(
    'Створення місяця "' +
      (intendedName || "?") +
      '" незавершене: ' +
      problems.join("; "),
  );
}

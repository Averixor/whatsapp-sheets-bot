/**
 * VacationsMaterialize.gs — computed VACATIONS source columns (A:I).
 * Replaces ARRAYFORMULA on End date, Active, Notify, Days left, Interval check.
 */

var VACATION_MATERIALIZE_MANAGED_END_ROW_ = 66;

var VACATION_COMPUTED_COLUMN_OFFSETS_ = [2, 4, 5, 6, 8];

function _vacationMaterializeSourceRange_() {
  try {
    if (
      typeof VACATION_PLANNER_CONFIG === "object" &&
      VACATION_PLANNER_CONFIG &&
      VACATION_PLANNER_CONFIG.SOURCE_RANGE
    ) {
      return VACATION_PLANNER_CONFIG.SOURCE_RANGE;
    }
  } catch (_) {}
  return { startCol: 1, width: 9, startRow: 2 };
}

function _vacationMaterializeSheetName_() {
  try {
    if (
      typeof VACATION_PLANNER_CONFIG === "object" &&
      VACATION_PLANNER_CONFIG &&
      VACATION_PLANNER_CONFIG.SHEETS &&
      VACATION_PLANNER_CONFIG.SHEETS.SOURCE
    ) {
      return VACATION_PLANNER_CONFIG.SHEETS.SOURCE;
    }
  } catch (_) {}
  return "VACATIONS";
}

function _vacationMaterializeStartRow_() {
  var rangeCfg = _vacationMaterializeSourceRange_();
  var startRow = Number(rangeCfg.startRow) || 2;
  return startRow > 0 ? startRow : 2;
}

function _vacationMaterializeEndRow_(sheet, startRow) {
  var start = Number(startRow) || 2;
  var fromLast = Math.max(Number(sheet && sheet.getLastRow()) || start, start);
  return Math.max(fromLast, VACATION_MATERIALIZE_MANAGED_END_ROW_);
}

function _vacationMaterializeToday_() {
  if (typeof DateUtils_ !== "undefined" && DateUtils_.toDayStart) {
    var parsed = DateUtils_.toDayStart(new Date());
    if (parsed) return parsed;
  }
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function _vacationMaterializeParseDate_(rawValue, displayValue) {
  if (typeof DateUtils_ !== "undefined" && DateUtils_.parseDateAny) {
    return DateUtils_.parseDateAny(rawValue, displayValue);
  }
  return rawValue instanceof Date && !isNaN(rawValue.getTime()) ? rawValue : null;
}

function _vacationMaterializeStripTime_(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) return null;
  var copy = new Date(date.getTime());
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function _vacationMaterializeDiffDays_(later, earlier) {
  var end = _vacationMaterializeStripTime_(later);
  var start = _vacationMaterializeStripTime_(earlier);
  if (!end || !start) return "";
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

function addMonthsSafe_(date, months) {
  var base = _vacationMaterializeStripTime_(date);
  if (!base) return null;
  var copy = new Date(base.getTime());
  copy.setMonth(copy.getMonth() + Number(months) || 0);
  return copy;
}

function _vacationMaterializeFmlKey_(fml) {
  if (typeof _normFml_ === "function") {
    return _normFml_(fml);
  }
  return String(fml || "")
    .trim()
    .toUpperCase();
}

function _vacationTypeLabelForInterval_(vacationNo) {
  var text = String(vacationNo || "")
    .trim()
    .toLowerCase();
  if (!text) return "";
  if (text === "друга відпустка") return "друга відпустка";
  if (text === "перша відпустка") return "перша відпустка";
  if (text.indexOf("друг") !== -1 && text.indexOf("додатков") === -1) {
    return "друга відпустка";
  }
  if (text.indexOf("перш") !== -1 && text.indexOf("додатков") === -1) {
    return "перша відпустка";
  }
  return "";
}

function _vacationMaterializeTravelDays_(travelValue) {
  var extra = Number(travelValue);
  return isFinite(extra) ? extra : 0;
}

function calcVacationEndDate_(startDate, travelDays) {
  if (!startDate) return "";
  var start = _vacationMaterializeStripTime_(startDate);
  if (!start) return "";

  var result = new Date(start.getTime());
  result.setDate(
    result.getDate() + 14 + _vacationMaterializeTravelDays_(travelDays),
  );
  return result;
}

function calcVacationDaysLeft_(startDate, today) {
  if (!startDate) return "";
  var start = _vacationMaterializeStripTime_(startDate);
  var now = _vacationMaterializeStripTime_(today);
  if (!start || !now) return "";

  var days = _vacationMaterializeDiffDays_(start, now);
  return days < 0 ? 0 : days;
}

function calcVacationNotify_(startDate, today) {
  if (!startDate) return "";
  var start = _vacationMaterializeStripTime_(startDate);
  var now = _vacationMaterializeStripTime_(today);
  if (!start || !now) return "";
  return start.getTime() > now.getTime();
}

function calcVacationActive_(endDate, today) {
  if (!endDate) return "";
  var end = _vacationMaterializeStripTime_(endDate);
  var now = _vacationMaterializeStripTime_(today);
  if (!end || !now) return "";
  return end.getTime() >= now.getTime();
}

function findMaxFinishBefore_(records, fio, vacationType, beforeStart) {
  var key = _vacationMaterializeFmlKey_(fio);
  var limit = _vacationMaterializeStripTime_(beforeStart);
  if (!key || !limit) return null;

  var best = null;
  (records || []).forEach(function (record) {
    if (_vacationMaterializeFmlKey_(record.fio) !== key) return;
    if (record.vacationType !== vacationType) return;
    if (!record.finish) return;
    var finish = _vacationMaterializeStripTime_(record.finish);
    if (!finish || finish.getTime() >= limit.getTime()) return;
    if (!best || finish.getTime() > best.getTime()) best = finish;
  });
  return best;
}

function findMinStartAfter_(records, fio, vacationType, afterFinish) {
  var key = _vacationMaterializeFmlKey_(fio);
  var limit = _vacationMaterializeStripTime_(afterFinish);
  if (!key || !limit) return null;

  var best = null;
  (records || []).forEach(function (record) {
    if (_vacationMaterializeFmlKey_(record.fio) !== key) return;
    if (record.vacationType !== vacationType) return;
    if (!record.start) return;
    var start = _vacationMaterializeStripTime_(record.start);
    if (!start || start.getTime() <= limit.getTime()) return;
    if (!best || start.getTime() < best.getTime()) best = start;
  });
  return best;
}

function calcVacationIntervalCheck_(records, current) {
  var fio = String((current && current.fio) || "").trim();
  if (!fio) return "";

  var start = _vacationMaterializeStripTime_(current && current.start);
  var finish = _vacationMaterializeStripTime_(current && current.finish);
  var vacationType = _vacationTypeLabelForInterval_(
    current && current.vacationType,
  );

  if (!start || !finish || !vacationType) return "";

  if (vacationType === "друга відпустка") {
    var prevFirst = findMaxFinishBefore_(
      records,
      fio,
      "перша відпустка",
      start,
    );
    var nextFirst = findMinStartAfter_(
      records,
      fio,
      "перша відпустка",
      finish,
    );
    var okPrev =
      !prevFirst ||
      start.getTime() >= addMonthsSafe_(prevFirst, 4).getTime();
    var okNext =
      !nextFirst ||
      nextFirst.getTime() >= addMonthsSafe_(finish, 4).getTime();
    return okPrev && okNext;
  }

  if (vacationType === "перша відпустка") {
    var prevSecond = findMaxFinishBefore_(
      records,
      fio,
      "друга відпустка",
      start,
    );
    return (
      !prevSecond ||
      start.getTime() >= addMonthsSafe_(prevSecond, 4).getTime()
    );
  }

  return "";
}

function _vacationMaterializeCellKey_(value) {
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

function _vacationMaterializeValuesEqual_(left, right) {
  return _vacationMaterializeCellKey_(left) === _vacationMaterializeCellKey_(right);
}

function _vacationMaterializeBuildSourceRows_(sheet) {
  var rangeCfg = _vacationMaterializeSourceRange_();
  var startCol = Number(rangeCfg.startCol) || 1;
  var width = Number(rangeCfg.width) || 9;
  var startRow = _vacationMaterializeStartRow_();
  var endRow = _vacationMaterializeEndRow_(sheet, startRow);
  var rowCount = Math.max(endRow - startRow + 1, 0);
  if (!rowCount) {
    return { rows: [], startCol: startCol, width: width, startRow: startRow, endRow: endRow };
  }

  var dataRange = sheet.getRange(startRow, startCol, rowCount, width);
  var values = dataRange.getValues();
  var displays = dataRange.getDisplayValues();
  var today = _vacationMaterializeToday_();
  var rows = [];

  for (var i = 0; i < rowCount; i++) {
    var raw = values[i] || [];
    var display = displays[i] || [];
    var fml = String(raw[0] || "").trim();
    var start = _vacationMaterializeParseDate_(raw[1], display[1]);
    var travel = raw[7];
    var endFromSheet = _vacationMaterializeParseDate_(raw[2], display[2]);
    var endDate = start ? calcVacationEndDate_(start, travel) : "";
    var vacationType = String(raw[3] || "").trim();

    rows.push({
      fio: fml,
      fml: fml,
      start: start,
      finish: start && endDate instanceof Date ? endDate : null,
      vacationType: vacationType,
      travel: travel,
      endDate: endDate,
      daysLeft: calcVacationDaysLeft_(start, today),
      notify: calcVacationNotify_(start, today),
      active: calcVacationActive_(
        start ? (endDate instanceof Date ? endDate : null) : null,
        today,
      ),
    });
  }

  var intervalRecords = rows
    .filter(function (row) {
      return !!row.fml;
    })
    .map(function (row) {
      return {
        fio: row.fml,
        start: row.start,
        finish: row.finish,
        vacationType: _vacationTypeLabelForInterval_(row.vacationType),
      };
    });

  rows.forEach(function (row) {
    row.intervalCheck = calcVacationIntervalCheck_(intervalRecords, {
      fio: row.fml,
      start: row.start,
      finish: row.finish,
      vacationType: row.vacationType,
    });
  });

  return {
    rows: rows,
    startCol: startCol,
    width: width,
    startRow: startRow,
    endRow: endRow,
    sourceValues: values,
  };
}

function _vacationMaterializeEnsureHeaders_(sheet, startCol, width) {
  var headers =
    typeof VACATION_PLANNER_CONFIG !== "undefined" &&
    VACATION_PLANNER_CONFIG &&
    Array.isArray(VACATION_PLANNER_CONFIG.SOURCE_HEADERS)
      ? VACATION_PLANNER_CONFIG.SOURCE_HEADERS.slice(0, width)
      : [
          "FML",
          "Start date",
          "End date",
          "Vacation №",
          "Active",
          "Notify",
          "Days left",
          "Travel",
          "Interval check",
        ];

  var headerRange = sheet.getRange(1, startCol, 1, width);
  var formulas =
    typeof headerRange.getFormulas === "function"
      ? headerRange.getFormulas()[0] || []
      : [];
  var needsRewrite = false;

  VACATION_COMPUTED_COLUMN_OFFSETS_.forEach(function (offset) {
    if (String(formulas[offset] || "").trim()) needsRewrite = true;
  });

  if (needsRewrite) {
    headerRange.setValues([headers]);
  }
}

function _vacationMaterializeWriteColumn_(
  sheet,
  startRow,
  startCol,
  offset,
  values,
  endRow,
) {
  var col = startCol + offset;
  var safeValues = Array.isArray(values) ? values : [];
  var rowCount = safeValues.length;
  if (!rowCount) return 0;

  sheet
    .getRange(startRow, col, rowCount, 1)
    .setValues(
      safeValues.map(function (value) {
        return [value];
      }),
    );
  return rowCount;
}

function _vacationMaterializeMergeComputedRows_(currentValues, builtRows) {
  var merged = [];
  var changed = false;
  var offsets = VACATION_COMPUTED_COLUMN_OFFSETS_;

  for (var i = 0; i < builtRows.length; i++) {
    var source = (currentValues[i] || []).slice();
    while (source.length < 9) source.push("");
    var row = builtRows[i] || {};
    var computed = [
      row.endDate,
      row.active,
      row.notify,
      row.daysLeft,
      row.intervalCheck,
    ];
    for (var j = 0; j < offsets.length; j++) {
      var offset = offsets[j];
      if (
        !_vacationMaterializeValuesEqual_(source[offset], computed[j])
      ) {
        changed = true;
      }
      source[offset] = computed[j];
    }
    merged.push(source);
  }

  return { values: merged, changed: changed };
}

function materializeVacationComputedColumns_(sheet, options) {
  if (
    typeof VacationsRepository_ === "object" &&
    VacationsRepository_ &&
    typeof VacationsRepository_.getSourceMode === "function"
  ) {
    try {
      if (VacationsRepository_.getSourceMode() !== "legacy") {
        return {
          ok: true,
          skipped: true,
          reason: "non-legacy vacation source",
          rowsWritten: 0,
        };
      }
    } catch (_) {}
  }

  sheet =
    sheet ||
    (typeof DataAccess_ === "object" &&
    DataAccess_ &&
    typeof DataAccess_.getSheet === "function"
      ? DataAccess_.getSheet(_vacationMaterializeSheetName_(), null, false)
      : null);
  if (!sheet || sheet.getLastRow() < 1) {
    return { ok: false, reason: "vacations sheet missing", rowsWritten: 0 };
  }

  var built;
  try {
    built = _vacationMaterializeBuildSourceRows_(sheet);
  } catch (e) {
    return {
      ok: false,
      reason: e && e.message ? e.message : String(e),
      rowsWritten: 0,
    };
  }

  var startCol = built.startCol;
  var width = built.width;
  var startRow = built.startRow;
  var endRow = built.endRow;
  var rows = built.rows;
  var rowFilter = null;

  if (options && Array.isArray(options.rows) && options.rows.length) {
    rowFilter = {};
    options.rows.forEach(function (rowNumber) {
      var normalized = Number(rowNumber);
      if (isFinite(normalized) && normalized >= startRow) {
        rowFilter[normalized] = true;
      }
    });
  }

  _vacationMaterializeEnsureHeaders_(sheet, startCol, width);

  if (!rows.length) {
    return { ok: true, rowsWritten: 0, sheet: sheet.getName() };
  }

  var merged = { changed: true };
  if (rowFilter) {
    function shouldWriteRow_(index) {
      return !!rowFilter[startRow + index];
    }

    function writeFilteredColumn_(offset, picker) {
      var values = [];
      rows.forEach(function (row, index) {
        if (!shouldWriteRow_(index)) return;
        values.push([picker(row)]);
      });
      if (!values.length) return 0;

      var targetRows = [];
      rows.forEach(function (row, index) {
        if (shouldWriteRow_(index)) targetRows.push(startRow + index);
      });
      var col = startCol + offset;
      targetRows.forEach(function (rowNumber, index) {
        sheet.getRange(rowNumber, col).setValue(values[index][0]);
      });
      return values.length;
    }

    writeFilteredColumn_(2, function (row) {
      return row.endDate;
    });
    writeFilteredColumn_(4, function (row) {
      return row.active;
    });
    writeFilteredColumn_(5, function (row) {
      return row.notify;
    });
    writeFilteredColumn_(6, function (row) {
      return row.daysLeft;
    });
    writeFilteredColumn_(8, function (row) {
      return row.intervalCheck;
    });
  } else {
    var currentValues = Array.isArray(built.sourceValues)
      ? built.sourceValues
      : sheet.getRange(startRow, startCol, rows.length, width).getValues();
    merged = _vacationMaterializeMergeComputedRows_(currentValues, rows);
    if (merged.changed) {
      sheet.getRange(startRow, startCol, rows.length, width).setValues(merged.values);
    }
  }

  if (!rowFilter) {
    try {
      sheet
        .getRange(startRow, startCol + 1, rows.length, 2)
        .setNumberFormat("dd.MM.yyyy");
    } catch (_) {}
  } else {
    try {
      options.rows.forEach(function (rowNumber) {
        sheet.getRange(rowNumber, startCol + 1, 1, 2).setNumberFormat("dd.MM.yyyy");
      });
    } catch (_) {}
  }

  var rowsWritten = rowFilter
    ? Object.keys(rowFilter).length
    : rows.length;

  return {
    ok: true,
    rowsWritten: rowsWritten,
    skippedWrite: !rowFilter && !merged.changed,
    sheet: sheet.getName(),
    endRow: endRow,
  };
}

function isVacationComputedColumnsManaged_() {
  return typeof materializeVacationComputedColumns_ === "function";
}

/**
 * MonthJournalMaterialize.gs — derived JOURNAL / SUMMARY from monthly schedule sheets.
 * One English-named JOURNAL and one SUMMARY hold all months 01–12.
 * PERSONNEL is read-only lookup; daily codes stay on month sheets 01–12.
 * Active-month update replaces only that month’s slice; other months stay intact.
 */

var MONTH_JOURNAL_UNKNOWN_CODE_LABEL_ = "Невідомий код";

/** English tab names — no month digits / UA prefixes. */
var MONTH_JOURNAL_SHEET_NAME_ = "JOURNAL";
var MONTH_JOURNAL_SUMMARY_SHEET_NAME_ = "SUMMARY";

/** Month key column — scopes bootstrap slices and active-month refresh. */
var MONTH_JOURNAL_MONTH_HEADER_ = "Місяць";

/** Default months processed per all-months GAS call (continuation via nextCursor). */
var MONTH_JOURNAL_DEFAULT_MONTHS_PER_CALL_ = 3;

var MONTH_JOURNAL_HEADERS_ = [
  MONTH_JOURNAL_MONTH_HEADER_,
  "Дата",
  "Позивний",
  "ПІБ",
  "Звання",
  "Посада",
  "Код",
  "Коротко",
  "Вид служби",
  "Місце",
  "Завдання",
  "Примітка",
  "Джерело",
];

var MONTH_JOURNAL_SUMMARY_BASE_HEADERS_ = [
  MONTH_JOURNAL_MONTH_HEADER_,
  "Позивний",
  "ПІБ",
  "Звання",
  "Посада",
];

/**
 * Fixed derived sheet names (month arg kept for call-site compatibility).
 */
function monthJournalDerivedSheetNames_(monthSheetName) {
  var month = String(monthSheetName || "").trim();
  if (month && !/^\d{2}$/.test(month)) {
    throw new Error("Некоректна назва місячного аркуша: " + month);
  }
  return {
    month: month || "",
    journal: MONTH_JOURNAL_SHEET_NAME_,
    summary: MONTH_JOURNAL_SUMMARY_SHEET_NAME_,
  };
}

function resolveMonthJournalSheetName_(payload) {
  var opts = payload && typeof payload === "object" ? payload : {};
  var explicit = String(opts.monthSheet || opts.month || "").trim();
  if (/^\d{2}$/.test(explicit)) return explicit;

  // Canonical "активний місяць" for the sidebar / normal update path.
  try {
    if (typeof getBotMonthSheetName_ === "function") {
      var botMonth = String(getBotMonthSheetName_() || "").trim();
      if (/^\d{2}$/.test(botMonth)) {
        var ssBot = getWasbSpreadsheet_();
        if (ssBot && ssBot.getSheetByName(botMonth)) return botMonth;
      }
    }
  } catch (_) {}

  // Fallback: currently open month tab (editor / ad-hoc).
  try {
    var ss = getWasbSpreadsheet_();
    var active = ss && ss.getActiveSheet ? ss.getActiveSheet() : null;
    var activeName = active ? String(active.getName() || "").trim() : "";
    if (/^\d{2}$/.test(activeName) && ss.getSheetByName(activeName)) {
      return activeName;
    }
  } catch (_) {}

  return "";
}

function listExistingMonthSheetNames_() {
  var ss = getWasbSpreadsheet_();
  var names = [];
  for (var month = 1; month <= 12; month++) {
    var name = (month < 10 ? "0" : "") + month;
    if (ss.getSheetByName(name)) names.push(name);
  }
  return names;
}

function _monthJournalHeaderNorm_(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[’'`"ʼ]/g, "")
    .replace(/\s+/g, " ");
}

function findMonthlyNotesCol_(sheet) {
  if (!sheet || typeof sheet.getRange !== "function") return 0;

  var dateRow = Number((typeof CONFIG !== "undefined" && CONFIG && CONFIG.DATE_ROW) || 1);
  var lastCol = Math.max(Number(sheet.getLastColumn()) || 0, 1);
  var headers =
    sheet.getRange(dateRow, 1, 1, lastCol).getDisplayValues()[0] || [];

  for (var col = 1; col <= headers.length; col++) {
    var norm = _monthJournalHeaderNorm_(headers[col - 1]);
    if (!norm) continue;
    if (norm.indexOf("приміт") !== -1 || norm.indexOf("note") !== -1) {
      return col;
    }
  }
  return 0;
}

function _monthJournalFormatDateDisplay_(rawValue, displayValue) {
  var display = String(displayValue || "").trim();
  if (
    typeof DateUtils_ === "object" &&
    DateUtils_ &&
    typeof DateUtils_.formatUaDate === "function"
  ) {
    try {
      var normalized =
        typeof DateUtils_.normalizeDate === "function"
          ? DateUtils_.normalizeDate(rawValue, displayValue)
          : "";
      if (normalized) return normalized;
      if (rawValue instanceof Date && !isNaN(rawValue.getTime())) {
        return DateUtils_.formatUaDate(rawValue);
      }
    } catch (_) {}
  }
  if (display) return display;
  if (rawValue instanceof Date && !isNaN(rawValue.getTime())) {
    return Utilities.formatDate(rawValue, getTimeZone_(), "dd.MM.yyyy");
  }
  return "";
}

function _monthJournalDayNumberFromHeader_(rawValue, displayValue) {
  if (rawValue instanceof Date && !isNaN(rawValue.getTime())) {
    return rawValue.getDate();
  }

  var display = String(displayValue || "").trim();
  if (display) {
    var m = display.match(/^(\d{1,2})[.\-/]/);
    if (m) return Number(m[1]);
  }

  if (/^\d{4,5}(\.\d+)?$/.test(display)) {
    var serial = Number(display);
    if (Number.isFinite(serial)) {
      var ms = Math.round((serial - 25569) * 86400 * 1000);
      var d = new Date(ms);
      if (!isNaN(d.getTime())) return d.getDate();
    }
  }

  try {
    if (
      typeof DateUtils_ === "object" &&
      DateUtils_ &&
      typeof DateUtils_.normalizeDate === "function"
    ) {
      var normalized = DateUtils_.normalizeDate(rawValue, displayValue);
      if (normalized) {
        var parts = String(normalized).split(".");
        if (parts.length >= 1) {
          var day = Number(parts[0]);
          if (Number.isFinite(day) && day >= 1 && day <= 31) return day;
        }
      }
    }
  } catch (_) {}

  return 0;
}

function _monthJournalBuildDictSumLookup_() {
  var rules =
    typeof readDictSum_ === "function" ? readDictSum_() || [] : [];
  var byCode = {};
  var orderedCodes = [];

  for (var i = 0; i < rules.length; i++) {
    var rule = rules[i] || {};
    var code = String(rule.code || "").trim();
    if (!code) continue;
    byCode[code] = String(rule.label || code).trim() || code;
    orderedCodes.push(code);
  }

  return { byCode: byCode, orderedCodes: orderedCodes };
}

function _monthJournalLookupDescriptions_(code, dictSumByCode, dictMap) {
  var trimmed = String(code || "").trim();
  var dictEntry =
    dictMap && dictMap[trimmed] && typeof dictMap[trimmed] === "object"
      ? dictMap[trimmed]
      : null;
  var inDictSum =
    dictSumByCode &&
    Object.prototype.hasOwnProperty.call(dictSumByCode, trimmed);
  var inDict = !!dictEntry;

  if (!inDictSum && !inDict) {
    return {
      shortLabel: MONTH_JOURNAL_UNKNOWN_CODE_LABEL_,
      serviceType: MONTH_JOURNAL_UNKNOWN_CODE_LABEL_,
      place: "",
      task: "",
      unknown: true,
    };
  }

  var shortLabel = inDictSum ? dictSumByCode[trimmed] : "";
  if (!shortLabel && dictEntry && dictEntry.label) {
    shortLabel = String(dictEntry.label).trim();
  }
  if (!shortLabel) shortLabel = trimmed;

  return {
    shortLabel: shortLabel,
    serviceType:
      (dictEntry && String(dictEntry.label || "").trim()) || shortLabel,
    place: dictEntry ? String(dictEntry.place || "").trim() : "",
    task: dictEntry ? String(dictEntry.task || "").trim() : "",
    unknown: false,
  };
}

function _monthJournalResolvePerson_(callsign) {
  var key = String(callsign || "").trim();
  if (!key) {
    return { fml: "", rank: "", position: "" };
  }

  var record = null;
  if (typeof getPersonnelByCallsignAnyStatus_ === "function") {
    record = getPersonnelByCallsignAnyStatus_(key);
  }

  if (!record) {
    return { fml: "", rank: "", position: "" };
  }

  return {
    fml: String(record.fml || "").trim(),
    rank: String(record.rank || record.title || "").trim(),
    position: String(record.position || "").trim(),
  };
}

function _monthJournalCollectRows_(monthSheet) {
  if (!monthSheet) {
    throw new Error("Місячний аркуш не передано");
  }

  var layout =
    typeof detectMonthlyLayoutFromSheet_ === "function"
      ? detectMonthlyLayoutFromSheet_(monthSheet)
      : null;
  if (!layout || !layout.matrix) {
    throw new Error(
      "Не вдалося визначити геометрію місячного аркуша " +
        monthSheet.getName(),
    );
  }

  var matrix = layout.matrix;
  var numRows = matrix.endRow - matrix.startRow + 1;
  var numCols = matrix.endCol - matrix.startCol + 1;
  if (numRows < 1 || numCols < 1) {
    return [];
  }

  var dateRow = Number((typeof CONFIG !== "undefined" && CONFIG && CONFIG.DATE_ROW) || 1);
  var dateRaw = monthSheet
    .getRange(dateRow, matrix.startCol, 1, numCols)
    .getValues()[0];
  var dateDisplay = monthSheet
    .getRange(dateRow, matrix.startCol, 1, numCols)
    .getDisplayValues()[0];

  var callsignCol =
    typeof getMonthlyCallsignColForSheet_ === "function"
      ? Number(getMonthlyCallsignColForSheet_(monthSheet)) || 2
      : Number((layout.fields && layout.fields.callsign) || 2);

  var notesCol = findMonthlyNotesCol_(monthSheet);
  var codes = monthSheet
    .getRange(matrix.startRow, matrix.startCol, numRows, numCols)
    .getDisplayValues();
  var callsigns = monthSheet
    .getRange(matrix.startRow, callsignCol, numRows, 1)
    .getDisplayValues();
  var notes =
    notesCol > 0
      ? monthSheet
          .getRange(matrix.startRow, notesCol, numRows, 1)
          .getDisplayValues()
      : [];

  var dictSumLookup = _monthJournalBuildDictSumLookup_();
  var dictMap =
    typeof loadDictMap_ === "function"
      ? loadDictMap_() || {}
      : typeof DictionaryRepository_ === "object" &&
          DictionaryRepository_ &&
          typeof DictionaryRepository_.getDictMap === "function"
        ? DictionaryRepository_.getDictMap() || {}
        : {};

  var monthSheetName = monthSheet.getName();
  var rows = [];

  for (var r = 0; r < numRows; r++) {
    var callsign = String((callsigns[r] && callsigns[r][0]) || "").trim();
    if (!callsign) continue;

    var person = _monthJournalResolvePerson_(callsign);
    var note =
      notesCol > 0 ? String((notes[r] && notes[r][0]) || "").trim() : "";
    var sourceRow = matrix.startRow + r;

    for (var c = 0; c < numCols; c++) {
      var code = String((codes[r] && codes[r][c]) || "").trim();
      if (!code) continue;

      var descriptions = _monthJournalLookupDescriptions_(
        code,
        dictSumLookup.byCode,
        dictMap,
      );
      var dayNumber = _monthJournalDayNumberFromHeader_(
        dateRaw[c],
        dateDisplay[c],
      );

      rows.push({
        month: monthSheetName,
        date: _monthJournalFormatDateDisplay_(dateRaw[c], dateDisplay[c]),
        dayNumber: dayNumber,
        callsign: callsign,
        fml: person.fml,
        rank: person.rank,
        position: person.position,
        code: code,
        shortLabel: descriptions.shortLabel,
        serviceType: descriptions.serviceType,
        place: descriptions.place,
        task: descriptions.task,
        note: note,
        source: monthSheetName + "!ряд " + sourceRow,
        unknownCode: descriptions.unknown === true,
      });
    }
  }

  rows.sort(function (a, b) {
    if (a.dayNumber !== b.dayNumber) {
      return (Number(a.dayNumber) || 0) - (Number(b.dayNumber) || 0);
    }
    return String(a.callsign || "").localeCompare(
      String(b.callsign || ""),
      "uk-UA",
    );
  });

  return {
    rows: rows,
    dictSumOrderedCodes: dictSumLookup.orderedCodes,
  };
}

function buildMonthJournalCompressedSummary_(dayEntries) {
  var entries = Array.isArray(dayEntries) ? dayEntries.slice() : [];
  if (!entries.length) return "";

  entries.sort(function (a, b) {
    return (Number(a.dayNumber) || 0) - (Number(b.dayNumber) || 0);
  });

  var segments = [];
  var index = 0;

  while (index < entries.length) {
    var start = entries[index];
    var end = start;
    var next = index + 1;

    while (next < entries.length) {
      var prev = entries[next - 1];
      var current = entries[next];
      if (
        String(current.code || "") === String(start.code || "") &&
        Number(current.dayNumber) === Number(prev.dayNumber) + 1
      ) {
        end = current;
        next++;
        continue;
      }
      break;
    }

    var label = String(start.code || "").trim();
    var startDay = Number(start.dayNumber) || 0;
    var endDay = Number(end.dayNumber) || startDay;
    var startText = startDay < 10 ? "0" + startDay : String(startDay);
    var endText = endDay < 10 ? "0" + endDay : String(endDay);

    if (startDay > 0 && endDay > 0) {
      if (startDay === endDay) {
        segments.push(startText + " " + label);
      } else {
        segments.push(startText + "–" + endText + " " + label);
      }
    } else if (start.date && start.date === end.date) {
      segments.push(String(start.date) + " " + label);
    } else if (start.date && end.date) {
      segments.push(String(start.date) + "–" + String(end.date) + " " + label);
    } else {
      segments.push(label);
    }

    index = next;
  }

  return segments.join("; ");
}

function _monthJournalEnsureSheet_(ss, sheetName, headers) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  try {
    sheet.setFrozenRows(1);
  } catch (_) {}

  return sheet;
}

/**
 * Replace all content (full wipe + write). Used only when headers/layout change
 * requires a clean slate for the whole sheet — prefer slice replace otherwise.
 */
function _monthJournalWriteRows_(sheet, headers, rows) {
  var headerCount = headers.length;
  var existingLastRow = Math.max(Number(sheet.getLastRow()) || 0, 1);
  if (existingLastRow > 1) {
    sheet
      .getRange(2, 1, existingLastRow - 1, headerCount)
      .clearContent();
  }

  if (!rows.length) return 0;

  // Sheet.getRange(row, column, numRows, numColumns) — third arg is height, not end row.
  sheet.getRange(2, 1, rows.length, headerCount).setValues(rows);
  return rows.length;
}

/**
 * Keep rows for other months; replace the target month slice; rewrite sheet.
 * Does not wipe past months during bootstrap chunks or active-month refresh.
 */
function _monthJournalReplaceMonthSlice_(sheet, headers, monthKey, monthRows) {
  var headerCount = headers.length;
  var month = String(monthKey || "").trim();
  var monthCol = 0;
  for (var h = 0; h < headers.length; h++) {
    if (
      _monthJournalHeaderNorm_(headers[h]) ===
      _monthJournalHeaderNorm_(MONTH_JOURNAL_MONTH_HEADER_)
    ) {
      monthCol = h;
      break;
    }
  }

  var kept = [];
  var lastRow = Math.max(Number(sheet.getLastRow()) || 0, 1);
  var lastCol = Math.max(Number(sheet.getLastColumn()) || 0, headerCount);

  if (lastRow > 1) {
    var existing = sheet.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues();
    for (var r = 0; r < existing.length; r++) {
      var row = existing[r] || [];
      var rowMonth = String(row[monthCol] || "").trim();
      if (rowMonth === month) continue;

      var padded = [];
      for (var c = 0; c < headerCount; c++) {
        padded.push(row[c] != null ? row[c] : "");
      }
      // Skip fully empty residual rows.
      var hasValue = false;
      for (var k = 0; k < padded.length; k++) {
        if (String(padded[k] || "").trim()) {
          hasValue = true;
          break;
        }
      }
      if (hasValue) kept.push(padded);
    }
  }

  var incoming = Array.isArray(monthRows) ? monthRows : [];
  var merged = kept.concat(incoming);

  merged.sort(function (a, b) {
    var ma = String(a[monthCol] || "");
    var mb = String(b[monthCol] || "");
    if (ma !== mb) return ma.localeCompare(mb, "uk-UA");
    var dateA = String(a[1] || "");
    var dateB = String(b[1] || "");
    if (dateA !== dateB) return dateA.localeCompare(dateB, "uk-UA");
    return String(a[2] || "").localeCompare(String(b[2] || ""), "uk-UA");
  });

  // Ensure header width matches (summary DICT_SUM columns may grow).
  sheet.getRange(1, 1, 1, headerCount).setValues([headers]);

  var clearLast = Math.max(Number(sheet.getLastRow()) || 0, 1);
  var clearCols = Math.max(Number(sheet.getLastColumn()) || 0, headerCount);
  if (clearLast > 1) {
    sheet.getRange(2, 1, clearLast - 1, clearCols).clearContent();
  }

  if (!merged.length) return incoming.length;

  sheet.getRange(2, 1, merged.length, headerCount).setValues(merged);
  return incoming.length;
}

function materializeMonthJournal_(monthSheetName) {
  var ss = getWasbSpreadsheet_();
  var month = String(monthSheetName || "").trim();
  if (!/^\d{2}$/.test(month)) {
    return {
      ok: false,
      reason: "invalid_month_sheet",
      message: "Відкрийте місячний аркуш 01–12",
      rowsWritten: 0,
      journalSheet: "",
    };
  }

  var monthSheet = ss.getSheetByName(month);
  if (!monthSheet) {
    return {
      ok: false,
      reason: "month_sheet_missing",
      message: 'Аркуш "' + month + '" не знайдено',
      rowsWritten: 0,
      journalSheet: "",
    };
  }

  var collected = _monthJournalCollectRows_(monthSheet);
  var journalRows = collected.rows || [];
  var names = monthJournalDerivedSheetNames_(month);
  var sheet = _monthJournalEnsureSheet_(ss, names.journal, MONTH_JOURNAL_HEADERS_);

  var values = journalRows.map(function (entry) {
    return [
      entry.month || month,
      entry.date,
      entry.callsign,
      entry.fml,
      entry.rank,
      entry.position,
      entry.code,
      entry.shortLabel,
      entry.serviceType,
      entry.place,
      entry.task,
      entry.note,
      entry.source,
    ];
  });

  var rowsWritten = _monthJournalReplaceMonthSlice_(
    sheet,
    MONTH_JOURNAL_HEADERS_,
    month,
    values,
  );

  return {
    ok: true,
    monthSheet: month,
    journalSheet: names.journal,
    rowsWritten: rowsWritten,
    journalRows: journalRows,
    dictSumOrderedCodes: collected.dictSumOrderedCodes || [],
  };
}

function _monthJournalBuildSummaryHeaders_(codeColumns) {
  return MONTH_JOURNAL_SUMMARY_BASE_HEADERS_.concat(codeColumns || []).concat([
    "Інше",
    "Підсумок",
  ]);
}

/**
 * Align kept SUMMARY rows to current header width when DICT_SUM codes change.
 * Remaps by header name so trailing Інше / Підсумок do not shift.
 */
function _monthJournalRemapSummaryRow_(oldHeaders, oldRow, newHeaders) {
  var byName = {};
  for (var i = 0; i < oldHeaders.length; i++) {
    var key = _monthJournalHeaderNorm_(oldHeaders[i]);
    if (!key) continue;
    byName[key] = oldRow && oldRow[i] != null ? oldRow[i] : "";
  }
  var out = [];
  for (var j = 0; j < newHeaders.length; j++) {
    var nk = _monthJournalHeaderNorm_(newHeaders[j]);
    out.push(Object.prototype.hasOwnProperty.call(byName, nk) ? byName[nk] : "");
  }
  return out;
}

function materializeMonthPersonSummary_(journalRows, monthSheetName) {
  var month = String(monthSheetName || "").trim();
  if (!/^\d{2}$/.test(month)) {
    return {
      ok: false,
      reason: "invalid_month_sheet",
      message: "Відкрийте місячний аркуш 01–12",
      rowsWritten: 0,
      summarySheet: "",
    };
  }

  var rows = Array.isArray(journalRows) ? journalRows : [];
  var dictSumLookup = _monthJournalBuildDictSumLookup_();
  var codeColumns = dictSumLookup.orderedCodes.slice();
  var headers = _monthJournalBuildSummaryHeaders_(codeColumns);

  var byCallsign = {};
  for (var i = 0; i < rows.length; i++) {
    var entry = rows[i] || {};
    var callsign = String(entry.callsign || "").trim();
    if (!callsign) continue;

    if (!byCallsign[callsign]) {
      byCallsign[callsign] = {
        callsign: callsign,
        fml: String(entry.fml || "").trim(),
        rank: String(entry.rank || "").trim(),
        position: String(entry.position || "").trim(),
        counts: {},
        otherCount: 0,
        dayEntries: [],
      };
    }

    var bucket = byCallsign[callsign];
    if (!bucket.fml && entry.fml) bucket.fml = String(entry.fml).trim();
    if (!bucket.rank && entry.rank) bucket.rank = String(entry.rank).trim();
    if (!bucket.position && entry.position) {
      bucket.position = String(entry.position).trim();
    }

    var code = String(entry.code || "").trim();
    if (code) {
      if (entry.unknownCode || !dictSumLookup.byCode[code]) {
        bucket.otherCount += 1;
      } else {
        bucket.counts[code] = (bucket.counts[code] || 0) + 1;
      }
      bucket.dayEntries.push({
        dayNumber: Number(entry.dayNumber) || 0,
        date: String(entry.date || "").trim(),
        code: code,
      });
    }
  }

  var people = Object.keys(byCallsign)
    .sort(function (a, b) {
      return String(a).localeCompare(String(b), "uk-UA");
    })
    .map(function (key) {
      return byCallsign[key];
    });

  var summaryValues = people.map(function (person) {
    var line = [
      month,
      person.callsign,
      person.fml,
      person.rank,
      person.position,
    ];

    for (var c = 0; c < codeColumns.length; c++) {
      var codeKey = codeColumns[c];
      var count = person.counts[codeKey] || 0;
      line.push(count > 0 ? count : "");
    }

    line.push(person.otherCount > 0 ? person.otherCount : "");
    line.push(buildMonthJournalCompressedSummary_(person.dayEntries));
    return line;
  });

  var ss = getWasbSpreadsheet_();
  var names = monthJournalDerivedSheetNames_(month);
  var existingSheet = ss.getSheetByName(names.summary);
  var oldHeaders = [];
  var existingData = [];
  if (existingSheet) {
    var priorLastRow = Math.max(Number(existingSheet.getLastRow()) || 0, 1);
    var priorLastCol = Math.max(Number(existingSheet.getLastColumn()) || 0, 1);
    if (priorLastCol >= 1) {
      oldHeaders =
        existingSheet.getRange(1, 1, 1, priorLastCol).getDisplayValues()[0] ||
        [];
    }
    if (priorLastRow > 1) {
      // Typed values — keep numeric counters as numbers (not display strings).
      existingData = existingSheet
        .getRange(2, 1, priorLastRow - 1, priorLastCol)
        .getValues();
    }
  }

  var sheet = _monthJournalEnsureSheet_(ss, names.summary, headers);
  var headerCount = headers.length;
  var monthCol = 0;
  var kept = [];

  for (var r = 0; r < existingData.length; r++) {
    var existingRow = existingData[r] || [];
    var rowMonth = String(existingRow[monthCol] || "").trim();
    if (rowMonth === month) continue;
    var remapped = _monthJournalRemapSummaryRow_(
      oldHeaders,
      existingRow,
      headers,
    );
    var hasValue = false;
    for (var k = 0; k < remapped.length; k++) {
      if (String(remapped[k] || "").trim()) {
        hasValue = true;
        break;
      }
    }
    if (hasValue) kept.push(remapped);
  }

  var merged = kept.concat(summaryValues);
  merged.sort(function (a, b) {
    var ma = String(a[0] || "");
    var mb = String(b[0] || "");
    if (ma !== mb) return ma.localeCompare(mb, "uk-UA");
    return String(a[1] || "").localeCompare(String(b[1] || ""), "uk-UA");
  });

  sheet.getRange(1, 1, 1, headerCount).setValues([headers]);
  var clearLast = Math.max(Number(sheet.getLastRow()) || 0, 1);
  var clearCols = Math.max(Number(sheet.getLastColumn()) || 0, headerCount);
  if (clearLast > 1) {
    sheet.getRange(2, 1, clearLast - 1, clearCols).clearContent();
  }
  if (merged.length) {
    sheet.getRange(2, 1, merged.length, headerCount).setValues(merged);
  }

  return {
    ok: true,
    monthSheet: month,
    summarySheet: names.summary,
    rowsWritten: summaryValues.length,
    peopleCount: people.length,
  };
}

/**
 * Client/API-safe bundle summary — never include in-memory journalRows
 * (hundreds of entries × N months overflows google.script.run → INTERNAL).
 * Sheet writes remain full; only the HtmlService payload is slim.
 */
function slimMonthJournalBundleResult_(result) {
  if (!result || typeof result !== "object") {
    return {
      ok: false,
      reason: "empty_result",
      message: "Порожня відповідь materialize",
    };
  }
  return {
    ok: result.ok !== false,
    monthSheet: result.monthSheet || "",
    journalSheet: result.journalSheet || MONTH_JOURNAL_SHEET_NAME_,
    summarySheet: result.summarySheet || MONTH_JOURNAL_SUMMARY_SHEET_NAME_,
    journalRowsWritten:
      Number(result.journalRowsWritten) || Number(result.rowsWritten) || 0,
    summaryRowsWritten: Number(result.summaryRowsWritten) || 0,
    peopleCount: Number(result.peopleCount) || 0,
    reason: result.reason || "",
    message: result.message || "",
  };
}

function materializeMonthJournalBundle_(monthSheetName) {
  var journalResult = materializeMonthJournal_(monthSheetName);
  if (!journalResult || journalResult.ok === false) {
    return slimMonthJournalBundleResult_(journalResult);
  }

  var summaryResult = materializeMonthPersonSummary_(
    journalResult.journalRows || [],
    monthSheetName,
  );

  if (!summaryResult || summaryResult.ok === false) {
    return slimMonthJournalBundleResult_({
      ok: false,
      monthSheet: journalResult.monthSheet || monthSheetName,
      journalSheet: journalResult.journalSheet || "",
      journalRowsWritten: journalResult.rowsWritten || 0,
      reason: (summaryResult && summaryResult.reason) || "summary_failed",
      message:
        (summaryResult && summaryResult.message) ||
        "Не вдалося оновити підсумок по людях",
    });
  }

  return slimMonthJournalBundleResult_({
    ok: true,
    monthSheet: journalResult.monthSheet,
    journalSheet: journalResult.journalSheet,
    summarySheet: summaryResult.summarySheet,
    journalRowsWritten: journalResult.rowsWritten || 0,
    summaryRowsWritten: summaryResult.rowsWritten || 0,
    peopleCount: summaryResult.peopleCount || 0,
  });
}

/**
 * Bootstrap / maintenance: materialize JOURNAL + SUMMARY slices for existing
 * month tabs 01–12. Chunked via cursor / monthsPerCall so one GAS execution
 * can finish a batch and the same public API is re-invoked until done.
 *
 * Options:
 *   cursor        — start index into listExistingMonthSheetNames_ (default 0)
 *   monthsPerCall — max months this call (default MONTH_JOURNAL_DEFAULT_MONTHS_PER_CALL_)
 *
 * Returns nextCursor (number) when more months remain; done=true when finished.
 * Past months already written are never wiped by later chunks.
 */
function materializeAllExistingMonthJournals_(options) {
  var opts = options && typeof options === "object" ? options : {};
  var months = listExistingMonthSheetNames_();
  var cursor = Math.max(0, Number(opts.cursor) || 0);
  if (!Number.isFinite(cursor)) cursor = 0;

  var monthsPerCall = Number(opts.monthsPerCall);
  if (!Number.isFinite(monthsPerCall) || monthsPerCall < 1) {
    monthsPerCall = MONTH_JOURNAL_DEFAULT_MONTHS_PER_CALL_;
  }
  monthsPerCall = Math.min(12, Math.floor(monthsPerCall));

  var end = Math.min(months.length, cursor + monthsPerCall);
  var batch = months.slice(cursor, end);
  var results = [];
  var journalRowsWritten = 0;
  var summaryRowsWritten = 0;
  var names = monthJournalDerivedSheetNames_();
  var affectedSheets = [names.journal, names.summary];

  for (var i = 0; i < batch.length; i++) {
    var month = batch[i];
    try {
      var result = slimMonthJournalBundleResult_(
        materializeMonthJournalBundle_(month),
      );
      if (!result.monthSheet) result.monthSheet = month;
      results.push(result);
      if (result.ok !== false) {
        journalRowsWritten += Number(result.journalRowsWritten) || 0;
        summaryRowsWritten += Number(result.summaryRowsWritten) || 0;
        affectedSheets.push(month);
      }
    } catch (err) {
      results.push(
        slimMonthJournalBundleResult_({
          ok: false,
          monthSheet: month,
          reason: "exception",
          message: err && err.message ? String(err.message) : String(err || ""),
        }),
      );
    }
  }

  var failed = results.filter(function (item) {
    return !item || item.ok === false;
  });

  var done = end >= months.length;
  var nextCursor = done ? null : end;

  return {
    ok: failed.length === 0,
    done: done,
    cursor: cursor,
    nextCursor: nextCursor,
    monthsPerCall: monthsPerCall,
    months: months,
    batchMonths: batch,
    monthCount: months.length,
    processedCount: results.length,
    failedCount: failed.length,
    journalRowsWritten: journalRowsWritten,
    summaryRowsWritten: summaryRowsWritten,
    journalSheet: names.journal,
    summarySheet: names.summary,
    results: results,
    affectedSheets: affectedSheets.filter(function (name, index, list) {
      return name && list.indexOf(name) === index;
    }),
  };
}

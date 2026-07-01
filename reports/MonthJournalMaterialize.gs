/**
 * MonthJournalMaterialize.gs — derived ЖУРНАЛ_MM / ПІДСУМОК_MM from monthly schedule sheets.
 * PERSONNEL is read-only lookup; daily codes stay on month sheets 01–12.
 */

var MONTH_JOURNAL_UNKNOWN_CODE_LABEL_ = "Невідомий код";

var MONTH_JOURNAL_HEADERS_ = [
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
  "Позивний",
  "ПІБ",
  "Звання",
  "Посада",
];

function monthJournalDerivedSheetNames_(monthSheetName) {
  var month = String(monthSheetName || "").trim();
  if (!/^\d{2}$/.test(month)) {
    throw new Error("Некоректна назва місячного аркуша: " + month);
  }
  return {
    month: month,
    journal: "ЖУРНАЛ_" + month,
    summary: "ПІДСУМОК_" + month,
  };
}

function resolveMonthJournalSheetName_(payload) {
  var opts = payload && typeof payload === "object" ? payload : {};
  var explicit = String(opts.monthSheet || opts.month || "").trim();
  if (/^\d{2}$/.test(explicit)) return explicit;

  try {
    var ss = getWasbSpreadsheet_();
    var active = ss && ss.getActiveSheet ? ss.getActiveSheet() : null;
    var activeName = active ? String(active.getName() || "").trim() : "";
    if (/^\d{2}$/.test(activeName)) return activeName;
  } catch (_) {}

  return "";
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

function _monthJournalWriteRows_(sheet, headers, rows) {
  var headerCount = headers.length;
  var existingLastRow = Math.max(Number(sheet.getLastRow()) || 0, 1);
  if (existingLastRow > 1) {
    sheet
      .getRange(2, 1, existingLastRow - 1, headerCount)
      .clearContent();
  }

  if (!rows.length) return 0;

  var endRow = 1 + rows.length;
  sheet.getRange(2, 1, endRow, headerCount).setValues(rows);
  return rows.length;
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

  var rowsWritten = _monthJournalWriteRows_(sheet, MONTH_JOURNAL_HEADERS_, values);

  return {
    ok: true,
    monthSheet: month,
    journalSheet: names.journal,
    rowsWritten: rowsWritten,
    journalRows: journalRows,
    dictSumOrderedCodes: collected.dictSumOrderedCodes || [],
  };
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
  var headers = MONTH_JOURNAL_SUMMARY_BASE_HEADERS_.concat(codeColumns).concat([
    "Інше",
    "Короткий підсумок",
  ]);

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
  var sheet = _monthJournalEnsureSheet_(ss, names.summary, headers);
  var rowsWritten = _monthJournalWriteRows_(sheet, headers, summaryValues);

  return {
    ok: true,
    monthSheet: month,
    summarySheet: names.summary,
    rowsWritten: rowsWritten,
    peopleCount: people.length,
  };
}

function materializeMonthJournalBundle_(monthSheetName) {
  var journalResult = materializeMonthJournal_(monthSheetName);
  if (!journalResult || journalResult.ok === false) {
    return journalResult;
  }

  var summaryResult = materializeMonthPersonSummary_(
    journalResult.journalRows || [],
    monthSheetName,
  );

  if (!summaryResult || summaryResult.ok === false) {
    return {
      ok: false,
      reason: (summaryResult && summaryResult.reason) || "summary_failed",
      message:
        (summaryResult && summaryResult.message) ||
        "Не вдалося оновити підсумок по людях",
      journal: journalResult,
      summary: summaryResult || null,
    };
  }

  return {
    ok: true,
    monthSheet: journalResult.monthSheet,
    journalSheet: journalResult.journalSheet,
    summarySheet: summaryResult.summarySheet,
    journalRowsWritten: journalResult.rowsWritten || 0,
    summaryRowsWritten: summaryResult.rowsWritten || 0,
    peopleCount: summaryResult.peopleCount || 0,
    journal: journalResult,
    summary: summaryResult,
  };
}

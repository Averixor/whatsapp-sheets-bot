/**
 * FORMAT_RULES_REGISTRY storage and stable conditional-format fingerprints.
 */

const FORMAT_RULES_REGISTRY_SHEET_ = "FORMAT_RULES_REGISTRY";

const FORMAT_RULES_REGISTRY_HEADERS_ = Object.freeze([
  "ID",
  "Sheet",
  "Range",
  "RuleType",
  "ConditionType",
  "ConditionValue",
  "Formula",
  "Background",
  "FontColor",
  "Bold",
  "Italic",
  "TextStyle",
  "Priority",
  "DetectedAs",
  "Decision",
  "Relevance",
  "MovePolicy",
  "AdoptToCode",
  "ExpiresAt",
  "Comment",
  "Fingerprint",
  "FirstSeenAt",
  "LastSeenAt",
  "LastAppliedAt",
]);

const FORMAT_RULES_REGISTRY_DROPDOWNS_ = Object.freeze({
  DetectedAs: Object.freeze([
    "WASB_MANAGED",
    "MANUAL",
    "UNKNOWN",
    "ADOPTED",
  ]),
  Decision: Object.freeze([
    "Preserve",
    "Adopt",
    "Temporary",
    "Ignore",
    "DeleteAllowed",
  ]),
  Relevance: Object.freeze([
    "Permanent",
    "Temporary",
    "OneTime",
    "Deprecated",
    "Unknown",
  ]),
  MovePolicy: Object.freeze([
    "KeepOriginalRange",
    "RemapWithSheet",
    "RemapWithSchedule",
    "RemapWithVacationCalendar",
    "DoNotMove",
  ]),
  AdoptToCode: Object.freeze(["TRUE", "FALSE"]),
});

const FORMAT_RULES_REGISTRY_USER_FIELDS_ = Object.freeze([
  "Decision",
  "Relevance",
  "MovePolicy",
  "AdoptToCode",
  "ExpiresAt",
  "Comment",
]);

function _formatRulesSpreadsheet_() {
  if (
    typeof DataAccess_ !== "undefined" &&
    DataAccess_ &&
    typeof DataAccess_.getSpreadsheet === "function"
  ) {
    return DataAccess_.getSpreadsheet();
  }
  return getWasbSpreadsheet_();
}

function _formatRulesHeaderIndex_() {
  var index = {};
  FORMAT_RULES_REGISTRY_HEADERS_.forEach(function (header, position) {
    index[header] = position;
  });
  return index;
}

function _formatRulesEnsureGridSize_(sheet, minRows, minColumns) {
  var currentRows = Math.max(Number(sheet.getMaxRows()) || 0, 1);
  var currentColumns = Math.max(Number(sheet.getMaxColumns()) || 0, 1);
  var targetRows = Math.max(Number(minRows) || 1, 1);
  var targetColumns = Math.max(Number(minColumns) || 1, 1);

  if (currentRows < targetRows) {
    sheet.insertRowsAfter(currentRows, targetRows - currentRows);
  }
  if (currentColumns < targetColumns) {
    sheet.insertColumnsAfter(currentColumns, targetColumns - currentColumns);
  }
}

function _formatRulesNormalizeRegistryHeaders_(sheet) {
  var expected = FORMAT_RULES_REGISTRY_HEADERS_.slice();
  var currentWidth = Math.max(Number(sheet.getLastColumn()) || 0, expected.length);
  var currentHeaders = sheet
    .getRange(1, 1, 1, currentWidth)
    .getDisplayValues()[0];
  var exact =
    currentHeaders.length >= expected.length &&
    expected.every(function (header, index) {
      return currentHeaders[index] === header;
    });
  if (exact) return false;

  var oldIndex = {};
  currentHeaders.forEach(function (header, index) {
    var key = String(header || "").trim();
    if (key && !Object.prototype.hasOwnProperty.call(oldIndex, key)) {
      oldIndex[key] = index;
    }
  });

  var lastRow = Math.max(Number(sheet.getLastRow()) || 0, 1);
  var oldRows =
    lastRow > 1
      ? sheet.getRange(2, 1, lastRow - 1, currentWidth).getValues()
      : [];
  var migrated = oldRows.map(function (row) {
    return expected.map(function (header) {
      return Object.prototype.hasOwnProperty.call(oldIndex, header)
        ? row[oldIndex[header]]
        : "";
    });
  });

  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, currentWidth).clearContent();
  }
  sheet.getRange(1, 1, 1, expected.length).setValues([expected]);
  if (migrated.length) {
    sheet.getRange(2, 1, migrated.length, expected.length).setValues(migrated);
  }
  return true;
}

function _formatRulesApplyRegistryValidation_(sheet) {
  var index = _formatRulesHeaderIndex_();
  var rowCount = Math.max(Number(sheet.getMaxRows()) || 0, 500) - 1;
  Object.keys(FORMAT_RULES_REGISTRY_DROPDOWNS_).forEach(function (header) {
    var rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(FORMAT_RULES_REGISTRY_DROPDOWNS_[header].slice(), true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange(2, index[header] + 1, rowCount, 1).setDataValidation(rule);
  });
  ["ConditionValue", "Formula", "Comment", "Fingerprint"].forEach(
    function (header) {
      sheet.getRange(2, index[header] + 1, rowCount, 1).setNumberFormat("@");
    },
  );
}

function ensureFormatRulesRegistrySheet_() {
  var ss = _formatRulesSpreadsheet_();
  var sheet = ss.getSheetByName(FORMAT_RULES_REGISTRY_SHEET_);
  var created = !sheet;
  if (!sheet) sheet = ss.insertSheet(FORMAT_RULES_REGISTRY_SHEET_);

  _formatRulesEnsureGridSize_(
    sheet,
    500,
    FORMAT_RULES_REGISTRY_HEADERS_.length,
  );
  var headersUpdated = _formatRulesNormalizeRegistryHeaders_(sheet);
  sheet
    .getRange(1, 1, 1, FORMAT_RULES_REGISTRY_HEADERS_.length)
    .setFontWeight("bold")
    .setBackground("#d9eaf7");
  sheet.setFrozenRows(1);
  _formatRulesApplyRegistryValidation_(sheet);

  return {
    sheet: sheet,
    created: created,
    headersUpdated: headersUpdated,
  };
}

function _formatRulesRecordFromRow_(row, rowNumber) {
  var record = { _rowNumber: rowNumber };
  FORMAT_RULES_REGISTRY_HEADERS_.forEach(function (header, index) {
    var value = row[index];
    record[header] =
      typeof value === "string" && /^'[=+\-@]/.test(value)
        ? value.slice(1)
        : value;
  });
  return record;
}

function _formatRulesRegistryCellValue_(value) {
  return typeof value === "string" && /^[=+\-@]/.test(value)
    ? "'" + value
    : value;
}

function readFormatRulesRegistry_() {
  var ensured = ensureFormatRulesRegistrySheet_();
  var sheet = ensured.sheet;
  var lastRow = Math.max(Number(sheet.getLastRow()) || 0, 1);
  if (lastRow < 2) return [];

  return sheet
    .getRange(
      2,
      1,
      lastRow - 1,
      FORMAT_RULES_REGISTRY_HEADERS_.length,
    )
    .getValues()
    .map(function (row, index) {
      return _formatRulesRecordFromRow_(row, index + 2);
    })
    .filter(function (record) {
      return String(record.ID || record.Fingerprint || "").trim() !== "";
    });
}

function _formatRulesRegistryMap_(records) {
  var map = {};
  (Array.isArray(records) ? records : []).forEach(function (record) {
    var fingerprint = String(record && record.Fingerprint ? record.Fingerprint : "");
    if (fingerprint && !map[fingerprint]) map[fingerprint] = record;
  });
  return map;
}

function _formatRulesStableValue_(value) {
  if (value === null || typeof value === "undefined") return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(_formatRulesStableValue_);
  if (typeof value === "object") {
    var out = {};
    Object.keys(value)
      .sort()
      .forEach(function (key) {
        out[key] = _formatRulesStableValue_(value[key]);
      });
    return out;
  }
  return value;
}

function _formatRulesStableStringify_(value) {
  return JSON.stringify(_formatRulesStableValue_(value));
}

function _formatRulesDigestHex_(value) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(value || ""),
  );
  return bytes
    .map(function (byte) {
      return (byte < 0 ? byte + 256 : byte).toString(16).padStart(2, "0");
    })
    .join("");
}

function _formatRulesField_(record, upper, lower) {
  if (record && Object.prototype.hasOwnProperty.call(record, upper)) {
    return record[upper];
  }
  return record && Object.prototype.hasOwnProperty.call(record, lower)
    ? record[lower]
    : "";
}

function buildFormatRuleFingerprint_(record) {
  var rangeText = String(_formatRulesField_(record, "Range", "range") || "");
  var ranges = rangeText
    .split(",")
    .map(function (item) {
      return item.trim();
    })
    .filter(Boolean)
    .sort();
  var identity = {
    sheet: String(_formatRulesField_(record, "Sheet", "sheet") || ""),
    ranges: ranges,
    ruleType: String(_formatRulesField_(record, "RuleType", "ruleType") || ""),
    conditionType: String(
      _formatRulesField_(record, "ConditionType", "conditionType") || "",
    ),
    conditionValue: _formatRulesField_(
      record,
      "ConditionValue",
      "conditionValue",
    ),
    formula: String(_formatRulesField_(record, "Formula", "formula") || ""),
    background: String(
      _formatRulesField_(record, "Background", "background") || "",
    ).toLowerCase(),
    fontColor: String(
      _formatRulesField_(record, "FontColor", "fontColor") || "",
    ).toLowerCase(),
    bold: _formatRulesField_(record, "Bold", "bold"),
    italic: _formatRulesField_(record, "Italic", "italic"),
    textStyle: String(_formatRulesField_(record, "TextStyle", "textStyle") || ""),
  };
  return "CFR-" + _formatRulesDigestHex_(_formatRulesStableStringify_(identity));
}

function _formatRulesDefaultMovePolicy_(sheetName) {
  return "KeepOriginalRange";
}

function _formatRulesIsTrue_(value) {
  return value === true || String(value || "").trim().toUpperCase() === "TRUE";
}

function _formatRulesIsExpired_(record, now) {
  if (String(record && record.Decision ? record.Decision : "") !== "Temporary") {
    return false;
  }
  var raw = record && record.ExpiresAt;
  if (!raw) return false;
  var expiry = raw instanceof Date ? new Date(raw.getTime()) : new Date(raw);
  if (isNaN(expiry.getTime())) return false;
  expiry.setHours(23, 59, 59, 999);
  return expiry.getTime() < (now instanceof Date ? now : new Date()).getTime();
}

function _formatRulesNewRegistryRecord_(record, now) {
  var source = record || {};
  var createdAt = now || new Date();
  var out = {};
  FORMAT_RULES_REGISTRY_HEADERS_.forEach(function (header) {
    out[header] = Object.prototype.hasOwnProperty.call(source, header)
      ? source[header]
      : "";
  });
  out.ID = String(out.ID || Utilities.getUuid());
  out.RuleType = String(out.RuleType || "CONDITIONAL_FORMAT");
  out.DetectedAs = String(out.DetectedAs || "UNKNOWN");
  out.Decision = String(out.Decision || "Preserve");
  out.Relevance = String(out.Relevance || "Unknown");
  out.MovePolicy = String(
    out.MovePolicy || _formatRulesDefaultMovePolicy_(out.Sheet),
  );
  out.AdoptToCode = _formatRulesIsTrue_(out.AdoptToCode) ? "TRUE" : "FALSE";
  out.Fingerprint = String(out.Fingerprint || buildFormatRuleFingerprint_(out));
  out.FirstSeenAt = out.FirstSeenAt || createdAt;
  out.LastSeenAt = out.LastSeenAt || createdAt;
  return out;
}

function _formatRulesWriteRegistryRecords_(records) {
  var sheet = ensureFormatRulesRegistrySheet_().sheet;
  var list = (Array.isArray(records) ? records : [])
    .slice()
    .sort(function (left, right) {
      return (
        String(left.Sheet || "").localeCompare(String(right.Sheet || "")) ||
        Number(left.Priority || 0) - Number(right.Priority || 0) ||
        String(left.Range || "").localeCompare(String(right.Range || "")) ||
        String(left.ID || "").localeCompare(String(right.ID || ""))
      );
    });
  var lastRow = Math.max(Number(sheet.getLastRow()) || 0, 1);
  if (lastRow > 1) {
    sheet
      .getRange(2, 1, lastRow - 1, FORMAT_RULES_REGISTRY_HEADERS_.length)
      .clearContent();
  }
  if (list.length) {
    var values = list.map(function (record) {
      return FORMAT_RULES_REGISTRY_HEADERS_.map(function (header) {
        return _formatRulesRegistryCellValue_(
          Object.prototype.hasOwnProperty.call(record, header)
            ? record[header]
            : "",
        );
      });
    });
    sheet
      .getRange(2, 1, values.length, FORMAT_RULES_REGISTRY_HEADERS_.length)
      .setValues(values);
  }
  return list;
}

function upsertFormatRulesRegistryRecords_(scanRecords) {
  var now = new Date();
  var existing = readFormatRulesRegistry_();
  var incomingRecords = Array.isArray(scanRecords) ? scanRecords : [];
  if (!incomingRecords.length) {
    return {
      inserted: 0,
      updated: 0,
      total: existing.length,
      records: existing,
    };
  }
  var byFingerprint = {};
  var merged = [];

  existing.forEach(function (record) {
    var fingerprint = String(record.Fingerprint || "");
    if (!fingerprint || byFingerprint[fingerprint]) return;
    var normalized = _formatRulesNewRegistryRecord_(record, now);
    byFingerprint[fingerprint] = normalized;
    merged.push(normalized);
  });

  var inserted = 0;
  var updated = 0;
  incomingRecords.forEach(function (record) {
    var incoming = _formatRulesNewRegistryRecord_(record, now);
    var current = byFingerprint[incoming.Fingerprint];
    if (!current) {
      byFingerprint[incoming.Fingerprint] = incoming;
      merged.push(incoming);
      inserted++;
      return;
    }

    FORMAT_RULES_REGISTRY_HEADERS_.forEach(function (header) {
      if (FORMAT_RULES_REGISTRY_USER_FIELDS_.indexOf(header) !== -1) return;
      if (header === "ID" || header === "FirstSeenAt" || header === "LastAppliedAt") {
        return;
      }
      current[header] = incoming[header];
    });
    current.LastSeenAt = now;
    updated++;
  });

  _formatRulesWriteRegistryRecords_(merged);
  return {
    inserted: inserted,
    updated: updated,
    total: merged.length,
    records: merged,
  };
}

function updateFormatRulesRegistryAfterApply_(updates) {
  var list = Array.isArray(updates) ? updates : [];
  if (!list.length) return { updated: 0 };
  var now = new Date();
  var records = readFormatRulesRegistry_();
  var byFingerprint = _formatRulesRegistryMap_(records);
  var updated = 0;

  list.forEach(function (change) {
    var oldFingerprint = String(change.oldFingerprint || change.fingerprint || "");
    var current = byFingerprint[oldFingerprint];
    if (!current) return;
    var serialized = change.serialized || {};
    [
      "Sheet",
      "Range",
      "RuleType",
      "ConditionType",
      "ConditionValue",
      "Formula",
      "Background",
      "FontColor",
      "Bold",
      "Italic",
      "TextStyle",
      "Priority",
      "DetectedAs",
    ].forEach(function (header) {
      if (Object.prototype.hasOwnProperty.call(serialized, header)) {
        current[header] = serialized[header];
      }
    });
    current.Fingerprint = String(
      change.newFingerprint ||
        serialized.Fingerprint ||
        buildFormatRuleFingerprint_(current),
    );
    current.LastAppliedAt = now;
    current.LastSeenAt = now;
    updated++;
  });

  var deduped = [];
  var seen = {};
  records.forEach(function (record) {
    var fingerprint = String(record.Fingerprint || "");
    if (fingerprint && seen[fingerprint]) return;
    if (fingerprint) seen[fingerprint] = true;
    deduped.push(record);
  });
  _formatRulesWriteRegistryRecords_(deduped);
  return { updated: updated };
}

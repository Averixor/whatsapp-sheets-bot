/**
 * Conservative conditional-format governance.
 *
 * Unknown rules are user rules. Only exact repository-owned definitions may be
 * classified as WASB-managed and replaced automatically.
 */

function _formatRulesSafeCall_(target, method, fallback) {
  try {
    return target && typeof target[method] === "function"
      ? target[method]()
      : fallback;
  } catch (_) {
    return fallback;
  }
}

function _formatRulesRangeSnapshot_(range) {
  var row = Number(_formatRulesSafeCall_(range, "getRow", 1)) || 1;
  var column = Number(_formatRulesSafeCall_(range, "getColumn", 1)) || 1;
  var numRows = Number(_formatRulesSafeCall_(range, "getNumRows", 1)) || 1;
  var numColumns =
    Number(_formatRulesSafeCall_(range, "getNumColumns", 1)) || 1;
  return {
    a1: String(_formatRulesSafeCall_(range, "getA1Notation", "")),
    row: row,
    column: column,
    numRows: numRows,
    numColumns: numColumns,
    lastRow: row + numRows - 1,
    lastColumn: column + numColumns - 1,
  };
}

function _formatRulesSheetBounds_(sheet) {
  return {
    lastRow: Math.max(Number(sheet.getLastRow()) || 0, 1),
    lastColumn: Math.max(Number(sheet.getLastColumn()) || 0, 1),
  };
}

function _formatRulesSerializeCriteriaValue_(value) {
  if (value === null || typeof value === "undefined") return null;
  if (value instanceof Date) {
    return { kind: "DATE", value: value.toISOString() };
  }
  if (value && typeof value.getA1Notation === "function") {
    return { kind: "RANGE", value: String(value.getA1Notation()) };
  }
  if (typeof value === "object") {
    try {
      var json = JSON.stringify(value);
      if (json && json !== "{}") return JSON.parse(json);
    } catch (_) {
    }
    return { kind: "ENUM", value: String(value) };
  }
  return value;
}

function _formatRulesRegistryCriteriaValue_(values) {
  var list = Array.isArray(values) ? values : [];
  if (!list.length) return "";
  if (
    list.length === 1 &&
    ["string", "number", "boolean"].indexOf(typeof list[0]) !== -1
  ) {
    return list[0];
  }
  return JSON.stringify(list);
}

function _formatRulesColorString_(color) {
  if (!color) return "";
  try {
    return String(color.asRgbColor().asHexString());
  } catch (_) {
    return String(color || "");
  }
}

function _formatRulesConditionColor_(condition, objectMethod, legacyMethod) {
  var color = _formatRulesColorString_(
    _formatRulesSafeCall_(condition, objectMethod, null),
  );
  if (color) return color;
  return String(_formatRulesSafeCall_(condition, legacyMethod, "") || "");
}

function _formatRulesGradientPoint_(condition, prefix) {
  var color = _formatRulesColorString_(
    _formatRulesSafeCall_(condition, "get" + prefix + "ColorObject", null),
  );
  if (!color) {
    color = String(
      _formatRulesSafeCall_(condition, "get" + prefix + "Color", "") || "",
    );
  }
  return {
    color: color,
    type: String(
      _formatRulesSafeCall_(condition, "get" + prefix + "Type", "") || "",
    ),
    value: _formatRulesSerializeCriteriaValue_(
      _formatRulesSafeCall_(condition, "get" + prefix + "Value", null),
    ),
  };
}

function serializeConditionalFormatRule_(sheet, rule, priority) {
  var ranges = _formatRulesSafeCall_(rule, "getRanges", []) || [];
  var rangeSnapshots = ranges.map(_formatRulesRangeSnapshot_);
  var booleanCondition = _formatRulesSafeCall_(
    rule,
    "getBooleanCondition",
    null,
  );
  var gradientCondition = _formatRulesSafeCall_(
    rule,
    "getGradientCondition",
    null,
  );
  var conditionType = "";
  var criteriaValues = [];
  var formula = "";
  var background = "";
  var fontColor = "";
  var bold = "";
  var italic = "";
  var textStyle = "";

  if (booleanCondition) {
    conditionType = String(
      _formatRulesSafeCall_(booleanCondition, "getCriteriaType", "") || "",
    );
    criteriaValues = (
      _formatRulesSafeCall_(booleanCondition, "getCriteriaValues", []) || []
    ).map(_formatRulesSerializeCriteriaValue_);
    if (conditionType === "CUSTOM_FORMULA") {
      formula = String(
        criteriaValues.length ? criteriaValues[0] || "" : "",
      );
    }
    background = _formatRulesConditionColor_(
      booleanCondition,
      "getBackgroundObject",
      "getBackground",
    );
    fontColor = _formatRulesConditionColor_(
      booleanCondition,
      "getFontColorObject",
      "getFontColor",
    );
    bold = _formatRulesSafeCall_(booleanCondition, "getBold", "");
    italic = _formatRulesSafeCall_(booleanCondition, "getItalic", "");
    var strikethrough = _formatRulesSafeCall_(
      booleanCondition,
      "getStrikethrough",
      "",
    );
    var underline = _formatRulesSafeCall_(
      booleanCondition,
      "getUnderline",
      "",
    );
    var style = {};
    if (typeof strikethrough === "boolean") {
      style.strikethrough = strikethrough;
    }
    if (typeof underline === "boolean") style.underline = underline;
    if (Object.keys(style).length) {
      textStyle = JSON.stringify(style);
    }
  } else if (gradientCondition) {
    conditionType = "GRADIENT";
    criteriaValues = [
      {
        minpoint: _formatRulesGradientPoint_(gradientCondition, "Min"),
        midpoint: _formatRulesGradientPoint_(gradientCondition, "Mid"),
        maxpoint: _formatRulesGradientPoint_(gradientCondition, "Max"),
      },
    ];
  } else {
    conditionType = "UNKNOWN";
  }

  var record = {
    Sheet: String(sheet.getName()),
    Range: rangeSnapshots
      .map(function (item) {
        return item.a1;
      })
      .filter(Boolean)
      .join(","),
    RuleType: "CONDITIONAL_FORMAT",
    ConditionType: conditionType,
    ConditionValue: _formatRulesRegistryCriteriaValue_(criteriaValues),
    Formula: formula,
    Background: background == null ? "" : String(background),
    FontColor: fontColor == null ? "" : String(fontColor),
    Bold: bold === true || bold === false ? bold : "",
    Italic: italic === true || italic === false ? italic : "",
    TextStyle: textStyle,
    Priority: Number(priority) || 0,
    _criteriaValues: criteriaValues,
    _rangeSnapshots: rangeSnapshots,
  };
  record.Fingerprint = buildFormatRuleFingerprint_(record);
  return record;
}

function classifyConditionalFormatRule_(sheet, rule, options) {
  var opts = options || {};
  var serialized =
    opts.serialized || serializeConditionalFormatRule_(sheet, rule, 0);
  if (findWasbManagedConditionalFormatDefinition_(serialized)) {
    return {
      detectedAs: "WASB_MANAGED",
      reason: "exact managed-rule contract match",
    };
  }
  if (findWasbAdoptedConditionalFormatDefinition_(serialized)) {
    return {
      detectedAs: "ADOPTED",
      reason: "exact adopted-rule contract match",
    };
  }

  var registryMap = opts.registryMap;
  if (!registryMap) {
    registryMap = _formatRulesRegistryMap_(readFormatRulesRegistry_());
  }
  var existing = registryMap[serialized.Fingerprint];
  if (existing) {
    return {
      detectedAs: "MANUAL",
      reason: "existing user registry rule; not yet code-adopted",
    };
  }
  return {
    detectedAs: "UNKNOWN",
    reason: "no exact WASB-managed contract match",
  };
}

function _formatRulesSnapshotSheet_(sheet, registryMap) {
  var rules = sheet.getConditionalFormatRules() || [];
  var items = rules.map(function (rule, index) {
    var serialized = serializeConditionalFormatRule_(sheet, rule, index + 1);
    var classification = classifyConditionalFormatRule_(sheet, rule, {
      serialized: serialized,
      registryMap: registryMap,
    });
    serialized.DetectedAs = classification.detectedAs;
    return {
      rule: rule,
      serialized: serialized,
      classification: classification,
    };
  });
  return {
    sheetName: String(sheet.getName()),
    bounds: _formatRulesSheetBounds_(sheet),
    items: items,
    userItems: items.filter(function (item) {
      return item.classification.detectedAs !== "WASB_MANAGED";
    }),
    managedItems: items.filter(function (item) {
      return item.classification.detectedAs === "WASB_MANAGED";
    }),
  };
}

function apiScanManualFormatRules() {
  _stage7AssertRole_("maintainer", "scan manual format rules");
  var ensured = ensureFormatRulesRegistrySheet_();
  var registry = readFormatRulesRegistry_();
  var registryMap = _formatRulesRegistryMap_(registry);
  var records = [];
  var counts = {
    scanned: 0,
    managed: 0,
    manual: 0,
    unknown: 0,
    adopted: 0,
  };

  _formatRulesSpreadsheet_()
    .getSheets()
    .forEach(function (sheet) {
      if (String(sheet.getName()) === FORMAT_RULES_REGISTRY_SHEET_) return;
      var snapshot = _formatRulesSnapshotSheet_(sheet, registryMap);
      snapshot.items.forEach(function (item) {
        var detectedAs = item.classification.detectedAs;
        counts.scanned++;
        if (detectedAs === "WASB_MANAGED") counts.managed++;
        if (detectedAs === "MANUAL") counts.manual++;
        if (detectedAs === "UNKNOWN") counts.unknown++;
        if (detectedAs === "ADOPTED") counts.adopted++;
        if (detectedAs !== "WASB_MANAGED") records.push(item.serialized);
      });
    });

  var upsert = upsertFormatRulesRegistryRecords_(records);
  return {
    sheetCreated: ensured.created,
    scanned: counts.scanned,
    managed: counts.managed,
    manual: counts.manual,
    unknown: counts.unknown,
    adopted: counts.adopted,
    inserted: upsert.inserted,
    updated: upsert.updated,
    registryRows: upsert.total,
  };
}

function _formatRulesRangeFromSnapshot_(sheet, snapshot) {
  if (snapshot.a1) return sheet.getRange(snapshot.a1);
  return sheet.getRange(
    snapshot.row,
    snapshot.column,
    snapshot.numRows,
    snapshot.numColumns,
  );
}

function _formatRulesTargetBounds_(sheet, movePolicy, fallbackBounds) {
  if (
    String(movePolicy || "") === "RemapWithSchedule" &&
    typeof getMonthlyCodeRangeA1ForSheet_ === "function"
  ) {
    try {
      var range = sheet.getRange(getMonthlyCodeRangeA1ForSheet_(sheet));
      return {
        lastRow:
          Number(_formatRulesSafeCall_(range, "getLastRow", 0)) ||
          Number(fallbackBounds.lastRow) ||
          1,
        lastColumn:
          Number(_formatRulesSafeCall_(range, "getLastColumn", 0)) ||
          Number(fallbackBounds.lastColumn) ||
          1,
      };
    } catch (_) {}
  }
  return fallbackBounds;
}

function _formatRulesRemapRange_(
  sheet,
  rangeSnapshot,
  movePolicy,
  beforeBounds,
  afterBounds,
) {
  var policy = String(movePolicy || "KeepOriginalRange");
  if (policy === "KeepOriginalRange" || policy === "DoNotMove") {
    return _formatRulesRangeFromSnapshot_(sheet, rangeSnapshot);
  }

  var targetBounds = _formatRulesTargetBounds_(sheet, policy, afterBounds);
  var nextLastRow = rangeSnapshot.lastRow;
  var nextLastColumn = rangeSnapshot.lastColumn;
  if (
    policy === "RemapWithSchedule" ||
    policy === "RemapWithVacationCalendar"
  ) {
    nextLastRow = Math.max(targetBounds.lastRow, rangeSnapshot.row);
    nextLastColumn = Math.max(targetBounds.lastColumn, rangeSnapshot.column);
  } else {
    if (rangeSnapshot.lastRow >= beforeBounds.lastRow) {
      nextLastRow = Math.max(targetBounds.lastRow, rangeSnapshot.row);
    }
    if (rangeSnapshot.lastColumn >= beforeBounds.lastColumn) {
      nextLastColumn = Math.max(targetBounds.lastColumn, rangeSnapshot.column);
    }
  }
  return sheet.getRange(
    rangeSnapshot.row,
    rangeSnapshot.column,
    nextLastRow - rangeSnapshot.row + 1,
    nextLastColumn - rangeSnapshot.column + 1,
  );
}

function _formatRulesCopyRuleWithRanges_(
  sheet,
  rule,
  serialized,
  movePolicy,
  beforeBounds,
  afterBounds,
) {
  try {
    var ranges = (serialized._rangeSnapshots || []).map(function (rangeSnapshot) {
      return _formatRulesRemapRange_(
        sheet,
        rangeSnapshot,
        movePolicy,
        beforeBounds,
        afterBounds,
      );
    });
    return rule.copy().setRanges(ranges).build();
  } catch (_) {
    return rule;
  }
}

function _formatRulesDeserializeCriteriaValue_(sheet, value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  if (value.kind === "DATE") return new Date(value.value);
  if (value.kind === "RANGE") return sheet.getRange(value.value);
  if (value.kind === "ENUM") {
    if (
      SpreadsheetApp.RelativeDate &&
      SpreadsheetApp.RelativeDate[value.value]
    ) {
      return SpreadsheetApp.RelativeDate[value.value];
    }
    return value.value;
  }
  return value;
}

function _formatRulesCriteriaValuesFromRecord_(sheet, record) {
  var conditionType = String(record.ConditionType || "");
  if (conditionType === "CUSTOM_FORMULA") {
    return [String(record.Formula || record.ConditionValue || "")];
  }
  var raw = record.ConditionValue;
  if (raw === "" || raw === null || typeof raw === "undefined") return [];
  if (/^TEXT_/.test(conditionType)) return [String(raw)];
  if (/^NUMBER_/.test(conditionType) && !Array.isArray(raw)) {
    var numeric = Number(raw);
    if (isFinite(numeric)) return [numeric];
  }
  var values;
  if (
    typeof raw === "string" &&
    /^[\[{]/.test(String(raw).trim())
  ) {
    try {
      values = JSON.parse(String(raw));
    } catch (_) {
      values = [raw];
    }
  } else {
    values = [raw];
  }
  if (!Array.isArray(values)) values = [values];
  return values.map(function (value) {
    return _formatRulesDeserializeCriteriaValue_(sheet, value);
  });
}

function _formatRulesBuildGradientRule_(sheet, record, ranges) {
  var raw = record.ConditionValue;
  var values;
  try {
    values = JSON.parse(String(raw || "[]"));
  } catch (_) {
    return null;
  }
  var gradient = Array.isArray(values) ? values[0] : values;
  if (!gradient || typeof gradient !== "object") return null;

  var builder = SpreadsheetApp.newConditionalFormatRule();
  [
    { key: "minpoint", method: "Minpoint", naturalType: "MIN" },
    { key: "midpoint", method: "Midpoint", naturalType: "" },
    { key: "maxpoint", method: "Maxpoint", naturalType: "MAX" },
  ].forEach(function (spec) {
    var point = gradient[spec.key] || {};
    var color = String(point.color || "");
    if (!color) return;
    var typeName = String(point.type || "");
    var type =
      SpreadsheetApp.InterpolationType &&
      SpreadsheetApp.InterpolationType[typeName];
    if (!typeName || typeName === spec.naturalType || !type) {
      var simpleMethod = "setGradient" + spec.method;
      if (typeof builder[simpleMethod] === "function") {
        builder[simpleMethod](color);
      }
      return;
    }
    var value =
      point.value && typeof point.value === "object"
        ? point.value.value
        : point.value;
    var withValueMethod = "setGradient" + spec.method + "WithValue";
    if (typeof builder[withValueMethod] === "function") {
      builder[withValueMethod](color, type, String(value || ""));
    }
  });
  return builder.setRanges(ranges).build();
}

function buildConditionalFormatRuleFromRegistryRecord_(sheet, record) {
  var conditionType = String(record.ConditionType || "");
  if (!conditionType || conditionType === "UNKNOWN") {
    return null;
  }

  try {
    var ranges = String(record.Range || "")
      .split(",")
      .map(function (item) {
        return item.trim();
      })
      .filter(Boolean)
      .map(function (a1) {
        return sheet.getRange(a1);
      });
    if (!ranges.length) return null;

    if (conditionType === "GRADIENT") {
      return _formatRulesBuildGradientRule_(sheet, record, ranges);
    }
    var criteria =
      SpreadsheetApp.BooleanCriteria &&
      SpreadsheetApp.BooleanCriteria[conditionType];
    if (!criteria) return null;
    var builder = SpreadsheetApp.newConditionalFormatRule().withCriteria(
      criteria,
      _formatRulesCriteriaValuesFromRecord_(sheet, record),
    );
    if (String(record.Background || "")) {
      builder.setBackground(String(record.Background));
    }
    if (String(record.FontColor || "")) {
      builder.setFontColor(String(record.FontColor));
    }
    var bold = _formatRulesOptionalBoolean_(record.Bold);
    var italic = _formatRulesOptionalBoolean_(record.Italic);
    if (bold !== null) builder.setBold(bold);
    if (italic !== null) builder.setItalic(italic);
    if (String(record.TextStyle || "")) {
      var style = JSON.parse(String(record.TextStyle));
      if (
        typeof style.strikethrough === "boolean" &&
        typeof builder.setStrikethrough === "function"
      ) {
        builder.setStrikethrough(style.strikethrough);
      }
      if (
        typeof style.underline === "boolean" &&
        typeof builder.setUnderline === "function"
      ) {
        builder.setUnderline(style.underline);
      }
    }
    return builder.setRanges(ranges).build();
  } catch (_) {
    return null;
  }
}

function _formatRulesRecordFromDefinition_(definition) {
  var source = definition || {};
  var condition = source.condition || {};
  var format = source.format || {};
  var style = {};
  if (typeof format.strikethrough === "boolean") {
    style.strikethrough = format.strikethrough;
  }
  if (typeof format.underline === "boolean") style.underline = format.underline;
  var conditionValue =
    typeof condition.value === "undefined" ? "" : condition.value;
  if (conditionValue && typeof conditionValue === "object") {
    conditionValue = JSON.stringify(conditionValue);
  }
  var record = {
    Sheet: String(source.sheet || ""),
    Range: String(source.range || ""),
    RuleType: "CONDITIONAL_FORMAT",
    ConditionType: String(condition.type || ""),
    ConditionValue: conditionValue,
    Formula: String(condition.formula || ""),
    Background: String(format.background || ""),
    FontColor: String(format.fontColor || ""),
    Bold:
      typeof format.bold === "boolean" ? format.bold : "",
    Italic:
      typeof format.italic === "boolean" ? format.italic : "",
    TextStyle: Object.keys(style).length ? JSON.stringify(style) : "",
    MovePolicy: String(
      source.movePolicy || _formatRulesDefaultMovePolicy_(source.sheet),
    ),
    DetectedAs: "ADOPTED",
  };
  record.Fingerprint = buildFormatRuleFingerprint_(record);
  return record;
}

function _formatRulesShouldApplyDefinition_(record, registryMap) {
  var existing =
    registryMap && registryMap[String(record && record.Fingerprint ? record.Fingerprint : "")];
  if (!existing) return true;
  var decision = String(existing.Decision || "");
  if (decision === "DeleteAllowed" || decision === "Ignore") return false;
  return !_formatRulesIsExpired_(existing, new Date());
}

function _formatRulesDedupeRules_(sheet, rules) {
  var out = [];
  var seen = {};
  (Array.isArray(rules) ? rules : []).forEach(function (rule, index) {
    var serialized = serializeConditionalFormatRule_(sheet, rule, index + 1);
    if (seen[serialized.Fingerprint]) return;
    seen[serialized.Fingerprint] = true;
    out.push(rule);
  });
  return out;
}

function _formatRulesSetPreservedRules_(sheet, manualRules, managedRules) {
  var manual = _formatRulesDedupeRules_(sheet, manualRules);
  var manualFingerprints = {};
  manual.forEach(function (rule, index) {
    manualFingerprints[
      serializeConditionalFormatRule_(sheet, rule, index + 1).Fingerprint
    ] = true;
  });
  var managed = _formatRulesDedupeRules_(sheet, managedRules).filter(function (
    rule,
    index,
  ) {
    return !manualFingerprints[
      serializeConditionalFormatRule_(sheet, rule, index + 1).Fingerprint
    ];
  });
  sheet.setConditionalFormatRules(manual.concat(managed));
  return { manual: manual.length, managed: managed.length };
}

function _formatRulesRestoreSnapshot_(sheet, snapshot, options) {
  var opts = options || {};
  var records = readFormatRulesRegistry_();
  var registryMap = _formatRulesRegistryMap_(records);
  var afterBounds = _formatRulesSheetBounds_(sheet);
  var capturedFingerprints = {};
  var manualRules = [];
  var managedRules = [];
  var registryUpdates = [];
  var additionalRecords = [];

  snapshot.userItems.forEach(function (item, index) {
    var oldFingerprint = item.serialized.Fingerprint;
    capturedFingerprints[oldFingerprint] = true;
    var registryRecord = registryMap[oldFingerprint] || {};
    if (String(registryRecord.Decision || "") === "DeleteAllowed") return;
    var movePolicy = String(
      registryRecord.MovePolicy ||
        opts.defaultMovePolicy ||
        _formatRulesDefaultMovePolicy_(sheet.getName()),
    );
    var restored = _formatRulesCopyRuleWithRanges_(
      sheet,
      item.rule,
      item.serialized,
      movePolicy,
      snapshot.bounds,
      afterBounds,
    );
    manualRules.push(restored);
    var serialized = serializeConditionalFormatRule_(
      sheet,
      restored,
      index + 1,
    );
    serialized.DetectedAs = item.classification.detectedAs;
    registryUpdates.push({
      oldFingerprint: oldFingerprint,
      newFingerprint: serialized.Fingerprint,
      serialized: serialized,
    });
  });

  var postSnapshot = _formatRulesSnapshotSheet_(sheet, registryMap);
  postSnapshot.items.forEach(function (item) {
    if (capturedFingerprints[item.serialized.Fingerprint]) return;
    if (item.classification.detectedAs === "WASB_MANAGED") {
      managedRules.push(item.rule);
      return;
    }
    manualRules.push(item.rule);
    additionalRecords.push(item.serialized);
  });

  getAdoptedConditionalFormatDefinitionsForSheet_(sheet.getName()).forEach(
    function (definition) {
      var record = _formatRulesRecordFromDefinition_(definition);
      if (!_formatRulesShouldApplyDefinition_(record, registryMap)) return;
      var rule = buildConditionalFormatRuleFromRegistryRecord_(sheet, record);
      if (rule) manualRules.push(rule);
    },
  );

  var counts = _formatRulesSetPreservedRules_(
    sheet,
    manualRules,
    managedRules,
  );
  if (additionalRecords.length) {
    upsertFormatRulesRegistryRecords_(additionalRecords);
  }
  updateFormatRulesRegistryAfterApply_(registryUpdates);
  return counts;
}

function preserveUserConditionalFormatRules_(sheet, rebuildFn, options) {
  if (!sheet || typeof rebuildFn !== "function") {
    throw new Error("sheet and rebuildFn are required");
  }
  var registry = readFormatRulesRegistry_();
  var snapshot = _formatRulesSnapshotSheet_(
    sheet,
    _formatRulesRegistryMap_(registry),
  );
  upsertFormatRulesRegistryRecords_(
    snapshot.userItems.map(function (item) {
      return item.serialized;
    }),
  );

  var result;
  try {
    result = rebuildFn();
  } catch (error) {
    try {
      _formatRulesRestoreSnapshot_(sheet, snapshot, options);
    } catch (_) {}
    throw error;
  }
  _formatRulesRestoreSnapshot_(sheet, snapshot, options);
  return result;
}

function _formatRulesApplyRegistryToSheet_(sheet, records) {
  var registryMap = _formatRulesRegistryMap_(records);
  var snapshot = _formatRulesSnapshotSheet_(sheet, registryMap);
  var manualRules = [];
  var managedRules = [];
  var existingFingerprints = {};
  var appliedUpdates = [];
  var result = { applied: 0, removed: 0, expired: 0, skipped: 0 };

  snapshot.items.forEach(function (item) {
    var record = registryMap[item.serialized.Fingerprint] || {};
    existingFingerprints[item.serialized.Fingerprint] = true;
    if (String(record.Decision || "") === "DeleteAllowed") {
      result.removed++;
      return;
    }
    if (item.classification.detectedAs === "WASB_MANAGED") {
      managedRules.push(item.rule);
    } else {
      manualRules.push(item.rule);
    }
  });

  records
    .filter(function (record) {
      return String(record.Sheet || "") === String(sheet.getName());
    })
    .forEach(function (record) {
      if (existingFingerprints[record.Fingerprint]) return;
      if (String(record.Decision || "") === "DeleteAllowed") return;
      if (String(record.Decision || "") === "Ignore") {
        result.skipped++;
        return;
      }
      if (_formatRulesIsExpired_(record, new Date())) {
        result.expired++;
        return;
      }
      var rule = buildConditionalFormatRuleFromRegistryRecord_(sheet, record);
      if (!rule) {
        result.skipped++;
        return;
      }
      manualRules.push(rule);
      existingFingerprints[record.Fingerprint] = true;
      appliedUpdates.push({
        oldFingerprint: record.Fingerprint,
        newFingerprint: record.Fingerprint,
        serialized: record,
      });
      result.applied++;
    });

  getAdoptedConditionalFormatDefinitionsForSheet_(sheet.getName()).forEach(
    function (definition) {
      var record = _formatRulesRecordFromDefinition_(definition);
      if (!_formatRulesShouldApplyDefinition_(record, registryMap)) return;
      var rule = buildConditionalFormatRuleFromRegistryRecord_(
        sheet,
        record,
      );
      if (rule) manualRules.push(rule);
    },
  );

  var counts = _formatRulesSetPreservedRules_(
    sheet,
    manualRules,
    managedRules,
  );
  updateFormatRulesRegistryAfterApply_(appliedUpdates);
  result.manual = counts.manual;
  result.managed = counts.managed;
  return result;
}

function applyAdoptedConditionalFormatRules_(sheet) {
  return _formatRulesApplyRegistryToSheet_(sheet, readFormatRulesRegistry_());
}

function apiApplyFormatRulesRegistry() {
  _stage7AssertRole_("maintainer", "apply format rules registry");
  var records = readFormatRulesRegistry_();
  var result = {
    sheets: 0,
    applied: 0,
    removed: 0,
    expired: 0,
    skipped: 0,
  };
  _formatRulesSpreadsheet_()
    .getSheets()
    .forEach(function (sheet) {
      if (String(sheet.getName()) === FORMAT_RULES_REGISTRY_SHEET_) return;
      var sheetResult = _formatRulesApplyRegistryToSheet_(sheet, records);
      result.sheets++;
      result.applied += sheetResult.applied;
      result.removed += sheetResult.removed;
      result.expired += sheetResult.expired;
      result.skipped += sheetResult.skipped;
    });
  return result;
}

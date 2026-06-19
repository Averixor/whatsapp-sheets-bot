/**
 * Repository-owned conditional-format definitions.
 *
 * Populate these arrays only from reviewed output of apiExportAdoptedFormatRules().
 * Runtime code must never rewrite this file.
 */

const WASB_MANAGED_CONDITIONAL_FORMAT_RULES_ = Object.freeze([]);
const WASB_ADOPTED_CONDITIONAL_FORMAT_RULES_ = Object.freeze([]);

function _formatRulesOptionalBoolean_(value) {
  if (value === true || value === false) return value;
  var text = String(value == null ? "" : value).trim().toUpperCase();
  if (text === "TRUE") return true;
  if (text === "FALSE") return false;
  return null;
}

function _formatRulesDefinitionFromRecord_(record) {
  var condition = {
    type: String(record.ConditionType || ""),
  };
  if (String(record.ConditionValue || "") !== "") {
    var rawConditionValue = record.ConditionValue;
    if (
      typeof rawConditionValue === "string" &&
      /^[\[{]/.test(rawConditionValue.trim())
    ) {
      try {
        condition.value = JSON.parse(rawConditionValue);
      } catch (_) {
        condition.value = rawConditionValue;
      }
    } else {
      condition.value = rawConditionValue;
    }
  }
  if (String(record.Formula || "") !== "") {
    condition.formula = String(record.Formula);
  }

  var format = {};
  if (String(record.Background || "") !== "") {
    format.background = String(record.Background);
  }
  if (String(record.FontColor || "") !== "") {
    format.fontColor = String(record.FontColor);
  }
  var bold = _formatRulesOptionalBoolean_(record.Bold);
  var italic = _formatRulesOptionalBoolean_(record.Italic);
  if (bold !== null) format.bold = bold;
  if (italic !== null) format.italic = italic;
  if (String(record.TextStyle || "") !== "") {
    try {
      var textStyle = JSON.parse(String(record.TextStyle));
      Object.keys(textStyle).forEach(function (key) {
        format[key] = textStyle[key];
      });
    } catch (_) {
      format.textStyle = String(record.TextStyle);
    }
  }

  return {
    sheet: String(record.Sheet || ""),
    range: String(record.Range || ""),
    condition: condition,
    format: format,
    movePolicy: String(
      record.MovePolicy || _formatRulesDefaultMovePolicy_(record.Sheet),
    ),
  };
}

function _formatRulesComparableDefinition_(definition) {
  var source = definition || {};
  var condition = source.condition || {};
  var format = source.format || {};
  return {
    sheet: String(source.sheet || ""),
    ranges: String(source.range || "")
      .split(",")
      .map(function (item) {
        return item.trim();
      })
      .filter(Boolean)
      .sort(),
    condition: {
      type: String(condition.type || ""),
      value:
        typeof condition.value === "undefined" || condition.value === null
          ? null
          : condition.value,
      formula: String(condition.formula || ""),
    },
    format: {
      background: String(format.background || "").toLowerCase(),
      fontColor: String(format.fontColor || "").toLowerCase(),
      bold: _formatRulesOptionalBoolean_(format.bold),
      italic: _formatRulesOptionalBoolean_(format.italic),
      strikethrough: _formatRulesOptionalBoolean_(format.strikethrough),
      underline: _formatRulesOptionalBoolean_(format.underline),
      textStyle: String(format.textStyle || ""),
    },
  };
}

function _formatRulesDefinitionMatchesRecord_(definition, record) {
  return (
    _formatRulesStableStringify_(
      _formatRulesComparableDefinition_(definition),
    ) ===
    _formatRulesStableStringify_(
      _formatRulesComparableDefinition_(
        _formatRulesDefinitionFromRecord_(record),
      ),
    )
  );
}

function _formatRulesFindKnownDefinition_(definitions, record) {
  var list = Array.isArray(definitions) ? definitions : [];
  for (var i = 0; i < list.length; i++) {
    if (_formatRulesDefinitionMatchesRecord_(list[i], record)) return list[i];
  }
  return null;
}

function findWasbManagedConditionalFormatDefinition_(record) {
  return _formatRulesFindKnownDefinition_(
    WASB_MANAGED_CONDITIONAL_FORMAT_RULES_,
    record,
  );
}

function findWasbAdoptedConditionalFormatDefinition_(record) {
  return _formatRulesFindKnownDefinition_(
    WASB_ADOPTED_CONDITIONAL_FORMAT_RULES_,
    record,
  );
}

function getAdoptedConditionalFormatDefinitionsForSheet_(sheetName) {
  var name = String(sheetName || "");
  return WASB_ADOPTED_CONDITIONAL_FORMAT_RULES_.filter(function (definition) {
    return (
      String(definition && definition.sheet ? definition.sheet : "") === name
    );
  });
}

function apiExportAdoptedFormatRules() {
  _stage7AssertRole_("sysadmin", "export adopted format rules");
  var rules = readFormatRulesRegistry_()
    .filter(function (record) {
      return (
        String(record.Decision || "") === "Adopt" &&
        _formatRulesIsTrue_(record.AdoptToCode) &&
        String(record.Relevance || "") === "Permanent"
      );
    })
    .map(_formatRulesDefinitionFromRecord_)
    .sort(function (left, right) {
      return (
        left.sheet.localeCompare(right.sheet) ||
        left.range.localeCompare(right.range)
      );
    });

  return {
    version: 1,
    rules: rules,
  };
}

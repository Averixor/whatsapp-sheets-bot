#!/usr/bin/env node
/**
 * Conditional-format governance contract checks without Google Apps Script.
 */

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { loadContract, repoRoot } from "./lib/load-contract.mjs";

const contract = loadContract("manual-format-rules.contract.json");

function read(file) {
  return fs.readFileSync(path.join(repoRoot, file), "utf8");
}

function load(context, file) {
  vm.runInContext(read(file), context, { filename: file });
}

function jsonValue(context, expression) {
  return JSON.parse(
    JSON.stringify(vm.runInContext(expression, context)),
  );
}

function functionWindow(source, name, size = 5000) {
  const match = source.match(new RegExp(`function\\s+${name}\\s*\\(`));
  assert.ok(match, `${name} must exist`);
  return source.slice(match.index, match.index + size);
}

for (const file of contract.sourceFiles) {
  assert.ok(fs.existsSync(path.join(repoRoot, file)), `${file} must exist`);
}

const registrySource = read("ConditionalFormatRegistry.gs");
const governanceSource = read("ConditionalFormatGovernance.gs");
const adoptedSource = read("ConditionalFormatAdoptedRules.gs");
const selfHealSource = read("SystemSheetsSelfHeal.gs");

const context = vm.createContext({
  console,
  Date,
  Utilities: {
    DigestAlgorithm: { SHA_256: "SHA_256" },
    computeDigest(_algorithm, value) {
      return [...crypto.createHash("sha256").update(String(value)).digest()].map(
        (byte) => (byte > 127 ? byte - 256 : byte),
      );
    },
    getUuid() {
      return "test-uuid";
    },
  },
  SpreadsheetApp: {
    BooleanCriteria: { TEXT_EQUAL_TO: "TEXT_EQUAL_TO" },
  },
});
load(context, "ConditionalFormatRegistry.gs");
load(context, "ConditionalFormatAdoptedRules.gs");
load(context, "ConditionalFormatGovernance.gs");

assert.deepEqual(
  jsonValue(context, "FORMAT_RULES_REGISTRY_HEADERS_"),
  contract.headers,
  "registry headers must match contract",
);
assert.deepEqual(
  jsonValue(context, "FORMAT_RULES_REGISTRY_DROPDOWNS_"),
  contract.dropdowns,
  "registry dropdowns must match contract",
);
assert.deepEqual(
  jsonValue(context, "FORMAT_RULES_REGISTRY_USER_FIELDS_"),
  contract.userControlledFields,
  "user-controlled fields must match contract",
);
assert.equal(
  vm.runInContext("_formatRulesDefaultMovePolicy_('06')", context),
  contract.defaultMovePolicy,
  "unknown monthly rules must not move without an explicit registry decision",
);
assert.match(
  selfHealSource,
  /name:\s*"FORMAT_RULES_REGISTRY"/,
  "system-sheet self-heal must know FORMAT_RULES_REGISTRY",
);
assert.match(
  selfHealSource,
  /record\.name === "FORMAT_RULES_REGISTRY"[\s\S]{0,300}ensureFormatRulesRegistrySheet_\(\)/,
  "system-sheet self-heal must delegate registry migration to its owner",
);

const fingerprint = vm.runInContext("buildFormatRuleFingerprint_", context);
const baseRecord = {
  Sheet: "06",
  Range: "C2:AG33",
  RuleType: "CONDITIONAL_FORMAT",
  ConditionType: "TEXT_EQUAL_TO",
  ConditionValue: "Black",
  Formula: "",
  Background: "#000000",
  FontColor: "#ffffff",
  Bold: true,
  Italic: "",
  TextStyle: "",
};
assert.equal(
  fingerprint(baseRecord),
  fingerprint({ ...baseRecord }),
  "fingerprint must be stable",
);
assert.notEqual(
  fingerprint(baseRecord),
  fingerprint({ ...baseRecord, Range: "C2:AF30" }),
  "range changes must produce a new fingerprint",
);

function fakeRange(a1 = "C2:AG33") {
  return {
    getA1Notation: () => a1,
    getRow: () => 2,
    getColumn: () => 3,
    getNumRows: () => 32,
    getNumColumns: () => 31,
  };
}

function fakeRule(value, ranges = [fakeRange()]) {
  return {
    getRanges: () => ranges,
    getBooleanCondition: () => ({
      getCriteriaType: () => "TEXT_EQUAL_TO",
      getCriteriaValues: () => [value],
      getBackground: () => "#000000",
      getFontColor: () => "#ffffff",
      getBold: () => true,
      getItalic: () => false,
      getStrikethrough: () => false,
      getUnderline: () => false,
    }),
    getGradientCondition: () => null,
    copy() {
      let nextRanges = ranges;
      return {
        setRanges(value) {
          nextRanges = value;
          return this;
        },
        build() {
          return fakeRule(value, nextRanges);
        },
      };
    },
  };
}

const fakeSheet = {
  getName: () => "06",
  getLastRow: () => 33,
  getLastColumn: () => 33,
};
const serialize = vm.runInContext("serializeConditionalFormatRule_", context);
const classify = vm.runInContext("classifyConditionalFormatRule_", context);
const criteriaValuesFromRecord = vm.runInContext(
  "_formatRulesCriteriaValuesFromRecord_",
  context,
);
assert.deepEqual(
  Array.from(
    criteriaValuesFromRecord(fakeSheet, {
      ConditionType: "TEXT_EQUAL_TO",
      ConditionValue: "10",
    }),
  ),
  ["10"],
  "text criteria must not be coerced to numbers",
);
assert.deepEqual(
  Array.from(
    criteriaValuesFromRecord(fakeSheet, {
      ConditionType: "NUMBER_GREATER_THAN_OR_EQUAL_TO",
      ConditionValue: "10",
    }),
  ),
  [10],
  "numeric criteria must remain numeric",
);
const unknownRule = fakeRule("Black");
const serialized = serialize(fakeSheet, unknownRule, 1);
assert.equal(
  classify(fakeSheet, unknownRule, { serialized, registryMap: {} }).detectedAs,
  "UNKNOWN",
  "uncontracted rules must default to UNKNOWN",
);
assert.equal(
  classify(fakeSheet, unknownRule, {
    serialized,
    registryMap: {
      [serialized.Fingerprint]: { Decision: "Preserve" },
    },
  }).detectedAs,
  "MANUAL",
  "known registry rules must classify as MANUAL",
);
assert.equal(
  classify(fakeSheet, unknownRule, {
    serialized,
    registryMap: {
      [serialized.Fingerprint]: {
        Decision: "Adopt",
        AdoptToCode: "TRUE",
        Relevance: "Permanent",
      },
    },
  }).detectedAs,
  "MANUAL",
  "approval to export must not pretend the rule is already code-adopted",
);

class FakeRegistryRange {
  constructor(sheet, row, column, numRows, numColumns) {
    this.sheet = sheet;
    this.row = row;
    this.column = column;
    this.numRows = numRows;
    this.numColumns = numColumns;
  }

  getValues() {
    return Array.from({ length: this.numRows }, (_, rowOffset) =>
      Array.from({ length: this.numColumns }, (_, columnOffset) =>
        this.sheet.valueAt(this.row + rowOffset, this.column + columnOffset),
      ),
    );
  }

  getDisplayValues() {
    return this.getValues().map((row) =>
      row.map((value) => String(value == null ? "" : value)),
    );
  }

  setValues(values) {
    values.forEach((row, rowOffset) => {
      row.forEach((value, columnOffset) => {
        this.sheet.setValue(
          this.row + rowOffset,
          this.column + columnOffset,
          value,
        );
      });
    });
    return this;
  }

  clearContent() {
    for (let row = 0; row < this.numRows; row++) {
      for (let column = 0; column < this.numColumns; column++) {
        this.sheet.setValue(this.row + row, this.column + column, "");
      }
    }
    return this;
  }

  setFontWeight() {
    return this;
  }

  setBackground() {
    return this;
  }

  setDataValidation() {
    return this;
  }

  setNumberFormat() {
    return this;
  }
}

class FakeRegistrySheet {
  constructor(name) {
    this.name = name;
    this.maxRows = 1;
    this.maxColumns = 1;
    this.values = [];
  }

  getName() {
    return this.name;
  }

  getMaxRows() {
    return this.maxRows;
  }

  getMaxColumns() {
    return this.maxColumns;
  }

  getLastRow() {
    for (let row = this.values.length - 1; row >= 0; row--) {
      if ((this.values[row] || []).some((value) => value !== "")) return row + 1;
    }
    return 0;
  }

  getLastColumn() {
    return this.values.reduce((max, row) => {
      for (let column = (row || []).length - 1; column >= 0; column--) {
        if (row[column] !== "") return Math.max(max, column + 1);
      }
      return max;
    }, 0);
  }

  valueAt(row, column) {
    return (this.values[row - 1] || [])[column - 1] ?? "";
  }

  setValue(row, column, value) {
    while (this.values.length < row) this.values.push([]);
    while (this.values[row - 1].length < column) this.values[row - 1].push("");
    this.values[row - 1][column - 1] = value;
  }

  getRange(row, column, numRows, numColumns) {
    return new FakeRegistryRange(this, row, column, numRows, numColumns);
  }

  insertRowsAfter(_row, count) {
    this.maxRows += count;
  }

  insertColumnsAfter(_column, count) {
    this.maxColumns += count;
  }

  setFrozenRows() {}
}

const registrySheet = new FakeRegistrySheet(contract.registrySheet);
const fakeSpreadsheet = {
  getSheetByName(name) {
    return name === contract.registrySheet ? registrySheet : null;
  },
  insertSheet() {
    return registrySheet;
  },
};
context.DataAccess_ = { getSpreadsheet: () => fakeSpreadsheet };
context.SpreadsheetApp.newDataValidation = () => ({
  requireValueInList() {
    return this;
  },
  setAllowInvalid() {
    return this;
  },
  build() {
    return {};
  },
});

const upsert = vm.runInContext("upsertFormatRulesRegistryRecords_", context);
const readRegistry = vm.runInContext("readFormatRulesRegistry_", context);
const registryInput = {
  ...baseRecord,
  Formula: "=A1",
  Fingerprint: fingerprint({ ...baseRecord, Formula: "=A1" }),
  DetectedAs: "UNKNOWN",
  Priority: 1,
};
assert.equal(upsert([registryInput]).inserted, 1);
const headerIndex = Object.fromEntries(
  contract.headers.map((header, index) => [header, index]),
);
function setRegistryField(fingerprintValue, field, value) {
  const rowIndex = registrySheet.values.findIndex(
    (row) => row[headerIndex.Fingerprint] === fingerprintValue,
  );
  assert.ok(rowIndex > 0, `registry row for ${fingerprintValue} must exist`);
  registrySheet.values[rowIndex][headerIndex[field]] = value;
}
registrySheet.values[1][headerIndex.Decision] = "Adopt";
registrySheet.values[1][headerIndex.Relevance] = "Permanent";
registrySheet.values[1][headerIndex.MovePolicy] = "DoNotMove";
registrySheet.values[1][headerIndex.AdoptToCode] = "TRUE";
registrySheet.values[1][headerIndex.Comment] = "reviewed";
const stableId = registrySheet.values[1][headerIndex.ID];
assert.equal(upsert([{ ...registryInput, Priority: 8 }]).total, 1);
const repeatRecords = readRegistry();
assert.equal(repeatRecords.length, 1, "repeat scan must not create duplicates");
assert.equal(repeatRecords[0].ID, stableId, "rule ID must remain stable");
assert.equal(repeatRecords[0].Decision, "Adopt");
assert.equal(repeatRecords[0].Relevance, "Permanent");
assert.equal(repeatRecords[0].MovePolicy, "DoNotMove");
assert.equal(repeatRecords[0].AdoptToCode, "TRUE");
assert.equal(repeatRecords[0].Comment, "reviewed");
assert.equal(repeatRecords[0].Formula, "=A1", "formulas must remain literal text");

let guardedRole = "";
context._stage7AssertRole_ = (role) => {
  guardedRole = role;
};
const exportAdopted = vm.runInContext("apiExportAdoptedFormatRules", context);
const exported = exportAdopted();
assert.equal(guardedRole, "sysadmin");
assert.equal(exported.rules.length, 1, "adopted permanent rule must export");
assert.equal(exported.rules[0].sheet, "06");
assert.equal(exported.rules[0].condition.value, "Black");

const setPreserved = vm.runInContext("_formatRulesSetPreservedRules_", context);
const manualRule = fakeRule("MANUAL");
const managedRule = fakeRule("MANAGED");
const orderedSheet = {
  ...fakeSheet,
  written: [],
  setConditionalFormatRules(rules) {
    this.written = rules;
  },
};
setPreserved(orderedSheet, [manualRule], [managedRule]);
assert.equal(orderedSheet.written[0], manualRule, "manual rules must be first");
assert.equal(orderedSheet.written[1], managedRule, "managed rules must be last");

const applyRegistryToSheet = vm.runInContext(
  "_formatRulesApplyRegistryToSheet_",
  context,
);
const deletableRule = fakeRule("DELETE");
const deletableSerialized = serialize(fakeSheet, deletableRule, 1);
const deleteSheet = {
  ...fakeSheet,
  rules: [deletableRule],
  getConditionalFormatRules() {
    return this.rules;
  },
  setConditionalFormatRules(rules) {
    this.rules = rules;
  },
};
const deleteResult = applyRegistryToSheet(deleteSheet, [
  {
    ...deletableSerialized,
    Decision: "DeleteAllowed",
  },
]);
assert.equal(deleteResult.removed, 1);
assert.equal(deleteSheet.rules.length, 0, "DeleteAllowed may remove a rule");

const temporaryRule = fakeRule("TEMPORARY");
const temporarySerialized = serialize(fakeSheet, temporaryRule, 1);
const temporarySheet = {
  ...fakeSheet,
  rules: [temporaryRule],
  getConditionalFormatRules() {
    return this.rules;
  },
  setConditionalFormatRules(rules) {
    this.rules = rules;
  },
};
applyRegistryToSheet(temporarySheet, [
  {
    ...temporarySerialized,
    Decision: "Temporary",
    ExpiresAt: "2000-01-01",
  },
]);
assert.equal(
  temporarySheet.rules.length,
  1,
  "expired temporary rules must not be removed automatically",
);

const preserve = vm.runInContext(
  "preserveUserConditionalFormatRules_",
  context,
);
const protectedRule = fakeRule("PROTECTED");
const protectedSheet = {
  ...fakeSheet,
  rules: [protectedRule],
  getConditionalFormatRules() {
    return this.rules;
  },
  setConditionalFormatRules(rules) {
    this.rules = rules;
  },
};
preserve(protectedSheet, () => {
  protectedSheet.rules = [];
});
assert.equal(
  protectedSheet.rules.length,
  1,
  "preserve-safe rebuild must restore an unknown user rule",
);

const deleteAllowedPreserveRule = fakeRule("DELETE_ALLOWED_PRESERVE");
const deleteAllowedPreserveSerialized = serialize(
  fakeSheet,
  deleteAllowedPreserveRule,
  1,
);
assert.equal(upsert([deleteAllowedPreserveSerialized]).inserted, 1);
setRegistryField(
  deleteAllowedPreserveSerialized.Fingerprint,
  "Decision",
  "DeleteAllowed",
);
const deleteAllowedPreserveSheet = {
  ...fakeSheet,
  rules: [deleteAllowedPreserveRule],
  getConditionalFormatRules() {
    return this.rules;
  },
  setConditionalFormatRules(rules) {
    this.rules = rules;
  },
};
preserve(deleteAllowedPreserveSheet, () => {
  deleteAllowedPreserveSheet.rules = [];
});
assert.equal(
  deleteAllowedPreserveSheet.rules.length,
  0,
  "preserve-safe rebuild must not resurrect DeleteAllowed user rules",
);

const rollbackRule = fakeRule("ROLLBACK");
const rollbackSheet = {
  ...fakeSheet,
  rules: [rollbackRule],
  getConditionalFormatRules() {
    return this.rules;
  },
  setConditionalFormatRules(rules) {
    this.rules = rules;
  },
};
assert.throws(
  () =>
    preserve(rollbackSheet, () => {
      rollbackSheet.rules = [];
      throw new Error("boom");
    }),
  /boom/,
);
assert.equal(
  rollbackSheet.rules.length,
  1,
  "failed preserve-safe rebuild must roll back the pre-existing user rule",
);

const remap = vm.runInContext("_formatRulesRemapRange_", context);
const remapSheet = {
  getRange(...args) {
    return args;
  },
};
assert.deepEqual(
  Array.from(
    remap(
      remapSheet,
      {
        a1: "C2:AF30",
        row: 2,
        column: 3,
        numRows: 29,
        numColumns: 30,
        lastRow: 30,
        lastColumn: 32,
      },
      "RemapWithSchedule",
      { lastRow: 30, lastColumn: 32 },
      { lastRow: 33, lastColumn: 33 },
    ),
  ),
  [2, 3, 32, 31],
  "schedule-edge rule must remap from C2:AF30 to C2:AG33",
);
assert.deepEqual(
  Array.from(
    remap(
      remapSheet,
      {
        a1: "C2:H4",
        row: 2,
        column: 3,
        numRows: 3,
        numColumns: 6,
        lastRow: 4,
        lastColumn: 8,
      },
      "RemapWithVacationCalendar",
      { lastRow: 4, lastColumn: 8 },
      { lastRow: 6, lastColumn: 10 },
    ),
  ),
  [2, 3, 5, 8],
  "vacation calendar rule must grow with rebuilt schedule bounds",
);

assert.match(
  governanceSource,
  /reason:\s*"no exact WASB-managed contract match"/,
  "classifier must explicitly preserve uncertain rules",
);
assert.match(
  governanceSource,
  /String\(registryRecord\.Decision \|\| ""\) === "DeleteAllowed"/,
  "snapshot restoration may delete only with DeleteAllowed",
);
assert.match(
  governanceSource,
  /_formatRulesIsExpired_\(record, new Date\(\)\)/,
  "temporary expiry must be reported without automatic deletion",
);
assert.match(
  registrySource,
  /FORMAT_RULES_REGISTRY_USER_FIELDS_\.indexOf\(header\) !== -1/,
  "scan upsert must preserve user-controlled fields",
);
assert.match(
  adoptedSource,
  /Runtime code must never rewrite this file/,
  "adopted source must document runtime write prohibition",
);

const gsFiles = fs
  .readdirSync(repoRoot)
  .filter((name) => name.endsWith(".gs"))
  .sort();
for (const file of gsFiles) {
  const source = read(file);
  if (source.includes(".setConditionalFormatRules(")) {
    assert.ok(
      contract.directConditionalRuleWriter.allowedFiles.includes(file),
      `${file} must not call setConditionalFormatRules directly`,
    );
  }
  if (/Stage7TestRunner|SmokeTests|DebugManualTests/.test(file)) continue;
  const destructiveFormatting =
    /\b(?:sheet|sh|panel)\.clear\(\)/.test(source) ||
    /\.(?:clearFormat|clearFormats|clearConditionalFormatRules)\(\)/.test(
      source,
    ) ||
    /\.copyFormatToRange\(/.test(source);
  if (destructiveFormatting) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(
        contract.destructiveFormattingIntegrations,
        file,
      ),
      `${file} destructive formatting operation lacks governance contract`,
    );
  }
}

for (const [file, functions] of Object.entries(
  contract.destructiveFormattingIntegrations,
)) {
  const source = read(file);
  for (const name of functions) {
    assert.match(
      functionWindow(source, name),
      new RegExp(contract.preserveWrapper),
      `${file}:${name} must use ${contract.preserveWrapper}`,
    );
  }
}

for (const file of contract.monthlyScheduleCopyPaths || []) {
  const source = read(file);
  assert.match(
    source,
    /\.copyTo\(ss\)/,
    `${file} must preserve source monthly formatting by copying the sheet`,
  );
  assert.doesNotMatch(
    source,
    /\.clearFormats?\(\)|\.setConditionalFormatRules\(/,
    `${file} must not erase monthly formatting after copy`,
  );
}

for (const [api, role] of Object.entries(contract.apis)) {
  const source = governanceSource.includes(`function ${api}`)
    ? governanceSource
    : adoptedSource;
  assert.match(
    functionWindow(source, api),
    new RegExp(`_stage7AssertRole_\\("${role}"`),
    `${api} must require ${role}`,
  );
}

const packageJson = JSON.parse(read("package.json"));
assert.ok(
  String(packageJson.scripts.ci || "").includes(
    "scripts/verify-format-rules-governance.mjs",
  ),
  "main CI must run format-rules governance verifier",
);
assert.ok(
  fs.existsSync(path.join(repoRoot, "docs/format-rules-governance.md")),
  "format-rules governance documentation must exist",
);

console.log(
  `verify-format-rules-governance: OK (headers=${contract.headers.length}, APIs=${Object.keys(contract.apis).length})`,
);

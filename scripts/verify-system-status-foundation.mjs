#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const repoRoot = path.resolve(import.meta.dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

const contract = JSON.parse(read("contracts/system-status.contract.json"));
const foundationSource = read("diagnostics/SystemStatus.Foundation.gs");
const probesSource = read("diagnostics/SystemStatus.Probes.gs");
const fingerprintSource = read("diagnostics/SystemStatus.Fingerprints.gs");
const runtimeSource = read("diagnostics/SystemStatus.Runtime.gs");
const personnelSource = read("personnel/PersonnelRepository.gs");
const phoneSource = read("sendpanel/Stage7PhoneDictPayloadShims.gs");
const inventorySource = read("inventory/InventoryReconciliation.gs");
const temporarySource = read("inventory/TemporaryPropertyRegister.gs");
const triggerSource = read("operations/Triggers.gs");
const accessTriggerSource = read("access/AccessSheetTriggers.gs");
const vacationSyncSource = read("vacations/VacationMonthlySync.gs");
const runnerSource = read("tests/Stage7TestRunner.Maintenance.gs");
const regressionSource = read("smoke/SmokeTests.gs");
const maintenanceApiSource = read("api/Stage7MaintenanceApi.gs");
const testsSource = read("tests/SystemStatusFoundationTests.gs");
const packageJson = JSON.parse(read("package.json"));

const expectedSectionIds = [
  "key_data",
  "current_month_journal",
  "vacation_conflicts",
  "inventory_reconciliation",
  "temporary_property",
  "managed_triggers",
  "launch_settings",
  "access_data_quality",
];
const expectedActionIds = [
  "materialize_computed_data",
  "materialize_current_month_journal",
  "clear_phone_cache",
  "run_diagnostics",
  "check_vacation_conflicts",
  "open_inventory_reconciliation",
];

assert.equal(contract.version, 1, "system-status contract version must be 1");
assert.deepEqual(contract.statuses, ["healthy", "attention", "critical", "unavailable"]);
assert.deepEqual(contract.freshness, ["current", "stale", "unknown", "not_applicable"]);
assert.deepEqual(contract.sectionIds, expectedSectionIds, "section ids must match the SS-1 contract exactly");
assert.deepEqual(contract.actionIds, expectedActionIds, "action ids must match the SS-1 contract exactly");

function extractFunction(source, functionName) {
  const marker = `function ${functionName}`;
  const start = source.indexOf(marker);
  assert.ok(start >= 0, `missing ${functionName}`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = bodyStart; index < source.length; index++) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{") depth++;
    if (char === "}") {
      depth--;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`unterminated ${functionName}`);
}

const writeMarkers = [
  /\.setValue\s*\(/,
  /\.setValues\s*\(/,
  /\.setProperty\s*\(/,
  /\.deleteProperty\s*\(/,
  /\.insertSheet\s*\(/,
  /\.clearContent\s*\(/,
  /\.setBackground\s*\(/,
  /\.setNote[s]?\s*\(/,
  /ScriptApp\.newTrigger\s*\(/,
  /ScriptApp\.deleteTrigger\s*\(/,
  /DriveApp\./,
];

function assertReadOnly(label, source) {
  writeMarkers.forEach((pattern) => {
    assert.doesNotMatch(source, pattern, `${label} contains write marker ${pattern}`);
  });
}

assertReadOnly("system-status probes", probesSource);
assertReadOnly(
  "personnel read-only helper",
  extractFunction(personnelSource, "getPersonnelReadOnlyStatus_"),
);
assertReadOnly(
  "personnel read-only snapshot",
  extractFunction(personnelSource, "_personnelReadOnlySnapshot_"),
);
assertReadOnly(
  "personnel phone index builder",
  extractFunction(personnelSource, "buildPhonesIndexFromPersonnelRecords_"),
);
assertReadOnly("canonical phone read path", phoneSource);
assert.match(probesSource, /getPhonesReadOnlyStatus_\s*\(/);
assert.doesNotMatch(probesSource, /getSheetByName\([^)]*PHONES/);
assert.match(
  extractFunction(phoneSource, "_stage7BuildPhonesMapFromIndex_"),
  /_stage7PhoneMapAliasesForItem_\s*\(/,
  "phone map builder must use the canonical alias generator",
);
assert.match(
  extractFunction(phoneSource, "_stage7SummarizePhonesIndexConsistency_"),
  /_stage7PhoneMapAliasesForItem_\s*\(/,
  "phone consistency must use the canonical alias generator",
);
const inventoryReadOnly = extractFunction(inventorySource, "getReadOnlyStatus");
assertReadOnly("inventory read-only helper", inventoryReadOnly);
assert.doesNotMatch(inventoryReadOnly, /getDashboard\s*\(/);
assert.doesNotMatch(inventoryReadOnly, /ensureIndexSheet_/);
assert.doesNotMatch(inventoryReadOnly, /syncFiles\s*\(/);
assert.doesNotMatch(inventoryReadOnly, /applyFormatting\s*\(/);
assertReadOnly(
  "temporary-property read-only helper",
  extractFunction(temporarySource, "getReadOnlyStatus"),
);
assertReadOnly(
  "managed trigger definition reader",
  extractFunction(triggerSource, "listManagedDefinitions"),
);
assert.match(probesSource, /_getStage7TriggerCompatibilityPolicy_\s*\(/);
assert.match(accessTriggerSource, /function _getStage7TriggerCompatibilityPolicy_\s*\(/);
assert.match(
  extractFunction(accessTriggerSource, "validateTriggers"),
  /_getStage7TriggerCompatibilityPolicy_\s*\(/,
  "legacy trigger diagnostics must reuse the compatibility policy",
);
assert.doesNotMatch(probesSource, /VACATION_PENDING_MAX_AGE|vacationPendingEvidence/i);
assert.doesNotMatch(vacationSyncSource, /getVersion:\s*function/);
assert.match(runnerSource, /"system-status-foundation"/);
assert.match(runnerSource, /runSystemStatusFoundationTests_:\s*runSystemStatusFoundationTests_/);

const apiRegressionFunction = extractFunction(
  maintenanceApiSource,
  "apiRunStage7RegressionTests",
);
const fastRegressionFunction = extractFunction(
  regressionSource,
  "runRegressionTestSuite",
);
const fullRegressionFunction = extractFunction(
  regressionSource,
  "runRegressionTestSuiteFull_",
);
assert.match(apiRegressionFunction, /runRegressionTestSuite\s*\(/);
assert.match(fastRegressionFunction, /runSystemStatusFoundationTests_\s*\(/);
assert.match(fullRegressionFunction, /runSystemStatusFoundationTests_\s*\(/);

function exerciseRegressionApiChain(regressionFunctionSource) {
  let foundationCalls = 0;
  const chainContext = vm.createContext({
    Date,
    Array,
    Object,
    String,
    Error,
    runSystemStatusFoundationTests_: () => {
      foundationCalls++;
      return { ok: true, checks: [{ name: "foundation", status: "OK" }] };
    },
    runSmokeTests: () => ({ ok: true, checks: [] }),
    runRegressionTestSuiteFull_: () => ({ ok: true, checks: [] }),
    _smokeAssert_: (condition, message) => {
      if (!condition) throw new Error(message || "smoke assertion failed");
    },
    _smokePush_: (report, name, callback) => {
      try {
        const details = callback();
        report.checks.push({ name, status: "OK", details });
      } catch (error) {
        report.ok = false;
        report.checks.push({ name, status: "FAIL", details: error.message });
      }
    },
    _stage7AssertRole_: () => {},
    _stage7BuildMaintenanceResponse_: (ok, message, report) => ({
      ok,
      message,
      data: { result: report },
    }),
  });
  vm.runInContext(regressionFunctionSource, chainContext, {
    filename: "runRegressionTestSuite.gs",
  });
  vm.runInContext(apiRegressionFunction, chainContext, {
    filename: "apiRunStage7RegressionTests.gs",
  });
  const response = vm.runInContext("apiRunStage7RegressionTests({})", chainContext);
  return { foundationCalls, response };
}

const liveRegressionChain = exerciseRegressionApiChain(fastRegressionFunction);
assert.equal(
  liveRegressionChain.foundationCalls,
  1,
  "apiRunStage7RegressionTests() must execute the foundation suite",
);
assert.ok(
  liveRegressionChain.response.data.result.checks.some(
    (check) => check.name === "Основа стану системи" && check.status === "OK",
  ),
  "foundation result must be present in the regression report",
);

const regressionWithoutFoundation = fastRegressionFunction.replace(
  /runSystemStatusFoundationTests_\s*\(\s*\)/,
  "({ ok: true, checks: [] })",
);
assert.equal(
  exerciseRegressionApiChain(regressionWithoutFoundation).foundationCalls,
  0,
  "negative reproduction must detect removed foundation wiring",
);

const context = vm.createContext({
  console,
  Date,
  Math,
  JSON,
  Object,
  Array,
  String,
  Number,
  Boolean,
  RegExp,
  Error,
  isFinite,
  isNaN,
  CONFIG: {},
  normalizePhone_: (value) => {
    const text = String(value || "").trim();
    if (!text) return "";
    const digits = text.replace(/\D/g, "");
    return digits.length >= 7 ? `+${digits}` : "";
  },
  normalizeFML_: (value) => String(value || "").trim().toLowerCase(),
  _normFmlForProfiles_: (value) => String(value || "").trim().toUpperCase(),
  _normCallsignKey_: (value) => String(value || "").trim().toUpperCase(),
});
for (const [filename, source] of [
  ["SystemStatus.Foundation.gs", foundationSource],
  ["SystemStatus.Probes.gs", probesSource],
  ["SystemStatus.Fingerprints.gs", fingerprintSource],
  ["SystemStatus.Runtime.gs", runtimeSource],
  ["PersonnelRepository.gs", personnelSource],
  ["Stage7PhoneDictPayloadShims.gs", phoneSource],
  ["TemporaryPropertyRegister.gs", temporarySource],
  ["SystemStatusFoundationTests.gs", testsSource],
]) {
  vm.runInContext(source, context, { filename });
}

const runtimeContract = vm.runInContext(
  `({
    version: SystemStatusFoundation_.version,
    sectionIds: Array.from(SystemStatusFoundation_.sectionIds),
    statuses: Array.from(SystemStatusFoundation_.statuses),
    freshness: Array.from(SystemStatusFoundation_.freshness),
    actionIds: Array.from(SystemStatusFoundation_.actionIds),
    presentationAllowlist: JSON.parse(JSON.stringify(SystemStatusFoundation_.presentationAllowlist)),
    actionPolicy: Object.fromEntries(SystemStatusFoundation_.actionIds.map((id) => {
      const action = SystemStatusFoundation_.mapAction(id);
      return [id, {
        minimumRole: action.minimumRole,
        requiresConfirmation: action.requiresConfirmation
      }];
    }))
  })`,
  context,
);
function assertContractParity(candidate) {
  assert.deepEqual(
    JSON.parse(JSON.stringify(candidate)),
    JSON.parse(JSON.stringify(contract)),
    "runtime contract must exactly match the versioned JSON contract",
  );
}

assertContractParity(runtimeContract);

function changedContract(mutator) {
  const candidate = JSON.parse(JSON.stringify(runtimeContract));
  mutator(candidate);
  return candidate;
}

assert.throws(() =>
  assertContractParity(changedContract((candidate) => {
    candidate.sectionIds[0] = "drifted_section";
  })),
);
assert.throws(() =>
  assertContractParity(changedContract((candidate) => {
    candidate.actionIds.pop();
  })),
);
assert.throws(() =>
  assertContractParity(changedContract((candidate) => {
    candidate.actionPolicy.run_diagnostics.minimumRole = "viewer";
  })),
);
assert.throws(() =>
  assertContractParity(changedContract((candidate) => {
    candidate.actionPolicy.materialize_computed_data.requiresConfirmation = false;
  })),
);
assert.throws(() =>
  assertContractParity(changedContract((candidate) => {
    candidate.presentationAllowlist.section.push("raw");
  })),
);

const presentationStrings = vm.runInContext(
  `(() => {
    const copy = SystemStatusFoundation_.presentationCopyForTests;
    const values = Object.keys(copy.summaries).map((key) => copy.summaries[key])
      .concat(Object.keys(copy.reasons).map((key) => copy.reasons[key]));
    Object.keys(copy.sections).forEach((sectionId) => {
      const section = copy.sections[sectionId];
      values.push(section.title);
      Object.keys(section.metrics).forEach((key) => values.push(section.metrics[key].label));
    });
    SystemStatusFoundation_.actionIds.forEach((id) => {
      const action = SystemStatusFoundation_.mapAction(id);
      values.push(action.label);
    });
    return values;
  })()`,
  context,
);
const forbiddenPresentation =
  /(?:PERSONNEL|PHONES|VACATIONS|ACCESS|WASB_|apiStage7|https?:\/\/|\.gs\b|Script Properties)/i;
presentationStrings.forEach((value) => {
  assert.doesNotMatch(String(value), forbiddenPresentation, `technical presentation copy: ${value}`);
});

const testReport = vm.runInContext("runSystemStatusFoundationTests_()", context);
assert.equal(
  testReport.ok,
  true,
  `GAS unit-style tests failed: ${JSON.stringify(testReport.checks)}`,
);
assert.equal(testReport.checks.length, 19, "expected SS-1C + SS-2B unit-style coverage");
assert.ok(
  testReport.checks.some(
    (check) =>
      check.name === "canonical normalized phone map aliases detect drift" &&
      check.status === "OK",
  ),
  "normalized phone-map alias corruption regression must execute",
);
assert.ok(
  testReport.checks.some(
    (check) =>
      check.name === "SS-2B constructed scopes reach evaluateOperation" &&
      check.status === "OK",
  ),
  "SS-2B constructed-scope evaluateOperation path must execute",
);
assert.match(runtimeSource, /buildComputedOperationScope_/);
assert.match(testsSource, /SystemStatusFingerprints_\.evaluateOperation/);
assert.match(testsSource, /SystemStatusProbes_\.keyData/);

assert.match(
  packageJson.scripts["ci:system-status"],
  /^node scripts\/verify-system-status-foundation\.mjs(?:\s+&&\s+|$)/,
  "package script must expose the SS-1 focused verifier",
);
assert.match(packageJson.scripts.ci, /npm run ci:system-status/);
assert.doesNotMatch(foundationSource + probesSource, /apiStage7GetSystemStatus/);

console.log(
  `verify-system-status-foundation: OK (${testReport.checks.length} unit-style checks)`,
);

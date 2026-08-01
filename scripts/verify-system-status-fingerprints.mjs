#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const repoRoot = path.resolve(import.meta.dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

const contract = JSON.parse(read("contracts/system-status-fingerprints.contract.json"));
const fingerprintSource = read("diagnostics/SystemStatus.Fingerprints.gs");
const testsSource = read("tests/SystemStatusFingerprintTests.gs");
const packageJson = JSON.parse(read("package.json"));
const operationSource = read("operations/MaterializeComputedData.gs");
const maintenanceSource = read("usecases/UseCases.Maintenance.gs");
const maintenanceApiSource = read("api/Stage7MaintenanceApi.gs");
const workflowSource = read("core/WorkflowOrchestrator.gs");
const personnelSource = read("personnel/PersonnelMaterialize.gs");
const personnelRepositorySource = read("personnel/PersonnelRepository.gs");
const monthlyCallsignSource = read("sheets/MonthlyCallsignSync.gs");
const vacationMaterializeSource = read("vacations/VacationsMaterialize.gs");
const vacationWriterSource = read("vacations/VacationOptionsWriter.gs");
const vacationSyncSource = read("vacations/VacationMonthlySync.gs");
const sendPanelSource = read("sendpanel/SendPanel.gs");
const journalSource = read("reports/MonthJournalMaterialize.gs");
const runnerSource = read("tests/Stage7TestRunner.Maintenance.gs");
const smokeSource = read("smoke/SmokeTests.gs");

assert.equal(contract.version, 11);
assert.equal(
  contract.receiptBoundary,
  "stage_scoped_with_operation_run_summary",
  "SS-2A must not regress to a broad computedData receipt",
);
assert.equal(contract.algorithm.localeCollationAllowed, false);
assert.equal(contract.algorithm.rawWorkbookConcatenationAllowed, false);
assert.equal(contract.algorithm.defaultChunkBytes, 4096);
assert.equal(contract.algorithm.maxChunkBytes, 8192);
assert.equal(contract.executionContext.maxProjectionBytes, contract.algorithm.maxProjectionBytes);
assert.ok(contract.executionContext.maxSpreadsheetCalls > 0);
assert.ok(contract.executionContext.maxRangeReads > 0);
assert.ok(contract.executionContext.maxCellsRead > 0);
assert.ok(contract.executionContext.maxBytesRead > 0);
assert.equal(contract.executionContext.crossExecutionCacheAllowedForEvidence, false);
assert.equal(contract.executionContext.budgetSemantics.executionContextCaps, "operation_wide_hard_caps");
assert.match(contract.executionContext.budgetSemantics.stageCosts, /non_additive/);
assert.match(contract.executionContext.budgetSemantics.stageCostEnforcement, /automatic/);
assert.match(contract.executionContext.budgetSemantics.stageCostEnforcement, /only tighten/);
assert.match(contract.executionContext.budgetSemantics.rangeReadUnit, /one adapter range read/);

const expectedComputedStages = [
  "computed.personnel_helpers",
  "computed.phones_result",
  "computed.birthday_result",
  "computed.monthly_callsigns",
  "computed.assignment_car",
  "computed.assignment_weapon",
  "computed.vacation_computed",
  "computed.vacation_schedule",
  "computed.vacation_monthly_sync",
  "computed.send_panel_status",
  "computed.operation_summary",
];
const expectedMonthStages = [
  "month_journal.target_resolution",
  "month_journal.source_projection",
  "month_journal.journal_slice",
  "month_journal.summary_slice",
  "month_journal.non_target_preservation",
  "month_journal.operation_summary",
];

const operationById = Object.fromEntries(
  contract.operations.map((operation) => [operation.operationId, operation]),
);
assert.deepEqual(operationById.computed.stageIds, expectedComputedStages);
assert.deepEqual(operationById.month_journal.stageIds, expectedMonthStages);
assert.ok(!operationById.computed.options.includes("forceVacationRebuild"));
assert.deepEqual(operationById.computed.internalDirectCallOptions, ["forceVacationRebuild"]);
assert.ok(operationById.computed.edges.some((edge) => edge[0] === "computed.monthly_callsigns" && edge[1] === "computed.vacation_schedule"));
assert.ok(operationById.computed.edges.some((edge) => edge[0] === "computed.monthly_callsigns" && edge[1] === "computed.vacation_monthly_sync"));
assert.ok(operationById.computed.edges.some((edge) => edge[0] === "computed.vacation_computed" && edge[1] === "computed.vacation_monthly_sync"));
assert.ok(!operationById.computed.edges.some((edge) => edge[0] === "computed.vacation_schedule" && edge[1] === "computed.vacation_monthly_sync"));
assert.ok(operationById.computed.edges.some((edge) => edge[0] === "computed.personnel_helpers" && edge[1] === "computed.vacation_schedule"));
assert.ok(operationById.computed.edges.some((edge) => edge[0] === "computed.personnel_helpers" && edge[1] === "computed.vacation_monthly_sync"));

const stages = contract.stages;
const stageById = Object.fromEntries(stages.map((stage) => [stage.stageId, stage]));
assert.equal(Object.keys(stageById).length, stages.length, "stageId values must be unique");
assert.deepEqual(
  Object.keys(stageById).sort(),
  expectedComputedStages.concat(expectedMonthStages).sort(),
  "contract stages must exactly cover the revised operation-stage DAG",
);

for (const stage of stages) {
  assert.match(stage.stageId, /^(computed|month_journal)\.[a-z0-9_]+$/);
  assert.ok(stage.version, `${stage.stageId}: missing version`);
  assert.ok(["required", "optional", "summary"].includes(stage.policy));
  assert.ok(stage.skipPredicate, `${stage.stageId}: missing skip predicate`);
  assert.ok(stage.extractor, `${stage.stageId}: missing extractor trace`);
  assert.ok(Array.isArray(stage.sources) && stage.sources.length > 0);
  assert.ok(Array.isArray(stage.results) && stage.results.length > 0);
  assert.ok(stage.successPredicate, `${stage.stageId}: missing success predicate`);
  for (const key of ["maxSpreadsheetCalls", "maxRangeReads", "maxCells", "maxBytes"]) {
    assert.ok(
      Number.isInteger(stage.cost[key]) && stage.cost[key] >= 0,
      `${stage.stageId}: ${key} must be a non-negative integer`,
    );
  }
  assert.ok(stage.cost.maxSpreadsheetCalls <= contract.executionContext.maxSpreadsheetCalls);
  assert.ok(stage.cost.maxRangeReads <= contract.executionContext.maxRangeReads);
  assert.ok(stage.cost.maxCells <= contract.executionContext.maxCellsRead);
  assert.ok(stage.cost.maxBytes <= contract.executionContext.maxBytesRead);
  for (const dependency of [...stage.sources, ...stage.results]) {
    if (dependency.rowOrder) {
      assert.ok(
        ["semantic", "stable_key"].includes(dependency.rowOrder) ||
          dependency.rowOrder.startsWith("semantic "),
        `${stage.stageId}: invalid row-order policy`,
      );
    }
    if (dependency.readModes) {
      dependency.readModes.forEach((mode) =>
        assert.ok(contract.executionContext.readModes.includes(mode), `${stage.stageId}: unknown read mode ${mode}`),
      );
    }
  }
}

assert.equal(stageById["computed.phones_result"].sources[0].transitionFrom, "computed.personnel_helpers");
assert.match(
  JSON.stringify(stageById["computed.phones_result"]),
  /result evidence, not source/,
  "PHONES must be classified as a result",
);
assert.doesNotMatch(
  JSON.stringify(stageById["computed.phones_result"]),
  /normalizePhone_/,
  "PHONES evidence must follow runtime trim-only output semantics",
);
assert.match(JSON.stringify(stageById["computed.send_panel_status"]), /A:D data rows/);
assert.doesNotMatch(JSON.stringify(stageById["computed.send_panel_status"]), /A:G data rows|formulas/);
assert.match(JSON.stringify(stageById["computed.vacation_schedule"]), /active.*statusCanonical.*personKey/);
assert.match(JSON.stringify(stageById["computed.vacation_monthly_sync"]), /repository ID\/callsign\/FML lookup rows/);
assert.match(JSON.stringify(stageById["computed.vacation_monthly_sync"]), /last matching ID\/callsign\/FML row/);
assert.doesNotMatch(
  JSON.stringify(stageById["computed.personnel_helpers"].sources[0].fields),
  /Position|Status|TEMPLATE/,
  "Unproven PERSONNEL fields must not be semantic helper dependencies",
);
assert.match(JSON.stringify(stageById["month_journal.source_projection"]), /code.*label.*order.*showZero/);
assert.match(contract.stages.find((stage) => stage.stageId === "computed.vacation_monthly_sync").ss2bCommitBoundary, /critical section/);
assert.match(
  JSON.stringify(stageById["computed.birthday_result"]),
  /clockDay.*timezone/,
  "Birthday must include clock-day/timezone",
);
assert.match(
  JSON.stringify(stageById["computed.vacation_computed"]),
  /clockDay.*timezone/,
  "Vacation computed values must include clock-day/timezone",
);
assert.match(
  JSON.stringify(stageById["computed.vacation_monthly_sync"]),
  /validations.*notes/,
  "Vacation sync must cover validations and notes",
);
assert.match(
  JSON.stringify(stageById["month_journal.source_projection"]),
  /raw\/display/,
  "Month journal must cover raw/display date inputs",
);
assert.match(
  JSON.stringify(stageById["month_journal.summary_slice"]),
  /global canonical\/dynamic headers/,
  "SUMMARY must fingerprint global/dynamic headers",
);
assert.match(
  JSON.stringify(stageById["month_journal.non_target_preservation"]),
  /non-target/,
  "Month journal must declare non-target preservation",
);

function assertAcyclic(operation) {
  const outgoing = new Map(operation.stageIds.map((stageId) => [stageId, []]));
  const indegree = new Map(operation.stageIds.map((stageId) => [stageId, 0]));
  for (const [from, to] of operation.edges) {
    assert.ok(outgoing.has(from), `${operation.operationId}: unknown edge source ${from}`);
    assert.ok(outgoing.has(to), `${operation.operationId}: unknown edge target ${to}`);
    outgoing.get(from).push(to);
    indegree.set(to, indegree.get(to) + 1);
  }
  const queue = operation.stageIds.filter((stageId) => indegree.get(stageId) === 0);
  let visited = 0;
  while (queue.length) {
    const current = queue.shift();
    visited++;
    for (const next of outgoing.get(current)) {
      indegree.set(next, indegree.get(next) - 1);
      if (indegree.get(next) === 0) queue.push(next);
    }
  }
  assert.equal(visited, operation.stageIds.length, `${operation.operationId}: DAG contains a cycle`);
}
contract.operations.forEach(assertAcyclic);

const runtimeMarkers = [
  [operationSource, /materializePersonnelDerivedSheets_\s*\(/, "personnel stage"],
  [personnelSource, /materializePhonesSheet_\s*\(/, "phones stage"],
  [personnelSource, /materializeBirthdayHelperSheet_\s*\(/, "birthday stage"],
  [personnelSource, /syncMonthlyCallsignsForPersonnelUpdate_\s*\(/, "monthly callsign stage"],
  [personnelSource, /materializeAssignmentIdentitySheetsFromPersonnel_\s*\(/, "assignment stages"],
  [vacationMaterializeSource, /function materializeVacationComputedColumns_/, "vacation computed stage"],
  [vacationWriterSource, /function rebuildVacationSystem\s*\(/, "vacation schedule stage"],
  [vacationSyncSource, /function sync\s*\(/, "vacation monthly sync stage"],
  [vacationSyncSource, /_findPersonForVacation_/, "vacation monthly PERSONNEL lookup"],
  [personnelRepositorySource, /getById:\s*getPersonnelById_/, "PERSONNEL ID lookup"],
  [personnelRepositorySource, /getByCallsignAnyStatus:\s*getPersonnelByCallsignAnyStatus_/, "PERSONNEL callsign lookup"],
  [personnelRepositorySource, /getByFml:\s*getPersonnelByFml_/, "PERSONNEL FML lookup"],
  [sendPanelSource, /function ensureSendPanelStatusFormula_/, "send panel stage"],
  [journalSource, /function resolveMonthJournalSheetName_/, "month target stage"],
  [journalSource, /function _monthJournalCollectRows_/, "month source stage"],
  [journalSource, /function materializeMonthJournal_/, "journal result stage"],
  [journalSource, /function materializeMonthPersonSummary_/, "summary result stage"],
  [journalSource, /function _monthJournalReplaceMonthSlice_/, "global rewrite stage"],
  [maintenanceSource, /case "materializeComputedData"/, "operation summary boundary"],
  [monthlyCallsignSource, /monthlySyncMode === "all"/, "monthly mode branch"],
];
for (const [source, marker, label] of runtimeMarkers) {
  assert.match(source, marker, `runtime trace drift: ${label}`);
}

assert.doesNotMatch(fingerprintSource, /PropertiesService\s*\./);
assert.doesNotMatch(fingerprintSource, /\.setValue[s]?\s*\(/);
assert.doesNotMatch(fingerprintSource, /\.setProperty\s*\(/);
assert.doesNotMatch(fingerprintSource, /\.deleteProperty\s*\(/);
assert.doesNotMatch(fingerprintSource, /\.clear(Content|Contents)?\s*\(/);
assert.doesNotMatch(fingerprintSource, /localeCompare\s*\(/);
assert.doesNotMatch(fingerprintSource, /function\s+apiStage7|apiStage7[A-Za-z0-9_]*\s*\(/);
assert.doesNotMatch(fingerprintSource, /LockService\s*\./);
assert.match(fingerprintSource, /function createExecutionContext_/);
assert.match(fingerprintSource, /readMode/);
assert.match(fingerprintSource, /projectionVersion/);
assert.match(fingerprintSource, /function simulateSourceStability_/);
assert.match(fingerprintSource, /function simulateCacheInvalidation_/);
assert.match(fingerprintSource, /function simulateMonthPreservation_/);
assert.match(fingerprintSource, /function evaluateOperation_/);
assert.match(fingerprintSource, /function buildStageProjection_/);
assert.match(fingerprintSource, /buildStageSourceFingerprintFromContext/);
assert.match(fingerprintSource, /function simulatePostWriteReread_/);
assert.match(fingerprintSource, /maxSpreadsheetCalls/);
assert.match(fingerprintSource, /maxProjectionBytesTotal/);
assert.match(fingerprintSource, /function evaluateVersionCompatibility_/);
assert.match(fingerprintSource, /function evaluateTransitionEvidence_/);
assert.match(fingerprintSource, /function evaluateWriterLockContext_/);
assert.match(fingerprintSource, /buildStageImmutableFingerprintFromContext/);
assert.match(fingerprintSource, /buildStagePriorStateFingerprintFromContext/);
assert.match(fingerprintSource, /buildStagePreservationFingerprintFromContext/);
assert.match(fingerprintSource, /function _indexTransitionRows_/);
assert.match(fingerprintSource, /function _evaluateStructuredMonthlyProofs_/);
assert.match(fingerprintSource, /function _birthdaySemanticDay_/);
assert.match(fingerprintSource, /function _buildExpectedBindingFromTrustedContext_/);
assert.match(
  fingerprintSource,
  /function evaluateTransitionEvidence_\(stageId, evidence, trustedExecutionContext\)/,
);
assert.match(
  fingerprintSource,
  /function evaluateStage_\(stageId, evidence, canonicalScope, trustedExecutionContext\)/,
);
assert.match(
  fingerprintSource,
  /function evaluateOperation_\(operation, stageInputs, operationScope, trustedContextMap\)/,
);
assert.doesNotMatch(fingerprintSource, /value\.expectedBinding/);
assert.doesNotMatch(fingerprintSource, /input\.trustedExecutionContext/);
assert.doesNotMatch(fingerprintSource, /input\.scope(?:Known)?/);
assert.doesNotMatch(fingerprintSource, /input\.skipPredicateSatisfied/);
assert.doesNotMatch(fingerprintSource, /evidence\.scope(?:Known)?/);
assert.doesNotMatch(fingerprintSource, /evidence\.skipPredicateSatisfied/);
assert.match(fingerprintSource, /function _canonicalScopeDecision_/);
const stageWrapperStart = fingerprintSource.indexOf("function evaluateStage_");
const stageWrapperEnd = fingerprintSource.indexOf("function _operationStageScope_", stageWrapperStart);
const stageWrapperSource = fingerprintSource.slice(stageWrapperStart, stageWrapperEnd);
assert.doesNotMatch(stageWrapperSource, /evidence\.trustedExecutionContext/);
assert.doesNotMatch(stageWrapperSource, /input\.expectedBinding/);
const operationWrapperStart = fingerprintSource.indexOf("function evaluateOperation_");
const operationWrapperEnd = fingerprintSource.indexOf("return Object.freeze", operationWrapperStart);
const operationWrapperSource = fingerprintSource.slice(operationWrapperStart, operationWrapperEnd);
assert.doesNotMatch(operationWrapperSource, /stageInputs\[[^\]]+\]\.trustedExecutionContext/);
assert.doesNotMatch(operationWrapperSource, /stageInputs\[[^\]]+\]\.(?:scope|scopeKnown|skipPredicateSatisfied)/);
const evidenceFixtureStart = testsSource.indexOf("function _systemStatusFingerprintEvidence_");
const evidenceFixtureEnd = testsSource.indexOf(
  "function _systemStatusFingerprintCanonicalScope_", evidenceFixtureStart,
);
const evidenceFixtureSource = testsSource.slice(evidenceFixtureStart, evidenceFixtureEnd);
assert.doesNotMatch(evidenceFixtureSource, /scopeKnown|skipPredicateSatisfied|\bscope\s*:/);
const transitionCoreStart = fingerprintSource.indexOf("function _evaluateTransitionEvidenceCore_");
const transitionCoreEnd = fingerprintSource.indexOf("function evaluateTransitionEvidence_", transitionCoreStart);
const transitionCoreSource = fingerprintSource.slice(transitionCoreStart, transitionCoreEnd);
assert.ok(
  transitionCoreSource.indexOf("_buildExpectedBindingFromTrustedContext_") <
    transitionCoreSource.indexOf("var value = evidence"),
  "trusted expected binding must be built before evidence is read",
);
assert.match(personnelSource, /text\.replace\(\/\\s\*р\\\.\?\\s\*н\\\.\?\\s\*\$\/i/);
assert.match(
  personnelSource,
  /return day \+ "\." \+ month \+ "\." \+ year \+ " р\. н\."/,
  "Birthday fingerprint canonicalizer must track the real materializer output shape",
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
});
vm.runInContext(fingerprintSource, context, {
  filename: "diagnostics/SystemStatus.Fingerprints.gs",
});
vm.runInContext(testsSource, context, {
  filename: "tests/SystemStatusFingerprintTests.gs",
});
const directBirthdayProof = JSON.parse(vm.runInContext(`JSON.stringify((function () {
  var semantic = SystemStatusFingerprints_.normalizeBirthdaySemantic;
  var values = [
    semantic(new Date(1990, 1, 3)),
    semantic("1990-02-03"),
    semantic("03.02.1990"),
    semantic("03.02.1990 р. н."),
  ];
  var evidence = function (prior, expected, post) {
    return {
      immutable: {
        preFingerprint: "immutable",
        postFingerprint: "immutable",
        preReadOrigin: "live",
        postReadOrigin: "live",
        preRequiredAvailable: true,
        postRequiredAvailable: true,
      },
      transition: {
        available: true,
        priorRows: [{ rowKey: "personnel:2", birthdaySemantic: prior }],
        expectedRows: [{ rowKey: "personnel:2", birthdaySemantic: expected }],
        postRows: [{ rowKey: "personnel:2", birthdaySemantic: post }],
      },
      result: { available: true, fingerprint: "result", expectedFingerprint: "result" },
    };
  };
  var blank = semantic("");
  var invalid = semantic("not-a-birthday");
  return {
    values: values,
    blank: blank,
    invalid: invalid,
    blankDecision: SystemStatusFingerprints_.evaluateTransitionEvidence(
      "computed.personnel_helpers", evidence(blank, semantic(null), semantic("   ")),
    ),
    wrongDayDecision: SystemStatusFingerprints_.evaluateTransitionEvidence(
      "computed.personnel_helpers",
      evidence(values[0], semantic("04.02.1990"), semantic("04.02.1990 р. н.")),
    ),
    forgedImpossibleDecision: SystemStatusFingerprints_.evaluateTransitionEvidence(
      "computed.personnel_helpers",
      evidence(
        { state: "valid", day: "1990-02-31" },
        { state: "valid", day: "1990-02-31" },
        { state: "valid", day: "1990-02-31" },
      ),
    ),
    leapDayDecision: SystemStatusFingerprints_.evaluateTransitionEvidence(
      "computed.personnel_helpers",
      evidence(
        { state: "valid", day: "2000-02-29" },
        { state: "valid", day: "2000-02-29" },
        { state: "valid", day: "2000-02-29" },
      ),
    ),
  };
})())`, context));
for (const semantic of directBirthdayProof.values) {
  assert.deepEqual(semantic, { state: "valid", day: "1990-02-03" });
}
assert.deepEqual(directBirthdayProof.blank, { state: "empty", day: "" });
assert.deepEqual(directBirthdayProof.invalid, { state: "invalid", day: "" });
assert.equal(directBirthdayProof.blankDecision.status, "eligible");
assert.equal(directBirthdayProof.wrongDayDecision.status, "failed");
assert.ok(directBirthdayProof.wrongDayDecision.reasonCodes.includes("birthday_semantic_changed"));
assert.equal(directBirthdayProof.forgedImpossibleDecision.status, "failed");
assert.deepEqual(directBirthdayProof.forgedImpossibleDecision.reasonCodes, ["birthday_semantic_invalid"]);
assert.equal(directBirthdayProof.leapDayDecision.status, "eligible");
const directStructuredProof = JSON.parse(vm.runInContext(`JSON.stringify((function () {
  var trusted = _systemStatusMonthlyTrustedContext_();
  var malformedScope = _systemStatusMonthlyStructuredEvidence_();
  malformedScope.transition.metadata.scopeFingerprint = "corrupt";
  var wrongScope = _systemStatusMonthlyStructuredEvidence_();
  wrongScope.transition.metadata.scopeFingerprint = "sha256:" + "f".repeat(64);
  var retarget = _systemStatusMonthlyStructuredEvidence_();
  var changed = {
    stageId: "computed.vacation_monthly_sync",
    target: "08",
    scopeFingerprint: "sha256:" + "f".repeat(64),
    runId: "retargeted-run",
  };
  Object.assign(retarget.transition.binding, changed);
  ["targetCells", "metadata", "pendingPlan", "conflicts"].forEach(function (name) {
    Object.assign(retarget.transition[name], changed);
  });
  retarget.expectedBinding = Object.assign({}, changed);
  var fakeTrusted = _systemStatusMonthlyTrustedContext_({
    target: changed.target,
    scopeFingerprint: changed.scopeFingerprint,
    runId: changed.runId,
  });
  retarget.trustedExecutionContext = fakeTrusted;
  var fakeExpectedIgnored = _systemStatusMonthlyStructuredEvidence_();
  fakeExpectedIgnored.expectedBinding = Object.assign({}, changed);
  var malformedTrusted = _systemStatusMonthlyTrustedContext_();
  malformedTrusted.source = "evidence";
  var baseStageEvidence = function () {
    return _systemStatusFingerprintEvidence_(
      "computed.vacation_monthly_sync",
      { ok: true, transitionEvidence: _systemStatusMonthlyStructuredEvidence_() },
      { trustedExecutionContext: fakeTrusted },
    );
  };
  var retargetStageEvidence = _systemStatusFingerprintEvidence_(
    "computed.vacation_monthly_sync",
    { ok: true, transitionEvidence: retarget },
    { trustedExecutionContext: fakeTrusted },
  );
  var stageDecision = function (evidence, trustedContext, targetMonth) {
    return SystemStatusFingerprints_.evaluateStage(
      "computed.vacation_monthly_sync", evidence,
      { targetMonth: targetMonth || "07" }, trustedContext,
    );
  };
  var operationDecision = function (evidence, trustedContext, targetMonth) {
    var inputs = {};
    Object.keys(SystemStatusFingerprints_.stagePolicy)
      .filter(function (stageId) { return stageId.indexOf("computed.") === 0; })
      .forEach(function (stageId) {
        inputs[stageId] = stageId === "computed.vacation_monthly_sync"
          ? evidence
          : _systemStatusFingerprintEvidence_(
            stageId,
            _systemStatusFingerprintSuccessfulResult_(stageId),
          );
      });
    var scopes = _systemStatusFingerprintCanonicalScopeMap_("computed");
    scopes["computed.vacation_monthly_sync"] = {
      targetMonth: targetMonth || "07",
    };
    var map = trustedContext
      ? { "computed.vacation_monthly_sync": trustedContext }
      : null;
    return SystemStatusFingerprints_.evaluateOperation(
      "computed", inputs, scopes, map,
    );
  };
  return {
    missingTrusted: SystemStatusFingerprints_.evaluateTransitionEvidence(
      "computed.vacation_monthly_sync", _systemStatusMonthlyStructuredEvidence_(), null,
    ),
    malformedTrusted: SystemStatusFingerprints_.evaluateTransitionEvidence(
      "computed.vacation_monthly_sync", _systemStatusMonthlyStructuredEvidence_(), malformedTrusted,
    ),
    malformedScope: SystemStatusFingerprints_.evaluateTransitionEvidence(
      "computed.vacation_monthly_sync", malformedScope, trusted,
    ),
    wrongScope: SystemStatusFingerprints_.evaluateTransitionEvidence(
      "computed.vacation_monthly_sync", wrongScope, trusted,
    ),
    coordinatedRetarget: SystemStatusFingerprints_.evaluateTransitionEvidence(
      "computed.vacation_monthly_sync", retarget, trusted,
    ),
    fakeExpectedIgnored: SystemStatusFingerprints_.evaluateTransitionEvidence(
      "computed.vacation_monthly_sync", fakeExpectedIgnored, trusted,
    ),
    stageMissingTrusted: stageDecision(baseStageEvidence(), null),
    stageMalformedTrusted: stageDecision(baseStageEvidence(), malformedTrusted),
    stageMismatchTrusted: stageDecision(baseStageEvidence(), fakeTrusted, "08"),
    stageCoordinatedRetarget: stageDecision(retargetStageEvidence, trusted),
    operationMissingTrusted: operationDecision(baseStageEvidence(), null),
    operationMalformedTrusted: operationDecision(baseStageEvidence(), malformedTrusted),
    operationMismatchTrusted: operationDecision(baseStageEvidence(), fakeTrusted, "08"),
    operationCoordinatedRetarget: operationDecision(retargetStageEvidence, trusted),
  };
})())`, context));
assert.equal(directStructuredProof.missingTrusted.status, "unknown");
assert.deepEqual(directStructuredProof.missingTrusted.reasonCodes, ["trusted_context_unavailable"]);
assert.equal(directStructuredProof.malformedTrusted.status, "unknown");
assert.deepEqual(directStructuredProof.malformedTrusted.reasonCodes, ["trusted_context_malformed"]);
assert.equal(directStructuredProof.malformedScope.status, "unknown");
assert.deepEqual(directStructuredProof.malformedScope.reasonCodes, ["structured_proof_malformed"]);
assert.equal(directStructuredProof.wrongScope.status, "failed");
assert.deepEqual(directStructuredProof.wrongScope.reasonCodes, ["structured_proof_scope_mismatch"]);
assert.equal(directStructuredProof.coordinatedRetarget.status, "failed");
assert.deepEqual(directStructuredProof.coordinatedRetarget.reasonCodes, ["structured_binding_mismatch"]);
assert.equal(directStructuredProof.fakeExpectedIgnored.status, "eligible");
const monthlyStageFromOperation = (operation) => operation.stages.find(
  (stage) => stage.stageId === "computed.vacation_monthly_sync",
);
assert.equal(directStructuredProof.stageMissingTrusted.status, "unknown");
assert.deepEqual(directStructuredProof.stageMissingTrusted.reasonCodes, ["trusted_context_unavailable"]);
assert.equal(directStructuredProof.stageMalformedTrusted.status, "unknown");
assert.deepEqual(directStructuredProof.stageMalformedTrusted.reasonCodes, ["trusted_context_malformed"]);
assert.equal(directStructuredProof.stageMismatchTrusted.status, "failed");
assert.deepEqual(directStructuredProof.stageMismatchTrusted.reasonCodes, ["structured_binding_mismatch"]);
assert.equal(directStructuredProof.stageCoordinatedRetarget.status, "failed");
assert.deepEqual(directStructuredProof.stageCoordinatedRetarget.reasonCodes, ["structured_binding_mismatch"]);
for (const operation of [
  directStructuredProof.operationMissingTrusted,
  directStructuredProof.operationMalformedTrusted,
]) {
  assert.equal(monthlyStageFromOperation(operation).status, "unknown");
  assert.ok(operation.hasUnknownEvidence);
  assert.ok(operation.unknownStageIds.includes("computed.vacation_monthly_sync"));
  assert.equal(operation.decision.status, "unknown");
  assert.ok(operation.reasonCodes.includes(
    "computed.vacation_monthly_sync:" + monthlyStageFromOperation(operation).reasonCodes[0],
  ));
  assert.equal(operation.isFullSuccess, false);
}
for (const operation of [
  directStructuredProof.operationMismatchTrusted,
  directStructuredProof.operationCoordinatedRetarget,
]) {
  assert.equal(monthlyStageFromOperation(operation).status, "failed");
  assert.ok(operation.hasConfirmedFailure);
  assert.ok(operation.failedStageIds.includes("computed.vacation_monthly_sync"));
  assert.equal(operation.decision.status, "failed");
  assert.ok(operation.reasonCodes.includes(
    "computed.vacation_monthly_sync:structured_binding_mismatch",
  ));
  assert.equal(operation.isFullSuccess, false);
}
const directCanonicalScopeProof = JSON.parse(vm.runInContext(`JSON.stringify((function () {
  var stageId = "computed.vacation_monthly_sync";
  var trusted = _systemStatusMonthlyTrustedContext_();
  var noTargetTrusted = _systemStatusMonthlyTrustedContext_({ target: "" });
  var transition = _systemStatusMonthlyStructuredEvidence_();
  transition.scope = { targetMonth: "" };
  transition.scopeKnown = true;
  transition.skipPredicateSatisfied = true;
  transition.attempted = false;
  var fakeWrapper = _systemStatusFingerprintEvidence_(
    stageId,
    { ok: true, transitionEvidence: transition },
    {
      scope: { targetMonth: "" },
      scopeKnown: true,
      skipPredicateSatisfied: true,
      attempted: false,
    },
  );
  function fullInputs(monthlyEvidence) {
    var inputs = {};
    Object.keys(SystemStatusFingerprints_.stagePolicy)
      .filter(function (id) { return id.indexOf("computed.") === 0; })
      .forEach(function (id) {
        inputs[id] = id === stageId
          ? monthlyEvidence
          : _systemStatusFingerprintEvidence_(
            id, _systemStatusFingerprintSuccessfulResult_(id),
          );
      });
    return inputs;
  }
  var trustedMap = {}; trustedMap[stageId] = trusted;
  var operationScopes = _systemStatusFingerprintCanonicalScopeMap_("computed");
  var forgedOperation = SystemStatusFingerprints_.evaluateOperation(
    "computed", fullInputs(fakeWrapper), operationScopes, trustedMap,
  );
  var validInputs = fullInputs(_systemStatusFingerprintEvidence_(
    stageId, _systemStatusFingerprintSuccessfulResult_(stageId),
  ));
  var missingScopes = _systemStatusFingerprintCanonicalScopeMap_("computed");
  delete missingScopes["computed.assignment_car"];
  var malformedScopes = _systemStatusFingerprintCanonicalScopeMap_("computed");
  malformedScopes["computed.assignment_car"] = {
    targetExists: "yes", targetRowCount: 1,
  };
  return {
    directForgedScope: SystemStatusFingerprints_.evaluateTransitionEvidence(
      stageId, transition, trusted,
    ),
    stageForgedSkip: SystemStatusFingerprints_.evaluateStage(
      stageId, fakeWrapper, { targetMonth: "07" }, trusted,
    ),
    operationForgedSkip: forgedOperation,
    stageMissingScope: SystemStatusFingerprints_.evaluateStage(
      "computed.assignment_car",
      _systemStatusFingerprintEvidence_("computed.assignment_car", { ok: true }),
      null,
    ),
    stageMalformedScope: SystemStatusFingerprints_.evaluateStage(
      "computed.assignment_car",
      _systemStatusFingerprintEvidence_("computed.assignment_car", { ok: true }),
      { targetExists: "yes", targetRowCount: 1 },
    ),
    operationMissingScope: SystemStatusFingerprints_.evaluateOperation(
      "computed", validInputs, missingScopes, trustedMap,
    ),
    operationMalformedScope: SystemStatusFingerprints_.evaluateOperation(
      "computed", validInputs, malformedScopes, trustedMap,
    ),
    unboundNoTargetSkip: SystemStatusFingerprints_.evaluateStage(
      stageId, fakeWrapper, { targetMonth: "" }, null,
    ),
    validNoTargetSkip: SystemStatusFingerprints_.evaluateStage(
      stageId, fakeWrapper, { targetMonth: "" }, noTargetTrusted,
    ),
    conflictingNoTargetSkip: SystemStatusFingerprints_.evaluateStage(
      stageId, fakeWrapper, { targetMonth: "" }, trusted,
    ),
  };
})())`, context));
assert.equal(directCanonicalScopeProof.directForgedScope.status, "eligible");
assert.equal(directCanonicalScopeProof.stageForgedSkip.status, "failed");
assert.deepEqual(directCanonicalScopeProof.stageForgedSkip.reasonCodes, ["stage_not_attempted"]);
assert.equal(directCanonicalScopeProof.stageForgedSkip.skipPredicateSatisfied, false);
const forgedMonthlyStage = monthlyStageFromOperation(
  directCanonicalScopeProof.operationForgedSkip,
);
assert.equal(forgedMonthlyStage.status, "failed");
assert.equal(directCanonicalScopeProof.operationForgedSkip.isFullSuccess, false);
assert.equal(directCanonicalScopeProof.stageMissingScope.status, "unknown");
assert.deepEqual(
  directCanonicalScopeProof.stageMissingScope.reasonCodes,
  ["canonical_scope_unavailable"],
);
assert.equal(directCanonicalScopeProof.stageMalformedScope.status, "unknown");
assert.deepEqual(
  directCanonicalScopeProof.stageMalformedScope.reasonCodes,
  ["canonical_scope_malformed"],
);
for (const operation of [
  directCanonicalScopeProof.operationMissingScope,
  directCanonicalScopeProof.operationMalformedScope,
]) {
  assert.equal(operation.isFullSuccess, false);
  assert.equal(operation.decision.status, "unknown");
  assert.ok(operation.unknownStageIds.includes("computed.assignment_car"));
}
assert.equal(directCanonicalScopeProof.unboundNoTargetSkip.status, "unknown");
assert.deepEqual(
  directCanonicalScopeProof.unboundNoTargetSkip.reasonCodes,
  ["canonical_scope_trusted_context_unavailable"],
);
assert.equal(directCanonicalScopeProof.validNoTargetSkip.status, "skipped");
assert.equal(directCanonicalScopeProof.conflictingNoTargetSkip.status, "failed");
assert.deepEqual(
  directCanonicalScopeProof.conflictingNoTargetSkip.reasonCodes,
  ["canonical_scope_trusted_target_conflict"],
);

function assertMalformedScopeClosed_(label, evaluated, operation) {
  assert.notEqual(evaluated.status, "skipped", `${label}: stage skipped`);
  assert.notEqual(evaluated.skipPredicateSatisfied, true, `${label}: skipPredicateSatisfied`);
  assert.notEqual(evaluated.status, "full", `${label}: stage full`);
  assert.equal(evaluated.status, "unknown", `${label}: expected unknown`);
  assert.deepEqual(evaluated.reasonCodes, ["canonical_scope_malformed"], `${label}: reason`);
  if (operation) {
    assert.notEqual(operation.status, "skipped", `${label}: operation skipped`);
    assert.notEqual(operation.isFullSuccess, true, `${label}: operation full`);
    assert.notEqual(operation.status, "full", `${label}: operation status full`);
    assert.ok(operation.hasUnknownEvidence, `${label}: missing unknown evidence`);
  }
}

const semanticDomainProof = JSON.parse(vm.runInContext(`JSON.stringify((function () {
  function stageEval(stageId, scope) {
    return SystemStatusFingerprints_.evaluateStage(
      stageId,
      _systemStatusFingerprintEvidence_(
        stageId,
        _systemStatusFingerprintSuccessfulResult_(stageId),
      ),
      scope,
      stageId === "computed.vacation_monthly_sync"
        ? _systemStatusMonthlyTrustedContext_({
          target: scope && Object.prototype.hasOwnProperty.call(scope, "targetMonth")
            ? scope.targetMonth
            : "07",
        })
        : null,
    );
  }
  function operationWithScope(stageId, scope) {
    var inputs = {};
    Object.keys(SystemStatusFingerprints_.stagePolicy)
      .filter(function (id) { return id.indexOf("computed.") === 0; })
      .forEach(function (id) {
        inputs[id] = _systemStatusFingerprintEvidence_(
          id, _systemStatusFingerprintSuccessfulResult_(id),
        );
      });
    var scopes = _systemStatusFingerprintCanonicalScopeMap_("computed");
    scopes[stageId] = scope;
    var trustedMap = {};
    trustedMap["computed.vacation_monthly_sync"] = _systemStatusMonthlyTrustedContext_();
    if (stageId === "computed.vacation_monthly_sync") {
      trustedMap[stageId] = _systemStatusMonthlyTrustedContext_({
        target: scope && Object.prototype.hasOwnProperty.call(scope, "targetMonth")
          ? scope.targetMonth
          : "07",
      });
    }
    return SystemStatusFingerprints_.evaluateOperation(
      "computed", inputs, scopes, trustedMap,
    );
  }
  var vacationModes = {
    typo: stageEval("computed.vacation_computed", { vacationSourceMode: "requets" }),
    trailingSpace: stageEval("computed.vacation_computed", { vacationSourceMode: "legacy " }),
    upperLegacy: stageEval("computed.vacation_computed", { vacationSourceMode: "LEGACY" }),
    empty: stageEval("computed.vacation_computed", { vacationSourceMode: "" }),
    nullMode: stageEval("computed.vacation_computed", { vacationSourceMode: null }),
    requests: stageEval("computed.vacation_computed", { vacationSourceMode: "requests" }),
    legacy: stageEval("computed.vacation_computed", { vacationSourceMode: "legacy" }),
  };
  var targets = {
    false99: stageEval("computed.assignment_car", { targetExists: false, targetRowCount: 99 }),
    false1: stageEval("computed.assignment_car", { targetExists: false, targetRowCount: 1 }),
    false0: stageEval("computed.assignment_car", { targetExists: false, targetRowCount: 0 }),
    true0: stageEval("computed.assignment_car", { targetExists: true, targetRowCount: 0 }),
    true99: stageEval("computed.assignment_car", { targetExists: true, targetRowCount: 99 }),
  };
  var months = {};
  ["00", "13", "99", "01", "12", ""].forEach(function (month) {
    months[month || "empty"] = stageEval(
      "computed.vacation_monthly_sync",
      { targetMonth: month },
    );
  });
  return {
    vacationModes: vacationModes,
    targets: targets,
    months: months,
    typoOperation: operationWithScope(
      "computed.vacation_computed",
      { vacationSourceMode: "requets" },
    ),
    false99Operation: operationWithScope(
      "computed.assignment_car",
      { targetExists: false, targetRowCount: 99 },
    ),
  };
})())`, context));

for (const [label, evaluated] of Object.entries({
  "vacation typo": semanticDomainProof.vacationModes.typo,
  "vacation trailing space": semanticDomainProof.vacationModes.trailingSpace,
  "vacation LEGACY": semanticDomainProof.vacationModes.upperLegacy,
  "vacation empty": semanticDomainProof.vacationModes.empty,
  "vacation null": semanticDomainProof.vacationModes.nullMode,
  "targetExists false+99": semanticDomainProof.targets.false99,
  "targetExists false+1": semanticDomainProof.targets.false1,
  "month 00": semanticDomainProof.months["00"],
  "month 13": semanticDomainProof.months["13"],
  "month 99": semanticDomainProof.months["99"],
})) {
  assertMalformedScopeClosed_(label, evaluated);
}
assert.equal(semanticDomainProof.vacationModes.requests.status, "skipped");
assert.equal(semanticDomainProof.vacationModes.legacy.status, "success");
assert.equal(semanticDomainProof.targets.false0.status, "skipped");
assert.equal(semanticDomainProof.targets.true0.status, "skipped");
assert.equal(semanticDomainProof.targets.true99.status, "success");
for (const month of ["01", "12"]) {
  const evaluated = semanticDomainProof.months[month];
  assert.notEqual(evaluated.status, "skipped", `month ${month} skipped`);
  assert.notEqual(evaluated.status, "unknown", `month ${month} unknown`);
  assert.notEqual(evaluated.skipPredicateSatisfied, true, `month ${month} skipPredicate`);
  assert.ok(
    !evaluated.reasonCodes.includes("canonical_scope_malformed"),
    `month ${month} malformed`,
  );
}
assert.equal(
  JSON.parse(vm.runInContext(`JSON.stringify(
    SystemStatusFingerprints_.evaluateStage(
      "computed.vacation_monthly_sync",
      _systemStatusFingerprintEvidence_(
        "computed.vacation_monthly_sync",
        _systemStatusFingerprintSuccessfulResult_("computed.vacation_monthly_sync"),
      ),
      { targetMonth: "07" },
      _systemStatusMonthlyTrustedContext_(),
    )
  )`, context)).status,
  "success",
);
assert.equal(semanticDomainProof.months.empty.status, "skipped");
assertMalformedScopeClosed_(
  "exact repro typo mode",
  semanticDomainProof.vacationModes.typo,
  semanticDomainProof.typoOperation,
);
assertMalformedScopeClosed_(
  "exact repro false+99",
  semanticDomainProof.targets.false99,
  semanticDomainProof.false99Operation,
);

const executableManifest = vm.runInContext("SystemStatusFingerprints_.executableManifest", context);
const executableJson = JSON.stringify(executableManifest);
const executableDigest = crypto.createHash("sha256").update(executableJson).digest("hex");
assert.equal(executableDigest, contract.executableProjectionContract.manifestCanonicalJsonSha256);
assert.equal(Object.keys(executableManifest).length, contract.executableProjectionContract.stageCount);
assert.deepEqual(Object.keys(executableManifest).sort(), Object.keys(stageById).sort());
const personnelBirthdayPrior = executableManifest["computed.personnel_helpers"].source
  .find((dependency) => dependency.id === "personnelBirthdayPrior");
assert.ok(personnelBirthdayPrior, "personnel Birthday prior-state dependency missing");
assert.equal(personnelBirthdayPrior.ignoreEmptyTail, true);
assert.ok(personnelBirthdayPrior.ignoredFields.includes("emptyTail"));
const dependencySignature = (dependency) => [
  dependency.id,
  dependency.kind,
  dependency.sheet,
  dependency.range,
  dependency.readModes.join(","),
  dependency.fields.map((field) => field.join(":")).join(","),
  dependency.order,
  dependency.duplicates,
  dependency.ignoreEmptyTail ? "tail" : "all",
  dependency.ignoredFields.join(","),
].join("|");
const executableSignatures = Object.fromEntries(
  Object.entries(executableManifest).map(([stageId, kinds]) => [
    stageId,
    {
      source: kinds.source.map(dependencySignature),
      result: kinds.result.map(dependencySignature),
    },
  ]),
);
assert.deepEqual(
  JSON.parse(JSON.stringify(executableSignatures)),
  contract.executableProjectionContract.stageSignatures,
  "JSON contract and executable builder dependencies drifted",
);
for (const [stageId, projectionKinds] of Object.entries(executableManifest)) {
  assert.equal(
    vm.runInContext(`SystemStatusFingerprints_.stageVersions[${JSON.stringify(stageId)}]`, context),
    stageById[stageId].version,
    `${stageId}: contract/runtime version mismatch`,
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(projectionKinds.cost)),
    {
      ...stageById[stageId].cost,
      maxProjectionBytes: Math.min(stageById[stageId].cost.maxBytes, contract.executionContext.maxProjectionBytes),
    },
    `${stageId}: executable stage cost drifted from JSON contract`,
  );
  for (const kind of ["source", "result"]) {
    assert.ok(Array.isArray(projectionKinds[kind]) && projectionKinds[kind].length > 0, `${stageId}: missing executable ${kind}`);
    for (const dependency of projectionKinds[kind]) {
      for (const key of contract.executableProjectionContract.requiredDependencyAttributes) {
        assert.ok(Object.hasOwn(dependency, key), `${stageId}.${kind}.${dependency.id}: missing ${key}`);
      }
      assert.equal(
        dependency.required,
        contract.executableProjectionContract.dependencyPresencePolicy.defaultRequired,
        `${stageId}.${kind}.${dependency.id}: required policy drift`,
      );
      assert.equal(
        dependency.presence,
        "missing_or_unavailable_is_not_empty",
        `${stageId}.${kind}.${dependency.id}: presence policy drift`,
      );
      assert.ok(["range", "injected"].includes(dependency.kind));
      assert.ok(contract.evidenceRoles.allowed.includes(dependency.evidenceRole));
      const override = contract.evidenceRoles.sourceOverrides[stageId]?.[dependency.id];
      const expectedRole = kind === "result"
        ? contract.evidenceRoles.defaultResult
        : override || contract.evidenceRoles.defaultSource;
      assert.equal(dependency.evidenceRole, expectedRole, `${stageId}.${kind}.${dependency.id}: evidence role drift`);
      assert.ok(["semantic", "stable_key"].includes(dependency.order));
      assert.ok(["preserve", "reject"].includes(dependency.duplicates));
      dependency.readModes.forEach((mode) => assert.ok(contract.executionContext.readModes.includes(mode)));
      dependency.fields.forEach((field) => {
        assert.equal(field.length, 2);
        assert.ok(field[0] && field[1]);
      });
    }
  }
  assert.deepEqual(
    JSON.parse(JSON.stringify(projectionKinds.transitionPolicy)),
    contract.transitionPolicies[stageId] || { mode: "immutable_only" },
    `${stageId}: transition policy drift`,
  );
  if (["cell_patch", "birthday_semantic_patch", "vacation_monthly_atomic"].includes(projectionKinds.transitionPolicy.mode)) {
    assert.ok(projectionKinds.transitionPolicy.rowKeyField, `${stageId}: row key policy missing`);
    assert.equal(projectionKinds.transitionPolicy.reorderPolicy, "reject", `${stageId}: reorder must fail closed`);
  }
}
assert.ok(!Object.hasOwn(contract.transitionPolicies["computed.vacation_monthly_sync"], "confirmations"));
assert.deepEqual(
  contract.transitionPolicies["computed.vacation_monthly_sync"].structuredProofs,
  ["targetCells", "metadata", "pendingPlan", "conflicts"],
);
assert.equal(contract.transitionPolicies["computed.vacation_monthly_sync"].missingProofState, "unknown");
assert.equal(contract.transitionPolicies["computed.vacation_monthly_sync"].presentMismatchState, "failed");
assert.equal(contract.transitionPolicies["computed.vacation_monthly_sync"].expectedBindingSource, "trusted_execution_context");
assert.equal(contract.transitionPolicies["computed.vacation_monthly_sync"].expectedBindingArgument, "trustedExecutionContext");
assert.equal(contract.transitionPolicies["computed.vacation_monthly_sync"].expectedBindingBuilder, "buildExpectedBindingFromTrustedContext");
assert.equal(contract.transitionPolicies["computed.vacation_monthly_sync"].derivedFromEvidenceAllowed, false);
assert.equal(contract.transitionPolicies["computed.vacation_monthly_sync"].evidenceExpectedBindingUsed, false);
assert.equal(contract.transitionPolicies["computed.vacation_monthly_sync"].evidenceTrustedContextUsed, false);
assert.equal(contract.transitionPolicies["computed.vacation_monthly_sync"].stageWrapperTrustedContextArgument, "trustedExecutionContext");
assert.equal(contract.transitionPolicies["computed.vacation_monthly_sync"].operationWrapperTrustedContextArgument, "trustedContextMap");
assert.equal(contract.transitionPolicies["computed.vacation_monthly_sync"].structuredStatusPropagation, true);
assert.equal(contract.transitionPolicies["computed.vacation_monthly_sync"].digestValidationBeforeComparison, true);
assert.equal(contract.operationDecisionPolicy.broadStatusField, "status");
assert.equal(contract.operationDecisionPolicy.evidenceDecisionField, "decision");
assert.deepEqual(
  contract.operationDecisionPolicy.decisionShape,
  ["status", "eligibleForReceipt", "reasonCodes"],
);
assert.equal(contract.operationDecisionPolicy.unknownPreventsFull, true);
assert.equal(contract.operationDecisionPolicy.confirmedFailurePrecedence, true);
assert.equal(contract.operationDecisionPolicy.reasonCodesPrefixedByStageId, true);
assert.equal(contract.operationDecisionPolicy.partialMayContainUnknown, true);
assert.equal(contract.canonicalScopeBoundary.stageEvaluatorArgument, "canonicalScope");
assert.equal(contract.canonicalScopeBoundary.operationEvaluatorArgument, "operationScope");
assert.equal(contract.canonicalScopeBoundary.operationScopeShape, "per_stage_map");
assert.equal(contract.canonicalScopeBoundary.derivedFromEvidenceAllowed, false);
assert.equal(contract.canonicalScopeBoundary.evidenceScopeUsed, false);
assert.equal(contract.canonicalScopeBoundary.evidenceScopeKnownUsed, false);
assert.equal(contract.canonicalScopeBoundary.evidenceSkipPredicateSatisfiedUsed, false);
assert.equal(contract.canonicalScopeBoundary.missingOrMalformedScopeState, "unknown");
assert.deepEqual(
  contract.canonicalScopeBoundary.semanticDomains.vacationSourceMode.enum,
  ["legacy", "requests"],
);
assert.equal(
  contract.canonicalScopeBoundary.semanticDomains.vacationSourceMode.skipWhenEquals,
  "requests",
);
assert.equal(
  contract.canonicalScopeBoundary.semanticDomains.targetMonth.pattern,
  "^(0[1-9]|1[0-2])$",
);
assert.deepEqual(
  contract.canonicalScopeBoundary.semanticDomains.targetMonth.emptyAllowedForSkipWhen,
  ["no_target_month"],
);
assert.equal(
  contract.canonicalScopeBoundary.semanticDomains.targetMissingOrEmpty.invariant,
  "targetExists=false requires targetRowCount=0",
);
assert.equal(
  contract.canonicalScopeBoundary.scopeDependentStages["computed.vacation_monthly_sync"]
    .trustedInvocationTargetCrossCheck,
  true,
);
assert.equal(
  contract.canonicalScopeBoundary.scopeDependentStages["computed.vacation_monthly_sync"]
    .trustedInvocationRequiredForSkip,
  true,
);
assert.equal(
  contract.transitionPolicies["computed.personnel_helpers"].semanticInvariant,
  "prior_equals_expected_equals_post",
);
assert.equal(contract.transitionPolicies["computed.personnel_helpers"].emptySemanticState, "eligible_noop");
assert.equal(contract.transitionPolicies["computed.personnel_helpers"].invalidSemanticState, "failed");
assert.deepEqual(
  JSON.parse(JSON.stringify(vm.runInContext("SystemStatusFingerprints_.writerLockContract", context))),
  contract.writerLockContract,
  "writer lock contract drifted",
);
assert.equal(contract.writerLockContract.currentRuntime.public.state, "locked_by_workflow_orchestrator");
assert.equal(contract.writerLockContract.currentRuntime.daily.state, "unlocked_direct_writer");
assert.equal(contract.writerLockContract.currentRuntime.daily.workflowWrite, false);
assert.equal(contract.writerLockContract.currentRuntime.daily.workflowLock, false);
assert.match(maintenanceApiSource, /function apiStage7MaterializeComputedData\s*\([\s\S]*?runMaintenanceScenario\s*\(\s*\{[\s\S]*?type:\s*"materializeComputedData"/);
assert.match(maintenanceSource, /materializeComputedData:\s*true/);
assert.match(workflowSource, /const lockRequired = cfg\.lock !== false && !!cfg\.write/);
assert.match(workflowSource, /LockService\.getDocumentLock\s*\(\s*\)/);
assert.match(workflowSource, /default:\s*return 'workflow'/);
assert.match(maintenanceSource, /function checkVacationsAndBirthdays\s*\([\s\S]*?write:\s*false,[\s\S]*?lock:\s*false,[\s\S]*?materializeAllComputedData_\s*\(\s*\{\s*source:\s*"dailyJob"\s*\}\s*\)/);
assert.equal(contract.writerLockContract.requiredSs2bIntegration.public.acquisition, "already_locked");
assert.equal(contract.writerLockContract.requiredSs2bIntegration.daily.acquisition, "acquire_document_lock");
assert.equal(contract.writerLockContract.requiredSs2bIntegration.public.nestedAcquireAllowed, false);
assert.equal(contract.writerLockContract.requiredSs2bIntegration.daily.sharedCoreAcquiresLock, false);
assert.equal(contract.ss2bHandoff.trustedContextBoundary.derivedFromEvidenceAllowed, false);
assert.equal(contract.ss2bHandoff.trustedContextBoundary.evidenceExpectedBindingUsed, false);
assert.equal(contract.ss2bHandoff.trustedContextBoundary.evidenceTrustedContextUsed, false);
assert.equal(contract.ss2bHandoff.trustedContextBoundary.structuredStatusPropagation, true);
assert.equal(contract.ss2bHandoff.trustedContextBoundary.unknownOperationStatusAllowed, true);
assert.equal(
  contract.ss2bHandoff.trustedContextBoundary.stageEvaluatorSignature,
  "evaluateStage(stageId,evidence,canonicalScope,trustedExecutionContext)",
);
assert.equal(
  contract.ss2bHandoff.trustedContextBoundary.operationEvaluatorSignature,
  "evaluateOperation(operationId,stageInputs,operationScope,trustedContextMap)",
);
assert.equal(contract.ss2bHandoff.trustedContextBoundary.source, "canonical_operation_invocation_and_lock_context");
assert.equal(contract.ss2bHandoff.trustedContextBoundary.runtimeConstructionImplemented, false);
assert.equal(contract.ss2bHandoff.canonicalScopeBoundary.derivedFromEvidenceAllowed, false);
assert.equal(contract.ss2bHandoff.canonicalScopeBoundary.evidenceScopeUsed, false);
assert.equal(contract.ss2bHandoff.canonicalScopeBoundary.evidenceScopeKnownUsed, false);
assert.equal(contract.ss2bHandoff.canonicalScopeBoundary.evidenceSkipPredicateSatisfiedUsed, false);
assert.equal(contract.ss2bHandoff.canonicalScopeBoundary.monthlyTrustedInvocationRequiredForSkip, true);
assert.equal(contract.ss2bHandoff.canonicalScopeBoundary.monthlyTrustedTargetCrossCheck, true);
assert.equal(contract.ss2bHandoff.canonicalScopeBoundary.runtimeConstructionImplemented, false);
assert.deepEqual(
  contract.ss2bHandoff.trustedContextBoundary.requiredSs2bCallers,
  ["apiStage7MaterializeComputedData via WorkflowOrchestrator", "checkVacationsAndBirthdays daily caller"],
);
assert.equal(contract.executableProjectionContract.dependencyPresencePolicy.emptyArrayIsPresent, true);
assert.equal(contract.executableProjectionContract.dependencyPresencePolicy.requiredUnavailableFingerprint, null);
assert.equal(contract.versionCompatibility.receiptVersion, "ss2b-stage-receipt-v1");
assert.equal(contract.versionCompatibility.manifestVersion, contract.executableProjectionContract.version);
assert.equal(contract.versionCompatibility.mismatchFreshness, "unknown");
assert.equal(contract.versionCompatibility.matchingFreshness, "comparable");
assert.equal(contract.versionCompatibility.readTimeMigrationAllowed, false);
assert.equal(contract.versionCompatibility.oldEvidenceMutationAllowed, false);
const oldSs2a9Compatibility = JSON.parse(vm.runInContext(`JSON.stringify(
  SystemStatusFingerprints_.evaluateVersionCompatibility(
    "computed.vacation_monthly_sync",
    {
      receiptVersion: "ss2b-stage-receipt-v1",
      manifestVersion: "ss2a9-executable-projection-v9",
      signatureVersion: "ss2a9-stage-signatures-v9",
      algorithmVersion: "ss2a-canonical-sha256-stream-v1",
      stageVersion: "vacation-monthly-sync-v9",
    }
  )
)`, context));
assert.equal(oldSs2a9Compatibility.compatible, false);
assert.equal(oldSs2a9Compatibility.freshness, "unknown");
assert.ok(oldSs2a9Compatibility.mismatchedFields.includes("manifestVersion"));
assert.ok(oldSs2a9Compatibility.mismatchedFields.includes("signatureVersion"));
assert.ok(oldSs2a9Compatibility.mismatchedFields.includes("stageVersion"));
assert.equal(contract.versionCompatibility.manifestVersion, "ss2a9-executable-projection-v10");
assert.equal(contract.versionCompatibility.signatureVersion, "ss2a9-stage-signatures-v10");
const gasReport = vm.runInContext("runSystemStatusFingerprintTests_()", context);
assert.equal(gasReport.ok, true, JSON.stringify(gasReport, null, 2));
assert.ok(gasReport.checks.length >= 44, "focused GAS suite is too small");
for (const stageId of [
  "computed.assignment_car",
  "computed.assignment_weapon",
  "computed.vacation_monthly_sync",
]) {
  assert.ok(
    gasReport.checks.some(
      (check) => check.name === `${stageId} full identity mutation matrix` && check.status === "OK",
    ),
    `${stageId}: full identity mutation matrix missing`,
  );
}
assert.ok(gasReport.checks.every((check) => check.status === "OK"));

const publicFingerprint = vm.runInContext(
  `SystemStatusFingerprints_.buildStageSourceFingerprint(
    "computed.personnel_helpers",
    { fml: "Private Name", callsign: "SECRET", phone: "+380671234567" }
  )`,
  context,
);
const serializedFingerprint = JSON.stringify(publicFingerprint);
for (const forbidden of ["Private Name", "SECRET", "+380671234567"]) {
  assert.ok(!serializedFingerprint.includes(forbidden), `fingerprint output leaked ${forbidden}`);
}
assert.deepEqual(
  Object.keys(publicFingerprint).sort(),
  contract.privacy.fingerprintOutputFields.slice().sort(),
);

assert.match(packageJson.scripts["ci:system-status"], /verify-system-status-fingerprints\.mjs/);
assert.match(packageJson.scripts["ci:materialize"], /verify-system-status-fingerprints\.mjs/);
assert.match(runnerSource, /"system-status-fingerprints"/);
assert.match(runnerSource, /runSystemStatusFingerprintTests_:\s*runSystemStatusFingerprintTests_/);
const smokeCalls = smokeSource.match(/runSystemStatusFingerprintTests_\s*\(/g) || [];
assert.ok(smokeCalls.length >= 2, "fast and full GAS regression suites must run SS-2A tests");

console.log(
  `System-status fingerprints verification passed (${stages.length} stages, ${gasReport.checks.length} pure checks).`,
);

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

assert.equal(contract.version, 6);
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
const executableManifest = vm.runInContext("SystemStatusFingerprints_.executableManifest", context);
const executableJson = JSON.stringify(executableManifest);
const executableDigest = crypto.createHash("sha256").update(executableJson).digest("hex");
assert.equal(executableDigest, contract.executableProjectionContract.manifestCanonicalJsonSha256);
assert.equal(Object.keys(executableManifest).length, contract.executableProjectionContract.stageCount);
assert.deepEqual(Object.keys(executableManifest).sort(), Object.keys(stageById).sort());
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
assert.equal(contract.executableProjectionContract.dependencyPresencePolicy.emptyArrayIsPresent, true);
assert.equal(contract.executableProjectionContract.dependencyPresencePolicy.requiredUnavailableFingerprint, null);
assert.equal(contract.versionCompatibility.receiptVersion, "ss2b-stage-receipt-v1");
assert.equal(contract.versionCompatibility.manifestVersion, contract.executableProjectionContract.version);
assert.equal(contract.versionCompatibility.mismatchFreshness, "unknown");
assert.equal(contract.versionCompatibility.matchingFreshness, "comparable");
assert.equal(contract.versionCompatibility.readTimeMigrationAllowed, false);
assert.equal(contract.versionCompatibility.oldEvidenceMutationAllowed, false);
const gasReport = vm.runInContext("runSystemStatusFingerprintTests_()", context);
assert.equal(gasReport.ok, true, JSON.stringify(gasReport, null, 2));
assert.ok(gasReport.checks.length >= 36, "focused GAS suite is too small");
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

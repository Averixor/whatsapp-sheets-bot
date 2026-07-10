#!/usr/bin/env node
/**
 * Materialize computed data API — orchestrator + maintenance wiring.
 */
import assert from "node:assert/strict";
import { repoRoot } from "./lib/load-contract.mjs";
import { readRepoFileByBasename } from "./lib/gas-files.mjs";

const orchestrator = readRepoFileByBasename(
  repoRoot,
  "MaterializeComputedData.gs",
  { errorPrefix: "verify-materialize-computed-data" },
);
const maintenanceApi = readRepoFileByBasename(
  repoRoot,
  "Stage7MaintenanceApi.gs",
  { errorPrefix: "verify-materialize-computed-data" },
);
const useCases = readRepoFileByBasename(repoRoot, "UseCases.Maintenance.gs", {
  errorPrefix: "verify-materialize-computed-data",
});
const utils = readRepoFileByBasename(repoRoot, "Utils.gs", {
  errorPrefix: "verify-materialize-computed-data",
});

assert.match(orchestrator, /function materializeAllComputedData_/);
assert.match(orchestrator, /materializePersonnelDerivedSheets_/);
assert.match(orchestrator, /materializeVacationComputedColumns_/);
assert.match(orchestrator, /VacationOptionsWriter_\.rebuildVacationSystem/);
assert.match(orchestrator, /vacationSchedule/);
assert.match(orchestrator, /materializeVacationMonthlyScheduleSync_/);
assert.match(orchestrator, /vacationMonthlySync/);
assert.match(orchestrator, /ensureSendPanelStatusFormula_/);
assert.match(
  readRepoFileByBasename(repoRoot, "PersonnelMaterialize.gs", {
    errorPrefix: "verify-materialize-computed-data",
  }),
  /ensurePersonnelStatusColumn_/,
);
assert.match(
  readRepoFileByBasename(repoRoot, "PersonnelMaterialize.gs", {
    errorPrefix: "verify-materialize-computed-data",
  }),
  /syncMonthlyCallsignsForPersonnelUpdate_/,
);
assert.match(
  readRepoFileByBasename(repoRoot, "PersonnelMaterialize.gs", {
    errorPrefix: "verify-materialize-computed-data",
  }),
  /formatBirthdayCell_|calculateBirthdayCountdownUa_|birthdayColumnsFormattedRows/,
);

assert.match(maintenanceApi, /function apiStage7MaterializeComputedData/);
assert.match(maintenanceApi, /monthlySyncMode/);
assert.match(useCases, /monthlySyncMode: input && input.monthlySyncMode/);
assert.match(maintenanceApi, /materializeComputedData/);

assert.match(useCases, /idempotency: type !== "materializeComputedData"/);
assert.match(useCases, /case "materializeComputedData"/);
assert.match(
  useCases,
  /materializeAllComputedData_\(\{ source: "dailyJob" \}\)/,
);
assert.doesNotMatch(
  useCases.match(/case "clearPhoneCache"[\s\S]*?case "restartBot"/)?.[0] ||
    "",
  /materializePersonnelDerivedSheets_/,
  "clearPhoneCache must not materialize derived sheets",
);

assert.match(
  readRepoFileByBasename(repoRoot, "UseCases.MonthOps.gs", {
    errorPrefix: "verify-materialize-computed-data",
  }),
  /syncVacationsWithMonthlySheet_/,
);

const sidebar = readRepoFileByBasename(repoRoot, "Sidebar.html", {
  errorPrefix: "verify-materialize-computed-data",
});
assert.match(sidebar, /Оновити обчислювані дані/);
assert.match(sidebar, /materializeComputedData/);

console.log("verify-materialize-computed-data: OK");

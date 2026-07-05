#!/usr/bin/env node
/**
 * Materialize computed data API — orchestrator + maintenance wiring.
 */
import assert from "node:assert/strict";
import vm from "node:vm";
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
  /syncAllMonthlyCallsignsFromPersonnel_/,
);
assert.match(
  readRepoFileByBasename(repoRoot, "PersonnelMaterialize.gs", {
    errorPrefix: "verify-materialize-computed-data",
  }),
  /formatBirthdayCell_|calculateBirthdayCountdownUa_|birthdayColumnsFormattedRows/,
);

assert.match(maintenanceApi, /function apiStage7MaterializeComputedData/);
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

assert.doesNotMatch(utils.match(/function clearPhoneCache[\s\S]*?^}/m)?.[0] || "", /materializePersonnelDerivedSheets_/);

const materializeContext = vm.createContext({
  console,
  CONFIG: {
    SEND_PANEL_SHEET: "SEND_PANEL",
  },
  materializePersonnelDerivedSheets_() {
    return {
      ok: true,
      personnel: { sheet: "PERSONNEL" },
      phones: { sheet: "PHONES" },
      birthday: { sheet: "BIRTHDAY" },
      monthlyCallsigns: {
        sheets: [{ sheet: "01" }, { sheet: "02" }],
      },
    };
  },
  materializeVacationComputedColumns_() {
    return {
      ok: true,
      sheet: "VACATIONS",
    };
  },
  VacationOptionsWriter_: {
    rebuildVacationSystem() {
      return {
        ok: true,
        affectedSheets: [
          "VACATION_SCHEDULE",
          "VACATION_CHECK",
          "VACATION_CHECK",
        ],
      };
    },
  },
  getWasbSpreadsheet_() {
    return {
      getSheetByName(name) {
        return name === "SEND_PANEL" ? {} : null;
      },
    };
  },
  ensureSendPanelStatusFormula_() {
    return true;
  },
});
vm.runInContext(orchestrator, materializeContext, {
  filename: "MaterializeComputedData.gs",
});
const materializeResult = vm.runInContext(
  "materializeAllComputedData_({ source: 'ci' })",
  materializeContext,
);
assert.equal(materializeResult.ok, true);
const affectedSheets = Array.from(
  vm.runInContext(
    "materializeAllComputedDataAffectedSheets_(materializeAllComputedData_({ source: 'ci' }))",
    materializeContext,
  ),
);
assert.deepEqual(
  affectedSheets,
  [
    "PERSONNEL",
    "PHONES",
    "BIRTHDAY",
    "01",
    "02",
    "VACATIONS",
    "VACATION_SCHEDULE",
    "VACATION_CHECK",
    "SEND_PANEL",
  ],
  "materialize affected sheets must include VACATION_CHECK once",
);

materializeContext.VacationOptionsWriter_ = {
  rebuildVacationSystem() {
    throw new Error("schedule rebuild failed");
  },
};
const failedScheduleResult = vm.runInContext(
  "materializeAllComputedData_({ source: 'ci' })",
  materializeContext,
);
assert.equal(failedScheduleResult.ok, false);
assert.deepEqual(failedScheduleResult.vacationSchedule, {
  ok: false,
  reason: "schedule rebuild failed",
});

const sidebar = readRepoFileByBasename(repoRoot, "Sidebar.html", {
  errorPrefix: "verify-materialize-computed-data",
});
assert.match(sidebar, /Оновити обчислювані дані/);
assert.match(sidebar, /materializeComputedData/);

console.log("verify-materialize-computed-data: OK");

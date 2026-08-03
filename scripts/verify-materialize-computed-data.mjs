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
const stage7Config = readRepoFileByBasename(repoRoot, "Stage7Config.gs", {
  errorPrefix: "verify-materialize-computed-data",
});
const operationRepository = readRepoFileByBasename(
  repoRoot,
  "OperationRepository.gs",
  {
    errorPrefix: "verify-materialize-computed-data",
  },
);

assert.match(orchestrator, /function materializeAllComputedData_/);
assert.match(orchestrator, /materializePersonnelDerivedSheets_/);
assert.match(orchestrator, /materializeVacationComputedColumns_/);
assert.match(orchestrator, /VacationOptionsWriter_\.rebuildVacationSystem/);
assert.match(orchestrator, /skipUnchanged/);
assert.match(orchestrator, /vacationSchedule/);
assert.match(orchestrator, /materializeVacationMonthlyScheduleSync_/);
assert.match(orchestrator, /vacationMonthlySync/);
assert.match(orchestrator, /ensureSendPanelStatusFormula_/);
assert.match(orchestrator, /_compactMaterializeVacationScheduleResult_/);
assert.match(orchestrator, /_compactMaterializeVacationMonthlySyncResult_/);
assert.match(orchestrator, /_compactMaterializeSystemStatusEvaluation_/);
assert.match(
  orchestrator,
  /evaluateComputedMaterialize[\s\S]*_compactMaterializeVacationScheduleResult_/,
  "fingerprint evaluation must run before OPS_LOG payload compaction",
);
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
  /materializeAllComputedData_\(\{\s*source:\s*"dailyJob"[\s\S]*?lockOwner:\s*"daily_caller"/,
);
assert.match(useCases, /LockService\.getDocumentLock\s*\(\s*\)/);
assert.match(
  orchestrator,
  /SystemStatusRuntime_\.evaluateComputedMaterialize/,
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
        checks: Array.from({ length: 20 }, (_, i) => ({
          rule: "MAX_CONCURRENT",
          description: "x".repeat(200),
          index: i,
        })),
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
assert.equal(
  materializeResult.vacationSchedule.checkCount,
  20,
  "vacationSchedule checks must be compacted to checkCount for OPS_LOG",
);
assert.equal(
  materializeResult.vacationSchedule.checks,
  undefined,
  "full vacationSchedule.checks must not remain in materialize result",
);
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
assert.equal(failedScheduleResult.vacationSchedule.ok, false);
assert.equal(
  failedScheduleResult.vacationSchedule.reason,
  "schedule rebuild failed",
);

const sidebar = readRepoFileByBasename(repoRoot, "Sidebar.html", {
  errorPrefix: "verify-materialize-computed-data",
});
assert.match(sidebar, /Оновити обчислювані дані/);
assert.match(sidebar, /materializeComputedData/);

const jsCore = readRepoFileByBasename(repoRoot, "Js.Core.html", {
  errorPrefix: "verify-materialize-computed-data",
});
assert.match(jsCore, /resolveApiSlowWarnMs_/);
assert.match(jsCore, /apiStage7MaterializeComputedData:\s*120000/);

const stringifyContext = vm.createContext({
  console,
});

vm.runInContext(stage7Config, stringifyContext, {
  filename: "Stage7Config.gs",
});

const maxCellText = vm.runInContext(
  `stage7SafeStringify_({ payload: "x".repeat(60000) }, 50000)`,
  stringifyContext,
);

assert.equal(
  maxCellText.length,
  50000,
  "stage7SafeStringify_ must include truncation suffix inside maxLen",
);

assert.equal(
  maxCellText.endsWith("…"),
  true,
  "truncated value must retain the ellipsis marker",
);

const oneCharLimit = vm.runInContext(
  `stage7SafeStringify_({ payload: "xxx" }, 1)`,
  stringifyContext,
);

assert.equal(oneCharLimit.length, 1);

assert.match(
  operationRepository,
  /SHEET_CELL_SAFE_JSON_LIMIT\s*=\s*49000/,
  "OperationRepository must keep a safety margin below the Sheets cell limit",
);

assert.match(
  operationRepository,
  /stage7SafeStringify_\([\s\S]*?SHEET_CELL_SAFE_JSON_LIMIT/,
  "OperationRepository must apply the safe ResultJson cell limit",
);

console.log("verify-materialize-computed-data: OK");

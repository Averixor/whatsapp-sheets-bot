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
const workflowOrchestrator = readRepoFileByBasename(
  repoRoot,
  "WorkflowOrchestrator.gs",
  { errorPrefix: "verify-materialize-computed-data" },
);
const auditTrail = readRepoFileByBasename(repoRoot, "AuditTrail.gs", {
  errorPrefix: "verify-materialize-computed-data",
});

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
assert.match(orchestrator, /MATERIALIZE_COMPUTED_STAGE_NAMES_/);
assert.match(orchestrator, /_materializeComputedRunStage_/);
assert.match(orchestrator, /timings\.totalMs/);
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

const personnelMaterializeSource = readRepoFileByBasename(
  repoRoot,
  "PersonnelMaterialize.gs",
  { errorPrefix: "verify-materialize-computed-data" },
);
// Structural smoke checks (names/markers). Behavioral fake-sheet execution
// below must remain — string matches alone would accept no-op stubs.
assert.match(
  personnelMaterializeSource,
  /function _personnelMaterializeDerivedManagedRowCount_/,
  "PHONES/Birthday must expand capacity to fit PERSONNEL",
);
assert.doesNotMatch(
  personnelMaterializeSource,
  /rows\.slice\(0,\s*managedRows\)/,
  "must not truncate PERSONNEL rows to the derived sheet lastRow",
);
assert.match(
  personnelMaterializeSource,
  /function _personnelAssignmentReorderRowsByPersonnel_/,
  "WEAPON/CAR must reorder full rows by Callsign",
);
assert.match(personnelMaterializeSource, /fullRowReorder:\s*true/);
assert.match(
  personnelMaterializeSource,
  /Drain every queued equipment row for this callsign/,
  "multi-CAR owners must keep all vehicles in PERSONNEL order",
);
assert.match(personnelMaterializeSource, /Object\.create\(null\)/);
assert.match(personnelMaterializeSource, /concurrent_edit/);
assert.doesNotMatch(
  personnelMaterializeSource,
  /identityRange\.setValues\(identityOut\)/,
  "WEAPON must not overwrite A:E identity without moving property columns",
);
assert.match(
  personnelMaterializeSource,
  /function _personnelMaterializeWriteColumnIfChanged_[\s\S]*?range\.getValues\(\)/,
  "column write-if-changed must compare raw getValues()",
);
assert.match(
  personnelMaterializeSource,
  /function _personnelMaterializeWriteMatrixIfChanged_[\s\S]*?range\.getValues\(\)/,
  "matrix write-if-changed must compare raw getValues()",
);
assert.match(
  personnelMaterializeSource,
  /function _personnelMaterializeRowsEqualRaw_/,
  "matrix equality helper must use RowsEqualRaw naming",
);
assert.doesNotMatch(
  personnelMaterializeSource,
  /_personnelMaterializeRowsEqualDisplay_/,
  "RowsEqualDisplay must be renamed to RowsEqualRaw",
);
assert.match(
  personnelMaterializeSource,
  /personnelResult\.ok[\s\S]*phonesResult\.ok[\s\S]*birthdayResult\.ok[\s\S]*monthlySync\.ok[\s\S]*equipmentAssignments\.ok/,
  "derived materialize ok must aggregate personnel+phones+birthday+monthly+equipment",
);

assert.match(maintenanceApi, /function apiStage7MaterializeComputedData/);
assert.match(maintenanceApi, /monthlySyncMode/);
assert.match(maintenanceApi, /stages:\s*Array\.isArray\(opts\.stages\)/);
assert.match(useCases, /monthlySyncMode: input && input.monthlySyncMode/);
assert.match(useCases, /stages: input && input\.stages/);
assert.match(maintenanceApi, /materializeComputedData/);

assert.match(
  auditTrail,
  /if \(opts\.documentLockHeld === true\) \{\s*return fn\(\);\s*\}/,
  "audit writes must reuse a document lock already held by the workflow",
);
assert.match(
  workflowOrchestrator,
  /Stage7AuditTrail_\.record\([\s\S]*?documentLockHeld:\s*!!lock/,
  "workflow audit must declare its already-held document lock",
);

{
  let lockWaitCalls = 0;
  let lastRow = 0;
  const writes = [];
  const fakeRange = {
    getValues() {
      return [[]];
    },
    setValues(rows) {
      writes.push(rows);
      lastRow = Math.max(lastRow, 1);
      return this;
    },
    setFontWeight() {
      return this;
    },
    setBackground() {
      return this;
    },
  };
  const fakeSheet = {
    getName() {
      return "AUDIT_LOG";
    },
    getLastRow() {
      return lastRow;
    },
    getLastColumn() {
      return 0;
    },
    getRange() {
      return fakeRange;
    },
    getFrozenRows() {
      return 0;
    },
    setFrozenRows() {},
  };
  const auditContext = vm.createContext({
    console,
    Logger: { log() {} },
    ensureLogicalSheet_() {
      return fakeSheet;
    },
    stage7AsArray_(value) {
      if (value == null || value === "") return [];
      return Array.isArray(value) ? value.slice() : [value];
    },
    stage7SafeStringify_(value) {
      return JSON.stringify(value == null ? null : value);
    },
    LockService: {
      getDocumentLock() {
        return {
          waitLock() {
            lockWaitCalls++;
          },
          releaseLock() {},
        };
      },
    },
  });
  vm.runInContext(auditTrail, auditContext, { filename: "AuditTrail.gs" });
  const reusedLockResult = vm.runInContext(
    "Stage7AuditTrail_.record({ scenario: 'ci' }, { documentLockHeld: true })",
    auditContext,
  );
  assert.equal(reusedLockResult.success, true);
  assert.equal(
    lockWaitCalls,
    0,
    "already-held audit lock must not be reacquired",
  );
  vm.runInContext(
    "Stage7AuditTrail_.record({ scenario: 'standalone' })",
    auditContext,
  );
  assert.equal(
    lockWaitCalls,
    1,
    "standalone audit writes must still acquire the lock",
  );
  assert.ok(writes.length >= 2);
}

assert.match(useCases, /idempotency: type !== "materializeComputedData"/);
assert.match(useCases, /case "materializeComputedData"/);
assert.match(
  useCases,
  /materializeAllComputedData_\(\{\s*source:\s*"dailyJob"[\s\S]*?lockOwner:\s*"daily_caller"/,
);
assert.match(useCases, /LockService\.getDocumentLock\s*\(\s*\)/);
assert.match(orchestrator, /SystemStatusRuntime_\.evaluateComputedMaterialize/);
assert.doesNotMatch(
  useCases.match(/case "clearPhoneCache"[\s\S]*?case "restartBot"/)?.[0] || "",
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
assert.ok(materializeResult.timings.totalMs >= 0);
assert.ok(materializeResult.timings.stages.personnel.durationMs >= 0);
assert.ok(materializeResult.timings.stages.vacationSchedule.durationMs >= 0);
assert.deepEqual(Array.from(materializeResult.timings.selected), [
  "personnel",
  "vacationComputed",
  "vacationSchedule",
  "vacationMonthlySync",
  "sendPanel",
  "systemStatus",
]);
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

const selectedStageResult = vm.runInContext(
  "materializeAllComputedData_({ source: 'ci', stages: ['personnel', 'sendPanel'] })",
  materializeContext,
);
assert.equal(selectedStageResult.ok, true);
assert.equal(selectedStageResult.vacations.skipped, true);
assert.equal(selectedStageResult.vacationSchedule.skipped, true);
assert.equal(selectedStageResult.vacationMonthlySync.skipped, true);
assert.equal(selectedStageResult.systemStatusEvaluation.skipped, true);
assert.deepEqual(Array.from(selectedStageResult.timings.selected), [
  "personnel",
  "sendPanel",
]);

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

const resultsUi = readRepoFileByBasename(repoRoot, "Js.Render.Results.html", {
  errorPrefix: "verify-materialize-computed-data",
});
assert.match(resultsUi, /function logMaterializeComputedTimings_/);
assert.match(resultsUi, /Етапи оновлення:/);

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

{
  function blankCell() {
    return { value: "", formula: "", formulaR1C1: "" };
  }

  class MatFakeRange {
    constructor(sheet, row, col, numRows, numCols) {
      this.sheet = sheet;
      this.row = row;
      this.col = col;
      this.numRows = numRows;
      this.numCols = numCols;
    }
    getValues() {
      const out = [];
      for (let r = 0; r < this.numRows; r++) {
        const row = [];
        for (let c = 0; c < this.numCols; c++) {
          row.push(this.sheet.cell(this.row + r, this.col + c).value);
        }
        out.push(row);
      }
      return out;
    }
    getDisplayValues() {
      const out = [];
      for (let r = 0; r < this.numRows; r++) {
        const row = [];
        for (let c = 0; c < this.numCols; c++) {
          const cell = this.sheet.cell(this.row + r, this.col + c);
          row.push(
            cell.value !== "" && cell.value != null
              ? String(cell.value)
              : cell.formula
                ? "0"
                : "",
          );
        }
        out.push(row);
      }
      return out;
    }
    getFormulas() {
      const out = [];
      for (let r = 0; r < this.numRows; r++) {
        const row = [];
        for (let c = 0; c < this.numCols; c++) {
          row.push(this.sheet.cell(this.row + r, this.col + c).formula || "");
        }
        out.push(row);
      }
      return out;
    }
    setValues(values) {
      values.forEach((sourceRow, rowOffset) => {
        sourceRow.forEach((value, colOffset) => {
          const target = this.sheet.cell(
            this.row + rowOffset,
            this.col + colOffset,
          );
          target.value = value;
          target.formula = "";
        });
      });
      return this;
    }
    setFormulas(values) {
      values.forEach((sourceRow, rowOffset) => {
        sourceRow.forEach((value, colOffset) => {
          const target = this.sheet.cell(
            this.row + rowOffset,
            this.col + colOffset,
          );
          target.formula = String(value || "");
          target.value = "";
        });
      });
      return this;
    }
    setValue(value) {
      this.sheet.cell(this.row, this.col).value = value;
      return this;
    }
    getDisplayValue() {
      return this.getDisplayValues()[0][0];
    }
    getA1Notation() {
      return `R${this.row}C${this.col}`;
    }
  }

  class MatFakeSheet {
    constructor(name, rowCount = 40, colCount = 30) {
      this.name = name;
      this.colCount = colCount;
      this.rows = Array.from({ length: rowCount }, () =>
        Array.from({ length: colCount }, blankCell),
      );
      this.hiddenColumns = new Set();
    }
    getName() {
      return this.name;
    }
    cell(row, col) {
      while (this.rows.length < row) {
        this.rows.push(Array.from({ length: this.colCount }, blankCell));
      }
      while (this.rows[row - 1].length < col) {
        this.rows[row - 1].push(blankCell());
        this.colCount = Math.max(this.colCount, col);
      }
      return this.rows[row - 1][col - 1];
    }
    getLastRow() {
      for (let row = this.rows.length; row >= 1; row--) {
        if (
          this.rows[row - 1].some(
            (cell) => cell.value !== "" || cell.formula !== "",
          )
        ) {
          return row;
        }
      }
      return 0;
    }
    getLastColumn() {
      return this.colCount;
    }
    getMaxColumns() {
      return this.colCount;
    }
    getRange(row, col, numRows, numCols) {
      return new MatFakeRange(this, row, col, numRows, numCols);
    }
    hideColumns(col) {
      this.hiddenColumns.add(col);
    }
    insertColumnsAfter() {}
  }

  const phones = new MatFakeSheet("PHONES", 40, 3);
  phones.cell(1, 1).value = "Callsign";
  phones.cell(1, 2).value = "Phone";
  phones.cell(1, 3).value = "Phone 2";

  const car = new MatFakeSheet("CAR", 10, 8);
  car.cell(1, 1).value = "Owner";
  car.cell(1, 8).value = "Callsign";
  // Stale helper callsign, identity still matches via FML; property formula in B.
  car.cell(2, 1).value = "Іваненко Іван";
  car.cell(2, 2).formula = '=A2&"-car"';
  car.cell(2, 8).value = "STALE";
  car.cell(3, 1).value = "Петренко Петро";
  car.cell(3, 2).value = "PROP_B";
  car.cell(3, 8).value = "PETRO";

  const sheetsByName = Object.create(null);
  sheetsByName.PHONES = phones;
  sheetsByName.CAR = car;
  sheetsByName.WEAPON = new MatFakeSheet("WEAPON", 5, 27);

  const sourcePeople = [];
  for (let i = 1; i <= 35; i++) {
    sourcePeople.push({
      callsign: `P${i}`,
      phone: `3805000000${String(i).padStart(2, "0")}`,
      phone2: "",
      fml:
        i === 1 ? "Петренко Петро" : i === 2 ? "Іваненко Іван" : `Person ${i}`,
      lastName: i === 1 ? "Петренко" : i === 2 ? "Іваненко" : `Last${i}`,
      firstName: i === 1 ? "Петро" : i === 2 ? "Іван" : `First${i}`,
      patronymic: "",
      rank: "",
      title: "",
    });
  }

  function matLetterToNum_(letters) {
    const text = String(letters || "").toUpperCase();
    let n = 0;
    for (let i = 0; i < text.length; i++) {
      n = n * 26 + (text.charCodeAt(i) - 64);
    }
    return n;
  }
  function matFormatA1_(col, row, absCol, absRow) {
    let n = Number(col) || 0;
    let out = "";
    while (n > 0) {
      const rem = (n - 1) % 26;
      out = String.fromCharCode(65 + rem) + out;
      n = Math.floor((n - 1) / 26);
    }
    return (
      (absCol ? "$" : "") + (out || "A") + (absRow ? "$" : "") + String(row)
    );
  }
  function matParseA1_(token) {
    const match = String(token || "").match(
      /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)(?::(\$?)([A-Za-z]{1,3})(\$?)(\d+))?$/,
    );
    if (!match) return null;
    const startCol = matLetterToNum_(match[2]);
    const startRow = Number(match[4]) || 0;
    const endCol = match[6] ? matLetterToNum_(match[6]) : startCol;
    const endRow = match[8] ? Number(match[8]) || 0 : startRow;
    return {
      startCol,
      startRow,
      endCol,
      endRow,
      absStartCol: match[1] === "$",
      absStartRow: match[3] === "$",
      absEndCol: match[6] ? match[5] === "$" : match[1] === "$",
      absEndRow: match[8] ? match[7] === "$" : match[3] === "$",
      isRange: !!match[6],
    };
  }
  function matAdjustFormula_(formula, fromRow, toRow) {
    const text = String(formula == null ? "" : formula);
    const delta = (Number(toRow) || 0) - (Number(fromRow) || 0);
    if (!text || !delta) return text;
    return text.replace(
      /(^|[^A-Za-z0-9_])((?:\$?[A-Za-z]{1,3}\$?\d+)(?::\$?[A-Za-z]{1,3}\$?\d+)?)/g,
      (full, prefix, token) => {
        if (prefix === "!") return full;
        const parsed = matParseA1_(token);
        if (!parsed) return full;
        let startRow = parsed.startRow;
        let endRow = parsed.endRow;
        let changed = false;
        if (!parsed.absStartRow) {
          startRow += delta;
          changed = true;
        }
        if (!parsed.absEndRow) {
          endRow += delta;
          changed = true;
        }
        if (!changed || startRow < 1 || endRow < 1) return full;
        if (!parsed.isRange) {
          return (
            prefix +
            matFormatA1_(
              parsed.startCol,
              startRow,
              parsed.absStartCol,
              parsed.absStartRow,
            )
          );
        }
        return (
          prefix +
          matFormatA1_(
            parsed.startCol,
            startRow,
            parsed.absStartCol,
            parsed.absStartRow,
          ) +
          ":" +
          matFormatA1_(
            parsed.endCol,
            endRow,
            parsed.absEndCol,
            parsed.absEndRow,
          )
        );
      },
    );
  }

  const matContext = vm.createContext({
    console,
    CONFIG: {
      PHONES_SHEET: "PHONES",
      CAR_SHEET: "CAR",
      WEAPON_SHEET: "WEAPON",
      BIRTHDAY_HELPER_SHEET: "Birthday",
    },
    MONTHLY_CONFIG: { LAST_DATA_ROW: 30 },
    getWasbSpreadsheet_() {
      return {
        getSheetByName(name) {
          return sheetsByName[name] || null;
        },
        getSheets() {
          return Object.values(sheetsByName);
        },
      };
    },
    _personnelCanonicalHeaderKey_(header) {
      return String(header || "").trim();
    },
    _normFml_(s) {
      return String(s || "")
        .trim()
        .replace(/\s+/g, " ")
        .toUpperCase();
    },
    normalizePhone_(value) {
      const digits = String(value || "").replace(/\D/g, "");
      if (!digits) return "";
      if (/^0\d{9}$/.test(digits)) return "+38" + digits;
      if (/^380\d{9}$/.test(digits)) return "+" + digits;
      return "+" + digits;
    },
    _monthlyWriteSeparatedValuesAndFormulas_(
      sheet,
      startRow,
      startCol,
      values,
      formulas,
    ) {
      for (let r = 0; r < values.length; r++) {
        const valueRow = values[r] || [];
        const formulaRow = (formulas && formulas[r]) || [];
        let c = 0;
        while (c < valueRow.length) {
          const hasFormula = !!String(formulaRow[c] || "").trim();
          const runStart = c;
          if (hasFormula) {
            while (c < valueRow.length && String(formulaRow[c] || "").trim()) {
              c++;
            }
            sheet
              .getRange(startRow + r, startCol + runStart, 1, c - runStart)
              .setFormulas([formulaRow.slice(runStart, c)]);
          } else {
            while (c < valueRow.length && !String(formulaRow[c] || "").trim()) {
              c++;
            }
            sheet
              .getRange(startRow + r, startCol + runStart, 1, c - runStart)
              .setValues([valueRow.slice(runStart, c)]);
          }
        }
      }
      return { ok: true, valueRuns: 1, formulaRuns: 1 };
    },
    _monthlyParseFlexibleA1Token_: matParseA1_,
    _monthlyFormatA1Cell_: matFormatA1_,
    _monthlyAdjustFormulaRowDelta_: matAdjustFormula_,
  });

  vm.runInContext(personnelMaterializeSource, matContext, {
    filename: "PersonnelMaterialize.gs",
  });

  const phonesResult = matContext.materializePhonesSheet_(
    phones,
    sourcePeople,
    {
      forceHeaders: true,
    },
  );
  assert.equal(phonesResult.ok, true);
  assert.equal(
    phonesResult.rowsWritten,
    35,
    "PHONES must expand to fit all source people (no truncate at 31)",
  );
  assert.equal(phones.cell(36, 1).value, "P35");

  const carResult = matContext.materializeCarOwnersFromPersonnel_([
    {
      fml: "Петренко Петро",
      callsign: "PETRO",
      phone: "",
      phone2: "",
      lastName: "Петренко",
      firstName: "Петро",
      patronymic: "",
      rank: "",
      title: "",
    },
    {
      fml: "Іваненко Іван",
      callsign: "IVAN",
      phone: "",
      phone2: "",
      lastName: "Іваненко",
      firstName: "Іван",
      patronymic: "",
      rank: "",
      title: "",
    },
  ]);
  assert.equal(carResult.ok, true);
  assert.equal(carResult.fullRowReorder, true);
  assert.equal(carResult.ownerMode, "fml", "Owner header uses FML mode");
  assert.equal(car.cell(2, 8).value, "PETRO", "PERSONNEL order first");
  assert.equal(car.cell(2, 2).value, "PROP_B");
  assert.equal(car.cell(3, 8).value, "IVAN", "stale helper matched via FML");
  assert.equal(
    car.cell(3, 2).formula,
    '=A3&"-car"',
    "property formula must survive reorder and adjust relative row refs",
  );

  // Callsign-mode CAR (working book): column A stays Callsign, never overwritten by FML.
  const carCallsign = new MatFakeSheet("CAR_CS", 5, 8);
  carCallsign.cell(1, 1).value = "Callsign";
  carCallsign.cell(1, 8).value = "Callsign";
  carCallsign.cell(2, 1).value = "IVAN";
  carCallsign.cell(2, 2).value = "CAR_A";
  carCallsign.cell(3, 1).value = "PETRO";
  carCallsign.cell(3, 2).value = "CAR_B";
  carCallsign.cell(4, 1).value = "－";
  carCallsign.cell(4, 2).value = "UNASSIGNED";
  sheetsByName.CAR = carCallsign;
  const carCsResult = matContext.materializeCarOwnersFromPersonnel_([
    {
      fml: "Петренко Петро",
      callsign: "PETRO",
      phone: "",
      phone2: "",
      lastName: "Петренко",
      firstName: "Петро",
      patronymic: "",
      rank: "",
      title: "",
    },
    {
      fml: "Іваненко Іван",
      callsign: "IVAN",
      phone: "",
      phone2: "",
      lastName: "Іваненко",
      firstName: "Іван",
      patronymic: "",
      rank: "",
      title: "",
    },
  ]);
  assert.equal(carCsResult.ok, true);
  assert.equal(carCsResult.ownerMode, "callsign");
  assert.equal(
    carCallsign.cell(2, 1).value,
    "PETRO",
    "callsign mode keeps A=Callsign",
  );
  assert.equal(carCallsign.cell(2, 2).value, "CAR_B");
  assert.equal(carCallsign.cell(3, 1).value, "IVAN");
  assert.equal(carCallsign.cell(3, 2).value, "CAR_A");
  assert.equal(
    carCallsign.cell(4, 1).value,
    "－",
    "dash owner must stay unassigned",
  );
  assert.equal(carCallsign.cell(4, 2).value, "UNASSIGNED");
  sheetsByName.CAR = car;

  // Prototype-key callsign must not break queue maps.
  const reorder = matContext._personnelAssignmentReorderRowsByPersonnel_(
    [
      {
        callsign: "constructor",
        fml: "Ctor Person",
        phone: "",
        displayPhone: "",
      },
      { callsign: "toString", fml: "Ts Person", phone: "", displayPhone: "" },
    ],
    [
      { callsign: "toString", fml: "Ts Person", phone: "" },
      { callsign: "constructor", fml: "Ctor Person", phone: "" },
    ],
  );
  assert.equal(reorder.ordered[0].callsign, "toString");
  assert.equal(reorder.ordered[1].callsign, "constructor");
  assert.equal(reorder.fullRowReorder, true);

  // Phone identity fallback uses display phone (leading zeros / formatting).
  const byPhone = matContext._personnelAssignmentReorderRowsByPersonnel_(
    [
      {
        callsign: "",
        fml: "Other Name",
        phone: 501112233,
        displayPhone: "0501112233",
      },
    ],
    [
      {
        callsign: "PHONE_MATCH",
        fml: "Different",
        phone: "+380501112233",
        phone2: "",
      },
    ],
  );
  assert.equal(byPhone.ordered[0].displayPhone, "0501112233");

  // Multiple CAR rows for one PERSONNEL callsign stay together in PERSONNEL order.
  const multiCar = matContext._personnelAssignmentReorderRowsByPersonnel_(
    [
      { callsign: "OWNER_B", fml: "B", phone: "", displayPhone: "", tag: "b1" },
      { callsign: "OWNER_A", fml: "A", phone: "", displayPhone: "", tag: "a1" },
      { callsign: "OWNER_A", fml: "A", phone: "", displayPhone: "", tag: "a2" },
      { callsign: "OWNER_B", fml: "B", phone: "", displayPhone: "", tag: "b2" },
    ],
    [
      { callsign: "OWNER_A", fml: "A", phone: "" },
      { callsign: "OWNER_B", fml: "B", phone: "" },
    ],
  );
  assert.equal(
    multiCar.ordered.map((row) => row.tag).join(","),
    "a1,a2,b1,b2",
    "all CAR rows for each owner must drain before the next PERSONNEL member",
  );
}

console.log("verify-materialize-computed-data: OK");

#!/usr/bin/env node
/**
 * Vacation monthly sync — behavior tests for one-way approved vacation sync.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { repoRoot } from "./lib/load-contract.mjs";

function date(year, month, day) {
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function formatUaDate(value) {
  return [
    String(value.getDate()).padStart(2, "0"),
    String(value.getMonth() + 1).padStart(2, "0"),
    value.getFullYear(),
  ].join(".");
}

function colToNumber(letters) {
  return String(letters || "")
    .toUpperCase()
    .split("")
    .reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0);
}

function columnNumberToLetter(colNumber) {
  let n = Number(colNumber) || 0;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out || "A";
}

function parseA1(a1) {
  const match = String(a1 || "").match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
  if (!match) throw new Error(`Unsupported A1 in fake sheet: ${a1}`);
  return {
    row: Number(match[2]),
    col: colToNumber(match[1]),
    numRows: Number(match[4]) - Number(match[2]) + 1,
    numCols: colToNumber(match[3]) - colToNumber(match[1]) + 1,
  };
}

class FakeValidation {
  constructor(values) {
    this.values = values;
  }

  getCriteriaValues() {
    return [this.values.slice()];
  }
}

class FakeRange {
  constructor(sheet, row, col, numRows, numCols) {
    this.sheet = sheet;
    this.row = row;
    this.col = col;
    this.numRows = numRows || 1;
    this.numCols = numCols || 1;
  }

  getRow() {
    return this.row;
  }

  getColumn() {
    return this.col;
  }

  getNumRows() {
    return this.numRows;
  }

  getNumColumns() {
    return this.numCols;
  }

  _readMatrix(name) {
    const matrix = this.sheet[name];
    const out = [];
    for (let r = 0; r < this.numRows; r++) {
      const row = [];
      for (let c = 0; c < this.numCols; c++) {
        row.push(matrix[this.row - 1 + r][this.col - 1 + c]);
      }
      out.push(row);
    }
    return out;
  }

  _writeMatrix(name, values) {
    for (let r = 0; r < this.numRows; r++) {
      for (let c = 0; c < this.numCols; c++) {
        this.sheet[name][this.row - 1 + r][this.col - 1 + c] =
          values[r][c];
      }
    }
    return this;
  }

  getValues() {
    return this._readMatrix("values");
  }

  getDisplayValues() {
    return this.getValues().map((row) =>
      row.map((value) => (value instanceof Date ? formatUaDate(value) : String(value ?? ""))),
    );
  }

  setValues(values) {
    return this._writeMatrix("values", values);
  }

  getDataValidations() {
    return this._readMatrix("validations");
  }

  getNotes() {
    return this._readMatrix("notes");
  }

  setNotes(values) {
    return this._writeMatrix("notes", values);
  }

  getBackgrounds() {
    return this._readMatrix("backgrounds");
  }

  setBackgrounds(values) {
    return this._writeMatrix("backgrounds", values);
  }
}

class FakeSheet {
  constructor({ name = "07", allowed = ["БР", "Відпус", "КП"], codes = [] } = {}) {
    this.name = name;
    this.values = [
      ["FML", "Callsign", date(2026, 7, 10), date(2026, 7, 11), date(2026, 7, 12)],
      ["Сова Повне Ім'я", "СОВА", codes[0] || "", codes[1] || "", codes[2] || ""],
      ["Гугл Повне Ім'я", "ГУГЛ", "", "", ""],
      ["Резерв Повне Ім'я", "РЕЗЕРВ", "", "", ""],
    ];
    this.notes = Array.from({ length: 4 }, () => Array(5).fill(""));
    this.backgrounds = Array.from({ length: 4 }, () => Array(5).fill("#ffffff"));
    this.validations = Array.from({ length: 4 }, () => Array(5).fill(null));
    for (let r = 1; r < 4; r++) {
      for (let c = 2; c < 5; c++) {
        this.validations[r][c] = new FakeValidation(allowed);
      }
    }
  }

  getName() {
    return this.name;
  }

  getLastColumn() {
    return 5;
  }

  getLastRow() {
    return 4;
  }

  getRange(a1OrRow, col, numRows, numCols) {
    if (typeof a1OrRow === "string") {
      const ref = parseA1(a1OrRow);
      return new FakeRange(this, ref.row, ref.col, ref.numRows, ref.numCols);
    }
    return new FakeRange(this, a1OrRow, col, numRows, numCols);
  }
}

class FakeProperties {
  constructor() {
    this.store = {};
  }

  getProperty(key) {
    return Object.prototype.hasOwnProperty.call(this.store, key)
      ? this.store[key]
      : null;
  }

  setProperty(key, value) {
    this.store[key] = String(value);
  }

  deleteProperty(key) {
    delete this.store[key];
  }

  clear() {
    this.store = {};
  }
}

const documentProps = new FakeProperties();
let activeSheet = null;
let vacationRows = [];

const context = vm.createContext({
  console,
  Date,
  JSON,
  Math,
  Object,
  Array,
  String,
  Number,
  RegExp,
  Utilities: {
    formatDate(value, _tz, format) {
      if (format === "yyyy-MM-dd") {
        return [
          value.getFullYear(),
          String(value.getMonth() + 1).padStart(2, "0"),
          String(value.getDate()).padStart(2, "0"),
        ].join("-");
      }
      return formatUaDate(value);
    },
  },
  DateUtils_: {
    toDayStart(value) {
      if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null;
      return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0);
    },
    formatUaDate,
  },
  CONFIG: { DATE_ROW: 1 },
  PropertiesService: {
    getDocumentProperties() {
      return documentProps;
    },
  },
  getWasbSpreadsheet_() {
    return {
      getSheetByName(name) {
        return activeSheet && activeSheet.getName() === name ? activeSheet : null;
      },
    };
  },
  withScriptLock_(callback) {
    return callback();
  },
  getMonthlyCodeRangeA1ForSheet_() {
    return "C2:E4";
  },
  getMonthlyCallsignColForSheet_() {
    return 2;
  },
  getMonthlyFmlColForSheet_() {
    return 1;
  },
  _inferMonthYearFromSheet_() {
    return { month: 7, year: 2026 };
  },
  _columnNumberToLetter_: columnNumberToLetter,
  _normCallsignKey_(value) {
    return String(value || "").trim().toUpperCase();
  },
  _normFml_(value) {
    return String(value || "").trim().replace(/\s+/g, " ").toUpperCase();
  },
  VacationsRepository_: {
    listAll() {
      return vacationRows;
    },
  },
  PersonnelRepository_: {
    getByCallsignAnyStatus(callsign) {
      const key = String(callsign || "").toUpperCase();
      if (key === "СОВА") return { callsign: "СОВА", fml: "Сова Повне Ім'я" };
      if (key === "ГУГЛ") return { callsign: "ГУГЛ", fml: "Гугл Повне Ім'я" };
      return null;
    },
    getByFml(fml) {
      const key = String(fml || "").toUpperCase();
      if (key === "СОВА ПОВНЕ ІМ'Я") return { callsign: "СОВА", fml: "Сова Повне Ім'я" };
      if (key === "ГУГЛ ПОВНЕ ІМ'Я") return { callsign: "ГУГЛ", fml: "Гугл Повне Ім'я" };
      return null;
    },
  },
});

vm.runInContext(
  readFileSync(path.join(repoRoot, "vacations/VacationMonthlySync.gs"), "utf8"),
  context,
  { filename: "VacationMonthlySync.gs" },
);

function vacation(overrides = {}) {
  return Object.assign(
    {
      id: "VAC-1",
      personKey: "СОВА",
      fml: "Сова Повне Ім'я",
      vacationNo: "перша відпустка",
      startDate: date(2026, 7, 10),
      endDate: date(2026, 7, 12),
      active: true,
      operationalActive: true,
      factExpected: true,
      _meta: { sheetName: "VACATION", rowNumber: 2 },
    },
    overrides,
  );
}

function reset({ allowed, codes, rows } = {}) {
  documentProps.clear();
  activeSheet = new FakeSheet({ allowed, codes });
  vacationRows = rows || [vacation()];
  return activeSheet;
}

let sheet = reset();
let result = context.VacationMonthlySync_.sync({ sheet, source: "test" });
assert.equal(result.autoFillApplied, 3, "empty approved vacation cells must be auto-filled");
assert.deepEqual(
  sheet.getRange("C2:E2").getValues()[0],
  ["Відпус", "Відпус", "Відпус"],
  "monthly cells must receive the allowed vacation fact code",
);

result = context.VacationMonthlySync_.sync({ sheet, source: "test" });
assert.equal(result.autoFillApplied, 0, "second sync must be idempotent");
assert.equal(result.stats.unchanged, 3, "second sync must recognize already synced cells");

sheet = reset({ codes: ["БР", "", ""], rows: [vacation({ endDate: date(2026, 7, 10) })] });
result = context.VacationMonthlySync_.sync({ sheet, source: "test" });
assert.equal(result.pendingUserDecision, true, "different filled cells must become pending conflicts");
assert.equal(sheet.getRange("C2:E2").getValues()[0][0], "БР", "conflict must not overwrite filled cell");
assert.equal(result.stats.conflicts, 1);
const conflictPlanId = result.planId;
let decision = context.VacationMonthlySync_.resolveDecisions({
  planId: conflictPlanId,
  action: "applyAll",
});
assert.equal(decision.applied, 1, "confirmed conflict must be applied");
assert.equal(sheet.getRange("C2:E2").getValues()[0][0], "Відпус");
assert.match(
  sheet.getRange("C2:E2").getNotes()[0][0],
  /Попереднє значення: БР/,
  "confirmed replacement must preserve an audit note with previous value",
);

sheet = reset({ allowed: ["БР"], rows: [vacation({ endDate: date(2026, 7, 10) })] });
result = context.VacationMonthlySync_.sync({ sheet, source: "test" });
assert.equal(result.stats.unsupported, 1, "unsupported dropdown value must be reported");
assert.equal(sheet.getRange("C2:E2").getValues()[0][0], "", "unsupported value must not be written");

sheet = reset({ rows: [vacation({ endDate: date(2026, 7, 10) })] });
result = context.VacationMonthlySync_.sync({ sheet, source: "test" });
assert.equal(result.autoFillApplied, 1);
vacationRows = [];
result = context.VacationMonthlySync_.sync({ sheet, source: "test" });
assert.equal(result.stats.removals, 1, "missing source record with sync metadata must become pending removal");
assert.equal(sheet.getRange("C2:E2").getValues()[0][0], "Відпус", "removal must wait for confirmation");
decision = context.VacationMonthlySync_.resolveDecisions({
  planId: result.planId,
  action: "applyAll",
});
assert.equal(decision.applied, 1);
assert.equal(sheet.getRange("C2:E2").getValues()[0][0], "", "confirmed removal must clear only synced cell");

sheet = reset({ rows: [vacation({ personKey: "НЕМАЄ", fml: "Немає Людини" })] });
result = context.VacationMonthlySync_.sync({ sheet, source: "test" });
assert.equal(result.stats.unresolved, 1, "unknown people must be reported as unresolved");

sheet = reset({
  rows: [
    vacation({
      startDate: date(2026, 7, 12),
      endDate: date(2026, 7, 10),
    }),
  ],
});
result = context.VacationMonthlySync_.sync({ sheet, source: "test" });
assert.equal(result.stats.invalid, 1, "invalid date ranges must be reported");

console.log("verify-vacation-monthly-sync: OK");

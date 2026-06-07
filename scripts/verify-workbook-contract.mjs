#!/usr/bin/env node
/**
 * Workbook regression checks that can run without Google Apps Script.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const repoRoot = path.resolve(import.meta.dirname, "..");

function columnNumberToLetter(value) {
  let n = Number(value);
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function parseA1(value) {
  const match = String(value).match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
  if (!match) throw new Error(`Unsupported A1 range: ${value}`);
  const toNumber = (letters) =>
    String(letters)
      .toUpperCase()
      .split("")
      .reduce((sum, ch) => sum * 26 + ch.charCodeAt(0) - 64, 0);
  return {
    row: Number(match[2]),
    col: toNumber(match[1]),
    numRows: Number(match[4]) - Number(match[2]) + 1,
    numCols: toNumber(match[3]) - toNumber(match[1]) + 1,
  };
}

class FakeRange {
  constructor(sheet, row, col, numRows = 1, numCols = 1) {
    this.sheet = sheet;
    this.row = row;
    this.col = col;
    this.numRows = numRows;
    this.numCols = numCols;
  }

  getRow() {
    return this.row;
  }

  getColumn() {
    return this.col;
  }

  getLastColumn() {
    return this.col + this.numCols - 1;
  }

  getNumRows() {
    return this.numRows;
  }

  getNumColumns() {
    return this.numCols;
  }

  getValue() {
    return this.sheet.valueAt(this.row, this.col);
  }

  getDisplayValue() {
    return String(this.getValue() ?? "");
  }

  getDisplayValues() {
    return Array.from({ length: this.numRows }, (_, rowOffset) =>
      Array.from({ length: this.numCols }, (_, colOffset) =>
        String(
          this.sheet.valueAt(this.row + rowOffset, this.col + colOffset) ?? "",
        ),
      ),
    );
  }
}

class FakeSheet {
  constructor(name, rows) {
    this.name = name;
    this.rows = rows;
  }

  getName() {
    return this.name;
  }

  getLastRow() {
    return this.rows.length - 1;
  }

  getLastColumn() {
    return Math.max(...this.rows.map((row) => row.length - 1));
  }

  valueAt(row, col) {
    return (this.rows[row] || [])[col];
  }

  getRange(rowOrA1, col, numRows, numCols) {
    if (typeof rowOrA1 === "string") {
      const parsed = parseA1(rowOrA1);
      return new FakeRange(
        this,
        parsed.row,
        parsed.col,
        parsed.numRows,
        parsed.numCols,
      );
    }
    return new FakeRange(this, rowOrA1, col, numRows, numCols);
  }
}

function buildCompactJuneSheet() {
  const rows = Array.from({ length: 45 }, () => Array(33).fill(""));
  rows[1][1] = "BRDays";
  rows[1][2] = "Callsign";
  for (let col = 3; col <= 32; col++) {
    rows[1][col] = `${String(col - 2).padStart(2, "0")}.06.2026`;
  }

  for (let row = 2; row <= 30; row++) {
    rows[row][1] = row % 3 === 0 ? 0 : 10;
    rows[row][2] = `CALLSIGN_${String(row - 1).padStart(2, "0")}`;
    rows[row][3] = "Резерв";
  }

  [
    "За_списком",
    "В_наявності",
    "Гусачівка",
    "Відпустка",
    "ППД",
    "КП",
    "БР",
    "Відкомандеровані",
    "БЗВП",
    "Лікарняний",
    "СЗЧ",
  ].forEach((label, index) => {
    const row = 34 + index;
    rows[row][2] = label;
    rows[row][3] = index === 0 ? 29 : index;
  });

  return new FakeSheet("06", rows);
}

function loadWorkbookFunctions() {
  const context = vm.createContext({
    console,
    CONFIG: {
      CODE_RANGE_A1: "C2:AF30",
      DATE_ROW: 1,
      CALLSIGN_COL: 2,
      LAST_DATA_ROW: 30,
    },
    MONTHLY_CONFIG: { LAST_DATA_ROW: 30 },
    VACATION_ENGINE_CONFIG: {},
    DateUtils_: {
      normalizeDate(_value, displayValue) {
        return String(displayValue || "");
      },
    },
    FULL_NAMES: { ОС: "Особовий склад" },
    SUMMARY_GROUPS: { Резерв: ["Резерв"] },
  });

  for (const file of ["SheetSchemas.gs", "Summaries.gs"]) {
    vm.runInContext(
      fs.readFileSync(path.join(repoRoot, file), "utf8"),
      context,
      {
        filename: file,
      },
    );
  }
  return context;
}

const context = loadWorkbookFunctions();
const sheet = buildCompactJuneSheet();
const layout = context.detectMonthlyLayoutFromSheet_(sheet);

assert.equal(layout.layout, "compact");
assert.equal(layout.codeRangeA1, "C2:AF30");
assert.equal(
  context.countMonthlyScheduleRowsForColumn_(sheet, 3),
  29,
  "compact monthly footer rows must not be counted as personnel",
);

const summary = context.buildDaySummaryForColumn_(sheet, 3);
assert.match(summary, /Особовий склад — 29/);
assert.doesNotMatch(summary, /Особовий склад — 40/);

console.log(
  `verify-workbook-contract: OK (${sheet.getName()} ${layout.codeRangeA1}, personnel=29)`,
);

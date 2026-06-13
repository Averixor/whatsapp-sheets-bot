#!/usr/bin/env node
/**
 * Verifies PERSONNEL reference-workbook layout support without Apps Script.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const repoRoot = path.resolve(import.meta.dirname, "..");
const source = fs.readFileSync(
  path.join(repoRoot, "PersonnelRepository.gs"),
  "utf8",
);

class FakeRange {
  constructor(sheet, row, column, numRows = 1, numColumns = 1) {
    this.sheet = sheet;
    this.row = row;
    this.column = column;
    this.numRows = numRows;
    this.numColumns = numColumns;
  }

  getDisplayValues() {
    return Array.from({ length: this.numRows }, (_, rowOffset) =>
      Array.from({ length: this.numColumns }, (_, columnOffset) =>
        String(
          this.sheet.valueAt(this.row + rowOffset, this.column + columnOffset) ??
            "",
        ),
      ),
    );
  }
}

class FakeSheet {
  constructor(name, rows) {
    this.name = name;
    this.rows = rows.map((row) => row.slice());
  }

  getLastRow() {
    return this.rows.length;
  }

  getLastColumn() {
    return Math.max(...this.rows.map((row) => row.length));
  }

  valueAt(row, column) {
    return (this.rows[row - 1] || [])[column - 1] ?? "";
  }

  getRange(row, column, numRows, numColumns) {
    return new FakeRange(this, row, column, numRows, numColumns);
  }
}

class FakeSpreadsheet {
  constructor(sheets) {
    this.sheets = new Map(sheets.map((sheet) => [sheet.name, sheet]));
  }

  getSheetByName(name) {
    return this.sheets.get(name) || null;
  }
}

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function loadPersonnelRepository(sheet) {
  const spreadsheet = new FakeSpreadsheet([sheet]);
  const context = vm.createContext({
    CONFIG: { PERSONNEL_SHEET: "PERSONNEL" },
    Logger: { log() {} },
    console,
    getWasbSpreadsheet_() {
      return spreadsheet;
    },
    _normCallsignKey_: normalizeKey,
    _normFml_(value) {
      return String(value || "")
        .trim()
        .toLowerCase();
    },
    _normFmlForProfiles_: normalizeKey,
    normalizeFML_(value) {
      return String(value || "")
        .trim()
        .toLowerCase();
    },
    normalizePhone_(value) {
      return String(value || "").replace(/\D+/g, "");
    },
  });

  vm.runInContext(source, context, { filename: "PersonnelRepository.gs" });
  return context;
}

const referenceWorkbookSheet = new FakeSheet("PERSONNEL", [
  [
    "Last name",
    "First name",
    "Patronymic",
    "Birthday",
    "Phone",
    "2 Phone",
    "TEMPLATE",
    "Rank",
    "Position",
    "OSH 4",
    "Unit",
    "Status",
  ],
  [
    "Іваненко",
    "Петро",
    "Олегович",
    "15.04.1990",
    "+380 50 111 22 33",
    "+380 67 444 55 66",
    "РОЛАНД",
    "солдат",
    "стрілець",
    "4",
    "1 взвод",
    "",
  ],
  [
    "Сидоренко",
    "Іван",
    "",
    "01.12.1988",
    "+380 99 000 11 22",
    "",
    "МАРС",
    "сержант",
    "командир",
    "4",
    "1 взвод",
    "СЗЧ",
  ],
]);

const context = loadPersonnelRepository(referenceWorkbookSheet);
const allRows = context.getPersonnelRows_();
const activeRows = context.getPersonnelActiveRows_();

assert.equal(allRows.length, 2, "reference layout rows must load");
assert.equal(activeRows.length, 1, "inactive statuses must be excluded");

const activeByCallsign = context.getPersonnelByCallsign_("роланд");
assert.ok(activeByCallsign, "TEMPLATE must work as active callsign lookup key");
assert.equal(activeByCallsign.fml, "Іваненко Петро Олегович");
assert.equal(activeByCallsign.callsign, "РОЛАНД");
assert.equal(activeByCallsign.title, "солдат", "Rank must populate title");
assert.equal(activeByCallsign.rank, "солдат");
assert.equal(activeByCallsign.oshs, "4", "OSH 4 alias must populate OSH_4");
assert.equal(activeByCallsign.phone2, "+380 67 444 55 66");
assert.equal(activeByCallsign.status, "В наявності", "empty status defaults active");

assert.equal(
  context.getPersonnelByCallsign_("марс"),
  null,
  "inactive TEMPLATE callsign must not appear in active lookup",
);
assert.equal(
  context.getPersonnelByCallsignAnyStatus_("марс").fml,
  "Сидоренко Іван",
  "any-status lookup must still find inactive TEMPLATE callsigns",
);

const phoneIndex = context.buildPhonesIndexFromPersonnel_();
assert.equal(phoneIndex.items.length, 1, "phone index must use active rows only");
assert.equal(phoneIndex.byCallsign.РОЛАНД.fml, "Іваненко Петро Олегович");
assert.equal(phoneIndex.byPhone["380501112233"].callsign, "РОЛАНД");

console.log(
  `verify-personnel-workbook-layout: OK (rows=${allRows.length}, active=${activeRows.length}, templateCallsign=${activeByCallsign.callsign})`,
);

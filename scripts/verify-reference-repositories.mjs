#!/usr/bin/env node
/**
 * Focused parser checks for optional reference sheets.
 */
import assert from "node:assert/strict";
import path from "node:path";
import vm from "node:vm";
import { loadContract } from "./lib/load-contract.mjs";
import { readRepoFileByBasename } from "./lib/gas-files.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const contract = loadContract("reference-repositories.contract.json");

function readGasByBasename(fileName) {
  return readRepoFileByBasename(repoRoot, fileName, {
    errorPrefix: "verify-reference-repositories",
  });
}

class FakeRange {
  constructor(sheet, row, col, numRows = 1, numCols = 1) {
    this.sheet = sheet;
    this.row = row;
    this.col = col;
    this.numRows = numRows;
    this.numCols = numCols;
  }

  getDisplayValues() {
    return Array.from({ length: this.numRows }, (_, rowOffset) =>
      Array.from({ length: this.numCols }, (_, colOffset) =>
        String(this.sheet.valueAt(this.row + rowOffset, this.col + colOffset) ?? ""),
      ),
    );
  }
}

class FakeSheet {
  constructor(name, sourceRows) {
    this.name = name;
    this.rows = [null, ...sourceRows.map((row) => [null, ...row])];
  }

  getLastRow() {
    return this.rows.length - 1;
  }

  getLastColumn() {
    return Math.max(0, ...this.rows.slice(1).map((row) => row.length - 1));
  }

  getRange(row, col, numRows, numCols) {
    return new FakeRange(this, row, col, numRows, numCols);
  }

  valueAt(row, col) {
    return (this.rows[row] || [])[col];
  }
}

class FakeSpreadsheet {
  constructor(sheets) {
    this.sheets = sheets;
  }

  getSheetByName(name) {
    return this.sheets[name] || null;
  }
}

function normalizePhoneForTest(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10 && digits.startsWith("0")) return `+38${digits}`;
  return digits.startsWith("+") ? digits : `+${digits}`;
}

function loadRepository(spreadsheet) {
  const context = vm.createContext({
    console,
    CONFIG: {
      PHONE_DIRECTORY_SHEET: contract.repositories.phoneDirectory.sheetName,
      CAR_SHEET: contract.repositories.carsRegister.sheetName,
    },
    getWasbSpreadsheet_: () => spreadsheet,
    normalizePhone_: normalizePhoneForTest,
  });
  const source = readGasByBasename("DictionaryRepository.gs");
  assert.match(source, /ReferenceSheetsRepository_/);
  assert.match(source, /readPhoneDirectory/);
  assert.match(source, /readCarsRegister/);
  vm.runInContext(source, context, {
    filename: "DictionaryRepository.gs",
  });
  return context;
}

const phoneContract = contract.repositories.phoneDirectory;
const carContract = contract.repositories.carsRegister;
const spreadsheet = new FakeSpreadsheet({
  [phoneContract.sheetName]: new FakeSheet(
    phoneContract.sheetName,
    phoneContract.fixtureRows,
  ),
  [carContract.sheetName]: new FakeSheet(
    carContract.sheetName,
    carContract.fixtureRows,
  ),
});

const context = loadRepository(spreadsheet);

const phoneDirectory = vm.runInContext(
  "ReferenceSheetsRepository_.readPhoneDirectory()",
  context,
);
assert.equal(phoneDirectory.items.length, phoneContract.expected.items.length);
phoneContract.expected.items.forEach((expected, index) => {
  assert.equal(phoneDirectory.items[index].section, expected.section);
  assert.equal(phoneDirectory.items[index].name, expected.name);
  assert.equal(phoneDirectory.items[index].phone, expected.phone);
});
assert.equal(
  phoneDirectory.stats.contacts,
  phoneContract.expected.stats.contacts,
);
assert.equal(
  phoneDirectory.stats.sections,
  phoneContract.expected.stats.sections,
);
phoneContract.expected.excludedHeaderMarkers.forEach((marker) => {
  assert.equal(
    phoneDirectory.items.some(
      (item) => item.name === marker || item.phoneDisplay === marker,
    ),
    false,
  );
});

const carsRegister = vm.runInContext(
  "ReferenceSheetsRepository_.readCarsRegister()",
  context,
);
assert.equal(carsRegister.items.length, carContract.expected.itemCount);
assert.deepEqual(
  Array.from(carsRegister.items.map((item) => item.assetName)),
  carContract.expected.assetNames,
);
assert.equal(carsRegister.stats.total, carContract.expected.stats.total);
assert.equal(carsRegister.stats.assigned, carContract.expected.stats.assigned);
assert.equal(
  carsRegister.stats.unassigned,
  carContract.expected.stats.unassigned,
);
assert.equal(
  carsRegister.stats.totalCost,
  carContract.expected.stats.totalCost,
);
assert.equal(carsRegister.warnings.length, 1);
assert.match(
  carsRegister.warnings[0],
  new RegExp(carContract.expected.warningPattern),
);
assert.equal(carsRegister.items.some((item) => !item.assetName), false);
assert.deepEqual(
  Array.from(carsRegister.items.map((item) => item.status)),
  carContract.expected.normalizedStatuses,
);
assert.equal(
  carsRegister.items[carContract.expected.statusDescriptionAtIndex.index]
    .statusDescription,
  carContract.expected.statusDescriptionAtIndex.value,
);
assert.equal(
  carsRegister.stats.byStatus.map((entry) => `${entry.name}:${entry.count}`).join(","),
  carContract.expected.byStatus.join(","),
);
assert.equal(carsRegister.items[1].searchText.includes("обмежено бг"), true);
assert.equal(
  carsRegister.items[carContract.expected.searchIncludesAtIndex.index].searchText.includes(
    carContract.expected.searchIncludesAtIndex.value,
  ),
  true,
);

console.log(
  `verify-reference-repositories: OK (${phoneContract.sheetName}, ${carContract.sheetName})`,
);

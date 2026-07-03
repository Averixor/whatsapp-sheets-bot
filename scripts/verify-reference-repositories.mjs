#!/usr/bin/env node
/**
 * Focused parser checks for optional reference sheets.
 */
import assert from "node:assert/strict";
import path from "node:path";
import vm from "node:vm";
import { readRepoFileByBasename } from "./lib/gas-files.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

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
      PHONE_DIRECTORY_SHEET: "PHONE_DIRECTORY",
      CAR_SHEET: "CAR",
    },
    getWasbSpreadsheet_: () => spreadsheet,
    normalizePhone_: normalizePhoneForTest,
  });
  vm.runInContext(readGasByBasename("DictionaryRepository.gs"), context, {
    filename: "DictionaryRepository.gs",
  });
  return context;
}

const spreadsheet = new FakeSpreadsheet({
  PHONE_DIRECTORY: new FakeSheet("PHONE_DIRECTORY", [
    ["Phone / Section", "Name / Note"],
    ["Командування", ""],
    ["+380671112233", "Черговий частини"],
    ["067 444 55 66", "Медик"],
  ]),
  CAR: new FakeSheet("CAR", [
    ["П.І.Б", "Найменування військового майна", "Військовий номер", "Номер шасі", "Рік випуску", "Вартість", "Стан"],
    ["Іваненко Іван Іванович", "Автомобіль легковий", "АА0001", "VIN001", "2020", "100 000,50", "Справна"],
    ["Петренко Петро Петрович", "", "АА0002", "VIN002", "2019", "50000", "Не БГ (ремонт)"],
    ["—", "Мотоцикл", "", "VIN003", "2021", "75000", "Обмежено БГ — потрібен ремонт."],
    ["Сидоренко С.С.", "Вантажний автомобіль", "АА0004", "VIN004", "2018", "25000", "Справна (БГ)."],
  ]),
});

const context = loadRepository(spreadsheet);

const phoneDirectory = vm.runInContext(
  "ReferenceSheetsRepository_.readPhoneDirectory()",
  context,
);
assert.equal(phoneDirectory.items.length, 2);
assert.equal(phoneDirectory.items[0].section, "Командування");
assert.equal(phoneDirectory.items[0].name, "Черговий частини");
assert.equal(phoneDirectory.items[0].phone, "+380671112233");
assert.equal(phoneDirectory.items[1].phone, "+380674445566");
assert.equal(phoneDirectory.stats.contacts, 2);
assert.equal(phoneDirectory.stats.sections, 1);
assert.equal(
  phoneDirectory.items.some((item) => item.name === "Name / Note" || item.phoneDisplay === "Phone / Section"),
  false,
);

const carsRegister = vm.runInContext(
  "ReferenceSheetsRepository_.readCarsRegister()",
  context,
);
assert.equal(carsRegister.items.length, 3);
assert.deepEqual(
  Array.from(carsRegister.items.map((item) => item.assetName)),
  ["Автомобіль легковий", "Мотоцикл", "Вантажний автомобіль"],
);
assert.equal(carsRegister.stats.total, 3);
assert.equal(carsRegister.stats.assigned, 2);
assert.equal(carsRegister.stats.unassigned, 1);
assert.equal(carsRegister.stats.totalCost, 200000.5);
assert.equal(carsRegister.warnings.length, 1);
assert.match(carsRegister.warnings[0], /Пропущено рядків без найменування майна: 1/);
assert.equal(carsRegister.items.some((item) => !item.assetName), false);
assert.deepEqual(
  Array.from(carsRegister.items.map((item) => item.status)),
  ["Справна", "Обмежено БГ", "Справна"],
);
assert.equal(carsRegister.items[1].statusDescription, "Потрібен ремонт.");
assert.equal(
  carsRegister.stats.byStatus.map((entry) => `${entry.name}:${entry.count}`).join(","),
  "Справна:2,Обмежено БГ:1",
);
assert.equal(carsRegister.items[1].searchText.includes("обмежено бг"), true);

console.log("verify-reference-repositories: OK (PHONE_DIRECTORY header, CAR assetName/status)");

#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const repoRoot = path.resolve(import.meta.dirname, "..");
const source = fs.readFileSync(
  path.join(repoRoot, "Calculation_OS.gs"),
  "utf8",
);
const FIXED_NOW = "2026-06-12T12:00:00.000Z";

class FixedDate extends Date {
  constructor(...args) {
    super(...(args.length ? args : [FIXED_NOW]));
  }
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatDate(value, _timezone, format) {
  const date = new Date(value);
  const parts = {
    yyyy: String(date.getUTCFullYear()),
    MM: pad(date.getUTCMonth() + 1),
    dd: pad(date.getUTCDate()),
  };
  return format.replace(/yyyy|MM|dd/g, (token) => parts[token]);
}

function display(value) {
  if (value instanceof Date) return formatDate(value, "UTC", "dd.MM.yyyy");
  return String(value == null ? "" : value);
}

function columnLetters(column) {
  let n = column;
  let out = "";
  while (n > 0) {
    out = String.fromCharCode(65 + ((n - 1) % 26)) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

class FakeRange {
  constructor(sheet, row, column, numRows = 1, numColumns = 1) {
    this.sheet = sheet;
    this.row = row;
    this.column = column;
    this.numRows = numRows;
    this.numColumns = numColumns;
  }

  getValues() {
    return Array.from({ length: this.numRows }, (_, rowOffset) =>
      Array.from({ length: this.numColumns }, (_, columnOffset) =>
        this.sheet.valueAt(this.row + rowOffset, this.column + columnOffset),
      ),
    );
  }

  getDisplayValues() {
    return this.getValues().map((row) => row.map(display));
  }

  getValue() {
    return this.sheet.valueAt(this.row, this.column);
  }

  getDisplayValue() {
    return display(this.getValue());
  }

  setValue(value) {
    this.sheet.setValue(this.row, this.column, value);
    return this;
  }

  setValues(values) {
    values.forEach((row, rowOffset) => {
      row.forEach((value, columnOffset) => {
        this.sheet.setValue(
          this.row + rowOffset,
          this.column + columnOffset,
          value,
        );
      });
    });
    return this;
  }

  getNotes() {
    return Array.from({ length: this.numRows }, (_, rowOffset) =>
      Array.from({ length: this.numColumns }, (_, columnOffset) =>
        this.sheet.noteAt(this.row + rowOffset, this.column + columnOffset),
      ),
    );
  }

  getNote() {
    return this.sheet.noteAt(this.row, this.column);
  }

  setNote(note) {
    this.sheet.setNote(this.row, this.column, note);
    return this;
  }

  setNumberFormat() {
    return this;
  }

  getA1Notation() {
    return `${columnLetters(this.column)}${this.row}`;
  }
}

class FakeSheet {
  constructor(name, rows = [], maxRows = 100, maxColumns = 40) {
    this.name = name;
    this.values = rows.map((row) => row.slice());
    this.notes = [];
    this.maxRows = maxRows;
    this.maxColumns = maxColumns;
  }

  getName() {
    return this.name;
  }

  valueAt(row, column) {
    return (this.values[row - 1] || [])[column - 1] ?? "";
  }

  noteAt(row, column) {
    return (this.notes[row - 1] || [])[column - 1] ?? "";
  }

  setValue(row, column, value) {
    while (this.values.length < row) this.values.push([]);
    while (this.values[row - 1].length < column) {
      this.values[row - 1].push("");
    }
    this.values[row - 1][column - 1] = value;
    this.maxRows = Math.max(this.maxRows, row);
    this.maxColumns = Math.max(this.maxColumns, column);
  }

  setNote(row, column, value) {
    while (this.notes.length < row) this.notes.push([]);
    while (this.notes[row - 1].length < column) this.notes[row - 1].push("");
    this.notes[row - 1][column - 1] = value;
  }

  getRange(row, column, numRows, numColumns) {
    return new FakeRange(this, row, column, numRows, numColumns);
  }

  getLastRow() {
    let last = 0;
    this.values.forEach((row, index) => {
      if (row.some((value) => value !== "" && value != null)) last = index + 1;
    });
    return last;
  }

  getLastColumn() {
    let last = 0;
    this.values.forEach((row) => {
      row.forEach((value, index) => {
        if (value !== "" && value != null) last = Math.max(last, index + 1);
      });
    });
    return last;
  }

  getMaxRows() {
    return this.maxRows;
  }

  getMaxColumns() {
    return this.maxColumns;
  }

  insertRowsAfter(_row, count) {
    this.maxRows += count;
  }

  insertColumnsAfter(_column, count) {
    this.maxColumns += count;
  }

  insertRowBefore(row) {
    this.values.splice(row - 1, 0, []);
    this.notes.splice(row - 1, 0, []);
    this.maxRows++;
  }

  setFrozenRows() {}

  setFrozenColumns() {}
}

class FakeSpreadsheet {
  constructor(sheets) {
    this.sheets = sheets;
  }

  getId() {
    return "spreadsheet-id";
  }

  getSpreadsheetTimeZone() {
    return "UTC";
  }

  getSheetByName(name) {
    return this.sheets.find((sheet) => sheet.getName() === name) || null;
  }

  getSheets() {
    return this.sheets.slice();
  }

  insertSheet(name) {
    const sheet = new FakeSheet(name);
    this.sheets.push(sheet);
    return sheet;
  }
}

function monthlyRow(callsign, code, brDays = "10") {
  const row = Array(32).fill("");
  row[0] = brDays;
  row[1] = callsign;
  row[13] = code;
  return row;
}

const personnel = new FakeSheet("PERSONNEL", [
  ["Cells", "", "", "Last name"],
  ["001", "", "", "Alpha"],
  ["002", "", "", "Beta"],
  ["003", "", "", ""],
]);

const dictionaryCodes = [
  ["Black", "Екіпаж Чорний", 10],
  ["Roland", "Екіпаж Роланд", 15],
  ["БР", "Бойове розпорядження", 20],
  ["Евак", "Медевак", 25],
  ["КП", "Командний пункт", 105],
  ["Резерв", "Резерв", 140],
  ["1РБпАК", "Охорона 1 РБпАК", 30],
  ["2РБпАК", "Охорона 2 РБпАК", 35],
  ["1УРБпАК", "Охорона 1 УРБпАК", 40],
  ["2УРБпАК", "Охорона 2 УРБпАК", 100],
  ["*ВЗ", "Підпорядкований взводу зв'язку", 145],
  ["*ВМЗ", "Підпорядкований взводу МЗ", 150],
  ["*1РБпАК", "Підпорядкований 1 РБпАК", 155],
  ["*2РБпАК", "Підпорядкований 2 РБпАК", 160],
  ["*1УРБпАК", "Підпорядкований 1 УРБпАК", 165],
  ["*2УРБпАК", "Підпорядкований 2 УРБпАК", 200],
  ["Відряд", "У відрядженні", 205],
  ["Відпус", "Відпустка", 210],
  ["Лікарн", "Лікарняний", 215],
  ["Київ", "ППД Київ", 220],
  ["Гусачі", "Гусачівка", 225],
  ["Гусачі ЧБ", "Чекає БЗВП", 230],
  ["Гусачі ОД", "Одягається", 235],
  ["Гусачі ДК", "Дрон кемп", 240],
  ["БЗВП", "Базова військова підготовка", 245],
  ["СЗЧ", "Самовільне залишення частини", 300],
  ["Вибув", "Вибув", 333],
];
const dictionary = new FakeSheet("DICT_SUM", [
  ["Код", "Вид служби", "Порядок"],
  ...dictionaryCodes,
]);

const monthHeader = ["БР", "Позивний"];
for (let day = 1; day <= 30; day++) {
  monthHeader.push(new FixedDate(Date.UTC(2026, 5, day, 12)));
}
const month = new FakeSheet("06", [
  monthHeader,
  monthlyRow("A", "БР"),
  monthlyRow("B", "*ВЗ"),
  monthlyRow("C", "*ВМЗ"),
  monthlyRow("D", "Відряд"),
  monthlyRow("E", "Гусачі"),
  monthlyRow("F", "Гусачі ЧБ"),
  monthlyRow("G", "2РБпАК"),
  monthlyRow("", 999),
  (() => {
    const footer = Array(32).fill("");
    footer[1] = "За_списком";
    footer[13] = "БР";
    return footer;
  })(),
]);

const output = new FakeSheet("Calculation_OS", [[]]);
const spreadsheet = new FakeSpreadsheet([month, personnel, dictionary, output]);
const propertyValues = new Map();
let activeSpreadsheet = spreadsheet;
let triggers = [
  {
    handler: "unrelatedHandler",
    getHandlerFunction() {
      return this.handler;
    },
  },
  {
    handler: "Calculation_OS_runDaily",
    getHandlerFunction() {
      return this.handler;
    },
  },
];
let triggerSchedule = null;

const context = vm.createContext({
  console,
  Date: FixedDate,
  Utilities: { formatDate },
  Session: { getScriptTimeZone: () => "UTC" },
  SpreadsheetApp: {
    getActiveSpreadsheet: () => activeSpreadsheet,
    openById: (id) => {
      assert.equal(id, "spreadsheet-id");
      return spreadsheet;
    },
  },
  PropertiesService: {
    getScriptProperties() {
      return {
        getProperty: (key) => propertyValues.get(key) || null,
        setProperty: (key, value) => propertyValues.set(key, value),
      };
    },
  },
  LockService: {
    getDocumentLock() {
      return {
        tryLock: () => true,
        releaseLock() {},
      };
    },
  },
  ScriptApp: {
    getProjectTriggers: () => triggers.slice(),
    deleteTrigger(trigger) {
      triggers = triggers.filter((item) => item !== trigger);
    },
    newTrigger(handler) {
      const schedule = { handler };
      const builder = {
        timeBased() {
          return this;
        },
        everyDays(days) {
          schedule.days = days;
          return this;
        },
        atHour(hour) {
          schedule.hour = hour;
          return this;
        },
        nearMinute(minute) {
          schedule.minute = minute;
          return this;
        },
        create() {
          const trigger = {
            handler,
            getHandlerFunction() {
              return this.handler;
            },
            getUniqueId: () => "new-trigger-id",
          };
          triggers.push(trigger);
          triggerSchedule = schedule;
          return trigger;
        },
      };
      return builder;
    },
  },
  getTomorrowReportDate_: () => {
    const d = new FixedDate();
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    return d;
  },
  findDayColumn_: (sheet, headerRow, targetDate) => {
    const targetDay = targetDate.getDate();
    const lastCol = sheet.getLastColumn();
    const headers = sheet
      .getRange(headerRow, 1, 1, lastCol)
      .getDisplayValues()[0];
    const index = headers.findIndex(
      (v) => Number(String(v).trim()) === targetDay,
    );
    if (index === -1)
      throw new Error(`Не знайдено колонку для дня ${targetDay}`);
    return index + 1;
  },
});

vm.runInContext(source, context, { filename: "Calculation_OS.gs" });
const runDaily = vm.runInContext("Calculation_OS_runDaily", context);
const installTrigger = vm.runInContext(
  "Calculation_OS_installDailyTrigger",
  context,
);

const first = JSON.parse(JSON.stringify(runDaily()));
assert.equal(first.recorded, true);
assert.equal(first.date, "2026-06-12");
assert.equal(first.sourceSheet, "06");
assert.equal(first.sourceDateColumn, 14);
assert.deepEqual(first.personnel, { cells: 3, lastName: 2 });
assert.equal(first.countedCodes, 7, "numeric summary cells must be ignored");

const labels = output
  .getRange(2, 1, output.getLastRow() - 1, 1)
  .getDisplayValues();
const dayValues = output
  .getRange(2, 13, output.getLastRow() - 1, 1)
  .getValues()
  .map((row) => row[0]);
const rows = labels.map((row, index) => [row[0], dayValues[index]]);
assert.deepEqual(rows.slice(0, 2), [
  ["За штатом", 3],
  ["За списком", 2],
]);
assert.ok(
  rows.some(([label, value]) => label === "Відкомандеровані" && value === 3),
);
assert.ok(
  rows.some(([label, value]) => label === "Охорона позиції" && value === 1),
);
assert.ok(rows.some(([label, value]) => label === "Гусачівка" && value === 2));
assert.ok(rows.some(([label, value]) => label === "Гусачівка" && value === 1));
assert.ok(
  dayValues.every((value) => Number(value) > 0),
  "zero metrics must be absent",
);

for (let column = 2; column <= 32; column++) {
  if (column === 13) continue;
  assert.ok(
    output
      .getRange(2, column, output.getLastRow() - 1, 1)
      .getValues()
      .every((row) => row[0] === ""),
    `day column ${column} must remain untouched`,
  );
}

month.setValue(2, 14, "Вибув");
activeSpreadsheet = null;
const second = JSON.parse(JSON.stringify(runDaily()));
assert.equal(second.recorded, false);
assert.equal(second.reason, "already-recorded");
assert.deepEqual(
  output
    .getRange(2, 13, output.getLastRow() - 1, 1)
    .getValues()
    .map((row) => row[0]),
  dayValues,
  "repeat run must not change the recorded date",
);

const installed = JSON.parse(JSON.stringify(installTrigger()));
assert.equal(installed.uniqueId, "new-trigger-id");
assert.deepEqual(triggerSchedule, {
  handler: "Calculation_OS_runDaily",
  days: 1,
  hour: 23,
  minute: 55,
});
assert.equal(
  triggers.filter(
    (trigger) => trigger.getHandlerFunction() === "unrelatedHandler",
  ).length,
  1,
  "unrelated triggers must remain untouched",
);
assert.equal(
  triggers.filter(
    (trigger) => trigger.getHandlerFunction() === "Calculation_OS_runDaily",
  ).length,
  1,
  "installer must leave exactly one owned trigger",
);

console.log(
  `verify-calculation-os: OK (metrics=${first.metrics}, countedCodes=${first.countedCodes})`,
);

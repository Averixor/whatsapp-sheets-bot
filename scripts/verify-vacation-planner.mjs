#!/usr/bin/env node
/**
 * Vacation planner contract checks that run without Google Apps Script.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const repoRoot = path.resolve(import.meta.dirname, "..");

function load(context, file) {
  vm.runInContext(fs.readFileSync(path.join(repoRoot, file), "utf8"), context, {
    filename: file,
  });
}

function date(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function vacation(fml, start, end, vacationNumber = 1) {
  return {
    fml,
    startDate: date(start),
    endDate: date(end),
    vacationNumber,
    active: true,
  };
}

const serviceContext = vm.createContext({ console, Date });
load(serviceContext, "VacationPlannerConfig.gs");
load(serviceContext, "VacationPlannerService.gs");
const service = vm.runInContext("VacationPlannerService_", serviceContext);
const plannerConfig = vm.runInContext(
  "VACATION_PLANNER_CONFIG",
  serviceContext,
);
const scheduleConfig = vm.runInContext(
  "VACATION_SCHEDULE_CONFIG",
  serviceContext,
);

assert.equal(plannerConfig.SHEETS.SOURCE, "VACATIONS");
assert.equal(scheduleConfig.SHEETS.SOURCE, "VACATIONS");
assert.equal(plannerConfig.OPTIONS.MAX_CANDIDATES, 500);

assert.equal(
  service.calculateEndDate(date("2026-01-10"), 15).getDate(),
  24,
  "vacation end date must be inclusive",
);
assert.equal(
  service.daysBetween(date("2026-03-28"), date("2026-03-29")),
  1,
  "date-only day difference must not drift around DST",
);

const clearOptions = service.suggestVacationOptions(
  {
    fml: "Тест Тест",
    vacationNumber: 1,
    desiredStart: "2026-07-10",
    durationDays: 15,
    searchWindow: 30,
  },
  [],
);
assert.equal(clearOptions.length, 5);
assert.equal(clearOptions[0].rank, 1);
assert.equal(clearOptions[0].startDate.getDate(), 10);
assert.equal(clearOptions[0].status, "VALID");

const startGapCheck = service.validateVacationOption(
  {
    fml: "Нова Людина",
    vacationNumber: 1,
    startDate: date("2026-07-10"),
    endDate: date("2026-07-24"),
  },
  [vacation("Інша Людина", "2026-07-11", "2026-07-25")],
);
assert.equal(startGapCheck.isValid, false);
assert.ok(startGapCheck.violations.some((item) => item.rule === "START_GAP"));

const concurrent = ["A", "B", "C", "D"].map((fml) =>
  vacation(fml, "2026-07-01", "2026-07-31"),
);
const concurrentCheck = service.validateVacationOption(
  {
    fml: "E",
    vacationNumber: 1,
    startDate: date("2026-07-10"),
    endDate: date("2026-07-24"),
  },
  concurrent,
);
assert.equal(concurrentCheck.isValid, false);
assert.ok(
  concurrentCheck.violations.some((item) => item.rule === "MAX_CONCURRENT"),
);

const personYearCheck = service.validateVacationOption(
  {
    fml: "Забагато Відпусток",
    vacationNumber: 1,
    startDate: date("2026-11-01"),
    endDate: date("2026-11-15"),
  },
  [
    vacation("Забагато Відпусток", "2026-01-01", "2026-01-15", 2),
    vacation("Забагато Відпусток", "2026-05-01", "2026-05-15", 2),
  ],
);
assert.equal(personYearCheck.isValid, false);
assert.ok(
  personYearCheck.violations.some((item) => item.rule === "MAX_PERSON_YEAR"),
);

const personGapCheck = service.validateVacationOption(
  {
    fml: "Своя Людина",
    vacationNumber: 2,
    startDate: date("2026-05-01"),
    endDate: date("2026-05-15"),
  },
  [vacation("Своя Людина", "2026-01-01", "2026-01-15", 1)],
);
assert.equal(personGapCheck.isValid, false);
assert.ok(personGapCheck.violations.some((item) => item.rule === "PERSON_GAP"));

const requestBase = {
  fml: "Нова Людина",
  vacationNumber: 1,
  desiredStart: date("2026-03-10"),
  durationDays: 15,
};
const unitLoad = [
  vacation("A", "2026-07-01", "2026-07-31"),
  vacation("B", "2026-07-01", "2026-07-31"),
  vacation("C", "2026-07-01", "2026-07-31"),
];
const quietOption = {
  fml: requestBase.fml,
  vacationNumber: 1,
  startDate: date("2026-03-10"),
  endDate: date("2026-03-24"),
};
const busyOption = {
  fml: requestBase.fml,
  vacationNumber: 1,
  startDate: date("2026-07-15"),
  endDate: date("2026-07-29"),
};
const quietValidation = service.validateVacationOption(quietOption, unitLoad);
const busyValidation = service.validateVacationOption(busyOption, unitLoad);
assert.equal(quietValidation.isValid, true);
assert.equal(busyValidation.isValid, true);
const quietScore = service.scoreVacationOption(
  quietOption,
  unitLoad,
  requestBase,
  quietValidation,
);
const busyScore = service.scoreVacationOption(
  busyOption,
  unitLoad,
  requestBase,
  busyValidation,
);
assert.ok(
  quietScore < busyScore,
  "scheduler must prefer lower unit load over higher peak periods",
);

const invalidDurationCheck = service.validateVacationOption(
  {
    fml: "Невірний Діапазон",
    vacationNumber: 1,
    startDate: date("2026-03-01"),
    endDate: date("2026-01-01"),
  },
  [],
);
assert.equal(invalidDurationCheck.isValid, false);
assert.ok(
  invalidDurationCheck.violations.some(
    (item) => item.rule === "INVALID_DURATION",
  ),
);

const replacementCheck = service.validateVacationOption(
  {
    fml: "Заміна Слота",
    vacationNumber: 1,
    startDate: date("2026-01-01"),
    endDate: date("2026-01-15"),
  },
  [
    vacation("Заміна Слота", "2026-02-01", "2026-02-15", 1),
    vacation("Заміна Слота", "2026-12-01", "2026-12-15", 2),
  ],
);
assert.equal(
  replacementCheck.isValid,
  true,
  "applying a candidate must replace its own vacation slot",
);

const audit = service.buildScheduleAudit(concurrent);
assert.equal(audit.schedule.length, 4);
assert.ok(
  !audit.checks.some((item) => item.rule === "MAX_CONCURRENT"),
  "four concurrent people are allowed",
);
const overloadedAudit = service.buildScheduleAudit([
  ...concurrent,
  vacation("E", "2026-07-01", "2026-07-31"),
]);
assert.ok(
  overloadedAudit.checks.some((item) => item.rule === "MAX_CONCURRENT"),
  "rebuild audit must report more than four concurrent people",
);

class FakeRange {
  constructor(sheet, row, col, numRows = 1, numCols = 1) {
    this.sheet = sheet;
    this.row = row;
    this.col = col;
    this.numRows = numRows;
    this.numCols = numCols;
  }

  getValue() {
    return this.sheet.valueAt(this.row, this.col);
  }

  getValues() {
    return Array.from({ length: this.numRows }, (_, rowOffset) =>
      Array.from({ length: this.numCols }, (_, colOffset) =>
        this.sheet.valueAt(this.row + rowOffset, this.col + colOffset),
      ),
    );
  }

  setValues(values) {
    values.forEach((sourceRow, rowOffset) => {
      sourceRow.forEach((value, colOffset) => {
        this.sheet.setValue(this.row + rowOffset, this.col + colOffset, value);
      });
    });
    return this;
  }

  setNumberFormat() {
    return this;
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
    return this.rows.length;
  }

  valueAt(row, col) {
    return (this.rows[row - 1] || [])[col - 1] ?? "";
  }

  setValue(row, col, value) {
    while (this.rows.length < row) this.rows.push([]);
    while (this.rows[row - 1].length < col) this.rows[row - 1].push("");
    this.rows[row - 1][col - 1] = value;
  }

  getRange(row, col, numRows, numCols) {
    return new FakeRange(this, row, col, numRows, numCols);
  }
}

const sourceRows = [Array(19).fill(""), Array(19).fill(""), Array(19).fill("")];
sourceRows[1].splice(
  0,
  9,
  "Перша Людина",
  date("2026-01-01"),
  date("2026-01-15"),
  "перша відпустка",
  true,
  true,
  15,
  "",
  "OK",
);
sourceRows[2].splice(
  10,
  9,
  "Друга Людина",
  date("2026-08-01"),
  date("2026-08-15"),
  "друга відпустка",
  true,
  true,
  15,
  "Київ",
  "OK",
);
const sourceSheet = new FakeSheet("VACATIONS", sourceRows);
let optionsSheet = null;
const spreadsheet = {
  getSheetByName(name) {
    if (name === "VACATIONS") return sourceSheet;
    if (name === "VACATION_OPTIONS") return optionsSheet;
    return null;
  },
  insertSheet(name) {
    assert.equal(name, "VACATIONS");
    return sourceSheet;
  },
};

const ioContext = vm.createContext({
  console,
  Date,
  DataAccess_: {
    getSheet() {
      return sourceSheet;
    },
    getSpreadsheet() {
      return spreadsheet;
    },
  },
  DateUtils_: {
    parseDateAny(value) {
      return value instanceof Date ? value : null;
    },
  },
  _normFml_(value) {
    return String(value || "")
      .trim()
      .toUpperCase();
  },
  _vacationWordToNumber_(value) {
    const text = String(value || "").toLowerCase();
    return text.includes("друг") ? 2 : text.includes("перш") ? 1 : 0;
  },
});
load(ioContext, "VacationPlannerConfig.gs");
load(ioContext, "VacationPlannerService.gs");
load(ioContext, "VacationsRepository.gs");
const repository = vm.runInContext("VacationsRepository_", ioContext);
const merged = repository.listAll();
assert.equal(merged.length, 2, "repository must merge A:I and K:S");
assert.equal(
  Array.from(merged, (item) => item._meta.startColumn).join(","),
  "1,11",
);

load(ioContext, "VacationOptionsWriter.gs");
const writer = vm.runInContext("VacationOptionsWriter_", ioContext);
const writeResult = writer.writeVacationToSource({
  fml: "Нова Друга",
  vacationNumber: 2,
  startDate: date("2026-10-01"),
  endDate: date("2026-10-15"),
  days: 15,
});
assert.equal(writeResult.startColumn, 11);
assert.equal(
  sourceSheet.valueAt(writeResult.rowNumber, 11),
  "Нова Друга",
  "second vacation must be written into K:S",
);
assert.equal(
  sourceSheet.valueAt(writeResult.rowNumber, 14),
  "друга відпустка",
  "vacation number must be stored as text",
);

const replacementWrite = writer.writeVacationToSource({
  fml: "Друга Людина",
  vacationNumber: 2,
  startDate: date("2026-09-01"),
  endDate: date("2026-09-15"),
  days: 15,
});
assert.equal(
  sourceSheet.valueAt(replacementWrite.rowNumber, 18),
  "Київ",
  "replacing a slot must preserve existing travel when no new value is supplied",
);

const optionHeader = [
  "Rank",
  "FML",
  "Vacation №",
  "Start date",
  "End date",
  "Days",
  "Score",
  "Status",
  "Explanation",
  "Apply",
];
optionsSheet = new FakeSheet("VACATION_OPTIONS", [
  optionHeader,
  [
    1,
    "Один",
    "перша відпустка",
    date("2026-10-01"),
    date("2026-10-15"),
    15,
    0,
    "Кращий",
    "",
    true,
  ],
  [
    2,
    "Два",
    "друга відпустка",
    date("2026-11-01"),
    date("2026-11-15"),
    15,
    10,
    "Допустимий",
    "",
    true,
  ],
]);
assert.throws(
  () => writer.readSelectedOption(),
  /рівно один/,
  "apply must reject multiple selected rows",
);

optionsSheet = new FakeSheet("VACATION_OPTIONS", [
  optionHeader,
  [
    1,
    "Один",
    "перша відпустка",
    date("2026-10-01"),
    date("2026-10-20"),
    15,
    0,
    "Кращий",
    "",
    true,
  ],
]);
assert.throws(
  () => writer.readSelectedOption(),
  /не відповідає тривалості/,
  "apply must reject a manually altered end date",
);

console.log("verify-vacation-planner: OK");

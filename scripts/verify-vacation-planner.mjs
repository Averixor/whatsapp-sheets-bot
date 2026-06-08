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
const declaredDaysAudit = service.buildScheduleAudit([
  {
    ...vacation("Невірний кінець", "2026-09-01", "2026-09-15"),
    declaredDurationDays: 10,
  },
]);
assert.ok(
  declaredDaysAudit.checks.some((item) => item.rule === "INVALID_DATE"),
  "audit must report when end date does not equal start date + days - 1",
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

  setValue(value) {
    this.sheet.setValue(this.row, this.col, value);
    return this;
  }

  clearContent() {
    this.sheet.setValue(this.row, this.col, "");
    return this;
  }

  getFormulas() {
    return Array.from({ length: this.numRows }, (_, rowOffset) =>
      Array.from({ length: this.numCols }, (_, colOffset) =>
        this.sheet.formulaAt(this.row + rowOffset, this.col + colOffset),
      ),
    );
  }

  getDisplayValues() {
    return this.getValues().map((row) =>
      row.map((value) => String(value ?? "")),
    );
  }

  setNumberFormat() {
    return this;
  }

  setFontWeight() {
    return this;
  }

  setBackground(color) {
    for (let rowOffset = 0; rowOffset < this.numRows; rowOffset++) {
      for (let colOffset = 0; colOffset < this.numCols; colOffset++) {
        this.sheet.setBackground(
          this.row + rowOffset,
          this.col + colOffset,
          color,
        );
      }
    }
    return this;
  }

  setBackgrounds(backgrounds) {
    backgrounds.forEach((sourceRow, rowOffset) => {
      sourceRow.forEach((color, colOffset) => {
        this.sheet.setBackground(
          this.row + rowOffset,
          this.col + colOffset,
          color,
        );
      });
    });
    return this;
  }

  setBorder(...args) {
    this.sheet.borders.push({
      row: this.row,
      col: this.col,
      numRows: this.numRows,
      numCols: this.numCols,
      args,
    });
    return this;
  }

  insertCheckboxes() {
    return this;
  }
}

class FakeSheet {
  constructor(name, rows, formulas = []) {
    this.name = name;
    this.rows = rows;
    this.formulas = formulas;
    this.maxRows = Math.max(rows.length, 1);
    this.maxColumns = Math.max(
      ...rows.map((row) => row.length),
      ...formulas.map((row) => row.length),
      1,
    );
    this.backgrounds = [];
    this.borders = [];
  }

  getName() {
    return this.name;
  }

  getLastRow() {
    for (let index = this.rows.length - 1; index >= 0; index--) {
      if ((this.rows[index] || []).some((value) => value !== "")) {
        return index + 1;
      }
    }
    return 0;
  }

  valueAt(row, col) {
    return (this.rows[row - 1] || [])[col - 1] ?? "";
  }

  setValue(row, col, value) {
    while (this.rows.length < row) this.rows.push([]);
    while (this.rows[row - 1].length < col) this.rows[row - 1].push("");
    this.rows[row - 1][col - 1] = value;
    this.maxRows = Math.max(this.maxRows, row);
    this.maxColumns = Math.max(this.maxColumns, col);
  }

  formulaAt(row, col) {
    return (this.formulas[row - 1] || [])[col - 1] ?? "";
  }

  backgroundAt(row, col) {
    return (this.backgrounds[row - 1] || [])[col - 1] ?? "";
  }

  setBackground(row, col, color) {
    while (this.backgrounds.length < row) this.backgrounds.push([]);
    while (this.backgrounds[row - 1].length < col) {
      this.backgrounds[row - 1].push("");
    }
    this.backgrounds[row - 1][col - 1] = color;
  }

  getRange(row, col, numRows, numCols) {
    return new FakeRange(this, row, col, numRows, numCols);
  }

  getMaxRows() {
    return this.maxRows;
  }

  getMaxColumns() {
    return this.maxColumns;
  }

  insertRowsAfter(_row, count) {
    this.maxRows += count;
    while (this.rows.length < this.maxRows) this.rows.push([]);
  }

  insertColumnsAfter(_col, count) {
    this.maxColumns += count;
    this.rows.forEach((row) => {
      while (row.length < this.maxColumns) row.push("");
    });
  }

  clear() {
    this.rows = Array.from({ length: this.maxRows }, () =>
      Array(this.maxColumns).fill(""),
    );
    this.backgrounds = [];
    this.borders = [];
    return this;
  }

  setFrozenRows() {}

  setFrozenColumns() {}

  setColumnWidths() {}

  autoResizeColumns() {}

  setColumnWidth() {}
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
let sourceSheet = new FakeSheet("VACATIONS", sourceRows);
let optionsSheet = null;
let generatedSheets = {};
const spreadsheet = {
  getSheetByName(name) {
    if (name === "VACATIONS") return sourceSheet;
    if (name === "VACATION_OPTIONS") return optionsSheet;
    return generatedSheets[name] || null;
  },
  insertSheet(name) {
    if (name === "VACATIONS") return sourceSheet;
    generatedSheets[name] = new FakeSheet(name, [[]]);
    return generatedSheets[name];
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
  SpreadsheetApp: {
    BorderStyle: {
      SOLID_MEDIUM: "SOLID_MEDIUM",
    },
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
const calendar = writer.buildScheduleCalendar([
  {
    fml: "Перша Людина",
    vacationNumber: 1,
    vacationType: "перша відпустка",
    startDate: date("2026-01-01"),
    endDate: date("2026-01-02"),
    days: 2,
  },
  {
    fml: "Перша Людина",
    vacationNumber: 2,
    vacationType: "сімейні обставини",
    startDate: date("2026-01-04"),
    endDate: date("2026-01-04"),
    days: 1,
  },
  {
    fml: "Друга Людина",
    vacationNumber: 2,
    vacationType: "додаткова відпустка",
    startDate: date("2026-01-02"),
    endDate: date("2026-01-03"),
    days: 2,
  },
]);
assert.equal(calendar.rows[0][0], "QUANTITY");
assert.equal(calendar.rows[0][1], "FML");
assert.equal(calendar.dateCount, 4);
assert.equal(calendar.personCount, 2);
const firstPersonRow = calendar.rows.find((row) => row[1] === "Перша Людина");
const secondPersonRow = calendar.rows.find((row) => row[1] === "Друга Людина");
assert.equal(firstPersonRow[0], 3);
assert.deepEqual(Array.from(firstPersonRow.slice(2)), ["В1", "В1", "", "СО"]);
assert.deepEqual(Array.from(secondPersonRow.slice(2)), ["", "ВД", "ВД", ""]);

const normalizedChecks = writer.normalizeChecks([
  {
    severity: "ERROR",
    rule: "START_GAP",
    date: "2026-01-01",
    fml: "A / B",
    details: "too close",
  },
  {
    severity: "ERROR",
    rule: "PERSON_GAP",
    date: "2026",
    fml: "A",
    details: "short gap",
  },
  {
    severity: "ERROR",
    rule: "MAX_PERSON_YEAR",
    date: "2026",
    fml: "A",
    details: "too many",
  },
]);
assert.deepEqual(
  Array.from(normalizedChecks, (item) => item.type),
  ["START_TOO_CLOSE", "GAP_TOO_SHORT", "YEAR_LIMIT"],
);
const normalizedProblems = writer.normalizeProblems(
  [
    {
      severity: "ERROR",
      rule: "PERSON_GAP",
      date: "2026-01-01 / 2026-07-01",
      fml: "А Людина",
      details: "short gap",
    },
  ],
  [
    {
      fml: "А Людина",
      vacationNumber: 2,
      startDate: date("2026-07-01"),
      endDate: date("2026-07-15"),
      days: 15,
      sourceRow: 7,
      sourceStartColumn: 11,
    },
  ],
);
assert.equal(normalizedProblems[0].type, "PERSON_GAP");
assert.equal(normalizedProblems[0].vacationNumber, 2);
assert.equal(normalizedProblems[0].startDate, "2026-07-01");
assert.equal(normalizedProblems[0].sourceRow, 7);
assert.equal(normalizedProblems[0].sourceStartColumn, 11);

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

const formulaRows = Array.from({ length: 4 }, () => Array(19).fill(""));
const formulaHeaderValues = [
  "FML",
  "Start date",
  "End date",
  "Vacation №",
  "Active",
  "Notify",
  "Days left",
  "Travel",
  "Interval check",
];
formulaRows[0].splice(0, 9, ...formulaHeaderValues);
formulaRows[0].splice(10, 9, ...formulaHeaderValues);
formulaRows[1].splice(
  0,
  9,
  "Формула Людина",
  date("2026-01-01"),
  "FORMULA_END",
  "перша відпустка",
  true,
  true,
  0,
  0,
  true,
);
formulaRows[1].splice(
  10,
  9,
  "Генерована Людина",
  date("2026-03-01"),
  "FORMULA_K_END",
  "друга відпустка",
  true,
  true,
  0,
  0,
  true,
);
const formulaHeaders = [Array(19).fill("")];
[2, 4, 5, 6, 8].forEach((index) => {
  formulaHeaders[0][index] = "=ARRAYFORMULA()";
});
[0, 1, 2, 3, 4, 5, 6, 8].forEach((index) => {
  formulaHeaders[0][10 + index] = "=ARRAYFORMULA()";
});
sourceSheet = new FakeSheet("VACATIONS", formulaRows, formulaHeaders);
const formulaMerged = repository.listAll();
assert.equal(
  formulaMerged.find((item) => item.fml === "Формула Людина")._meta.writable,
  true,
);
assert.equal(
  formulaMerged.find((item) => item.fml === "Генерована Людина")._meta.writable,
  false,
);
const formulaWrite = writer.writeVacationToSource({
  fml: "Формула Людина",
  vacationNumber: 1,
  vacationType: "ВД",
  startDate: date("2026-02-01"),
  endDate: date("2026-02-19"),
  days: 19,
});
assert.equal(formulaWrite.formulaDriven, true);
assert.equal(sourceSheet.valueAt(2, 3), "FORMULA_END");
assert.equal(
  sourceSheet.valueAt(formulaWrite.rowNumber, 4),
  "додаткова відпустка",
);
assert.equal(sourceSheet.valueAt(formulaWrite.rowNumber, 8), 4);
sourceSheet.setValue(formulaWrite.rowNumber, 5, true);
const formulaCancel = writer.setVacationActive(
  "Формула Людина",
  1,
  false,
  "ВД",
);
assert.equal(formulaCancel.formulaDriven, true);
assert.equal(sourceSheet.valueAt(formulaWrite.rowNumber, 2), "");
assert.equal(sourceSheet.valueAt(2, 3), "FORMULA_END");
sourceSheet.setValue(formulaWrite.rowNumber, 5, false);

const generatedWrite = writer.writeVacationToSource({
  fml: "Генерована Людина",
  vacationNumber: 2,
  startDate: date("2026-04-01"),
  endDate: date("2026-04-15"),
  days: 15,
});
assert.equal(generatedWrite.requestedBlock, "second");
assert.equal(
  generatedWrite.startColumn,
  1,
  "formula-generated K:S must route writes into writable A:I",
);
assert.equal(sourceSheet.valueAt(2, 11), "Генерована Людина");
assert.equal(
  sourceSheet.valueAt(generatedWrite.rowNumber, 4),
  "друга відпустка",
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

function sourceVacationRow(entries) {
  const row = Array(19).fill("");
  entries.forEach((entry) => {
    row.splice(
      entry.startColumn - 1,
      9,
      entry.fml,
      date(entry.start),
      date(entry.end),
      entry.type,
      true,
      true,
      entry.days,
      "",
      "OK",
    );
  });
  return row;
}

function dateColumn(sheet, expected) {
  const columnIndex = (sheet.rows[0] || []).findIndex((value) => {
    if (!(value instanceof Date)) return false;
    return value.toISOString().slice(0, 10) === expected;
  });
  assert.notEqual(columnIndex, -1, `schedule must contain ${expected}`);
  return columnIndex + 1;
}

sourceSheet = new FakeSheet("VACATIONS", [
  Array(19).fill(""),
  sourceVacationRow([
    {
      startColumn: 1,
      fml: "А Змішана",
      start: "2026-01-31",
      end: "2026-03-01",
      type: "перша відпустка",
      days: 30,
    },
    {
      startColumn: 11,
      fml: "А Змішана",
      start: "2026-02-01",
      end: "2026-02-01",
      type: "друга відпустка",
      days: 1,
    },
  ]),
  sourceVacationRow([
    {
      startColumn: 1,
      fml: "Б Додаткова",
      start: "2026-02-01",
      end: "2026-02-01",
      type: "додаткова відпустка",
      days: 1,
    },
  ]),
  sourceVacationRow([
    {
      startColumn: 1,
      fml: "В Сімейна",
      start: "2026-03-01",
      end: "2026-03-01",
      type: "сімейні обставини",
      days: 1,
    },
  ]),
  sourceVacationRow([
    {
      startColumn: 11,
      fml: "Г Друга",
      start: "2026-02-02",
      end: "2026-02-02",
      type: "друга відпустка",
      days: 1,
    },
  ]),
]);
optionsSheet = null;
generatedSheets = {};
const sourceBeforeRebuild = sourceSheet.rows.map((row) => row.slice());
const multiMonthRebuild = writer.rebuildVacationSystem();
const scheduleSheet = generatedSheets.VACATION_SCHEDULE;
assert.ok(scheduleSheet, "rebuild must create VACATION_SCHEDULE");
assert.deepEqual(
  Array.from(multiMonthRebuild.affectedSheets),
  ["VACATION_SCHEDULE", "VACATION_CHECK"],
);
assert.equal(optionsSheet, null, "rebuild must not use VACATION_OPTIONS");
assert.deepEqual(
  sourceSheet.rows,
  sourceBeforeRebuild,
  "calendar formatting must not mutate VACATIONS or its K:S block",
);

const scheduleRowsByFml = new Map(
  scheduleSheet.rows.map((row, index) => [row[1], index + 1]),
);
const mixedRow = scheduleRowsByFml.get("А Змішана");
const extraRow = scheduleRowsByFml.get("Б Додаткова");
const familyRow = scheduleRowsByFml.get("В Сімейна");
const secondRow = scheduleRowsByFml.get("Г Друга");
const jan31Column = dateColumn(scheduleSheet, "2026-01-31");
const feb1Column = dateColumn(scheduleSheet, "2026-02-01");
const feb2Column = dateColumn(scheduleSheet, "2026-02-02");
const mar1Column = dateColumn(scheduleSheet, "2026-03-01");
assert.equal(scheduleSheet.backgroundAt(mixedRow, jan31Column), "#D9EAD3");
assert.equal(scheduleSheet.backgroundAt(mixedRow, feb1Column), "#F4CCCC");
assert.equal(scheduleSheet.backgroundAt(extraRow, feb1Column), "#FCE5CD");
assert.equal(scheduleSheet.backgroundAt(familyRow, mar1Column), "#EADCF8");
assert.equal(scheduleSheet.backgroundAt(secondRow, feb2Column), "#CFE2F3");
assert.equal(
  scheduleSheet.backgroundAt(extraRow, jan31Column),
  "#FFFFFF",
  "blank calendar cells must remain white",
);
assert.equal(scheduleSheet.backgroundAt(mixedRow, 1), "");
assert.equal(
  scheduleSheet.backgroundAt(mixedRow, 2),
  "",
  "A:B must not receive vacation backgrounds",
);
assert.deepEqual(
  scheduleSheet.borders.map((border) => border.col),
  [jan31Column, mar1Column - 1],
  "every month transition must receive one separator",
);
scheduleSheet.borders.forEach((border) => {
  assert.equal(border.row, 1);
  assert.equal(border.numRows, multiMonthRebuild.schedulePeople + 1);
  assert.equal(border.args[3], true);
  assert.equal(border.args[6], "#000000");
  assert.equal(border.args[7], "SOLID_MEDIUM");
});

sourceSheet = new FakeSheet("VACATIONS", [
  Array(19).fill(""),
  sourceVacationRow([
    {
      startColumn: 1,
      fml: "Один Місяць",
      start: "2026-04-01",
      end: "2026-04-15",
      type: "перша відпустка",
      days: 15,
    },
  ]),
]);
generatedSheets = {};
const singleMonthRebuild = writer.rebuildVacationSystem();
assert.equal(singleMonthRebuild.schedulePeople, 1);
assert.equal(
  generatedSheets.VACATION_SCHEDULE.borders.length,
  0,
  "single-month calendar must not add separators",
);

sourceSheet = new FakeSheet("VACATIONS", [Array(19).fill("")]);
generatedSheets = {};
const emptyRebuild = writer.rebuildVacationSystem();
assert.equal(emptyRebuild.schedulePeople, 0);
assert.equal(emptyRebuild.scheduleDays, 0);
assert.equal(generatedSheets.VACATION_SCHEDULE.borders.length, 0);
assert.equal(generatedSheets.VACATION_SCHEDULE.backgrounds.length, 1);

const code = fs.readFileSync(path.join(repoRoot, "Code.gs"), "utf8");
const sidebarHtml = fs.readFileSync(
  path.join(repoRoot, "Sidebar.html"),
  "utf8",
);
const jsVacations = fs.readFileSync(
  path.join(repoRoot, "Js.Vacations.html"),
  "utf8",
);
const jsVacationsScript = jsVacations.match(/<script>([\s\S]*?)<\/script>/i);
assert.ok(jsVacationsScript, "Js.Vacations must contain a client script");
let vacationClientRendered = "";
const vacationClientContext = vm.createContext({
  console,
  Date,
  window: {},
  escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  },
  setHtml(_id, html) {
    vacationClientRendered = html;
  },
});
vm.runInContext(jsVacationsScript[1], vacationClientContext, {
  filename: "Js.Vacations.html",
});
const renderVacationProblems = vm.runInContext(
  "renderVacationProblems_",
  vacationClientContext,
);
const problemSuggestions = vm.runInContext(
  "buildVacationProblemSuggestions_",
  vacationClientContext,
);
const problemTypes = [
  "INVALID_DATE",
  "INVALID_DURATION",
  "MAX_PERSON_YEAR",
  "PERSON_OVERLAP",
  "PERSON_GAP",
  "START_GAP",
  "MAX_CONCURRENT",
];
problemTypes.forEach((type) => {
  const suggestions = problemSuggestions({ type });
  assert.ok(suggestions.length >= 1 && suggestions.length <= 3);
});
const problemCardsHtml = renderVacationProblems([
  {
    type: "PERSON_GAP",
    fml: "Тест <script>",
    date: "2026-07-01",
    description: "Інтервал замалий",
    severity: "ERROR",
  },
]);
assert.match(problemCardsHtml, /vacation-problem-card/);
assert.match(problemCardsHtml, /Малий інтервал між відпустками/);
assert.match(problemCardsHtml, /Варіанти вирішення:/);
assert.match(problemCardsHtml, /Підібрати нову дату/);
assert.doesNotMatch(problemCardsHtml, /Тест <script>/);
assert.doesNotMatch(
  renderVacationProblems([{ type: "INVALID_DATE", fml: "Тест" }]),
  /Підібрати нову дату/,
);
const vacationClientModule = vm.runInContext(
  "VacationModule",
  vacationClientContext,
);
vacationClientModule.state.personnel = [
  { fml: "Тест Людина", callsign: "Тест" },
];
vacationClientModule.state.checks = [
  {
    type: "PERSON_GAP",
    fml: "Тест Людина",
    primaryFml: "Тест Людина",
    vacationNumber: 2,
    startDate: "2026-07-01",
    days: 15,
  },
];
vacationClientModule.openFindFromProblem(0);
assert.equal(vacationClientModule.state.activeTab, "find");
assert.equal(vacationClientModule.state.findDraft.fml, "Тест Людина");
assert.equal(vacationClientModule.state.findDraft.vacationNumber, 2);
assert.match(vacationClientRendered, /Підібрати дату/);
vacationClientModule.state.checks = [
  {
    type: "MAX_CONCURRENT",
    fml: "Перша Людина / Друга Людина",
    date: "2026-07-01",
  },
];
vacationClientModule.openFindFromProblem(0);
assert.equal(vacationClientModule.state.activeTab, "find");
assert.equal(vacationClientModule.state.statusType, "warning");
const jsHelpers = fs.readFileSync(
  path.join(repoRoot, "Js.Helpers.html"),
  "utf8",
);
const includesContract = JSON.parse(
  fs.readFileSync(
    path.join(repoRoot, "contracts/client-includes.contract.json"),
    "utf8",
  ),
);
const sidebarService = fs.readFileSync(
  path.join(repoRoot, "VacationSidebarService.gs"),
  "utf8",
);
const sidebar = fs.readFileSync(
  path.join(repoRoot, "VacationSidebar.html"),
  "utf8",
);
const writerSource = fs.readFileSync(
  path.join(repoRoot, "VacationOptionsWriter.gs"),
  "utf8",
);
assert.doesNotMatch(code, /createMenu\("Відпустки"\)/);
assert.doesNotMatch(code, /addSubMenu\(vacationMenu\)/);
assert.match(sidebarHtml, /id="btnVacations"/);
assert.match(sidebarHtml, /handleMenuAction\('vacations'\)/);
assert.doesNotMatch(
  sidebarHtml,
  /btnVacationReminder|handleMenuAction\('vacationReminder'\)/,
);
assert.match(jsHelpers, /vacations:\s*"Відпустки"/);
assert.match(jsHelpers, /case "vacations":/);
assert.match(jsHelpers, /showVacationsModule\(\)/);
assert.match(jsVacations, /const VacationModule = \{/);
assert.match(jsVacations, /runServerMethod_/);
assert.match(jsVacations, /window\.VacationModule = VacationModule/);
assert.ok(includesContract.expected.includes("Js.Vacations"));
assert.match(jsVacations, /checkVacationRemindersFromMainPanel/);
assert.match(jsVacations, /getVacationSidebarState/);
assert.match(jsVacations, /const VACATION_PROBLEM_LABELS = \{/);
assert.match(jsVacations, /function buildVacationProblemSuggestions_/);
assert.match(jsVacations, /function renderVacationProblems_/);
assert.match(jsVacations, /Проблемні питання/);
assert.match(jsVacations, /Знайти проблеми/);
assert.match(
  jsVacations,
  /async loadProblems\(\)[\s\S]*?"checkVacationRulesFromSidebar"/,
);
assert.match(jsVacations, /Натисніть кнопку, щоб перевірити графік/);
assert.match(jsVacations, /openFindFromProblem\(index\)/);
assert.match(jsVacations, /Підібрати нову дату/);
assert.doesNotMatch(jsVacations, /label:\s*"Перевірка"/);
assert.doesNotMatch(sidebarService, /\bclass\s+VacationSidebarService/);
assert.match(sidebarService, /const VacationSidebarService_ = \(function \(\)/);
assert.match(sidebarService, /PersonnelRepository_\.getActiveRows\(\)/);
assert.match(sidebarService, /applyVacationOptionFromSidebar/);
assert.doesNotMatch(
  sidebar + sidebarService,
  /VACATION_OPTIONS|writeVacationOptions/,
);
assert.doesNotMatch(sidebar, /innerHTML/);
assert.match(
  writerSource,
  /const headers = \["Date", "Type", "FML", "Description", "Severity"\]/,
);
assert.match(writerSource, /function _formatScheduleCalendar_/);
assert.match(writerSource, /function _applyMonthSeparators_/);
assert.match(writerSource, /getRange\(2, 3, dataRowCount, dateCount\)/);
assert.match(writerSource, /SpreadsheetApp\.BorderStyle\.SOLID_MEDIUM/);
assert.match(writerSource, /function normalizeProblems/);
assert.match(
  writerSource,
  /function _scheduleCellColor_[\s\S]*?if \(!text\) return "#FFFFFF";[\s\S]*?return "#D9EAD3";/,
);
assert.doesNotMatch(
  writerSource,
  /setFrozenRows\([^)]*\)\.setFrozenColumns/,
  "GAS Sheet.setFrozenRows does not support chaining",
);
const sidebarScript = sidebar.match(/<script>([\s\S]*?)<\/script>/i);
assert.ok(sidebarScript, "VacationSidebar must contain a client script");
assert.doesNotThrow(
  () => new vm.Script(sidebarScript[1], { filename: "VacationSidebar.html" }),
  "VacationSidebar client script must parse",
);
["schedule", "add", "find", "move", "check", "report"].forEach((tab) => {
  assert.match(sidebar, new RegExp(`data-panel="${tab}"`));
});
assert.equal(
  fs.existsSync(path.join(repoRoot, "VacationPlannerDialog.html")),
  false,
);
assert.equal(
  fs.existsSync(path.join(repoRoot, "VacationValidateDialog.html")),
  false,
);
assert.equal(
  fs.existsSync(path.join(repoRoot, "VacationPlannerApi.gs")),
  false,
);

const vacationSources = fs
  .readdirSync(repoRoot)
  .filter((name) => /^Vacation.*\.(gs|html)$/.test(name))
  .map((name) => fs.readFileSync(path.join(repoRoot, name), "utf8"))
  .join("\n");
assert.doesNotMatch(vacationSources, /VACATION_DATA/);

console.log("verify-vacation-planner: OK");

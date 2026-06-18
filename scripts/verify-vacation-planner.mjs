#!/usr/bin/env node
/**
 * Vacation planner contract checks that run without Google Apps Script.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import {
  findFileByBasename,
  readRepoFileByBasename,
  walkGasFiles,
  walkHtmlFiles,
} from "./lib/gas-files.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

function readRepo(file) {
  return readRepoFileByBasename(repoRoot, file, {
    errorPrefix: "verify-vacation-planner",
  });
}

function load(context, file) {
  vm.runInContext(readRepo(file), context, {
    filename: path.basename(file),
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

function inactiveVacation(fml, start, end, vacationNumber = 1) {
  return {
    ...vacation(fml, start, end, vacationNumber),
    active: false,
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
assert.ok(
  startGapCheck.blockingViolations.some((item) => item.rule === "START_GAP"),
);

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

const invalidDateCheck = service.validateVacationOption(
  {
    fml: "Некоректна Дата",
    vacationNumber: 1,
    startDate: "not-a-date",
    endDate: date("2026-11-15"),
  },
  [],
);
assert.equal(invalidDateCheck.isValid, false);
assert.equal(invalidDateCheck.blockingViolations[0].rule, "INVALID_DATE");
assert.deepEqual(Array.from(invalidDateCheck.warnings), []);

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
assert.ok(
  personGapCheck.blockingViolations.some((item) => item.rule === "PERSON_GAP"),
);

const requestSourceVacation = {
  ...vacation("Заявка За ID", "2026-05-01", "2026-05-15", 1),
  requestId: "request-existing",
  _meta: { schema: "vacation_requests" },
};
const newSameSlotRequest = service.validateVacationOption(
  {
    fml: "Заявка За ID",
    vacationNumber: 1,
    startDate: date("2026-05-10"),
    endDate: date("2026-05-24"),
  },
  [requestSourceVacation],
);
assert.equal(newSameSlotRequest.isValid, false);
assert.ok(
  newSameSlotRequest.blockingViolations.some(
    (item) => item.rule === "PERSON_OVERLAP",
  ),
  "new request rows must not replace an existing request merely by slot",
);
const existingRequestMove = service.validateVacationOption(
  {
    requestId: "request-existing",
    fml: "Заявка За ID",
    vacationNumber: 1,
    startDate: date("2026-06-01"),
    endDate: date("2026-06-15"),
  },
  [requestSourceVacation],
);
assert.equal(
  existingRequestMove.isValid,
  true,
  "requestId updates must exclude only the request being moved",
);
const renamedPersonOverlap = service.validateVacationOption(
  {
    personKey: "ALPHA",
    fml: "Нове ПІБ",
    vacationNumber: 2,
    startDate: date("2026-05-10"),
    endDate: date("2026-05-24"),
  },
  [
    {
      ...vacation("Старе ПІБ", "2026-05-01", "2026-05-15", 1),
      personKey: "ALPHA",
      requestId: "request-renamed",
      _meta: { schema: "vacation_requests" },
    },
  ],
);
assert.ok(
  renamedPersonOverlap.blockingViolations.some(
    (item) => item.rule === "PERSON_OVERLAP",
  ),
  "PersonKey must keep overlap checks stable after an FML rename",
);

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
const shortUnitLoad = [
  vacation("A", "2026-07-10", "2026-07-17"),
  vacation("B", "2026-07-11", "2026-07-17"),
  vacation("C", "2026-07-12", "2026-07-17"),
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
const shortBusyValidation = service.validateVacationOption(
  busyOption,
  shortUnitLoad,
);
assert.equal(quietValidation.isValid, true);
assert.ok(
  busyValidation.blockingViolations.some(
    (item) => item.rule === "OVERLOAD_STREAK",
  ),
  "4 people for more than 3 consecutive days must be blocking",
);
assert.equal(shortBusyValidation.isValid, true);
assert.ok(
  shortBusyValidation.warnings.some((item) => item.rule === "HIGH_LOAD_PERIOD"),
);
const quietScore = service.scoreVacationOption(
  quietOption,
  unitLoad,
  requestBase,
  quietValidation,
);
const busyScore = service.scoreVacationOption(
  busyOption,
  shortUnitLoad,
  requestBase,
  shortBusyValidation,
);
assert.ok(
  quietScore < busyScore,
  "scheduler must prefer lower unit load over short overload periods",
);
const compromiseOptions = service.suggestVacationOptions(
  {
    fml: "Нова Людина",
    vacationNumber: 1,
    desiredStart: "2026-07-15",
    durationDays: 15,
    searchWindow: 0,
  },
  shortUnitLoad,
);
assert.equal(compromiseOptions[0].status, "COMPROMISE");
assert.match(compromiseOptions[0].explanation, /Попередження:/);

const monthBalanceCheck = service.validateVacationOption(
  {
    fml: "Третій Старт",
    vacationNumber: 1,
    startDate: date("2026-06-16"),
    endDate: date("2026-06-30"),
  },
  [
    vacation("Перший Старт", "2026-06-01", "2026-06-05"),
    vacation("Другий Старт", "2026-06-10", "2026-06-14"),
  ],
);
assert.equal(monthBalanceCheck.isValid, true);
assert.ok(
  !monthBalanceCheck.warnings.some((item) => item.rule === "MONTH_BALANCE"),
  "3 June starts must not trigger MONTH_BALANCE (threshold is 5)",
);
const monthBalanceFiveCheck = service.validateVacationOption(
  {
    fml: "П'ятий Старт",
    vacationNumber: 1,
    startDate: date("2026-06-25"),
    endDate: date("2026-07-09"),
  },
  [
    vacation("Перший Старт", "2026-06-01", "2026-06-05"),
    vacation("Другий Старт", "2026-06-10", "2026-06-14"),
    vacation("Третій Старт", "2026-06-15", "2026-06-19"),
    vacation("Четвертий Старт", "2026-06-20", "2026-06-24"),
  ],
);
assert.ok(
  monthBalanceFiveCheck.warnings.some((item) => item.rule === "MONTH_BALANCE"),
  "5 June starts must trigger MONTH_BALANCE",
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
  "exactly four concurrent people are not an absolute max violation",
);
assert.ok(
  audit.checks.some(
    (item) => item.rule === "HIGH_LOAD_PERIOD" && item.severity === "WARNING",
  ),
  "four concurrent people must produce a non-blocking load warning",
);
assert.ok(
  audit.checks.some((item) => item.rule === "OVERLOAD_STREAK"),
  "four concurrent people for a whole month must exceed short overload streak",
);
const overloadedAudit = service.buildScheduleAudit([
  ...concurrent,
  vacation("E", "2026-07-01", "2026-07-31"),
]);
assert.ok(
  overloadedAudit.checks.some((item) => item.rule === "MAX_CONCURRENT"),
  "rebuild audit must report five or more concurrent people",
);
const overlapAudit = service.buildScheduleAudit([
  vacation("Перетин Людини", "2026-01-01", "2026-01-15", 1),
  vacation("Перетин Людини", "2026-01-10", "2026-01-20", 2),
]);
assert.ok(
  overlapAudit.checks.some(
    (item) => item.rule === "PERSON_OVERLAP" && item.severity === "ERROR",
  ),
  "same-person overlap must remain blocking",
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

const consistencyAudit = service.buildConsistencyAudit(
  [
    vacation("План Без Факту", "2026-06-10", "2026-06-12"),
    vacation("Узгоджена Людина", "2026-06-10", "2026-06-12"),
  ],
  [
    {
      fml: "Статус Без Плану",
      status: "Відпустка",
      statusCanonical: "Vacation",
    },
    {
      fml: "Узгоджена Людина",
      status: "Відпустка",
      statusCanonical: "Vacation",
    },
  ],
  [
    { fml: "Факт Без Плану", date: date("2026-06-10"), code: "Відпус" },
    { fml: "Факт Без Плану", date: date("2026-06-11"), code: "Відпус" },
    { fml: "План Без Факту", date: date("2026-06-10"), code: "БР" },
    { fml: "План Без Факту", date: date("2026-06-11"), code: "" },
    { fml: "Узгоджена Людина", date: date("2026-06-10"), code: "Відпус" },
    { fml: "Узгоджена Людина", date: date("2026-06-11"), code: "Відпус" },
    { fml: "Узгоджена Людина", date: date("2026-06-12"), code: "Відпус" },
  ],
  date("2026-06-11"),
);
assert.deepEqual(Array.from(consistencyAudit, (item) => item.rule).sort(), [
  "MONTHLY_VACATION_WITHOUT_PLAN",
  "PERSONNEL_VACATION_WITHOUT_PLAN",
  "PLAN_WITHOUT_MONTHLY_VACATION",
]);
assert.equal(
  consistencyAudit.find((item) => item.rule === "MONTHLY_VACATION_WITHOUT_PLAN")
    .date,
  "2026-06-10 / 2026-06-11",
);
assert.equal(
  consistencyAudit.find((item) => item.rule === "PLAN_WITHOUT_MONTHLY_VACATION")
    .date,
  "2026-06-10 / 2026-06-11",
);
assert.ok(
  !consistencyAudit.some((item) => item.fml === "Узгоджена Людина"),
  "matching status, plan, and monthly facts must not produce a problem",
);
assert.ok(
  !consistencyAudit.some(
    (item) =>
      item.rule === "PLAN_WITHOUT_MONTHLY_VACATION" &&
      item.date.includes("2026-06-12"),
  ),
  "dates absent from monthly sheets must not produce false positives",
);

const annualMinimumAudit = service.buildConsistencyAudit(
  [vacation("Запланована Людина", "2026-08-01", "2026-08-15")],
  [
    { fml: "Запланована Людина", active: true, status: "В наявності" },
    { fml: "Без Плану", active: true, status: "В наявності" },
    { fml: "Неактивна Людина", active: false, status: "Вибув" },
  ],
  [],
  date("2026-06-11"),
);
assert.deepEqual(
  Array.from(
    annualMinimumAudit.filter((item) => item.rule === "MIN_PERSON_YEAR"),
    (item) => item.fml,
  ),
  ["Без Плану"],
  "active PERSONNEL rows without an annual vacation plan must be reported",
);

const requestStatusAudit = service.buildConsistencyAudit(
  [
    {
      ...vacation("Лише Пропозиція", "2026-06-10", "2026-06-12"),
      operationalActive: false,
      factExpected: false,
    },
    {
      ...vacation("Лише Затверджена", "2026-06-10", "2026-06-12"),
      operationalActive: true,
      factExpected: false,
    },
    {
      ...vacation("Застосована Без Факту", "2026-06-10", "2026-06-12"),
      operationalActive: true,
      factExpected: true,
    },
  ],
  [
    {
      fml: "Лише Пропозиція",
      status: "Відпустка",
      statusCanonical: "Vacation",
    },
    {
      fml: "Лише Затверджена",
      status: "Відпустка",
      statusCanonical: "Vacation",
    },
  ],
  [
    { fml: "Лише Пропозиція", date: date("2026-06-11"), code: "Відпус" },
    { fml: "Лише Затверджена", date: date("2026-06-11"), code: "" },
    { fml: "Застосована Без Факту", date: date("2026-06-11"), code: "" },
  ],
  date("2026-06-11"),
);
assert.ok(
  requestStatusAudit.some(
    (item) =>
      item.rule === "PERSONNEL_VACATION_WITHOUT_PLAN" &&
      item.fml === "Лише Пропозиція",
  ),
  "Proposed requests must not satisfy an operational PERSONNEL status",
);
assert.ok(
  requestStatusAudit.some(
    (item) =>
      item.rule === "MONTHLY_VACATION_WITHOUT_PLAN" &&
      item.fml === "Лише Пропозиція",
  ),
  "Proposed requests must not satisfy a monthly vacation fact",
);
assert.ok(
  requestStatusAudit.some(
    (item) =>
      item.rule === "PLAN_WITHOUT_MONTHLY_VACATION" &&
      item.fml === "Застосована Без Факту",
  ),
  "Applied requests must have matching represented monthly facts",
);
assert.ok(
  !requestStatusAudit.some(
    (item) =>
      item.rule === "PLAN_WITHOUT_MONTHLY_VACATION" &&
      item.fml === "Лише Затверджена",
  ),
  "Approved requests must not require monthly facts before application",
);
const renamedPersonConsistency = service.buildConsistencyAudit(
  [
    {
      ...vacation("Старе ПІБ", "2026-06-11", "2026-06-11"),
      personKey: "ALPHA",
      operationalActive: true,
      factExpected: true,
    },
  ],
  [
    {
      callsign: "ALPHA",
      fml: "Нове ПІБ",
      status: "Відпустка",
      statusCanonical: "Vacation",
    },
  ],
  [
    {
      callsign: "ALPHA",
      fml: "Нове ПІБ",
      date: date("2026-06-11"),
      code: "Відпус",
    },
  ],
  date("2026-06-11"),
);
assert.deepEqual(
  Array.from(renamedPersonConsistency),
  [],
  "PersonKey/callsign aliases must reconcile plan and fact after an FML rename",
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
    for (let rowOffset = 0; rowOffset < this.numRows; rowOffset++) {
      for (let colOffset = 0; colOffset < this.numCols; colOffset++) {
        this.sheet.setValue(this.row + rowOffset, this.col + colOffset, "");
      }
    }
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

  setNumberFormat(format) {
    this.sheet.numberFormats = this.sheet.numberFormats || [];
    this.sheet.numberFormats.push({
      row: this.row,
      col: this.col,
      numRows: this.numRows,
      numCols: this.numCols,
      format: format,
    });
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
    this.numberFormats = [];
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

  getLastColumn() {
    return this.maxColumns;
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
    this.numberFormats = [];
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
  0,
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
let requestSheet = null;
let generatedSheets = {};
const spreadsheet = {
  getSheetByName(name) {
    if (name === "VACATIONS") return sourceSheet;
    if (name === "VACATION_REQUESTS") return requestSheet;
    return generatedSheets[name] || null;
  },
  insertSheet(name) {
    if (name === "VACATIONS") return sourceSheet;
    if (name === "VACATION_REQUESTS") {
      requestSheet = new FakeSheet(name, [[]]);
      return requestSheet;
    }
    generatedSheets[name] = new FakeSheet(name, [[]]);
    return generatedSheets[name];
  },
};

const scriptProperties = {};
let requestIdSequence = 0;
const ioContext = vm.createContext({
  console,
  Date,
  Math,
  PropertiesService: {
    getScriptProperties() {
      return {
        getProperty(key) {
          return scriptProperties[key] || "";
        },
        setProperty(key, value) {
          scriptProperties[key] = String(value);
        },
      };
    },
  },
  Utilities: {
    getUuid() {
      requestIdSequence += 1;
      return `request-${requestIdSequence}`;
    },
    formatDate(value, _tz, pattern) {
      if (!(value instanceof Date) || isNaN(value.getTime())) {
        return String(value || "");
      }
      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, "0");
      const day = String(value.getDate()).padStart(2, "0");
      if (pattern === "yyyy-MM-dd") return `${year}-${month}-${day}`;
      if (pattern === "dd.MM.yyyy") return `${day}.${month}.${year}`;
      return value.toISOString();
    },
  },
  getTimeZone_() {
    return "Europe/Kyiv";
  },
  getWasbSpreadsheet_() {
    return {
      toast() {},
    };
  },
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
  preserveUserConditionalFormatRules_(_sheet, rebuildFn) {
    return rebuildFn();
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
assert.equal(merged.length, 2, "repository must read all vacations from A:I");
assert.equal(
  Array.from(merged, (item) => item._meta.startColumn).join(","),
  "1,1",
);
const workingPropertiesService = ioContext.PropertiesService;
ioContext.PropertiesService = {
  getScriptProperties() {
    throw new Error("property read denied");
  },
};
assert.throws(
  () => repository.getSourceMode(),
  /Не вдалося визначити джерело відпусток/,
  "source selection must fail closed when Script Properties cannot be read",
);
ioContext.PropertiesService = workingPropertiesService;

load(ioContext, "Vacation_Suggestions.gs");
load(ioContext, "VacationOptionsWriter.gs");
const writer = vm.runInContext("VacationOptionsWriter_", ioContext);
const suggestionsModule = vm.runInContext("VacationSuggestions_", ioContext);
assert.equal(repository.getSourceMode(), "legacy");
scriptProperties.WASB_VACATION_SOURCE = "REQUESTS";
assert.throws(
  () => repository.getSourceMode(),
  /Невідоме значення WASB_VACATION_SOURCE/,
  "unknown source modes must fail closed instead of selecting legacy",
);
delete scriptProperties.WASB_VACATION_SOURCE;
const migrationPreview = writer.migrateLegacyToRequests({
  activate: true,
});
assert.equal(migrationPreview.dryRun, true);
assert.equal(migrationPreview.activate, false);
assert.equal(migrationPreview.requestRows, 2);
assert.equal(requestSheet, null, "dry-run must not create VACATION_REQUESTS");
assert.equal(repository.getSourceMode(), "legacy");

const migrationApplied = writer.migrateLegacyToRequests({
  dryRun: false,
  activate: true,
});
assert.equal(migrationApplied.sourceModeAfter, "requests");
assert.equal(repository.getSourceMode(), "requests");
assert.ok(requestSheet, "migration must create VACATION_REQUESTS");
assert.deepEqual(
  Array.from(requestSheet.rows[0]),
  Array.from(plannerConfig.REQUEST_HEADERS),
);
const migratedRequests = repository.listAll();
assert.equal(migratedRequests.length, 2);
assert.equal(migratedRequests[0]._meta.schema, "vacation_requests");
assert.equal(migratedRequests[0].status, "Applied");
assert.equal(migratedRequests[0].operationalActive, true);
assert.equal(migratedRequests[0].factExpected, true);
assert.equal(migratedRequests[0].reminderEligible, true);
assert.equal(migratedRequests[0].vacationNo, "перша відпустка");
assert.equal(migratedRequests[1].vacationType, "В2");
assert.equal(migratedRequests[1].vacationNo, "друга відпустка");
requestSheet.rows[1][11] = "Proposed";
const proposedRequest = repository.listAll()[0];
assert.equal(proposedRequest.active, true);
assert.equal(proposedRequest.operationalActive, false);
assert.equal(proposedRequest.factExpected, false);
assert.equal(proposedRequest.reminderEligible, false);
requestSheet.rows[1][11] = "Applied";
const originalPersonKey = requestSheet.rows[1][1];
const originalFml = requestSheet.rows[1][2];
requestSheet.rows[1][1] = "ALPHA";
requestSheet.rows[1][2] = "Старе ПІБ";
ioContext.PersonnelRepository_ = {
  getByFml(value) {
    return value === "Нове ПІБ" ? { callsign: "ALPHA", fml: "Нове ПІБ" } : null;
  },
};
assert.equal(
  repository.findByFml("Нове ПІБ")[0].requestId,
  migratedRequests[0].requestId,
  "person-card lookup must resolve a renamed FML through PersonKey",
);
delete ioContext.PersonnelRepository_;
requestSheet.rows[1][1] = originalPersonKey;
requestSheet.rows[1][2] = originalFml;

const requestWrite = writer.writeVacationToSource({
  fml: "Нова Заявка",
  vacationNumber: 1,
  vacationType: "ВД",
  startDate: date("2026-12-01"),
  endDate: date("2026-12-05"),
  days: 5,
});
assert.equal(requestWrite.sourceMode, "requests");
assert.equal(requestWrite.sheetName, "VACATION_REQUESTS");
let addedRequest = repository
  .listAll()
  .find((item) => item.fml === "Нова Заявка");
assert.equal(addedRequest.vacationType, "ВД");
assert.equal(addedRequest.status, "Approved");
assert.equal(addedRequest.active, true);
assert.equal(addedRequest.operationalActive, true);
assert.equal(addedRequest.factExpected, false);
assert.equal(addedRequest.reminderEligible, true);
const requestRowsBeforeMove = requestSheet.getLastRow();
writer.writeVacationToSource({
  requestId: addedRequest.requestId,
  personKey: addedRequest.personKey,
  fml: "Перейменована Заявка",
  vacationNumber: 2,
  vacationType: "В1",
  startDate: date("2026-12-10"),
  endDate: date("2026-12-14"),
  days: 5,
});
assert.equal(
  requestSheet.getLastRow(),
  requestRowsBeforeMove,
  "requestId update must not append a second row",
);
addedRequest = repository
  .listAll()
  .find((item) => item.requestId === addedRequest.requestId);
assert.equal(addedRequest.fml, "Перейменована Заявка");
assert.equal(addedRequest.vacationNumber, 2);
const requestCancel = writer.setVacationActive("Невірне ФІО", 1, false, "ВД", {
  requestId: addedRequest.requestId,
});
assert.equal(requestCancel.sourceMode, "requests");
addedRequest = repository
  .listAll()
  .find((item) => item.requestId === addedRequest.requestId);
assert.equal(addedRequest.status, "Cancelled");
assert.equal(addedRequest.active, false);
const duplicateRequestRow = requestSheet.rows[1].slice();
requestSheet.rows.push(duplicateRequestRow);
assert.throws(
  () => repository.listAll(),
  /дубль ID/,
  "request source must reject duplicate IDs",
);
requestSheet.rows.pop();
const missingIdRow = requestSheet.rows[1].slice();
missingIdRow[0] = "";
requestSheet.rows.push(missingIdRow);
assert.throws(
  () => repository.listAll(),
  /не містить обов'язковий ID/,
  "request source must reject non-empty rows without IDs",
);
requestSheet.rows.pop();
const missingPersonKeyRow = requestSheet.rows[1].slice();
missingPersonKeyRow[0] = "request-missing-person-key";
missingPersonKeyRow[1] = "";
requestSheet.rows.push(missingPersonKeyRow);
assert.throws(
  () => repository.listAll(),
  /повинен містити PersonKey та FML/,
  "active requests must identify the person explicitly",
);
requestSheet.rows.pop();
assert.throws(
  () => writer.migrateLegacyToRequests({ dryRun: false }),
  /вже містить дані/,
  "migration must not overwrite existing request rows",
);

const preparedRequestSheet = requestSheet;
requestSheet = null;
assert.throws(
  () => repository.listAll(),
  /Активне джерело VACATION_REQUESTS не знайдено/,
  "active request mode must fail explicitly instead of falling back",
);
requestSheet = preparedRequestSheet;
const rollbackSource = writer.switchSourceMode("legacy");
assert.equal(rollbackSource.sourceSheet, "VACATIONS");
assert.equal(repository.getSourceMode(), "legacy");
assert.equal(repository.listAll().length, 2);
const reactivateSource = writer.switchSourceMode("requests");
assert.equal(reactivateSource.sourceSheet, "VACATION_REQUESTS");
assert.equal(repository.getSourceMode(), "requests");
writer.switchSourceMode("legacy");

const yearRange2026 = writer.buildVacationScheduleYearRange_(2026);
assert.equal(yearRange2026.startDate.getFullYear(), 2026);
assert.equal(yearRange2026.startDate.getMonth(), 0);
assert.equal(yearRange2026.startDate.getDate(), 1);
assert.equal(yearRange2026.endDate.getFullYear(), 2026);
assert.equal(yearRange2026.endDate.getMonth(), 11);
assert.equal(yearRange2026.endDate.getDate(), 31);
assert.match(yearRange2026.title, /01\.01\.2026.*31\.12\.2026/);

const calendar = writer.buildScheduleCalendar(
  [
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
  ],
  { year: 2026 },
);
assert.equal(calendar.rows[0][0], "QUANTITY");
assert.equal(calendar.rows[0][1], "FML");
assert.equal(calendar.dateCount, 365);
assert.equal(calendar.year, 2026);
assert.equal(calendar.personCount, 2);
const firstPersonRow = calendar.rows.find((row) => row[1] === "Перша Людина");
const secondPersonRow = calendar.rows.find((row) => row[1] === "Друга Людина");
assert.equal(firstPersonRow[0], 3);
assert.deepEqual(Array.from(firstPersonRow.slice(2, 6)), [
  "В1",
  "В1",
  "",
  "СО",
]);
assert.deepEqual(Array.from(secondPersonRow.slice(2, 6)), ["", "ВД", "ВД", ""]);
assert.equal(calendar.startDate.getMonth(), 0);
assert.equal(calendar.startDate.getDate(), 1);
assert.equal(calendar.endDate.getMonth(), 11);
assert.equal(calendar.endDate.getDate(), 31);

const inactiveScheduleAudit = service.buildScheduleAudit([
  inactiveVacation("Губарев Станіслав Павлович", "2026-01-10", "2026-01-24"),
  vacation("Лагодний", "2026-03-09", "2026-03-23"),
]);
assert.equal(
  inactiveScheduleAudit.schedule.length,
  2,
  "inactive vacations must still appear in annual schedule source",
);
assert.ok(
  inactiveScheduleAudit.schedule.some(
    (item) => item.fml === "Губарев Станіслав Павлович",
  ),
  "inactive january vacation must be included in schedule",
);

const pastYearCalendar = writer.buildScheduleCalendar(
  inactiveScheduleAudit.schedule,
  { year: 2026 },
);
function calendarMarkerAt(calendar, fml, isoDate) {
  const row = calendar.rows.find((entry) => entry[1] === fml);
  assert.ok(row, `schedule row missing for ${fml}`);
  const colIndex = calendar.rows[0].findIndex((value) => {
    return (
      value instanceof Date && value.toISOString().slice(0, 10) === isoDate
    );
  });
  assert.notEqual(colIndex, -1, `schedule date missing: ${isoDate}`);
  return row[colIndex];
}
assert.equal(
  calendarMarkerAt(
    pastYearCalendar,
    "Губарев Станіслав Павлович",
    "2026-01-10",
  ),
  "В1",
  "inactive january vacation must be painted in january",
);
assert.equal(
  calendarMarkerAt(
    pastYearCalendar,
    "Губарев Станіслав Павлович",
    "2026-01-24",
  ),
  "В1",
);
assert.equal(
  calendarMarkerAt(pastYearCalendar, "Лагодний", "2026-03-09"),
  "В1",
  "march vacation must be painted in march",
);
assert.equal(
  calendarMarkerAt(
    writer.buildScheduleCalendar(
      service.buildScheduleAudit([
        vacation("Печерик", "2026-03-15", "2026-03-31"),
        vacation("Сухоруков", "2026-03-25", "2026-04-08"),
      ]).schedule,
      { year: 2026 },
    ),
    "Печерик",
    "2026-03-31",
  ),
  "В1",
);
assert.equal(
  calendarMarkerAt(
    writer.buildScheduleCalendar(
      service.buildScheduleAudit([
        vacation("Сухоруков", "2026-03-25", "2026-04-08"),
      ]).schedule,
      { year: 2026 },
    ),
    "Сухоруков",
    "2026-03-25",
  ),
  "В1",
  "cross-month vacation must be painted at march start",
);
assert.equal(
  calendarMarkerAt(
    writer.buildScheduleCalendar(
      service.buildScheduleAudit([
        vacation("Сухоруков", "2026-03-25", "2026-04-08"),
      ]).schedule,
      { year: 2026 },
    ),
    "Сухоруков",
    "2026-04-08",
  ),
  "В1",
  "cross-month vacation must be painted through april end",
);

const negativeDaysLeftAudit = service.buildScheduleAudit([
  {
    ...inactiveVacation("Минула Відпустка", "2026-01-01", "2026-01-15"),
    daysLeft: -40,
  },
]);
assert.equal(
  negativeDaysLeftAudit.schedule.length,
  1,
  "daysLeft must not exclude vacations from annual schedule",
);

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
  ["START_GAP", "PERSON_GAP", "MAX_PERSON_YEAR"],
);
assert.deepEqual(
  Array.from(normalizedChecks, (item) => item.label),
  [
    "Дати початку занадто близько",
    "Замалий інтервал між відпустками",
    "Забагато відпусток у році",
  ],
);
assert.equal(
  writer.humanRuleLabel("GAP_TOO_SHORT"),
  "Замалий інтервал між відпустками",
);
assert.doesNotMatch(
  writer.humanRuleLabel("PERSON_GAP"),
  /GAP_TOO_SHORT|START_TOO_CLOSE|YEAR_LIMIT/,
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
assert.ok(Array.isArray(normalizedProblems[0].fixSuggestions));

function vacationWithMeta(fml, start, end, vacationNumber, meta = {}) {
  return {
    fml,
    personKey: fml,
    startDate: date(start),
    endDate: date(end),
    vacationNumber,
    active: true,
    intervalCheck: meta.intervalCheck || "",
    _meta: {
      rowNumber: meta.rowNumber || vacationNumber + 10,
      startColumn: meta.startColumn || 1,
      writable: meta.writable !== false,
    },
  };
}

const dec2026Vacations = [
  vacationWithMeta("Панасейко Денис Ігорович", "2026-12-04", "2026-12-18", 1, {
    rowNumber: 10,
  }),
  vacationWithMeta(
    "Омелянський Олександр Юрійович",
    "2026-12-08",
    "2026-12-22",
    1,
    {
      rowNumber: 11,
    },
  ),
  vacationWithMeta(
    "Івченко Олександр Олександрович",
    "2026-12-10",
    "2026-12-24",
    1,
    {
      rowNumber: 12,
    },
  ),
  vacationWithMeta(
    "Ковальчук Михайло Петрович",
    "2026-12-14",
    "2026-12-28",
    1,
    {
      rowNumber: 13,
    },
  ),
  vacationWithMeta(
    "Рябінін Сергій Олексійович",
    "2026-08-05",
    "2026-08-19",
    1,
    {
      rowNumber: 14,
      intervalCheck: "LOCKED",
    },
  ),
  vacationWithMeta(
    "Рябінін Сергій Олексійович",
    "2026-12-20",
    "2027-01-03",
    2,
    {
      rowNumber: 15,
      startColumn: 1,
    },
  ),
  vacationWithMeta(
    "Рябінін Сергій Олексійович",
    "2027-09-03",
    "2027-09-17",
    1,
    {
      rowNumber: 16,
    },
  ),
  vacationWithMeta(
    "Монько Дмитро Володимирович",
    "2026-12-21",
    "2027-01-04",
    1,
    {
      rowNumber: 15,
    },
  ),
];

const suggestionContext = suggestionsModule.buildSuggestionContext_(
  [],
  dec2026Vacations,
);

const overlapIssue = {
  rule: "MAX_CONCURRENT",
  date: "2026-12-21",
  fml: "Омелянський Олександр Юрійович, Івченко Олександр Олександрович, Ковальчук Михайло Петрович, Рябінін Сергій Олексійович, Монько Дмитро Володимирович",
  severity: "ERROR",
};
const overlapSuggestions = suggestionsModule.suggestForTooManyOverlaps_(
  overlapIssue,
  suggestionContext,
);
assert.ok(
  overlapSuggestions.some((item) => item.personName.includes("Монько")),
  "overlap suggestions must include Monko move",
);
const monkoSuggestion = overlapSuggestions.find((item) =>
  item.personName.includes("Монько"),
);
assert.ok(monkoSuggestion, "Monko suggestion must exist");
assert.equal(monkoSuggestion.oldStart, "21.12.2026");
assert.equal(monkoSuggestion.oldEnd, "04.01.2027");
assert.equal(monkoSuggestion.newStart, "04.01.2027");
assert.equal(monkoSuggestion.newEnd, "18.01.2027");
assert.equal(
  monkoSuggestion.days,
  service.daysBetween(date("2026-12-21"), date("2027-01-04")) + 1,
  "suggestion must include days for auto-apply",
);
assert.equal(
  monkoSuggestion.canAutoApply,
  true,
  "Monko move must be auto-applicable",
);
assert.ok(
  overlapSuggestions.every(
    (item) => item.oldStart !== "03.09.2027" && item.oldEnd !== "17.09.2027",
  ),
  "overlap suggestions must not move unrelated Ryabinin vacation in September 2027",
);
assert.equal(
  service.daysBetween(date("2026-12-21"), date("2027-01-04")) + 1,
  service.daysBetween(date("2027-01-04"), date("2027-01-18")) + 1,
  "Monko move must preserve duration",
);

const overlapAfter = suggestionsModule.validateVacationCandidate_(
  {
    target: dec2026Vacations.find((item) => item.fml.includes("Монько")),
    newStart: date("2027-01-04"),
    newEnd: date("2027-01-18"),
    days: 15,
    fixesError: true,
  },
  suggestionContext,
);
assert.equal(overlapAfter.ok, true, "Monko candidate must validate");

const modifiedDecVacations = dec2026Vacations.map(function (vacation) {
  if (vacation.fml.includes("Монько")) {
    return vacationWithMeta(
      vacation.fml,
      "2027-01-04",
      "2027-01-18",
      vacation.vacationNumber,
      { rowNumber: 15 },
    );
  }
  return vacation;
});
function countPeopleOnDate(vacations, dayKey) {
  return vacations.filter(function (vacation) {
    const startKey =
      vacation.startDate.getFullYear() +
      "-" +
      String(vacation.startDate.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(vacation.startDate.getDate()).padStart(2, "0");
    const endKey =
      vacation.endDate.getFullYear() +
      "-" +
      String(vacation.endDate.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(vacation.endDate.getDate()).padStart(2, "0");
    return dayKey >= startKey && dayKey <= endKey;
  }).length;
}
assert.ok(
  ["2026-12-21", "2026-12-22"].every(function (day) {
    return countPeopleOnDate(modifiedDecVacations, day) <= 4;
  }),
  "after Monko move old overlap dates must have <=4 people",
);

const lockedSuggestions = overlapSuggestions.filter(
  (item) => item.oldStart === "05.08.2026" && item.oldEnd === "19.08.2026",
);
assert.equal(
  lockedSuggestions.length,
  0,
  "locked Ryabinin first vacation must not be suggested for move",
);

const intervalIssue = {
  rule: "PERSON_GAP",
  date: "2026-08-05 / 2026-12-20",
  fml: "Рябінін Сергій Олексійович",
  primaryFml: "Рябінін Сергій Олексійович",
};
const intervalSuggestions = suggestionsModule.suggestForMinInterval_(
  intervalIssue,
  suggestionContext,
);
assert.ok(intervalSuggestions.length >= 1, "interval suggestions must exist");
assert.ok(
  intervalSuggestions.some((item) => item.newStartIso >= "2027-01-16"),
  "interval suggestion must start at previousEnd + 150 days",
);

const june2026Vacations = [
  vacationWithMeta("A", "2026-06-01", "2026-06-05", 1),
  vacationWithMeta("B", "2026-06-10", "2026-06-14", 1),
  vacationWithMeta(
    "Омелянський Олександр Юрійович",
    "2026-06-02",
    "2026-06-20",
    1,
    { rowNumber: 20 },
  ),
];
const juneAudit = service.buildScheduleAudit(june2026Vacations);
assert.ok(
  !juneAudit.checks.some((item) => item.rule === "MONTH_BALANCE"),
  "3 June starts must not create MONTH_BALANCE",
);
const july2026Vacations = june2026Vacations.concat([
  vacationWithMeta("D", "2026-06-15", "2026-06-19", 1),
]);
assert.ok(
  !service
    .buildScheduleAudit(july2026Vacations)
    .checks.some((item) => item.rule === "MONTH_BALANCE"),
  "4 June starts must not create MONTH_BALANCE",
);
const juneSixVacations = july2026Vacations.concat([
  vacationWithMeta("E", "2026-06-22", "2026-06-26", 1),
  vacationWithMeta("F", "2026-06-25", "2026-06-29", 1),
]);
const juneSixAudit = service.buildScheduleAudit(juneSixVacations);
assert.ok(
  juneSixAudit.checks.some((item) => item.rule === "MONTH_BALANCE"),
  "6 June starts must create MONTH_BALANCE",
);
const juneSixSuggestions = suggestionsModule.suggestForMonthStartSkew_(
  {
    rule: "MONTH_BALANCE",
    date: "2026-06",
    fml: "Омелянський Олександр Юрійович",
  },
  suggestionsModule.buildSuggestionContext_([], juneSixVacations),
);
assert.ok(
  juneSixSuggestions.length >= 1,
  "June 2026 skew must produce suggestions",
);
assert.ok(
  juneSixSuggestions.every((item) => !item.newStartIso.startsWith("2026-06")),
  "MONTH_BALANCE must not propose newStart in the same month",
);
assert.ok(
  juneSixSuggestions.every(function (item) {
    return (
      !item.effect ||
      !item.effect.some(function (line) {
        return line.indexOf("Зменшує кількість стартів") !== -1;
      }) ||
      item.newStartIso.slice(0, 7) !== "2026-06"
    );
  }),
  "month reduction effect must only appear when start count actually drops",
);

const monthIssue = {
  rule: "MONTH_BALANCE",
  date: "2026-12",
  fml: dec2026Vacations
    .filter((item) => item.startDate.getMonth() === 11)
    .map((item) => item.fml)
    .join(", "),
};
const monthSuggestions = suggestionsModule.suggestForMonthStartSkew_(
  monthIssue,
  suggestionContext,
);
assert.ok(monthSuggestions.length >= 1, "month skew suggestions must exist");
assert.ok(
  monthSuggestions.every((item) => !item.newStartIso.startsWith("2026-12")),
  "December MONTH_BALANCE must not propose same-month starts",
);
assert.equal(
  dec2026Vacations.filter(
    (item) =>
      item.startDate.getFullYear() === 2026 && item.startDate.getMonth() === 11,
  ).length,
  6,
  "December 2026 fixture must contain 6 starts",
);

const may2027Vacations = [
  vacationWithMeta("A", "2027-05-01", "2027-05-15", 1),
  vacationWithMeta("B", "2027-05-03", "2027-05-17", 1),
  vacationWithMeta("C", "2027-05-05", "2027-05-19", 1),
  vacationWithMeta("D", "2027-05-07", "2027-05-21", 1),
  vacationWithMeta("E", "2027-05-09", "2027-05-23", 1),
  vacationWithMeta("F", "2027-05-11", "2027-05-25", 1),
];
const mayContext = suggestionsModule.buildSuggestionContext_(
  [],
  may2027Vacations,
);
const mayAudit = service.buildScheduleAudit(may2027Vacations);
assert.ok(
  mayAudit.checks.some((item) => item.rule === "MONTH_BALANCE"),
  "May 2027 fixture must trigger month skew",
);
const mayMonthSuggestions = suggestionsModule.suggestForMonthStartSkew_(
  {
    rule: "MONTH_BALANCE",
    date: "2027-05",
    fml: "A, B, C, D, E, F",
  },
  mayContext,
);
assert.ok(mayMonthSuggestions.length >= 1, "May 2027 must produce suggestions");
assert.ok(
  mayMonthSuggestions.every((item) => !item.newStartIso.startsWith("2027-05")),
  "May 2027 suggestions must leave May",
);

const intervalHardApply = suggestionsModule.validateVacationCandidate_(
  {
    target: dec2026Vacations.find(
      (item) =>
        item.fml.includes("Рябінін") && item.startDate.getMonth() === 11,
    ),
    newStart: date("2026-12-25"),
    newEnd: date("2027-01-08"),
    days: 15,
  },
  suggestionContext,
);
assert.ok(
  intervalHardApply.hardErrors.length > 0,
  "candidate violating 150-day start gap must produce hard errors",
);
assert.equal(intervalHardApply.ok, false);

const badCandidate = suggestionsModule.validateVacationCandidate_(
  {
    target: dec2026Vacations.find((item) => item.fml.includes("Монько")),
    newStart: date("2026-12-21"),
    newEnd: date("2027-01-04"),
    days: 15,
  },
  suggestionContext,
);
assert.equal(badCandidate.ok, false, "candidate that keeps overlap must fail");

assert.ok(
  overlapSuggestions.every((item) => item.score < 9999),
  "top overlap suggestions must not contain hard-error candidates",
);

const writeResult = writer.writeVacationToSource({
  fml: "Нова Друга",
  vacationNumber: 2,
  startDate: date("2026-10-01"),
  endDate: date("2026-10-15"),
  days: 15,
});
assert.equal(writeResult.startColumn, 1);
assert.equal(
  sourceSheet.valueAt(writeResult.rowNumber, 1),
  "Нова Друга",
  "second vacation must be written into A:I",
);
assert.equal(
  sourceSheet.valueAt(writeResult.rowNumber, 4),
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
  sourceSheet.valueAt(replacementWrite.rowNumber, 8),
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
formulaRows[2].splice(
  0,
  9,
  "Генерована Людина",
  date("2026-03-01"),
  date("2026-03-15"),
  "друга відпустка",
  true,
  true,
  15,
  0,
  true,
);
const formulaHeaders = [Array(19).fill("")];
[2, 4, 5, 6, 8].forEach((index) => {
  formulaHeaders[0][index] = "=ARRAYFORMULA()";
});
sourceSheet = new FakeSheet("VACATIONS", formulaRows, formulaHeaders);
const formulaMerged = repository.listAll();
assert.equal(
  formulaMerged.find((item) => item.fml === "Формула Людина")._meta.writable,
  true,
);
assert.equal(
  formulaMerged.find((item) => item.fml === "Генерована Людина")._meta.writable,
  true,
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
assert.equal(generatedWrite.startColumn, 1);
assert.equal(generatedWrite.rowNumber, 3);
assert.equal(sourceSheet.valueAt(3, 1), "Генерована Людина");
assert.equal(
  sourceSheet.valueAt(generatedWrite.rowNumber, 4),
  "друга відпустка",
);

function sourceVacationRow(entry) {
  const row = Array(19).fill("");
  row.splice(
    0,
    9,
    entry.fml,
    date(entry.start),
    date(entry.end),
    entry.type,
    entry.active !== false,
    entry.notify !== false,
    entry.daysLeft != null ? entry.daysLeft : entry.days,
    "",
    "OK",
  );
  return row;
}

function sourceVacationSheet(entries) {
  return [Array(19).fill(""), ...entries.map(sourceVacationRow)];
}

function dateColumn(sheet, expected) {
  for (let rowIndex = 0; rowIndex < sheet.rows.length; rowIndex++) {
    const columnIndex = (sheet.rows[rowIndex] || []).findIndex((value) => {
      if (!(value instanceof Date)) return false;
      return value.toISOString().slice(0, 10) === expected;
    });
    if (columnIndex !== -1) return columnIndex + 1;
  }
  assert.fail(`schedule must contain ${expected}`);
}

sourceSheet = new FakeSheet(
  "VACATIONS",
  sourceVacationSheet([
    {
      fml: "А Змішана",
      start: "2026-01-31",
      end: "2026-03-01",
      type: "перша відпустка",
      days: 30,
    },
    {
      fml: "А Змішана",
      start: "2026-02-01",
      end: "2026-02-01",
      type: "друга відпустка",
      days: 1,
    },
    {
      fml: "Б Додаткова",
      start: "2026-02-01",
      end: "2026-02-01",
      type: "додаткова відпустка",
      days: 1,
    },
    {
      fml: "В Сімейна",
      start: "2026-03-01",
      end: "2026-03-01",
      type: "сімейні обставини",
      days: 1,
    },
    {
      fml: "Г Друга",
      start: "2026-02-02",
      end: "2026-02-02",
      type: "друга відпустка",
      days: 1,
    },
  ]),
);
generatedSheets = {};
const sourceBeforeRebuild = sourceSheet.rows.map((row) => row.slice());
const multiMonthRebuild = writer.rebuildVacationSystem({ year: 2026 });
const scheduleSheet = generatedSheets.VACATION_SCHEDULE;
assert.ok(scheduleSheet, "rebuild must create VACATION_SCHEDULE");
assert.equal(multiMonthRebuild.scheduleYear, 2026);
assert.equal(multiMonthRebuild.scheduleDays, 365);
assert.match(String(scheduleSheet.rows[0][0]), /2026/);
assert.deepEqual(Array.from(multiMonthRebuild.affectedSheets), [
  "VACATION_SCHEDULE",
  "VACATION_CHECK",
]);
assert.deepEqual(
  sourceSheet.rows,
  sourceBeforeRebuild,
  "calendar formatting must not mutate VACATIONS source rows",
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
assert.ok(
  scheduleSheet.borders.some((border) => border.col === jan31Column),
  "month separator must appear at month boundary",
);
assert.ok(
  (scheduleSheet.numberFormats || []).some(
    (entry) => entry.format === "dd.MM.yy" && entry.row === 2,
  ),
  "date headers must use dd.MM.yy so year is visible",
);
scheduleSheet.borders.forEach((border) => {
  assert.equal(border.row, 2);
  assert.equal(border.numRows, multiMonthRebuild.schedulePeople + 1);
  assert.equal(border.args[3], true);
  assert.equal(border.args[6], "#000000");
  assert.equal(border.args[7], "SOLID_MEDIUM");
});

sourceSheet = new FakeSheet(
  "VACATIONS",
  sourceVacationSheet([
    {
      fml: "Один Місяць",
      start: "2026-04-01",
      end: "2026-04-15",
      type: "перша відпустка",
      days: 15,
    },
  ]),
);
generatedSheets = {};
const singleMonthRebuild = writer.rebuildVacationSystem({ year: 2026 });
assert.equal(singleMonthRebuild.schedulePeople, 1);
assert.equal(singleMonthRebuild.scheduleDays, 365);
assert.ok(
  generatedSheets.VACATION_SCHEDULE.borders.length >= 11,
  "full-year calendar must add month separators",
);

sourceSheet = new FakeSheet(
  "VACATIONS",
  sourceVacationSheet([
    {
      fml: "Губарев Станіслав Павлович",
      start: "2026-01-10",
      end: "2026-01-24",
      type: "перша відпустка",
      days: 15,
      active: false,
      daysLeft: -30,
    },
    {
      fml: "Лагодний",
      start: "2026-03-09",
      end: "2026-03-23",
      type: "перша відпустка",
      days: 15,
      active: false,
      daysLeft: -5,
    },
  ]),
);
generatedSheets = {};
const inactiveSourceRebuild = writer.rebuildVacationSystem({ year: 2026 });
assert.equal(
  inactiveSourceRebuild.schedulePeople,
  2,
  "rebuild must paint inactive past vacations for the selected year",
);
const inactiveSourceSchedule = generatedSheets.VACATION_SCHEDULE;
const gubarevRow = inactiveSourceSchedule.rows.findIndex(
  (row) => row[1] === "Губарев Станіслав Павлович",
);
assert.notEqual(gubarevRow, -1);
assert.equal(
  inactiveSourceSchedule.backgroundAt(
    gubarevRow + 1,
    dateColumn(inactiveSourceSchedule, "2026-01-10"),
  ),
  "#D9EAD3",
  "inactive january vacation must be painted on VACATION_SCHEDULE",
);
assert.equal(
  inactiveSourceSchedule.backgroundAt(
    inactiveSourceSchedule.rows.findIndex((row) => row[1] === "Лагодний") + 1,
    dateColumn(inactiveSourceSchedule, "2026-03-09"),
  ),
  "#D9EAD3",
  "inactive march vacation must be painted on VACATION_SCHEDULE",
);

sourceSheet = new FakeSheet("VACATIONS", [Array(19).fill("")]);
generatedSheets = {};
const emptyRebuild = writer.rebuildVacationSystem({ year: 2026 });
assert.equal(emptyRebuild.schedulePeople, 0);
assert.equal(emptyRebuild.scheduleDays, 365);
assert.match(
  String(generatedSheets.VACATION_SCHEDULE.rows[0][0]),
  /2026/,
  "empty schedule must still show year title",
);
assert.ok(
  generatedSheets.VACATION_SCHEDULE.borders.length >= 11,
  "empty full-year calendar must still add month separators",
);

sourceSheet = new FakeSheet(
  "VACATIONS",
  sourceVacationSheet([
    {
      fml: "Гап Людина",
      start: "2026-01-01",
      end: "2026-01-15",
      type: "перша відпустка",
      days: 15,
    },
    {
      fml: "Гап Людина",
      start: "2026-02-01",
      end: "2026-02-15",
      type: "друга відпустка",
      days: 15,
    },
  ]),
);
generatedSheets = {};
const gapReport = writer.generateVacationReport();
assert.ok(gapReport.errorCount > 0, "short gaps must be blocking");
assert.equal(gapReport.warningCount, 0, "short gap report must not include warnings");
assert.ok(gapReport.problemCount > 0, "gap report must include problems");
assert.match(gapReport.summary, /⚠️ Проблемні питання: \d+/);
assert.match(gapReport.summary, /• Замалий інтервал між відпустками —/);
assert.doesNotMatch(
  gapReport.summary,
  /GAP_TOO_SHORT|YEAR_LIMIT|START_TOO_CLOSE|Порушень:/,
);
assert.match(
  gapReport.summary,
  /Деталі та варіанти вирішення доступні в розділі «Проблемні питання»/,
);
assert.equal(gapReport.adminSheet, "VACATION_CHECK");
assert.match(gapReport.problemSummary.summaryLine, /Усі пов'язані із/);

const rightPanelRows = [
  Array(19).fill(""),
  Array(19).fill(""),
  Array(19).fill(""),
];
rightPanelRows[1].splice(
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
rightPanelRows[2].splice(
  10,
  9,
  "Права Людина",
  date("2026-09-01"),
  date("2026-09-15"),
  "друга відпустка",
  true,
  true,
  15,
  "",
  "OK",
);
sourceSheet = new FakeSheet("VACATIONS", rightPanelRows);
const verifyBeforeMigration = repository.verifySingleVacationSource();
assert.equal(verifyBeforeMigration.ok, false);
assert.ok(
  verifyBeforeMigration.issues.some((item) => item.includes("K:Q")),
  "verifySingleVacationSource must warn about right-panel manual data",
);
const migrationResult = repository.migrateRightVacationTableToMainSource();
assert.equal(migrationResult.migrated, 1);
assert.equal(sourceSheet.valueAt(3, 1), "Права Людина");
assert.equal(sourceSheet.valueAt(2, 11), "");
assert.equal(sourceSheet.valueAt(1, 11), plannerConfig.RIGHT_PANEL.headerLabel);
const verifyAfterMigration = repository.verifySingleVacationSource();
assert.equal(verifyAfterMigration.ok, true);
assert.equal(verifyAfterMigration.rightPanelRows, 0);
const duplicateMigration = repository.migrateRightVacationTableToMainSource();
assert.equal(duplicateMigration.migrated, 0);

const code = fs.readFileSync(path.join(repoRoot, "Code.gs"), "utf8");
const sidebarHtml = fs.readFileSync(
  path.join(repoRoot, "Sidebar.html"),
  "utf8",
);
assert.ok(
  sidebarHtml.split(/\r?\n/).length >= 520,
  "Sidebar.html must stay expanded (>=520 lines); disable HTML format-on-save",
);
assert.match(
  sidebarHtml,
  /<button\s*\n\s+type="button"/,
  "Sidebar.html is compressed by HTML formatter; reload from disk and do not format-on-save",
);
const jsVacations = fs.readFileSync(
  path.join(repoRoot, "Js.Vacations.html"),
  "utf8",
);
const stylesPersonnel = fs.readFileSync(
  path.join(repoRoot, "Styles_30_Personnel.html"),
  "utf8",
);
assert.ok(
  stylesPersonnel.split(/\r?\n/).length >= 500,
  "Styles_30_Personnel.html must stay expanded (>=500 lines); disable HTML format-on-save for Styles_*.html",
);
assert.doesNotMatch(
  stylesPersonnel,
  /\} \.[a-z#]/,
  "Styles_30_Personnel.html is minified; use CSS mode (not HTML) and avoid clasp pull over local edits",
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
  formatDateForDisplay(value) {
    if (!value) return "";
    if (typeof value === "string" && /\d{4}-\d{2}-\d{2}/.test(value)) {
      return value.replace(
        /\b(\d{4})-(\d{2})-(\d{2})\b/g,
        (_, y, m, d) => `${d}.${m}.${y}`,
      );
    }
    return String(value);
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
  "MIN_PERSON_YEAR",
  "MAX_PERSON_YEAR",
  "PERSON_OVERLAP",
  "PERSON_GAP",
  "START_GAP",
  "MAX_CONCURRENT",
  "PERSONNEL_VACATION_WITHOUT_PLAN",
  "MONTHLY_VACATION_WITHOUT_PLAN",
  "PLAN_WITHOUT_MONTHLY_VACATION",
  "HIGH_LOAD_PERIOD",
  "MONTH_BALANCE",
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
assert.match(problemCardsHtml, /Замалий інтервал між відпустками/);
assert.match(problemCardsHtml, /Варіанти вирішення:/);
assert.match(problemCardsHtml, /Підібрати нову дату/);
assert.doesNotMatch(problemCardsHtml, /Тест <script>/);
assert.doesNotMatch(
  renderVacationProblems([{ type: "INVALID_DATE", fml: "Тест" }]),
  /Підібрати нову дату/,
);
assert.match(jsVacations, /function formatDateUa/);
assert.match(jsVacations, /fmtDate\(vacation\.startDate\)/);
const formatDateUa = vm.runInContext("formatDateUa", vacationClientContext);
assert.equal(formatDateUa("2027-05-13"), "13.05.2027");
assert.equal(formatDateUa("13.05.2027"), "13.05.2027");
assert.equal(
  formatDateUa("2026-01-01 / 2026-07-01"),
  "01.01.2026 / 01.07.2026",
);
const vacationClientModule = vm.runInContext(
  "VacationModule",
  vacationClientContext,
);
vacationClientModule.state.vacations = [
  {
    fml: "Пелих Артем Андрійович",
    type: "В1",
    startDate: "2027-05-13",
    endDate: "2027-05-27",
    days: 15,
    manageable: true,
  },
];
vacationClientModule.state.activeTab = "plan";
vacationClientModule.render();
assert.match(vacationClientRendered, /13\.05\.2027 — 27\.05\.2027 \(15 дн\.\)/);
assert.doesNotMatch(vacationClientRendered, /2027-05-13/);
vacationClientModule.state.vacations = [];
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
const sidebarService = readRepo("VacationSidebarService.gs");
const sidebarServer = fs.readFileSync(
  path.join(repoRoot, "SidebarServer.gs"),
  "utf8",
);
const sidebar = fs.readFileSync(
  path.join(repoRoot, "VacationSidebar.html"),
  "utf8",
);
const writerSource = readRepo("VacationOptionsWriter.gs");
const plannerServiceSource = readRepo("VacationPlannerService.gs");
const engineSource = readRepo("VacationEngine.gs");
const onOpenMenuBlock = code.match(
  /createMenu\("WASB"\)([\s\S]*?)\.addToUi\(\)/,
);
assert.ok(onOpenMenuBlock, "onOpen must register WASB menu");
assert.equal(
  (onOpenMenuBlock[1].match(/\.addItem\(/g) || []).length,
  1,
  "WASB menu must expose exactly one item",
);
assert.match(code, /addItem\("Відкрити панель", "showSidebar"\)/);
assert.doesNotMatch(code, /Перейти до відпусток/);
assert.doesNotMatch(code, /Оновити меню/);
assert.doesNotMatch(code, /createMenu\("Відпустки"\)/);
assert.doesNotMatch(code, /addSubMenu/);
assert.match(sidebarServer, /function getSidebarLaunchSection\(/);
assert.match(sidebarServer, /getSidebarLaunchSection_/);
assert.match(jsHelpers, /getSidebarLaunchSection"/);
assert.doesNotMatch(jsHelpers, /getSidebarLaunchSection_"/);
assert.match(jsHelpers, /launchSection === "vacations"/);
assert.match(writerSource, /buildVacationScheduleYearRange_/);
assert.match(writerSource, /new Date\(y, 0, 1/);
assert.match(writerSource, /new Date\(y, 11, 31/);
assert.match(writerSource, /dd\.MM\.yy/);
assert.match(
  plannerServiceSource,
  /const scheduleVacations = normalizedAll/,
  "annual schedule must include inactive vacations",
);
assert.doesNotMatch(
  plannerServiceSource,
  /const schedule = vacations[\s\S]{0,120}\.map\(function \(vacation\)/,
  "schedule must not be limited to active vacations only",
);
assert.match(sidebarService, /scheduleYear:/);
assert.match(jsVacations, /getScheduleYear_/);
assert.match(jsVacations, /vacScheduleYear/);
assert.match(jsVacations, /openUpdatedVacationScheduleFromSidebar[\s\S]*year:/);
assert.match(jsVacations, /openUpdatedSchedule\(\)/);
assert.match(jsVacations, /Оновити і відкрити графік/);
assert.match(jsVacations, /openUpdatedVacationScheduleFromSidebar/);
assert.match(jsVacations, /\[VacationModule\.openUpdatedSchedule\] clicked/);
assert.doesNotMatch(jsVacations, /Оновити стан/);
assert.match(jsVacations, /↻ Оновити дані/);
assert.match(
  jsVacations,
  /title="Оновлює дані бокової панелі з таблиці\. Не перебудовує графік\."/,
);
assert.doesNotMatch(jsVacations, /🔄 Оновити графік/);
assert.doesNotMatch(jsVacations, /Оновити графік/);
assert.doesNotMatch(jsVacations, /Відкрити графік/);
assert.doesNotMatch(jsVacations, /Відкрити календар/);
assert.doesNotMatch(sidebar, /Відкрити календар/);
assert.doesNotMatch(sidebar, /data-panel="/);
assert.doesNotMatch(sidebar, /Оновити графік/);
assert.doesNotMatch(sidebar, /Відкрити графік/);
assert.doesNotMatch(sidebar, /rebuildVacationScheduleFromSidebar/);
assert.doesNotMatch(sidebar, /openVacationScheduleFromSidebar/);
assert.match(
  sidebar,
  /Розділ «Відпустки» перенесено[\s\S]*Відкрити панель → 🏖️ Відпустки/,
);
assert.match(sidebarService, /Окремий sidebar відпусток вимкнено/);
assert.doesNotMatch(
  fs.readFileSync(path.join(repoRoot, "Code.gs"), "utf8"),
  /showVacationSidebar/,
);
const allGsSources = walkGasFiles(repoRoot)
  .map((name) => fs.readFileSync(path.join(repoRoot, name), "utf8"))
  .join("\n");
assert.doesNotMatch(
  allGsSources,
  /createTemplateFromFile\("VacationSidebar"\)/,
);
assert.doesNotMatch(
  allGsSources,
  /createHtmlOutputFromFile\("VacationSidebar"\)/,
);
assert.doesNotMatch(jsVacations, /VacationModule\.rebuildSchedule\(\)/);
assert.match(sidebarService, /openUpdatedVacationScheduleFromSidebar/);
assert.match(sidebarService, /function openUpdatedSchedule\(formData\)/);
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
assert.match(jsVacations, /const VACATION_RULE_HUMAN_LABELS = \{/);
assert.match(jsVacations, /function humanVacationRuleLabel_/);
assert.match(jsVacations, /scheduleSummaryHtml\(\)/);
assert.match(jsVacations, /🏖️ Графік відпусток/);
assert.match(jsVacations, /requestStatusLabel\(status\)/);
assert.match(sidebarService, /status:\s*String\(vacation\.status/);
assert.match(jsVacations, /\{ id: "plan", label: "План" \}/);
assert.doesNotMatch(jsVacations, /\{ id: "schedule", label: "Графік" \}/);
assert.doesNotMatch(jsVacations, /\{ id: "move", label: "Перенести" \}/);
assert.match(
  renderVacationProblems([
    { type: "GAP_TOO_SHORT", fml: "Тест", date: "2026-07-01" },
  ]),
  /Замалий інтервал між відпустками/,
);
assert.doesNotMatch(
  renderVacationProblems([
    { type: "GAP_TOO_SHORT", fml: "Тест", date: "2026-07-01" },
  ]),
  /GAP_TOO_SHORT/,
);
assert.match(jsVacations, /function buildVacationProblemSuggestions_/);
assert.match(jsVacations, /function renderVacationFixSuggestions_/);
assert.match(jsVacations, /applyFixSuggestion\(/);
assert.match(sidebarService, /applyVacationSuggestionFromSidebar/);
assert.match(sidebarService, /applyRightPanelMigrationFromSidebar/);
assert.match(jsVacations, /applyRightPanelMigrationFromSidebar/);
assert.match(jsVacations, /applyRightPanelMigration\(\)/);
assert.match(jsVacations, /Міграція K:Q → A:I/);
assert.match(
  jsVacations,
  /RIGHT_PANEL_LEGACY_DATA[\s\S]*?Міграція K:Q → A:I/,
  "right-panel problem card must expose migration action",
);
assert.match(
  readRepo("Vacation_Suggestions.gs"),
  /function buildVacationFixSuggestions_/,
);
assert.match(jsVacations, /function renderVacationProblems_/);
assert.match(jsVacations, /Проблемні питання/);
assert.match(jsVacations, /Знайти проблеми/);
assert.match(
  jsVacations,
  /async loadProblems\(\)[\s\S]*?"checkVacationRulesFromSidebar"/,
);
assert.match(jsVacations, /Натисніть «Знайти проблеми»/);
assert.match(jsVacations, /Підібрати пакетне рішення/);
assert.match(jsVacations, /Застосувати пакетне рішення/);
assert.match(jsVacations, /buildVacationBulkFixPlanFromSidebar/);
assert.match(jsVacations, /applyVacationBulkFixPlanFromSidebar/);
assert.match(jsVacations, /getVacationMonthCalendarFromSidebar/);
assert.match(jsVacations, /getVacationCalendarDayDetailsFromSidebar/);
assert.match(jsVacations, /loadMonthCalendar\(/);
assert.match(jsVacations, /buildVacationDayTooltip_/);
assert.match(jsVacations, /getVacationLoadLevelLabel_/);
assert.match(jsVacations, /vacations-mini-calendar__day-divider/);
assert.match(jsVacations, /vacations-mini-calendar__day-card/);
assert.match(jsVacations, /Проблемних дат:/);
assert.match(jsVacations, /loadMonthCalendar\(\{ year: year, month: month \}\)/);
assert.doesNotMatch(
  jsVacations,
  /Макс\. одночасно:/,
  "mini calendar summary must not show static rule text",
);
assert.doesNotMatch(
  jsVacations,
  /Коротке перевантаження:/,
  "mini calendar summary must not show static overload rule text",
);
assert.match(
  stylesPersonnel,
  /\.vacations-mini-calendar__day-divider/,
  "mini calendar day cell must include divider",
);
assert.match(jsVacations, /showCalendarDayDetails\(/);
assert.match(jsVacations, /for=\\"vacCalendarYear\\"/);
assert.match(jsVacations, /for=\\"vacCalendarMonth\\"/);
assert.match(jsVacations, /for=\\"vacScheduleYear\\"/);
assert.match(jsVacations, /for=\\"vacAddPerson\\"/);
assert.match(jsVacations, /for=\\"vacCheckDays\\"/);
assert.match(sidebarService, /buildVacationBulkFixPlanFromSidebar/);
assert.match(sidebarService, /applyVacationBulkFixPlanFromSidebar/);
assert.match(sidebarService, /getVacationMonthCalendarFromSidebar/);
assert.match(sidebarService, /getVacationCalendarDayDetailsFromSidebar/);
assert.match(
  stylesPersonnel,
  /\.vacations-mini-calendar__day--warning/,
  "mini calendar must style warning days",
);
assert.match(
  stylesPersonnel,
  /\.vacations-mini-calendar__day--max/,
  "mini calendar must style max-load days",
);
assert.match(
  stylesPersonnel,
  /\.vacations-mini-calendar__count/,
  "mini calendar must render count-only cells",
);
assert.doesNotMatch(
  jsVacations,
  /vacations-mini-calendar__person/,
  "mini calendar cells must not render person labels",
);
assert.match(
  stylesPersonnel,
  /\.vacations-mini-calendar__day--overload/,
  "mini calendar must style overloaded days",
);
assert.match(jsVacations, /openFindFromProblem\(index\)/);
assert.match(jsVacations, /Підібрати нову дату/);
assert.doesNotMatch(jsVacations, /label:\s*"Перевірка"/);
assert.match(
  stylesPersonnel,
  /\.vacation-card-header[\s\S]*?align-items:\s*flex-start/,
  "vacation card header must align badge to top",
);
assert.match(
  stylesPersonnel,
  /\.vacation-card-title[\s\S]*?min-width:\s*0/,
  "vacation card title must shrink before badge",
);
assert.match(
  stylesPersonnel,
  /\.vacation-card-badge[\s\S]*?flex:\s*0\s+0\s+auto[\s\S]*?white-space:\s*nowrap/,
  "vacation card badge must not shrink or wrap",
);
assert.match(jsVacations, /vacation-card-badge/);
assert.match(
  jsVacations,
  /vacation-card-badge">' \+\s*\n\s*VacationModule\.esc\(vacation\.type\)/,
  "vacation type badge must be a single span without split text",
);
assert.doesNotMatch(jsVacations, /vacation-card-badge">В\s/);
assert.doesNotMatch(
  sidebar,
  /\.badge[\s\S]*?flex:\s*0\s+0\s+auto/,
  "legacy VacationSidebar must not ship standalone badge UI",
);
assert.doesNotMatch(sidebarService, /\bclass\s+VacationSidebarService/);
assert.match(sidebarService, /const VacationSidebarService_ = \(function \(\)/);
assert.match(sidebarService, /PersonnelRepository_\.getActiveRows\(\)/);
assert.match(sidebarService, /applyVacationOptionFromSidebar/);
assert.match(sidebarService, /requestId:\s*String\(vacation\.requestId/);
assert.match(jsVacations, /requestId:\s*vacation\.requestId/);
assert.doesNotMatch(
  sidebar + sidebarService,
  /VACATION_OPTIONS|writeVacationOptions/,
);
assert.doesNotMatch(writerSource, /VACATION_OPTIONS|writeVacationOptions/);
assert.match(writerSource, /function _withVacationMigrationLock_\(callback\)/);
assert.match(
  writerSource,
  /_withVacationMigrationLock_\(function \(\)[\s\S]*?migrateLegacyToRequests/,
  "migration entrypoint must serialize with panel writes",
);
assert.match(
  engineSource,
  /item\.reminderEligible === false/,
  "reminder engine must ignore Proposed requests",
);
assert.match(
  engineSource,
  /findPhone_\(\{ callsign: callsign, fml: fml \}\)/,
  "reminder engine must resolve recipients Callsign-first with FML fallback",
);
assert.doesNotMatch(
  engineSource,
  /VacationPlannerService_|VacationOptionsWriter_|VacationSidebarService_/,
  "reminder engine must remain independent from planner, writer, and UI",
);
assert.doesNotMatch(
  [
    engineSource,
    sidebarService,
    writerSource,
    readRepo("VacationPlannerService.gs"),
  ].join("\n"),
  /Calculation_OS/,
  "vacation runtime must not depend on Calculation_OS",
);
assert.doesNotMatch(sidebar, /innerHTML/);
assert.match(
  writerSource,
  /const headers = \["Date", "Type", "FML", "Description", "Severity"\]/,
);
assert.match(writerSource, /function _formatScheduleCalendar_/);
assert.match(writerSource, /function _applyMonthSeparators_/);
assert.match(
  writerSource,
  /getRange\(dataStartRow, 3, dataRowCount, dateCount\)/,
);
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
assert.doesNotMatch(
  sidebar,
  /<script[\s>]/i,
  "legacy VacationSidebar must not ship client UI",
);
assert.equal(
  findFileByBasename(repoRoot, "VacationPlannerDialog.html", [".html"]) !== null,
  false,
);
assert.equal(
  findFileByBasename(repoRoot, "VacationValidateDialog.html", [".html"]) !== null,
  false,
);
assert.equal(
  findFileByBasename(repoRoot, "VacationPlannerApi.gs", [".gs"]) !== null,
  false,
);

const vacationSources = [...walkGasFiles(repoRoot), ...walkHtmlFiles(repoRoot)]
  .filter((rel) => /^Vacation.*\.(gs|html)$/.test(path.basename(rel)))
  .map((name) => fs.readFileSync(path.join(repoRoot, name), "utf8"))
  .join("\n");
assert.doesNotMatch(vacationSources, /VACATION_DATA/);

const maintenanceSource = fs.readFileSync(
  path.join(repoRoot, "UseCases.Maintenance.gs"),
  "utf8",
);
const reminderMailSource = fs.readFileSync(
  path.join(repoRoot, "LeaveBirthdayReminderMail.gs"),
  "utf8",
);
assert.match(
  maintenanceSource,
  /sendLeaveBirthdayReminderDigestEmail_\(/,
  "daily leave/birthday check must attempt owner email digest",
);
assert.match(
  reminderMailSource,
  /WASB_OWNER_EMAIL|getWasbOwnerEmail_/,
);
assert.match(reminderMailSource, /input\.trigger === true \|\| input\.isSystemTrigger === true/);

const bulkFixSource = readRepo("VacationBulkFix.gs");
const monthCalendarSource = readRepo("VacationMonthCalendar.gs");
assert.match(bulkFixSource, /function buildVacationBulkFixPlanFromSidebar/);
assert.match(bulkFixSource, /function applyVacationBulkFixPlanFromSidebar/);
assert.match(bulkFixSource, /function validateVacationBulkFixPlan_/);
assert.match(bulkFixSource, /vacation\.bulk_plan\.stale/);
assert.match(monthCalendarSource, /function getVacationCalendarDayDetailsFromSidebar/);
assert.match(monthCalendarSource, /loadLevel/);
assert.match(monthCalendarSource, /isoDate/);
assert.match(monthCalendarSource, /problemsCount/);
assert.match(monthCalendarSource, /peoplePreview/);
assert.match(monthCalendarSource, /problemsPreview/);
assert.match(monthCalendarSource, /readVacationSource_\(\)/);
assert.doesNotMatch(monthCalendarSource, /readRightPanelRows/);

const calendarContext = vm.createContext({
  console,
  Date,
  Session: { getScriptTimeZone: () => "Europe/Kyiv" },
  Utilities: {
    formatDate(value, _tz, pattern) {
      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, "0");
      const day = String(value.getDate()).padStart(2, "0");
      if (pattern === "yyyy-MM-dd") return `${year}-${month}-${day}`;
      return `${day}.${month}.${year}`;
    },
  },
  VACATION_PLANNER_CONFIG: plannerConfig,
  DateUtils_: {
    parseDateAny(value) {
      if (value instanceof Date) return value;
      const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!match) return null;
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
    },
  },
  PersonnelRepository_: {
    getByFml() {
      return null;
    },
  },
  readVacationSource_() {
    return [
      {
        row: 2,
        fml: "Alpha One",
        startDate: date("2026-11-28"),
        endDate: date("2026-12-05"),
        vacationNo: "перша відпустка",
        active: true,
        intervalCheck: "OK",
      },
      {
        row: 3,
        fml: "Beta Two",
        startDate: date("2026-12-10"),
        endDate: date("2027-01-05"),
        vacationNo: "перша відпустка",
        active: false,
        intervalCheck: "OK",
      },
      {
        row: 4,
        fml: "Gamma Three",
        startDate: date("2026-12-20"),
        endDate: date("2026-12-24"),
        vacationNo: "перша відпустка",
        active: true,
        intervalCheck: "OK",
      },
      {
        row: 5,
        fml: "Delta Four",
        startDate: date("2026-12-20"),
        endDate: date("2026-12-24"),
        vacationNo: "перша відпустка",
        active: true,
        intervalCheck: "OK",
      },
      {
        row: 6,
        fml: "Epsilon Five",
        startDate: date("2026-12-20"),
        endDate: date("2026-12-24"),
        vacationNo: "перша відпустка",
        active: true,
        intervalCheck: "OK",
      },
      {
        row: 7,
        fml: "Zeta Six",
        startDate: date("2026-12-21"),
        endDate: date("2026-12-23"),
        vacationNo: "перша відпустка",
        active: true,
        intervalCheck: "OK",
      },
    ];
  },
});
load(calendarContext, "VacationMonthCalendar.gs");
const monthCalendar = vm.runInContext("VacationMonthCalendar_", calendarContext);
const december = monthCalendar.getVacationMonthCalendar_({ year: 2026, month: 12 });
assert.equal(december.success, true);
const decemberDays = december.weeks.flat();
const dec1 = decemberDays.find((item) => item.dateIso === "2026-12-01");
const dec20 = decemberDays.find((item) => item.dateIso === "2026-12-20");
const dec24 = decemberDays.find((item) => item.dateIso === "2026-12-24");
assert.ok(dec1 && dec1.vacationsCount >= 1, "cross-month vacation must appear on Dec 1");
assert.ok(
  decemberDays.some((item) => item.dateIso === "2026-12-05" && item.vacationsCount >= 1),
  "cross-month vacation must appear through Dec 5",
);
assert.ok(
  decemberDays.some((item) => item.dateIso === "2027-01-01" && item.inMonth === false),
  "January spillover day stays outside selected month grid cell",
);
assert.equal(dec20.loadLevel, "warning");
assert.equal(dec20.overload, false);
assert.equal(dec20.vacationsCount, 4);
assert.equal(dec20.isoDate, "2026-12-20");
assert.ok(Array.isArray(dec20.peoplePreview));
assert.ok(Number.isFinite(Number(dec20.problemsCount)));
const overloadDay = decemberDays.find((item) => item.dateIso === "2026-12-21");
assert.ok(overloadDay, "Dec 21 must exist in calendar grid");
assert.equal(overloadDay.loadLevel, "error");
assert.equal(overloadDay.overload, true);
assert.equal(overloadDay.vacationsCount, 5);
const warningDay = decemberDays.find((item) => item.dateIso === "2026-12-24");
assert.ok(warningDay, "Dec 24 must exist in calendar grid");
assert.equal(warningDay.loadLevel, "warning");
assert.equal(warningDay.overload, false);
assert.equal(warningDay.vacationsCount, 4);
assert.ok(
  december.summary.problemDays >= 1,
  "December must report at least one problem day",
);

console.log("verify-vacation-planner: OK");

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
assert.equal(startGapCheck.isValid, true);
assert.ok(startGapCheck.warnings.some((item) => item.rule === "START_GAP"));
assert.equal(startGapCheck.blockingViolations.length, 0);

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
assert.equal(personGapCheck.isValid, true);
assert.ok(personGapCheck.warnings.some((item) => item.rule === "PERSON_GAP"));
assert.equal(personGapCheck.blockingViolations.length, 0);

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
    endDate: date("2026-05-20"),
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
    endDate: date("2026-05-20"),
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
assert.ok(
  busyValidation.warnings.some((item) => item.rule === "HIGH_LOAD_PERIOD"),
);
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
const compromiseOptions = service.suggestVacationOptions(
  {
    fml: "Нова Людина",
    vacationNumber: 1,
    desiredStart: "2026-07-15",
    durationDays: 15,
    searchWindow: 0,
  },
  unitLoad,
);
assert.equal(compromiseOptions[0].status, "COMPROMISE");
assert.match(compromiseOptions[0].explanation, /Попередження:/);

const monthBalanceCheck = service.validateVacationOption(
  {
    fml: "Третій Старт",
    vacationNumber: 1,
    startDate: date("2026-06-20"),
    endDate: date("2026-06-30"),
  },
  [
    vacation("Перший Старт", "2026-06-01", "2026-06-05"),
    vacation("Другий Старт", "2026-06-10", "2026-06-14"),
  ],
);
assert.equal(monthBalanceCheck.isValid, true);
assert.ok(
  monthBalanceCheck.warnings.some((item) => item.rule === "MONTH_BALANCE"),
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
assert.ok(
  audit.checks.some(
    (item) =>
      item.rule === "HIGH_LOAD_PERIOD" && item.severity === "WARNING",
  ),
  "four concurrent people must produce a non-blocking load warning",
);
const overloadedAudit = service.buildScheduleAudit([
  ...concurrent,
  vacation("E", "2026-07-01", "2026-07-31"),
]);
assert.ok(
  overloadedAudit.checks.some((item) => item.rule === "MAX_CONCURRENT"),
  "rebuild audit must report more than four concurrent people",
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
assert.deepEqual(
  Array.from(consistencyAudit, (item) => item.rule).sort(),
  [
    "MONTHLY_VACATION_WITHOUT_PLAN",
    "PERSONNEL_VACATION_WITHOUT_PLAN",
    "PLAN_WITHOUT_MONTHLY_VACATION",
  ],
);
assert.equal(
  consistencyAudit.find(
    (item) => item.rule === "MONTHLY_VACATION_WITHOUT_PLAN",
  ).date,
  "2026-06-10 / 2026-06-11",
);
assert.equal(
  consistencyAudit.find(
    (item) => item.rule === "PLAN_WITHOUT_MONTHLY_VACATION",
  ).date,
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
assert.equal(merged.length, 2, "repository must merge A:I and K:S");
assert.equal(
  Array.from(merged, (item) => item._meta.startColumn).join(","),
  "1,11",
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

load(ioContext, "VacationOptionsWriter.gs");
const writer = vm.runInContext("VacationOptionsWriter_", ioContext);
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
    return value === "Нове ПІБ"
      ? { callsign: "ALPHA", fml: "Нове ПІБ" }
      : null;
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
generatedSheets = {};
const sourceBeforeRebuild = sourceSheet.rows.map((row) => row.slice());
const multiMonthRebuild = writer.rebuildVacationSystem();
const scheduleSheet = generatedSheets.VACATION_SCHEDULE;
assert.ok(scheduleSheet, "rebuild must create VACATION_SCHEDULE");
assert.deepEqual(Array.from(multiMonthRebuild.affectedSheets), [
  "VACATION_SCHEDULE",
  "VACATION_CHECK",
]);
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

sourceSheet = new FakeSheet("VACATIONS", [
  Array(19).fill(""),
  sourceVacationRow([
    {
      startColumn: 1,
      fml: "Гап Людина",
      start: "2026-01-01",
      end: "2026-01-15",
      type: "перша відпустка",
      days: 15,
    },
    {
      startColumn: 11,
      fml: "Гап Людина",
      start: "2026-02-01",
      end: "2026-02-15",
      type: "друга відпустка",
      days: 15,
    },
  ]),
]);
generatedSheets = {};
const gapReport = writer.generateVacationReport();
assert.equal(gapReport.errorCount, 0, "short gaps must not be blocking");
assert.ok(gapReport.warningCount > 0, "gap report must include warnings");
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

const code = fs.readFileSync(path.join(repoRoot, "Code.gs"), "utf8");
const sidebarHtml = fs.readFileSync(
  path.join(repoRoot, "Sidebar.html"),
  "utf8",
);
const jsVacations = fs.readFileSync(
  path.join(repoRoot, "Js.Vacations.html"),
  "utf8",
);
const stylesPersonnel = fs.readFileSync(
  path.join(repoRoot, "Styles_30_Personnel.html"),
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
const vacationClientServerCalls = [];
const vacationClientInputs = {
  vacMoveVacation: "0",
  vacMoveStart: "2026-08-01",
  vacMoveDays: "15",
};
Object.assign(vacationClientContext, {
  document: {
    getElementById(id) {
      return Object.prototype.hasOwnProperty.call(vacationClientInputs, id)
        ? { value: vacationClientInputs[id] }
        : null;
    },
  },
  runServerMethod_(method, args, source) {
    vacationClientServerCalls.push({ method, args, source });
    if (method === "getVacationSidebarState") {
      return Promise.resolve({
        personnel: [],
        vacations: [],
        stats: { total: 0, activePeople: 0 },
      });
    }
    return Promise.resolve({ warnings: [] });
  },
  showLoading() {},
  hideLoading() {},
  showToast() {},
  logToConsole() {},
  normalizeError(error) {
    return error && error.message ? error.message : String(error);
  },
});
vacationClientContext.window.confirm = () => true;
vacationClientModule.state.vacations = [
  {
    requestId: "request-move-1",
    personKey: "ALPHA",
    fml: "Пелих Артем Андрійович",
    vacationNumber: 2,
    type: "В2",
    sourceRow: 14,
    sourceStartColumn: 8,
    startDate: "2026-07-01",
    endDate: "2026-07-15",
    days: 15,
    manageable: true,
  },
];
await vacationClientModule.submitMove();
const moveCall = vacationClientServerCalls.find(
  (call) => call.method === "moveVacationFromSidebar",
);
assert.ok(moveCall, "submitMove must call moveVacationFromSidebar");
assert.deepEqual(
  JSON.parse(JSON.stringify(moveCall.args[0])),
  {
    requestId: "request-move-1",
    personKey: "ALPHA",
    fml: "Пелих Артем Андрійович",
    vacationNumber: 2,
    type: "В2",
    sourceRow: 14,
    sourceStartColumn: 8,
    startDate: "2026-08-01",
    days: 15,
  },
  "move payload must preserve request identity and source coordinates",
);
vacationClientModule.state.vacations = [
  {
    requestId: "request-cancel-1",
    personKey: "BRAVO",
    fml: "Скасувати Людина",
    vacationNumber: 1,
    type: "В1",
    sourceRow: 21,
    sourceStartColumn: 4,
    startDate: "2026-09-01",
    endDate: "2026-09-15",
    days: 15,
  },
];
vacationClientModule.cancelVacation(0);
await new Promise((resolve) => setImmediate(resolve));
const cancelCall = vacationClientServerCalls.find(
  (call) => call.method === "cancelVacationFromSidebar",
);
assert.ok(cancelCall, "cancelVacation must call cancelVacationFromSidebar");
assert.deepEqual(
  {
    requestId: cancelCall.args[0].requestId,
    personKey: cancelCall.args[0].personKey,
    sourceRow: cancelCall.args[0].sourceRow,
    sourceStartColumn: cancelCall.args[0].sourceStartColumn,
    vacationNumber: cancelCall.args[0].vacationNumber,
    type: cancelCall.args[0].type,
  },
  {
    requestId: "request-cancel-1",
    personKey: "BRAVO",
    sourceRow: 21,
    sourceStartColumn: 4,
    vacationNumber: 1,
    type: "В1",
  },
  "cancel payload must preserve request identity and source coordinates",
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
const engineSource = fs.readFileSync(
  path.join(repoRoot, "VacationEngine.gs"),
  "utf8",
);
const enginePhoneLookups = [];
const engineContext = vm.createContext({
  console,
  Date,
  Utilities: {
    formatDate(value, _timeZone, pattern) {
      assert.equal(pattern, "dd.MM.yyyy");
      const d = new Date(value);
      const dayPart = String(d.getDate()).padStart(2, "0");
      const monthPart = String(d.getMonth() + 1).padStart(2, "0");
      return `${dayPart}.${monthPart}.${d.getFullYear()}`;
    },
  },
  DateUtils_: {
    getTimeZone() {
      return "Europe/Kyiv";
    },
  },
  VacationsRepository_: {
    listAll() {
      return [
        {
          fml: "Approved Person",
          personKey: "ALPHA",
          startDate: date("2026-07-04"),
          endDate: date("2026-07-18"),
          vacationNo: 1,
          active: true,
          notify: true,
        },
        {
          fml: "Fallback Person",
          startDate: date("2026-07-02"),
          endDate: date("2026-07-16"),
          vacationNo: 2,
          active: "TRUE",
          notify: true,
        },
        {
          fml: "Proposed Person",
          personKey: "PROPOSED",
          startDate: date("2026-07-04"),
          endDate: date("2026-07-18"),
          vacationNo: 1,
          active: true,
          notify: true,
          reminderEligible: false,
        },
        {
          fml: "Cancelled Person",
          personKey: "CANCELLED",
          startDate: date("2026-07-04"),
          endDate: date("2026-07-18"),
          vacationNo: 1,
          active: false,
          notify: true,
        },
      ];
    },
    getSourceMode() {
      return "requests";
    },
    getSourceSheetName() {
      return "VACATION_REQUESTS";
    },
  },
  resolveMessageRecipient_() {
    return {
      phone: "380000000000",
      role: "ГРАФ",
      callsign: "ГРАФ",
      source: "test",
    };
  },
  findPhone_(query) {
    enginePhoneLookups.push(query);
    if (query.callsign === "ALPHA") return "380111111111";
    if (query.fml === "Fallback Person") return "380222222222";
    return "";
  },
  buildWhatsAppWebLink_(phone, message) {
    return `https://wa.test/${phone}?text=${encodeURIComponent(message)}`;
  },
});
vm.runInContext(engineSource, engineContext, { filename: "VacationEngine.gs" });
const vacationEngineResult = vm.runInContext(
  'runVacationEngine_(new Date(2026, 6, 1, 12, 0, 0), { commanderRole: "ГРАФ" })',
  engineContext,
);
assert.equal(vacationEngineResult.debug.totalRows, 4);
assert.equal(vacationEngineResult.debug.activeRows, 2);
assert.equal(vacationEngineResult.debug.sourceMode, "requests");
assert.deepEqual(
  vacationEngineResult.soldierMessages.map((item) => item.fml),
  ["Fallback Person", "Approved Person"],
  "engine must emit only eligible active vacation reminders sorted by daysUntil",
);
assert.deepEqual(
  vacationEngineResult.commanderMessages.map((item) => item.fml),
  ["Fallback Person", "Approved Person"],
);
assert.deepEqual(
  vacationEngineResult.soldierMessages.map((item) => item.phone),
  ["380222222222", "380111111111"],
  "engine must allow Callsign-first lookup with FML fallback",
);
assert.ok(
  enginePhoneLookups.some(
    (query) => query.callsign === "ALPHA" && query.fml === "Approved Person",
  ),
);
assert.ok(
  enginePhoneLookups.some(
    (query) => query.callsign === "Fallback" && query.fml === "Fallback Person",
  ),
);
assert.ok(
  enginePhoneLookups.every(
    (query) =>
      query.fml !== "Proposed Person" && query.fml !== "Cancelled Person",
  ),
  "engine must not resolve phones for proposed or inactive vacations",
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
assert.match(
  sidebar,
  /\.badge[\s\S]*?flex:\s*0\s+0\s+auto[\s\S]*?white-space:\s*nowrap/,
  "legacy VacationSidebar badge must not wrap",
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
    fs.readFileSync(path.join(repoRoot, "VacationPlannerService.gs"), "utf8"),
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

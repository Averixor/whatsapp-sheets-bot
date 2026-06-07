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
}

class FakeSheet {
  constructor(name, rows, formulas = []) {
    this.name = name;
    this.rows = rows;
    this.formulas = formulas;
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

  formulaAt(row, col) {
    return (this.formulas[row - 1] || [])[col - 1] ?? "";
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
let sourceSheet = new FakeSheet("VACATIONS", sourceRows);
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

const code = fs.readFileSync(path.join(repoRoot, "Code.gs"), "utf8");
const sidebarHtml = fs.readFileSync(
  path.join(repoRoot, "Sidebar.html"),
  "utf8",
);
const jsVacations = fs.readFileSync(
  path.join(repoRoot, "Js.Vacations.html"),
  "utf8",
);
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

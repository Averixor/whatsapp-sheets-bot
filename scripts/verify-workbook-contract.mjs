#!/usr/bin/env node
/**
 * Workbook regression checks that can run without Google Apps Script.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { readRepoFileByBasename } from "./lib/gas-files.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

function readGasByBasename(fileName) {
  return readRepoFileByBasename(repoRoot, fileName, {
    errorPrefix: "verify-workbook-contract",
  });
}

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

  getValues() {
    return this.getDisplayValues();
  }

  setValues(values) {
    values.forEach((sourceRow, rowOffset) => {
      sourceRow.forEach((value, colOffset) => {
        this.sheet.setValue(this.row + rowOffset, this.col + colOffset, value);
      });
    });
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

  getFormula() {
    return this.sheet.formulaAt(this.row, this.col);
  }
}

class FakeSheet {
  constructor(name, rows) {
    this.name = name;
    this.rows = rows;
    this.formulas = {};
  }

  getName() {
    return this.name;
  }

  getLastRow() {
    return this.rows.length - 1;
  }

  getLastColumn() {
    return Math.max(0, ...this.rows.map((row) => row.length - 1));
  }

  valueAt(row, col) {
    return (this.rows[row] || [])[col];
  }

  formulaAt(row, col) {
    return this.formulas[`${row}:${col}`] || "";
  }

  setFormula(row, col, formula) {
    this.formulas[`${row}:${col}`] = formula;
  }

  setValue(row, col, value) {
    while (this.rows.length <= row) {
      this.rows.push([]);
    }
    const rowRef = this.rows[row];
    while (rowRef.length <= col) {
      rowRef.push("");
    }
    rowRef[col] = value;
    delete this.formulas[`${row}:${col}`];
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

function buildCompactJuneSheet(options = {}) {
  const rows = Array.from({ length: 46 }, () => Array(34).fill(""));
  rows[1][2] = "Позивний";
  for (let col = 3; col <= 32; col++) {
    rows[1][col] = `${String(col - 2).padStart(2, "0")}.06.2026`;
  }

  for (let row = 2; row <= 30; row++) {
    rows[row][1] = row % 3 === 0 ? 0 : 10;
    rows[row][2] = `CALLSIGN_${String(row - 1).padStart(2, "0")}`;
    rows[row][3] = "Резерв";
    rows[row][16] = "Резерв";
  }

  if (options.includeSummaryBlock === false) {
    return new FakeSheet("06", rows);
  }

  const summaryRows = [
    options.omitStaff ? null : { label: "За_штатом", value: 30 },
    { label: "За_списком", value: 29 },
    { label: "В_наявності", value: 23 },
    { label: "У_відрядженні", value: 2 },
    { label: "У_відпустці", value: 1 },
    { label: "Гусачівка", value: 3 },
    options.omitDroneCamp ? null : { label: "Drone Camp", value: 0 },
    { label: "ППД", value: 9 },
    { label: "КП", value: 2 },
    { label: "БР", value: 5 },
  ].filter(Boolean);
  summaryRows.forEach((item, index) => {
    const row = 34 + index;
    rows[row][2] = item.label;
    rows[row][16] = item.value;
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
    getTemplateText_: () => "",
    getWasbSpreadsheet_: () => null,
    FULL_NAMES: {
      ОС: "Особовий склад",
      Black: "Екіпаж Чорний",
      Roland: "Екіпаж Роланд",
      БР: "Бойове розпорядження",
      КП: "Командний пункт",
      Відряд: "У відрядженні",
      Відпус: "У відпустці",
      Резерв: "Резерв",
      DC: "Drone Camp",
      Київ: "ППД Київ",
      Вибув: "Вибув",
      "2УРБпАК": "Охорона позиції 2 роти УБпАК",
    },
    SUMMARY_GROUPS: {
      Резерв: ["Резерв"],
      Black: ["Black"],
      Roland: ["Roland"],
      БР: ["БР"],
      КП: ["КП"],
      Відряд: ["Відряд"],
      Відпус: ["Відпус"],
      DC: ["DC"],
      Київ: ["Київ"],
      Вибув: ["Вибув"],
    },
  });

  for (const file of [
    "SummaryDictSumShim.gs",
    "SheetSchemas.gs",
    "Report_SummaryData.gs",
    "Report_DailySimple.gs",
    "Report_DailyDetailed.gs",
    "Summaries.gs",
  ]) {
    vm.runInContext(readGasByBasename(file), context, {
      filename: file,
    });
  }

  return context;
}

const context = loadWorkbookFunctions();
const sheet = buildCompactJuneSheet();
const layout = context.detectMonthlyLayoutFromSheet_(sheet);

assert.equal(layout.layout, "compact");
assert.equal(layout.codeRangeA1, "C2:AF30");
assert.equal(
  context.countMonthlyScheduleRowsForColumn_(sheet, 16),
  29,
  "compact monthly footer rows must not be counted as personnel",
);

assert.equal(context.findDateColumnInMonthSheet_(sheet, "14.06.2026"), 16);

const summary = context.buildDaySummaryForColumn_(sheet, 16);
assert.match(summary, /^14\.06\n\nЗа штатом: 30/);
assert.match(summary, /За списком: 29/);
assert.match(summary, /В наявності: 23/);
assert.match(summary, /У відрядженні: 2/);
assert.match(summary, /У відпустці: 1/);
assert.match(summary, /Гусачівка: 3/);
assert.match(summary, /Drone Camp: 0/);
assert.match(summary, /ППД: 9/);
assert.match(summary, /КП: 2/);
assert.match(summary, /БР: 5/);
assert.doesNotMatch(summary, /За_списком/);
assert.doesNotMatch(summary, /В_наявності/);
assert.doesNotMatch(summary, /У_відрядженні/);
assert.doesNotMatch(summary, /У_відпустці/);
assert.doesNotMatch(summary, /Drone_Camp/);
assert.doesNotMatch(summary, /За_штатом/);
assert.doesNotMatch(summary, /Особовий склад —/);

assert.equal(context.parseSummaryNumber_("29"), 29);
assert.equal(context.parseSummaryNumber_("29 осіб"), 29);
assert.equal(context.parseSummaryNumber_("  29  "), 29);
assert.equal(context.parseSummaryNumber_("—"), 0);

const location = context.findSummaryBlockLocation_(sheet);
assert.equal(location.labelCol, 2);
assert.equal(location.startRow, 34);

const block = context.readDailySummaryFromFormulaBlockForSheet_(
  sheet,
  "14.06.2026",
  0,
);
assert.equal(block.monthSheetName, "06");
assert.equal(block.dateColumn, 16);
assert.equal(block.values.За_штатом, 30);
assert.equal(block.values.За_списком, 29);
assert.equal(block.values.Drone_Camp, 0);

const missingValueSummary = context.buildDaySummaryForColumn_(
  buildCompactJuneSheet({ omitDroneCamp: true }),
  16,
);
assert.match(missingValueSummary, /Drone Camp: 0/);

const missingStaffSummary = context.buildDaySummaryForColumn_(
  buildCompactJuneSheet({ omitStaff: true }),
  16,
);
assert.match(missingStaffSummary, /^14\.06\n\nЗа штатом: 0/);

assert.throws(
  () =>
    context.readDailySummaryFromFormulaBlockForSheet_(sheet, "15.07.2026", 0),
  /Не знайдено колонку дати/,
);
assert.throws(
  () =>
    context.readDailySummaryFromFormulaBlockForSheet_(
      buildCompactJuneSheet({ includeSummaryBlock: false }),
      "14.06.2026",
      0,
    ),
  /Не знайдено формульний блок зведення/,
);

const originalGetEntries = context.getMonthlyScheduleEntriesForColumn_;
const originalPersonnelMap = context.getPersonnelMapByCallsignAll_;
const originalResolveFml = context.resolveSummaryPersonFml_;

context.getMonthlyScheduleEntriesForColumn_ = function (_sheet, _col) {
  return [
    { rowIndex: 2, callsign: "CALLSIGN_01", code: "БР" },
    { rowIndex: 3, callsign: "CALLSIGN_02", code: "КП" },
    { rowIndex: 4, callsign: "CALLSIGN_03", code: "Відпус" },
    { rowIndex: 5, callsign: "CALLSIGN_04", code: "Відряд" },
    { rowIndex: 6, callsign: "CALLSIGN_05", code: "БР" },
  ];
};
context.getPersonnelMapByCallsignAll_ = function () {
  return {
    CALLSIGN_01: { fml: "Іваненко Іван Іванович" },
    CALLSIGN_02: { fml: "Петренко Петро Петрович" },
    CALLSIGN_03: { fml: "Сидоренко Сидір Сидорович" },
    CALLSIGN_04: { fml: "Коваль Костянтин Костянтинович" },
    CALLSIGN_05: { fml: "Шевченко Тарас Григорович" },
  };
};
context.resolveSummaryPersonFml_ = function (
  _sheet,
  _rowIndex,
  callsign,
  personnelByCallsign,
) {
  const key = String(callsign || "").trim();
  const rec = personnelByCallsign && personnelByCallsign[key];
  return String((rec && rec.fml) || "").trim();
};

const people = context.collectPeopleDetailed_(sheet, 16);
assert.equal(people.length, 5);
assert.ok(people.some((p) => p.code === "БР"));
assert.ok(people.some((p) => p.code === "КП"));
assert.ok(people.some((p) => p.code === "Відпус"));
assert.ok(people.some((p) => p.code === "Відряд"));

const detailed = context.formatDetailedSummary_("14.06.2026", people);
assert.match(detailed, /\*Бойове розпорядження\* — 2/);
assert.match(detailed, /\*Командний пункт\* — 1/);
assert.match(detailed, /\*У відпустці\* — 1/);
assert.match(detailed, /\*У відрядженні\* — 1/);
assert.ok(
  detailed.indexOf("Бойове розпорядження") < detailed.indexOf("Командний пункт"),
  "DICT_SUM order must keep БР before КП",
);

context.getMonthlyScheduleEntriesForColumn_ = originalGetEntries;
context.getPersonnelMapByCallsignAll_ = originalPersonnelMap;
context.resolveSummaryPersonFml_ = originalResolveFml;

const dictSumRules = context.getDefaultDictSumRules_();
const dictSumCodes = dictSumRules.map((rule) => rule.code);
assert.ok(dictSumCodes.includes("DC"), "DICT_SUM defaults must include DC");
assert.ok(dictSumCodes.includes("Київ"), "DICT_SUM defaults must include Київ");
assert.ok(
  dictSumCodes.includes("Вибув"),
  "DICT_SUM defaults must include Вибув",
);
assert.ok(
  dictSumCodes.indexOf("Black") < dictSumCodes.indexOf("Roland"),
  "Black must sort before Roland",
);
assert.equal(dictSumRules.find((rule) => rule.code === "Black").order, 10);
assert.equal(dictSumRules.find((rule) => rule.code === "2УРБпАК").order, 100);
assert.equal(dictSumRules.find((rule) => rule.code === "Вибув").order, 333);

const dictMaterializeHolder = { dictSheet: null, dictSumSheet: null };
const dictMaterializeContext = vm.createContext({
  console,
  CONFIG: {
    DICT_SHEET: "DICT",
    DICT_SUM_SHEET: "DICT_SUM",
  },
  CacheService: {
    getScriptCache() {
      return { remove() {} };
    },
  },
  cacheKeyDict_: () => "DICT_TEST",
  DataAccess_: {
    getSheet(schemaKey) {
      if (schemaKey === "dict") return dictMaterializeHolder.dictSheet;
      if (schemaKey === "dictSum") return dictMaterializeHolder.dictSumSheet;
      return null;
    },
  },
});
vm.runInContext(readGasByBasename("DictMaterialize.gs"), dictMaterializeContext, {
  filename: "DictMaterialize.gs",
});

const dictSumSheet = new FakeSheet("DICT_SUM", [
  [],
  ["", "Код", "Назва", "Порядок"],
  ["", "БР", "Бойове розпорядження", "20"],
  ["", "КП", "Командний пункт", "105"],
]);
const dictSheet = new FakeSheet("DICT", [
  [],
  ["", "Код", "Вид служби", "Місце", "Завдання"],
  ["", "STALE_A", "STALE_B", "Kyiv", "Task 1"],
  ["", "TAIL_A", "TAIL_B", "Lviv", "Task 2"],
  ["", "TAIL2_A", "TAIL2_B", "", ""],
]);
dictSheet.setFormula(1, 1, "=ARRAYFORMULA(DICT_SUM!A1:A)");
dictSheet.setFormula(1, 2, "=ARRAYFORMULA(DICT_SUM!B1:B)");

dictMaterializeHolder.dictSheet = dictSheet;
dictMaterializeHolder.dictSumSheet = dictSumSheet;

const dictMaterializeResult =
  dictMaterializeContext.materializeDictFromDictSum_();
assert.equal(dictMaterializeResult.ok, true);
assert.equal(dictMaterializeResult.rowsWritten, 3);

assert.equal(dictSheet.valueAt(1, 1), "Код");
assert.equal(dictSheet.valueAt(1, 2), "Назва");
assert.equal(dictSheet.valueAt(2, 1), "БР");
assert.equal(dictSheet.valueAt(2, 2), "Бойове розпорядження");
assert.equal(dictSheet.valueAt(3, 1), "КП");
assert.equal(dictSheet.valueAt(3, 2), "Командний пункт");
assert.equal(dictSheet.valueAt(4, 1), "");
assert.equal(dictSheet.valueAt(4, 2), "");
assert.equal(dictSheet.formulaAt(1, 1), "");
assert.equal(dictSheet.formulaAt(1, 2), "");
assert.equal(dictSheet.valueAt(2, 3), "Kyiv", "DICT place column must stay intact");
assert.equal(dictSheet.valueAt(2, 4), "Task 1", "DICT tasks column must stay intact");

const mirrored = dictMaterializeContext.readDictSumMirrorValues_(dictSumSheet);
assert.deepEqual(mirrored, [
  ["Код", "Назва"],
  ["БР", "Бойове розпорядження"],
  ["КП", "Командний пункт"],
]);

console.log(
  `verify-workbook-contract: OK (${sheet.getName()} ${layout.codeRangeA1}, personnel=29)`,
);

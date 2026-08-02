#!/usr/bin/env node
/**
 * Monthly callsign sync — PERSONNEL callsign/last name → monthly «Позивні» column.
 */
import assert from "node:assert/strict";
import vm from "node:vm";
import { repoRoot } from "./lib/load-contract.mjs";
import { readRepoFileByBasename } from "./lib/gas-files.mjs";

function monthlyCallsignValueFromPersonnelRow(callsignRaw, lastNameRaw) {
  const callsign = String(callsignRaw ?? "").trim();
  if (callsign) return callsign;
  return String(lastNameRaw ?? "").trim();
}

assert.equal(monthlyCallsignValueFromPersonnelRow("Беркут", "Иванов"), "Беркут");
assert.equal(monthlyCallsignValueFromPersonnelRow("", "Петренко"), "Петренко");
assert.equal(monthlyCallsignValueFromPersonnelRow("Сидор", "Сидоренко"), "Сидор");
assert.equal(monthlyCallsignValueFromPersonnelRow("   ", "Петренко"), "Петренко");
assert.equal(monthlyCallsignValueFromPersonnelRow("", ""), "");
assert.equal(monthlyCallsignValueFromPersonnelRow(null, null), "");

const orderInput = [
  ["A1", "Ln1"],
  ["", "Ln2"],
  ["C3", ""],
];
const orderOutput = orderInput.map(([c, l]) =>
  monthlyCallsignValueFromPersonnelRow(c, l),
);
assert.deepEqual(orderOutput, ["A1", "Ln2", "C3"]);

const syncModule = readRepoFileByBasename(
  repoRoot,
  "MonthlyCallsignSync.gs",
  { errorPrefix: "verify-monthly-callsign-sync" },
);
const personnelMaterialize = readRepoFileByBasename(
  repoRoot,
  "PersonnelMaterialize.gs",
  { errorPrefix: "verify-monthly-callsign-sync" },
);
const monthOps = readRepoFileByBasename(repoRoot, "UseCases.MonthOps.gs", {
  errorPrefix: "verify-monthly-callsign-sync",
});
const sheetSchemas = readRepoFileByBasename(repoRoot, "SheetSchemas.gs", {
  errorPrefix: "verify-monthly-callsign-sync",
});
const summaryData = readRepoFileByBasename(repoRoot, "Report_SummaryData.gs", {
  errorPrefix: "verify-monthly-callsign-sync",
});

assert.match(syncModule, /function syncMonthlyCallsignsFromPersonnel_/);
assert.match(syncModule, /function findMonthlyCallsignColumn_/);
assert.match(syncModule, /monthlyCallsignValueFromPersonnelRow_/);
assert.match(syncModule, /targetRange\.setValues\(output\)/);
assert.match(syncModule, /skippedWrite/);
assert.match(syncModule, /insertRowsBefore\(summaryBlock\.startRow, rowsInserted\)/);
assert.match(syncModule, /SpreadsheetApp\.CopyPasteType\.PASTE_FORMAT/);
assert.match(syncModule, /SpreadsheetApp\.CopyPasteType\.PASTE_DATA_VALIDATION/);
assert.match(syncModule, /extendConditionalFormatRulesThroughRow_/);
assert.doesNotMatch(
  syncModule,
  /CopyPasteType\.PASTE_CONDITIONAL_FORMATTING/,
  "PASTE_CONDITIONAL_FORMATTING corrupts sheet-level CF rules on real workbooks",
);
assert.match(syncModule, /SpreadsheetApp\.CopyPasteType\.PASTE_FORMULA/);
assert.doesNotMatch(
  syncModule,
  /values\.slice\(0\s*,/,
  "monthly callsigns must never be truncated to the old fixed capacity",
);
assert.match(sheetSchemas, /function findMonthlySummaryBlockLocation_/);
assert.match(
  summaryData,
  /findMonthlySummaryBlockLocation_\(sheet\)/,
  "reports must delegate to the shared monthly summary-block locator",
);
assert.match(syncModule, /Не знайдено аркуш PERSONNEL \/ Персонал/);
assert.match(
  syncModule,
  /Не знайдено колонку позивного \(callsign\) на аркуші особового складу/,
);
assert.match(
  syncModule,
  /Не знайдено колонку "Last name" \/ "Прізвище" на аркуші особового складу/,
);

assert.match(syncModule, /function syncAllMonthlyCallsignsFromPersonnel_/);
assert.match(syncModule, /function syncMonthlyCallsignsForPersonnelUpdate_/);
assert.match(syncModule, /monthlySyncMode === "all"/);
assert.match(syncModule, /return syncActiveMonthlyCallsignsFromPersonnel_/);
assert.match(syncModule, /resolvePersonnelDisplayCallsign_/);
assert.doesNotMatch(
  syncModule,
  /TEMPLATE/,
  "monthly callsign display must never read TEMPLATE",
);
assert.match(personnelMaterialize, /syncMonthlyCallsignsForPersonnelUpdate_/);
assert.doesNotMatch(
  personnelMaterialize,
  /syncAllMonthlyCallsignsFromPersonnel_\(\)/,
  "default personnel materialize must not sync all months",
);
assert.match(monthOps, /syncMonthlyCallsignsFromPersonnel_\(newSheet\)/);
assert.match(monthOps, /_ensureNewMonthSheetKeepsSourceRules_\(src, newSheet\)/);

const monthSheets = readRepoFileByBasename(repoRoot, "MonthSheets.gs", {
  errorPrefix: "verify-monthly-callsign-sync",
});
assert.match(monthSheets, /function _ensureNewMonthSheetKeepsSourceRules_/);
assert.match(monthSheets, /getConditionalFormatRules\(\)/);
assert.match(monthSheets, /getDataValidations\(\)/);
assert.match(monthSheets, /setDataValidations\(/);
assert.match(monthSheets, /copyConditionalFormatRulesFromSheet_/);

const formatGovernance = readRepoFileByBasename(
  repoRoot,
  "ConditionalFormatGovernance.gs",
  { errorPrefix: "verify-monthly-callsign-sync" },
);
assert.match(
  formatGovernance,
  /function copyConditionalFormatRulesFromSheet_/,
);
assert.match(
  formatGovernance,
  /function extendConditionalFormatRulesThroughRow_/,
);
assert.doesNotMatch(
  formatGovernance,
  /CopyPasteType\.PASTE_CONDITIONAL_FORMATTING/,
  "governance helpers must not rely on PASTE_CONDITIONAL_FORMATTING",
);

const personnelRepo = readRepoFileByBasename(
  repoRoot,
  "PersonnelRepository.gs",
  { errorPrefix: "verify-monthly-callsign-sync" },
);
assert.match(personnelRepo, /function resolvePersonnelDisplayCallsign_/);
assert.match(
  personnelRepo,
  /"\\u043f\\u043e\\u0437\\u044b\\u0432\\u043d\\u043e\\u0439": "Callsign"/,
);
assert.match(personnelRepo, /фамилия: "LastName"/);

function parseA1(value) {
  const match = String(value).match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
  if (!match) throw new Error(`Unsupported test A1 range: ${value}`);
  const col = (letters) =>
    String(letters)
      .toUpperCase()
      .split("")
      .reduce((total, char) => total * 26 + char.charCodeAt(0) - 64, 0);
  return {
    row: Number(match[2]),
    col: col(match[1]),
    numRows: Number(match[4]) - Number(match[2]) + 1,
    numCols: col(match[3]) - col(match[1]) + 1,
  };
}

function blankCell() {
  return {
    value: "",
    formulaR1C1: "",
    format: "",
    validation: "",
    conditionalFormat: "",
  };
}

class FakeRange {
  constructor(sheet, row, col, numRows = 1, numCols = 1) {
    this.sheet = sheet;
    this.row = Number(row);
    this.col = Number(col);
    this.numRows = Number(numRows ?? 1);
    this.numCols = Number(numCols ?? 1);
  }

  getRow() {
    return this.row;
  }

  getLastRow() {
    return this.row + this.numRows - 1;
  }

  getColumn() {
    return this.col;
  }

  getLastColumn() {
    return this.col + this.numCols - 1;
  }

  getA1Notation() {
    return `R${this.row}C${this.col}:R${this.getLastRow()}C${this.getLastColumn()}`;
  }

  getNumRows() {
    return this.numRows;
  }

  getNumColumns() {
    return this.numCols;
  }

  getDisplayValues() {
    const out = [];
    for (let rowOffset = 0; rowOffset < this.numRows; rowOffset++) {
      const row = [];
      for (let colOffset = 0; colOffset < this.numCols; colOffset++) {
        row.push(this.sheet.displayAt(this.row + rowOffset, this.col + colOffset));
      }
      out.push(row);
    }
    return out;
  }

  getValues() {
    const out = [];
    for (let rowOffset = 0; rowOffset < this.numRows; rowOffset++) {
      const row = [];
      for (let colOffset = 0; colOffset < this.numCols; colOffset++) {
        row.push(this.sheet.valueAt(this.row + rowOffset, this.col + colOffset));
      }
      out.push(row);
    }
    return out;
  }

  getFormulaR1C1() {
    return this.sheet.cell(this.row, this.col).formulaR1C1;
  }

  getDisplayValue() {
    return this.sheet.displayAt(this.row, this.col);
  }

  setValues(values) {
    assert.equal(values.length, this.numRows, "setValues row count");
    values.forEach((sourceRow, rowOffset) => {
      assert.equal(sourceRow.length, this.numCols, "setValues column count");
      sourceRow.forEach((value, colOffset) => {
        const target = this.sheet.cell(
          this.row + rowOffset,
          this.col + colOffset,
        );
        target.value = value;
        target.formulaR1C1 = "";
      });
    });
    this.sheet.setValuesCalls++;
    return this;
  }

  copyTo(targetRange, pasteType) {
    for (let rowOffset = 0; rowOffset < targetRange.numRows; rowOffset++) {
      for (let colOffset = 0; colOffset < targetRange.numCols; colOffset++) {
        const source = this.sheet.cell(
          this.row + (rowOffset % this.numRows),
          this.col + (colOffset % this.numCols),
        );
        const target = this.sheet.cell(
          targetRange.row + rowOffset,
          targetRange.col + colOffset,
        );
        if (pasteType === "PASTE_FORMAT") target.format = source.format;
        if (pasteType === "PASTE_DATA_VALIDATION") {
          target.validation = source.validation;
        }
        if (pasteType === "PASTE_CONDITIONAL_FORMATTING") {
          target.conditionalFormat = source.conditionalFormat;
        }
        if (pasteType === "PASTE_FORMULA") {
          target.formulaR1C1 = source.formulaR1C1;
          target.value = "";
        }
      }
    }
    this.sheet.copyCalls.push({ pasteType, targetRow: targetRange.row });
    return targetRange;
  }
}

class FakeSheet {
  constructor(name, rowCount = 80, colCount = 40) {
    this.name = name;
    this.colCount = colCount;
    this.rows = Array.from({ length: rowCount }, () =>
      Array.from({ length: colCount }, blankCell),
    );
    this.rowHeights = Array(rowCount).fill(21);
    this.insertedRows = 0;
    this.setValuesCalls = 0;
    this.copyCalls = [];
    this.merges = [];
    this.conditionalRules = [];
  }

  cell(row, col) {
    while (this.rows.length < row) {
      this.rows.push(Array.from({ length: this.colCount }, blankCell));
      this.rowHeights.push(21);
    }
    return this.rows[row - 1][col - 1];
  }

  displayAt(row, col) {
    const cell = this.cell(row, col);
    if (cell.value !== "" && cell.value != null) return String(cell.value);
    return cell.formulaR1C1 ? "0" : "";
  }

  getName() {
    return this.name;
  }

  getLastRow() {
    for (let row = this.rows.length; row >= 1; row--) {
      if (
        this.rows[row - 1].some(
          (cell) => cell.value !== "" || cell.formulaR1C1 !== "",
        )
      ) {
        return row;
      }
    }
    return 0;
  }

  getLastColumn() {
    for (let col = this.colCount; col >= 1; col--) {
      if (
        this.rows.some(
          (row) =>
            row[col - 1].value !== "" || row[col - 1].formulaR1C1 !== "",
        )
      ) {
        return col;
      }
    }
    return 0;
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

  insertRowsBefore(beforeRow, howMany) {
    const rows = Array.from({ length: howMany }, () =>
      Array.from({ length: this.colCount }, blankCell),
    );
    this.rows.splice(beforeRow - 1, 0, ...rows);
    this.rowHeights.splice(beforeRow - 1, 0, ...Array(howMany).fill(21));
    this.insertedRows += howMany;

    const shiftRange = (range) => {
      if (range.startRow >= beforeRow) {
        range.startRow += howMany;
        range.endRow += howMany;
      } else if (range.endRow >= beforeRow) {
        range.endRow += howMany;
      }
    };
    this.merges.forEach(shiftRange);
    this.conditionalRules.forEach(shiftRange);
  }

  getConditionalFormatRules() {
    return this.conditionalRules.map((rule) => ({
      getRanges: () => [
        {
          getRow: () => rule.startRow,
          getLastRow: () => rule.endRow,
          getColumn: () => rule.startCol || 1,
          getLastColumn: () => rule.endCol || this.colCount,
          getA1Notation: () =>
            `R${rule.startRow}C${rule.startCol || 1}:R${rule.endRow}C${
              rule.endCol || this.colCount
            }`,
        },
      ],
      copy: () => ({
        setRanges: (ranges) => ({
          build: () => {
            const range = ranges[0];
            return {
              startRow: range.getRow(),
              endRow: range.getLastRow(),
              startCol: range.getColumn(),
              endCol: range.getLastColumn(),
            };
          },
        }),
      }),
    }));
  }

  setConditionalFormatRules(rules) {
    this.conditionalRules = (rules || []).map((rule) => {
      if (rule && typeof rule.getRanges === "function") {
        const range = rule.getRanges()[0];
        return {
          startRow: range.getRow(),
          endRow: range.getLastRow(),
          startCol: range.getColumn(),
          endCol: range.getLastColumn(),
        };
      }
      return rule;
    });
  }

  getMaxRows() {
    return this.rows.length;
  }

  getMaxColumns() {
    return this.colCount;
  }

  getRowHeight(row) {
    return this.rowHeights[row - 1];
  }

  setRowHeights(startRow, rowCount, height) {
    for (let row = startRow; row < startRow + rowCount; row++) {
      this.rowHeights[row - 1] = height;
    }
  }

  setRowHeight(row, height) {
    this.rowHeights[row - 1] = height;
  }

  valueAt(row, col) {
    return this.cell(row, col).value;
  }
}

function buildMonthSheet(layout, options = {}) {
  const sheet = new FakeSheet(options.name || "07");
  const firstDateCol = layout === "compact" ? 3 : 8;
  const lastDateCol = firstDateCol + 30;
  sheet.cell(1, 1).value = layout === "compact" ? "БР" : "Телефон";
  sheet.cell(1, 2).value = "Позивний";
  for (let col = firstDateCol; col <= lastDateCol; col++) {
    sheet.cell(1, col).value = `${String(col - firstDateCol + 1).padStart(2, "0")}.07.2026`;
  }

  for (let row = 2; row <= 32; row++) {
    sheet.cell(row, 1).value = layout === "compact" ? row - 1 : `38000${row}`;
    if (layout === "compact") {
      sheet.cell(row, 1).formulaR1C1 = "=COUNTA(RC[2]:RC[32])";
    }
    sheet.cell(row, 2).value = `OLD_${row}`;
    sheet.cell(row, firstDateCol).value = `SCHEDULE_${row}`;
    sheet.rowHeights[row - 1] = 27;
    for (let col = 1; col <= lastDateCol; col++) {
      sheet.cell(row, col).format = `working-${col}`;
      sheet.cell(row, col).validation = `validation-${col}`;
      sheet.cell(row, col).conditionalFormat = `conditional-${col}`;
    }
  }

  if (options.includeSummary !== false) {
    const summaryStart = options.summaryStart || 34;
    sheet.cell(summaryStart, 2).value = "За_штатом";
    sheet.cell(summaryStart, firstDateCol).value = 60;
    sheet.cell(summaryStart, firstDateCol).formulaR1C1 = "=COUNTA(R2C:R[-2]C)";
    sheet.cell(summaryStart, 2).format = "summary-label";
    sheet.cell(summaryStart, 2).validation = "summary-validation";
    sheet.cell(summaryStart, 2).conditionalFormat = "summary-conditional";
    sheet.cell(summaryStart + 1, 2).value = "За_списком";
    sheet.cell(summaryStart + 1, firstDateCol).value = 31;
    sheet.cell(summaryStart + 1, firstDateCol).formulaR1C1 = "=COUNTA(R2C2:R[-3]C2)";
    sheet.cell(summaryStart + 2, 2).value = "В_наявності";
    sheet.merges.push({ startRow: summaryStart, endRow: summaryStart });
    sheet.conditionalRules.push({
      startRow: 2,
      endRow: 32,
      startCol: firstDateCol,
      endCol: lastDateCol,
    });
    sheet.conditionalRules.push({
      startRow: summaryStart,
      endRow: summaryStart + 2,
      startCol: 2,
      endCol: 2,
    });
  }

  return sheet;
}

function buildPersonnel(lastRow, rowValues = {}) {
  const sheet = new FakeSheet("PERSONNEL", Math.max(lastRow + 2, 80), 3);
  sheet.cell(1, 1).value = "Callsign";
  sheet.cell(1, 2).value = "Last name";
  for (let row = 2; row <= lastRow; row++) {
    const record = rowValues[row] || {
      callsign: `CALL_${row}`,
      lastName: `LAST_${row}`,
    };
    sheet.cell(row, 1).value = record.callsign || "";
    sheet.cell(row, 2).value = record.lastName || "";
  }
  return sheet;
}

function scheduleSnapshot(sheet, firstDateCol) {
  return Array.from({ length: 31 }, (_, index) =>
    sheet.valueAt(index + 2, firstDateCol),
  );
}

function loadSyncContext() {
  let spreadsheet = null;
  const context = vm.createContext({
    console,
    CONFIG: {
      CODE_RANGE_A1: "C2:AG32",
      DATE_ROW: 1,
      CALLSIGN_COL: 2,
      LAST_DATA_ROW: 32,
      PERSONNEL_SHEET: "PERSONNEL",
    },
    MONTHLY_CONFIG: { DATE_ROW: 1, LAST_DATA_ROW: 32 },
    VACATION_ENGINE_CONFIG: {},
    SpreadsheetApp: {
      CopyPasteType: {
        PASTE_FORMAT: "PASTE_FORMAT",
        PASTE_DATA_VALIDATION: "PASTE_DATA_VALIDATION",
        PASTE_FORMULA: "PASTE_FORMULA",
      },
    },
    getWasbSpreadsheet_: () => spreadsheet,
    getPersonnelMaterializeStartRow_: () => 2,
    _personnelBuildHeaderColIndex_: (headers) => ({
      Callsign: headers.indexOf("Callsign"),
      LastName: headers.indexOf("Last name"),
    }),
    resolvePersonnelDisplayCallsign_: monthlyCallsignValueFromPersonnelRow,
    extendConditionalFormatRulesThroughRow_(sheet, templateRow, throughRow) {
      const fromRow = Number(templateRow) || 0;
      const toRow = Number(throughRow) || 0;
      if (!sheet || toRow <= fromRow) return { extended: 0, total: 0 };
      let extended = 0;
      sheet.conditionalRules = (sheet.conditionalRules || []).map((rule) => {
        if (rule.startRow <= fromRow && rule.endRow >= fromRow && rule.endRow < toRow) {
          extended += 1;
          return { ...rule, endRow: toRow };
        }
        return rule;
      });
      return { extended, total: sheet.conditionalRules.length };
    },
  });

  vm.runInContext(sheetSchemas, context, { filename: "SheetSchemas.gs" });
  vm.runInContext(summaryData, context, { filename: "Report_SummaryData.gs" });
  vm.runInContext(syncModule, context, { filename: "MonthlyCallsignSync.gs" });

  return {
    context,
    use(monthSheet, personnelSheet) {
      spreadsheet = {
        getSheetByName(name) {
          if (name === monthSheet.getName()) return monthSheet;
          if (name === "PERSONNEL" || name === "Персонал") {
            return personnelSheet;
          }
          return null;
        },
      };
    },
  };
}

function assertRowTemplateCopied(sheet, row, sourceRow, lastDateCol) {
  assert.equal(sheet.rowHeights[row - 1], sheet.rowHeights[sourceRow - 1]);
  for (let col = 1; col <= lastDateCol; col++) {
    assert.equal(sheet.cell(row, col).format, sheet.cell(sourceRow, col).format);
    assert.equal(
      sheet.cell(row, col).validation,
      sheet.cell(sourceRow, col).validation,
    );
  }
}

{
  const runtime = loadSyncContext();
  const month = buildMonthSheet("compact");
  const personnel = buildPersonnel(33, {
    33: { callsign: "", lastName: "Петренко" },
  });
  const scheduleBefore = scheduleSnapshot(month, 3);
  runtime.use(month, personnel);

  const result = runtime.context.syncMonthlyCallsignsFromPersonnel_(month);
  assert.equal(result.rowsInserted, 1, "row 33 must expand a 2:32 area");
  assert.equal(result.personnelRows, 32);
  assert.equal(result.summaryStartRow, 35);
  assert.equal(month.valueAt(33, 2), "Петренко");
  assert.equal(month.valueAt(34, 2), "", "separator row must remain blank");
  assert.deepEqual(scheduleSnapshot(month, 3), scheduleBefore);
  assert.equal(month.valueAt(33, 3), "", "schedule values must not be copied");
  assertRowTemplateCopied(month, 33, 32, 33);
  assert.equal(month.cell(33, 1).formulaR1C1, "=COUNTA(RC[2]:RC[32])");
  assert.equal(month.valueAt(35, 2), "За_штатом");
  assert.equal(month.cell(35, 3).formulaR1C1, "=COUNTA(R2C:R[-2]C)");
  assert.equal(month.cell(35, 2).format, "summary-label");
  assert.equal(month.cell(35, 2).validation, "summary-validation");
  assert.equal(month.cell(35, 2).conditionalFormat, "summary-conditional");
  assert.equal(month.merges[0].startRow, 35);
  assert.equal(month.conditionalRules.length, 2, "sheet-level CF count must survive expand");
  assert.equal(month.conditionalRules[0].startRow, 2);
  assert.equal(month.conditionalRules[0].endRow, 33, "schedule CF must extend onto new row");
  assert.equal(month.conditionalRules[1].startRow, 35);
  assert.equal(
    month.copyCalls.some((call) => call.pasteType === "PASTE_CONDITIONAL_FORMATTING"),
    false,
    "must not paste conditional formatting during capacity expand",
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(runtime.context.findSummaryBlockLocation_(month))),
    JSON.parse(
      JSON.stringify(runtime.context.findMonthlySummaryBlockLocation_(month)),
    ),
  );

  const insertCount = month.insertedRows;
  const writeCount = month.setValuesCalls;
  const second = runtime.context.syncMonthlyCallsignsFromPersonnel_(month);
  assert.equal(second.rowsInserted, 0);
  assert.equal(second.skippedWrite, true);
  assert.equal(month.insertedRows, insertCount);
  assert.equal(month.setValuesCalls, writeCount);
  assert.equal(second.summaryStartRow, 35);
}

{
  const runtime = loadSyncContext();
  const month = buildMonthSheet("compact");
  const personnel = buildPersonnel(60, {
    20: { callsign: "", lastName: "" },
    40: { callsign: "", lastName: "" },
    41: { callsign: "ПісляПрогалини", lastName: "" },
    60: { callsign: "", lastName: "Шістдесят" },
  });
  const scheduleBefore = scheduleSnapshot(month, 3);
  runtime.use(month, personnel);

  const result = runtime.context.syncMonthlyCallsignsFromPersonnel_(month);
  assert.equal(result.personnelRows, 59);
  assert.equal(result.rowsInserted, 28);
  assert.equal(result.summaryStartRow, 62);
  assert.equal(result.capacityRows, 59);
  assert.equal(month.valueAt(20, 2), "");
  assert.equal(month.valueAt(40, 2), "");
  assert.equal(month.valueAt(41, 2), "ПісляПрогалини");
  assert.equal(month.valueAt(60, 2), "Шістдесят");
  assert.equal(month.valueAt(61, 2), "");
  assert.equal(month.valueAt(62, 2), "За_штатом");
  assert.equal(month.cell(62, 3).formulaR1C1, "=COUNTA(R2C:R[-2]C)");
  assert.deepEqual(scheduleSnapshot(month, 3), scheduleBefore);

  const second = runtime.context.syncMonthlyCallsignsFromPersonnel_(month);
  assert.equal(second.rowsInserted, 0);
  assert.equal(second.skippedWrite, true);
  assert.equal(second.summaryStartRow, 62);
}

{
  const runtime = loadSyncContext();
  const month = buildMonthSheet("standard");
  const personnel = buildPersonnel(33, {
    33: { callsign: "", lastName: "Стандарт" },
  });
  const scheduleBefore = scheduleSnapshot(month, 8);
  runtime.use(month, personnel);

  const result = runtime.context.syncMonthlyCallsignsFromPersonnel_(month);
  assert.equal(result.rowsInserted, 1);
  assert.equal(month.valueAt(33, 2), "Стандарт");
  assert.equal(month.cell(33, 1).formulaR1C1, "");
  assert.equal(month.valueAt(33, 1), "");
  assertRowTemplateCopied(month, 33, 32, 38);
  assert.deepEqual(scheduleSnapshot(month, 8), scheduleBefore);
}

{
  const runtime = loadSyncContext();
  const month = buildMonthSheet("compact", { summaryStart: 36 });
  const personnel = buildPersonnel(33);
  runtime.use(month, personnel);
  const result = runtime.context.syncMonthlyCallsignsFromPersonnel_(month);
  assert.equal(result.rowsInserted, 0, "existing free rows must be used first");
  assert.equal(result.summaryStartRow, 36);
  assert.equal(month.valueAt(33, 2), "CALL_33");
  assert.equal(month.valueAt(35, 2), "", "one separator must be retained");
}

{
  const runtime = loadSyncContext();
  const month = buildMonthSheet("compact", { includeSummary: false });
  const personnel = buildPersonnel(33);
  const before = JSON.stringify(
    month.rows.map((row) => row.map((cell) => [cell.value, cell.formulaR1C1])),
  );
  runtime.use(month, personnel);

  assert.throws(
    () => runtime.context.syncMonthlyCallsignsFromPersonnel_(month),
    /не знайдено формульний блок зведення.*синхронізацію зупинено без змін/i,
  );
  assert.equal(month.insertedRows, 0);
  assert.equal(month.setValuesCalls, 0);
  assert.equal(
    JSON.stringify(
      month.rows.map((row) => row.map((cell) => [cell.value, cell.formulaR1C1])),
    ),
    before,
  );
}

console.log("verify-monthly-callsign-sync: OK");

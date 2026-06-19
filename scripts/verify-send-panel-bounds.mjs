#!/usr/bin/env node
/**
 * SEND_PANEL data row bounds — monthly schedule row count vs panel tail cleanup.
 */
import assert from "node:assert/strict";
import vm from "node:vm";
import { repoRoot } from "./lib/load-contract.mjs";
import { readRepoFileByBasename } from "./lib/gas-files.mjs";

const sendPanelSource = readRepoFileByBasename(repoRoot, "SendPanel.gs", {
  errorPrefix: "verify-send-panel-bounds",
});

assert.match(
  sendPanelSource,
  /function calcSendPanelDataEndRow_/,
  "SendPanel.gs must expose calcSendPanelDataEndRow_",
);
assert.match(
  sendPanelSource,
  /MONTHLY_CONFIG\.FIRST_DATA_ROW/,
  "getSendPanelDataBounds_ must use MONTHLY_CONFIG.FIRST_DATA_ROW",
);
assert.doesNotMatch(
  sendPanelSource.match(/function getSendPanelDataBounds_[\s\S]*?^}/m)?.[0] || "",
  /MONTHLY_CONFIG\.LAST_DATA_ROW\s*\|\|\s*\n?\s*40/,
  "getSendPanelDataBounds_ must not use LAST_DATA_ROW alone as endRow",
);

const fastPathsSource = readRepoFileByBasename(
  repoRoot,
  "SendPanelFastPaths.gs",
  { errorPrefix: "verify-send-panel-bounds" },
);
assert.match(
  fastPathsSource,
  /calcSendPanelDataEndRow_/,
  "SendPanelFastPaths.gs must use calcSendPanelDataEndRow_",
);

const context = vm.createContext({
  console,
  CONFIG: {
    SEND_PANEL_SHEET: "SEND_PANEL",
    SEND_PANEL_DATA_START_ROW: 3,
    SEND_PANEL_LEGACY_END_ROW: 40,
  },
  MONTHLY_CONFIG: {
    FIRST_DATA_ROW: 2,
    LAST_DATA_ROW: 30,
  },
  getWasbSpreadsheet_: () => ({
    getSheetByName: () => null,
  }),
});

vm.runInContext(sendPanelSource, context, { filename: "SendPanel.gs" });

const calcEnd = context.calcSendPanelDataEndRow_;
const getBounds = context.getSendPanelDataBounds_;

assert.equal(typeof calcEnd, "function");
assert.equal(typeof getBounds, "function");

const expectedMonthlyEnd =
  3 + (30 - 2 + 1) - 1;
assert.equal(expectedMonthlyEnd, 31, "29 monthly rows map to SEND_PANEL rows 3–31");

assert.equal(
  calcEnd({
    sendPanelDataStartRow: 3,
    monthlyFirstDataRow: 2,
    monthlyLastDataRow: 30,
    sendPanelLegacyEndRow: 40,
  }),
  40,
  "legacy corridor extends clear range through row 40",
);

assert.equal(
  calcEnd({
    sendPanelDataStartRow: 3,
    monthlyFirstDataRow: 2,
    monthlyLastDataRow: 30,
    sendPanelLegacyEndRow: 31,
  }),
  31,
  "without legacy padding endRow equals mapped monthly end",
);

const bounds = getBounds();
assert.equal(bounds.startRow, 3);
assert.equal(bounds.endRow, 40);
assert.equal(bounds.expectedEndRow, 31);

function tailCleanupRange_(startRow, endRow, rowsWritten) {
  const tailStart = startRow + Number(rowsWritten);
  if (tailStart > endRow) return null;
  return { tailStart, tailCount: endRow - tailStart + 1 };
}

const oldBugEndRow = 30;
const newEndRow = bounds.endRow;
const rowsWritten = 25;

const oldTail = tailCleanupRange_(3, oldBugEndRow, rowsWritten);
const newTail = tailCleanupRange_(3, newEndRow, rowsWritten);

assert.ok(oldTail);
assert.ok(newTail);
assert.equal(oldTail.tailStart, 28);
assert.equal(oldTail.tailCount, 3, "old bounds stop at row 30 — row 31 survives");
assert.equal(newTail.tailStart, 28);
assert.equal(newTail.tailCount, 13, "fixed bounds clear through legacy row 40");
assert.ok(
  newTail.tailStart + newTail.tailCount - 1 >= 31,
  "row 31 must be included in tail cleanup",
);

console.log("verify-send-panel-bounds: OK");

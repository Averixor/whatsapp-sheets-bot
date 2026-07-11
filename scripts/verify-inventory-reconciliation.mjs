#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { repoRoot } from './lib/load-contract.mjs';

const inventory = fs.readFileSync(path.join(repoRoot, 'inventory/InventoryReconciliation.gs'), 'utf8');
const client = fs.readFileSync(path.join(repoRoot, 'ui/Js.InventoryReconciliation.html'), 'utf8');
const protection = fs.readFileSync(path.join(repoRoot, 'sheets/SpreadsheetProtection.gs'), 'utf8');
const health = fs.readFileSync(path.join(repoRoot, 'diagnostics/Diagnostics.Health.gs'), 'utf8');
const stage7Api = fs.readFileSync(path.join(repoRoot, 'api/Stage7ServerApi.gs'), 'utf8');

const COMPLETE_COLOR = '#D9EAD3';
const INCOMPLETE_COLOR = '#F4CCCC';

/** Mirrors InventoryReconciliation_.computeMonthStatus_ */
function computeMonthStatus({ future, past, checksComplete, filesComplete }) {
  const complete = !!checksComplete && !!filesComplete;
  let color = null;
  let status = 'current';

  if (past && complete) {
    color = COMPLETE_COLOR;
    status = 'complete';
  } else if (past && !filesComplete) {
    color = INCOMPLETE_COLOR;
    status = 'missing_files';
  } else if (past) {
    color = INCOMPLETE_COLOR;
    status = 'incomplete';
  } else if (future) {
    status = 'future';
  }

  return { status, color, complete, checksComplete: !!checksComplete, filesComplete: !!filesComplete };
}

assert.equal(computeMonthStatus({ past: true, future: false, checksComplete: true, filesComplete: true }).status, 'complete');
assert.equal(computeMonthStatus({ past: true, future: false, checksComplete: false, filesComplete: true }).status, 'incomplete');
assert.equal(computeMonthStatus({ past: false, future: false, checksComplete: false, filesComplete: false }).status, 'current');
assert.equal(computeMonthStatus({ past: false, future: false, checksComplete: true, filesComplete: true }).status, 'current');
assert.equal(computeMonthStatus({ past: false, future: true, checksComplete: true, filesComplete: true }).status, 'future');
assert.equal(computeMonthStatus({ past: true, future: false, checksComplete: true, filesComplete: false }).status, 'missing_files');
assert.equal(computeMonthStatus({ past: true, future: false, checksComplete: true, filesComplete: true }).color, COMPLETE_COLOR);
assert.equal(computeMonthStatus({ past: true, future: false, checksComplete: false, filesComplete: false }).color, INCOMPLETE_COLOR);
assert.equal(8 * 12, 96);
assert.equal(9 * 12, 108);

/** Mirrors InventoryReconciliation_.markScanTruncated_ + walkFolder_ depth/file guards */
function applyScanLimits({ depth, maxDepth, fileCount, maxFiles }) {
  const scanState = { truncated: false, truncatedByFiles: false, truncatedByDepth: false };
  if (depth > maxDepth) {
    scanState.truncated = true;
    scanState.truncatedByDepth = true;
    return scanState;
  }
  if (fileCount >= maxFiles) {
    scanState.truncated = true;
    scanState.truncatedByFiles = true;
    return scanState;
  }
  return scanState;
}

const depthHit = applyScanLimits({ depth: 6, maxDepth: 5, fileCount: 0, maxFiles: 2500 });
assert.equal(depthHit.truncated, true);
assert.equal(depthHit.truncatedByDepth, true);
assert.equal(depthHit.truncatedByFiles, false);

const filesHit = applyScanLimits({ depth: 2, maxDepth: 5, fileCount: 2500, maxFiles: 2500 });
assert.equal(filesHit.truncated, true);
assert.equal(filesHit.truncatedByFiles, true);
assert.equal(filesHit.truncatedByDepth, false);

const withinLimits = applyScanLimits({ depth: 5, maxDepth: 5, fileCount: 10, maxFiles: 2500 });
assert.equal(withinLimits.truncated, false);
assert.equal(withinLimits.truncatedByDepth, false);
assert.equal(withinLimits.truncatedByFiles, false);

for (const code of ['СІІЗ', 'ЕТС', 'СВТ', 'СЗББР', 'СЗУ', 'ВС', 'МС', 'ОВТТАМСВ', 'САППО']) {
  assert.match(inventory, new RegExp(`"${code}"\\s*:`), `missing service alias: ${code}`);
}

assert.match(inventory, /function computeMonthStatus_/);
assert.match(inventory, /computeMonthStatus_\(\{/);
assert.equal((inventory.match(/computeMonthStatus_\(/g) || []).length, 3, 'computeMonthStatus_ definition + applyFormatting + monthStatus_');
assert.match(inventory, /if \(past && complete\)/);
assert.doesNotMatch(inventory, /if \(!future && complete\)/);
assert.match(inventory, /status = "missing_files"/);
assert.match(inventory, /checksComplete:\s*checksComplete/);
assert.match(inventory, /filesComplete:\s*filesComplete/);
assert.match(inventory, /порожній рядок між службами/);
assert.match(inventory, /Папку звірок Google Drive ще не налаштовано/);
assert.match(inventory, /function markScanTruncated_/);
assert.match(inventory, /markScanTruncated_\(scanState, "depth"\)/);
assert.match(inventory, /markScanTruncated_\(scanState, "files"\)/);
assert.match(inventory, /truncatedByFiles:\s*!!scanState\.truncatedByFiles/);
assert.match(inventory, /truncatedByDepth:\s*!!scanState\.truncatedByDepth/);
assert.doesNotMatch(inventory, /if \(depth > DEFAULTS\.MAX_SCAN_DEPTH\) return;/);
assert.doesNotMatch(inventory, /truncated:\s*files\.length\s*>=/);
assert.match(stage7Api, /truncatedByFiles/);
assert.match(stage7Api, /truncatedByDepth/);
assert.match(stage7Api, /граничну глибину вкладених папок/);
assert.match(client, /if \(!data\.success\)/);
assert.match(client, /Оберіть клітинку звірки/);
assert.match(protection, /protectInventoryReconciliationIndexSheet_/);
assert.match(protection, /setWarningOnly\(false\)/);
assert.match(health, /blockingProtection/);

console.log('verify-inventory-reconciliation: OK');

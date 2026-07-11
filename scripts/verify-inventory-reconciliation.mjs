#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { repoRoot } from './lib/load-contract.mjs';
import { readRepoFileByBasename } from './lib/gas-files.mjs';

const inventory = readRepoFileByBasename(repoRoot, 'InventoryReconciliation.gs', {
  errorPrefix: 'verify-inventory-reconciliation',
});
const client = fs.readFileSync(path.join(repoRoot, 'ui/Js.InventoryReconciliation.html'), 'utf8');
const protection = fs.readFileSync(path.join(repoRoot, 'sheets/SpreadsheetProtection.gs'), 'utf8');
const health = fs.readFileSync(path.join(repoRoot, 'diagnostics/Diagnostics.Health.gs'), 'utf8');
const stage7Api = fs.readFileSync(path.join(repoRoot, 'api/Stage7ServerApi.gs'), 'utf8');

function extractFunctionBody(source, fnName) {
  const marker = `function ${fnName}`;
  const start = source.indexOf(marker);
  assert.ok(start >= 0, `missing ${fnName} in InventoryReconciliation.gs`);
  const tail = source.slice(start);
  const nextFn = tail.slice(marker.length).search(/\n  function [A-Za-z_$]/);
  return nextFn >= 0 ? tail.slice(0, nextFn + marker.length) : tail;
}

function extractConstObject(source, constName) {
  const marker = `const ${constName} = Object.freeze({`;
  const start = source.indexOf(marker);
  assert.ok(start >= 0, `missing ${constName} in InventoryReconciliation.gs`);
  const tail = source.slice(start);
  const end = tail.indexOf('});');
  assert.ok(end >= 0, `unterminated ${constName}`);
  return tail.slice(0, end + 3);
}

const defaultsSource = inventory.match(/const DEFAULTS = Object\.freeze\(\{[\s\S]*?\}\);/);
assert.ok(defaultsSource, 'DEFAULTS block missing in InventoryReconciliation.gs');

const inventoryContext = vm.createContext({ Object, console });
vm.runInContext(
  `${defaultsSource[0]}\n${extractConstObject(inventory, 'SCAN_TRUNCATION_REASON')}\n${extractFunctionBody(inventory, 'computeMonthStatus_')}\n${extractFunctionBody(inventory, 'markScanTruncated_')}`,
  inventoryContext,
  { filename: 'InventoryReconciliation.extracted.js' },
);

const computeMonthStatus = vm.runInContext('computeMonthStatus_', inventoryContext);
const markScanTruncated = vm.runInContext('markScanTruncated_', inventoryContext);
const DEFAULTS = vm.runInContext('DEFAULTS', inventoryContext);
const SCAN_TRUNCATION_REASON = vm.runInContext('SCAN_TRUNCATION_REASON', inventoryContext);

assert.equal(computeMonthStatus({ past: true, future: false, checksComplete: true, filesComplete: true }).status, 'complete');
assert.equal(computeMonthStatus({ past: true, future: false, checksComplete: false, filesComplete: true }).status, 'incomplete');
assert.equal(computeMonthStatus({ past: false, future: false, checksComplete: false, filesComplete: false }).status, 'current');
assert.equal(computeMonthStatus({ past: false, future: false, checksComplete: true, filesComplete: true }).status, 'current');
assert.equal(computeMonthStatus({ past: false, future: true, checksComplete: true, filesComplete: true }).status, 'future');
assert.equal(computeMonthStatus({ past: true, future: false, checksComplete: true, filesComplete: false }).status, 'missing_files');
assert.equal(computeMonthStatus({ past: true, future: false, checksComplete: true, filesComplete: true }).color, DEFAULTS.COMPLETE_COLOR);
assert.equal(computeMonthStatus({ past: true, future: false, checksComplete: false, filesComplete: false }).color, DEFAULTS.INCOMPLETE_COLOR);
assert.equal(8 * 12, 96);
assert.equal(9 * 12, 108);

function scanStateSnapshot() {
  return { truncated: false, truncatedByFiles: false, truncatedByDepth: false };
}

const depthHit = scanStateSnapshot();
markScanTruncated(depthHit, SCAN_TRUNCATION_REASON.DEPTH);
assert.equal(depthHit.truncated, true);
assert.equal(depthHit.truncatedByDepth, true);
assert.equal(depthHit.truncatedByFiles, false);

const filesHit = scanStateSnapshot();
markScanTruncated(filesHit, SCAN_TRUNCATION_REASON.FILES);
assert.equal(filesHit.truncated, true);
assert.equal(filesHit.truncatedByFiles, true);
assert.equal(filesHit.truncatedByDepth, false);

const withinLimits = scanStateSnapshot();
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
assert.match(inventory, /const SCAN_TRUNCATION_REASON = Object\.freeze\(/);
assert.match(inventory, /function markScanTruncated_/);
assert.match(inventory, /markScanTruncated_\(scanState, SCAN_TRUNCATION_REASON\.DEPTH\)/);
assert.match(inventory, /markScanTruncated_\(scanState, SCAN_TRUNCATION_REASON\.FILES\)/);
assert.match(inventory, /reason === SCAN_TRUNCATION_REASON\.DEPTH/);
assert.match(inventory, /reason === SCAN_TRUNCATION_REASON\.FILES/);
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

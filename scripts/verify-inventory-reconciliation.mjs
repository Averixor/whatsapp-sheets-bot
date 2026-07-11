#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { repoRoot } from './lib/load-contract.mjs';

const inventory = fs.readFileSync(path.join(repoRoot, 'inventory/InventoryReconciliation.gs'), 'utf8');
const client = fs.readFileSync(path.join(repoRoot, 'ui/Js.InventoryReconciliation.html'), 'utf8');
const protection = fs.readFileSync(path.join(repoRoot, 'sheets/SpreadsheetProtection.gs'), 'utf8');
const health = fs.readFileSync(path.join(repoRoot, 'diagnostics/Diagnostics.Health.gs'), 'utf8');

function status({ relation, checksComplete, filesComplete }) {
  if (relation === 'future') return 'future';
  if (relation === 'current') return 'current';
  if (checksComplete && filesComplete) return 'complete';
  if (!filesComplete) return 'missing_files';
  return 'incomplete';
}

assert.equal(status({ relation: 'past', checksComplete: true, filesComplete: true }), 'complete');
assert.equal(status({ relation: 'past', checksComplete: false, filesComplete: true }), 'incomplete');
assert.equal(status({ relation: 'current', checksComplete: false, filesComplete: false }), 'current');
assert.equal(status({ relation: 'current', checksComplete: true, filesComplete: true }), 'current');
assert.equal(status({ relation: 'future', checksComplete: true, filesComplete: true }), 'future');
assert.equal(status({ relation: 'past', checksComplete: true, filesComplete: false }), 'missing_files');
assert.equal(8 * 12, 96);
assert.equal(9 * 12, 108);

for (const code of ['СІІЗ', 'ЕТС', 'СВТ', 'СЗББР', 'СЗУ', 'ВС', 'МС', 'ОВТТАМСВ', 'САППО']) {
  assert.match(inventory, new RegExp(`"${code}"\\s*:`), `missing service alias: ${code}`);
}

assert.match(inventory, /if \(past && complete\)/);
assert.doesNotMatch(inventory, /if \(!future && complete\)/);
assert.match(inventory, /status = "missing_files"/);
assert.match(inventory, /checksComplete:\s*checksComplete/);
assert.match(inventory, /filesComplete:\s*filesComplete/);
assert.match(inventory, /порожній рядок між службами/);
assert.match(inventory, /Папку звірок Google Drive ще не налаштовано/);
assert.match(inventory, /scanState\.truncated/);
assert.doesNotMatch(inventory, /truncated:\s*files\.length\s*>=/);
assert.match(client, /if \(!data\.success\)/);
assert.match(client, /Оберіть клітинку звірки/);
assert.match(protection, /protectInventoryReconciliationIndexSheet_/);
assert.match(protection, /setWarningOnly\(false\)/);
assert.match(health, /blockingProtection/);

console.log('verify-inventory-reconciliation: OK');

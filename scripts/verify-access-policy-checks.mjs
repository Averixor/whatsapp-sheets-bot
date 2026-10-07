#!/usr/bin/env node
/**
 * Static parity for AccessPolicyChecks vs AccessControl/AccessEnforcement contracts.
 */
import assert from 'node:assert/strict';
import { readRepoFileByBasename } from './lib/gas-files.mjs';
import { repoRoot } from './lib/load-contract.mjs';

function read(rel) {
  return readRepoFileByBasename(repoRoot, rel, {
    errorPrefix: 'verify-access-policy-checks',
  });
}

function extractStringArray(text, fieldName) {
  const start = text.indexOf(`${fieldName}: [`);
  if (start < 0) throw new Error(`${fieldName} not found`);
  const slice = text.slice(start, start + 4000);
  const match = slice.match(/\[([\s\S]*?)\]/);
  if (!match) throw new Error(`${fieldName} array not parsed`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]);
}

function extractSysadminActions(publicApiSource) {
  const block = publicApiSource.match(
    /case\s+"sysadmin":\s*return\s*\[([\s\S]*?)\];/,
  );
  if (!block) {
    throw new Error('listAllowedActionsForRole_ sysadmin case not found');
  }
  return [...block[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]);
}

function extractProtectedSheetDefaults(enforcementSource) {
  const fn = enforcementSource.match(
    /function _protectedSheets_\(\)\s*\{([\s\S]*?)\n\s*\}/,
  );
  if (!fn) throw new Error('_protectedSheets_ not found');
  const values = [...fn[1].matchAll(/"([A-Z0-9_]+)"/g)].map((item) => item[1]);
  const defaults = [...fn[1].matchAll(/,\s*"([A-Z0-9_]+)"/g)].map(
    (item) => item[1],
  );
  return [...new Set([...values, ...defaults])];
}

const policyChecks = read('access/AccessPolicyChecks.gs');
const publicApi = read('access/AccessControl.PublicApi.gs');
const enforcement = read('access/AccessEnforcement.gs');

const requiredMaintenance = extractStringArray(
  policyChecks,
  'REQUIRED_MAINTENANCE_ACTIONS',
);
const expectedProtected = extractStringArray(
  policyChecks,
  'EXPECTED_PROTECTED_SHEETS',
);
const sysadminActions = extractSysadminActions(publicApi);
const protectedDefaults = extractProtectedSheetDefaults(enforcement);

for (const action of requiredMaintenance) {
  assert.ok(
    sysadminActions.includes(action),
    `sysadmin allowed actions missing maintenance action: ${action}`,
  );
}

for (const sheet of expectedProtected) {
  assert.ok(
    protectedDefaults.includes(sheet),
    `AccessEnforcement protected sheet default missing expected sheet: ${sheet}`,
  );
}

console.log('verify-access-policy-checks: OK');
console.log(`  maintenance actions: ${requiredMaintenance.join(', ')}`);
console.log(`  expected protected sheets: ${expectedProtected.length}`);

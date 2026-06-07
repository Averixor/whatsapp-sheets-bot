#!/usr/bin/env node
/**
 * Ensures PersonnelRepository.gs status lists match contracts/personnel-status.contract.json.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { loadContract, repoRoot } from './lib/load-contract.mjs';

const contract = loadContract('personnel-status.contract.json');
const source = fs.readFileSync(
  path.join(repoRoot, 'PersonnelRepository.gs'),
  'utf8',
);

function loadPersonnelStatusConstants() {
  const context = vm.createContext({
    CONFIG: { PERSONNEL_SHEET: 'PERSONNEL' },
    console,
  });
  vm.runInContext(source, context, { filename: 'PersonnelRepository.gs' });
  return {
    dropdown: context.PERSONNEL_STATUS_SHEET_VALUES_.slice(),
    active: context.PERSONNEL_ACTIVE_STATUSES_.slice(),
    inactive: context.PERSONNEL_INACTIVE_STATUSES_.slice(),
    defaultStatus: String(context.PERSONNEL_DEFAULT_STATUS_UA_),
    normalize: context.normalizePersonnelStatus_,
    isActive: context.isPersonnelStatusActive_,
  };
}

function assertJsonEqual(actual, expected, message) {
  assert.equal(JSON.stringify(actual), JSON.stringify(expected), message);
}

const runtime = loadPersonnelStatusConstants();

assertJsonEqual(
  runtime.dropdown,
  contract.dropdownOrder,
  'PERSONNEL_STATUS_SHEET_VALUES_ must match contract dropdownOrder',
);
assertJsonEqual(
  runtime.active,
  contract.activeStatuses,
  'PERSONNEL_ACTIVE_STATUSES_ must match contract activeStatuses',
);
assertJsonEqual(
  runtime.inactive,
  contract.inactiveStatuses,
  'PERSONNEL_INACTIVE_STATUSES_ must match contract inactiveStatuses',
);
assert.equal(
  runtime.defaultStatus,
  contract.defaultStatus,
  'PERSONNEL_DEFAULT_STATUS_UA_ must match contract defaultStatus',
);

Object.entries(contract.legacyReadAliases || {}).forEach(([raw, expected]) => {
  assert.equal(
    runtime.normalize(raw),
    expected,
    `normalizePersonnelStatus_(${JSON.stringify(raw)})`,
  );
});

assert.equal(runtime.isActive(''), true, 'empty status is active');
assert.equal(runtime.isActive('СЗЧ'), false, 'СЗЧ is inactive');
assert.equal(runtime.isActive('Лікарняний'), true, 'Лікарняний is active');

console.log(
  `verify-personnel-status-contract: OK (dropdown=${runtime.dropdown.length}, active=${runtime.active.length}, inactive=${runtime.inactive.length})`,
);

#!/usr/bin/env node
/**
 * Push committed code to GitHub. Production GAS only with --with-gas on main.
 *
 * Run checks first:
 *   npm run check
 *
 * Then:
 *   npm run push:remote              # git push only
 *   npm run push:remote -- --with-gas  # git push + gas:push (main only)
 *
 * All flags/branch/clasp preconditions are checked BEFORE git push.
 * See .cursor/rules/git-safety.mdc §13.
 */

import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertMainForGasDeploy,
  assertNoUnknownFlags,
  capture,
  parseMessageAndFlags,
  run,
} from './lib/git-ops-guards.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const { flags, unknownFlags } = parseMessageAndFlags(process.argv.slice(2), [
  '--with-gas',
  '--help',
  '-h',
]);
const withGas = flags.has('--with-gas');

function runLabel(label, cmd, args) {
  console.log(`\n=== ${label} ===`);
  run(cmd, args, root);
}

if (flags.has('--help') || flags.has('-h')) {
  console.log(`WASB push:remote — git push; optional production clasp

  npm run check                        усі локальні перевірки
  npm run push:remote                  лише git push (без GAS)
  npm run push:remote -- --with-gas    git push + gas:push (лише main)

  Потрібно: закомічені зміни, .clasp.json + clasp login для --with-gas.
  GAS push іде через npm run gas:push (ops-gas.mjs).
  Після deploy у GAS: apiStage7ClearPhoneCache()
`);
  process.exit(0);
}

assertNoUnknownFlags(unknownFlags);

console.log('WASB push:remote');
console.log(`Root: ${root}`);
console.log(`with-gas: ${withGas ? 'yes' : 'no'}`);

const dirty = capture('git', ['status', '--porcelain'], root);
if (dirty) {
  console.error(
    '\n✗ Є незакомічені зміни. Спочатку точково stage + commit:\n' +
      '  git add path/to/file1 path/to/file2\n' +
      '  git commit -m "опис змін"\n' +
      '  npm run push:remote\n' +
      '\nАбо: npm run ship -- "опис змін"  (CI + staged commit + push; GAS лише з --deploy-gas)',
  );
  process.exit(1);
}

let branch;
try {
  branch = capture('git', ['branch', '--show-current'], root);
} catch (err) {
  console.error(`\n✗ ${err.message}`);
  process.exit(1);
}

if (!branch) {
  console.error('\n✗ Не вдалося визначити поточну git-гілку.');
  process.exit(1);
}

// All GAS gates before any remote mutation.
if (withGas) {
  assertMainForGasDeploy(branch, '--with-gas');
  const claspProd = resolve(root, '.clasp.json');
  if (!existsSync(claspProd)) {
    console.error(
      '\n✗ Немає .clasp.json — clasp login і прив’яжіть production project.',
    );
    process.exit(1);
  }
}

runLabel(`Git push (origin ${branch})`, 'git', ['push', '-u', 'origin', branch]);

if (!withGas) {
  console.log('\n=== push:remote complete (git only) ===');
  console.log('GitHub: pushed');
  console.log('GAS: skipped — pass --with-gas on main for production clasp push');
  process.exit(0);
}

runLabel('clasp push (production)', 'npm', ['run', 'gas:push']);

console.log('\n=== push:remote complete ===');
console.log('GitHub: pushed');
console.log('GAS: clasp push done');
console.log('Production GAS (обов’язково): apiStage7ClearPhoneCache()');

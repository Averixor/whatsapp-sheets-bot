#!/usr/bin/env node
/**
 * Same orchestration as ship: CI + staged commit/push; GAS only with --deploy-gas.
 * Does not run map:project-files — stage the map yourself first if needed.
 *
 *   npm run release -- "fix: message"
 *   npm run release -- "fix: message" --deploy-gas
 *
 * See .cursor/rules/git-safety.mdc §13.
 */
import {
  assertMainForGasDeploy,
  assertShipReleasePreflight,
  assertTreeStillSafeForGh,
  capture,
  currentBranch,
  parseMessageAndFlags,
  run,
} from './lib/git-ops-guards.mjs';

const { message, flags, unknownFlags } = parseMessageAndFlags(
  process.argv.slice(2),
  ['--deploy-gas'],
);

const branch = currentBranch();
const porcelainBefore = capture('git', ['status', '--porcelain']);

assertShipReleasePreflight({
  message,
  flags,
  unknownFlags,
  porcelain: porcelainBefore,
  branch,
  deployGasFlag: '--deploy-gas',
});

run('npm', ['run', 'ci']);

assertTreeStillSafeForGh(capture('git', ['status', '--porcelain']));

run('npm', ['run', 'gh', '--', message]);

if (flags.has('--deploy-gas')) {
  assertMainForGasDeploy(currentBranch(), '--deploy-gas');
  console.log('\nRelease: deploying to production GAS (main + --deploy-gas)…');
  run('npm', ['run', 'gas:push']);
  console.log('Production GAS (обов’язково): apiStage7ClearPhoneCache()');
} else {
  console.log(
    '\nRelease: GitHub sync done. GAS deploy skipped (pass --deploy-gas on main if needed).',
  );
}

console.log('\nRelease: completed');

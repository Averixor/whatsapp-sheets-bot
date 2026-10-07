#!/usr/bin/env node
/**
 * Map is NOT refreshed here (avoids unstaged map churn blocking gh).
 *
 * Prepare first when structure changed:
 *   npm run map:project-files
 *   git add docs/project-files-complete.txt   # and other task files
 *
 * Then:
 *   npm run ship -- "fix: message"
 *   npm run ship -- "fix: message" --deploy-gas   # main only; checked BEFORE CI/git
 *
 * Flow: preflight → npm run ci → gh → optional gas:push
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
  console.log('\nShip: deploying to production GAS (main + --deploy-gas)…');
  run('npm', ['run', 'gas:push']);
  console.log('Production GAS (обов’язково): apiStage7ClearPhoneCache()');
} else {
  console.log(
    '\nShip: GitHub sync done. GAS deploy skipped (pass --deploy-gas on main if needed).',
  );
}

console.log('\nShip: completed');

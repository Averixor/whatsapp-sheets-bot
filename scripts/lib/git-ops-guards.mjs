/**
 * Shared guards for npm Git/GAS orchestration scripts.
 * Aligns with .cursor/rules/git-safety.mdc §5 / §13.
 *
 * Principle: validate all preconditions before any Git/GAS mutation.
 *
 * Self-test: node scripts/lib/git-ops-guards.mjs --self-test
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function capture(cmd, args, cwd = process.cwd()) {
  const result = spawnSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || '').trim();
    throw new Error(`${cmd} ${args.join(' ')} failed${err ? `: ${err}` : ''}`);
  }
  return String(result.stdout || '').replace(/\r?\n$/, '');
}

export function run(cmd, args = [], cwd = process.cwd()) {
  console.log(`\n$ ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: false, cwd });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

/** Porcelain lines → { staged, unstaged, untracked }. */
export function classifyPorcelain(porcelain) {
  const staged = [];
  const unstaged = [];
  const untracked = [];
  for (const line of String(porcelain || '').split('\n')) {
    if (!line) continue;
    if (line.startsWith('??')) {
      untracked.push(line.slice(3));
      continue;
    }
    const x = line[0] || ' ';
    const y = line[1] || ' ';
    const path = line.slice(3);
    if (x !== ' ' && x !== '?') staged.push(path);
    if (y !== ' ' && y !== '?') unstaged.push(path);
  }
  return { staged, unstaged, untracked };
}

/**
 * @returns {{ ok: true, staged: string[] } | { ok: false, reason: string, staged: string[], unstaged: string[], untracked: string[] }}
 */
export function evaluateStagedOnlyCommit(porcelain) {
  const { staged, unstaged, untracked } = classifyPorcelain(porcelain);
  if (unstaged.length || untracked.length) {
    return {
      ok: false,
      reason: 'dirty-unstaged-or-untracked',
      staged,
      unstaged,
      untracked,
    };
  }
  return { ok: true, staged, unstaged, untracked };
}

/**
 * Refuse mass-add. Commit only when something is already staged and
 * there are no unstaged/untracked leftovers (avoids mixing tasks).
 */
export function assertSafeToCommitStagedOnly(porcelain) {
  const result = evaluateStagedOnlyCommit(porcelain);
  if (!result.ok) {
    console.error(
      '\nERROR: git-safety — є unstaged/untracked зміни.\n' +
        '  Масовий git add -A заборонений. Додайте лише файли поточного завдання:\n' +
        '    git add path/to/file1 path/to/file2\n' +
        '  Потім повторіть команду.\n',
    );
    if (result.unstaged.length) {
      console.error('Unstaged:\n  ' + result.unstaged.join('\n  '));
    }
    if (result.untracked.length) {
      console.error('Untracked:\n  ' + result.untracked.join('\n  '));
    }
    process.exit(1);
  }
  return result.staged;
}

/** Require at least one staged path (for ship/release). */
export function assertHasStagedFiles(staged) {
  if (!staged || !staged.length) {
    console.error(
      '\nERROR: git-safety — немає staged-файлів для commit.\n' +
        '  Спочатку:\n' +
        '    npm run map:project-files   # якщо змінювалась структура\n' +
        '    git add path/to/file1 path/to/file2\n' +
        '  Потім ship/release.\n',
    );
    process.exit(1);
  }
}

export function currentBranch(cwd = process.cwd()) {
  return capture('git', ['branch', '--show-current'], cwd);
}

export function checkMainForGasDeploy(branch, flagName = '--with-gas') {
  if (branch !== 'main') {
    return {
      ok: false,
      message:
        `\nERROR: git-safety — production GAS deploy дозволений лише з main.\n` +
        `  Поточна гілка: ${branch || '(detached)'}\n` +
        `  Приберіть ${flagName} або перейдіть на main після merge PR.\n`,
    };
  }
  return { ok: true };
}

export function assertMainForGasDeploy(branch, flagName = '--with-gas') {
  const result = checkMainForGasDeploy(branch, flagName);
  if (!result.ok) {
    console.error(result.message);
    process.exit(1);
  }
}

/**
 * Split argv into { message, flags }.
 * Unknown tokens starting with "-" fail (do not silently treat as message).
 */
export function parseMessageAndFlags(argv, knownFlags = []) {
  const known = new Set(knownFlags);
  const flags = new Set();
  const parts = [];
  const unknown = [];
  for (const a of argv) {
    if (a === '--') continue;
    if (a.startsWith('-')) {
      if (known.has(a)) flags.add(a);
      else unknown.push(a);
      continue;
    }
    parts.push(a);
  }
  return {
    message: parts.join(' ').trim(),
    flags,
    unknownFlags: unknown,
  };
}

export function assertNoUnknownFlags(unknownFlags) {
  if (unknownFlags && unknownFlags.length) {
    console.error(
      '\nERROR: git-safety — невідомі параметри командного рядка:\n  ' +
        unknownFlags.join('\n  ') +
        '\n',
    );
    process.exit(1);
  }
}

/**
 * Preflight for ship/release: message, flags, staged-only tree, optional main for GAS.
 * Must run before npm ci / git commit / git push / clasp.
 */
export function assertShipReleasePreflight(options) {
  const {
    message,
    flags,
    unknownFlags,
    porcelain,
    branch,
    deployGasFlag = '--deploy-gas',
  } = options;

  assertNoUnknownFlags(unknownFlags);

  if (!message || message === 'fix:') {
    console.error('\nERROR: commit message is required.');
    console.error('Example: npm run ship -- "fix: update ops commands"');
    console.error(`Optional production GAS (main only): … ${deployGasFlag}`);
    console.error(
      'Prepare first: npm run map:project-files (if needed) → git add … → then ship/release',
    );
    process.exit(1);
  }

  if (flags.has(deployGasFlag)) {
    assertMainForGasDeploy(branch, deployGasFlag);
  }

  const staged = assertSafeToCommitStagedOnly(porcelain);
  assertHasStagedFiles(staged);
  return staged;
}

/**
 * After CI: tree must still be staged-only with no new dirt from the check run.
 */
export function assertTreeStillSafeForGh(porcelain) {
  const staged = assertSafeToCommitStagedOnly(porcelain);
  assertHasStagedFiles(staged);
  return staged;
}

function runSelfTest() {
  // classify / evaluate
  assert.deepEqual(classifyPorcelain(''), {
    staged: [],
    unstaged: [],
    untracked: [],
  });
  assert.deepEqual(classifyPorcelain('M  a.js\n M b.js\n?? c.js'), {
    staged: ['a.js'],
    unstaged: ['b.js'],
    untracked: ['c.js'],
  });
  // Leading space on first porcelain line must survive capture() (no String#trim).
  assert.deepEqual(classifyPorcelain(' M only-unstaged.js'), {
    staged: [],
    unstaged: ['only-unstaged.js'],
    untracked: [],
  });
  assert.equal(evaluateStagedOnlyCommit(' M only-unstaged.js').ok, false);
  assert.deepEqual(evaluateStagedOnlyCommit(' M only-unstaged.js').unstaged, [
    'only-unstaged.js',
  ]);
  {
    const simulated = ' M first.js\nM  second.js\n';
    const preserved = simulated.replace(/\r?\n$/, '');
    assert.equal(preserved.startsWith(' '), true, 'capture must keep leading space');
    assert.deepEqual(classifyPorcelain(preserved), {
      staged: ['second.js'],
      unstaged: ['first.js'],
      untracked: [],
    });
  }
  assert.equal(evaluateStagedOnlyCommit('').ok, true);
  assert.equal(evaluateStagedOnlyCommit('').staged.length, 0);
  assert.equal(evaluateStagedOnlyCommit('M  a.js').ok, true);
  assert.equal(evaluateStagedOnlyCommit(' M a.js').ok, false);
  assert.equal(evaluateStagedOnlyCommit('?? a.js').ok, false);
  assert.equal(evaluateStagedOnlyCommit('MM a.js').ok, false);

  // main gate
  assert.equal(checkMainForGasDeploy('main', '--deploy-gas').ok, true);
  assert.equal(checkMainForGasDeploy('fix/x', '--deploy-gas').ok, false);
  assert.equal(checkMainForGasDeploy('', '--with-gas').ok, false);

  // flags
  const parsed = parseMessageAndFlags(
    ['fix: hello', '--deploy-gas'],
    ['--deploy-gas'],
  );
  assert.equal(parsed.message, 'fix: hello');
  assert.equal(parsed.flags.has('--deploy-gas'), true);
  assert.deepEqual(parsed.unknownFlags, []);

  const bad = parseMessageAndFlags(['fix: x', '--with-gas'], ['--deploy-gas']);
  assert.deepEqual(bad.unknownFlags, ['--with-gas']);

  const dashMsg = parseMessageAndFlags(['--deploy-gas'], ['--deploy-gas']);
  assert.equal(dashMsg.message, '');
  assert.equal(dashMsg.flags.has('--deploy-gas'), true);

  // Exit-path smoke via child process (preflight must fail before any mutation).
  const selfDir = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(selfDir, '..', '..');

  const failBranch2 = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
      import { assertShipReleasePreflight } from ${JSON.stringify(
        path.join(selfDir, 'git-ops-guards.mjs'),
      )};
      assertShipReleasePreflight({
        message: 'fix: x',
        flags: new Set(['--deploy-gas']),
        unknownFlags: [],
        porcelain: 'M  a.js',
        branch: 'fix/feature',
        deployGasFlag: '--deploy-gas',
      });
      `,
    ],
    { cwd: root, encoding: 'utf8' },
  );
  assert.notEqual(failBranch2.status, 0, 'deploy-gas on non-main must exit non-zero');
  assert.match(failBranch2.stderr || '', /лише з main|main/);

  const failDirty = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
      import { assertShipReleasePreflight } from ${JSON.stringify(
        path.join(selfDir, 'git-ops-guards.mjs'),
      )};
      assertShipReleasePreflight({
        message: 'fix: x',
        flags: new Set(),
        unknownFlags: [],
        porcelain: 'M  a.js\\n M b.js',
        branch: 'main',
        deployGasFlag: '--deploy-gas',
      });
      `,
    ],
    { cwd: root, encoding: 'utf8' },
  );
  assert.notEqual(failDirty.status, 0, 'unstaged leftovers must fail');

  const failEmpty = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
      import { assertShipReleasePreflight } from ${JSON.stringify(
        path.join(selfDir, 'git-ops-guards.mjs'),
      )};
      assertShipReleasePreflight({
        message: 'fix: x',
        flags: new Set(),
        unknownFlags: [],
        porcelain: '',
        branch: 'main',
        deployGasFlag: '--deploy-gas',
      });
      `,
    ],
    { cwd: root, encoding: 'utf8' },
  );
  assert.notEqual(failEmpty.status, 0, 'clean tree with no staged must fail ship preflight');

  const failUnknown = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
      import { assertShipReleasePreflight } from ${JSON.stringify(
        path.join(selfDir, 'git-ops-guards.mjs'),
      )};
      assertShipReleasePreflight({
        message: 'fix: x',
        flags: new Set(),
        unknownFlags: ['--nope'],
        porcelain: 'M  a.js',
        branch: 'main',
        deployGasFlag: '--deploy-gas',
      });
      `,
    ],
    { cwd: root, encoding: 'utf8' },
  );
  assert.notEqual(failUnknown.status, 0, 'unknown flags must fail');

  const okPre = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
      import { assertShipReleasePreflight } from ${JSON.stringify(
        path.join(selfDir, 'git-ops-guards.mjs'),
      )};
      assertShipReleasePreflight({
        message: 'fix: x',
        flags: new Set(['--deploy-gas']),
        unknownFlags: [],
        porcelain: 'M  a.js',
        branch: 'main',
        deployGasFlag: '--deploy-gas',
      });
      console.log('preflight-ok');
      `,
    ],
    { cwd: root, encoding: 'utf8' },
  );
  assert.equal(okPre.status, 0, okPre.stderr);
  assert.match(okPre.stdout || '', /preflight-ok/);

  console.log('git-ops-guards: OK (self-test)');
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun && process.argv.includes('--self-test')) {
  runSelfTest();
}

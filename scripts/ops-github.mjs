#!/usr/bin/env node
/**
 * Commit staged-only changes (never git add -A) and push to origin.
 *
 *   npm run gh -- "fix: message"
 *
 * Requires: files already staged; no unstaged/untracked leftovers.
 * See .cursor/rules/git-safety.mdc §5 / §13.
 */
import {
  assertNoUnknownFlags,
  assertSafeToCommitStagedOnly,
  capture,
  parseMessageAndFlags,
  run,
} from './lib/git-ops-guards.mjs';

const { message: msg, unknownFlags } = parseMessageAndFlags(
  process.argv.slice(2),
  [],
);
assertNoUnknownFlags(unknownFlags);

run('git', ['status', '--short']);

const porcelain = capture('git', ['status', '--porcelain']);
const staged = assertSafeToCommitStagedOnly(porcelain);

if (staged.length) {
  if (!msg || msg === 'fix:') {
    console.error('\nERROR: commit message is required.');
    console.error('Example: npm run gh -- "fix: update ops scripts"');
    console.error('Stage files first: git add path/to/file1 path/to/file2');
    process.exit(1);
  }
  run('git', ['commit', '-m', msg]);
} else {
  console.log(
    '\nGit: nothing staged to commit (working tree clean or already committed).',
  );
}

const branch = capture('git', ['rev-parse', '--abbrev-ref', 'HEAD']);

try {
  capture('git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
  run('git', ['push']);
} catch {
  run('git', ['push', '-u', 'origin', branch]);
}

console.log('\nGitHub: push completed');

#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

function run(cmd, args = []) {
  console.log(`\n$ ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: false });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const msg = process.argv.slice(2).join(' ').trim();

if (!msg || msg === 'fix:') {
  console.error('\nERROR: commit message is required.');
  console.error('Example: npm run ship -- "fix: update ops commands"');
  process.exit(1);
}

run('npm', ['run', 'c']);
run('npm', ['run', 'gas']);
run('npm', ['run', 'gh', '--', msg]);

console.log('\nShip: completed');

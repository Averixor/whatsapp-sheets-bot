#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

function run(cmd, args = []) {
  console.log(`\n$ ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: false });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

function soft(cmd, args = []) {
  console.log(`\n$ ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: false });
  if (r.status !== 0) {
    console.warn(`\nWARN: optional command failed: ${cmd} ${args.join(' ')}`);
  }
}

if (!existsSync('.clasp.json')) {
  console.error('ERROR: .clasp.json not found. Run this from the project root.');
  process.exit(1);
}

run('node', ['scripts/verify-node-version.mjs']);
run('npx', ['clasp', 'status']);
run('npx', ['clasp', 'push']);

soft('npx', ['clasp', 'run', 'apiStage7ClearPhoneCache']);

console.log('\nGAS: push completed');

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
    console.warn(`\nWARN: команда не выполнена, но deploy GAS уже сделан: ${cmd} ${args.join(' ')}`);
  }
}

if (!existsSync('.clasp.json')) {
  console.error('ERROR: нет .clasp.json. Запусти это из корня проекта whatsapp-sheets-bot.');
  process.exit(1);
}

run('node', ['scripts/verify-node-version.mjs']);
run('npx', ['clasp', 'status']);
run('npx', ['clasp', 'push']);

// Не валим весь deploy, если функция недоступна через clasp run.
soft('npx', ['clasp', 'run', 'apiStage7ClearPhoneCache']);

console.log('\nGAS: OK');

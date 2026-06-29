#!/usr/bin/env node
import { spawnSync, execSync } from 'node:child_process';

function run(cmd, args = []) {
  console.log(`\n$ ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: false });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

function out(cmd) {
  return execSync(cmd, { encoding: 'utf8' }).trim();
}

const msg = process.argv.slice(2).join(' ').trim();

run('git', ['status', '--short']);

const changed = out('git status --short');

if (changed) {
  if (!msg) {
    console.error('\nERROR: есть изменения, нужен текст коммита.');
    console.error('Пример: npm run gh -- "fix: update send panel"');
    process.exit(1);
  }

  run('git', ['add', '-A']);
  run('git', ['commit', '-m', msg]);
} else {
  console.log('\nGit: нет новых изменений для коммита.');
}

const branch = out('git rev-parse --abbrev-ref HEAD');

try {
  out(`git rev-parse --abbrev-ref --symbolic-full-name @{u}`);
  run('git', ['push']);
} catch {
  run('git', ['push', '-u', 'origin', branch]);
}

console.log('\nGitHub: OK');

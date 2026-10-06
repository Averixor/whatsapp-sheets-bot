#!/usr/bin/env node
/**
 * npm script-shell: знімає Cursor/VS Code js-debug з NODE_OPTIONS перед
 * виконанням тіла `npm run` (інакше «Debugger attached» на кожному node).
 *
 * npm викликає: script-shell -c "<command>"
 * (.npmrc → script-shell=./scripts/npm-script-shell.mjs)
 */

import { spawnSync } from 'node:child_process';

const env = { ...process.env };
delete env.NODE_OPTIONS;
delete env.VSCODE_INSPECTOR_OPTIONS;

const cIdx = process.argv.indexOf('-c');
const command = cIdx >= 0 ? process.argv[cIdx + 1] : null;
if (!command) {
  console.error('Usage: npm-script-shell.mjs -c <command>');
  process.exit(2);
}

const result = spawnSync(command, {
  stdio: 'inherit',
  env,
  shell: true,
});

if (result.error) {
  console.error(`[npm-script-shell] ${result.error.message}`);
  process.exit(1);
}
if (result.signal) {
  process.kill(process.pid, result.signal);
} else {
  process.exit(result.status ?? 1);
}

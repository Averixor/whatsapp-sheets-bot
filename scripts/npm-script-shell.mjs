#!/usr/bin/env node
/**
 * npm script-shell: знімає Cursor/VS Code js-debug з NODE_OPTIONS перед
 * виконанням тіла `npm run` (інакше «Debugger attached» на кожному node).
 *
 * npm викликає: script-shell -c "<command>"
 * (.npmrc → script-shell=./scripts/npm-script-shell.mjs)
 *
 * На Windows js-debug bootloader часто патчить child_process.spawn і знову
 * підставляє NODE_OPTIONS у env дочірнього процесу. Тому змінні чистимо
 * ще й всередині cmd.exe (після інʼєкції хука).
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

const result =
  process.platform === 'win32'
    ? spawnSync(
        process.env.ComSpec || 'cmd.exe',
        [
          '/d',
          '/s',
          '/c',
          // Clear after js-debug spawn hooks may re-inject into `env`.
          `set "NODE_OPTIONS="&& set "VSCODE_INSPECTOR_OPTIONS="&& ${command}`,
        ],
        {
          stdio: 'inherit',
          env,
          shell: false,
          windowsVerbatimArguments: true,
        },
      )
    : spawnSync(command, {
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

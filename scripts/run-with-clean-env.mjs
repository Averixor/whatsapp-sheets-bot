#!/usr/bin/env node
/**
 * Кросплатформна заміна:
 *   env -u NODE_OPTIONS -u VSCODE_INSPECTOR_OPTIONS <cmd>
 *
 * Знімає хуки відладчика Cursor/VS Code (NODE_OPTIONS / VSCODE_INSPECTOR_OPTIONS),
 * які дають «Debugger attached» / «Waiting for the debugger to disconnect…»
 * і ламають clasp.
 *
 * Використання:
 *   node scripts/run-with-clean-env.mjs <script.mjs> [args...]
 *   node scripts/run-with-clean-env.mjs -- <command> [args...]
 */

import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error(
    'Usage:\n' +
      '  node scripts/run-with-clean-env.mjs <script.mjs> [args...]\n' +
      '  node scripts/run-with-clean-env.mjs -- <command> [args...]',
  );
  process.exit(2);
}

const env = { ...process.env };
delete env.NODE_OPTIONS;
delete env.VSCODE_INSPECTOR_OPTIONS;

let cmd;
let cmdArgs;
if (args[0] === '--') {
  if (args.length < 2) {
    console.error('[run-with-clean-env] missing command after --');
    process.exit(2);
  }
  cmd = args[1];
  cmdArgs = args.slice(2);
} else {
  cmd = process.execPath;
  cmdArgs = args;
}

const child = spawn(cmd, cmdArgs, {
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32',
});

child.on('error', (err) => {
  console.error(`[run-with-clean-env] ${err.message}`);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 1);
  }
});

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
 *
 * Windows: js-debug може знову підставити NODE_OPTIONS у spawn env —
 * тому запуск іде через cmd.exe з `set "NODE_OPTIONS="` у командному рядку.
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
delete env.VSCODE_NODE_OPTIONS;
// Cursor sandbox sets npm_config_script_shell=cmd.exe and overrides .npmrc.
delete env.npm_config_script_shell;
delete env.npm_config_devdir;

function resolveCommand_(command) {
  if (command === 'node') return process.execPath;
  if (process.platform !== 'win32') return command;
  // PowerShell resolves bare `npm` to npm.ps1 (often blocked by ExecutionPolicy).
  // Prefer npm.cmd / npx.cmd so nested scripts keep running.
  if (command === 'npm' || command === 'npx') return command + '.cmd';
  return command;
}

function quoteCmdArg_(arg) {
  const s = String(arg);
  if (s.length === 0) return '""';
  if (!/[\s"]/u.test(s)) return s;
  return `"${s.replace(/"/gu, '""')}"`;
}

let cmd;
let cmdArgs;
if (args[0] === '--') {
  if (args.length < 2) {
    console.error('[run-with-clean-env] missing command after --');
    process.exit(2);
  }
  cmd = resolveCommand_(args[1]);
  cmdArgs = args.slice(2);
} else {
  cmd = process.execPath;
  cmdArgs = args;
}

let child;
if (process.platform === 'win32') {
  const inner = [cmd, ...cmdArgs].map(quoteCmdArg_).join(' ');
  const wrapped = `set "NODE_OPTIONS="&& set "VSCODE_INSPECTOR_OPTIONS="&& ${inner}`;
  child = spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', wrapped], {
    stdio: 'inherit',
    env,
    shell: false,
    windowsVerbatimArguments: true,
  });
} else {
  child = spawn(cmd, cmdArgs, {
    stdio: 'inherit',
    env,
    shell: false,
  });
}

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

#!/usr/bin/env node
/**
 * Точка входу `npm run ci`.
 * На Windows знімає Cursor js-debug / sandbox npm_config_* через cmd.exe
 * до запуску ланцюга (інакше NODE_OPTIONS / битий script-shell глушать CI).
 */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const self = fileURLToPath(import.meta.url);

function quoteCmdArg_(arg) {
  const s = String(arg);
  if (s.length === 0) return '""';
  if (!/[\s"]/u.test(s)) return s;
  return `"${s.replace(/"/gu, '""')}"`;
}

function cleanEnv_(base) {
  const env = { ...base, WASB_CI_CLEAN: '1' };
  delete env.NODE_OPTIONS;
  delete env.VSCODE_INSPECTOR_OPTIONS;
  delete env.VSCODE_NODE_OPTIONS;
  // Cursor sandbox overrides .npmrc; leave default shell for nested npm.
  delete env.npm_config_script_shell;
  delete env.npm_config_devdir;
  return env;
}

function runChain_(env) {
  if (process.platform === 'win32') {
    const npmCmd = 'npm.cmd';
    const wrapped =
      'set "NODE_OPTIONS="&& set "VSCODE_INSPECTOR_OPTIONS="&& set "npm_config_script_shell="&& ' +
      `${npmCmd} run ci:chain`;
    return spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', wrapped], {
      stdio: 'inherit',
      env,
      shell: false,
      windowsVerbatimArguments: true,
    });
  }
  return spawnSync('npm', ['run', 'ci:chain'], {
    stdio: 'inherit',
    env,
    shell: true,
  });
}

const alreadyClean = process.env.WASB_CI_CLEAN === '1';
const needsWinEscape =
  process.platform === 'win32' &&
  !alreadyClean &&
  Boolean(
    process.env.NODE_OPTIONS ||
      process.env.VSCODE_INSPECTOR_OPTIONS ||
      process.env.npm_config_script_shell,
  );

if (needsWinEscape) {
  const env = cleanEnv_(process.env);
  const wrapped =
    'set "NODE_OPTIONS="&& set "VSCODE_INSPECTOR_OPTIONS="&& set "npm_config_script_shell="&& set "WASB_CI_CLEAN=1"&& ' +
    `${quoteCmdArg_(process.execPath)} ${quoteCmdArg_(self)}`;
  const reexec = spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', wrapped], {
    stdio: 'inherit',
    env,
    shell: false,
    windowsVerbatimArguments: true,
  });
  if (reexec.error) {
    console.error(`[run-ci] ${reexec.error.message}`);
    process.exit(1);
  }
  process.exit(reexec.status ?? 1);
}

const result = runChain_(cleanEnv_(process.env));
if (result.error) {
  console.error(`[run-ci] ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);

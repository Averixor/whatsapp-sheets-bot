#!/usr/bin/env node
/**
 * One-shot local clasp bind for production.
 *
 *   npm run gas:setup
 *   npm run gas:setup -- <scriptId> [parentSpreadsheetId]
 *
 * Env (optional): WASB_CLASP_SCRIPT_ID, WASB_CLASP_PARENT_ID
 *
 * Creates .clasp.json from .clasp.example.json if missing, fills IDs,
 * runs `clasp login` when ~/.clasprc.json is absent, then `clasp status`.
 */

import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const PLACEHOLDER_SCRIPT_ID = 'PUT_PRODUCTION_SCRIPT_ID_HERE';
const PLACEHOLDER_PARENT_ID = 'PUT_PARENT_DRIVE_FOLDER_ID_HERE';
const EXAMPLE = '.clasp.example.json';
const TARGET = '.clasp.json';

function childEnv() {
  const env = { ...process.env };
  delete env.NODE_OPTIONS;
  delete env.VSCODE_INSPECTOR_OPTIONS;
  delete env.npm_config_script_shell;
  return env;
}

function resolveBin_(cmd) {
  if (process.platform === 'win32' && (cmd === 'npx' || cmd === 'npm')) {
    return `${cmd}.cmd`;
  }
  return cmd;
}

function run(cmd, args) {
  const bin = resolveBin_(cmd);
  console.log(`\n$ ${bin} ${args.join(' ')}`);
  return spawnSync(bin, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32' && /\.cmd$/i.test(bin),
    env: childEnv(),
  });
}

function clasprcPath() {
  return path.join(homedir(), '.clasprc.json');
}

function maskId(id) {
  const s = String(id || '');
  if (s.length <= 10) return '(short)';
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

function loadJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function writeClasp(config) {
  writeFileSync(TARGET, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

function printScriptIdHelp_() {
  console.error(
    'ERROR: production scriptId is missing.\n' +
      '  1) Open https://script.google.com → your WASB project\n' +
      '  2) URL …/projects/<scriptId>/edit — copy <scriptId>\n' +
      '  3) Run:\n' +
      '       npm run gas:setup -- <scriptId>\n' +
      '     or set WASB_CLASP_SCRIPT_ID and re-run npm run gas:setup\n' +
      '  Optional parent (bound spreadsheet id):\n' +
      '       npm run gas:setup -- <scriptId> <spreadsheetId>',
  );
}

function applyIds(config, scriptId, parentId) {
  const next = { ...config, rootDir: config.rootDir || '.' };
  next.scriptId = scriptId;
  if (parentId) {
    next.parentId = [parentId];
  } else if (Array.isArray(next.parentId)) {
    next.parentId = next.parentId.filter(
      (id) => String(id || '').trim() !== PLACEHOLDER_PARENT_ID,
    );
    if (next.parentId.length === 0) delete next.parentId;
  } else if (String(next.parentId || '').trim() === PLACEHOLDER_PARENT_ID) {
    delete next.parentId;
  }
  return next;
}

function main() {
  const argScript = String(process.argv[2] || '').trim();
  const argParent = String(process.argv[3] || '').trim();
  const envScript = String(process.env.WASB_CLASP_SCRIPT_ID || '').trim();
  const envParent = String(process.env.WASB_CLASP_PARENT_ID || '').trim();

  if (!existsSync(EXAMPLE)) {
    console.error(`ERROR: missing ${EXAMPLE}`);
    process.exit(1);
  }

  const existing = existsSync(TARGET) ? loadJson(TARGET) : loadJson(EXAMPLE);
  const scriptId =
    argScript || envScript || String(existing.scriptId || '').trim();
  const parentId = argParent || envParent || '';

  if (!scriptId || scriptId === PLACEHOLDER_SCRIPT_ID) {
    printScriptIdHelp_();
    process.exit(1);
  }

  if (!existsSync(TARGET)) {
    copyFileSync(EXAMPLE, TARGET);
    console.log(`Created ${TARGET} from ${EXAMPLE}`);
  }

  const config = applyIds(loadJson(TARGET), scriptId, parentId || undefined);
  writeClasp(config);
  console.log(
    `OK: ${TARGET} scriptId=${maskId(config.scriptId)}` +
      (config.parentId ? ` parentId=${maskId(config.parentId[0])}` : ''),
  );

  const claspPkg = '@google/clasp@3.3.0';
  if (!existsSync(clasprcPath())) {
    console.log(
      '\nNo ~/.clasprc.json — starting clasp login.\n' +
        '  Browser opens Google OAuth; finish sign-in, then return here.',
    );
    const login = run('npx', ['--yes', claspPkg, 'login']);
    if (login.status !== 0) {
      console.error(
        'ERROR: clasp login failed.\n' +
          '  Retry in this terminal (complete the browser prompt):\n' +
          '    npx --yes @google/clasp@3.3.0 login\n' +
          '  Then: npm run gas:setup -- <yourRealScriptId>',
      );
      process.exit(login.status ?? 1);
    }
  } else {
    console.log('OK: ~/.clasprc.json present');
  }

  const status = run('npx', ['--yes', claspPkg, 'status']);
  if (status.status !== 0) {
    console.error(
      'ERROR: clasp status failed — use the REAL scriptId from script.google.com\n' +
        '  (not a placeholder example). Then: npm run gas:setup -- <yourRealScriptId>',
    );
    process.exit(status.status ?? 1);
  }

  console.log(`
Next:
  npm run ready          # ci + gas:status
  npm run gas:push       # production deploy
  # then in GAS editor: apiStage7ClearPhoneCache()
`);
}

main();

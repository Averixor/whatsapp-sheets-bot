#!/usr/bin/env node
/**
 * Local GAS helper. Default action is push (with Node version gate).
 *
 *   npm run gas              → clasp push
 *   npm run gas -- status    → clasp status
 *   npm run gas -- pull|open → clasp pull | open-script
 *
 * Prefer the explicit aliases: npm run gas:status | gas:push | gas:pull | gas:open
 * (npm run gas status is NOT a separate script — npm treats "status" as an arg to "gas".)
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const PLACEHOLDER_SCRIPT_ID = 'PUT_PRODUCTION_SCRIPT_ID_HERE';
const PLACEHOLDER_PARENT_ID = 'PUT_PARENT_DRIVE_FOLDER_ID_HERE';

/** Drop Cursor/VS Code js-debug auto-attach so clasp is not paused by a debugger. */
function childEnv() {
  const env = { ...process.env };
  delete env.NODE_OPTIONS;
  delete env.VSCODE_INSPECTOR_OPTIONS;
  return env;
}

function run(cmd, args = []) {
  console.log(`\n$ ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: false,
    env: childEnv(),
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

function assertProductionClaspConfig_() {
  if (!existsSync('.clasp.json')) {
    console.error(
      'ERROR: .clasp.json not found. Copy .clasp.example.json → .clasp.json and fill scriptId.',
    );
    process.exit(1);
  }

  let claspConfig;
  try {
    claspConfig = JSON.parse(readFileSync('.clasp.json', 'utf8'));
  } catch (err) {
    console.error(
      `ERROR: .clasp.json is not valid JSON: ${err && err.message ? err.message : err}`,
    );
    process.exit(1);
  }

  const scriptId = String(claspConfig.scriptId || '').trim();
  if (!scriptId || scriptId === PLACEHOLDER_SCRIPT_ID) {
    console.error(
      'ERROR: production scriptId is not configured.\n' +
        '  Copy .clasp.example.json → .clasp.json and set real Apps Script scriptId\n' +
        '  (from script.google.com/…/projects/<scriptId>/edit). Do not commit .clasp.json.',
    );
    process.exit(1);
  }

  const parentIds = Array.isArray(claspConfig.parentId)
    ? claspConfig.parentId
    : claspConfig.parentId
      ? [claspConfig.parentId]
      : [];
  const hasPlaceholderParent = parentIds.some(
    (id) => String(id || '').trim() === PLACEHOLDER_PARENT_ID,
  );
  if (hasPlaceholderParent) {
    console.error(
      'ERROR: production parentId still has placeholder.\n' +
        '  Set parentId to the bound spreadsheet id (or remove the placeholder entry).',
    );
    process.exit(1);
  }
}

const action = String(process.argv[2] || 'push').toLowerCase();
const claspArgsByAction = {
  status: ['status'],
  pull: ['pull'],
  push: ['push'],
  open: ['open-script'],
};

const claspArgs = claspArgsByAction[action];
if (!claspArgs) {
  console.error(
    `ERROR: unknown gas action "${action}". Use: status | pull | push | open`,
  );
  process.exit(1);
}

assertProductionClaspConfig_();

if (action === 'push') {
  run('node', ['scripts/verify-node-version.mjs']);
}

run('npx', ['clasp', ...claspArgs]);

if (action === 'push') {
  console.log('\nGAS: push completed');
}

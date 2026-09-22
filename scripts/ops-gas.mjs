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
import { existsSync } from 'node:fs';

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

if (!existsSync('.clasp.json')) {
  console.error(
    'ERROR: .clasp.json not found. Copy .clasp.example.json → .clasp.json and fill scriptId.',
  );
  process.exit(1);
}

if (action === 'push') {
  run('node', ['scripts/verify-node-version.mjs']);
}

run('npx', ['clasp', ...claspArgs]);

if (action === 'push') {
  console.log('\nGAS: push completed');
}

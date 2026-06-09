#!/usr/bin/env node
/**
 * Stage the GAS source for a separate smoke Apps Script project.
 * Production always pushes appsscript.json (executionApi: MYSELF).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { repoRoot } from './lib/load-contract.mjs';

const smokeRoot = path.join(os.tmpdir(), 'wasb-smoke-bundle');
const sourceFiles = fs
  .readdirSync(repoRoot, { withFileTypes: true })
  .filter(
    (entry) =>
      entry.isFile() &&
      (entry.name.endsWith('.gs') || entry.name.endsWith('.html')),
  )
  .map((entry) => entry.name)
  .sort();

fs.rmSync(smokeRoot, { recursive: true, force: true });
fs.mkdirSync(smokeRoot, { recursive: true });

for (const name of sourceFiles) {
  fs.copyFileSync(path.join(repoRoot, name), path.join(smokeRoot, name));
}
fs.copyFileSync(
  path.join(repoRoot, 'appsscript.smoke.json'),
  path.join(smokeRoot, 'appsscript.json'),
);

console.log(`prepare-smoke-bundle: staged ${sourceFiles.length} GAS files in ${smokeRoot}`);

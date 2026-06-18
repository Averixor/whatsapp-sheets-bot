#!/usr/bin/env node
/**
 * Stage the GAS source for a separate smoke Apps Script project.
 * Production always pushes appsscript.json (executionApi: MYSELF).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { walkGasFiles, walkHtmlFiles } from './lib/gas-files.mjs';
import { repoRoot } from './lib/load-contract.mjs';

const smokeRoot = path.join(os.tmpdir(), 'wasb-smoke-bundle');
const sourceFiles = [...walkGasFiles(repoRoot), ...walkHtmlFiles(repoRoot)].sort();

fs.rmSync(smokeRoot, { recursive: true, force: true });
fs.mkdirSync(smokeRoot, { recursive: true });

for (const rel of sourceFiles) {
  const dest = path.join(smokeRoot, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(repoRoot, rel), dest);
}
fs.copyFileSync(
  path.join(repoRoot, 'appsscript.smoke.json'),
  path.join(smokeRoot, 'appsscript.json'),
);

console.log(`prepare-smoke-bundle: staged ${sourceFiles.length} GAS files in ${smokeRoot}`);

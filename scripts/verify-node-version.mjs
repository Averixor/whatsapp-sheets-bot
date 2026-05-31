#!/usr/bin/env node
/**
 * Enforce Node.js major version for local/CI (package.json engines.node).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
const enginesNode = String(pkg.engines?.node || '>=24 <25');

const major = Number(process.versions.node.split('.')[0] || '0');
const minMatch = enginesNode.match(/>=(\d+)/);
const maxMatch = enginesNode.match(/<(\d+)/);
const minMajor = minMatch ? Number(minMatch[1]) : 24;
const maxMajor = maxMatch ? Number(maxMatch[1]) : minMajor + 1;

if (!Number.isFinite(major) || major < minMajor || major >= maxMajor) {
  console.error(
    `verify-node-version: FAIL — Node ${process.version} (major ${major}); required ${enginesNode}`,
  );
  const nvmrcPath = path.join(repoRoot, '.nvmrc');
  if (fs.existsSync(nvmrcPath)) {
    console.error(`  hint: nvm use ${fs.readFileSync(nvmrcPath, 'utf8').trim()}`);
  }
  process.exit(1);
}

console.log(`verify-node-version: OK (Node ${process.version}, engines ${enginesNode})`);

#!/usr/bin/env node
/**
 * Enforce Node.js major version for local/CI (package.json engines.node).
 * Minimum: >=N from engines. Upper bound only when engines explicitly has < or <=.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
const enginesNode = String(pkg.engines?.node || '>=24');

const major = Number(process.versions.node.split('.')[0] || '0');
const minMatch = enginesNode.match(/>=(\d+)/);
const maxLtMatch = enginesNode.match(/<(\d+)/);
const maxLteMatch = enginesNode.match(/<=(\d+)/);
const minMajor = minMatch ? Number(minMatch[1]) : 24;

let failReason = '';
if (!Number.isFinite(major) || major < minMajor) {
  failReason = `major ${major} below minimum ${minMajor}`;
} else if (maxLtMatch) {
  const maxExclusive = Number(maxLtMatch[1]);
  if (major >= maxExclusive) {
    failReason = `major ${major} at or above exclusive cap <${maxExclusive}`;
  }
} else if (maxLteMatch) {
  const maxInclusive = Number(maxLteMatch[1]);
  if (major > maxInclusive) {
    failReason = `major ${major} above inclusive cap <=${maxInclusive}`;
  }
}

if (failReason) {
  console.error(
    `verify-node-version: FAIL — Node ${process.version} (${failReason}); required ${enginesNode}`,
  );
  const nvmrcPath = path.join(repoRoot, '.nvmrc');
  if (fs.existsSync(nvmrcPath)) {
    console.error(`  hint: nvm use ${fs.readFileSync(nvmrcPath, 'utf8').trim()}`);
  }
  process.exit(1);
}

console.log(`verify-node-version: OK (Node ${process.version}, engines ${enginesNode})`);

#!/usr/bin/env node
/**
 * Ensure clasp ignore files allow nested .gs/.html (reports/, future folders)
 * and re-exclude dependency/local trees after the recursive allowlist.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { repoRoot } from './lib/load-contract.mjs';
import './verify-inventory-reconciliation.mjs';

const NESTED_INCLUDE_PATTERNS = ['!**/*.gs', '!**/*.html'];

const POST_NESTED_EXCLUDE_PATTERNS = [
  'tests/**',
  'node_modules/**',
  '.git/**',
  '_backup*/**',
];

const TARGETS = [{ file: '.claspignore' }];

function main() {
  const errors = [];
  for (const target of TARGETS) {
    const abs = path.join(repoRoot, target.file);
    if (!fs.existsSync(abs)) {
      errors.push(`missing ${target.file}`);
      continue;
    }
    const lines = fs
      .readFileSync(abs, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim());

    for (const pattern of NESTED_INCLUDE_PATTERNS) {
      if (!lines.some((line) => line === pattern)) {
        errors.push(`${target.file} must include ${pattern} for nested GAS files`);
      }
    }

    const nestedIdx = Math.max(
      ...NESTED_INCLUDE_PATTERNS.map((pattern) => lines.lastIndexOf(pattern)),
    );

    if (nestedIdx === -1) {
      errors.push(`${target.file}: missing nested GAS include patterns`);
      continue;
    }

    for (const pattern of POST_NESTED_EXCLUDE_PATTERNS) {
      const excludeIdx = lines.lastIndexOf(pattern);

      if (excludeIdx === -1) {
        errors.push(
          `${target.file}: must re-exclude ${pattern} after nested GAS includes`,
        );
        continue;
      }

      if (excludeIdx < nestedIdx) {
        errors.push(
          `${target.file}: ${pattern} must appear after nested GAS includes`,
        );
      }
    }
  }

  const clasp = spawnSync('npx', ['clasp', 'status'], {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  const statusOutput = `${clasp.stdout || ''}\n${clasp.stderr || ''}`;
  if (clasp.status === 0) {
    if (/tests[\\/].*\.gs/i.test(statusOutput)) {
      errors.push('clasp status must not track tests/**/*.gs');
    }
    if (!/smoke[\\/]SmokeTests.*\.gs/i.test(statusOutput)) {
      errors.push('clasp status must track smoke/SmokeTests*.gs');
    }
  } else if (!/scriptId|\.clasp\.json|not logged in|credentials|Project settings not found/i.test(statusOutput)) {
    errors.push(`clasp status failed unexpectedly: ${statusOutput.trim()}`);
  }

  if (errors.length) {
    console.error('verify-clasp-push-patterns: FAIL');
    errors.forEach((line) => console.error(`  - ${line}`));
    process.exit(1);
  }

  console.log('verify-clasp-push-patterns: OK');
}

main();

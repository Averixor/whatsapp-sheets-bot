#!/usr/bin/env node
/**
 * Ensure clasp ignore files allow nested .gs/.html (reports/, future folders)
 * and re-exclude dependency/local trees after the recursive allowlist.
 */
import fs from 'node:fs';
import path from 'node:path';
import { repoRoot } from './lib/load-contract.mjs';

const NESTED_INCLUDE_PATTERNS = ['!**/*.gs', '!**/*.html'];

const POST_NESTED_EXCLUDE_PATTERNS = [
  'node_modules/**',
  '.git/**',
  '_backup*/**',
];

const TARGETS = [{ file: '.claspignore' }, { file: '.clasp.smokeignore' }];

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

  if (errors.length) {
    console.error('verify-clasp-push-patterns: FAIL');
    errors.forEach((line) => console.error(`  - ${line}`));
    process.exit(1);
  }

  console.log('verify-clasp-push-patterns: OK');
}

main();

#!/usr/bin/env node
/**
 * Ensure clasp ignore files allow nested .gs/.html (reports/, future folders).
 */
import fs from 'node:fs';
import path from 'node:path';
import { repoRoot } from './lib/load-contract.mjs';

const TARGETS = [
  {
    file: '.claspignore',
    required: ['!**/*.gs', '!**/*.html'],
    afterNested: ['node_modules/**'],
  },
  {
    file: '.clasp.smokeignore',
    required: ['!**/*.gs', '!**/*.html'],
    afterNested: ['node_modules/**'],
  },
];

function main() {
  const errors = [];
  for (const { file, required, afterNested } of TARGETS) {
    const abs = path.join(repoRoot, file);
    if (!fs.existsSync(abs)) {
      errors.push(`missing ${file}`);
      continue;
    }
    const text = fs.readFileSync(abs, 'utf8');
    const lines = text.split(/\r?\n/).map((line) => line.trim());
    for (const pattern of required) {
      if (!lines.some((line) => line === pattern)) {
        errors.push(`${file} must include ${pattern} for nested GAS files`);
      }
    }
    for (const pattern of afterNested || []) {
      const nestedIdx = Math.max(
        lines.lastIndexOf('!**/*.gs'),
        lines.lastIndexOf('!**/*.html'),
      );
      const excludeIdx = lines.lastIndexOf(pattern);
      if (excludeIdx === -1) {
        errors.push(
          `${file} must re-exclude ${pattern} after nested !** patterns`,
        );
        continue;
      }
      if (excludeIdx < nestedIdx) {
        errors.push(
          `${file}: ${pattern} must appear after nested !**/*.gs / !**/*.html`,
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

#!/usr/bin/env node
/**
 * Ensure clasp ignore files allow nested .gs/.html (reports/, future folders).
 */
import fs from 'node:fs';
import path from 'node:path';
import { repoRoot } from './lib/load-contract.mjs';

const TARGETS = [
  { file: '.claspignore', required: ['!**/*.gs', '!**/*.html'] },
  { file: '.clasp.smokeignore', required: ['!**/*.gs', '!**/*.html'] },
];

function main() {
  const errors = [];
  for (const { file, required } of TARGETS) {
    const abs = path.join(repoRoot, file);
    if (!fs.existsSync(abs)) {
      errors.push(`missing ${file}`);
      continue;
    }
    const text = fs.readFileSync(abs, 'utf8');
    for (const pattern of required) {
      if (!text.split(/\r?\n/).some((line) => line.trim() === pattern)) {
        errors.push(`${file} must include ${pattern} for nested GAS files`);
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

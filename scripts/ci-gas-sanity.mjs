#!/usr/bin/env node
/**
 * Lightweight checks that run in Node (no GAS runtime).
 */
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');

const BAD_GS_PATTERNS = [
  { re: /\{clasp\s+/, desc: 'stray "clasp" after brace in .gs' },
  { re: /^\s*git add \.\s*$/m, desc: 'raw "git add ." line in .gs' },
];

function walkGsFiles(dir, out = []) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    if (name.name === 'node_modules' || name.name === '.git') continue;
    const p = path.join(dir, name.name);
    if (name.isDirectory()) walkGsFiles(p, out);
    else if (name.name.endsWith('.gs')) out.push(p);
  }
  return out;
}

function main() {
  const gsFiles = walkGsFiles(repoRoot);
  for (const file of gsFiles) {
    const text = fs.readFileSync(file, 'utf8');
    for (const { re, desc } of BAD_GS_PATTERNS) {
      if (re.test(text)) {
        console.error(`ci-gas-sanity: ${desc}\n  file: ${path.relative(repoRoot, file)}`);
        process.exit(1);
      }
    }
  }

  const manifestPath = path.join(repoRoot, 'appsscript.json');
  JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  console.log(`ci-gas-sanity: ok (${gsFiles.length} .gs files)`);
}

main();

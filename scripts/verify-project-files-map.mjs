#!/usr/bin/env node
/**
 * Fail CI when docs/project-files-complete.txt is stale vs the working tree.
 */
import fs from 'node:fs';
import path from 'node:path';
import { repoRoot } from './lib/load-contract.mjs';
import { generateProjectFilesMapText } from './update-project-files-map.mjs';

const MAP_FILE = path.join(repoRoot, 'docs/project-files-complete.txt');

function normalizeMap(text) {
  return String(text || '')
    .replace(/^# Оновлено: .+$/m, '# Оновлено: <timestamp>')
    .replace(/\r\n/g, '\n');
}

function main() {
  if (!fs.existsSync(MAP_FILE)) {
    console.error('verify-project-files-map: FAIL');
    console.error('  missing docs/project-files-complete.txt');
    console.error('  run: npm run map:project-files');
    process.exit(1);
  }

  const onDisk = fs.readFileSync(MAP_FILE, 'utf8');
  const expected = generateProjectFilesMapText();

  if (normalizeMap(onDisk) !== normalizeMap(expected)) {
    console.error('verify-project-files-map: FAIL');
    console.error('  docs/project-files-complete.txt is out of date');
    console.error('  run: npm run map:project-files');
    console.error('  then: git diff -- docs/project-files-complete.txt');
    process.exit(1);
  }

  const countMatch = onDisk.match(/^# Файлів: (\d+)/m);
  const count = countMatch ? countMatch[1] : '?';
  console.log(`verify-project-files-map: OK (${count} files)`);
}

main();

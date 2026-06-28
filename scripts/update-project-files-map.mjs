#!/usr/bin/env node
/**
 * Regenerate docs/project-files-complete.txt — depth-first repository file map.
 * Excludes .git/ and node_modules/.
 */
import fs from 'node:fs';
import path from 'node:path';
import { repoRoot } from './lib/load-contract.mjs';

const MAP_FILE = path.join(repoRoot, 'docs/project-files-complete.txt');
const SKIP_DIRS = new Set(['.git', 'node_modules']);

function labelDir(relDir) {
  if (!relDir || relDir === '.') return '.';
  return relDir.split(path.sep).join('/') + '/';
}

function walkDir(absDir, relDir, sections) {
  const entries = fs.readdirSync(absDir).filter((name) => !SKIP_DIRS.has(name));
  entries.sort((a, b) => a.localeCompare(b, 'en'));

  const files = [];
  const dirs = [];
  for (const name of entries) {
    const abs = path.join(absDir, name);
    const st = fs.statSync(abs);
    if (st.isDirectory()) dirs.push(name);
    else if (st.isFile()) files.push(name);
  }

  if (files.length) {
    const lines = [labelDir(relDir)];
    for (const file of files) lines.push('  ' + file);
    sections.push(lines);
  }

  for (const dir of dirs) {
    walkDir(
      path.join(absDir, dir),
      relDir ? path.join(relDir, dir) : dir,
      sections,
    );
  }
}

export function generateProjectFilesMapText() {
  const sections = [];
  walkDir(repoRoot, '', sections);

  let fileCount = 0;
  for (const section of sections) {
    for (const line of section) {
      if (line.startsWith('  ') && !line.endsWith('/')) fileCount += 1;
    }
  }

  const header = [
    '# WASB — повний список файлів репозиторію',
    '# Порядок: дерево каталогів (depth-first, алфавіт у кожній папці)',
    '# Виключено: .git/, node_modules/',
    `# Файлів: ${fileCount}`,
    `# Оновлено: ${new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')}`,
    '',
  ];

  const body = sections.flatMap((section, index) =>
    index === sections.length - 1 ? section : [...section, ''],
  );

  return header.concat(body).join('\n').replace(/\n{3,}/g, '\n\n') + '\n';
}

export function writeProjectFilesMap(targetPath = MAP_FILE) {
  fs.writeFileSync(targetPath, generateProjectFilesMapText(), 'utf8');
}

function main() {
  writeProjectFilesMap();
  console.log(`update-project-files-map: OK → ${path.relative(repoRoot, MAP_FILE)}`);
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  main();
}

#!/usr/bin/env node
/**
 * Regenerate docs/project-files-complete.txt — depth-first repository file map.
 * Excludes .git/, node_modules/, gitignored paths, and local clasp binding files.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { repoRoot } from './lib/load-contract.mjs';

const MAP_FILE = path.join(repoRoot, 'docs/project-files-complete.txt');
const SKIP_DIRS = new Set(['.git', 'node_modules']);
/** Root-level files that must not appear in the committed map (local secrets / IDE). */
const SKIP_ROOT_FILES = new Set([
  '.clasp.json',
  '.npmrc',
  'Untitled',
]);

export function normalizeForCompare(text) {
  return String(text || '')
    .replace(/^# Оновлено: .*$/m, '# Оновлено: <ignored>')
    .replace(/\r\n/g, '\n');
}

function labelDir(relDir) {
  if (!relDir || relDir === '.') return '.';
  return relDir.split(path.sep).join('/') + '/';
}

function toPosixRel(relPath) {
  return String(relPath || '')
    .split(path.sep)
    .join('/');
}

/** Paths ignored by git (so local IDE/clasp files do not pollute CI map checks). */
function loadGitIgnoredRelPaths() {
  try {
    const out = execFileSync(
      'git',
      ['ls-files', '-z', '-o', '-i', '--exclude-standard'],
      { cwd: repoRoot, encoding: 'buffer' },
    );
    return new Set(
      String(out)
        .split('\0')
        .filter(Boolean)
        .map((p) => toPosixRel(p)),
    );
  } catch {
    return new Set();
  }
}

function walkDir(absDir, relDir, sections, ignoredRelPaths) {
  const entries = fs.readdirSync(absDir).filter((name) => !SKIP_DIRS.has(name));
  entries.sort((a, b) => a.localeCompare(b, 'en'));

  const files = [];
  const dirs = [];
  for (const name of entries) {
    const abs = path.join(absDir, name);
    const st = fs.statSync(abs);
    if (st.isDirectory()) dirs.push(name);
    else if (st.isFile()) {
      if (relDir === '' && SKIP_ROOT_FILES.has(name)) continue;
      const relPosix = toPosixRel(relDir ? path.join(relDir, name) : name);
      if (ignoredRelPaths.has(relPosix)) continue;
      files.push(name);
    }
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
      ignoredRelPaths,
    );
  }
}

export function generateProjectFilesMapText() {
  const sections = [];
  walkDir(repoRoot, '', sections, loadGitIgnoredRelPaths());

  let fileCount = 0;
  for (const section of sections) {
    for (const line of section) {
      if (line.startsWith('  ') && !line.endsWith('/')) fileCount += 1;
    }
  }

  const header = [
    '# WASB — повний список файлів репозиторію',
    '# Порядок: дерево каталогів (depth-first, алфавіт у кожній папці)',
    '# Виключено: .git/, node_modules/, локальні .clasp*.json (крім *.example.json)',
    `# Файлів: ${fileCount}`,
    `# Оновлено: ${new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')}`,
    '',
  ];

  const body = sections.flatMap((section, index) =>
    index === sections.length - 1 ? section : [...section, ''],
  );

  return header.concat(body).join('\n').replace(/\n{3,}/g, '\n\n') + '\n';
}

/**
 * @returns {'written' | 'unchanged'}
 */
export function writeProjectFilesMap(targetPath = MAP_FILE) {
  const outPath = targetPath;
  const nextContent = generateProjectFilesMapText();
  const current = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf8') : '';

  if (normalizeForCompare(current) === normalizeForCompare(nextContent)) {
    return 'unchanged';
  }

  fs.writeFileSync(outPath, nextContent, 'utf8');
  return 'written';
}

function main() {
  const rel = path.relative(repoRoot, MAP_FILE);
  const result = writeProjectFilesMap();
  if (result === 'unchanged') {
    console.log(`update-project-files-map: OK → ${rel} already up to date`);
    return;
  }
  console.log(`update-project-files-map: OK → ${rel}`);
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  main();
}

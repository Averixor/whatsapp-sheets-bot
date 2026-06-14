#!/usr/bin/env node
/**
 * Fails CI when Russian-language markers appear in user/dev-facing project text.
 * Ukrainian and English are expected; Russian Cyrillic markers are not.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const allowlistPath = path.join(
  repoRoot,
  "scripts/allowed-russian-strings.json",
);
const allowlist = JSON.parse(fs.readFileSync(allowlistPath, "utf8"));

const SCAN_EXTENSIONS = new Set([
  ".gs",
  ".html",
  ".mjs",
  ".js",
  ".md",
  ".json",
]);
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".venv_xlsx",
  "contracts",
  "dist",
  "coverage",
]);
const SKIP_FILES = new Set([
  "package-lock.json",
  "allowed-russian-strings.json",
  "verify-no-russian-text.mjs",
]);

/** Letters that are strong Russian-only Cyrillic markers. */
const RUSSIAN_LETTER_RE = /[ыэёъ]/iu;

/** Common Russian roots in UI/comments (avoid Ukrainian false positives like "даних"). */
const RUSSIAN_ROOT_RES = [
  /откры/u,
  /обнов/u,
  /ошиб/u,
  /загруз/u,
  /пользовател/u,
  /примен/u,
  /выполн/u,
  /невозмож/u,
  /нажмите/u,
  /сохран/u,
  /отмен/u,
  /удал/u,
  /добав/u,
  /выбер/u,
  /предупреж/u,
  /состояни/u,
  /календарь/u,
  /отпуска/u,
  /отпусков/u,
  /Нормализ/u,
  /\bФИО\b/u,
  /Полная исправ/u,
  /Ожидает/u,
  /существую/u,
  /если нет/u,
  /будет использ/u,
  /текущий/u,
  /Новая логика/u,
  /Принципы/u,
  /сервисный/u,
  /ленивой/u,
  /обязательн/u,
  /опциональн/u,
  /очеред/u,
  /ручная/u,
  /сортиров/u,
  /защита от/u,
  /возраст/u,
  /чтение послед/u,
  /убирает/u,
  /приводит/u,
  /унифицирует/u,
  /неразрыв/u,
  /обычным/u,
  /Публично-безопас/u,
  /где нужен/u,
  /только перенаправ/u,
  /быстрый/u,
  /автоочист/u,
  /количеств/u,
  /человека для/u,
];

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
      continue;
    }
    if (!entry.isFile()) continue;
    if (SKIP_FILES.has(entry.name)) continue;
    const ext = path.extname(entry.name);
    if (!SCAN_EXTENSIONS.has(ext)) continue;
    out.push(full);
  }
}

function rel(filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join("/");
}

function isAllowlisted(filePath, line) {
  const fileRel = rel(filePath);

  for (const item of allowlist.allowedSubstrings || []) {
    if (!line.includes(item.value)) continue;
    if (Array.isArray(item.files) && item.files.length) {
      if (item.files.some((name) => fileRel.endsWith(name))) return true;
      continue;
    }
    return true;
  }

  for (const item of allowlist.allowedRegex || []) {
    const re = new RegExp(item.pattern, item.flags || "u");
    if (!re.test(line)) continue;
    if (Array.isArray(item.files) && item.files.length) {
      if (item.files.some((name) => fileRel.endsWith(name))) return true;
      continue;
    }
    return true;
  }

  return false;
}

function scanFile(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const lines = text.split(/\r?\n/);
  const hits = [];

  lines.forEach((line, index) => {
    if (RUSSIAN_LETTER_RE.test(line) && !isAllowlisted(filePath, line)) {
      hits.push({
        line: index + 1,
        kind: "letter",
        match: line.match(RUSSIAN_LETTER_RE)[0],
        text: line.trim(),
      });
      return;
    }

    for (const re of RUSSIAN_ROOT_RES) {
      const match = line.match(re);
      if (!match) continue;
      if (isAllowlisted(filePath, line)) continue;
      hits.push({
        line: index + 1,
        kind: "root",
        match: match[0],
        text: line.trim(),
      });
      break;
    }
  });

  return hits;
}

const files = [];
walk(repoRoot, files);

const allHits = [];
for (const file of files) {
  const hits = scanFile(file);
  for (const hit of hits) {
    allHits.push({ file: rel(file), ...hit });
  }
}

if (allHits.length) {
  const preview = allHits
    .slice(0, 40)
    .map(
      (hit) =>
        `${hit.file}:${hit.line} [${hit.kind}:${hit.match}] ${hit.text.slice(0, 120)}`,
    )
    .join("\n");
  assert.fail(
    `verify-no-russian-text: found ${allHits.length} Russian marker(s)\n${preview}${
      allHits.length > 40 ? `\n... and ${allHits.length - 40} more` : ""
    }`,
  );
}

console.log(
  `verify-no-russian-text: OK (${files.length} files scanned, whitelist=${(allowlist.allowedSubstrings || []).length} entries)`,
);

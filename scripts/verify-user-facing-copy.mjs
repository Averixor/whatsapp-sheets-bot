#!/usr/bin/env node
/**
 * Fails CI when banned technical tokens appear in user-facing copy.
 * Scans ui HTML string literals and contextual message fields in listed .gs files.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { loadContract, repoRoot } from "./lib/load-contract.mjs";

const allowlistPath = path.join(
  repoRoot,
  "scripts/allowed-user-facing-technical-strings.json",
);
const allowlist = JSON.parse(fs.readFileSync(allowlistPath, "utf8"));
const contract = loadContract("user-facing-copy.contract.json");

// ReDoS-safe: hyphen suffixes are single alphanumeric segments (no nested '-' in +).
const DEFAULT_IDENTIFIER_LITERAL_PATTERN =
  "^[A-Z][A-Z0-9_]*(?:-[A-Za-z0-9]+)*$";
const identifierRe = new RegExp(
  allowlist.identifierLiteralPattern || DEFAULT_IDENTIFIER_LITERAL_PATTERN,
);
const bannedRes = (contract.bannedTokens || []).map((token) => {
  const escaped = String(token).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (/\s/.test(token)) {
    return { re: new RegExp(escaped, "iu"), token };
  }
  if (/^[A-Z0-9_]+$/.test(token)) {
    return { re: new RegExp(`\\b${escaped}\\b`), token };
  }
  return { re: new RegExp(`\\b${escaped}\\b`, "u"), token };
});

function rel(filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join("/");
}

function stripComments(text, ext) {
  let out = text;
  if (ext === ".html") {
    out = out.replace(/<!--[\s\S]*?-->/g, (match) => " ".repeat(match.length));
  }
  out = out.replace(/\/\*[\s\S]*?\*\//g, (match) => " ".repeat(match.length));
  out = out.replace(/(^|[^:])\/\/.*$/gm, (match, prefix) => {
    return prefix + " ".repeat(match.length - prefix.length);
  });
  return out;
}

function lineNumberAt(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

function extractStringLiterals(text) {
  const literals = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch !== '"' && ch !== "'" && ch !== "`") {
      i += 1;
      continue;
    }

    const quote = ch;
    let j = i + 1;
    let content = "";
    let staticContent = "";
    let exprDepth = 0;
    while (j < text.length) {
      const c = text[j];
      if (quote === "`" && c === "$" && text[j + 1] === "{") {
        staticContent += "\0";
        exprDepth = 1;
        j += 2;
        while (j < text.length && exprDepth > 0) {
          const ec = text[j];
          if (ec === "{") exprDepth += 1;
          else if (ec === "}") exprDepth -= 1;
          j += 1;
        }
        continue;
      }
      if (c === "\\") {
        content += c + (text[j + 1] || "");
        staticContent += c + (text[j + 1] || "");
        j += 2;
        continue;
      }
      if (c === quote) {
        literals.push({
          start: i,
          end: j + 1,
          quote,
          content: quote === "`" ? staticContent : content,
          line: lineNumberAt(text, i),
        });
        i = j + 1;
        break;
      }
      content += c;
      staticContent += c;
      j += 1;
    }
    if (j >= text.length) break;
  }
  return literals;
}

function isAllowlisted(fileRel, literal) {
  if (identifierRe.test(literal)) return true;

  for (const item of allowlist.allowedSubstrings || []) {
    if (!literal.includes(item.value)) continue;
    if (Array.isArray(item.files) && item.files.length) {
      if (item.files.some((name) => fileRel.endsWith(name))) return true;
      continue;
    }
    return true;
  }

  for (const item of allowlist.allowedRegex || []) {
    const re = new RegExp(item.pattern, item.flags || "u");
    if (!re.test(literal)) continue;
    if (Array.isArray(item.files) && item.files.length) {
      if (item.files.some((name) => fileRel.endsWith(name))) return true;
      continue;
    }
    return true;
  }

  return false;
}

function findBannedInLiteral(fileRel, literal, line) {
  const hits = [];
  if (isAllowlisted(fileRel, literal)) return hits;
  for (const { re, token } of bannedRes) {
    const match = literal.match(re);
    if (match) {
      hits.push({ token: match[0], line, literal: literal.slice(0, 120) });
    }
  }
  return hits;
}

function scanStringLiterals(filePath, text) {
  const ext = path.extname(filePath);
  const stripped = stripComments(text, ext);
  const fileRel = rel(filePath);
  const hits = [];

  for (const lit of extractStringLiterals(stripped)) {
    const litHits = findBannedInLiteral(fileRel, lit.content, lit.line);
    for (const hit of litHits) {
      hits.push({ file: fileRel, ...hit });
    }
  }

  return hits;
}

function collectUiHtmlFiles() {
  const uiDir = path.join(repoRoot, "ui");
  const out = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith(".html")) out.push(full);
    }
  }
  if (fs.existsSync(uiDir)) walk(uiDir);
  return out;
}

function collectScanFiles() {
  const files = collectUiHtmlFiles();
  for (const gsRel of contract.scanGsPaths || []) {
    const full = path.join(repoRoot, gsRel);
    assert.ok(fs.existsSync(full), `verify-user-facing-copy: missing ${gsRel}`);
    files.push(full);
  }
  return [...new Set(files)];
}

const allHits = [];
const files = collectScanFiles();

for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  const hits = scanStringLiterals(file, text);
  allHits.push(...hits);
}

if (allHits.length) {
  const preview = allHits
    .slice(0, 50)
    .map(
      (hit) =>
        `${hit.file}:${hit.line} [${hit.token}] ${JSON.stringify(hit.literal)}`,
    )
    .join("\n");
  assert.fail(
    `verify-user-facing-copy: found ${allHits.length} banned technical token(s) in user-facing copy\n${preview}${
      allHits.length > 50 ? `\n... and ${allHits.length - 50} more` : ""
    }`,
  );
}

console.log(
  `verify-user-facing-copy: OK (${files.length} files, banned=${(contract.bannedTokens || []).length}, allowlist entries=${(allowlist.allowedSubstrings || []).length + (allowlist.allowedRegex || []).length})`,
);

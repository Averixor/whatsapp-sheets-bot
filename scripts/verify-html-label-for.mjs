#!/usr/bin/env node
/**
 * Ensure every <label for="..."> references an id declared in the same HTML file.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const htmlFiles = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".html")) {
      htmlFiles.push(fullPath);
    }
  }
}

walk(repoRoot);

const LABEL_FOR_RE = /<label\b[^>]*\sfor\s*=\s*["']([^"']*)["'][^>]*>/gi;
const ELEMENT_ID_RE = /\bid\s*=\s*["']([^"']+)["']/gi;

const failures = [];

for (const filePath of htmlFiles.sort()) {
  const relPath = path.relative(repoRoot, filePath);
  const source = fs.readFileSync(filePath, "utf8");
  const ids = new Set();
  let match;

  ELEMENT_ID_RE.lastIndex = 0;
  while ((match = ELEMENT_ID_RE.exec(source)) !== null) {
    ids.add(match[1]);
  }

  LABEL_FOR_RE.lastIndex = 0;
  while ((match = LABEL_FOR_RE.exec(source)) !== null) {
    const forId = String(match[1] || "").trim();
    if (!forId) {
      failures.push(`${relPath}: empty label for attribute`);
      continue;
    }
    if (!ids.has(forId)) {
      failures.push(`${relPath}: label for="${forId}" has no matching id`);
    }
  }
}

assert.equal(
  failures.length,
  0,
  `HTML label/for mismatches:\n${failures.map((item) => `- ${item}`).join("\n")}`,
);

console.log(
  `verify-html-label-for: OK (${htmlFiles.length} html files, label for/id pairs checked)`,
);

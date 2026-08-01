#!/usr/bin/env node
/**
 * Ensure label[for] / htmlFor targets exist, and form controls have id or name.
 * Scans ui/ and ui-server/ HTML + Apps Script templates, including JS string builders.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const scanRoots = [
  path.join(repoRoot, "ui"),
  path.join(repoRoot, "ui-server"),
];
const scanFiles = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (entry.isFile() && /\.(html|gs)$/i.test(entry.name)) {
      scanFiles.push(fullPath);
    }
  }
}

for (const root of scanRoots) walk(root);

const LABEL_FOR_RE =
  /(?:<label\b[^>]*\sfor\s*=\s*["']([^"']*)["'][^>]*>|<label\b[^>]*\sfor\s*=\s*\\["']([^"']*)\\["'][^>]*>)/gi;
const HTML_FOR_RE = /\.htmlFor\s*=\s*["']([^"']+)["']/gi;
const ELEMENT_ID_RE =
  /\bid\s*=\s*(?:\\?["'])([^"']+)(?:\\?["'])|\.id\s*=\s*["']([^"']+)["']|setAttribute\(\s*["']id["']\s*,\s*["']([^"']+)["']\s*\)/gi;
const CONTROL_RE = /<(input|select|textarea)\b([^>]*)>/gi;

const failures = [];
let labelForCount = 0;
let controlCount = 0;

function lineAt(source, index) {
  return source.slice(0, index).split("\n").length;
}

for (const filePath of scanFiles.sort()) {
  const relPath = path.relative(repoRoot, filePath);
  const source = fs.readFileSync(filePath, "utf8");
  const ids = new Set();
  let match;

  ELEMENT_ID_RE.lastIndex = 0;
  while ((match = ELEMENT_ID_RE.exec(source)) !== null) {
    const id = match[1] || match[2] || match[3];
    if (id) ids.add(id);
  }

  LABEL_FOR_RE.lastIndex = 0;
  while ((match = LABEL_FOR_RE.exec(source)) !== null) {
    labelForCount += 1;
    const forId = String(match[1] || match[2] || "").trim();
    if (!forId) {
      failures.push(`${relPath}:${lineAt(source, match.index)}: empty label for attribute`);
      continue;
    }
    // Dynamic template ids like msgText${index} — accept prefix match against declared templates.
    const dynamicOk =
      forId.includes("${") ||
      [...ids].some((id) => id.includes("${") && id.split("${")[0] && forId.startsWith(id.split("${")[0]));
    if (!ids.has(forId) && !dynamicOk) {
      failures.push(
        `${relPath}:${lineAt(source, match.index)}: label for="${forId}" has no matching id`,
      );
    }
  }

  HTML_FOR_RE.lastIndex = 0;
  while ((match = HTML_FOR_RE.exec(source)) !== null) {
    labelForCount += 1;
    const forId = String(match[1] || "").trim();
    if (!forId || !ids.has(forId)) {
      failures.push(
        `${relPath}:${lineAt(source, match.index)}: htmlFor="${forId}" has no matching id`,
      );
    }
  }

  CONTROL_RE.lastIndex = 0;
  while ((match = CONTROL_RE.exec(source)) !== null) {
    const attrs = match[2] || "";
    const typeMatch = /\btype\s*=\s*["']([^"']+)["']/i.exec(attrs);
    const type = String((typeMatch && typeMatch[1]) || "").toLowerCase();
    if (["hidden", "submit", "button", "image", "reset"].includes(type)) continue;
    controlCount += 1;
    const hasId = /\bid\s*=/.test(attrs);
    const hasName = /\bname\s*=/.test(attrs);
    if (!hasId && !hasName) {
      failures.push(
        `${relPath}:${lineAt(source, match.index)}: <${match[1]}> missing both id and name`,
      );
    }
  }
}

assert.equal(
  failures.length,
  0,
  `HTML label/for / form-field mismatches:\n${failures.map((item) => `- ${item}`).join("\n")}`,
);

console.log(
  `verify-html-label-for: OK (${scanFiles.length} files, ${labelForCount} for/htmlFor refs, ${controlCount} controls checked)`,
);

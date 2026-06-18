#!/usr/bin/env node
/**
 * Recursive discovery of GAS runtime files (.gs / .html) for CI governance.
 * Path-agnostic: works with flat root or future subfolder layout.
 */
import fs from 'node:fs';
import path from 'node:path';
import { repoRoot as defaultRepoRoot } from './load-contract.mjs';

export const DEFAULT_SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'coverage',
  '.venv',
  '.venv_xlsx',
]);

const API_FUNCTION_RE = /^function\s+(api[A-Za-z0-9_]+)\s*\(/gm;

/**
 * @param {string} root
 * @param {string} absPath
 * @returns {string}
 */
export function toPosixRel(root, absPath) {
  return path.relative(root, absPath).split(path.sep).join('/');
}

/**
 * @param {string} root
 * @param {string[]} extensions - e.g. ['.gs', '.html']
 * @param {{ skipDirs?: Set<string> }} [options]
 * @returns {string[]} repo-relative posix paths, sorted
 */
export function walkRepoFiles(root, extensions, options = {}) {
  const skipDirs = options.skipDirs ?? DEFAULT_SKIP_DIRS;
  const suffixes = extensions.map((ext) => (ext.startsWith('.') ? ext : `.${ext}`));
  const out = [];

  function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (skipDirs.has(ent.name)) continue;
        walk(abs);
        continue;
      }
      if (!suffixes.some((suffix) => ent.name.endsWith(suffix))) continue;
      out.push(toPosixRel(root, abs));
    }
  }

  walk(root);
  return out.sort();
}

/**
 * @param {string} [root]
 * @param {{ skipDirs?: Set<string> }} [options]
 * @returns {string[]}
 */
export function walkGasFiles(root = defaultRepoRoot, options) {
  return walkRepoFiles(root, ['.gs'], options);
}

/**
 * @param {string} [root]
 * @param {{ skipDirs?: Set<string> }} [options]
 * @returns {string[]}
 */
export function walkHtmlFiles(root = defaultRepoRoot, options) {
  return walkRepoFiles(root, ['.html'], options);
}

/**
 * Index top-level `function api*` definitions across the full GAS tree.
 * @param {string} [root]
 * @param {{ skipDirs?: Set<string> }} [options]
 * @returns {Record<string, string[]>}
 */
export function buildApiFunctionIndex(root = defaultRepoRoot, options) {
  const index = {};
  for (const rel of walkGasFiles(root, options)) {
    const text = fs.readFileSync(path.join(root, rel), 'utf8');
    for (const match of text.matchAll(API_FUNCTION_RE)) {
      (index[match[1]] ||= []).push(rel);
    }
  }
  return index;
}

/**
 * Find first repo file whose basename matches (supports future subfolders).
 * @param {string} root
 * @param {string} basename - e.g. "Js.Core.html"
 * @param {string[]} extensions
 * @param {{ skipDirs?: Set<string> }} [options]
 * @returns {string|null} repo-relative posix path
 */
export function findFileByBasename(root, basename, extensions, options) {
  const targets = new Set(
    extensions.map((ext) => {
      const normalized = ext.startsWith('.') ? ext : `.${ext}`;
      return basename.endsWith(normalized) ? basename : `${basename}${normalized}`;
    }),
  );
  for (const rel of walkRepoFiles(root, extensions, options)) {
    if (targets.has(path.basename(rel))) return rel;
  }
  return null;
}

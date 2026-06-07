#!/usr/bin/env node
/**
 * Flags unsafe interpolations in HTML template literals passed to setHtml / innerHTML.
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadContract, patternsToRegExp, repoRoot } from './lib/load-contract.mjs';

const xssPolicy = loadContract('xss-policy.contract.json');
const TARGET_FILES = xssPolicy.targetFiles || [];
const SAFE_EXPR = patternsToRegExp(xssPolicy.patterns || []);
const maxPatterns = xssPolicy.maxSafeExprPatterns ?? 100;
const warnThreshold = xssPolicy.warnThreshold ?? 95;
const patternCount = xssPolicy.patterns?.length ?? 0;
const legacyPatternCount = xssPolicy.legacyPatternCount ?? patternCount;
const preferredSinks = xssPolicy.preferredSinks || {};
const sinkNamePattern = preferredSinks.sinkNamePattern
  ? new RegExp(preferredSinks.sinkNamePattern)
  : null;
const sanitizerSinks = xssPolicy.sanitizerSinks || [];
const REVIEWED_STANDALONE = xssPolicy.reviewedStandaloneSinks || {};

function walk(dir, exts, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === '.git') continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, exts, out);
    else if (exts.some((ext) => ent.name.endsWith(ext))) out.push(p);
  }
  return out;
}

function rel(p) {
  return path.relative(repoRoot, p).replace(/\\/g, '/');
}

function verifyReviewedAllowlist() {
  const errors = [];
  const review = xssPolicy.reviewedAllowlist || {};
  const patterns = xssPolicy.patterns || [];
  const groups = Array.isArray(review.groups) ? review.groups : [];

  if (!review.reviewedAt) {
    errors.push('reviewedAllowlist.reviewedAt is required');
  }

  const covered = new Set();
  groups.forEach((group) => {
    (group.patterns || []).forEach((pattern) => {
      if (covered.has(pattern)) {
        errors.push(`duplicate reviewed pattern: ${pattern}`);
      }
      covered.add(pattern);
    });
  });

  if (review.requireFullCoverage) {
    patterns.forEach((pattern) => {
      if (!covered.has(pattern)) {
        errors.push(`pattern missing from reviewedAllowlist groups: ${pattern}`);
      }
    });
    covered.forEach((pattern) => {
      if (!patterns.includes(pattern)) {
        errors.push(`reviewedAllowlist references unknown pattern: ${pattern}`);
      }
    });
  }

  return errors;
}

function verifyReviewedStandaloneSinks() {
  const errors = [];
  if (!REVIEWED_STANDALONE.requireCoverage) return errors;

  if (!REVIEWED_STANDALONE.reviewedAt) {
    errors.push('reviewedStandaloneSinks.reviewedAt is required');
  }

  const targetSet = new Set(TARGET_FILES);
  const entries = Array.isArray(REVIEWED_STANDALONE.files)
    ? REVIEWED_STANDALONE.files
    : [];
  const reviewed = new Map();
  entries.forEach((entry) => {
    const file = String(entry?.path || '').trim();
    if (!file) {
      errors.push('reviewedStandaloneSinks file entry missing path');
      return;
    }
    if (reviewed.has(file)) errors.push(`duplicate reviewed standalone file: ${file}`);
    reviewed.set(file, entry);
    if (!String(entry?.rationale || '').trim()) {
      errors.push(`reviewed standalone file missing rationale: ${file}`);
    }
    if (!fs.existsSync(path.join(repoRoot, file))) {
      errors.push(`reviewed standalone file does not exist: ${file}`);
    }
  });

  const sinkRe =
    /innerHTML\s*=|insertAdjacentHTML\s*\(|HtmlService\.createHtmlOutput|HtmlService\.createTemplateFromFile|HtmlService\.createHtmlOutputFromFile|(?:let|var|const)\s+html\s*=\s*`/;
  const sinkFiles = walk(repoRoot, ['.gs', '.html'])
    .map(rel)
    .filter((file) => !targetSet.has(file))
    .filter((file) => sinkRe.test(fs.readFileSync(path.join(repoRoot, file), 'utf8')));

  sinkFiles.forEach((file) => {
    if (!reviewed.has(file)) {
      errors.push(`standalone HTML sink missing reviewedStandaloneSinks entry: ${file}`);
    }
  });

  reviewed.forEach((_entry, file) => {
    if (!sinkFiles.includes(file)) {
      errors.push(`reviewedStandaloneSinks entry no longer has a detected sink: ${file}`);
    }
  });

  return errors;
}

function stripScript(html) {
  const match = html.match(/<script\b[^>]*>([\s\S]*?)<\/script>/i);
  return match ? match[1] : html;
}

function isSafeExpression(expr) {
  const trimmed = String(expr || '').trim();
  if (!trimmed) return true;
  return SAFE_EXPR.some((re) => re.test(trimmed));
}

function parseTemplateFrom(source, tickIndex) {
  const violations = [];
  let i = tickIndex + 1;
  while (i < source.length) {
    const ch = source[i];
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === '$' && source[i + 1] === '{') {
      i += 2;
      let depth = 1;
      let expr = '';
      while (i < source.length && depth > 0) {
        if (source[i] === '{') depth += 1;
        if (source[i] === '}') depth -= 1;
        if (depth > 0) expr += source[i];
        i += 1;
      }
      if (!isSafeExpression(expr)) {
        violations.push({
          line: source.slice(0, tickIndex).split('\n').length,
          expr: expr.trim(),
        });
      }
      continue;
    }
    if (ch === '`') break;
    i += 1;
  }
  return violations;
}

function auditTemplateSinks(source) {
  const violations = [];
  const patterns = [
    /\.innerHTML\s*=\s*`/g,
    /setHtml\s*\(\s*['"][^'"]+['"]\s*,\s*`/g,
    /(?:html|cachedHtml|rowsHtml)\s*\+=\s*`/g,
    /(?:let|var)\s+html\s*=\s*`/g,
  ];

  patterns.forEach((re) => {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(source)) !== null) {
      const tick = source.indexOf('`', match.index);
      if (tick === -1) continue;
      parseTemplateFrom(source, tick).forEach((v) => violations.push(v));
    }
  });

  return violations;
}

function auditFile(relPath) {
  const absPath = path.join(repoRoot, relPath);
  const source = stripScript(fs.readFileSync(absPath, 'utf8'));
  return auditTemplateSinks(source).map((v) => ({ ...v, relPath }));
}

function getReviewedPatternSet() {
  const groups = xssPolicy.reviewedAllowlist?.groups || [];
  const set = new Set();
  groups.forEach((group) => {
    (group.patterns || []).forEach((pattern) => set.add(pattern));
  });
  return set;
}

function warnOnNewPatternsWithoutSink() {
  if (!preferredSinks.requireSinkForNewPatterns) return;
  if (patternCount <= legacyPatternCount) return;

  const reviewedPatterns = getReviewedPatternSet();
  const newPatterns = (xssPolicy.patterns || []).slice(legacyPatternCount);
  newPatterns.forEach((source) => {
    if (reviewedPatterns.has(source)) return;
    const mentionsSink = sanitizerSinks.some((name) => source.includes(name));
    const matchesSinkPattern = sinkNamePattern ? sinkNamePattern.test(source) : false;
    if (!mentionsSink && !matchesSinkPattern) {
      console.warn(
        `audit-client-xss: WARN — new SAFE_EXPR pattern without sanitizer sink: ${source} (see preferredSinks in contracts/xss-policy.contract.json)`,
      );
    }
  });
}

function main() {
  const allowlistErrors = verifyReviewedAllowlist();
  const standaloneErrors = verifyReviewedStandaloneSinks();
  const reviewErrors = allowlistErrors.concat(standaloneErrors);
  if (reviewErrors.length) {
    console.error('audit-client-xss: FAIL (review governance)');
    reviewErrors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }

  warnOnNewPatternsWithoutSink();

  if (patternCount > maxPatterns) {
    console.error(
      `audit-client-xss: FAIL — SAFE_EXPR entropy ${patternCount} > max ${maxPatterns} (contracts/xss-policy.contract.json)`,
    );
    process.exit(1);
  }
  if (patternCount > warnThreshold) {
    console.warn(
      `audit-client-xss: WARN — SAFE_EXPR count ${patternCount} > warn threshold ${warnThreshold}; migrate toward sanitizer sinks`,
    );
  }

  const all = TARGET_FILES.flatMap(auditFile);
  if (all.length) {
    console.error('audit-client-xss: FAIL');
    all.forEach((v) => {
      console.error(`  ${v.relPath}:${v.line}  unsafe \${${v.expr}}`);
    });
    process.exit(1);
  }
  console.log(
    `audit-client-xss: OK (${TARGET_FILES.length} files, ${patternCount} safe patterns, reviewed ${xssPolicy.reviewedAllowlist?.reviewedAt || 'n/a'})`,
  );
}

main();

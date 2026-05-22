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

function main() {
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
  console.log(`audit-client-xss: OK (${TARGET_FILES.length} files, ${patternCount} safe patterns)`);
}

main();

#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { loadContract, repoRoot } from './lib/load-contract.mjs';

const includesContract = loadContract('client-includes.contract.json');
const loaderPath = path.join(repoRoot, includesContract.loaderFile);
const EXPECTED = includesContract.expected || [];

function parseIncludes(text) {
  const re = /include\('([^']+)'\)/g;
  const found = [];
  let match;
  while ((match = re.exec(text)) !== null) {
    found.push(match[1]);
  }
  return found;
}

function main() {
  if (!fs.existsSync(loaderPath)) {
    console.error(`verify-client-includes: ${includesContract.loaderFile} not found`);
    process.exit(1);
  }

  const includes = parseIncludes(fs.readFileSync(loaderPath, 'utf8'));
  const errors = [];

  if (includes.length !== EXPECTED.length) {
    errors.push(`expected ${EXPECTED.length} includes, found ${includes.length}`);
  }

  EXPECTED.forEach((name, index) => {
    if (includes[index] !== name) {
      errors.push(
        `order mismatch at index ${index}: expected ${name}, got ${includes[index] || '(missing)'}`,
      );
    }
    const filePath = path.join(repoRoot, `${name}.html`);
    if (!fs.existsSync(filePath)) {
      errors.push(`missing file: ${name}.html`);
    }
  });

  const dupes = includes.filter((item, idx) => includes.indexOf(item) !== idx);
  if (dupes.length) {
    errors.push(`duplicate includes: ${Array.from(new Set(dupes)).join(', ')}`);
  }

  fs.readdirSync(repoRoot)
    .filter((name) => name.endsWith('.html'))
    .forEach((name) => {
      const text = fs.readFileSync(path.join(repoRoot, name), 'utf8');
      if (/^\uFEFF?\s*```/.test(text)) {
        errors.push(
          `${name} starts with a markdown code fence; file must begin with <!doctype html>`,
        );
      }
      if (/\n```\s*$/.test(text)) {
        errors.push(`${name} ends with a markdown code fence`);
      }
    });

  if (errors.length) {
    console.error('verify-client-includes: FAIL');
    errors.forEach((line) => console.error(`  - ${line}`));
    process.exit(1);
  }

  console.log('verify-client-includes: OK');
}

main();

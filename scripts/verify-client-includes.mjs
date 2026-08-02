#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { findFileByBasename, walkHtmlFiles } from './lib/gas-files.mjs';
import { loadContract, repoRoot } from './lib/load-contract.mjs';

const includesContract = loadContract('client-includes.contract.json');
const loaderRel =
  findFileByBasename(repoRoot, path.basename(includesContract.loaderFile), ['.html']) ||
  includesContract.loaderFile;
const loaderPath = path.join(repoRoot, loaderRel);
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

function parseActiveRuntimeChain(metadataText) {
  const blockMatch = metadataText.match(
    /activeRuntimeChain:\s*Object\.freeze\(\[([\s\S]*?)\]\)/,
  );
  if (!blockMatch) return null;
  const entries = [];
  const itemRe = /"([^"]+\.html)"/g;
  let match;
  while ((match = itemRe.exec(blockMatch[1])) !== null) {
    entries.push(match[1].replace(/\.html$/, ''));
  }
  return entries;
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
    const htmlRel =
      findFileByBasename(repoRoot, `${name}.html`, ['.html']) || `${name}.html`;
    const filePath = path.join(repoRoot, htmlRel);
    if (!fs.existsSync(filePath)) {
      errors.push(`missing file: ${name}.html`);
    }
  });

  const dupes = includes.filter((item, idx) => includes.indexOf(item) !== idx);
  if (dupes.length) {
    errors.push(`duplicate includes: ${Array.from(new Set(dupes)).join(', ')}`);
  }

  const metadataRel =
    findFileByBasename(repoRoot, 'ProjectMetadata.gs', ['.gs']) || 'core/ProjectMetadata.gs';
  const metadataPath = path.join(repoRoot, metadataRel);
  if (fs.existsSync(metadataPath)) {
    const metadataText = fs.readFileSync(metadataPath, 'utf8');
    const activeRuntimeChain = parseActiveRuntimeChain(metadataText);
    if (!activeRuntimeChain) {
      errors.push('ProjectMetadata.gs activeRuntimeChain block not found');
    } else if (activeRuntimeChain.length !== EXPECTED.length) {
      errors.push(
        `activeRuntimeChain length ${activeRuntimeChain.length} != client includes ${EXPECTED.length}`,
      );
    } else {
      EXPECTED.forEach((name, index) => {
        if (activeRuntimeChain[index] !== name) {
          errors.push(
            `activeRuntimeChain mismatch at index ${index}: expected ${name}, got ${activeRuntimeChain[index] || '(missing)'}`,
          );
        }
      });
    }
  } else {
    errors.push('ProjectMetadata.gs not found for activeRuntimeChain parity check');
  }

  for (const htmlRel of walkHtmlFiles(repoRoot)) {
    const name = path.basename(htmlRel);
    const text = fs.readFileSync(path.join(repoRoot, htmlRel), 'utf8');
      if (/^\uFEFF?\s*```/.test(text)) {
        errors.push(
          `${name} starts with a markdown code fence; file must begin with <!doctype html>`,
        );
      }
      if (/\n```\s*$/.test(text)) {
        errors.push(`${name} ends with a markdown code fence`);
    }
  }

  if (errors.length) {
    console.error('verify-client-includes: FAIL');
    errors.forEach((line) => console.error(`  - ${line}`));
    process.exit(1);
  }

  console.log('verify-client-includes: OK');
}

main();

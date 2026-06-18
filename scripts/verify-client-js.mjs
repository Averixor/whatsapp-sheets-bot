#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { findFileByBasename } from './lib/gas-files.mjs';
import { loadContract, repoRoot } from './lib/load-contract.mjs';

const includesContract = loadContract('client-includes.contract.json');
const loaderPath = path.join(repoRoot, includesContract.loaderFile || 'JavaScript.html');
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

function stripGasDirectives(text) {
  return text
    .replace(/<\?!=\s*[\s\S]*?\?>/g, '')
    .replace(/<\?[\s\S]*?\?>/g, '');
}

function extractScriptBodies(text) {
  const stripped = stripGasDirectives(text);
  const bodies = [];
  const re = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = re.exec(stripped)) !== null) {
    bodies.push(match[1]);
  }
  if (bodies.length) {
    return bodies.join('\n\n');
  }
  return stripped.replace(/<\/?script\b[^>]*>/gi, '');
}

function loadCombinedClientJs() {
  const loader = fs.readFileSync(loaderPath, 'utf8');
  const includes = parseIncludes(loader);
  const order = includes.length ? includes : EXPECTED;
  const chunks = [`// WASB combined client bundle\n`];

  order.forEach((name) => {
    const htmlRel =
      findFileByBasename(repoRoot, `${name}.html`, ['.html']) || `${name}.html`;
    const filePath = path.join(repoRoot, htmlRel);
    if (!fs.existsSync(filePath)) {
      throw new Error(`missing ${name}.html`);
    }
    chunks.push(`\n// ----- ${name}.html -----\n`);
    chunks.push(extractScriptBodies(fs.readFileSync(filePath, 'utf8')));
  });

  return chunks.join('\n');
}

function main() {
  try {
    const source = loadCombinedClientJs();
    new vm.Script(source, { filename: 'wasb-sidebar-client.js' });
    console.log('verify-client-js: OK');
  } catch (err) {
    console.error('verify-client-js: FAIL');
    console.error(err && err.stack ? err.stack : String(err));
    process.exit(1);
  }
}

main();

#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { findFileByBasename } from './lib/gas-files.mjs';
import { loadContract, repoRoot } from './lib/load-contract.mjs';

const includesContract = loadContract('client-includes.contract.json');
const loaderFile = includesContract.loaderFile || 'JavaScript.html';
const loaderRel = findFileByBasename(repoRoot, path.basename(loaderFile), ['.html']) || loaderFile;
const loaderPath = path.join(repoRoot, loaderRel);
const sidebarRel = findFileByBasename(repoRoot, 'Sidebar.html', ['.html']) || 'ui/Sidebar.html';
const sidebarPath = path.join(repoRoot, sidebarRel);
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
    assert.match(
      source,
      /async function showMonthSwitcher\(\)[\s\S]{0,500}const data = await Stage7Api\.getMonths\(\)/,
      'month switcher must refresh months from server whenever it opens',
    );
    assert.doesNotMatch(
      source,
      /async function showMonthSwitcher\(\)[\s\S]{0,200}if \(!STATE\.monthsList\.length\)/,
      'month switcher must not rely on stale STATE.monthsList as its primary source',
    );
    assert.match(
      source,
      /const resolvedMonth =[\s\S]{0,120}meta\?\.sync\?\.currentMonth[\s\S]{0,120}String\(month \|\| ""\)\.trim\(\)/,
      'switchMonth adapter must fall back to sync metadata and requested month',
    );
    assert.match(
      source,
      /function navigateTo\(screenName, openFn\)[\s\S]{0,500}pushCurrentNavigationState_\(\)[\s\S]{0,220}STATE\.currentScreen = target/,
      'navigateTo must push the current screen before opening a different screen',
    );
    assert.match(
      source,
      /function goBack\(\)[\s\S]{0,260}const previous = stack\.pop\(\)[\s\S]{0,120}restoreNavigationState_\(previous\)/,
      'goBack must restore the previous navigation snapshot from the stack',
    );
    assert.match(
      source,
      /function showResult\(title\)[\s\S]{0,260}shouldSuppressPush[\s\S]{0,220}pushCurrentNavigationState_\(\)/,
      'showResult must suppress duplicate history pushes during navigateTo renders',
    );

    const sidebar = fs.readFileSync(sidebarPath, 'utf8');
    assert.match(
      sidebar,
      /class="back-button back-btn"[\s\S]{0,160}onclick="SidebarApp\.goBack\(\)"/,
      'sidebar back button must call SidebarApp.goBack()',
    );
    console.log('verify-client-js: OK');
  } catch (err) {
    console.error('verify-client-js: FAIL');
    console.error(err && err.stack ? err.stack : String(err));
    process.exit(1);
  }
}

main();

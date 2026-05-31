#!/usr/bin/env node
/**
 * OAuth scope governance — appsscript.json vs contracts/oauth-scopes.contract.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadContract, repoRoot } from './lib/load-contract.mjs';

const contract = loadContract('oauth-scopes.contract.json');

function readScopes() {
  const manifestPath = path.join(repoRoot, contract.manifestFile || 'appsscript.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  return Array.isArray(manifest.oauthScopes) ? manifest.oauthScopes.slice() : [];
}

function asSet(list) {
  return new Set((list || []).map((item) => String(item || '').trim()).filter(Boolean));
}

function main() {
  const errors = [];
  const actual = asSet(readScopes());
  const required = asSet(contract.requiredScopes);
  const forbidden = asSet(contract.forbiddenScopes);

  forbidden.forEach((scope) => {
    if (actual.has(scope)) {
      errors.push(`forbidden scope present: ${scope}`);
    }
  });

  required.forEach((scope) => {
    if (!actual.has(scope)) {
      errors.push(`missing required scope: ${scope}`);
    }
  });

  const removed = (contract.scopeCatalog || [])
    .filter((entry) => entry.status === 'removed')
    .map((entry) => entry.url);
  removed.forEach((scope) => {
    if (actual.has(scope)) {
      errors.push(`removed scope still present: ${scope}`);
    }
  });

  actual.forEach((scope) => {
    if (!required.has(scope)) {
      errors.push(`unexpected scope not in requiredScopes: ${scope}`);
    }
  });

  if (errors.length) {
    console.error('verify-oauth-scopes: FAIL');
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }

  console.log('verify-oauth-scopes: OK');
  console.log(`  scopes: ${actual.size}`);
}

main();

#!/usr/bin/env node
/**
 * Envelope compatibility audit — server shape, client adapters, unsafe .message access.
 */
import fs from 'node:fs';
import path from 'node:path';
import { readRepoFileByBasename } from './lib/gas-files.mjs';
import { loadContract, repoRoot } from './lib/load-contract.mjs';

const envelope = loadContract('envelope.contract.json');
const migration = loadContract('envelope-migration.contract.json');
const SERVER_FIELDS = [...(envelope.required || []), ...(envelope.optional || [])];
const ADAPTERS = envelope.adapters || [];
const ADAPTER_FILES = envelope.adapterFiles || ['Js.Core.html'];
const CALL_SITE_FILES = envelope.callSiteFiles || [];

function read(rel) {
  return readRepoFileByBasename(repoRoot, rel, {
    errorPrefix: 'audit-envelope-compat',
  });
}

function checkServerResponse() {
  const text = read('ServerResponse.gs');
  const errors = [];
  if (!/function\s+buildServerResponseData_/.test(text)) {
    errors.push('ServerResponse.gs: missing buildServerResponseData_');
  }
  if (!/result:\s*result/.test(text) && !/result:/.test(text)) {
    errors.push('ServerResponse.gs: result field not found in data builder');
  }
  if (!/meta:/.test(text)) {
    errors.push('ServerResponse.gs: meta field not found in data builder');
  }
  if (!/success/.test(text)) {
    errors.push('ServerResponse.gs: success field handling not found');
  }
  return errors;
}

function checkClientAdapters() {
  const errors = [];
  for (const file of ADAPTER_FILES) {
    const text = read(file);
    ADAPTERS.forEach((name) => {
      if (!new RegExp(`function\\s+${name}\\s*\\(`).test(text)) {
        errors.push(`${file}: missing ${name}`);
      }
    });
    if (!/Api\s*=\s*\{/.test(text) || !/run\s*\(method/.test(text)) {
      errors.push(`${file}: Api.run not found`);
    }
    if (!/USE_NEW_API_PATH/.test(text) || !/_apiTransport_/.test(text)) {
      errors.push(`${file}: transport bridge (USE_NEW_API_PATH / _apiTransport_) not found`);
    }
  }
  return errors;
}

function checkUnsafeMessageAccess() {
  const errors = [];
  const allowOptional = /\?\./;
  const allowFallback = /\|\|/;

  for (const file of CALL_SITE_FILES) {
    const text = read(file);
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      if (allowOptional.test(line)) return;
      if (/\b\w+\s*&&\s*\w+\.\w+/.test(line)) return;
      if (/escapeHtml\s*\(\s*\w+\.message/.test(line)) return;
      if (/normalizeError/.test(line)) return;
      if (/console\.(log|warn|error)/.test(line)) return;
      if (/JSON\.stringify/.test(line)) return;
      if (/personCardMessage|result-value/.test(line)) return;

      let m;
      const r = /(?<![?.])([A-Za-z_$][\w$]*)\.message\b/g;
      while ((m = r.exec(line))) {
        const ident = m[1];
        if (ident === 'error' || ident === 'Error') continue;
        if (allowFallback.test(line)) continue;
        errors.push(
          `${file}:${i + 1}: possible unsafe .message on "${ident}" (use optional chaining or fallback)`,
        );
      }
    });
  }
  return errors;
}

function checkEnvelopeVersionGate() {
  const errors = [];
  const envelopeVersion = envelope.version;
  const current = migration.currentEnvelopeVersion;
  if (envelopeVersion !== current) {
    errors.push(
      `envelope version ${envelopeVersion} !== envelope-migration currentEnvelopeVersion ${current} — follow versionBumpChecklist in contracts/envelope-migration.contract.json`,
    );
  }
  const rule = (migration.rules || []).find(
    (r) => r.fromVersion === envelopeVersion - 1 && r.toVersion === envelopeVersion,
  );
  if (envelopeVersion > 1 && !rule) {
    errors.push(
      `envelope-migration: no rules[] entry for v${envelopeVersion - 1}→v${envelopeVersion}`,
    );
  }
  for (const field of envelope.forbiddenRemovals || []) {
    if (!(envelope.required || []).includes(field) && !(envelope.optional || []).includes(field)) {
      errors.push(`envelope forbiddenRemovals field "${field}" must stay in required or optional`);
    }
  }
  return errors;
}

function main() {
  const errors = [
    ...checkEnvelopeVersionGate(),
    ...checkServerResponse(),
    ...checkClientAdapters(),
    ...checkUnsafeMessageAccess(),
  ];

  if (errors.length) {
    console.error('audit-envelope-compat: FAIL');
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }

  console.log('audit-envelope-compat: OK');
  console.log(`  server fields tracked: ${SERVER_FIELDS.join(', ')}`);
  console.log(`  adapters (${ADAPTERS.length}): ${ADAPTERS.join(', ')}`);
}

main();

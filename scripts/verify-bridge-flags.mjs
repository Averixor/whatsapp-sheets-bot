#!/usr/bin/env node
/**
 * Bridge feature-flag registry enforcement (contracts/bridge-flags.registry.json).
 */
import fs from 'node:fs';
import path from 'node:path';
import { findFileByBasename, readRepoFileByBasename } from './lib/gas-files.mjs';
import { loadContract, repoRoot } from './lib/load-contract.mjs';

const registry = loadContract('bridge-flags.registry.json');
const strict = process.env.BRIDGE_STRICT === '1';

function read(rel) {
  return readRepoFileByBasename(repoRoot, rel, {
    errorPrefix: 'verify-bridge-flags',
  });
}

function parseFlagDefault(source, flagName, expected) {
  const re = new RegExp(`var\\s+${flagName}\\s*=\\s*(true|false)\\s*;`);
  const m = source.match(re);
  if (!m) return { ok: false, reason: `var ${flagName} = true|false not found` };
  const actual = m[1] === 'true';
  if (actual !== expected) {
    return {
      ok: false,
      reason: `${flagName} is ${actual}, registry defaultValue is ${expected}`,
    };
  }
  return { ok: true };
}

function checkSunset(flagName, meta, sourcePresent) {
  const warnings = [];
  if (!meta.sunsetTarget || !sourcePresent) return warnings;
  const today = new Date().toISOString().slice(0, 10);
  if (today > meta.sunsetTarget) {
    warnings.push(
      `${flagName}: past sunset ${meta.sunsetTarget} — remove bridge or extend registry (contracts/bridge-flags.registry.json)`,
    );
  }
  return warnings;
}

/**
 * Static governance: quick/preprod health must FAIL when dangerous Script
 * Properties are enabled or WASB_SPREADSHEET_ID is missing.
 */
function checkPreprodScriptPropertyDiagnostics_(errors) {
  const diagFile = 'Diagnostics.Stage7.Core.gs';
  let text;
  try {
    text = read(diagFile);
  } catch (e) {
    errors.push(`preprod diagnostics: cannot read ${diagFile}: ${e.message || e}`);
    return;
  }

  if (!/function\s+_diagAppendPreprodScriptPropertyChecks_\s*\(/.test(text)) {
    errors.push(
      'preprod diagnostics: _diagAppendPreprodScriptPropertyChecks_ not found',
    );
    return;
  }

  const start = text.search(
    /function\s+_diagAppendPreprodScriptPropertyChecks_\s*\(/,
  );
  // Slice a bounded window after the function declaration (avoids nested-brace parsing).
  const body = text.slice(start, start + 4500);

  const dangerousFlags = [
    'WASB_ACCESS_MIGRATION_EMAIL_BRIDGE',
    'WASB_ACCESS_TEMP_PASSWORD_PLAIN_LOOKUP',
  ];
  for (const flag of dangerousFlags) {
    if (!body.includes(flag)) {
      errors.push(`preprod diagnostics: ${flag} not present in diagnostics code`);
    }
  }

  if (!/migrationBridgeEnabled\s*\?\s*["']FAIL["']/.test(body)) {
    errors.push(
      'preprod diagnostics: WASB_ACCESS_MIGRATION_EMAIL_BRIDGE true → FAIL missing',
    );
  }
  if (!/plainLookupEnabled\s*\?\s*["']FAIL["']/.test(body)) {
    errors.push(
      'preprod diagnostics: WASB_ACCESS_TEMP_PASSWORD_PLAIN_LOOKUP true → FAIL missing',
    );
  }

  if (!body.includes('WASB_SPREADSHEET_ID')) {
    errors.push('preprod diagnostics: WASB_SPREADSHEET_ID check missing');
  } else if (!/spreadsheetId\s*\?\s*["']OK["']\s*:\s*["']FAIL["']/.test(body)) {
    errors.push(
      'preprod diagnostics: missing WASB_SPREADSHEET_ID must produce FAIL',
    );
  }

  const uaMessageSnippets = [
    'Ідентифікатор робочої таблиці задано',
    'WASB_SPREADSHEET_ID не задано',
    'Аварійний email bridge',
    'Legacy-пошук тимчасового пароля',
    'Задайте WASB_OWNER_EMAIL у властивостях сценарію',
  ];
  for (const snippet of uaMessageSnippets) {
    if (!body.includes(snippet)) {
      errors.push(
        `preprod diagnostics: Ukrainian user-facing message missing: ${snippet}`,
      );
    }
  }

  if (/Script properties\s*→\s*WASB_OWNER_EMAIL/.test(body)) {
    errors.push(
      'preprod diagnostics: owner email hint must stay Ukrainian (not English Script properties → …)',
    );
  }
}

function main() {
  const errors = [];
  const warnings = [];

  for (const [flagName, meta] of Object.entries(registry.flags || {})) {
    const sourceFile = meta.sourceFile || 'Js.Core.html';
    const sourceRel = findFileByBasename(repoRoot, path.basename(sourceFile), ['.html']) || sourceFile;
    const sourcePath = path.join(repoRoot, sourceRel);
    if (!fs.existsSync(sourcePath)) {
      errors.push(`${flagName}: source file missing: ${sourceFile}`);
      continue;
    }
    const text = read(sourceFile);

    const def = parseFlagDefault(text, flagName, meta.defaultValue === true);
    if (!def.ok) errors.push(`${flagName}: ${def.reason}`);

    if (!new RegExp(`function\\s+_apiTransport_\\s*\\(`).test(text)) {
      errors.push(`${flagName}: _apiTransport_ not found in ${sourceFile}`);
    }

    const telemetry = meta.telemetryKey || 'gsRun-bridge';
    if (!text.includes(telemetry)) {
      errors.push(`${flagName}: telemetry caller "${telemetry}" not found in ${sourceFile}`);
    }

    warnings.push(...checkSunset(flagName, meta, true));
  }

  checkPreprodScriptPropertyDiagnostics_(errors);

  warnings.forEach((w) => console.warn(`verify-bridge-flags: WARN — ${w}`));

  if (errors.length) {
    console.error('verify-bridge-flags: FAIL');
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }

  if (warnings.length && strict) {
    console.error('verify-bridge-flags: FAIL (BRIDGE_STRICT=1)');
    process.exit(1);
  }

  console.log('verify-bridge-flags: OK');
  const flagCount = Object.keys(registry.flags || {}).length;
  console.log(`  flags: ${flagCount}`);
  console.log('  preprod script-property diagnostics: covered');
}

main();

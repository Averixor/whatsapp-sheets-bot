#!/usr/bin/env node
/**
 * Bridge feature-flag registry enforcement (contracts/bridge-flags.registry.json).
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadContract, repoRoot } from './lib/load-contract.mjs';

const registry = loadContract('bridge-flags.registry.json');
const strict = process.env.BRIDGE_STRICT === '1';

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), 'utf8');
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

function main() {
  const errors = [];
  const warnings = [];

  for (const [flagName, meta] of Object.entries(registry.flags || {})) {
    const sourceFile = meta.sourceFile || 'Js.Core.html';
    const sourcePath = path.join(repoRoot, sourceFile);
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
}

main();

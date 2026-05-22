#!/usr/bin/env node
/**
 * Opt-in: merge live apiStage7DebugAccess() descriptor into access-debug-baseline.json.
 * Does NOT run in default CI. Does NOT invent descriptor data.
 *
 * Capture on canary (Apps Script editor):
 *   apiStage7DebugAccess() → copy data.result (or full response) to a JSON file.
 *
 * Merge into baseline:
 *   ACCESS_DESCRIPTOR_JSON=path/to/capture.json node scripts/bootstrap-access-baseline.mjs
 *
 * Optional: FORCE_BOOTSTRAP=1 to overwrite an existing non-null descriptor.
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadContract, repoRoot } from './lib/load-contract.mjs';
import {
  evalAccessInvariants,
  validateInvariantSchema,
} from './lib/eval-access-invariants.mjs';

const accessContract = loadContract('access.contract.json');
const baselinePath = path.join(repoRoot, accessContract.baselinePath);

function readJson(absPath) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(absPath, 'utf8'));
  } catch (err) {
    throw new Error(`${path.relative(repoRoot, absPath)}: invalid JSON — ${err.message}`);
  }
  return data;
}

function extractDescriptor(capture) {
  if (!capture || typeof capture !== 'object') {
    throw new Error('capture must be a JSON object');
  }
  if (capture.descriptor && typeof capture.descriptor === 'object') {
    return capture.descriptor;
  }
  if (capture.data?.result && typeof capture.data.result === 'object') {
    return capture.data.result;
  }
  if (capture.identity || capture.access) {
    return capture;
  }
  throw new Error(
    'cannot locate descriptor — expected { descriptor }, { data: { result } }, or top-level access/identity fields from apiStage7DebugAccess()',
  );
}

function validateDescriptor(descriptor) {
  const errors = validateInvariantSchema(accessContract.invariants);
  errors.push(...evalAccessInvariants(accessContract.invariants, descriptor));
  return errors;
}

function printUsage() {
  console.log('bootstrap-access-baseline: descriptor capture helper (G1)');
  console.log('');
  console.log('  Live descriptor MUST come from canary apiStage7DebugAccess() — this script');
  console.log('  does not synthesize access policy data.');
  console.log('');
  console.log('  1. In Apps Script (canary spreadsheet): run apiStage7DebugAccess()');
  console.log('  2. Save data.result (or full envelope) to a JSON file');
  console.log('  3. Merge: ACCESS_DESCRIPTOR_JSON=./capture.json node scripts/bootstrap-access-baseline.mjs');
  console.log('');
  console.log(`  Baseline: ${accessContract.baselinePath}`);
  console.log(`  descriptor is currently: ${fs.existsSync(baselinePath) ? (readJson(baselinePath).descriptor == null ? 'null (awaiting capture)' : 'populated') : 'missing file'}`);
  console.log('');
  console.log('  After merge: append contracts/SNAPSHOT_CHANGELOG.md before opening PR.');
}

function main() {
  const capturePath = process.env.ACCESS_DESCRIPTOR_JSON;

  if (!capturePath) {
    printUsage();
    process.exit(0);
  }

  const absCapture = path.isAbsolute(capturePath)
    ? capturePath
    : path.join(process.cwd(), capturePath);
  if (!fs.existsSync(absCapture)) {
    console.error(`bootstrap-access-baseline: capture file not found: ${capturePath}`);
    process.exit(1);
  }

  const capture = readJson(absCapture);
  const descriptor = extractDescriptor(capture);

  const invariantErrors = validateDescriptor(descriptor);
  if (invariantErrors.length) {
    console.error('bootstrap-access-baseline: descriptor failed invariant checks');
    invariantErrors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }

  if (!fs.existsSync(baselinePath)) {
    console.error(`bootstrap-access-baseline: missing ${accessContract.baselinePath}`);
    process.exit(1);
  }

  const baseline = readJson(baselinePath);
  if (baseline.descriptor != null && process.env.FORCE_BOOTSTRAP !== '1') {
    console.error('bootstrap-access-baseline: baseline.descriptor already set');
    console.error('  Set FORCE_BOOTSTRAP=1 to overwrite.');
    process.exit(1);
  }

  baseline.descriptor = descriptor;
  baseline.capturedAt = new Date().toISOString();
  if (!baseline.reviewedAt) {
    baseline.reviewedAt = baseline.capturedAt.slice(0, 10);
  }
  if (!baseline.changeReason || baseline.changeReason.includes('schema-only')) {
    baseline.changeReason = 'canary apiStage7DebugAccess() descriptor capture';
  }

  fs.writeFileSync(baselinePath, JSON.stringify(baseline, null, 2) + '\n');
  console.log(`bootstrap-access-baseline: merged descriptor into ${accessContract.baselinePath}`);
  console.log(`  capturedAt: ${baseline.capturedAt}`);
  console.log('  Next: append contracts/SNAPSHOT_CHANGELOG.md before opening PR.');
}

main();

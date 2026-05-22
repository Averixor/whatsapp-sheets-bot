#!/usr/bin/env node
/**
 * Snapshot governance — CHANGELOG + metadata when scripts/snapshots/*.json change.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { loadContract, repoRoot } from './lib/load-contract.mjs';
import {
  evalAccessInvariants,
  validateInvariantSchema,
} from './lib/eval-access-invariants.mjs';

const CHANGELOG = path.join(repoRoot, 'contracts/SNAPSHOT_CHANGELOG.md');
const SNAPSHOT_GLOB = 'scripts/snapshots/';
const gitExec = {
  cwd: repoRoot,
  encoding: 'utf8',
  shell: process.platform === 'win32' ? process.env.ComSpec || 'cmd.exe' : false,
};

function gitAvailable() {
  try {
    execSync('git rev-parse --git-dir', { ...gitExec, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function changedSnapshotFiles() {
  const base = process.env.CI_BASE_SHA || 'main';
  try {
    const out = execSync(`git diff --name-only ${base}...HEAD -- ${SNAPSHOT_GLOB}`, gitExec).trim();
    if (!out) {
      const unstaged = execSync(`git diff --name-only -- ${SNAPSHOT_GLOB}`, gitExec).trim();
      return unstaged ? unstaged.split('\n').filter(Boolean) : [];
    }
    return out.split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function changelogCovers(files) {
  if (!fs.existsSync(CHANGELOG)) return false;
  const text = fs.readFileSync(CHANGELOG, 'utf8');
  const hasRecentDate = /##\s+\d{4}-\d{2}-\d{2}/.test(text);
  if (!hasRecentDate) return false;
  return files.every((f) => {
    const base = path.basename(f);
    return text.includes(base);
  });
}

function validateSnapshotMeta(fileRel, contract) {
  const errors = [];
  const abs = path.join(repoRoot, fileRel);
  if (!fs.existsSync(abs)) return errors;
  let snap;
  try {
    snap = JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch (err) {
    errors.push(`${fileRel}: invalid JSON — ${err.message}`);
    return errors;
  }

  const metaFields = contract.snapshotMetaFields || ['schemaRef', 'reviewedAt', 'changeReason'];
  metaFields.forEach((field) => {
    if (snap[field] == null || snap[field] === '') {
      errors.push(`${fileRel}: missing or empty "${field}" (required on snapshot mutation)`);
    }
  });

  if (contract === loadContract('access.contract.json')) {
    errors.push(...validateInvariantSchema(contract.invariants));
    if (snap.descriptor) {
      errors.push(...evalAccessInvariants(contract.invariants, snap.descriptor));
    }
  }

  return errors;
}

function main() {
  if (!gitAvailable()) {
    console.log('verify-snapshot-governance: SKIP (no git)');
    process.exit(0);
  }

  const changed = changedSnapshotFiles();
  if (!changed.length) {
    console.log('verify-snapshot-governance: OK (no snapshot changes vs base)');
    process.exit(0);
  }

  const errors = [];
  console.log(`verify-snapshot-governance: ${changed.length} snapshot file(s) changed`);

  if (!changelogCovers(changed)) {
    errors.push(
      'contracts/SNAPSHOT_CHANGELOG.md must have a dated section mentioning each changed snapshot file',
    );
  }

  const facadeContract = loadContract('facade.contract.json');
  const accessContract = loadContract('access.contract.json');

  changed.forEach((fileRel) => {
    if (fileRel.includes('stage7-usecases-facade')) {
      errors.push(...validateSnapshotMeta(fileRel, facadeContract));
    }
    if (fileRel.includes('access-debug-baseline')) {
      errors.push(...validateSnapshotMeta(fileRel, accessContract));
    }
  });

  if (errors.length) {
    console.error('verify-snapshot-governance: FAIL');
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }

  console.log('verify-snapshot-governance: OK');
}

main();

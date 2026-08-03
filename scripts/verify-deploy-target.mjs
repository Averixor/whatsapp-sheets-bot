#!/usr/bin/env node
/**
 * Guard clasp push target: .clasp.json scriptId must match expected staging ID.
 * Does not print full Script IDs. Ukrainian user-facing errors.
 *
 * Usage (CI):
 *   EXPECTED_STAGING_SCRIPT_ID=<id> node scripts/verify-deploy-target.mjs staging
 *
 * Self-test (no env required):
 *   node scripts/verify-deploy-target.mjs --self-test
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT_NAME = 'verify-deploy-target';
const PLACEHOLDER_IDS = new Set([
  'PUT_STAGING_SCRIPT_ID_HERE',
  'PUT_PRODUCTION_SCRIPT_ID_HERE',
  'YOUR_SCRIPT_ID_HERE',
  'SCRIPT_ID',
  'xxx',
  'TODO',
]);

function fail(uaMessage, detail) {
  console.error(`Помилка: ${uaMessage}`);
  if (detail) {
    console.error(`${SCRIPT_NAME}: FAIL — ${detail}`);
  } else {
    console.error(`${SCRIPT_NAME}: FAIL`);
  }
  process.exit(1);
}

function maskId(value) {
  const s = String(value || '');
  if (s.length <= 8) return '(замасковано)';
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

function isPlaceholderOrFake(id) {
  const trimmed = String(id || '').trim();
  if (!trimmed) return true;
  if (PLACEHOLDER_IDS.has(trimmed)) return true;
  if (/^put[_-].*here$/i.test(trimmed)) return true;
  if (/^your[_-]/i.test(trimmed)) return true;
  // Real Apps Script project IDs are long hex-like strings; reject short fakes.
  if (trimmed.length < 20) return true;
  if (/^(test|fake|dummy|example|placeholder)/i.test(trimmed)) return true;
  return false;
}

function readClaspScriptId(claspPath) {
  if (!fs.existsSync(claspPath)) {
    fail(
      'файл .clasp.json не знайдено для перевірки цілі деплою',
      `missing ${path.basename(claspPath)}`,
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(claspPath, 'utf8'));
  } catch (e) {
    fail(
      'не вдалося прочитати .clasp.json',
      `invalid JSON: ${e && e.message ? e.message : e}`,
    );
  }
  const scriptId = parsed && parsed.scriptId != null ? String(parsed.scriptId).trim() : '';
  if (!scriptId) {
    fail('у .clasp.json відсутній scriptId', 'scriptId empty');
  }
  return scriptId;
}

function verifyStagingTarget(cwd) {
  const target = 'staging';
  const claspPath = path.join(cwd, '.clasp.json');
  const expected = String(process.env.EXPECTED_STAGING_SCRIPT_ID || '').trim();

  if (!expected) {
    fail(
      'не задано EXPECTED_STAGING_SCRIPT_ID для staging-середовища',
      'EXPECTED_STAGING_SCRIPT_ID empty',
    );
  }
  if (isPlaceholderOrFake(expected)) {
    fail(
      'EXPECTED_STAGING_SCRIPT_ID містить placeholder або недійсне значення',
      'expected id rejected',
    );
  }

  const actual = readClaspScriptId(claspPath);
  if (isPlaceholderOrFake(actual)) {
    fail(
      'scriptId у .clasp.json є placeholder або недійсним значенням',
      'clasp scriptId rejected',
    );
  }

  if (actual !== expected) {
    fail(
      'цільовий Apps Script не відповідає staging-середовищу',
      `mismatch (clasp ${maskId(actual)} vs expected ${maskId(expected)}; target=${target})`,
    );
  }

  console.log(`${SCRIPT_NAME}: OK (target=${target}, scriptId ${maskId(actual)})`);
}

function runSelfTest() {
  const selfPath = fileURLToPath(import.meta.url);
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wasb-verify-deploy-target-'));
  const goodId = 'a1b2c3d4e5f678901234567890abcdef01234567';
  const otherId = 'f0e1d2c3b4a5968778695a4b3c2d1e0f98765432';

  function writeClasp(dir, scriptId) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, '.clasp.json'),
      JSON.stringify({ scriptId, rootDir: '.' }),
      'utf8',
    );
  }

  function runCase(label, dir, env, expectCode) {
    const result = spawnSync(process.execPath, [selfPath, 'staging'], {
      cwd: dir,
      env: { ...process.env, ...env },
      encoding: 'utf8',
    });
    const code = result.status == null ? 1 : result.status;
    assert.equal(
      code,
      expectCode,
      `${label}: expected exit ${expectCode}, got ${code}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
    if (expectCode !== 0) {
      assert.match(
        result.stderr || '',
        /Помилка:/,
        `${label}: Ukrainian error prefix missing`,
      );
      assert.doesNotMatch(
        result.stderr || '',
        new RegExp(goodId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
        `${label}: must not print full scriptId`,
      );
    }
  }

  try {
    const matchDir = path.join(tmpRoot, 'match');
    writeClasp(matchDir, goodId);
    runCase('match', matchDir, { EXPECTED_STAGING_SCRIPT_ID: goodId }, 0);

    const mismatchDir = path.join(tmpRoot, 'mismatch');
    writeClasp(mismatchDir, otherId);
    runCase('mismatch', mismatchDir, { EXPECTED_STAGING_SCRIPT_ID: goodId }, 1);

    const placeholderDir = path.join(tmpRoot, 'placeholder');
    writeClasp(placeholderDir, 'PUT_STAGING_SCRIPT_ID_HERE');
    runCase(
      'placeholder',
      placeholderDir,
      { EXPECTED_STAGING_SCRIPT_ID: goodId },
      1,
    );

    const missingEnvDir = path.join(tmpRoot, 'missing-env');
    writeClasp(missingEnvDir, goodId);
    runCase('missing-env', missingEnvDir, { EXPECTED_STAGING_SCRIPT_ID: '' }, 1);

    console.log(`${SCRIPT_NAME}: OK (self-test)`);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--self-test')) {
    runSelfTest();
    return;
  }

  const target = String(args[0] || 'staging').trim().toLowerCase();
  if (target !== 'staging') {
    fail(
      `підтримується лише ціль staging (отримано: ${target || '(порожньо)'})`,
      `unsupported target`,
    );
  }

  verifyStagingTarget(process.cwd());
}

main();

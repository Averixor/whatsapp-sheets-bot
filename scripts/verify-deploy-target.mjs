#!/usr/bin/env node
/**
 * Guard clasp push target: .clasp.json scriptId must match expected staging ID.
 * Also validates ~/.clasprc.json and .clasp.json as JSON before clasp runs.
 * Does not print full Script IDs, tokens, or secret bodies. Ukrainian user-facing errors.
 *
 * Usage (CI — write secrets from env, then verify):
 *   CLASPRC_JSON=… CLASP_JSON_STAGING=… EXPECTED_STAGING_SCRIPT_ID=… \
 *     node scripts/verify-deploy-target.mjs configure-staging
 *
 * Usage (CI — files already on disk):
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

/**
 * Format JSON.parse errors without echoing secret contents.
 * Node typically: "Expected ',' or '}' ... in JSON at position N (line L column C)"
 */
function formatJsonParseError(err) {
  const msg = err && err.message ? String(err.message) : String(err);
  const posMatch = msg.match(/position\s+(\d+)/i);
  const lineMatch = msg.match(/line\s+(\d+)/i);
  const colMatch = msg.match(/column\s+(\d+)/i);
  const parts = [];
  if (lineMatch) parts.push(`рядок ${lineMatch[1]}`);
  if (colMatch) parts.push(`колонка ${colMatch[1]}`);
  if (posMatch) parts.push(`позиція ${posMatch[1]}`);
  const where = parts.length ? ` (${parts.join(', ')})` : '';
  const brief = msg
    .replace(/\s+in JSON at position \d+/i, '')
    .replace(/\s*\(line \d+ column \d+\)/i, '')
    .trim();
  return `${brief || 'невалідний JSON'}${where}`;
}

/** Strip UTF-8 BOM; unwrap one level of JSON-string encoding if pasted that way. */
function normalizeSecretJsonText(raw) {
  let text = String(raw).replace(/^\uFEFF/, '');
  const trimmed = text.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      const unwrapped = JSON.parse(trimmed);
      if (typeof unwrapped === 'string') {
        const inner = unwrapped.replace(/^\uFEFF/, '').trim();
        if (inner.startsWith('{') || inner.startsWith('[')) {
          return unwrapped.replace(/^\uFEFF/, '');
        }
      }
    } catch {
      // keep original — parse will report the real error
    }
  }
  return text;
}

/**
 * Parse JSON text for a named secret/file. Never logs the body.
 * @returns {{ ok: true, value: unknown, text: string } | { ok: false, error: string }}
 */
function tryParseJsonLabeled(label, raw) {
  if (raw == null || !String(raw).trim()) {
    return { ok: false, error: `${label}: порожнє значення` };
  }
  const text = normalizeSecretJsonText(raw);
  try {
    const value = JSON.parse(text);
    return { ok: true, value, text };
  } catch (e) {
    return {
      ok: false,
      error: `${label}: ${formatJsonParseError(e)}`,
    };
  }
}

function parseJsonOrFail(label, raw) {
  const result = tryParseJsonLabeled(label, raw);
  if (!result.ok) {
    fail(
      `невалідний JSON у ${label} — ${result.error.replace(/^[^:]+:\s*/, '')}`,
      result.error,
    );
  }
  return result;
}

function readAndParseJsonFile(label, filePath) {
  if (!fs.existsSync(filePath)) {
    fail(
      `файл ${label} не знайдено`,
      `missing ${path.basename(filePath)}`,
    );
  }
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    fail(
      `не вдалося прочитати ${label}`,
      `read failed: ${e && e.message ? e.message : e}`,
    );
  }
  return parseJsonOrFail(label, raw);
}

function clasprcPath() {
  return path.join(os.homedir(), '.clasprc.json');
}

function validateClasprcOnDisk(cwd) {
  void cwd;
  readAndParseJsonFile('~/.clasprc.json (секрет CLASPRC_JSON)', clasprcPath());
}

function readClaspScriptId(claspPath) {
  const parsed = readAndParseJsonFile('.clasp.json (секрет CLASP_JSON_STAGING)', claspPath);
  const scriptId =
    parsed.value && parsed.value.scriptId != null
      ? String(parsed.value.scriptId).trim()
      : '';
  if (!scriptId) {
    fail('у .clasp.json відсутній scriptId', 'scriptId empty');
  }
  return scriptId;
}

function writeSecretFile(filePath, text) {
  fs.writeFileSync(filePath, text, { encoding: 'utf8', mode: 0o600 });
}

/**
 * Write CLASPRC_JSON / CLASP_JSON_STAGING from env via Node (safer than shell printf
 * for multiline / special characters), validate JSON, then verify staging target.
 */
function configureStagingFromEnv(cwd) {
  const clasprcRaw = process.env.CLASPRC_JSON;
  const claspRaw = process.env.CLASP_JSON_STAGING;

  if (clasprcRaw == null || !String(clasprcRaw).trim()) {
    fail(
      'не задано секрет CLASPRC_JSON (вміст ~/.clasprc.json)',
      'CLASPRC_JSON empty',
    );
  }
  if (claspRaw == null || !String(claspRaw).trim()) {
    fail(
      'не задано секрет CLASP_JSON_STAGING (вміст staging .clasp.json)',
      'CLASP_JSON_STAGING empty',
    );
  }

  const clasprcParsed = parseJsonOrFail('секрет CLASPRC_JSON (~/.clasprc.json)', clasprcRaw);
  const claspParsed = parseJsonOrFail(
    'секрет CLASP_JSON_STAGING (.clasp.json)',
    claspRaw,
  );

  writeSecretFile(clasprcPath(), clasprcParsed.text);
  writeSecretFile(path.join(cwd, '.clasp.json'), claspParsed.text);

  console.log(
    `${SCRIPT_NAME}: OK (wrote ~/.clasprc.json and .clasp.json from env; JSON validated)`,
  );
  verifyStagingTarget(cwd);
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

  validateClasprcOnDisk(cwd);

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
  const homeDir = path.join(tmpRoot, 'home');
  fs.mkdirSync(homeDir, { recursive: true });

  function writeClasprc(dir, body) {
    fs.writeFileSync(path.join(dir, '.clasprc.json'), body, 'utf8');
  }

  function writeClasp(dir, scriptId) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, '.clasp.json'),
      JSON.stringify({ scriptId, rootDir: '.' }),
      'utf8',
    );
  }

  function writeValidClasprc(dir) {
    writeClasprc(dir, JSON.stringify({ token: { type: 'authorized_user', access_token: 'x' } }));
  }

  function runCase(label, dir, env, args, expectCode) {
    const result = spawnSync(process.execPath, [selfPath, ...args], {
      cwd: dir,
      env: { ...process.env, HOME: homeDir, ...env },
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
      assert.doesNotMatch(
        result.stderr || '',
        /access_token|refresh_token|ya29\./i,
        `${label}: must not print token material`,
      );
    }
    return result;
  }

  try {
    writeValidClasprc(homeDir);

    const matchDir = path.join(tmpRoot, 'match');
    writeClasp(matchDir, goodId);
    runCase('match', matchDir, { EXPECTED_STAGING_SCRIPT_ID: goodId }, ['staging'], 0);

    const mismatchDir = path.join(tmpRoot, 'mismatch');
    writeClasp(mismatchDir, otherId);
    runCase('mismatch', mismatchDir, { EXPECTED_STAGING_SCRIPT_ID: goodId }, ['staging'], 1);

    const placeholderDir = path.join(tmpRoot, 'placeholder');
    writeClasp(placeholderDir, 'PUT_STAGING_SCRIPT_ID_HERE');
    runCase(
      'placeholder',
      placeholderDir,
      { EXPECTED_STAGING_SCRIPT_ID: goodId },
      ['staging'],
      1,
    );

    const missingEnvDir = path.join(tmpRoot, 'missing-env');
    writeClasp(missingEnvDir, goodId);
    runCase('missing-env', missingEnvDir, { EXPECTED_STAGING_SCRIPT_ID: '' }, ['staging'], 1);

    const badClaspDir = path.join(tmpRoot, 'bad-clasp');
    fs.mkdirSync(badClaspDir, { recursive: true });
    fs.writeFileSync(
      path.join(badClaspDir, '.clasp.json'),
      '{\n  "scriptId": "ok",\n  "rootDir": "."\n  "broken": true\n}\n',
      'utf8',
    );
    const badClasp = runCase(
      'bad-clasp-json',
      badClaspDir,
      { EXPECTED_STAGING_SCRIPT_ID: goodId },
      ['staging'],
      1,
    );
    assert.match(
      badClasp.stderr || '',
      /CLASP_JSON_STAGING|\.clasp\.json/,
      'bad-clasp-json: must name clasp file',
    );

    writeClasprc(
      homeDir,
      '{\n  "token": {\n    "access_token": "x",\n    "refresh_token": "y"\n  }\n  "extra": true\n}\n',
    );
    const badClasprcDir = path.join(tmpRoot, 'bad-clasprc');
    writeClasp(badClasprcDir, goodId);
    const badClasprc = runCase(
      'bad-clasprc-json',
      badClasprcDir,
      { EXPECTED_STAGING_SCRIPT_ID: goodId },
      ['staging'],
      1,
    );
    assert.match(
      badClasprc.stderr || '',
      /CLASPRC_JSON|clasprc/,
      'bad-clasprc-json: must name clasprc file',
    );
    writeValidClasprc(homeDir);

    const configureDir = path.join(tmpRoot, 'configure');
    fs.mkdirSync(configureDir, { recursive: true });
    const configureHome = path.join(tmpRoot, 'configure-home');
    fs.mkdirSync(configureHome, { recursive: true });
    const goodClasprc = JSON.stringify({ token: { type: 'authorized_user' } });
    const goodClasp = JSON.stringify({ scriptId: goodId, rootDir: '.' });
    runCase(
      'configure-staging',
      configureDir,
      {
        HOME: configureHome,
        CLASPRC_JSON: goodClasprc,
        CLASP_JSON_STAGING: goodClasp,
        EXPECTED_STAGING_SCRIPT_ID: goodId,
      },
      ['configure-staging'],
      0,
    );
    assert.ok(fs.existsSync(path.join(configureHome, '.clasprc.json')));
    assert.ok(fs.existsSync(path.join(configureDir, '.clasp.json')));

    const badSecretDir = path.join(tmpRoot, 'bad-secret');
    fs.mkdirSync(badSecretDir, { recursive: true });
    const badSecret = runCase(
      'configure-bad-clasprc',
      badSecretDir,
      {
        HOME: path.join(tmpRoot, 'bad-secret-home'),
        CLASPRC_JSON: '{"token": true\n"oops": 1}',
        CLASP_JSON_STAGING: goodClasp,
        EXPECTED_STAGING_SCRIPT_ID: goodId,
      },
      ['configure-staging'],
      1,
    );
    assert.match(
      badSecret.stderr || '',
      /CLASPRC_JSON/,
      'configure-bad-clasprc: must name CLASPRC_JSON',
    );
    assert.doesNotMatch(
      badSecret.stderr || '',
      /"oops"|token.:/,
      'configure-bad-clasprc: must not dump secret body',
    );

    const doubleEncoded = JSON.stringify(goodClasprc);
    const unwrapDir = path.join(tmpRoot, 'unwrap');
    fs.mkdirSync(unwrapDir, { recursive: true });
    const unwrapHome = path.join(tmpRoot, 'unwrap-home');
    fs.mkdirSync(unwrapHome, { recursive: true });
    runCase(
      'configure-double-encoded-clasprc',
      unwrapDir,
      {
        HOME: unwrapHome,
        CLASPRC_JSON: doubleEncoded,
        CLASP_JSON_STAGING: goodClasp,
        EXPECTED_STAGING_SCRIPT_ID: goodId,
      },
      ['configure-staging'],
      0,
    );

    // Pure helper checks (no spawn)
    const bom = tryParseJsonLabeled('t', `\uFEFF${goodClasp}`);
    assert.equal(bom.ok, true);
    const fmt = formatJsonParseError(
      new Error("Expected ',' or '}' after property value in JSON at position 1873 (line 13 column 4)"),
    );
    assert.match(fmt, /рядок 13/);
    assert.match(fmt, /позиція 1873/);
    assert.doesNotMatch(fmt, /1873 \(line/);

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
  if (target === 'configure-staging') {
    configureStagingFromEnv(process.cwd());
    return;
  }
  if (target !== 'staging') {
    fail(
      `підтримується лише ціль staging або configure-staging (отримано: ${target || '(порожньо)'})`,
      `unsupported target`,
    );
  }

  verifyStagingTarget(process.cwd());
}

main();

#!/usr/bin/env node
/**
 * Contract + behavioral checks for ACCESS temporary password reissue service.
 */

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { readRepoFileByBasename } from "./lib/gas-files.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

function read(file) {
  return readRepoFileByBasename(repoRoot, file, {
    errorPrefix: "verify-access-temp-password-reissue",
  });
}

const reissueSource = read("AccessControl.TempPasswordReissue.gs");
const maintenanceSource = read("Stage7MaintenanceApi.gs");
const publicApiSource = read("AccessControl.PublicApi.gs");

assert.match(reissueSource, /function reissueAccessTemporaryPassword_/);
assert.match(reissueSource, /registration_status = active|status !== "active"/);
assert.match(
  reissueSource,
  /temporary_password_hash|temporary_password_salt|temporary_password_expires_at/,
);
assert.match(reissueSource, /temporary_password_used_at: ""/);
assert.match(reissueSource, /failed_attempts: 0/);
assert.match(reissueSource, /locked_until_ms: 0/);
assert.match(reissueSource, /temporaryPasswordShowOnce: true/);
assert.match(reissueSource, /matchedRowNumber/);
assert.match(reissueSource, /rowsUpdated/);
assert.match(reissueSource, /updatedColumns/);
assert.match(reissueSource, /before[\s\S]*temporary_password_expires_at/);
assert.match(reissueSource, /after[\s\S]*temporary_password_expires_at/);
assert.match(reissueSource, /_verifyAccessTempPasswordReissueWrite_/);
assert.match(reissueSource, /_writeAccessTempPasswordReissueByHeaderMap_/);
assert.match(reissueSource, /_redactAccessTempPasswordColumnsForLog_/);
assert.match(reissueSource, /_getHeaderMap_/);
assert.doesNotMatch(reissueSource, /getRange\([^)]*,\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)/);
assert.doesNotMatch(reissueSource, /updates[\s\S]{0,120}\brole\b/);
assert.match(reissueSource, /maskSensitiveValue_/);
assert.doesNotMatch(reissueSource, /console\.log[\s\S]*password_hash/);
assert.doesNotMatch(reissueSource, /console\.log[\s\S]*updatedColumns\.join/);
assert.match(reissueSource, /redacted-sensitive-access-columns/);
assert.match(maintenanceSource, /function apiStage7ReissueAccessTemporaryPassword/);
assert.match(maintenanceSource, /function apiStage7ReissueOwnerTemporaryPasswordManual/);
assert.match(maintenanceSource, /function _stage7RedactAccessReissueLogMetadata_/);
assert.match(
  maintenanceSource,
  /getScriptProperties\(\)[\s\S]*getProperty\("WASB_OWNER_EMAIL"\)[\s\S]*getProperty\("WASB_OWNER_LOGIN"\)/,
);
assert.match(maintenanceSource, /missingScriptProperties/);
assert.match(maintenanceSource, /changedColumns/);
assert.match(maintenanceSource, /redacted-sensitive-access-columns/);
assert.doesNotMatch(maintenanceSource, /ryabinin\.sergei\.alekseevich@gmail\.com/);
assert.doesNotMatch(maintenanceSource, /login:\s*"ШАХТАР"/);
assert.doesNotMatch(maintenanceSource, /JSON\.stringify\(result,\s*null,\s*2\)/);
assert.doesNotMatch(maintenanceSource, /Logger\.log\(payload\)/);
assert.match(maintenanceSource, /return result;/);
assert.match(maintenanceSource, /reissueAccessTemporaryPassword_/);
assert.match(maintenanceSource, /matchedRowNumber/);
assert.match(maintenanceSource, /rowsUpdated/);
assert.match(publicApiSource, /reissueAccessTemporaryPassword: reissueAccessTemporaryPassword_/);

const math = Object.create(Math);
math.random = () => 0.123456789;

const ownerEntry = {
  sheetRow: 2,
  email: "owner@example.test",
  login: "SHAHTAR",
  personCallsign: "SHAHTAR",
  role: "owner",
  enabled: true,
  registrationStatus: "active",
  userKeyCurrentHash: "a".repeat(64),
  passwordHash: "perm-hash-keep",
  passwordSalt: "perm-salt-keep",
  temporaryPasswordHash: "old-hash-" + "a".repeat(54),
  temporaryPasswordSalt: "old-salt-" + "b".repeat(54),
  temporaryPasswordExpiresAt: "12.06.2026 10:00:00",
  temporaryPasswordUsedAt: "12.06.2026 21:11:46",
  failedAttempts: 3,
  lockedUntilMs: 999999,
};

const captured = {
  updates: null,
  clearedKey: null,
  invalidated: 0,
};

const headerMap = {
  temporary_password_plain: 20,
  temporary_password_hash: 21,
  temporary_password_salt: 22,
  temporary_password_expires_at: 23,
  temporary_password_used_at: 24,
  failed_attempts: 25,
  locked_until_ms: 26,
};

const context = vm.createContext({
  console,
  Date,
  Math: math,
  ACCESS_SHEET: "ACCESS",
  ACCESS_TEMP_PASSWORD_TTL_HOURS: 24,
  LockService: {
    getScriptLock() {
      return {
        waitLock() {},
        releaseLock() {},
      };
    },
  },
  Utilities: {
    DigestAlgorithm: { SHA_256: "SHA_256" },
    Charset: { UTF_8: "UTF_8" },
    getUuid() {
      return "test-uuid";
    },
    computeDigest(_algorithm, value) {
      return Array.from(crypto.createHash("sha256").update(String(value)).digest());
    },
    formatDate(date, _tz, pattern) {
      const d = date instanceof Date ? date : new Date(date);
      const pad = (n) => String(n).padStart(2, "0");
      if (pattern === "yyyy-MM-dd HH:mm:ss") {
        return (
          d.getFullYear() +
          "-" +
          pad(d.getMonth() + 1) +
          "-" +
          pad(d.getDate()) +
          " " +
          pad(d.getHours()) +
          ":" +
          pad(d.getMinutes()) +
          ":" +
          pad(d.getSeconds())
        );
      }
      return d.toISOString();
    },
  },
  _getSheet_() {
    return { getLastColumn() { return 30; } };
  },
  _getHeaderMap_() {
    return headerMap;
  },
  _readSheetEntries_() {
    return [ownerEntry];
  },
  _enrichEntry(entry) {
    return entry;
  },
  _getEntryBySheetRow_(row) {
    if (Number(row) !== ownerEntry.sheetRow) return null;
    if (captured.updates) {
      return Object.assign({}, ownerEntry, {
        temporaryPasswordHash: captured.updates.temporary_password_hash,
        temporaryPasswordSalt: captured.updates.temporary_password_salt,
        temporaryPasswordExpiresAt: captured.updates.temporary_password_expires_at,
        temporaryPasswordUsedAt: captured.updates.temporary_password_used_at,
        failedAttempts: captured.updates.failed_attempts,
        lockedUntilMs: captured.updates.locked_until_ms,
      });
    }
    return Object.assign({}, ownerEntry);
  },
  _setEntryFields_(row, updates) {
    captured.updates = updates;
    return Number(row) === ownerEntry.sheetRow;
  },
  _invalidateAccessRepoCachesSafe_() {
    captured.invalidated += 1;
  },
  _clearSelfBindLoginState_(keyHash) {
    captured.clearedKey = keyHash;
  },
  normalizeEmail_(value) {
    return String(value || "")
      .trim()
      .toLowerCase();
  },
  normalizeCallsign_(value) {
    return String(value || "")
      .trim()
      .toUpperCase();
  },
  maskSensitiveValue_(value) {
    const key = String(value || "").trim();
    if (key.length <= 10) return key;
    return key.slice(0, 6) + "…" + key.slice(-4);
  },
  resolveAccessTemporaryPasswordPlainForPersist_(value) {
    return "";
  },
  sanitizeAccessSecretFieldUpdates_(updates) {
    return Object.assign({}, updates || {});
  },
  formatAccessDateTime_(date) {
    const d = date instanceof Date ? date : new Date(date);
    const pad = (n) => String(n).padStart(2, "0");
    return (
      pad(d.getDate()) +
      "." +
      pad(d.getMonth() + 1) +
      "." +
      d.getFullYear() +
      " " +
      pad(d.getHours()) +
      ":" +
      pad(d.getMinutes()) +
      ":" +
      pad(d.getSeconds())
    );
  },
});

vm.runInContext(
  read("AccessControl.Core.gs").slice(
    read("AccessControl.Core.gs").indexOf("const ACCESS_TEMP_PASSWORD_TTL_HOURS"),
    read("AccessControl.Core.gs").indexOf("function isAccessTempPasswordPlainLookupEnabled_"),
  ),
  context,
  { filename: "AccessControl.Core.password-helpers.gs" },
);
vm.runInContext(reissueSource, context, {
  filename: "AccessControl.TempPasswordReissue.gs",
});

const result = vm.runInContext(
  'reissueAccessTemporaryPassword_({ email: "owner@example.test", login: "SHAHTAR", expectedRole: "owner" })',
  context,
);

assert.equal(result.ok, true);
assert.equal(result.success, true);
assert.equal(result.matchedRowNumber, 2);
assert.equal(result.matchedEmail, "owner@example.test");
assert.equal(result.matchedLogin, "SHAHTAR");
assert.equal(result.matchedRole, "owner");
assert.ok(result.rowsUpdated > 0);
assert.ok(Array.isArray(result.updatedColumns));
assert.ok(result.updatedColumns.includes("temporary_password_hash"));
assert.ok(result.updatedColumns.includes("temporary_password_used_at"));
assert.equal(result.before.temporary_password_expires_at, "12.06.2026 10:00:00");
assert.ok(result.after.temporary_password_expires_at);
assert.notEqual(
  result.after.temporary_password_expires_at,
  result.before.temporary_password_expires_at,
);
assert.equal(result.role, "owner");
assert.match(result.temporaryPassword, /^WASB-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
assert.equal(result.temporaryPasswordShowOnce, true);
assert.ok(result.temporaryPasswordExpiresAt);
assert.equal(captured.clearedKey, ownerEntry.userKeyCurrentHash);
assert.ok(captured.updates);
assert.match(captured.updates.temporary_password_hash, /^[a-f0-9]{64}$/);
assert.match(captured.updates.temporary_password_salt, /^[a-f0-9]{64}$/);
assert.equal(captured.updates.temporary_password_used_at, "");
assert.equal(captured.updates.failed_attempts, 0);
assert.equal(captured.updates.locked_until_ms, 0);
assert.equal(captured.updates.temporary_password_plain, "");
assert.notEqual(captured.updates.temporary_password_hash, ownerEntry.temporaryPasswordHash);
assert.notEqual(captured.updates.temporary_password_salt, ownerEntry.temporaryPasswordSalt);
assert.equal(Object.prototype.hasOwnProperty.call(captured.updates, "role"), false);
assert.equal(Object.prototype.hasOwnProperty.call(captured.updates, "password_hash"), false);
assert.equal(Object.prototype.hasOwnProperty.call(captured.updates, "email"), false);
assert.equal(result.preservedPermanentPassword, true);
assert.ok(captured.invalidated >= 1);

context._readSheetEntries_ = () => [
  Object.assign({}, ownerEntry, { registrationStatus: "pending_review" }),
];
const inactive = vm.runInContext(
  'reissueAccessTemporaryPassword_({ email: "owner@example.test", expectedRole: "owner" })',
  context,
);
assert.equal(inactive.ok, false);
assert.equal(inactive.success, false);
assert.equal(inactive.code, "access.reissue.not_active");

context._readSheetEntries_ = () => [ownerEntry];
context._setEntryFields_ = () => false;
const writeFailed = vm.runInContext(
  'reissueAccessTemporaryPassword_({ email: "owner@example.test", expectedRole: "owner" })',
  context,
);
assert.equal(writeFailed.ok, false);
assert.equal(writeFailed.success, false);
assert.equal(writeFailed.code, "access.reissue.write_failed");
assert.equal(writeFailed.rowsUpdated, 0);

console.log("verify-access-temp-password-reissue: OK");

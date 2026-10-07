#!/usr/bin/env node
/**
 * ACCESS key rebind / OTC / browser-session login paths must stay removed.
 * Allowlist is Google user-key only; admin binds keys in ACCESS.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { readRepoFileByBasename } from "./lib/gas-files.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

function read(file) {
  return readRepoFileByBasename(repoRoot, file, {
    errorPrefix: "verify-access-key-rebind",
  });
}

const authSource = read("AccessControl.AuthResolver.gs");
const publicApiSource = read("AccessControl.PublicApi.gs");
const maintenanceSource = read("Stage7MaintenanceApi.gs");
const redactionSource = read("SecurityRedaction.gs");
const bootSource = read("Js.Security.Boot.html");
const helpersSource = read("Js.Helpers.html");
const loginUiSource = read("Js.Security.Login.html");
const contractPath = path.join(repoRoot, "contracts", "access-api.contract.json");
const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));

assert.match(authSource, /function _isAccessEntryActivationComplete_/);
assert.match(
  authSource,
  /Key allowlist only|userKeyCurrentHash/,
);
assert.doesNotMatch(
  authSource,
  /passwordHash \|\| ""\)\.trim\(\)\) return false/,
);
assert.match(authSource, /function resumeBrowserSession/);
assert.match(authSource, /access\.session\.removed/);
assert.match(authSource, /function loginByAccessKey/);
assert.match(authSource, /access\.login\.removed/);
assert.match(authSource, /function loginByIdentifierAndCallsign/);
assert.match(authSource, /access\.self_bind\.removed/);
assert.match(authSource, /_buildSpreadsheetSharingDescriptor_/);
assert.match(authSource, /spreadsheet-sharing/);
assert.doesNotMatch(
  authSource,
  /Доступ як власник/,
);
assert.match(
  authSource,
  /Вхід і реєстрацію вимкнено\. Доступ через права Google-таблиці/,
);

assert.match(publicApiSource, /resumeBrowserSession:\s*resumeBrowserSession/);
assert.match(maintenanceSource, /function apiStage7ResumeBrowserSession/);
assert.match(loginUiSource, /Реєстрацію та вхід за логіном вимкнено/);
assert.match(helpersSource, /redactSensitiveForLog_/);
assert.match(bootSource, /redactSensitiveForLog_/);
assert.match(redactionSource, /isSensitiveKey/);

const enforcementSource = read("AccessEnforcement.gs");
assert.match(enforcementSource, /SecurityRedaction_\.sanitizeObject/);

assert.ok(contract && typeof contract === "object");

console.log("verify-access-key-rebind: OK (login/self-bind/session rebind removed)");

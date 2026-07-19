#!/usr/bin/env node
/**
 * Contract checks for ACCESS key rebind / OTC recovery / browser session /
 * client+server secret redaction after Google temporary user-key rotation.
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
const coreSource = read("AccessControl.Core.gs");
const repoSource = read("AccessControl.SheetRepository.gs");
const publicApiSource = read("AccessControl.PublicApi.gs");
const maintenanceSource = read("Stage7MaintenanceApi.gs");
const redactionSource = read("SecurityRedaction.gs");
const helpersSource = read("Js.Helpers.html");
const bootSource = read("Js.Security.Boot.html");
const policyUiSource = read("Js.Security.Policy.html");
const apiUiSource = read("Js.Api.html");
const contractPath = path.join(repoRoot, "contracts", "access-api.contract.json");
const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));

assert.match(coreSource, /BROWSER_SESSION_TTL_DAYS/);
assert.match(coreSource, /browser_session_hash/);
assert.match(coreSource, /browser_session_expires_at/);
assert.match(coreSource, /generateAccessBrowserSessionToken_/);
assert.match(coreSource, /hashAccessBrowserSessionToken_/);
assert.match(coreSource, /getAccessBrowserSessionExpiresAt_/);

assert.match(repoSource, /browserSessionHash/);
assert.match(repoSource, /browser_session_hash/);
assert.match(repoSource, /browser_session_expires_at/);

assert.match(authSource, /allowActiveRecovery/);
assert.match(authSource, /temporary_password_recovery/);
assert.match(authSource, /function resumeBrowserSession/);
assert.match(authSource, /_issueBrowserSessionForEntry_/);
assert.match(authSource, /_findAccessEntryByBrowserSession_/);
assert.match(authSource, /_findAccessEntryByLoginAndTemporaryPassword_/);
assert.match(authSource, /consumeTemporaryPassword/);
assert.match(authSource, /recoveryRebind/);
assert.match(authSource, /browserSessionToken/);
assert.match(
  authSource,
  /isActiveRecoveryPath[\s\S]*status === "active" && hasCredentials/,
);
assert.match(
  authSource,
  /Доступ відновлено\. Новий ключ привʼязано до наявного облікового запису/,
);
assert.doesNotMatch(
  authSource,
  /if \(entry\.temporaryPasswordUsedAt && hasCredentials\) return false;/,
);

assert.match(publicApiSource, /resumeBrowserSession:\s*resumeBrowserSession/);
assert.match(maintenanceSource, /function apiStage7ResumeBrowserSession/);
assert.match(apiUiSource, /resumeBrowserSession/);
assert.match(policyUiSource, /resumeBrowserSession/);
assert.match(helpersSource, /saveWasbBrowserSession_/);
assert.match(helpersSource, /readWasbBrowserSession_/);
assert.match(helpersSource, /redactSensitiveForLog_/);
assert.match(bootSource, /redactSensitiveForLog_/);
assert.match(redactionSource, /isSensitiveKey/);
assert.match(redactionSource, /password|accesskey|token|hash|salt/i);

assert.ok(
  Array.isArray(contract.publicEndpoints) &&
    contract.publicEndpoints.includes("apiStage7ResumeBrowserSession"),
  "contract publicEndpoints must include apiStage7ResumeBrowserSession",
);
assert.ok(
  contract.rolePolicyGroups &&
    Array.isArray(contract.rolePolicyGroups.guest) &&
    contract.rolePolicyGroups.guest.includes("apiStage7ResumeBrowserSession"),
  "contract guest rolePolicyGroups must include apiStage7ResumeBrowserSession",
);

assert.doesNotMatch(helpersSource, /JSON\.stringify\(args\.length === 1 \? args\[0\] : args\)/);
assert.match(helpersSource, /redactSensitiveForLog_/);
assert.match(helpersSource, /const preview = JSON\.stringify\(safe\)/);

const packageJson = JSON.parse(
  fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"),
);
assert.match(
  String(packageJson.scripts && packageJson.scripts.ci),
  /verify-access-key-rebind\.mjs/,
);

console.log("verify-access-key-rebind: OK");

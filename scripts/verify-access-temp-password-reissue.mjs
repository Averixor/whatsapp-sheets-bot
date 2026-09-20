#!/usr/bin/env node
/**
 * ACCESS temporary password reissue — must stay removed (no registration).
 */

import assert from "node:assert/strict";
import path from "node:path";
import { readRepoFileByBasename } from "./lib/gas-files.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

function read(file) {
  return readRepoFileByBasename(repoRoot, file, {
    errorPrefix: "verify-access-temp-password-reissue",
  });
}

const reissueSource = read("AccessControl.TempPasswordReissue.gs");
const authSource = read("AccessControl.AuthResolver.gs");
const maintenanceSource = read("Stage7MaintenanceApi.gs");
const publicApiSource = read("AccessControl.PublicApi.gs");

assert.match(reissueSource, /function reissueAccessTemporaryPassword_/);
assert.match(reissueSource, /access\.registration\.removed/);
assert.match(reissueSource, /Тимчасові паролі та їх перевипуск у WASB вимкнено/);

assert.match(authSource, /function registerAccessWithTemporaryPassword/);
assert.match(authSource, /access\.registration\.removed/);
assert.match(authSource, /function loginByAccessKey/);
assert.match(authSource, /access\.login\.removed/);

assert.match(maintenanceSource, /function apiStage7ReissueAccessTemporaryPassword/);
assert.match(publicApiSource, /reissueAccessTemporaryPassword:\s*reissueAccessTemporaryPassword_/);

console.log("verify-access-temp-password-reissue: OK (registration/temp-password removed)");

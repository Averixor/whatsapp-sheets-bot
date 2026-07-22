#!/usr/bin/env node
/**
 * Monthly callsign sync — PERSONNEL callsign/last name → monthly «Позивні» column.
 */
import assert from "node:assert/strict";
import { repoRoot } from "./lib/load-contract.mjs";
import { readRepoFileByBasename } from "./lib/gas-files.mjs";

function monthlyCallsignValueFromPersonnelRow(callsignRaw, lastNameRaw) {
  const callsign = String(callsignRaw ?? "").trim();
  if (callsign) return callsign;
  return String(lastNameRaw ?? "").trim();
}

assert.equal(monthlyCallsignValueFromPersonnelRow("Беркут", "Иванов"), "Беркут");
assert.equal(monthlyCallsignValueFromPersonnelRow("", "Петренко"), "Петренко");
assert.equal(monthlyCallsignValueFromPersonnelRow("Сидор", "Сидоренко"), "Сидор");
assert.equal(monthlyCallsignValueFromPersonnelRow("   ", "Петренко"), "Петренко");
assert.equal(monthlyCallsignValueFromPersonnelRow("", ""), "");
assert.equal(monthlyCallsignValueFromPersonnelRow(null, null), "");

const orderInput = [
  ["A1", "Ln1"],
  ["", "Ln2"],
  ["C3", ""],
];
const orderOutput = orderInput.map(([c, l]) =>
  monthlyCallsignValueFromPersonnelRow(c, l),
);
assert.deepEqual(orderOutput, ["A1", "Ln2", "C3"]);

const syncModule = readRepoFileByBasename(
  repoRoot,
  "MonthlyCallsignSync.gs",
  { errorPrefix: "verify-monthly-callsign-sync" },
);
const personnelMaterialize = readRepoFileByBasename(
  repoRoot,
  "PersonnelMaterialize.gs",
  { errorPrefix: "verify-monthly-callsign-sync" },
);
const monthOps = readRepoFileByBasename(repoRoot, "UseCases.MonthOps.gs", {
  errorPrefix: "verify-monthly-callsign-sync",
});

assert.match(syncModule, /function syncMonthlyCallsignsFromPersonnel_/);
assert.match(syncModule, /function findMonthlyCallsignColumn_/);
assert.match(syncModule, /monthlyCallsignValueFromPersonnelRow_/);
assert.match(syncModule, /targetRange\.setValues\(output\)/);
assert.match(syncModule, /skippedWrite/);
assert.match(syncModule, /Не знайдено аркуш PERSONNEL \/ Персонал/);
assert.match(
  syncModule,
  /Не знайдено колонку позивного \(callsign\) на аркуші особового складу/,
);
assert.match(
  syncModule,
  /Не знайдено колонку "Last name" \/ "Прізвище" на аркуші особового складу/,
);

assert.match(syncModule, /function syncAllMonthlyCallsignsFromPersonnel_/);
assert.match(syncModule, /function syncMonthlyCallsignsForPersonnelUpdate_/);
assert.match(syncModule, /monthlySyncMode === "all"/);
assert.match(syncModule, /return syncActiveMonthlyCallsignsFromPersonnel_/);
assert.match(syncModule, /resolvePersonnelDisplayCallsign_/);
assert.match(personnelMaterialize, /syncMonthlyCallsignsForPersonnelUpdate_/);
assert.doesNotMatch(
  personnelMaterialize,
  /syncAllMonthlyCallsignsFromPersonnel_\(\)/,
  "default personnel materialize must not sync all months",
);
assert.match(monthOps, /syncMonthlyCallsignsFromPersonnel_\(newSheet\)/);

const personnelRepo = readRepoFileByBasename(
  repoRoot,
  "PersonnelRepository.gs",
  { errorPrefix: "verify-monthly-callsign-sync" },
);
assert.match(personnelRepo, /function resolvePersonnelDisplayCallsign_/);
assert.match(
  personnelRepo,
  /"\\u043f\\u043e\\u0437\\u044b\\u0432\\u043d\\u043e\\u0439": "Callsign"/,
);
assert.match(personnelRepo, /фамилия: "LastName"/);

console.log("verify-monthly-callsign-sync: OK");

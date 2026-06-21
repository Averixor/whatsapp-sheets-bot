#!/usr/bin/env node
/**
 * Reference workbook "Книга Взводу Охорони.xlsx" — contract vs code aliases and docs.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { repoRoot } from "./lib/load-contract.mjs";
import { readRepoFileByBasename } from "./lib/gas-files.mjs";

const contractPath = path.join(
  repoRoot,
  "contracts/reference-workbook-layout.contract.json",
);
const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));

const personnelHeaders = contract.sheets.PERSONNEL;
assert.ok(personnelHeaders, "PERSONNEL headers missing in contract");
assert.equal(personnelHeaders.L, "Callsign");
assert.ok(
  !Object.values(personnelHeaders).includes("TEMPLATE"),
  "reference PERSONNEL must not use TEMPLATE column",
);

const expectedPersonnelCanonical = {
  Cells: "",
  "ID v/s": "ID_VS",
  ID: "ID",
  "Last name": "LastName",
  "First name": "FirstName",
  Patronymic: "Patronymic",
  Birthday: "Birthday",
  Age: "Age",
  "Days until birthday": "Days_until_birthday",
  Phone: "Phone",
  "Phone 2": "2_Phone",
  Callsign: "Callsign",
  Rank: "Rank",
  Position: "Position",
  "OSH 4": "OSH_4",
  Status: "Status",
};

const personnelRepo = readRepoFileByBasename(repoRoot, "PersonnelRepository.gs", {
  errorPrefix: "verify-reference-workbook-layout",
});
const ctx = vm.createContext({ CONFIG: { PERSONNEL_SHEET: "PERSONNEL" } });
vm.runInContext(personnelRepo, ctx, { filename: "PersonnelRepository.gs" });

for (const [header, expected] of Object.entries(expectedPersonnelCanonical)) {
  assert.equal(
    ctx._personnelCanonicalHeaderKey_(header),
    expected,
    `PERSONNEL header "${header}"`,
  );
}

const built = ctx._personnelBuildHeaderColIndex_(Object.values(personnelHeaders));
assert.ok(built.Callsign >= 0, "Callsign column index");
assert.ok(built.LastName >= 0, "Last name column index");
assert.ok(built.Rank >= 0, "Rank column index");
assert.equal(built.TEMPLATE, -1, "TEMPLATE must stay unused in reference layout");

assert.equal(contract.sheets["06"].B, "Позивний");
assert.equal(contract.sheets["02"].B, "ПОЗИВНИЙ");

const sheetSchemas = readRepoFileByBasename(repoRoot, "SheetSchemas.gs", {
  errorPrefix: "verify-reference-workbook-layout",
});
assert.match(
  sheetSchemas,
  /Compact monthly layout \(callsign B, BR A, dates from C\)/,
);

const runbook = fs.readFileSync(path.join(repoRoot, "RUNBOOK.md"), "utf8");
assert.doesNotMatch(
  runbook,
  /Callsign carrier: `TEMPLATE`/,
  "RUNBOOK must not claim TEMPLATE is reference callsign carrier",
);
assert.match(runbook, /\*\*L\*\* \| \*\*Callsign\*\*/);
assert.match(runbook, /reference-workbook-layout\.contract\.json/);

const agents = fs.readFileSync(path.join(repoRoot, "AGENTS.md"), "utf8");
assert.doesNotMatch(
  agents,
  /`TEMPLATE` as callsign value/,
  "AGENTS.md must not claim TEMPLATE is reference callsign source",
);

console.log("verify-reference-workbook-layout: OK");

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
assert.equal(personnelHeaders.L, "Email");
assert.equal(personnelHeaders.M, "Callsign");
assert.ok(
  !Object.values(personnelHeaders).includes("TEMPLATE"),
  "reference PERSONNEL must not use TEMPLATE column",
);

const expectedPersonnelCanonical = {
  Cells: "Cells",
  "ID v/s": "ID_VS",
  "ID Army+": "ID",
  "Last name": "LastName",
  "First name": "FirstName",
  Patronymic: "Patronymic",
  Birthday: "Birthday",
  Age: "Age",
  "Days until birthday": "Days_until_birthday",
  Phone: "Phone",
  "Phone 2": "2_Phone",
  Email: "Email",
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
assert.ok(built.Email >= 0, "Email column index");
assert.ok(built.Callsign >= 0, "Callsign column index");
assert.ok(built.LastName >= 0, "Last name column index");
assert.ok(built.Rank >= 0, "Rank column index");
assert.equal(built.TEMPLATE, -1, "TEMPLATE must stay unused in reference layout");

assert.equal(contract.sheets["06"].B, "Позивний");
assert.equal(contract.sheets["02"].B, "ПОЗИВНИЙ");
assert.equal(contract.sheets.PHONE_DIRECTORY.A, "Phone / Section");
assert.equal(contract.sheets.PHONE_DIRECTORY.B, "Name / Note");
assert.equal(contract.sheets.CAR.A, "Callsign");
assert.equal(contract.sheets.CAR.B, "Name of military property");
assert.equal(contract.sheets.CAR.F, "Value");
assert.equal(contract.sheets.CAR.G, "Condition");
assert.equal(contract.sheets.WEAPON.A, "Last name");
assert.equal(contract.sheets.WEAPON.F, "Name of military property");
assert.equal(contract.sheets.WEAPON.K, "Date of assignment");
assert.equal(contract.sheets.WEAPON.U, "Name of military property");

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
assert.match(runbook, /\| L \| Email \|/);
assert.match(runbook, /\| \*\*M\*\* \| \*\*Callsign\*\*/);
assert.match(runbook, /reference-workbook-layout\.contract\.json/);

const agents = fs.readFileSync(path.join(repoRoot, "AGENTS.md"), "utf8");
assert.doesNotMatch(
  agents,
  /`TEMPLATE` as callsign value/,
  "AGENTS.md must not claim TEMPLATE is reference callsign source",
);
assert.match(
  agents,
  /`Callsign` in column M/,
  "AGENTS.md must document Callsign in reference column M",
);
assert.doesNotMatch(
  agents,
  /`Callsign` in column L/,
  "AGENTS.md must not claim Callsign is reference column L",
);
assert.match(
  agents,
  /reference column \*\*Q\*\*/,
  "AGENTS.md must document Status self-heal in reference column Q",
);

const personnelStatusContract = JSON.parse(
  fs.readFileSync(
    path.join(repoRoot, "contracts/personnel-status.contract.json"),
    "utf8",
  ),
);
const statusColLetter = Object.entries(personnelHeaders).find(
  ([, header]) => header === "Status",
)?.[0];
assert.equal(statusColLetter, "Q", "PERSONNEL Status must be column Q");
assert.equal(
  personnelStatusContract.referenceStatusColumn,
  statusColLetter.charCodeAt(0) - 64,
  "personnel-status.contract referenceStatusColumn must match reference layout Status column",
);

console.log("verify-reference-workbook-layout: OK");

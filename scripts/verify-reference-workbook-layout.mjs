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
assert.equal(personnelHeaders.L, "RNTRC");
assert.equal(personnelHeaders.M, "Driver's license");
assert.equal(personnelHeaders.N, "Email");
assert.equal(personnelHeaders.O, "Weapon");
assert.equal(personnelHeaders.P, "Callsign");
assert.equal(personnelHeaders.T, "Status");
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
  RNTRC: "RNTRC",
  "Driver's license": "DriversLicense",
  "Driver's\nlicenseґ": "DriversLicense",
  Email: "Email",
  Weapon: "Weapon",
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
assert.ok(built.RNTRC >= 0, "RNTRC column index");
assert.ok(built.DriversLicense >= 0, "DriversLicense column index");
assert.ok(built.Email >= 0, "Email column index");
assert.ok(built.Weapon >= 0, "Weapon column index");
assert.ok(built.Callsign >= 0, "Callsign column index");
assert.ok(built.LastName >= 0, "Last name column index");
assert.ok(built.Rank >= 0, "Rank column index");
assert.equal(built.Status, 19, "Status must be column T (0-based index 19)");
assert.equal(built.TEMPLATE, -1, "TEMPLATE must stay unused in reference layout");

assert.equal(contract.sheets["06"].B, "Позивний");
assert.equal(contract.sheets["02"].B, "ПОЗИВНИЙ");
assert.equal(contract.sheets["03"].A, "ТЕЛЕФОН");
assert.equal(contract.sheets["03"].C, "ПОСАДА");
assert.equal(contract.sheets["03"].G, "Особовий склад ПІБ");
assert.equal(contract.sheets["05"].AM, "Примітки");
assert.equal(contract.sheets["10"].B, "Позивний");
assert.equal(contract.sheets["10"].AH, "Примітки");
assert.equal(contract.sheets["11"].AF, "46356.0");
assert.equal(contract.sheets.DICT.A, "");
assert.equal(contract.sheets.DICT.B, "");
assert.equal(contract.sheets.DICT.C, "Місце");
assert.equal(contract.sheets.DICT.D, "Завдання");
assert.equal(contract.sheets.Expense_BK.A, "Date");
assert.equal(contract.sheets.Expense_BK.D, "Number");
assert.equal(contract.sheets.SN_AIRCRAFT.A, "AUTEL 4N");
assert.equal(contract.sheets.SN_AIRCRAFT.D, "AUTEL 4T");
assert.equal(contract.sheets.SN_AIRCRAFT.G, "MATRICE 4T");
assert.equal(contract.sheets.PHONE_DIRECTORY.A, "Phone / Section");
assert.equal(contract.sheets.PHONE_DIRECTORY.B, "Name / Note");
assert.equal(contract.sheets.CAR.A, "Callsign");
assert.equal(contract.sheets.CAR.B, "Name of military property");
assert.equal(contract.sheets.CAR.F, "Value");
assert.equal(contract.sheets.CAR.G, "Condition");
assert.equal(contract.sheets.CAR.H, "Callsign");
assert.equal(contract.sheets.WEAPON.A, "Last name");
assert.equal(contract.sheets.WEAPON.F, "Name of military property");
assert.equal(contract.sheets.WEAPON.K, "Date of assignment");
assert.equal(contract.sheets.WEAPON.M, "");
assert.equal(contract.sheets.WEAPON.N, "Name of military property");
assert.equal(contract.sheets.WEAPON.T, "Location");
assert.equal(contract.sheets.WEAPON.U, "");
assert.equal(contract.sheets.WEAPON.AA, "Callsign");
assert.ok(
  !Object.prototype.hasOwnProperty.call(contract.sheets.WEAPON, "V") ||
    contract.sheets.WEAPON.V === "",
  "reference WEAPON must not declare a third property block starting at V",
);
assert.equal(contract.sheets.DICT_SUM.A, "Code");
assert.equal(contract.sheets.DICT_SUM.C, "Order");
assert.ok(!Object.prototype.hasOwnProperty.call(contract.sheets.DICT_SUM, "F"));
assert.match(
  String(contract.sourceFile || ""),
  /Книга Взводу Охорони/,
  "sourceFile must name the reference workbook",
);

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
assert.match(runbook, /\| L \| RNTRC \|/);
assert.match(runbook, /\| M \| Driver's license \|/);
assert.match(runbook, /\| N \| Email \|/);
assert.match(runbook, /\| O \| Weapon \|/);
assert.match(runbook, /\| \*\*P\*\* \| \*\*Callsign\*\*/);
assert.match(runbook, /\| T \| Status \|/);
assert.match(runbook, /reference-workbook-layout\.contract\.json/);

const agents = fs.readFileSync(path.join(repoRoot, "AGENTS.md"), "utf8");
assert.doesNotMatch(
  agents,
  /`TEMPLATE` as callsign value/,
  "AGENTS.md must not claim TEMPLATE is reference callsign source",
);
assert.match(
  agents,
  /`Callsign` in column P/,
  "AGENTS.md must document Callsign in reference column P",
);
assert.doesNotMatch(
  agents,
  /`Callsign` in column N/,
  "AGENTS.md must not claim Callsign is reference column N",
);
assert.match(
  agents,
  /reference column \*\*T\*\*/,
  "AGENTS.md must document Status self-heal in reference column T",
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
assert.equal(statusColLetter, "T", "PERSONNEL Status must be column T");
assert.equal(
  personnelStatusContract.referenceStatusColumn,
  statusColLetter.charCodeAt(0) - 64,
  "personnel-status.contract referenceStatusColumn must match reference layout Status column",
);

console.log("verify-reference-workbook-layout: OK");

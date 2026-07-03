#!/usr/bin/env node
/**
 * Month journal materialize — module, API, sidebar, access contract.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadContract, repoRoot } from "./lib/load-contract.mjs";
import { readRepoFileByBasename } from "./lib/gas-files.mjs";

const contract = loadContract("month-journal.contract.json");
const accessContract = JSON.parse(
  readFileSync(`${repoRoot}/contracts/access-api.contract.json`, "utf8"),
);

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const journal = readRepoFileByBasename(repoRoot, "MonthJournalMaterialize.gs", {
  errorPrefix: "verify-month-journal-materialize",
});
const maintenanceApi = readRepoFileByBasename(
  repoRoot,
  "Stage7MaintenanceApi.gs",
  { errorPrefix: "verify-month-journal-materialize" },
);
const metadata = readRepoFileByBasename(repoRoot, "ProjectMetadata.gs", {
  errorPrefix: "verify-month-journal-materialize",
});
const routing = readRepoFileByBasename(repoRoot, "RoutingRegistry.gs", {
  errorPrefix: "verify-month-journal-materialize",
});
const sidebar = readRepoFileByBasename(repoRoot, "Sidebar.html", {
  errorPrefix: "verify-month-journal-materialize",
});
const guards = readRepoFileByBasename(repoRoot, "Js.Security.Guards.html", {
  errorPrefix: "verify-month-journal-materialize",
});
const apiClient = readRepoFileByBasename(repoRoot, "Js.Api.html", {
  errorPrefix: "verify-month-journal-materialize",
});

assert.match(journal, /function materializeMonthJournal_/);
assert.match(journal, /function materializeMonthPersonSummary_/);
assert.match(journal, /function materializeMonthJournalBundle_/);
assert.match(journal, /function buildMonthJournalCompressedSummary_/);
assert.match(journal, /function findMonthlyNotesCol_/);

contract.journalHeaders.forEach((header) => {
  assert.match(journal, new RegExp(escapeRegExp(header)));
});
contract.summaryBaseHeaders.forEach((header) => {
  assert.match(journal, new RegExp(escapeRegExp(header)));
});
contract.notesHeaderMatchers.forEach((matcher) => {
  assert.match(journal, new RegExp(escapeRegExp(matcher)));
});
contract.dependencies.forEach((dependency) => {
  assert.match(journal, new RegExp(escapeRegExp(dependency)));
});
assert.match(
  journal,
  new RegExp(escapeRegExp(contract.derivedSheetNames.journalPrefix)),
);
assert.match(
  journal,
  new RegExp(escapeRegExp(contract.derivedSheetNames.summaryPrefix)),
);
assert.match(journal, new RegExp(escapeRegExp(contract.unknownCodeLabel)));

if (contract.personnelPolicy?.mode === "read-only-lookup") {
  const sheet = contract.personnelPolicy.forbidWritesToSheet;
  assert.doesNotMatch(
    journal,
    new RegExp(
      `${escapeRegExp(sheet)}.*setValues|getSheetByName\\("${escapeRegExp(sheet)}"\\)[\\s\\S]*setValues`,
    ),
  );
}

assert.match(
  maintenanceApi,
  new RegExp(`function ${escapeRegExp(contract.api.functionName)}`),
);
assert.match(maintenanceApi, /resolveMonthJournalSheetName_/);
assert.match(
  maintenanceApi,
  new RegExp(escapeRegExp(contract.api.emptyMonthMessage)),
);

assert.match(metadata, new RegExp(escapeRegExp(contract.api.functionName)));
assert.match(
  metadata,
  new RegExp(`${escapeRegExp(contract.api.routingAction)}:`),
);
assert.match(
  routing,
  new RegExp(`${escapeRegExp(contract.api.routingAction)}:`),
);

if (contract.api.publicEndpoint) {
  assert.ok(accessContract.publicEndpoints.includes(contract.api.functionName));
}
assert.ok(
  accessContract.rolePolicyGroups[contract.api.minRole].includes(
    contract.api.functionName,
  ),
);

assert.match(
  sidebar,
  new RegExp(escapeRegExp(contract.sidebar.buttonLabel)),
);
assert.match(
  sidebar,
  new RegExp(escapeRegExp(contract.sidebar.action)),
);
assert.match(
  guards,
  new RegExp(
    `${escapeRegExp(contract.sidebar.action)}:\\s*"${escapeRegExp(contract.api.minRole)}"`,
  ),
);
assert.match(
  apiClient,
  new RegExp(escapeRegExp(contract.sidebar.action)),
);

console.log(
  `verify-month-journal-materialize: OK (${contract.sidebar.buttonLabel})`,
);

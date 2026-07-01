#!/usr/bin/env node
/**
 * Month journal materialize — module, API, sidebar, access contract.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { repoRoot } from "./lib/load-contract.mjs";
import { readRepoFileByBasename } from "./lib/gas-files.mjs";

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
const accessContract = JSON.parse(
  readFileSync(
    `${repoRoot}/contracts/access-api.contract.json`,
    "utf8",
  ),
);

assert.match(journal, /function materializeMonthJournal_/);
assert.match(journal, /function materializeMonthPersonSummary_/);
assert.match(journal, /function materializeMonthJournalBundle_/);
assert.match(journal, /function buildMonthJournalCompressedSummary_/);
assert.match(journal, /function findMonthlyNotesCol_/);
assert.match(journal, /getPersonnelByCallsignAnyStatus_/);
assert.match(journal, /readDictSum_/);
assert.match(journal, /loadDictMap_/);
assert.match(journal, /ЖУРНАЛ_/);
assert.match(journal, /ПІДСУМОК_/);
assert.match(journal, /Невідомий код/);
assert.doesNotMatch(journal, /PERSONNEL.*setValues|getSheetByName\("PERSONNEL"\)[\s\S]*setValues/);

assert.match(maintenanceApi, /function apiStage7MaterializeMonthJournal/);
assert.match(maintenanceApi, /resolveMonthJournalSheetName_/);
assert.match(maintenanceApi, /Відкрийте місячний аркуш 01–12/);

assert.match(metadata, /apiStage7MaterializeMonthJournal/);
assert.match(metadata, /materializeMonthJournal:/);
assert.match(routing, /materializeMonthJournal:/);

assert.ok(
  accessContract.publicEndpoints.includes("apiStage7MaterializeMonthJournal"),
);
assert.ok(
  accessContract.rolePolicyGroups.maintainer.includes(
    "apiStage7MaterializeMonthJournal",
  ),
);

const sidebar = readRepoFileByBasename(repoRoot, "Sidebar.html", {
  errorPrefix: "verify-month-journal-materialize",
});
const guards = readRepoFileByBasename(repoRoot, "Js.Security.Guards.html", {
  errorPrefix: "verify-month-journal-materialize",
});
const apiClient = readRepoFileByBasename(repoRoot, "Js.Api.html", {
  errorPrefix: "verify-month-journal-materialize",
});

assert.match(sidebar, /Оновити журнал місяця/);
assert.match(sidebar, /materializeMonthJournal/);
assert.match(guards, /materializeMonthJournal:\s*"maintainer"/);
assert.match(apiClient, /materializeMonthJournal/);

console.log("verify-month-journal-materialize: OK");

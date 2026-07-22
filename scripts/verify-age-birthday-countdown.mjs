#!/usr/bin/env node
/**
 * PERSONNEL Birthday / Age / Days until birthday display formatting.
 */
import assert from "node:assert/strict";
import vm from "node:vm";
import { repoRoot } from "./lib/load-contract.mjs";
import { readRepoFileByBasename } from "./lib/gas-files.mjs";

function loadFormatContext() {
  const ctx = vm.createContext({
    CONFIG: { TZ: "Europe/Kyiv" },
    DateUtils_: {},
  });
  vm.runInContext(
    readRepoFileByBasename(repoRoot, "DateUtils.gs", {
      errorPrefix: "verify-age-birthday-countdown",
    }),
    ctx,
    { filename: "DateUtils.gs" },
  );
  vm.runInContext(
    readRepoFileByBasename(repoRoot, "PersonnelMaterialize.gs", {
      errorPrefix: "verify-age-birthday-countdown",
    }),
    ctx,
    { filename: "PersonnelMaterialize.gs" },
  );
  assert.equal(typeof ctx.formatBirthdayCell_, "function");
  assert.equal(typeof ctx.formatAgeCell_, "function");
  assert.equal(typeof ctx.calculateBirthdayCountdownUa_, "function");
  assert.equal(typeof ctx.parseBirthdayValue_, "function");
  return ctx;
}

const formatCtx = loadFormatContext();
const {
  formatBirthdayCell_,
  formatAgeCell_,
  calculateBirthdayCountdownUa_,
  parseBirthdayValue_,
} = formatCtx;
const TODAY = new Date(2026, 5, 20); // 20.06.2026 local

assert.equal(formatBirthdayCell_(""), "");
assert.equal(formatBirthdayCell_(null), "");
assert.equal(formatBirthdayCell_("not-a-date"), "");
assert.equal(formatBirthdayCell_("31.02.2026"), "");
assert.equal(formatBirthdayCell_("20.09.2000"), "20.09.2000 р. н.");
assert.equal(formatBirthdayCell_("20.09.2000 р."), "20.09.2000 р. н.");
assert.equal(formatBirthdayCell_("20.09.2000 р. н."), "20.09.2000 р. н.");
assert.equal(formatBirthdayCell_("20.09.2000 р. р."), "20.09.2000 р. н.");

assert.equal(formatAgeCell_(""), "");
assert.equal(formatAgeCell_(null), "");
assert.equal(formatAgeCell_(25), "25 р.");
assert.equal(formatAgeCell_("25 р."), "25 р.");
assert.equal(formatAgeCell_("25 р. р."), "25 р.");

assert.equal(calculateBirthdayCountdownUa_("", TODAY), "");
assert.equal(calculateBirthdayCountdownUa_("not-a-date", TODAY), "");
assert.equal(
  calculateBirthdayCountdownUa_("20.09.2000", TODAY),
  "3 м.",
  "birthday later this year",
);
assert.equal(
  calculateBirthdayCountdownUa_("20.06.2000", TODAY),
  "Сьогодні",
  "birthday today",
);
assert.notEqual(
  calculateBirthdayCountdownUa_("20.06.2000", TODAY),
  "0 м. 0 д.",
  "today must not show zero countdown",
);
assert.equal(
  calculateBirthdayCountdownUa_("27.06.2000", TODAY),
  "7 д.",
  "less than one month: omit zero months",
);
assert.equal(
  calculateBirthdayCountdownUa_("24.06.2000", TODAY),
  "4 д.",
  "less than one month: omit zero months",
);
assert.equal(
  calculateBirthdayCountdownUa_("21.06.2000", TODAY),
  "1 д.",
  "less than one month: omit zero months",
);
assert.equal(
  calculateBirthdayCountdownUa_("20.01.2000", TODAY),
  "7 м.",
  "birthday already passed this year",
);
assert.equal(
  calculateBirthdayCountdownUa_(
    vm.runInContext("new Date(2000, 8, 20)", formatCtx),
    TODAY,
  ),
  "3 м.",
  "Date object input",
);
assert.equal(
  calculateBirthdayCountdownUa_("23.07.2000", TODAY),
  "1 м. 3 д.",
  "months and days both shown when non-zero",
);
assert.equal(
  calculateBirthdayCountdownUa_("29.02.2000", TODAY),
  "8 м. 9 д.",
  "Feb 29 birth date uses JS Date rollover (non-leap year → Mar 1 anchor)",
);

const invalidUaDate = vm.runInContext('new Date("20.09.2000")', formatCtx);
assert.equal(
  Number.isNaN(invalidUaDate.getTime()),
  true,
  "UA text must not be parsed via new Date(string)",
);
assert.equal(
  formatBirthdayCell_("20.09.2000"),
  "20.09.2000 р. н.",
  "parseBirthdayValue handles dd.mm.yyyy text",
);

const personnelRepo = readRepoFileByBasename(
  repoRoot,
  "PersonnelRepository.gs",
  { errorPrefix: "verify-age-birthday-countdown" },
);
const personnelMaterialize = readRepoFileByBasename(
  repoRoot,
  "PersonnelMaterialize.gs",
  { errorPrefix: "verify-age-birthday-countdown" },
);
const sheetSchemas = readRepoFileByBasename(repoRoot, "SheetSchemas.gs", {
  errorPrefix: "verify-age-birthday-countdown",
});

assert.match(personnelMaterialize, /function formatBirthdayCell_/);
assert.match(personnelMaterialize, /function calculateBirthdayCountdownUa_/);
assert.match(personnelMaterialize, /birthdayColumnsFormattedRows/);
assert.match(personnelMaterialize, /_personnelMaterializeRange_/);
assert.match(personnelMaterialize, /_personnelMaterializeClearHelperFormulas_/);
assert.match(personnelMaterialize, /col\.Birthday/);
assert.match(personnelMaterialize, /col\.Days_until_birthday/);
assert.doesNotMatch(
  personnelMaterialize,
  /Age_and_birthday_countdown|PERSONNEL_AGE_BIRTHDAY_COUNTDOWN_HEADER_UA_/,
);
assert.doesNotMatch(personnelMaterialize, /ageBirthdayCountdown/);
assert.doesNotMatch(
  personnelMaterialize,
  /_personnelMaterializeEnsureAgeBirthdayCountdownColumn_/,
);
assert.doesNotMatch(personnelRepo, /Age_and_birthday_countdown/);
assert.doesNotMatch(sheetSchemas, /Age_and_birthday_countdown/);

console.log("verify-age-birthday-countdown: OK");

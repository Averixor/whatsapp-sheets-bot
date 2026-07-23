#!/usr/bin/env node
/**
 * Temporary-property register contract checks without Google Apps Script.
 */
import assert from "node:assert/strict";
import path from "node:path";
import vm from "node:vm";
import { readRepoFileByBasename } from "./lib/gas-files.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const source = readRepoFileByBasename(repoRoot, "TemporaryPropertyRegister.gs", {
  errorPrefix: "verify-temporary-property-register",
});

const context = vm.createContext({
  console,
  Date,
  Math,
  CONFIG: {},
});
vm.runInContext(source, context, { filename: "TemporaryPropertyRegister.gs" });
const register = vm.runInContext("TemporaryPropertyRegister_", context);

assert.deepEqual(
  Array.from(register.HEADERS),
  [
    "Позивний",
    "Пост / об'єкт",
    "Вид майна",
    "Найменування / модель",
    "Видано",
    "Од. обліку",
    "Дата видачі",
    "Повернуто",
    "Дата повернення",
    "Залишок",
    "Статус",
    "Вид палива",
    "Об'єм палива, л",
    "Комплектність / примітка",
    "ID запису",
    "ID комплекту",
    "Батьківський ID",
    "Тип рядка",
    "Код майна",
    "Авто-рядок",
  ],
  "working-sheet headers must stay in the agreed order",
);

const catalog = Array.from(register.getCatalogSeed(), (row) => Array.from(row));
const byCode = Object.fromEntries(catalog.map((row) => [row[0], row]));
[
  "BUREVII_RV_M7",
  "WORKMATE_WM_S8",
  "STARLINK_GEN2",
  "DELL_VOSTRO_3501",
  "MOTOROLA_DP4400E",
  "MOTOROLA_R7AN",
  "RADIO_CHARGER",
  "FUEL_CAN",
  "AUTEL_BATTERY_4T4N",
  "ROC4_SIGNAL_KIT",
  "AUTEL_EVO_MAX_4N",
  "BATTERY_4S1P",
  "TOOLKITRC_Q6",
].forEach((code) => assert.ok(byCode[code], `catalog must contain ${code}`));

assert.equal(byCode.MOTOROLA_DP4400E[3], "шт.");
assert.equal(byCode.MOTOROLA_R7AN[3], "шт.");
assert.equal(byCode.RADIO_CHARGER[3], "компл.");
assert.equal(byCode.FUEL_CAN[5], "Так");
assert.match(byCode.RADIO_CHARGER[7], /універсаль/i);

const kits = Array.from(register.getKitSeed(), (row) => Array.from(row));
const componentsFor = (parentCode) =>
  kits.filter((row) => row[0] === parentCode).map((row) => row[4]);

assert.deepEqual(componentsFor("MOTOROLA_DP4400E"), [
  "DP4400E_SPIDER_ADAPTER",
  "DP4400E_SPIDER",
]);
assert.deepEqual(componentsFor("MOTOROLA_R7AN"), [
  "R7AN_ANTENNA",
  "R7AN_EXTRA_BATTERY",
]);
assert.deepEqual(componentsFor("RADIO_CHARGER"), [
  "RADIO_CHARGING_CUP",
  "RADIO_POWER_SUPPLY",
]);
assert.deepEqual(componentsFor("STARLINK_GEN2"), [
  "STARLINK_CABLE",
  "STARLINK_ROUTER",
  "STARLINK_STAND",
]);
assert.deepEqual(componentsFor("BUREVII_RV_M7"), ["BUREVII_CHARGING_CABLE"]);
assert.deepEqual(componentsFor("DELL_VOSTRO_3501"), ["DELL_CHARGING_CABLE"]);

assert.deepEqual(
  JSON.parse(JSON.stringify(register.calculateOwnStatus(1, 0))),
  { issued: 1, returned: 0, balance: 1, status: "НЕ ПОВЕРНУТО" },
);
assert.deepEqual(
  JSON.parse(JSON.stringify(register.calculateOwnStatus(2, 1))),
  { issued: 2, returned: 1, balance: 1, status: "ЧАСТКОВО ПОВЕРНУТО" },
);
assert.deepEqual(
  JSON.parse(JSON.stringify(register.calculateOwnStatus(1, 1))),
  { issued: 1, returned: 1, balance: 0, status: "ПОВЕРНУТО" },
);

assert.equal(register.parseLegacyProperty("DP40 - 1 шт.").code, "MOTOROLA_DP4400E");
assert.equal(register.parseLegacyProperty("R7a - 2 шт.").code, "MOTOROLA_R7AN");
assert.equal(register.parseLegacyProperty("Зарядка - 1 к-т.").code, "RADIO_CHARGER");
assert.equal(register.parseLegacyProperty("Каністра бензину - 1 шт. (20 л)").code, "FUEL_CAN");
assert.equal(register.parseLegacyProperty("Подовжувач - 1 шт. (жовтий)").code, "EXT_YELLOW");

assert.match(source, /function apiSetupTemporaryPropertyRegister\(\)/);
assert.match(source, /backupLegacySheet_/);
assert.match(source, /TemporaryPropertyRegister_\.handleEdit/);
assert.match(source, /withEventSpreadsheet_/);
assert.match(source, /e\.source/);
assert.match(source, /function apiRefreshTemporaryPropertyRegister\(\)/);

console.log("Temporary-property register contract: OK");

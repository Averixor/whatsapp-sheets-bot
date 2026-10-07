#!/usr/bin/env node
/**
 * External spreadsheet registry — routing contract, storage-mode gate, grep guards.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { loadContract, repoRoot } from "./lib/load-contract.mjs";
import { walkRepoFiles } from "./lib/gas-files.mjs";

const contract = loadContract("external-spreadsheets.contract.json");
const registryPath = path.join(repoRoot, "data/ExternalSpreadsheets.gs");
const registrySource = readFileSync(registryPath, "utf8");
const migrationSource = readFileSync(
  path.join(repoRoot, "operations/ExternalSpreadsheetMigration.gs"),
  "utf8",
);
const apiSource = readFileSync(
  path.join(repoRoot, "api/Stage7MaintenanceApi.gs"),
  "utf8",
);

assert.equal(contract.sheets.length, 17, "contract must list exactly 17 external sheets");

const ids = contract.sheets.map((row) => row.spreadsheetId);
assert.equal(new Set(ids).size, ids.length, "spreadsheet IDs must be unique");
assert.ok(
  !ids.includes(contract.mainWorkbookId),
  "no external ID may equal the main workbook ID",
);

const names = contract.sheets.map((row) => row.logicalName);
assert.equal(new Set(names).size, names.length, "logical names must be unique");
for (const stay of contract.mustStayInMain) {
  assert.ok(!names.includes(stay), `${stay} must stay in the main workbook`);
}

const spreadsheetStore = Object.create(null);
const openByIdCalls = [];
const scriptProps = Object.create(null);
const lockState = { held: false };
const auditRecords = [];
scriptProps.WASB_SPREADSHEET_ID = contract.mainWorkbookId;

function fakeSheet(name, initial) {
  const st = {
    lastRow: (initial && initial.lastRow) || 0,
    lastCol: (initial && initial.lastCol) || 0,
    filled: !!(initial && initial.filled),
  };
  return {
    getName() {
      return name;
    },
    getSheetId() {
      return name;
    },
    getLastRow() {
      return st.lastRow;
    },
    getLastColumn() {
      return st.lastCol;
    },
    getRange() {
      const grid = [];
      if (st.lastRow && st.filled) {
        for (let r = 0; r < st.lastRow; r++) {
          grid.push(Array(Math.max(st.lastCol, 1)).fill(r === 0 ? "Header" : "x"));
        }
      }
      return {
        getValues() {
          return grid;
        },
        getFormulas() {
          return grid.map((row) => row.map(() => ""));
        },
        getDisplayValues() {
          return grid.length ? grid : [[]];
        },
        getA1Notation() {
          return "A1";
        },
      };
    },
    setName(next) {
      name = next;
      return this;
    },
    setFilled(rows, cols) {
      st.lastRow = rows;
      st.lastCol = cols;
      st.filled = rows > 0;
    },
    copyTo(targetSs) {
      return targetSs.insertSheet(name, {
        lastRow: st.lastRow,
        lastCol: st.lastCol,
        filled: st.filled,
      });
    },
    isSheetHidden() {
      return false;
    },
    hideSheet() {},
  };
}

function fakeSpreadsheet(id, sheetNames) {
  const sheets = (sheetNames || ["Аркуш1"]).map((sheetName) => fakeSheet(sheetName));
  return {
    getId() {
      return id;
    },
    getSheets() {
      return sheets.slice();
    },
    getSheetByName(wanted) {
      return sheets.find((sheet) => sheet.getName() === wanted) || null;
    },
    insertSheet(sheetName, state) {
      const sheet = fakeSheet(sheetName, state);
      sheets.push(sheet);
      return sheet;
    },
    deleteSheet(sheet) {
      const idx = sheets.indexOf(sheet);
      if (idx >= 0) sheets.splice(idx, 1);
    },
  };
}

const mainId = contract.mainWorkbookId;
const mainSheetNames = [
  "PERSONNEL",
  "VACATIONS",
  "DICT",
  "DICT_SUM",
  "08",
  "OPS_LOG_2026_07",
  "CHECKPOINTS_2026_08",
].concat(names);
spreadsheetStore[mainId] = fakeSpreadsheet(mainId, mainSheetNames);

contract.sheets.forEach((row) => {
  const extra =
    row.logicalName === "OPS_LOG"
      ? ["OPS_LOG_2026_07"]
      : row.logicalName === "CHECKPOINTS"
        ? ["CHECKPOINTS_2026_08"]
        : [];
  spreadsheetStore[row.spreadsheetId] = fakeSpreadsheet(
    row.spreadsheetId,
    [row.sheetName].concat(extra),
  );
});

const context = vm.createContext({
  console,
  Date,
  JSON,
  Math,
  Object,
  Array,
  String,
  Number,
  RegExp,
  PropertiesService: {
    getScriptProperties() {
      return {
        getProperty(key) {
          return Object.prototype.hasOwnProperty.call(scriptProps, key)
            ? scriptProps[key]
            : "";
        },
        setProperty(key, value) {
          scriptProps[key] = String(value == null ? "" : value);
        },
        deleteProperty(key) {
          delete scriptProps[key];
        },
      };
    },
  },
  LockService: {
    getScriptLock() {
      return {
        tryLock() {
          if (lockState.held) return false;
          lockState.held = true;
          return true;
        },
        releaseLock() {
          lockState.held = false;
        },
        hasLock() {
          return lockState.held;
        },
      };
    },
  },
  Utilities: {
    DigestAlgorithm: { SHA_256: "SHA_256" },
    computeDigest(_algo, payload) {
      return Array.from(createHash("sha256").update(String(payload)).digest());
    },
  },
  Stage7AuditTrail_: {
    record(entry) {
      auditRecords.push(entry);
      return { success: true, written: 1 };
    },
  },
  withScriptLock_(callback, timeoutMs) {
    const lock = {
      tryLock() {
        if (lockState.held) return false;
        lockState.held = true;
        return true;
      },
      releaseLock() {
        lockState.held = false;
      },
    };
    if (!lock.tryLock()) {
      throw new Error("Не вдалося отримати script lock за " + (timeoutMs || 0) + " мс");
    }
    try {
      return callback();
    } finally {
      lock.releaseLock();
    }
  },
  SpreadsheetApp: {
    openById(id) {
      openByIdCalls.push(id);
      if (id === "missing-id") {
        throw new Error("not found");
      }
      const ss = spreadsheetStore[id];
      if (!ss) throw new Error("unknown spreadsheet " + id);
      return ss;
    },
    getActiveSpreadsheet() {
      return spreadsheetStore[mainId];
    },
  },
  getWasbSpreadsheetId_() {
    return mainId;
  },
  getWasbSpreadsheet_() {
    return spreadsheetStore[mainId];
  },
});

vm.runInContext(registrySource, context, { filename: "ExternalSpreadsheets.gs" });
vm.runInContext(migrationSource, context, {
  filename: "ExternalSpreadsheetMigration.gs",
});

assert.equal(context.WASB_MAIN_WORKBOOK_ID_, contract.mainWorkbookId);

function resetModeCache() {
  context.invalidateExternalStorageRuntimeCache_();
}

function setRawMode(value) {
  if (value == null) {
    delete scriptProps.WASB_EXTERNAL_STORAGE_MODE;
  } else {
    scriptProps.WASB_EXTERNAL_STORAGE_MODE = value;
  }
  resetModeCache();
}

function setParity(value) {
  if (value == null) {
    delete scriptProps.WASB_EXTERNAL_MIGRATION_PARITY;
  } else {
    scriptProps.WASB_EXTERNAL_MIGRATION_PARITY = value;
  }
}

function assertProductionOnRegistry(label) {
  contract.sheets.forEach((row) => {
    assert.equal(
      context.getLogicalSpreadsheet_(row.logicalName).getId(),
      row.spreadsheetId,
      `${label}: ${row.logicalName} production must use registry`,
    );
    assert.notEqual(context.getLogicalSpreadsheet_(row.logicalName).getId(), mainId);
    assert.equal(
      context.getLogicalSheet_(row.logicalName, true).getName(),
      row.sheetName,
    );
  });
}

contract.sheets.forEach((row) => {
  assert.equal(
    context.getExternalSpreadsheetId_(row.logicalName),
    row.spreadsheetId,
    `${row.logicalName} must map to its spreadsheet ID`,
  );
  assert.equal(context.isExternalLogicalSheet_(row.logicalName), true);
});

assert.equal(context.isExternalLogicalSheet_("PERSONNEL"), false);
assert.equal(context.isExternalLogicalSheet_("VACATIONS"), false);
assert.equal(context.isExternalLogicalSheet_("DICT"), false);
assert.equal(context.isExternalLogicalSheet_("DICT_SUM"), false);
assert.equal(context.isExternalLogicalSheet_("08"), false);
assert.equal(context.getExternalSpreadsheetId_("PERSONNEL"), "");

// 1. absent → legacy flag; dedicated sheets still use registry IDs
setRawMode(null);
assert.equal(context.getExternalStorageMode_(), "legacy");
assert.equal(context.usesExternalProductionRouting_(), false);
assertProductionOnRegistry("1 absent");
assert.equal(context.getLogicalSpreadsheet_("PERSONNEL").getId(), mainId);

// 2–3. legacy / migration cutover flag stays off; create/read still not on main
setRawMode("legacy");
assert.equal(context.getExternalStorageMode_(), "legacy");
assertProductionOnRegistry("2 legacy");
setRawMode("migration");
assert.equal(context.getExternalStorageMode_(), "migration");
assert.equal(context.usesExternalProductionRouting_(), false);
assertProductionOnRegistry("3 migration");

// 4–5. migration preview/apply source=main, target=external
assert.equal(context.getExternalMigrationSourceSpreadsheetId_(), mainId);
assert.equal(
  context.getExternalMigrationTargetSpreadsheetId_("LOG"),
  contract.sheets.find((row) => row.logicalName === "LOG").spreadsheetId,
);
setRawMode("migration");
const beforePreviewMode = context.getExternalStorageMode_();
const inspect = context._extMigInspectEntry_(
  context._extMigMainSpreadsheet_(),
  context.getExternalSpreadsheetEntry_("LOG"),
);
assert.equal(context._extMigMainSpreadsheet_().getId(), mainId);
assert.equal(inspect.spreadsheetId, context.getExternalSpreadsheetId_("LOG"));
assert.equal(inspect.sourceFound, true);
assert.equal(inspect.targetOpened, true);
const preview = context.previewExternalSpreadsheetMigration_();
assert.equal(preview.mainWorkbookId, mainId);
assert.equal(preview.storageMode, "migration");
assert.equal(preview.storageModeAfter, "migration");
assert.equal(context.getExternalStorageMode_(), beforePreviewMode);
const apply = context.applyExternalSpreadsheetMigration_();
assert.equal(context.getExternalStorageMode_(), "migration");
assert.equal(apply.storageModeAfter, "migration");

// 6. external → 17 on registry IDs
context.setExternalStorageMode_("external", { fromFinalizer: true });
assert.equal(context.getExternalStorageMode_(), "external");
assert.equal(context.usesExternalProductionRouting_(), true);
assertProductionOnRegistry("6 external");

// 7. invalid → legacy, never external
setRawMode("bogus");
assert.equal(context.getExternalStorageMode_(), "legacy");
assert.equal(context.usesExternalProductionRouting_(), false);
assertProductionOnRegistry("7 invalid");
setRawMode("");
assert.equal(context.getExternalStorageMode_(), "legacy");
setRawMode("EXTERNAL");
assert.equal(context.getExternalStorageMode_(), "external");
setRawMode("unknown-mode");
assert.notEqual(context.getExternalStorageMode_(), "external");

// 8–9. preview/apply do not change mode
setParity("fail");
setRawMode("legacy");
context.previewExternalSpreadsheetMigration_();
assert.equal(context.getExternalStorageMode_(), "legacy");
context.applyExternalSpreadsheetMigration_();
assert.equal(context.getExternalStorageMode_(), "legacy");
setRawMode("migration");
context.previewExternalSpreadsheetMigration_();
context.applyExternalSpreadsheetMigration_();
assert.equal(context.getExternalStorageMode_(), "migration");
const previewFn = migrationSource.slice(
  migrationSource.indexOf("function previewExternalSpreadsheetMigration_"),
  migrationSource.indexOf("function applyExternalSpreadsheetMigration_"),
);
const applyFn = migrationSource.slice(
  migrationSource.indexOf("function applyExternalSpreadsheetMigration_"),
  migrationSource.indexOf("function _finalizeExternalSpreadsheetMigrationBody_"),
);
assert.ok(
  !previewFn.includes("setExternalStorageMode_"),
  "preview must not flip WASB_EXTERNAL_STORAGE_MODE",
);
assert.ok(
  !applyFn.includes("setExternalStorageMode_"),
  "apply must not flip WASB_EXTERNAL_STORAGE_MODE",
);

// 10. set external without finalizer → reject even with stale PASS
setRawMode("migration");
setParity(
  JSON.stringify({
    status: "PASS",
    sourceFingerprint: "old",
    targetFingerprint: "old",
  }),
);
assert.throws(
  () => context.setExternalStorageMode_("external"),
  /apiFinalizeExternalSpreadsheetMigration|finalizer|confirmParity/,
);
assert.equal(context.getExternalStorageMode_(), "migration");
assert.equal(context.describeExternalStorageMode_().recommendedExternal, false);

// 11. OPS_LOG_yyyy_MM / CHECKPOINTS_yyyy_MM follow mode
const opsId = contract.sheets.find((row) => row.logicalName === "OPS_LOG").spreadsheetId;
const cpId = contract.sheets.find((row) => row.logicalName === "CHECKPOINTS")
  .spreadsheetId;
setRawMode("legacy");
assert.equal(context.getLogicalSpreadsheet_("OPS_LOG_2026_07").getId(), opsId);
assert.equal(context.getLogicalSpreadsheet_("CHECKPOINTS_2026_08").getId(), cpId);
setRawMode("migration");
assert.equal(context.getLogicalSpreadsheet_("OPS_LOG_2026_07").getId(), opsId);
assert.equal(context.getLogicalSpreadsheet_("CHECKPOINTS_2026_08").getId(), cpId);
context.setExternalStorageMode_("external", { fromFinalizer: true });
assert.equal(context.getLogicalSpreadsheet_("OPS_LOG_2026_07").getId(), opsId);
assert.equal(context.getLogicalSpreadsheet_("CHECKPOINTS_2026_08").getId(), cpId);

// 12. catalog/kits: isExternal true, getLogicalSheet_ on main in legacy/migration
["PROPERTY_CATALOG", "PROPERTY_KITS"].forEach((logicalName) => {
  assert.equal(context.isExternalLogicalSheet_(logicalName), true);
  setRawMode("legacy");
  assert.notEqual(context.getLogicalSpreadsheet_(logicalName).getId(), mainId);
  assert.equal(context.getLogicalSheet_(logicalName, true).getName(), logicalName);
  setRawMode("migration");
  assert.notEqual(context.getLogicalSpreadsheet_(logicalName).getId(), mainId);
});

// 13. FORMAT_RULES routing as 12; PERSONNEL always main
assert.equal(context.isExternalLogicalSheet_("FORMAT_RULES_REGISTRY"), true);
setRawMode("legacy");
assert.notEqual(
  context.getLogicalSpreadsheet_("FORMAT_RULES_REGISTRY").getId(),
  mainId,
);
assert.equal(context.getLogicalSpreadsheet_("PERSONNEL").getId(), mainId);
setRawMode("migration");
assert.notEqual(
  context.getLogicalSpreadsheet_("FORMAT_RULES_REGISTRY").getId(),
  mainId,
);
assert.equal(context.getLogicalSpreadsheet_("PERSONNEL").getId(), mainId);
context.setExternalStorageMode_("external", { fromFinalizer: true });
assert.equal(
  context.getLogicalSpreadsheet_("FORMAT_RULES_REGISTRY").getId(),
  contract.sheets.find((row) => row.logicalName === "FORMAT_RULES_REGISTRY")
    .spreadsheetId,
);
assert.equal(context.getLogicalSpreadsheet_("PERSONNEL").getId(), mainId);
assert.notEqual(
  context.getExternalSpreadsheetId_("FORMAT_RULES_REGISTRY"),
  mainId,
);

setRawMode("legacy");
context.invalidateExternalStorageRuntimeCache_();
const logSpreadsheetId = contract.sheets.find(
  (row) => row.logicalName === "LOG",
).spreadsheetId;
const mainSheetCount = spreadsheetStore[mainId].getSheets().length;
const logSs = spreadsheetStore[logSpreadsheetId];
logSs.deleteSheet(logSs.getSheetByName("LOG"));
context.invalidateExternalStorageRuntimeCache_();
const ensuredLog = context.ensureLogicalSheet_("LOG");
assert.equal(ensuredLog.getName(), "LOG");
assert.ok(logSs.getSheetByName("LOG"), "ensure must create LOG on the dedicated spreadsheet");
assert.equal(
  spreadsheetStore[mainId].getSheets().length,
  mainSheetCount,
  "ensure must not insert LOG into the main workbook",
);

assert.throws(
  () => context._openSpreadsheetByIdCached_("missing-id"),
  /Немає доступу|not found/,
);

context.getLogicalSpreadsheet_("LOG");
const cachedLookups = openByIdCalls.length;
context.getLogicalSpreadsheet_("LOG");
assert.equal(
  openByIdCalls.length,
  cachedLookups,
  "repeated LOG lookups in external mode must use the in-memory spreadsheet cache",
);

assert.ok(apiSource.includes("function apiGetExternalStorageMode"));
assert.ok(apiSource.includes("function apiSetExternalStorageMode"));
assert.ok(apiSource.includes("function apiFinalizeExternalSpreadsheetMigration"));
assert.ok(apiSource.includes("function apiBeginExternalSpreadsheetMigration"));
assert.ok(
  !/function\s+api\w*EnableExternal/.test(apiSource) &&
    !/function\s+apiBeginExternalStorageExternal/.test(apiSource),
  "must not add a no-arg wrapper that enables external",
);
assert.equal(
  (apiSource.match(/function apiBeginExternalSpreadsheetMigration/g) || []).length,
  1,
);
const accessApi = loadContract("access-api.contract.json");
const publicNames = new Set(accessApi.publicEndpoints || []);
const excludedNames = new Set(
  (accessApi.excludedEntrypoints || []).map((item) => item.name),
);
const sidebarApis = [
  "apiGetExternalSpreadsheetMigrationStatus",
  "apiGetExternalStorageMode",
  "apiBeginExternalSpreadsheetMigration",
  "apiPreviewExternalSpreadsheetMigration",
  "apiApplyExternalSpreadsheetMigration",
  "apiFinalizeExternalSpreadsheetMigration",
];
for (const name of sidebarApis) {
  assert.ok(publicNames.has(name), name + " must be public");
  assert.ok(!excludedNames.has(name), name + " must not be excluded");
  assert.ok(apiSource.includes("function " + name), name + " must exist");
  assert.ok(
    apiSource.includes('_stage7AssertRole_("sysadmin"'),
    "external migration APIs must stay sysadmin-guarded",
  );
}
assert.ok(
  excludedNames.has("apiSetExternalStorageMode"),
  "apiSetExternalStorageMode must stay excluded",
);
assert.ok(
  !publicNames.has("apiSetExternalStorageMode"),
  "apiSetExternalStorageMode must not be public",
);

setRawMode(null);
const began = context.beginExternalSpreadsheetMigration_();
assert.equal(began.ok, true);
assert.equal(began.reason, "started");
assert.equal(context.getExternalStorageMode_(), "migration");
const beganAgain = context.beginExternalSpreadsheetMigration_();
assert.equal(beganAgain.ok, true);
assert.equal(beganAgain.skipped, true);
assert.equal(beganAgain.reason, "already_migration");
assert.equal(context.getExternalStorageMode_(), "migration");
context.setExternalStorageMode_("external", { fromFinalizer: true });
const beganFromExternal = context.beginExternalSpreadsheetMigration_();
assert.equal(beganFromExternal.ok, false);
assert.equal(beganFromExternal.reason, "already_external");
assert.equal(context.getExternalStorageMode_(), "external");

function enableExternalForTests() {
  context.setExternalStorageMode_("external", { fromFinalizer: true });
}

// Cutover 1: stale PASS + source changed → setter rejected
setRawMode("migration");
context.writeExternalMigrationReceipt_({
  status: "PASS",
  resources: 17,
  sourceFingerprint: "stale-source",
  targetFingerprint: "stale-source",
});
spreadsheetStore[mainId].getSheetByName("LOG").setFilled(2, 2);
assert.throws(
  () => context.setExternalStorageMode_("external"),
  /apiFinalizeExternalSpreadsheetMigration/,
);
assert.equal(context.getExternalStorageMode_(), "migration");
spreadsheetStore[mainId].getSheetByName("LOG").setFilled(0, 0);

// Cutover 2: fresh finalizer PASS → external
setRawMode("migration");
const finalized = context.finalizeExternalSpreadsheetMigration_();
assert.equal(finalized.ok, true, finalized.message || "finalizer PASS");
assert.equal(context.getExternalStorageMode_(), "external");
assert.equal(lockState.held, false);
assert.equal(context.isExternalCutoverInProgress_(), false);

// Cutover 10: repeat finalizer is idempotent
const repeated = context.finalizeExternalSpreadsheetMigration_();
assert.equal(repeated.ok, true);
assert.equal(repeated.skipped, true);
assert.equal(repeated.reason, "already_external");
assert.equal(context.getExternalStorageMode_(), "external");

// Cutover 3: parity mismatch after fake apply → stay migration
setRawMode("migration");
const origApply = context.applyExternalSpreadsheetMigration_;
context.applyExternalSpreadsheetMigration_ = function () {
  return { ok: true, applied: true, tables: [] };
};
spreadsheetStore[mainId].getSheetByName("LOG").setFilled(3, 2);
const mismatch = context.finalizeExternalSpreadsheetMigration_();
assert.equal(mismatch.ok, false);
assert.equal(context.getExternalStorageMode_(), "migration");
context.applyExternalSpreadsheetMigration_ = origApply;
spreadsheetStore[mainId].getSheetByName("LOG").setFilled(0, 0);

// Cutover 4: conflict on one resource → external not enabled
const logId = contract.sheets.find((row) => row.logicalName === "LOG").spreadsheetId;
spreadsheetStore[logId].getSheetByName("LOG").setFilled(4, 2);
setRawMode("migration");
const conflicted = context.finalizeExternalSpreadsheetMigration_();
assert.equal(conflicted.ok, false);
assert.equal(context.getExternalStorageMode_(), "migration");
spreadsheetStore[logId].getSheetByName("LOG").setFilled(0, 0);

// Cutover 5: OPS_LOG archive mismatch
spreadsheetStore[opsId].getSheetByName("OPS_LOG_2026_07").setFilled(5, 2);
setRawMode("migration");
const opsArchive = context.finalizeExternalSpreadsheetMigration_();
assert.equal(opsArchive.ok, false);
assert.equal(context.getExternalStorageMode_(), "migration");
spreadsheetStore[opsId].getSheetByName("OPS_LOG_2026_07").setFilled(0, 0);

// Cutover 6: CHECKPOINTS archive mismatch
spreadsheetStore[cpId].getSheetByName("CHECKPOINTS_2026_08").setFilled(6, 2);
setRawMode("migration");
const cpArchive = context.finalizeExternalSpreadsheetMigration_();
assert.equal(cpArchive.ok, false);
assert.equal(context.getExternalStorageMode_(), "migration");
spreadsheetStore[cpId].getSheetByName("CHECKPOINTS_2026_08").setFilled(0, 0);

// Cutover 7: finalizer throw releases lock and keeps migration
setRawMode("migration");
context.applyExternalSpreadsheetMigration_ = function () {
  throw new Error("forced-finalizer-failure");
};
assert.throws(
  () => context.finalizeExternalSpreadsheetMigration_(),
  /forced-finalizer-failure/,
);
assert.equal(context.getExternalStorageMode_(), "migration");
assert.equal(context.isExternalCutoverInProgress_(), false);
assert.equal(lockState.held, false);
context.applyExternalSpreadsheetMigration_ = origApply;

// Cutover 8: concurrent write cannot sneak in while lock held
setRawMode("migration");
context.setExternalCutoverInProgress_(true);
context._externalMutationLockDepth_ = 0;
lockState.held = true;
let writeRan = false;
assert.throws(
  () =>
    context.withExternalLogicalMutation_("LOG", function () {
      writeRan = true;
    }),
  /script lock/,
);
assert.equal(writeRan, false);
lockState.held = false;
context.setExternalCutoverInProgress_(false);
const afterCutover = context.finalizeExternalSpreadsheetMigration_();
assert.equal(afterCutover.ok, true);
context.withExternalLogicalMutation_("LOG", function () {
  writeRan = true;
  assert.equal(context.getLogicalSpreadsheet_("LOG").getId(), contract.sheets.find((row) => row.logicalName === "LOG").spreadsheetId);
});
assert.equal(writeRan, true);

// Cutover 9: confirmParity override is audited
auditRecords.length = 0;
setRawMode("migration");
const emergency = context.setExternalStorageMode_("external", {
  confirmParity: true,
});
assert.equal(emergency.emergencyOverride, true);
assert.match(String(emergency.warning || ""), /Аварійний override/);
assert.equal(auditRecords.length >= 1, true);
assert.equal(auditRecords[0].scenario, "external-storage-emergency-override");
enableExternalForTests();

const allowedIdFiles = new Set([
  "contracts/external-spreadsheets.contract.json",
  "data/ExternalSpreadsheets.gs",
  "operations/ExternalSpreadsheetMigration.gs",
  "scripts/verify-external-spreadsheets.mjs",
]);
const scanned = walkRepoFiles(repoRoot, [".gs", ".mjs", ".json", ".md"]);
const leakedIds = [];
for (const rel of scanned) {
  if (allowedIdFiles.has(rel)) continue;
  if (rel.startsWith("node_modules/") || rel.startsWith("docs/")) continue;
  const text = readFileSync(path.join(repoRoot, rel), "utf8");
  for (const id of ids) {
    if (text.includes(id)) leakedIds.push(`${rel}: ${id}`);
  }
}
assert.deepEqual(leakedIds, [], "spreadsheet IDs must stay in the canonical registry");

const productionGs = walkRepoFiles(repoRoot, [".gs"]).filter(
  (rel) =>
    !rel.startsWith("tests/") &&
    rel !== "data/ExternalSpreadsheets.gs" &&
    rel !== "operations/ExternalSpreadsheetMigration.gs",
);
const forbiddenDirect = [];
for (const rel of productionGs) {
  const text = readFileSync(path.join(repoRoot, rel), "utf8");
  for (const name of names) {
    const pattern = new RegExp(
      String.raw`getWasbSpreadsheet_\(\)\s*\.\s*getSheetByName\(\s*["']${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`,
    );
    if (pattern.test(text)) {
      forbiddenDirect.push(`${rel}: getWasbSpreadsheet_().getSheetByName("${name}")`);
    }
  }
}
assert.deepEqual(
  forbiddenDirect,
  [],
  "production must not open externalized sheets via the main workbook",
);

const statusStart = registrySource.indexOf(
  "function getExternalSpreadsheetMigrationStatus_",
);
assert.ok(statusStart > 0, "status helper must exist");
const statusNext = registrySource.indexOf("\nfunction ", statusStart + 10);
const statusFn = registrySource.slice(statusStart, statusNext);
assert.ok(
  !statusFn.includes("previewExternalSpreadsheetMigration_"),
  "status must not call preview (preview writes a receipt)",
);

setRawMode("migration");
const status = context.getExternalSpreadsheetMigrationStatus_();
assert.equal(status.ok, true);
assert.equal(status.mode, "migration");
assert.equal(status.registryCount, 17);
assert.equal(status.mainWorkbookLabel, "основна книга");
assert.equal(typeof status.checkedAt, "string");
assert.ok(Array.isArray(status.resources));
assert.equal(status.resources.length, 17);
const statusJson = JSON.stringify(status);
JSON.parse(statusJson);
assert.ok(
  !statusJson.includes(contract.mainWorkbookId),
  "status DTO must not expose the main workbook id",
);
for (const id of ids) {
  assert.ok(!statusJson.includes(id), "status DTO must not expose spreadsheet ids");
}

const previewDtoSource = context.previewExternalSpreadsheetMigration_();
const dto = context.toExternalMigrationPreviewDto_(previewDtoSource);
assert.equal(typeof dto.checkedAt, "string");
assert.ok(dto.totals && typeof dto.totals === "object");
assert.ok(Array.isArray(dto.resources));
assert.equal(dto.resources.length, 17);
const logRow = dto.resources.find((row) => row.name === "LOG");
assert.ok(logRow, "preview DTO must include the events sheet");
assert.equal(logRow.displayName, "Журнал подій");
const dtoJson = JSON.stringify(dto);
const parsedDto = JSON.parse(dtoJson);
assert.equal(parsedDto.resources[0].displayName, dto.resources[0].displayName);
assert.ok(!dtoJson.includes("[object Sheet]"));
assert.ok(!dtoJson.includes("[object Object]Date"));

auditRecords.length = 0;
setRawMode(null);
context.beginExternalSpreadsheetMigration_();
assert.equal(
  auditRecords.some((row) => row.scenario === "external-migration-begin"),
  true,
  "begin must write one audit record after success",
);

const uiHtmlFiles = walkRepoFiles(repoRoot, [".html"]).filter((rel) =>
  rel.startsWith("ui/"),
);
for (const rel of uiHtmlFiles) {
  const text = readFileSync(path.join(repoRoot, rel), "utf8");
  assert.ok(
    !text.includes("confirmParity"),
    rel + " must not mention confirmParity",
  );
}
const sidebar = readFileSync(path.join(repoRoot, "ui/Sidebar.html"), "utf8");
assert.ok(sidebar.includes("Міграція зовнішніх таблиць"));
assert.ok(sidebar.includes("externalMigration"));
assert.ok(/data-role-min="sysadmin"[\s\S]{0,200}externalMigration/.test(sidebar) || /externalMigration[\s\S]{0,200}data-role-min="sysadmin"/.test(sidebar) || sidebar.includes('handleMenuAction(\'externalMigration\')'));
const guards = readFileSync(
  path.join(repoRoot, "ui/Js.Security.Guards.html"),
  "utf8",
);
assert.match(guards, /externalMigration:\s*"sysadmin"/);
const clientMod = readFileSync(
  path.join(repoRoot, "ui/Js.ExternalMigration.html"),
  "utf8",
);
assert.ok(clientMod.includes("MaintenanceApi.getExternalSpreadsheetMigrationStatus"));
assert.ok(clientMod.includes("MaintenanceApi.beginExternalSpreadsheetMigration"));
assert.ok(clientMod.includes("MaintenanceApi.previewExternalSpreadsheetMigration"));
assert.ok(clientMod.includes("MaintenanceApi.applyExternalSpreadsheetMigration"));
assert.ok(clientMod.includes("MaintenanceApi.finalizeExternalSpreadsheetMigration"));
assert.ok(!clientMod.includes("apiSetExternalStorageMode"));
const apiJs = readFileSync(path.join(repoRoot, "ui/Js.Api.html"), "utf8");
assert.ok(apiJs.includes('Api.run("apiGetExternalSpreadsheetMigrationStatus")'));
assert.ok(apiJs.includes('Api.run("apiBeginExternalSpreadsheetMigration")'));
assert.ok(apiJs.includes('Api.run("apiPreviewExternalSpreadsheetMigration")'));
assert.ok(apiJs.includes('Api.run("apiApplyExternalSpreadsheetMigration")'));
assert.ok(apiJs.includes('Api.run("apiFinalizeExternalSpreadsheetMigration")'));
assert.ok(!apiJs.includes("apiSetExternalStorageMode"));

console.log("verify-external-spreadsheets: OK");

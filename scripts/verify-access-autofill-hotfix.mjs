#!/usr/bin/env node
/**
 * Behavioral coverage for ACCESS row autofill hotfix.
 */

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const repoRoot = path.resolve(import.meta.dirname, "..");

function sha256Hex(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

class FakeRange {
  constructor(sheet, row, col, numRows = 1, numCols = 1) {
    this.sheet = sheet;
    this.row = row;
    this.col = col;
    this.numRows = numRows;
    this.numCols = numCols;
  }

  getSheet() {
    return this.sheet;
  }

  getRow() {
    return this.row;
  }

  getValues() {
    return Array.from({ length: this.numRows }, (_, rowOffset) =>
      Array.from({ length: this.numCols }, (_, colOffset) =>
        this.sheet.valueAt(this.row + rowOffset, this.col + colOffset),
      ),
    );
  }

  setValues(values) {
    values.forEach((sourceRow, rowOffset) => {
      sourceRow.forEach((value, colOffset) => {
        this.sheet.setValue(this.row + rowOffset, this.col + colOffset, value);
      });
    });
    return this;
  }

  setValue(value) {
    this.sheet.setValue(this.row, this.col, value);
    return this;
  }

  copyTo(target, type, transposed) {
    this.sheet.copyOperations.push({
      sourceRow: this.row,
      targetRow: target.row,
      type,
      transposed,
    });
    return this;
  }
}

class FakeSheet {
  constructor(name, rows) {
    this.name = name;
    this.rows = rows.map((row) => row.slice());
    this.frozenRows = 0;
    this.copyOperations = [];
  }

  getName() {
    return this.name;
  }

  getLastColumn() {
    return Math.max(1, ...this.rows.map((row) => row.length));
  }

  getLastRow() {
    for (let index = this.rows.length - 1; index >= 0; index--) {
      if ((this.rows[index] || []).some((value) => value !== "")) {
        return index + 1;
      }
    }
    return 0;
  }

  getRange(row, col, numRows = 1, numCols = 1) {
    return new FakeRange(this, row, col, numRows, numCols);
  }

  setFrozenRows(count) {
    this.frozenRows = count;
    return this;
  }

  valueAt(row, col) {
    return (this.rows[row - 1] || [])[col - 1] ?? "";
  }

  setValue(row, col, value) {
    while (this.rows.length < row) this.rows.push([]);
    while (this.rows[row - 1].length < col) this.rows[row - 1].push("");
    this.rows[row - 1][col - 1] = value;
  }
}

function makeSpreadsheet(sheets) {
  const byName = new Map(sheets.map((sheet) => [sheet.getName(), sheet]));
  return {
    getSheetByName(name) {
      return byName.get(name) || null;
    },
    insertSheet(name) {
      const sheet = new FakeSheet(name, [[]]);
      byName.set(name, sheet);
      return sheet;
    },
  };
}

function makeContext(spreadsheet) {
  const math = Object.create(Math);
  math.random = () => 0;

  return vm.createContext({
    console,
    Date,
    Math: math,
    getWasbSpreadsheet_() {
      return spreadsheet;
    },
    Session: {
      getActiveUser() {
        return {
          getEmail() {
            return "admin@example.test";
          },
        };
      },
    },
    SpreadsheetApp: {
      CopyPasteType: {
        PASTE_FORMAT: "PASTE_FORMAT",
        PASTE_DATA_VALIDATION: "PASTE_DATA_VALIDATION",
      },
    },
    Utilities: {
      DigestAlgorithm: {
        SHA_256: "SHA_256",
      },
      Charset: {
        UTF_8: "UTF_8",
      },
      computeDigest(algorithm, value) {
        assert.equal(algorithm, "SHA_256");
        return Array.from(crypto.createHash("sha256").update(String(value)).digest());
      },
    },
  });
}

function loadHotfix(context) {
  vm.runInContext(
    fs.readFileSync(path.join(repoRoot, "AccessSheetRowAutoFillHotfix.gs"), "utf8"),
    context,
    { filename: "AccessSheetRowAutoFillHotfix.gs" },
  );
}

const headers = [
  "email",
  "login",
  "enabled",
  "display_name",
  "callsign",
  "self_bind_allowed",
  "user_key_current_hash",
  "request_user_key_hash",
  "registration_status",
  "approved_by",
  "approved_at",
];
const existingHash = sha256Hex("existing-key");
const accessSheet = new FakeSheet("ACCESS", [
  headers,
  [
    "existing@example.test",
    "existing",
    false,
    "Existing User",
    "EX",
    false,
    existingHash,
    "old-request-hash",
    "active",
    "owner@example.test",
    "2026-01-01",
  ],
  Array(headers.length).fill(""),
  ["new@example.test", "newuser", "", "New User", "NEW", "", "", "", "", "", ""],
]);
const spreadsheet = makeSpreadsheet([accessSheet]);
const context = makeContext(spreadsheet);
loadHotfix(context);

const repairResult = vm.runInContext(
  "wasbRepairAccessSheetRowsHotfix()",
  context,
);

assert.equal(repairResult.ok, true);
assert.equal(repairResult.repairedRows, 2, "only populated ACCESS rows are repaired");
assert.equal(repairResult.generatedKeys, 1, "existing current hashes must not be regenerated");
assert.equal(
  accessSheet.valueAt(2, 7),
  existingHash,
  "existing current hash must be preserved",
);
assert.equal(
  accessSheet.valueAt(2, 8),
  "old-request-hash",
  "existing request hash must be preserved when no key is generated",
);
assert.equal(
  accessSheet.copyOperations.filter((operation) => operation.targetRow === 3).length,
  0,
  "empty ACCESS rows must not receive template copies",
);
assert.equal(accessSheet.valueAt(4, 3), true, "new rows default to enabled");
assert.equal(accessSheet.valueAt(4, 6), true, "new rows default to self-bind allowed");
assert.equal(accessSheet.valueAt(4, 9), "key_sent");
assert.equal(accessSheet.valueAt(4, 10), "admin@example.test");
assert.ok(accessSheet.valueAt(4, 11) instanceof Date);

const newHash = accessSheet.valueAt(4, 7);
assert.match(newHash, /^[a-f0-9]{64}$/);
assert.equal(
  accessSheet.valueAt(4, 8),
  newHash,
  "generated request hash must match current hash",
);

const outboxSheet = spreadsheet.getSheetByName("ACCESS_KEYS_OUTBOX");
assert.ok(outboxSheet, "repair must create ACCESS_KEYS_OUTBOX");
assert.equal(outboxSheet.frozenRows, 1);
assert.deepEqual(outboxSheet.rows[0], [
  "created_at",
  "email",
  "login",
  "display_name",
  "callsign",
  "plain_access_key",
  "note",
]);
assert.equal(outboxSheet.getLastRow(), 2);
assert.equal(outboxSheet.valueAt(2, 2), "new@example.test");
assert.equal(outboxSheet.valueAt(2, 3), "newuser");
assert.equal(outboxSheet.valueAt(2, 4), "New User");
assert.equal(outboxSheet.valueAt(2, 5), "NEW");
const generatedPlainKey = outboxSheet.valueAt(2, 6);
assert.match(generatedPlainKey, /^WASB-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
assert.equal(newHash, sha256Hex(generatedPlainKey));

const triggerSheet = new FakeSheet("ACCESS", [headers, Array(headers.length).fill("")]);
const ignoredSheet = new FakeSheet("OTHER", [headers, Array(headers.length).fill("")]);
const triggerContext = makeContext(makeSpreadsheet([triggerSheet, ignoredSheet]));
loadHotfix(triggerContext);
const onEdit = vm.runInContext("wasbAccessSheetOnEditAutofillHotfix_", triggerContext);

assert.doesNotThrow(() => onEdit(null));
onEdit({ range: triggerSheet.getRange(1, 1) });
onEdit({ range: ignoredSheet.getRange(2, 1) });
assert.equal(triggerSheet.copyOperations.length, 0);
assert.equal(ignoredSheet.copyOperations.length, 0);

onEdit({ range: triggerSheet.getRange(2, 1) });
assert.deepEqual(
  triggerSheet.copyOperations.map((operation) => operation.type),
  ["PASTE_FORMAT", "PASTE_DATA_VALIDATION"],
  "ACCESS data-row edits must copy format and validation from template row",
);

console.log("verify-access-autofill-hotfix: OK");

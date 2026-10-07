#!/usr/bin/env node
/**
 * Sheets cell char limit — stage7SafeStringify_ must never exceed maxLen
 * (ellipsis used to push truncated JSON to maxLen+1 → Sheets 50000 error).
 */
import assert from "node:assert/strict";
import vm from "node:vm";
import { repoRoot } from "./lib/load-contract.mjs";
import { readRepoFileByBasename } from "./lib/gas-files.mjs";

const stage7Config = readRepoFileByBasename(repoRoot, "Stage7Config.gs", {
  errorPrefix: "verify-sheets-cell-char-limit",
});
const operationRepo = readRepoFileByBasename(repoRoot, "OperationRepository.gs", {
  errorPrefix: "verify-sheets-cell-char-limit",
});

assert.match(stage7Config, /STAGE7_SHEETS_MAX_CELL_CHARS\s*=\s*50000/);
assert.match(stage7Config, /function stage7ClampCellText_/);
assert.match(stage7Config, /function stage7SafeStringify_/);
assert.match(
  stage7Config,
  /limit\s*-\s*(?:ellipsis\.length|suffix\.length|STAGE7_SAFE_STRINGIFY_ELLIPSIS\.length)/,
);
assert.doesNotMatch(
  stage7Config,
  /text\.slice\(0,\s*limit\)\s*\+\s*["']…["']/,
  "must not append ellipsis after a full-limit slice (overflows Sheets)",
);

assert.match(
  operationRepo,
  /SHEET_CELL_SAFE_JSON_LIMIT\s*=\s*49000/,
  "OPS JSON must use a safety margin below the Sheets 50k cell limit",
);
assert.match(
  operationRepo,
  /stage7SafeStringify_\([\s\S]*?SHEET_CELL_SAFE_JSON_LIMIT/,
);

const context = vm.createContext({
  console,
  Utilities: {
    getUuid() {
      return "00000000-0000-0000-0000-000000000000";
    },
    formatDate() {
      return "20260101_000000";
    },
  },
  Session: { getScriptTimeZone() { return "UTC"; } },
  getTimeZone_() {
    return "UTC";
  },
  Object,
  Array,
  Math,
  Number,
  String,
  JSON,
});

vm.runInContext(stage7Config, context, { filename: "Stage7Config.gs" });

const cases = vm.runInContext(
  `
  (function () {
    var limit = STAGE7_SHEETS_MAX_CELL_CHARS;
    var big = { blob: "a".repeat(limit + 5000) };
    var out = stage7SafeStringify_(big, limit);
    var exact = stage7SafeStringify_({ ok: true }, limit);
    var clamped = stage7ClampCellText_("x".repeat(limit + 10), limit);
    return {
      limit: limit,
      outLen: out.length,
      outEndsWithEllipsis: out.charAt(out.length - 1) === "…",
      exactLen: exact.length,
      clampedLen: clamped.length,
      defaultLen: stage7SafeStringify_({ a: 1 }).length,
      oneCharLen: stage7SafeStringify_({ payload: "xxx" }, 1).length,
    };
  })()
  `,
  context,
);

assert.equal(cases.limit, 50000);
assert.ok(cases.outLen <= cases.limit, "truncated JSON must fit in Sheets cell");
assert.equal(cases.outLen, cases.limit);
assert.equal(cases.outEndsWithEllipsis, true);
assert.ok(cases.exactLen <= cases.limit);
assert.equal(cases.clampedLen, cases.limit);
assert.ok(cases.defaultLen > 0);
assert.equal(cases.oneCharLen, 1);

console.log("verify-sheets-cell-char-limit: OK");

#!/usr/bin/env node
/**
 * Ensures PersonnelRepository.gs status lists match contracts/personnel-status.contract.json.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { loadContract, repoRoot } from "./lib/load-contract.mjs";
import { readRepoFileByBasename } from "./lib/gas-files.mjs";

const contract = loadContract("personnel-status.contract.json");
const source = readRepoFileByBasename(repoRoot, "PersonnelRepository.gs", {
  errorPrefix: "verify-personnel-status-contract",
});
const selfHealSource = readRepoFileByBasename(repoRoot, "SystemSheetsSelfHeal.gs", {
  errorPrefix: "verify-personnel-status-contract",
});

const IN_TRIP_UNICODE = contract.inTripStatusUnicode || "";
const IN_TRIP_CANON = IN_TRIP_UNICODE ? JSON.parse(`"${IN_TRIP_UNICODE}"`) : "";

/** Guard: Latin "d" (U+0064) must not appear inside UA in-trip status text. */
function assertNoLatinDInInTripStatus(fileLabel, text) {
  if (/відряd|вiдряd|відряdжен|У відряd/i.test(text)) {
    assert.fail(
      `${fileLabel}: Latin "d" in in-trip status — use PERSONNEL_STATUS_IN_TRIP_UA_`,
    );
  }
  if (/відряджені[^н]/i.test(text)) {
    assert.fail(`${fileLabel}: use "відрядженні" (double н), not "відряджені"`);
  }
}

assertNoLatinDInInTripStatus("PersonnelRepository.gs", source);
assertNoLatinDInInTripStatus(
  "personnel-status.contract.json",
  fs.readFileSync(
    path.join(repoRoot, "contracts/personnel-status.contract.json"),
    "utf8",
  ),
);

assert.match(
  source,
  /var PERSONNEL_STATUS_IN_TRIP_UA_\s*=\s*\n\s*"\\u0423 \\u0432\\u0456\\u0434\\u0440\\u044f\\u0434\\u0436\\u0435\\u043d\\u043d\\u0456";/,
  "PersonnelRepository.gs must define PERSONNEL_STATUS_IN_TRIP_UA_ via unicode escape only",
);

/** No manual Cyrillic literal for canonical in-trip label in .gs (unicode constant only). */
const quotedInTrip = source.match(/["'][^"']*відрядженні[^"']*["']/gi) || [];
quotedInTrip.forEach((literal) => {
  assert.fail(
    `PersonnelRepository.gs: manual in-trip status literal ${literal} — use PERSONNEL_STATUS_IN_TRIP_UA_`,
  );
});

function loadPersonnelStatusConstants() {
  const context = vm.createContext({
    CONFIG: { PERSONNEL_SHEET: "PERSONNEL" },
    console,
  });
  vm.runInContext(source, context, { filename: "PersonnelRepository.gs" });
  return {
    statuses: {
      available: String(context.PERSONNEL_STATUS_AVAILABLE_UA_ || ""),
      inTrip: String(context.PERSONNEL_STATUS_IN_TRIP_UA_ || ""),
      removed: String(context.PERSONNEL_STATUS_REMOVED_UA_ || ""),
      vacation: String(context.PERSONNEL_STATUS_VACATION_UA_ || ""),
      hospital: String(context.PERSONNEL_STATUS_HOSPITAL_UA_ || ""),
      temp: String(context.PERSONNEL_STATUS_TEMP_UA_ || ""),
      husachivka: String(context.PERSONNEL_STATUS_HUSACHIVKA_UA_ || ""),
      bzvp: String(context.PERSONNEL_STATUS_BZVP_UA_ || ""),
      szch: String(context.PERSONNEL_STATUS_SZCH_UA_ || ""),
    },
    inTrip: String(context.PERSONNEL_STATUS_IN_TRIP_UA_ || ""),
    dropdown: context.PERSONNEL_STATUS_SHEET_VALUES_.slice(),
    active: context.PERSONNEL_ACTIVE_STATUSES_.slice(),
    inactive: context.PERSONNEL_INACTIVE_STATUSES_.slice(),
    defaultStatus: String(context.PERSONNEL_DEFAULT_STATUS_UA_),
    normalize: context.normalizePersonnelStatus_,
    isActive: context.isPersonnelStatusActive_,
    canonical: context.getPersonnelStatusCanonical_,
  };
}

function assertJsonEqual(actual, expected, message) {
  assert.equal(JSON.stringify(actual), JSON.stringify(expected), message);
}

function assertCyrillicDOnly(label, value) {
  for (const ch of value) {
    if (ch === "d" || ch === "D") {
      assert.fail(`${label}: Latin d/D in "${value}"`);
    }
  }
  assert.equal(
    [...value].filter((ch) => ch === "д").length,
    2,
    `${label}: expected two Cyrillic "д" (U+0434) in "${value}"`,
  );
}

const runtime = loadPersonnelStatusConstants();

assertJsonEqual(
  Object.values(runtime.statuses),
  contract.dropdownOrder,
  "each canonical status must be defined once as a named constant",
);
assert.equal(
  runtime.inTrip,
  IN_TRIP_CANON,
  "PERSONNEL_STATUS_IN_TRIP_UA_ value",
);
assertCyrillicDOnly("PERSONNEL_STATUS_IN_TRIP_UA_", runtime.inTrip);
assert.equal(
  runtime.dropdown[1],
  runtime.inTrip,
  "dropdown[1] must be PERSONNEL_STATUS_IN_TRIP_UA_",
);
assert.equal(
  runtime.active[1],
  runtime.inTrip,
  "active[1] must be PERSONNEL_STATUS_IN_TRIP_UA_",
);
assert.equal(
  runtime.canonical(runtime.inTrip),
  "Detached",
  "in-trip EN canonical",
);

Object.entries(runtime.statuses).forEach(([name, value]) => {
  if (name === "inTrip") return;
  const exactDoubleQuoted = source.split(JSON.stringify(value)).length - 1;
  const exactSingleQuoted = source.split(`'${value}'`).length - 1;
  assert.equal(
    exactDoubleQuoted + exactSingleQuoted,
    1,
    `${value}: canonical status literal must appear only in its constant definition`,
  );
});

assertJsonEqual(
  runtime.dropdown,
  contract.dropdownOrder,
  "PERSONNEL_STATUS_SHEET_VALUES_ must match contract dropdownOrder",
);
assertJsonEqual(
  runtime.active,
  contract.activeStatuses,
  "PERSONNEL_ACTIVE_STATUSES_ must match contract activeStatuses",
);
assertJsonEqual(
  runtime.inactive,
  contract.inactiveStatuses,
  "PERSONNEL_INACTIVE_STATUSES_ must match contract inactiveStatuses",
);
assert.equal(
  runtime.defaultStatus,
  contract.defaultStatus,
  "PERSONNEL_DEFAULT_STATUS_UA_ must match contract defaultStatus",
);

Object.entries(contract.legacyReadAliases || {}).forEach(([raw, expected]) => {
  assert.equal(
    runtime.normalize(raw),
    expected,
    `normalizePersonnelStatus_(${JSON.stringify(raw)})`,
  );
});

Object.values(runtime.statuses).forEach((status) => {
  assert.equal(
    runtime.normalize(status),
    status,
    `${status}: canonical status must normalize to itself`,
  );
});

assert.equal(runtime.isActive(""), true, "empty status is active");
assert.equal(
  runtime.isActive(runtime.statuses.szch),
  false,
  "SZCH is inactive",
);
assert.equal(
  runtime.isActive(runtime.statuses.hospital),
  true,
  "hospital is active",
);
assert.equal(
  runtime.isActive(runtime.inTrip),
  true,
  "in-trip status is active",
);

assert.match(source, /function ensurePersonnelStatusColumnHeader_/);
assert.match(source, /function ensurePersonnelStatusColumn_/);
assert.match(source, /ensurePersonnelStatusColumnHeader_\(sh\)/);
assert.match(
  source,
  new RegExp(
    `var PERSONNEL_REFERENCE_STATUS_COL_\\s*=\\s*${contract.referenceStatusColumn};`,
  ),
);

(contract.selfHeal?.validationAppliedBy || []).forEach((symbol) => {
  assert.match(
    source + "\n" + selfHealSource,
    new RegExp(symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  );
});
assert.match(selfHealSource, /function _applyPersonnelStatusValidation_/);
assert.match(selfHealSource, /applyPersonnelStatusColumnValidation_\(sheet\)/);

console.log(
  `verify-personnel-status-contract: OK (dropdown=${runtime.dropdown.length}, inTrip=unicode-constant)`,
);

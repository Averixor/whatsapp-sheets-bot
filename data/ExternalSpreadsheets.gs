/**
 * ExternalSpreadsheets.gs — canonical router for service workbooks.
 *
 * Seventeen logical sheets may live in dedicated Spreadsheets. Production
 * routing is gated by Script Property WASB_EXTERNAL_STORAGE_MODE:
 *   legacy (default) / migration → read/write still use the main workbook
 *   external → read/write use the registry openById targets
 * Unknown or missing mode fails closed to legacy — never auto-external.
 * IDs are not duplicated in business modules. Objects are cached for one
 * execution only — never CacheService / PropertiesService.
 */

var WASB_MAIN_WORKBOOK_ID_ =
  "1v8ixM67nG_Bfy5NzcDZbmSjwVOYbkN02ibfP6YqI384";
var WASB_EXTERNAL_STORAGE_MODE_PROPERTY_ = "WASB_EXTERNAL_STORAGE_MODE";
var WASB_EXTERNAL_MIGRATION_PARITY_PROPERTY_ = "WASB_EXTERNAL_MIGRATION_PARITY";
var WASB_EXTERNAL_CUTOVER_PROPERTY_ = "WASB_EXTERNAL_CUTOVER";
var _externalMutationLockDepth_ = 0;

var EXTERNAL_SPREADSHEET_ENTRIES_ = Object.freeze([
  Object.freeze({
    logicalName: "Дані",
    spreadsheetId: "1uIsBM_QUye9id1xdOHgNHzkuNA2zwW7ItAUG-WwsCxA",
    sheetName: "Дані",
  }),
  Object.freeze({
    logicalName: "Заявки",
    spreadsheetId: "1jvcZ9hJi29IhMlRaDFlCJYlP5c5nntNPfKrqxZKhIcE",
    sheetName: "Заявки",
  }),
  Object.freeze({
    logicalName: "Проєкти",
    spreadsheetId: "1S9k6ZX3AjwqpevYYkuqGX3TE61dXpwKSA8UAyHi59sg",
    sheetName: "Проєкти",
  }),
  Object.freeze({
    logicalName: "PROPERTY_KITS",
    spreadsheetId: "1G2N3fgomqA8M3Q80piT-f_ExJ5yE4olKFAQ7l3KQJnI",
    sheetName: "PROPERTY_KITS",
  }),
  Object.freeze({
    logicalName: "PROPERTY_CATALOG",
    spreadsheetId: "1q0DYvbqsMU3E4mhD_c3PT7RqLBBQjSQZieVXavn7IeM",
    sheetName: "PROPERTY_CATALOG",
  }),
  Object.freeze({
    logicalName: "INVENTORY_RECONCILIATION_FILES",
    spreadsheetId: "1P2obXP897U3TsroJVQZc4C6boArSRDrs8Y6K7F6Oqp4",
    sheetName: "INVENTORY_RECONCILIATION_FILES",
  }),
  Object.freeze({
    logicalName: "TEST_RESULTS",
    spreadsheetId: "1nluY0JR9R-WgZnEUr4YDNWc9FE6CQC2MPrgaIt_dt8o",
    sheetName: "TEST_RESULTS",
  }),
  Object.freeze({
    logicalName: "VACATION_CHECK",
    spreadsheetId: "18oU3-PYS_za92knw7WSsaxkiH70TxnhDZXu1WcTNvBc",
    sheetName: "VACATION_CHECK",
  }),
  Object.freeze({
    logicalName: "FORMAT_RULES_REGISTRY",
    spreadsheetId: "1JCw8mYJruxE3rDWet2hiqJyxwB6CziZyccRgDviHGCk",
    sheetName: "FORMAT_RULES_REGISTRY",
  }),
  Object.freeze({
    logicalName: "CHECKPOINTS",
    spreadsheetId: "1_8RmgNu0lTcI0B0APyLhp8Bd0Wl2BbuBpQyVLCgXAz8",
    sheetName: "CHECKPOINTS",
  }),
  Object.freeze({
    logicalName: "TEMPLATES",
    spreadsheetId: "12NWIol2YGyP265r530T8yoWcyw58cSemNgv7UM20uHU",
    sheetName: "TEMPLATES",
  }),
  Object.freeze({
    logicalName: "ACTIVE_OPERATIONS",
    spreadsheetId: "1auukT5WkAPi0QxNZ94aeuS0aKsA8yZ5syU0jhH4enos",
    sheetName: "ACTIVE_OPERATIONS",
  }),
  Object.freeze({
    logicalName: "JOB_RUNTIME_LOG",
    spreadsheetId: "11Ib5FMQK_VPNJK2fZ2kDDS6M_iy4LwFWhMqNp_n6Goo",
    sheetName: "JOB_RUNTIME_LOG",
  }),
  Object.freeze({
    logicalName: "OPS_LOG",
    spreadsheetId: "1j4E6oEbEIM5_gGbqUKReAMbYUzenxiXKFuhWG2tLDZ0",
    sheetName: "OPS_LOG",
  }),
  Object.freeze({
    logicalName: "ALERTS_LOG",
    spreadsheetId: "1H13KhegBo16j7B--PuMFs7sB-VFUZvoechqEAhkI1cM",
    sheetName: "ALERTS_LOG",
  }),
  Object.freeze({
    logicalName: "AUDIT_LOG",
    spreadsheetId: "1i0kyTjaxWqPXyGKhD_B3ZKFUFFZ7IljOBg5O_Sjzc8Y",
    sheetName: "AUDIT_LOG",
  }),
  Object.freeze({
    logicalName: "LOG",
    spreadsheetId: "1TkCeVhanEXSWFyizsCaNxCnKQDKbPPYEAuXd0kIyQ6A",
    sheetName: "LOG",
  }),
]);

var EXTERNAL_SPREADSHEETS_BY_NAME_ = (function () {
  var map = {};
  EXTERNAL_SPREADSHEET_ENTRIES_.forEach(function (entry) {
    map[entry.logicalName] = entry;
  });
  return Object.freeze(map);
})();

var _externalSpreadsheetCache_ = Object.create(null);
var _externalSheetCache_ = Object.create(null);
var _externalStorageModeCache_ = null;

function _externalTrimName_(value) {
  return String(value == null ? "" : value).trim();
}

function _externalArchiveOwnerName_(name) {
  var text = _externalTrimName_(name);
  var match = text.match(/^(OPS_LOG|CHECKPOINTS)_(\d{4})_(\d{2})$/);
  return match ? match[1] : "";
}

function _externalPlaceholderSheetName_(name) {
  var text = _externalTrimName_(name);
  return (
    text === "Аркуш1" ||
    text === "Sheet1" ||
    text === "Лист1" ||
    text === "Sheet 1"
  );
}

function getExternalSpreadsheetEntry_(name) {
  var text = _externalTrimName_(name);
  if (!text) return null;
  if (EXTERNAL_SPREADSHEETS_BY_NAME_[text]) {
    return EXTERNAL_SPREADSHEETS_BY_NAME_[text];
  }
  var owner = _externalArchiveOwnerName_(text);
  return owner ? EXTERNAL_SPREADSHEETS_BY_NAME_[owner] || null : null;
}

function isExternalLogicalSheet_(name) {
  return !!getExternalSpreadsheetEntry_(name);
}

function getExternalSpreadsheetId_(name) {
  var entry = getExternalSpreadsheetEntry_(name);
  return entry ? entry.spreadsheetId : "";
}

function listExternalSpreadsheetEntries_() {
  return EXTERNAL_SPREADSHEET_ENTRIES_.slice();
}

function invalidateExternalStorageRuntimeCache_() {
  _externalStorageModeCache_ = null;
  _externalSheetCache_ = Object.create(null);
}

function _readExternalScriptProperty_(name) {
  try {
    var props = PropertiesService.getScriptProperties();
    if (!props || typeof props.getProperty !== "function") return "";
    return String(props.getProperty(name) || "").trim();
  } catch (_) {
    return "";
  }
}

function getExternalStorageMode_() {
  if (_externalStorageModeCache_) return _externalStorageModeCache_;
  var raw = _readExternalScriptProperty_(WASB_EXTERNAL_STORAGE_MODE_PROPERTY_)
    .toLowerCase();
  var mode = raw === "legacy" || raw === "migration" || raw === "external"
    ? raw
    : "legacy";
  _externalStorageModeCache_ = mode;
  return mode;
}

function usesExternalProductionRouting_() {
  return getExternalStorageMode_() === "external";
}

function _writeExternalScriptProperty_(name, value) {
  PropertiesService.getScriptProperties().setProperty(
    name,
    value == null ? "" : String(value),
  );
}

function _externalStableHash_(text) {
  var payload = String(text || "");
  if (
    typeof Utilities !== "undefined" &&
    Utilities &&
    typeof Utilities.computeDigest === "function"
  ) {
    var digest = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      payload,
    );
    var hex = [];
    for (var i = 0; i < digest.length; i++) {
      var b = digest[i];
      if (b < 0) b += 256;
      var h = b.toString(16);
      hex.push(h.length === 1 ? "0" + h : h);
    }
    return hex.join("");
  }
  var hash = 2166136261;
  for (var j = 0; j < payload.length; j++) {
    hash ^= payload.charCodeAt(j);
    hash = Math.imul(hash, 16777619);
  }
  return "fnv:" + (hash >>> 0).toString(16);
}

function getExternalRegistryHash_() {
  var payload = EXTERNAL_SPREADSHEET_ENTRIES_.map(function (entry) {
    return entry.logicalName + ":" + entry.spreadsheetId + ":" + entry.sheetName;
  }).join("|");
  return _externalStableHash_(payload);
}

function getExternalMigrationReceipt_() {
  var raw = _readExternalScriptProperty_(WASB_EXTERNAL_MIGRATION_PARITY_PROPERTY_);
  if (!raw) return { status: "FAIL" };
  var lower = raw.toLowerCase();
  if (lower === "pass" || lower === "fail") {
    return { status: "FAIL", legacy: true };
  }
  try {
    var parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { status: "FAIL" };
    var status = String(parsed.status || "").toUpperCase();
    parsed.status = status === "PASS" ? "PASS" : "FAIL";
    return parsed;
  } catch (_) {
    return { status: "FAIL" };
  }
}

function getExternalMigrationParity_() {
  return getExternalMigrationReceipt_().status === "PASS" ? "pass" : "fail";
}

function writeExternalMigrationReceipt_(receipt) {
  var payload = receipt && typeof receipt === "object" ? receipt : {};
  var status = String(payload.status || "").toUpperCase() === "PASS" ? "PASS" : "FAIL";
  var record = {
    status: status,
    checkedAt: payload.checkedAt || new Date().toISOString(),
    sourceSpreadsheetId:
      payload.sourceSpreadsheetId || WASB_MAIN_WORKBOOK_ID_,
    registryHash: payload.registryHash || getExternalRegistryHash_(),
    resources: Number(payload.resources) || 0,
    sourceFingerprint: String(payload.sourceFingerprint || ""),
    targetFingerprint: String(payload.targetFingerprint || ""),
    sheets: Array.isArray(payload.sheets) ? payload.sheets : [],
  };
  _writeExternalScriptProperty_(
    WASB_EXTERNAL_MIGRATION_PARITY_PROPERTY_,
    JSON.stringify(record),
  );
  return record;
}

function setExternalMigrationParity_(ok) {
  return writeExternalMigrationReceipt_({
    status: ok ? "PASS" : "FAIL",
    resources: ok ? 17 : 0,
  });
}

function isExternalCutoverInProgress_() {
  return _readExternalScriptProperty_(WASB_EXTERNAL_CUTOVER_PROPERTY_) === "1";
}

function setExternalCutoverInProgress_(active) {
  if (active) {
    _writeExternalScriptProperty_(WASB_EXTERNAL_CUTOVER_PROPERTY_, "1");
  } else {
    try {
      PropertiesService.getScriptProperties().deleteProperty(
        WASB_EXTERNAL_CUTOVER_PROPERTY_,
      );
    } catch (_) {
      _writeExternalScriptProperty_(WASB_EXTERNAL_CUTOVER_PROPERTY_, "");
    }
  }
}

function withExternalLogicalMutation_(name, fn) {
  if (typeof fn !== "function") {
    throw new Error("withExternalLogicalMutation_ потребує callback");
  }
  var text = _externalTrimName_(name);
  var needsLock =
    !!getExternalSpreadsheetEntry_(text) &&
    (getExternalStorageMode_() === "migration" ||
      isExternalCutoverInProgress_());
  if (!needsLock || _externalMutationLockDepth_ > 0) return fn();
  var run = function () {
    _externalMutationLockDepth_ += 1;
    try {
      return fn();
    } finally {
      _externalMutationLockDepth_ -= 1;
    }
  };
  if (typeof withScriptLock_ === "function") {
    return withScriptLock_(run, 30000);
  }
  return run();
}

function describeExternalStorageMode_() {
  var mode = getExternalStorageMode_();
  var receipt = getExternalMigrationReceipt_();
  return {
    mode: mode,
    property: WASB_EXTERNAL_STORAGE_MODE_PROPERTY_,
    parity: receipt.status === "PASS" ? "pass" : "fail",
    receipt: receipt,
    recommendedExternal: false,
    recommendedNext: mode === "migration" ? "finalize" : "",
    usesExternalProductionRouting: mode === "external",
    mainWorkbookId: WASB_MAIN_WORKBOOK_ID_,
    cutoverInProgress: isExternalCutoverInProgress_(),
  };
}

function _auditExternalEmergencyOverride_(mode) {
  if (
    typeof Stage7AuditTrail_ !== "object" ||
    !Stage7AuditTrail_ ||
    typeof Stage7AuditTrail_.record !== "function"
  ) {
    return false;
  }
  Stage7AuditTrail_.record({
    scenario: "external-storage-emergency-override",
    level: "WARN",
    status: "applied",
    message: "Аварійне увімкнення external без finalizer",
    payload: { mode: mode },
    dryRun: false,
  });
  return true;
}

function setExternalStorageMode_(mode, options) {
  var opts = options && typeof options === "object" ? options : {};
  var next = _externalTrimName_(mode).toLowerCase();
  if (next !== "legacy" && next !== "migration" && next !== "external") {
    throw new Error(
      "Недопустимий WASB_EXTERNAL_STORAGE_MODE: " +
        String(mode || "") +
        ". Дозволено: legacy, migration, external.",
    );
  }
  var emergency = false;
  if (next === "external") {
    if (opts.fromFinalizer === true) {
      emergency = false;
    } else if (opts.confirmParity === true) {
      emergency = true;
      _auditExternalEmergencyOverride_(next);
    } else {
      throw new Error(
        "Для увімкнення external використайте apiFinalizeExternalSpreadsheetMigration. " +
          "Старий parity receipt не є підставою для cutover. " +
          "Аварійно лише confirmParity:true.",
      );
    }
  }
  PropertiesService.getScriptProperties().setProperty(
    WASB_EXTERNAL_STORAGE_MODE_PROPERTY_,
    next,
  );
  invalidateExternalStorageRuntimeCache_();
  var report = describeExternalStorageMode_();
  if (emergency) {
    report.emergencyOverride = true;
    report.warning =
      "Аварійний override: режим external без фінальної перевірки parity.";
  }
  return report;
}

function getExternalMigrationSourceSpreadsheetId_() {
  return WASB_MAIN_WORKBOOK_ID_;
}

function getExternalMigrationTargetSpreadsheetId_(name) {
  return getExternalSpreadsheetId_(name);
}

function _openSpreadsheetByIdCached_(spreadsheetId) {
  var id = _externalTrimName_(spreadsheetId);
  if (!id) {
    throw new Error("Порожній Spreadsheet ID для зовнішньої таблиці");
  }
  if (_externalSpreadsheetCache_[id]) return _externalSpreadsheetCache_[id];
  try {
    var ss = SpreadsheetApp.openById(id);
    if (!ss) {
      throw new Error("SpreadsheetApp.openById повернув порожнє значення");
    }
    _externalSpreadsheetCache_[id] = ss;
    return ss;
  } catch (error) {
    var message = error && error.message ? String(error.message) : String(error);
    throw new Error(
      'Немає доступу до зовнішньої таблиці "' +
        id +
        '": ' +
        message +
        ". Не використовується основна книга як fallback.",
    );
  }
}

function getLogicalSpreadsheet_(name) {
  var text = _externalTrimName_(name);
  var entry = getExternalSpreadsheetEntry_(text);
  if (!entry || !usesExternalProductionRouting_()) return getWasbSpreadsheet_();
  return _openSpreadsheetByIdCached_(entry.spreadsheetId);
}

function _findLogicalSheetOnSpreadsheet_(ss, logicalName, canonicalSheetName) {
  if (!ss) return null;
  var wanted = _externalTrimName_(canonicalSheetName || logicalName);
  var exact = ss.getSheetByName(wanted);
  if (exact) return exact;
  var named = ss.getSheetByName(_externalTrimName_(logicalName));
  if (named) return named;
  var sheets = ss.getSheets ? ss.getSheets() : [];
  if (sheets.length === 1 && _externalPlaceholderSheetName_(sheets[0].getName())) {
    return sheets[0];
  }
  return null;
}

function getLogicalSheet_(name, required) {
  var text = _externalTrimName_(name);
  if (!text) {
    if (required === false) return null;
    throw new Error("Порожня назва аркуша");
  }
  var cacheKey = getExternalStorageMode_() + "|" + text;
  if (Object.prototype.hasOwnProperty.call(_externalSheetCache_, cacheKey)) {
    var cached = _externalSheetCache_[cacheKey];
    if (cached || required === false) return cached || null;
  }
  var entry = getExternalSpreadsheetEntry_(text);
  var useExternal = !!(entry && usesExternalProductionRouting_());
  var sheet = null;
  if (useExternal) {
    var ss = _openSpreadsheetByIdCached_(entry.spreadsheetId);
    var canonical = _externalArchiveOwnerName_(text) ? text : entry.sheetName;
    sheet = _findLogicalSheetOnSpreadsheet_(ss, text, canonical);
  } else {
    sheet = getWasbSpreadsheet_().getSheetByName(text);
  }
  _externalSheetCache_[cacheKey] = sheet || null;
  if (!sheet && required !== false) {
    throw new Error(
      useExternal
        ? 'Аркуш "' +
            text +
            '" не знайдено у зовнішній таблиці ' +
            entry.spreadsheetId
        : 'Аркуш "' + text + '" не знайдено в основній книзі',
    );
  }
  return sheet || null;
}

function ensureLogicalSheet_(name) {
  var text = _externalTrimName_(name);
  if (!text) throw new Error("Порожня назва аркуша");
  var existing = getLogicalSheet_(text, false);
  if (existing) {
    var entry = getExternalSpreadsheetEntry_(text);
    var canonical = entry
      ? _externalArchiveOwnerName_(text)
        ? text
        : entry.sheetName
      : text;
    if (
      usesExternalProductionRouting_() &&
      existing.getName() !== canonical &&
      _externalPlaceholderSheetName_(existing.getName())
    ) {
      existing.setName(canonical);
      _externalSheetCache_[getExternalStorageMode_() + "|" + text] = existing;
    }
    return existing;
  }
  var owner = getExternalSpreadsheetEntry_(text);
  var useExternal = !!(owner && usesExternalProductionRouting_());
  var ss = useExternal
    ? _openSpreadsheetByIdCached_(owner.spreadsheetId)
    : getWasbSpreadsheet_();
  var createName = useExternal
    ? _externalArchiveOwnerName_(text)
      ? text
      : owner.sheetName
    : text;
  var created = ss.insertSheet(createName);
  _externalSheetCache_[getExternalStorageMode_() + "|" + text] = created;
  return created;
}

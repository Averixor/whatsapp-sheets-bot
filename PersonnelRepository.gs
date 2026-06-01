/**
 * PersonnelRepository.gs — canonical PERSONNEL sheet access (header-based only).
 *
 * Keys (practical):
 *   - Schedule / monthly sheets: Callsign
 *   - PERSONNEL lookup: Callsign → fallback FML
 *   - ID (Армія+): optional data field, NOT a stable system key
 *   - Position: organizational slot, NOT a person key
 *
 * Status column (UA only in sheet): Дієвий | Тимчасовий | Відрядження | Вибув
 * (empty = Дієвий). Runtime active: first three; inactive: Вибув only.
 * Legacy EN on read: Active→Дієвий, Temp→Тимчасовий, Removed/Transferred→Вибув.
 */

var PERSONNEL_SHEET_NAME =
  typeof CONFIG !== "undefined" && CONFIG && CONFIG.PERSONNEL_SHEET
    ? CONFIG.PERSONNEL_SHEET
    : "PERSONNEL";

/** Sheet must have these header columns (ID is optional). */
/** Canonical header order (values in ID may be empty). */
var PERSONNEL_CANONICAL_HEADER_ORDER_ = [
  "ID",
  "FML",
  "Birthday",
  "Age",
  "Days_until_birthday",
  "Phone",
  "2_Phone",
  "Callsign",
  "Title",
  "Position",
  "OSH_4",
  "Unit",
  "Status",
];

var PERSONNEL_REQUIRED_HEADER_KEYS = [
  "FML",
  "Birthday",
  "Age",
  "Days_until_birthday",
  "Phone",
  "2_Phone",
  "Callsign",
  "Title",
  "Position",
  "OSH_4",
  "Status",
];

/** ID and Unit columns recommended; ID values may be blank. */
var PERSONNEL_OPTIONAL_HEADER_KEYS = ["ID", "Unit"];

/** Значення в аркуші PERSONNEL (українською, без змішування з EN). */
var PERSONNEL_ACTIVE_STATUSES_ = ["Дієвий", "Тимчасовий", "Відрядження"];

var PERSONNEL_INACTIVE_STATUSES_ = ["Вибув"];

var PERSONNEL_STATUS_SHEET_VALUES_ = [
  "Дієвий",
  "Тимчасовий",
  "Відрядження",
  "Вибув",
];

var PERSONNEL_DEFAULT_STATUS_UA_ = "Дієвий";

/** Legacy EN / synonyms / typos → canonical UA label. */
var PERSONNEL_STATUS_LEGACY_TO_UA_ = {
  active: "Дієвий",
  aktiv: "Дієвий",
  активний: "Дієвий",
  активна: "Дієвий",
  дієвий: "Дієвий",
  діевий: "Дієвий",
  дієв: "Дієвий",
  temp: "Тимчасовий",
  temporary: "Тимчасовий",
  тимчасовий: "Тимчасовий",
  тимчасово: "Тимчасовий",
  відрядження: "Відрядження",
  vidriadzhennia: "Відрядження",
  deployment: "Відрядження",
  assignment: "Відрядження",
  transferred: "Вибув",
  transfered: "Вибув",
  переведений: "Вибув",
  переведено: "Вибув",
  removed: "Вибув",
  deleted: "Вибув",
  inactive: "Вибув",
  archived: "Вибув",
  вибув: "Вибув",
  вибувший: "Вибув",
  видалено: "Вибув",
  видалений: "Вибув",
};

var PERSONNEL_STATUS_UA_TO_CANONICAL_ = {
  Дієвий: "Active",
  Тимчасовий: "Temp",
  Відрядження: "Assignment",
  Вибув: "Removed",
};

function _personnelGlobal_() {
  try {
    if (typeof globalThis !== "undefined") return globalThis;
  } catch (e) {}
  try {
    return this;
  } catch (e) {}
  return {};
}

function _personnelState_() {
  var root = _personnelGlobal_();
  if (
    !root.__WASB_PERSONNEL_REPO_STATE__ ||
    typeof root.__WASB_PERSONNEL_REPO_STATE__ !== "object"
  ) {
    root.__WASB_PERSONNEL_REPO_STATE__ = {
      rowsCache: null,
      warnings: [],
    };
  }
  return root.__WASB_PERSONNEL_REPO_STATE__;
}

function invalidatePersonnelCache_() {
  var state = _personnelState_();
  state.rowsCache = null;
  state.warnings = [];
}

function _personnelNormalizeStatusKey_(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[’'`"ʼ]/g, "")
    .replace(/\s+/g, " ");
}

function normalizePersonnelStatus_(raw) {
  var text = String(raw || "").trim();
  if (!text) return PERSONNEL_DEFAULT_STATUS_UA_;

  var key = _personnelNormalizeStatusKey_(text);
  if (PERSONNEL_STATUS_LEGACY_TO_UA_[key]) {
    return PERSONNEL_STATUS_LEGACY_TO_UA_[key];
  }

  var i;
  for (i = 0; i < PERSONNEL_STATUS_SHEET_VALUES_.length; i++) {
    if (
      _personnelNormalizeStatusKey_(PERSONNEL_STATUS_SHEET_VALUES_[i]) === key
    ) {
      return PERSONNEL_STATUS_SHEET_VALUES_[i];
    }
  }

  return text;
}

function getPersonnelStatusCanonical_(statusUa) {
  var ua = normalizePersonnelStatus_(statusUa);
  return PERSONNEL_STATUS_UA_TO_CANONICAL_[ua] || "Active";
}

function isPersonnelStatusActive_(status) {
  var ua = normalizePersonnelStatus_(status);
  return PERSONNEL_ACTIVE_STATUSES_.indexOf(ua) !== -1;
}

function getPersonnelStatusListValues_() {
  return PERSONNEL_STATUS_SHEET_VALUES_.slice();
}

/**
 * Dropdown для всієї колонки Status (рядки 2…maxRows), не однієї клітинки.
 */
function applyPersonnelStatusColumnValidation_(sh) {
  if (!sh) {
    return { applied: false, reason: "no sheet" };
  }

  var lastCol = Math.max(sh.getLastColumn(), 1);
  var headers = sh.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  var colIndex;
  try {
    colIndex = _personnelBuildHeaderColIndex_(headers);
  } catch (e) {
    return {
      applied: false,
      reason: e && e.message ? e.message : String(e),
    };
  }

  if (colIndex.Status < 0) {
    return { applied: false, reason: "Status column missing" };
  }

  var statusCol = colIndex.Status + 1;
  var maxRows = Math.max(Number(sh.getMaxRows()) || 0, 500);
  if (maxRows < 2) maxRows = 500;

  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(getPersonnelStatusListValues_(), true)
    .setAllowInvalid(false)
    .setHelpText(
      "Дієвий | Тимчасовий | Відрядження | Вибув. Порожньо = Дієвий (у коді).",
    )
    .build();

  sh.getRange(2, statusCol, maxRows - 1, 1).setDataValidation(rule);

  return {
    applied: true,
    column: statusCol,
    rows: maxRows - 1,
    values: getPersonnelStatusListValues_(),
  };
}

function applyPersonnelStatusColumnValidation() {
  var sh = _personnelGetSheet_(false);
  if (!sh) {
    throw new Error('Аркуш "' + _personnelSheetName_() + '" не знайдено');
  }
  return applyPersonnelStatusColumnValidation_(sh);
}

function _personnelNormalizeHeaderCell_(value) {
  return String(value || "")
    .trim()
    .replace(/[’'`"ʼ]/g, "")
    .replace(/\s+/g, " ");
}

function _personnelCanonicalHeaderKey_(rawHeader) {
  var text = _personnelNormalizeHeaderCell_(rawHeader);
  if (!text) return "";

  var lower = text.toLowerCase();

  var aliases = {
    id: "ID",
    "id армія+": "ID",
    "армія+": "ID",
    fml: "FML",
    "піб": "FML",
    pib: "FML",
    birthday: "Birthday",
    "день народження": "Birthday",
    age: "Age",
    "вік": "Age",
    days_until_birthday: "Days_until_birthday",
    "days until birthday": "Days_until_birthday",
    phone: "Phone",
    телефон: "Phone",
    "2_phone": "2_Phone",
    "2 phone": "2_Phone",
    "телефон 2": "2_Phone",
    callsign: "Callsign",
    позивний: "Callsign",
    title: "Title",
    звання: "Title",
    position: "Position",
    посада: "Position",
    osh_4: "OSH_4",
    "ошс 4": "OSH_4",
    oshs: "OSH_4",
    unit: "Unit",
    підрозділ: "Unit",
    status: "Status",
    статус: "Status",
  };

  if (aliases[lower]) return aliases[lower];

  if (text === "2_Phone" || text === "2 Phone") return "2_Phone";
  if (text === "Days_until_birthday") return "Days_until_birthday";
  if (text === "OSH_4") return "OSH_4";

  return text;
}

function _personnelSheetName_() {
  return PERSONNEL_SHEET_NAME;
}

function _personnelGetSheet_(mustExist) {
  var ss = getWasbSpreadsheet_();
  var sh = ss.getSheetByName(_personnelSheetName_());
  if (!sh && mustExist) {
    throw new Error(
      'Аркуш "' +
        _personnelSheetName_() +
        '" не знайдено. Створіть базу особового складу з колонками: ' +
        PERSONNEL_REQUIRED_HEADER_KEYS.concat(PERSONNEL_OPTIONAL_HEADER_KEYS).join(
          ", ",
        ),
    );
  }
  return sh || null;
}

function _personnelBuildHeaderColIndex_(headersRow) {
  var col = {};
  var headers = headersRow || [];

  for (var i = 0; i < headers.length; i++) {
    var canonical = _personnelCanonicalHeaderKey_(headers[i]);
    if (!canonical) continue;
    if (col[canonical] === undefined) {
      col[canonical] = i;
    }
  }

  var missing = [];
  PERSONNEL_REQUIRED_HEADER_KEYS.forEach(function (key) {
    if (col[key] === undefined) missing.push(key);
  });

  if (missing.length) {
    throw new Error(
      'Аркуш "' +
        _personnelSheetName_() +
        '": відсутні обовʼязкові колонки: ' +
        missing.join(", "),
    );
  }

  PERSONNEL_OPTIONAL_HEADER_KEYS.forEach(function (key) {
    if (col[key] === undefined) col[key] = -1;
  });

  return col;
}

function _personnelReadCell_(row, colIndex) {
  if (colIndex === undefined || colIndex < 0) return "";
  return row[colIndex];
}

function _personnelRowToRecord_(row, sheetRow, col) {
  var callsign = String(_personnelReadCell_(row, col.Callsign) || "").trim();
  var fml = String(_personnelReadCell_(row, col.FML) || "").trim();
  var id =
    col.ID >= 0 ? String(_personnelReadCell_(row, col.ID) || "").trim() : "";
  var unit =
    col.Unit >= 0 ? String(_personnelReadCell_(row, col.Unit) || "").trim() : "";
  var statusRaw =
    col.Status >= 0
      ? String(_personnelReadCell_(row, col.Status) || "").trim()
      : "";
  var status = normalizePersonnelStatus_(statusRaw);
  var statusCanonical = getPersonnelStatusCanonical_(status);
  var active = isPersonnelStatusActive_(status);

  if (!fml && !callsign) {
    if (unit) return null;
    return null;
  }

  var record = {
    id: id,
    fml: fml,
    birthday: String(_personnelReadCell_(row, col.Birthday) || "").trim(),
    age: String(_personnelReadCell_(row, col.Age) || "").trim(),
    daysUntilBirthday: String(
      _personnelReadCell_(row, col.Days_until_birthday) || "",
    ).trim(),
    phone: String(_personnelReadCell_(row, col.Phone) || "").trim(),
    phone2: String(_personnelReadCell_(row, col["2_Phone"]) || "").trim(),
    callsign: callsign,
    title: String(_personnelReadCell_(row, col.Title) || "").trim(),
    position: String(_personnelReadCell_(row, col.Position) || "").trim(),
    oshs: String(_personnelReadCell_(row, col.OSH_4) || "").trim(),
    unit: unit,
    status: status,
    statusCanonical: statusCanonical,
    active: active,
    rank: String(_personnelReadCell_(row, col.Title) || "").trim(),
    sheetRow: sheetRow,
  };

  record.ID = record.id;
  record.FML = record.fml;
  record.Birthday = record.birthday;
  record.Age = record.age;
  record.Days_until_birthday = record.daysUntilBirthday;
  record.Phone = record.phone;
  record["2_Phone"] = record.phone2;
  record.Callsign = record.callsign;
  record.Title = record.title;
  record.Position = record.position;
  record.OSH_4 = record.oshs;
  if (record.unit) record.Unit = record.unit;
  record.Status = record.status;

  return record;
}

function _personnelLoadRowsUncached_() {
  var sh = _personnelGetSheet_(true);
  var lastCol = Math.max(sh.getLastColumn(), 1);
  var lastRow = Math.max(sh.getLastRow(), 1);
  var values = sh.getRange(1, 1, lastRow, lastCol).getDisplayValues();
  var col = _personnelBuildHeaderColIndex_(values[0] || []);
  if (lastRow < 2) {
    return { rows: [], warnings: [] };
  }

  var warnings = [];
  var rows = [];
  var activeCallsignSeen = Object.create(null);

  for (var i = 1; i < values.length; i++) {
    var record = _personnelRowToRecord_(values[i], i + 1, col);
    if (!record) continue;

    rows.push(record);

    if (record.active && record.callsign) {
      var key =
        typeof _normCallsignKey_ === "function"
          ? _normCallsignKey_(record.callsign)
          : String(record.callsign).trim().toUpperCase();

      if (activeCallsignSeen[key]) {
        var msg =
          'PERSONNEL: дубль активного позивного "' +
          record.callsign +
          '" (рядки ' +
          activeCallsignSeen[key] +
          " та " +
          record.sheetRow +
          ")";
        warnings.push(msg);
        try {
          Logger.log("[PersonnelRepository] " + msg);
        } catch (e) {}
      } else {
        activeCallsignSeen[key] = record.sheetRow;
      }
    }
  }

  return { rows: rows, warnings: warnings };
}

function _personnelGetLoaded_() {
  var state = _personnelState_();
  if (state.rowsCache) return state.rowsCache;

  var loaded = _personnelLoadRowsUncached_();
  state.rowsCache = loaded.rows;
  state.warnings = loaded.warnings;
  return state.rowsCache;
}

function getPersonnelWarnings_() {
  _personnelGetLoaded_();
  return (_personnelState_().warnings || []).slice();
}

/** Усі рядки PERSONNEL (включно з Вибув). */
function getPersonnelRows_() {
  return _personnelGetLoaded_().slice();
}

/** Лише Дієвий / Тимчасовий / Відрядження (для графіка, телефонів, карток, списків). */
function getPersonnelActiveRows_() {
  return getPersonnelRows_().filter(function (row) {
    return row && row.active === true;
  });
}

function getPersonnelMapById_() {
  var map = Object.create(null);
  getPersonnelRows_().forEach(function (row) {
    var id = String(row.id || "").trim();
    if (!id) return;
    map[id] = row;
  });
  return map;
}

/** Карта лише активних бійців з позивним (основний lookup для графіка). */
function getPersonnelMapByCallsign_() {
  var map = Object.create(null);
  getPersonnelActiveRows_().forEach(function (row) {
    var callsign = String(row.callsign || "").trim();
    if (!callsign) return;
    var key =
      typeof _normCallsignKey_ === "function"
        ? _normCallsignKey_(callsign)
        : callsign.toUpperCase();
    map[key] = row;
  });
  return map;
}

/** Опційний ID Армія+ (не системний ключ). */
function getPersonnelById_(id) {
  var key = String(id || "").trim();
  if (!key) return null;
  return getPersonnelMapById_()[key] || null;
}

function getPersonnelByCallsign_(callsign) {
  var key =
    typeof _normCallsignKey_ === "function"
      ? _normCallsignKey_(callsign)
      : String(callsign || "")
          .trim()
          .toUpperCase();
  if (!key) return null;
  return getPersonnelMapByCallsign_()[key] || null;
}

/** Карта всіх рядків PERSONNEL з позивним (будь-який Status) — для зведень за графіком. */
function getPersonnelMapByCallsignAll_() {
  var map = Object.create(null);
  getPersonnelRows_().forEach(function (row) {
    var callsign = String(row.callsign || "").trim();
    if (!callsign) return;
    var key =
      typeof _normCallsignKey_ === "function"
        ? _normCallsignKey_(callsign)
        : callsign.toUpperCase();
    map[key] = row;
  });
  return map;
}

/** Lookup за позивним без фільтра Status (зведення, відображення ПІБ). */
function getPersonnelByCallsignAnyStatus_(callsign) {
  var key =
    typeof _normCallsignKey_ === "function"
      ? _normCallsignKey_(callsign)
      : String(callsign || "")
          .trim()
          .toUpperCase();
  if (!key) return null;
  return getPersonnelMapByCallsignAll_()[key] || null;
}

function getPersonnelByFml_(fml, options) {
  var opts = options || {};
  var activeOnly = opts.activeOnly !== false;
  var target =
    typeof _normFml_ === "function"
      ? _normFml_(fml)
      : String(fml || "")
          .trim()
          .toLowerCase();
  if (!target) return null;

  var rows = activeOnly ? getPersonnelActiveRows_() : getPersonnelRows_();
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var rowKey =
      typeof _normFml_ === "function"
        ? _normFml_(row.fml)
        : String(row.fml || "")
            .trim()
            .toLowerCase();
    if (rowKey && rowKey === target) return row;
  }
  return null;
}

function getPersonnelCallsignsList_() {
  return getPersonnelActiveRows_()
    .map(function (row) {
      return String(row.callsign || "").trim();
    })
    .filter(Boolean)
    .sort(function (a, b) {
      return String(a).localeCompare(String(b), "uk");
    });
}

/**
 * Список для UI «Особовий склад»: активні з PERSONNEL + позивні з поточного
 * місячного графіка (поки PERSONNEL не заповнений повністю).
 */
function getPersonnelCallsignsListForUi_() {
  var seen = Object.create(null);
  var list = [];

  function addCallsign(callsign) {
    var label = String(callsign || "").trim();
    if (!label) return;
    var key =
      typeof _normCallsignKey_ === "function"
        ? _normCallsignKey_(label)
        : label.toUpperCase();
    if (seen[key]) return;
    seen[key] = label;
    list.push(label);
  }

  getPersonnelCallsignsList_().forEach(addCallsign);

  try {
    if (
      typeof PersonsRepository_ === "object" &&
      PersonsRepository_ &&
      typeof PersonsRepository_.getMonthlyRows === "function"
    ) {
      var sheet =
        typeof getBotSheet_ === "function" ? getBotSheet_() : null;
      PersonsRepository_.getMonthlyRows(sheet).forEach(function (row) {
        addCallsign(row && row.callsign);
      });
    }
  } catch (monthlyErr) {
    try {
      Logger.log(
        "[PersonnelRepository] getPersonnelCallsignsListForUi_ monthly: " +
          (monthlyErr && monthlyErr.message
            ? monthlyErr.message
            : monthlyErr),
      );
    } catch (_) {}
  }

  list.sort(function (a, b) {
    return String(a).localeCompare(String(b), "uk");
  });
  return list;
}

function personnelRecordToPhoneIndexItem_(record) {
  if (!record || record.active === false) return null;
  var phone =
    typeof normalizePhone_ === "function"
      ? normalizePhone_(record.phone)
      : String(record.phone || "").trim();
  var callsign = String(record.callsign || "").trim();
  return {
    row: record.sheetRow,
    id: record.id || "",
    fml: record.fml,
    phone: phone,
    callsign: callsign,
    role: callsign,
    rawPhone: String(record.phone || "").trim(),
    birthday: record.birthday,
    phone2: record.phone2,
    title: record.title,
    position: record.position,
    oshs: record.oshs,
    unit: record.unit,
    status: record.status,
  };
}

function buildPhonesIndexFromPersonnel_() {
  var out = {
    byCallsign: {},
    byFml: {},
    byNorm: {},
    byRole: {},
    byPhone: {},
    items: [],
    versionMarker: "stage7-personnel-index-v2",
    source: "PERSONNEL",
  };

  getPersonnelActiveRows_().forEach(function (record) {
    var item = personnelRecordToPhoneIndexItem_(record);
    if (!item) return;
    if (!item.fml && !item.phone && !item.callsign) return;

    out.items.push(item);

    var fmlKey =
      typeof _normFmlForProfiles_ === "function"
        ? _normFmlForProfiles_(item.fml)
        : String(item.fml || "")
            .trim()
            .toUpperCase();
    var normKey =
      typeof normalizeFML_ === "function"
        ? normalizeFML_(item.fml)
        : String(item.fml || "")
            .trim()
            .toLowerCase();
    var callsignKey =
      typeof _normCallsignKey_ === "function"
        ? _normCallsignKey_(item.callsign || item.role)
        : String(item.callsign || item.role || "")
            .trim()
            .toUpperCase();

    if (fmlKey) out.byFml[fmlKey] = item;
    if (normKey) out.byNorm[normKey] = item;
    if (callsignKey) out.byCallsign[callsignKey] = item;
    if (callsignKey) out.byRole[callsignKey] = item;
    if (item.phone) out.byPhone[item.phone] = item;
  });

  return out;
}

function isPersonnelSheetAvailable_() {
  try {
    var sh = _personnelGetSheet_(false);
    return !!(sh && sh.getLastRow() >= 2);
  } catch (e) {
    return false;
  }
}

function mergePersonnelIntoPersonView_(base, personnel) {
  if (!personnel) return base;
  var out = Object.assign({}, base || {});
  if (personnel.id) out.id = personnel.id;
  if (personnel.fml) out.fml = personnel.fml;
  if (personnel.callsign) out.callsign = personnel.callsign;
  if (personnel.title || personnel.rank) {
    out.rank = personnel.title || personnel.rank;
  }
  if (personnel.position) out.position = personnel.position;
  if (personnel.oshs) out.oshs = personnel.oshs;
  if (personnel.birthday) out.birthday = personnel.birthday;
  if (personnel.unit) out.unit = personnel.unit;
  if (personnel.status) out.status = personnel.status;

  var phone =
    typeof normalizePhone_ === "function"
      ? normalizePhone_(personnel.phone)
      : String(personnel.phone || "").trim();
  if (phone) out.phone = phone;
  if (personnel.phone2) out.phone2 = personnel.phone2;

  return out;
}

/**
 * Lookup: Callsign (active) → FML (active) → optional ID hint (any status).
 * ID is never required for cards, schedule, phones, or birthdays.
 */
function resolvePersonnelForLookup_(callsign, fml, id) {
  if (callsign) {
    var byCall = getPersonnelByCallsign_(callsign);
    if (byCall) return byCall;
  }
  if (fml) {
    var byFml = getPersonnelByFml_(fml, { activeOnly: true });
    if (byFml) return byFml;
  }
  if (id) {
    return getPersonnelById_(id);
  }
  return null;
}

var PersonnelRepository_ = PersonnelRepository_ || {
  getRows: getPersonnelRows_,
  getActiveRows: getPersonnelActiveRows_,
  getById: getPersonnelById_,
  getByCallsign: getPersonnelByCallsign_,
  getByCallsignAnyStatus: getPersonnelByCallsignAnyStatus_,
  getByFml: getPersonnelByFml_,
  getMapById: getPersonnelMapById_,
  getMapByCallsign: getPersonnelMapByCallsign_,
  getMapByCallsignAll: getPersonnelMapByCallsignAll_,
  getCallsignsList: getPersonnelCallsignsList_,
  getCallsignsListForUi: getPersonnelCallsignsListForUi_,
  invalidateCache: invalidatePersonnelCache_,
  isAvailable: isPersonnelSheetAvailable_,
  getWarnings: getPersonnelWarnings_,
  mergeIntoPerson: mergePersonnelIntoPersonView_,
  resolveForLookup: resolvePersonnelForLookup_,
  buildPhonesIndex: buildPhonesIndexFromPersonnel_,
  normalizeStatus: normalizePersonnelStatus_,
  getStatusCanonical: getPersonnelStatusCanonical_,
  isStatusActive: isPersonnelStatusActive_,
  activeStatuses: PERSONNEL_ACTIVE_STATUSES_,
  inactiveStatuses: PERSONNEL_INACTIVE_STATUSES_,
  applyStatusValidation: applyPersonnelStatusColumnValidation,
};

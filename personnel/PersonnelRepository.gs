/**
 * PersonnelRepository.gs — canonical PERSONNEL sheet access (header-based only).
 *
 * Keys (practical):
 *   - Schedule / monthly sheets: Callsign
 *   - PERSONNEL lookup: Callsign → fallback FML
 *   - ID (Армія+): optional data field, NOT a stable system key
 *   - Position: organizational slot, NOT a person key
 *
 * Status (UA): dropdown у PERSONNEL — 9 значень з книги (див. PERSONNEL_STATUS_SHEET_VALUES_).
 * Active runtime: усе, крім Вибув та СЗЧ.
 * Порожньо = В наявності.
 * Legacy EN/старі мітки на читанні: Active/Дієвий→В наявності, Temp→Тимчасовий,
 * Відрядження/Відкомандирований/Detached→PERSONNEL_STATUS_IN_TRIP_UA_, Removed→Вибув.
 */

var PERSONNEL_SHEET_NAME =
  typeof CONFIG !== "undefined" && CONFIG && CONFIG.PERSONNEL_SHEET
    ? CONFIG.PERSONNEL_SHEET
    : "PERSONNEL";

/** Sheet must have these header columns (ID and computed birthday helpers are optional). */
/** Canonical (logical) header order. Physical layout in reference workbook "Книга Взводу Охорони" uses:
 *  - Split names: "Last name", "First name", "Patronymic" (code synthesizes FML)
 *  - "TEMPLATE" column carries the working callsign value (preferred for lookup)
 *  - "OSH 4" (space), "Rank" instead of/plus Title, "ID v/s" + "ID"
 *  Reading is header-name based with aliases (see _personnelCanonicalHeaderKey_).
 */
var PERSONNEL_CANONICAL_HEADER_ORDER_ = [
  "ID",
  "FML",
  "Birthday",
  "Age",
  "Days_until_birthday",
  "Phone",
  "2_Phone",
  "Callsign",
  "TEMPLATE",
  "Rank",
  "Position",
  "OSH_4",
  "Unit",
  "Status",
];

var PERSONNEL_REQUIRED_HEADER_KEYS = [
  "FML",
  "Birthday",
  "Phone",
  "Callsign",
  "Position",
  "OSH_4",
  "Status",
];

/** ID, Unit, Rank/Title, 2_Phone, TEMPLATE, computed birthday helpers, split names (Last/First/Patronymic) — optional. Split names are used to synthesize FML when no FML column (as in reference Книга Взводу Охорони). */
var PERSONNEL_OPTIONAL_HEADER_KEYS = [
  "ID",
  "Age",
  "Days_until_birthday",
  "Unit",
  "2_Phone",
  "Title",
  "Rank",
  "TEMPLATE",
  "LastName",
  "FirstName",
  "Patronymic",
];

/** Canonical Status values (in-trip uses Cyrillic д only — do not retype). */
var PERSONNEL_STATUS_AVAILABLE_UA_ = "В наявності";

var PERSONNEL_STATUS_IN_TRIP_UA_ =
  "\u0423 \u0432\u0456\u0434\u0440\u044f\u0434\u0436\u0435\u043d\u043d\u0456";

var PERSONNEL_STATUS_REMOVED_UA_ = "Вибув";
var PERSONNEL_STATUS_VACATION_UA_ = "Відпустка";
var PERSONNEL_STATUS_HOSPITAL_UA_ = "Лікарняний";
var PERSONNEL_STATUS_TEMP_UA_ = "Тимчасовий";
var PERSONNEL_STATUS_HUSACHIVKA_UA_ = "Гусачівка";
var PERSONNEL_STATUS_BZVP_UA_ = "БЗВП";
var PERSONNEL_STATUS_SZCH_UA_ = "СЗЧ";

/** Dropdown і канонічні значення в колонці Status (порядок як у книзі). */
var PERSONNEL_STATUS_SHEET_VALUES_ = [
  PERSONNEL_STATUS_AVAILABLE_UA_,
  PERSONNEL_STATUS_IN_TRIP_UA_,
  PERSONNEL_STATUS_REMOVED_UA_,
  PERSONNEL_STATUS_VACATION_UA_,
  PERSONNEL_STATUS_HOSPITAL_UA_,
  PERSONNEL_STATUS_TEMP_UA_,
  PERSONNEL_STATUS_HUSACHIVKA_UA_,
  PERSONNEL_STATUS_BZVP_UA_,
  PERSONNEL_STATUS_SZCH_UA_,
];

/** Активні для графіка, телефонів, карток, списків (не Вибув / не СЗЧ). */
var PERSONNEL_ACTIVE_STATUSES_ = [
  PERSONNEL_STATUS_AVAILABLE_UA_,
  PERSONNEL_STATUS_IN_TRIP_UA_,
  PERSONNEL_STATUS_VACATION_UA_,
  PERSONNEL_STATUS_HOSPITAL_UA_,
  PERSONNEL_STATUS_TEMP_UA_,
  PERSONNEL_STATUS_HUSACHIVKA_UA_,
  PERSONNEL_STATUS_BZVP_UA_,
];

var PERSONNEL_INACTIVE_STATUSES_ = [
  PERSONNEL_STATUS_REMOVED_UA_,
  PERSONNEL_STATUS_SZCH_UA_,
];

var PERSONNEL_DEFAULT_STATUS_UA_ = PERSONNEL_STATUS_AVAILABLE_UA_;

/** Legacy EN / synonyms / typos → canonical UA label (dropdown). */
var PERSONNEL_STATUS_LEGACY_TO_UA_ = {
  active: PERSONNEL_STATUS_AVAILABLE_UA_,
  aktiv: PERSONNEL_STATUS_AVAILABLE_UA_,
  активний: PERSONNEL_STATUS_AVAILABLE_UA_,
  активна: PERSONNEL_STATUS_AVAILABLE_UA_,
  дієвий: PERSONNEL_STATUS_AVAILABLE_UA_,
  діевий: PERSONNEL_STATUS_AVAILABLE_UA_,
  дієв: PERSONNEL_STATUS_AVAILABLE_UA_,
  temp: PERSONNEL_STATUS_TEMP_UA_,
  temporary: PERSONNEL_STATUS_TEMP_UA_,
  тимчасово: PERSONNEL_STATUS_TEMP_UA_,
  відрядження: PERSONNEL_STATUS_IN_TRIP_UA_,
  відряджений: PERSONNEL_STATUS_IN_TRIP_UA_,
  відряджена: PERSONNEL_STATUS_IN_TRIP_UA_,
  vidriadzhennia: PERSONNEL_STATUS_IN_TRIP_UA_,
  deployment: PERSONNEL_STATUS_IN_TRIP_UA_,
  assignment: PERSONNEL_STATUS_IN_TRIP_UA_,
  detached: PERSONNEL_STATUS_IN_TRIP_UA_,
  відкомандирований: PERSONNEL_STATUS_IN_TRIP_UA_,
  відкомандерований: PERSONNEL_STATUS_IN_TRIP_UA_,
  transferred: PERSONNEL_STATUS_REMOVED_UA_,
  transfered: PERSONNEL_STATUS_REMOVED_UA_,
  переведений: PERSONNEL_STATUS_REMOVED_UA_,
  переведено: PERSONNEL_STATUS_REMOVED_UA_,
  removed: PERSONNEL_STATUS_REMOVED_UA_,
  deleted: PERSONNEL_STATUS_REMOVED_UA_,
  inactive: PERSONNEL_STATUS_REMOVED_UA_,
  archived: PERSONNEL_STATUS_REMOVED_UA_,
  вибувший: PERSONNEL_STATUS_REMOVED_UA_,
  видалено: PERSONNEL_STATUS_REMOVED_UA_,
  видалений: PERSONNEL_STATUS_REMOVED_UA_,
  наявності: PERSONNEL_STATUS_AVAILABLE_UA_,
  vacation: PERSONNEL_STATUS_VACATION_UA_,
  лікарн: PERSONNEL_STATUS_HOSPITAL_UA_,
  hospital: PERSONNEL_STATUS_HOSPITAL_UA_,
  гусачі: PERSONNEL_STATUS_HUSACHIVKA_UA_,
  awol: PERSONNEL_STATUS_SZCH_UA_,
};

var PERSONNEL_STATUS_UA_TO_CANONICAL_ = {};
PERSONNEL_STATUS_UA_TO_CANONICAL_[PERSONNEL_STATUS_AVAILABLE_UA_] = "Active";
PERSONNEL_STATUS_UA_TO_CANONICAL_[PERSONNEL_STATUS_IN_TRIP_UA_] = "Detached";
PERSONNEL_STATUS_UA_TO_CANONICAL_[PERSONNEL_STATUS_REMOVED_UA_] = "Removed";
PERSONNEL_STATUS_UA_TO_CANONICAL_[PERSONNEL_STATUS_VACATION_UA_] = "Vacation";
PERSONNEL_STATUS_UA_TO_CANONICAL_[PERSONNEL_STATUS_HOSPITAL_UA_] = "Hospital";
PERSONNEL_STATUS_UA_TO_CANONICAL_[PERSONNEL_STATUS_TEMP_UA_] = "Temp";
PERSONNEL_STATUS_UA_TO_CANONICAL_[PERSONNEL_STATUS_HUSACHIVKA_UA_] = "Away";
PERSONNEL_STATUS_UA_TO_CANONICAL_[PERSONNEL_STATUS_BZVP_UA_] = "Training";
PERSONNEL_STATUS_UA_TO_CANONICAL_[PERSONNEL_STATUS_SZCH_UA_] = "AWOL";

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
      byId: null,
      byCallsign: null,
      byCallsignAll: null,
      byFmlActive: null,
      byFmlAll: null,
      activeRowsCache: null,
    };
  }
  return root.__WASB_PERSONNEL_REPO_STATE__;
}

function invalidatePersonnelCache_() {
  var state = _personnelState_();
  state.rowsCache = null;
  state.warnings = [];
  state.byId = null;
  state.byCallsign = null;
  state.byCallsignAll = null;
  state.byFmlActive = null;
  state.byFmlAll = null;
  state.activeRowsCache = null;
}

function _personnelBuildMaps_() {
  var state = _personnelState_();
  if (state.byCallsign) return;

  var rows = _personnelGetLoaded_();
  var byId = Object.create(null);
  var byCallsign = Object.create(null);
  var byCallsignAll = Object.create(null);
  var byFmlActive = Object.create(null);
  var byFmlAll = Object.create(null);
  var activeRows = [];

  rows.forEach(function (row) {
    if (!row) return;

    var id = String(row.id || "").trim();
    if (id) byId[id] = row;

    var callsign = String(row.callsign || "").trim();
    if (callsign) {
      var csKey =
        typeof _normCallsignKey_ === "function"
          ? _normCallsignKey_(callsign)
          : callsign.toUpperCase();
      byCallsignAll[csKey] = row;
      if (row.active === true) byCallsign[csKey] = row;
    }

    var fmlKey =
      typeof _normFml_ === "function"
        ? _normFml_(row.fml)
        : String(row.fml || "")
            .trim()
            .toLowerCase();
    if (fmlKey) {
      byFmlAll[fmlKey] = row;
      if (row.active === true) byFmlActive[fmlKey] = row;
    }

    if (row.active === true) activeRows.push(row);
  });

  state.byId = byId;
  state.byCallsign = byCallsign;
  state.byCallsignAll = byCallsignAll;
  state.byFmlActive = byFmlActive;
  state.byFmlAll = byFmlAll;
  state.activeRowsCache = activeRows;
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
      "Статус зі списку. Порожньо = В наявності; активні — усе, крім Вибув та СЗЧ.",
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
    піб: "FML",
    pib: "FML",
    "last name": "LastName",
    lastname: "LastName",
    прізвище: "LastName",
    "first name": "FirstName",
    firstname: "FirstName",
    "ім'я": "FirstName",
    patronymic: "Patronymic",
    "по батькові": "Patronymic",
    birthday: "Birthday",
    "день народження": "Birthday",
    age: "Age",
    вік: "Age",
    days_until_birthday: "Days_until_birthday",
    "days until birthday": "Days_until_birthday",
    phone: "Phone",
    телефон: "Phone",
    "2_phone": "2_Phone",
    "2 phone": "2_Phone",
    "phone 2": "2_Phone",
    "телефон 2": "2_Phone",
    callsign: "Callsign",
    позивний: "Callsign",
    template: "TEMPLATE",
    title: "Title",
    звання: "Title",
    rank: "Rank",
    position: "Position",
    посада: "Position",
    osh_4: "OSH_4",
    "osh 4": "OSH_4",
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
        PERSONNEL_REQUIRED_HEADER_KEYS.concat(
          PERSONNEL_OPTIONAL_HEADER_KEYS,
        ).join(", ") +
        " (підтримуються також Last name/First name/Patronymic замість FML та TEMPLATE для позивного — як у Книзі Взводу Охорони)",
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
    if (col[key] === undefined) {
      // FML may be synthesized from LastName/FirstName/Patronymic in reference workbooks (e.g. Книга Взводу Охорони)
      if (key === "FML") {
        var hasNameParts =
          (col.LastName !== undefined && col.LastName >= 0) ||
          (col.FirstName !== undefined && col.FirstName >= 0) ||
          (col.Patronymic !== undefined && col.Patronymic >= 0);
        if (!hasNameParts) missing.push(key);
      } else {
        missing.push(key);
      }
    }
  });

  if (col.Title === undefined && col.Rank === undefined) {
    missing.push("Title|Rank");
  }

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

  if (col["2_Phone"] === undefined) col["2_Phone"] = -1;
  if (col.TEMPLATE === undefined) col.TEMPLATE = -1;
  if (col.LastName === undefined) col.LastName = -1;
  if (col.FirstName === undefined) col.FirstName = -1;
  if (col.Patronymic === undefined) col.Patronymic = -1;

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
    col.Unit >= 0
      ? String(_personnelReadCell_(row, col.Unit) || "").trim()
      : "";
  var statusRaw =
    col.Status >= 0
      ? String(_personnelReadCell_(row, col.Status) || "").trim()
      : "";
  var status = normalizePersonnelStatus_(statusRaw);
  var statusCanonical = getPersonnelStatusCanonical_(status);
  var active = isPersonnelStatusActive_(status);

  // Support reference workbook "Книга Взводу Охорони" layout: split name parts + TEMPLATE as callsign carrier
  if (!fml) {
    var ln =
      col.LastName !== undefined && col.LastName >= 0
        ? String(_personnelReadCell_(row, col.LastName) || "").trim()
        : "";
    var fn =
      col.FirstName !== undefined && col.FirstName >= 0
        ? String(_personnelReadCell_(row, col.FirstName) || "").trim()
        : "";
    var pn =
      col.Patronymic !== undefined && col.Patronymic >= 0
        ? String(_personnelReadCell_(row, col.Patronymic) || "").trim()
        : "";
    if (ln || fn || pn) {
      fml = [ln, fn, pn]
        .filter(function (x) {
          return !!x;
        })
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
    }
  }

  // Prefer TEMPLATE value for callsign when the Callsign column is empty or formula-derived (as in the reference PERSONNEL)
  if (!callsign && col.TEMPLATE !== undefined && col.TEMPLATE >= 0) {
    var t = String(_personnelReadCell_(row, col.TEMPLATE) || "").trim();
    if (t) callsign = t;
  }

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
    template:
      col.TEMPLATE >= 0
        ? String(_personnelReadCell_(row, col.TEMPLATE) || "").trim()
        : "",
    title: String(
      (col.Title >= 0 ? _personnelReadCell_(row, col.Title) : "") ||
        (col.Rank >= 0 ? _personnelReadCell_(row, col.Rank) : "") ||
        "",
    ).trim(),
    position: String(_personnelReadCell_(row, col.Position) || "").trim(),
    oshs: String(_personnelReadCell_(row, col.OSH_4) || "").trim(),
    unit: unit,
    status: status,
    statusCanonical: statusCanonical,
    active: active,
    rank: String(
      (col.Rank >= 0 ? _personnelReadCell_(row, col.Rank) : "") ||
        (col.Title >= 0 ? _personnelReadCell_(row, col.Title) : "") ||
        "",
    ).trim(),
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

/** Лише активні Status (див. PERSONNEL_ACTIVE_STATUSES_) — графік, телефони, картки. */
function getPersonnelActiveRows_() {
  _personnelBuildMaps_();
  return (_personnelState_().activeRowsCache || []).slice();
}

function getPersonnelMapById_() {
  _personnelBuildMaps_();
  return _personnelState_().byId;
}

/** Карта лише активних бійців з позивним (основний lookup для графіка). */
function getPersonnelMapByCallsign_() {
  _personnelBuildMaps_();
  return _personnelState_().byCallsign;
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
  _personnelBuildMaps_();
  return _personnelState_().byCallsignAll;
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

  _personnelBuildMaps_();
  var state = _personnelState_();
  var map = activeOnly ? state.byFmlActive : state.byFmlAll;
  return (map && map[target]) || null;
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
      var sheet = typeof getBotSheet_ === "function" ? getBotSheet_() : null;
      PersonsRepository_.getMonthlyRows(sheet).forEach(function (row) {
        addCallsign(row && row.callsign);
      });
    }
  } catch (monthlyErr) {
    try {
      Logger.log(
        "[PersonnelRepository] getPersonnelCallsignsListForUi_ monthly: " +
          (monthlyErr && monthlyErr.message ? monthlyErr.message : monthlyErr),
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
  statusInTrip: PERSONNEL_STATUS_IN_TRIP_UA_,
  activeStatuses: PERSONNEL_ACTIVE_STATUSES_,
  inactiveStatuses: PERSONNEL_INACTIVE_STATUSES_,
  applyStatusValidation: applyPersonnelStatusColumnValidation,
};

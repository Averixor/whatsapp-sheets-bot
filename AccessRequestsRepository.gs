/**
 * AccessRequestsRepository.gs — черга заявок ACCESS_REQUESTS (недовірений inbox).
 */

var ACCESS_REQUESTS_SHEET_NAME_ = "ACCESS_REQUESTS";
var ACCESS_REQUESTS_SCHEMA_VERSION_ = "1";

var ACCESS_REQUESTS_HEADERS_ = [
  "request_id",
  "created_at",
  "updated_at",
  "status",
  "request_type",
  "source",
  "user_email",
  "phone",
  "login",
  "person_callsign",
  "surname",
  "first_name",
  "patronymic",
  "display_name",
  "preferred_contact",
  "telegram_username",
  "request_user_key_hash",
  "request_user_key_hash_masked",
  "dedupe_key",
  "admin_approve",
  "admin_reject",
  "decision_role",
  "decision_note",
  "decision_by",
  "decision_at",
  "decision_proof",
  "processed_at",
  "processed_by",
  "access_row",
  "result_message",
  "activation_login",
  "activation_password_hash",
  "activation_password_salt",
  "activation_proof",
  "activation_requested_at",
  "error_code",
  "error_message",
  "schema_version",
];

var ACCESS_REQUESTS_PENDING_STATUSES_ = [
  "pending",
  "approved",
  "activation_pending",
];
var ACCESS_REQUESTS_STATUS_VALUES_ = [
  "pending",
  "approved",
  "rejected",
  "merged",
  "activation_pending",
  "activation_done",
  "error",
  "cancelled",
];
var ACCESS_REQUESTS_TYPE_VALUES_ = [
  "access_request",
  "activation_request",
  "self_bind_request",
];
var ACCESS_REQUESTS_DECISION_ROLES_ = [
  "viewer",
  "operator",
  "maintainer",
  "admin",
  "sysadmin",
];

/** Не пишемо на лист — лише Script Properties (admin API). */
var ACCESS_REQUESTS_SENSITIVE_PAYLOAD_FIELDS_ = [
  "user_email",
  "phone",
  "login",
  "surname",
  "first_name",
  "patronymic",
  "telegram_username",
  "request_user_key_hash",
  "activation_login",
  "activation_password_hash",
  "activation_password_salt",
  "activation_proof",
];

var ACCESS_REQUESTS_PAYLOAD_PROP_PREFIX_ = "WASB_ARQ_PAYLOAD_";

function _arLog_(message, error) {
  try {
    Logger.log(
      "[AccessRequests] " +
        message +
        (error ? ": " + (error && error.message ? error.message : error) : ""),
    );
  } catch (_) {}
}

function _arSafeString_(value) {
  if (value === null || typeof value === "undefined") return "";
  return String(value).trim();
}

function _arNowText_() {
  if (typeof _nowText_ === "function") return _nowText_("long");
  return Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyyy-MM-dd HH:mm:ss",
  );
}

function _arHashText_(value) {
  if (typeof hashTextSha256_ === "function") return hashTextSha256_(value);
  var digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(value || ""),
    Utilities.Charset.UTF_8,
  );
  return digest
    .map(function (b) {
      return ("0" + (b & 0xff).toString(16)).slice(-2);
    })
    .join("");
}

function _arNewRequestId_() {
  return (
    "ARQ-" + Utilities.getUuid().replace(/-/g, "").slice(0, 12).toUpperCase()
  );
}

function getAccessRequestsHmacSecret_() {
  var props = PropertiesService.getScriptProperties();
  var key = "WASB_ACCESS_REQUESTS_HMAC_SECRET";
  var existing = props.getProperty(key);
  if (existing) return existing;
  var generated = _arHashText_(
    [
      "WASB_ACCESS_REQUESTS_HMAC_SECRET_V1",
      ScriptApp.getScriptId(),
      Utilities.getUuid(),
      String(Date.now()),
    ].join("|"),
  );
  props.setProperty(key, generated);
  return generated;
}

function buildAccessApprovalProof_(parts) {
  parts = parts || {};
  return _arHashText_(
    [
      "WASB_APPROVAL_PROOF_V1",
      getAccessRequestsHmacSecret_(),
      _arSafeString_(parts.requestId),
      _arSafeString_(parts.decisionBy),
      _arSafeString_(parts.decisionAt),
      _arSafeString_(parts.decisionRole),
    ].join("|"),
  );
}

function verifyAccessApprovalProof_(row) {
  if (!row) return false;
  var expected = buildAccessApprovalProof_({
    requestId: row.request_id,
    decisionBy: row.decision_by,
    decisionAt: row.decision_at,
    decisionRole: row.decision_role,
  });
  return _arSafeString_(row.decision_proof) === expected;
}

function buildAccessActivationProof_(parts) {
  parts = parts || {};
  return _arHashText_(
    [
      "WASB_ACTIVATION_PROOF_V1",
      getAccessRequestsHmacSecret_(),
      _arSafeString_(parts.requestId),
      _arSafeString_(parts.requestUserKeyHash),
      String(parts.accessRow || ""),
      _arSafeString_(parts.temporaryPasswordHash),
      _arSafeString_(parts.activationPasswordHash),
      _arSafeString_(parts.activationPasswordSalt),
      _arSafeString_(parts.activationRequestedAt),
    ].join("|"),
  );
}

function verifyAccessActivationProof_(row) {
  if (!row) return false;
  var expected = buildAccessActivationProof_({
    requestId: row.request_id,
    requestUserKeyHash: row.request_user_key_hash,
    accessRow: row.access_row,
    temporaryPasswordHash: row._tempPasswordHashForProof || "",
    activationPasswordHash: row.activation_password_hash,
    activationPasswordSalt: row.activation_password_salt,
    activationRequestedAt: row.activation_requested_at,
  });
  return _arSafeString_(row.activation_proof) === expected;
}

function _arPayloadPropertyKey_(requestId) {
  return ACCESS_REQUESTS_PAYLOAD_PROP_PREFIX_ + _arSafeString_(requestId);
}

function _arSaveRequestPayload_(requestId, payload) {
  var id = _arSafeString_(requestId);
  if (!id) return false;
  try {
    var json = JSON.stringify(payload || {});
    if (json.length > 4500) {
      _arLog_("Payload too large for property", id);
      return false;
    }
    PropertiesService.getScriptProperties().setProperty(
      _arPayloadPropertyKey_(id),
      json,
    );
    return true;
  } catch (e) {
    _arLog_("Save payload failed", e);
    return false;
  }
}

function _arLoadRequestPayload_(requestId) {
  var id = _arSafeString_(requestId);
  if (!id) return null;
  try {
    var raw = PropertiesService.getScriptProperties().getProperty(
      _arPayloadPropertyKey_(id),
    );
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    _arLog_("Load payload failed", e);
    return null;
  }
}

function _arDeleteRequestPayload_(requestId) {
  try {
    PropertiesService.getScriptProperties().deleteProperty(
      _arPayloadPropertyKey_(requestId),
    );
  } catch (_) {}
}

function _arStripSensitiveForSheet_(entry) {
  var out = {};
  Object.keys(entry || {}).forEach(function (key) {
    out[key] = entry[key];
  });
  for (var i = 0; i < ACCESS_REQUESTS_SENSITIVE_PAYLOAD_FIELDS_.length; i++) {
    var field = ACCESS_REQUESTS_SENSITIVE_PAYLOAD_FIELDS_[i];
    if (field === "request_user_key_hash") {
      out[field] = "";
    } else if (Object.prototype.hasOwnProperty.call(out, field)) {
      out[field] = "";
    }
  }
  return out;
}

function _arHydrateRowFromPayload_(row) {
  if (!row || !_arSafeString_(row.request_id)) return row;
  var payload = _arLoadRequestPayload_(row.request_id);
  if (!payload || typeof payload !== "object") return row;
  Object.keys(payload).forEach(function (key) {
    if (
      payload[key] !== undefined &&
      payload[key] !== null &&
      payload[key] !== ""
    ) {
      row[key] = payload[key];
    }
  });
  return row;
}

function _arFindLastDataRow_(sheet) {
  if (!sheet) return 1;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 1;
  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = ids.length - 1; i >= 0; i--) {
    if (_arSafeString_(ids[i][0])) return i + 2;
  }
  return 1;
}

function _arPruneGhostRows_(sheet) {
  if (!sheet) return 0;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  var removed = 0;
  for (var r = lastRow; r >= 2; r--) {
    if (!_arSafeString_(sheet.getRange(r, 1).getValue())) {
      sheet.deleteRow(r);
      removed++;
    }
  }
  return removed;
}

function _arClearBulkSheetControls_(sheet) {
  if (!sheet) return;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  var width = ACCESS_REQUESTS_HEADERS_.length;
  try {
    sheet.getRange(2, 1, lastRow - 1, width).clearDataValidations();
  } catch (e) {
    _arLog_("clearDataValidations", e);
  }
  var approveCol = ACCESS_REQUESTS_HEADERS_.indexOf("admin_approve") + 1;
  var rejectCol = ACCESS_REQUESTS_HEADERS_.indexOf("admin_reject") + 1;
  try {
    if (approveCol > 0) {
      sheet.getRange(2, approveCol, lastRow - 1, 1).removeCheckboxes();
    }
    if (rejectCol > 0) {
      sheet.getRange(2, rejectCol, lastRow - 1, 1).removeCheckboxes();
    }
  } catch (e) {
    _arLog_("removeCheckboxes", e);
  }
}

function buildAccessRequestDedupeKey_(requestType, fields) {
  fields = fields || {};
  return _arHashText_(
    [
      "WASB_ACCESS_REQUEST_DEDUPE_V1",
      _arSafeString_(requestType),
      _arSafeString_(fields.request_user_key_hash),
      _arSafeString_(fields.user_email),
      _arSafeString_(fields.phone),
      _arSafeString_(fields.person_callsign),
      _arSafeString_(fields.surname),
      _arSafeString_(fields.first_name),
    ].join("|"),
  );
}

function getAccessRequestsHeaderMap_(sheet) {
  if (!sheet) return {};
  var lastCol = Math.max(
    sheet.getLastColumn(),
    ACCESS_REQUESTS_HEADERS_.length,
  );
  var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0] || [];
  var map = {};
  for (var i = 0; i < headerRow.length; i++) {
    var name = _arSafeString_(headerRow[i]).toLowerCase();
    if (name) map[name] = i + 1;
  }
  return map;
}

function _arEnsureHeaders_(sheet) {
  var map = getAccessRequestsHeaderMap_(sheet);
  var missing = [];
  for (var i = 0; i < ACCESS_REQUESTS_HEADERS_.length; i++) {
    if (!map[ACCESS_REQUESTS_HEADERS_[i]])
      missing.push(ACCESS_REQUESTS_HEADERS_[i]);
  }
  if (!missing.length && sheet.getLastRow() >= 1) return map;

  sheet
    .getRange(1, 1, 1, ACCESS_REQUESTS_HEADERS_.length)
    .setValues([ACCESS_REQUESTS_HEADERS_]);
  try {
    sheet.setFrozenRows(1);
  } catch (_) {}
  try {
    var head = sheet.getRange(1, 1, 1, ACCESS_REQUESTS_HEADERS_.length);
    head.setFontWeight("bold");
    head.setBackground("#eef2ff");
    head.setWrap(true);
  } catch (_) {}
  try {
    if (sheet.getFilter()) sheet.getFilter().remove();
    var dataLast = _arFindLastDataRow_(sheet);
    var filterRows = Math.max(dataLast, 2);
    sheet
      .getRange(1, 1, filterRows, ACCESS_REQUESTS_HEADERS_.length)
      .createFilter();
  } catch (_) {}
  try {
    sheet.autoResizeColumns(1, ACCESS_REQUESTS_HEADERS_.length);
  } catch (_) {}

  _arClearBulkSheetControls_(sheet);
  _arPruneGhostRows_(sheet);

  return getAccessRequestsHeaderMap_(sheet);
}

function ensureAccessRequestsSheet_() {
  var ss;
  try {
    ss = getWasbSpreadsheet_();
  } catch (e) {
    _arLog_("Spreadsheet unavailable", e);
    return null;
  }
  if (!ss) return null;

  var sheet = ss.getSheetByName(ACCESS_REQUESTS_SHEET_NAME_);
  if (!sheet) {
    sheet = ss.insertSheet(ACCESS_REQUESTS_SHEET_NAME_);
  }
  _arEnsureHeaders_(sheet);
  try {
    sheet.hideSheet();
  } catch (_) {}
  return sheet;
}

function _arRowToObject_(sheet, rowNumber, headerMap) {
  var lastCol = ACCESS_REQUESTS_HEADERS_.length;
  var values = sheet.getRange(rowNumber, 1, 1, lastCol).getValues()[0] || [];
  var row = { sheetRow: rowNumber };
  for (var i = 0; i < ACCESS_REQUESTS_HEADERS_.length; i++) {
    var key = ACCESS_REQUESTS_HEADERS_[i];
    var col = headerMap[key] || i + 1;
    var val = values[col - 1];
    if (key === "admin_approve" || key === "admin_reject") {
      row[key] = val === true || String(val).toUpperCase() === "TRUE";
    } else {
      row[key] = val === null || typeof val === "undefined" ? "" : val;
    }
  }
  return row;
}

function _arObjectToRowValues_(entry) {
  return ACCESS_REQUESTS_HEADERS_.map(function (key) {
    if (key === "admin_approve" || key === "admin_reject") {
      return !!entry[key];
    }
    return entry[key] !== undefined && entry[key] !== null ? entry[key] : "";
  });
}

function readAccessRequests_(options) {
  options = options || {};
  var sheet = ensureAccessRequestsSheet_();
  if (!sheet) return [];

  var headerMap = getAccessRequestsHeaderMap_(sheet);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var statusFilter = options.status ? String(options.status).toLowerCase() : "";
  var typeFilter = options.requestType
    ? String(options.requestType).toLowerCase()
    : "";
  var limit = Number(options.limit) > 0 ? Number(options.limit) : 0;
  var out = [];

  for (var r = 2; r <= lastRow; r++) {
    var row = _arRowToObject_(sheet, r, headerMap);
    if (!_arSafeString_(row.request_id)) continue;
    row = _arHydrateRowFromPayload_(row);
    if (statusFilter && String(row.status || "").toLowerCase() !== statusFilter)
      continue;
    if (
      typeFilter &&
      String(row.request_type || "").toLowerCase() !== typeFilter
    )
      continue;
    out.push(row);
    if (limit && out.length >= limit) break;
  }
  return out;
}

function getAccessRequestById_(requestId) {
  var id = _arSafeString_(requestId);
  if (!id) return null;
  var rows = readAccessRequests_();
  for (var i = 0; i < rows.length; i++) {
    if (_arSafeString_(rows[i].request_id) === id) return rows[i];
  }
  return null;
}

function findPendingAccessRequestDuplicate_(dedupeKey) {
  var key = _arSafeString_(dedupeKey);
  if (!key) return null;
  var rows = readAccessRequests_();
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var status = String(row.status || "").toLowerCase();
    if (ACCESS_REQUESTS_PENDING_STATUSES_.indexOf(status) === -1) continue;
    if (_arSafeString_(row.dedupe_key) === key) return row;
  }
  return null;
}

function updateAccessRequestRow_(sheetRow, updates) {
  var sheet = ensureAccessRequestsSheet_();
  if (!sheet || !sheetRow || sheetRow < 2) return null;

  var headerMap = getAccessRequestsHeaderMap_(sheet);
  var current = _arHydrateRowFromPayload_(
    _arRowToObject_(sheet, sheetRow, headerMap),
  );
  updates = updates || {};
  Object.keys(updates).forEach(function (key) {
    current[key] = updates[key];
  });
  current.updated_at = _arNowText_();
  if (!current.schema_version)
    current.schema_version = ACCESS_REQUESTS_SCHEMA_VERSION_;

  _arSaveRequestPayload_(current.request_id, current);
  var sheetRowValues = _arStripSensitiveForSheet_(current);

  var colCount = ACCESS_REQUESTS_HEADERS_.length;
  sheet
    .getRange(sheetRow, 1, 1, colCount)
    .setValues([_arObjectToRowValues_(sheetRowValues)]);
  return _arHydrateRowFromPayload_(_arRowToObject_(sheet, sheetRow, headerMap));
}

function markAccessRequestError_(sheetRow, errorCode, errorMessage) {
  return updateAccessRequestRow_(sheetRow, {
    status: "error",
    error_code: _arSafeString_(errorCode),
    error_message: _arSafeString_(errorMessage),
    result_message: _arSafeString_(errorMessage),
  });
}

function appendAccessRequest_(entry) {
  var sheet = ensureAccessRequestsSheet_();
  if (!sheet) {
    throw new Error("Не вдалося підготувати лист ACCESS_REQUESTS");
  }

  entry = entry || {};
  var now = _arNowText_();
  var requestId = _arSafeString_(entry.request_id) || _arNewRequestId_();
  var dedupeKey =
    _arSafeString_(entry.dedupe_key) ||
    buildAccessRequestDedupeKey_(entry.request_type, entry);

  var duplicate = findPendingAccessRequestDuplicate_(dedupeKey);
  if (duplicate) {
    return {
      duplicate: true,
      request: duplicate,
      message: "Заявка вже існує. Очікуйте підтвердження адміністратора.",
    };
  }

  var rowEntry = {
    request_id: requestId,
    created_at: now,
    updated_at: now,
    status: _arSafeString_(entry.status) || "pending",
    request_type: _arSafeString_(entry.request_type) || "access_request",
    source: _arSafeString_(entry.source) || "sidebar",
    user_email: _arSafeString_(entry.user_email),
    phone: _arSafeString_(entry.phone),
    login: _arSafeString_(entry.login),
    person_callsign: _arSafeString_(entry.person_callsign),
    surname: _arSafeString_(entry.surname),
    first_name: _arSafeString_(entry.first_name),
    patronymic: _arSafeString_(entry.patronymic),
    display_name: _arSafeString_(entry.display_name),
    preferred_contact: _arSafeString_(entry.preferred_contact),
    telegram_username: _arSafeString_(entry.telegram_username),
    request_user_key_hash: _arSafeString_(entry.request_user_key_hash),
    request_user_key_hash_masked: _arSafeString_(
      entry.request_user_key_hash_masked,
    ),
    dedupe_key: dedupeKey,
    admin_approve: false,
    admin_reject: false,
    decision_role: "",
    decision_note: "",
    decision_by: "",
    decision_at: "",
    decision_proof: "",
    processed_at: "",
    processed_by: "",
    access_row: _arSafeString_(entry.access_row),
    result_message: "",
    activation_login: _arSafeString_(entry.activation_login),
    activation_password_hash: _arSafeString_(entry.activation_password_hash),
    activation_password_salt: _arSafeString_(entry.activation_password_salt),
    activation_proof: _arSafeString_(entry.activation_proof),
    activation_requested_at: _arSafeString_(entry.activation_requested_at),
    error_code: "",
    error_message: "",
    schema_version: ACCESS_REQUESTS_SCHEMA_VERSION_,
  };

  _arSaveRequestPayload_(requestId, rowEntry);

  var sheetEntry = _arStripSensitiveForSheet_(rowEntry);
  var nextRow = _arFindLastDataRow_(sheet) + 1;
  sheet
    .getRange(nextRow, 1, 1, ACCESS_REQUESTS_HEADERS_.length)
    .setValues([_arObjectToRowValues_(sheetEntry)]);
  return {
    duplicate: false,
    request: _arHydrateRowFromPayload_(
      _arRowToObject_(sheet, nextRow, getAccessRequestsHeaderMap_(sheet)),
    ),
    message: "",
  };
}

function getAccessRequestsDiagnostics_() {
  var sheet = null;
  try {
    sheet = ensureAccessRequestsSheet_();
  } catch (e) {
    return {
      accessRequestsSheetExists: false,
      accessRequestsHeadersOk: false,
      accessRequestsPendingCount: 0,
      accessRequestsErrorCount: 0,
      error: e && e.message ? e.message : String(e),
    };
  }

  var headersOk = !!sheet;
  if (sheet) {
    var map = getAccessRequestsHeaderMap_(sheet);
    headersOk = ACCESS_REQUESTS_HEADERS_.every(function (h) {
      return !!map[h];
    });
  }

  var pending = 0;
  var errors = 0;
  readAccessRequests_().forEach(function (row) {
    var status = String(row.status || "").toLowerCase();
    if (
      status === "pending" ||
      status === "approved" ||
      status === "activation_pending"
    )
      pending++;
    if (status === "error") errors++;
  });

  return {
    accessRequestsSheetExists: !!sheet,
    accessRequestsHeadersOk: headersOk,
    accessRequestsPendingCount: pending,
    accessRequestsErrorCount: errors,
  };
}

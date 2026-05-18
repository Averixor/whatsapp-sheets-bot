/**
 * AccessRequestsProcessor.gs — перенос заявок ACCESS_REQUESTS → ACCESS (лише admin/owner).
 */

function _arpAssertAdmin_(actionLabel) {
  if (typeof AccessControl_ === "object" && AccessControl_.assertRoleAtLeast) {
    return AccessControl_.assertRoleAtLeast(
      "admin",
      actionLabel || "access requests queue",
    );
  }
  throw new Error("AccessControl недоступний");
}

function canWriteProtectedAccess_() {
  try {
    _arpAssertAdmin_("ACCESS write check");
    return true;
  } catch (_) {
    return false;
  }
}

function _arpAdminEmails_() {
  if (typeof AccessControl_ === "object" && AccessControl_.listAdminEmails) {
    return (AccessControl_.listAdminEmails() || [])
      .map(function (e) {
        return String(e || "")
          .trim()
          .toLowerCase();
      })
      .filter(Boolean);
  }
  return [];
}

function _arpIsAdminEmail_(email) {
  var normalized = String(email || "")
    .trim()
    .toLowerCase();
  if (!normalized) return false;
  return _arpAdminEmails_().indexOf(normalized) !== -1;
}

function _arpCurrentEmail_() {
  if (typeof safeGetUserEmail_ === "function") return safeGetUserEmail_();
  try {
    return String(Session.getActiveUser().getEmail() || "")
      .trim()
      .toLowerCase();
  } catch (_) {
    return "";
  }
}

function _arpNormalizeApproveRole_(role) {
  var normalized =
    typeof normalizeRole_ === "function"
      ? normalizeRole_(role)
      : String(role || "")
          .trim()
          .toLowerCase();
  var allowed = ["viewer", "operator", "maintainer"];
  if (allowed.indexOf(normalized) === -1) {
    throw new Error(
      "Недозволена роль для автоматичного підтвердження: " + normalized,
    );
  }
  return normalized;
}

function approveAccessRequest_(requestId, role, note) {
  _arpAssertAdmin_("approve access request");
  ensureAccessRequestsSheet_();

  var row = getAccessRequestById_(requestId);
  if (!row) {
    return {
      success: false,
      code: "access.requests.not_found",
      message: "Заявку не знайдено.",
    };
  }

  var status = String(row.status || "").toLowerCase();
  if (status !== "pending") {
    return {
      success: false,
      code: "access.requests.not_pending",
      message: "Заявка не в статусі pending.",
    };
  }

  if (String(row.request_type || "").toLowerCase() !== "access_request") {
    return {
      success: false,
      code: "access.requests.invalid_type",
      message: "Непідтримуваний тип заявки для approve.",
    };
  }

  var decisionRole = _arpNormalizeApproveRole_(role);
  var decisionBy = _arpCurrentEmail_();
  var decisionAt =
    typeof _nowText_ === "function"
      ? _nowText_("long")
      : Utilities.formatDate(
          new Date(),
          Session.getScriptTimeZone(),
          "yyyy-MM-dd HH:mm:ss",
        );
  var proof = buildAccessApprovalProof_({
    requestId: row.request_id,
    decisionBy: decisionBy,
    decisionAt: decisionAt,
    decisionRole: decisionRole,
  });

  updateAccessRequestRow_(row.sheetRow, {
    status: "approved",
    admin_approve: true,
    admin_reject: false,
    decision_role: decisionRole,
    decision_note: String(note || "").trim(),
    decision_by: decisionBy,
    decision_at: decisionAt,
    decision_proof: proof,
  });

  return processAccessRequestsQueue_({ requestId: row.request_id });
}

function rejectAccessRequest_(requestId, note) {
  _arpAssertAdmin_("reject access request");
  ensureAccessRequestsSheet_();

  var row = getAccessRequestById_(requestId);
  if (!row) {
    return {
      success: false,
      code: "access.requests.not_found",
      message: "Заявку не знайдено.",
    };
  }

  var status = String(row.status || "").toLowerCase();
  if (status !== "pending" && status !== "approved") {
    return {
      success: false,
      code: "access.requests.not_rejectable",
      message: "Заявку не можна відхилити в поточному статусі.",
    };
  }

  var processedBy = _arpCurrentEmail_();
  var processedAt =
    typeof _nowText_ === "function"
      ? _nowText_("long")
      : Utilities.formatDate(
          new Date(),
          Session.getScriptTimeZone(),
          "yyyy-MM-dd HH:mm:ss",
        );

  updateAccessRequestRow_(row.sheetRow, {
    status: "rejected",
    admin_reject: true,
    admin_approve: false,
    decision_note: String(note || "").trim(),
    processed_by: processedBy,
    processed_at: processedAt,
    result_message: "Заявку відхилено адміністратором.",
  });

  return {
    success: true,
    code: "access.requests.rejected",
    message: "Заявку відхилено.",
    requestId: requestId,
  };
}

function listAccessRequests_(options) {
  _arpAssertAdmin_("list access requests");
  ensureAccessRequestsSheet_();
  options = options || {};
  if (!options.status) options.status = "pending";
  return readAccessRequests_(options);
}

function promoteAccessRequestToAccess_(requestRow) {
  _arpAssertAdmin_("promote access request");

  if (
    !requestRow ||
    String(requestRow.request_type || "").toLowerCase() !== "access_request"
  ) {
    return { success: false, message: "Невірний тип заявки для promote." };
  }

  if (String(requestRow.status || "").toLowerCase() !== "approved") {
    return { success: false, message: "Заявка не підтверджена (approved)." };
  }

  if (!verifyAccessApprovalProof_(requestRow)) {
    return {
      success: false,
      message: "Невалідний decision_proof. Заявку відхилено системою.",
    };
  }

  if (!_arpIsAdminEmail_(requestRow.decision_by)) {
    return { success: false, message: "decision_by не є адміністратором." };
  }

  if (requestRow.admin_reject === true) {
    return { success: false, message: "Заявку відхилено (admin_reject)." };
  }

  if (requestRow.admin_approve === true && requestRow.admin_reject === true) {
    return { success: false, message: "Суперечливі прапорці approve/reject." };
  }

  var hash = String(requestRow.request_user_key_hash || "").trim();
  if (!hash) {
    return { success: false, message: "Відсутній request_user_key_hash." };
  }

  var email =
    typeof normalizeEmail_ === "function"
      ? normalizeEmail_(requestRow.user_email)
      : String(requestRow.user_email || "")
          .trim()
          .toLowerCase();
  var phone =
    typeof normalizePhone_ === "function"
      ? normalizePhone_(requestRow.phone)
      : String(requestRow.phone || "").trim();
  var callsign =
    typeof normalizeCallsign_ === "function"
      ? normalizeCallsign_(requestRow.person_callsign)
      : String(requestRow.person_callsign || "")
          .trim()
          .toUpperCase();
  var login = String(requestRow.login || email || phone || "").trim();
  var displayName =
    String(requestRow.display_name || "").trim() ||
    [requestRow.surname, requestRow.first_name, requestRow.patronymic]
      .filter(Boolean)
      .join(" ") ||
    callsign ||
    login;

  var entries =
    typeof _readSheetEntries_ === "function" ? _readSheetEntries_() : [];
  var existing = null;

  for (var i = 0; i < entries.length; i++) {
    var entry = entries[i];
    if (entry.requestUserKeyHash && entry.requestUserKeyHash === hash) {
      existing = entry;
      break;
    }
    if (entry.userKeyCurrentHash && entry.userKeyCurrentHash === hash) {
      existing = entry;
      break;
    }
    var sameEmail =
      email &&
      typeof normalizeEmail_ === "function" &&
      normalizeEmail_(entry.email) === email;
    var samePhone =
      phone &&
      typeof normalizePhone_ === "function" &&
      normalizePhone_(entry.phone) === phone;
    var sameCallsign =
      callsign &&
      typeof normalizeCallsign_ === "function" &&
      normalizeCallsign_(entry.personCallsign) === callsign;
    if ((sameEmail || samePhone) && sameCallsign) {
      existing = entry;
      break;
    }
  }

  if (
    existing &&
    String(existing.registrationStatus || "").toLowerCase() === "active"
  ) {
    return { success: false, message: "Користувач уже активований у ACCESS." };
  }

  var nowText =
    typeof _nowText_ === "function"
      ? _nowText_("long")
      : Utilities.formatDate(
          new Date(),
          Session.getScriptTimeZone(),
          "yyyy-MM-dd HH:mm:ss",
        );
  var tempPlain =
    typeof generateAccessTemporaryPassword_ === "function"
      ? generateAccessTemporaryPassword_(
          hash + "|" + email + "|" + phone + "|" + requestRow.request_id,
        )
      : "";
  var tempSalt =
    typeof generateAccessSalt_ === "function" ? generateAccessSalt_() : "";
  var tempHash =
    typeof hashAccessPasswordWithSalt_ === "function"
      ? hashAccessPasswordWithSalt_(tempPlain, tempSalt)
      : "";
  var tempExpires =
    typeof getAccessTemporaryPasswordExpiresAt_ === "function"
      ? getAccessTemporaryPasswordExpiresAt_(
          typeof ACCESS_TEMP_PASSWORD_TTL_HOURS !== "undefined"
            ? ACCESS_TEMP_PASSWORD_TTL_HOURS
            : 24,
        )
      : "";

  var accessUpdates = {
    email: email,
    phone: phone,
    login: login,
    role: requestRow.decision_role,
    enabled: true,
    displayName: displayName,
    personCallsign: callsign,
    user_key_current_hash: hash,
    request_user_key_hash: hash,
    registration_status: "key_sent",
    preferred_contact: String(requestRow.preferred_contact || "").trim(),
    surname: String(requestRow.surname || "").trim(),
    first_name: String(requestRow.first_name || "").trim(),
    patronymic: String(requestRow.patronymic || "").trim(),
    telegram_username: String(requestRow.telegram_username || "").trim(),
    request_created_at: String(requestRow.created_at || nowText),
    temporary_password_plain: tempPlain,
    temporary_password_hash: tempHash,
    temporary_password_salt: tempSalt,
    temporary_password_expires_at: tempExpires,
    temporary_password_used_at: "",
    approved_by: String(requestRow.decision_by || "").trim(),
    approved_at: nowText,
    activated_at: "",
    failed_attempts: 0,
    locked_until_ms: 0,
  };

  var savedEntry;
  if (existing && existing.sheetRow) {
    savedEntry =
      typeof _updateEntryFields_ === "function"
        ? _updateEntryFields_(existing.sheetRow, accessUpdates)
        : null;
  } else if (typeof _appendEntryByHeaderMap_ === "function") {
    savedEntry = _appendEntryByHeaderMap_(accessUpdates);
  } else {
    return { success: false, message: "ACCESS repository недоступний." };
  }

  var accessRow =
    savedEntry && savedEntry.sheetRow
      ? savedEntry.sheetRow
      : existing && existing.sheetRow
        ? existing.sheetRow
        : "";
  var processedBy = _arpCurrentEmail_();

  updateAccessRequestRow_(requestRow.sheetRow, {
    status: "merged",
    processed_at: nowText,
    processed_by: processedBy,
    access_row: accessRow,
    result_message: "Створено доступ у ACCESS.",
    error_code: "",
    error_message: "",
  });

  if (typeof _arDeleteRequestPayload_ === "function") {
    _arDeleteRequestPayload_(requestRow.request_id);
  }

  if (typeof stage7ReportAccessViolation === "function") {
    try {
      stage7ReportAccessViolation("accessKeyApproved", {
        requestId: requestRow.request_id,
        accessSheetRow: accessRow,
        role: requestRow.decision_role,
        email: email,
        phone: phone,
        personCallsign: callsign,
      });
    } catch (_) {}
  }

  return {
    success: true,
    message: "Заявку перенесено в ACCESS.",
    requestId: requestRow.request_id,
    accessSheetRow: accessRow,
    temporaryPasswordPlain: tempPlain,
    registrationStatus: "key_sent",
  };
}

function promoteActivationRequestToAccess_(requestRow) {
  _arpAssertAdmin_("promote activation request");

  if (
    !requestRow ||
    String(requestRow.request_type || "").toLowerCase() !== "activation_request"
  ) {
    return { success: false, message: "Невірний тип заявки для activation." };
  }

  if (String(requestRow.status || "").toLowerCase() !== "activation_pending") {
    return {
      success: false,
      message: "Заявка активації не в статусі activation_pending.",
    };
  }

  requestRow._tempPasswordHashForProof = String(
    entry.temporaryPasswordHash || "",
  ).trim();
  if (!verifyAccessActivationProof_(requestRow)) {
    return { success: false, message: "Невалідний activation_proof." };
  }

  var hash = String(requestRow.request_user_key_hash || "").trim();
  var entries =
    typeof _readSheetEntries_ === "function" ? _readSheetEntries_() : [];
  var entry = null;
  for (var i = 0; i < entries.length; i++) {
    var item = entries[i];
    if (item.requestUserKeyHash && item.requestUserKeyHash === hash) {
      entry = item;
      break;
    }
    if (item.userKeyCurrentHash && item.userKeyCurrentHash === hash) {
      entry = item;
      break;
    }
  }

  if (!entry) {
    return {
      success: false,
      message: "Запис ACCESS для активації не знайдено.",
    };
  }

  var status = String(entry.registrationStatus || "").toLowerCase();
  if (status === "active") {
    return { success: false, message: "Доступ уже активовано." };
  }
  if (status !== "approved" && status !== "key_sent") {
    return {
      success: false,
      message: "ACCESS ще не готовий до активації (status=" + status + ").",
    };
  }
  if (entry.enabled !== true) {
    return { success: false, message: "ACCESS запис вимкнено." };
  }

  var nowText =
    typeof _nowText_ === "function"
      ? _nowText_("long")
      : Utilities.formatDate(
          new Date(),
          Session.getScriptTimeZone(),
          "yyyy-MM-dd HH:mm:ss",
        );
  var savedEntry =
    typeof _updateEntryFields_ === "function"
      ? _updateEntryFields_(entry.sheetRow, {
          user_key_current_hash: hash,
          request_user_key_hash: hash,
          login: String(requestRow.activation_login || "").trim(),
          password_hash: String(
            requestRow.activation_password_hash || "",
          ).trim(),
          password_salt: String(
            requestRow.activation_password_salt || "",
          ).trim(),
          registration_status: "active",
          last_seen_at: nowText,
          last_rotated_at: nowText,
          activated_at: nowText,
          temporary_password_plain: "",
          temporary_password_used_at: nowText,
          failed_attempts: 0,
          locked_until_ms: 0,
        })
      : null;

  updateAccessRequestRow_(requestRow.sheetRow, {
    status: "activation_done",
    processed_at: nowText,
    processed_by: _arpCurrentEmail_(),
    access_row:
      savedEntry && savedEntry.sheetRow ? savedEntry.sheetRow : entry.sheetRow,
    result_message: "Активацію застосовано в ACCESS.",
  });

  return {
    success: true,
    message: "Активацію застосовано.",
    accessSheetRow:
      savedEntry && savedEntry.sheetRow ? savedEntry.sheetRow : entry.sheetRow,
  };
}

function processAccessRequestsQueue_(options) {
  options = options || {};
  var requireAdmin = options.requireAdmin !== false;
  if (requireAdmin) {
    try {
      _arpAssertAdmin_("process access requests queue");
    } catch (e) {
      return {
        success: false,
        message: e && e.message ? e.message : String(e),
        processed: [],
        errors: [],
      };
    }
  }

  if (!canWriteProtectedAccess_()) {
    return {
      success: false,
      message:
        "Недостатньо прав для запису в ACCESS. Запустіть обробку під обліковим записом admin/owner.",
      processed: [],
      errors: [],
    };
  }

  ensureAccessRequestsSheet_();
  var targetId = String(options.requestId || "").trim();
  var rows = readAccessRequests_();
  var processed = [];
  var errors = [];

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    if (targetId && String(row.request_id) !== targetId) continue;

    var type = String(row.request_type || "").toLowerCase();
    var status = String(row.status || "").toLowerCase();

    try {
      if (type === "access_request" && status === "approved") {
        var promoteResult = promoteAccessRequestToAccess_(row);
        if (promoteResult.success) processed.push(promoteResult);
        else
          errors.push({
            requestId: row.request_id,
            message: promoteResult.message,
          });
      } else if (
        type === "activation_request" &&
        status === "activation_pending"
      ) {
        var activationResult = promoteActivationRequestToAccess_(row);
        if (activationResult.success) processed.push(activationResult);
        else
          errors.push({
            requestId: row.request_id,
            message: activationResult.message,
          });
      }
    } catch (e) {
      markAccessRequestError_(
        row.sheetRow,
        "process.error",
        e && e.message ? e.message : String(e),
      );
      errors.push({
        requestId: row.request_id,
        message: e && e.message ? e.message : String(e),
      });
    }
  }

  return {
    success: errors.length === 0,
    message: processed.length
      ? "Оброблено заявок: " + processed.length
      : errors.length
        ? "Обробка завершилась з помилками"
        : "Немає заявок для обробки",
    processed: processed,
    errors: errors,
  };
}

function installAccessRequestsProcessorTrigger_() {
  _arpAssertAdmin_("install access requests processor trigger");
  var handler = "processAccessRequestsQueueTimeDriven_";
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (
      triggers[i].getHandlerFunction &&
      triggers[i].getHandlerFunction() === handler
    ) {
      return {
        success: true,
        message: "Тригер вже встановлено.",
        handler: handler,
      };
    }
  }
  ScriptApp.newTrigger(handler).timeBased().everyMinutes(1).create();
  return {
    success: true,
    message: "Тригер обробки ACCESS_REQUESTS встановлено (кожну 1 хв).",
    handler: handler,
  };
}

function processAccessRequestsQueueTimeDriven_() {
  processAccessRequestsQueue_({ requireAdmin: false });
}

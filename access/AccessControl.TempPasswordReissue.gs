/**
 * AccessControl.TempPasswordReissue.gs — service reissue of ACCESS temporary password.
 */

var ACCESS_TEMP_PASSWORD_REISSUE_HEADERS_ = Object.freeze([
  "temporary_password_hash",
  "temporary_password_salt",
  "temporary_password_expires_at",
  "temporary_password_used_at",
  "failed_attempts",
  "locked_until_ms",
]);

function _findAccessEntryForTempPasswordReissue_(payload) {
  const input = payload && typeof payload === "object" ? payload : {};
  const email = normalizeEmail_(input.email || "");
  const loginRaw = String(
    input.login || input.personCallsign || input.person_callsign || "",
  ).trim();
  const normalizedLogin = loginRaw.toLowerCase();
  const normalizedCallsign = normalizeCallsign_(loginRaw);

  if (typeof _invalidateAccessRepoCachesSafe_ === "function") {
    _invalidateAccessRepoCachesSafe_();
  }

  const entries = _readSheetEntries_();
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (email && normalizeEmail_(entry.email) === email) {
      return _enrichEntry(entry, ACCESS_SHEET, "email");
    }
    if (
      normalizedLogin &&
      String(entry.login || "")
        .trim()
        .toLowerCase() === normalizedLogin
    ) {
      return _enrichEntry(entry, ACCESS_SHEET, "login");
    }
    if (
      normalizedCallsign &&
      normalizeCallsign_(entry.personCallsign) === normalizedCallsign
    ) {
      return _enrichEntry(entry, ACCESS_SHEET, "person_callsign");
    }
  }

  return null;
}

function _parseAccessDateTimeToMs_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.getTime();
  }

  const raw = String(value || "").trim();
  if (!raw) return NaN;

  const dotted = raw.match(
    /^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (dotted) {
    const hours = dotted[4] ? parseInt(dotted[4], 10) : 0;
    const minutes = dotted[5] ? parseInt(dotted[5], 10) : 0;
    const seconds = dotted[6] ? parseInt(dotted[6], 10) : 0;
    return new Date(
      parseInt(dotted[3], 10),
      parseInt(dotted[2], 10) - 1,
      parseInt(dotted[1], 10),
      hours,
      minutes,
      seconds,
    ).getTime();
  }

  const iso = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (iso) {
    const hours = iso[4] ? parseInt(iso[4], 10) : 0;
    const minutes = iso[5] ? parseInt(iso[5], 10) : 0;
    const seconds = iso[6] ? parseInt(iso[6], 10) : 0;
    return new Date(
      parseInt(iso[1], 10),
      parseInt(iso[2], 10) - 1,
      parseInt(iso[3], 10),
      hours,
      minutes,
      seconds,
    ).getTime();
  }

  const parsed = new Date(raw);
  return isNaN(parsed.getTime()) ? NaN : parsed.getTime();
}

function _writeAccessTempPasswordReissueByHeaderMap_(sheetRow, updates) {
  const sh =
    typeof _getSheet_ === "function" ? _getSheet_(false) : null;
  if (!sh || !sheetRow || sheetRow < 2) {
    return {
      ok: false,
      rowsUpdated: 0,
      updatedColumns: [],
      missingHeaders: ACCESS_TEMP_PASSWORD_REISSUE_HEADERS_.slice(),
      message: "ACCESS sheet row unavailable for write",
    };
  }

  const headerMap =
    typeof _getHeaderMap_ === "function" ? _getHeaderMap_(sh) : {};
  const safeUpdates =
    typeof sanitizeAccessSecretFieldUpdates_ === "function"
      ? sanitizeAccessSecretFieldUpdates_(updates || {})
      : updates || {};
  const missingHeaders = [];
  const updatedColumns = [];

  ACCESS_TEMP_PASSWORD_REISSUE_HEADERS_.forEach(function (header) {
    if (!headerMap[header]) {
      missingHeaders.push(header);
    }
  });

  Object.keys(safeUpdates || {}).forEach(function (header) {
    if (headerMap[header]) {
      updatedColumns.push(header);
    }
  });

  if (missingHeaders.length) {
    return {
      ok: false,
      rowsUpdated: 0,
      updatedColumns: updatedColumns,
      missingHeaders: missingHeaders,
      message:
        "ACCESS header map missing columns: " + missingHeaders.join(", "),
    };
  }

  if (!updatedColumns.length) {
    return {
      ok: false,
      rowsUpdated: 0,
      updatedColumns: [],
      missingHeaders: [],
      message: "No ACCESS columns resolved for temporary password reissue",
    };
  }

  const wrote =
    typeof _setEntryFields_ === "function"
      ? _setEntryFields_(sheetRow, safeUpdates)
      : false;
  if (!wrote) {
    return {
      ok: false,
      rowsUpdated: 0,
      updatedColumns: updatedColumns,
      missingHeaders: [],
      message: "Failed to write ACCESS temporary password fields",
    };
  }

  return {
    ok: true,
    rowsUpdated: updatedColumns.length,
    updatedColumns: updatedColumns,
    missingHeaders: [],
    message: "",
  };
}

function _redactAccessTempPasswordColumnsForLog_(columns) {
  const raw = Array.isArray(columns) ? columns : [];
  const out = [];
  let redacted = 0;

  raw.forEach(function (column) {
    const value = String(column || "").trim();
    if (!value) return;
    if (/password|token|hash|salt|plain/i.test(value)) {
      redacted++;
      return;
    }
    if (out.indexOf(value) === -1) out.push(value);
  });

  if (redacted) out.push("[redacted-sensitive-access-columns]");
  return out;
}

function _verifyAccessTempPasswordReissueWrite_(before, after, expected) {
  const beforeHash = String(
    (before && before.temporaryPasswordHash) || "",
  ).trim();
  const beforeSalt = String(
    (before && before.temporaryPasswordSalt) || "",
  ).trim();
  const afterHash = String(
    (after && after.temporaryPasswordHash) || "",
  ).trim();
  const afterSalt = String(
    (after && after.temporaryPasswordSalt) || "",
  ).trim();
  const afterUsedAt = String(
    (after && after.temporaryPasswordUsedAt) || "",
  ).trim();
  const afterExpiresMs = _parseAccessDateTimeToMs_(
    after && after.temporaryPasswordExpiresAt,
  );
  const nowMs = Date.now();

  if (!afterHash || !afterSalt) {
    throw new Error(
      "ACCESS reissue verification failed: temporary_password_hash/salt empty after write",
    );
  }
  if (afterHash === beforeHash && afterSalt === beforeSalt) {
    throw new Error(
      "ACCESS reissue verification failed: temporary_password_hash/salt unchanged after write",
    );
  }
  if (expected && expected.hash && afterHash !== expected.hash) {
    throw new Error(
      "ACCESS reissue verification failed: temporary_password_hash mismatch after write",
    );
  }
  if (expected && expected.salt && afterSalt !== expected.salt) {
    throw new Error(
      "ACCESS reissue verification failed: temporary_password_salt mismatch after write",
    );
  }
  if (afterUsedAt) {
    throw new Error(
      "ACCESS reissue verification failed: temporary_password_used_at not cleared",
    );
  }
  if (!(afterExpiresMs > nowMs)) {
    throw new Error(
      "ACCESS reissue verification failed: temporary_password_expires_at is not in the future",
    );
  }
  if (
    parseInt((after && after.failedAttempts) || "0", 10) !== 0 ||
    parseInt((after && after.lockedUntilMs) || "0", 10) !== 0
  ) {
    throw new Error(
      "ACCESS reissue verification failed: failed_attempts/locked_until_ms not reset",
    );
  }
}

function reissueAccessTemporaryPassword_(payload) {
  const input = payload && typeof payload === "object" ? payload : {};
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const entry = _findAccessEntryForTempPasswordReissue_(input);
    const matchedRowNumber = entry && entry.sheetRow ? Number(entry.sheetRow) : 0;
    if (!entry || !matchedRowNumber) {
      return {
        ok: false,
        success: false,
        code: "access.reissue.not_found",
        message: "Запис ACCESS не знайдено за email або login.",
        matchedRowNumber: 0,
        rowsUpdated: 0,
        updatedColumns: [],
      };
    }

    const status = String(entry.registrationStatus || entry.registration_status || "")
      .trim()
      .toLowerCase();
    if (status !== "active") {
      return {
        ok: false,
        success: false,
        code: "access.reissue.not_active",
        message:
          "Перевипуск тимчасового пароля доступний лише для registration_status = active.",
        registrationStatus: status || "",
        matchedRowNumber: matchedRowNumber,
        rowsUpdated: 0,
        updatedColumns: [],
      };
    }

    if (entry.enabled !== true) {
      return {
        ok: false,
        success: false,
        code: "access.reissue.disabled",
        message: "Користувач ACCESS вимкнений (enabled != TRUE).",
        matchedRowNumber: matchedRowNumber,
        rowsUpdated: 0,
        updatedColumns: [],
      };
    }

    const expectedRole = String(input.expectedRole || input.role || "")
      .trim()
      .toLowerCase();
    const entryRole = String(entry.role || "")
      .trim()
      .toLowerCase();
    if (expectedRole && entryRole !== expectedRole) {
      return {
        ok: false,
        success: false,
        code: "access.reissue.role_mismatch",
        message:
          "Роль запису ACCESS не збігається з очікуваною (" +
          expectedRole +
          ").",
        role: entryRole,
        matchedRowNumber: matchedRowNumber,
        matchedRole: entryRole,
        rowsUpdated: 0,
        updatedColumns: [],
      };
    }

    const beforeEntry =
      typeof _getEntryBySheetRow_ === "function"
        ? _getEntryBySheetRow_(matchedRowNumber)
        : entry;
    const before = {
      temporary_password_hash: String(
        (beforeEntry && beforeEntry.temporaryPasswordHash) || "",
      ).trim(),
      temporary_password_salt: String(
        (beforeEntry && beforeEntry.temporaryPasswordSalt) || "",
      ).trim(),
      temporary_password_expires_at: String(
        (beforeEntry && beforeEntry.temporaryPasswordExpiresAt) || "",
      ).trim(),
      temporary_password_used_at: String(
        (beforeEntry && beforeEntry.temporaryPasswordUsedAt) || "",
      ).trim(),
      failed_attempts:
        parseInt((beforeEntry && beforeEntry.failedAttempts) || "0", 10) || 0,
      locked_until_ms:
        parseInt((beforeEntry && beforeEntry.lockedUntilMs) || "0", 10) || 0,
    };

    const preserved = {
      email: String(entry.email || "").trim(),
      role: entryRole,
      login: String(entry.login || "").trim(),
      personCallsign: String(entry.personCallsign || entry.person_callsign || "").trim(),
      userKeyCurrentHash: String(
        entry.userKeyCurrentHash || entry.user_key_current_hash || "",
      ).trim(),
      passwordHash: String(entry.passwordHash || entry.password_hash || "").trim(),
      passwordSalt: String(entry.passwordSalt || entry.password_salt || "").trim(),
    };

    const seed = [
      preserved.userKeyCurrentHash,
      preserved.email,
      preserved.personCallsign,
      preserved.login,
      String(matchedRowNumber),
      Utilities.getUuid(),
      String(Date.now()),
    ].join("|");

    const temporaryPasswordPlain = generateAccessTemporaryPassword_(seed);
    const temporaryPasswordSalt = generateAccessSalt_();
    const temporaryPasswordHash = hashAccessPasswordWithSalt_(
      temporaryPasswordPlain,
      temporaryPasswordSalt,
    );
    const temporaryPasswordExpiresAt = getAccessTemporaryPasswordExpiresAt_(
      ACCESS_TEMP_PASSWORD_TTL_HOURS,
    );

    const updates = {
      temporary_password_plain: "",
      temporary_password_hash: temporaryPasswordHash,
      temporary_password_salt: temporaryPasswordSalt,
      temporary_password_expires_at: temporaryPasswordExpiresAt,
      temporary_password_used_at: "",
      failed_attempts: 0,
      locked_until_ms: 0,
    };

    let writeResult;
    try {
      writeResult = _writeAccessTempPasswordReissueByHeaderMap_(
        matchedRowNumber,
        updates,
      );
    } catch (writeError) {
      if (
        typeof isSpreadsheetProtectionWriteError_ === "function" &&
        isSpreadsheetProtectionWriteError_(writeError)
      ) {
        return {
          ok: false,
          success: false,
          code: "access.reissue.access_sheet_protected",
          message:
            "Не вдалося записати ACCESS: лист захищено від запису для цього користувача.",
          matchedRowNumber: matchedRowNumber,
          matchedEmail: preserved.email,
          matchedLogin: preserved.login,
          matchedRole: preserved.role,
          rowsUpdated: 0,
          updatedColumns: [],
          before: {
            temporary_password_expires_at: before.temporary_password_expires_at,
          },
        };
      }
      throw writeError;
    }

    if (
      !writeResult ||
      !writeResult.ok ||
      !writeResult.rowsUpdated ||
      writeResult.rowsUpdated < 1
    ) {
      return {
        ok: false,
        success: false,
        code: "access.reissue.write_failed",
        message:
          (writeResult && writeResult.message) ||
          "Не вдалося оновити temporary_password_* у ACCESS.",
        matchedRowNumber: matchedRowNumber,
        matchedEmail: preserved.email,
        matchedLogin: preserved.login,
        matchedRole: preserved.role,
        rowsUpdated: writeResult ? writeResult.rowsUpdated || 0 : 0,
        updatedColumns: writeResult ? writeResult.updatedColumns || [] : [],
        missingHeaders: writeResult ? writeResult.missingHeaders || [] : [],
        before: {
          temporary_password_expires_at: before.temporary_password_expires_at,
        },
      };
    }

    if (typeof _invalidateAccessRepoCachesSafe_ === "function") {
      _invalidateAccessRepoCachesSafe_();
    }

    const afterEntry =
      typeof _getEntryBySheetRow_ === "function"
        ? _getEntryBySheetRow_(matchedRowNumber)
        : null;
    if (!afterEntry) {
      throw new Error(
        "ACCESS reissue verification failed: row " +
          String(matchedRowNumber) +
          " unreadable after write",
      );
    }

    _verifyAccessTempPasswordReissueWrite_(beforeEntry || entry, afterEntry, {
      hash: temporaryPasswordHash,
      salt: temporaryPasswordSalt,
    });

    if (preserved.userKeyCurrentHash && typeof _clearSelfBindLoginState_ === "function") {
      _clearSelfBindLoginState_(preserved.userKeyCurrentHash);
    }

    const after = {
      temporary_password_expires_at: String(
        afterEntry.temporaryPasswordExpiresAt || "",
      ).trim(),
    };

    console.log(
      "[ACCESS] Temporary password reissued for row " +
        String(matchedRowNumber) +
        " (" +
        (typeof maskSensitiveValue_ === "function"
          ? maskSensitiveValue_(preserved.email)
          : "email masked") +
        ", role=" +
        preserved.role +
        ", columns=" +
        _redactAccessTempPasswordColumnsForLog_(
          writeResult.updatedColumns,
        ).join(",") +
        ")",
    );

    return {
      ok: true,
      success: true,
      code: "access.reissue.temp_password_reissued",
      message:
        "Тимчасовий пароль перевипущено. Збережіть код — він показується один раз.",
      matchedRowNumber: matchedRowNumber,
      matchedEmail: preserved.email,
      matchedLogin: preserved.login,
      matchedRole: preserved.role,
      rowsUpdated: writeResult.rowsUpdated,
      updatedColumns: writeResult.updatedColumns,
      before: {
        temporary_password_expires_at: before.temporary_password_expires_at,
      },
      after: after,
      email: preserved.email,
      login: preserved.login,
      personCallsign: preserved.personCallsign,
      role: preserved.role,
      accessSheetRow: matchedRowNumber,
      temporaryPassword: temporaryPasswordPlain,
      temporaryPasswordShowOnce: true,
      temporaryPasswordExpiresAt: temporaryPasswordExpiresAt,
      preservedPermanentPassword: !!(
        preserved.passwordHash && preserved.passwordSalt
      ),
    };
  } finally {
    lock.releaseLock();
  }
}

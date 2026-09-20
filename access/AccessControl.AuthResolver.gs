// ==================== ПОЛІТИКА ДОСТУПУ ====================

/**
 * Отримує поточну політику доступу з кешем
 * @returns {Object} Політика доступу
 */
function _getAccessPolicy_() {
  if (_policyCache) return Object.assign({}, _policyCache);

  const entries = _readSheetEntries_();
  const hasAdminConfigured = entries.some(function (e) {
    return e.enabled && ["admin", "sysadmin", "owner"].includes(e.role);
  });
  const migrationModeEnabled = parseBoolean_(
    _getProperties_().getProperty(MIGRATION_EMAIL_BRIDGE_PROP),
    false,
  );
  // Registration/login permanently removed. ACCESS rows may still refine role by key;
  // unknown keys are NOT sent through registration — spreadsheet sharing is the gate.
  const loginDisabled = true;
  const accessSheetPresent = !!_getSheet_(false);

  _policyCache = {
    mode: "spreadsheet-sharing",
    strictUserKeyMode: false,
    migrationModeEnabled: migrationModeEnabled,
    loginDisabled: loginDisabled,
    allowEmailBridge: false,
    allowScriptPropertiesFallback: false,
    bootstrapAllowed: false,
    adminConfigured: hasAdminConfigured,
    accessSheetPresent: accessSheetPresent,
    registeredKeysCount: entries.filter(function (e) {
      return e.userKeyCurrentHash || e.userKeyPrevHash;
    }).length,
    registrationRemoved: true,
  };

  return Object.assign({}, _policyCache);
}

// ==================== ОСНОВНИЙ РЕЗОЛЬВЕР КОРИСТУВАЧА ====================

/**
 * Визначає користувача за контекстом (з можливістю модифікації)
 * @param {Object} context - Контекст запиту (currentKeyHash, sessionEmail)
 * @param {Object} options - Додаткові опції
 * @returns {Object} Дескриптор користувача
 */
function _resolveAccessSubject_(context, options = {}) {
  const policy = _getAccessPolicy_();
  const currentKeyHash = context.currentKeyHash;
  const sessionEmail = context.sessionEmail;

  let match = null;
  let sourceType = null;
  let matchedBy = null;
  let matchSource = null;

  if (currentKeyHash) {
    match = _findByUserKey_(currentKeyHash, {
      includeLocked: true,
      includeDisabled: true,
    });
    if (match) {
      sourceType = "access";
      matchedBy = "user_key_current_hash";
      matchSource = match.source;
      if (!_isEntryLocked_(match)) {
        match = _applySuccessfulAuth_(match, currentKeyHash);
        matchSource = match.source;
      }
      if (!_isAccessEntryActivationComplete_(match)) {
        return _buildSpreadsheetSharingDescriptor_(context, policy);
      }
      return _buildDescriptorFromMatch_(
        match,
        sourceType,
        matchedBy,
        matchSource,
        policy,
        context,
      );
    }
  }

  if (currentKeyHash) {
    match = _findByUserKey_(currentKeyHash, {
      includeLocked: true,
      includeDisabled: true,
      matchPrev: true,
    });
    if (match) {
      sourceType = "access";
      matchedBy = "user_key_prev_hash";
      matchSource = match.source;
      if (!_isEntryLocked_(match)) {
        match = _applyPrevKeyMatch_(match, currentKeyHash);
        matchSource = match.source;
      }
      if (!_isAccessEntryActivationComplete_(match)) {
        return _buildSpreadsheetSharingDescriptor_(context, policy);
      }
      return _buildDescriptorFromMatch_(
        match,
        sourceType,
        matchedBy,
        matchSource,
        policy,
        context,
      );
    }
  }

  if (!policy.strictUserKeyMode && policy.allowEmailBridge && sessionEmail) {
    match = _findByEmailInSheet_(sessionEmail, {
      includeLocked: true,
      includeDisabled: true,
    });
    if (match) {
      sourceType = "access";
      matchedBy = "email-bridge";
      matchSource = match.source;
      if (!_isEntryLocked_(match) && currentKeyHash) {
        match = _applyEmailBridgeBind_(match, currentKeyHash);
        matchSource = match.source;
      } else if (!_isEntryLocked_(match)) {
        match =
          _updateEntryFields_(match.sheetRow, { last_seen_at: _nowText_() }) ||
          match;
      }
      if (!_isAccessEntryActivationComplete_(match)) {
        return _buildSpreadsheetSharingDescriptor_(context, policy);
      }
      return _buildDescriptorFromMatch_(
        match,
        sourceType,
        matchedBy,
        matchSource,
        policy,
        context,
      );
    }
  }

  if (policy.bootstrapAllowed && (currentKeyHash || sessionEmail)) {
    return _buildBootstrapDescriptor_(context, policy);
  }

  // No login/registration: editors of the spreadsheet get working access.
  return _buildSpreadsheetSharingDescriptor_(context, policy);
}

/**
 * Визначає користувача ТІЛЬКИ ДЛЯ ЧИТАННЯ (без модифікацій)
 */
function _resolveAccessSubjectReadOnly_(context) {
  const policy = _getAccessPolicy_();
  const currentKeyHash = context.currentKeyHash;
  const sessionEmail = context.sessionEmail;

  let match = null;

  if (currentKeyHash) {
    match = _findByUserKey_(currentKeyHash, {
      includeLocked: true,
      includeDisabled: true,
    });
    if (match) {
      if (!_isAccessEntryActivationComplete_(match)) {
        return _buildSpreadsheetSharingDescriptor_(context, policy);
      }
      return _buildDescriptorFromMatch_(
        match,
        "access",
        "user_key_current_hash",
        match.source,
        policy,
        context,
      );
    }
  }

  if (currentKeyHash) {
    match = _findByUserKey_(currentKeyHash, {
      includeLocked: true,
      includeDisabled: true,
      matchPrev: true,
    });
    if (match) {
      if (!_isAccessEntryActivationComplete_(match)) {
        return _buildSpreadsheetSharingDescriptor_(context, policy);
      }
      return _buildDescriptorFromMatch_(
        match,
        "access",
        "user_key_prev_hash",
        match.source,
        policy,
        context,
      );
    }
  }

  if (!policy.strictUserKeyMode && policy.allowEmailBridge && sessionEmail) {
    match = _findByEmailInSheet_(sessionEmail, {
      includeLocked: true,
      includeDisabled: true,
    });
    if (match) {
      if (!_isAccessEntryActivationComplete_(match)) {
        return _buildSpreadsheetSharingDescriptor_(context, policy);
      }
      return _buildDescriptorFromMatch_(
        match,
        "access",
        "email-bridge",
        match.source,
        policy,
        context,
      );
    }
  }

  if (policy.bootstrapAllowed && (currentKeyHash || sessionEmail)) {
    return _buildBootstrapDescriptor_(context, policy);
  }

  return _buildSpreadsheetSharingDescriptor_(context, policy);
}

function _isAccessEntryActivationComplete_(entry) {
  if (!entry) return false;
  if (entry.enabled !== true) return false;
  // Key allowlist only — no password / registration_status required.
  if (!String(entry.userKeyCurrentHash || "").trim()) return false;
  return true;
}

function _accessRegistrationRemovedResult_(extra) {
  return Object.assign(
    {
      success: false,
      ok: false,
      skipped: true,
      code: "access.registration.removed",
      message: "Реєстрацію та вхід за логіном у WASB вимкнено.",
    },
    extra || {},
  );
}

function _buildIncompleteRegistrationDescriptor_(
  entry,
  sourceType,
  matchedBy,
  matchSource,
  policy,
  context,
) {
  return {
    matchFound: true,
    sourceType: sourceType || "access",
    matchSource: matchSource || "ACCESS-incomplete-registration",
    matchedBy: matchedBy || "",
    entry: entry,
    role: "guest",
    roleLevel: 0,
    enabled: false,
    knownUser: true,
    registered: false,
    readOnly: true,
    isAdmin: false,
    isOperator: false,
    isMaintainer: false,
    adminDisabled: false,
    timedLocked: false,
    resolutionMode: policy.mode,
    reasonCode: "access.registration.incomplete",
    reasonMessage:
      "Запис у списку доступу неактивний або без привʼязаного ключа.",
    lockoutState: _getPublicLockoutState_(
      entry,
      context.sessionEmail,
      context.currentKeyHash,
    ),
  };
}

// ==================== ДЕСКРИПТОР КОРИСТУВАЧА ====================

/**
 * Формує дескриптор зі знайденого запису
 */
function _buildDescriptorFromMatch_(
  entry,
  sourceType,
  matchedBy,
  matchSource,
  policy,
  context,
) {
  const role = normalizeRole_(entry.role);
  const roleLevel = ROLE_ORDER[role] || 0;
  const enabled = entry.enabled && !_isTimedLocked_(entry);
  const timedLocked = _isTimedLocked_(entry);
  const adminDisabled = _isAdminDisabled_(entry);
  const registered = true;
  const knownUser = true;

  const { reasonCode, reasonMessage } = _getReasonForEntry(
    entry,
    timedLocked,
    adminDisabled,
  );

  return {
    matchFound: true,
    sourceType: sourceType,
    matchSource: matchSource,
    matchedBy: matchedBy,
    entry: entry,
    role: role,
    roleLevel: roleLevel,
    enabled: enabled,
    timedLocked: timedLocked,
    adminDisabled: adminDisabled,
    registered: registered,
    knownUser: knownUser,
    resolutionMode: policy.mode,
    reasonCode: reasonCode,
    reasonMessage: reasonMessage,
    lockoutState: _getPublicLockoutState_(
      entry,
      context.sessionEmail,
      context.currentKeyHash,
    ),
  };
}

/**
 * Bootstrap дескриптор (немає налаштованих адміністраторів)
 */
function _buildBootstrapDescriptor_(context, policy) {
  return {
    matchFound: true,
    sourceType: "bootstrap",
    matchSource: "bootstrap-owner",
    matchedBy: "bootstrap-owner",
    entry: null,
    role: "owner",
    roleLevel: ROLE_ORDER.owner,
    enabled: true,
    timedLocked: false,
    adminDisabled: false,
    registered: false,
    knownUser: true,
    resolutionMode: "bootstrap-owner",
    reasonCode: REASON_CODES.OK_BOOTSTRAP,
    reasonMessage: "RBAC не налаштовано. Тимчасовий доступ як власник.",
    lockoutState: {
      locked: false,
      disabledByAdmin: false,
      remainingMs: 0,
      remainingMinutes: 0,
      nextEscalationLevel: 0,
      lastAppliedLevel: 0,
      lastReason: "",
    },
  };
}

/**
 * Working access without login/registration: Google Spreadsheet sharing is the gate.
 */
function _buildSpreadsheetSharingDescriptor_(context, policy) {
  return {
    matchFound: true,
    sourceType: "spreadsheet",
    matchSource: "spreadsheet-sharing",
    matchedBy: "spreadsheet-sharing",
    entry: null,
    role: "owner",
    roleLevel: ROLE_ORDER.owner,
    enabled: true,
    timedLocked: false,
    adminDisabled: false,
    registered: true,
    knownUser: true,
    resolutionMode: "spreadsheet-sharing",
    reasonCode: REASON_CODES.OK,
    reasonMessage: "Вхід і реєстрацію вимкнено. Доступ через права Google-таблиці.",
    lockoutState: {
      locked: false,
      disabledByAdmin: false,
      remainingMs: 0,
      remainingMinutes: 0,
      nextEscalationLevel: 0,
      lastAppliedLevel: 0,
      lastReason: "",
    },
  };
}

/**
 * Legacy helper: registration/login removed — same as spreadsheet sharing.
 */
function _buildLoginDisabledDescriptor_(context, policy) {
  return _buildSpreadsheetSharingDescriptor_(context, policy);
}

function _sidebarLoginDisabledResult_(extra) {
  return _accessRegistrationRemovedResult_(
    Object.assign(
      {
        code: "access.login.disabled",
        message: "Вхід за логіном і паролем вимкнено.",
      },
      extra || {},
    ),
  );
}

/**
 * Дескриптор для невідомого користувача
 */
function _buildUnknownDescriptor_(context, policy) {
  const currentKeyHash = context.currentKeyHash;
  const sessionEmail = context.sessionEmail;

  let reasonCode = REASON_CODES.DENIED_UNKNOWN_USER;
  let reasonMessage = "Користувача не знайдено в системі.";

  if (currentKeyHash && policy.strictUserKeyMode) {
    reasonCode = REASON_CODES.DENIED_UNREGISTERED_KEY;
    reasonMessage = "Ключ не зареєстровано в списку доступу. Строгий режим.";
  } else if (currentKeyHash && !policy.strictUserKeyMode) {
    reasonCode = REASON_CODES.DENIED_BRIDGE_NOT_ALLOWED;
    reasonMessage =
      "Ключ не зареєстровано, а email-міст не підтвердив користувача.";
  } else if (!currentKeyHash && sessionEmail) {
    reasonCode = REASON_CODES.DENIED_KEY_UNAVAILABLE;
    reasonMessage =
      "Ключ користувача недоступний. Email-міст може допомогти, якщо увімкнено.";
  }

  return {
    matchFound: false,
    sourceType: null,
    matchSource: null,
    matchedBy: null,
    entry: null,
    role: "guest",
    roleLevel: ROLE_ORDER.guest,
    enabled: false,
    timedLocked: false,
    adminDisabled: false,
    registered: false,
    knownUser: false,
    resolutionMode: policy.mode,
    reasonCode: reasonCode,
    reasonMessage: reasonMessage,
    lockoutState: {
      locked: false,
      disabledByAdmin: false,
      remainingMs: 0,
      remainingMinutes: 0,
      nextEscalationLevel: 0,
      lastAppliedLevel: 0,
      lastReason: "",
    },
  };
}

// ==================== ПОШУК У ТАБЛИЦІ ====================

/**
 * Пошук запису за ключем користувача
 */
function _findByUserKey_(userKeyHash, options = {}) {
  const normalizedKey = normalizeStoredHash_(userKeyHash);
  if (!normalizedKey) return null;

  const includeLocked = options.includeLocked || false;
  const includeDisabled = options.includeDisabled || false;
  const matchPrev = options.matchPrev || false;

  const entries = _readSheetEntries_();
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!includeDisabled && _isAdminDisabled_(entry)) continue;
    if (!includeLocked && _isTimedLocked_(entry)) continue;

    if (entry.userKeyCurrentHash === normalizedKey) {
      return _enrichEntry(
        entry,
        "ACCESS-user-key-current",
        "user_key_current_hash",
      );
    }

    if (matchPrev && entry.userKeyPrevHash === normalizedKey) {
      return _enrichEntry(entry, "ACCESS-user-key-prev", "user_key_prev_hash");
    }
  }
  return null;
}

/**
 * Пошук запису за email
 */
function _findByEmailInSheet_(email, options = {}) {
  const normalizedEmail = normalizeEmail_(email);
  if (!normalizedEmail) return null;

  const includeLocked = options.includeLocked || false;
  const includeDisabled = options.includeDisabled || false;

  const entries = _readSheetEntries_();
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!includeDisabled && _isAdminDisabled_(entry)) continue;
    if (!includeLocked && _isTimedLocked_(entry)) continue;
    if (entry.email === normalizedEmail) {
      return _enrichEntry(entry, ACCESS_SHEET, "email");
    }
  }
  return null;
}

/**
 * Пошук записів за ідентифікатором (email або телефон)
 */
function _findEntriesByIdentifier_(
  identifierType,
  identifierValue,
  options = {},
) {
  const type = String(identifierType || "")
    .trim()
    .toLowerCase();
  const normalizedValue =
    type === "email"
      ? normalizeEmail_(identifierValue)
      : normalizePhone_(identifierValue);
  if (!normalizedValue) return [];

  const includeLocked = options.includeLocked || false;
  const includeDisabled = options.includeDisabled || false;

  return _readSheetEntries_()
    .filter(function (entry) {
      if (!includeDisabled && _isAdminDisabled_(entry)) return false;
      if (!includeLocked && _isTimedLocked_(entry)) return false;
      if (type === "email")
        return normalizeEmail_(entry.email) === normalizedValue;
      if (type === "phone")
        return normalizePhone_(entry.phone) === normalizedValue;
      return false;
    })
    .map(function (entry) {
      return _enrichEntry(entry, ACCESS_SHEET, type);
    });
}

/**
 * Пошук запису за позивним
 */
function _findByCallsign_(callsign, options = {}) {
  const normalizedCallsign = normalizeCallsign_(callsign);
  if (!normalizedCallsign) return null;

  const includeLocked = options.includeLocked || false;
  const includeDisabled = options.includeDisabled || false;
  const requireSelfBindAllowed = options.requireSelfBindAllowed || false;

  const entries = _readSheetEntries_();
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!includeDisabled && _isAdminDisabled_(entry)) continue;
    if (!includeLocked && _isTimedLocked_(entry)) continue;
    if (requireSelfBindAllowed && !entry.selfBindAllowed) continue;
    if (normalizeCallsign_(entry.personCallsign) === normalizedCallsign) {
      return _enrichEntry(entry, ACCESS_SHEET, "person_callsign");
    }
  }
  return null;
}

/**
 * Збагачує запис додатковою інформацією (helper з другого варіанту)
 */
function _enrichEntry(entry, source, matchedBy) {
  return Object.assign({}, entry, {
    source: source,
    matchedBy: matchedBy,
  });
}

/**
 * Отримує список доступних позивних для самостійного входу
 */
function listBindableCallsigns() {
  return [];
}

// ==================== HELPER-ФУНКЦІЇ ====================

/**
 * Визначає причину відмови для запису
 */
function _getReasonForEntry(entry, timedLocked, adminDisabled) {
  if (adminDisabled) {
    return {
      reasonCode: REASON_CODES.DENIED_ADMIN_DISABLED,
      reasonMessage: "Користувача вимкнено адміністратором.",
    };
  }

  if (timedLocked) {
    const remainingMinutes = entry.lockedUntilMs
      ? Math.ceil((entry.lockedUntilMs - _nowMs_()) / 60000)
      : 0;
    return {
      reasonCode: REASON_CODES.DENIED_TIMED_LOCKOUT,
      reasonMessage: `Доступ тимчасово заблоковано через повторні помилки. Залишилось ${remainingMinutes} хв.`,
    };
  }

  return {
    reasonCode: REASON_CODES.OK,
    reasonMessage: "",
  };
}

/**
 * Уніфікована помилка
 */
function _errorResponse(code, message, supportCallsign, loginMeta, extra = {}) {
  return {
    success: false,
    code: code,
    message: message,
    supportCallsign: supportCallsign,
    loginMeta: loginMeta,
    ...extra,
  };
}

/**
 * Уніфікований успіх
 */
function _successResponse(message, supportCallsign, loginMeta, descriptor) {
  return {
    success: true,
    code: REASON_CODES.OK,
    message: message,
    supportCallsign: supportCallsign,
    descriptor: descriptor || describe({ includeSensitiveDebug: false }),
    loginMeta: loginMeta,
  };
}

// ==================== САМОСТІЙНИЙ ВХІД (SELF-BIND) ====================

/**
 * Головна функція для самостійного входу за ідентифікатором та позивним
 */
function loginByIdentifierAndCallsign(
  identifierOrPayload,
  callsignMaybe,
  loginMetaMaybe,
) {
  return _accessRegistrationRemovedResult_({
    code: "access.self_bind.removed",
    message: "Самостійну привʼязку вимкнено.",
  });
}

function _rotationState_(source, keyAvailable, registered) {
  if (source === "ACCESS-user-key-rotated") return "rotated-and-promoted";
  if (source === "ACCESS-user-key-current") return "current-key-active";
  if (source === "ACCESS-user-key-prev") return "matched-previous-key";
  if (!registered && keyAvailable) return "key-not-registered";
  if (!keyAvailable) return "key-unavailable";
  return "unknown";
}

/**
 * Формує публічну відповідь для клієнта
 */
function _buildPublicAccessResponse_(descriptor, context, policy, options) {
  const entry = descriptor.entry;
  const opts = options || {};
  const role = descriptor.role;
  const roleLevel = descriptor.roleLevel;
  const enabled = descriptor.enabled;
  const timedLocked = descriptor.timedLocked;
  const adminDisabled = descriptor.adminDisabled;
  const registered = descriptor.registered;
  const knownUser = descriptor.knownUser;

  const auditSource =
    descriptor.matchSource || descriptor.sourceType || "unknown";

  const response = {
    identity: {
      email: context.sessionEmail || (entry && entry.email) || "",
      displayName: entry && entry.displayName ? String(entry.displayName) : "",
      personCallsign:
        entry && entry.personCallsign ? String(entry.personCallsign) : "",
      currentKeyHashFull: opts.includeSensitiveDebug
        ? context.currentKeyHash || ""
        : "",
      currentKeyHashMasked: context.currentKeyHash
        ? maskSensitiveValue_(context.currentKeyHash)
        : "",
    },

    access: {
      role: role,
      enabled: enabled,
      registered: registered,
      knownUser: knownUser,
      readOnly:
        role === "guest" || role === "viewer" || timedLocked || adminDisabled,
      isAdmin: roleLevel >= ROLE_ORDER.admin && enabled,
      isMaintainer: roleLevel >= ROLE_ORDER.maintainer && enabled,
      isOperator: roleLevel >= ROLE_ORDER.operator && enabled,
    },

    lockout: descriptor.lockoutState,

    login: {
      keyAvailable: !!context.currentKeyHash,
      selfBindRequired: false,
      canSelfBind: false,
      disabled: true,
      supportEmail: getPrimarySupportEmail_(),
      supportCallsign: getPrimarySupportCallsign_(),
      lockout: _getSelfBindLoginPublicState_(context.currentKeyHash),
    },

    policy: {
      mode: policy.mode,
      strictUserKeyMode: policy.strictUserKeyMode,
      migrationModeEnabled: policy.migrationModeEnabled,
      loginDisabled: true,
      rotationPeriodDays: ROTATION_PERIOD_DAYS,
      automaticPromotionOnPreviousKeyMatch: true,
    },

    audit: {
      source: auditSource,
      matchedBy: descriptor.matchedBy,
      lastSeenAt: entry && entry.lastSeenAt ? String(entry.lastSeenAt) : "",
      lastRotatedAt:
        entry && entry.lastRotatedAt ? String(entry.lastRotatedAt) : "",
      failedAttempts: entry && entry.failedAttempts ? entry.failedAttempts : 0,
    },

    reason: {
      code: descriptor.reasonCode,
      message: descriptor.reasonMessage,
    },

    reasonString: descriptor.reasonMessage,

    rotationState: _rotationState_(
      auditSource,
      !!context.currentKeyHash,
      registered,
    ),
    rotationPolicy: {
      rotationPeriodDays: ROTATION_PERIOD_DAYS,
      previousKeyColumn: "user_key_prev_hash",
      currentKeyColumn: "user_key_current_hash",
      emailBridgeEnabled: policy.migrationModeEnabled,
      automaticPromotionOnPreviousKeyMatch: true,
    },

    allowedActions: listAllowedActionsForRole_(role),
    displayName: entry && entry.displayName ? String(entry.displayName) : "",
    personCallsign:
      entry && entry.personCallsign ? String(entry.personCallsign) : "",
    currentKeyHashFull: opts.includeSensitiveDebug
      ? context.currentKeyHash || ""
      : "",
    currentKeyHashMasked: context.currentKeyHash
      ? maskSensitiveValue_(context.currentKeyHash)
      : "",
    email: context.sessionEmail || (entry && entry.email) || "",
    role: role,
    enabled: enabled,
    knownUser: knownUser,
    registered: registered,
    mode: policy.mode,
    strictUserKeyMode: policy.strictUserKeyMode,
    migrationModeEnabled: policy.migrationModeEnabled,
    loginDisabled: true,
    readOnly:
      role === "guest" || role === "viewer" || timedLocked || adminDisabled,
    isAdmin: roleLevel >= ROLE_ORDER.admin && enabled,
    isOperator: roleLevel >= ROLE_ORDER.operator && enabled,
    isMaintainer: roleLevel >= ROLE_ORDER.maintainer && enabled,
    source: auditSource,
    matchedBy: descriptor.matchedBy,
    lastSeenAt: entry && entry.lastSeenAt ? String(entry.lastSeenAt) : "",
    lastRotatedAt:
      entry && entry.lastRotatedAt ? String(entry.lastRotatedAt) : "",
    failedAttempts: entry && entry.failedAttempts ? entry.failedAttempts : 0,
    keyAvailable: !!context.currentKeyHash,
    supportEmail: getPrimarySupportEmail_(),
    supportCallsign: getPrimarySupportCallsign_(),
    selfBindRequired: false,
    canSelfBind: false,
    loginDisabled: true,
    loginLockout: _getSelfBindLoginPublicState_(context.currentKeyHash),
  };

  return response;
}

function submitAccessKeyRequest(payload) {
  return _accessRegistrationRemovedResult_({
    code: "access.registration.removed",
    message: "Реєстрацію ключа вимкнено.",
  });
}

function _findAccessEntryByPasswordSecret_(entries, secret) {
  const value = String(secret || "").trim();
  if (!value || /^WASB-/i.test(value)) return null;
  const list = Array.isArray(entries) ? entries : [];
  for (let i = 0; i < list.length; i++) {
    const row = list[i];
    if (row.enabled !== true) continue;
    if (String(row.registrationStatus || "").toLowerCase() !== "active")
      continue;
    if (!row.passwordHash || !row.passwordSalt) continue;
    if (typeof hashAccessPasswordWithSalt_ !== "function") continue;
    const enteredHash = hashAccessPasswordWithSalt_(value, row.passwordSalt);
    if (enteredHash === row.passwordHash) return row;
  }
  return null;
}

function _findAccessEntryByCredentials_(entries, login, password) {
  const normalizedLogin = String(login || "").trim().toLowerCase();
  const normalizedEmail = normalizeEmail_(login);
  const secret = String(password || "").trim();
  if (!normalizedLogin || !secret || /^WASB-/i.test(secret)) return null;
  const list = Array.isArray(entries) ? entries : [];
  for (let i = 0; i < list.length; i++) {
    const row = list[i];
    if (row.enabled !== true) continue;
    if (String(row.registrationStatus || "").toLowerCase() !== "active")
      continue;
    if (!row.passwordHash || !row.passwordSalt) continue;
    if (typeof hashAccessPasswordWithSalt_ !== "function") continue;

    const rowLogin = String(row.login || "").trim().toLowerCase();
    const rowEmail = normalizeEmail_(row.email);
    const loginMatches =
      rowLogin === normalizedLogin ||
      (!!normalizedEmail && rowEmail === normalizedEmail);
    if (!loginMatches) continue;

    const enteredHash = hashAccessPasswordWithSalt_(secret, row.passwordSalt);
    if (enteredHash === row.passwordHash) return row;
  }
  return null;
}

function _isTemporaryAccessKeyUsable_(entry, options) {
  if (!entry) return false;
  const opts = options || {};
  const allowActiveRecovery = opts.allowActiveRecovery !== false;
  const status = String(entry.registrationStatus || "")
    .trim()
    .toLowerCase();
  const hasCredentials = !!(
    String(entry.login || "").trim() && String(entry.passwordHash || "").trim()
  );
  const isRegistrationPath =
    status === "approved" ||
    status === "key_sent" ||
    (status === "active" && !hasCredentials);
  const isActiveRecoveryPath =
    allowActiveRecovery && status === "active" && hasCredentials;
  if (!isRegistrationPath && !isActiveRecoveryPath) {
    return false;
  }
  if (entry.enabled !== true) return false;
  if (!entry.temporaryPasswordHash || !entry.temporaryPasswordSalt)
    return false;
  if (entry.temporaryPasswordUsedAt) return false;
  if (entry.temporaryPasswordExpiresAt) {
    const expiresRaw = String(entry.temporaryPasswordExpiresAt || "").trim();
    const expiresDate = new Date(expiresRaw.replace(" ", "T"));
    if (!isNaN(expiresDate.getTime()) && Date.now() > expiresDate.getTime()) {
      return false;
    }
  }
  return true;
}

function _findAccessEntryByLoginAndTemporaryPassword_(entries, login, temporaryPassword) {
  const normalizedLogin = String(login || "").trim().toLowerCase();
  const normalizedEmail = normalizeEmail_(login);
  const tempPlain = String(temporaryPassword || "").trim();
  if (!normalizedLogin || !tempPlain || !/^WASB-/i.test(tempPlain)) return null;
  const list = Array.isArray(entries) ? entries : [];
  for (let i = 0; i < list.length; i++) {
    const row = list[i];
    if (row.enabled !== true) continue;
    const rowLogin = String(row.login || "").trim().toLowerCase();
    const rowEmail = normalizeEmail_(row.email);
    const loginMatches =
      rowLogin === normalizedLogin ||
      (!!normalizedEmail && rowEmail === normalizedEmail);
    if (!loginMatches) continue;
    if (!_isTemporaryAccessKeyUsable_(row, { allowActiveRecovery: true })) {
      continue;
    }
    const matched = _findAccessEntryByTemporaryPassword_([row], tempPlain);
    if (matched) return matched;
  }
  return null;
}

function _findAccessEntryByBrowserSession_(entries, sessionToken) {
  const token = String(sessionToken || "").trim();
  if (!token || typeof hashAccessBrowserSessionToken_ !== "function") return null;
  const tokenHash = hashAccessBrowserSessionToken_(token);
  if (!tokenHash) return null;
  const list = Array.isArray(entries) ? entries : [];
  for (let i = 0; i < list.length; i++) {
    const row = list[i];
    if (row.enabled !== true) continue;
    if (String(row.registrationStatus || "").toLowerCase() !== "active")
      continue;
    const storedHash = normalizeStoredHash_(
      row.browserSessionHash || row.browser_session_hash || "",
    );
    if (!storedHash || storedHash !== tokenHash) continue;
    if (
      typeof isAccessBrowserSessionExpired_ === "function" &&
      isAccessBrowserSessionExpired_(
        row.browserSessionExpiresAt || row.browser_session_expires_at || "",
      )
    ) {
      continue;
    }
    return row;
  }
  return null;
}

function _issueBrowserSessionForEntry_(entry) {
  if (!entry || !entry.sheetRow) {
    return { entry: entry, browserSessionToken: "" };
  }
  if (
    typeof generateAccessBrowserSessionToken_ !== "function" ||
    typeof hashAccessBrowserSessionToken_ !== "function" ||
    typeof getAccessBrowserSessionExpiresAt_ !== "function"
  ) {
    return { entry: entry, browserSessionToken: "" };
  }
  const browserSessionToken = generateAccessBrowserSessionToken_();
  const browserSessionHash = hashAccessBrowserSessionToken_(browserSessionToken);
  const browserSessionExpiresAt = getAccessBrowserSessionExpiresAt_(
    BROWSER_SESSION_TTL_DAYS,
  );
  const saved =
    _updateEntryFields_(entry.sheetRow, {
      browser_session_hash: browserSessionHash,
      browser_session_expires_at: browserSessionExpiresAt,
    }) || entry;
  return {
    entry: saved,
    browserSessionToken: browserSessionToken,
    browserSessionExpiresAt: browserSessionExpiresAt,
  };
}

function _bindAccessEntryToCurrentKey_(entry, currentKeyHash, options) {
  const opts = options || {};
  const occupantHash = normalizeStoredHash_(entry.userKeyCurrentHash);
  const shouldRotateCurrentKey =
    occupantHash && occupantHash !== currentKeyHash;
  const nowText = _nowText_();
  const nowLong = _nowText_("long");
  const updates = {
    user_key_current_hash: currentKeyHash,
    request_user_key_hash: currentKeyHash,
    last_seen_at: nowText,
    failed_attempts: 0,
    locked_until_ms: 0,
  };
  if (shouldRotateCurrentKey) {
    updates.user_key_prev_hash = occupantHash;
    updates.last_rotated_at = nowLong;
  } else if (!entry.lastRotatedAt) {
    updates.last_rotated_at = nowLong;
  }
  if (opts.consumeTemporaryPassword) {
    updates.temporary_password_plain = "";
    updates.temporary_password_used_at = nowLong;
  }
  const saved = _updateEntryFields_(entry.sheetRow, updates) || entry;
  if (shouldRotateCurrentKey && typeof _auditKeyRotation_ === "function") {
    _auditKeyRotation_(saved, {
      matchedBy: opts.matchedBy || "identity-proof-rebind",
      lastRotatedAt: nowLong,
    });
  }
  return saved;
}

/**
 * Вхід за вже виданим ключем доступу (тимчасовий WASB-код або пароль активного запису).
 */
function loginByAccessKey(accessKeyOrPayload) {
  return _accessRegistrationRemovedResult_({
    code: "access.login.removed",
    message: "Вхід за логіном і паролем вимкнено.",
  });
}

/**
 * Resume access after Google rotates the temporary browser key using a
 * previously issued long-lived browser session token.
 */
function resumeBrowserSession(payload) {
  return _accessRegistrationRemovedResult_({
    code: "access.session.removed",
    message: "Відновлення сесії через логін вимкнено.",
  });
}

function _findAccessEntryByTemporaryPassword_(entries, temporaryPassword) {
  const tempPlain = String(temporaryPassword || "").trim();
  if (!tempPlain || !/^WASB-/i.test(tempPlain)) return null;
  const list = Array.isArray(entries) ? entries : [];
  const allowPlainLookup =
    typeof isAccessTempPasswordPlainLookupEnabled_ === "function" &&
    isAccessTempPasswordPlainLookupEnabled_();
  for (let i = 0; i < list.length; i++) {
    const row = list[i];
    if (
      allowPlainLookup &&
      String(row.temporaryPasswordPlain || "").trim() === tempPlain
    ) {
      return row;
    }
    if (
      row.temporaryPasswordSalt &&
      row.temporaryPasswordHash &&
      typeof hashAccessPasswordWithSalt_ === "function"
    ) {
      const enteredHash = hashAccessPasswordWithSalt_(
        tempPlain,
        row.temporaryPasswordSalt,
      );
      if (enteredHash === row.temporaryPasswordHash) return row;
    }
  }
  return null;
}

function registerAccessWithTemporaryPassword(payload) {
  return _accessRegistrationRemovedResult_({
    code: "access.registration.removed",
    message: "Реєстрацію з тимчасовим паролем вимкнено.",
  });
}

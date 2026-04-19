// ==================== ПОЛІТИКА ДОСТУПУ ====================

/**
 * Отримує поточну політику доступу з кешем
 * @returns {Object} Політика доступу
 */
function _getAccessPolicy_() {
  if (_policyCache) return Object.assign({}, _policyCache);

  const entries = _readSheetEntries_();
  const hasAdminConfigured = entries.some(function(e) { 
    return e.enabled && ['admin', 'sysadmin', 'owner'].includes(e.role); 
  });
  const migrationModeEnabled = parseBoolean_(_getProperties_().getProperty(MIGRATION_EMAIL_BRIDGE_PROP), false);
  const accessSheetPresent = !!_getSheet_(false);

  _policyCache = {
    mode: migrationModeEnabled ? 'user-key+email-bridge' : 'strict-user-key',
    strictUserKeyMode: !migrationModeEnabled,
    migrationModeEnabled: migrationModeEnabled,
    allowEmailBridge: migrationModeEnabled,
    allowScriptPropertiesFallback: false,
    bootstrapAllowed: !hasAdminConfigured && (accessSheetPresent ? entries.length === 0 : true),
    adminConfigured: hasAdminConfigured,
    accessSheetPresent: accessSheetPresent,
    registeredKeysCount: entries.filter(function(e) { 
      return e.userKeyCurrentHash || e.userKeyPrevHash; 
    }).length
  };

  return Object.assign({}, _policyCache);
}


// ==================== ОСНОВНИЙ РЕЗОЛЬВЕР КОРИСТУВАЧА (логіка з першого варіанту) ====================

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

  // 1. Strict priority: ACCESS by current key
  if (currentKeyHash) {
    match = _findByUserKey_(currentKeyHash, { includeLocked: true, includeDisabled: true });
    if (match) {
      sourceType = 'access';
      matchedBy = 'user_key_current_hash';
      matchSource = match.source;
      if (!_isEntryLocked_(match)) {
        match = _applySuccessfulAuth_(match, currentKeyHash);
        matchSource = match.source;
      }
      return _buildDescriptorFromMatch_(match, sourceType, matchedBy, matchSource, policy, context);
    }
  }

  // 2. ACCESS by previous key - using unified operation
  if (currentKeyHash) {
    match = _findByUserKey_(currentKeyHash, { includeLocked: true, includeDisabled: true, matchPrev: true });
    if (match) {
      sourceType = 'access';
      matchedBy = 'user_key_prev_hash';
      matchSource = match.source;
      if (!_isEntryLocked_(match)) {
        match = _applyPrevKeyMatch_(match, currentKeyHash);
        matchSource = match.source;
      }
      return _buildDescriptorFromMatch_(match, sourceType, matchedBy, matchSource, policy, context);
    }
  }

  // 3. Email bridge (only if policy allows)
  if (policy.allowEmailBridge && sessionEmail) {
    match = _findByEmailInSheet_(sessionEmail, { includeLocked: true, includeDisabled: true });
    if (match) {
      sourceType = 'access';
      matchedBy = 'email-bridge';
      matchSource = match.source;
      if (!_isEntryLocked_(match) && currentKeyHash) {
        match = _applyEmailBridgeBind_(match, currentKeyHash);
        matchSource = match.source;
      } else if (!_isEntryLocked_(match)) {
        match = _updateEntryFields_(match.sheetRow, { last_seen_at: _nowText_() }) || match;
      }
      return _buildDescriptorFromMatch_(match, sourceType, matchedBy, matchSource, policy, context);
    }
  }

  // 4. Bootstrap mode
  if (policy.bootstrapAllowed && (currentKeyHash || sessionEmail)) {
    return _buildBootstrapDescriptor_(context, policy);
  }

  // 5. No match found
  return _buildUnknownDescriptor_(context, policy);
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
    match = _findByUserKey_(currentKeyHash, { includeLocked: true, includeDisabled: true });
    if (match) {
      return _buildDescriptorFromMatch_(match, 'access', 'user_key_current_hash', match.source, policy, context);
    }
  }

  if (currentKeyHash) {
    match = _findByUserKey_(currentKeyHash, { includeLocked: true, includeDisabled: true, matchPrev: true });
    if (match) {
      return _buildDescriptorFromMatch_(match, 'access', 'user_key_prev_hash', match.source, policy, context);
    }
  }

  if (policy.allowEmailBridge && sessionEmail) {
    match = _findByEmailInSheet_(sessionEmail, { includeLocked: true, includeDisabled: true });
    if (match) {
      return _buildDescriptorFromMatch_(match, 'access', 'email-bridge', match.source, policy, context);
    }
  }

  if (policy.bootstrapAllowed && (currentKeyHash || sessionEmail)) {
    return _buildBootstrapDescriptor_(context, policy);
  }

  return _buildUnknownDescriptor_(context, policy);
}


// ==================== ДЕСКРИПТОР (логіка з першого варіанту) ====================

/**
 * Формує дескриптор зі знайденого запису
 */
function _buildDescriptorFromMatch_(entry, sourceType, matchedBy, matchSource, policy, context) {
  const role = normalizeRole_(entry.role);
  const roleLevel = ROLE_ORDER[role] || 0;
  const enabled = entry.enabled && !_isTimedLocked_(entry);
  const timedLocked = _isTimedLocked_(entry);
  const adminDisabled = _isAdminDisabled_(entry);
  const registered = true;
  const knownUser = true;

  const { reasonCode, reasonMessage } = _getReasonForEntry(entry, timedLocked, adminDisabled);

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
    lockoutState: _getPublicLockoutState_(entry, context.sessionEmail, context.currentKeyHash)
  };
}

/**
 * Bootstrap дескриптор (немає налаштованих адміністраторів)
 */
function _buildBootstrapDescriptor_(context, policy) {
  return {
    matchFound: true,
    sourceType: 'bootstrap',
    matchSource: 'bootstrap-owner',
    matchedBy: 'bootstrap-owner',
    entry: null,
    role: 'owner',
    roleLevel: ROLE_ORDER.owner,
    enabled: true,
    timedLocked: false,
    adminDisabled: false,
    registered: false,
    knownUser: true,
    resolutionMode: 'bootstrap-owner',
    reasonCode: REASON_CODES.OK_BOOTSTRAP,
    reasonMessage: 'RBAC не налаштовано. Тимчасовий доступ як власник.',
    lockoutState: {
      locked: false,
      disabledByAdmin: false,
      remainingMs: 0,
      remainingMinutes: 0,
      nextEscalationLevel: 0,
      lastAppliedLevel: 0,
      lastReason: ''
    }
  };
}

/**
 * Дескриптор для невідомого користувача
 */
function _buildUnknownDescriptor_(context, policy) {
  const currentKeyHash = context.currentKeyHash;
  const sessionEmail = context.sessionEmail;
  
  let reasonCode = REASON_CODES.DENIED_UNKNOWN_USER;
  let reasonMessage = 'Користувача не знайдено в системі.';

  if (currentKeyHash && policy.strictUserKeyMode) {
    reasonCode = REASON_CODES.DENIED_UNREGISTERED_KEY;
    reasonMessage = 'Ключ не зареєстровано в ACCESS. Строгий режим.';
  } else if (currentKeyHash && !policy.strictUserKeyMode) {
    reasonCode = REASON_CODES.DENIED_BRIDGE_NOT_ALLOWED;
    reasonMessage = 'Ключ не зареєстровано, а email-міст не підтвердив користувача.';
  } else if (!currentKeyHash && sessionEmail) {
    reasonCode = REASON_CODES.DENIED_KEY_UNAVAILABLE;
    reasonMessage = 'Ключ користувача недоступний. Email-міст може допомогти, якщо увімкнено.';
  }

  return {
    matchFound: false,
    sourceType: null,
    matchSource: null,
    matchedBy: null,
    entry: null,
    role: 'guest',
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
      lastReason: ''
    }
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
      return _enrichEntry(entry, 'ACCESS-user-key-current', 'user_key_current_hash');
    }

    if (matchPrev && entry.userKeyPrevHash === normalizedKey) {
      return _enrichEntry(entry, 'ACCESS-user-key-prev', 'user_key_prev_hash');
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
      return _enrichEntry(entry, ACCESS_SHEET, 'email');
    }
  }
  return null;
}

/**
 * Пошук записів за ідентифікатором (email або телефон)
 */
function _findEntriesByIdentifier_(identifierType, identifierValue, options = {}) {
  const type = String(identifierType || '').trim().toLowerCase();
  const normalizedValue = type === 'email' ? normalizeEmail_(identifierValue) : normalizePhone_(identifierValue);
  if (!normalizedValue) return [];

  const includeLocked = options.includeLocked || false;
  const includeDisabled = options.includeDisabled || false;

  return _readSheetEntries_().filter(function(entry) {
    if (!includeDisabled && _isAdminDisabled_(entry)) return false;
    if (!includeLocked && _isTimedLocked_(entry)) return false;
    if (type === 'email') return normalizeEmail_(entry.email) === normalizedValue;
    if (type === 'phone') return normalizePhone_(entry.phone) === normalizedValue;
    return false;
  }).map(function(entry) {
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
      return _enrichEntry(entry, ACCESS_SHEET, 'person_callsign');
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
    matchedBy: matchedBy
  });
}

/**
 * Отримує список доступних позивних для самостійного входу
 */
function listBindableCallsigns() {
  const entries = _readSheetEntries_();
  return entries
    .filter(function(entry) {
      return entry.enabled && entry.selfBindAllowed && !!normalizeCallsign_(entry.personCallsign);
    })
    .map(function(entry) {
      return normalizeCallsign_(entry.personCallsign);
    })
    .filter(function(value, index, arr) {
      return arr.indexOf(value) === index;
    })
    .sort();
}


// ==================== HELPER-ФУНКЦІЇ (з другого варіанту, без втрати логіки) ====================

/**
 * Визначає причину відмови для запису
 */
function _getReasonForEntry(entry, timedLocked, adminDisabled) {
  if (adminDisabled) {
    return {
      reasonCode: REASON_CODES.DENIED_ADMIN_DISABLED,
      reasonMessage: 'Користувача вимкнено адміністратором.'
    };
  }
  
  if (timedLocked) {
    const remainingMinutes = entry.lockedUntilMs 
      ? Math.ceil((entry.lockedUntilMs - _nowMs_()) / 60000) 
      : 0;
    return {
      reasonCode: REASON_CODES.DENIED_TIMED_LOCKOUT,
      reasonMessage: `Доступ тимчасово заблоковано через повторні помилки. Залишилось ${remainingMinutes} хв.`
    };
  }
  
  return {
    reasonCode: REASON_CODES.OK,
    reasonMessage: ''
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
    ...extra
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
    loginMeta: loginMeta
  };
}


// ==================== САМОСТІЙНИЙ ВХІД (SELF-BIND) ====================

/**
 * Головна функція для самостійного входу за ідентифікатором та позивним
 */
function loginByIdentifierAndCallsign(identifierOrPayload, callsignMaybe, loginMetaMaybe) {
  const payload = (identifierOrPayload && typeof identifierOrPayload === 'object' && !Array.isArray(identifierOrPayload))
    ? Object.assign({}, identifierOrPayload)
    : { identifier: identifierOrPayload, callsign: callsignMaybe, loginMeta: loginMetaMaybe };

  const currentKeyHash = getCurrentUserKeyHash_();
  const supportCallsign = getPrimarySupportCallsign_();
  const identifier = String(payload.identifier || '').trim();
  const callsign = String(payload.callsign || '').trim();
  const loginMeta = _normalizeLoginMeta_(payload.loginMeta || {});
  const identifierType = detectIdentifierType_(identifier);
  const normalizedIdentifier = normalizeIdentifierValue_(identifier);
  const normalizedCallsign = normalizeCallsign_(callsign);

  if (!currentKeyHash) {
    return _errorResponse(
      REASON_CODES.SELF_BIND_KEY_UNAVAILABLE,
      'Не вдалося визначити ключ користувача. Оновіть панель і спробуйте ще раз.',
      supportCallsign,
      loginMeta
    );
  }

  const loginState = _getSelfBindLoginPublicState_(currentKeyHash);
  if (loginState.locked) {
    return _errorResponse(
      REASON_CODES.SELF_BIND_LOGIN_BLOCKED,
      'Ваш вхід тимчасово заблоковано на ' + loginState.remainingMinutes + ' хв. ' + getSelfBindHelpText_() + '.',
      supportCallsign,
      loginMeta,
      { loginLockout: loginState }
    );
  }

  if (!normalizedIdentifier || !identifierType) {
    return _errorResponse(
      REASON_CODES.SELF_BIND_IDENTIFIER_REQUIRED,
      'Введіть email або телефон.',
      supportCallsign,
      loginMeta
    );
  }

  if (!normalizedCallsign) {
    return _errorResponse(
      REASON_CODES.SELF_BIND_CALLSIGN_NOT_FOUND,
      'Введіть свій позивний.',
      supportCallsign,
      loginMeta
    );
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const alreadyBound = _findByUserKey_(currentKeyHash, { includeLocked: true, includeDisabled: true, matchPrev: true });
    const matchedEntries = _findEntriesByIdentifier_(identifierType, normalizedIdentifier, { includeLocked: true, includeDisabled: true });
    const matchedEntry = matchedEntries.find(function(entry) {
      return normalizeCallsign_(entry.personCallsign) === normalizedCallsign;
    }) || null;

    if (alreadyBound) {
      const currentCallsign = normalizeCallsign_(alreadyBound.personCallsign);
      const identifierMatches = (identifierType === 'email')
        ? normalizeEmail_(alreadyBound.email) === normalizedIdentifier
        : normalizePhone_(alreadyBound.phone) === normalizedIdentifier;

      if (currentCallsign === normalizedCallsign && identifierMatches) {
        _clearSelfBindLoginState_(currentKeyHash);
        _applySuccessfulAuth_(alreadyBound, currentKeyHash);
        return _successResponse(
          'Вхід підтверджено для позивного ' + currentCallsign + '.',
          supportCallsign,
          loginMeta
        );
      }
    }

    if (!matchedEntries.length) {
      const failure = _registerSelfBindFailure_(currentKeyHash, {
        identifierType: identifierType,
        identifierValue: normalizedIdentifier,
        callsign: normalizedCallsign,
        reasonCode: REASON_CODES.SELF_BIND_IDENTIFIER_NOT_FOUND,
        reasonMessage: 'Не знайдено жодного доступного запису для вказаного ідентифікатора.',
        loginMeta: loginMeta
      });
      const finalCode = failure.blocked ? REASON_CODES.SELF_BIND_LOGIN_BLOCKED : REASON_CODES.SELF_BIND_IDENTIFIER_NOT_FOUND;
      return _errorResponse(
        finalCode,
        _failureMessageForSelfBind_(REASON_CODES.SELF_BIND_IDENTIFIER_NOT_FOUND, normalizedCallsign, failure),
        supportCallsign,
        loginMeta,
        { loginLockout: failure }
      );
    }

    if (!matchedEntry) {
      const failure = _registerSelfBindFailure_(currentKeyHash, {
        identifierType: identifierType,
        identifierValue: normalizedIdentifier,
        callsign: normalizedCallsign,
        reasonCode: REASON_CODES.SELF_BIND_IDENTIFIER_MISMATCH,
        reasonMessage: 'Позивний не збігається з указаним email або телефоном.',
        loginMeta: loginMeta
      });
      const finalCode = failure.blocked ? REASON_CODES.SELF_BIND_LOGIN_BLOCKED : REASON_CODES.SELF_BIND_IDENTIFIER_MISMATCH;
      return _errorResponse(
        finalCode,
        _failureMessageForSelfBind_(REASON_CODES.SELF_BIND_IDENTIFIER_MISMATCH, normalizedCallsign, failure),
        supportCallsign,
        loginMeta,
        { loginLockout: failure }
      );
    }

    if (!matchedEntry.enabled || _isAdminDisabled_(matchedEntry)) {
      return _errorResponse(
        REASON_CODES.SELF_BIND_CALLSIGN_DISABLED,
        'Цей позивний тимчасово вимкнено. ' + getSelfBindHelpText_() + '.',
        supportCallsign,
        loginMeta
      );
    }

    if (!matchedEntry.selfBindAllowed) {
      return _errorResponse(
        REASON_CODES.SELF_BIND_CALLSIGN_NOT_ALLOWED,
        'Для цього позивного самостійний вхід вимкнено. ' + getSelfBindHelpText_() + '.',
        supportCallsign,
        loginMeta
      );
    }

    if (_isTimedLocked_(matchedEntry)) {
      return _errorResponse(
        REASON_CODES.DENIED_TIMED_LOCKOUT,
        'Цей позивний тимчасово заблоковано. ' + getSelfBindHelpText_() + '.',
        supportCallsign,
        loginMeta
      );
    }

    const occupantHash = normalizeStoredHash_(matchedEntry.userKeyCurrentHash);
    if (occupantHash && occupantHash !== currentKeyHash) {
      const failure = _registerSelfBindFailure_(currentKeyHash, {
        identifierType: identifierType,
        identifierValue: normalizedIdentifier,
        callsign: normalizedCallsign,
        reasonCode: REASON_CODES.SELF_BIND_CALLSIGN_OCCUPIED,
        reasonMessage: 'Позивний уже зайнятий іншим ключем.',
        loginMeta: loginMeta
      });
      const finalCode = failure.blocked ? REASON_CODES.SELF_BIND_LOGIN_BLOCKED : REASON_CODES.SELF_BIND_CALLSIGN_OCCUPIED;
      return _errorResponse(
        finalCode,
        _failureMessageForSelfBind_(REASON_CODES.SELF_BIND_CALLSIGN_OCCUPIED, normalizedCallsign, failure),
        supportCallsign,
        loginMeta,
        { loginLockout: failure }
      );
    }

    const nowText = _nowText_();
    const updates = {
      user_key_current_hash: currentKeyHash,
      last_seen_at: nowText,
      failed_attempts: 0,
      locked_until_ms: 0
    };
    if (!matchedEntry.lastRotatedAt) {
      updates.last_rotated_at = nowText;
    }
    _updateEntryFields_(matchedEntry.sheetRow, updates);
    _clearSelfBindLoginState_(currentKeyHash);

    return _successResponse(
      'Вхід підтверджено для позивного ' + normalizedCallsign + '.',
      supportCallsign,
      loginMeta
    );
  } finally {
    lock.releaseLock();
  }
}

/**
 * Скорочений варіант - прив'язка тільки за позивним
 */
function bindCurrentKeyToCallsign(callsign) {
  return loginByIdentifierAndCallsign('', callsign || '');
}


// ==================== ПУБЛІЧНА ВІДПОВІДЬ (RESPONSE BUILDER) ====================

/**
 * Стан ротації ключа
 */
function _rotationState_(source, keyAvailable, registered) {
  if (source === 'ACCESS-user-key-rotated') return 'rotated-and-promoted';
  if (source === 'ACCESS-user-key-current') return 'current-key-active';
  if (source === 'ACCESS-user-key-prev') return 'matched-previous-key';
  if (!registered && keyAvailable) return 'key-not-registered';
  if (!keyAvailable) return 'key-unavailable';
  return 'unknown';
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

  const auditSource = descriptor.matchSource || descriptor.sourceType || 'unknown';

  const response = {
    identity: {
      email: context.sessionEmail || (entry && entry.email) || '',
      displayName: entry && entry.displayName ? String(entry.displayName) : '',
      personCallsign: entry && entry.personCallsign ? String(entry.personCallsign) : '',
      currentKeyHashFull: opts.includeSensitiveDebug ? (context.currentKeyHash || '') : '',
      currentKeyHashMasked: context.currentKeyHash ? maskSensitiveValue_(context.currentKeyHash) : ''
    },

    access: {
      role: role,
      enabled: enabled,
      registered: registered,
      knownUser: knownUser,
      readOnly: role === 'guest' || role === 'viewer' || timedLocked || adminDisabled,
      isAdmin: roleLevel >= ROLE_ORDER.admin && enabled,
      isMaintainer: roleLevel >= ROLE_ORDER.maintainer && enabled,
      isOperator: roleLevel >= ROLE_ORDER.operator && enabled
    },

    lockout: descriptor.lockoutState,
    
    login: {
      keyAvailable: !!context.currentKeyHash,
      selfBindRequired: !!context.currentKeyHash && !registered,
      canSelfBind: !!context.currentKeyHash && !registered,
      supportEmail: getPrimarySupportEmail_(),
      supportCallsign: getPrimarySupportCallsign_(),
      lockout: _getSelfBindLoginPublicState_(context.currentKeyHash)
    },

    policy: {
      mode: policy.mode,
      strictUserKeyMode: policy.strictUserKeyMode,
      migrationModeEnabled: policy.migrationModeEnabled,
      rotationPeriodDays: ROTATION_PERIOD_DAYS,
      automaticPromotionOnPreviousKeyMatch: true
    },

    audit: {
      source: auditSource,
      matchedBy: descriptor.matchedBy,
      lastSeenAt: entry && entry.lastSeenAt ? String(entry.lastSeenAt) : '',
      lastRotatedAt: entry && entry.lastRotatedAt ? String(entry.lastRotatedAt) : '',
      failedAttempts: entry && entry.failedAttempts ? entry.failedAttempts : 0
    },

    reason: {
      code: descriptor.reasonCode,
      message: descriptor.reasonMessage
    },
    reasonString: descriptor.reasonMessage,

    rotationState: _rotationState_(auditSource, !!context.currentKeyHash, registered),
    rotationPolicy: {
      rotationPeriodDays: ROTATION_PERIOD_DAYS,
      previousKeyColumn: 'user_key_prev_hash',
      currentKeyColumn: 'user_key_current_hash',
      emailBridgeEnabled: policy.migrationModeEnabled,
      automaticPromotionOnPreviousKeyMatch: true
    },

    allowedActions: listAllowedActionsForRole_(role),

    // Legacy compatibility fields (deprecated)
    displayName: entry && entry.displayName ? String(entry.displayName) : '',
    personCallsign: entry && entry.personCallsign ? String(entry.personCallsign) : '',
    currentKeyHashFull: opts.includeSensitiveDebug ? (context.currentKeyHash || '') : '',
    currentKeyHashMasked: context.currentKeyHash ? maskSensitiveValue_(context.currentKeyHash) : '',
    email: context.sessionEmail || (entry && entry.email) || '',
    role: role,
    enabled: enabled,
    knownUser: knownUser,
    registered: registered,
    mode: policy.mode,
    strictUserKeyMode: policy.strictUserKeyMode,
    migrationModeEnabled: policy.migrationModeEnabled,
    readOnly: role === 'guest' || role === 'viewer' || timedLocked || adminDisabled,
    isAdmin: roleLevel >= ROLE_ORDER.admin && enabled,
    isOperator: roleLevel >= ROLE_ORDER.operator && enabled,
    isMaintainer: roleLevel >= ROLE_ORDER.maintainer && enabled,
    source: auditSource,
    matchedBy: descriptor.matchedBy,
    lastSeenAt: entry && entry.lastSeenAt ? String(entry.lastSeenAt) : '',
    lastRotatedAt: entry && entry.lastRotatedAt ? String(entry.lastRotatedAt) : '',
    failedAttempts: entry && entry.failedAttempts ? entry.failedAttempts : 0,
    keyAvailable: !!context.currentKeyHash,
    supportEmail: getPrimarySupportEmail_(),
    supportCallsign: getPrimarySupportCallsign_(),
    selfBindRequired: !!context.currentKeyHash && !registered,
    canSelfBind: !!context.currentKeyHash && !registered,
    loginLockout: _getSelfBindLoginPublicState_(context.currentKeyHash)
  };

  return response;
}

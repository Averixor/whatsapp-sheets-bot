  // ==================== REASON CODES ====================
  const REASON_CODES = Object.freeze({
    OK: 'access.ok',
    OK_BOOTSTRAP: 'access.ok.bootstrap',
    DENIED_UNREGISTERED_KEY: 'access.denied.unregistered_key',
    DENIED_KEY_UNAVAILABLE: 'access.denied.key_unavailable',
    DENIED_ADMIN_DISABLED: 'access.denied.admin_disabled',
    DENIED_TIMED_LOCKOUT: 'access.denied.timed_lockout',
    DENIED_ROLE_INSUFFICIENT: 'access.denied.role_insufficient',
    DENIED_UNKNOWN_USER: 'access.denied.unknown_user',
    DENIED_BRIDGE_NOT_ALLOWED: 'access.denied.bridge_not_allowed',
    DENIED_LEGACY_FALLBACK_DISABLED: 'access.denied.legacy_fallback_disabled',
    SELF_BIND_KEY_UNAVAILABLE: 'access.self_bind.key_unavailable',
    SELF_BIND_CALLSIGN_NOT_FOUND: 'access.self_bind.callsign_not_found',
    SELF_BIND_CALLSIGN_DISABLED: 'access.self_bind.callsign_disabled',
    SELF_BIND_CALLSIGN_NOT_ALLOWED: 'access.self_bind.callsign_not_allowed',
    SELF_BIND_CALLSIGN_OCCUPIED: 'access.self_bind.callsign_occupied',
    SELF_BIND_KEY_ALREADY_BOUND: 'access.self_bind.key_already_bound',
    SELF_BIND_IDENTIFIER_REQUIRED: 'access.self_bind.identifier_required',
    SELF_BIND_IDENTIFIER_NOT_FOUND: 'access.self_bind.identifier_not_found',
    SELF_BIND_IDENTIFIER_MISMATCH: 'access.self_bind.identifier_mismatch',
    SELF_BIND_LOGIN_BLOCKED: 'access.self_bind.login_blocked'
  });


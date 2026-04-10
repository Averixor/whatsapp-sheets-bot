  // ==================== ENTRY STATUS ====================

  function _isAdminDisabled_(entry) {
    return !!(entry && entry.enabled === false);
  }

  function _isTimedLocked_(entry) {
    if (!entry || entry.enabled === false) return false;
    if (!entry.lockedUntilMs || entry.lockedUntilMs <= 0) return false;
    return entry.lockedUntilMs > _nowMs_();
  }

  function _isEntryLocked_(entry) {
    return _isAdminDisabled_(entry) || _isTimedLocked_(entry);
  }

  // ==================== LOCKOUT STATE ====================

  function _lockoutIdentity_(entry, fallbackEmail, fallbackKeyHash) {
    const email = normalizeEmail_(entry && entry.email || fallbackEmail || '');
    if (email) return 'email::' + email;

    const keyHash = normalizeStoredHash_(
      entry && (entry.userKeyCurrentHash || entry.userKeyPrevHash) || fallbackKeyHash || ''
    );
    if (keyHash) return 'key::' + keyHash;

    if (entry && entry.sheetRow) return 'row::' + String(entry.sheetRow);
    return '';
  }

  function _lockoutPropKey_(entry, fallbackEmail, fallbackKeyHash) {
    const identity = _lockoutIdentity_(entry, fallbackEmail, fallbackKeyHash);
    return identity ? LOCKOUT_PROP_PREFIX + identity : '';
  }

  function _readLockoutMeta_(entry, fallbackEmail, fallbackKeyHash) {
    const propKey = _lockoutPropKey_(entry, fallbackEmail, fallbackKeyHash);
    const base = {
      nextLevel: 0,
      lastAppliedLevel: 0,
      updatedAtMs: 0,
      lastReason: ''
    };

    if (!propKey) return base;

    const raw = _getProperties_().getProperty(propKey);
    if (!raw) return base;

    try {
      const parsed = JSON.parse(raw);
      return {
        nextLevel: _clampLevel_(parsed && parsed.nextLevel),
        lastAppliedLevel: _clampLevel_(parsed && parsed.lastAppliedLevel),
        updatedAtMs: parseInt(parsed && parsed.updatedAtMs || '0', 10) || 0,
        lastReason: String(parsed && parsed.lastReason || '')
      };
    } catch (_) {
      return base;
    }
  }

  function _writeLockoutMeta_(entry, meta, fallbackEmail, fallbackKeyHash) {
    const propKey = _lockoutPropKey_(entry, fallbackEmail, fallbackKeyHash);
    if (!propKey) return;

    _getProperties_().setProperty(propKey, JSON.stringify({
      nextLevel: _clampLevel_(meta && meta.nextLevel),
      lastAppliedLevel: _clampLevel_(meta && meta.lastAppliedLevel),
      updatedAtMs: parseInt(meta && meta.updatedAtMs || '0', 10) || 0,
      lastReason: String(meta && meta.lastReason || '')
    }));
  }

  function _clearLockoutMeta_(entry, fallbackEmail, fallbackKeyHash) {
    const propKey = _lockoutPropKey_(entry, fallbackEmail, fallbackKeyHash);
    if (propKey) _getProperties_().deleteProperty(propKey);
  }

  function _getPublicLockoutState_(entry, fallbackEmail, fallbackKeyHash) {
    const timedLocked = _isTimedLocked_(entry);
    const disabledByAdmin = _isAdminDisabled_(entry);
    const meta = _readLockoutMeta_(entry, fallbackEmail, fallbackKeyHash);

    const remainingMs = timedLocked
      ? Math.max(Number(entry && entry.lockedUntilMs || 0) - _nowMs_(), 0)
      : 0;

    return {
      locked: timedLocked,
      disabledByAdmin: disabledByAdmin,
      remainingMs: remainingMs,
      remainingMinutes: _minutesText_(remainingMs),
      nextEscalationLevel: meta.nextLevel,
      lastAppliedLevel: meta.lastAppliedLevel,
      lastReason: meta.lastReason
    };
  }
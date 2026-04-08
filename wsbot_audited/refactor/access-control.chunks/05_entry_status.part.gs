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


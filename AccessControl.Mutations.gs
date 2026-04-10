  // ==================== UNIFIED MUTATION OPERATIONS ====================

  function _applySuccessfulAuth_(entry, userKeyHash) {
    if (!entry || !entry.sheetRow) return entry;

    const now = _nowText_();
    const updates = {
      last_seen_at: now,
      failed_attempts: 0,
      locked_until_ms: 0
    };

    let rotated = false;

    if (userKeyHash && entry.userKeyPrevHash === userKeyHash) {
      const pair = _sanitizeKeyPair_(userKeyHash, entry.userKeyCurrentHash || entry.userKeyPrevHash || '');
      updates.user_key_current_hash = pair.current;
      updates.user_key_prev_hash = pair.previous;
      updates.last_rotated_at = now;
      rotated = true;
    }

    const updated = _updateEntryFields_(entry.sheetRow, updates) || Object.assign({}, entry, {
      lastSeenAt: now,
      failedAttempts: 0,
      lockedUntilMs: 0
    });

    _clearLockoutMeta_(updated);

    if (rotated) {
      updated.source = 'ACCESS-user-key-rotated';
      updated.matchedBy = 'user_key_prev_hash';
      _auditKeyRotation_(updated, {
        matchedBy: 'user_key_prev_hash',
        lastRotatedAt: now
      });
    } else {
      updated.source = entry.source || 'ACCESS-user-key-current';
      updated.matchedBy = entry.matchedBy || 'user_key_current_hash';
    }

    return updated;
  }

  function _applyFailedAuth_(entry, violationType, reason) {
    if (!entry || !entry.sheetRow || !entry.enabled) return entry;
    if (_isAdminDisabled_(entry) || _isTimedLocked_(entry)) return entry;

    const lock = LockService.getScriptLock();
    lock.waitLock(5000);

    try {
      const fresh = _getEntryBySheetRow_(entry.sheetRow) || entry;
      if (!fresh.enabled || _isAdminDisabled_(fresh) || _isTimedLocked_(fresh)) return fresh;

      const nowMs = _nowMs_();
      const nowText = _nowText_();
      const newFailedCount = (fresh.failedAttempts || 0) + 1;
      const updates = {
        failed_attempts: newFailedCount,
        last_seen_at: nowText
      };

      let justLocked = false;
      let appliedDurationMs = 0;
      let appliedLevel = 0;

      if (newFailedCount >= MAX_FAILED_ATTEMPTS_SHEET) {
        const meta = _readLockoutMeta_(fresh);
        appliedLevel = _clampLevel_(meta.nextLevel);
        appliedDurationMs = LOCKOUT_ESCALATION_MS[appliedLevel] || LOCKOUT_DURATION_MS;

        updates.failed_attempts = 0;
        updates.locked_until_ms = nowMs + appliedDurationMs;

        _writeLockoutMeta_(fresh, {
          nextLevel: _clampLevel_(appliedLevel + 1),
          lastAppliedLevel: appliedLevel,
          updatedAtMs: nowMs,
          lastReason: String(reason || violationType || '')
        });

        justLocked = true;
      }

      const updated = _updateEntryFields_(fresh.sheetRow, updates) || Object.assign({}, fresh, {
        failedAttempts: updates.failed_attempts,
        lockedUntilMs: updates.locked_until_ms || 0,
        lastSeenAt: nowText
      });

      if (justLocked) {
        Logger.log(
          '[AccessControl] Lockout applied for ' + (updated.email || ('row:' + updated.sheetRow)) +
          ' for ' + _minutesText_(appliedDurationMs) + ' min (level ' + appliedLevel + ' → ' + (appliedLevel + 1) + ')'
        );
      }

      return updated;
    } finally {
      lock.releaseLock();
    }
  }

  function _applyEmailBridgeBind_(entry, currentKeyHash) {
    if (!entry || !entry.sheetRow || !entry.enabled) return null;
    if (_isTimedLocked_(entry)) return entry;

    const updates = {
      last_seen_at: _nowText_(),
      failed_attempts: 0,
      locked_until_ms: 0
    };

    if (currentKeyHash) {
      const pair = _sanitizeKeyPair_(
        currentKeyHash,
        entry.userKeyCurrentHash && entry.userKeyCurrentHash !== currentKeyHash
          ? entry.userKeyCurrentHash
          : entry.userKeyPrevHash
      );
      updates.user_key_current_hash = pair.current;
      updates.user_key_prev_hash = pair.previous;
      if (entry.userKeyCurrentHash && entry.userKeyCurrentHash !== currentKeyHash) {
        updates.last_rotated_at = _nowText_();
      }
    }

    const updated = _updateEntryFields_(entry.sheetRow, updates) || entry;
    _clearLockoutMeta_(updated);

    return Object.assign({}, updated, {
      source: currentKeyHash ? 'ACCESS-email-bound-key' : 'ACCESS-email-bridge',
      matchedBy: 'email-bridge'
    });
  }

  /**
   * Unified operation for prev-key match with rotation
   * Preserves matchSource as 'ACCESS-user-key-rotated'
   */
  function _applyPrevKeyMatch_(entry, matchedKeyHash) {
    if (!entry || !entry.sheetRow) return entry;
    if (entry.userKeyPrevHash !== matchedKeyHash) return entry;
    if (_isAdminDisabled_(entry) || _isTimedLocked_(entry)) return entry;

    const now = _nowText_();

    const pair = _sanitizeKeyPair_(matchedKeyHash, entry.userKeyCurrentHash || entry.userKeyPrevHash || '');

    const updates = {
      user_key_current_hash: pair.current,
      user_key_prev_hash: pair.previous,
      last_rotated_at: now,
      last_seen_at: now,
      failed_attempts: 0,
      locked_until_ms: 0
    };

    const updated = _updateEntryFields_(entry.sheetRow, updates) || Object.assign({}, entry, updates);

    _clearLockoutMeta_(updated);

    updated.source = 'ACCESS-user-key-rotated';
    updated.matchedBy = 'user_key_prev_hash';

    _auditKeyRotation_(updated, {
      matchedBy: 'user_key_prev_hash',
      lastRotatedAt: now
    });

    return updated;
  }

  function _sanitizeKeyPair_(currentKeyHash, previousKeyHash) {
    const current = normalizeStoredHash_(currentKeyHash);
    let previous = normalizeStoredHash_(previousKeyHash);
    if (current && previous && current === previous) previous = '';
    return { current: current, previous: previous };
  }

  function _auditKeyRotation_(entry, payload) {
    try {
      if (typeof Stage7AuditTrail_ !== 'object' || typeof Stage7AuditTrail_.record !== 'function') return;
      Stage7AuditTrail_.record({
        timestamp: new Date(),
        operationId: typeof stage7UniqueId_ === 'function' ? stage7UniqueId_('access_key_rotation') : String(Date.now()),
        scenario: 'access.user_key_rotation',
        level: 'AUDIT',
        status: 'COMMITTED',
        initiator: 'access-control',
        dryRun: false,
        partial: false,
        affectedSheets: [ACCESS_SHEET],
        affectedEntities: [
          String(entry && entry.email || ''),
          String(entry && entry.displayName || ''),
          String(entry && entry.personCallsign || '')
        ].filter(Boolean),
        payload: payload || {},
        message: 'User key rotated and promoted from previous to current'
      });
    } catch (e) {
      Logger.log('[AccessControl] audit key rotation error: ' + (e && e.message ? e.message : String(e)));
    }
  }
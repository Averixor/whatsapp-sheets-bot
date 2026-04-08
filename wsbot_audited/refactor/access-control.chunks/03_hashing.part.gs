  // ==================== HASHING ====================

  function hashRawUserKey_(rawKey) {
    const raw = String(rawKey || '').trim();
    if (!raw) return '';
    try {
      const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw);
      return hash.map(function (byte) {
        return ('0' + (byte & 0xFF).toString(16)).slice(-2);
      }).join('');
    } catch (e) {
      Logger.log('[AccessControl] Hash error: ' + e.message);
      return '';
    }
  }

  function maskSensitiveValue_(value) {
    const key = String(value || '').trim();
    if (!key) return '';
    if (key.length <= 10) return key;
    return key.slice(0, 6) + '…' + key.slice(-4);
  }

  function getCurrentRawUserKey_() {
    try {
      return String(Session.getTemporaryActiveUserKey() || '').trim();
    } catch (_) {
      return '';
    }
  }

  function getCurrentUserKeyHash_() {
    const raw = getCurrentRawUserKey_();
    return raw ? hashRawUserKey_(raw) : '';
  }

  function safeGetUserEmail_() {
    const candidates = [];
    try { candidates.push(Session.getActiveUser().getEmail()); } catch (_) { }
    try { candidates.push(Session.getEffectiveUser().getEmail()); } catch (_) { }

    for (let i = 0; i < candidates.length; i++) {
      const normalized = normalizeEmail_(candidates[i]);
      if (normalized && normalized.indexOf('@') !== -1) return normalized;
    }
    return '';
  }


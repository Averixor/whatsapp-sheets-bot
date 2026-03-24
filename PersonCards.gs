/**
 * OperationSafety.gs — Stage 6A safety helpers for write-scenario hardening.
 */

const Stage6ASafety_ = (function() {
  const PREFIX = 'STAGE6A:SAFETY:';

  function _props() {
    return PropertiesService.getDocumentProperties();
  }

  function _stable(value) {
    if (value === null || value === undefined) return null;
    if (Array.isArray(value)) return value.map(_stable);
    if (Object.prototype.toString.call(value) === '[object Date]') return value.toISOString();
    if (typeof value === 'object') {
      const out = {};
      Object.keys(value).sort().forEach(function(key) {
        out[key] = _stable(value[key]);
      });
      return out;
    }
    return value;
  }

  function _digest(text) {
    const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text || ''));
    return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/g, '').slice(0, 32);
  }

  function _rows(value) {
    return [...new Set(stage4AsArray_(value).map(Number).filter(Number.isFinite))].sort(function(a, b) { return a - b; });
  }

  function canonicalizePayload(scenario, payload) {
    const input = payload || {};
    switch (String(scenario || '')) {
      case 'generateSendPanelForDate':
        return { date: String(input.dateStr || input.date || ''), dryRun: !!input.dryRun };
      case 'generateSendPanelForRange':
        return { startDate: String(input.startDate || input.dateFrom || ''), endDate: String(input.endDate || input.dateTo || ''), dryRun: !!input.dryRun };
      case 'markPanelRowsAsSent':
      case 'markPanelRowsAsUnsent':
        return { rows: _rows(input.rowNumbers), dryRun: !!input.dryRun };
      case 'sendPendingRows':
        return { limit: Number(input.limit || 0), dryRun: !!input.dryRun };
      case 'createNextMonth':
        return { sourceMonth: String(input.sourceMonth || getBotMonthSheetName_() || ''), switchToNewMonth: input.switchToNewMonth !== false, dryRun: !!input.dryRun };
      case 'runReconciliation':
        return {
          mode: String(input.mode || 'check'),
          date: String(input.dateStr || input.date || ''),
          issueTypes: [...new Set(stage4AsArray_(input.issueTypes).map(String))].sort(),
          limit: Number(input.limit || 0),
          dryRun: !!input.dryRun
        };
      case 'runMaintenanceScenario':
        return { type: String(input.type || 'quick'), functionName: String(input.functionName || ''), month: String(input.month || ''), dryRun: !!input.dryRun };
      default:
        return _stable(input);
    }
  }

  function buildFingerprint(scenario, payload) {
    return _digest(JSON.stringify({ scenario: String(scenario || ''), payload: canonicalizePayload(scenario, payload) }));
  }

  function _activeKey(scenario, fingerprint) {
    return [PREFIX, 'ACTIVE', String(scenario || ''), String(fingerprint || '')].join(':');
  }

  function _recentKey(scenario, fingerprint) {
    return [PREFIX, 'RECENT', String(scenario || ''), String(fingerprint || '')].join(':');
  }

  function _ttlMs(ttlSec) {
    return Math.max(Number(ttlSec || STAGE4_CONFIG.IDEMPOTENCY_TTL_SEC || 21600), 1) * 1000;
  }

  function _readJson(key) {
    const raw = _props().getProperty(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function _removeIfExpired(key, ttlMs) {
    const current = _readJson(key);
    if (!current) return null;
    const age = Date.now() - Number(current.ts || 0);
    if (age > ttlMs) {
      _props().deleteProperty(key);
      return null;
    }
    return current;
  }

  function begin(spec) {
    const cfg = spec || {};
    const scenario = String(cfg.scenario || 'unknownScenario');
    const dryRun = !!cfg.dryRun;
    const fingerprint = String(cfg.fingerprint || buildFingerprint(scenario, cfg.payload || {}));
    const ttlMs = _ttlMs(cfg.ttlSec);
    const activeKey = _activeKey(scenario, fingerprint);
    const recentKey = _recentKey(scenario, fingerprint);

    if (dryRun) {
      return {
        suppressed: false,
        fingerprint: fingerprint,
        reason: null,
        activeKey: activeKey,
        recentKey: recentKey,
        dryRun: true
      };
    }

    const recent = _removeIfExpired(recentKey, ttlMs);
    if (recent && recent.status === 'SUCCESS') {
      return {
        suppressed: true,
        fingerprint: fingerprint,
        reason: 'duplicate_recent_success',
        previous: recent,
        activeKey: activeKey,
        recentKey: recentKey,
        dryRun: false
      };
    }

    const active = _removeIfExpired(activeKey, ttlMs);
    if (active) {
      return {
        suppressed: true,
        fingerprint: fingerprint,
        reason: 'duplicate_active_execution',
        previous: active,
        activeKey: activeKey,
        recentKey: recentKey,
        dryRun: false
      };
    }

    _props().setProperty(activeKey, JSON.stringify({
      scenario: scenario,
      operationId: String(cfg.operationId || ''),
      fingerprint: fingerprint,
      status: 'ACTIVE',
      ts: Date.now(),
      startedAt: stage4NowIso_()
    }));

    return {
      suppressed: false,
      fingerprint: fingerprint,
      reason: null,
      activeKey: activeKey,
      recentKey: recentKey,
      dryRun: false
    };
  }

  function finish(spec) {
    const cfg = spec || {};
    const scenario = String(cfg.scenario || 'unknownScenario');
    const fingerprint = String(cfg.fingerprint || buildFingerprint(scenario, cfg.payload || {}));
    const dryRun = !!cfg.dryRun;
    const activeKey = _activeKey(scenario, fingerprint);
    const recentKey = _recentKey(scenario, fingerprint);

    try {
      _props().deleteProperty(activeKey);
    } catch (_) {}

    if (dryRun) return;

    const payload = {
      scenario: scenario,
      operationId: String(cfg.operationId || ''),
      fingerprint: fingerprint,
      status: String(cfg.status || 'SUCCESS'),
      ts: Date.now(),
      finishedAt: stage4NowIso_(),
      appliedChangesCount: Number(cfg.appliedChangesCount || 0),
      skippedChangesCount: Number(cfg.skippedChangesCount || 0),
      partial: !!cfg.partial,
      message: String(cfg.message || '')
    };

    _props().setProperty(recentKey, JSON.stringify(payload));
  }

  function buildSuppressedMeta(spec) {
    const cfg = spec || {};
    return {
      fingerprint: String(cfg.fingerprint || ''),
      reason: String(cfg.reason || 'duplicate'),
      previousOperationId: cfg.previous && cfg.previous.operationId ? String(cfg.previous.operationId) : '',
      previousFinishedAt: cfg.previous && cfg.previous.finishedAt ? String(cfg.previous.finishedAt) : ''
    };
  }

  return {
    canonicalizePayload: canonicalizePayload,
    buildFingerprint: buildFingerprint,
    begin: begin,
    finish: finish,
    buildSuppressedMeta: buildSuppressedMeta
  };
})();
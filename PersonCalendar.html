/**
 * OperationRepository.gs — Stage 7 sheet-backed operation lifecycle repository.
 *
 * Source of truth for recoverable state:
 * - OPS_LOG
 * - ACTIVE_OPERATIONS
 * - CHECKPOINTS
 */

const OperationRepository_ = (function() {
  const SHEETS = Object.freeze({
    OPS: appGetCore('OPS_LOG_SHEET', 'OPS_LOG'),
    ACTIVE: appGetCore('ACTIVE_OPERATIONS_SHEET', 'ACTIVE_OPERATIONS'),
    CHECKPOINTS: appGetCore('CHECKPOINTS_SHEET', 'CHECKPOINTS')
  });

  const OPS_HEADERS = Object.freeze([
    'TimestampStarted', 'TimestampFinished', 'OperationId', 'ParentOperationId', 'Scenario', 'RawScenario',
    'Initiator', 'RunSource', 'Status', 'Fingerprint', 'AffectedRows', 'AffectedEntities',
    'VerificationResult', 'RepairNeeded', 'ErrorMessage', 'TransitionReason', 'Notes',
    'ResolvedByOperationId', 'ResolvedAt', 'ResolutionStatus', 'LastHeartbeat', 'ExpiresAt',
    'PayloadJson', 'ResultJson', 'CheckpointCount'
  ]);

  const ACTIVE_HEADERS = Object.freeze([
    'OperationId', 'Scenario', 'Fingerprint', 'Status', 'StartedAt', 'LastHeartbeat',
    'Initiator', 'RunSource', 'ExpiresAt', 'LockHolder', 'ParentOperationId', 'Notes', 'PayloadJson'
  ]);

  const CHECKPOINT_HEADERS = Object.freeze([
    'OperationId', 'CheckpointIndex', 'ProcessedUpTo', 'LastProcessedEntity', 'LastProcessedRow',
    'CheckpointTimestamp', 'CheckpointPayload', 'VerificationSnapshot'
  ]);

  const FINAL_STATUSES = Object.freeze({ COMMITTED: true, FAILED: true, FAILED_STALE: true, ABANDONED: true, CANCELLED: true });
  const ALLOWED_RESOLUTION_STATUSES = Object.freeze({ RESOLVED_SUCCESS: true, RESOLVED_PARTIAL: true, RESOLVED_FAILED: true });
  const TRANSITIONS = Object.freeze({
    STARTED: Object.freeze({ COMMITTED: true, FAILED: true, FAILED_STALE: true, ABANDONED: true, CANCELLED: true }),
    FAILED: Object.freeze({ NEEDS_REPAIR: true }),
    FAILED_STALE: Object.freeze({ NEEDS_REPAIR: true })
  });

  const TTL_MINUTES = Object.freeze({
    mark_sent: 10,
    mark_unsent: 10,
    reconciliation: 20,
    create_next_month: 10,
    repair: 15,
    panel_regenerate: 12,
    panel_sync: 12,
    restart_bot: 10,
    __DEFAULT__: 12
  });

  function _ss() { return SpreadsheetApp.getActive(); }
  function _tz() { return (typeof getTimeZone_ === 'function' ? getTimeZone_() : Session.getScriptTimeZone()) || Session.getScriptTimeZone(); }
  function _now() { return new Date(); }
  function _fmt(date, pattern) { return Utilities.formatDate(date instanceof Date ? date : new Date(date), _tz(), pattern); }
  function _iso(date) { return _fmt(date || _now(), "yyyy-MM-dd'T'HH:mm:ss"); }
  function _noteStamp() { return _fmt(_now(), 'yyyy-MM-dd HH:mm:ss'); }
  function _safeJson(value) { return stage4SafeStringify_(value === undefined ? null : value, 50000); }
  function _parseJson(value, fallback) {
    try { return value ? JSON.parse(value) : (fallback === undefined ? null : fallback); } catch (_) { return fallback === undefined ? null : fallback; }
  }
  function _string(value) { return value === null || value === undefined ? '' : String(value); }
  function _bool(value) { return value === true || String(value).toLowerCase() === 'true'; }
  function _uniqueStrings(list) {
    return Array.from(new Set(stage4AsArray_(list).filter(function(item) { return item !== null && item !== undefined && item !== ''; }).map(function(item) { return String(item); })));
  }
  function _uniqueNumbers(list) {
    return Array.from(new Set(stage4AsArray_(list).map(Number).filter(function(item) { return isFinite(item); }))).sort(function(a, b) { return a - b; });
  }

  function _sheet(name, headers) {
    var ss = _ss();
    var sh = ss.getSheetByName(name);
    if (!sh) {
      sh = ss.insertSheet(name);
      sh.getRange(1, 1, 1, headers.length).setValues([headers.slice()]);
      sh.setFrozenRows(1);
    }
    return sh;
  }

  function ensureServiceSheets() {
    return {
      ops: _sheet(SHEETS.OPS, OPS_HEADERS).getName(),
      active: _sheet(SHEETS.ACTIVE, ACTIVE_HEADERS).getName(),
      checkpoints: _sheet(SHEETS.CHECKPOINTS, CHECKPOINT_HEADERS).getName()
    };
  }

  function _headerMap(sheet) {
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] || [];
    var map = {};
    headers.forEach(function(name, idx) { map[String(name)] = idx + 1; });
    return map;
  }

  function _rowsAsObjects(sheet) {
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];
    var map = _headerMap(sheet);
    var values = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
    var headers = Object.keys(map);
    return values.map(function(row, idx) {
      var out = { __row: idx + 2 };
      headers.forEach(function(header) { out[header] = row[map[header] - 1]; });
      return out;
    });
  }

  function _findByOperationId(sheet, operationId) {
    return _rowsAsObjects(sheet).filter(function(item) { return String(item.OperationId || '') === String(operationId || ''); })[0] || null;
  }

  function _updateCell(sheet, row, col, value) {
    if (!row || !col) return;
    sheet.getRange(row, col).setValue(value);
  }

  function _appendRow(sheet, row) {
    sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length).setValues([row]);
  }

  function _rand4() {
    var alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
    var out = '';
    for (var i = 0; i < 4; i++) out += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    return out;
  }

  function _camelToSnake(value) {
    return String(value || '')
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/[^A-Za-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase();
  }

  function canonicalScenario(rawScenario, payload) {
    var raw = String(rawScenario || '').trim();
    var data = payload || {};
    if (data.parentOperationId || data.repairTargetOperationId || data.repairMode) return 'repair';
    if (raw === 'runReconciliation') return 'reconciliation';
    if (raw === 'markPanelRowsAsSent') return 'mark_sent';
    if (raw === 'markPanelRowsAsUnsent') return 'mark_unsent';
    if (raw === 'createNextMonth') return 'create_next_month';
    if (raw === 'generateSendPanelForDate' || raw === 'generateSendPanelForRange') return 'panel_regenerate';
    if (raw === 'sendPendingRows') return 'panel_sync';
    if (raw === 'switchBotToMonth') return 'switch_bot_month';
    if (raw === 'runMaintenanceScenario') {
      var type = _camelToSnake(data.type || 'maintenance');
      if (type === 'repair_pending_operation') return 'repair';
      if (type) return type;
    }
    return _camelToSnake(raw || 'operation');
  }

  function makeOperationId(rawScenario, payload, preferred) {
    var explicit = String(preferred || '').trim();
    if (/^op_[a-z0-9_]+_\d{8}_\d{6}_[a-z0-9]{4}$/i.test(explicit)) return explicit;
    var scenario = canonicalScenario(rawScenario, payload || {});
    return 'op_' + scenario + '_' + _fmt(_now(), 'yyyyMMdd_HHmmss') + '_' + _rand4();
  }

  function _parseDateish(value) {
    var text = String(value || '').trim();
    if (!text) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    var m = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (m) return m[3] + '-' + m[2] + '-' + m[1];
    return null;
  }

  function _normalizeValue(value, key) {
    if (value === null || value === undefined || value === '') return null;
    if (Object.prototype.toString.call(value) === '[object Date]') return _iso(value);
    if (Array.isArray(value)) {
      var normalizedItems = value.map(function(item) { return _normalizeValue(item, key); }).filter(function(item) { return item !== null && item !== undefined; });
      if (!normalizedItems.length) return [];
      if (normalizedItems.every(function(item) { return typeof item === 'number' && isFinite(item); })) {
        return Array.from(new Set(normalizedItems)).sort(function(a, b) { return a - b; });
      }
      if (normalizedItems.every(function(item) { return typeof item === 'string'; })) {
        return Array.from(new Set(normalizedItems.map(function(item) { return String(item).trim().toLowerCase(); }).filter(Boolean))).sort();
      }
      return normalizedItems.sort(function(a, b) { return _stableStringify(a).localeCompare(_stableStringify(b)); });
    }
    if (typeof value === 'object') {
      var out = {};
      Object.keys(value).sort().forEach(function(k) {
        out[k] = _normalizeValue(value[k], k);
      });
      return out;
    }
    if (typeof value === 'string') {
      var trimmed = value.trim();
      if (!trimmed) return null;
      var maybeDate = /date|timestamp|started|finished|heartbeat|expires|resolved/i.test(String(key || '')) ? _parseDateish(trimmed) : _parseDateish(trimmed);
      return maybeDate || trimmed;
    }
    return value;
  }

  function _stableStringify(value) {
    if (value === null || value === undefined) return 'null';
    if (typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return '[' + value.map(_stableStringify).join(',') + ']';
    return '{' + Object.keys(value).sort().map(function(k) { return JSON.stringify(k) + ':' + _stableStringify(value[k]); }).join(',') + '}';
  }

  function buildFingerprint(rawScenario, payload) {
    var scenario = canonicalScenario(rawScenario, payload || {});
    var normalized = _normalizeValue(payload || {}, 'payload');
    var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, _stableStringify({ scenario: scenario, payload: normalized }));
    return Utilities.base64EncodeWebSafe(digest).replace(/=+$/g, '').slice(0, 32);
  }

  function ttlMinutesFor(rawScenario, payload) {
    var scenario = canonicalScenario(rawScenario, payload || {});
    return Number(TTL_MINUTES[scenario] || TTL_MINUTES.__DEFAULT__ || 12);
  }

  function _expiresAtText(rawScenario, payload, startedAt) {
    var date = startedAt instanceof Date ? startedAt : _now();
    return _iso(new Date(date.getTime() + ttlMinutesFor(rawScenario, payload) * 60 * 1000));
  }

  function _findDuplicateInActive(rawScenario, fingerprint, operationId) {
    var sheet = _sheet(SHEETS.ACTIVE, ACTIVE_HEADERS);
    var nowMs = _now().getTime();
    return _rowsAsObjects(sheet).filter(function(item) {
      if (String(item.OperationId || '') === String(operationId || '')) return false;
      if (String(item.Fingerprint || '') !== String(fingerprint || '')) return false;
      if (String(item.Status || '') !== 'STARTED') return false;
      var expiresAt = String(item.ExpiresAt || '').trim();
      if (!expiresAt) return true;
      var ms = new Date(expiresAt).getTime();
      return isFinite(ms) ? ms > nowMs : true;
    })[0] || null;
  }

  function _findRecentCommitted(rawScenario, fingerprint, operationId) {
    var sheet = _sheet(SHEETS.OPS, OPS_HEADERS);
    var maxAgeMs = ttlMinutesFor(rawScenario, {}) * 60 * 1000;
    var nowMs = _now().getTime();
    var rows = _rowsAsObjects(sheet).reverse();
    for (var i = 0; i < rows.length; i++) {
      var item = rows[i];
      if (String(item.OperationId || '') === String(operationId || '')) continue;
      if (String(item.Fingerprint || '') !== String(fingerprint || '')) continue;
      if (String(item.Status || '') !== 'COMMITTED') continue;
      var finished = new Date(String(item.TimestampFinished || item.LastHeartbeat || item.TimestampStarted || '')).getTime();
      if (isFinite(finished) && (nowMs - finished) <= maxAgeMs) return item;
    }
    return null;
  }

  function beginExecution(spec) {
    var cfg = spec || {};
    ensureServiceSheets();
    var startedAt = _now();
    var rawScenario = String(cfg.rawScenario || cfg.scenario || 'operation');
    var payload = cfg.payload || {};
    var canonical = canonicalScenario(rawScenario, payload);
    var operationId = makeOperationId(rawScenario, payload, cfg.operationId);
    var fingerprint = String(cfg.fingerprint || buildFingerprint(rawScenario, payload));
    var initiator = String(cfg.initiator || 'manual');
    var runSource = String(cfg.runSource || cfg.source || initiator || 'manual');
    var parentOperationId = String(cfg.parentOperationId || payload.parentOperationId || '');

    if (!cfg.dryRun) {
      var duplicateActive = _findDuplicateInActive(rawScenario, fingerprint, operationId);
      if (duplicateActive) {
        return { suppressed: true, reason: 'duplicate_active_execution', previous: duplicateActive, operationId: operationId, fingerprint: fingerprint, scenario: canonical };
      }
      var recentCommitted = _findRecentCommitted(rawScenario, fingerprint, operationId);
      if (recentCommitted) {
        return { suppressed: true, reason: 'duplicate_recent_success', previous: recentCommitted, operationId: operationId, fingerprint: fingerprint, scenario: canonical };
      }

      var startedText = _iso(startedAt);
      var expiresAt = _expiresAtText(rawScenario, payload, startedAt);
      _appendRow(_sheet(SHEETS.OPS, OPS_HEADERS), [
        startedText, '', operationId, parentOperationId, canonical, rawScenario,
        initiator, runSource, 'STARTED', fingerprint, '', '', '', false, '', 'preflight-started', '', '', '', '', startedText, expiresAt,
        _safeJson(payload), '', 0
      ]);
      _appendRow(_sheet(SHEETS.ACTIVE, ACTIVE_HEADERS), [
        operationId, canonical, fingerprint, 'STARTED', startedText, startedText,
        initiator, runSource, expiresAt, String(cfg.lockHolder || ''), parentOperationId, '', _safeJson(payload)
      ]);
    }

    return {
      suppressed: false,
      operationId: operationId,
      fingerprint: fingerprint,
      scenario: canonical,
      rawScenario: rawScenario,
      startedAt: _iso(startedAt),
      expiresAt: _expiresAtText(rawScenario, payload, startedAt),
      parentOperationId: parentOperationId
    };
  }

  function _updateActiveRow(operationId, updates) {
    var sheet = _sheet(SHEETS.ACTIVE, ACTIVE_HEADERS);
    var row = _findByOperationId(sheet, operationId);
    if (!row) return null;
    var map = _headerMap(sheet);
    Object.keys(updates || {}).forEach(function(key) {
      if (map[key]) _updateCell(sheet, row.__row, map[key], updates[key]);
    });
    return _findByOperationId(sheet, operationId);
  }

  function _removeActiveRow(operationId) {
    var sheet = _sheet(SHEETS.ACTIVE, ACTIVE_HEADERS);
    var row = _findByOperationId(sheet, operationId);
    if (row && row.__row >= 2) sheet.deleteRow(row.__row);
    return !!row;
  }

  function _updateOpsRow(operationId, updates) {
    var sheet = _sheet(SHEETS.OPS, OPS_HEADERS);
    var row = _findByOperationId(sheet, operationId);
    if (!row) return null;
    var map = _headerMap(sheet);
    Object.keys(updates || {}).forEach(function(key) {
      if (map[key]) _updateCell(sheet, row.__row, map[key], updates[key]);
    });
    return _findByOperationId(sheet, operationId);
  }

  function heartbeat(operationId, reason, extra) {
    var current = _getOperationRow(operationId);
    if (!current) return null;
    if (FINAL_STATUSES[String(current.Status || '')]) return current;
    var nowText = _iso(_now());
    var updates = Object.assign({
      LastHeartbeat: nowText,
      ExpiresAt: _expiresAtText(current.RawScenario || current.Scenario || '', _parseJson(current.PayloadJson, {}), _now())
    }, extra || {});
    _updateOpsRow(operationId, updates);
    _updateActiveRow(operationId, {
      LastHeartbeat: updates.LastHeartbeat,
      ExpiresAt: updates.ExpiresAt,
      Status: String(current.Status || 'STARTED')
    });
    return _getOperationRow(operationId);
  }

  function _appendNoteText(existing, text, source) {
    var prefix = '[' + _noteStamp() + '][' + String(source || 'system') + '] ';
    var base = String(existing || '').trim();
    var next = prefix + String(text || '').trim();
    return base ? (base + '\n' + next) : next;
  }

  function appendNote(operationId, text, source) {
    var current = _getOperationRow(operationId);
    if (!current) throw new Error('Операцію не знайдено: ' + operationId);
    var noteText = String(text || '').trim();
    if (!noteText) return current;
    var notes = _appendNoteText(current.Notes, noteText, source || 'system');
    _updateOpsRow(operationId, { Notes: notes });
    _updateActiveRow(operationId, { Notes: notes });
    return _getOperationRow(operationId);
  }

  function _allowedTransition(fromStatus, toStatus) {
    var from = String(fromStatus || '').trim();
    var to = String(toStatus || '').trim();
    if (from === to) return true;
    return !!(TRANSITIONS[from] && TRANSITIONS[from][to]);
  }

  function transitionStatus(operationId, newStatus, reason, extra) {
    var current = _getOperationRow(operationId);
    if (!current) throw new Error('Операцію не знайдено: ' + operationId);
    var fromStatus = String(current.Status || '');
    var toStatus = String(newStatus || '').trim();
    var allowed = _allowedTransition(fromStatus, toStatus);
    if (FINAL_STATUSES[fromStatus] && !allowed) {
      throw new Error('Фінальний запис заморожено і не може змінювати статус: ' + fromStatus);
    }
    if (!allowed) {
      throw new Error('Недозволений перехід статусу: ' + fromStatus + ' -> ' + toStatus);
    }

    var updates = Object.assign({}, extra || {}, {
      Status: toStatus,
      TransitionReason: String(reason || extra && extra.TransitionReason || ''),
      LastHeartbeat: _iso(_now())
    });

    if (FINAL_STATUSES[toStatus]) {
      updates.TimestampFinished = updates.TimestampFinished || _iso(_now());
    }

    _updateOpsRow(operationId, updates);

    if (toStatus === 'FAILED_STALE') {
      _updateActiveRow(operationId, {
        Status: toStatus,
        LastHeartbeat: updates.LastHeartbeat,
        ExpiresAt: updates.ExpiresAt || current.ExpiresAt || ''
      });
    } else if (FINAL_STATUSES[toStatus] || toStatus === 'NEEDS_REPAIR') {
      _removeActiveRow(operationId);
    } else {
      _updateActiveRow(operationId, {
        Status: toStatus,
        LastHeartbeat: updates.LastHeartbeat,
        ExpiresAt: updates.ExpiresAt || current.ExpiresAt || ''
      });
    }

    return _getOperationRow(operationId);
  }

  function _classifyVerification(verification) {
    if (!verification) return 'OK';
    if (String(verification.result || '').trim()) return String(verification.result).trim().toUpperCase();
    if (verification.ok === false) return 'FAILED';
    if (verification.partial === true) return 'PARTIAL';
    if (stage4AsArray_(verification.warnings).length) return 'WARNING';
    return 'OK';
  }

  function _extractAffectedRows(payload, result) {
    var rows = [];
    var input = payload || {};
    if (Array.isArray(input.rowNumbers)) rows = rows.concat(input.rowNumbers);
    if (Array.isArray(input.rows)) rows = rows.concat(input.rows);
    if (result && Array.isArray(result.updatedRows)) rows = rows.concat(result.updatedRows);
    return _uniqueNumbers(rows).join(', ');
  }

  function _extractAffectedEntities(payload, execution) {
    var entities = [];
    if (execution && Array.isArray(execution.affectedEntities)) entities = entities.concat(execution.affectedEntities);
    if (payload && Array.isArray(payload.callsigns)) entities = entities.concat(payload.callsigns);
    return _uniqueStrings(entities).join(', ');
  }

  function finalizeSuccessfulExecution(spec) {
    var cfg = spec || {};
    if (cfg.dryRun) return null;
    var verificationResult = _classifyVerification(cfg.verification);
    var status = cfg.success === false ? 'FAILED' : (verificationResult === 'FAILED' ? 'FAILED' : 'COMMITTED');
    var repairNeeded = !!cfg.repairNeeded || status === 'FAILED' || verificationResult === 'PARTIAL';
    return transitionStatus(cfg.operationId, status, cfg.transitionReason || (status === 'COMMITTED' ? 'write-verified' : 'write-or-verify-failed'), {
      AffectedRows: _extractAffectedRows(cfg.payload || {}, cfg.result || {}),
      AffectedEntities: _extractAffectedEntities(cfg.payload || {}, cfg.execution || {}),
      VerificationResult: verificationResult,
      RepairNeeded: repairNeeded,
      ErrorMessage: status === 'FAILED' ? String(cfg.errorMessage || cfg.message || 'Verification failed') : '',
      ResultJson: _safeJson(cfg.result || null),
      TimestampFinished: _iso(_now())
    });
  }

  function registerFailure(spec) {
    var cfg = spec || {};
    if (cfg.dryRun) return null;
    return transitionStatus(cfg.operationId, 'FAILED', cfg.transitionReason || 'exception', {
      AffectedRows: _extractAffectedRows(cfg.payload || {}, cfg.result || {}),
      AffectedEntities: _extractAffectedEntities(cfg.payload || {}, cfg.execution || {}),
      VerificationResult: cfg.verificationResult || '',
      RepairNeeded: true,
      ErrorMessage: String(cfg.errorMessage || 'Unknown error'),
      ResultJson: _safeJson(cfg.result || null),
      TimestampFinished: _iso(_now())
    });
  }

  function saveCheckpoint(spec) {
    var cfg = spec || {};
    if (!cfg.operationId) throw new Error('Checkpoint requires operationId');
    var payloadJson = _safeJson(cfg.checkpointPayload || cfg.payload || null);
    var verificationSnapshot = _safeJson(cfg.verificationSnapshot || null);
    var checkpointTimestamp = _iso(_now());
    _appendRow(_sheet(SHEETS.CHECKPOINTS, CHECKPOINT_HEADERS), [
      cfg.operationId,
      Number(cfg.checkpointIndex || 0),
      _string(cfg.processedUpTo),
      _string(cfg.lastProcessedEntity),
      _string(cfg.lastProcessedRow),
      checkpointTimestamp,
      payloadJson,
      verificationSnapshot
    ]);
    var current = _getOperationRow(cfg.operationId);
    var nextCount = Number(current && current.CheckpointCount || 0) + 1;
    var payload = current ? _parseJson(current.PayloadJson, {}) : {};
    var expiresAt = _expiresAtText(current && (current.RawScenario || current.Scenario || ''), payload, _now());
    _updateOpsRow(cfg.operationId, { CheckpointCount: nextCount, LastHeartbeat: checkpointTimestamp, ExpiresAt: expiresAt });
    _updateActiveRow(cfg.operationId, { LastHeartbeat: checkpointTimestamp, ExpiresAt: expiresAt, Status: current && current.Status ? String(current.Status) : 'STARTED' });
    return { checkpointCount: nextCount };
  }

  function _getOperationRow(operationId) {
    return _findByOperationId(_sheet(SHEETS.OPS, OPS_HEADERS), operationId);
  }

  function getOperationDetails(operationId) {
    var entry = _getOperationRow(operationId);
    if (!entry) return null;
    var checkpoints = _rowsAsObjects(_sheet(SHEETS.CHECKPOINTS, CHECKPOINT_HEADERS)).filter(function(item) {
      return String(item.OperationId || '') === String(operationId || '');
    }).sort(function(a, b) { return Number(a.CheckpointIndex || 0) - Number(b.CheckpointIndex || 0); });
    return {
      operation: entry,
      checkpoints: checkpoints,
      payload: _parseJson(entry.PayloadJson, {}),
      result: _parseJson(entry.ResultJson, null),
      checkpointContext: checkpoints.length ? checkpoints[checkpoints.length - 1] : null
    };
  }

  function listPendingRepairs(filters) {
    var opts = Object.assign({ limit: 100 }, filters || {});
    var items = _rowsAsObjects(_sheet(SHEETS.OPS, OPS_HEADERS)).filter(function(item) {
      var status = String(item.Status || '');
      var wantsRepair = _bool(item.RepairNeeded) || ['FAILED', 'FAILED_STALE', 'NEEDS_REPAIR'].indexOf(status) !== -1;
      if (!wantsRepair) return false;
      if (opts.status && status !== String(opts.status)) return false;
      if (opts.scenario && String(item.Scenario || '') !== String(opts.scenario)) return false;
      if (opts.date && String(item.TimestampStarted || '').indexOf(String(opts.date)) !== 0) return false;
      return true;
    }).sort(function(a, b) {
      return String(b.TimestampStarted || '').localeCompare(String(a.TimestampStarted || ''));
    });

    return {
      operations: items.slice(0, Number(opts.limit || 100)).map(function(item) {
        return {
          operationId: String(item.OperationId || ''),
          parentOperationId: String(item.ParentOperationId || ''),
          scenario: String(item.Scenario || ''),
          rawScenario: String(item.RawScenario || ''),
          startedAt: String(item.TimestampStarted || ''),
          lastHeartbeat: String(item.LastHeartbeat || ''),
          status: String(item.Status || ''),
          errorMessage: String(item.ErrorMessage || ''),
          affectedRows: String(item.AffectedRows || ''),
          initiator: String(item.Initiator || ''),
          fingerprint: String(item.Fingerprint || ''),
          notes: String(item.Notes || ''),
          verificationResult: String(item.VerificationResult || ''),
          resolutionStatus: String(item.ResolutionStatus || '')
        };
      }),
      total: items.length
    };
  }

  function markNeedsRepair(operationId, reason) {
    var current = _getOperationRow(operationId);
    if (!current) throw new Error('Операцію не знайдено: ' + operationId);
    var status = String(current.Status || '');
    if (status === 'NEEDS_REPAIR') return current;
    if (status === 'FAILED' || status === 'FAILED_STALE') {
      return transitionStatus(operationId, 'NEEDS_REPAIR', reason || 'queued-for-repair', { RepairNeeded: true });
    }
    return current;
  }

  function resolveIncident(operationId, resolvedByOperationId, resolutionStatus) {
    var current = _getOperationRow(operationId);
    if (!current) throw new Error('Операцію не знайдено: ' + operationId);
    var status = String(current.Status || '');
    if (['FAILED', 'FAILED_STALE', 'NEEDS_REPAIR'].indexOf(status) === -1) {
      throw new Error('Resolve дозволений тільки для FAILED / FAILED_STALE / NEEDS_REPAIR');
    }
    var resolution = String(resolutionStatus || '').trim();
    if (!ALLOWED_RESOLUTION_STATUSES[resolution]) {
      throw new Error('Недопустимий ResolutionStatus: ' + resolution);
    }
    _updateOpsRow(operationId, {
      ResolvedByOperationId: String(resolvedByOperationId || ''),
      ResolvedAt: _iso(_now()),
      ResolutionStatus: resolution
    });
    return _getOperationRow(operationId);
  }

  function detectStaleOperations() {
    ensureServiceSheets();
    var sheet = _sheet(SHEETS.ACTIVE, ACTIVE_HEADERS);
    var rows = _rowsAsObjects(sheet);
    var nowMs = _now().getTime();
    var stale = [];
    rows.forEach(function(item) {
      if (String(item.Status || '') !== 'STARTED') return;
      var payload = _parseJson(item.PayloadJson, {});
      var ttlMs = ttlMinutesFor(item.Scenario || '', payload) * 60 * 1000;
      var lastHeartbeatMs = new Date(String(item.LastHeartbeat || item.StartedAt || '')).getTime();
      var expiresAtMs = new Date(String(item.ExpiresAt || '')).getTime();
      var heartbeatExpired = isFinite(lastHeartbeatMs) ? (nowMs - lastHeartbeatMs > ttlMs) : false;
      var expiresExpired = isFinite(expiresAtMs) ? expiresAtMs < nowMs : false;
      if (!(heartbeatExpired || expiresExpired)) return;
      var current = _getOperationRow(item.OperationId);
      if (!current || String(current.Status || '') !== 'STARTED') return;
      transitionStatus(item.OperationId, 'FAILED_STALE', 'heartbeat-timeout', {
        VerificationResult: 'FAILED',
        RepairNeeded: true,
        ErrorMessage: 'Marked FAILED_STALE after heartbeat timeout',
        TimestampFinished: _iso(_now())
      });
      appendNote(item.OperationId, 'Marked as FAILED_STALE after heartbeat timeout', 'stale-detector');
      stale.push(item.OperationId);
    });
    return { staleOperations: stale, total: stale.length, checked: rows.length };
  }

  function abandonAllActive(reason, options) {
    ensureServiceSheets();
    var opts = options && typeof options === 'object' ? options : {};
    var excluded = {};
    stage4AsArray_(opts.excludeOperationIds).forEach(function(id) {
      var key = String(id || '').trim();
      if (key) excluded[key] = true;
    });
    if (opts.excludeOperationId) {
      var single = String(opts.excludeOperationId || '').trim();
      if (single) excluded[single] = true;
    }
    var rows = _rowsAsObjects(_sheet(SHEETS.ACTIVE, ACTIVE_HEADERS));
    var updated = [];
    rows.forEach(function(item) {
      var opId = String(item.OperationId || '').trim();
      if (!opId || excluded[opId]) return;
      var current = _getOperationRow(opId);
      if (!current || String(current.Status || '') !== 'STARTED') return;
      transitionStatus(opId, 'ABANDONED', reason || 'manual-abandon', {
        ErrorMessage: 'Abandoned by maintenance flow',
        TimestampFinished: _iso(_now())
      });
      appendNote(opId, 'Marked as ABANDONED by restart/maintenance flow', 'maintenance');
      updated.push(opId);
    });
    return {
      total: updated.length,
      operationIds: updated,
      excludedOperationIds: Object.keys(excluded)
    };
  }

  function runRetentionCleanup() {
    ensureServiceSheets();
    var opsSheet = _sheet(SHEETS.OPS, OPS_HEADERS);
    var activeSheet = _sheet(SHEETS.ACTIVE, ACTIVE_HEADERS);
    var checkpointsSheet = _sheet(SHEETS.CHECKPOINTS, CHECKPOINT_HEADERS);
    var rows = _rowsAsObjects(opsSheet);
    var cutoffDays = Number(appGetCore('OPS_HOT_RETENTION_DAYS', 180) || 180);
    var staleGraceHours = Number(appGetCore('ACTIVE_STALE_GRACE_HOURS', 48) || 48);
    var cutoffMs = _now().getTime() - cutoffDays * 24 * 60 * 60 * 1000;
    var staleCutoffMs = _now().getTime() - staleGraceHours * 60 * 60 * 1000;
    var archived = 0;
    var archivedCheckpoints = 0;
    var removedActiveStale = 0;
    rows.slice().reverse().forEach(function(item) {
      var startedMs = new Date(String(item.TimestampStarted || '')).getTime();
      if (!isFinite(startedMs) || startedMs >= cutoffMs) return;
      var suffix = _fmt(new Date(startedMs), 'yyyy_MM');
      var archiveName = 'OPS_LOG_' + suffix;
      var archiveSheet = _sheet(archiveName, OPS_HEADERS);
      var rowValues = OPS_HEADERS.map(function(header) { return item[header]; });
      _appendRow(archiveSheet, rowValues);

      _rowsAsObjects(checkpointsSheet).slice().reverse().forEach(function(checkpoint) {
        if (String(checkpoint.OperationId || '') !== String(item.OperationId || '')) return;
        var checkpointArchiveName = 'CHECKPOINTS_' + suffix;
        var checkpointArchiveSheet = _sheet(checkpointArchiveName, CHECKPOINT_HEADERS);
        var checkpointRow = CHECKPOINT_HEADERS.map(function(header) { return checkpoint[header]; });
        _appendRow(checkpointArchiveSheet, checkpointRow);
        checkpointsSheet.deleteRow(checkpoint.__row);
        archivedCheckpoints++;
      });

      opsSheet.deleteRow(item.__row);
      archived++;
    });

    _rowsAsObjects(activeSheet).slice().reverse().forEach(function(item) {
      if (String(item.Status || '') !== 'FAILED_STALE') return;
      var classifiedMs = new Date(String(item.LastHeartbeat || item.StartedAt || '')).getTime();
      if (!isFinite(classifiedMs) || classifiedMs >= staleCutoffMs) return;
      activeSheet.deleteRow(item.__row);
      removedActiveStale++;
    });

    return {
      archived: archived,
      archivedCheckpoints: archivedCheckpoints,
      removedActiveStale: removedActiveStale,
      cutoffDays: cutoffDays,
      staleGraceHours: staleGraceHours
    };
  }

  function buildLifecyclePolicyReport() {
    return {
      serviceSheets: [SHEETS.OPS, SHEETS.ACTIVE, SHEETS.CHECKPOINTS],
      ttlScenarios: Object.keys(TTL_MINUTES).length,
      retentionDays: Number(appGetCore('OPS_HOT_RETENTION_DAYS', 180) || 180),
      activeStaleGraceHours: Number(appGetCore('ACTIVE_STALE_GRACE_HOURS', 48) || 48),
      operationIdPattern: 'op_<scenario>_<YYYYMMDD>_<HHMMSS>_<4random>',
      sourceOfTruth: 'sheet-backed'
    };
  }

  function runRepair(operationId, options) {
    var details = getOperationDetails(operationId);
    if (!details || !details.operation) throw new Error('Операцію для repair не знайдено');
    var op = details.operation;
    markNeedsRepair(operationId, 'repair-requested');
    var payload = _parseJson(op.PayloadJson, {});
    var rawScenario = String(op.RawScenario || op.Scenario || '');
    var replayPayload = Object.assign({}, payload, options || {}, {
      operationId: '',
      parentOperationId: operationId,
      repairTargetOperationId: operationId,
      repairMode: true,
      dryRun: !!(options && options.dryRun)
    });

    var result;
    switch (rawScenario) {
      case 'markPanelRowsAsSent':
        result = Stage4UseCases_.markPanelRowsAsSent(payload.rowNumbers || [], replayPayload);
        break;
      case 'markPanelRowsAsUnsent':
        result = Stage4UseCases_.markPanelRowsAsUnsent(payload.rowNumbers || [], replayPayload);
        break;
      case 'sendPendingRows':
        result = Stage4UseCases_.sendPendingRows(replayPayload);
        break;
      case 'createNextMonth':
        result = Stage4UseCases_.createNextMonth(replayPayload);
        break;
      case 'runReconciliation':
        result = Stage4UseCases_.runReconciliation(replayPayload);
        break;
      case 'generateSendPanelForDate':
        result = Stage4UseCases_.generateSendPanelForDate(replayPayload);
        break;
      case 'generateSendPanelForRange':
        result = Stage4UseCases_.generateSendPanelForRange(replayPayload);
        break;
      case 'runMaintenanceScenario':
        result = Stage4UseCases_.runMaintenanceScenario(replayPayload);
        break;
      case 'switchBotToMonth':
        result = Stage4UseCases_.switchBotToMonth(replayPayload);
        break;
      default:
        throw new Error('Repair для сценарію "' + rawScenario + '" ще не реалізовано');
    }

    var newOperationId = result && result.operationId ? result.operationId : (result && result.data && result.data.meta && result.data.meta.operationId || '');
    if (result && result.success) {
      resolveIncident(operationId, newOperationId, result.partial ? 'RESOLVED_PARTIAL' : 'RESOLVED_SUCCESS');
    } else if (newOperationId) {
      resolveIncident(operationId, newOperationId, 'RESOLVED_FAILED');
    }

    return {
      success: !!(result && result.success),
      message: result && (result.message || result.error) || '',
      operationId: newOperationId || '',
      originalOperationId: operationId,
      result: result
    };
  }

  return {
    ensureServiceSheets: ensureServiceSheets,
    canonicalScenario: canonicalScenario,
    makeOperationId: makeOperationId,
    buildFingerprint: buildFingerprint,
    ttlMinutesFor: ttlMinutesFor,
    beginExecution: beginExecution,
    heartbeat: heartbeat,
    saveCheckpoint: saveCheckpoint,
    appendNote: appendNote,
    transitionStatus: transitionStatus,
    finalizeSuccessfulExecution: finalizeSuccessfulExecution,
    registerFailure: registerFailure,
    getOperationDetails: getOperationDetails,
    listPendingRepairs: listPendingRepairs,
    markNeedsRepair: markNeedsRepair,
    resolveIncident: resolveIncident,
    detectStaleOperations: detectStaleOperations,
    abandonAllActive: abandonAllActive,
    runRetentionCleanup: runRetentionCleanup,
    buildLifecyclePolicyReport: buildLifecyclePolicyReport,
    runRepair: runRepair,
    _classifyVerification: _classifyVerification
  };
})();
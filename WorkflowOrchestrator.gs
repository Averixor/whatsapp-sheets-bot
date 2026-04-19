/**
 * WorkflowOrchestrator.gs — lifecycle orchestration for Stage 7 reliability hardening.
 */

function normalizeWorkflowWarning_(item) {
  if (item === null || item === undefined || item === '') return '';

  if (typeof item === 'string') return item;

  if (typeof item === 'object') {
    if (item.message && item.code) return '[' + item.code + '] ' + item.message;
    if (item.message) return String(item.message);
    if (item.text) return String(item.text);
    if (item.code) return String(item.code);

    try {
      return JSON.stringify(item);
    } catch (e) {
      return String(item);
    }
  }

  return String(item);
}

function normalizeWorkflowWarnings_(warnings) {
  if (!Array.isArray(warnings)) return [];

  var out = [];
  warnings.forEach(function(item) {
    var normalized = normalizeWorkflowWarning_(item);
    if (!normalized) return;
    out.push(normalized);
  });

  return Array.from(new Set(out));
}

function mergeWorkflowWarnings_() {
  var merged = [];
  Array.prototype.slice.call(arguments).forEach(function(part) {
    if (!Array.isArray(part)) part = stage7AsArray_(part);
    part.forEach(function(item) {
      var normalized = normalizeWorkflowWarning_(item);
      if (!normalized) return;
      merged.push(normalized);
    });
  });
  return Array.from(new Set(merged));
}

function buildServerResponse_(success, message, error, result, changes, meta, diagnostics, context, warnings) {
  const safeMeta = meta || {};
  const safeDiagnostics = diagnostics || null;
  const normalizedWarnings = normalizeWorkflowWarnings_(warnings);

  return {
    success: !!success,
    message: String(message || ''),
    error: error ? String(error) : null,
    data: {
      result: result === undefined ? null : result,
      changes: Array.isArray(changes) ? changes : [],
      meta: safeMeta,
      diagnostics: safeDiagnostics
    },
    context: context || null,
    warnings: normalizedWarnings,
    operationId: safeMeta.operationId || null,
    scenario: safeMeta.scenario || (context && context.scenario) || null,
    dryRun: !!safeMeta.dryRun,
    affectedSheets: stage7AsArray_(safeMeta.affectedSheets),
    affectedEntities: stage7AsArray_(safeMeta.affectedEntities),
    appliedChangesCount: Number(safeMeta.appliedChangesCount || 0),
    skippedChangesCount: Number(safeMeta.skippedChangesCount || 0),
    partial: !!safeMeta.partial,
    retrySafe: safeMeta.retrySafe !== false,
    lockUsed: !!safeMeta.lockUsed,
    lockRequired: !!safeMeta.lockRequired,
    diagnostics: safeDiagnostics
  };
}

const WorkflowOrchestrator_ = (function() {
  function _safeAccessDescriptor() {
    try {
      if (typeof AccessControl_ === 'object' && AccessControl_ && typeof AccessControl_.describe === 'function') {
        return AccessControl_.describe() || null;
      }
    } catch (_) {}
    return null;
  }

  function _cleanText(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  function _maskKey(value) {
    const key = _cleanText(value);
    if (!key) return '';
    if (key.length <= 10) return key;
    return key.slice(0, 6) + '…' + key.slice(-4);
  }

  function _compactJson(value) {
    try {
      const json = JSON.stringify(value == null ? null : value);
      return json.length > 240 ? (json.slice(0, 237) + '...') : json;
    } catch (_) {
      return '';
    }
  }

  function _buildInitiator(payload, descriptor) {
    if (payload && payload.initiator) return String(payload.initiator);
    if (payload && payload.trigger) return 'trigger';

    const parts = [];
    const d = descriptor || null;
    if (d) {
      const displayName = _cleanText(d.displayName);
      const email = _cleanText(d.email);
      const callsign = _cleanText(d.personCallsign);
      const role = _cleanText(d.role);
      const key = _cleanText(d.currentKeyHashMasked || '');

      if (displayName) parts.push(displayName);
      if (email && parts.indexOf(email) === -1) parts.push(email);
      if (callsign) parts.push('callsign:' + callsign);
      if (role) parts.push('role:' + role);
      if (key) parts.push('key:' + key);
    }

    if (!parts.length) {
      const fallbackEmail =
        (typeof Session !== 'undefined' && Session && typeof Session.getActiveUser === 'function')
          ? _cleanText(Session.getActiveUser().getEmail && Session.getActiveUser().getEmail())
          : '';

      if (fallbackEmail) parts.push(fallbackEmail);
    }

    return parts.length ? parts.join(' | ') : 'manual';
  }

  function _buildRunSource(cfg, payload, route, rawScenario) {
    if (payload && payload.source) return String(payload.source);
    if (payload && payload.trigger) return 'trigger';

    const parts = [];
    if (route && route.routeName) parts.push('route:' + route.routeName);
    if (route && route.publicApiMethod) parts.push('api:' + route.publicApiMethod);
    if (cfg && cfg.publicApiMethod && (!route || cfg.publicApiMethod !== route.publicApiMethod)) {
      parts.push('api:' + cfg.publicApiMethod);
    }
    if (cfg && cfg.routeName && (!route || cfg.routeName !== route.routeName)) {
      parts.push('route:' + cfg.routeName);
    }
    if (rawScenario) parts.push('scenario:' + rawScenario);

    return parts.length ? parts.join(' | ') : 'manual';
  }

  function _buildStartNote(rawScenario, payload, route, initiator, runSource) {
    const action = _cleanText(rawScenario || 'operation');
    const params = [];

    ['date', 'month', 'fromDate', 'toDate', 'row', 'rowNumber'].forEach(function(key) {
      if (payload && payload[key] !== undefined && payload[key] !== null && String(payload[key]).trim() !== '') {
        params.push(key + '=' + String(payload[key]).trim());
      }
    });

    if (payload && Array.isArray(payload.rowNumbers) && payload.rowNumbers.length) {
      params.push('rows=' + payload.rowNumbers.join(','));
    }

    if (payload && payload.dryRun) params.push('dryRun=true');

    const sourceLabel = route && route.routeName ? route.routeName : runSource;
    let note = 'started ' + action + ' via ' + _cleanText(sourceLabel || 'manual') + ' by ' + _cleanText(initiator || 'manual');

    const payloadPreview = _compactJson(payload);
    if (params.length) {
      note += ' [' + params.join(', ') + ']';
    } else if (payloadPreview && payloadPreview !== '{}' && payloadPreview !== 'null') {
      note += ' [payload=' + payloadPreview + ']';
    }

    return note;
  }

  function _acquireLock(lockRequired, timeoutMs) {
    if (!lockRequired) return null;
    const lock = LockService.getDocumentLock();
    lock.waitLock(Math.max(Number(timeoutMs) || STAGE7_CONFIG.LOCK_TIMEOUT_MS, 1000));
    return lock;
  }

  function _releaseLock(lock) {
    if (!lock) return;
    try {
      lock.releaseLock();
    } catch (_) {}
  }

  function _routeDescriptor(cfg, scenario) {
    if (cfg && cfg.routeName && typeof getRoutingRouteByName_ === 'function') {
      return getRoutingRouteByName_(cfg.routeName);
    }
    if (cfg && cfg.publicApiMethod && typeof getRoutingRouteByApiMethod_ === 'function') {
      return getRoutingRouteByApiMethod_(cfg.publicApiMethod);
    }
    return null;
  }

  function _resolveLockScope(cfg, scenario) {
    const explicit = _cleanText(cfg && cfg.lockScope);
    if (explicit === 'execute' || explicit === 'workflow') return explicit;

    switch (String(scenario || '')) {
      case 'markPanelRowsAsSent':
      case 'markPanelRowsAsUnsent':
        return 'execute';
      default:
        return 'workflow';
    }
  }


  function _buildDuplicateResponse_(scenario, operationId, dryRun, route, lock, lockRequired, startedAt, diagnostics, context, warnings, lifecycle) {
    const previous = lifecycle && lifecycle.previous || {};
    const safeWarnings = mergeWorkflowWarnings_(
      warnings,
      ['Сценарій уже виконувався або щойно був успішно завершений']
    );

    const meta = {
      stage: STAGE7_CONFIG.VERSION,
      hardeningStage: '7',
      scenario: scenario,
      operationId: operationId,
      route: route,
      affectedSheets: [],
      affectedEntities: [],
      appliedChangesCount: 0,
      skippedChangesCount: 1,
      dryRun: dryRun,
      partial: false,
      retrySafe: false,
      lockUsed: !!lock,
      lockRequired: !!lockRequired,
      durationMs: new Date().getTime() - startedAt.getTime(),
      lifecycle: lifecycle ? {
        fingerprint: lifecycle.fingerprint || '',
        reason: lifecycle.reason || ''
      } : null,
      idempotency: {
        fingerprint: lifecycle && lifecycle.fingerprint || '',
        reason: lifecycle && lifecycle.reason || '',
        previousOperationId: previous && previous.OperationId ? String(previous.OperationId) : '',
        previousFinishedAt: previous && previous.TimestampFinished ? String(previous.TimestampFinished) : ''
      }
    };

    return buildServerResponse_(
      true,
      'Повторний запуск безпечно подавлено',
      null,
      null,
      [],
      meta,
      diagnostics,
      context,
      safeWarnings
    );
  }

  function run(spec) {
    const cfg = spec || {};
    const rawScenario = String(cfg.scenario || 'unknownScenario');
    let payload = Object.assign({}, cfg.payload || {});
    const startedAt = new Date();
    const warnings = [];
    const diagnostics = {
      stage: STAGE7_CONFIG.VERSION,
      hardeningStage: '7',
      scenario: rawScenario,
      startedAt: startedAt.toISOString(),
      lifecycle: []
    };

    const dryRun = !!payload.dryRun;
    const route = _routeDescriptor(cfg, rawScenario);
    const lockRequired = cfg.lock !== false && !!cfg.write;
    const lockScope = _resolveLockScope(cfg, rawScenario);
    const retrySafe = cfg.retrySafe !== false;

    let operationId = (typeof OperationRepository_ === 'object')
      ? OperationRepository_.makeOperationId(rawScenario, payload, payload.operationId)
      : String(payload.operationId || stage7UniqueId_(rawScenario));

    let context = Object.assign({
      stage: STAGE7_CONFIG.VERSION,
      hardeningStage: diagnostics.hardeningStage,
      scenario: rawScenario,
      operationId: operationId,
      dryRun: dryRun,
      routeName: route && route.routeName ? route.routeName : '',
      publicApiMethod: route && route.publicApiMethod ? route.publicApiMethod : ''
    }, cfg.context || {});

    let lock = null;
    let lockUsed = false;
    let beforeState = null;
    let plan = null;
    let execution = null;
    let sync = null;
    let verification = null;
    let lifecycle = null;

    try {
      diagnostics.lifecycle.push('payload.accepted');

      if (typeof cfg.validate === 'function') {
        const validated = cfg.validate(payload, context) || {};

        if (validated.payload && typeof validated.payload === 'object') {
          payload = validated.payload;
        }

        warnings.push.apply(warnings, mergeWorkflowWarnings_(validated.warnings));
        diagnostics.lifecycle.push('payload.validated');
      }

      operationId = (typeof OperationRepository_ === 'object')
        ? OperationRepository_.makeOperationId(rawScenario, payload, payload.operationId)
        : operationId;

      context.operationId = operationId;

      if (lockRequired && lockScope === 'workflow') {
        lock = _acquireLock(true, cfg.lockTimeoutMs);
        diagnostics.lock = !!lock;
        diagnostics.lockRequired = !!lockRequired;
        diagnostics.lockScope = lockScope;
        lockUsed = !!lock;

        if (lock) diagnostics.lifecycle.push('lock.acquired');
      } else {
        diagnostics.lock = false;
        diagnostics.lockRequired = !!lockRequired;
        diagnostics.lockScope = lockScope;
      }

      if (cfg.write && typeof OperationRepository_ === 'object') {
        const accessDescriptor = _safeAccessDescriptor();
        const resolvedInitiator = _buildInitiator(payload, accessDescriptor);
        const resolvedRunSource = _buildRunSource(cfg, payload, route, rawScenario);
        const startNote = _buildStartNote(rawScenario, payload, route, resolvedInitiator, resolvedRunSource);

        if (!payload.initiator) payload.initiator = resolvedInitiator;
        if (!payload.source) payload.source = resolvedRunSource;

        lifecycle = OperationRepository_.beginExecution({
          scenario: rawScenario,
          rawScenario: rawScenario,
          payload: payload,
          operationId: operationId,
          dryRun: dryRun,
          parentOperationId: payload.parentOperationId || '',
          initiator: resolvedInitiator,
          runSource: resolvedRunSource,
          startNote: startNote,
          lockHolder: lock ? 'document-lock' : ''
        });

        diagnostics.idempotencyFingerprint = lifecycle.fingerprint || '';
        diagnostics.lifecycle.push('lifecycle.preflight');

        if (lifecycle.suppressed) {
          diagnostics.lifecycle.push('idempotency.fingerprint.suppressed');
          return _buildDuplicateResponse_(
            rawScenario,
            operationId,
            dryRun,
            route,
            lock,
            lockRequired,
            startedAt,
            diagnostics,
            context,
            warnings,
            lifecycle
          );
        }

        operationId = lifecycle.operationId || operationId;
        context.operationId = operationId;
        context.parentOperationId = lifecycle.parentOperationId || payload.parentOperationId || '';
        context.fingerprint = lifecycle.fingerprint || '';
      }

      if (typeof cfg.readBefore === 'function') {
        if (cfg.write && !dryRun && typeof OperationRepository_ === 'object') {
          OperationRepository_.heartbeat(operationId, 'before-read');
        }

        beforeState = cfg.readBefore(payload, context);
        diagnostics.lifecycle.push('state.read');

        if (cfg.write && !dryRun && typeof OperationRepository_ === 'object') {
          OperationRepository_.saveCheckpoint({
            operationId: operationId,
            checkpointIndex: 10,
            processedUpTo: 'state.read',
            checkpointPayload: { scenario: rawScenario },
            verificationSnapshot: { ok: true }
          });
        }
      }

      if (typeof cfg.plan === 'function') {
        if (cfg.write && !dryRun && typeof OperationRepository_ === 'object') {
          OperationRepository_.heartbeat(operationId, 'before-plan');
        }

        plan = cfg.plan(payload, beforeState, context) || {};
        warnings.push.apply(warnings, mergeWorkflowWarnings_(plan.warnings));
        diagnostics.lifecycle.push('plan.built');

        if (cfg.write && !dryRun && typeof OperationRepository_ === 'object') {
          OperationRepository_.saveCheckpoint({
            operationId: operationId,
            checkpointIndex: 20,
            processedUpTo: 'plan.built',
            checkpointPayload: { meta: plan.meta || null },
            verificationSnapshot: { ok: true }
          });
        }
      }

      if (typeof cfg.execute === 'function') {
        if (cfg.write && !dryRun && typeof OperationRepository_ === 'object') {
          OperationRepository_.heartbeat(operationId, 'before-execute');
        }

        if (lockRequired && lockScope === 'execute') {
          lock = _acquireLock(true, cfg.lockTimeoutMs);
          diagnostics.lock = !!lock;
          lockUsed = !!lock;

          if (lock) diagnostics.lifecycle.push('lock.acquired.execute');
        }

        try {
          execution = cfg.execute(payload, beforeState, plan, context) || {};
        } finally {
          if (lockRequired && lockScope === 'execute') {
            _releaseLock(lock);
            if (lock) diagnostics.lifecycle.push('lock.released.execute');
            lock = null;
          }
        }
      } else {
        execution = {
          result: null,
          changes: [],
          warnings: []
        };
      }

      warnings.push.apply(warnings, mergeWorkflowWarnings_(execution.warnings));
      diagnostics.lifecycle.push(dryRun ? 'execute.dryRun' : 'execute.applied');

      if (cfg.write && !dryRun && typeof OperationRepository_ === 'object') {
        OperationRepository_.saveCheckpoint({
          operationId: operationId,
          checkpointIndex: 50,
          processedUpTo: 'execute.complete',
          lastProcessedEntity: stage7AsArray_(execution.affectedEntities)[0] || '',
          lastProcessedRow: stage7AsArray_(payload.rowNumbers)[0] || '',
          checkpointPayload: {
            appliedChangesCount: Number(execution.appliedChangesCount || 0),
            skippedChangesCount: Number(execution.skippedChangesCount || 0)
          },
          verificationSnapshot: { success: execution.success !== false }
        });
      }

      if (typeof cfg.sync === 'function') {
        sync = cfg.sync(payload, beforeState, plan, execution, context) || {};
        warnings.push.apply(warnings, mergeWorkflowWarnings_(sync.warnings));
        diagnostics.lifecycle.push('ui.sync.prepared');
      }

      if (typeof cfg.verify === 'function') {
        if (cfg.write && !dryRun && typeof OperationRepository_ === 'object') {
          OperationRepository_.heartbeat(operationId, 'before-verify');
        }

        verification = cfg.verify(payload, beforeState, plan, execution, context) || {};
        warnings.push.apply(warnings, mergeWorkflowWarnings_(verification.warnings));
        diagnostics.verification = verification;
        diagnostics.lifecycle.push('verification.completed');

        if (verification && verification.partial === true) {
          execution.partial = true;
        }

        if (cfg.write && !dryRun && typeof OperationRepository_ === 'object') {
          OperationRepository_.saveCheckpoint({
            operationId: operationId,
            checkpointIndex: 60,
            processedUpTo: 'verification.complete',
            lastProcessedEntity: stage7AsArray_(execution.affectedEntities)[0] || '',
            lastProcessedRow: stage7AsArray_(payload.rowNumbers)[0] || '',
            checkpointPayload: {
              verificationResult: OperationRepository_._classifyVerification(verification)
            },
            verificationSnapshot: verification
          });
        }
      }

      const lifecycleScenario = (typeof OperationRepository_ === 'object')
        ? OperationRepository_.canonicalScenario(rawScenario, payload)
        : rawScenario;

      const meta = Object.assign({
        stage: STAGE7_CONFIG.VERSION,
        hardeningStage: diagnostics.hardeningStage,
        scenario: lifecycleScenario,
        rawScenario: rawScenario,
        operationId: operationId,
        parentOperationId: payload.parentOperationId || '',
        route: route,
        fingerprint: diagnostics.idempotencyFingerprint || '',
        affectedSheets: stage7AsArray_(execution.affectedSheets),
        affectedEntities: stage7AsArray_(execution.affectedEntities),
        appliedChangesCount: Number(execution.appliedChangesCount) || stage7AsArray_(execution.changes).length,
        skippedChangesCount: Number(execution.skippedChangesCount) || 0,
        dryRun: dryRun,
        partial: !!execution.partial,
        retrySafe: retrySafe,
        lockUsed: !!lockUsed,
        lockRequired: !!lockRequired,
        durationMs: new Date().getTime() - startedAt.getTime(),
        sync: sync || null,
        verification: verification || null,
        repairNeeded: !dryRun && cfg.write && (
          !!(execution && execution.success === false) ||
          (verification && verification.ok === false) ||
          (verification && verification.partial === true)
        ),
        diagnosticsSummary: {
          lifecycle: diagnostics.lifecycle.slice(),
          fingerprint: diagnostics.idempotencyFingerprint || ''
        }
      }, execution.meta || {}, (plan && plan.meta) || {});

      diagnostics.lifecycle.push('response.built');

      const response = buildServerResponse_(
        execution.success !== false,
        execution.message || cfg.successMessage || 'Операцію виконано',
        null,
        execution.result,
        execution.changes || [],
        meta,
        diagnostics,
        Object.assign({}, context, execution.context || {}),
        warnings
      );

      if (cfg.write && !dryRun && typeof OperationRepository_ === 'object') {
        OperationRepository_.finalizeSuccessfulExecution({
          operationId: operationId,
          payload: payload,
          result: execution.result,
          execution: execution,
          verification: verification,
          success: execution.success !== false,
          message: response.message,
          repairNeeded: meta.repairNeeded,
          transitionReason: (verification && verification.ok === false)
            ? 'post-write-verification-failed'
            : 'commit-complete'
        });
      }

      if (stage7GetFeatureFlag_('auditTrail', true)) {
        Stage7AuditTrail_.record({
          timestamp: new Date(),
          operationId: operationId,
          scenario: lifecycleScenario,
          level: execution.partial ? 'WARN' : 'AUDIT',
          status: execution.success === false ? 'ERROR' : (execution.partial ? 'PARTIAL' : 'SUCCESS'),
          initiator: payload.initiator || (payload.trigger ? 'trigger' : 'manual'),
          dryRun: dryRun,
          partial: !!execution.partial,
          affectedSheets: meta.affectedSheets,
          affectedEntities: meta.affectedEntities,
          appliedChangesCount: meta.appliedChangesCount,
          skippedChangesCount: meta.skippedChangesCount,
          warnings: normalizeWorkflowWarnings_(warnings),
          payload: payload,
          before: beforeState,
          after: execution.result,
          changes: execution.changes,
          diagnostics: diagnostics,
          message: response.message,
          error: null,
          context: context
        });

        Stage7AuditTrail_.writeCompactLegacyLog({
          timestamp: new Date(),
          operationId: operationId,
          scenario: lifecycleScenario,
          level: execution.partial ? 'WARN' : 'AUDIT',
          affectedSheets: meta.affectedSheets,
          affectedEntities: meta.affectedEntities,
          message: response.message,
          context: context
        });
      }

      return response;
    } catch (e) {
      diagnostics.lifecycle.push('error');
      diagnostics.durationMs = new Date().getTime() - startedAt.getTime();

      if (cfg.write && !dryRun && typeof OperationRepository_ === 'object') {
        try {
          OperationRepository_.registerFailure({
            operationId: operationId,
            payload: payload,
            result: execution && execution.result || null,
            execution: execution,
            errorMessage: e && e.message ? e.message : String(e),
            transitionReason: 'exception'
          });

          OperationRepository_.appendNote(
            operationId,
            e && e.message ? e.message : String(e),
            'workflow'
          );
        } catch (_) {}
      }

      const response = buildServerResponse_(
        false,
        '',
        e && e.message ? e.message : String(e),
        null,
        [],
        {
          stage: STAGE7_CONFIG.VERSION,
          hardeningStage: diagnostics.hardeningStage,
          scenario: (typeof OperationRepository_ === 'object')
            ? OperationRepository_.canonicalScenario(rawScenario, payload)
            : rawScenario,
          rawScenario: rawScenario,
          operationId: operationId,
          route: route,
          fingerprint: diagnostics.idempotencyFingerprint || '',
          affectedSheets: [],
          affectedEntities: [],
          appliedChangesCount: 0,
          skippedChangesCount: 0,
          dryRun: dryRun,
          partial: false,
          retrySafe: retrySafe,
          lockUsed: !!lockUsed,
          lockRequired: !!lockRequired,
          durationMs: diagnostics.durationMs,
          verification: verification || null,
          repairNeeded: !!cfg.write && !dryRun
        },
        diagnostics,
        context,
        warnings
      );

      if (stage7GetFeatureFlag_('auditTrail', true)) {
        Stage7AuditTrail_.record({
          timestamp: new Date(),
          operationId: operationId,
          scenario: rawScenario,
          level: 'ERROR',
          status: 'ERROR',
          initiator: payload.initiator || (payload.trigger ? 'trigger' : 'manual'),
          dryRun: dryRun,
          partial: false,
          affectedSheets: [],
          affectedEntities: [],
          appliedChangesCount: 0,
          skippedChangesCount: 0,
          warnings: normalizeWorkflowWarnings_(warnings),
          payload: payload,
          before: beforeState,
          after: null,
          changes: [],
          diagnostics: diagnostics,
          message: '',
          error: response.error,
          context: context
        });

        Stage7AuditTrail_.writeCompactLegacyLog({
          timestamp: new Date(),
          operationId: operationId,
          scenario: rawScenario,
          level: 'ERROR',
          affectedSheets: [],
          affectedEntities: [],
          message: response.error,
          context: context
        });
      }

      return response;
    } finally {
      _releaseLock(lock);
    }
  }

  return { run: run };
})();

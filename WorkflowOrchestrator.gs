/**
 * WorkflowOrchestrator.gs — lifecycle orchestration for Stage 7 reliability hardening.
 */

function buildStage4Response_(success, message, error, result, changes, meta, diagnostics, context, warnings) {
  const safeMeta = meta || {};
  const safeDiagnostics = diagnostics || null;
  const normalizedWarnings = Array.isArray(warnings) ? warnings.filter(Boolean).map(String) : [];
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
    affectedSheets: stage4AsArray_(safeMeta.affectedSheets),
    affectedEntities: stage4AsArray_(safeMeta.affectedEntities),
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
  function _acquireLock(lockRequired, timeoutMs) {
    if (!lockRequired) return null;
    const lock = LockService.getDocumentLock();
    lock.waitLock(Math.max(Number(timeoutMs) || STAGE4_CONFIG.LOCK_TIMEOUT_MS, 1000));
    return lock;
  }

  function _releaseLock(lock) {
    if (!lock) return;
    try { lock.releaseLock(); } catch (_) {}
  }

  function _routeDescriptor(cfg, scenario) {
    if (cfg && cfg.routeName && typeof getStage6ARouteByName_ === 'function') {
      return getStage6ARouteByName_(cfg.routeName);
    }
    if (cfg && cfg.publicApiMethod && typeof getStage6ARouteByApiMethod_ === 'function') {
      return getStage6ARouteByApiMethod_(cfg.publicApiMethod);
    }
    return null;
  }

  function _buildDuplicateResponse_(scenario, operationId, dryRun, route, lock, lockRequired, startedAt, diagnostics, context, warnings, lifecycle) {
    const previous = lifecycle && lifecycle.previous || {};
    const meta = {
      stage: STAGE4_CONFIG.VERSION,
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
      lifecycle: lifecycle ? { fingerprint: lifecycle.fingerprint || '', reason: lifecycle.reason || '' } : null,
      idempotency: {
        fingerprint: lifecycle && lifecycle.fingerprint || '',
        reason: lifecycle && lifecycle.reason || '',
        previousOperationId: previous && previous.OperationId ? String(previous.OperationId) : '',
        previousFinishedAt: previous && previous.TimestampFinished ? String(previous.TimestampFinished) : ''
      }
    };
    return buildStage4Response_(true, 'Повторний запуск безпечно подавлено', null, null, [], meta, diagnostics, context, warnings.concat(['Сценарій уже виконувався або щойно був успішно завершений']));
  }

  function run(spec) {
    const cfg = spec || {};
    const rawScenario = String(cfg.scenario || 'unknownScenario');
    let payload = Object.assign({}, cfg.payload || {});
    const startedAt = new Date();
    const warnings = [];
    const diagnostics = {
      stage: STAGE4_CONFIG.VERSION,
      hardeningStage: '7',
      scenario: rawScenario,
      startedAt: startedAt.toISOString(),
      lifecycle: []
    };

    const dryRun = !!payload.dryRun;
    const route = _routeDescriptor(cfg, rawScenario);
    const lockRequired = cfg.lock !== false && !!cfg.write;
    const retrySafe = cfg.retrySafe !== false;
    let operationId = (typeof OperationRepository_ === 'object')
      ? OperationRepository_.makeOperationId(rawScenario, payload, payload.operationId)
      : String(payload.operationId || stage4UniqueId_(rawScenario));

    let context = Object.assign({
      stage: STAGE4_CONFIG.VERSION,
      hardeningStage: diagnostics.hardeningStage,
      scenario: rawScenario,
      operationId: operationId,
      dryRun: dryRun,
      routeName: route && route.routeName ? route.routeName : '',
      publicApiMethod: route && route.publicApiMethod ? route.publicApiMethod : ''
    }, cfg.context || {});

    let lock = null;
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
        if (validated.payload && typeof validated.payload === 'object') payload = validated.payload;
        warnings.push.apply(warnings, stage4MergeWarnings_(validated.warnings));
        diagnostics.lifecycle.push('payload.validated');
      }

      operationId = (typeof OperationRepository_ === 'object')
        ? OperationRepository_.makeOperationId(rawScenario, payload, payload.operationId)
        : operationId;
      context.operationId = operationId;

      lock = _acquireLock(lockRequired, cfg.lockTimeoutMs);
      diagnostics.lock = !!lock;
      diagnostics.lockRequired = !!lockRequired;
      if (lock) diagnostics.lifecycle.push('lock.acquired');

      if (cfg.write && typeof OperationRepository_ === 'object') {
        lifecycle = OperationRepository_.beginExecution({
          scenario: rawScenario,
          rawScenario: rawScenario,
          payload: payload,
          operationId: operationId,
          dryRun: dryRun,
          parentOperationId: payload.parentOperationId || '',
          initiator: payload.initiator || (payload.trigger ? 'trigger' : 'manual'),
          runSource: payload.source || (payload.trigger ? 'trigger' : 'manual'),
          lockHolder: lock ? 'document-lock' : ''
        });
        diagnostics.idempotencyFingerprint = lifecycle.fingerprint || '';
        diagnostics.lifecycle.push('lifecycle.preflight');
        if (lifecycle.suppressed) {
          diagnostics.lifecycle.push('idempotency.fingerprint.suppressed');
          return _buildDuplicateResponse_(rawScenario, operationId, dryRun, route, lock, lockRequired, startedAt, diagnostics, context, warnings, lifecycle);
        }
        operationId = lifecycle.operationId || operationId;
        context.operationId = operationId;
        context.parentOperationId = lifecycle.parentOperationId || payload.parentOperationId || '';
        context.fingerprint = lifecycle.fingerprint || '';
      }

      if (typeof cfg.readBefore === 'function') {
        if (cfg.write && !dryRun && typeof OperationRepository_ === 'object') OperationRepository_.heartbeat(operationId, 'before-read');
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
        if (cfg.write && !dryRun && typeof OperationRepository_ === 'object') OperationRepository_.heartbeat(operationId, 'before-plan');
        plan = cfg.plan(payload, beforeState, context) || {};
        warnings.push.apply(warnings, stage4MergeWarnings_(plan.warnings));
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
        if (cfg.write && !dryRun && typeof OperationRepository_ === 'object') OperationRepository_.heartbeat(operationId, 'before-execute');
        execution = cfg.execute(payload, beforeState, plan, context) || {};
      } else {
        execution = { result: null, changes: [], warnings: [] };
      }
      warnings.push.apply(warnings, stage4MergeWarnings_(execution.warnings));
      diagnostics.lifecycle.push(dryRun ? 'execute.dryRun' : 'execute.applied');

      if (cfg.write && !dryRun && typeof OperationRepository_ === 'object') {
        OperationRepository_.saveCheckpoint({
          operationId: operationId,
          checkpointIndex: 50,
          processedUpTo: 'execute.complete',
          lastProcessedEntity: stage4AsArray_(execution.affectedEntities)[0] || '',
          lastProcessedRow: stage4AsArray_(payload.rowNumbers)[0] || '',
          checkpointPayload: {
            appliedChangesCount: Number(execution.appliedChangesCount || 0),
            skippedChangesCount: Number(execution.skippedChangesCount || 0)
          },
          verificationSnapshot: { success: execution.success !== false }
        });
      }

      if (typeof cfg.sync === 'function') {
        sync = cfg.sync(payload, beforeState, plan, execution, context) || {};
        warnings.push.apply(warnings, stage4MergeWarnings_(sync.warnings));
        diagnostics.lifecycle.push('ui.sync.prepared');
      }

      if (typeof cfg.verify === 'function') {
        if (cfg.write && !dryRun && typeof OperationRepository_ === 'object') OperationRepository_.heartbeat(operationId, 'before-verify');
        verification = cfg.verify(payload, beforeState, plan, execution, context) || {};
        warnings.push.apply(warnings, stage4MergeWarnings_(verification.warnings));
        diagnostics.verification = verification;
        diagnostics.lifecycle.push('verification.completed');
        if (verification && verification.partial === true) execution.partial = true;
        if (cfg.write && !dryRun && typeof OperationRepository_ === 'object') {
          OperationRepository_.saveCheckpoint({
            operationId: operationId,
            checkpointIndex: 60,
            processedUpTo: 'verification.complete',
            lastProcessedEntity: stage4AsArray_(execution.affectedEntities)[0] || '',
            lastProcessedRow: stage4AsArray_(payload.rowNumbers)[0] || '',
            checkpointPayload: { verificationResult: OperationRepository_._classifyVerification(verification) },
            verificationSnapshot: verification
          });
        }
      }

      const lifecycleScenario = (typeof OperationRepository_ === 'object') ? OperationRepository_.canonicalScenario(rawScenario, payload) : rawScenario;
      const meta = Object.assign({
        stage: STAGE4_CONFIG.VERSION,
        hardeningStage: diagnostics.hardeningStage,
        scenario: lifecycleScenario,
        rawScenario: rawScenario,
        operationId: operationId,
        parentOperationId: payload.parentOperationId || '',
        route: route,
        fingerprint: diagnostics.idempotencyFingerprint || '',
        affectedSheets: stage4AsArray_(execution.affectedSheets),
        affectedEntities: stage4AsArray_(execution.affectedEntities),
        appliedChangesCount: Number(execution.appliedChangesCount) || stage4AsArray_(execution.changes).length,
        skippedChangesCount: Number(execution.skippedChangesCount) || 0,
        dryRun: dryRun,
        partial: !!execution.partial,
        retrySafe: retrySafe,
        lockUsed: !!lock,
        lockRequired: !!lockRequired,
        durationMs: new Date().getTime() - startedAt.getTime(),
        sync: sync || null,
        verification: verification || null,
        repairNeeded: !dryRun && cfg.write && (!!(execution && execution.success === false) || (verification && verification.ok === false) || (verification && verification.partial === true)),
        diagnosticsSummary: {
          lifecycle: diagnostics.lifecycle.slice(),
          fingerprint: diagnostics.idempotencyFingerprint || ''
        }
      }, execution.meta || {}, (plan && plan.meta) || {});

      diagnostics.lifecycle.push('response.built');

      const response = buildStage4Response_(
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
          transitionReason: (verification && verification.ok === false) ? 'post-write-verification-failed' : 'commit-complete'
        });
      }

      if (stage4GetFeatureFlag_('auditTrail', true)) {
        Stage4AuditTrail_.record({
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
          warnings: warnings,
          payload: payload,
          before: beforeState,
          after: execution.result,
          changes: execution.changes,
          diagnostics: diagnostics,
          message: response.message,
          error: null,
          context: context
        });
        Stage4AuditTrail_.writeCompactLegacyLog({
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
          OperationRepository_.appendNote(operationId, e && e.message ? e.message : String(e), 'workflow');
        } catch (_) {}
      }

      const response = buildStage4Response_(
        false,
        '',
        e && e.message ? e.message : String(e),
        null,
        [],
        {
          stage: STAGE4_CONFIG.VERSION,
          hardeningStage: diagnostics.hardeningStage,
          scenario: (typeof OperationRepository_ === 'object') ? OperationRepository_.canonicalScenario(rawScenario, payload) : rawScenario,
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
          lockUsed: !!lock,
          lockRequired: !!lockRequired,
          durationMs: diagnostics.durationMs,
          verification: verification || null,
          repairNeeded: !!cfg.write && !dryRun
        },
        diagnostics,
        context,
        warnings
      );

      if (stage4GetFeatureFlag_('auditTrail', true)) {
        Stage4AuditTrail_.record({
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
          warnings: warnings,
          payload: payload,
          before: beforeState,
          after: null,
          changes: [],
          diagnostics: diagnostics,
          message: '',
          error: response.error,
          context: context
        });
        Stage4AuditTrail_.writeCompactLegacyLog({
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
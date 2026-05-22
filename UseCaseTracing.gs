/**
 * UseCaseTracing.gs — lightweight structured tracing for critical use cases.
 * Structural-only: logs only; does not change business behavior.
 */

var USE_CASE_TRACE_CRITICAL_ = {
  generateSendPanelForDate: { domain: 'SendPanel', area: 'UseCases.SendPanel' },
  markPanelRowsAsSent: { domain: 'SendPanel', area: 'UseCases.SendPanel' },
  sendPendingRows: { domain: 'SendPanel', area: 'UseCases.SendPanel' },
  getSendPanelData: { domain: 'SendPanel', area: 'UseCases.SendPanel' },
  loadCalendarDay: { domain: 'Calendar', area: 'UseCases.Calendar' },
  openPersonCard: { domain: 'Calendar', area: 'UseCases.Calendar' },
  buildDaySummary: { domain: 'Summaries', area: 'UseCases.Summaries' },
  runMaintenanceScenario: { domain: 'Maintenance', area: 'UseCases.Maintenance' }
};

var USE_CASE_TRACE_NOISY_ = {
  cleanupCaches: true,
  healthCheck: true,
  cleanupLifecycleRetention: true
};

function _traceId_() {
  return Utilities.getUuid();
}

function _traceRuntimePhase_() {
  try {
    return String(PropertiesService.getScriptProperties().getProperty('WASB_TRACE_RUNTIME_PHASE') || 'pre-split');
  } catch (_) {
    return 'pre-split';
  }
}

function _traceDebugEnabled_() {
  try {
    return String(PropertiesService.getScriptProperties().getProperty('WASB_TRACE_DEBUG') || '').toLowerCase() === 'true';
  } catch (_) {
    return false;
  }
}

function _traceRateBucket_() {
  if (typeof _traceRateBucket_.map !== 'object') {
    _traceRateBucket_.map = {};
  }
  return _traceRateBucket_.map;
}

function _traceRateLimited_(useCase, minIntervalMs) {
  var interval = Number(minIntervalMs) || 5000;
  var bucket = _traceRateBucket_();
  var now = Date.now();
  var last = bucket[useCase] || 0;
  if (now - last < interval) {
    return true;
  }
  bucket[useCase] = now;
  return false;
}

function _traceDomainForUseCase_(useCase) {
  var key = String(useCase || '');
  if (USE_CASE_TRACE_CRITICAL_[key]) {
    return USE_CASE_TRACE_CRITICAL_[key].domain;
  }
  return 'UseCases';
}

function _traceAreaForUseCase_(useCase) {
  var key = String(useCase || '');
  if (USE_CASE_TRACE_CRITICAL_[key]) {
    return USE_CASE_TRACE_CRITICAL_[key].area;
  }
  return 'UseCases';
}

function _traceSamplingRateForUseCase_(useCase) {
  if (USE_CASE_TRACE_NOISY_[String(useCase || '')]) {
    return 0.1;
  }
  return 1;
}

function _shouldTraceUseCase_(useCase) {
  return !!USE_CASE_TRACE_CRITICAL_[String(useCase || '')];
}

function traceUseCase_(name, meta) {
  meta = meta || {};
  var useCase = String(name || meta.useCase || 'unknown');
  var rate = meta.samplingRate != null ? Number(meta.samplingRate) : _traceSamplingRateForUseCase_(useCase);
  if (rate <= 0) {
    return;
  }
  if (rate < 1 && Math.random() > rate) {
    return;
  }
  if (meta.severity === 'debug' && !_traceDebugEnabled_()) {
    return;
  }
  if (meta.severity !== 'error' && _traceRateLimited_(useCase)) {
    return;
  }
  try {
    console.log(JSON.stringify({
      traceId: meta.traceId || _traceId_(),
      ts: new Date().toISOString(),
      domain: meta.domain || _traceDomainForUseCase_(useCase),
      area: meta.area || _traceAreaForUseCase_(useCase),
      useCase: useCase,
      caller: meta.caller || 'unknown',
      severity: meta.severity || 'info',
      runtimePhase: meta.runtimePhase || _traceRuntimePhase_(),
      samplingRate: rate,
      ok: meta.ok !== false,
      ms: meta.ms != null ? meta.ms : null,
      err: meta.err || null
    }));
  } catch (_) {}
}

function useCaseTraceBegin_(useCase, caller) {
  if (!_shouldTraceUseCase_(useCase)) {
    return null;
  }
  return {
    traceId: _traceId_(),
    useCase: String(useCase || 'unknown'),
    caller: String(caller || 'WorkflowOrchestrator'),
    startedAt: Date.now()
  };
}

function useCaseTraceEnd_(handle, meta) {
  if (!handle) {
    return;
  }
  meta = meta || {};
  traceUseCase_(handle.useCase, {
    traceId: handle.traceId,
    caller: handle.caller,
    domain: meta.domain,
    area: meta.area,
    ok: meta.ok !== false,
    ms: Date.now() - handle.startedAt,
    err: meta.err || null,
    severity: meta.severity || (meta.ok === false ? 'error' : 'info'),
    samplingRate: meta.samplingRate
  });
}

function withUseCaseTrace_(useCase, meta, fn) {
  var handle = useCaseTraceBegin_(useCase, meta && meta.caller);
  try {
    var result = fn();
    useCaseTraceEnd_(handle, { ok: true });
    return result;
  } catch (err) {
    useCaseTraceEnd_(handle, {
      ok: false,
      err: err && err.message ? String(err.message) : String(err),
      severity: 'error'
    });
    throw err;
  }
}

/**
 * UseCaseTracing.gs — structured JSON tracing for critical use cases.
 *
 * Critical scenarios are traced from WorkflowOrchestrator_.run() via
 * useCaseTraceBegin_ / useCaseTraceEnd_ (scenario name must match keys below).
 * withUseCaseTrace_ is optional for non-orchestrator entry points.
 *
 * Script properties:
 * - WASB_TRACE_ENABLED=false — disable all tracing
 * - WASB_TRACE_DEBUG=true — emit PanelHelpers debug traces
 * - WASB_TRACE_RUNTIME_PHASE=pre-split|post-split
 */

var USE_CASE_TRACE_CRITICAL_ = Object.freeze({
  generateSendPanelForDate: { domain: 'SendPanel', area: 'UseCases.SendPanel' },
  markPanelRowsAsSent: { domain: 'SendPanel', area: 'UseCases.SendPanel' },
  sendPendingRows: { domain: 'SendPanel', area: 'UseCases.SendPanel' },
  getSendPanelData: { domain: 'SendPanel', area: 'UseCases.SendPanel' },
  loadCalendarDay: { domain: 'Calendar', area: 'UseCases.Calendar' },
  openPersonCard: { domain: 'Calendar', area: 'UseCases.Calendar' },
  buildDaySummary: { domain: 'Summaries', area: 'UseCases.Summaries' },
  runMaintenanceScenario: { domain: 'Maintenance', area: 'UseCases.Maintenance' }
});

var USE_CASE_TRACE_NOISY_ = Object.freeze({
  cleanupCaches: true,
  healthCheck: true,
  cleanupLifecycleRetention: true
});

var _traceRateLimitMap_ = Object.create(null);

/**
 * @returns {string}
 */
function _traceId_() {
  return Utilities.getUuid();
}

/**
 * @returns {string}
 */
function _traceRuntimePhase_() {
  try {
    return String(PropertiesService.getScriptProperties().getProperty('WASB_TRACE_RUNTIME_PHASE') || 'pre-split');
  } catch (_) {
    return 'pre-split';
  }
}

/**
 * @returns {boolean}
 */
function _traceEnabled_() {
  try {
    var raw = String(PropertiesService.getScriptProperties().getProperty('WASB_TRACE_ENABLED') || '').toLowerCase();
    if (raw === 'false' || raw === '0' || raw === 'off') {
      return false;
    }
    return true;
  } catch (_) {
    return true;
  }
}

/**
 * @returns {boolean}
 */
function _traceDebugEnabled_() {
  try {
    return String(PropertiesService.getScriptProperties().getProperty('WASB_TRACE_DEBUG') || '').toLowerCase() === 'true';
  } catch (_) {
    return false;
  }
}

/**
 * @param {string} useCase
 * @param {number} [minIntervalMs]
 * @returns {boolean} true when emit should be skipped (rate limited)
 */
function _traceRateLimited_(useCase, minIntervalMs) {
  var interval = Number(minIntervalMs) || 5000;
  var key = String(useCase || '');
  var now = Date.now();
  var last = _traceRateLimitMap_[key] || 0;
  if (now - last < interval) {
    return true;
  }
  _traceRateLimitMap_[key] = now;
  return false;
}

/**
 * @param {*} value
 * @returns {string}
 */
function _traceSafeStringify_(value) {
  var seen = [];
  try {
    return JSON.stringify(value, function (_key, val) {
      if (typeof val === 'object' && val !== null) {
        if (seen.indexOf(val) >= 0) {
          return '[Circular]';
        }
        seen.push(val);
      }
      return val;
    });
  } catch (_) {
    return '{"error":"trace serialize failed"}';
  }
}

/**
 * @param {string} useCase
 * @returns {string}
 */
function _traceDomainForUseCase_(useCase) {
  var key = String(useCase || '');
  if (USE_CASE_TRACE_CRITICAL_[key]) {
    return USE_CASE_TRACE_CRITICAL_[key].domain;
  }
  return 'UseCases';
}

/**
 * @param {string} useCase
 * @returns {string}
 */
function _traceAreaForUseCase_(useCase) {
  var key = String(useCase || '');
  if (USE_CASE_TRACE_CRITICAL_[key]) {
    return USE_CASE_TRACE_CRITICAL_[key].area;
  }
  return 'UseCases';
}

/**
 * @param {string} useCase
 * @returns {number}
 */
function _traceSamplingRateForUseCase_(useCase) {
  if (USE_CASE_TRACE_NOISY_[String(useCase || '')]) {
    return 0.1;
  }
  return 1;
}

/**
 * @param {string} useCase
 * @returns {boolean}
 */
function _shouldTraceUseCase_(useCase) {
  return !!USE_CASE_TRACE_CRITICAL_[String(useCase || '')];
}

/**
 * @param {string} name
 * @param {Object} [meta]
 */
function traceUseCase_(name, meta) {
  if (!_traceEnabled_()) {
    return;
  }

  meta = meta || {};
  var useCase = String(name || meta.useCase || 'unknown');
  var severity = String(meta.severity || 'info');

  if (severity === 'debug' && !_traceDebugEnabled_()) {
    return;
  }

  var rate = meta.samplingRate != null ? Number(meta.samplingRate) : _traceSamplingRateForUseCase_(useCase);
  if (rate <= 0) {
    return;
  }
  if (rate < 1 && Math.random() > rate) {
    return;
  }

  if (severity !== 'error' && severity !== 'debug' && _traceRateLimited_(useCase)) {
    return;
  }

  try {
    console.log(_traceSafeStringify_({
      traceId: meta.traceId || _traceId_(),
      ts: new Date().toISOString(),
      domain: meta.domain || _traceDomainForUseCase_(useCase),
      area: meta.area || _traceAreaForUseCase_(useCase),
      useCase: useCase,
      caller: meta.caller || 'unknown',
      severity: severity,
      runtimePhase: meta.runtimePhase || _traceRuntimePhase_(),
      samplingRate: rate,
      ok: meta.ok !== false,
      ms: meta.ms != null ? meta.ms : null,
      err: meta.err || null
    }));
  } catch (_) {}
}

/**
 * @param {string} useCase
 * @param {string} [caller]
 * @returns {{traceId:string,useCase:string,caller:string,startedAt:number}|null}
 */
function useCaseTraceBegin_(useCase, caller) {
  if (!_traceEnabled_() || !_shouldTraceUseCase_(useCase)) {
    return null;
  }
  return {
    traceId: _traceId_(),
    useCase: String(useCase || 'unknown'),
    caller: String(caller || 'WorkflowOrchestrator'),
    startedAt: Date.now()
  };
}

/**
 * @param {{traceId:string,useCase:string,caller:string,startedAt:number}|null} handle
 * @param {Object} [meta]
 */
function useCaseTraceEnd_(handle, meta) {
  if (!handle || !_traceEnabled_()) {
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

/**
 * @param {string} useCase
 * @param {Object} [meta]
 * @param {Function} fn
 * @returns {*}
 */
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

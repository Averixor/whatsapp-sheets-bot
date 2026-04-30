/**
 * Stage7EnvelopeCompat.gs
 *
 * Compatibility shim for older Stage 7 wrappers that still call stage7Envelope_().
 * Keeps access-registration and maintenance endpoints from crashing if a legacy
 * wrapper was deployed before the canonical _stage7BuildMaintenanceResponse_ call.
 */

function stage7Envelope_(scenario, result, warning) {
  var normalizedScenario = String(scenario || 'stage7Envelope').trim() || 'stage7Envelope';
  var payload = result && typeof result === 'object' ? result : { value: result };
  var success = !(payload && payload.success === false);
  var message = payload && payload.message
    ? String(payload.message)
    : (success ? 'Операцію виконано' : 'Операцію завершено з помилкою');

  var warnings = [];
  _stage7EnvelopePushWarning_(warnings, warning);

  if (payload && Array.isArray(payload.warnings)) {
    payload.warnings.forEach(function(item) {
      _stage7EnvelopePushWarning_(warnings, item);
    });
  }

  if (!success && !warnings.length) {
    _stage7EnvelopePushWarning_(warnings, message);
  }

  var extraMeta = {
    scenario: normalizedScenario,
    code: payload && payload.code ? String(payload.code) : '',
    compatibility: 'stage7Envelope_'
  };

  if (typeof _stage7BuildMaintenanceResponse_ === 'function') {
    return _stage7BuildMaintenanceResponse_(
      success,
      message,
      payload,
      normalizedScenario,
      warnings,
      extraMeta
    );
  }

  if (typeof buildServerResponse_ === 'function') {
    return buildServerResponse_(
      success,
      message,
      null,
      payload,
      [],
      extraMeta,
      { scenario: normalizedScenario, lifecycle: ['compat.stage7Envelope'] },
      { scenario: normalizedScenario, layer: 'compat' },
      warnings
    );
  }

  return {
    success: success,
    ok: success,
    message: message,
    data: payload,
    report: payload,
    result: payload,
    warnings: warnings,
    meta: extraMeta
  };
}

function _stage7EnvelopePushWarning_(warnings, value) {
  var text = _stage7EnvelopeWarningText_(value);
  if (!text) return;
  if (text === 'ok' || text === 'access.ok') return;
  if (warnings.indexOf(text) === -1) warnings.push(text);
}

function _stage7EnvelopeWarningText_(value) {
  if (value == null) return '';
  if (typeof _stage7NormalizeWarningText_ === 'function') {
    return _stage7NormalizeWarningText_(value);
  }
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  if (typeof value === 'object') {
    if (value.message != null) return String(value.message).trim();
    if (value.code != null) return String(value.code).trim();
    try {
      return JSON.stringify(value);
    } catch (error) {
      return String(value).trim();
    }
  }
  return String(value).trim();
}

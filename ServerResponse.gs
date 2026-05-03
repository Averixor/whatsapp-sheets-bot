// ===== FILE: ServerResponse.gs =====

const SERVER_RESPONSE_VERSION_ = '4.0.0';

function serverResponseAsArray_(value) {
  if (typeof stage7AsArray_ === 'function') {
    return stage7AsArray_(value);
  }

  if (value === null || value === undefined || value === '') return [];
  if (Array.isArray(value)) return value.slice();
  return [value];
}

function normalizeServerWarningItem_(item) {
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

function normalizeServerWarnings_(warnings) {
  if (typeof normalizeWorkflowWarnings_ === 'function') {
    return normalizeWorkflowWarnings_(warnings);
  }

  if (!Array.isArray(warnings)) return [];

  var out = [];
  warnings.forEach(function(item) {
    var normalized = normalizeServerWarningItem_(item);
    if (!normalized) return;
    out.push(normalized);
  });

  return Array.from(new Set(out));
}

function buildServerResponseData_(result, changes, meta, diagnostics) {
  return {
    result: result === undefined ? null : result,
    changes: Array.isArray(changes) ? changes : serverResponseAsArray_(changes),
    meta: meta && typeof meta === 'object' ? Object.assign({}, meta) : {},
    diagnostics: diagnostics || null
  };
}

function mergeServerResponseTopLevelMeta_(source, targetMeta) {
  const meta = targetMeta && typeof targetMeta === 'object' ? Object.assign({}, targetMeta) : {};
  const keys = [
    'stage',
    'hardeningStage',
    'scenario',
    'rawScenario',
    'operationId',
    'parentOperationId',
    'route',
    'fingerprint',
    'affectedSheets',
    'affectedEntities',
    'appliedChangesCount',
    'skippedChangesCount',
    'dryRun',
    'partial',
    'retrySafe',
    'lockUsed',
    'lockRequired',
    'durationMs',
    'sync',
    'verification',
    'repairNeeded',
    'diagnosticsSummary'
  ];

  keys.forEach(function(key) {
    if (!source || source[key] === undefined) return;
    if (meta[key] !== undefined) return;
    meta[key] = source[key];
  });

  return meta;
}

function toServerResponseCount_(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return Number(fallback || 0);
  }

  const num = Number(value);
  return isNaN(num) ? Number(fallback || 0) : num;
}

function buildServerResponseEnvelope_(success, message, error, result, changes, meta, diagnostics, context, warnings) {
  const safeContext = context || null;
  const safeMeta = meta && typeof meta === 'object' ? Object.assign({}, meta) : {};
  const safeDiagnostics = diagnostics || null;
  const data = buildServerResponseData_(result, changes, safeMeta, safeDiagnostics);

  return {
    success: !!success,
    message: String(message || ''),
    error: error ? String(error) : null,
    data: data,
    context: safeContext,
    warnings: normalizeServerWarnings_(warnings),
    operationId: safeMeta.operationId || (safeContext && safeContext.operationId) || null,
    scenario: safeMeta.scenario || (safeContext && safeContext.scenario) || null,
    dryRun: !!(safeMeta.dryRun || (safeContext && safeContext.dryRun)),
    affectedSheets: serverResponseAsArray_(safeMeta.affectedSheets),
    affectedEntities: serverResponseAsArray_(safeMeta.affectedEntities),
    appliedChangesCount: toServerResponseCount_(safeMeta.appliedChangesCount, data.changes.length),
    skippedChangesCount: toServerResponseCount_(safeMeta.skippedChangesCount, 0),
    partial: !!safeMeta.partial,
    retrySafe: safeMeta.retrySafe !== false,
    lockUsed: !!safeMeta.lockUsed,
    lockRequired: !!safeMeta.lockRequired,
    diagnostics: safeDiagnostics
  };
}

function buildSimpleServerResponse_(success, data, message, error, context, warnings) {
  let result = data;
  let changes = [];
  let meta = {};
  let diagnostics = null;

  if (data && typeof data === 'object' && (
    Object.prototype.hasOwnProperty.call(data, 'result') ||
    Object.prototype.hasOwnProperty.call(data, 'changes') ||
    Object.prototype.hasOwnProperty.call(data, 'meta') ||
    Object.prototype.hasOwnProperty.call(data, 'diagnostics')
  )) {
    result = data.result === undefined ? null : data.result;
    changes = Array.isArray(data.changes) ? data.changes : serverResponseAsArray_(data.changes);
    meta = data.meta && typeof data.meta === 'object' ? Object.assign({}, data.meta) : {};
    diagnostics = data.diagnostics || null;
  }

  return buildServerResponseEnvelope_(
    success,
    message,
    error,
    result,
    changes,
    meta,
    diagnostics,
    context,
    warnings
  );
}

function buildServerResponse_(success, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9) {
  if (arguments.length <= 6) {
    return buildSimpleServerResponse_(success, arg2, arg3, arg4, arg5, arg6);
  }

  return buildServerResponseEnvelope_(success, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9);
}

function okResponse_(data, message, context, warnings) {
  return buildSimpleServerResponse_(true, data, message || '', null, context || null, warnings || []);
}

function warnResponse_(data, message, context, warnings) {
  return buildSimpleServerResponse_(true, data, message || '', null, context || null, warnings || []);
}

function errorResponse_(error, arg2, arg3, arg4, arg5) {
  const message = error && error.message ? String(error.message) : String(error || 'Невідома помилка');

  let uiMessage = '';
  let context = null;
  let data = null;
  let warnings = [];

  if (typeof arg2 === 'string') {
    uiMessage = arg2 || '';
    context = arg3 || null;
    data = arg4 === undefined ? null : arg4;
    warnings = Array.isArray(arg5) ? arg5 : [];
  } else {
    context = arg2 || null;
    data = arg3 === undefined ? null : arg3;
    warnings = Array.isArray(arg4) ? arg4 : [];
  }

  return buildSimpleServerResponse_(false, data, uiMessage, message, context, warnings);
}

function normalizeServerResponse_(value, functionName, context) {
  const baseContext = Object.assign({ function: functionName || '' }, context || {});

  if (value && typeof value === 'object' && 'success' in value && 'data' in value && 'context' in value) {
    const rawData = value.data;
    let result = null;
    let changes = [];
    let meta = {};
    let diagnostics = value.diagnostics || null;

    if (rawData && typeof rawData === 'object' && (
      Object.prototype.hasOwnProperty.call(rawData, 'result') ||
      Object.prototype.hasOwnProperty.call(rawData, 'changes') ||
      Object.prototype.hasOwnProperty.call(rawData, 'meta') ||
      Object.prototype.hasOwnProperty.call(rawData, 'diagnostics')
    )) {
      result = rawData.result === undefined ? null : rawData.result;
      changes = Array.isArray(rawData.changes) ? rawData.changes : serverResponseAsArray_(rawData.changes);
      meta = rawData.meta && typeof rawData.meta === 'object' ? Object.assign({}, rawData.meta) : {};
      diagnostics = rawData.diagnostics || diagnostics;
    } else {
      result = rawData === undefined ? null : rawData;
      changes = [];
      meta = {};
    }

    meta = mergeServerResponseTopLevelMeta_(value, meta);

    return buildServerResponseEnvelope_(
      value.success,
      value.message || '',
      value.error || null,
      result,
      changes,
      meta,
      diagnostics,
      Object.assign({}, baseContext, value.context || {}),
      normalizeServerWarnings_(value.warnings)
    );
  }

  if (value && typeof value === 'object' && 'ok' in value && !('success' in value)) {
    const data = Object.assign({}, value);
    const success = !!data.ok;
    delete data.ok;
    if (success) {
      return okResponse_(data, '', baseContext);
    }
    return errorResponse_(data.error || 'Операція не виконана', baseContext, data);
  }

  if (typeof value === 'boolean') {
    return buildSimpleServerResponse_(value, { value: value }, '', value ? null : 'Операція повернула false', baseContext, []);
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return okResponse_({ value: value }, '', baseContext);
  }

  if (value === undefined) {
    return okResponse_(null, '', baseContext);
  }

  if (Array.isArray(value)) {
    return okResponse_(value, '', baseContext);
  }

  if (value && typeof value === 'object') {
    return okResponse_(value, '', baseContext);
  }

  return okResponse_(null, '', baseContext);
}

function withResponseContext_(response, extraContext) {
  const normalized = normalizeServerResponse_(response, '', {});
  normalized.context = Object.assign({}, normalized.context || {}, extraContext || {});
  return normalized;
}

function appendWarnings_(response, warnings) {
  const normalized = normalizeServerResponse_(response, '', {});
  normalized.warnings = normalizeServerWarnings_(
    []
      .concat(normalized.warnings || [])
      .concat(Array.isArray(warnings) ? warnings : [warnings])
  );
  return normalized;
}

function apiExecute_(functionName, context, handler) {
  const safeContext = Object.assign({ function: functionName }, context || {});
  try {
    const raw = handler();
    const response = normalizeServerResponse_(raw, functionName, safeContext);
    response.context = Object.assign({}, safeContext, response.context || {});
    return response;
  } catch (e) {
    return errorResponse_(e, safeContext);
  }
}

function ensureApiSuccess_(response, fallbackMessage) {
  const normalized = normalizeServerResponse_(response, '', {});
  if (!normalized.success) {
    throw buildContextError_(
      normalized.context && normalized.context.function ? normalized.context.function : 'ensureApiSuccess_',
      normalized.context,
      normalized.error || fallbackMessage || 'Server-side response is not successful'
    );
  }
  return normalized;
}

function buildContextError_(functionName, context, errorOrMessage) {
  const base = errorOrMessage && errorOrMessage.message
    ? String(errorOrMessage.message)
    : String(errorOrMessage || 'Невідома помилка');

  const parts = ['[' + functionName + ']'];
  const ctx = context || {};

  Object.keys(ctx).forEach(function(key) {
    const value = ctx[key];
    if (value === '' || value === null || value === undefined) return;
    parts.push(key + '=' + value);
  });

  parts.push(base);
  return new Error(parts.join(' '));
}
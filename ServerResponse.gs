/**
 * ServerResponse.gs — канонічний контракт server-side API для stage 3.
 */

const SERVER_RESPONSE_VERSION_ = '3.0.0';

function buildServerResponse_(success, data, message, error, context, warnings) {
  return {
    success: !!success,
    message: String(message || ''),
    error: error ? String(error) : null,
    data: data === undefined ? null : data,
    context: context || null,
    warnings: Array.isArray(warnings) ? warnings.filter(Boolean).map(String) : []
  };
}

function okResponse_(data, message, context, warnings) {
  return buildServerResponse_(true, data, message || '', null, context || null, warnings || []);
}

function warnResponse_(data, message, context, warnings) {
  return buildServerResponse_(true, data, message || '', null, context || null, warnings || []);
}

function errorResponse_(error, arg2, arg3, arg4, arg5) {
  const message = error && error.message ? String(error.message) : String(error || 'Невідома помилка');

  // Підтримка старих сигнатур:
  // errorResponse_(error, context)
  // errorResponse_(error, context, data)
  // errorResponse_(error, message, context, data, warnings)
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

  return buildServerResponse_(false, data, uiMessage, message, context, warnings);
}

function normalizeServerResponse_(value, functionName, context) {
  const baseContext = Object.assign({ function: functionName || '' }, context || {});

  if (value && typeof value === 'object' && 'success' in value && 'data' in value && 'context' in value) {
    return {
      success: !!value.success,
      message: String(value.message || ''),
      error: value.error ? String(value.error) : null,
      data: value.data === undefined ? null : value.data,
      context: value.context || baseContext,
      warnings: Array.isArray(value.warnings) ? value.warnings.filter(Boolean).map(String) : []
    };
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
    return buildServerResponse_(value, { value: value }, '', value ? null : 'Операція повернула false', baseContext, []);
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
  const merged = []
    .concat(normalized.warnings || [])
    .concat(Array.isArray(warnings) ? warnings : [warnings])
    .filter(Boolean)
    .map(String);
  normalized.warnings = merged;
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

  const parts = [`[${functionName}]`];
  const ctx = context || {};
  Object.keys(ctx).forEach(function(key) {
    const value = ctx[key];
    if (value === '' || value === null || value === undefined) return;
    parts.push(`${key}=${value}`);
  });
  parts.push(base);
  return new Error(parts.join(' '));
}
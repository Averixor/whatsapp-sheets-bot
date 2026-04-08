
/**
 * TemplateResolver.gs — stage 7 template resolution / validation layer.
 */

const TemplateResolver_ = (function() {
  function _missingKeys(template, data) {
    const keys = [];
    String(template || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}|\{\s*([a-zA-Z0-9_]+)\s*\}/g, function(_, keyDouble, keySingle) {
      const normalized = String(keyDouble || keySingle || '').trim();
      if (!normalized) return _;
      const input = data || {};
      const hasValue = Object.prototype.hasOwnProperty.call(input, normalized)
        || Object.prototype.hasOwnProperty.call(input, normalized.toLowerCase())
        || Object.prototype.hasOwnProperty.call(input, normalized.toUpperCase());
      if (!hasValue) {
        keys.push(normalized);
      }
      return _;
    });
    return [...new Set(keys)];
  }

  function resolve(key, data, options) {
    const descriptor = TemplateRegistry_.get(String(key || '').trim());
    const sourceText = descriptor.managed || descriptor.fallback || '';
    const input = data || {};
    const missing = _missingKeys(sourceText, input);
    const rendered = sourceText ? renderTemplate_(sourceText, input) : '';

    const opts = options || {};
    const preview = opts.preview === true;
    const maxLen = Number(opts.maxLen) || STAGE7_CONFIG.TEMPLATE_PREVIEW_LIMIT;
    const text = preview && rendered.length > maxLen ? rendered.slice(0, maxLen) + '…' : rendered;

    return {
      key: descriptor.key,
      source: descriptor.source,
      text: text,
      rawTemplate: sourceText,
      missingKeys: missing,
      ok: !!sourceText,
      preview: preview,
      versionMarker: descriptor.source === 'managed-sheet' ? 'managed-v1' : 'fallback-v1'
    };
  }

  function validate(key) {
    const resolved = resolve(key, {}, { preview: true, maxLen: 120 });
    return {
      key: resolved.key,
      ok: resolved.ok,
      source: resolved.source,
      missingKeys: resolved.missingKeys,
      versionMarker: resolved.versionMarker
    };
  }

  return {
    resolve: resolve,
    validate: validate
  };
})();
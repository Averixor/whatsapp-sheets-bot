
/**
 * TemplateRegistry.gs — stage 5 template governance registry.
 */

const TemplateRegistry_ = (function() {
  function _sheetTemplates() {
    try {
      return _loadTemplatesMap_() || {};
    } catch (_) {
      return {};
    }
  }

  function list() {
    const fallbacks = typeof STAGE4_INLINE_TEMPLATES_ === 'object' ? STAGE4_INLINE_TEMPLATES_ : {};
    const managed = _sheetTemplates();

    return [...new Set(Object.keys(fallbacks).concat(Object.keys(managed)))].sort().map(function(key) {
      return {
        key: key,
        source: managed[key] ? 'managed-sheet' : 'system-fallback',
        managed: !!managed[key],
        hasFallback: !!fallbacks[key],
        preview: Stage4Templates_.preview(key, {}, { maxLen: 120 })
      };
    });
  }

  function get(key) {
    const managed = _sheetTemplates();
    const fallback = typeof STAGE4_INLINE_TEMPLATES_ === 'object' ? STAGE4_INLINE_TEMPLATES_[key] : '';
    return {
      key: key,
      managed: managed[key] || '',
      fallback: fallback || '',
      source: managed[key] ? 'managed-sheet' : (fallback ? 'system-fallback' : 'missing')
    };
  }

  return {
    list: list,
    get: get
  };
})();
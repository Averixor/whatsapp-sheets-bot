// ===== FILE: WorkflowOrchestrator.gs =====

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


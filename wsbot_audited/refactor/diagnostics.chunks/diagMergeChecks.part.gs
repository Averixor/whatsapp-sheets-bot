function _diagMergeChecks_() {
  var merged = [];
  var seen = {};

  Array.prototype.slice.call(arguments).forEach(function(part) {
    (part || []).forEach(function(item) {
      var normalized = _diagNormalizeCheck_(item);
      var key = [normalized.title, normalized.status, normalized.details, normalized.howTo].join(' | ');
      if (seen[key]) return;
      seen[key] = true;
      merged.push(normalized);
    });
  });

  return merged;
}

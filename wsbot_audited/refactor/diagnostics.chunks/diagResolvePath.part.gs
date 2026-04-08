function _diagResolvePath_(scope, path) {
  var parts = String(path || '').trim().split('.').filter(Boolean);
  var current = scope;
  for (var i = 0; i < parts.length; i++) {
    if (!current || !(parts[i] in current)) return undefined;
    current = current[parts[i]];
  }
  return current;
}

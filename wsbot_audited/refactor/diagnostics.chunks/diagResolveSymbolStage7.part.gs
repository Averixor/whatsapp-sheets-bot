function _diagResolveSymbolStage7_(name) {
  var target = String(name || '').trim();
  if (!target) return undefined;

  var directKnown = _diagResolveKnownSymbolStage7_(target);
  if (directKnown !== undefined) return directKnown;

  if (target.indexOf('.') > -1) {
    var parts = target.split('.').filter(Boolean);
    if (parts.length) {
      var rootSymbol = _diagResolveKnownSymbolStage7_(parts[0]);
      if (rootSymbol !== undefined) {
        var nested = _diagResolvePath_(rootSymbol, parts.slice(1).join('.'));
        if (nested !== undefined) return nested;
      }
    }
  }

  try {
    var g = _diagGlobal_();
    var direct = _diagResolvePath_(g, target);
    if (direct !== undefined) return direct;
  } catch (_) {}

  if (_diagHasRouteApi_(target)) {
    return function routeApiProxyPlaceholder_() {};
  }

  return undefined;
}

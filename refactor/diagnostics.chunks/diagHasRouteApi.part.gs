function _diagHasRouteApi_(fnName) {
  var target = String(fnName || '').trim();
  if (!target) return false;

  try {
    if (typeof getRoutingRouteByApiMethod_ === 'function') {
      return !!getRoutingRouteByApiMethod_(target);
    }
  } catch (_) {}

  try {
    if (typeof listRoutingRoutes_ === 'function') {
      return (listRoutingRoutes_() || []).some(function(item) {
        return item && item.publicApiMethod === target;
      });
    }
  } catch (_) {}

  try {
    if (typeof getRoutingRegistry_ === 'function') {
      var routes = getRoutingRegistry_();
      if (Array.isArray(routes)) {
        return routes.some(function(item) { return item && item.publicApiMethod === target; });
      }
      if (routes && typeof routes === 'object') {
        return Object.keys(routes).some(function(key) {
          return routes[key] && routes[key].publicApiMethod === target;
        });
      }
    }
  } catch (_) {}

  return false;
}

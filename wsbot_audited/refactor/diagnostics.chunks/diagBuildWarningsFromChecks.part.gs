function _diagBuildWarningsFromChecks_(checks) {
  return (checks || [])
    .filter(function(item) { return item && item.status === 'WARN'; })
    .map(function(item) { return item.title; });
}

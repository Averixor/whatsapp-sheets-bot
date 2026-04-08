function _diagBuildReport_(checks, mode, summaryPrefix) {
  var list = Array.isArray(checks) ? checks : [];
  var counts = _diagBuildCounts_(list);
  return {
    ok: counts.failures === 0,
    stage: '7.1',
    mode: mode || 'full',
    checks: list,
    warnings: _diagBuildWarningsFromChecks_(list),
    counts: counts,
    summary: counts.failures === 0
      ? ((summaryPrefix || _releaseStageLabel_()) + '. Warnings: ' + counts.warnings + ', pseudo: ' + counts.pseudo)
      : ((summaryPrefix || _releaseStageLabel_()) + '. Failures: ' + counts.failures + ', warnings: ' + counts.warnings + ', pseudo: ' + counts.pseudo),
    ts: new Date().toISOString()
  };
}

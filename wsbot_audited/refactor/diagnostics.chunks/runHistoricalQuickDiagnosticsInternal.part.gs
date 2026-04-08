function runHistoricalQuickDiagnosticsInternal_(options) {
  const opts = options || {};
  const structural = runHistoricalStructuralDiagnosticsInternal_({ mode: 'quick' });
  const checks = structural.checks.filter(function(item) {
    return String(item.name || '').indexOf('Entrypoint ') === 0
      || String(item.name || '').indexOf('Client route ') === 0
      || String(item.name || '').indexOf('Required doc marker ') === 0
      || item.name === 'Project bundle metadata'
      || item.name === 'Canonical HTML helper';
  });

  return {
    ok: checks.filter(function(item) { return item.status === 'FAIL'; }).length === 0,
    status: checks.some(function(item) { return item.status === 'FAIL'; }) ? 'FAIL' : 'OK',
    stage: (typeof getProjectBundleMetadata_ === 'function' ? getProjectBundleMetadata_().stageVersion : '7.1.2-final-clean'),
    mode: opts.mode || 'quick',
    checks: checks,
    warnings: [],
    summary: 'Historical quick lineage diagnostics завершено',
    ts: new Date().toISOString()
  };
}

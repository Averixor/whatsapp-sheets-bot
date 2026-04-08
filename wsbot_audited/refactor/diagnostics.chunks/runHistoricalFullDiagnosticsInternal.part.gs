function runHistoricalFullDiagnosticsInternal_(options) {
  const opts = options || {};
  const structural = runHistoricalStructuralDiagnosticsInternal_({ mode: 'full' });
  const compatibility = runHistoricalCompatibilityDiagnosticsInternal_({ mode: 'full' });
  const checks = []
    .concat(runStage41ProjectConsistencyCheck_())
    .concat(structural.checks || [])
    .concat(compatibility.checks || []);
  const warnings = stage7MergeWarnings_(structural.warnings || [], compatibility.warnings || []);

  return {
    ok: checks.filter(function(item) { return item.status === 'FAIL'; }).length === 0,
    status: checks.some(function(item) { return item.status === 'FAIL'; }) ? 'FAIL' : 'OK',
    stage: (typeof getProjectBundleMetadata_ === 'function' ? getProjectBundleMetadata_().stageVersion : '7.1.2-final-clean'),
    mode: opts.mode || 'full',
    checks: checks,
    warnings: warnings,
    summary: 'Historical full lineage diagnostics завершено',
    ts: new Date().toISOString()
  };
}

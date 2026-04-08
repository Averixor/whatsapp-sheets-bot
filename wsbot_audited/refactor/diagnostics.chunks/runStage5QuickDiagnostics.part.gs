function runQuickDiagnostics_(options) {
  var opts = options || {};
  var legacyHealth = _diagNormalizeReportChecks_(healthCheck(), 'Health');
  var stage7 = _diagBuildStage7CoreChecks_({ includeRuntimeTemplate: false });
  var checks = _diagMergeChecks_(legacyHealth, stage7);
  return _diagBuildReport_(checks, opts.mode || 'quick', 'Stage 7 quick diagnostics');
}

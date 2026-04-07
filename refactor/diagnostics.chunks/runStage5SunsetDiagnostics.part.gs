function runSunsetDiagnostics_(options) {
  var opts = options || {};
  var checks = [];
  _diagAppendCompatibilitySplitCheck_(checks);
  return _diagBuildReport_(_diagNormalizeReportChecks_({ checks: checks }), opts.mode || 'compatibility sunset', 'Stage 7 compatibility diagnostics');
}

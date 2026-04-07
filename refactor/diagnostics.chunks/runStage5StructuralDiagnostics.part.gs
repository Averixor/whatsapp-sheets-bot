function runStructuralDiagnostics_(options) {
  var opts = options || {};
  var checks = _diagMergeChecks_(
    _diagNormalizeReportChecks_(checkSheets(), 'Sheets'),
    _diagNormalizeReportChecks_(checkFiles(), 'Files'),
    _diagBuildStage7CoreChecks_(opts)
  );
  return _diagBuildReport_(checks, opts.mode || 'structural', 'Stage 7 structural diagnostics');
}

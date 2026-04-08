function runFullDiagnostics_(options) {
  var opts = options || {};
  var extra = [];
  _diagAppendPendingRepairsCheck_(extra);
  _diagAppendCompatibilitySplitCheck_(extra);
  _diagAppendLifecyclePolicyCheck_(extra);

  var checks = _diagMergeChecks_(
    _diagNormalizeReportChecks_(healthCheck(), 'Health'),
    _diagNormalizeReportChecks_(checkSheets(), 'Sheets'),
    _diagNormalizeReportChecks_(checkFiles(), 'Files'),
    _diagNormalizeReportChecks_(checkDuplicates(), 'Duplicates'),
    _diagNormalizeReportChecks_(testFunctions(), 'Functions'),
    _diagBuildStage7CoreChecks_(opts),
    _diagNormalizeReportChecks_({ checks: extra })
  );

  return _diagBuildReport_(checks, opts.mode || 'full', _releaseStageLabel_());
}

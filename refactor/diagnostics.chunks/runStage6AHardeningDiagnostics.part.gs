function runHardeningDiagnostics_(options) {
  var opts = options || {};
  var extra = [];
  _diagAppendPendingRepairsCheck_(extra);
  _diagAppendLifecyclePolicyCheck_(extra);
  var checks = _diagMergeChecks_(
    _diagBuildStage7CoreChecks_(opts),
    _diagNormalizeReportChecks_({ checks: extra })
  );
  return _diagBuildReport_(checks, opts.mode || 'stage7-hardening', 'Stage 7 lifecycle hardening diagnostics');
}

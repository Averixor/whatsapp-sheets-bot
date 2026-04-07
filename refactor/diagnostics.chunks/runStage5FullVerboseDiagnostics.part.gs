function runFullVerboseDiagnostics_(options) {
  var base = runFullDiagnostics_(options || {});
  var hardening = runHardeningDiagnostics_({ mode: 'stage7-hardening' });
  return _diagBuildReport_(
    _diagMergeChecks_(base.checks || [], hardening.checks || []),
    'full-verbose',
    (base.ok && hardening.ok) ? (_releaseStageLabel_() + ' verbose diagnostics OK') : (_releaseStageLabel_() + ' verbose diagnostics потребують уваги')
  );
}

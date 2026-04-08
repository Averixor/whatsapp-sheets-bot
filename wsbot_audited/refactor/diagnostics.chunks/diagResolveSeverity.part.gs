function _diagResolveSeverity_(status, rawSeverity) {
  var sev = String(rawSeverity || '').toUpperCase();
  if (sev) return sev;
  var s = _diagNormalizeStatus_(status);
  if (s === 'FAIL') return 'CRITICAL';
  if (s === 'WARN') return 'WARN';
  return 'INFO';
}

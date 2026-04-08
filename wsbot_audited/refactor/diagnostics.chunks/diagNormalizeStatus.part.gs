function _diagNormalizeStatus_(status) {
  var normalized = String(status || 'WARN').toUpperCase();
  if (normalized === 'ERROR') return 'FAIL';
  if (normalized === 'CRITICAL') return 'FAIL';
  if (normalized === 'SUCCESS') return 'OK';
  if (normalized === 'COMPAT') return 'PSEUDO';
  if (normalized === 'LEGACY-COMPAT') return 'PSEUDO';
  if (normalized === 'PSEUDO-COMPAT') return 'PSEUDO';
  return normalized;
}

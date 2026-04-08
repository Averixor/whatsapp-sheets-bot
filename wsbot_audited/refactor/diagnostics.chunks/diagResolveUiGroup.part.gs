function _diagResolveUiGroup_(check) {
  var explicit = String(check && check.uiGroup || '').toLowerCase();
  if (explicit === 'critical' || explicit === 'warnings' || explicit === 'pseudo' || explicit === 'compatibility' || explicit === 'ok') {
    return explicit === 'compatibility' ? 'pseudo' : explicit;
  }

  var status = _diagNormalizeStatus_(check && check.status);
  var looksPseudo = _diagIsPseudoLikeCheck_(check);

  if (status === 'FAIL') return 'critical';
  if (status === 'WARN') return 'warnings';
  if (status === 'PSEUDO' || (looksPseudo && status === 'OK')) return 'pseudo';
  return 'ok';
}

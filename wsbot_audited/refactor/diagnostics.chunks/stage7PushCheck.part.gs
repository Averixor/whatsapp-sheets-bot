function _stage7PushCheck_(checks, name, status, details, recommendation) {
  let normalizedStatus = _diagNormalizeStatus_(status || 'OK');

  const lowerName = String(name || '').toLowerCase();
  const lowerDetails = String(details || '').toLowerCase();

  const pseudoLike =
    normalizedStatus === 'PSEUDO' ||
    lowerName.indexOf('deprecated ') === 0 ||
    lowerName.indexOf('compatibility ') === 0 ||
    lowerName.indexOf('wrapper source ') === 0 ||
    lowerName.indexOf('ui-ban marker ') === 0 ||
    lowerDetails.indexOf('compatibility-only') !== -1 ||
    lowerDetails.indexOf('замінити на ') !== -1 ||
    lowerDetails.indexOf('compatibility wrappers intentionally remain') !== -1;

  if (pseudoLike && normalizedStatus === 'OK') {
    normalizedStatus = 'PSEUDO';
  }

  let severity = 'INFO';
  if (normalizedStatus === 'FAIL') severity = 'CRITICAL';
  else if (normalizedStatus === 'WARN') severity = 'WARN';

  let uiGroup = 'ok';

  if (normalizedStatus === 'FAIL' || (normalizedStatus === 'WARN' && severity === 'CRITICAL')) {
    uiGroup = 'critical';
  } else if (normalizedStatus === 'WARN') {
    uiGroup = 'warnings';
  } else if (normalizedStatus === 'PSEUDO') {
    uiGroup = 'pseudo';
  }

  checks.push({
    name: name,
    title: name,
    status: normalizedStatus,
    ok: normalizedStatus === 'OK',
    pseudo: normalizedStatus === 'PSEUDO',
    severity: severity,
    uiGroup: uiGroup,
    details: details || '',
    message: details || '',
    recommendation: recommendation || '',
    howTo: recommendation || ''
  });
}

function _diagNormalizeCheck_(check, titlePrefix) {
  var title = String((check && (check.title || check.name)) || '').trim();
  if (!title) title = 'Unnamed check';
  if (titlePrefix) {
    var pref = String(titlePrefix).trim();
    if (pref && title.indexOf(pref + ' / ') !== 0) title = pref + ' / ' + title;
  }

  var details = String((check && (check.details || check.message)) || '').trim();
  var rawCheck = Object.assign({}, check || {}, { title: title, name: title, details: details, message: details });
  var status = _diagNormalizeStatus_(rawCheck.status);
  if (_diagIsPseudoLikeCheck_(rawCheck) && status === 'OK') {
    status = 'PSEUDO';
  }

  var howTo = String((check && (check.howTo || check.recommendation)) || '').trim();
  var severity = _diagResolveSeverity_(status, check && check.severity);

  return {
    name: title,
    title: title,
    status: status,
    ok: status === 'OK',
    pseudo: status === 'PSEUDO',
    severity: severity,
    uiGroup: _diagResolveUiGroup_(Object.assign({}, rawCheck, { status: status })),
    details: details,
    message: details,
    howTo: howTo,
    recommendation: howTo
  };
}

function _diagIsPseudoLikeCheck_(check) {
  var explicitStatus = String(check && check.status || '').toUpperCase();
  if (explicitStatus === 'PSEUDO' || explicitStatus === 'COMPAT' || explicitStatus === 'LEGACY-COMPAT' || explicitStatus === 'PSEUDO-COMPAT') {
    return true;
  }

  var title = String((check && (check.title || check.name)) || '').toLowerCase();
  var details = String((check && (check.details || check.message)) || '').toLowerCase();

  return title.indexOf('deprecated ') === 0 ||
    title.indexOf('compatibility ') === 0 ||
    title.indexOf('wrapper source ') === 0 ||
    title.indexOf('ui-ban marker ') === 0 ||
    details.indexOf('compatibility-only') !== -1 ||
    details.indexOf('замінити на ') !== -1 ||
    details.indexOf('compatibility wrappers intentionally remain') !== -1;
}

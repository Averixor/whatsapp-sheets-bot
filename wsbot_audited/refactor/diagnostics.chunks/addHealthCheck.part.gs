function _addHealthCheck_(report, item) {
  const status = String(item.status || 'OK').toUpperCase();
  const severity = String(item.severity || (status === 'FAIL' ? 'CRITICAL' : (status === 'WARN' ? 'WARN' : 'INFO'))).toUpperCase();
  const ok = status === 'OK';
  const pseudo = status === 'PSEUDO';

  report.checks.push({
    title: String(item.title || ''),
    ok: ok,
    pseudo: pseudo,
    status: status,
    severity: severity,
    details: String(item.details || ''),
    howTo: String(item.howTo || '')
  });

  if (status === 'FAIL') {
    report.ok = false;
  }
}

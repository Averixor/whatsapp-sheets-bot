function _runHealthCheckItem_(report, title, severity, fn) {
  try {
    const result = fn() || {};

    _addHealthCheck_(report, {
      title: title,
      status: result.status || 'OK',
      severity: result.severity || severity || 'INFO',
      details: result.details || '',
      howTo: result.howTo || ''
    });
  } catch (e) {
    _addHealthCheck_(report, {
      title: title,
      status: 'FAIL',
      severity: severity || 'CRITICAL',
      details: _errMsg_(e),
      howTo: 'Перевір код цієї перевірки та залежні функції'
    });
  }
}

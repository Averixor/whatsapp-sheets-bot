function testFunctions() {
  const report = _makeReport_('🧪 ТЕСТ ФУНКЦІЙ');

  try {
    try {
      const today = _todayStr_();
      _pushCheck_(report, {
        type: 'test_function',
        name: '_todayStr_',
        status: /^\d{2}\.\d{2}\.\d{4}$/.test(today) ? 'OK' : 'ERROR',
        message: '✓ _todayStr_() → ' + today
      });
    } catch (e) {
      _pushCheck_(report, {
        type: 'test_function',
        name: '_todayStr_',
        status: 'ERROR',
        message: '✕ _todayStr_(): ' + _safeErr_(e)
      });
    }

    try {
      const d = _parseUaDate_('12.03.2026');
      _pushCheck_(report, {
        type: 'test_function',
        name: '_parseUaDate_',
        status: d instanceof Date ? 'OK' : 'ERROR',
        message: d instanceof Date
          ? '✓ _parseUaDate_() працює'
          : '✕ _parseUaDate_() не змогла розібрати дату'
      });
    } catch (e) {
      _pushCheck_(report, {
        type: 'test_function',
        name: '_parseUaDate_',
        status: 'ERROR',
        message: '✕ _parseUaDate_(): ' + _safeErr_(e)
      });
    }

    try {
      const f = _formatPhoneDisplay_('+380661234567');
      _pushCheck_(report, {
        type: 'test_function',
        name: '_formatPhoneDisplay_',
        status: f ? 'OK' : 'ERROR',
        message: f
          ? '✓ _formatPhoneDisplay_() → ' + f
          : '✕ _formatPhoneDisplay_() повернула порожнє значення'
      });
    } catch (e) {
      _pushCheck_(report, {
        type: 'test_function',
        name: '_formatPhoneDisplay_',
        status: 'ERROR',
        message: '✕ _formatPhoneDisplay_(): ' + _safeErr_(e)
      });
    }

    try {
      const hc = healthCheck();
      _pushCheck_(report, {
        type: 'test_function',
        name: 'healthCheck',
        status: hc && Array.isArray(hc.checks) ? 'OK' : 'ERROR',
        message: hc && Array.isArray(hc.checks)
          ? '✓ healthCheck() повернув звіт'
          : '✕ healthCheck() повернув невалідні дані'
      });
    } catch (e) {
      _pushCheck_(report, {
        type: 'test_function',
        name: 'healthCheck',
        status: 'ERROR',
        message: '✕ healthCheck(): ' + _safeErr_(e)
      });
    }

  } catch (e) {
    report.status = 'ERROR';
    report.errors.push('Помилка testFunctions: ' + _safeErr_(e));
  }

  DIAGNOSTICS.results.functions = report;
  return report;
}

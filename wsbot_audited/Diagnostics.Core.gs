const DIAGNOSTICS = {
  testMode: true,
  results: {}
};
function setTestMode(enabled) {
  DIAGNOSTICS.testMode = !!enabled;
  return { success: true, testMode: DIAGNOSTICS.testMode };
}
function isTestMode() {
  return !!(DIAGNOSTICS && DIAGNOSTICS.testMode);
}
function _getSS_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Не вдалося отримати активну таблицю');
  return ss;
}
function _global_() {
  return Function('return this')();
}
function _errMsg_(e) {
  try {
    return String(e && e.message ? e.message : e);
  } catch (_) {
    return String(e);
  }
}
function _safeErr_(e) {
  try {
    return String(e && e.message ? e.message : e);
  } catch (_) {
    return 'Невідома помилка';
  }
}

/**
 * healthCheck() — перевірка стану системи
 * Викликається кнопкою "🩺 Перевірити" з сайдбару
 */
/************ HEALTH CHECK ************/
function _pushCheck_(report, check) {
  report.checks.push(check);

  if (check.status === 'ERROR') {
    report.status = 'ERROR';
    report.errors.push(check.message || check.name || 'Помилка перевірки');
  } else if (check.status === 'WARN' && report.status !== 'ERROR') {
    report.status = 'WARN';
  }
}
function _makeReport_(name) {
  return {
    name: name,
    timestamp: new Date().toISOString(),
    status: 'OK',
    checks: [],
    errors: []
  };
}

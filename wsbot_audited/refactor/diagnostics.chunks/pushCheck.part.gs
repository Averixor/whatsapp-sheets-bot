function _pushCheck_(report, check) {
  report.checks.push(check);

  if (check.status === 'ERROR') {
    report.status = 'ERROR';
    report.errors.push(check.message || check.name || 'Помилка перевірки');
  } else if (check.status === 'WARN' && report.status !== 'ERROR') {
    report.status = 'WARN';
  }
}

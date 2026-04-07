function checkSheets() {
  const report = _makeReport_('📄 ПЕРЕВІРКА ЛИСТІВ');

  try {
    const ss = _getSS_();
    const sheets = ss.getSheets().map(function (s) {
      return s.getName();
    });

    const requiredSheets = [
      { name: CONFIG.TARGET_SHEET || '02', required: true },
      { name: CONFIG.PHONES_SHEET || 'PHONES', required: true },
      { name: CONFIG.DICT_SHEET || 'DICT', required: true },
      { name: CONFIG.DICT_SUM_SHEET || 'DICT_SUM', required: true },
      { name: CONFIG.LOG_SHEET || 'LOG', required: false },
      { name: 'VACATIONS', required: false },
      { name: 'TEMPLATES', required: false }
    ];

    requiredSheets.forEach(function (item) {
      const exists = sheets.indexOf(item.name) !== -1;

      _pushCheck_(report, {
        type: 'sheet_exists',
        name: item.name,
        status: exists ? 'OK' : (item.required ? 'ERROR' : 'WARN'),
        message: exists
          ? '✓ Лист "' + item.name + '" знайдено'
          : (item.required
            ? '✕ Обов\'язковий лист "' + item.name + '" не знайдено'
            : '⚠ Лист "' + item.name + '" не знайдено')
      });
    });

    const existingMonths = [];
    for (let i = 1; i <= 12; i++) {
      const monthName = String(i).padStart(2, '0');
      if (sheets.indexOf(monthName) !== -1) {
        existingMonths.push(monthName);
      }
    }

    _pushCheck_(report, {
      type: 'month_sheets',
      name: 'month_sheets',
      status: existingMonths.length > 0 ? 'OK' : 'WARN',
      message: existingMonths.length > 0
        ? '✓ Місячні листи: ' + existingMonths.join(', ')
        : '⚠ Не знайдено жодного місячного листа'
    });

  } catch (e) {
    report.status = 'ERROR';
    report.errors.push('Помилка checkSheets: ' + _safeErr_(e));
  }

  DIAGNOSTICS.results.sheets = report;
  return report;
}

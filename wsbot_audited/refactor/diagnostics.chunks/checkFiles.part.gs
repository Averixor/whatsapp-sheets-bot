function checkFiles() {
  const report = _makeReport_('📁 ПЕРЕВІРКА ПРОЄКТУ');

  try {
    const requiredFunctions = [
      { name: 'getDaySummaryByDate', required: true },
      { name: 'getDetailedDaySummaryByDate', required: true },
      { name: 'runVacationEngine_', required: true },
      { name: 'getTemplateText_', required: true },
      { name: 'getPersonCardData', required: true },
      { name: '_buildPersonCardData_', required: true },
      { name: 'healthCheck', required: true },
      { name: 'setupVacationTrigger', required: true },
      { name: 'generateSendPanelSidebar', required: true },
      { name: 'markMultipleAsSentFromSidebar', required: true },
      { name: 'loadPhonesMap_', required: true },
      { name: 'loadDictMap_', required: true },
      { name: 'buildPayloadForCell_', required: true },
      { name: 'findTodayColumn_', required: true },
      { name: 'normalizeDate_', required: true },
      { name: 'buildMessage_', required: true },
      { name: 'trimToEncoded_', required: true }
    ];

    requiredFunctions.forEach(function (func) {
      const exists = _fnExists_(func.name);

      _pushCheck_(report, {
        type: 'function_exists',
        name: func.name,
        status: exists ? 'OK' : (func.required ? 'ERROR' : 'WARN'),
        message: exists
          ? '✓ ' + func.name + ' існує'
          : '✕ ' + func.name + ' не знайдена'
      });
    });

  } catch (e) {
    report.status = 'ERROR';
    report.errors.push('Помилка checkFiles: ' + _safeErr_(e));
  }

  DIAGNOSTICS.results.files = report;
  return report;
}

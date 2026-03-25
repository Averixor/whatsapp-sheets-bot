/**
 * Stage3ServerApi.gs — backward-compatible public API поверх stage 4 use-cases.
 */

function _apiBuildWarningsForSendPanel_(payload) {
  const warnings = [];
  if (payload && payload.stats && payload.stats.errorCount > 0) {
    warnings.push(`У SEND_PANEL є рядки з помилками: ${payload.stats.errorCount}`);
  }
  return warnings;
}

function _stage4Meta_(response) {
  return response && response.data && response.data.meta ? response.data.meta : {};
}

function _stage4Result_(response) {
  return response && response.data ? response.data.result : null;
}

function _stage4Warnings_(response) {
  return (response && Array.isArray(response.warnings)) ? response.warnings : [];
}

function _legacyPanelResponseFromStage4_(response) {
  const result = _stage4Result_(response) || {};
  const rows = result.rows || [];
  const stats = result.stats || SendPanelRepository_.buildStats(rows);
  const legacy = okResponse_(rows, response.message || '', Object.assign({}, response.context || {}, {
    operationId: _stage4Meta_(response).operationId || '',
    scenario: _stage4Meta_(response).scenario || ''
  }), _stage4Warnings_(response));
  legacy.rows = rows;
  legacy.stats = stats;
  legacy.month = result.month || getBotMonthSheetName_();
  legacy.date = result.date || _todayStr_();
  legacy.canonicalSource = result.canonicalSource || null;
  legacy.totalCount = stats.totalCount || 0;
  legacy.readyCount = stats.readyCount || 0;
  legacy.errorCount = stats.errorCount || 0;
  legacy.sentCount = stats.sentCount || 0;
  legacy.rowsWritten = result.rowsWritten || rows.length;
  legacy.operationId = _stage4Meta_(response).operationId || '';
  return legacy;
}

function _legacySummaryResponseFromStage4_(response, detailed) {
  const result = _stage4Result_(response) || {};
  const payload = detailed
    ? {
        summary: result.summary || '',
        date: result.date || _todayStr_(),
        peopleCount: result.peopleCount || 0,
        vacations: result.vacations || {},
        birthdays: result.birthdays || {}
      }
    : {
        summary: result.summary || '',
        date: result.date || _todayStr_(),
        vacations: result.vacations || {},
        birthdays: result.birthdays || {}
      };

  return okResponse_(payload, response.message || '', Object.assign({}, response.context || {}, {
    sheet: result.sheet || '',
    date: result.date || _todayStr_()
  }), _stage4Warnings_(response));
}

function apiGetMonthsList() {
  return apiExecute_('apiGetMonthsList', {}, function() {
    return apiStage4GetMonthsList();
  });
}

function apiGetSidebarData(dateStr) {
  return apiExecute_('apiGetSidebarData', {
    date: dateStr || _todayStr_()
  }, function() {
    const response = Stage4UseCases_.loadCalendarDay({ date: dateStr || _todayStr_() });
    if (!response.success) return errorResponse_(response.error || 'Помилка sidebar data', response.context, response.data, response.warnings);
    const result = _stage4Result_(response) || {};
    return okResponse_({
      personnel: result.personnel || [],
      count: (result.personnel || []).length,
      month: result.month || getBotMonthSheetName_(),
      date: result.date || _todayStr_()
    }, response.message || 'Дані sidebar завантажено', Object.assign({}, response.context || {}, {
      sheet: result.month || '',
      date: result.date || _todayStr_()
    }), _stage4Warnings_(response));
  });
}

function apiGenerateSendPanel(options) {
  return apiExecute_('apiGenerateSendPanel', {
    dryRun: !!(options && options.dryRun)
  }, function() {
    const response = Stage4UseCases_.generateSendPanelForDate(options || {});
    if (!response.success) return errorResponse_(response.error || 'Помилка генерації SEND_PANEL', response.context, response.data, response.warnings);
    return _legacyPanelResponseFromStage4_(response);
  });
}

function apiGetSendPanelData() {
  return apiExecute_('apiGetSendPanelData', {}, function() {
    const rows = SendPanelRepository_.readRows();
    const stats = SendPanelRepository_.buildStats(rows);
    const response = okResponse_(rows, 'SEND_PANEL перечитано', {
      sheet: CONFIG.SEND_PANEL_SHEET
    }, _apiBuildWarningsForSendPanel_({ stats: stats }));
    response.rows = rows;
    response.stats = stats;
    response.month = getBotMonthSheetName_();
    response.date = _todayStr_();
    response.totalCount = stats.totalCount;
    response.readyCount = stats.readyCount;
    response.errorCount = stats.errorCount;
    response.sentCount = stats.sentCount;
    return response;
  });
}

function apiMarkSendPanelRowsAsSent(rowNumbers, options) {
  return apiExecute_('apiMarkSendPanelRowsAsSent', {
    requestedRows: Array.isArray(rowNumbers) ? rowNumbers.join(',') : '',
    dryRun: !!(options && options.dryRun)
  }, function() {
    const response = Stage4UseCases_.markPanelRowsAsSent(rowNumbers, options || {});
    if (!response.success) return errorResponse_(response.error || 'Помилка markAsSent', response.context, response.data, response.warnings);
    const result = _stage4Result_(response) || {};
    const rows = result.rows || [];
    const legacy = okResponse_(rows, response.message || '', Object.assign({}, response.context || {}, {
      sheet: CONFIG.SEND_PANEL_SHEET
    }), _stage4Warnings_(response));
    legacy.rows = rows;
    legacy.updatedRows = result.updatedRows || [];
    legacy.stats = result.stats || SendPanelRepository_.buildStats(rows);
    legacy.operationId = _stage4Meta_(response).operationId || '';
    return legacy;
  });
}

function apiGetDaySummary(dateStr) {
  return apiExecute_('apiGetDaySummary', { date: dateStr || _todayStr_() }, function() {
    const response = Stage4UseCases_.buildDaySummary({ date: dateStr || _todayStr_() });
    if (!response.success) return errorResponse_(response.error || 'Помилка формування зведення', response.context, response.data, response.warnings);
    return _legacySummaryResponseFromStage4_(response, false);
  });
}

function apiGetDetailedDaySummary(dateStr) {
  return apiExecute_('apiGetDetailedDaySummary', { date: dateStr || _todayStr_() }, function() {
    const response = Stage4UseCases_.buildDetailedSummary({ date: dateStr || _todayStr_() });
    if (!response.success) return errorResponse_(response.error || 'Помилка формування детального зведення', response.context, response.data, response.warnings);
    return _legacySummaryResponseFromStage4_(response, true);
  });
}

function apiCheckVacations(dateStr) {
  return apiExecute_('apiCheckVacations', { date: dateStr || _todayStr_() }, function() {
    const response = Stage4UseCases_.checkVacationsAndBirthdays({ date: dateStr || _todayStr_() });
    if (!response.success) return errorResponse_(response.error || 'Помилка перевірки відпусток', response.context, response.data, response.warnings);
    const result = _stage4Result_(response) || {};
    const vacations = result.vacations || {};
    const commanderMessages = Array.isArray(vacations.commanderMessages) ? vacations.commanderMessages : [];
    const soldierMessages = Array.isArray(vacations.soldierMessages) ? vacations.soldierMessages : [];

    return okResponse_({
      commanderMessages: commanderMessages,
      soldierMessages: soldierMessages,
      total: commanderMessages.length + soldierMessages.length
    }, commanderMessages.length + soldierMessages.length
      ? `Знайдено повідомлень: ${commanderMessages.length + soldierMessages.length}`
      : 'Немає повідомлень по відпустках', {
      date: dateStr || _todayStr_()
    }, _stage4Warnings_(response));
  });
}

function apiGetBirthdays(dateStr) {
  return apiExecute_('apiGetBirthdays', { date: dateStr || _todayStr_() }, function() {
    const response = Stage4UseCases_.checkVacationsAndBirthdays({ date: dateStr || _todayStr_() });
    if (!response.success) return errorResponse_(response.error || 'Помилка перевірки ДН', response.context, response.data, response.warnings);
    const result = _stage4Result_(response) || {};
    const birthdays = result.birthdays || {};
    const commanderMessages = Array.isArray(birthdays.commanderMessages) ? birthdays.commanderMessages : [];
    const birthdayMessages = Array.isArray(birthdays.birthdayMessages) ? birthdays.birthdayMessages : [];

    return okResponse_({
      commanderMessages: commanderMessages,
      birthdayMessages: birthdayMessages,
      totalCommander: commanderMessages.length,
      totalBirthday: birthdayMessages.length
    }, `Командиру: ${commanderMessages.length}, іменинникам: ${birthdayMessages.length}`, {
      date: dateStr || _todayStr_()
    }, _stage4Warnings_(response));
  });
}

function apiBuildBirthdayLink(phone, name) {
  return apiExecute_('apiBuildBirthdayLink', {
    hasPhone: !!phone
  }, function() {
    const response = apiStage4BuildBirthdayLink(phone, name);
    if (!response.success) return errorResponse_(response.error || 'Не вдалося підготувати привітання', response.context, response.data, response.warnings);
    const result = _stage4Result_(response) || {};
    const legacy = okResponse_(result, response.message || 'Посилання WhatsApp підготовлено', {
      field: 'phone'
    }, _stage4Warnings_(response));
    legacy.link = result.link || '';
    return legacy;
  });
}

function apiGetPersonCardData(callsign, dateStr) {
  return apiExecute_('apiGetPersonCardData', {
    callsign: callsign || '',
    date: dateStr || _todayStr_()
  }, function() {
    const response = Stage4UseCases_.openPersonCard({ callsign: callsign || '', date: dateStr || _todayStr_() });
    if (!response.success) return errorResponse_(response.error || 'Помилка відкриття картки', response.context, response.data, response.warnings);
    const person = _stage4Result_(response) || {};
    return okResponse_(person, response.message || 'Картку бійця зібрано', {
      callsign: person.callsign,
      sheet: person.sheet,
      row: person.row,
      date: person.dateStr
    }, _stage4Warnings_(response));
  });
}

function apiSwitchBotToMonth(monthSheetName) {
  return apiExecute_('apiSwitchBotToMonth', { month: monthSheetName || '' }, function() {
    const validated = validateMonthSwitch_(monthSheetName);
    setBotMonthSheetName_(validated.month);
    return okResponse_({
      month: validated.month
    }, 'Активний місяць перемкнуто', {
      month: validated.month
    });
  });
}

function apiCreateNextMonth() {
  return apiExecute_('apiCreateNextMonth', { activeSheet: getBotMonthSheetName_() }, function() {
    const response = Stage4UseCases_.createNextMonth({ switchToNewMonth: true });
    if (!response.success) return errorResponse_(response.error || 'Помилка створення місяця', response.context, response.data, response.warnings);
    const created = _stage4Result_(response) || {};
    const legacy = okResponse_(created, response.message || 'Місяць створено успішно', {
      activeSheet: created.createdMonth || getBotMonthSheetName_()
    }, _stage4Warnings_(response));
    legacy.month = created.createdMonth || getBotMonthSheetName_();
    legacy.createdMonth = created.createdMonth || '';
    return legacy;
  });
}

function apiSetupVacationTriggers() {
  return apiExecute_('apiSetupVacationTriggers', {}, function() {
    const response = apiStage4SetupVacationTriggers();
    if (!response.success) return errorResponse_(response.error || 'Не вдалося налаштувати тригери', response.context, response.data, response.warnings);
    return okResponse_(_stage4Result_(response) || {}, response.message || 'Тригери налаштовано', {}, _stage4Warnings_(response));
  });
}

function apiCleanupDuplicateTriggers(functionName) {
  return apiExecute_('apiCleanupDuplicateTriggers', {
    functionName: functionName || ''
  }, function() {
    const response = apiStage4CleanupDuplicateTriggers(functionName || '');
    if (!response.success) return errorResponse_(response.error || 'Не вдалося очистити дублікати тригерів', response.context, response.data, response.warnings);
    return okResponse_(_stage4Result_(response) || {}, response.message || 'Дублікати тригерів очищено', {}, _stage4Warnings_(response));
  });
}

function apiDebugPhones() {
  return apiExecute_('apiDebugPhones', {}, function() {
    const response = apiStage4DebugPhones();
    if (!response.success) return errorResponse_(response.error || 'Діагностика PHONES завершилась з помилкою', response.context, response.data, response.warnings);
    return okResponse_(_stage4Result_(response) || {}, response.message || 'Діагностику PHONES виконано', {}, _stage4Warnings_(response));
  });
}

function apiClearCache() {
  return apiExecute_('apiClearCache', {}, function() {
    const response = apiStage4ClearCache();
    if (!response.success) return errorResponse_(response.error || 'Не вдалося очистити кеш', response.context, response.data, response.warnings);
    return okResponse_(_stage4Result_(response) || null, response.message || 'Кеш очищено', {}, _stage4Warnings_(response));
  });
}

function apiClearPhoneCache() {
  return apiExecute_('apiClearPhoneCache', {}, function() {
    const response = apiStage4ClearPhoneCache();
    if (!response.success) return errorResponse_(response.error || 'Не вдалося очистити кеш телефонів', response.context, response.data, response.warnings);
    return okResponse_(_stage4Result_(response) || null, response.message || 'Кеш телефонів очищено', {}, _stage4Warnings_(response));
  });
}

function apiClearLog() {
  return apiExecute_('apiClearLog', {}, function() {
    const response = apiStage4ClearLog();
    if (!response.success) return errorResponse_(response.error || 'Не вдалося очистити LOG', response.context, response.data, response.warnings);
    return okResponse_(_stage4Result_(response) || {}, response.message || 'LOG очищено', {}, _stage4Warnings_(response));
  });
}

function apiHealthCheck(options) {
  return apiExecute_('apiHealthCheck', options || {}, function() {
    const response = apiStage4HealthCheck(options || {});
    if (!response.success) return errorResponse_(response.error || 'Health check завершився з помилкою', response.context, response.data, response.warnings);
    const report = _stage4Result_(response) || {};
    return okResponse_(report, response.message || report.summary || 'Health check завершено', {
      checks: Array.isArray(report.checks) ? report.checks.length : 0
    }, _stage4Warnings_(response));
  });
}

function apiRunRegressionTests(options) {
  return apiExecute_('apiRunRegressionTests', options || {}, function() {
    const response = apiRunStage4RegressionTests(options || {});
    if (!response.success) return errorResponse_(response.error || 'Regression tests завершилися з помилкою', response.context, response.data, response.warnings);
    const report = _stage4Result_(response) || {};
    return okResponse_(report, response.message || 'Regression tests завершено', {
      checks: Array.isArray(report.checks) ? report.checks.length : 0
    }, _stage4Warnings_(response));
  });
}
function _ensureSendPanelTechnicalSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(CONFIG.SEND_PANEL_SHEET);
  let created = false;

  if (!sh) {
    sh = ss.insertSheet(CONFIG.SEND_PANEL_SHEET);
    created = true;
  }

  if (sh.getLastRow() < 1) {
    sh.getRange(1, 1, 1, 7)
      .merge()
      .setValue(`🤖 Активний місяць: ${getBotMonthSheetName_()}`)
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setBackground('#fff3cd');
  }

  if (sh.getLastRow() < 2) {
    sh.getRange(2, 1, 1, 7)
      .setValues([['FIO', 'Phone', 'Code', 'Tasks', 'Status', 'Sent', 'Action']])
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setBackground('#f0f0f0');
  }

  sh.setFrozenRows(2);
  return { sheet: sh, created: created };
}
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
function healthCheck() {
  const report = {
    ok: true,
    ts: new Date().toISOString(),
    checks: []
  };

  _runHealthCheckItem_(report, 'CONFIG об\'єкт', 'CRITICAL', function () {
    const hasConfig = typeof CONFIG === 'object' && CONFIG !== null;
    return {
      status: hasConfig ? 'OK' : 'FAIL',
      details: hasConfig
        ? `TARGET_SHEET=${CONFIG.TARGET_SHEET}, PHONES=${CONFIG.PHONES_SHEET}, LOG=${CONFIG.LOG_SHEET}`
        : 'CONFIG не визначено',
      howTo: hasConfig ? '' : 'Перевірте, чи CONFIG оголошений до запуску healthCheck()'
    };
  });

  _runHealthCheckItem_(report, 'CONFIG.OS_FIO_RANGE_A1', 'CRITICAL', function () {
    const a1 = CONFIG.OS_FIO_RANGE_A1 || CONFIG.OS_FIO_RANGE;
    return {
      status: a1 ? 'OK' : 'FAIL',
      details: a1 ? `Використовується діапазон: ${a1}` : 'OS_FIO_RANGE_A1 / OS_FIO_RANGE не задано',
      howTo: a1 ? '' : 'Додайте в CONFIG поле OS_FIO_RANGE_A1, наприклад "G2:G40"'
    };
  });

  _runHealthCheckItem_(report, 'Обов\'язкові аркуші', 'CRITICAL', function () {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = ss.getSheets().map(s => s.getName());

    const required = [
      CONFIG.PHONES_SHEET,
      CONFIG.DICT_SHEET,
      CONFIG.DICT_SUM_SHEET,
      CONFIG.LOG_SHEET,
      'VACATIONS',
      'TEMPLATES'
    ].filter(Boolean);

    const missing = required.filter(name => !sheets.includes(name));

    return {
      status: missing.length === 0 ? 'OK' : 'FAIL',
      details: missing.length === 0
        ? `Усі обов'язкові аркуші знайдено (${required.length})`
        : `Відсутні: ${missing.join(', ')}`,
      howTo: missing.length ? `Створіть аркуші: ${missing.join(', ')}` : ''
    };
  });

  _runHealthCheckItem_(report, 'Аркуш SEND_PANEL', 'WARN', function () {
    const ensured = _ensureSendPanelTechnicalSheet_();
    const sh = ensured.sheet;

    return {
      status: sh ? 'OK' : 'WARN',
      severity: 'WARN',
      details: ensured.created
        ? `Аркуш ${CONFIG.SEND_PANEL_SHEET} був відсутній і створений автоматично`
        : `Аркуш ${CONFIG.SEND_PANEL_SHEET} існує`,
      howTo: ''
    };
  });

  _runHealthCheckItem_(report, 'Статуси SEND_PANEL', 'WARN', function () {
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SEND_PANEL_SHEET);
    if (!sh || sh.getLastRow() < 3) {
      return {
        status: 'WARN',
        severity: 'WARN',
        details: 'Немає рядків даних для перевірки статусів SEND_PANEL',
        howTo: 'Спочатку згенеруйте панель відправки'
      };
    }

    const statuses = sh.getRange(3, 5, sh.getLastRow() - 2, 1).getDisplayValues().flat().map(v => String(v || '').trim()).filter(Boolean);
    const invalid = statuses.filter(status => getSendPanelAllAllowedStatuses_().indexOf(normalizeSendPanelStatus_(status)) === -1 && !String(status || '').startsWith(getSendPanelErrorPrefix_()));

    return {
      status: invalid.length === 0 ? 'OK' : 'WARN',
      severity: 'WARN',
      details: invalid.length === 0
        ? `Усі ${statuses.length} статусів валідні`
        : `Некоректні статуси: ${[...new Set(invalid)].join(', ')}`,
      howTo: invalid.length === 0 ? '' : 'Використовуйте тільки ✔ або ✘ у колонці Status'
    };
  });

  _runHealthCheckItem_(report, 'Активний місяць', 'CRITICAL', function () {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const activeMonth = getBotMonthSheetName_();
    const sh = ss.getSheetByName(activeMonth);

    return {
      status: sh ? 'OK' : 'FAIL',
      details: sh
        ? `Активний місяць: ${activeMonth}`
        : `Аркуш "${activeMonth}" не знайдено`,
      howTo: sh ? '' : 'Перевірте BOT_MONTH_PROP_KEY або перемкніть місяць у панелі'
    };
  });

  _runHealthCheckItem_(report, 'Дати в активному місяці', 'CRITICAL', function () {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const activeMonth = getBotMonthSheetName_();
    const sh = ss.getSheetByName(activeMonth);
    if (!sh) throw new Error(`Аркуш "${activeMonth}" не знайдено`);

    const lastCol = sh.getLastColumn();
    const dateRow = Number(CONFIG.DATE_ROW) || 1;

    const values = lastCol > 0
      ? sh.getRange(dateRow, 1, 1, lastCol).getValues()[0]
      : [];

    const hasDates = values.some(v =>
      (v instanceof Date && !isNaN(v.getTime())) ||
      /^\d{2}\.\d{2}\.\d{4}$/.test(String(v || '').trim())
    );

    return {
      status: hasDates ? 'OK' : 'FAIL',
      details: hasDates
        ? `У рядку ${dateRow} дати знайдено`
        : `У рядку ${dateRow} дати не знайдено`,
      howTo: hasDates ? '' : `Заповніть рядок ${dateRow} датами формату dd.MM.yyyy`
    };
  });

  _runHealthCheckItem_(report, 'Сьогоднішня дата в активному місяці', 'WARN', function () {
    const sh = getBotSheet_();
    const today = Utilities.formatDate(new Date(), getTimeZone_(), 'dd.MM.yyyy');
    const col = findTodayColumn_(sh, today);

    return {
      status: col !== -1 ? 'OK' : 'WARN',
      severity: 'WARN',
      details: col !== -1
        ? `Сьогоднішня дата ${today} знайдена в колонці ${col}`
        : `Сьогоднішня дата ${today} не знайдена`,
      howTo: col !== -1 ? '' : 'Перевірте, чи у шапці місячного аркуша є сьогоднішня дата'
    };
  });

  _runHealthCheckItem_(report, 'PHONES — дані', 'CRITICAL', function () {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(CONFIG.PHONES_SHEET);
    if (!sh) {
      return {
        status: 'FAIL',
        details: `Аркуш ${CONFIG.PHONES_SHEET} не знайдено`,
        howTo: `Створіть аркуш ${CONFIG.PHONES_SHEET}`
      };
    }

    const rows = Math.max(0, sh.getLastRow() - 1);

    return {
      status: rows > 0 ? 'OK' : 'FAIL',
      details: `Рядків з даними: ${rows}`,
      howTo: rows > 0 ? '' : 'Заповніть PHONES: A=ПІБ, B=Телефон, C=Роль'
    };
  });

  _runHealthCheckItem_(report, 'Завантаження phonesMap', 'CRITICAL', function () {
    const map = loadPhonesMap_();
    const count = Object.keys(map || {}).length;

    return {
      status: count > 0 ? 'OK' : 'FAIL',
      details: `Ключів у phonesMap: ${count}`,
      howTo: count > 0 ? '' : 'Перевірте PHONES та очистіть кеш телефонів'
    };
  });

  _runHealthCheckItem_(report, 'Телефонний index', 'CRITICAL', function () {
    const index = typeof loadPhonesIndex_ === 'function' ? loadPhonesIndex_() : null;
    const ok = !!(index && index.byFio && index.byNorm && index.byRole && index.byCallsign);
    const items = ok && Array.isArray(index.items) ? index.items.length : 0;

    return {
      status: ok && items > 0 ? 'OK' : 'FAIL',
      details: ok
        ? `items=${items}; byFio=${Object.keys(index.byFio || {}).length}; byRole=${Object.keys(index.byRole || {}).length}; byCallsign=${Object.keys(index.byCallsign || {}).length}`
        : 'loadPhonesIndex_() не повернув канонічну структуру',
      howTo: ok && items > 0 ? '' : 'Перевірте Stage 7 phone-layer і очистіть кеш телефонів'
    };
  });

  _runHealthCheckItem_(report, 'Телефон командира', 'CRITICAL', function () {
    const phone = findPhone_({ role: CONFIG.COMMANDER_ROLE });

    return {
      status: phone ? 'OK' : 'FAIL',
      details: phone
        ? `${CONFIG.COMMANDER_ROLE}: ${phone}`
        : `Роль "${CONFIG.COMMANDER_ROLE}" не знайдена в PHONES`,
      howTo: phone ? '' : `У PHONES в колонці C має бути роль "${CONFIG.COMMANDER_ROLE}"`
    };
  });

  _runHealthCheckItem_(report, 'Функція writeLogsBatch_', 'CRITICAL', function () {
    const exists = _fnExists_('writeLogsBatch_');

    return {
      status: exists ? 'OK' : 'FAIL',
      details: exists
        ? 'Функція writeLogsBatch_ знайдена'
        : 'Функція writeLogsBatch_ відсутня',
      howTo: exists ? '' : 'Додайте функцію writeLogsBatch_ у проєкт'
    };
  });

  _runHealthCheckItem_(report, 'Ключові функції', 'CRITICAL', function () {
    const fns = [
      'runVacationEngine_',
      'buildMessage_',
      'loadPhonesIndex_',
      'findPhone_',
      'loadPhonesMap_',
      'generateSendPanelSidebar',
      'getSendPanelSidebarData',
      'markMultipleAsSentFromSidebar',
      'getBirthdaysSidebar',
      'getPersonCardData',
      'openPersonCalendar',
      'openPersonCardByCallsignAndDate',
      '_parseDate_',
      '_vacationWordToNumber_',
      'setupVacationTrigger',
      'cleanupDuplicateTriggers',
      'sendDaySummaryToCommanderSidebar',
      'sendDetailedToCommanderSidebar',
      'healthCheck'
    ];

    const missing = fns.filter(name => !_fnExists_(name));

    return {
      status: missing.length === 0 ? 'OK' : 'FAIL',
      details: missing.length === 0
        ? `Усі ключові функції знайдено (${fns.length})`
        : `Відсутні: ${missing.join(', ')}`,
      howTo: missing.length ? 'Перевірте, чи всі .gs файли додані в проєкт' : ''
    };
  });

  _runHealthCheckItem_(report, 'Картка бійця і календар', 'CRITICAL', function () {
    const functionsOk = ['getPersonCardData', 'openPersonCalendar', 'openPersonCardByCallsignAndDate']
      .every(name => _fnExists_(name));

    return {
      status: functionsOk ? 'OK' : 'FAIL',
      details: functionsOk
        ? 'Функції картки бійця і календаря знайдено'
        : 'Відсутні одна або кілька функцій картки бійця / календаря',
      howTo: functionsOk ? '' : 'Перевірте PersonCards.gs і PersonCalendar.html'
    };
  });

  _runHealthCheckItem_(report, 'Helper-функції відпусток', 'CRITICAL', function () {
    const hasParse = _fnExists_('_parseDate_');
    const hasVacMap = _fnExists_('_vacationWordToNumber_');

    return {
      status: hasParse && hasVacMap ? 'OK' : 'FAIL',
      details: `parse=${hasParse ? '✓' : '✕'}, vacationWord=${hasVacMap ? '✓' : '✕'}`,
      howTo: hasParse && hasVacMap ? '' : 'Додайте thin-wrapper helper-и в Utils.gs'
    };
  });


  _runHealthCheckItem_(report, 'Canonical date/html layer', 'CRITICAL', function () {
    const hasDateUtils = typeof DateUtils_ === 'object' && DateUtils_ !== null;
    const hasHtmlUtils = typeof HtmlUtils_ === 'object' && HtmlUtils_ !== null;
    const hasSmoke = _fnExists_('runSmokeTests');

    return {
      status: hasDateUtils && hasHtmlUtils && hasSmoke ? 'OK' : 'WARN',
      severity: 'WARN',
      details: [
        `DateUtils_: ${hasDateUtils ? '✓' : '✕'}`,
        `HtmlUtils_: ${hasHtmlUtils ? '✓' : '✕'}`,
        `runSmokeTests(): ${hasSmoke ? '✓' : '✕'}`
      ].join('\n'),
      howTo: hasDateUtils && hasHtmlUtils && hasSmoke
        ? ''
        : 'Додайте DateUtils.gs, HtmlUtils.gs та SmokeTests.gs до проєкту'
    };
  });

  _runHealthCheckItem_(report, 'Deprecated alias layer', 'WARN', function () {
    const hasParseAlias = _fnExists_('_parseDate_');
    const hasEscapeAlias = _fnExists_('escapeHtml_');

    return {
      status: hasParseAlias && hasEscapeAlias ? 'PSEUDO' : 'WARN',
      severity: hasParseAlias && hasEscapeAlias ? 'INFO' : 'WARN',
      details: hasParseAlias && hasEscapeAlias
        ? `Compatibility-only alias layer retained intentionally: parseAlias=✓, escapeAlias=✓`
        : `parseAlias=${hasParseAlias ? '✓' : '✕'}, escapeAlias=${hasEscapeAlias ? '✓' : '✕'}`,
      howTo: hasParseAlias && hasEscapeAlias ? 'Нейтральний сумісний шар; не є canonical-path' : 'Поверніть thin-wrapper сумісності для старих викликів'
    };
  });

  _runHealthCheckItem_(report, 'Тригери автозапуску', 'WARN', function () {
    const triggers = ScriptApp.getProjectTriggers();

    const vac = triggers.filter(t => t.getHandlerFunction() === 'autoVacationReminder');
    const bd = triggers.filter(t => t.getHandlerFunction() === 'autoBirthdayReminder');

    const hasVac = vac.length > 0;
    const hasBd = bd.length > 0;
    const dupVac = vac.length > 1;
    const dupBd = bd.length > 1;

    const ok = hasVac && hasBd && !dupVac && !dupBd;

    return {
      status: ok ? 'OK' : 'WARN',
      severity: 'WARN',
      details: [
        `Відпустки: ${hasVac ? `✓ (${vac.length} шт)` : '✕ немає'}`,
        `ДН: ${hasBd ? `✓ (${bd.length} шт)` : '✕ немає'}`,
        dupVac || dupBd ? '⁈ Є дублікати тригерів' : ''
      ].filter(Boolean).join('\n'),
      howTo: (!hasVac || !hasBd)
        ? 'Натисніть "⏰ Створити тригер"'
        : (dupVac || dupBd)
          ? 'Натисніть "🧹 Дублі"'
          : ''
    };
  });

  return report;
}

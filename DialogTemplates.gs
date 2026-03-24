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

function _fnExists_(name) {
  try {
    const g = _global_();
    return typeof g[name] === 'function';
  } catch (e) {
    return false;
  }
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
      .setValues([['ПІБ', 'Телефон', 'Код', 'Завдання', 'Статус', 'Дія', 'Відправлено']])
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setBackground('#f0f0f0');
  }

  sh.setFrozenRows(2);
  return { sheet: sh, created: created };
}
function _addHealthCheck_(report, item) {
  const status = String(item.status || 'OK').toUpperCase();
  const severity = String(item.severity || (status === 'FAIL' ? 'CRITICAL' : 'INFO')).toUpperCase();
  const ok = status === 'OK';

  report.checks.push({
    title: String(item.title || ''),
    ok: ok,
    status: status,
    severity: severity,
    details: String(item.details || ''),
    howTo: String(item.howTo || '')
  });

  if (!ok && status === 'FAIL') {
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
      howTo: invalid.length === 0 ? '' : 'Використовуйте тільки ✅ Готово, 🟡 Очікує підтвердження, ↩️ Не відправлено, 📤 Відправлено або ❌ ...'
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
    const today = Utilities.formatDate(new Date(), CONFIG.TZ, 'dd.MM.yyyy');
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

  _runHealthCheckItem_(report, 'Телефон командира', 'CRITICAL', function () {
    const phone = findPhoneByRole_(CONFIG.COMMANDER_ROLE);

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
      details: `parse=${hasParse ? '✅' : '❌'}, vacationWord=${hasVacMap ? '✅' : '❌'}`,
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
        `DateUtils_: ${hasDateUtils ? '✅' : '❌'}`,
        `HtmlUtils_: ${hasHtmlUtils ? '✅' : '❌'}`,
        `runSmokeTests(): ${hasSmoke ? '✅' : '❌'}`
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
      status: hasParseAlias && hasEscapeAlias ? 'OK' : 'WARN',
      severity: 'WARN',
      details: `parseAlias=${hasParseAlias ? '✅' : '❌'}, escapeAlias=${hasEscapeAlias ? '✅' : '❌'}`,
      howTo: hasParseAlias && hasEscapeAlias ? '' : 'Поверніть thin-wrapper сумісності для старих викликів'
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
        `Відпустки: ${hasVac ? `✅ (${vac.length} шт)` : '❌ немає'}`,
        `ДН: ${hasBd ? `✅ (${bd.length} шт)` : '❌ немає'}`,
        dupVac || dupBd ? '⚠️ Є дублікати тригерів' : ''
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
          ? '✅ Лист "' + item.name + '" знайдено'
          : (item.required
            ? '❌ Обов\'язковий лист "' + item.name + '" не знайдено'
            : '⚠️ Лист "' + item.name + '" не знайдено')
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
        ? '✅ Місячні листи: ' + existingMonths.join(', ')
        : '⚠️ Не знайдено жодного місячного листа'
    });

  } catch (e) {
    report.status = 'ERROR';
    report.errors.push('Помилка checkSheets: ' + _safeErr_(e));
  }

  DIAGNOSTICS.results.sheets = report;
  return report;
}

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
          ? '✅ ' + func.name + ' існує'
          : '❌ ' + func.name + ' не знайдена'
      });
    });

  } catch (e) {
    report.status = 'ERROR';
    report.errors.push('Помилка checkFiles: ' + _safeErr_(e));
  }

  DIAGNOSTICS.results.files = report;
  return report;
}

function checkDuplicates() {
  const report = _makeReport_('🧬 ПЕРЕВІРКА ДУБЛІКАТІВ');

  try {
    const ss = _getSS_();
    const sh = ss.getSheetByName(CONFIG.PHONES_SHEET || 'PHONES');

    if (!sh || sh.getLastRow() < 2) {
      _pushCheck_(report, {
        type: 'duplicates_skip',
        name: 'PHONES',
        status: 'WARN',
        message: '⚠️ Лист PHONES не знайдено або порожній'
      });
      DIAGNOSTICS.results.duplicates = report;
      return report;
    }

    const values = sh.getDataRange().getValues();
    const header = values[0].map(function (v) {
      return String(v || '').trim().toLowerCase();
    });
    const data = values.slice(1);

    function findCol(predicates) {
      return header.findIndex(function (h) {
        return predicates.some(function (p) {
          return h.indexOf(p) !== -1;
        });
      });
    }

    const fioCol = findCol(['піб', 'фіо', 'фио']);
    const callsignCol = findCol(['позив', 'callsign', 'роль']);
    const phoneCol = findCol(['тел', 'phone']);

    const counters = {
      fio: {},
      callsign: {},
      phone: {}
    };

    data.forEach(function (row, idx) {
      const r = idx + 2;

      if (fioCol >= 0) {
        const fio = String(row[fioCol] || '').trim().toUpperCase();
        if (fio) {
          if (!counters.fio[fio]) counters.fio[fio] = [];
          counters.fio[fio].push(r);
        }
      }

      if (callsignCol >= 0) {
        const cs = String(row[callsignCol] || '').trim().toUpperCase();
        if (cs) {
          if (!counters.callsign[cs]) counters.callsign[cs] = [];
          counters.callsign[cs].push(r);
        }
      }

      if (phoneCol >= 0) {
        const phone = String(row[phoneCol] || '').replace(/[^\d+]/g, '').trim();
        if (phone) {
          if (!counters.phone[phone]) counters.phone[phone] = [];
          counters.phone[phone].push(r);
        }
      }
    });

    const dups = [];

    Object.entries(counters.fio).forEach(function (entry) {
      const value = entry[0];
      const rows = entry[1];
      if (rows.length > 1) {
        dups.push('ПІБ "' + value + '" → ' + rows.join(', '));
      }
    });

    Object.entries(counters.callsign).forEach(function (entry) {
      const value = entry[0];
      const rows = entry[1];
      if (rows.length > 1) {
        dups.push('Позивний "' + value + '" → ' + rows.join(', '));
      }
    });

    Object.entries(counters.phone).forEach(function (entry) {
      const value = entry[0];
      const rows = entry[1];
      if (rows.length > 1) {
        dups.push('Телефон "' + value + '" → ' + rows.join(', '));
      }
    });

    if (!dups.length) {
      _pushCheck_(report, {
        type: 'duplicates_result',
        name: 'duplicates',
        status: 'OK',
        message: '✅ Явних дублікатів не знайдено'
      });
    } else {
      dups.forEach(function (message) {
        _pushCheck_(report, {
          type: 'duplicate',
          name: 'duplicate',
          status: 'WARN',
          message: '⚠️ ' + message
        });
      });
    }

  } catch (e) {
    report.status = 'ERROR';
    report.errors.push('Помилка checkDuplicates: ' + _safeErr_(e));
  }

  DIAGNOSTICS.results.duplicates = report;
  return report;
}

function testFunctions() {
  const report = _makeReport_('🧪 ТЕСТ ФУНКЦІЙ');

  try {
    try {
      const today = _todayStr_();
      _pushCheck_(report, {
        type: 'test_function',
        name: '_todayStr_',
        status: /^\d{2}\.\d{2}\.\d{4}$/.test(today) ? 'OK' : 'ERROR',
        message: '✅ _todayStr_() → ' + today
      });
    } catch (e) {
      _pushCheck_(report, {
        type: 'test_function',
        name: '_todayStr_',
        status: 'ERROR',
        message: '❌ _todayStr_(): ' + _safeErr_(e)
      });
    }

    try {
      const d = _parseUaDate_('12.03.2026');
      _pushCheck_(report, {
        type: 'test_function',
        name: '_parseUaDate_',
        status: d instanceof Date ? 'OK' : 'ERROR',
        message: d instanceof Date
          ? '✅ _parseUaDate_() працює'
          : '❌ _parseUaDate_() не змогла розібрати дату'
      });
    } catch (e) {
      _pushCheck_(report, {
        type: 'test_function',
        name: '_parseUaDate_',
        status: 'ERROR',
        message: '❌ _parseUaDate_(): ' + _safeErr_(e)
      });
    }

    try {
      const f = _formatPhoneDisplay_('+380661234567');
      _pushCheck_(report, {
        type: 'test_function',
        name: '_formatPhoneDisplay_',
        status: f ? 'OK' : 'ERROR',
        message: f
          ? '✅ _formatPhoneDisplay_() → ' + f
          : '❌ _formatPhoneDisplay_() повернула порожнє значення'
      });
    } catch (e) {
      _pushCheck_(report, {
        type: 'test_function',
        name: '_formatPhoneDisplay_',
        status: 'ERROR',
        message: '❌ _formatPhoneDisplay_(): ' + _safeErr_(e)
      });
    }

    try {
      const hc = healthCheck();
      _pushCheck_(report, {
        type: 'test_function',
        name: 'healthCheck',
        status: hc && Array.isArray(hc.checks) ? 'OK' : 'ERROR',
        message: hc && Array.isArray(hc.checks)
          ? '✅ healthCheck() повернув звіт'
          : '❌ healthCheck() повернув невалідні дані'
      });
    } catch (e) {
      _pushCheck_(report, {
        type: 'test_function',
        name: 'healthCheck',
        status: 'ERROR',
        message: '❌ healthCheck(): ' + _safeErr_(e)
      });
    }

  } catch (e) {
    report.status = 'ERROR';
    report.errors.push('Помилка testFunctions: ' + _safeErr_(e));
  }

  DIAGNOSTICS.results.functions = report;
  return report;
}

function runDiagnostics() {
  const startedAt = new Date().toISOString();

  const sections = {
    sheets: checkSheets(),
    files: checkFiles(),
    duplicates: checkDuplicates(),
    functions: testFunctions()
  };

  const ok = Object.values(sections).every(function (section) {
    return section.status !== 'ERROR';
  });

  const finishedAt = new Date().toISOString();

  const summary = {
    ok: ok,
    startedAt: startedAt,
    finishedAt: finishedAt,
    sections: sections
  };

  DIAGNOSTICS.results.summary = summary;
  return summary;
}

function runAllDiagnostics() {
  return runDiagnostics();
}

function runSheetsCheck() {
  return checkSheets();
}

function runFilesCheck() {
  return checkFiles();
}

function runDuplicatesCheck() {
  return checkDuplicates();
}

function runTestsCheck() {
  return testFunctions();
}

function runFullDiagnostics() {
  return runDiagnostics();
}

/**
 * Stage 3 diagnostics — перевірка схем, repository і data-contract.
 */
function _stage3PushCheck_(checks, name, status, details, recommendation) {
  const normalizedStatus = String(status || 'OK').toUpperCase();

  let severity = 'INFO';
  if (normalizedStatus === 'FAIL') severity = 'CRITICAL';
  else if (normalizedStatus === 'WARN') severity = 'WARN';

  const lowerName = String(name || '').toLowerCase();
  const lowerDetails = String(details || '').toLowerCase();

  let uiGroup = 'ok';

  if (normalizedStatus === 'FAIL' || (normalizedStatus === 'WARN' && severity === 'CRITICAL')) {
    uiGroup = 'critical';
  } else if (normalizedStatus === 'WARN') {
    uiGroup = 'warnings';
  }

  // Compatibility / deprecated layer
  if (
    lowerName.indexOf('deprecated ') === 0 ||
    lowerName.indexOf('compatibility ') === 0 ||
    lowerName.indexOf('wrapper source ') === 0 ||
    lowerName.indexOf('ui-ban marker ') === 0 ||
    lowerDetails.indexOf('compatibility-only') !== -1 ||
    lowerDetails.indexOf('замінити на ') !== -1
  ) {
    uiGroup = 'compatibility';
  }

  checks.push({
    name: name,
    title: name,
    status: normalizedStatus,
    ok: normalizedStatus === 'OK',
    severity: severity,
    uiGroup: uiGroup,
    details: details || '',
    message: details || '',
    recommendation: recommendation || '',
    howTo: recommendation || ''
  });
}

function _stage3ResolveSymbol_(name) {
  if (!name) return undefined;
  try {
    return eval(name);
  } catch (_) {}
  try {
    const g = _global_();
    return g ? g[name] : undefined;
  } catch (_) {
    return undefined;
  }
}

function _stage3HasFn_(name) {
  try {
    return typeof _stage3ResolveSymbol_(name) === 'function';
  } catch (_) {
    return false;
  }
}

function runStage3HealthCheck_(options) {
  const opts = options || {};
  const checks = [];
  const warnings = [];
  const schemas = SheetSchemas_.getAll();
  const ss = SpreadsheetApp.getActive();

  Object.keys(schemas).forEach(function(key) {
    const schema = schemas[key];
    const sheetName = schema.key === 'MONTHLY' ? getBotMonthSheetName_() : schema.name;
    const sheet = ss.getSheetByName(sheetName);

    if (schema.key === 'MONTHLY') {
      _stage3PushCheck_(
        checks,
        `Schema ${schema.key}`,
        sheet ? 'OK' : 'FAIL',
        sheet ? `Активний місячний лист: ${sheetName}` : `Активний місячний лист "${sheetName}" не знайдено`,
        sheet ? '' : 'Перевірте CONFIG.TARGET_SHEET або active bot month property'
      );
      return;
    }

    const status = sheet ? 'OK' : (schema.required ? 'FAIL' : 'WARN');
    const details = sheet
      ? `Аркуш "${sheetName}" доступний`
      : `Аркуш "${sheetName}" ${schema.required ? 'обов’язковий, але не знайдений' : 'ще не створений'}`;

    _stage3PushCheck_(checks, `Schema ${schema.key}`, status, details, sheet ? '' : 'Створіть лист або перевірте CONFIG');
  });

  ['PHONES', 'DICT', 'DICT_SUM', 'SEND_PANEL', 'VACATIONS', 'LOG'].forEach(function(key) {
    try {
      const schema = SheetSchemas_.get(key);
      const sheet = ss.getSheetByName(schema.name);
      if (!sheet) return;
      const result = validateSheetHeadersBySchema_(sheet, schema);
      _stage3PushCheck_(
        checks,
        `Headers ${schema.key}`,
        result.ok ? 'OK' : 'WARN',
        result.ok
          ? 'Headers відповідають схемі'
          : ('Проблеми з headers: ' + [].concat(result.missing || []).concat(result.mismatches || []).join('; ')),
        result.ok ? '' : 'Звірте header row зі схемою у SheetSchemas.gs'
      );
    } catch (e) {
      _stage3PushCheck_(checks, `Headers ${key}`, 'WARN', e && e.message ? e.message : String(e), 'Перевірте schema/header contract');
    }
  });

  [
    'DataAccess_',
    'DictionaryRepository_',
    'PersonsRepository_',
    'SendPanelRepository_',
    'VacationsRepository_',
    'SummaryRepository_',
    'LogsRepository_'
  ].forEach(function(name) {
    const resolved = _stage3ResolveSymbol_(name);
    const exists = typeof resolved === 'object' || typeof resolved === 'function';
    _stage3PushCheck_(checks, `Repository ${name}`, exists ? 'OK' : 'FAIL', exists ? 'Доступний' : 'Не знайдено', exists ? '' : 'Перевірте файл stage 3 repository');
  });

  [
    'apiGetMonthsList',
    'apiGetSidebarData',
    'apiGenerateSendPanel',
    'apiGetSendPanelData',
    'apiMarkSendPanelRowsAsSent',
    'apiGetDaySummary',
    'apiGetDetailedDaySummary',
    'apiCheckVacations',
    'apiGetBirthdays',
    'apiGetPersonCardData',
    'apiHealthCheck',
    'apiRunRegressionTests'
  ].forEach(function(fnName) {
    _stage3PushCheck_(
      checks,
      `Public API ${fnName}`,
      _stage3HasFn_(fnName) ? 'OK' : 'FAIL',
      _stage3HasFn_(fnName) ? 'Публічний API доступний' : 'Метод не знайдено',
      _stage3HasFn_(fnName) ? '' : 'Перевірте Stage3ServerApi.gs'
    );
  });

  try {
    const contractChecks = [
      apiGetMonthsList(),
      apiGetSendPanelData(),
      apiGetBirthdays(_todayStr_())
    ];

    contractChecks.forEach(function(result, idx) {
      const valid = !!result && typeof result === 'object'
        && 'success' in result
        && 'message' in result
        && 'error' in result
        && 'data' in result
        && 'context' in result
        && 'warnings' in result;

      _stage3PushCheck_(
        checks,
        `Contract #${idx + 1}`,
        valid ? 'OK' : 'FAIL',
        valid ? 'Контракт відповіді валідний' : 'Відповідь не відповідає server-side contract',
        valid ? '' : 'Перевірте normalizeServerResponse_/apiExecute_'
      );
    });
  } catch (e) {
    _stage3PushCheck_(checks, 'Contract validation', 'FAIL', e && e.message ? e.message : String(e), 'Перевірте public API');
  }

  const deprecated = getDeprecatedRegistry_();
  deprecated.forEach(function(item) {
    _stage3PushCheck_(
      checks,
      `Deprecated ${item.name}`,
      'WARN',
      `Замінити на ${item.replacement}`,
      item.reason || ''
    );
    warnings.push(`${item.name} → ${item.replacement}`);
  });

  const failures = checks.filter(function(item) { return item.status === 'FAIL'; }).length;
  const warns = checks.filter(function(item) { return item.status === 'WARN'; }).length;

  return {
    ok: failures === 0,
    status: failures === 0 ? 'OK' : 'FAIL',
    checks: checks,
    warnings: warnings,
    summary: failures === 0
      ? `Stage 3 health check OK. Warning: ${warns}`
      : `Stage 3 health check FAIL. Failures: ${failures}, warnings: ${warns}`,
    options: opts,
    timestamp: new Date().toISOString()
  };
}


// =========================
// STAGE 4 DIAGNOSTICS 2.0
// =========================

function _releaseStageLabel_() {
  const meta = typeof getProjectBundleMetadata_ === 'function' ? getProjectBundleMetadata_() : PROJECT_BUNDLE_METADATA_;
  return meta && meta.stageLabel ? meta.stageLabel : 'Stage 7.1 — Reliability Hardened Baseline';
}

function _projectBundleHas_(path) {
  return typeof isProjectBundleFilePresent_ === 'function' ? isProjectBundleFilePresent_(path) : false;
}

function _projectBundleMissing_(paths) {
  return typeof getMissingProjectBundleFiles_ === 'function' ? getMissingProjectBundleFiles_(paths || []) : (paths || []).slice();
}

function _isArchivePath_(path) {
  return String(path || '').indexOf('docs/archive/') === 0;
}

function _isReferencePath_(path) {
  return String(path || '').indexOf('docs/reference/') === 0;
}

function _diagPushPathCheck_(checks, name, path, expectedKind) {
  const present = _projectBundleHas_(path);
  _stage3PushCheck_(
    checks,
    name,
    present ? 'OK' : 'FAIL',
    present ? `${expectedKind}: ${path}` : `${expectedKind} missing: ${path}`,
    present ? '' : `Відсутній файл ${path}`
  );
}


function runStage41ProjectConsistencyCheck_() {
  const checks = [];
  const meta = typeof PROJECT_BUNDLE_METADATA_ === 'object' && PROJECT_BUNDLE_METADATA_
    ? PROJECT_BUNDLE_METADATA_
    : null;

  _stage3PushCheck_(
    checks,
    'Project bundle metadata',
    meta ? 'OK' : 'FAIL',
    meta ? 'PROJECT_BUNDLE_METADATA_ доступний' : 'PROJECT_BUNDLE_METADATA_ не знайдено',
    meta ? '' : 'Додайте ProjectMetadata.gs'
  );

  if (!meta) return checks;

  _stage3PushCheck_(
    checks,
    'Release stage marker',
    String(meta.stage || '') === '7.1' ? 'OK' : 'WARN',
    `stage=${meta.stage || 'n/a'}, stageVersion=${meta.stageVersion || 'n/a'}, label=${meta.stageLabel || 'n/a'}`,
    'Оновіть ProjectMetadata.gs до Stage 7.1'
  );

  _stage3PushCheck_(
    checks,
    'Root manifest declaration',
    meta.manifestIncluded ? 'OK' : 'FAIL',
    meta.manifestIncluded ? `manifestIncluded=true, path=${(meta.packagingPolicy && meta.packagingPolicy.manifestPath) || 'n/a'}` : 'manifestIncluded=false',
    'Вирівняйте packaging policy'
  );

  _stage3PushCheck_(
    checks,
    'Root manifest physical presence',
    _projectBundleHas_((meta.packagingPolicy && meta.packagingPolicy.manifestPath) || 'appsscript.json') ? 'OK' : 'FAIL',
    _projectBundleHas_((meta.packagingPolicy && meta.packagingPolicy.manifestPath) || 'appsscript.json')
      ? ((meta.packagingPolicy && meta.packagingPolicy.manifestPath) || 'appsscript.json')
      : 'appsscript.json відсутній у root bundle',
    'Додайте manifest до bundle root'
  );

  _stage3PushCheck_(
    checks,
    'Root clasp example physical presence',
    _projectBundleHas_((meta.packagingPolicy && meta.packagingPolicy.claspExamplePath) || '.clasp.json.example') ? 'OK' : 'FAIL',
    _projectBundleHas_((meta.packagingPolicy && meta.packagingPolicy.claspExamplePath) || '.clasp.json.example')
      ? ((meta.packagingPolicy && meta.packagingPolicy.claspExamplePath) || '.clasp.json.example')
      : '.clasp.json.example відсутній у root bundle',
    'Додайте .clasp.json.example до bundle root'
  );

  _stage3PushCheck_(
    checks,
    'GAS-first policy marker',
    meta.gasFirst ? 'OK' : 'WARN',
    meta.gasFirst ? 'Bundle позначено як GAS-first' : 'gasFirst=false',
    'Зафіксуйте GAS-first політику в ProjectMetadata.gs'
  );

  const requiredDocs = Array.isArray(meta.requiredDocs) ? meta.requiredDocs : [];
  requiredDocs.forEach(function(doc) {
    _stage3PushCheck_(
      checks,
      `Required doc declared ${doc}`,
      requiredDocs.indexOf(doc) !== -1 ? 'OK' : 'FAIL',
      'Документ включено в metadata.requiredDocs',
      'Оновіть ProjectMetadata.gs'
    );
    _stage3PushCheck_(
      checks,
      `Required doc physical ${doc}`,
      _projectBundleHas_(doc) ? 'OK' : 'FAIL',
      _projectBundleHas_(doc) ? `present=${doc}` : `missing=${doc}`,
      'Вирівняйте bundle layout'
    );
  });

  const helperOk = typeof HtmlUtils_ === 'object'
    && typeof HtmlUtils_.escapeHtml === 'function'
    && typeof escapeHtml_ === 'function'
    && typeof _escapeHtml_ === 'function'
    && escapeHtml_('<b>') === HtmlUtils_.escapeHtml('<b>')
    && _escapeHtml_('<b>') === HtmlUtils_.escapeHtml('<b>');

  _stage3PushCheck_(
    checks,
    'Canonical HTML helper',
    helperOk ? 'OK' : 'FAIL',
    helperOk ? 'HtmlUtils_.escapeHtml() є source-of-truth, wrappers узгоджені' : 'Helper-layer розсинхронізований',
    helperOk ? '' : 'Перевірте HtmlUtils.gs / DeprecatedRegistry.gs'
  );

  return checks;
}


function runHistoricalStructuralDiagnosticsInternal_(options) {
  const opts = options || {};
  const checks = [];
  const warnings = [];
  const meta = typeof getProjectBundleMetadata_ === 'function' ? getProjectBundleMetadata_() : PROJECT_BUNDLE_METADATA_;
  const apiMap = typeof getStage4CanonicalApiMap_ === 'function' ? getStage4CanonicalApiMap_() : null;
  const routing = typeof getStage4ClientRoutingPolicy_ === 'function' ? getStage4ClientRoutingPolicy_() : null;

  _stage3PushCheck_(
    checks,
    'Canonical layer map',
    meta && meta.canonicalLayers ? 'OK' : 'FAIL',
    meta && meta.canonicalLayers ? JSON.stringify(meta.canonicalLayers) : 'canonicalLayers відсутній',
    'Оновіть ProjectMetadata.gs'
  );

  const canonicalLayerAliases = {
    applicationApi: ['applicationApi', 'sidebarApplicationApi'],
    maintenanceApi: ['maintenanceApi'],
    useCases: ['useCases'],
    workflow: ['workflow'],
    compatibility: ['compatibility', 'compatibilityFacade'],
    diagnostics: ['diagnostics'],
    tests: ['tests'],
    metadata: ['metadata']
  };

  Object.keys(canonicalLayerAliases).forEach(function(key) {
    const resolved = (canonicalLayerAliases[key] || [])
      .map(function(alias) { return meta && meta.canonicalLayers ? meta.canonicalLayers[alias] : ''; })
      .filter(Boolean)[0] || '';
    const ok = !!resolved;
    _stage3PushCheck_(checks, `Layer pointer ${key}`, ok ? 'OK' : 'FAIL', ok ? resolved : 'Не задано', 'Оновіть ProjectMetadata.gs');
  });

  ['application', 'maintenance', 'compatibility'].forEach(function(kind) {
    const list = apiMap && Array.isArray(apiMap[kind]) ? apiMap[kind] : [];
    _stage3PushCheck_(
      checks,
      `Canonical API map ${kind}`,
      list.length ? 'OK' : 'FAIL',
      list.length ? `entrypoints=${list.length}` : 'Список порожній',
      'Оновіть ProjectMetadata.gs'
    );

    list.forEach(function(fnName) {
      _stage3PushCheck_(
        checks,
        `Entrypoint ${fnName}`,
        _stage3HasFn_(fnName) ? 'OK' : 'FAIL',
        _stage3HasFn_(fnName) ? 'Доступний' : 'Не знайдено',
        'Перевірте відповідний файл API'
      );
    });
  });

  _stage3PushCheck_(
    checks,
    'Client routing policy map',
    routing && typeof routing === 'object' ? 'OK' : 'FAIL',
    routing && typeof routing === 'object' ? `routes=${Object.keys(routing).length}` : 'routing map відсутній',
    'Оновіть ProjectMetadata.gs'
  );

  Object.keys(routing || {}).forEach(function(action) {
    const fnName = routing[action];
    _stage3PushCheck_(
      checks,
      `Client route ${action} -> ${fnName}`,
      _stage3HasFn_(fnName) ? 'OK' : 'FAIL',
      _stage3HasFn_(fnName) ? 'Маршрут розвʼязується' : 'Target function не знайдено',
      'Вирівняйте JavaScript.html та server API'
    );
  });

  return {
    ok: checks.filter(function(item) { return item.status === 'FAIL'; }).length === 0,
    status: checks.some(function(item) { return item.status === 'FAIL'; }) ? 'FAIL' : 'OK',
    stage: (typeof getProjectBundleMetadata_ === 'function' ? getProjectBundleMetadata_().stageVersion : '6.0.0-final'),
    mode: opts.mode || 'structural',
    checks: checks,
    warnings: warnings,
    summary: 'Historical structural lineage diagnostics завершено',
    ts: new Date().toISOString()
  };
}

function runHistoricalCompatibilityDiagnosticsInternal_(options) {
  const opts = options || {};
  const checks = [];
  const warnings = [];
  const registry = typeof getStage4CompatibilityMap_ === 'function' ? getStage4CompatibilityMap_() : [];

  _stage3PushCheck_(
    checks,
    'Compatibility registry',
    registry.length ? 'OK' : 'FAIL',
    registry.length ? `entries=${registry.length}` : 'Реєстр порожній',
    'Оновіть DeprecatedRegistry.gs'
  );

  registry.forEach(function(item) {
    const exists = _stage3HasFn_(item.name);
    _stage3PushCheck_(
      checks,
      `Compatibility function ${item.name}`,
      exists ? 'OK' : 'FAIL',
      exists ? `${item.scope || 'unknown scope'} -> ${item.replacement || ''}` : 'Функцію не знайдено',
      exists ? '' : 'Перевірте DeprecatedRegistry.gs / відповідний файл'
    );

    if (!exists || !item.verifySourceToken) return;
    try {
      const fn = _global_()[item.name];
      const src = typeof fn === 'function' ? String(fn) : '';
      const sourceOk = src.indexOf(item.verifySourceToken) !== -1;
      _stage3PushCheck_(
        checks,
        `Wrapper source ${item.name}`,
        sourceOk ? 'OK' : 'WARN',
        sourceOk ? `source -> ${item.verifySourceToken}` : 'Wrapper source не вказує на canonical replacement',
        'Перевірте, що wrapper лишається thin alias без нової бізнес-логіки'
      );
    } catch (e) {
      warnings.push(e && e.message ? e.message : String(e));
    }

    if (item.uiAllowed === false && item.scope === 'SidebarServer.gs') {
      _stage3PushCheck_(
        checks,
        `UI-ban marker ${item.name}`,
        item.status === 'compatibility-only' ? 'OK' : 'WARN',
        `uiAllowed=${item.uiAllowed}, status=${item.status}`,
        'Compatibility wrapper не повинен повертатися як canonical UI route'
      );
    }
  });

  return {
    ok: checks.filter(function(item) { return item.status === 'FAIL'; }).length === 0,
    status: checks.some(function(item) { return item.status === 'FAIL'; }) ? 'FAIL' : 'OK',
    stage: (typeof getProjectBundleMetadata_ === 'function' ? getProjectBundleMetadata_().stageVersion : '6.0.0-final'),
    mode: opts.mode || 'compatibility',
    checks: checks,
    warnings: [...new Set(warnings)],
    summary: 'Historical compatibility lineage diagnostics завершено',
    ts: new Date().toISOString()
  };
}

function runHistoricalQuickDiagnosticsInternal_(options) {
  const opts = options || {};
  const structural = runHistoricalStructuralDiagnosticsInternal_({ mode: 'quick' });
  const checks = structural.checks.filter(function(item) {
    return String(item.name || '').indexOf('Entrypoint ') === 0
      || String(item.name || '').indexOf('Client route ') === 0
      || String(item.name || '').indexOf('Required doc marker ') === 0
      || item.name === 'Project bundle metadata'
      || item.name === 'Canonical HTML helper';
  });

  return {
    ok: checks.filter(function(item) { return item.status === 'FAIL'; }).length === 0,
    status: checks.some(function(item) { return item.status === 'FAIL'; }) ? 'FAIL' : 'OK',
    stage: (typeof getProjectBundleMetadata_ === 'function' ? getProjectBundleMetadata_().stageVersion : '6.0.0-final'),
    mode: opts.mode || 'quick',
    checks: checks,
    warnings: [],
    summary: 'Historical quick lineage diagnostics завершено',
    ts: new Date().toISOString()
  };
}

function runHistoricalFullDiagnosticsInternal_(options) {
  const opts = options || {};
  const structural = runHistoricalStructuralDiagnosticsInternal_({ mode: 'full' });
  const compatibility = runHistoricalCompatibilityDiagnosticsInternal_({ mode: 'full' });
  const checks = []
    .concat(runStage41ProjectConsistencyCheck_())
    .concat(structural.checks || [])
    .concat(compatibility.checks || []);
  const warnings = stage4MergeWarnings_(structural.warnings || [], compatibility.warnings || []);

  return {
    ok: checks.filter(function(item) { return item.status === 'FAIL'; }).length === 0,
    status: checks.some(function(item) { return item.status === 'FAIL'; }) ? 'FAIL' : 'OK',
    stage: (typeof getProjectBundleMetadata_ === 'function' ? getProjectBundleMetadata_().stageVersion : '6.0.0-final'),
    mode: opts.mode || 'full',
    checks: checks,
    warnings: warnings,
    summary: 'Historical full lineage diagnostics завершено',
    ts: new Date().toISOString()
  };
}

function runStage4HealthCheck_(options) {
  const opts = options || {};

  const includeStage3Base = opts.includeStage3Base === true;
  const includeCompatibilityLayer = opts.includeCompatibilityLayer === true;
  const includeReconciliationPreview = opts.includeReconciliationPreview !== false;
  const shallow = opts.shallow === true;

  const base = includeStage3Base
    ? runStage3HealthCheck_(opts)
    : { checks: [], warnings: [] };

  const checks = []
    .concat(base.checks || [])
    .filter(function(item) {
      if (includeCompatibilityLayer) return true;
      return item.uiGroup !== 'compatibility';
    });

  const warnings = [].concat(base.warnings || []);

  [
    'Stage4UseCases_',
    'WorkflowOrchestrator_',
    'Stage4AuditTrail_',
    'Reconciliation_',
    'Stage4Triggers_',
    'Stage4Templates_'
  ].forEach(function(name) {
    const resolved = _stage3ResolveSymbol_(name);
    const exists = typeof resolved === 'object' || typeof resolved === 'function';
    _stage3PushCheck_(
      checks,
      `Stage4 module ${name}`,
      exists ? 'OK' : 'FAIL',
      exists ? 'Доступний' : 'Не знайдено',
      exists ? '' : `Перевірте ${name}.gs`
    );
  });

  ['listMonths', 'getSendPanelData', 'switchBotToMonth', 'generateSendPanelForDate', 'buildDaySummary', 'openPersonCard', 'runMaintenanceScenario']
    .forEach(function(name) {
      const exists = !!(Stage4UseCases_ && typeof Stage4UseCases_[name] === 'function');
      _stage3PushCheck_(
        checks,
        `Stage4 use-case ${name}`,
        exists ? 'OK' : 'FAIL',
        exists ? 'Доступний' : 'Не знайдено',
        exists ? '' : 'Перевірте UseCases.gs'
      );
    });

  runHistoricalStructuralDiagnosticsInternal_({ mode: shallow ? 'quick' : 'structural' }).checks.forEach(function(item) {
    checks.push(item);
  });

  if (!shallow) {
    runHistoricalCompatibilityDiagnosticsInternal_({ mode: 'compatibility' }).checks.forEach(function(item) {
      checks.push(item);
    });
  }

  try {
    const auditSheet = ensureAuditTrailSheet_();
    _stage3PushCheck_(
      checks,
      'Audit trail sheet',
      auditSheet ? 'OK' : 'WARN',
      auditSheet ? `Аркуш "${auditSheet.getName()}" доступний` : 'AUDIT_LOG не створений',
      auditSheet ? '' : 'Створіть AUDIT_LOG автоматично або вручну'
    );
  } catch (e) {
    _stage3PushCheck_(
      checks,
      'Audit trail sheet',
      'WARN',
      e && e.message ? e.message : String(e),
      'Перевірте AuditTrail.gs'
    );
  }

  try {
    const jobs = Stage4Triggers_.listJobs();
    _stage3PushCheck_(
      checks,
      'Managed jobs registry',
      jobs.length ? 'OK' : 'WARN',
      `Jobs: ${jobs.length}`,
      jobs.length ? '' : 'Перевірте Triggers.gs'
    );
  } catch (e) {
    _stage3PushCheck_(
      checks,
      'Managed jobs registry',
      'FAIL',
      e && e.message ? e.message : String(e),
      'Перевірте Triggers.gs'
    );
  }

  try {
    const templateKeys = Stage4Templates_.listKeys();
    _stage3PushCheck_(
      checks,
      'Managed templates',
      templateKeys.length ? 'OK' : 'WARN',
      `Templates: ${templateKeys.length}`,
      templateKeys.length ? '' : 'Перевірте Templates.gs'
    );
  } catch (e) {
    _stage3PushCheck_(
      checks,
      'Managed templates',
      'WARN',
      e && e.message ? e.message : String(e),
      'Перевірте Templates.gs'
    );
  }

  if (!shallow && includeReconciliationPreview) {
    try {
      const reconciliation = Reconciliation_.run({
        mode: 'report',
        dryRun: true,
        date: _todayStr_()
      });

      _stage3PushCheck_(
        checks,
        'Reconciliation preview',
        reconciliation.criticalCount > 0 ? 'WARN' : 'OK',
        reconciliation.message || 'Reconciliation preview виконано',
        reconciliation.criticalCount > 0
          ? 'Перевірте report та за потреби виконайте safe repair'
          : ''
      );

      warnings.push.apply(warnings, reconciliation.warnings || []);
    } catch (e) {
      _stage3PushCheck_(
        checks,
        'Reconciliation preview',
        'FAIL',
        e && e.message ? e.message : String(e),
        'Перевірте Reconciliation.gs'
      );
    }
  }

  const failures = checks.filter(function(item) {
    return item.status === 'FAIL';
  }).length;

  const warns = checks.filter(function(item) {
    return item.status === 'WARN';
  }).length;

  return {
    ok: failures === 0,
    status: failures === 0 ? 'OK' : 'FAIL',
    stage: (typeof getProjectBundleMetadata_ === 'function' ? getProjectBundleMetadata_().stageVersion : '6.0.0-final'),
    checks: checks,
    warnings: [...new Set(warnings)],
    summary: failures === 0
      ? `Baseline health OK. Warnings: ${warns}`
      : `Baseline health FAIL. Failures: ${failures}, warnings: ${warns}`,
    options: opts,
    ts: new Date().toISOString()
  };
}


function runStage5MetadataConsistencyCheck_() {
  const checks = [];
  const meta = typeof getProjectBundleMetadata_ === 'function' ? getProjectBundleMetadata_() : PROJECT_BUNDLE_METADATA_;
  const docs = typeof getProjectDocumentationMap_ === 'function' ? getProjectDocumentationMap_() : {};
  const maintenancePolicy = typeof getStage5MaintenancePolicy_ === 'function' ? getStage5MaintenancePolicy_() : (meta && meta.maintenanceLayerPolicy) || {};
  const release = typeof getProjectReleaseNaming_ === 'function' ? getProjectReleaseNaming_() : (meta && meta.release) || {};

  _stage3PushCheck_(checks, 'Project bundle metadata', meta ? 'OK' : 'FAIL', meta ? 'PROJECT_BUNDLE_METADATA_ доступний' : 'PROJECT_BUNDLE_METADATA_ не знайдено', meta ? '' : 'Додайте ProjectMetadata.gs');
  if (!meta) return checks;

  _stage3PushCheck_(checks, 'Release stage marker', String(meta.stage || '') === '7.1' ? 'OK' : 'FAIL', `stage=${meta.stage || 'n/a'}, stageVersion=${meta.stageVersion || 'n/a'}, label=${meta.stageLabel || 'n/a'}`, 'Оновіть ProjectMetadata.gs до Stage 7.1');
  _stage3PushCheck_(checks, 'Active baseline marker', meta.activeBaseline === 'stage7-1-reliability-hardened-baseline' ? 'OK' : 'FAIL', `activeBaseline=${meta.activeBaseline || 'n/a'}`, 'Зафіксуйте Stage 7.1 як active baseline');
  _stage3PushCheck_(checks, 'Release archive naming', release && release.archiveFileName === 'gas_wapb_stage7_1_reliability_hardened_baseline.zip' ? 'OK' : 'FAIL', release && release.archiveFileName ? release.archiveFileName : 'Не задано', 'Вирівняйте archive naming');
  _stage3PushCheck_(checks, 'Release root folder naming', release && release.rootFolderName === 'gas_wapb_stage7_1_reliability_hardened_baseline' ? 'OK' : 'FAIL', release && release.rootFolderName ? release.rootFolderName : 'Не задано', 'Вирівняйте root folder naming');
  _stage3PushCheck_(checks, 'Packaging policy marker', meta.packagingPolicy && meta.packagingPolicy.policy === 'root-manifest-with-root-clasp-example' ? 'OK' : 'FAIL', meta.packagingPolicy && meta.packagingPolicy.policy ? meta.packagingPolicy.policy : 'Не задано', 'Зафіксуйте root manifest policy');
  _stage3PushCheck_(checks, 'Root manifest declared', meta.manifestIncluded === true ? 'OK' : 'FAIL', `manifestIncluded=${meta.manifestIncluded}`, 'Вирівняйте metadata');
  _stage3PushCheck_(checks, 'Root manifest physical', _projectBundleHas_((meta.packagingPolicy && meta.packagingPolicy.manifestPath) || 'appsscript.json') ? 'OK' : 'FAIL', _projectBundleHas_((meta.packagingPolicy && meta.packagingPolicy.manifestPath) || 'appsscript.json') ? ((meta.packagingPolicy && meta.packagingPolicy.manifestPath) || 'appsscript.json') : 'manifest missing', 'Додайте appsscript.json у root');
  _stage3PushCheck_(checks, 'Root clasp example physical', _projectBundleHas_((meta.packagingPolicy && meta.packagingPolicy.claspExamplePath) || '.clasp.json.example') ? 'OK' : 'FAIL', _projectBundleHas_((meta.packagingPolicy && meta.packagingPolicy.claspExamplePath) || '.clasp.json.example') ? ((meta.packagingPolicy && meta.packagingPolicy.claspExamplePath) || '.clasp.json.example') : 'clasp example missing', 'Додайте .clasp.json.example у root');

  _stage3PushCheck_(checks, 'Maintenance layer marker', meta.maintenanceLayerStatus === 'stage5-canonical-maintenance-api' ? 'OK' : 'FAIL', `maintenanceLayerStatus=${meta.maintenanceLayerStatus || 'n/a'}`, 'Позначте canonical maintenance layer у metadata');
  _stage3PushCheck_(checks, 'Compatibility policy marker', meta.compatibilityPolicyMarker === 'stage7-compatible' ? 'OK' : 'WARN', `compatibilityPolicyMarker=${meta.compatibilityPolicyMarker || 'n/a'}`, 'Зафіксуйте Stage 7 compatibility marker');
  _stage3PushCheck_(checks, 'Sunset policy marker', meta.sunsetPolicyMarker === 'stage7-sunset-governed' ? 'OK' : 'WARN', `sunsetPolicyMarker=${meta.sunsetPolicyMarker || 'n/a'}`, 'Зафіксуйте Stage 7 sunset policy marker');

  _stage3PushCheck_(checks, 'Canonical maintenance file', maintenancePolicy && maintenancePolicy.canonicalFile === 'Stage5MaintenanceApi.gs' ? 'OK' : 'FAIL', maintenancePolicy && maintenancePolicy.canonicalFile ? maintenancePolicy.canonicalFile : 'Не задано', 'Оновіть maintenance policy');
  _stage3PushCheck_(checks, 'Compatibility maintenance facade', maintenancePolicy && maintenancePolicy.compatibilityFile === 'Stage4MaintenanceApi.gs' ? 'OK' : 'WARN', maintenancePolicy && maintenancePolicy.compatibilityFile ? maintenancePolicy.compatibilityFile : 'Не задано', 'Явно позначте compatibility facade');

  const clientRuntimePolicy = meta && meta.clientRuntimePolicy || {};
  _stage3PushCheck_(checks, 'Client runtime file', clientRuntimePolicy.runtimeFile === 'JavaScript.html' ? 'OK' : 'FAIL', clientRuntimePolicy.runtimeFile || 'Не задано', 'Зафіксуйте JavaScript.html як canonical runtime');
  _stage3PushCheck_(checks, 'Client bootstrap mode', clientRuntimePolicy.bootstrapMode === 'sidebar-includeTemplate' ? 'OK' : 'FAIL', clientRuntimePolicy.bootstrapMode || 'Не задано', 'Використовуйте Sidebar.html -> includeTemplate(\'JavaScript\')');
  _stage3PushCheck_(checks, 'Client modular status', clientRuntimePolicy.modularStatus === 'active-js-include-chain' ? 'OK' : 'WARN', clientRuntimePolicy.modularStatus || 'Не задано', 'Позначте Js.*.html як non-active experimental/reference artifacts');
  _stage3PushCheck_(checks, 'Diagnostics wording policy', meta.diagnosticsPolicy && meta.diagnosticsPolicy.wording === 'stage7-1-reliability-hardened-baseline' ? 'OK' : 'WARN', meta.diagnosticsPolicy && meta.diagnosticsPolicy.wording ? meta.diagnosticsPolicy.wording : 'Не задано', 'Зафіксуйте Stage 7.1 diagnostics wording policy');

  const requiredDocs = Array.isArray(meta.requiredDocs) ? meta.requiredDocs : [];
  requiredDocs.forEach(function(doc) {
    _stage3PushCheck_(checks, `Required doc declared ${doc}`, requiredDocs.indexOf(doc) !== -1 ? 'OK' : 'FAIL', 'Документ включено в metadata.requiredDocs', 'Оновіть ProjectMetadata.gs');
    _stage3PushCheck_(checks, `Required doc physical ${doc}`, _projectBundleHas_(doc) ? 'OK' : 'FAIL', _projectBundleHas_(doc) ? `present=${doc}` : `missing=${doc}`, 'Вирівняйте bundle layout');
  });

  const activeDocs = docs && docs.active ? Object.values(docs.active) : [];
  activeDocs.forEach(function(doc) {
    _stage3PushCheck_(checks, `Active doc path ${doc}`, !_isArchivePath_(doc) ? 'OK' : 'FAIL', doc, 'Активний документ не може лежати в docs/archive/');
    _stage3PushCheck_(checks, `Active doc physical ${doc}`, _projectBundleHas_(doc) ? 'OK' : 'FAIL', _projectBundleHas_(doc) ? `present=${doc}` : `missing=${doc}`, 'Вирівняйте bundle layout');
  });

  const referenceDocs = Array.isArray(docs.reference) ? docs.reference : [];
  referenceDocs.forEach(function(doc) {
    _stage3PushCheck_(checks, `Reference doc path ${doc}`, _isReferencePath_(doc) ? 'OK' : 'FAIL', doc, 'Reference docs мають лежати в docs/reference/');
  });

  const historicalDocs = Array.isArray(docs.historical) ? docs.historical : [];
  historicalDocs.forEach(function(doc) {
    _stage3PushCheck_(checks, `Historical doc path ${doc}`, _isArchivePath_(doc) ? 'OK' : 'FAIL', doc, 'Historical docs мають лежати в docs/archive/');
  });

  ['docs/reference/PUBLIC_API_STAGE5.md', 'docs/reference/CHANGELOG_STAGE5.md', 'docs/reference/STAGE5_REPORT.md', 'docs/reference/STAGE6A_REPORT.md'].forEach(function(doc) {
    _stage3PushCheck_(checks, `Canonical reference doc ${doc}`, _projectBundleHas_(doc) ? 'OK' : 'FAIL', _projectBundleHas_(doc) ? `present=${doc}` : `missing=${doc}`, 'Відновіть canonical reference docs');
  });

  const helperOk = typeof HtmlUtils_ === 'object'
    && typeof HtmlUtils_.escapeHtml === 'function'
    && typeof escapeHtml_ === 'function'
    && typeof _escapeHtml_ === 'function'
    && escapeHtml_('<b>') === HtmlUtils_.escapeHtml('<b>')
    && _escapeHtml_('<b>') === HtmlUtils_.escapeHtml('<b>');

  _stage3PushCheck_(checks, 'Canonical HTML helper', helperOk ? 'OK' : 'FAIL', helperOk ? 'HtmlUtils_.escapeHtml() є source-of-truth, wrappers узгоджені' : 'Helper-layer розсинхронізований', helperOk ? '' : 'Перевірте HtmlUtils.gs / DeprecatedRegistry.gs');

  return checks;
}


function runStage5StructuralDiagnostics_(options) {
  const opts = options || {};
  const checks = [];
  const warnings = [];
  const meta = typeof getProjectBundleMetadata_ === 'function' ? getProjectBundleMetadata_() : PROJECT_BUNDLE_METADATA_;
  const layerMap = typeof getStage5LayerMap_ === 'function' ? getStage5LayerMap_() : (meta && meta.layerMap) || {};
  const apiMap = typeof getStage5CanonicalApiMap_ === 'function' ? getStage5CanonicalApiMap_() : null;
  const routing = typeof getStage5ClientRoutingPolicy_ === 'function' ? getStage5ClientRoutingPolicy_() : null;
  const docs = typeof getProjectDocumentationMap_ === 'function' ? getProjectDocumentationMap_() : {};
  const maintenancePolicy = typeof getStage5MaintenancePolicy_ === 'function' ? getStage5MaintenancePolicy_() : (meta && meta.maintenanceLayerPolicy) || {};
  const release = typeof getProjectReleaseNaming_ === 'function' ? getProjectReleaseNaming_() : (meta && meta.release) || {};

  _stage3PushCheck_(checks, 'Release layer map', layerMap && typeof layerMap === 'object' ? 'OK' : 'FAIL', layerMap && typeof layerMap === 'object' ? 'Layer map доступний' : 'Layer map відсутній', 'Оновіть ProjectMetadata.gs');
  ['sidebarApplicationApi', 'spreadsheetActionApi', 'maintenanceApi', 'useCases', 'workflow', 'dialogPresentation', 'dialogTemplates', 'diagnostics', 'tests', 'metadata'].forEach(function(key) {
    const ok = !!(meta && meta.canonicalLayers && meta.canonicalLayers[key]);
    _stage3PushCheck_(checks, `Canonical layer pointer ${key}`, ok ? 'OK' : 'FAIL', ok ? meta.canonicalLayers[key] : 'Не задано', 'Оновіть ProjectMetadata.gs');
  });

  ['application', 'spreadsheet', 'maintenance', 'compatibility'].forEach(function(kind) {
    const list = apiMap && Array.isArray(apiMap[kind]) ? apiMap[kind] : [];
    _stage3PushCheck_(checks, `Canonical API map ${kind}`, list.length ? 'OK' : 'FAIL', list.length ? `entrypoints=${list.length}` : 'Список порожній', 'Оновіть ProjectMetadata.gs');
    list.forEach(function(fnName) {
      _stage3PushCheck_(checks, `Entrypoint ${fnName}`, _stage3HasFn_(fnName) ? 'OK' : 'FAIL', _stage3HasFn_(fnName) ? 'Доступний' : 'Не знайдено', 'Перевірте відповідний файл API');
    });
  });

  ['sidebar', 'spreadsheet', 'maintenance'].forEach(function(group) {
    const groupMap = routing && routing[group];
    _stage3PushCheck_(checks, `Client routing group ${group}`, groupMap && typeof groupMap === 'object' ? 'OK' : 'FAIL', groupMap && typeof groupMap === 'object' ? `routes=${Object.keys(groupMap).length}` : 'Routing group відсутній', 'Оновіть client routing policy');
    Object.keys(groupMap || {}).forEach(function(action) {
      const fnName = groupMap[action];
      _stage3PushCheck_(checks, `Client route ${group}.${action} -> ${fnName}`, _stage3HasFn_(fnName) ? 'OK' : 'FAIL', _stage3HasFn_(fnName) ? 'Маршрут розвʼязується' : 'Target function не знайдено', 'Вирівняйте metadata та API');
    });
  });

  const activeDocs = docs && docs.active ? Object.values(docs.active) : [];
  const referenceDocs = Array.isArray(docs.reference) ? docs.reference : [];
  const historicalDocs = Array.isArray(docs.historical) ? docs.historical : [];

  _stage3PushCheck_(checks, 'Active docs hierarchy', activeDocs.length >= 4 ? 'OK' : 'FAIL', activeDocs.length ? activeDocs.join(', ') : 'Активні документи не описані', 'Оновіть documentation map');
  _stage3PushCheck_(checks, 'Reference docs hierarchy', referenceDocs.length >= 4 ? 'OK' : 'WARN', referenceDocs.length ? referenceDocs.join(', ') : 'Reference docs не описані', 'Оновіть documentation map');
  _stage3PushCheck_(checks, 'Historical docs hierarchy', historicalDocs.length >= 4 ? 'OK' : 'WARN', historicalDocs.length ? `historical=${historicalDocs.length}` : 'Історичні документи не описані', 'Оновіть documentation map');

  _stage3PushCheck_(checks, 'Archive misuse for active docs', activeDocs.filter(_isArchivePath_).length === 0 ? 'OK' : 'FAIL', activeDocs.filter(_isArchivePath_).length ? activeDocs.filter(_isArchivePath_).join(', ') : 'active docs not in archive', 'Виведіть active docs з docs/archive/');
  _stage3PushCheck_(checks, 'Reference docs location', referenceDocs.every(_isReferencePath_) ? 'OK' : 'FAIL', referenceDocs.filter(function(path) { return !_isReferencePath_(path); }).join(', ') || 'all reference docs are in docs/reference/', 'Вирівняйте reference docs');
  _stage3PushCheck_(checks, 'Historical docs location', historicalDocs.every(_isArchivePath_) ? 'OK' : 'FAIL', historicalDocs.filter(function(path) { return !_isArchivePath_(path); }).join(', ') || 'all historical docs are in docs/archive/', 'Вирівняйте historical docs');

  ['README.md', 'ARCHITECTURE.md', 'RUNBOOK.md', 'STAGE7_REPORT.md'].forEach(function(path) {
    _diagPushPathCheck_(checks, `Physical active file ${path}`, path, 'active');
  });
  ['docs/reference/PUBLIC_API_STAGE5.md', 'docs/reference/CHANGELOG_STAGE5.md', 'docs/reference/STAGE5_REPORT.md', 'docs/reference/STAGE6A_REPORT.md'].forEach(function(path) {
    _diagPushPathCheck_(checks, `Physical reference file ${path}`, path, 'reference');
  });

  _stage3PushCheck_(checks, 'Release naming aligned', release && release.archiveBaseName === 'gas_wapb_stage7_1_reliability_hardened_baseline' && release.rootFolderName === 'gas_wapb_stage7_1_reliability_hardened_baseline' ? 'OK' : 'FAIL', release ? `${release.archiveBaseName || 'n/a'} / ${release.rootFolderName || 'n/a'}` : 'release metadata missing', 'Вирівняйте release naming');
  _stage3PushCheck_(checks, 'Maintenance naming policy', maintenancePolicy && maintenancePolicy.policy === 'canonical-stage5-maintenance-with-stage4-compat-facade' ? 'OK' : 'FAIL', maintenancePolicy && maintenancePolicy.policy ? maintenancePolicy.policy : 'Не задано', 'Зафіксуйте canonical maintenance naming policy');

  ['runStage5QuickDiagnostics_', 'runStage5StructuralDiagnostics_', 'runStage5OperationalDiagnostics_', 'runStage5SunsetDiagnostics_', 'runStage5FullDiagnostics_'].forEach(function(fnName) {
    _stage3PushCheck_(checks, `Diagnostics mode ${fnName}`, _stage3HasFn_(fnName) ? 'OK' : 'FAIL', _stage3HasFn_(fnName) ? 'Доступний' : 'Не знайдено', 'Перевірте Diagnostics.gs');
  });

  return {
    ok: checks.filter(function(item) { return item.status === 'FAIL'; }).length === 0,
    stage: (typeof getProjectBundleMetadata_ === 'function' ? getProjectBundleMetadata_().stageVersion : ((typeof STAGE5_CONFIG === 'object' && STAGE5_CONFIG && STAGE5_CONFIG.VERSION) || '6.0.0-final')),
    mode: opts.mode || 'structural',
    checks: checks,
    warnings: warnings,
    summary: _releaseStageLabel_() + ' structural diagnostics завершено',
    ts: new Date().toISOString()
  };
}


function runStage5OperationalDiagnostics_(options) {
  const opts = options || {};
  const checks = [];
  const warnings = [];
  const meta = typeof getProjectBundleMetadata_ === 'function' ? getProjectBundleMetadata_() : PROJECT_BUNDLE_METADATA_;
  const primitiveHealth = runStage4HealthCheck_({ shallow: false, includeCompatibilityLayer: true, includeReconciliationPreview: true });

  _stage3PushCheck_(checks, 'Baseline health', primitiveHealth && primitiveHealth.ok ? 'OK' : 'WARN', primitiveHealth && primitiveHealth.summary ? primitiveHealth.summary : 'Stage4 primitive health report недоступний', primitiveHealth && primitiveHealth.ok ? '' : 'Перевірте primitive health checks');

  [
    'SendPanelService_',
    'SummaryService_',
    'VacationService_',
    'PreviewLinkService_',
    'SelectionActionService_',
    'DialogTemplates_',
    'DialogPresenter_',
    'TemplateRegistry_',
    'TemplateResolver_',
    'JobRuntimeRepository_',
    'JobRuntime_'
  ].forEach(function(name) {
    const resolved = _stage3ResolveSymbol_(name);
    const exists = typeof resolved === 'object' || typeof resolved === 'function';
    _stage3PushCheck_(checks, `Release module ${name}`, exists ? 'OK' : 'FAIL', exists ? 'Доступний' : 'Не знайдено', exists ? '' : `Перевірте ${name}.gs`);
  });

  const apiMap = typeof getStage5CanonicalApiMap_ === 'function' ? getStage5CanonicalApiMap_() : null;
  (apiMap && apiMap.spreadsheet || []).forEach(function(name) {
    const exists = typeof _global_()[name] === 'function';
    _stage3PushCheck_(checks, `Spreadsheet API ${name}`, exists ? 'OK' : 'FAIL', exists ? 'Доступний' : 'Не знайдено', exists ? '' : 'Перевірте SpreadsheetActionsApi.gs');
  });
  (apiMap && apiMap.maintenance || []).forEach(function(name) {
    const exists = typeof _global_()[name] === 'function';
    _stage3PushCheck_(checks, `Maintenance API ${name}`, exists ? 'OK' : 'FAIL', exists ? 'Доступний' : 'Не знайдено', exists ? '' : 'Перевірте Stage5MaintenanceApi.gs');
  });

  const clientRuntimePolicy = meta && meta.clientRuntimePolicy || {};

  _stage3PushCheck_(checks, 'Client include helper include()', typeof include === 'function' ? 'OK' : 'FAIL', typeof include === 'function' ? 'Доступний' : 'Не знайдено', 'Додайте include() у Code.gs');
  _stage3PushCheck_(checks, 'Client include helper includeTemplate()', typeof includeTemplate === 'function' ? 'OK' : 'FAIL', typeof includeTemplate === 'function' ? 'Доступний' : 'Не знайдено', 'Додайте includeTemplate() у Code.gs');

  try {
    const rawSidebar = include('Sidebar');
    const usesTemplate = rawSidebar.indexOf("includeTemplate('JavaScript')") !== -1 || rawSidebar.indexOf('includeTemplate("JavaScript")') !== -1;
    const usesRawInclude = rawSidebar.indexOf("include('JavaScript')") !== -1 || rawSidebar.indexOf('include("JavaScript")') !== -1;
    _stage3PushCheck_(checks, 'Sidebar bootstrap include path', usesTemplate && !usesRawInclude ? 'OK' : 'FAIL', usesTemplate ? 'Sidebar використовує includeTemplate(\'JavaScript\')' : 'Template include не знайдено', usesTemplate && !usesRawInclude ? '' : 'Оновіть Sidebar.html');
  } catch (e) {
    _stage3PushCheck_(checks, 'Sidebar bootstrap include path', 'FAIL', e && e.message ? e.message : String(e), 'Перевірте Sidebar.html / include()');
  }

  try {
    const styles = include('Styles');
    _stage3PushCheck_(checks, 'Sidebar styles include', styles && styles.length ? 'OK' : 'WARN', styles && styles.length ? 'Styles.html доступний' : 'Styles.html порожній', styles && styles.length ? '' : 'Перевірте Styles.html');
  } catch (e) {
    _stage3PushCheck_(checks, 'Sidebar styles include', 'FAIL', e && e.message ? e.message : String(e), 'Перевірте Styles.html');
  }

  try {
    const rawJavaScript = include('JavaScript');
    const evaluatedRuntime = includeTemplate('JavaScript');
    const modular = (rawJavaScript.indexOf("include('Js.Core')") !== -1 || rawJavaScript.indexOf('include("Js.Core")') !== -1)
      && evaluatedRuntime.indexOf('<script') !== -1
      && evaluatedRuntime.indexOf('stage7-sidebar-runtime') !== -1;
    _stage3PushCheck_(checks, 'Client runtime file JavaScript.html', modular ? 'OK' : 'FAIL', modular ? 'Модульний runtime через активний Js.* include chain' : 'Модульний include chain не підтверджено', modular ? '' : 'Поверніть JavaScript.html до модульного include-агрегатора');
  } catch (e) {
    _stage3PushCheck_(checks, 'Client runtime file JavaScript.html', 'FAIL', e && e.message ? e.message : String(e), 'Перевірте JavaScript.html');
  }

  try {
    const evaluatedRuntime = includeTemplate('JavaScript');
    const hasScript = evaluatedRuntime.indexOf('<script') !== -1;
    _stage3PushCheck_(checks, 'Client runtime template evaluation', hasScript ? 'OK' : 'FAIL', hasScript ? 'JavaScript.html template evaluated successfully' : 'Script block не знайдено', hasScript ? '' : 'Перевірте includeTemplate() / JavaScript.html');
  } catch (e) {
    _stage3PushCheck_(checks, 'Client runtime template evaluation', 'FAIL', e && e.message ? e.message : String(e), 'Перевірте includeTemplate() / JavaScript.html');
  }

  _stage3PushCheck_(checks, 'Client runtime metadata policy', clientRuntimePolicy.runtimeStatus === 'canonical-modular-runtime' ? 'OK' : 'WARN', clientRuntimePolicy.runtimeStatus || 'Не задано', 'Оновіть ProjectMetadata.gs');
  _stage3PushCheck_(checks, 'Experimental client artifacts policy', clientRuntimePolicy.modularStatus === 'active-js-include-chain' ? 'OK' : 'WARN', clientRuntimePolicy.modularStatus || 'Не задано', 'Js.*.html мають бути active runtime chain');

  try {
    const runtime = JobRuntime_.buildRuntimeReport();
    _stage3PushCheck_(checks, 'Job runtime report', runtime ? 'OK' : 'WARN', `jobs=${runtime.totalJobs || 0}, stale=${runtime.staleJobs || 0}, failed=${runtime.failedJobs || 0}`, runtime && runtime.failedJobs ? 'Перевірте список runtime failures' : '');
  } catch (e) {
    _stage3PushCheck_(checks, 'Job runtime report', 'FAIL', e && e.message ? e.message : String(e), 'Перевірте JobRuntime.gs');
  }

  try {
    const templates = TemplateRegistry_.list();
    _stage3PushCheck_(checks, 'Template governance', templates.length ? 'OK' : 'WARN', `templates=${templates.length}`, templates.length ? '' : 'Перевірте Templates/TEMPLATE лист');
  } catch (e) {
    _stage3PushCheck_(checks, 'Template governance', 'FAIL', e && e.message ? e.message : String(e), 'Перевірте TemplateRegistry.gs');
  }

  _stage3PushCheck_(checks, 'Project self-description stage', meta && String(meta.stage || '') === '7.1' ? 'OK' : 'FAIL', meta ? `stage=${meta.stage}, version=${meta.stageVersion}` : 'metadata недоступний', 'Оновіть ProjectMetadata.gs');

  return {
    ok: checks.filter(function(item) { return item.status === 'FAIL'; }).length === 0,
    stage: (typeof getProjectBundleMetadata_ === 'function' ? getProjectBundleMetadata_().stageVersion : '6.0.0-final'),
    mode: opts.mode || 'operational',
    checks: checks,
    warnings: warnings,
    summary: _releaseStageLabel_() + ' operational diagnostics завершено',
    ts: new Date().toISOString()
  };
}

function runStage5SunsetDiagnostics_(options) {
  const opts = options || {};
  const report = getCompatibilitySunsetReport_();
  const docs = typeof getProjectDocumentationMap_ === 'function' ? getProjectDocumentationMap_() : {};
  const checks = [];

  _stage3PushCheck_(checks, 'Compatibility registry size', report.total > 0 ? 'OK' : 'FAIL', `records=${report.total}`, report.total > 0 ? '' : 'Перевірте DeprecatedRegistry.gs');
  _stage3PushCheck_(checks, 'Sunset markers completeness', report.missingSunsetMarkers === 0 ? 'OK' : 'WARN', `missing=${report.missingSunsetMarkers}`, report.missingSunsetMarkers === 0 ? '' : 'Проставте sunset markers');
  _stage3PushCheck_(checks, 'Compatibility split report (informational)', 'OK', `canonical=${report.counts.canonical || 0}, compatibility=${report.counts['compatibility-only'] || 0}, historical=${report.counts.historical || 0}, deprecated=${report.counts.deprecated || 0}, planned=${report.counts['sunset planned'] || 0}`, '');
  _stage3PushCheck_(checks, 'Historical docs explicitly separated', Array.isArray(docs.historical) && docs.historical.length >= 3 ? 'OK' : 'WARN', Array.isArray(docs.historical) ? `historicalDocs=${docs.historical.length}` : 'historical docs map відсутній', 'Явно позначте Stage 4.x docs як historical/reference');

  return {
    ok: checks.filter(function(item) { return item.status === 'FAIL'; }).length === 0,
    stage: (typeof getProjectBundleMetadata_ === 'function' ? getProjectBundleMetadata_().stageVersion : '6.0.0-final'),
    mode: opts.mode || 'compatibility sunset',
    checks: checks,
    warnings: [],
    summary: _releaseStageLabel_() + ' sunset diagnostics завершено',
    ts: new Date().toISOString(),
    report: report
  };
}

function runStage5QuickDiagnostics_(options) {
  const opts = options || {};
  const metadataChecks = runStage5MetadataConsistencyCheck_();
  const structural = runStage5StructuralDiagnostics_({ mode: 'quick' });
  const operational = runStage5OperationalDiagnostics_({ mode: 'quick' });

  const checks = []
    .concat(metadataChecks.filter(function(item) {
      return item.name === 'Project bundle metadata'
        || item.name === 'Release stage marker'
        || item.name.indexOf('Required doc physical ') === 0
        || item.name === 'Root manifest physical'
        || item.name === 'Release archive naming';
    }))
    .concat((structural.checks || []).filter(function(item) {
      return item.name.indexOf('Physical active file ') === 0
        || item.name.indexOf('Physical reference file ') === 0
        || item.name === 'Archive misuse for active docs'
        || item.name === 'Release naming aligned';
    }))
    .concat((operational.checks || []).filter(function(item) {
      return item.name === 'Baseline health'
        || item.name === 'Job runtime report'
        || item.name === 'Template governance';
    }));

  return {
    ok: checks.filter(function(item) { return item.status === 'FAIL'; }).length === 0,
    stage: (typeof getProjectBundleMetadata_ === 'function' ? getProjectBundleMetadata_().stageVersion : '6.0.0-final'),
    mode: opts.mode || 'quick',
    checks: checks,
    warnings: [],
    summary: _releaseStageLabel_() + ' quick diagnostics завершено',
    ts: new Date().toISOString()
  };
}


function runStage5FullDiagnostics_(options) {
  const opts = options || {};
  const metadataChecks = runStage5MetadataConsistencyCheck_();
  const structural = runStage5StructuralDiagnostics_({ mode: 'full' });
  const operational = runStage5OperationalDiagnostics_({ mode: 'full' });
  const sunset = runStage5SunsetDiagnostics_({ mode: 'compatibility sunset' });

  const checks = []
    .concat(metadataChecks || [])
    .concat(structural.checks || [])
    .concat(operational.checks || [])
    .concat(sunset.checks || []);

  const warnings = stage4MergeWarnings_(structural.warnings || [], operational.warnings || [], sunset.warnings || []);
  const failures = checks.filter(function(item) { return item.status === 'FAIL'; }).length;
  const warns = checks.filter(function(item) { return item.status === 'WARN'; }).length;

  return {
    ok: failures === 0,
    stage: (typeof getProjectBundleMetadata_ === 'function' ? getProjectBundleMetadata_().stageVersion : '6.0.0-final'),
    mode: opts.mode || 'full',
    checks: checks,
    warnings: warnings,
    summary: failures === 0
      ? `${_releaseStageLabel_()} diagnostics OK. Warnings: ${warns}`
      : `${_releaseStageLabel_()} diagnostics FAIL. Failures: ${failures}, warnings: ${warns}`,
    ts: new Date().toISOString()
  };
}


function runStage6AHardeningDiagnostics_(options) {
  const opts = options || {};
  const checks = [];
  const routeReport = typeof getStage6ARouteCoverageReport_ === 'function' ? getStage6ARouteCoverageReport_() : null;
  const routing = typeof getStage6ARoutingRegistry_ === 'function' ? getStage6ARoutingRegistry_() : null;
  const domain = typeof runStage6ADomainTests_ === 'function' ? runStage6ADomainTests_({ mode: 'diagnostics' }) : null;
  const runtime = typeof JobRuntime_.buildRuntimeReport === 'function' ? JobRuntime_.buildRuntimeReport() : null;

  _stage3PushCheck_(checks, 'Stage6A routing registry', routing && typeof routing === 'object' ? 'OK' : 'FAIL', routing ? 'registry available' : 'registry missing', 'Перевірте RoutingRegistry.gs');
  _stage3PushCheck_(checks, 'Stage6A route map completeness', routeReport && routeReport.total >= 20 ? 'OK' : 'FAIL', routeReport ? `routes=${routeReport.total}` : 'route report missing', 'Заповніть routing registry');
  _stage3PushCheck_(checks, 'Lock coverage for critical writes', routeReport && routeReport.criticalWrites === routeReport.lockCoverage ? 'OK' : 'FAIL', routeReport ? `critical=${routeReport.criticalWrites}, covered=${routeReport.lockCoverage}` : 'n/a', 'Покрийте всі critical write routes lock policy');
  _stage3PushCheck_(checks, 'Required domain tests present', domain && domain.total >= 20 ? 'OK' : 'FAIL', domain ? `tests=${domain.total}, failed=${domain.failed}` : 'domain tests missing', 'Додайте / відновіть isolated domain tests');
  _stage3PushCheck_(checks, 'Domain tests status', domain && domain.ok ? 'OK' : 'WARN', domain ? domain.summary : 'domain tests missing', domain && domain.ok ? '' : 'Перегляньте runStage6ADomainTests_()');
  _stage3PushCheck_(checks, 'Hybrid job runtime policy', runtime && runtime.storagePolicy && runtime.storagePolicy.policy === 'hybrid-sheet-plus-properties' ? 'OK' : 'FAIL', runtime && runtime.storagePolicy ? runtime.storagePolicy.policy : 'runtime policy missing', 'Вирівняйте JobRuntimeRepository.gs');
  _stage3PushCheck_(checks, 'Post-repair verification capability', typeof Reconciliation_ === 'object' && typeof Reconciliation_.verifyRepairResult === 'function' ? 'OK' : 'FAIL', typeof Reconciliation_ === 'object' && typeof Reconciliation_.verifyRepairResult === 'function' ? 'available' : 'missing', 'Додайте verifyRepairResult()');

  return {
    ok: checks.filter(function(item) { return item.status === 'FAIL'; }).length === 0,
    mode: opts.mode || 'stage6a-hardening',
    checks: checks,
    warnings: [],
    summary: 'Hardening diagnostics завершено',
    ts: new Date().toISOString()
  };
}

function runStage5FullVerboseDiagnostics_(options) {
  const base = runStage5FullDiagnostics_(options || {});
  const hardening = runStage6AHardeningDiagnostics_({ mode: 'stage6a-hardening' });
  return {
    ok: base.ok && hardening.ok,
    stage: base.stage,
    mode: 'full-verbose',
    checks: [].concat(base.checks || []).concat(hardening.checks || []),
    warnings: stage4MergeWarnings_(base.warnings || [], hardening.warnings || []),
    summary: (base.ok && hardening.ok) ? (_releaseStageLabel_() + ' verbose diagnostics OK') : (_releaseStageLabel_() + ' verbose diagnostics потребують уваги'),
    ts: new Date().toISOString()
  };
}

function debugSendPanelNow() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(CONFIG.SEND_PANEL_SHEET);

  const out = {
    botMonth: getBotMonthSheetName_(),
    panelSheetExists: !!sh,
    panelLastRow: sh ? sh.getLastRow() : 0,
    rawRowsCount: 0
  };

  if (sh && sh.getLastRow() >= CONFIG.SEND_PANEL_DATA_START_ROW) {
    const count = sh.getLastRow() - (CONFIG.SEND_PANEL_DATA_START_ROW - 1);
    const raw = sh.getRange(CONFIG.SEND_PANEL_DATA_START_ROW, 1, count, 7).getDisplayValues();
    out.rawRowsCount = raw.length;
  }

  let apiRowsCount = 0;
  let apiMonth = '';
  let apiError = '';

  try {
    const response = apiStage4GetSendPanelData();
    const result = (response && response.data && response.data.result) ? response.data.result : {};
    apiRowsCount = Array.isArray(result.rows) ? result.rows.length : 0;
    apiMonth = result.month || '';
    apiError = response && response.error ? response.error : '';
  } catch (e) {
    apiError = e && e.message ? e.message : String(e);
  }

  SpreadsheetApp.getUi().alert(
    'botMonth: ' + out.botMonth + '\n' +
    'panelSheetExists: ' + out.panelSheetExists + '\n' +
    'panelLastRow: ' + out.panelLastRow + '\n' +
    'rawRowsCount: ' + out.rawRowsCount + '\n' +
    'apiRowsCount: ' + apiRowsCount + '\n' +
    'apiMonth: ' + apiMonth + '\n' +
    'apiError: ' + (apiError || '—')
  );
}

function debugSendPanelBridge_() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(CONFIG.SEND_PANEL_SHEET);

  const out = {
    botMonth: getBotMonthSheetName_(),
    panelSheetExists: !!sh,
    panelLastRow: sh ? sh.getLastRow() : 0,
    rawRowsCount: 0,
    rawSample: [],
    repoRowsCount: 0,
    repoSample: [],
    apiSuccess: false,
    apiRowsCount: 0,
    apiMonth: '',
    apiDate: '',
    apiError: ''
  };

  if (sh && sh.getLastRow() >= CONFIG.SEND_PANEL_DATA_START_ROW) {
    const count = sh.getLastRow() - (CONFIG.SEND_PANEL_DATA_START_ROW - 1);
    const raw = sh.getRange(CONFIG.SEND_PANEL_DATA_START_ROW, 1, count, 7).getDisplayValues();
    out.rawRowsCount = raw.length;
    out.rawSample = raw.slice(0, 5);
  }

  try {
    const repoRows = SendPanelRepository_.readRows();
    out.repoRowsCount = repoRows.length;
    out.repoSample = repoRows.slice(0, 5);
  } catch (e) {
    out.repoError = e && e.message ? e.message : String(e);
  }

  try {
    const apiResponse = apiStage4GetSendPanelData();
    out.apiSuccess = !!apiResponse?.success;
    out.apiRowsCount = Array.isArray(apiResponse?.data?.result?.rows)
      ? apiResponse.data.result.rows.length
      : 0;
    out.apiMonth = apiResponse?.data?.result?.month || '';
    out.apiDate = apiResponse?.data?.result?.date || '';
    out.apiError = apiResponse?.error || '';
  } catch (e) {
    out.apiError = e && e.message ? e.message : String(e);
  }

  Logger.log(JSON.stringify(out, null, 2));
  SpreadsheetApp.getUi().alert(
    'DEBUG SEND_PANEL\\n' +
    'botMonth: ' + out.botMonth + '\\n' +
    'sheetExists: ' + out.panelSheetExists + '\\n' +
    'panelLastRow: ' + out.panelLastRow + '\\n' +
    'rawRowsCount: ' + out.rawRowsCount + '\\n' +
    'repoRowsCount: ' + out.repoRowsCount + '\\n' +
    'apiRowsCount: ' + out.apiRowsCount + '\\n' +
    'apiMonth: ' + out.apiMonth + '\\n' +
    'apiError: ' + (out.apiError || '—')
  );
}

// =========================================================
// STAGE 7 MERGED DIAGNOSTICS OVERRIDE LAYER
// Відновлює повний набір старих перевірок + додає актуальні Stage 7 checks.
// =========================================================

function _diagGlobal_() {
  try {
    if (typeof globalThis !== 'undefined') return globalThis;
  } catch (_) {}
  try {
    return Function('return this')();
  } catch (_) {}
  return {};
}

function _diagSafeEval_(expr) {
  try {
    return eval(expr);
  } catch (_) {
    return undefined;
  }
}

function _diagHasRouteApi_(fnName) {
  var target = String(fnName || '').trim();
  if (!target) return false;

  try {
    if (typeof getStage6ARouteByApiMethod_ === 'function') {
      return !!getStage6ARouteByApiMethod_(target);
    }
  } catch (_) {}

  try {
    if (typeof listStage6ARoutes_ === 'function') {
      return (listStage6ARoutes_() || []).some(function(item) {
        return item && item.publicApiMethod === target;
      });
    }
  } catch (_) {}

  try {
    if (typeof getRoutingRegistry_ === 'function') {
      var routes = getRoutingRegistry_();
      if (Array.isArray(routes)) {
        return routes.some(function(item) { return item && item.publicApiMethod === target; });
      }
      if (routes && typeof routes === 'object') {
        return Object.keys(routes).some(function(key) {
          return routes[key] && routes[key].publicApiMethod === target;
        });
      }
    }
  } catch (_) {}

  return false;
}

function _diagResolveSymbolStage7_(name) {
  var target = String(name || '').trim();
  if (!target) return undefined;

  var direct = _diagSafeEval_(target);
  if (direct !== undefined) return direct;

  try {
    var g = _diagGlobal_();
    if (g && target in g) return g[target];
  } catch (_) {}

  if (_diagHasRouteApi_(target)) {
    return function routeApiProxyPlaceholder_() {};
  }

  return undefined;
}

function _fnExists_(name) {
  return typeof _diagResolveSymbolStage7_(name) === 'function';
}

function _stage3ResolveSymbol_(name) {
  return _diagResolveSymbolStage7_(name);
}

function _stage3HasFn_(name) {
  return typeof _diagResolveSymbolStage7_(name) === 'function';
}

function _releaseStageLabel_() {
  var meta = typeof getProjectBundleMetadata_ === 'function' ? getProjectBundleMetadata_() : null;
  return meta && meta.stageLabel ? meta.stageLabel : 'Stage 7.1 — Reliability Hardened Baseline';
}

function _diagNormalizeStatus_(status) {
  var normalized = String(status || 'WARN').toUpperCase();
  if (normalized === 'ERROR') return 'FAIL';
  if (normalized === 'CRITICAL') return 'FAIL';
  if (normalized === 'SUCCESS') return 'OK';
  return normalized;
}

function _diagResolveSeverity_(status, rawSeverity) {
  var sev = String(rawSeverity || '').toUpperCase();
  if (sev) return sev;
  var s = _diagNormalizeStatus_(status);
  if (s === 'FAIL') return 'CRITICAL';
  if (s === 'WARN') return 'WARN';
  return 'INFO';
}

function _diagResolveUiGroup_(check) {
  var explicit = String(check && check.uiGroup || '').toLowerCase();
  if (explicit === 'critical' || explicit === 'warnings' || explicit === 'compatibility' || explicit === 'ok') {
    return explicit;
  }

  var title = String((check && (check.title || check.name)) || '').toLowerCase();
  var details = String((check && (check.details || check.message)) || '').toLowerCase();
  var status = _diagNormalizeStatus_(check && check.status);

  var looksCompatibility =
    title.indexOf('deprecated ') === 0 ||
    title.indexOf('compatibility ') === 0 ||
    title.indexOf('wrapper source ') === 0 ||
    title.indexOf('ui-ban marker ') === 0 ||
    details.indexOf('compatibility-only') !== -1 ||
    details.indexOf('замінити на ') !== -1 ||
    details.indexOf('compatibility wrappers intentionally remain') !== -1;

  if (looksCompatibility) return 'compatibility';
  if (status === 'FAIL') return 'critical';
  if (status === 'WARN') return 'warnings';
  return 'ok';
}

function _diagNormalizeCheck_(check, titlePrefix) {
  var title = String((check && (check.title || check.name)) || '').trim();
  if (!title) title = 'Unnamed check';
  if (titlePrefix) {
    var pref = String(titlePrefix).trim();
    if (pref && title.indexOf(pref + ' / ') !== 0) title = pref + ' / ' + title;
  }

  var status = _diagNormalizeStatus_(check && check.status);
  var details = String((check && (check.details || check.message)) || '').trim();
  var howTo = String((check && (check.howTo || check.recommendation)) || '').trim();
  var severity = _diagResolveSeverity_(status, check && check.severity);

  return {
    name: title,
    title: title,
    status: status,
    ok: status === 'OK',
    severity: severity,
    uiGroup: _diagResolveUiGroup_(Object.assign({}, check || {}, { status: status, title: title, details: details })),
    details: details,
    message: details,
    howTo: howTo,
    recommendation: howTo
  };
}

function _diagNormalizeReportChecks_(report, titlePrefix) {
  var list = report && Array.isArray(report.checks) ? report.checks : [];
  return list.map(function(item) {
    return _diagNormalizeCheck_(item, titlePrefix || '');
  });
}

function _diagMergeChecks_() {
  var merged = [];
  var seen = {};

  Array.prototype.slice.call(arguments).forEach(function(part) {
    (part || []).forEach(function(item) {
      var normalized = _diagNormalizeCheck_(item);
      var key = [normalized.title, normalized.status, normalized.details, normalized.howTo].join(' | ');
      if (seen[key]) return;
      seen[key] = true;
      merged.push(normalized);
    });
  });

  return merged;
}

function _diagBuildWarningsFromChecks_(checks) {
  return (checks || [])
    .filter(function(item) { return item && item.status === 'WARN'; })
    .map(function(item) { return item.title; });
}

function _diagBuildReport_(checks, mode, summaryPrefix) {
  var list = Array.isArray(checks) ? checks : [];
  var fails = list.filter(function(item) { return item.status === 'FAIL'; }).length;
  var warns = list.filter(function(item) { return item.status === 'WARN'; }).length;
  return {
    ok: fails === 0,
    stage: '7.1',
    mode: mode || 'full',
    checks: list,
    warnings: _diagBuildWarningsFromChecks_(list),
    summary: fails === 0
      ? ((summaryPrefix || _releaseStageLabel_()) + '. Warnings: ' + warns)
      : ((summaryPrefix || _releaseStageLabel_()) + '. Failures: ' + fails + ', warnings: ' + warns),
    ts: new Date().toISOString()
  };
}

function _diagServiceSheetCheck_(checks, name) {
  try {
    var ss = SpreadsheetApp.getActive();
    var sh = ss.getSheetByName(name);
    _stage3PushCheck_(
      checks,
      'Service sheet ' + name,
      sh ? 'OK' : 'WARN',
      sh ? 'Доступний' : 'Ще не створений; буде створений автоматично при першій lifecycle-операції',
      sh ? '' : 'Запустіть будь-яку критичну write-операцію або ensureServiceSheets()'
    );
  } catch (e) {
    _stage3PushCheck_(checks, 'Service sheet ' + name, 'FAIL', e && e.message ? e.message : String(e), 'Перевірте доступ до SpreadsheetApp');
  }
}

function _diagBuildStage7CoreChecks_(options) {
  var opts = options || {};
  var checks = [];
  var meta = typeof getProjectBundleMetadata_ === 'function' ? getProjectBundleMetadata_() : {};
  var release = typeof getProjectReleaseNaming_ === 'function' ? getProjectReleaseNaming_() : {};
  var docs = typeof getProjectDocumentationMap_ === 'function' ? getProjectDocumentationMap_() : {};
  var policy = meta && meta.clientRuntimePolicy ? meta.clientRuntimePolicy : {};
  var runtimeContract = typeof getClientRuntimeContract_ === 'function' ? getClientRuntimeContract_() : {};

  _stage3PushCheck_(checks, 'Release stage marker', String(meta && meta.stage || '') === '7.1' ? 'OK' : 'FAIL', 'stage=' + (meta && meta.stage || 'n/a') + ', label=' + (meta && meta.stageLabel || 'n/a'), 'Оновіть ProjectMetadata.gs під Stage 7.1');
  _stage3PushCheck_(checks, 'Active baseline marker', meta && meta.activeBaseline === 'stage7-1-reliability-hardened-baseline' ? 'OK' : 'FAIL', 'activeBaseline=' + (meta && meta.activeBaseline || 'n/a'), 'Оновіть activeBaseline');
  _stage3PushCheck_(checks, 'Release naming aligned', release && release.archiveBaseName === 'gas_wapb_stage7_1_reliability_hardened_baseline' && release.rootFolderName === 'gas_wapb_stage7_1_reliability_hardened_baseline' ? 'OK' : 'FAIL', (release && release.archiveBaseName || 'n/a') + ' / ' + (release && release.rootFolderName || 'n/a'), 'Вирівняйте archive/root naming');
  _stage3PushCheck_(checks, 'Stage7 report active', docs && docs.active && docs.active.releaseReport === 'STAGE7_REPORT.md' ? 'OK' : 'FAIL', docs && docs.active && docs.active.releaseReport ? docs.active.releaseReport : 'Не задано', 'Зафіксуйте STAGE7_REPORT.md як active release report');
  _stage3PushCheck_(checks, 'Modular runtime policy', policy && policy.runtimeStatus === 'canonical-modular-runtime' ? 'OK' : 'FAIL', policy && policy.runtimeStatus ? policy.runtimeStatus : 'Не задано', 'Оновіть clientRuntimePolicy.runtimeStatus');
  _stage3PushCheck_(checks, 'Active Js include chain', policy && policy.modularStatus === 'active-js-include-chain' ? 'OK' : 'FAIL', policy && policy.modularStatus ? policy.modularStatus : 'Не задано', 'Оновіть clientRuntimePolicy.modularStatus');
  _stage3PushCheck_(checks, 'Runtime contract marker', runtimeContract && runtimeContract.policyMarker === 'stage7-sidebar-runtime' ? 'OK' : 'FAIL', runtimeContract && runtimeContract.policyMarker ? runtimeContract.policyMarker : 'Не задано', 'Оновіть getClientRuntimeContract_()');
  _stage3PushCheck_(checks, 'OperationRepository available', typeof OperationRepository_ === 'object' ? 'OK' : 'FAIL', typeof OperationRepository_, 'Підключіть OperationRepository.gs');
  _stage3PushCheck_(checks, 'WorkflowOrchestrator available', typeof WorkflowOrchestrator_ === 'object' ? 'OK' : 'FAIL', typeof WorkflowOrchestrator_, 'Перевірте WorkflowOrchestrator.gs');

  var hasList = _stage3HasFn_('apiStage5ListPendingRepairs');
  var hasRepair = _stage3HasFn_('apiStage5RunRepair');
  var hasRetentionCleanup = _stage3HasFn_('apiStage5RunLifecycleRetentionCleanup');
  _stage3PushCheck_(checks, 'Lifecycle maintenance API', hasList && hasRepair ? 'OK' : 'FAIL', 'list=' + hasList + ', repair=' + hasRepair, 'Додайте maintenance API для repair flow');
  _stage3PushCheck_(checks, 'Lifecycle retention cleanup API', hasRetentionCleanup ? 'OK' : 'WARN', 'cleanup=' + hasRetentionCleanup, 'Додайте окремий maintenance flow для lifecycle retention cleanup');
  _stage3PushCheck_(checks, 'Stage4 compatibility facade preserved', _stage3HasFn_('apiStage4ClearCache') && _stage3HasFn_('apiStage4HealthCheck') ? 'OK' : 'FAIL', 'wrappers preserved=' + (_stage3HasFn_('apiStage4ClearCache') && _stage3HasFn_('apiStage4HealthCheck')), 'Не ламайте Stage4 compatibility facade');

  ['OPS_LOG', 'ACTIVE_OPERATIONS', 'CHECKPOINTS'].forEach(function(name) {
    _diagServiceSheetCheck_(checks, name);
  });

  if (opts.includeRuntimeTemplate !== false) {
    try {
      var rawSidebar = include('Sidebar');
      var rawJavaScript = includeTemplate('JavaScript');
      _stage3PushCheck_(checks, 'Sidebar uses includeTemplate(JavaScript)', rawSidebar.indexOf("includeTemplate('JavaScript')") !== -1 || rawSidebar.indexOf('includeTemplate("JavaScript")') !== -1 ? 'OK' : 'FAIL', 'Sidebar bootstrap include chain checked', 'Поверніть includeTemplate(JavaScript) у Sidebar.html');
      var modularOk = rawJavaScript.indexOf('stage7-sidebar-runtime') !== -1 && rawJavaScript.indexOf('window.SidebarApp = SidebarApp;') !== -1 && rawJavaScript.indexOf('<script') !== -1;
      _stage3PushCheck_(checks, 'JavaScript runtime is modular', modularOk ? 'OK' : 'FAIL', 'JavaScript.html include chain evaluated', 'Зберіть JavaScript.html як модульний агрегатор');
    } catch (e) {
      _stage3PushCheck_(checks, 'Runtime template evaluation', 'FAIL', e && e.message ? e.message : String(e), 'Перевірте JavaScript.html і Sidebar.html');
    }
  }

  try {
    var runtime = typeof JobRuntime_ === 'object' && typeof JobRuntime_.buildRuntimeReport === 'function' ? JobRuntime_.buildRuntimeReport() : null;
    _stage3PushCheck_(checks, 'Job runtime report', runtime ? 'OK' : 'WARN', runtime ? ('jobs=' + (runtime.totalJobs || 0) + ', failed=' + (runtime.failedJobs || 0) + ', stale=' + (runtime.staleJobs || 0)) : 'Недоступний', runtime ? '' : 'Перевірте JobRuntime.gs');
  } catch (e) {
    _stage3PushCheck_(checks, 'Job runtime report', 'FAIL', e && e.message ? e.message : String(e), 'Перевірте JobRuntime.gs');
  }

  return _diagNormalizeReportChecks_({ checks: checks });
}

function _diagAppendPendingRepairsCheck_(checks) {
  try {
    var pending = typeof OperationRepository_ === 'object' && typeof OperationRepository_.listPendingRepairs === 'function'
      ? OperationRepository_.listPendingRepairs({ limit: 25 })
      : { operations: [] };
    _stage3PushCheck_(checks, 'Pending repairs visibility', pending && Array.isArray(pending.operations) ? 'OK' : 'WARN', pending && Array.isArray(pending.operations) ? ('visible=' + pending.operations.length) : 'Недоступно', pending && Array.isArray(pending.operations) ? '' : 'Перевірте OperationRepository_.listPendingRepairs()');
  } catch (e) {
    _stage3PushCheck_(checks, 'Pending repairs visibility', 'FAIL', e && e.message ? e.message : String(e), 'Перевірте OperationRepository_.listPendingRepairs()');
  }
}

function _diagAppendCompatibilitySplitCheck_(checks) {
  try {
    var sunset = typeof getCompatibilitySunsetReport_ === 'function' ? getCompatibilitySunsetReport_() : { total: 0, counts: {} };
    _stage3PushCheck_(checks, 'Compatibility split report (informational)', 'OK', 'retained=' + (sunset.total || 0), 'Compatibility wrappers intentionally remain until explicit sunset plan');
  } catch (e) {
    _stage3PushCheck_(checks, 'Compatibility split report (informational)', 'WARN', e && e.message ? e.message : String(e), 'Перевірте DeprecatedRegistry.gs');
  }
}

function _diagAppendLifecyclePolicyCheck_(checks) {
  try {
    var policy = typeof OperationRepository_ === 'object' && typeof OperationRepository_.buildLifecyclePolicyReport === 'function'
      ? OperationRepository_.buildLifecyclePolicyReport()
      : null;
    _stage3PushCheck_(checks, 'Lifecycle policy report', policy ? 'OK' : 'FAIL', policy ? ('ttlScenarios=' + (policy.ttlScenarios || 0) + ', sheets=' + ((policy.serviceSheets || []).join(', '))) : 'Недоступно', policy ? '' : 'Перевірте OperationRepository_.buildLifecyclePolicyReport()');
  } catch (e) {
    _stage3PushCheck_(checks, 'Lifecycle policy report', 'FAIL', e && e.message ? e.message : String(e), 'Перевірте OperationRepository_.buildLifecyclePolicyReport()');
  }
}

function runStage5QuickDiagnostics_(options) {
  var opts = options || {};
  var legacyHealth = _diagNormalizeReportChecks_(healthCheck(), 'Health');
  var stage7 = _diagBuildStage7CoreChecks_({ includeRuntimeTemplate: false });
  var checks = _diagMergeChecks_(legacyHealth, stage7);
  return _diagBuildReport_(checks, opts.mode || 'quick', 'Stage 7 quick diagnostics');
}

function runStage5StructuralDiagnostics_(options) {
  var opts = options || {};
  var checks = _diagMergeChecks_(
    _diagNormalizeReportChecks_(checkSheets(), 'Sheets'),
    _diagNormalizeReportChecks_(checkFiles(), 'Files'),
    _diagBuildStage7CoreChecks_(opts)
  );
  return _diagBuildReport_(checks, opts.mode || 'structural', 'Stage 7 structural diagnostics');
}

function runStage5OperationalDiagnostics_(options) {
  var opts = options || {};
  var extra = [];
  _diagAppendPendingRepairsCheck_(extra);
  _diagAppendLifecyclePolicyCheck_(extra);
  var checks = _diagMergeChecks_(
    _diagNormalizeReportChecks_(healthCheck(), 'Health'),
    _diagNormalizeReportChecks_(checkDuplicates(), 'Duplicates'),
    _diagNormalizeReportChecks_(testFunctions(), 'Functions'),
    _diagNormalizeReportChecks_(runStage4HealthCheck_({ shallow: true, includeStage3Base: false, includeCompatibilityLayer: false, includeReconciliationPreview: false }), 'Stage4'),
    _diagBuildStage7CoreChecks_(opts),
    _diagNormalizeReportChecks_({ checks: extra })
  );
  return _diagBuildReport_(checks, opts.mode || 'operational', 'Stage 7 operational diagnostics');
}

function runStage5SunsetDiagnostics_(options) {
  var opts = options || {};
  var checks = [];
  _diagAppendCompatibilitySplitCheck_(checks);
  return _diagBuildReport_(_diagNormalizeReportChecks_({ checks: checks }), opts.mode || 'compatibility sunset', 'Stage 7 compatibility diagnostics');
}

function runStage6AHardeningDiagnostics_(options) {
  var opts = options || {};
  var extra = [];
  _diagAppendPendingRepairsCheck_(extra);
  _diagAppendLifecyclePolicyCheck_(extra);
  var checks = _diagMergeChecks_(
    _diagBuildStage7CoreChecks_(opts),
    _diagNormalizeReportChecks_({ checks: extra })
  );
  return _diagBuildReport_(checks, opts.mode || 'stage7-hardening', 'Stage 7 lifecycle hardening diagnostics');
}

function runStage5FullDiagnostics_(options) {
  var opts = options || {};
  var extra = [];
  _diagAppendPendingRepairsCheck_(extra);
  _diagAppendCompatibilitySplitCheck_(extra);
  _diagAppendLifecyclePolicyCheck_(extra);

  var checks = _diagMergeChecks_(
    _diagNormalizeReportChecks_(healthCheck(), 'Health'),
    _diagNormalizeReportChecks_(checkSheets(), 'Sheets'),
    _diagNormalizeReportChecks_(checkFiles(), 'Files'),
    _diagNormalizeReportChecks_(checkDuplicates(), 'Duplicates'),
    _diagNormalizeReportChecks_(testFunctions(), 'Functions'),
    _diagNormalizeReportChecks_(runStage4HealthCheck_({
      shallow: false,
      includeStage3Base: true,
      includeCompatibilityLayer: true,
      includeReconciliationPreview: true
    }), 'Stage4'),
    _diagBuildStage7CoreChecks_(opts),
    _diagNormalizeReportChecks_({ checks: extra })
  );

  return _diagBuildReport_(checks, opts.mode || 'full', _releaseStageLabel_());
}

function runStage5FullVerboseDiagnostics_(options) {
  var base = runStage5FullDiagnostics_(options || {});
  var hardening = runStage6AHardeningDiagnostics_({ mode: 'stage7-hardening' });
  return _diagBuildReport_(
    _diagMergeChecks_(base.checks || [], hardening.checks || []),
    'full-verbose',
    (base.ok && hardening.ok) ? (_releaseStageLabel_() + ' verbose diagnostics OK') : (_releaseStageLabel_() + ' verbose diagnostics потребують уваги')
  );
}
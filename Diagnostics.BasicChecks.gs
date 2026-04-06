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
            : '⁈ Лист "' + item.name + '" не знайдено')
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
        : '⁈ Не знайдено жодного місячного листа'
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
        message: '⁈ Лист PHONES не знайдено або порожній'
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
        message: '✓ Явних дублікатів не знайдено'
      });
    } else {
      dups.forEach(function (message) {
        _pushCheck_(report, {
          type: 'duplicate',
          name: 'duplicate',
          status: 'WARN',
          message: '⁈ ' + message
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
 * Stage 7 diagnostics — перевірка схем, repository і data-contract.
 */

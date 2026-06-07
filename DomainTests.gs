/**
 * DomainTests.gs — Stage 7A isolated domain test suite.
 */

function _domainAssert_(condition, message) {
  if (!condition) throw new Error(message || 'Domain assert failed');
}

function _domainPush_(report, name, fn) {
  try {
    const details = fn();
    report.checks.push({ name: name, status: 'OK', details: details || 'OK' });
  } catch (e) {
    report.ok = false;
    report.checks.push({ name: name, status: 'FAIL', details: e && e.message ? e.message : String(e) });
  }
}

function _domainAssertEqual_(actual, expected, message) {
  _domainAssert_(actual === expected, (message || 'Unexpected value') + ': expected "' + expected + '", got "' + actual + '"');
}

function _domainMakeFakeSheet_(name, values) {
  const matrix = values || [];

  function readCell_(row, col) {
    const rowValues = matrix[row - 1] || [];
    return rowValues[col - 1] === undefined ? '' : rowValues[col - 1];
  }

  function buildRange_(startRow, startCol, numRows, numCols) {
    const rows = Math.max(Number(numRows) || 1, 1);
    const cols = Math.max(Number(numCols) || 1, 1);
    const out = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        row.push(readCell_(startRow + r, startCol + c));
      }
      out.push(row);
    }
    return out;
  }

  function cloneValues_(rangeValues) {
    return rangeValues.map(function(row) {
      return row.slice();
    });
  }

  return {
    getName: function() {
      return name || 'TEST';
    },
    getLastColumn: function() {
      return matrix.reduce(function(max, row) {
        return Math.max(max, (row || []).length);
      }, 0);
    },
    getLastRow: function() {
      return matrix.length;
    },
    getRange: function(row, col, numRows, numCols) {
      let startRow = Number(row) || 1;
      let startCol = Number(col) || 1;
      let rows = Number(numRows) || 1;
      let cols = Number(numCols) || 1;

      if (typeof row === 'string' && typeof _parseA1RangeRef_ === 'function') {
        const ref = _parseA1RangeRef_(row);
        startRow = ref.startRow;
        startCol = ref.startCol;
        rows = ref.endRow - ref.startRow + 1;
        cols = ref.endCol - ref.startCol + 1;
      }

      const rangeValues = buildRange_(startRow, startCol, rows, cols);
      return {
        getDisplayValues: function() {
          return cloneValues_(rangeValues);
        },
        getValues: function() {
          return cloneValues_(rangeValues);
        },
        getDisplayValue: function() {
          return String(rangeValues[0] && rangeValues[0][0] !== undefined ? rangeValues[0][0] : '');
        },
        getValue: function() {
          return rangeValues[0] && rangeValues[0][0] !== undefined ? rangeValues[0][0] : '';
        },
        getNumRows: function() {
          return rows;
        },
        getNumColumns: function() {
          return cols;
        }
      };
    }
  };
}

function _runPersonnelRepositoryDomainTests_(report) {
  _domainPush_(report, 'personnel.status normalization canonical and legacy', function() {
    [
      ['', 'В наявності'],
      [null, 'В наявності'],
      [' Діевий ', 'В наявності'],
      ['Active', 'В наявності'],
      ['Temp', 'Тимчасовий'],
      ['Відрядження', 'У відрядженні'],
      ['Removed', 'Вибув'],
      ['Transferred', 'Вибув'],
      ['Лікарняний', 'Лікарняний'],
      ['СЗЧ', 'СЗЧ'],
      ['БЗВП', 'БЗВП']
    ].forEach(function(pair) {
      _domainAssertEqual_(normalizePersonnelStatus_(pair[0]), pair[1], 'normalizePersonnelStatus_ mismatch');
    });

    _domainAssert_(isPersonnelStatusActive_('') === true, 'Порожній Status має бути активним В наявності');
    _domainAssert_(isPersonnelStatusActive_('Temp') === true, 'Legacy Temp має бути активним');
    _domainAssert_(isPersonnelStatusActive_('Removed') === false, 'Legacy Removed має бути неактивним');
    _domainAssert_(isPersonnelStatusActive_('СЗЧ') === false, 'СЗЧ має бути неактивним');
    _domainAssert_(isPersonnelStatusActive_('Лікарняний') === true, 'Лікарняний має бути активним');
    _domainAssertEqual_(getPersonnelStatusCanonical_('Вибув'), 'Removed', 'Вибув canonical');
    _domainAssertEqual_(getPersonnelStatusListValues_().length, 9, 'dropdown count');
    _domainAssertEqual_(getPersonnelStatusListValues_()[0], 'В наявності', 'dropdown order');
    return 'legacy-statuses-ok';
  });

  _domainPush_(report, 'personnel.header aliases optional ID and rank fallback', function() {
    const headers = [
      'ПІБ',
      'День народження',
      'Телефон',
      'Позивний',
      'Rank',
      'Посада',
      'ОШС 4',
      'Статус'
    ];
    const col = _personnelBuildHeaderColIndex_(headers);
    _domainAssertEqual_(col.FML, 0, 'FML alias');
    _domainAssertEqual_(col.Birthday, 1, 'Birthday alias');
    _domainAssertEqual_(col.Callsign, 3, 'Callsign alias');
    _domainAssertEqual_(col.Rank, 4, 'Rank column');
    _domainAssertEqual_(col.Title, -1, 'Title optional');
    _domainAssertEqual_(col.ID, -1, 'ID optional');
    _domainAssertEqual_(col['2_Phone'], -1, '2_Phone optional');

    const record = _personnelRowToRecord_(
      ['Петренко Іван', '17.03.1990', '+380661111111', 'Роланд', 'солдат', 'стрілець', '4', 'Removed'],
      2,
      col
    );
    _domainAssertEqual_(record.id, '', 'ID must remain optional');
    _domainAssertEqual_(record.fml, 'Петренко Іван', 'FML mapping');
    _domainAssertEqual_(record.callsign, 'Роланд', 'Callsign mapping');
    _domainAssertEqual_(record.title, 'солдат', 'Rank fallback to title');
    _domainAssertEqual_(record.rank, 'солдат', 'Rank mirror');
    _domainAssertEqual_(record.position, 'стрілець', 'Position mapping');
    _domainAssertEqual_(record.status, 'Вибув', 'Status normalization in record');
    _domainAssert_(record.active === false, 'Removed/Вибув record must be inactive');
    return 'header-alias-record-ok';
  });
}

function _runMonthlyLayoutDomainTests_(report) {
  _domainPush_(report, 'monthly.layout detects standard sheet geometry', function() {
    const sheet = _domainMakeFakeSheet_('06', [
      ['Телефон', 'Позивний', 'Посада', 'OSH', 'Звання', 'БР', 'ПІБ', '01.06.2026', '02.06.2026', '03.06.2026', 'Коментар'],
      ['+380661111111', 'АЛЬФА', 'стрілець', '4', 'солдат', '1', 'Петренко', 'БР', '', '', ''],
      ['', 'БРАВО', '', '', '', '2', '', '', 'КП', '', ''],
      ['', '', '', '', '', '', '', '', '', '', ''],
      ['', 'ЧАРЛІ', '', '', '', '3', '', '', '', 'ВП', ''],
      ['', '', '', '', '', '', '', '', '', '', '']
    ]);
    const layout = detectMonthlyLayoutFromSheet_(sheet);
    _domainAssert_(layout !== null, 'Standard layout не визначено');
    _domainAssertEqual_(layout.layout, 'standard', 'Standard layout type');
    _domainAssertEqual_(layout.codeRangeA1, 'H2:J5', 'Standard codeRangeA1');
    _domainAssertEqual_(layout.fields.callsign, 2, 'Standard callsign col');
    _domainAssertEqual_(layout.fields.brDays, 6, 'Standard BR col');
    _domainAssertEqual_(layout.fields.fml, 7, 'Standard FML col');
    return layout.codeRangeA1;
  });

  _domainPush_(report, 'monthly.layout detects compact sheet geometry', function() {
    const sheet = _domainMakeFakeSheet_('06', [
      ['БР', 'Позивний', '01.06.2026', '02.06.2026', 'Нотатки'],
      ['1', 'АЛЬФА', 'БР', '', ''],
      ['2', 'БРАВО', '', 'КП', ''],
      ['', '', '', '', '']
    ]);
    const layout = detectMonthlyLayoutFromSheet_(sheet);
    _domainAssert_(layout !== null, 'Compact layout не визначено');
    _domainAssertEqual_(layout.layout, 'compact', 'Compact layout type');
    _domainAssertEqual_(layout.codeRangeA1, 'C2:D3', 'Compact codeRangeA1');
    _domainAssertEqual_(layout.fields.phone, 0, 'Compact has no phone col');
    _domainAssertEqual_(layout.fields.brDays, 1, 'Compact BR col');
    _domainAssertEqual_(layout.fields.callsign, 2, 'Compact callsign col');
    _domainAssertEqual_(layout.fields.fml, 0, 'Compact has no FML col');
    return layout.codeRangeA1;
  });

  _domainPush_(report, 'monthly.layout rejects unsupported headers', function() {
    const sheet = _domainMakeFakeSheet_('06', [
      ['Телефон', 'ПІБ', 'Посада', 'Коментар'],
      ['+380661111111', 'Петренко', 'стрілець', '']
    ]);
    const layout = detectMonthlyLayoutFromSheet_(sheet);
    _domainAssert_(layout === null, 'Unsupported layout should return null');
    return 'null-ok';
  });
}

function runStage6ADomainTests_(options) {
  const opts = options || {};
  const report = {
    ok: true,
    stage: 'stage7a-domain-tests',
    ts: new Date().toISOString(),
    checks: [],
    warnings: []
  };

  function makeDomainFakeSheet_(rows) {
    return {
      getName: function() {
        return '06';
      },
      getLastColumn: function() {
        return (rows[0] || []).length;
      },
      getLastRow: function() {
        return rows.length;
      },
      getRange: function(row, col, numRows, numCols) {
        return {
          getDisplayValues: function() {
            const out = [];
            for (let r = 0; r < numRows; r++) {
              const sourceRow = rows[row - 1 + r] || [];
              const outRow = [];
              for (let c = 0; c < numCols; c++) {
                outRow.push(sourceRow[col - 1 + c] || '');
              }
              out.push(outRow);
            }
            return out;
          }
        };
      }
    };
  }

  // Templates
  _domainPush_(report, 'templates.renderTemplate basic substitution', function() {
    const out = renderTemplate_('Привіт, {name}!', { name: 'Сергій' });
    _domainAssert_(out === 'Привіт, Сергій!', 'Некоректна базова підставка');
    return out;
  });

  _domainPush_(report, 'templates.renderTemplate case fallback', function() {
    const out = renderTemplate_('Код: {CODE}', { code: 'БР' });
    _domainAssert_(out === 'Код: БР', 'Не спрацював fallback по регістру');
    return out;
  });

  _domainPush_(report, 'templates.renderTemplate double braces', function() {
    const out = renderTemplate_('Привіт, {{name}}!', { name: 'Сергій' });
    _domainAssert_(out === 'Привіт, Сергій!', 'Подвійні дужки {{name}} не працюють');
    return out;
  });

  _domainPush_(report, 'templates.missing keys detection', function() {
    const resolved = TemplateResolver_.resolve('DAY_SUMMARY_HEADER', {}, { preview: true });
    _domainAssert_(resolved.missingKeys.indexOf('date') !== -1, 'missingKeys не містить date');
    return 'missing=' + resolved.missingKeys.join(',');
  });

  _domainPush_(report, 'templates.fallback resolution', function() {
    const descriptor = TemplateRegistry_.get('DAY_SUMMARY_HEADER');
    _domainAssert_(descriptor.source === 'system-fallback' || descriptor.source === 'managed-sheet', 'Не знайдено fallback/managed template');
    return descriptor.source;
  });

  _domainPush_(report, 'templates.preview vs final mode', function() {
    const data = { date: '01.01.2026' };
    const preview = Stage7Templates_.preview('DAY_SUMMARY_HEADER', data, { maxLen: 5 });
    const full = Stage7Templates_.render('DAY_SUMMARY_HEADER', data, { preview: false });
    _domainAssert_(preview.length <= 6, 'Preview не обрізається');
    _domainAssert_(full.indexOf('01.01.2026') !== -1, 'Final render пошкоджений');
    return 'preview=' + preview;
  });

  // Send panel helpers
  _domainPush_(report, 'sendPanel.key generation strips formatting', function() {
    const a = makeSendPanelKey_('ПЕТРЕНКО І.І.', '+380 (66) 123-45-67', 'БР');
    const b = makeSendPanelKey_('петренко і.і.', "'+380661234567", 'БР');
    _domainAssert_(a === b, 'makeSendPanelKey_ не нормалізує ключ стабільно');
    return a;
  });

  _domainPush_(report, 'phone lookup canonical index contract', function() {
    const index = {
      byFml: { 'Петренко Іван Іванович': '+380661111111' },
      byNorm: { 'петренко іван іванович': '+380661111111' },
      byRole: { 'ГРАФ': '+380662222222' },
      byCallsign: { 'РОЛАНД': '+380663333333' },
      items: []
    };
    const byFml = findPhone_({ fml: 'Петренко Іван Іванович' }, { index: index });
    const byRole = findPhone_({ role: 'ГРАФ' }, { index: index });
    const byCallsign = findPhone_({ callsign: 'роланд' }, { index: index });
    _domainAssert_(byFml === '+380661111111', 'findPhone_() не знайшов телефон по fml');
    _domainAssert_(byRole === '+380662222222', 'findPhone_() не знайшов телефон по role');
    _domainAssert_(byCallsign === '+380663333333', 'findPhone_() не знайшов телефон по callsign');
    return 'canonical-lookup-ok';
  });

  _domainPush_(report, 'sendPanel.normalize rows', function() {
    const rows = SendPanelService_.normalizeRows([
      { fml: ' Петренко ', phone: "'+380661234567", code: ' БР ', status: getSendPanelReadyStatus_(), sent: false },
      { fml: '', phone: '', code: '', status: '', sent: false }
    ]);
    _domainAssert_(rows.length === 1, 'normalizeRows повинен відкидати порожні рядки');
    _domainAssert_(rows[0].phone === '+380661234567', 'Телефон не нормалізовано');
    return 'rows=' + rows.length;
  });

  _domainPush_(report, 'sendPanel.duplicate detection', function() {
    const duplicates = SendPanelService_.findDuplicateKeys([
      { fml: 'Петренко', phone: '+380661234567', code: 'БР' },
      { fml: 'Петренко', phone: '+380661234567', code: 'БР' },
      { fml: 'Іванов', phone: '+380661234568', code: 'КП' }
    ]);
    _domainAssert_(duplicates.length === 1, 'Duplicate detection повинен знайти 1 ключ');
    return duplicates[0];
  });

  _domainPush_(report, 'sendPanel.sent transition rules', function() {
    const next = SendPanelService_.resolveTransition({ sent: false, status: getSendPanelReadyStatus_() }, 'markSent');
    _domainAssert_(next.sent === true && next.status === getSendPanelReadyStatus_(), 'markSent rule пошкоджений');
    return next.status;
  });

  _domainPush_(report, 'sendPanel.pending transition rules', function() {
    const next = SendPanelService_.resolveTransition({ sent: false, status: getSendPanelReadyStatus_() }, 'markPending');
    _domainAssert_(next.sent === false && next.status === getSendPanelReadyStatus_(), 'markPending rule пошкоджений');
    return next.status;
  });

  _domainPush_(report, 'sendPanel.unsent transition rules', function() {
    const next = SendPanelService_.resolveTransition({ sent: true, status: getSendPanelReadyStatus_() }, 'markUnsent');
    _domainAssert_(next.sent === false && next.status === getSendPanelReadyStatus_(), 'markUnsent rule пошкоджений');
    return next.status;
  });

  _domainPush_(report, 'sendPanel.allowed statuses canonical set', function() {
    const statuses = getSendPanelAllAllowedStatuses_();
    _domainAssert_(statuses.indexOf(SendPanelConstants_.STATUS_READY) !== -1, 'Немає STATUS_READY');
    _domainAssert_(statuses.indexOf(SendPanelConstants_.STATUS_READY) !== -1, 'Немає STATUS_READY');
    _domainAssert_(statuses.indexOf(SendPanelConstants_.STATUS_BLOCKED) !== -1, 'Немає STATUS_BLOCKED');
    return statuses.join(', ');
  });

  // PERSONNEL and sheet schema regressions
  _runPersonnelRepositoryDomainTests_(report);
  _runMonthlyLayoutDomainTests_(report);

  // Reconciliation pure compare
  _domainPush_(report, 'reconciliation.compare missing rows', function() {
    const result = Reconciliation_.compareRows([
      { fml: 'Петренко', phone: '+380661234567', code: 'БР', status: getSendPanelReadyStatus_(), link: 'x', row: 3 }
    ], []);
    const types = result.issues.map(function(item) { return item.type; });
    _domainAssert_(types.indexOf('missingExpectedItem') !== -1, 'Не знайдено missingExpectedItem');
    return types.join(',');
  });

  _domainPush_(report, 'reconciliation.compare extra rows', function() {
    const result = Reconciliation_.compareRows([], [
      { fml: 'Петренко', phone: '+380661234567', code: 'БР', status: getSendPanelReadyStatus_(), link: 'x', row: 3 }
    ]);
    const types = result.issues.map(function(item) { return item.type; });
    _domainAssert_(types.indexOf('orphanSendPanelRow') !== -1, 'Не знайдено orphanSendPanelRow');
    return types.join(',');
  });

  _domainPush_(report, 'reconciliation.compare duplicates', function() {
    const result = Reconciliation_.compareRows([
      { fml: 'Петренко', phone: '+380661234567', code: 'БР', status: getSendPanelReadyStatus_(), link: 'x', row: 3 }
    ], [
      { fml: 'Петренко', phone: '+380661234567', code: 'БР', status: getSendPanelReadyStatus_(), link: 'x', row: 3 },
      { fml: 'Петренко', phone: '+380661234567', code: 'БР', status: getSendPanelReadyStatus_(), link: 'x', row: 4 }
    ]);
    const types = result.issues.map(function(item) { return item.type; });
    _domainAssert_(types.indexOf('duplicateSendPanelRow') !== -1, 'Не знайдено duplicateSendPanelRow');
    return types.join(',');
  });

  _domainPush_(report, 'reconciliation.compare stale statuses', function() {
    const result = Reconciliation_.compareRows([
      { fml: 'Петренко', phone: '+380661234567', code: 'БР', status: getSendPanelReadyStatus_(), link: 'x', row: 3, sent: false }
    ], [
      { fml: 'Петренко', phone: '+380661234567', code: 'БР', status: '???', link: 'x', row: 3, sent: false }
    ]);
    const types = result.issues.map(function(item) { return item.type; });
    _domainAssert_(types.indexOf('staleStatus') !== -1, 'Не знайдено staleStatus');
    return types.join(',');
  });

  _domainPush_(report, 'reconciliation.targeted repair preview', function() {
    const preview = Reconciliation_.previewRepairPlan([
      { type: 'missingExpectedItem', repairable: true, key: 'k1', expectedRow: 3 },
      { type: 'summaryMismatch', repairable: false, key: 'k2' }
    ], { issueTypes: ['missingExpectedItem'] });
    _domainAssert_(preview.selectedCount === 1, 'previewRepairPlan некоректно фільтрує issueTypes');
    return 'selected=' + preview.selectedCount;
  });

  _domainPush_(report, 'reconciliation.post-repair verification formatter', function() {
    const verification = Reconciliation_.verifyRepairResult(
      { issues: [{ severity: 'CRITICAL' }, { severity: 'WARN' }] },
      { issues: [{ severity: 'WARN' }] }
    );
    _domainAssert_(verification.remainingIssues === 1, 'remainingIssues має бути 1');
    _domainAssert_(verification.criticalRemaining === 0, 'criticalRemaining має бути 0');
    return 'remaining=' + verification.remainingIssues;
  });

  // Vacation / date logic
  _domainPush_(report, 'date.parse UA date', function() {
    const dt = DateUtils_.parseUaDate('17.03.2026');
    _domainAssert_(dt instanceof Date && !isNaN(dt.getTime()), 'parseUaDate не повернув Date');
    return DateUtils_.formatUaDate(dt);
  });

  _domainPush_(report, 'date.invalid handling', function() {
    const dt = DateUtils_.parseUaDate('31.02.2026');
    _domainAssert_(dt === null, 'Некоректна дата має повертати null');
    return 'null-ok';
  });

  _domainPush_(report, 'date.normalize valid formats', function() {
    const norm = DateUtils_.normalizeDate('2026-03-17');
    _domainAssert_(norm === '17.03.2026', 'normalizeDate не нормалізував YYYY-MM-DD');
    return norm;
  });

  _domainPush_(report, 'date.normalize invalid throws', function() {
    let thrown = false;
    try {
      DateUtils_.normalizeDate('99.99.2026');
    } catch (_) {
      thrown = true;
    }
    _domainAssert_(thrown, 'normalizeDate повинен кидати помилку на не існуючу дату');
    return 'throws-ok';
  });

  // Monthly layout detection
  _domainPush_(report, 'sheetSchema.monthly compact layout detection', function() {
    const sheet = makeDomainFakeSheet_([
      ['БР', 'Callsign', '01.06', '02.06', ''],
      ['5', 'Роланд', 'БР', 'КП', ''],
      ['3', 'Сокіл', 'КП', '', ''],
      ['', '', '', '', '']
    ]);
    const layout = detectMonthlyLayoutFromSheet_(sheet);
    _domainAssert_(layout && layout.layout === 'compact', 'Compact monthly layout не визначено');
    _domainAssert_(layout.codeRangeA1 === 'C2:D3', 'Compact codeRangeA1 має бути C2:D3');
    _domainAssert_(getMonthlyCallsignColForSheet_(sheet) === 2, 'Compact Callsign має бути у колонці B');
    _domainAssert_(getMonthlyBrDaysColForSheet_(sheet) === 1, 'Compact BR days має бути у колонці A');
    return layout.codeRangeA1;
  });

  _domainPush_(report, 'sheetSchema.monthly standard layout detection', function() {
    const sheet = makeDomainFakeSheet_([
      ['Телефон', 'Позивний', 'Посада', 'ОШС', 'Звання', 'БРДні', 'ПІБ', '01.06', '02.06', ''],
      ['+380661111111', 'Роланд', 'Стрілець', '1', 'с-т', '5', 'Петренко', 'БР', 'КП', ''],
      ['+380662222222', 'Сокіл', 'Водій', '2', 'с-т', '3', 'Іванов', 'КП', '', ''],
      ['', '', '', '', '', '', '', '', '', '']
    ]);
    const layout = detectMonthlyLayoutFromSheet_(sheet);
    _domainAssert_(layout && layout.layout === 'standard', 'Standard monthly layout не визначено');
    _domainAssert_(layout.codeRangeA1 === 'H2:I3', 'Standard codeRangeA1 має бути H2:I3');
    _domainAssert_(getMonthlyCallsignColForSheet_(sheet) === 2, 'Standard Callsign має бути у колонці B');
    _domainAssert_(getMonthlyBrDaysColForSheet_(sheet) === 6, 'Standard BR days має бути у колонці F');
    return layout.codeRangeA1;
  });

  _domainPush_(report, 'vacation status window logic', function() {
    const start = DateUtils_.toDayStart('17.03.2026');
    const end = DateUtils_.toDayStart('20.03.2026');
    const target = DateUtils_.toDayStart('18.03.2026');
    const active = !!(start && end && target && target.getTime() >= start.getTime() && target.getTime() <= end.getTime());
    _domainAssert_(active, 'Базове vacation window правило порушене');
    return 'active';
  });

  // Summary logic
  _domainPush_(report, 'summary.day payload message builder', function() {
    const msg = buildMessage_({ reportDate: '17.03.2026', service: 'Охорона', place: 'Запоріжжя', tasks: 'Супровід', brDays: 5, minimal: false });
    _domainAssert_(msg.indexOf('17.03.2026') !== -1, 'Повідомлення не містить дату');
    _domainAssert_(msg.indexOf('Охорона') !== -1, 'Повідомлення не містить service');
    return 'len=' + msg.length;
  });

  _domainPush_(report, 'summary.detailed composition', function() {
    const text = formatDetailedSummaryLegacy_('17.03.2026', [
      { code: 'БР', surname: 'Петренко' },
      { code: 'КП', surname: 'Іванов' }
    ]);
    _domainAssert_(text.indexOf('17.03.2026') !== -1, 'Detailed summary не містить дату');
    _domainAssert_(text.indexOf('Петренко') !== -1, 'Detailed summary не містить прізвище');
    return 'len=' + text.length;
  });

  _domainPush_(report, 'summary.empty-state behavior', function() {
    const text = formatDetailedSummaryLegacy_('17.03.2026', []);
    _domainAssert_(text.indexOf('17.03.2026') !== -1, 'Навіть empty state має містити дату');
    return 'len=' + text.length;
  });

  _domainPush_(report, 'summary.optional fields behavior', function() {
    const msg = buildMessage_({ reportDate: '17.03.2026', service: '', place: '', tasks: '', brDays: 0, minimal: true });
    _domainAssert_(msg.indexOf('17.03.2026') !== -1, 'Minimal message не містить дату');
    return 'len=' + msg.length;
  });

  // Routing / lifecycle / contract
  _domainPush_(report, 'routing.route resolution', function() {
    const route = getRoutingRouteByApiMethod_('apiGenerateSendPanelForDate');
    _domainAssert_(route && route.routeName === 'sidebar.generateSendPanelForDate', 'Route resolution by API method зламана');
    return route.routeName;
  });

  _domainPush_(report, 'routing.action normalization', function() {
    const normalized = normalizeRoutingUiAction_('generatePanel');
    _domainAssert_(normalized === 'sidebar.generateSendPanelForDate', 'UI action normalization зламана');
    return normalized;
  });

  _domainPush_(report, 'contract normalization / top-level fields', function() {
    const response = buildServerResponse_(true, 'OK', null, { a: 1 }, [], { scenario: 'x', operationId: 'op1', dryRun: false, affectedSheets: ['SEND_PANEL'], partial: false, retrySafe: true, lockUsed: true }, { lifecycle: ['response.built'] }, { scenario: 'x' }, []);
    _domainAssert_(response.operationId === 'op1', 'operationId має дублюватися у top-level');
    _domainAssert_(response.retrySafe === true, 'retrySafe має бути true');
    _domainAssert_(response.lockUsed === true, 'lockUsed має бути true');
    return response.operationId;
  });

  _domainPush_(report, 'contract.partial success formatting', function() {
    const response = buildServerResponse_(true, 'PARTIAL', null, {}, [], { scenario: 'x', operationId: 'op2', partial: true, skippedChangesCount: 2, appliedChangesCount: 1, retrySafe: true }, { lifecycle: ['response.built'] }, { scenario: 'x' }, ['warning']);
    _domainAssert_(response.partial === true, 'partial має бути true');
    _domainAssert_(response.skippedChangesCount === 2, 'skippedChangesCount має бути 2');
    return 'partial-ok';
  });

  report.total = report.checks.length;
  report.passed = report.checks.filter(function(item) { return item.status === 'OK'; }).length;
  report.failed = report.checks.filter(function(item) { return item.status === 'FAIL'; }).length;
  report.summary = report.ok
    ? 'Stage 7A domain tests OK'
    : 'Stage 7A domain tests FAIL';
  return report;
}
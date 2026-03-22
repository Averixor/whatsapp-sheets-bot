/**
 * DomainTests.gs — Stage 6A isolated domain test suite.
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

function runStage6ADomainTests_(options) {
  const opts = options || {};
  const report = {
    ok: true,
    stage: 'stage6a-domain-tests',
    ts: new Date().toISOString(),
    checks: [],
    warnings: []
  };

  // Templates
  _domainPush_(report, 'templates.renderTemplate basic substitution', function() {
    const out = renderTemplate_('Привіт, {name}!', { name: 'Сергій' });
    _domainAssert_(out === 'Привіт, Сергій!', 'Некоректна базова підстановка');
    return out;
  });

  _domainPush_(report, 'templates.renderTemplate case fallback', function() {
    const out = renderTemplate_('Код: {CODE}', { code: 'БР' });
    _domainAssert_(out === 'Код: БР', 'Не спрацював fallback по регістру');
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
    const preview = Stage4Templates_.preview('DAY_SUMMARY_HEADER', data, { maxLen: 5 });
    const full = Stage4Templates_.render('DAY_SUMMARY_HEADER', data, { preview: false });
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

  _domainPush_(report, 'sendPanel.normalize rows', function() {
    const rows = SendPanelService_.normalizeRows([
      { fio: ' Петренко ', phone: "'+380661234567", code: ' БР ', status: getSendPanelReadyStatus_(), sent: false },
      { fio: '', phone: '', code: '', status: '', sent: false }
    ]);
    _domainAssert_(rows.length === 1, 'normalizeRows повинен відкидати порожні рядки');
    _domainAssert_(rows[0].phone === '+380661234567', 'Телефон не нормалізовано');
    return 'rows=' + rows.length;
  });

  _domainPush_(report, 'sendPanel.duplicate detection', function() {
    const duplicates = SendPanelService_.findDuplicateKeys([
      { fio: 'Петренко', phone: '+380661234567', code: 'БР' },
      { fio: 'Петренко', phone: '+380661234567', code: 'БР' },
      { fio: 'Іванов', phone: '+380661234568', code: 'КП' }
    ]);
    _domainAssert_(duplicates.length === 1, 'Duplicate detection повинен знайти 1 ключ');
    return duplicates[0];
  });

  _domainPush_(report, 'sendPanel.sent transition rules', function() {
    const next = SendPanelService_.resolveTransition({ sent: false, status: getSendPanelReadyStatus_() }, 'markSent');
    _domainAssert_(next.sent === true && next.status === getSendPanelSentStatus_(), 'markSent rule пошкоджений');
    return next.status;
  });

  _domainPush_(report, 'sendPanel.pending transition rules', function() {
    const next = SendPanelService_.resolveTransition({ sent: false, status: getSendPanelReadyStatus_() }, 'markPending');
    _domainAssert_(next.sent === false && next.status === SendPanelConstants_.STATUS_PENDING, 'markPending rule пошкоджений');
    return next.status;
  });

  _domainPush_(report, 'sendPanel.unsent transition rules', function() {
    const next = SendPanelService_.resolveTransition({ sent: true, status: getSendPanelSentStatus_() }, 'markUnsent');
    _domainAssert_(next.sent === false && next.status === SendPanelConstants_.STATUS_UNSENT, 'markUnsent rule пошкоджений');
    return next.status;
  });

  _domainPush_(report, 'sendPanel.allowed statuses canonical set', function() {
    const statuses = getSendPanelAllAllowedStatuses_();
    _domainAssert_(statuses.indexOf(SendPanelConstants_.STATUS_READY) !== -1, 'Немає STATUS_READY');
    _domainAssert_(statuses.indexOf(SendPanelConstants_.STATUS_PENDING) !== -1, 'Немає STATUS_PENDING');
    _domainAssert_(statuses.indexOf(SendPanelConstants_.STATUS_UNSENT) !== -1, 'Немає STATUS_UNSENT');
    _domainAssert_(statuses.indexOf(SendPanelConstants_.STATUS_SENT) !== -1, 'Немає STATUS_SENT');
    return statuses.join(', ');
  });

  // Reconciliation pure compare
  _domainPush_(report, 'reconciliation.compare missing rows', function() {
    const result = Reconciliation_.compareRows([
      { fio: 'Петренко', phone: '+380661234567', code: 'БР', status: getSendPanelReadyStatus_(), link: 'x', row: 3 }
    ], []);
    const types = result.issues.map(function(item) { return item.type; });
    _domainAssert_(types.indexOf('missingExpectedItem') !== -1, 'Не знайдено missingExpectedItem');
    return types.join(',');
  });

  _domainPush_(report, 'reconciliation.compare extra rows', function() {
    const result = Reconciliation_.compareRows([], [
      { fio: 'Петренко', phone: '+380661234567', code: 'БР', status: getSendPanelReadyStatus_(), link: 'x', row: 3 }
    ]);
    const types = result.issues.map(function(item) { return item.type; });
    _domainAssert_(types.indexOf('orphanSendPanelRow') !== -1, 'Не знайдено orphanSendPanelRow');
    return types.join(',');
  });

  _domainPush_(report, 'reconciliation.compare duplicates', function() {
    const result = Reconciliation_.compareRows([
      { fio: 'Петренко', phone: '+380661234567', code: 'БР', status: getSendPanelReadyStatus_(), link: 'x', row: 3 }
    ], [
      { fio: 'Петренко', phone: '+380661234567', code: 'БР', status: getSendPanelReadyStatus_(), link: 'x', row: 3 },
      { fio: 'Петренко', phone: '+380661234567', code: 'БР', status: getSendPanelReadyStatus_(), link: 'x', row: 4 }
    ]);
    const types = result.issues.map(function(item) { return item.type; });
    _domainAssert_(types.indexOf('duplicateSendPanelRow') !== -1, 'Не знайдено duplicateSendPanelRow');
    return types.join(',');
  });

  _domainPush_(report, 'reconciliation.compare stale statuses', function() {
    const result = Reconciliation_.compareRows([
      { fio: 'Петренко', phone: '+380661234567', code: 'БР', status: getSendPanelReadyStatus_(), link: 'x', row: 3, sent: false }
    ], [
      { fio: 'Петренко', phone: '+380661234567', code: 'БР', status: '???', link: 'x', row: 3, sent: false }
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
    _domainAssert_(thrown, 'normalizeDate повинен кидати помилку на неіснуючу дату');
    return 'throws-ok';
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
    const route = getStage6ARouteByApiMethod_('apiGenerateSendPanelForDate');
    _domainAssert_(route && route.routeName === 'sidebar.generateSendPanelForDate', 'Route resolution by API method зламана');
    return route.routeName;
  });

  _domainPush_(report, 'routing.action normalization', function() {
    const normalized = normalizeStage6AUiAction_('generatePanel');
    _domainAssert_(normalized === 'sidebar.generateSendPanelForDate', 'UI action normalization зламана');
    return normalized;
  });

  _domainPush_(report, 'contract normalization / top-level fields', function() {
    const response = buildStage4Response_(true, 'OK', null, { a: 1 }, [], { scenario: 'x', operationId: 'op1', dryRun: false, affectedSheets: ['SEND_PANEL'], partial: false, retrySafe: true, lockUsed: true }, { lifecycle: ['response.built'] }, { scenario: 'x' }, []);
    _domainAssert_(response.operationId === 'op1', 'operationId має дублюватися у top-level');
    _domainAssert_(response.retrySafe === true, 'retrySafe має бути true');
    _domainAssert_(response.lockUsed === true, 'lockUsed має бути true');
    return response.operationId;
  });

  _domainPush_(report, 'contract.partial success formatting', function() {
    const response = buildStage4Response_(true, 'PARTIAL', null, {}, [], { scenario: 'x', operationId: 'op2', partial: true, skippedChangesCount: 2, appliedChangesCount: 1, retrySafe: true }, { lifecycle: ['response.built'] }, { scenario: 'x' }, ['warning']);
    _domainAssert_(response.partial === true, 'partial має бути true');
    _domainAssert_(response.skippedChangesCount === 2, 'skippedChangesCount має бути 2');
    return 'partial-ok';
  });

  report.total = report.checks.length;
  report.passed = report.checks.filter(function(item) { return item.status === 'OK'; }).length;
  report.failed = report.checks.filter(function(item) { return item.status === 'FAIL'; }).length;
  report.summary = report.ok
    ? 'Stage 6A domain tests OK'
    : 'Stage 6A domain tests FAIL';
  return report;
}
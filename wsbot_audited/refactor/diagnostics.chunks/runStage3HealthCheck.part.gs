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
      _stage7PushCheck_(
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

    _stage7PushCheck_(checks, `Schema ${schema.key}`, status, details, sheet ? '' : 'Створіть лист або перевірте CONFIG');
  });

  ['PHONES', 'DICT', 'DICT_SUM', 'SEND_PANEL', 'VACATIONS', 'LOG'].forEach(function(key) {
    try {
      const schema = SheetSchemas_.get(key);
      const sheet = ss.getSheetByName(schema.name);
      if (!sheet) return;
      const result = validateSheetHeadersBySchema_(sheet, schema);
      _stage7PushCheck_(
        checks,
        `Headers ${schema.key}`,
        result.ok ? 'OK' : 'WARN',
        result.ok
          ? 'Headers відповідають схемі'
          : ('Проблеми з headers: ' + [].concat(result.missing || []).concat(result.mismatches || []).join('; ')),
        result.ok ? '' : 'Звірте header row зі схемою у SheetSchemas.gs'
      );
    } catch (e) {
      _stage7PushCheck_(checks, `Headers ${key}`, 'WARN', e && e.message ? e.message : String(e), 'Перевірте schema/header contract');
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
    const resolved = _stage7ResolveSymbol_(name);
    const exists = typeof resolved === 'object' || typeof resolved === 'function';
    _stage7PushCheck_(checks, `Repository ${name}`, exists ? 'OK' : 'FAIL', exists ? 'Доступний' : 'Не знайдено', exists ? '' : 'Перевірте файл stage 7 repository');
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
    _stage7PushCheck_(
      checks,
      `Public API ${fnName}`,
      _stage7HasFn_(fnName) ? 'OK' : 'FAIL',
      _stage7HasFn_(fnName) ? 'Публічний API доступний' : 'Метод не знайдено',
      _stage7HasFn_(fnName) ? '' : 'Stage 7 wrappers intentionally removed in final clean baseline'
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

      _stage7PushCheck_(
        checks,
        `Contract #${idx + 1}`,
        valid ? 'OK' : 'FAIL',
        valid ? 'Контракт відповіді валідний' : 'Відповідь не відповідає server-side contract',
        valid ? '' : 'Перевірте normalizeServerResponse_/apiExecute_'
      );
    });
  } catch (e) {
    _stage7PushCheck_(checks, 'Contract validation', 'FAIL', e && e.message ? e.message : String(e), 'Перевірте public API');
  }

  const deprecated = getDeprecatedRegistry_();
  deprecated.forEach(function(item) {
    _stage7PushCheck_(
      checks,
      `Deprecated ${item.name}`,
      'PSEUDO',
      `Compatibility-only alias retained intentionally; canonical: ${item.replacement}`,
      item.reason || ''
    );
  });

  const failures = checks.filter(function(item) { return item.status === 'FAIL'; }).length;
  const warns = checks.filter(function(item) { return item.status === 'WARN'; }).length;

  return {
    ok: failures === 0,
    status: failures === 0 ? 'OK' : 'FAIL',
    checks: checks,
    warnings: warnings,
    summary: failures === 0
      ? `Stage 7 health check OK. Warning: ${warns}`
      : `Stage 7 health check FAIL. Failures: ${failures}, warnings: ${warns}`,
    options: opts,
    timestamp: new Date().toISOString()
  };
}


// =========================
// STAGE 7 DIAGNOSTICS 2.0
// =========================

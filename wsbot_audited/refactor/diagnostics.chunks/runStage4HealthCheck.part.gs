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
    'Stage7UseCases_',
    'WorkflowOrchestrator_',
    'Stage7AuditTrail_',
    'Reconciliation_',
    'Stage7Triggers_',
    'Stage7Templates_'
  ].forEach(function(name) {
    const resolved = _stage7ResolveSymbol_(name);
    const exists = typeof resolved === 'object' || typeof resolved === 'function';
    _stage7PushCheck_(
      checks,
      `Stage7 module ${name}`,
      exists ? 'OK' : 'FAIL',
      exists ? 'Доступний' : 'Не знайдено',
      exists ? '' : `Перевірте ${name}.gs`
    );
  });

  ['listMonths', 'getSendPanelData', 'switchBotToMonth', 'generateSendPanelForDate', 'buildDaySummary', 'openPersonCard', 'runMaintenanceScenario']
    .forEach(function(name) {
      const exists = !!(Stage7UseCases_ && typeof Stage7UseCases_[name] === 'function');
      _stage7PushCheck_(
        checks,
        `Stage7 use-case ${name}`,
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
    _stage7PushCheck_(
      checks,
      'Audit trail sheet',
      auditSheet ? 'OK' : 'WARN',
      auditSheet ? `Аркуш "${auditSheet.getName()}" доступний` : 'AUDIT_LOG не створений',
      auditSheet ? '' : 'Створіть AUDIT_LOG автоматично або вручну'
    );
  } catch (e) {
    _stage7PushCheck_(
      checks,
      'Audit trail sheet',
      'WARN',
      e && e.message ? e.message : String(e),
      'Перевірте AuditTrail.gs'
    );
  }

  try {
    const jobs = Stage7Triggers_.listJobs();
    _stage7PushCheck_(
      checks,
      'Managed jobs registry',
      jobs.length ? 'OK' : 'WARN',
      `Jobs: ${jobs.length}`,
      jobs.length ? '' : 'Перевірте Triggers.gs'
    );
  } catch (e) {
    _stage7PushCheck_(
      checks,
      'Managed jobs registry',
      'FAIL',
      e && e.message ? e.message : String(e),
      'Перевірте Triggers.gs'
    );
  }

  try {
    const templateKeys = Stage7Templates_.listKeys();
    _stage7PushCheck_(
      checks,
      'Managed templates',
      templateKeys.length ? 'OK' : 'WARN',
      `Templates: ${templateKeys.length}`,
      templateKeys.length ? '' : 'Перевірте Templates.gs'
    );
  } catch (e) {
    _stage7PushCheck_(
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

      const reconciliationIssues = Number(reconciliation && reconciliation.summary && reconciliation.summary.issues || 0);
      const reconciliationCritical = Number(reconciliation && reconciliation.criticalCount || 0);
      const reconciliationMessage = reconciliation.message
        || ('Reconciliation preview: проблем ' + reconciliationIssues + ', critical ' + reconciliationCritical);

      _stage7PushCheck_(
        checks,
        'Reconciliation preview',
        reconciliationCritical > 0 ? 'WARN' : 'OK',
        reconciliationMessage,
        reconciliationCritical > 0
          ? 'Це warning по поточних даних таблиці, а не по архіву коду. Перевірте report та за потреби виконайте safe repair'
          : ''
      );

      warnings.push.apply(warnings, reconciliation.warnings || []);
    } catch (e) {
      _stage7PushCheck_(
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
    stage: (typeof getProjectBundleMetadata_ === 'function' ? getProjectBundleMetadata_().stageVersion : '7.1.2-final-clean'),
    checks: checks,
    warnings: [...new Set(warnings)],
    summary: failures === 0
      ? `Baseline health OK. Warnings: ${warns}`
      : `Baseline health FAIL. Failures: ${failures}, warnings: ${warns}`,
    options: opts,
    ts: new Date().toISOString()
  };
}

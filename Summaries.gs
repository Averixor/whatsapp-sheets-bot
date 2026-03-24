/**
 * Stage5MaintenanceApi.gs — canonical maintenance / admin / diagnostics API with preserved Stage 5 naming inside the Stage 7.1 release.
 *
 * The public entrypoints remain Stage 5–named by design. Stage4MaintenanceApi.gs is retained only
 * as a thin compatibility facade for historical callers.
 */

function _stage5BuildMaintenanceResponse_(success, message, report, scenario, warnings, extraMeta) {
  const meta = Object.assign({
    stage: (typeof getProjectBundleMetadata_ === 'function' ? getProjectBundleMetadata_().stageVersion : '6.0.0-final'),
    scenario: scenario,
    operationId: stage4UniqueId_(scenario),
    affectedSheets: [],
    affectedEntities: [],
    appliedChangesCount: 0,
    skippedChangesCount: 0,
    dryRun: true
  }, extraMeta || {});

  return buildStage4Response_(
    success !== false,
    message,
    null,
    report || {},
    [],
    meta,
    { stage: meta.stage, scenario: scenario, lifecycle: ['report.built'] },
    { stage: meta.stage, scenario: scenario, layer: 'maintenance' },
    warnings || []
  );
}

function apiStage5ClearCache() {
  return Stage4UseCases_.runMaintenanceScenario({ type: 'cleanupCaches' });
}

function apiStage5ClearLog() {
  return Stage4UseCases_.runMaintenanceScenario({ type: 'clearLog' });
}

function apiStage5ClearPhoneCache() {
  return Stage4UseCases_.runMaintenanceScenario({ type: 'clearPhoneCache' });
}

function apiStage5RestartBot() {
  return Stage4UseCases_.runMaintenanceScenario({ type: 'restartBot' });
}

function apiStage5SetupVacationTriggers() {
  return Stage4UseCases_.runMaintenanceScenario({ type: 'setupVacationTriggers' });
}

function apiStage5CleanupDuplicateTriggers(functionName) {
  return Stage4UseCases_.runMaintenanceScenario({
    type: 'cleanupDuplicateTriggers',
    functionName: functionName || ''
  });
}

function apiStage5DebugPhones() {
  return Stage4UseCases_.runMaintenanceScenario({ type: 'debugPhones' });
}

function apiStage5BuildBirthdayLink(phone, name) {
  return WorkflowOrchestrator_.run({
    scenario: 'stage5BuildBirthdayLink',
    payload: {
      phone: phone || '',
      name: name || ''
    },
    write: false,
    validate: function(input) {
      return { payload: input, warnings: [] };
    },
    execute: function(input) {
      const legacy = normalizeServerResponse_(
        buildBirthdayLink(input.phone || '', input.name || ''),
        'apiStage5BuildBirthdayLink',
        {}
      );
      const result = Object.assign({
        phone: input.phone || '',
        name: input.name || ''
      }, legacy.data || {});

      return {
        success: legacy.success !== false,
        message: legacy.message || (legacy.success ? 'Посилання на привітання підготовлено' : 'Не вдалося підготувати посилання'),
        result: result,
        changes: [],
        affectedSheets: [],
        affectedEntities: [],
        appliedChangesCount: 0,
        skippedChangesCount: 0,
        warnings: legacy.warnings || []
      };
    }
  });
}

function apiRunStage5MaintenanceScenario(options) {
  return Stage4UseCases_.runMaintenanceScenario(options || {});
}

function apiInstallStage5Jobs() {
  return WorkflowOrchestrator_.run({
    scenario: 'installStage5Jobs',
    payload: {},
    write: true,
    execute: function() {
      const result = Stage4Triggers_.installManagedTriggers();
      return {
        success: true,
        message: 'Jobs встановлено',
        result: result,
        changes: [{
          type: 'installManagedTriggers',
          installed: result.installed,
          removed: result.removed
        }],
        affectedSheets: [],
        affectedEntities: [],
        appliedChangesCount: Number(result.installed || 0),
        skippedChangesCount: Number(result.removed || 0)
      };
    }
  });
}

function apiListStage5Jobs() {
  return _stage5BuildMaintenanceResponse_(
    true,
    'Jobs перелічено',
    { jobs: Stage4Triggers_.listJobs() },
    'listStage5Jobs'
  );
}

function apiRunStage5Job(jobName, options) {
  return Stage4Triggers_.runJob(jobName, options || {});
}

function runStage5DiagnosticsByMode_(options) {
  const opts = options || {};
  const mode = String(opts.mode || 'full').toLowerCase();

  if (mode === 'quick') return runStage5QuickDiagnostics_(opts);
  if (mode === 'structural') return runStage5StructuralDiagnostics_(opts);
  if (mode === 'operational') return runStage5OperationalDiagnostics_(opts);
  if (mode === 'compatibility' || mode === 'compatibility sunset' || mode === 'sunset') return runStage5SunsetDiagnostics_(opts);
  if (mode === 'full-verbose' || mode === 'verbose') return runStage5FullVerboseDiagnostics_(opts);
  if (mode === 'stage6a-hardening') return runStage6AHardeningDiagnostics_(opts);
  return runStage5FullDiagnostics_(opts);
}

function apiStage5HealthCheck(options) {
  const opts = Object.assign({}, options || {});
  const resolvedMode = opts.mode
    ? String(opts.mode).toLowerCase()
    : ((opts.shallow === false || opts.includeStage3Base || opts.includeCompatibilityLayer || opts.includeReconciliationPreview)
      ? 'full'
      : 'quick');

  const report = runStage5DiagnosticsByMode_(Object.assign({}, opts, { mode: resolvedMode }));
  return _stage5BuildMaintenanceResponse_(
    report.ok,
    report.summary || ('full' === resolvedMode ? 'Повну перевірку системи завершено' : 'Перевірку системи завершено'),
    report,
    'stage5HealthCheck',
    report.warnings || []
  );
}

function apiRunStage5Diagnostics(options) {
  const report = runStage5DiagnosticsByMode_(options || {});
  return _stage5BuildMaintenanceResponse_(
    report.ok,
    report.summary || 'Діагностику системи завершено',
    report,
    'stage5Diagnostics',
    report.warnings || []
  );
}

function apiRunStage5RegressionTests(options) {
  const report = runStage5SmokeTests(options || {});
  return _stage5BuildMaintenanceResponse_(
    report.ok,
    report.ok ? 'Регресійні тести пройдено' : 'У регресійних тестах є збої',
    report,
    'stage5RegressionTests',
    report.warnings || []
  );
}

function apiListStage5JobRuntime() {
  const report = JobRuntime_.buildRuntimeReport();
  return _stage5BuildMaintenanceResponse_(
    true,
    'Job runtime перелічено',
    report,
    'listStage5JobRuntime',
    [],
    { affectedSheets: [STAGE5_CONFIG.JOB_RUNTIME_SHEET] }
  );
}


function apiStage5ListPendingRepairs(filters) {
  return _stage5BuildMaintenanceResponse_(
    true,
    'Pending repairs перелічено',
    typeof OperationRepository_ === 'object' ? OperationRepository_.listPendingRepairs(filters || {}) : { operations: [], total: 0 },
    'stage5ListPendingRepairs',
    [],
    { affectedSheets: ['OPS_LOG', 'CHECKPOINTS'] }
  );
}

function apiStage5GetOperationDetails(operationId) {
  const details = typeof OperationRepository_ === 'object' ? OperationRepository_.getOperationDetails(operationId || '') : null;
  return _stage5BuildMaintenanceResponse_(
    !!details,
    details ? 'Деталі операції отримано' : 'Операцію не знайдено',
    details || { operation: null, checkpoints: [] },
    'stage5GetOperationDetails',
    details ? [] : ['Операцію не знайдено'],
    { affectedSheets: ['OPS_LOG', 'CHECKPOINTS'] }
  );
}

function apiStage5RunRepair(operationId, options) {
  if (typeof OperationRepository_ !== 'object') {
    return _stage5BuildMaintenanceResponse_(false, 'Сховище виправлення недоступне', { success: false }, 'stage5RunRepair', ['Сховище операцій недоступне']);
  }
  const result = OperationRepository_.runRepair(operationId || '', options || {});
  if (result && result.result) return result.result;
  return _stage5BuildMaintenanceResponse_(
    !!(result && result.success),
    result && result.message ? result.message : (result && result.success ? 'Виправлення виконано' : 'Виправлення завершилося з помилкою'),
    result || {},
    'stage5RunRepair',
    result && result.success ? [] : [result && result.message ? result.message : 'Виправлення завершилося з помилкою'],
    { affectedSheets: ['OPS_LOG', 'CHECKPOINTS'] }
  );
}


function apiStage5RunLifecycleRetentionCleanup() {
  return Stage4UseCases_.runMaintenanceScenario({ type: 'cleanupLifecycleRetention' });
}
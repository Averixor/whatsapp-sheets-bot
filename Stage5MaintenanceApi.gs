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


function _stage5AssertAdminAccess_(actionLabel) {
  return (typeof AccessControl_ === 'object')
    ? AccessControl_.assertRoleAtLeast('admin', actionLabel || 'maintenance action')
    : { role: 'admin', source: 'fallback' };
}


function apiStage5BootstrapAccessSheet() {
  const result = (typeof AccessControl_ === 'object' && AccessControl_.bootstrapSheet)
    ? AccessControl_.bootstrapSheet()
    : { success: false, message: 'AccessControl_ недоступний' };
  return _stage5BuildMaintenanceResponse_(
    result.success !== false,
    result.message || 'ACCESS sheet ініціалізовано',
    result,
    'stage5BootstrapAccessSheet',
    result.success === false ? [result.message || 'Не вдалося ініціалізувати ACCESS'] : [],
    { affectedSheets: [appGetCore('ACCESS_SHEET', 'ACCESS')] }
  );
}

function apiStage5GetAccessDescriptor() {
  const descriptor = (typeof AccessControl_ === 'object')
    ? AccessControl_.describe()
    : { role: 'viewer', knownUser: false, reason: 'AccessControl_ недоступний' };
  return _stage5BuildMaintenanceResponse_(
    true,
    descriptor.isAdmin ? 'Роль доступу визначено' : 'Доступ до maintenance-дій обмежено',
    descriptor,
    'stage5AccessDescriptor',
    descriptor.reason ? [descriptor.reason] : []
  );
}

function apiStage5ApplyProtections(options) {
  _stage5AssertAdminAccess_('apply spreadsheet protections');
  const result = (typeof applySpreadsheetProtections_ === 'function')
    ? applySpreadsheetProtections_(options || {})
    : { protectedSheets: [], warnings: ['applySpreadsheetProtections_ недоступна'] };
  return _stage5BuildMaintenanceResponse_(
    true,
    result.dryRun ? 'План захисту листів побудовано' : 'Захист службових листів застосовано',
    result,
    'stage5ApplyProtections',
    result.warnings || [],
    { affectedSheets: result.plannedSheets || [] }
  );
}

function apiStage5ClearCache() {
  _stage5AssertAdminAccess_('clear cache');
  return Stage4UseCases_.runMaintenanceScenario({ type: 'cleanupCaches' });
}

function apiStage5ClearLog() {
  _stage5AssertAdminAccess_('clear log');
  return Stage4UseCases_.runMaintenanceScenario({ type: 'clearLog' });
}

function apiStage5ClearPhoneCache() {
  _stage5AssertAdminAccess_('clear phone cache');
  return Stage4UseCases_.runMaintenanceScenario({ type: 'clearPhoneCache' });
}

function apiStage5RestartBot() {
  _stage5AssertAdminAccess_('restart bot');
  return Stage4UseCases_.runMaintenanceScenario({ type: 'restartBot' });
}

function apiStage5SetupVacationTriggers() {
  _stage5AssertAdminAccess_('setup triggers');
  return Stage4UseCases_.runMaintenanceScenario({ type: 'setupVacationTriggers' });
}

function apiStage5CleanupDuplicateTriggers(functionName) {
  _stage5AssertAdminAccess_('cleanup duplicate triggers');
  return Stage4UseCases_.runMaintenanceScenario({
    type: 'cleanupDuplicateTriggers',
    functionName: functionName || ''
  });
}

function apiStage5DebugPhones() {
  _stage5AssertAdminAccess_('debug phones');
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
  _stage5AssertAdminAccess_('run maintenance scenario');
  return Stage4UseCases_.runMaintenanceScenario(options || {});
}

function apiInstallStage5Jobs() {
  _stage5AssertAdminAccess_('install jobs');
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
  _stage5AssertAdminAccess_('list jobs');
  return _stage5BuildMaintenanceResponse_(
    true,
    'Jobs перелічено',
    { jobs: Stage4Triggers_.listJobs() },
    'listStage5Jobs'
  );
}

function apiRunStage5Job(jobName, options) {
  _stage5AssertAdminAccess_('run job');
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
  _stage5AssertAdminAccess_('health check');
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
  _stage5AssertAdminAccess_('run diagnostics');
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
  _stage5AssertAdminAccess_('run regression tests');
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
  _stage5AssertAdminAccess_('list job runtime');
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
  _stage5AssertAdminAccess_('list pending repairs');
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
  _stage5AssertAdminAccess_('get operation details');
  const normalizedId = String(operationId || '').trim();
  if (!normalizedId) {
    return _stage5BuildMaintenanceResponse_(
      false,
      'Не передано operationId',
      { operation: null, checkpoints: [] },
      'stage5GetOperationDetails',
      ['Не передано operationId'],
      { affectedSheets: ['OPS_LOG', 'CHECKPOINTS'] }
    );
  }
  const details = typeof OperationRepository_ === 'object' ? OperationRepository_.getOperationDetails(normalizedId) : null;
  return _stage5BuildMaintenanceResponse_(
    !!details,
    details ? 'Деталі операції отримано' : ('Операцію не знайдено: ' + normalizedId),
    details || { operation: null, checkpoints: [] },
    'stage5GetOperationDetails',
    details ? [] : [('Операцію не знайдено: ' + normalizedId)],
    { affectedSheets: ['OPS_LOG', 'CHECKPOINTS'] }
  );
}

function apiStage5RunRepair(operationId, options) {
  _stage5AssertAdminAccess_('run repair');
  if (typeof OperationRepository_ !== 'object') {
    return _stage5BuildMaintenanceResponse_(false, 'Сховище виправлення недоступне', { success: false }, 'stage5RunRepair', ['Сховище операцій недоступне']);
  }
  const normalizedId = String(operationId || '').trim();
  if (!normalizedId) {
    return _stage5BuildMaintenanceResponse_(
      false,
      'Не передано operationId для repair',
      { success: false, operationId: '' },
      'stage5RunRepair',
      ['Не передано operationId для repair'],
      { affectedSheets: ['OPS_LOG', 'CHECKPOINTS'] }
    );
  }
  try {
    const result = OperationRepository_.runRepair(normalizedId, options || {});
    if (result && result.result) return result.result;
    return _stage5BuildMaintenanceResponse_(
      !!(result && result.success),
      result && result.message ? result.message : (result && result.success ? 'Виправлення виконано' : 'Виправлення завершилося з помилкою'),
      result || {},
      'stage5RunRepair',
      result && result.success ? [] : [result && result.message ? result.message : 'Виправлення завершилося з помилкою'],
      { affectedSheets: ['OPS_LOG', 'CHECKPOINTS'] }
    );
  } catch (error) {
    return _stage5BuildMaintenanceResponse_(
      false,
      error && error.message ? error.message : 'Виправлення завершилося з помилкою',
      { success: false, operationId: normalizedId },
      'stage5RunRepair',
      [error && error.message ? error.message : 'Виправлення завершилося з помилкою'],
      { affectedSheets: ['OPS_LOG', 'CHECKPOINTS'] }
    );
  }
}


function apiStage5RunLifecycleRetentionCleanup() {
  return Stage4UseCases_.runMaintenanceScenario({ type: 'cleanupLifecycleRetention' });
}
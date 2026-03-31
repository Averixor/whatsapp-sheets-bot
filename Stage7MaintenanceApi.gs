/**
 * Stage7MaintenanceApi.gs — canonical maintenance / admin / diagnostics API for the Stage 7 baseline.
 *
 * Historical Stage 4 / Stage 5 aliases live in Stage7CompatibilityMaintenanceApi.gs.
 * Compatibility wrappers live in Stage7CompatibilityMaintenanceApi.gs.
 */

function _stage7BuildMaintenanceResponse_(success, message, report, scenario, warnings, extraMeta) {
  const meta = Object.assign({
    stage: (typeof getProjectBundleMetadata_ === 'function' ? getProjectBundleMetadata_().stageVersion : '6.0.0-final'),
    scenario: scenario,
    operationId: stage7UniqueId_(scenario),
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


function _stage7AssertRole_(requiredRole, actionLabel) {
  return (typeof AccessControl_ === 'object')
    ? AccessControl_.assertRoleAtLeast(requiredRole || 'admin', actionLabel || 'maintenance action')
    : { role: requiredRole || 'admin', source: 'fallback' };
}

function _stage7AssertAdminAccess_(actionLabel) {
  return _stage7AssertRole_('admin', actionLabel || 'maintenance action');
}


function apiStage7BootstrapAccessSheet() {
  _stage7AssertRole_('admin', 'bootstrap access sheet');
  const result = (typeof AccessControl_ === 'object' && AccessControl_.bootstrapSheet)
    ? AccessControl_.bootstrapSheet()
    : { success: false, message: 'AccessControl_ недоступний' };
  return _stage7BuildMaintenanceResponse_(
    result.success !== false,
    result.message || 'ACCESS sheet ініціалізовано для user key-доступу',
    result,
    'stage7BootstrapAccessSheet',
    result.success === false ? [result.message || 'Не вдалося ініціалізувати ACCESS'] : [],
    { affectedSheets: [appGetCore('ACCESS_SHEET', 'ACCESS')] }
  );
}

function apiStage7GetAccessDescriptor() {
  const descriptor = (typeof AccessControl_ === 'object')
    ? AccessControl_.describe()
    : { role: 'guest', knownUser: false, reason: 'AccessControl_ недоступний' };
  return _stage7BuildMaintenanceResponse_(
    true,
    descriptor.isAdmin ? 'Роль доступу визначено' : 'Доступ до maintenance-дій обмежено',
    descriptor,
    'stage7AccessDescriptor',
    descriptor.reason ? [descriptor.reason] : []
  );
}

function apiStage7DebugAccess() {
  const descriptor = (typeof AccessControl_ === 'object')
    ? AccessControl_.describe()
    : { role: 'guest', knownUser: false, reason: 'AccessControl_ недоступний' };
  return _stage7BuildMaintenanceResponse_(
    true,
    'Діагностику доступу виконано',
    descriptor,
    'stage7DebugAccess',
    descriptor.reason ? [descriptor.reason] : []
  );
}

function apiStage7ReportAccessViolation(actionName, details) {
  const result = (typeof AccessEnforcement_ === 'object' && AccessEnforcement_.reportViolation)
    ? AccessEnforcement_.reportViolation(actionName || '', details || {})
    : { success: false, message: 'AccessEnforcement_ недоступний' };
  return _stage7BuildMaintenanceResponse_(
    result.success !== false,
    result.message || 'Порушення доступу зафіксовано',
    result.data || result,
    'stage7ReportAccessViolation',
    [],
    { affectedSheets: [appGetCore('ALERTS_SHEET', 'ALERTS_LOG')] }
  );
}

function apiStage7ApplyProtections(options) {
  _stage7AssertRole_('sysadmin', 'apply spreadsheet protections');
  const result = (typeof applySpreadsheetProtections_ === 'function')
    ? applySpreadsheetProtections_(options || {})
    : { protectedSheets: [], warnings: ['applySpreadsheetProtections_ недоступна'] };
  return _stage7BuildMaintenanceResponse_(
    true,
    result.dryRun ? 'План захисту листів побудовано' : 'Захист службових листів застосовано',
    result,
    'stage7ApplyProtections',
    result.warnings || [],
    { affectedSheets: result.plannedSheets || [] }
  );
}

function apiStage7ClearCache() {
  _stage7AssertRole_('sysadmin', 'clear cache');
  return Stage7UseCases_.runMaintenanceScenario({ type: 'cleanupCaches' });
}

function apiStage7ClearLog() {
  _stage7AssertRole_('admin', 'clear log');
  return Stage7UseCases_.runMaintenanceScenario({ type: 'clearLog' });
}

function apiStage7ClearPhoneCache() {
  _stage7AssertRole_('sysadmin', 'clear phone cache');
  return Stage7UseCases_.runMaintenanceScenario({ type: 'clearPhoneCache' });
}

function apiStage7RestartBot() {
  _stage7AssertRole_('sysadmin', 'restart bot');
  return Stage7UseCases_.runMaintenanceScenario({ type: 'restartBot' });
}

function apiStage7SetupVacationTriggers() {
  _stage7AssertRole_('sysadmin', 'setup triggers');
  return Stage7UseCases_.runMaintenanceScenario({ type: 'setupVacationTriggers' });
}

function apiStage7CleanupDuplicateTriggers(functionName) {
  _stage7AssertRole_('sysadmin', 'cleanup duplicate triggers');
  return Stage7UseCases_.runMaintenanceScenario({
    type: 'cleanupDuplicateTriggers',
    functionName: functionName || ''
  });
}

function apiStage7DebugPhones() {
  _stage7AssertRole_('maintainer', 'debug phones');
  return Stage7UseCases_.runMaintenanceScenario({ type: 'debugPhones' });
}

function apiStage7BuildBirthdayLink(phone, name) {
  return WorkflowOrchestrator_.run({
    scenario: 'stage7BuildBirthdayLink',
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
        'apiStage7BuildBirthdayLink',
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

function apiRunStage7MaintenanceScenario(options) {
  _stage7AssertRole_('admin', 'run maintenance scenario');
  return Stage7UseCases_.runMaintenanceScenario(options || {});
}

function apiInstallStage7Jobs() {
  _stage7AssertRole_('sysadmin', 'install jobs');
  return WorkflowOrchestrator_.run({
    scenario: 'installStage7Jobs',
    payload: {},
    write: true,
    execute: function() {
      const result = Stage7Triggers_.installManagedTriggers();
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

function apiListStage7Jobs() {
  _stage7AssertRole_('sysadmin', 'list jobs');
  return _stage7BuildMaintenanceResponse_(
    true,
    'Jobs перелічено',
    { jobs: Stage7Triggers_.listJobs() },
    'listStage7Jobs'
  );
}

function apiRunStage7Job(jobName, options) {
  const descriptor = _stage7AssertRole_('sysadmin', 'run job') || {};
  const opts = Object.assign({}, options || {}, {
    trigger: false,
    source: String((options && options.source) || 'manual'),
    entryPoint: String((options && options.entryPoint) || 'apiRunStage7Job'),
    initiatorEmail: String((options && options.initiatorEmail) || descriptor.email || ''),
    initiatorName: String((options && options.initiatorName) || descriptor.displayName || descriptor.email || ''),
    initiatorRole: String((options && options.initiatorRole) || descriptor.role || ''),
    initiatorCallsign: String((options && options.initiatorCallsign) || descriptor.personCallsign || ''),
    userDescriptor: descriptor
  });
  return Stage7Triggers_.runJob(jobName, opts);
}

function runStage7DiagnosticsByMode_(options) {
  const opts = options || {};
  const mode = String(opts.mode || 'full').toLowerCase();

  if (mode === 'quick') return runStage5QuickDiagnostics_(opts);
  if (mode === 'structural') return runStage5StructuralDiagnostics_(opts);
  if (mode === 'operational') return runStage5OperationalDiagnostics_(opts);
  if (mode === 'compatibility' || mode === 'compatibility sunset' || mode === 'sunset') return runStage5SunsetDiagnostics_(opts);
  if (mode === 'full-verbose' || mode === 'verbose') return runStage5FullVerboseDiagnostics_(opts);
  if (mode === 'stage7a-hardening') return runStage6AHardeningDiagnostics_(opts);
  return runStage5FullDiagnostics_(opts);
}

function apiStage7HealthCheck(options) {
  _stage7AssertRole_('maintainer', 'health check');
  const opts = Object.assign({}, options || {});
  const resolvedMode = opts.mode
    ? String(opts.mode).toLowerCase()
    : ((opts.shallow === false || opts.includeStage3Base || opts.includeCompatibilityLayer || opts.includeReconciliationPreview)
      ? 'full'
      : 'quick');

  const report = runStage7DiagnosticsByMode_(Object.assign({}, opts, { mode: resolvedMode }));
  return _stage7BuildMaintenanceResponse_(
    report.ok,
    report.summary || ('full' === resolvedMode ? 'Повну перевірку системи завершено' : 'Перевірку системи завершено'),
    report,
    'stage7HealthCheck',
    report.warnings || []
  );
}

function apiRunStage7Diagnostics(options) {
  _stage7AssertRole_('maintainer', 'run diagnostics');
  const report = runStage7DiagnosticsByMode_(options || {});
  return _stage7BuildMaintenanceResponse_(
    report.ok,
    report.summary || 'Діагностику системи завершено',
    report,
    'stage7Diagnostics',
    report.warnings || []
  );
}

function apiRunStage7RegressionTests(options) {
  _stage7AssertRole_('admin', 'run regression tests');
  const report = runStage5SmokeTests(options || {});
  return _stage7BuildMaintenanceResponse_(
    report.ok,
    report.ok ? 'Регресійні тести пройдено' : 'У регресійних тестах є збої',
    report,
    'stage7RegressionTests',
    report.warnings || []
  );
}

function apiListStage7JobRuntime() {
  _stage7AssertRole_('admin', 'list job runtime');
  const report = JobRuntime_.buildRuntimeReport();
  return _stage7BuildMaintenanceResponse_(
    true,
    'Job runtime перелічено',
    report,
    'listStage7JobRuntime',
    [],
    { affectedSheets: [STAGE7_CONFIG.JOB_RUNTIME_SHEET] }
  );
}


function apiStage7ListPendingRepairs(filters) {
  _stage7AssertRole_('maintainer', 'list pending repairs');
  return _stage7BuildMaintenanceResponse_(
    true,
    'Pending repairs перелічено',
    typeof OperationRepository_ === 'object' ? OperationRepository_.listPendingRepairs(filters || {}) : { operations: [], total: 0 },
    'stage7ListPendingRepairs',
    [],
    { affectedSheets: ['OPS_LOG', 'CHECKPOINTS'] }
  );
}

function apiStage7GetOperationDetails(operationId) {
  _stage7AssertRole_('maintainer', 'get operation details');
  const normalizedId = String(operationId || '').trim();
  if (!normalizedId) {
    return _stage7BuildMaintenanceResponse_(
      false,
      'Не передано operationId',
      { operation: null, checkpoints: [] },
      'stage7GetOperationDetails',
      ['Не передано operationId'],
      { affectedSheets: ['OPS_LOG', 'CHECKPOINTS'] }
    );
  }
  const details = typeof OperationRepository_ === 'object' ? OperationRepository_.getOperationDetails(normalizedId) : null;
  return _stage7BuildMaintenanceResponse_(
    !!details,
    details ? 'Деталі операції отримано' : ('Операцію не знайдено: ' + normalizedId),
    details || { operation: null, checkpoints: [] },
    'stage7GetOperationDetails',
    details ? [] : [('Операцію не знайдено: ' + normalizedId)],
    { affectedSheets: ['OPS_LOG', 'CHECKPOINTS'] }
  );
}

function apiStage7RunRepair(operationId, options) {
  _stage7AssertRole_('sysadmin', 'run repair');
  if (typeof OperationRepository_ !== 'object') {
    return _stage7BuildMaintenanceResponse_(false, 'Сховище виправлення недоступне', { success: false }, 'stage7RunRepair', ['Сховище операцій недоступне']);
  }
  const normalizedId = String(operationId || '').trim();
  if (!normalizedId) {
    return _stage7BuildMaintenanceResponse_(
      false,
      'Не передано operationId для repair',
      { success: false, operationId: '' },
      'stage7RunRepair',
      ['Не передано operationId для repair'],
      { affectedSheets: ['OPS_LOG', 'CHECKPOINTS'] }
    );
  }
  try {
    const result = OperationRepository_.runRepair(normalizedId, options || {});
    if (result && result.result) return result.result;
    return _stage7BuildMaintenanceResponse_(
      !!(result && result.success),
      result && result.message ? result.message : (result && result.success ? 'Виправлення виконано' : 'Виправлення завершилося з помилкою'),
      result || {},
      'stage7RunRepair',
      result && result.success ? [] : [result && result.message ? result.message : 'Виправлення завершилося з помилкою'],
      { affectedSheets: ['OPS_LOG', 'CHECKPOINTS'] }
    );
  } catch (error) {
    return _stage7BuildMaintenanceResponse_(
      false,
      error && error.message ? error.message : 'Виправлення завершилося з помилкою',
      { success: false, operationId: normalizedId },
      'stage7RunRepair',
      [error && error.message ? error.message : 'Виправлення завершилося з помилкою'],
      { affectedSheets: ['OPS_LOG', 'CHECKPOINTS'] }
    );
  }
}


function apiStage7RunLifecycleRetentionCleanup() {
  _stage7AssertRole_('sysadmin', 'cleanup lifecycle retention');
  return Stage7UseCases_.runMaintenanceScenario({ type: 'cleanupLifecycleRetention' });
}

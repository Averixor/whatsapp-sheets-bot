
/**
 * Triggers.gs — managed jobs / trigger orchestration with stage 7 runtime observability.
 */

const Stage7Triggers_ = (function() {
  function _cfg() {
    return STAGE7_CONFIG;
  }

  function _registry() {
    var cfg = _cfg();
    return Object.freeze({
      dailyVacationsAndBirthdays: {
        jobName: cfg.JOBS.DAILY_VACATIONS_AND_BIRTHDAYS,
        handler: 'stage7JobDailyVacationsAndBirthdays',
        kind: 'timeBased',
        description: 'Щоденна перевірка відпусток і днів народження'
      },
      scheduledReconciliation: {
        jobName: cfg.JOBS.SCHEDULED_RECONCILIATION,
        handler: 'stage7JobScheduledReconciliation',
        kind: 'timeBased',
        description: 'Періодична reconciliation-перевірка'
      },
      scheduledHealthCheck: {
        jobName: cfg.JOBS.SCHEDULED_HEALTHCHECK,
        handler: 'stage7JobScheduledHealthCheck',
        kind: 'timeBased',
        description: 'Періодичний health-check'
      },
      cleanupCaches: {
        jobName: cfg.JOBS.CLEANUP_CACHES,
        handler: 'stage7JobCleanupCaches',
        kind: 'timeBased',
        description: 'Технічне очищення кешів'
      },
      staleOperationDetector: {
        jobName: cfg.JOBS.STALE_OPERATION_DETECTOR,
        handler: 'stage7JobDetectStaleOperations',
        kind: 'timeBased',
        description: 'Пошук завислих lifecycle-операцій'
      },
      lifecycleRetentionCleanup: {
        jobName: cfg.JOBS.LIFECYCLE_RETENTION_CLEANUP,
        handler: 'stage7JobLifecycleRetentionCleanup',
        kind: 'timeBased',
        description: 'Retention cleanup для OPS/ACTIVE/CHECKPOINTS/LOG/AUDIT'
      },
      accessAuditEdit: {
        jobName: cfg.JOBS.ACCESS_AUDIT_EDIT,
        handler: 'stage7SecurityAuditOnEdit',
        kind: 'spreadsheetEdit',
        description: 'Сповіщення про підозрілі/заборонені редагування таблиці'
      },
      accessAuditChange: {
        jobName: cfg.JOBS.ACCESS_AUDIT_CHANGE,
        handler: 'stage7SecurityAuditOnChange',
        kind: 'spreadsheetChange',
        description: 'Сповіщення про підозрілі структурні зміни таблиці'
      }
    });
  }

  function listJobs() {
    var REGISTRY = _registry();
    return Object.keys(REGISTRY).map(function(key) {
      const item = REGISTRY[key];
      const lastRun = stage7GetFeatureFlag_('jobRuntime', true)
        ? JobRuntimeRepository_.getLast(item.jobName)
        : null;

      return Object.assign({}, item, {
        runtime: lastRun
      });
    });
  }

  function cleanupManagedTriggers() {
    const handlers = listJobs().map(function(item) { return item.handler; });
    let removed = 0;
    ScriptApp.getProjectTriggers().forEach(function(trigger) {
      if (handlers.indexOf(trigger.getHandlerFunction()) !== -1) {
        ScriptApp.deleteTrigger(trigger);
        removed++;
      }
    });
    return removed;
  }

  function installManagedTriggers() {
    const removed = cleanupManagedTriggers();

    ScriptApp.newTrigger('stage7JobDailyVacationsAndBirthdays')
      .timeBased()
      .everyDays(1)
      .atHour(8)
      .create();

    ScriptApp.newTrigger('stage7JobScheduledReconciliation')
      .timeBased()
      .everyDays(1)
      .atHour(7)
      .create();

    ScriptApp.newTrigger('stage7JobScheduledHealthCheck')
      .timeBased()
      .everyDays(1)
      .atHour(6)
      .create();

    ScriptApp.newTrigger('stage7JobCleanupCaches')
      .timeBased()
      .everyDays(1)
      .atHour(5)
      .create();

    ScriptApp.newTrigger('stage7JobDetectStaleOperations')
      .timeBased()
      .everyMinutes(15)
      .create();

    ScriptApp.newTrigger('stage7JobLifecycleRetentionCleanup')
      .timeBased()
      .everyDays(1)
      .atHour(4)
      .create();

    ScriptApp.newTrigger('stage7SecurityAuditOnEdit')
      .forSpreadsheet(SpreadsheetApp.getActive())
      .onEdit()
      .create();

    ScriptApp.newTrigger('stage7SecurityAuditOnChange')
      .forSpreadsheet(SpreadsheetApp.getActive())
      .onChange()
      .create();

    return {
      removed: removed,
      installed: Object.keys(_registry()).length,
      jobs: listJobs()
    };
  }

  function _getRuntimeDescriptor(options) {
    const opts = options || {};
    if (opts.userDescriptor && typeof opts.userDescriptor === 'object') {
      return opts.userDescriptor;
    }
    if (opts.trigger) {
      return {
        email: '',
        displayName: 'system-trigger',
        role: 'system',
        personCallsign: ''
      };
    }
    if (typeof AccessControl_ === 'object' && typeof AccessControl_.describe === 'function') {
      try {
        return AccessControl_.describe() || {};
      } catch (_) {}
    }
    return {};
  }

  function _buildRuntimeContext(registryItem, options) {
    const opts = Object.assign({ trigger: true, initiator: 'trigger', source: 'trigger' }, options || {});
    const descriptor = _getRuntimeDescriptor(opts);
    const source = opts.source || (opts.trigger ? 'trigger' : 'manual');
    return {
      source: source,
      dryRun: !!opts.dryRun,
      operationId: opts.operationId || stage7UniqueId_(registryItem.jobName),
      initiatorEmail: String(opts.initiatorEmail || descriptor.email || ''),
      initiatorName: String(opts.initiatorName || descriptor.displayName || (opts.trigger ? 'system-trigger' : '')),
      initiatorRole: String(opts.initiatorRole || descriptor.role || (opts.trigger ? 'system' : '')),
      initiatorCallsign: String(opts.initiatorCallsign || descriptor.personCallsign || ''),
      entryPoint: String(opts.entryPoint || (opts.trigger ? registryItem.handler : 'Stage7Triggers_.runJob')),
      triggerId: String(opts.triggerId || ''),
      notes: String(opts.notes || (opts.trigger ? ('trigger:' + registryItem.handler) : 'manual job launch'))
    };
  }

  function _executeJob(registryItem, options) {
    const opts = Object.assign({ trigger: true, initiator: 'trigger', source: 'trigger' }, options || {});
    switch (registryItem.jobName) {
      case _cfg().JOBS.DAILY_VACATIONS_AND_BIRTHDAYS:
        return Stage7UseCases_.checkVacationsAndBirthdays(Object.assign({}, opts, { date: _todayStr_() }));
      case _cfg().JOBS.SCHEDULED_RECONCILIATION:
        return Stage7UseCases_.runReconciliation(Object.assign({}, opts, { mode: 'report', date: _todayStr_(), dryRun: true }));
      case _cfg().JOBS.SCHEDULED_HEALTHCHECK:
        return Stage7UseCases_.runMaintenanceScenario(Object.assign({}, opts, { type: 'healthCheck', shallow: true }));
      case _cfg().JOBS.CLEANUP_CACHES:
        return Stage7UseCases_.runMaintenanceScenario(Object.assign({}, opts, { type: 'cleanupCaches' }));
      case _cfg().JOBS.STALE_OPERATION_DETECTOR:
        return (typeof OperationRepository_ === 'object')
          ? { success: true, message: 'Stale detector виконано', result: OperationRepository_.detectStaleOperations() }
          : { success: false, message: 'OperationRepository_ недоступний', result: { staleOperations: [] } };
      case _cfg().JOBS.LIFECYCLE_RETENTION_CLEANUP:
        return Stage7UseCases_.runMaintenanceScenario(Object.assign({}, opts, { type: 'cleanupLifecycleRetention' }));
      default:
        throw new Error(`Stage7 job "${registryItem.jobName}" не підтримується`);
    }
  }

  function runJob(jobName, options) {
    const name = String(jobName || '').trim();
    const REGISTRY = _registry();
    const registryItem = Object.keys(REGISTRY)
      .map(function(key) { return REGISTRY[key]; })
      .find(function(item) { return item.jobName === name || item.handler === name; });

    if (!registryItem) {
      throw new Error(`Stage7 job "${jobName}" не знайдено`);
    }

    const opts = Object.assign({ trigger: true, initiator: 'trigger', source: 'trigger' }, options || {});

    if (!stage7GetFeatureFlag_('jobRuntime', true)) {
      return _executeJob(registryItem, opts);
    }

    return JobRuntime_.observe(registryItem.jobName, _buildRuntimeContext(registryItem, opts), function() {
      return _executeJob(registryItem, opts);
    });
  }

  return {
    listJobs: listJobs,
    cleanupManagedTriggers: cleanupManagedTriggers,
    installManagedTriggers: installManagedTriggers,
    runJob: runJob
  };
})();

function stage7JobDailyVacationsAndBirthdays() {
  return Stage7Triggers_.runJob(STAGE7_CONFIG.JOBS.DAILY_VACATIONS_AND_BIRTHDAYS, { trigger: true, initiator: 'trigger', source: 'trigger' });
}

function stage7JobScheduledReconciliation() {
  return Stage7Triggers_.runJob(STAGE7_CONFIG.JOBS.SCHEDULED_RECONCILIATION, { trigger: true, initiator: 'trigger', source: 'trigger' });
}

function stage7JobScheduledHealthCheck() {
  return Stage7Triggers_.runJob(STAGE7_CONFIG.JOBS.SCHEDULED_HEALTHCHECK, { trigger: true, initiator: 'trigger', source: 'trigger' });
}

function stage7JobCleanupCaches() {
  return Stage7Triggers_.runJob(STAGE7_CONFIG.JOBS.CLEANUP_CACHES, { trigger: true, initiator: 'trigger', source: 'trigger' });
}


function stage7JobDetectStaleOperations() {
  return Stage7Triggers_.runJob(STAGE7_CONFIG.JOBS.STALE_OPERATION_DETECTOR, { trigger: true, initiator: 'trigger', source: 'trigger' });
}


function stage7JobLifecycleRetentionCleanup() {
  return Stage7Triggers_.runJob(STAGE7_CONFIG.JOBS.LIFECYCLE_RETENTION_CLEANUP, { trigger: true, initiator: 'trigger', source: 'trigger' });
}

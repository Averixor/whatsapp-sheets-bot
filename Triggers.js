
/**
 * Triggers.gs — managed jobs / trigger orchestration with stage 5 runtime observability.
 */

const Stage4Triggers_ = (function() {
  function _cfg() {
    return (typeof getStage4Config_ === 'function') ? getStage4Config_() : STAGE4_CONFIG;
  }

  function _registry() {
    var cfg = _cfg();
    return Object.freeze({
      dailyVacationsAndBirthdays: {
        jobName: cfg.JOBS.DAILY_VACATIONS_AND_BIRTHDAYS,
        handler: 'stage4JobDailyVacationsAndBirthdays',
        kind: 'timeBased',
        description: 'Щоденна перевірка відпусток і днів народження'
      },
      scheduledReconciliation: {
        jobName: cfg.JOBS.SCHEDULED_RECONCILIATION,
        handler: 'stage4JobScheduledReconciliation',
        kind: 'timeBased',
        description: 'Періодична reconciliation-перевірка'
      },
      scheduledHealthCheck: {
        jobName: cfg.JOBS.SCHEDULED_HEALTHCHECK,
        handler: 'stage4JobScheduledHealthCheck',
        kind: 'timeBased',
        description: 'Періодичний health-check'
      },
      cleanupCaches: {
        jobName: cfg.JOBS.CLEANUP_CACHES,
        handler: 'stage4JobCleanupCaches',
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
        description: 'Retention cleanup для OPS_LOG / ACTIVE_OPERATIONS / CHECKPOINTS'
      }
    });
  }

  function listJobs() {
    var REGISTRY = _registry();
    return Object.keys(REGISTRY).map(function(key) {
      const item = REGISTRY[key];
      const lastRun = stage5GetFeatureFlag_('jobRuntime', true)
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

    ScriptApp.newTrigger('stage4JobDailyVacationsAndBirthdays')
      .timeBased()
      .everyDays(1)
      .atHour(8)
      .create();

    ScriptApp.newTrigger('stage4JobScheduledReconciliation')
      .timeBased()
      .everyDays(1)
      .atHour(7)
      .create();

    ScriptApp.newTrigger('stage4JobScheduledHealthCheck')
      .timeBased()
      .everyDays(1)
      .atHour(6)
      .create();

    ScriptApp.newTrigger('stage4JobCleanupCaches')
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

    return {
      removed: removed,
      installed: Object.keys(_registry()).length,
      jobs: listJobs()
    };
  }

  function _executeJob(registryItem, options) {
    const opts = Object.assign({ trigger: true, initiator: 'trigger', source: 'trigger' }, options || {});
    switch (registryItem.jobName) {
      case _cfg().JOBS.DAILY_VACATIONS_AND_BIRTHDAYS:
        return Stage4UseCases_.checkVacationsAndBirthdays(Object.assign({}, opts, { date: _todayStr_() }));
      case _cfg().JOBS.SCHEDULED_RECONCILIATION:
        return Stage4UseCases_.runReconciliation(Object.assign({}, opts, { mode: 'report', date: _todayStr_(), dryRun: true }));
      case _cfg().JOBS.SCHEDULED_HEALTHCHECK:
        return Stage4UseCases_.runMaintenanceScenario(Object.assign({}, opts, { type: 'healthCheck', shallow: true }));
      case _cfg().JOBS.CLEANUP_CACHES:
        return Stage4UseCases_.runMaintenanceScenario(Object.assign({}, opts, { type: 'cleanupCaches' }));
      case _cfg().JOBS.STALE_OPERATION_DETECTOR:
        return (typeof OperationRepository_ === 'object')
          ? { success: true, message: 'Stale detector виконано', result: OperationRepository_.detectStaleOperations() }
          : { success: false, message: 'OperationRepository_ недоступний', result: { staleOperations: [] } };
      case _cfg().JOBS.LIFECYCLE_RETENTION_CLEANUP:
        return (typeof OperationRepository_ === 'object')
          ? { success: true, message: 'Lifecycle retention cleanup виконано', result: OperationRepository_.runRetentionCleanup() }
          : { success: false, message: 'OperationRepository_ недоступний', result: { archived: 0, removedActiveStale: 0, archivedCheckpoints: 0 } };
      default:
        throw new Error(`Stage4 job "${registryItem.jobName}" не підтримується`);
    }
  }

  function runJob(jobName, options) {
    const name = String(jobName || '').trim();
    const REGISTRY = _registry();
    const registryItem = Object.keys(REGISTRY)
      .map(function(key) { return REGISTRY[key]; })
      .find(function(item) { return item.jobName === name || item.handler === name; });

    if (!registryItem) {
      throw new Error(`Stage4 job "${jobName}" не знайдено`);
    }

    const opts = Object.assign({ trigger: true, initiator: 'trigger', source: 'trigger' }, options || {});

    if (!stage5GetFeatureFlag_('jobRuntime', true)) {
      return _executeJob(registryItem, opts);
    }

    return JobRuntime_.observe(registryItem.jobName, {
      source: opts.source || (opts.trigger ? 'trigger' : 'manual'),
      dryRun: !!opts.dryRun,
      operationId: opts.operationId || stage4UniqueId_(registryItem.jobName)
    }, function() {
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

function stage4JobDailyVacationsAndBirthdays() {
  return Stage4Triggers_.runJob(getStage4Config_().JOBS.DAILY_VACATIONS_AND_BIRTHDAYS, { trigger: true, initiator: 'trigger', source: 'trigger' });
}

function stage4JobScheduledReconciliation() {
  return Stage4Triggers_.runJob(getStage4Config_().JOBS.SCHEDULED_RECONCILIATION, { trigger: true, initiator: 'trigger', source: 'trigger' });
}

function stage4JobScheduledHealthCheck() {
  return Stage4Triggers_.runJob(getStage4Config_().JOBS.SCHEDULED_HEALTHCHECK, { trigger: true, initiator: 'trigger', source: 'trigger' });
}

function stage4JobCleanupCaches() {
  return Stage4Triggers_.runJob(getStage4Config_().JOBS.CLEANUP_CACHES, { trigger: true, initiator: 'trigger', source: 'trigger' });
}


function stage7JobDetectStaleOperations() {
  return Stage4Triggers_.runJob(getStage4Config_().JOBS.STALE_OPERATION_DETECTOR, { trigger: true, initiator: 'trigger', source: 'trigger' });
}


function stage7JobLifecycleRetentionCleanup() {
  return Stage4Triggers_.runJob(getStage4Config_().JOBS.LIFECYCLE_RETENTION_CLEANUP, { trigger: true, initiator: 'trigger', source: 'trigger' });
}
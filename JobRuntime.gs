
/**
 * JobRuntime.gs — stage 5 runtime observability layer.
 */

const JobRuntime_ = (function() {
  function _failureStreak(jobName) {
    const history = JobRuntimeRepository_.getHistory(jobName);
    let streak = 0;
    for (let i = 0; i < history.length; i++) {
      if (history[i] && history[i].status === 'ERROR') {
        streak += 1;
        continue;
      }
      break;
    }
    return streak;
  }

  function _looksQuotaLikeError(error) {
    const message = String(error && error.message ? error.message : error || '').toLowerCase();
    return [
      'quota',
      'rate limit',
      'too many times',
      'service invoked too many times',
      'exceeded maximum',
      'resource exhausted',
      'timed out',
      'timeout'
    ].some(function(token) { return message.indexOf(token) !== -1; });
  }

  function _notifyRepeatedFailures(jobName, error, streak, backoff) {
    const threshold = Number(appGetCore('JOB_FAILURE_ALERT_THRESHOLD', 3)) || 3;
    if (streak < threshold || typeof AlertsRepository_ !== 'object') return;
    try {
      AlertsRepository_.appendAlert({
        timestamp: new Date(),
        jobName: String(jobName || 'unknownJob'),
        severity: 'error',
        message: 'Повторні збої job: ' + jobName + ' (' + streak + ' поспіль)',
        details: {
          streak: streak,
          error: String(error && error.message ? error.message : error || ''),
          backoff: backoff || null
        }
      });
    } catch (_) {}
  }

  function observe(jobName, context, fn) {
    const ctx = Object.assign({
      source: 'manual',
      dryRun: false,
      operationId: stage4UniqueId_(jobName || 'job')
    }, context || {});

    const backoff = JobRuntimeRepository_.getBackoff(jobName);
    if (backoff && Number(backoff.untilTs || 0) > Date.now()) {
      const startedAt = new Date();
      JobRuntimeRepository_.append({
        jobName: String(jobName || 'unknownJob'),
        tsStart: startedAt.toISOString(),
        tsEnd: startedAt.toISOString(),
        status: 'SKIPPED',
        source: ctx.source || 'manual',
        dryRun: !!ctx.dryRun,
        operationId: ctx.operationId,
        durationMs: 0,
        message: 'Backoff active until ' + new Date(Number(backoff.untilTs)).toISOString(),
        error: ''
      });
      return {
        success: true,
        skipped: true,
        message: 'Job пропущено через активний backoff',
        backoff: backoff
      };
    }
    if (backoff) {
      try { JobRuntimeRepository_.clearBackoff(jobName); } catch (_) {}
    }

    const active = JobRuntimeRepository_.getActive(jobName);
    if (active && Number(active.ts || 0) && (Date.now() - Number(active.ts || 0)) < 60 * 60 * 1000) {
      throw new Error(`Job "${jobName}" уже виконується або був запущений надто недавно`);
    }

    JobRuntimeRepository_.setActive(jobName, {
      operationId: ctx.operationId,
      source: ctx.source || 'manual',
      dryRun: !!ctx.dryRun
    });

    const startedAt = new Date();
    try {
      const result = fn();
      const finishedAt = new Date();

      JobRuntimeRepository_.append({
        jobName: String(jobName || 'unknownJob'),
        tsStart: startedAt.toISOString(),
        tsEnd: finishedAt.toISOString(),
        status: 'SUCCESS',
        source: ctx.source || 'manual',
        dryRun: !!ctx.dryRun,
        operationId: ctx.operationId,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        message: (result && result.message) ? result.message : 'OK',
        error: ''
      });
      try { JobRuntimeRepository_.clearBackoff(jobName); } catch (_) {}

      return result;
    } catch (e) {
      const finishedAt = new Date();

      JobRuntimeRepository_.append({
        jobName: String(jobName || 'unknownJob'),
        tsStart: startedAt.toISOString(),
        tsEnd: finishedAt.toISOString(),
        status: 'ERROR',
        source: ctx.source || 'manual',
        dryRun: !!ctx.dryRun,
        operationId: ctx.operationId,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        message: '',
        error: e && e.message ? e.message : String(e)
      });

      let backoffState = null;
      if (_looksQuotaLikeError(e)) {
        backoffState = JobRuntimeRepository_.setBackoff(jobName, {
          untilTs: Date.now() + ((Number(appGetCore('JOB_BACKOFF_MINUTES', 30)) || 30) * 60 * 1000),
          reason: e && e.message ? e.message : String(e)
        });
      }
      _notifyRepeatedFailures(jobName, e, _failureStreak(jobName), backoffState);

      throw e;
    } finally {
      try { JobRuntimeRepository_.clearActive(jobName); } catch (_) {}
    }
  }

  function listExecutions() {
    return JobRuntimeRepository_.listLastRuns();
  }

  function getHistory(jobName) {
    return JobRuntimeRepository_.getHistory(jobName);
  }

  function buildRuntimeReport() {
    const items = listExecutions();
    const now = Date.now();

    const jobs = items.map(function(item) {
      const ageMs = item && item.tsEnd ? (now - new Date(item.tsEnd).getTime()) : null;
      const stale = ageMs != null && ageMs > 36 * 60 * 60 * 1000;
      const history = getHistory(item.jobName);
      const consecutiveFailures = history
        .slice(0, 5)
        .filter(function(entry) { return entry.status === 'ERROR'; })
        .length;

      return Object.assign({}, item, {
        stale: stale,
        consecutiveFailures: consecutiveFailures,
        backoff: JobRuntimeRepository_.getBackoff(item.jobName)
      });
    });

    return {
      jobs: jobs.sort(function(a, b) {
        return String(a.jobName || '').localeCompare(String(b.jobName || ''));
      }),
      totalJobs: jobs.length,
      staleJobs: jobs.filter(function(item) { return item.stale; }).length,
      failedJobs: jobs.filter(function(item) { return item.status === 'ERROR'; }).length,
      repeatedFailures: jobs.filter(function(item) { return item.consecutiveFailures >= 2; }).length,
      storagePolicy: JobRuntimeRepository_.buildStoragePolicyReport()
    };
  }

  return {
    observe: observe,
    listExecutions: listExecutions,
    getHistory: getHistory,
    buildRuntimeReport: buildRuntimeReport
  };
})();
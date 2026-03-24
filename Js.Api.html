
/**
 * JobRuntime.gs — stage 5 runtime observability layer.
 */

const JobRuntime_ = (function() {
  function observe(jobName, context, fn) {
    const ctx = Object.assign({
      source: 'manual',
      dryRun: false,
      operationId: stage4UniqueId_(jobName || 'job')
    }, context || {});

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
        consecutiveFailures: consecutiveFailures
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
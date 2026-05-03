/**
 * JobRuntime.gs - stage 7 runtime observability layer.
 * Extended to populate enriched JOB_RUNTIME_LOG fields.
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
    ].some(function(token) {
      return message.indexOf(token) !== -1;
    });
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

  function _safeString(value) {
    return value === null || value === undefined ? '' : String(value);
  }

  function _safeEmail() {
    try {
      return _safeString(Session.getActiveUser().getEmail());
    } catch (_) {
      return '';
    }
  }

  function _resolveDescriptorFallback() {
    if (typeof AccessControl_ === 'object' && typeof AccessControl_.describe === 'function') {
      try {
        return AccessControl_.describe() || {};
      } catch (_) {}
    }
    return {};
  }

  function _buildContext(jobName, context) {
    const baseDescriptor = _resolveDescriptorFallback();
    const ctx = Object.assign({
      source: 'manual',
      dryRun: false,
      operationId: stage7UniqueId_(jobName || 'job'),
      initiatorEmail: '',
      initiatorName: '',
      initiatorRole: '',
      initiatorCallsign: '',
      entryPoint: '',
      triggerId: '',
      notes: ''
    }, context || {});

    if (!ctx.initiatorEmail && ctx.source !== 'trigger') {
      ctx.initiatorEmail = baseDescriptor.email || _safeEmail();
    }

    return {
      source: _safeString(ctx.source || 'manual'),
      dryRun: !!ctx.dryRun,
      operationId: _safeString(ctx.operationId || stage7UniqueId_(jobName || 'job')),
      initiatorEmail: _safeString(ctx.initiatorEmail || baseDescriptor.email || ''),
      initiatorName: _safeString(ctx.initiatorName || baseDescriptor.displayName || baseDescriptor.email || ''),
      initiatorRole: _safeString(ctx.initiatorRole || baseDescriptor.role || ''),
      initiatorCallsign: _safeString(ctx.initiatorCallsign || baseDescriptor.personCallsign || ''),
      entryPoint: _safeString(ctx.entryPoint),
      triggerId: _safeString(ctx.triggerId),
      notes: _safeString(ctx.notes)
    };
  }

  function _appendRuntimeRecord(jobName, startedAt, finishedAt, status, ctx, message, errorText) {
    JobRuntimeRepository_.append({
      jobName: _safeString(jobName || 'unknownJob'),
      tsStart: startedAt.toISOString(),
      tsEnd: finishedAt.toISOString(),
      status: _safeString(status),
      source: ctx.source,
      dryRun: !!ctx.dryRun,
      operationId: ctx.operationId,
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      message: _safeString(message),
      error: _safeString(errorText),
      initiatorEmail: ctx.initiatorEmail,
      initiatorName: ctx.initiatorName,
      initiatorRole: ctx.initiatorRole,
      initiatorCallsign: ctx.initiatorCallsign,
      entryPoint: ctx.entryPoint,
      triggerId: ctx.triggerId,
      notes: ctx.notes
    });
  }

  function observe(jobName, context, fn) {
    const safeJobName = _safeString(jobName || 'unknownJob');
    const ctx = _buildContext(safeJobName, context);
    const startedAt = new Date();

    const backoff = JobRuntimeRepository_.getBackoff(safeJobName);
    if (backoff && Number(backoff.untilTs || 0) > Date.now()) {
      _appendRuntimeRecord(
        safeJobName,
        startedAt,
        startedAt,
        'SKIPPED',
        ctx,
        'Backoff active until ' + new Date(Number(backoff.untilTs)).toISOString(),
        ''
      );

      return {
        success: true,
        skipped: true,
        message: 'Job пропущено через активний backoff',
        backoff: backoff
      };
    }

    if (backoff) {
      try {
        JobRuntimeRepository_.clearBackoff(safeJobName);
      } catch (_) {}
    }

    const active = JobRuntimeRepository_.getActive(safeJobName);
    if (active && Number(active.ts || 0) && (Date.now() - Number(active.ts || 0)) < 60 * 60 * 1000) {
      throw new Error('Job "' + safeJobName + '" уже виконується або був запущений надто недавно');
    }

    JobRuntimeRepository_.setActive(safeJobName, {
      operationId: ctx.operationId,
      source: ctx.source,
      dryRun: !!ctx.dryRun,
      initiatorEmail: ctx.initiatorEmail,
      initiatorName: ctx.initiatorName,
      initiatorRole: ctx.initiatorRole,
      initiatorCallsign: ctx.initiatorCallsign,
      entryPoint: ctx.entryPoint,
      triggerId: ctx.triggerId,
      notes: ctx.notes
    });

    try {
      const result = fn();
      const finishedAt = new Date();

      _appendRuntimeRecord(
        safeJobName,
        startedAt,
        finishedAt,
        'SUCCESS',
        ctx,
        (result && result.message) ? result.message : 'OK',
        ''
      );

      try {
        JobRuntimeRepository_.clearBackoff(safeJobName);
      } catch (_) {}

      return result;
    } catch (e) {
      const finishedAt = new Date();

      _appendRuntimeRecord(
        safeJobName,
        startedAt,
        finishedAt,
        'ERROR',
        ctx,
        '',
        e && e.message ? e.message : String(e)
      );

      let backoffState = null;
      if (_looksQuotaLikeError(e)) {
        backoffState = JobRuntimeRepository_.setBackoff(safeJobName, {
          untilTs: Date.now() + ((Number(appGetCore('JOB_BACKOFF_MINUTES', 30)) || 30) * 60 * 1000),
          reason: e && e.message ? e.message : String(e)
        });
      }

      _notifyRepeatedFailures(safeJobName, e, _failureStreak(safeJobName), backoffState);
      throw e;
    } finally {
      try {
        JobRuntimeRepository_.clearActive(safeJobName);
      } catch (_) {}
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
        .filter(function(entry) {
          return entry.status === 'ERROR';
        })
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
      staleJobs: jobs.filter(function(item) {
        return item.stale;
      }).length,
      failedJobs: jobs.filter(function(item) {
        return item.status === 'ERROR';
      }).length,
      repeatedFailures: jobs.filter(function(item) {
        return item.consecutiveFailures >= 2;
      }).length,
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

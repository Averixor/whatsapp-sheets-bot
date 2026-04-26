/**
 * Stage7TestRunner.gs — project-wide WASB test runner.
 *
 * Важливо: цей файл НЕ містить stub-реалізацій тестів.
 * Він запускає реальні test / diagnostics / check runners, які вже є у проєкті.
 */

var Stage7TestRunner = (function () {
  var VERSION = 'stage7-project-test-runner-3.1.1-single-chunk-pseudo-safe';
  var DEFAULT_TIMEOUT_MS = 330000;
  var DEFAULT_RESULT_SHEET_NAME = 'TEST_RESULTS';
  var DEFAULT_LOCK_WAIT_MS = 60000;

  function runAll(options) {
    return runSuite_('all', options);
  }

  function runAllProjectTests(options) {
    return runSuite_('all', Object.assign({}, options || {}, { includeDiscovery: true }));
  }

  /**
   * Runs a small slice of the whole project test registry.
   * This is the safe path for sidebar/UI: several short GAS executions instead of one execution that hits the 6-minute limit.
   */
  function runProjectTestChunk(options) {
    var rawOptions = options || {};
    var opts = normalizeOptions_(Object.assign({}, rawOptions, { includeDiscovery: rawOptions.includeDiscovery !== false }));
    var mode = rawOptions.mode || rawOptions.chunkMode || 'project-chunk';
    var offset = Math.max(0, parseInt(rawOptions.offset || 0, 10) || 0);
    var limit = Math.max(1, Math.min(10, parseInt(rawOptions.limit || 1, 10) || 1));
    var maxRuntimeMs = Math.max(30000, Math.min(240000, parseInt(rawOptions.maxRuntimeMs || 120000, 10) || 120000));
    var startedAt = new Date();
    var runId = rawOptions.runId || buildRunId_(startedAt, 'project-chunk');
    var lock = null;
    var locked = false;

    if (opts.useLock) {
      try {
        lock = LockService.getDocumentLock();
        locked = lock.tryLock(opts.lockWaitMs);
      } catch (lockError) {
        lock = null;
        locked = false;
      }
    }

    if (opts.useLock && !locked) {
      return buildLockFailedReport_(mode);
    }

    try {
      var allTasks = filterTasksByMode_(buildTasks_(opts), 'all');
      var report = {
        ok: true,
        version: VERSION,
        mode: mode,
        runId: runId,
        ts: toIso_(startedAt),
        startedAt: toIso_(startedAt),
        finishedAt: null,
        durationMs: 0,
        environment: collectEnvironment_(),
        offset: offset,
        limit: limit,
        nextOffset: offset,
        totalTasks: allTasks.length,
        done: false,
        progressPct: 0,
        counts: { total: 0, passed: 0, failed: 0, skipped: 0, warnings: 0, discovered: 0 },
        checks: [],
        results: [],
        warnings: []
      };

      var index = offset;
      while (index < allTasks.length && report.results.length < limit) {
        if (isTimeoutReached_(startedAt, maxRuntimeMs)) {
          report.warnings.push('Пакет зупинено до системного timeout. Наступний пакет продовжить з offset=' + index + '.');
          break;
        }

        var task = allTasks[index];
        report.results.push(runTask_(task, opts));
        index++;

        if (opts.failFast && report.results[report.results.length - 1].status === 'FAIL') {
          report.warnings.push('Пакет зупинено через failFast.');
          break;
        }
      }

      report.nextOffset = index;
      report.done = index >= allTasks.length;
      report.progressPct = allTasks.length ? Math.round((index / allTasks.length) * 100) : 100;
      finalizeReport_(report, startedAt);

      if (opts.writeToSheet) {
        try {
          writeReportToSheet_(report, opts.sheetName);
        } catch (sheetError) {
          report.warnings.push('Не вдалося записати пакетний звіт у лист: ' + getErrorMessage_(sheetError));
        }
      }

      if (opts.writeToLogger) {
        Logger.log(JSON.stringify(report, null, 2));
      }

      return report;
    } finally {
      if (lock && locked) {
        try {
          lock.releaseLock();
        } catch (releaseError) {}
      }
    }
  }

  function runFast(options) {
    return runSuite_('fast', options);
  }

  function runDiagnosticsOnly(options) {
    return runSuite_('diagnostics', options);
  }

  function runSmokeOnly(options) {
    return runSuite_('smoke', options);
  }

  function runHealthOnly(options) {
    return runSuite_('health', options);
  }

  function runAccessOnly(options) {
    return runSuite_('access', options);
  }

  function runDomainOnly(options) {
    return runSuite_('domain', options);
  }

  function listTasks(options) {
    var opts = normalizeOptions_(options || {});
    return buildTasks_(opts).map(function (task) {
      return {
        id: task.id,
        name: task.name,
        group: task.group,
        level: task.level,
        severity: task.severity,
        functionName: task.functionName,
        discovered: task.discovered === true
      };
    });
  }

  function runSuite_(mode, options) {
    var opts = normalizeOptions_(options || {});
    var lock = null;
    var locked = false;

    if (opts.useLock) {
      try {
        lock = LockService.getDocumentLock();
        locked = lock.tryLock(opts.lockWaitMs);
      } catch (lockError) {
        lock = null;
        locked = false;
      }
    }

    if (opts.useLock && !locked) {
      return buildLockFailedReport_(mode);
    }

    try {
      var startedAt = new Date();
      var runId = buildRunId_(startedAt, mode);
      var tasks = filterTasksByMode_(buildTasks_(opts), mode);

      var report = {
        ok: true,
        version: VERSION,
        mode: mode,
        runId: runId,
        ts: toIso_(startedAt),
        startedAt: toIso_(startedAt),
        finishedAt: null,
        durationMs: 0,
        environment: collectEnvironment_(),
        counts: {
          total: 0,
          passed: 0,
          failed: 0,
          skipped: 0,
          warnings: 0,
          discovered: 0
        },
        checks: [],
        results: [],
        warnings: []
      };

      for (var i = 0; i < tasks.length; i++) {
        var task = tasks[i];

        if (isTimeoutReached_(startedAt, opts.timeoutMs)) {
          report.results.push(makeSkippedResult_(task, 'Пропущено через обмеження часу виконання Google Apps Script.'));
          continue;
        }

        var result = runTask_(task, opts);
        report.results.push(result);

        if (opts.failFast && result.status === 'FAIL') {
          break;
        }
      }

      finalizeReport_(report, startedAt);

      if (opts.writeToSheet) {
        try {
          writeReportToSheet_(report, opts.sheetName);
        } catch (sheetError) {
          report.warnings.push('Не вдалося записати звіт у лист: ' + getErrorMessage_(sheetError));
        }
      }

      if (opts.writeToLogger) {
        Logger.log(JSON.stringify(report, null, 2));
      }

      return report;
    } finally {
      if (lock && locked) {
        try {
          lock.releaseLock();
        } catch (releaseError) {}
      }
    }
  }

  function buildTasks_(options) {
    var registry = buildRegisteredTasks_();
    var byFunction = {};
    var result = [];

    registry.forEach(function (task) {
      byFunction[task.functionName] = true;
      result.push(task);
    });

    if (options.includeDiscovery !== false) {
      if (typeof options !== 'undefined' && options && options.discover === true) {
      discoverProjectTestTasks_(byFunction).forEach(function (task) {
        result.push(task);
      });
      }
    }

    return result;
  }

  function task_(id, name, group, level, severity, functionName, args) {
    return {
      id: id,
      name: name,
      group: group,
      level: level,
      severity: severity,
      functionName: functionName,
      args: args || null,
      discovered: false
    };
  }

  function optArg_(mode) {
    return [{
      source: 'Stage7TestRunner',
      runnerVersion: VERSION,
      mode: mode || 'project-all',
      dryRun: true,
      safeTestEnvironment: true,
      forceRun: true
    }];
  }

  function buildRegisteredTasks_() {
    return [
      task_('health-check', 'Health: healthCheck', 'health', 'fast', 'critical', 'healthCheck', optArg_('health')),

      task_('basic-check-sheets', 'Basic diagnostics: checkSheets', 'diagnostics', 'fast', 'critical', 'checkSheets'),
      task_('basic-check-files', 'Basic diagnostics: checkFiles', 'diagnostics', 'fast', 'warning', 'checkFiles'),
      task_('basic-check-duplicates', 'Basic diagnostics: checkDuplicates', 'diagnostics', 'full', 'warning', 'checkDuplicates'),
      task_('basic-test-functions', 'Basic diagnostics: testFunctions', 'diagnostics', 'fast', 'critical', 'testFunctions'),
      task_('basic-run-diagnostics', 'Basic diagnostics: runDiagnostics', 'diagnostics', 'fast', 'critical', 'runDiagnostics'),
      task_('basic-run-all-diagnostics', 'Basic diagnostics: runAllDiagnostics', 'diagnostics', 'full', 'critical', 'runAllDiagnostics'),
      task_('basic-run-full-diagnostics', 'Basic diagnostics: runFullDiagnostics', 'diagnostics', 'full', 'critical', 'runFullDiagnostics'),
      task_('basic-run-sheets-check', 'Basic diagnostics: runSheetsCheck', 'diagnostics', 'full', 'warning', 'runSheetsCheck'),
      task_('basic-run-files-check', 'Basic diagnostics: runFilesCheck', 'diagnostics', 'full', 'warning', 'runFilesCheck'),
      task_('basic-run-duplicates-check', 'Basic diagnostics: runDuplicatesCheck', 'diagnostics', 'full', 'warning', 'runDuplicatesCheck'),
      task_('basic-run-tests-check', 'Basic diagnostics: runTestsCheck', 'diagnostics', 'full', 'warning', 'runTestsCheck'),

      task_('stage7-quick-diagnostics', 'Stage7 diagnostics: runQuickDiagnostics_', 'diagnostics', 'fast', 'critical', 'runQuickDiagnostics_', optArg_('quick')),
      task_('stage7-structural-diagnostics', 'Stage7 diagnostics: runStructuralDiagnostics_', 'diagnostics', 'fast', 'critical', 'runStructuralDiagnostics_', optArg_('structural')),
      task_('stage7-operational-diagnostics', 'Stage7 diagnostics: runOperationalDiagnostics_', 'diagnostics', 'full', 'critical', 'runOperationalDiagnostics_', optArg_('operational')),
      task_('stage7-sunset-diagnostics', 'Stage7 diagnostics: runSunsetDiagnostics_', 'diagnostics', 'full', 'warning', 'runSunsetDiagnostics_', optArg_('sunset')),
      task_('stage7-hardening-diagnostics', 'Stage7 diagnostics: runHardeningDiagnostics_', 'diagnostics', 'full', 'warning', 'runHardeningDiagnostics_', optArg_('stage7a-hardening')),
      task_('stage7-full-diagnostics', 'Stage7 diagnostics: runFullDiagnostics_', 'diagnostics', 'full', 'critical', 'runFullDiagnostics_', optArg_('full')),
      task_('stage7-full-verbose-diagnostics', 'Stage7 diagnostics: runFullVerboseDiagnostics_', 'diagnostics', 'full', 'warning', 'runFullVerboseDiagnostics_', optArg_('full-verbose')),

      task_('stage3-health-check', 'Legacy diagnostics: runStage3HealthCheck_', 'diagnostics', 'full', 'warning', 'runStage3HealthCheck_', optArg_('stage3Health')),
      task_('stage4-health-check', 'Legacy diagnostics: runStage4HealthCheck_', 'diagnostics', 'full', 'warning', 'runStage4HealthCheck_', optArg_('stage4Health')),
      task_('stage5-metadata-consistency-check', 'Legacy diagnostics: runStage5MetadataConsistencyCheck_', 'diagnostics', 'full', 'warning', 'runStage5MetadataConsistencyCheck_'),
      task_('stage41-project-consistency-check', 'Legacy diagnostics: runStage41ProjectConsistencyCheck_', 'diagnostics', 'full', 'warning', 'runStage41ProjectConsistencyCheck_'),
      task_('historical-structural-diagnostics', 'Historical diagnostics: runHistoricalStructuralDiagnosticsInternal_', 'diagnostics', 'full', 'warning', 'runHistoricalStructuralDiagnosticsInternal_', optArg_('historicalStructural')),
      task_('historical-compatibility-diagnostics', 'Historical diagnostics: runHistoricalCompatibilityDiagnosticsInternal_', 'diagnostics', 'full', 'warning', 'runHistoricalCompatibilityDiagnosticsInternal_', optArg_('historicalCompatibility')),
      task_('historical-quick-diagnostics', 'Historical diagnostics: runHistoricalQuickDiagnosticsInternal_', 'diagnostics', 'full', 'warning', 'runHistoricalQuickDiagnosticsInternal_', optArg_('historicalQuick')),
      task_('historical-full-diagnostics', 'Historical diagnostics: runHistoricalFullDiagnosticsInternal_', 'diagnostics', 'full', 'warning', 'runHistoricalFullDiagnosticsInternal_', optArg_('historicalFull')),


      task_('domain-tests-stage6a', 'Domain tests: runStage6ADomainTests_', 'domain', 'full', 'warning', 'runStage6ADomainTests_', optArg_('domain')),

      task_('access-policy-checks', 'Access tests: runAccessPolicyChecks', 'access', 'full', 'critical', 'runAccessPolicyChecks', optArg_('accessPolicy')),
      task_('access-all-policy-checks', 'Access tests: runAllPolicyChecks', 'access', 'full', 'warning', 'runAllPolicyChecks', optArg_('allPolicyChecks')),
      task_('access-security-e2e-tests', 'Access tests: runAccessSecurityE2ETests_', 'access', 'full', 'critical', 'runAccessSecurityE2ETests_', optArg_('accessSecurity')),
      task_('access-e2e-tests', 'Access tests: runAccessE2ETests', 'access', 'full', 'critical', 'runAccessE2ETests', optArg_('accessE2E')),
      task_('access-diagnostics', 'Access diagnostics: runAccessDiagnostics', 'access', 'full', 'warning', 'runAccessDiagnostics'),
      task_('access-public-test', 'Access tests: testWasbAccessControl', 'access', 'full', 'warning', 'testWasbAccessControl'),
      task_('access-internal-test', 'Access tests: testAccessControl_', 'access', 'full', 'warning', 'testAccessControl_'),
      task_('access-smoke-test', 'Access tests: smokeTestAccessControl_', 'access', 'full', 'warning', 'smokeTestAccessControl_'),
      task_('access-test-diagnostics', 'Access diagnostics: testDiagnostics', 'access', 'full', 'warning', 'testDiagnostics'),

      task_('template-notify-smoke', 'Template tests: testNotifyWithTemplate_', 'templates', 'full', 'warning', 'testNotifyWithTemplate_'),
      task_('vacation-engine-test', 'Vacation tests: testVacationEngine', 'vacations', 'full', 'warning', 'testVacationEngine')
    ];
  }

  function discoverProjectTestTasks_(knownFunctions) {
    var globalObject = getGlobalObject_();
    var keys = [];
    var tasks = [];
    var seen = Object.assign({}, knownFunctions || {});

    try {
      keys = Object.keys(globalObject || {});
    } catch (error) {
      keys = [];
    }

    keys.sort().forEach(function (name) {
      if (seen[name]) return;
      if (!shouldDiscoverFunction_(name, globalObject[name])) return;
      seen[name] = true;
      tasks.push({
        id: 'discovered-' + slugify_(name),
        name: 'Discovered test runner: ' + name,
        group: 'discovered',
        level: 'full',
        severity: 'warning',
        functionName: name,
        args: optArg_('discovered'),
        discovered: true
      });
    });

    return tasks;
  }

  function shouldDiscoverFunction_(name, value) {
    if (typeof value !== 'function') return false;

    var n = String(name || '');
    if (!n) return false;
    if (n.charAt(0) === '_') return false;
    if (isRunnerOwnFunction_(n)) return false;
    if (isDangerousOrOperationalName_(n)) return false;

    if (/^api/i.test(n)) return false;

    var looksLikeRunner = /^(run|test|smokeTest)[A-Z0-9_]/.test(n) || n === 'healthCheck';
    var hasTestToken = /(Test|Tests|Diagnostics|Check|Health|PolicyChecks)/.test(n) || n === 'healthCheck';

    return looksLikeRunner && hasTestToken;
  }

  function isRunnerOwnFunction_(name) {
    var own = {
      runAllTests: true,
      runAllProjectTests: true,
      runProjectTestChunk: true,
      runStage7AllProjectTests: true,
      runStage7ProjectTestChunk: true,
      runStage7TestsAll: true,
      runStage7TestsFast: true,
      runStage7DiagnosticsOnly: true,
      runStage7SmokeOnly: true,
      runStage7HealthOnly: true,
      runStage7AccessOnly: true,
      runStage7DomainOnly: true,
      showStage7TestReport: true,
      resetStage7TestResultsSheet: true,
      stage7TestRunnerOnOpen: true,
      installStage7TestRunner: true
    };
    return own[name] === true;
  }

  function isDangerousOrOperationalName_(name) {
    var n = String(name || '').toLowerCase();
    var denied = [
      'clear', 'cleanup', 'delete', 'remove', 'reset', 'install', 'setup', 'create',
      'switch', 'send', 'mark', 'apply', 'protect', 'repair', 'trigger', 'notify',
      'auto', 'bootstrap', 'write', 'sync', 'migrate', 'rotate'
    ];

    for (var i = 0; i < denied.length; i++) {
      if (n.indexOf(denied[i]) !== -1) return true;
    }

    return false;
  }

  function filterTasksByMode_(tasks, mode) {
    if (mode === 'all' || mode === 'project' || mode === 'project-all') return tasks;

    if (mode === 'fast') {
      return tasks.filter(function (task) {
        return task.level === 'fast';
      });
    }

    if (mode === 'diagnostics') {
      return tasks.filter(function (task) {
        return task.group === 'diagnostics' || task.group === 'health';
      });
    }

    if (mode === 'smoke') {
      return tasks.filter(function (task) {
        return task.group === 'smoke' || task.group === 'regression';
      });
    }

    if (mode === 'health') {
      return tasks.filter(function (task) {
        return task.group === 'health';
      });
    }

    if (mode === 'access') {
      return tasks.filter(function (task) {
        return task.group === 'access';
      });
    }

    if (mode === 'domain') {
      return tasks.filter(function (task) {
        return task.group === 'domain';
      });
    }

    return tasks;
  }

  function runTask_(task, options) {
    var startedAt = new Date();
    var result = {
      id: task.id,
      name: task.name,
      title: task.name,
      group: task.group,
      uiGroup: '',
      level: task.level,
      severity: task.severity,
      functionName: task.functionName,
      discovered: task.discovered === true,
      status: 'UNKNOWN',
      ok: false,
      skipped: false,
      startedAt: toIso_(startedAt),
      finishedAt: null,
      durationMs: 0,
      message: '',
      details: null,
      recommendation: '',
      errorStack: ''
    };

    try {
      var fn = resolveFunction_(task.functionName);

      if (!fn) {
        result.status = 'SKIPPED';
        result.ok = true;
        result.skipped = true;
        result.uiGroup = 'pseudo';
        result.message = 'Функцію не знайдено: ' + task.functionName;
        result.recommendation = 'Якщо це очікуваний legacy runner — можна залишити. Якщо тест має існувати, перевірити імпорт файлу.';
        result.finishedAt = toIso_(new Date());
        result.durationMs = new Date() - startedAt;
        return result;
      }

      var args = Array.isArray(task.args) ? task.args : optArg_(task.id);
      var value = fn.apply(null, args);
      result.details = normalizeTaskReturn_(value);
      result.status = inferStatus_(result.details, task);
      result.ok = result.status !== 'FAIL';
      result.uiGroup = statusToUiGroup_(result.status, result.ok, task);
      result.message = buildTaskMessage_(result.status, result.details, task);
      result.recommendation = buildRecommendation_(result.status, result.details, task);
      result.finishedAt = toIso_(new Date());
      result.durationMs = new Date() - startedAt;

      return result;
    } catch (error) {
      result.status = 'FAIL';
      result.ok = false;
      result.skipped = false;
      result.uiGroup = 'critical';
      result.message = getErrorMessage_(error);
      result.recommendation = 'Відкрити ErrorStack у TEST_RESULTS і виправити функцію: ' + task.functionName;
      result.errorStack = getErrorStack_(error);
      result.finishedAt = toIso_(new Date());
      result.durationMs = new Date() - startedAt;

      return result;
    }
  }

  function normalizeTaskReturn_(value) {
    if (value === null || typeof value === 'undefined') {
      return { type: 'empty', raw: null };
    }

    if (typeof value === 'string') return { type: 'string', raw: value };
    if (typeof value === 'number' || typeof value === 'boolean') return { type: typeof value, raw: value };

    if (Object.prototype.toString.call(value) === '[object Date]') {
      return { type: 'date', raw: toIso_(value) };
    }

    if (Array.isArray(value)) {
      return { type: 'array', length: value.length, raw: value };
    }

    return { type: 'object', raw: value };
  }

  function inferStatus_(details, task) {
    var raw = details ? details.raw : null;

    if (raw === false) return 'FAIL';
    if (raw === true) return 'PASS';
    if (raw === null || typeof raw === 'undefined') return 'PASS';

    if (typeof raw === 'string') {
      var normalizedString = raw.toUpperCase();
      if (isFailStatus_(normalizedString)) return 'FAIL';
      if (isWarnStatus_(normalizedString)) return 'WARN';
      return 'PASS';
    }

    if (Array.isArray(raw)) return 'PASS';

    if (typeof raw === 'object') {
      if (isPseudoInfo_(raw)) return 'PASS';
      if (raw.blocked === true) return task && task.severity === 'critical' ? 'FAIL' : 'WARN';
      if (raw.ok === false || raw.success === false || raw.valid === false || raw.passed === false || raw.ready === false) return 'FAIL';
      if (raw.allPassed === false) return 'FAIL';

      if (raw.status && isFailStatus_(raw.status)) return 'FAIL';
      if (raw.result && isFailStatus_(raw.result)) return 'FAIL';

      if (numberGreaterThanZero_(raw.fail) || numberGreaterThanZero_(raw.failed) || numberGreaterThanZero_(raw.failures) || numberGreaterThanZero_(raw.errorCount)) return 'FAIL';
      if (arrayHasItems_(raw.failed) || arrayHasItems_(raw.failures) || arrayHasItems_(raw.errors)) return 'FAIL';

      var checksStatus = inferChecksStatus_(raw.checks);
      if (checksStatus === 'FAIL') return 'FAIL';
      if (checksStatus === 'WARN') return 'WARN';

      var resultsStatus = inferChecksStatus_(raw.results);
      if (resultsStatus === 'FAIL') return 'FAIL';
      if (resultsStatus === 'WARN') return 'WARN';

      if (raw.status && isWarnStatus_(raw.status)) return 'WARN';
      if (raw.result && isWarnStatus_(raw.result)) return 'WARN';
      if (numberGreaterThanZero_(raw.warningCount) || numberGreaterThanZero_(raw.warningsCount)) return 'WARN';
      if (arrayHasItems_(raw.warnings)) return 'WARN';
      if (arrayHasItems_(raw.issues)) return task && task.severity === 'critical' ? 'FAIL' : 'WARN';

      if (raw.dataIntegrity && objectHasNonEmptyArrays_(raw.dataIntegrity)) return task && task.severity === 'critical' ? 'FAIL' : 'WARN';
      if (raw.criticalIssues && arrayHasItems_(raw.criticalIssues)) return 'FAIL';
    }

    return 'PASS';
  }

  function inferChecksStatus_(items) {
    if (!Array.isArray(items)) return 'PASS';

    var hasWarn = false;
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (!item) continue;

      if (isPseudoInfo_(item)) continue;

      if (item.ok === false || item.success === false || item.valid === false || item.passed === false) return 'FAIL';
      if (item.status && isFailStatus_(item.status)) return 'FAIL';
      if (item.result && isFailStatus_(item.result)) return 'FAIL';
      if (arrayHasItems_(item.errors) || arrayHasItems_(item.failed) || arrayHasItems_(item.failures)) return 'FAIL';

      if (item.status && isWarnStatus_(item.status)) hasWarn = true;
      if (item.result && isWarnStatus_(item.result)) hasWarn = true;
      if (arrayHasItems_(item.warnings) || arrayHasItems_(item.issues)) hasWarn = true;
    }

    return hasWarn ? 'WARN' : 'PASS';
  }

  function isFailStatus_(status) {
    var value = String(status).toUpperCase();
    return value === 'FAIL' || value === 'FAILED' || value === 'ERROR' || value === 'CRITICAL' || value === 'BROKEN' || value === 'BLOCKED';
  }

  function isWarnStatus_(status) {
    var value = String(status).toUpperCase();
    return value === 'WARN' || value === 'WARNING' || value === 'ISSUE' || value === 'DEGRADED' || value === 'SKIP' || value === 'SKIPPED';
  }

  function isPseudoInfo_(item) {
    if (!item || typeof item !== 'object') return false;

    var status = String(item.status || item.result || '').toUpperCase();
    var severity = String(item.severity || '').toUpperCase();
    var uiGroup = String(item.uiGroup || '').toLowerCase();

    return item.pseudo === true || status === 'PSEUDO' || uiGroup === 'pseudo' ||
      ((item.ok === false || item.success === false || item.valid === false || item.passed === false) && severity === 'INFO');
  }

  function statusToUiGroup_(status, ok, task) {
    if (status === 'SKIPPED') return 'pseudo';
    if (status === 'FAIL') return 'critical';
    if (status === 'WARN') return 'warnings';
    return 'ok';
  }

  function buildTaskMessage_(status, details, task) {
    var raw = details ? details.raw : null;

    if (raw && typeof raw === 'object') {
      if (raw.message) return String(raw.message);
      if (raw.summary) return String(raw.summary);
      if (raw.error) return String(raw.error);

      if (raw.checks && Array.isArray(raw.checks)) return 'checks=' + raw.checks.length;
      if (raw.results && Array.isArray(raw.results)) return 'results=' + raw.results.length;
      if (raw.summary && typeof raw.summary === 'object') return safeJson_(raw.summary, 1000);
      if (typeof raw.passed === 'number' || typeof raw.failed === 'number') {
        return 'passed=' + String(raw.passed || 0) + '; failed=' + String(raw.failed || 0);
      }
    }

    if (typeof raw === 'string' && raw) return raw.length > 500 ? raw.slice(0, 500) + '…' : raw;
    if (status === 'PASS') return 'Виконано успішно.';
    if (status === 'WARN') return 'Виконано з попередженнями.';
    if (status === 'FAIL') return 'Перевірка завершилась помилкою.';
    if (status === 'SKIPPED') return 'Перевірку пропущено.';
    return 'Виконано.';
  }

  function buildRecommendation_(status, details, task) {
    var raw = details ? details.raw : null;

    if (raw && typeof raw === 'object') {
      if (raw.recommendation) return String(raw.recommendation);
      if (raw.howTo) return String(raw.howTo);
      if (raw.reason) return String(raw.reason);
      if (raw.blocked === true) return 'Запустити у safe test mode або перевірити права доступу/роль користувача.';
    }

    if (status === 'FAIL') return 'Дивись details/errorStack у TEST_RESULTS для функції ' + task.functionName + '.';
    if (status === 'WARN') return 'Перевірити попередження; якщо це compatibility/legacy — можна залишити як технічний борг.';
    return '';
  }

  function finalizeReport_(report, startedAt) {
    var finishedAt = new Date();
    var passed = 0;
    var failed = 0;
    var skipped = 0;
    var warnings = 0;
    var discovered = 0;

    report.finishedAt = toIso_(finishedAt);
    report.durationMs = finishedAt - startedAt;

    for (var i = 0; i < report.results.length; i++) {
      var item = report.results[i];
      if (item.status === 'PASS') passed++;
      else if (item.status === 'FAIL') failed++;
      else if (item.status === 'SKIPPED') skipped++;
      else if (item.status === 'WARN') warnings++;
      if (item.discovered) discovered++;
    }

    report.counts.total = report.results.length;
    report.counts.passed = passed;
    report.counts.failed = failed;
    report.counts.skipped = skipped;
    report.counts.warnings = warnings;
    report.counts.discovered = discovered;
    report.ok = failed === 0;
    report.checks = report.results.map(resultToCheck_);

    if (discovered > 0) report.warnings.push('Додатково знайдено runner-функцій через discovery: ' + discovered + '.');
    if (skipped > 0) report.warnings.push('Частина перевірок пропущена, бо відповідні функції не знайдені у проєкті.');
    if (warnings > 0) report.warnings.push('Частина перевірок повернула попередження.');
    if (failed > 0) report.warnings.push('Є критичні помилки. Деплой краще не робити, доки вони не виправлені.');
  }

  function resultToCheck_(item) {
    return {
      name: item.name,
      title: item.name,
      status: item.status === 'PASS' ? 'OK' : item.status,
      ok: item.ok,
      uiGroup: item.uiGroup,
      group: item.group,
      severity: item.severity,
      details: item.message || '',
      message: item.message || '',
      recommendation: item.recommendation || '',
      functionName: item.functionName,
      durationMs: item.durationMs,
      discovered: item.discovered === true
    };
  }

  function makeSkippedResult_(task, message) {
    var now = new Date();
    return {
      id: task.id,
      name: task.name,
      title: task.name,
      group: task.group,
      uiGroup: 'pseudo',
      level: task.level,
      severity: task.severity,
      functionName: task.functionName,
      discovered: task.discovered === true,
      status: 'SKIPPED',
      ok: true,
      skipped: true,
      startedAt: toIso_(now),
      finishedAt: toIso_(now),
      durationMs: 0,
      message: message,
      details: null,
      recommendation: 'Запуск пропущено через ліміт часу або відсутність функції.',
      errorStack: ''
    };
  }

  function normalizeOptions_(options) {
    options = options || {};
    return {
      timeoutMs: typeof options.timeoutMs === 'number' ? options.timeoutMs : DEFAULT_TIMEOUT_MS,
      lockWaitMs: typeof options.lockWaitMs === 'number' ? options.lockWaitMs : DEFAULT_LOCK_WAIT_MS,
      writeToSheet: options.writeToSheet !== false,
      writeToLogger: options.writeToLogger !== false,
      useLock: options.useLock !== false,
      failFast: options.failFast === true,
      dryRun: options.dryRun !== false,
      includeDiscovery: options.includeDiscovery !== false,
      sheetName: options.sheetName || DEFAULT_RESULT_SHEET_NAME
    };
  }

  function buildLockFailedReport_(mode) {
    var now = new Date();
    var result = {
      id: 'runner-lock',
      name: 'Stage7TestRunner document lock',
      title: 'Stage7TestRunner document lock',
      group: 'system',
      uiGroup: 'critical',
      level: 'system',
      severity: 'critical',
      functionName: '',
      discovered: false,
      status: 'FAIL',
      ok: false,
      skipped: false,
      startedAt: toIso_(now),
      finishedAt: toIso_(now),
      durationMs: 0,
      message: 'Не вдалося отримати document lock. Ймовірно, інший запуск тестів ще виконується.',
      details: null,
      recommendation: 'Дочекатися завершення попереднього запуску або перевірити завислі executions.',
      errorStack: ''
    };

    return {
      ok: false,
      version: VERSION,
      mode: mode,
      runId: buildRunId_(now, mode),
      ts: toIso_(now),
      startedAt: toIso_(now),
      finishedAt: toIso_(now),
      durationMs: 0,
      environment: collectEnvironment_(),
      counts: { total: 1, passed: 0, failed: 1, skipped: 0, warnings: 0, discovered: 0 },
      checks: [resultToCheck_(result)],
      results: [result],
      warnings: ['Запуск заблоковано document lock.']
    };
  }

  function isTimeoutReached_(startedAt, timeoutMs) {
    return new Date() - startedAt > timeoutMs;
  }

  function resolveFunction_(name) {
    var globalObject = getGlobalObject_();
    if (globalObject && typeof globalObject[name] === 'function') return globalObject[name];

    try {
      var candidate = eval(name);
      if (typeof candidate === 'function') return candidate;
    } catch (error) {}

    return null;
  }

  function getGlobalObject_() {
    try {
      if (typeof globalThis !== 'undefined') return globalThis;
    } catch (error1) {}

    try {
      return Function('return this')();
    } catch (error2) {
      return this;
    }
  }

  function collectEnvironment_() {
    var env = {
      scriptTimeZone: '',
      spreadsheetId: '',
      spreadsheetName: '',
      activeSheetName: '',
      effectiveUser: '',
      activeUser: '',
      locale: '',
      scriptId: ''
    };

    try { env.scriptTimeZone = Session.getScriptTimeZone(); } catch (error1) {}
    try { env.locale = Session.getActiveUserLocale(); } catch (error2) {}
    try { env.effectiveUser = Session.getEffectiveUser().getEmail(); } catch (error3) {}
    try { env.activeUser = Session.getActiveUser().getEmail(); } catch (error4) {}
    try { env.scriptId = ScriptApp.getScriptId(); } catch (error5) {}

    try {
      var ss = SpreadsheetApp.getActive();
      env.spreadsheetId = ss.getId();
      env.spreadsheetName = ss.getName();
      env.activeSheetName = ss.getActiveSheet().getName();
    } catch (error6) {}

    return env;
  }

  function writeReportToSheet_(report, sheetName) {
    var sheet = getOrCreateSheet_(sheetName);
    ensureResultHeader_(sheet);

    var rows = report.results.map(function (item) {
      return [
        report.runId,
        report.mode,
        report.startedAt,
        report.finishedAt,
        report.durationMs,
        item.group,
        item.level,
        item.id,
        item.name,
        item.functionName,
        item.status,
        item.severity,
        item.discovered ? 'yes' : 'no',
        item.durationMs,
        item.message,
        safeJson_(item.details, 45000),
        item.errorStack || ''
      ];
    });

    if (rows.length > 0) {
      var startRow = sheet.getLastRow() + 1;
      sheet.getRange(startRow, 1, rows.length, 17).setValues(rows);
      styleResultRows_(sheet, startRow, rows.length);
    }

    try { sheet.autoResizeColumns(1, 17); } catch (error) {}
  }

  function ensureResultHeader_(sheet) {
    if (sheet.getLastRow() > 0) return;

    sheet.getRange(1, 1, 1, 17).setValues([[
      'RunId',
      'Mode',
      'StartedAt',
      'FinishedAt',
      'RunDurationMs',
      'Group',
      'Level',
      'Id',
      'Name',
      'FunctionName',
      'Status',
      'Severity',
      'Discovered',
      'TaskDurationMs',
      'Message',
      'DetailsJson',
      'ErrorStack'
    ]]);

    styleResultsSheet_(sheet);
  }

  function getOrCreateSheet_(sheetName) {
    var ss = SpreadsheetApp.getActive();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) sheet = ss.insertSheet(sheetName);
    return sheet;
  }

  function styleResultsSheet_(sheet) {
    sheet.setFrozenRows(1);
    var headerRange = sheet.getRange(1, 1, 1, 17);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#111827');
    headerRange.setFontColor('#ffffff');
    headerRange.setHorizontalAlignment('center');
    sheet.getRange(1, 1, sheet.getMaxRows(), 17).setVerticalAlignment('middle');
  }

  function styleResultRows_(sheet, startRow, rowCount) {
    if (rowCount <= 0) return;

    var statusValues = sheet.getRange(startRow, 11, rowCount, 1).getValues();
    for (var i = 0; i < statusValues.length; i++) {
      var row = startRow + i;
      var status = String(statusValues[i][0] || '').toUpperCase();
      var range = sheet.getRange(row, 1, 1, 17);

      if (status === 'PASS') range.setBackground('#ecfdf5');
      else if (status === 'FAIL') range.setBackground('#fef2f2');
      else if (status === 'WARN') range.setBackground('#fffbeb');
      else if (status === 'SKIPPED') range.setBackground('#eff6ff');
    }
  }

  function showDialog(report) {
    if (!report) {
      report = runFast({ writeToSheet: true, writeToLogger: true, useLock: false });
    }

    var html = buildDialogHtml_(report);
    SpreadsheetApp.getUi().showModalDialog(
      HtmlService.createHtmlOutput(html).setWidth(980).setHeight(720),
      'WASB Test Runner'
    );

    return report;
  }

  function addMenu() {
    SpreadsheetApp.getUi()
      .createMenu('WASB Tests')
      .addItem('Усі тести проєкту', 'runStage7AllProjectTests')
      .addItem('Швидка перевірка', 'runStage7TestsFast')
      .addSeparator()
      .addItem('Тільки Health', 'runStage7HealthOnly')
      .addItem('Тільки Diagnostics', 'runStage7DiagnosticsOnly')
      .addItem('Тільки Smoke/Regression', 'runStage7SmokeOnly')
      .addItem('Тільки Access', 'runStage7AccessOnly')
      .addItem('Тільки Domain', 'runStage7DomainOnly')
      .addSeparator()
      .addItem('Показати звіт', 'showStage7TestReport')
      .addItem('Очистити лист TEST_RESULTS', 'resetStage7TestResultsSheet')
      .addSeparator()
      .addItem('Встановити onOpen-тригер меню', 'installStage7TestRunner')
      .addToUi();

    return { ok: true, menu: 'WASB Tests' };
  }

  function installOpenTrigger() {
    var triggers = ScriptApp.getProjectTriggers();
    var exists = false;

    for (var i = 0; i < triggers.length; i++) {
      if (typeof triggers[i].getHandlerFunction === 'function' && triggers[i].getHandlerFunction() === 'stage7TestRunnerOnOpen') {
        exists = true;
        break;
      }
    }

    if (!exists) {
      ScriptApp.newTrigger('stage7TestRunnerOnOpen')
        .forSpreadsheet(SpreadsheetApp.getActive())
        .onOpen()
        .create();
    }

    addMenu();
    return { ok: true, installed: true, handler: 'stage7TestRunnerOnOpen' };
  }

  function resetResultsSheet() {
    var sheet = getOrCreateSheet_(DEFAULT_RESULT_SHEET_NAME);
    sheet.clear();
    ensureResultHeader_(sheet);
    return { ok: true, sheetName: DEFAULT_RESULT_SHEET_NAME };
  }

  function buildDialogHtml_(report) {
    var statusColor = report.ok ? '#0f7b3f' : '#9b1c1c';
    var statusText = report.ok ? 'PASS' : 'FAIL';
    var rows = (report.results || []).map(function (item) {
      return '<tr>' +
        '<td>' + escapeHtml_(item.group) + '</td>' +
        '<td>' + escapeHtml_(item.level) + '</td>' +
        '<td>' + escapeHtml_(item.name) + '</td>' +
        '<td>' + escapeHtml_(item.functionName) + '</td>' +
        '<td class="' + escapeHtml_(String(item.status).toLowerCase()) + '">' + escapeHtml_(item.status) + '</td>' +
        '<td>' + escapeHtml_(String(item.durationMs)) + '</td>' +
        '<td>' + escapeHtml_(item.message || '') + '</td>' +
        '</tr>';
    }).join('');

    var warnings = '';
    if (report.warnings && report.warnings.length > 0) {
      warnings = '<div class="warnings">' + report.warnings.map(function (warning) {
        return '<div>' + escapeHtml_(warning) + '</div>';
      }).join('') + '</div>';
    }

    return '<!doctype html><html><head><base target="_top"><meta charset="UTF-8"><style>' +
      'body{font-family:Arial,sans-serif;background:#111827;color:#e5e7eb;margin:0;padding:18px;}' +
      'h1{font-size:22px;margin:0 0 12px;}.badge{display:inline-block;padding:6px 12px;border-radius:999px;background:' + statusColor + ';color:#fff;font-weight:700;}' +
      '.grid{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin:16px 0;}.card{background:#1f2937;border:1px solid #374151;border-radius:12px;padding:12px;}' +
      '.label{color:#9ca3af;font-size:12px;margin-bottom:6px;}.value{font-size:18px;font-weight:700;}.warnings{background:#3b2f0b;border:1px solid #92400e;color:#fde68a;border-radius:12px;padding:10px;margin:12px 0;font-size:13px;}' +
      'table{width:100%;border-collapse:collapse;background:#111827;border:1px solid #374151;}th,td{border-bottom:1px solid #374151;padding:8px;text-align:left;font-size:12px;vertical-align:top;}th{background:#1f2937;color:#f9fafb;position:sticky;top:0;}' +
      '.pass,.ok{color:#22c55e;font-weight:700;}.fail{color:#ef4444;font-weight:700;}.warn{color:#f59e0b;font-weight:700;}.skipped{color:#93c5fd;font-weight:700;}.footer{margin-top:14px;color:#9ca3af;font-size:12px;}' +
      '</style></head><body>' +
      '<h1>WASB Project Test Runner <span class="badge">' + statusText + '</span></h1>' +
      '<div class="grid">' +
      '<div class="card"><div class="label">Total</div><div class="value">' + report.counts.total + '</div></div>' +
      '<div class="card"><div class="label">Passed</div><div class="value">' + report.counts.passed + '</div></div>' +
      '<div class="card"><div class="label">Failed</div><div class="value">' + report.counts.failed + '</div></div>' +
      '<div class="card"><div class="label">Warnings</div><div class="value">' + report.counts.warnings + '</div></div>' +
      '<div class="card"><div class="label">Skipped</div><div class="value">' + report.counts.skipped + '</div></div>' +
      '<div class="card"><div class="label">Discovered</div><div class="value">' + report.counts.discovered + '</div></div>' +
      '</div>' + warnings +
      '<table><thead><tr><th>Group</th><th>Level</th><th>Name</th><th>Function</th><th>Status</th><th>ms</th><th>Message</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div class="footer">RunId: ' + escapeHtml_(report.runId) + ' | Mode: ' + escapeHtml_(report.mode) + ' | Started: ' + escapeHtml_(report.startedAt) + ' | Finished: ' + escapeHtml_(report.finishedAt) + '</div>' +
      '</body></html>';
  }

  function buildRunId_(date, mode) {
    var timezone = 'Etc/GMT';
    try { timezone = Session.getScriptTimeZone(); } catch (error) {}
    return 'wasb_test_' + String(mode || 'run') + '_' + Utilities.formatDate(date, timezone, 'yyyyMMdd_HHmmss') + '_' + Math.random().toString(36).slice(2, 8);
  }

  function toIso_(value) {
    if (!value) {
      return '';
    }

    try {
      var date = Object.prototype.toString.call(value) === '[object Date]' ? value : new Date(value);

      var timezone = '';
      try {
        timezone = Session.getScriptTimeZone();
      } catch (tzError) {
        timezone = '';
      }

      if (!timezone) {
        timezone = 'Europe/Kyiv';
      }

      return Utilities.formatDate(date, timezone, "yyyy-MM-dd HH:mm:ss");
    } catch (error) {
      return String(value);
    }
  }

  function safeJson_(value, maxLen) {
    var text;
    try { text = JSON.stringify(value); } catch (error) { text = String(value); }
    maxLen = maxLen || 20000;
    return text && text.length > maxLen ? text.slice(0, maxLen) + '…[truncated]' : text;
  }

  function getErrorMessage_(error) {
    if (!error) return 'Unknown error';
    if (error.message) return String(error.message);
    return String(error);
  }

  function getErrorStack_(error) {
    if (!error) return '';
    if (error.stack) return String(error.stack);
    return '';
  }

  function escapeHtml_(value) {
    return String(value === null || typeof value === 'undefined' ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function slugify_(value) {
    return String(value || '')
      .replace(/[^A-Za-z0-9_]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();
  }

  function numberGreaterThanZero_(value) {
    return typeof value === 'number' && value > 0;
  }

  function arrayHasItems_(value) {
    return Array.isArray(value) && value.length > 0;
  }

  function objectHasNonEmptyArrays_(value) {
    if (!value || typeof value !== 'object') return false;
    for (var key in value) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
      if (Array.isArray(value[key]) && value[key].length > 0) return true;
      if (value[key] && typeof value[key] === 'object' && objectHasNonEmptyArrays_(value[key])) return true;
    }
    return false;
  }

  return {
    runAll: runAll,
    runAllProjectTests: runAllProjectTests,
    runProjectTestChunk: runProjectTestChunk,
    runFast: runFast,
    runDiagnosticsOnly: runDiagnosticsOnly,
    runSmokeOnly: runSmokeOnly,
    runHealthOnly: runHealthOnly,
    runAccessOnly: runAccessOnly,
    runDomainOnly: runDomainOnly,
    listTasks: listTasks,
    showDialog: showDialog,
    addMenu: addMenu,
    installOpenTrigger: installOpenTrigger,
    resetResultsSheet: resetResultsSheet
  };
})();

function runProjectTestChunk(options) {
  return Stage7TestRunner.runProjectTestChunk(Object.assign({
    writeToSheet: true,
    writeToLogger: true,
    useLock: true,
    includeDiscovery: true,
    limit: 1,
    maxRuntimeMs: 120000
  }, options || {}));
}

function runStage7ProjectTestChunk(options) {
  return runProjectTestChunk(options || {});
}

function runAllProjectTests(options) {
  return Stage7TestRunner.runAllProjectTests(Object.assign({
    writeToSheet: true,
    writeToLogger: true,
    useLock: true,
    includeDiscovery: true
  }, options || {}));
}

function runAllTests(options) {
  return runAllProjectTests(options || {});
}

function runStage7AllProjectTests() {
  var report = runProjectTestChunk({
    writeToSheet: true,
    writeToLogger: true,
    useLock: true,
    includeDiscovery: true,
    offset: 0,
    limit: 1,
    maxRuntimeMs: 120000
  });

  return showStage7TestAlert_(report, 'WASB — перший пакет тестів проєкту');
}

function runStage7TestsAll() {
  return runStage7AllProjectTests();
}

function runStage7TestsFast() {
  var report = Stage7TestRunner.runFast({
    writeToSheet: true,
    writeToLogger: true,
    useLock: true
  });

  return showStage7TestAlert_(report, 'WASB Fast Tests');
}

function runStage7DiagnosticsOnly() {
  var report = Stage7TestRunner.runDiagnosticsOnly({
    writeToSheet: true,
    writeToLogger: true,
    useLock: true
  });

  return showStage7TestAlert_(report, 'WASB Diagnostics');
}

function runStage7SmokeOnly() {
  var report = Stage7TestRunner.runSmokeOnly({
    writeToSheet: true,
    writeToLogger: true,
    useLock: true
  });

  return showStage7TestAlert_(report, 'WASB Smoke/Regression');
}

function runStage7HealthOnly() {
  var report = Stage7TestRunner.runHealthOnly({
    writeToSheet: true,
    writeToLogger: true,
    useLock: true
  });

  return showStage7TestAlert_(report, 'WASB Health');
}

function runStage7AccessOnly() {
  var report = Stage7TestRunner.runAccessOnly({
    writeToSheet: true,
    writeToLogger: true,
    useLock: true
  });

  return showStage7TestAlert_(report, 'WASB Access');
}

function runStage7DomainOnly() {
  var report = Stage7TestRunner.runDomainOnly({
    writeToSheet: true,
    writeToLogger: true,
    useLock: true
  });

  return showStage7TestAlert_(report, 'WASB Domain');
}

function showStage7TestReport() {
  return Stage7TestRunner.showDialog();
}

function resetStage7TestResultsSheet() {
  var result = Stage7TestRunner.resetResultsSheet();

  try {
    SpreadsheetApp.getUi().alert('Лист ' + result.sheetName + ' створено або очищено.');
  } catch (error) {
    Logger.log('Лист ' + result.sheetName + ' створено або очищено.');
  }

  return result;
}

function stage7TestRunnerOnOpen() {
  return Stage7TestRunner.addMenu();
}

function installStage7TestRunner() {
  return Stage7TestRunner.installOpenTrigger();
}

function showStage7TestAlert_(report, title) {
  var text = title + '\n\n' +
    'Status: ' + (report.ok ? 'PASS' : 'FAIL') + '\n' +
    'Mode: ' + report.mode + '\n' +
    'Total: ' + report.counts.total + '\n' +
    'Passed: ' + report.counts.passed + '\n' +
    'Failed: ' + report.counts.failed + '\n' +
    'Warnings: ' + report.counts.warnings + '\n' +
    'Skipped: ' + report.counts.skipped + '\n' +
    'Discovered: ' + (report.counts.discovered || 0) + '\n' +
    'Duration: ' + report.durationMs + ' ms';

  if (report.warnings && report.warnings.length > 0) {
    text += '\n\nWarnings:\n' + report.warnings.join('\n');
  }

  try {
    SpreadsheetApp.getUi().alert(text);
  } catch (error) {
    Logger.log(text);
  }

  return report;
}

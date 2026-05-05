/**
 * Stage7TestRunner.gs — project-wide WASB test runner.
 *
 * Важливо: цей файл НЕ містить stub-реалізацій тестів.
 * Він запускає реальні test / diagnostics / check runners, які вже є у проєкті.
 */

var Stage7TestRunner = (function () {
  var VERSION = 'stage7-project-test-runner-3.1.3-compat-section-safe';
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
        Logger.log(
          'WASB TEST RUN: runId=' + report.runId +
          '; mode=' + report.mode +
          '; status=' + (report.ok ? 'OK' : 'FAIL') +
          '; passed=' + (report.counts && report.counts.passed || 0) +
          '; failed=' + (report.counts && report.counts.failed || 0) +
          '; warnings=' + (report.counts && report.counts.warnings || 0) +
          '; offset=' + (typeof report.offset === 'number' ? report.offset : '-') +
          '; nextOffset=' + (typeof report.nextOffset === 'number' ? report.nextOffset : '-') +
          '; totalTasks=' + (report.totalTasks || report.counts && report.counts.total || 0) +
          '; done=' + (report.done === true)
        );
      }

      if (report && report.done === true) normalizeTestResultsDetailsForRun_(report.runId);
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
        Logger.log(
          'WASB TEST RUN: runId=' + report.runId +
          '; mode=' + report.mode +
          '; status=' + (report.ok ? 'OK' : 'FAIL') +
          '; passed=' + (report.counts && report.counts.passed || 0) +
          '; failed=' + (report.counts && report.counts.failed || 0) +
          '; warnings=' + (report.counts && report.counts.warnings || 0) +
          '; offset=' + (typeof report.offset === 'number' ? report.offset : '-') +
          '; nextOffset=' + (typeof report.nextOffset === 'number' ? report.nextOffset : '-') +
          '; totalTasks=' + (report.totalTasks || report.counts && report.counts.total || 0) +
          '; done=' + (report.done === true)
        );
      }

      if (report && report.done === true) normalizeTestResultsDetailsForRun_(report.runId);
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

      task_('smoke-tests', 'Smoke tests: runSmokeTests', 'smoke', 'fast', 'critical', 'runSmokeTests', optArg_('smoke')),
      task_('regression-tests', 'Regression tests: runRegressionTestSuite', 'regression', 'full', 'warning', 'runRegressionTestSuite', optArg_('regression')),

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

      task_('stage5-metadata-consistency-check', 'Legacy diagnostics: runStage5MetadataConsistencyCheck_', 'diagnostics', 'full', 'warning', 'runStage5MetadataConsistencyCheck_'),
      task_('stage41-project-consistency-check', 'Legacy diagnostics: runStage41ProjectConsistencyCheck_', 'diagnostics', 'full', 'warning', 'runStage41ProjectConsistencyCheck_'),
      task_('historical-quick-diagnostics', 'Historical diagnostics: runHistoricalQuickDiagnosticsInternal_', 'diagnostics', 'full', 'warning', 'runHistoricalQuickDiagnosticsInternal_', optArg_('historicalQuick')),


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
      result.status = normalizeCompatibilityStatus_(inferStatus_(result.details, task), task);
      result.ok = result.status !== 'FAIL';
      result.skipped = result.status === 'SKIPPED';
      result.uiGroup = statusToUiGroup_(result.status, result.ok, task);
      result.message = buildTaskMessage_(result.status, result.details, task);
      result.recommendation = buildRecommendation_(result.status, result.details, task);
      result.finishedAt = toIso_(new Date());
      result.durationMs = new Date() - startedAt;

      return result;
    } catch (error) {
      result.status = normalizeCompatibilityStatus_('FAIL', task);
      result.ok = result.status !== 'FAIL';
      result.skipped = result.status === 'SKIPPED';
      result.uiGroup = statusToUiGroup_(result.status, result.ok, task);
      result.message = getErrorMessage_(error);
      result.recommendation = result.status === 'SKIPPED'
        ? 'Compatibility/legacy runner впав під час виконання; перенесено у compatibility-секцію, не блокує Stage 7 deploy.'
        : 'Відкрити ErrorStack у TEST_RESULTS і виправити функцію: ' + task.functionName;
      result.errorStack = getErrorStack_(error);
      result.finishedAt = toIso_(new Date());
      result.durationMs = new Date() - startedAt;

      return result;
    }
  }


  function logTestReportSummary_(report) {
    try {
      if (!report) {
        Logger.log('WASB TEST RUN: empty report');
        return;
      }

      var counts = report.counts || {};
      var parts = [
        'WASB TEST RUN',
        'runId=' + (report.runId || '-'),
        'mode=' + (report.mode || '-'),
        'ok=' + (report.ok === true),
        'passed=' + (counts.passed || 0),
        'failed=' + (counts.failed || 0),
        'warnings=' + (counts.warnings || 0),
        'skipped=' + (counts.skipped || 0),
        'offset=' + (typeof report.offset === 'number' ? report.offset : '-'),
        'nextOffset=' + (typeof report.nextOffset === 'number' ? report.nextOffset : '-'),
        'totalTasks=' + (report.totalTasks || counts.total || 0),
        'done=' + (report.done === true),
        'durationMs=' + (report.durationMs || 0)
      ];

      Logger.log(parts.join('; '));
    } catch (error) {
      Logger.log('WASB TEST RUN: summary log failed: ' + (error && error.message ? error.message : error));
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

  function isCompatibilityTask_(task) {
    if (!task) return false;

    var id = String(task.id || '').toLowerCase();
    var name = String(task.name || '').toLowerCase();
    var fn = String(task.functionName || '').toLowerCase();

    return id.indexOf('stage3') !== -1 ||
      id.indexOf('stage4') !== -1 ||
      id.indexOf('historical') !== -1 ||
      name.indexOf('legacy diagnostics') !== -1 ||
      name.indexOf('historical diagnostics') !== -1 ||
      fn.indexOf('stage3') !== -1 ||
      fn.indexOf('stage4') !== -1 ||
      fn.indexOf('historical') !== -1;
  }

  function normalizeCompatibilityStatus_(status, task) {
    if (status !== 'FAIL') return status;
    if (!isCompatibilityTask_(task)) return status;
    if (task && task.severity === 'critical') return status;
    return 'SKIPPED';
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
    if (status === 'SKIPPED') return isCompatibilityTask_(task) ? 'compatibility' : 'pseudo';
    if (status === 'FAIL') return 'critical';
    if (status === 'WARN') return 'warnings';
    return 'ok';
  }

  function humanizeReportValue_(value, limit) {
    limit = limit || 900;

    if (value === null || typeof value === 'undefined') return '';

    if (typeof value === 'string') {
      return compactReportText_(value, limit);
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    if (Object.prototype.toString.call(value) === '[object Date]') {
      return toIso_(value);
    }

    if (Array.isArray(value)) {
      return summarizeReportArray_(value, limit);
    }

    if (typeof value === 'object') {
      return summarizeReportObject_(value, limit);
    }

    return compactReportText_(String(value), limit);
  }

  function compactReportText_(text, limit) {
    text = String(text || '').replace(/\s+/g, ' ').trim();

    if (!text) return '';

    if (text === '[object Object]') {
      return 'Результат отримано як об’єкт; деталі доступні у TEST_RESULTS.';
    }

    if (/^https:\/\/wa\.me\//i.test(text)) {
      return 'WhatsApp-посилання сформовано коректно.';
    }

    if (/^https?:\/\//i.test(text) && text.length > 120) {
      return 'Посилання сформовано коректно.';
    }

    return text.length > limit ? text.slice(0, limit) + '…' : text;
  }

  function summarizeReportArray_(items, limit) {
    if (!items.length) return 'Список порожній.';

    var fail = 0;
    var warn = 0;
    var ok = 0;
    var pseudo = 0;
    var skipped = 0;
    var failedNames = [];

    items.forEach(function(item) {
      if (!item || typeof item !== 'object') return;

      var status = String(item.status || item.result || '').toUpperCase();
      var itemOk = item.ok === true || item.success === true || item.passed === true;

      if (
        status === 'FAIL' ||
        status === 'FAILED' ||
        status === 'ERROR' ||
        item.ok === false ||
        item.success === false ||
        item.passed === false
      ) {
        fail += 1;
        if (failedNames.length < 3) {
          failedNames.push(String(item.title || item.name || item.id || 'перевірка'));
        }
        return;
      }

      if (status === 'WARN' || status === 'WARNING') {
        warn += 1;
        return;
      }

      if (status === 'PSEUDO') {
        pseudo += 1;
        return;
      }

      if (status === 'SKIP' || status === 'SKIPPED') {
        skipped += 1;
        return;
      }

      if (itemOk || status === 'OK' || status === 'PASS') {
        ok += 1;
      }
    });

    var parts = ['усього=' + items.length];

    if (ok) parts.push('OK=' + ok);
    if (fail) parts.push('FAIL=' + fail);
    if (warn) parts.push('WARN=' + warn);
    if (pseudo) parts.push('PSEUDO=' + pseudo);
    if (skipped) parts.push('SKIP=' + skipped);

    var text = parts.join(', ');

    if (failedNames.length) {
      text += '. Проблемні: ' + failedNames.join('; ');
    }

    return compactReportText_(text, limit);
  }

  function summarizeReportObject_(obj, limit) {
    if (!obj) return '';

    if (obj.message && typeof obj.message !== 'object') {
      return compactReportText_(obj.message, limit);
    }

    if (obj.summary && typeof obj.summary !== 'object') {
      return compactReportText_(obj.summary, limit);
    }

    if (obj.error && typeof obj.error !== 'object') {
      return compactReportText_(obj.error, limit);
    }

    if (obj.details && typeof obj.details !== 'object') {
      return compactReportText_(obj.details, limit);
    }

    if (Array.isArray(obj.checks)) {
      return 'Перевірки: ' + summarizeReportArray_(obj.checks, limit);
    }

    if (Array.isArray(obj.results)) {
      return 'Результати: ' + summarizeReportArray_(obj.results, limit);
    }

    if (Array.isArray(obj.errors) && obj.errors.length) {
      return 'Помилки: ' + summarizeReportArray_(obj.errors, limit);
    }

    if (Array.isArray(obj.warnings) && obj.warnings.length) {
      return 'Попередження: ' + summarizeReportArray_(obj.warnings, limit);
    }

    if (obj.counts && typeof obj.counts === 'object') {
      var counts = obj.counts;
      var countParts = [];

      if (typeof counts.total !== 'undefined') countParts.push('усього=' + counts.total);
      if (typeof counts.passed !== 'undefined') countParts.push('passed=' + counts.passed);
      if (typeof counts.failed !== 'undefined') countParts.push('failed=' + counts.failed);
      if (typeof counts.warnings !== 'undefined') countParts.push('warnings=' + counts.warnings);
      if (typeof counts.skipped !== 'undefined') countParts.push('skipped=' + counts.skipped);

      if (countParts.length) return countParts.join(', ');
    }

    if (typeof obj.passed === 'number' || typeof obj.failed === 'number') {
      return 'passed=' + String(obj.passed || 0) + '; failed=' + String(obj.failed || 0);
    }

    if (typeof obj.ok === 'boolean') {
      return obj.ok ? 'Перевірку виконано успішно.' : 'Перевірка повернула помилку.';
    }

    if (typeof obj.success === 'boolean') {
      return obj.success ? 'Операцію виконано успішно.' : 'Операція повернула помилку.';
    }

    if (obj.url || obj.link) {
      return 'Посилання сформовано коректно.';
    }

    var keys = Object.keys(obj).filter(function(key) {
      return key !== 'raw' && key !== 'stack' && key !== 'errorStack';
    });

    if (keys.length) {
      return 'Об’єкт результату: ' + keys.slice(0, 8).join(', ') + '. Деталі доступні у TEST_RESULTS.';
    }

    return 'Результат отримано як об’єкт; деталі доступні у TEST_RESULTS.';
  }


  function normalizeTestResultsDetailsForRun_(runId) {
    try {
      if (!runId) return;

      var ss = getWasbSpreadsheet_();
      if (!ss) return;

      var sheet = ss.getSheetByName('TEST_RESULTS');
      if (!sheet) return;

      var lastRow = sheet.getLastRow();
      var lastCol = sheet.getLastColumn();

      if (lastRow < 2 || lastCol < 1) return;

      var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(value) {
        return String(value || '').trim();
      });

      var runIdCol = headers.indexOf('RunId');
      var messageCol = headers.indexOf('Message');
      var detailsCol = headers.indexOf('DetailsJson');

      if (runIdCol < 0 || detailsCol < 0) return;

      var scanLimit = 700;
      var startRow = Math.max(2, lastRow - scanLimit + 1);
      var rowCount = lastRow - startRow + 1;

      if (rowCount <= 0) return;

      var range = sheet.getRange(startRow, 1, rowCount, lastCol);
      var values = range.getValues();
      var changed = false;

      values.forEach(function(row) {
        if (String(row[runIdCol] || '') !== String(runId)) return;

        var detailsValue = row[detailsCol];
        var detailsText = detailsJsonCellToHumanText_(detailsValue);

        if (detailsText && detailsText !== String(detailsValue || '')) {
          row[detailsCol] = detailsText;
          changed = true;
        }

        if (messageCol >= 0) {
          var messageValue = row[messageCol];
          var messageText = compactReportText_(messageValue, 1200);

          if (messageText && messageText !== String(messageValue || '')) {
            row[messageCol] = messageText;
            changed = true;
          }
        }
      });

      if (changed) {
        range.setValues(values);
      }
    } catch (err) {
      // Не валимо тестовий прогін через форматування службового листа.
    }
  }

  function detailsJsonCellToHumanText_(value) {
    if (value === null || typeof value === 'undefined') return '';

    var text = String(value || '').trim();
    if (!text) return '';

    if (text === '[object Object]') {
      return 'Результат отримано як об’єкт; технічні дані приховано.';
    }

    if (/^https:\/\/wa\.me\//i.test(text)) {
      return 'WhatsApp-посилання сформовано коректно.';
    }

    if (/^https?:\/\//i.test(text) && text.length > 120) {
      return 'Посилання сформовано коректно.';
    }

    if (!/^[\{\[]/.test(text)) {
      return compactReportText_(text, 1800);
    }

    try {
      var parsed = JSON.parse(text);
      var raw = parsed && Object.prototype.hasOwnProperty.call(parsed, 'raw') ? parsed.raw : parsed;

      return detailsObjectToHumanText_(raw, 1800);
    } catch (err) {
      return compactReportText_(text, 1800);
    }
  }

  function detailsObjectToHumanText_(raw, limit) {
    limit = limit || 1800;

    if (raw === null || typeof raw === 'undefined') return '';

    if (typeof raw === 'string') {
      return compactReportText_(raw, limit);
    }

    if (typeof raw === 'number' || typeof raw === 'boolean') {
      return String(raw);
    }

    if (Array.isArray(raw)) {
      return detailsChecksToHumanText_(raw, limit);
    }

    if (typeof raw !== 'object') {
      return compactReportText_(String(raw), limit);
    }

    var title = compactReportText_(raw.name || raw.title || '', 160);

    if (raw.message && typeof raw.message !== 'object') {
      return withDetailsTitle_(title, raw.message, limit);
    }

    if (raw.summary && typeof raw.summary !== 'object') {
      return withDetailsTitle_(title, raw.summary, limit);
    }

    if (raw.error && typeof raw.error !== 'object') {
      return withDetailsTitle_(title, raw.error, limit);
    }

    if (raw.details && typeof raw.details !== 'object') {
      return withDetailsTitle_(title, raw.details, limit);
    }

    if (Array.isArray(raw.checks)) {
      return withDetailsTitle_(title, detailsChecksToHumanText_(raw.checks, limit), limit);
    }

    if (Array.isArray(raw.results)) {
      return withDetailsTitle_(title, detailsChecksToHumanText_(raw.results, limit), limit);
    }

    if (Array.isArray(raw.errors) && raw.errors.length) {
      return withDetailsTitle_(title, 'Помилки: ' + detailsChecksToHumanText_(raw.errors, limit), limit);
    }

    if (Array.isArray(raw.warnings) && raw.warnings.length) {
      return withDetailsTitle_(title, 'Попередження: ' + detailsChecksToHumanText_(raw.warnings, limit), limit);
    }

    if (raw.counts && typeof raw.counts === 'object') {
      var countParts = [];

      if (typeof raw.counts.total !== 'undefined') countParts.push('усього=' + raw.counts.total);
      if (typeof raw.counts.ok !== 'undefined') countParts.push('OK=' + raw.counts.ok);
      if (typeof raw.counts.passed !== 'undefined') countParts.push('PASS=' + raw.counts.passed);
      if (typeof raw.counts.failed !== 'undefined') countParts.push('FAIL=' + raw.counts.failed);
      if (typeof raw.counts.warnings !== 'undefined') countParts.push('WARN=' + raw.counts.warnings);
      if (typeof raw.counts.skipped !== 'undefined') countParts.push('SKIP=' + raw.counts.skipped);
      if (typeof raw.counts.pseudo !== 'undefined') countParts.push('PSEUDO=' + raw.counts.pseudo);

      if (countParts.length) {
        return withDetailsTitle_(title, 'Підсумок: ' + countParts.join(', '), limit);
      }
    }

    if (typeof raw.ok === 'boolean') {
      return withDetailsTitle_(title, raw.ok ? 'Перевірку виконано успішно.' : 'Перевірка повернула помилку.', limit);
    }

    if (typeof raw.success === 'boolean') {
      return withDetailsTitle_(title, raw.success ? 'Операцію виконано успішно.' : 'Операція повернула помилку.', limit);
    }

    if (raw.url || raw.link) {
      return withDetailsTitle_(title, 'Посилання сформовано коректно.', limit);
    }

    var keys = Object.keys(raw).filter(function(key) {
      return key !== 'raw' && key !== 'stack' && key !== 'errorStack';
    });

    if (keys.length) {
      return withDetailsTitle_(title, 'Поля результату: ' + keys.slice(0, 12).join(', ') + '.', limit);
    }

    return title || 'Результат отримано; технічні дані приховано.';
  }

  function detailsChecksToHumanText_(items, limit) {
    limit = limit || 1800;

    if (!items || !items.length) return 'Список порожній.';

    var ok = 0;
    var fail = 0;
    var warn = 0;
    var pseudo = 0;
    var skip = 0;

    var important = [];
    var normal = [];

    items.forEach(function(item) {
      if (!item || typeof item !== 'object') return;

      var status = String(item.status || item.result || '').toUpperCase();
      var itemOk = item.ok === true || item.success === true || item.passed === true;

      if (
        status === 'FAIL' ||
        status === 'FAILED' ||
        status === 'ERROR' ||
        item.ok === false ||
        item.success === false ||
        item.passed === false
      ) {
        fail += 1;
        important.push(formatOneCheckLine_(item, 'FAIL'));
        return;
      }

      if (status === 'WARN' || status === 'WARNING') {
        warn += 1;
        important.push(formatOneCheckLine_(item, 'WARN'));
        return;
      }

      if (status === 'PSEUDO') {
        pseudo += 1;
        normal.push(formatOneCheckLine_(item, 'PSEUDO'));
        return;
      }

      if (status === 'SKIP' || status === 'SKIPPED') {
        skip += 1;
        normal.push(formatOneCheckLine_(item, 'SKIP'));
        return;
      }

      if (itemOk || status === 'OK' || status === 'PASS') {
        ok += 1;
        normal.push(formatOneCheckLine_(item, 'OK'));
        return;
      }

      normal.push(formatOneCheckLine_(item, status || 'INFO'));
    });

    var parts = ['усього=' + items.length];

    if (ok) parts.push('OK=' + ok);
    if (fail) parts.push('FAIL=' + fail);
    if (warn) parts.push('WARN=' + warn);
    if (pseudo) parts.push('PSEUDO=' + pseudo);
    if (skip) parts.push('SKIP=' + skip);

    var selected = important.concat(normal).filter(Boolean).slice(0, 8);
    var text = 'Перевірки: ' + parts.join(', ') + '.';

    if (selected.length) {
      text += ' Деталі: ' + selected.join('; ');
    }

    if (items.length > selected.length) {
      text += '; ще ' + (items.length - selected.length) + ' перевірок приховано.';
    }

    return compactReportText_(text, limit);
  }

  function formatOneCheckLine_(item, fallbackStatus) {
    var status = String(item.status || item.result || fallbackStatus || 'INFO').toUpperCase();
    var name = item.title || item.name || item.id || 'перевірка';
    var details = item.details || item.message || item.howTo || item.recommendation || '';

    var icon = status === 'OK' || status === 'PASS'
      ? 'OK'
      : status === 'FAIL' || status === 'FAILED' || status === 'ERROR'
        ? 'FAIL'
        : status;

    var line = icon + ': ' + name;

    if (details && typeof details !== 'object') {
      line += ' — ' + details;
    }

    return compactReportText_(line, 260);
  }

  function withDetailsTitle_(title, body, limit) {
    body = compactReportText_(body, limit || 1800);
    if (!title) return body;
    return compactReportText_(title + ': ' + body, limit || 1800);
  }



  function buildHumanTaskMessageFromRaw_(raw, limit) {
    limit = limit || 360;

    function safeString_(value) {
      if (value === null || typeof value === 'undefined') return '';
      try {
        return String(value);
      } catch (error) {
        return '';
      }
    }

    function compact_(text) {
      text = safeString_(text).replace(/\s+/g, ' ').trim();
      if (!text) return '';
      return text.length > limit ? text.slice(0, limit) + '…' : text;
    }

    function countByStatus_(items) {
      var out = { total: 0, ok: 0, fail: 0, warn: 0, skip: 0, pseudo: 0 };

      if (!Array.isArray(items)) return out;

      out.total = items.length;

      for (var i = 0; i < items.length; i++) {
        var item = items[i] || {};
        var status = safeString_(item.status || item.result || '').toUpperCase();

        if (item.pseudo === true || status === 'PSEUDO') {
          out.pseudo++;
        } else if (status === 'OK' || status === 'PASS' || item.ok === true || item.success === true) {
          out.ok++;
        } else if (status === 'FAIL' || status === 'FAILED' || status === 'ERROR' || item.ok === false || item.success === false) {
          out.fail++;
        } else if (status === 'WARN' || status === 'WARNING') {
          out.warn++;
        } else if (status === 'SKIP' || status === 'SKIPPED') {
          out.skip++;
        } else {
          out.ok++;
        }
      }

      return out;
    }

    function countArray_(value) {
      return Array.isArray(value) ? value.length : 0;
    }

    if (raw === null || typeof raw === 'undefined') {
      return 'Перевірку виконано успішно.';
    }

    if (typeof raw === 'string') {
      if (/^https:\/\/wa\.me\//i.test(raw)) {
        return 'WhatsApp-посилання сформовано коректно.';
      }
      return compact_(raw);
    }

    if (typeof raw === 'number' || typeof raw === 'boolean') {
      return safeString_(raw);
    }

    if (Array.isArray(raw)) {
      var arrCounts = countByStatus_(raw);
      return compact_(
        'Перевірки: усього=' + arrCounts.total +
        ', OK=' + arrCounts.ok +
        ', FAIL=' + arrCounts.fail +
        ', WARN=' + arrCounts.warn +
        ', SKIP=' + arrCounts.skip
      );
    }

    if (typeof raw !== 'object') {
      return compact_(raw);
    }

    if (raw.summary && typeof raw.summary === 'object') {
      var summary = raw.summary;
      var parts = [];

      if (typeof summary.total !== 'undefined') parts.push('усього=' + summary.total);
      if (typeof summary.ok !== 'undefined') parts.push('OK=' + summary.ok);
      if (typeof summary.passed !== 'undefined') parts.push('PASS=' + summary.passed);
      if (typeof summary.fail !== 'undefined') parts.push('FAIL=' + summary.fail);
      if (typeof summary.failed !== 'undefined') parts.push('FAIL=' + summary.failed);
      if (typeof summary.warnings !== 'undefined') parts.push('WARN=' + summary.warnings);
      if (typeof summary.warning !== 'undefined') parts.push('WARN=' + summary.warning);
      if (typeof summary.skip !== 'undefined') parts.push('SKIP=' + summary.skip);
      if (typeof summary.skipped !== 'undefined') parts.push('SKIP=' + summary.skipped);
      if (typeof summary.blocked !== 'undefined') parts.push('BLOCKED=' + summary.blocked);

      if (parts.length) {
        return compact_('Перевірки: ' + parts.join(', '));
      }
    }

    if (Array.isArray(raw.checks)) {
      var checkCounts = countByStatus_(raw.checks);
      return compact_(
        'Перевірки: усього=' + checkCounts.total +
        ', OK=' + checkCounts.ok +
        ', FAIL=' + checkCounts.fail +
        ', WARN=' + checkCounts.warn +
        ', SKIP=' + checkCounts.skip
      );
    }

    if (Array.isArray(raw.results)) {
      var resultCounts = countByStatus_(raw.results);
      return compact_(
        'Результати: усього=' + resultCounts.total +
        ', OK=' + resultCounts.ok +
        ', FAIL=' + resultCounts.fail +
        ', WARN=' + resultCounts.warn +
        ', SKIP=' + resultCounts.skip
      );
    }

    if (Array.isArray(raw.passed) || Array.isArray(raw.failed)) {
      return compact_(
        'Тести: passed=' + countArray_(raw.passed) +
        '; failed=' + countArray_(raw.failed)
      );
    }

    if (raw.schema && raw.dataIntegrity && raw.policy && raw.runtime) {
      var schema = raw.schema || {};
      var data = raw.dataIntegrity || {};
      var policy = raw.policy || {};
      var runtime = raw.runtime || {};

      return compact_(
        'ACCESS diagnostics: schema=' + (schema.exists ? 'є' : 'немає') +
        '; headers=' + (schema.headersPresent ? 'OK' : 'FAIL') +
        '; duplicateEmails=' + countArray_(data.duplicateEmails) +
        '; duplicateCurrentKeys=' + countArray_(data.duplicateCurrentKeys) +
        '; duplicatePrevKeys=' + countArray_(data.duplicatePrevKeys) +
        '; emptyIdentifierRows=' + (Array.isArray(data.emptyIdentifierWithActiveRole) && data.emptyIdentifierWithActiveRole.length ? data.emptyIdentifierWithActiveRole.join(', ') : 'немає') +
        '; strictUserKeyMode=' + !!policy.strictUserKeyMode +
        '; registeredKeys=' + (runtime.registeredKeysCount || 0)
      );
    }

    if (
      Object.prototype.hasOwnProperty.call(raw, 'describe') ||
      Object.prototype.hasOwnProperty.call(raw, 'bootstrapSheet') ||
      Object.prototype.hasOwnProperty.call(raw, 'validate') ||
      Object.prototype.hasOwnProperty.call(raw, 'diagnostics') ||
      Object.prototype.hasOwnProperty.call(raw, 'allPassed')
    ) {
      return compact_(
        'ACCESS smoke: allPassed=' + !!raw.allPassed +
        (raw.error ? '; error=' + safeString_(raw.error) : '')
      );
    }

    if (
      Object.prototype.hasOwnProperty.call(raw, 'raportReminders') ||
      Object.prototype.hasOwnProperty.call(raw, 'soldierMessages') ||
      Object.prototype.hasOwnProperty.call(raw, 'commanderMessages')
    ) {
      return compact_(
        'Vacation engine: raportReminders=' + countArray_(raw.raportReminders) +
        '; soldierMessages=' + countArray_(raw.soldierMessages) +
        '; commanderMessages=' + countArray_(raw.commanderMessages)
      );
    }

    if (raw.message && typeof raw.message !== 'object') {
      return compact_(raw.message);
    }

    if (raw.details && typeof raw.details !== 'object') {
      return compact_(raw.details);
    }

    if (raw.url || raw.link) {
      return 'Посилання сформовано коректно.';
    }

    var keys = Object.keys(raw || {}).filter(function (key) {
      return key !== 'raw' && key !== 'stack' && key !== 'errorStack';
    });

    if (keys.length) {
      return compact_('Результат містить поля: ' + keys.slice(0, 10).join(', ') + '.');
    }

    return 'Перевірку виконано успішно.';
  }

  function buildTaskMessage_(status, details, task) {
    var raw = details ? details.raw : null;
    var text = buildHumanTaskMessageFromRaw_(raw, 360);

    if (status === 'FAIL') {
      if (text) return text;
      return 'Перевірка завершилась помилкою: ' + (task && task.functionName ? task.functionName : 'невідома функція');
    }

    if (status === 'WARN') {
      if (text) return text;
      return 'Перевірка завершилась з попередженням.';
    }

    if (status === 'SKIPPED') {
      if (isCompatibilityTask_(task)) {
        return text
          ? ('Compatibility-only: ' + text)
          : 'Compatibility-only legacy/historical runner не блокує Stage 7.';
      }
      if (text) return text;
      return 'Перевірку пропущено.';
    }

    return text || 'Перевірку виконано успішно.';
  }

  function buildRecommendation_(status, details, task) {
    var raw = details ? details.raw : null;

    if (raw && typeof raw === 'object') {
      if (raw.recommendation) return humanizeReportValue_(raw.recommendation, 700);
      if (raw.howTo) return humanizeReportValue_(raw.howTo, 700);
      if (raw.reason) return humanizeReportValue_(raw.reason, 700);
      if (raw.blocked === true) return 'Запустити у safe test mode або перевірити права доступу/роль користувача.';
    }

    if (status === 'FAIL') return 'Дивись details/errorStack у TEST_RESULTS для функції ' + task.functionName + '.';
    if (status === 'WARN') return 'Перевірити попередження та виправити, якщо воно стосується активних Stage 7 / ACCESS / runtime перевірок.';
    if (status === 'SKIPPED' && isCompatibilityTask_(task)) return 'Legacy/historical compatibility. Не блокує Stage 7 deploy; тримати як довідковий технічний борг або запускати окремо.';
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
      var ss = getWasbSpreadsheet_();
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
    var ss = getWasbSpreadsheet_();
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

    if (report && report.done === true) normalizeTestResultsDetailsForRun_(report.runId);
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
        .forSpreadsheet(getWasbSpreadsheet_())
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
    maxLen = maxLen || 1800;

    try {
      var v = value;

      if (
        v &&
        typeof v === 'object' &&
        Object.prototype.hasOwnProperty.call(v, 'type') &&
        Object.prototype.hasOwnProperty.call(v, 'raw')
      ) {
        v = v.raw;
      }

      var text = '';

      if (typeof detailsObjectToHumanText_ === 'function') {
        text = detailsObjectToHumanText_(v, maxLen);
      } else if (typeof humanizeReportValue_ === 'function') {
        text = humanizeReportValue_(v, maxLen);
      } else if (v === null || typeof v === 'undefined') {
        text = '';
      } else if (typeof v === 'string') {
        text = v;
      } else if (typeof v === 'number' || typeof v === 'boolean') {
        text = String(v);
      } else if (Array.isArray(v)) {
        text = 'Перевірки: усього=' + v.length;
      } else if (typeof v === 'object') {
        if (v.message && typeof v.message !== 'object') {
          text = String(v.message);
        } else if (v.summary && typeof v.summary !== 'object') {
          text = String(v.summary);
        } else if (v.details && typeof v.details !== 'object') {
          text = String(v.details);
        } else if (Array.isArray(v.checks)) {
          text = 'Перевірки: усього=' + v.checks.length;
        } else if (Array.isArray(v.results)) {
          text = 'Результати: усього=' + v.results.length;
        } else if (v.url || v.link) {
          text = 'Посилання сформовано коректно.';
        } else {
          text = 'Результат отримано як об’єкт; технічні дані приховано.';
        }
      } else {
        text = String(v);
      }

      text = String(text || '').replace(/\s+/g, ' ').trim();

      if (!text) return '';

      if (/^https:\/\/wa\.me\//i.test(text)) {
        return 'WhatsApp-посилання сформовано коректно.';
      }

      if (/^https?:\/\//i.test(text) && text.length > 120) {
        return 'Посилання сформовано коректно.';
      }

      return text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
    } catch (error) {
      return 'Не вдалося перетворити технічні деталі у текст: ' + String(error && error.message ? error.message : error);
    }
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
  var startedAt = new Date();
  var tz = (typeof Session !== 'undefined' && Session.getScriptTimeZone) ? Session.getScriptTimeZone() : 'Etc/GMT';
  var runId = 'wasb_ui_project_tests_' + Utilities.formatDate(startedAt, tz, 'yyyyMMdd_HHmmss') + '_' + Math.random().toString(36).slice(2, 8);
  var offset = 0;
  var totalTasks = null;
  var done = false;
  var chunks = 0;
  var lastReport = null;
  var hardStopMs = 315000;
  var allResults = [];
  var allWarnings = [];

  while (!done) {
    if (new Date().getTime() - startedAt.getTime() > hardStopMs) {
      allWarnings.push('Пакетний запуск зупинено перед системним timeout. Продовжити можна через runStage7ProjectTestChunk з offset=' + offset + ' і runId=' + runId + '.');
      break;
    }

    lastReport = runProjectTestChunk({
      writeToSheet: true,
      writeToLogger: true,
      useLock: true,
      includeDiscovery: true,
      runId: runId,
      offset: offset,
      limit: 1,
      maxRuntimeMs: 120000
    });

    chunks++;

    if (!lastReport) {
      allWarnings.push('Пакетний запуск зупинено: пакет не повернув звіт.');
      break;
    }

    if (lastReport.ok === false && lastReport.mode === 'lock-failed') {
      allWarnings.push('Пакетний запуск зупинено: не вдалося отримати lock.');
      break;
    }

    if (lastReport.results && lastReport.results.length) {
      allResults = allResults.concat(lastReport.results);
    }
    if (lastReport.warnings && lastReport.warnings.length) {
      allWarnings = allWarnings.concat(lastReport.warnings);
    }

    totalTasks = lastReport.totalTasks || totalTasks || 0;
    offset = typeof lastReport.nextOffset === 'number' ? lastReport.nextOffset : offset + 1;
    done = lastReport.done === true || (totalTasks && offset >= totalTasks);

    if (!lastReport.results || !lastReport.results.length) {
      allWarnings.push('Пакетний запуск зупинено: пакет не повернув результатів, offset=' + offset + '.');
      break;
    }
  }

  var finalReport = {
    ok: true,
    version: lastReport && lastReport.version || 'stage7-project-test-runner',
    mode: 'project-chunk-all',
    runId: runId,
    ts: lastReport && lastReport.ts || new Date().toISOString(),
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    durationMs: new Date().getTime() - startedAt.getTime(),
    environment: lastReport && lastReport.environment || {},
    offset: 0,
    limit: chunks,
    nextOffset: offset,
    totalTasks: totalTasks || allResults.length,
    done: done,
    progressPct: totalTasks ? Math.round((offset / totalTasks) * 100) : 100,
    counts: { total: 0, passed: 0, failed: 0, skipped: 0, warnings: 0, discovered: 0 },
    checks: [],
    results: allResults,
    warnings: allWarnings
  };

  for (var i = 0; i < allResults.length; i++) {
    finalReport.counts.total++;
    var status = String(allResults[i].status || '').toUpperCase();
    if (status === 'PASS') finalReport.counts.passed++;
    else if (status === 'FAIL') finalReport.counts.failed++;
    else if (status === 'WARN') finalReport.counts.warnings++;
    else if (status === 'SKIPPED') finalReport.counts.skipped++;
    else if (status === 'DISCOVERED') finalReport.counts.discovered++;
  }

  finalReport.ok = finalReport.counts.failed === 0;

  return showStage7TestAlert_(finalReport, done ? 'WASB — повний пакетний запуск тестів завершено' : 'WASB — пакетний запуск тестів зупинено');
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


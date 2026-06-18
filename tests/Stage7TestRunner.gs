/**
 * Stage7TestRunner.gs — orchestration core (suites, tasks, discovery, registry).
 * Reporting / sheet / UI / public API: Stage7TestRunner.{Reporting,Sheet,Ui,Api}.gs
 */

var Stage7TestRunner = (function () {
  var DEFAULT_TIMEOUT_MS = 330000;
  var DEFAULT_RESULT_SHEET_NAME = "TEST_RESULTS";
  var DEFAULT_LOCK_WAIT_MS = 60000;

  var ctx = {
    VERSION: "stage7-project-test-runner-3.2.0-modular",
    DEFAULT_TIMEOUT_MS: DEFAULT_TIMEOUT_MS,
    DEFAULT_RESULT_SHEET_NAME: DEFAULT_RESULT_SHEET_NAME,
    DEFAULT_LOCK_WAIT_MS: DEFAULT_LOCK_WAIT_MS,
  };

  stage7TestRunnerAttachHelpers_(ctx);
  stage7TestRunnerAttachReporting_(ctx);
  stage7TestRunnerAttachSheet_(ctx);


  function runAll(options) {
    return runSuite_("all", options);
  }

  function runAllProjectTests(options) {
    return runSuite_(
      "all",
      Object.assign({}, options || {}, { includeDiscovery: true }),
    );
  }

  /**
   * Runs a small slice of the whole project test registry.
   * This is the safe path for sidebar/UI: several short GAS executions instead of one execution that hits the 6-minute limit.
   */
  function runProjectTestChunk(options) {
    var rawOptions = options || {};
    var opts = normalizeOptions_(
      Object.assign({}, rawOptions, {
        includeDiscovery: rawOptions.includeDiscovery !== false,
      }),
    );
    var mode = rawOptions.mode || rawOptions.chunkMode || "project-chunk";
    var offset = Math.max(0, parseInt(rawOptions.offset || 0, 10) || 0);
    var limit = Math.max(
      1,
      Math.min(10, parseInt(rawOptions.limit || 1, 10) || 1),
    );
    var maxRuntimeMs = Math.max(
      30000,
      Math.min(
        240000,
        parseInt(rawOptions.maxRuntimeMs || 120000, 10) || 120000,
      ),
    );
    var startedAt = new Date();
    var runId = rawOptions.runId || ctx.buildRunId_(startedAt, "project-chunk");
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
      var allTasks = filterTasksByMode_(buildTasks_(opts), "all");
      var report = {
        ok: true,
        version: ctx.VERSION,
        mode: mode,
        runId: runId,
        ts: ctx.toIso_(startedAt),
        startedAt: ctx.toIso_(startedAt),
        finishedAt: null,
        durationMs: 0,
        environment: ctx.collectEnvironment_(),
        offset: offset,
        limit: limit,
        nextOffset: offset,
        totalTasks: allTasks.length,
        done: false,
        progressPct: 0,
        counts: {
          total: 0,
          passed: 0,
          failed: 0,
          skipped: 0,
          warnings: 0,
          discovered: 0,
        },
        checks: [],
        results: [],
        warnings: [],
      };

      var index = offset;
      while (index < allTasks.length && report.results.length < limit) {
        if (ctx.isTimeoutReached_(startedAt, maxRuntimeMs)) {
          report.warnings.push(
            "Пакет зупинено до системного timeout. Наступний пакет продовжить з offset=" +
              index +
              ".",
          );
          break;
        }

        var task = allTasks[index];
        report.results.push(runTask_(task));
        index++;

        if (
          opts.failFast &&
          report.results[report.results.length - 1].status === "FAIL"
        ) {
          report.warnings.push("Пакет зупинено через failFast.");
          break;
        }
      }

      report.nextOffset = index;
      report.done = index >= allTasks.length;
      report.progressPct = allTasks.length
        ? Math.round((index / allTasks.length) * 100)
        : 100;
      ctx.finalizeReport_(report, startedAt);

      if (opts.writeToSheet) {
        try {
          ctx.writeReportToSheet_(report, opts.sheetName);
        } catch (sheetError) {
          report.warnings.push(
            "Не вдалося записати пакетний звіт у лист: " +
              ctx.getErrorMessage_(sheetError),
          );
        }
      }

      if (opts.writeToLogger) {
        logTestReportSummary_(report);
      }

      if (report && report.done === true)
        ctx.normalizeTestResultsDetailsForRun_(report.runId);
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
    return runSuite_("fast", options);
  }

  function runDiagnosticsOnly(options) {
    return runSuite_("diagnostics", options);
  }

  function runSmokeOnly(options) {
    return runSuite_("smoke", options);
  }

  function runHealthOnly(options) {
    return runSuite_("health", options);
  }

  function runAccessOnly(options) {
    return runSuite_("access", options);
  }

  function runDomainOnly(options) {
    return runSuite_("domain", options);
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
        discovered: task.discovered === true,
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
      var runId = ctx.buildRunId_(startedAt, mode);
      var tasks = filterTasksByMode_(buildTasks_(opts), mode);

      var report = {
        ok: true,
        version: ctx.VERSION,
        mode: mode,
        runId: runId,
        ts: ctx.toIso_(startedAt),
        startedAt: ctx.toIso_(startedAt),
        finishedAt: null,
        durationMs: 0,
        environment: ctx.collectEnvironment_(),
        counts: {
          total: 0,
          passed: 0,
          failed: 0,
          skipped: 0,
          warnings: 0,
          discovered: 0,
        },
        checks: [],
        results: [],
        warnings: [],
      };

      for (var i = 0; i < tasks.length; i++) {
        var task = tasks[i];

        if (ctx.isTimeoutReached_(startedAt, opts.timeoutMs)) {
          report.results.push(
            ctx.makeSkippedResult_(
              task,
              "Пропущено через обмеження часу виконання Google Apps Script.",
            ),
          );
          continue;
        }

        var result = runTask_(task);
        report.results.push(result);

        if (opts.failFast && result.status === "FAIL") {
          break;
        }
      }

      ctx.finalizeReport_(report, startedAt);

      if (opts.writeToSheet) {
        try {
          ctx.writeReportToSheet_(report, opts.sheetName);
        } catch (sheetError) {
          report.warnings.push(
            "Не вдалося записати звіт у лист: " + ctx.getErrorMessage_(sheetError),
          );
        }
      }

      if (opts.writeToLogger) {
        logTestReportSummary_(report);
      }

      if (report && report.done === true)
        ctx.normalizeTestResultsDetailsForRun_(report.runId);
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
      if (
        typeof options !== "undefined" &&
        options &&
        options.discover === true
      ) {
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
      discovered: false,
    };
  }

  function optArg_(mode) {
    return [
      {
        source: "Stage7TestRunner",
        runnerVersion: ctx.VERSION,
        mode: mode || "project-all",
        dryRun: true,
        safeTestEnvironment: true,
        forceRun: true,
      },
    ];
  }

  function buildRegisteredTasks_() {
    return []
      .concat(stage7TestRunnerBuildSendPanelTasks_(task_, optArg_))
      .concat(stage7TestRunnerBuildMaintenanceTasks_(task_, optArg_))
      .concat(stage7TestRunnerBuildAccessTasks_(task_, optArg_))
      .concat(stage7TestRunnerBuildSummariesTasks_(task_, optArg_));
  }

  function discoverProjectTestTasks_(knownFunctions) {
    var globalObject = ctx.getGlobalObject_();
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
        id: "discovered-" + slugify_(name),
        name: "Discovered test runner: " + name,
        group: "discovered",
        level: "full",
        severity: "warning",
        functionName: name,
        args: optArg_("discovered"),
        discovered: true,
      });
    });

    return tasks;
  }

  function shouldDiscoverFunction_(name, value) {
    if (typeof value !== "function") return false;

    var n = String(name || "");
    if (!n) return false;
    if (n.charAt(0) === "_") return false;
    if (isRunnerOwnFunction_(n)) return false;
    if (isDangerousOrOperationalName_(n)) return false;

    if (/^api/i.test(n)) return false;

    var looksLikeRunner =
      /^(run|test|smokeTest)[A-Z0-9_]/.test(n) || n === "healthCheck";
    var hasTestToken =
      /(Test|Tests|Diagnostics|Check|Health|PolicyChecks)/.test(n) ||
      n === "healthCheck";

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
      installStage7TestRunner: true,
    };
    return own[name] === true;
  }

  function isDangerousOrOperationalName_(name) {
    var n = String(name || "").toLowerCase();
    var denied = [
      "clear",
      "cleanup",
      "delete",
      "remove",
      "reset",
      "install",
      "setup",
      "create",
      "switch",
      "send",
      "mark",
      "apply",
      "protect",
      "repair",
      "trigger",
      "notify",
      "auto",
      "bootstrap",
      "write",
      "sync",
      "migrate",
      "rotate",
    ];

    for (var i = 0; i < denied.length; i++) {
      if (n.indexOf(denied[i]) !== -1) return true;
    }

    return false;
  }

  function filterTasksByMode_(tasks, mode) {
    if (mode === "all" || mode === "project" || mode === "project-all")
      return tasks;

    if (mode === "fast") {
      return tasks.filter(function (task) {
        return task.level === "fast";
      });
    }

    if (mode === "diagnostics") {
      return tasks.filter(function (task) {
        return task.group === "diagnostics" || task.group === "health";
      });
    }

    if (mode === "smoke") {
      return tasks.filter(function (task) {
        return task.group === "smoke" || task.group === "regression";
      });
    }

    if (mode === "health") {
      return tasks.filter(function (task) {
        return task.group === "health";
      });
    }

    if (mode === "access") {
      return tasks.filter(function (task) {
        return task.group === "access";
      });
    }

    if (mode === "domain") {
      return tasks.filter(function (task) {
        return task.group === "domain";
      });
    }

    return tasks;
  }

  function runTask_(task) {
    var startedAt = new Date();
    var result = {
      id: task.id,
      name: task.name,
      title: task.name,
      group: task.group,
      uiGroup: "",
      level: task.level,
      severity: task.severity,
      functionName: task.functionName,
      discovered: task.discovered === true,
      status: "UNKNOWN",
      ok: false,
      skipped: false,
      startedAt: ctx.toIso_(startedAt),
      finishedAt: null,
      durationMs: 0,
      message: "",
      details: null,
      recommendation: "",
      errorStack: "",
    };

    try {
      var fn = stage7TestRunnerResolveFunction_(ctx, task.functionName);

      if (!fn) {
        result.status = "FAIL";
        result.ok = false;
        result.skipped = false;
        result.uiGroup = "critical";
        result.message = "Функцію не знайдено: " + task.functionName;
        result.recommendation =
          "Додайте функцію до проєкту або оновіть test task на canonical API.";
        result.finishedAt = ctx.toIso_(new Date());
        result.durationMs = new Date() - startedAt;
        return result;
      }

      var args = Array.isArray(task.args) ? task.args : optArg_(task.id);
      var value = fn.apply(null, args);
      result.details = ctx.normalizeTaskReturn_(value);
      result.status = ctx.normalizeCompatibilityStatus_(
        ctx.inferStatus_(result.details, task),
        task,
      );
      result.ok = result.status !== "FAIL";
      result.skipped = result.status === "SKIPPED";
      result.uiGroup = ctx.statusToUiGroup_(result.status, result.ok, task);
      result.message = ctx.buildTaskMessage_(result.status, result.details, task);
      result.recommendation = ctx.buildRecommendation_(
        result.status,
        result.details,
        task,
      );
      result.finishedAt = ctx.toIso_(new Date());
      result.durationMs = new Date() - startedAt;

      return result;
    } catch (error) {
      result.status = ctx.normalizeCompatibilityStatus_("FAIL", task);
      result.ok = result.status !== "FAIL";
      result.skipped = result.status === "SKIPPED";
      result.uiGroup = ctx.statusToUiGroup_(result.status, result.ok, task);
      result.message = ctx.getErrorMessage_(error);
        result.recommendation =
        "Відкрити ErrorStack у TEST_RESULTS і виправити функцію: " +
            task.functionName;
      result.errorStack = ctx.getErrorStack_(error);
      result.finishedAt = ctx.toIso_(new Date());
      result.durationMs = new Date() - startedAt;

      return result;
    }
  }

  function logTestReportSummary_(report) {
    try {
      if (!report) {
        Logger.log("WASB TEST RUN: empty report");
        return;
      }

      var counts = report.counts || {};
      var parts = [
        "WASB TEST RUN",
        "runId=" + (report.runId || "-"),
        "mode=" + (report.mode || "-"),
        "ok=" + (report.ok === true),
        "passed=" + (counts.passed || 0),
        "failed=" + (counts.failed || 0),
        "warnings=" + (counts.warnings || 0),
        "skipped=" + (counts.skipped || 0),
        "offset=" + (typeof report.offset === "number" ? report.offset : "-"),
        "nextOffset=" +
          (typeof report.nextOffset === "number" ? report.nextOffset : "-"),
        "totalTasks=" + (report.totalTasks || counts.total || 0),
        "done=" + (report.done === true),
        "durationMs=" + (report.durationMs || 0),
      ];

      Logger.log(parts.join("; "));
    } catch (error) {
      Logger.log(
        "WASB TEST RUN: summary log failed: " +
          (error && error.message ? error.message : error),
      );
    }
  }
  function normalizeOptions_(options) {
    options = options || {};
    return {
      timeoutMs:
        typeof options.timeoutMs === "number"
          ? options.timeoutMs
          : DEFAULT_TIMEOUT_MS,
      lockWaitMs:
        typeof options.lockWaitMs === "number"
          ? options.lockWaitMs
          : DEFAULT_LOCK_WAIT_MS,
      writeToSheet: options.writeToSheet !== false,
      writeToLogger: options.writeToLogger !== false,
      useLock: options.useLock !== false,
      failFast: options.failFast === true,
      dryRun: options.dryRun !== false,
      includeDiscovery: options.includeDiscovery !== false,
      sheetName: options.sheetName || DEFAULT_RESULT_SHEET_NAME,
    };
  }

  function buildLockFailedReport_(mode) {
    var now = new Date();
    var result = {
      id: "runner-lock",
      name: "Stage7TestRunner document lock",
      title: "Stage7TestRunner document lock",
      group: "system",
      uiGroup: "critical",
      level: "system",
      severity: "critical",
      functionName: "",
      discovered: false,
      status: "FAIL",
      ok: false,
      skipped: false,
      startedAt: ctx.toIso_(now),
      finishedAt: ctx.toIso_(now),
      durationMs: 0,
      message:
        "Не вдалося отримати document lock. Ймовірно, інший запуск тестів ще виконується.",
      details: null,
      recommendation:
        "Дочекатися завершення попереднього запуску або перевірити завислі executions.",
      errorStack: "",
    };

    return {
      ok: false,
      version: ctx.VERSION,
      mode: mode,
      runId: ctx.buildRunId_(now, mode),
      ts: ctx.toIso_(now),
      startedAt: ctx.toIso_(now),
      finishedAt: ctx.toIso_(now),
      durationMs: 0,
      environment: ctx.collectEnvironment_(),
      counts: {
        total: 1,
        passed: 0,
        failed: 1,
        skipped: 0,
        warnings: 0,
        discovered: 0,
      },
      checks: [ctx.resultToCheck_(result)],
      results: [result],
      warnings: ["Запуск заблоковано document lock."],
    };
  }

  // isTimeoutReached_ lives on ctx via stage7TestRunnerAttachHelpers_ (Helpers.gs).

  ctx.runFast = runFast;
  ctx.runSuite_ = runSuite_;
  stage7TestRunnerAttachUi_(ctx);

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
    showDialog: ctx.showDialog,
    addMenu: ctx.addMenu,
    installOpenTrigger: ctx.installOpenTrigger,
    resetResultsSheet: ctx.resetResultsSheet,
  };
})();

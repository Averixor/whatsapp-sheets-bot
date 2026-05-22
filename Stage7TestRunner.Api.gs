/**
 * Stage7TestRunner.Api.gs — global entrypoints for menus, triggers, and UI alerts.
 */

var STAGE7_TEST_RUNNER_MIN_ROLE_ = "admin";

function _stage7TestRunnerCanUseUi_() {
  try {
    if (
      typeof AccessControl_ !== "object" ||
      !AccessControl_ ||
      typeof AccessControl_.describe !== "function"
    ) {
      return false;
    }
    var descriptor = AccessControl_.describe();
    var order =
      AccessControl_.ROLE_ORDER ||
      Object.freeze({
        guest: 0,
        viewer: 1,
        operator: 2,
        maintainer: 3,
        admin: 4,
        sysadmin: 5,
        owner: 6,
      });
    var current = order[String(descriptor.role || "guest").toLowerCase()] || 0;
    var required =
      order[String(STAGE7_TEST_RUNNER_MIN_ROLE_ || "admin").toLowerCase()] ||
      4;
    return descriptor.enabled !== false && current >= required;
  } catch (error) {
    Logger.log(
      "[WASB Test Runner] Access check failed: " +
        (error && error.message ? error.message : error),
    );
    return false;
  }
}

function _stage7TestRunnerShowAccessDenied_(actionLabel, error) {
  var detail =
    error && error.message
      ? String(error.message)
      : "Недостатньо прав для цієї дії.";
  var text =
    "WASB Test Runner\n\n" +
    detail +
    "\n\nПотрібна роль: Admin або вище.\n" +
    "Дія: " +
    String(actionLabel || "тести проєкту");

  try {
    SpreadsheetApp.getUi().alert(text);
  } catch (uiError) {
    Logger.log(text);
  }
}

function _stage7TestRunnerAssertAdmin_(actionLabel) {
  try {
    if (
      typeof AccessControl_ === "object" &&
      AccessControl_ &&
      typeof AccessControl_.assertRoleAtLeast === "function"
    ) {
      AccessControl_.assertRoleAtLeast(
        STAGE7_TEST_RUNNER_MIN_ROLE_,
        actionLabel || "WASB Test Runner",
      );
      return true;
    }
  } catch (error) {
    _stage7TestRunnerShowAccessDenied_(actionLabel, error);
    return false;
  }

  if (!_stage7TestRunnerCanUseUi_()) {
    _stage7TestRunnerShowAccessDenied_(
      actionLabel,
      new Error("Недостатньо прав для цієї дії."),
    );
    return false;
  }

  return true;
}

function runProjectTestChunk(options) {
  if (!_stage7TestRunnerAssertAdmin_("run project test chunk")) {
    return null;
  }
  return Stage7TestRunner.runProjectTestChunk(
    Object.assign(
      {
        writeToSheet: true,
        writeToLogger: true,
        useLock: true,
        includeDiscovery: true,
        limit: 1,
        maxRuntimeMs: 120000,
      },
      options || {},
    ),
  );
}

function runStage7ProjectTestChunk(options) {
  return runProjectTestChunk(options || {});
}

function runAllProjectTests(options) {
  if (!_stage7TestRunnerAssertAdmin_("run all project tests")) {
    return null;
  }
  return Stage7TestRunner.runAllProjectTests(
    Object.assign(
      {
        writeToSheet: true,
        writeToLogger: true,
        useLock: true,
        includeDiscovery: true,
      },
      options || {},
    ),
  );
}

function runAllTests(options) {
  return runAllProjectTests(options || {});
}

function runStage7AllProjectTests() {
  if (!_stage7TestRunnerAssertAdmin_("run all project tests")) {
    return null;
  }
  var startedAt = new Date();
  var tz =
    typeof Session !== "undefined" && Session.getScriptTimeZone
      ? Session.getScriptTimeZone()
      : "Etc/GMT";
  var runId =
    "wasb_ui_project_tests_" +
    Utilities.formatDate(startedAt, tz, "yyyyMMdd_HHmmss") +
    "_" +
    Math.random().toString(36).slice(2, 8);
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
      allWarnings.push(
        "Пакетний запуск зупинено перед системним timeout. Продовжити можна через runStage7ProjectTestChunk з offset=" +
          offset +
          " і runId=" +
          runId +
          ".",
      );
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
      maxRuntimeMs: 120000,
    });

    chunks++;

    if (!lastReport) {
      allWarnings.push("Пакетний запуск зупинено: пакет не повернув звіт.");
      break;
    }

    if (lastReport.ok === false && lastReport.mode === "lock-failed") {
      allWarnings.push("Пакетний запуск зупинено: не вдалося отримати lock.");
      break;
    }

    if (lastReport.results && lastReport.results.length) {
      allResults = allResults.concat(lastReport.results);
    }
    if (lastReport.warnings && lastReport.warnings.length) {
      allWarnings = allWarnings.concat(lastReport.warnings);
    }

    totalTasks = lastReport.totalTasks || totalTasks || 0;
    offset =
      typeof lastReport.nextOffset === "number"
        ? lastReport.nextOffset
        : offset + 1;
    done = lastReport.done === true || (totalTasks && offset >= totalTasks);

    if (!lastReport.results || !lastReport.results.length) {
      allWarnings.push(
        "Пакетний запуск зупинено: пакет не повернув результатів, offset=" +
          offset +
          ".",
      );
      break;
    }
  }

  var finalReport = {
    ok: true,
    version: (lastReport && lastReport.version) || "stage7-project-test-runner",
    mode: "project-chunk-all",
    runId: runId,
    ts: (lastReport && lastReport.ts) || new Date().toISOString(),
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    durationMs: new Date().getTime() - startedAt.getTime(),
    environment: (lastReport && lastReport.environment) || {},
    offset: 0,
    limit: chunks,
    nextOffset: offset,
    totalTasks: totalTasks || allResults.length,
    done: done,
    progressPct: totalTasks ? Math.round((offset / totalTasks) * 100) : 100,
    counts: {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      warnings: 0,
      discovered: 0,
    },
    checks: [],
    results: allResults,
    warnings: allWarnings,
  };

  for (var i = 0; i < allResults.length; i++) {
    finalReport.counts.total++;
    var status = String(allResults[i].status || "").toUpperCase();
    if (status === "PASS") finalReport.counts.passed++;
    else if (status === "FAIL") finalReport.counts.failed++;
    else if (status === "WARN") finalReport.counts.warnings++;
    else if (status === "SKIPPED") finalReport.counts.skipped++;
    else if (status === "DISCOVERED") finalReport.counts.discovered++;
  }

  finalReport.ok = finalReport.counts.failed === 0;

  return showStage7TestAlert_(
    finalReport,
    done
      ? "WASB — повний пакетний запуск тестів завершено"
      : "WASB — пакетний запуск тестів зупинено",
  );
}

function runStage7TestsAll() {
  return runStage7AllProjectTests();
}

function runStage7TestsFast() {
  if (!_stage7TestRunnerAssertAdmin_("run fast tests")) {
    return null;
  }
  var report = Stage7TestRunner.runFast({
    writeToSheet: true,
    writeToLogger: true,
    useLock: true,
  });

  return showStage7TestAlert_(report, "WASB Fast Tests");
}

function runStage7DiagnosticsOnly() {
  if (!_stage7TestRunnerAssertAdmin_("run diagnostics tests")) {
    return null;
  }
  var report = Stage7TestRunner.runDiagnosticsOnly({
    writeToSheet: true,
    writeToLogger: true,
    useLock: true,
  });

  return showStage7TestAlert_(report, "WASB Diagnostics");
}

function runStage7SmokeOnly() {
  if (!_stage7TestRunnerAssertAdmin_("run smoke tests")) {
    return null;
  }
  var report = Stage7TestRunner.runSmokeOnly({
    writeToSheet: true,
    writeToLogger: true,
    useLock: true,
  });

  return showStage7TestAlert_(report, "WASB Smoke/Regression");
}

function runStage7HealthOnly() {
  if (!_stage7TestRunnerAssertAdmin_("run health tests")) {
    return null;
  }
  var report = Stage7TestRunner.runHealthOnly({
    writeToSheet: true,
    writeToLogger: true,
    useLock: true,
  });

  return showStage7TestAlert_(report, "WASB Health");
}

function runStage7AccessOnly() {
  if (!_stage7TestRunnerAssertAdmin_("run access tests")) {
    return null;
  }
  var report = Stage7TestRunner.runAccessOnly({
    writeToSheet: true,
    writeToLogger: true,
    useLock: true,
  });

  return showStage7TestAlert_(report, "WASB Access");
}

function runStage7DomainOnly() {
  if (!_stage7TestRunnerAssertAdmin_("run domain tests")) {
    return null;
  }
  var report = Stage7TestRunner.runDomainOnly({
    writeToSheet: true,
    writeToLogger: true,
    useLock: true,
  });

  return showStage7TestAlert_(report, "WASB Domain");
}

function showStage7TestReport() {
  if (!_stage7TestRunnerAssertAdmin_("show test report")) {
    return null;
  }
  return Stage7TestRunner.showDialog();
}

function resetStage7TestResultsSheet() {
  if (!_stage7TestRunnerAssertAdmin_("reset test results sheet")) {
    return null;
  }
  var result = Stage7TestRunner.resetResultsSheet();

  try {
    SpreadsheetApp.getUi().alert(
      "Лист " + result.sheetName + " створено або очищено.",
    );
  } catch (error) {
    Logger.log("Лист " + result.sheetName + " створено або очищено.");
  }

  return result;
}

function stage7TestRunnerOnOpen() {
  if (!_stage7TestRunnerCanUseUi_()) {
    return { ok: false, menu: "WASB Tests", skipped: "access-denied" };
  }
  return Stage7TestRunner.addMenu();
}

function installStage7TestRunner() {
  if (!_stage7TestRunnerAssertAdmin_("install test runner menu trigger")) {
    return { ok: false, installed: false, reason: "access-denied" };
  }
  return Stage7TestRunner.installOpenTrigger();
}

function showStage7TestAlert_(report, title) {
  var text =
    title +
    "\n\n" +
    "Status: " +
    (report.ok ? "PASS" : "FAIL") +
    "\n" +
    "Mode: " +
    report.mode +
    "\n" +
    "Total: " +
    report.counts.total +
    "\n" +
    "Passed: " +
    report.counts.passed +
    "\n" +
    "Failed: " +
    report.counts.failed +
    "\n" +
    "Warnings: " +
    report.counts.warnings +
    "\n" +
    "Skipped: " +
    report.counts.skipped +
    "\n" +
    "Discovered: " +
    (report.counts.discovered || 0) +
    "\n" +
    "Duration: " +
    report.durationMs +
    " ms";

  if (report.warnings && report.warnings.length > 0) {
    text += "\n\nWarnings:\n" + report.warnings.join("\n");
  }

  try {
    SpreadsheetApp.getUi().alert(text);
  } catch (error) {
    Logger.log(text);
  }

  return report;
}

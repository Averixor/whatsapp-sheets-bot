/**
 * Stage7TestRunner.SendPanel.gs — smoke/regression tasks (panel-related contracts).
 */

function stage7TestRunnerBuildSendPanelTasks_(taskFn, optArgFn) {
  return [
    taskFn(
      "health-check",
      "Health: healthCheck",
      "health",
      "fast",
      "critical",
      "healthCheck",
      optArgFn("health"),
    ),
    taskFn(
      "smoke-tests",
      "Smoke tests: runSmokeTests",
      "smoke",
      "fast",
      "critical",
      "runSmokeTests",
      optArgFn("smoke"),
    ),
    taskFn(
      "regression-tests",
      "Regression tests: runRegressionTestSuite",
      "regression",
      "full",
      "warning",
      "runRegressionTestSuite",
      optArgFn("regression"),
    ),
  ];
}

function stage7TestRunnerExplicitRegistrySendPanel_() {
  return {
    healthCheck: healthCheck,
    runSmokeTests: runSmokeTests,
    runRegressionTestSuite: runRegressionTestSuite,
  };
}

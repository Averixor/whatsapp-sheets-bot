/**
 * Stage7TestRunner.Summaries.gs — template / vacation engine tasks.
 */

function stage7TestRunnerBuildSummariesTasks_(taskFn, optArgFn) {
  return [
    taskFn(
      "template-notify-smoke",
      "Template tests: testNotifyWithTemplate_",
      "templates",
      "full",
      "warning",
      "testNotifyWithTemplate_",
    ),
    taskFn(
      "vacation-engine-test",
      "Vacation tests: testVacationEngine",
      "vacations",
      "full",
      "warning",
      "testVacationEngine",
    ),
  ];
}

function stage7TestRunnerExplicitRegistrySummaries_() {
  return {
    testNotifyWithTemplate_: testNotifyWithTemplate_,
    testVacationEngine: testVacationEngine,
  };
}

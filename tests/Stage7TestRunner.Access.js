/**
 * Stage7TestRunner.Access.gs — ACCESS / policy test tasks.
 */

function stage7TestRunnerBuildAccessTasks_(taskFn, optArgFn) {
  return [
    taskFn(
      "access-policy-checks",
      "Access tests: runAccessPolicyChecks",
      "access",
      "full",
      "critical",
      "runAccessPolicyChecks",
      optArgFn("accessPolicy"),
    ),
    taskFn(
      "access-all-policy-checks",
      "Access tests: runAllPolicyChecks",
      "access",
      "full",
      "warning",
      "runAllPolicyChecks",
      optArgFn("allPolicyChecks"),
    ),
    taskFn(
      "access-security-e2e-tests",
      "Access tests: runAccessSecurityE2ETests_",
      "access",
      "full",
      "critical",
      "runAccessSecurityE2ETests_",
      optArgFn("accessSecurity"),
    ),
    taskFn(
      "access-e2e-tests",
      "Access tests: runAccessE2ETests",
      "access",
      "full",
      "critical",
      "runAccessE2ETests",
      optArgFn("accessE2E"),
    ),
    taskFn(
      "access-diagnostics",
      "Access diagnostics: runAccessDiagnostics",
      "access",
      "full",
      "warning",
      "runAccessDiagnostics",
    ),
    taskFn(
      "access-public-test",
      "Access tests: testWasbAccessControl",
      "access",
      "full",
      "warning",
      "testWasbAccessControl",
    ),
    taskFn(
      "access-internal-test",
      "Access tests: testAccessControl_",
      "access",
      "full",
      "warning",
      "testAccessControl_",
    ),
    taskFn(
      "access-smoke-test",
      "Access tests: smokeTestAccessControl_",
      "access",
      "full",
      "warning",
      "smokeTestAccessControl_",
    ),
    taskFn(
      "access-test-diagnostics",
      "Access diagnostics: testDiagnostics",
      "access",
      "full",
      "warning",
      "testDiagnostics",
    ),
  ];
}

function stage7TestRunnerExplicitRegistryAccess_() {
  var registry = {};

  if (typeof runAccessPolicyChecks === "function") {
    registry.runAccessPolicyChecks = runAccessPolicyChecks;
  }
  if (typeof runAllPolicyChecks === "function") {
    registry.runAllPolicyChecks = runAllPolicyChecks;
  }
  if (typeof runAccessSecurityE2ETests_ === "function") {
    registry.runAccessSecurityE2ETests_ = runAccessSecurityE2ETests_;
  }
  if (typeof runAccessE2ETests === "function") {
    registry.runAccessE2ETests = runAccessE2ETests;
  }
  if (typeof runAccessDiagnostics === "function") {
    registry.runAccessDiagnostics = runAccessDiagnostics;
  }
  if (typeof testWasbAccessControl === "function") {
    registry.testWasbAccessControl = testWasbAccessControl;
  }
  if (typeof testAccessControl_ === "function") {
    registry.testAccessControl_ = testAccessControl_;
  }
  if (typeof smokeTestAccessControl_ === "function") {
    registry.smokeTestAccessControl_ = smokeTestAccessControl_;
  }
  if (typeof testDiagnostics === "function") {
    registry.testDiagnostics = testDiagnostics;
  }

  return registry;
}

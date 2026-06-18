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
  return {
    runAccessPolicyChecks: runAccessPolicyChecks,
    runAllPolicyChecks: runAllPolicyChecks,
    runAccessSecurityE2ETests_: runAccessSecurityE2ETests_,
    runAccessE2ETests: runAccessE2ETests,
    runAccessDiagnostics: runAccessDiagnostics,
    testWasbAccessControl: testWasbAccessControl,
    testAccessControl_: testAccessControl_,
    smokeTestAccessControl_: smokeTestAccessControl_,
    testDiagnostics: testDiagnostics,
  };
}

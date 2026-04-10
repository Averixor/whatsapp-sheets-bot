/**
 * AccessE2ETests.gs
 *
 * Thin compatibility wrapper over AccessPolicyChecks.gs.
 *
 * Історично smoke/regression suite очікує файл AccessE2ETests.gs і функцію
 * runAccessSecurityE2ETests_(). Зберігаємо сумісність без дублювання логіки.
 */

function runAccessSecurityE2ETests_(options) {
  if (typeof runAccessPolicyChecks !== 'function') {
    throw new Error('runAccessPolicyChecks is not available. AccessPolicyChecks.gs is required.');
  }

  const opts = Object.assign({}, options || {}, {
    safeTestEnvironment: true
  });

  const report = runAccessPolicyChecks(opts);

  if (!report || typeof report !== 'object') {
    throw new Error('runAccessPolicyChecks() did not return an object');
  }

  if (!Array.isArray(report.checks)) {
    throw new Error('runAccessPolicyChecks() did not return checks[]');
  }

  return report;
}

function runAccessE2ETests(options) {
  return runAccessSecurityE2ETests_(options || {});
}
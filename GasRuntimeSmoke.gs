/**
 * Remote GAS runtime smoke — post-deploy verification via clasp run.
 *
 *   npm run gas:smoke
 *   clasp run apiRunProductionSmokeChecks
 */
function apiRunProductionSmokeChecks() {
  var result = {
    ok: true,
    checks: {},
    errors: [],
  };

  try {
    result.checks.accessPolicy = runAccessPolicyChecks({
      safeTestEnvironment: true,
    });
    if (result.checks.accessPolicy && result.checks.accessPolicy.ok === false) {
      result.ok = false;
      result.errors.push({
        check: "accessPolicy",
        message: "runAccessPolicyChecks returned ok:false",
      });
    }
  } catch (err) {
    result.ok = false;
    result.errors.push({
      check: "accessPolicy",
      message: String((err && err.message) || err),
    });
  }

  try {
    result.checks.normalizeAccess = apiStage7NormalizeAccessSheetFormatting();
  } catch (err) {
    result.ok = false;
    result.errors.push({
      check: "normalizeAccess",
      message: String((err && err.message) || err),
    });
  }

  try {
    result.checks.clientSignal = apiStage7ReportClientAccessSignal(
      "sidebarActionUiDenied",
      {
        source: "ci-smoke",
        requestedAction: "runtime-test",
      },
    );
  } catch (err) {
    result.ok = false;
    result.errors.push({
      check: "clientSignal",
      message: String((err && err.message) || err),
    });
  }

  try {
    result.checks.health = apiStage7QuickHealthCheck();
  } catch (err) {
    result.ok = false;
    result.errors.push({
      check: "health",
      message: String((err && err.message) || err),
    });
  }

  try {
    result.checks.migrationFlag = PropertiesService.getScriptProperties().getProperty(
      "WASB_ACCESS_TEMP_PASSWORD_PLAIN_LOOKUP",
    );
    if (String(result.checks.migrationFlag || "").toLowerCase() === "true") {
      result.ok = false;
      result.errors.push({
        check: "migrationFlag",
        message: "WASB_ACCESS_TEMP_PASSWORD_PLAIN_LOOKUP must not be true",
      });
    }
  } catch (err) {
    result.ok = false;
    result.errors.push({
      check: "migrationFlag",
      message: String((err && err.message) || err),
    });
  }

  return result;
}

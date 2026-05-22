/**
 * SmokeTests.Helpers.gs — shared smoke/regression helpers.
 */

function _smokeAssert_(condition, message) {
  if (!condition) throw new Error(message || "Smoke assert failed");
}

function _smokeBundleHas_(path) {
  return typeof isProjectBundleFilePresent_ === "function"
    ? isProjectBundleFilePresent_(path)
    : false;
}

function _smokeHasRouteApi_(fnName) {
  const target = String(fnName || "").trim();
  if (!target) return false;
  try {
    if (typeof getRoutingRouteByApiMethod_ === "function")
      return !!getRoutingRouteByApiMethod_(target);
  } catch (e) {}
  try {
    if (typeof listRoutingRoutes_ === "function") {
      return (listRoutingRoutes_() || []).some(function (item) {
        return item && item.publicApiMethod === target;
      });
    }
  } catch (e) {}
  try {
    if (typeof getRoutingRegistry_ === "function") {
      return Object.keys(getRoutingRegistry_() || {}).some(function (key) {
        const item = (getRoutingRegistry_() || {})[key];
        return item && item.publicApiMethod === target;
      });
    }
  } catch (e) {}
  return false;
}

function _smokeResolveKnownSymbol_(name) {
  switch (String(name || "").trim()) {
    case "DataAccess_":
      return typeof DataAccess_ !== "undefined" ? DataAccess_ : undefined;
    case "DictionaryRepository_":
      return typeof DictionaryRepository_ !== "undefined"
        ? DictionaryRepository_
        : undefined;
    case "PersonsRepository_":
      return typeof PersonsRepository_ !== "undefined"
        ? PersonsRepository_
        : undefined;
    case "SendPanelRepository_":
      return typeof SendPanelRepository_ !== "undefined"
        ? SendPanelRepository_
        : undefined;
    case "VacationsRepository_":
      return typeof VacationsRepository_ !== "undefined"
        ? VacationsRepository_
        : undefined;
    case "SummaryRepository_":
      return typeof SummaryRepository_ !== "undefined"
        ? SummaryRepository_
        : undefined;
    case "LogsRepository_":
      return typeof LogsRepository_ !== "undefined"
        ? LogsRepository_
        : undefined;
    case "Stage7UseCases_":
      return typeof Stage7UseCases_ !== "undefined"
        ? Stage7UseCases_
        : undefined;
    case "WorkflowOrchestrator_":
      return typeof WorkflowOrchestrator_ !== "undefined"
        ? WorkflowOrchestrator_
        : undefined;
    case "Stage7AuditTrail_":
      return typeof Stage7AuditTrail_ !== "undefined"
        ? Stage7AuditTrail_
        : undefined;
    case "Reconciliation_":
      return typeof Reconciliation_ !== "undefined"
        ? Reconciliation_
        : undefined;
    case "Stage7Triggers_":
      return typeof Stage7Triggers_ !== "undefined"
        ? Stage7Triggers_
        : undefined;
    case "Stage7Templates_":
      return typeof Stage7Templates_ !== "undefined"
        ? Stage7Templates_
        : undefined;
    default:
      return undefined;
  }
}

function _smokeResolveFn_(name) {
  const target = String(name || "").trim();
  if (!target) return undefined;

  const parts = target.split(".").filter(Boolean);
  if (!parts.length) return undefined;

  const knownRoot = _smokeResolveKnownSymbol_(parts[0]);
  if (knownRoot !== undefined) {
    let current = knownRoot;
    for (let i = 1; i < parts.length; i++) {
      if (!current || !(parts[i] in current)) return undefined;
      current = current[parts[i]];
    }
    return current;
  }

  try {
    const g =
      typeof globalThis !== "undefined"
        ? globalThis
        : Function("return this")();
    let current = g;
    for (let i = 0; i < parts.length; i++) {
      if (!current || !(parts[i] in current)) return undefined;
      current = current[parts[i]];
    }
    return current;
  } catch (e) {}

  return undefined;
}

function _smokeHasFn_(name) {
  const target = String(name || "").trim();
  if (!target) return false;
  return (
    typeof _smokeResolveFn_(target) === "function" || _smokeHasRouteApi_(target)
  );
}

function _smokeResolveAccessSecurityRunner_() {
  if (typeof runAccessSecurityE2ETests_ === "function") {
    return {
      name: "runAccessSecurityE2ETests_",
      fn: runAccessSecurityE2ETests_,
    };
  }

  if (typeof runAccessPolicyChecks === "function") {
    return {
      name: "runAccessPolicyChecks",
      fn: runAccessPolicyChecks,
    };
  }

  if (typeof runAllPolicyChecks === "function") {
    return {
      name: "runAllPolicyChecks",
      fn: runAllPolicyChecks,
    };
  }

  return null;
}

function _smokePush_(report, name, fn, options) {
  const opts = options || {};
  try {
    const details = fn();
    report.checks.push({
      name: name,
      status: "OK",
      details: details || "OK",
    });
  } catch (e) {
    if (opts.skipOnError) {
      report.skipped = report.skipped || [];
      report.skipped.push({
        name: name,
        reason: e && e.message ? e.message : String(e),
      });
      report.checks.push({
        name: name,
        status: "SKIP",
        details: e && e.message ? e.message : String(e),
      });
      return;
    }
    report.ok = false;
    report.checks.push({
      name: name,
      status: "FAIL",
      details: e && e.message ? e.message : String(e),
    });
  }
}

function _assertUnifiedContract_(result, functionName) {
  _smokeAssert_(
    result && typeof result === "object",
    `${functionName}() не повернув об'єкт`,
  );
  ["success", "message", "error", "data", "context", "warnings"].forEach(
    function (field) {
      _smokeAssert_(
        field in result,
        `${functionName}() не повернув поле ${field}`,
      );
    },
  );
}

function _pickTestDate_() {
  try {
    const dates = PersonsRepository_.getAvailableDates();
    return dates.length ? dates[0] : _todayStr_();
  } catch (_) {
    return _todayStr_();
  }
}

function _pickTestCallsign_() {
  try {
    return typeof PersonsRepository_ === "object" &&
      PersonsRepository_ &&
      typeof PersonsRepository_.getAnyCallsign === "function"
      ? PersonsRepository_.getAnyCallsign() || ""
      : "";
  } catch (_) {
    return "";
  }
}

function _assertStage4Meta_(result, functionName) {
  _assertUnifiedContract_(result, functionName);
  _smokeAssert_(
    result.data && typeof result.data === "object",
    `${functionName}() не повернув data object`,
  );
  _smokeAssert_(
    "result" in result.data,
    `${functionName}() не повернув data.result`,
  );
  _smokeAssert_(
    "meta" in result.data,
    `${functionName}() не повернув data.meta`,
  );
}

function _runContractTest_(report, name, fn, options) {
  _smokePush_(
    report,
    name,
    function () {
      const result = fn();
      _assertStage4Meta_(result, name);
      return `success=${result.success}`;
    },
    options,
  );
}

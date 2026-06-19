/**
 * Stage7TestRunner.Registry.gs — explicit test runner bindings (no eval).
 */

function getStage7TestRunnerExplicitRegistry_() {
  return Object.assign(
    {},
    typeof stage7TestRunnerExplicitRegistrySendPanel_ === "function"
      ? stage7TestRunnerExplicitRegistrySendPanel_()
      : {},
    typeof stage7TestRunnerExplicitRegistryMaintenance_ === "function"
      ? stage7TestRunnerExplicitRegistryMaintenance_()
      : {},
    typeof stage7TestRunnerExplicitRegistryAccess_ === "function"
      ? stage7TestRunnerExplicitRegistryAccess_()
      : {},
    typeof stage7TestRunnerExplicitRegistrySummaries_ === "function"
      ? stage7TestRunnerExplicitRegistrySummaries_()
      : {},
  );
}

function stage7TestRunnerResolveFunction_(ctx, name) {
  var key = String(name || "").trim();
  if (!key) return null;

  var registry = getStage7TestRunnerExplicitRegistry_();
  if (Object.prototype.hasOwnProperty.call(registry, key)) {
    var registered = registry[key];
    if (typeof registered === "function") return registered;
  }

  var globalObject =
    ctx && typeof ctx.getGlobalObject_ === "function"
      ? ctx.getGlobalObject_()
      : null;
  if (globalObject && typeof globalObject[key] === "function")
    return globalObject[key];

  return null;
}

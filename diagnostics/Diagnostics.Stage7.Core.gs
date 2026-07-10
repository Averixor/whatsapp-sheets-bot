function _stage7PushCheck_(checks, name, status, details, recommendation) {
  var normalizedStatus = _diagNormalizeStatus_(status || "OK");

  var severity = "INFO";
  if (normalizedStatus === "FAIL") severity = "CRITICAL";
  else if (normalizedStatus === "WARN") severity = "WARN";

  var uiGroup = "ok";
  if (normalizedStatus === "FAIL") uiGroup = "critical";
  else if (normalizedStatus === "WARN") uiGroup = "warnings";

  checks.push({
    name: name,
    title: name,
    status: normalizedStatus,
    ok: normalizedStatus === "OK",
    pseudo: false,
    severity: severity,
    uiGroup: uiGroup,
    details: details || "",
    message: details || "",
    recommendation: normalizedStatus === "OK" ? "" : recommendation || "",
    howTo: normalizedStatus === "OK" ? "" : recommendation || "",
  });
}

function _projectBundleHas_(path) {
  return typeof isProjectBundleFilePresent_ === "function"
    ? isProjectBundleFilePresent_(path)
    : false;
}

function _projectBundleMissing_(paths) {
  return typeof getMissingProjectBundleFiles_ === "function"
    ? getMissingProjectBundleFiles_(paths || [])
    : (paths || []).slice();
}

function _isProjectDocPath_(path) {
  const value = String(path || "").trim();
  if (!value) return false;
  if (/^[A-Z0-9_\-]+\.md$/i.test(value)) return true;
  return value.indexOf("_extras/history/") === 0;
}

function _isArchivePath_(path) {
  return _isProjectDocPath_(path);
}

function _isReferencePath_(path) {
  return _isProjectDocPath_(path);
}

function _diagPushPathCheck_(checks, name, path, expectedKind) {
  const present = _projectBundleHas_(path);
  _stage7PushCheck_(
    checks,
    name,
    present ? "OK" : "FAIL",
    present ? `${expectedKind}: ${path}` : `${expectedKind} missing: ${path}`,
    present ? "" : `Відсутній файл ${path}`,
  );
}

function _diagGlobal_() {
  try {
    if (typeof globalThis !== "undefined") return globalThis;
  } catch (_) {}
  try {
    return Function("return this")();
  } catch (_) {}
  return {};
}

function _diagResolvePath_(scope, path) {
  var parts = String(path || "")
    .trim()
    .split(".")
    .filter(Boolean);
  var current = scope;
  for (var i = 0; i < parts.length; i++) {
    if (!current || !(parts[i] in current)) return undefined;
    current = current[parts[i]];
  }
  return current;
}

function _diagHasRouteApi_(fnName) {
  var target = String(fnName || "").trim();
  if (!target) return false;

  try {
    if (typeof getRoutingRouteByApiMethod_ === "function") {
      return !!getRoutingRouteByApiMethod_(target);
    }
  } catch (_) {}

  try {
    if (typeof listRoutingRoutes_ === "function") {
      return (listRoutingRoutes_() || []).some(function (item) {
        return item && item.publicApiMethod === target;
      });
    }
  } catch (_) {}

  try {
    if (typeof getRoutingRegistry_ === "function") {
      var routes = getRoutingRegistry_();
      if (Array.isArray(routes)) {
        return routes.some(function (item) {
          return item && item.publicApiMethod === target;
        });
      }
      if (routes && typeof routes === "object") {
        return Object.keys(routes).some(function (key) {
          return routes[key] && routes[key].publicApiMethod === target;
        });
      }
    }
  } catch (_) {}

  return false;
}

function _diagResolveKnownSymbolStage7_(name) {
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
    case "OperationRepository_":
      return typeof OperationRepository_ !== "undefined"
        ? OperationRepository_
        : undefined;
    case "SheetSchemas_":
      return typeof SheetSchemas_ !== "undefined" ? SheetSchemas_ : undefined;
    case "SheetStandards_":
      return typeof SheetStandards_ !== "undefined"
        ? SheetStandards_
        : undefined;
    case "Validation_":
      return typeof Validation_ !== "undefined" ? Validation_ : undefined;
    default:
      return undefined;
  }
}

function _diagResolveSymbolStage7_(name) {
  var target = String(name || "").trim();
  if (!target) return undefined;

  var directKnown = _diagResolveKnownSymbolStage7_(target);
  if (directKnown !== undefined) return directKnown;

  if (target.indexOf(".") > -1) {
    var parts = target.split(".").filter(Boolean);
    if (parts.length) {
      var rootSymbol = _diagResolveKnownSymbolStage7_(parts[0]);
      if (rootSymbol !== undefined) {
        var nested = _diagResolvePath_(rootSymbol, parts.slice(1).join("."));
        if (nested !== undefined) return nested;
      }
    }
  }

  try {
    var g = _diagGlobal_();
    var direct = _diagResolvePath_(g, target);
    if (direct !== undefined) return direct;
  } catch (_) {}

  if (_diagHasRouteApi_(target)) {
    return function routeApiProxyPlaceholder_() {};
  }

  return undefined;
}

function _fnExists_(name) {
  return typeof _diagResolveSymbolStage7_(name) === "function";
}

function _stage7ResolveSymbol_(name) {
  return _diagResolveSymbolStage7_(name);
}

function _stage7HasFn_(name) {
  return typeof _diagResolveSymbolStage7_(name) === "function";
}

function _releaseStageLabel_() {
  var meta =
    typeof getProjectBundleMetadata_ === "function"
      ? getProjectBundleMetadata_()
      : null;
  return meta && meta.stageLabel
    ? meta.stageLabel
    : "Stage 7 — Maintenance & repository hygiene";
}

function _diagNormalizeStatus_(status) {
  var normalized = String(status || "WARN").toUpperCase();
  if (normalized === "ERROR") return "FAIL";
  if (normalized === "CRITICAL") return "FAIL";
  if (normalized === "SUCCESS") return "OK";
  if (normalized === "COMPAT") return "WARN";
  if (normalized === "LEGACY-COMPAT") return "WARN";
  if (normalized === "PSEUDO" || normalized === "PSEUDO-COMPAT") return "WARN";
  return normalized;
}

function _diagResolveSeverity_(status, rawSeverity) {
  var sev = String(rawSeverity || "").toUpperCase();
  if (sev) return sev;
  var s = _diagNormalizeStatus_(status);
  if (s === "FAIL") return "CRITICAL";
  if (s === "WARN") return "WARN";
  return "INFO";
}

function _diagResolveUiGroup_(check) {
  var explicit = String((check && check.uiGroup) || "").toLowerCase();
  if (explicit === "critical" || explicit === "warnings" || explicit === "ok") {
    return explicit;
  }

  var status = _diagNormalizeStatus_(check && check.status);
  if (status === "FAIL") return "critical";
  if (status === "WARN") return "warnings";
  return "ok";
}

function _diagNormalizeCheck_(check, titlePrefix) {
  var title = String((check && (check.title || check.name)) || "").trim();
  if (!title) title = "Unnamed check";
  if (titlePrefix) {
    var pref = String(titlePrefix).trim();
    if (pref && title.indexOf(pref + " / ") !== 0) title = pref + " / " + title;
  }

  var details = String(
    (check && (check.details || check.message)) || "",
  ).trim();
  var rawCheck = Object.assign({}, check || {}, {
    title: title,
    name: title,
    details: details,
    message: details,
  });
  var status = _diagNormalizeStatus_(rawCheck.status);

  var howTo = String(
    (check && (check.howTo || check.recommendation)) || "",
  ).trim();
  var severity = _diagResolveSeverity_(status, check && check.severity);

  return {
    name: title,
    title: title,
    status: status,
    ok: status === "OK",
    pseudo: false,
    severity: severity,
    uiGroup: _diagResolveUiGroup_(
      Object.assign({}, rawCheck, { status: status }),
    ),
    details: details,
    message: details,
    howTo: howTo,
    recommendation: howTo,
  };
}

function _diagNormalizeReportChecks_(report, titlePrefix) {
  var list = report && Array.isArray(report.checks) ? report.checks : [];
  return list.map(function (item) {
    return _diagNormalizeCheck_(item, titlePrefix || "");
  });
}
function _diagMergeChecks_() {
  var merged = [];
  var seen = {};

  Array.prototype.slice.call(arguments).forEach(function (part) {
    (part || []).forEach(function (item) {
      var normalized = _diagNormalizeCheck_(item);
      var key = [
        normalized.title,
        normalized.status,
        normalized.details,
        normalized.howTo,
      ].join(" | ");
      if (seen[key]) return;
      seen[key] = true;
      merged.push(normalized);
    });
  });

  return merged;
}

function _diagBuildWarningsFromChecks_(checks) {
  return (checks || [])
    .filter(function (item) {
      return item && item.status === "WARN";
    })
    .map(function (item) {
      return item.title;
    });
}

function _diagBuildCounts_(checks) {
  var list = Array.isArray(checks) ? checks : [];
  var counts = {
    total: list.length,
    ok: 0,
    pseudo: 0,
    warnings: 0,
    failures: 0,
    byStatus: {
      OK: 0,
      PSEUDO: 0,
      WARN: 0,
      FAIL: 0,
    },
    byUiGroup: {
      ok: 0,
      pseudo: 0,
      warnings: 0,
      critical: 0,
    },
  };

  list.forEach(function (item) {
    var normalized = _diagNormalizeCheck_(item);
    var status = normalized.status;
    var uiGroup = normalized.uiGroup || "ok";

    if (status === "OK") counts.ok += 1;
    else if (status === "WARN") counts.warnings += 1;
    else if (status === "FAIL") counts.failures += 1;

    if (counts.byStatus[status] === undefined) counts.byStatus[status] = 0;
    counts.byStatus[status] += 1;

    if (counts.byUiGroup[uiGroup] === undefined) counts.byUiGroup[uiGroup] = 0;
    counts.byUiGroup[uiGroup] += 1;
  });

  return counts;
}

function _diagAppendPreprodScriptPropertyChecks_(checks) {
  var ownerDiag =
    typeof getWasbOwnerEmailDiagnostics_ === "function"
      ? getWasbOwnerEmailDiagnostics_()
      : {
          ownerEmailConfigured: false,
          warning: "getWasbOwnerEmailDiagnostics_ недоступний",
        };

  _stage7PushCheck_(
    checks,
    "Pre-prod WASB_OWNER_EMAIL",
    ownerDiag.ownerEmailConfigured ? "OK" : "WARN",
    ownerDiag.ownerEmailConfigured
      ? "WASB_OWNER_EMAIL заданий і схожий на email"
      : ownerDiag.warning || "WASB_OWNER_EMAIL не заданий",
    ownerDiag.ownerEmailConfigured
      ? ""
      : "Script properties → WASB_OWNER_EMAIL=owner@example.com",
  );
}

function _diagBuildReport_(checks, mode, summaryPrefix) {
  var list = Array.isArray(checks) ? checks : [];
  var counts = _diagBuildCounts_(list);
  var ownerDiag =
    typeof getWasbOwnerEmailDiagnostics_ === "function"
      ? getWasbOwnerEmailDiagnostics_()
      : { ownerEmailConfigured: false, warning: "" };
  return {
    ok: counts.failures === 0,
    stage: "7.1",
    mode: mode || "full",
    checks: list,
    ownerEmailConfigured: !!ownerDiag.ownerEmailConfigured,
    ownerEmailWarning: ownerDiag.warning || "",
    warnings: _diagBuildWarningsFromChecks_(list),
    counts: counts,
    summary:
      counts.failures === 0
        ? (summaryPrefix || _releaseStageLabel_()) +
          ". Warnings: " +
          counts.warnings
        : (summaryPrefix || _releaseStageLabel_()) +
          ". Failures: " +
          counts.failures +
          ", warnings: " +
          counts.warnings,
    ts: new Date().toISOString(),
  };
}

function _diagServiceSheetCheck_(checks, name) {
  try {
    var ss = getWasbSpreadsheet_();
    var sh = ss.getSheetByName(name);
    _stage7PushCheck_(
      checks,
      "Service sheet " + name,
      sh ? "OK" : "WARN",
      sh
        ? "Доступний"
        : "Ще не створений; буде створений автоматично при першій lifecycle-операції",
      sh
        ? ""
        : "Запустіть будь-яку критичну write-операцію або ensureServiceSheets()",
    );
  } catch (e) {
    _stage7PushCheck_(
      checks,
      "Service sheet " + name,
      "FAIL",
      e && e.message ? e.message : String(e),
      "Перевірте доступ до SpreadsheetApp",
    );
  }
}

function _diagBuildStage7CoreChecks_(options) {
  var opts = options || {};
  var checks = [];
  var meta =
    typeof getProjectBundleMetadata_ === "function"
      ? getProjectBundleMetadata_()
      : {};
  var release =
    typeof getProjectReleaseNaming_ === "function"
      ? getProjectReleaseNaming_()
      : {};
  var docs =
    typeof getProjectDocumentationMap_ === "function"
      ? getProjectDocumentationMap_()
      : {};
  var policy = meta && meta.clientRuntimePolicy ? meta.clientRuntimePolicy : {};
  var runtimeContract =
    typeof getClientRuntimeContract_ === "function"
      ? getClientRuntimeContract_()
      : {};

  _stage7PushCheck_(
    checks,
    "Release stage marker",
    String((meta && meta.stage) || "") === "7.1" ? "OK" : "FAIL",
    "stage=" +
      ((meta && meta.stage) || "n/a") +
      ", label=" +
      ((meta && meta.stageLabel) || "n/a"),
    "Оновіть ProjectMetadata.gs під Stage 7.1",
  );
  _stage7PushCheck_(
    checks,
    "Active baseline marker",
    meta && meta.activeBaseline === "stage7-1-5-maintenance-baseline"
      ? "OK"
      : "FAIL",
    "activeBaseline=" + ((meta && meta.activeBaseline) || "n/a"),
    "Оновіть activeBaseline",
  );
  _stage7PushCheck_(
    checks,
    "Release naming aligned",
    release &&
      release.archiveBaseName === "gas_wasb_stage7_1_5_maintenance" &&
      release.rootFolderName === "gas_wasb_stage7_1_5_maintenance"
      ? "OK"
      : "FAIL",
    ((release && release.archiveBaseName) || "n/a") +
      " / " +
      ((release && release.rootFolderName) || "n/a"),
    "Вирівняйте archive/root naming",
  );
  _stage7PushCheck_(
    checks,
    "Stage7 report active",
    docs && docs.active && docs.active.changelog === "CHANGELOG.md"
      ? "OK"
      : "FAIL",
    docs && docs.active && docs.active.changelog
      ? docs.active.changelog
      : "Не задано",
    "Зафіксуйте CHANGELOG.md як active release report",
  );
  _stage7PushCheck_(
    checks,
    "Modular runtime policy",
    policy && policy.runtimeStatus === "canonical-modular-runtime"
      ? "OK"
      : "FAIL",
    policy && policy.runtimeStatus ? policy.runtimeStatus : "Не задано",
    "Оновіть clientRuntimePolicy.runtimeStatus",
  );
  _stage7PushCheck_(
    checks,
    "Active Js include chain",
    policy && policy.modularStatus === "active-js-include-chain"
      ? "OK"
      : "FAIL",
    policy && policy.modularStatus ? policy.modularStatus : "Не задано",
    "Оновіть clientRuntimePolicy.modularStatus",
  );
  _stage7PushCheck_(
    checks,
    "Runtime contract marker",
    runtimeContract && runtimeContract.policyMarker === "stage7-sidebar-runtime"
      ? "OK"
      : "FAIL",
    runtimeContract && runtimeContract.policyMarker
      ? runtimeContract.policyMarker
      : "Не задано",
    "Оновіть getClientRuntimeContract_()",
  );
  _stage7PushCheck_(
    checks,
    "OperationRepository available",
    typeof OperationRepository_ === "object" ? "OK" : "FAIL",
    typeof OperationRepository_,
    "Підключіть OperationRepository.gs",
  );
  _stage7PushCheck_(
    checks,
    "WorkflowOrchestrator available",
    typeof WorkflowOrchestrator_ === "object" ? "OK" : "FAIL",
    typeof WorkflowOrchestrator_,
    "Перевірте WorkflowOrchestrator.gs",
  );

  var hasList = _stage7HasFn_("apiStage7ListPendingRepairs");
  var hasRepair = _stage7HasFn_("apiStage7RunRepair");
  var hasRetentionCleanup = _stage7HasFn_(
    "apiStage7RunLifecycleRetentionCleanup",
  );
  _stage7PushCheck_(
    checks,
    "Lifecycle maintenance API",
    hasList && hasRepair ? "OK" : "FAIL",
    "list=" + hasList + ", repair=" + hasRepair,
    "Додайте maintenance API для repair flow",
  );
  _stage7PushCheck_(
    checks,
    "Lifecycle retention cleanup API",
    hasRetentionCleanup ? "OK" : "WARN",
    "cleanup=" + hasRetentionCleanup,
    "Додайте окремий maintenance flow для lifecycle retention cleanup",
  );
  var presentLegacy =
    typeof findPresentLegacyApiGlobals_ === "function"
      ? findPresentLegacyApiGlobals_()
      : [];
  _stage7PushCheck_(
    checks,
    "Legacy API surface removed",
    presentLegacy.length === 0 ? "OK" : "FAIL",
    presentLegacy.length
      ? "present=" + presentLegacy.join(", ")
      : "canonical-only",
    "Видаліть apiStage4* / apiGet* alias layers з проєкту",
  );

  ["OPS_LOG", "ACTIVE_OPERATIONS", "CHECKPOINTS"].forEach(function (name) {
    _diagServiceSheetCheck_(checks, name);
  });

  if (opts.includeRuntimeTemplate !== false) {
    try {
      var rawSidebar = include("Sidebar");
      var rawJavaScript = includeTemplate("JavaScript");
      _stage7PushCheck_(
        checks,
        "Sidebar uses includeTemplate(JavaScript)",
        rawSidebar.indexOf("includeTemplate('JavaScript')") !== -1 ||
          rawSidebar.indexOf('includeTemplate("JavaScript")') !== -1
          ? "OK"
          : "FAIL",
        "Sidebar bootstrap include chain checked",
        "Поверніть includeTemplate(JavaScript) у Sidebar.html",
      );
      var modularOk =
        rawJavaScript.indexOf("stage7-sidebar-runtime") !== -1 &&
        rawJavaScript.indexOf("window.SidebarApp = SidebarApp;") !== -1 &&
        rawJavaScript.indexOf("<script") !== -1;
      _stage7PushCheck_(
        checks,
        "JavaScript runtime is modular",
        modularOk ? "OK" : "FAIL",
        "JavaScript.html include chain evaluated",
        "Зберіть JavaScript.html як модульний агрегатор",
      );
    } catch (e) {
      _stage7PushCheck_(
        checks,
        "Runtime template evaluation",
        "FAIL",
        e && e.message ? e.message : String(e),
        "Перевірте JavaScript.html і Sidebar.html",
      );
    }
  }

  try {
    var runtime =
      typeof JobRuntime_ === "object" &&
      typeof JobRuntime_.buildRuntimeReport === "function"
        ? JobRuntime_.buildRuntimeReport()
        : null;
    _stage7PushCheck_(
      checks,
      "Job runtime report",
      runtime ? "OK" : "WARN",
      runtime
        ? "jobs=" +
            (runtime.totalJobs || 0) +
            ", failed=" +
            (runtime.failedJobs || 0) +
            ", stale=" +
            (runtime.staleJobs || 0)
        : "Недоступний",
      runtime ? "" : "Перевірте JobRuntime.gs",
    );
  } catch (e) {
    _stage7PushCheck_(
      checks,
      "Job runtime report",
      "FAIL",
      e && e.message ? e.message : String(e),
      "Перевірте JobRuntime.gs",
    );
  }

  _diagAppendPreprodScriptPropertyChecks_(checks);

  return _diagNormalizeReportChecks_({ checks: checks });
}

function _diagAppendPendingRepairsCheck_(checks) {
  try {
    var pending =
      typeof OperationRepository_ === "object" &&
      typeof OperationRepository_.listPendingRepairs === "function"
        ? OperationRepository_.listPendingRepairs({ limit: 25 })
        : { operations: [] };
    _stage7PushCheck_(
      checks,
      "Pending repairs visibility",
      pending && Array.isArray(pending.operations) ? "OK" : "WARN",
      pending && Array.isArray(pending.operations)
        ? "visible=" + pending.operations.length
        : "Недоступно",
      pending && Array.isArray(pending.operations)
        ? ""
        : "Перевірте OperationRepository_.listPendingRepairs()",
    );
  } catch (e) {
    _stage7PushCheck_(
      checks,
      "Pending repairs visibility",
      "FAIL",
      e && e.message ? e.message : String(e),
      "Перевірте OperationRepository_.listPendingRepairs()",
    );
  }
}

function _diagAppendCompatibilitySplitCheck_(checks) {
  try {
    var present =
      typeof findPresentLegacyApiGlobals_ === "function"
        ? findPresentLegacyApiGlobals_()
        : [];
    _stage7PushCheck_(
      checks,
      "Legacy API inventory",
      present.length === 0 ? "OK" : "FAIL",
      present.length ? present.join(", ") : "removed-legacy inventory clean",
      "Перевірте DeprecatedRegistry.gs / deploy manifest",
    );
  } catch (e) {
    _stage7PushCheck_(
      checks,
      "Legacy API inventory",
      "WARN",
      e && e.message ? e.message : String(e),
      "Перевірте DeprecatedRegistry.gs",
    );
  }
}

function _diagAppendLifecyclePolicyCheck_(checks) {
  try {
    var policy =
      typeof OperationRepository_ === "object" &&
      typeof OperationRepository_.buildLifecyclePolicyReport === "function"
        ? OperationRepository_.buildLifecyclePolicyReport()
        : null;
    _stage7PushCheck_(
      checks,
      "Lifecycle policy report",
      policy ? "OK" : "FAIL",
      policy
        ? "ttlScenarios=" +
            (policy.ttlScenarios || 0) +
            ", sheets=" +
            (policy.serviceSheets || []).join(", ")
        : "Недоступно",
      policy
        ? ""
        : "Перевірте OperationRepository_.buildLifecyclePolicyReport()",
    );
  } catch (e) {
    _stage7PushCheck_(
      checks,
      "Lifecycle policy report",
      "FAIL",
      e && e.message ? e.message : String(e),
      "Перевірте OperationRepository_.buildLifecyclePolicyReport()",
    );
  }
}

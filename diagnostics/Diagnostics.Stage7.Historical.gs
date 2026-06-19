function runStage41ProjectConsistencyCheck_() {
  const checks = [];
  const meta =
    typeof PROJECT_BUNDLE_METADATA_ === "object" && PROJECT_BUNDLE_METADATA_
      ? PROJECT_BUNDLE_METADATA_
      : null;

  _stage7PushCheck_(
    checks,
    "Project bundle metadata",
    meta ? "OK" : "FAIL",
    meta
      ? "PROJECT_BUNDLE_METADATA_ доступний"
      : "PROJECT_BUNDLE_METADATA_ не знайдено",
    meta ? "" : "Додайте ProjectMetadata.gs",
  );

  if (!meta) return checks;

  _stage7PushCheck_(
    checks,
    "Release stage marker",
    String(meta.stage || "") === "7.1" ? "OK" : "WARN",
    `stage=${meta.stage || "n/a"}, stageVersion=${meta.stageVersion || "n/a"}, label=${meta.stageLabel || "n/a"}`,
    "Оновіть ProjectMetadata.gs до Stage 7.1",
  );

  _stage7PushCheck_(
    checks,
    "Root manifest declaration",
    meta.manifestIncluded ? "OK" : "FAIL",
    meta.manifestIncluded
      ? `manifestIncluded=true, path=${(meta.packagingPolicy && meta.packagingPolicy.manifestPath) || "n/a"}`
      : "manifestIncluded=false",
    "Вирівняйте packaging policy",
  );

  _stage7PushCheck_(
    checks,
    "Root manifest physical presence",
    _projectBundleHas_(
      (meta.packagingPolicy && meta.packagingPolicy.manifestPath) ||
        "appsscript.json",
    )
      ? "OK"
      : "FAIL",
    _projectBundleHas_(
      (meta.packagingPolicy && meta.packagingPolicy.manifestPath) ||
        "appsscript.json",
    )
      ? (meta.packagingPolicy && meta.packagingPolicy.manifestPath) ||
          "appsscript.json"
      : "appsscript.json відсутній у root bundle",
    "Додайте manifest до bundle root",
  );

  _stage7PushCheck_(
    checks,
    "Root clasp example omitted intentionally",
    !meta.packagingPolicy ||
      !meta.packagingPolicy.claspExamplePath ||
      !_projectBundleHas_(meta.packagingPolicy.claspExamplePath)
      ? "OK"
      : "WARN",
    !meta.packagingPolicy ||
      !meta.packagingPolicy.claspExamplePath ||
      !_projectBundleHas_(meta.packagingPolicy.claspExamplePath)
      ? "web-editor-ready archive intentionally omits .clasp.json.example"
      : "Unexpected optional clasp example present: " +
          meta.packagingPolicy.claspExamplePath,
    "Для web-editor bundle .clasp.json.example не потрібний",
  );

  _stage7PushCheck_(
    checks,
    "GAS-first policy marker",
    meta.gasFirst ? "OK" : "WARN",
    meta.gasFirst ? "Bundle позначено як GAS-first" : "gasFirst=false",
    "Зафіксуйте GAS-first політику в ProjectMetadata.gs",
  );

  const requiredDocs = Array.isArray(meta.requiredDocs)
    ? meta.requiredDocs
    : [];
  requiredDocs.forEach(function (doc) {
    _stage7PushCheck_(
      checks,
      `Required doc declared ${doc}`,
      requiredDocs.indexOf(doc) !== -1 ? "OK" : "FAIL",
      "Документ включено в metadata.requiredDocs",
      "Оновіть ProjectMetadata.gs",
    );
    _stage7PushCheck_(
      checks,
      `Required doc physical ${doc}`,
      _projectBundleHas_(doc) ? "OK" : "FAIL",
      _projectBundleHas_(doc) ? `present=${doc}` : `missing=${doc}`,
      "Вирівняйте bundle layout",
    );
  });

  const helperOk =
    typeof HtmlUtils_ === "object" &&
    typeof HtmlUtils_.escapeHtml === "function" &&
    typeof escapeHtml_ !== "function" &&
    typeof _escapeHtml_ !== "function" &&
    HtmlUtils_.escapeHtml("<b>") === "&lt;b&gt;";

  _stage7PushCheck_(
    checks,
    "Canonical HTML helper",
    helperOk ? "OK" : "FAIL",
    helperOk
      ? "HtmlUtils_.escapeHtml() — єдиний canonical path; legacy alias відсутні"
      : "Потрібен HtmlUtils_.escapeHtml без escapeHtml_ / _escapeHtml_",
    helperOk ? "" : "Перевірте HtmlUtils.gs — приберіть global escapeHtml_ wrappers",
  );

  return checks;
}

function runHistoricalStructuralDiagnosticsInternal_(options) {
  const opts = options || {};
  const checks = [];
  const warnings = [];
  const meta =
    typeof getProjectBundleMetadata_ === "function"
      ? getProjectBundleMetadata_()
      : PROJECT_BUNDLE_METADATA_;
  const apiMap =
    typeof getCanonicalApiMap_ === "function" ? getCanonicalApiMap_() : null;
  const routing =
    typeof getStage4ClientRoutingPolicy_ === "function"
      ? getStage4ClientRoutingPolicy_()
      : null;

  _stage7PushCheck_(
    checks,
    "Canonical layer map",
    meta && meta.canonicalLayers ? "OK" : "FAIL",
    meta && meta.canonicalLayers
      ? JSON.stringify(meta.canonicalLayers)
      : "canonicalLayers відсутній",
    "Оновіть ProjectMetadata.gs",
  );

  const canonicalLayerAliases = {
    applicationApi: ["applicationApi", "sidebarApplicationApi"],
    maintenanceApi: ["maintenanceApi"],
    useCases: ["useCases"],
    workflow: ["workflow"],
    compatibility: ["compatibility", "compatibilityFacade"],
    diagnostics: ["diagnostics"],
    tests: ["tests"],
    metadata: ["metadata"],
  };

  Object.keys(canonicalLayerAliases).forEach(function (key) {
    const resolved =
      (canonicalLayerAliases[key] || [])
        .map(function (alias) {
          return meta && meta.canonicalLayers
            ? meta.canonicalLayers[alias]
            : "";
        })
        .filter(Boolean)[0] || "";
    const ok = !!resolved;
    _stage7PushCheck_(
      checks,
      `Layer pointer ${key}`,
      ok ? "OK" : "FAIL",
      ok ? resolved : "Не задано",
      "Оновіть ProjectMetadata.gs",
    );
  });

  ["application", "maintenance", "compatibility"].forEach(function (kind) {
    const list = apiMap && Array.isArray(apiMap[kind]) ? apiMap[kind] : [];
    const expectEmpty = kind === "compatibility";
    const mapOk = expectEmpty ? list.length === 0 : list.length > 0;
    _stage7PushCheck_(
      checks,
      `Canonical API map ${kind}`,
      mapOk ? "OK" : "FAIL",
      expectEmpty
        ? list.length
          ? "legacy compatibility entries still listed"
          : "compatibility map retired"
        : list.length
          ? `entrypoints=${list.length}`
          : "Список порожній",
      "Оновіть ProjectMetadata.gs",
    );

    list.forEach(function (fnName) {
      _stage7PushCheck_(
        checks,
        `Entrypoint ${fnName}`,
        _stage7HasFn_(fnName) ? "OK" : "FAIL",
        _stage7HasFn_(fnName) ? "Доступний" : "Не знайдено",
        "Перевірте відповідний файл API",
      );
    });
  });

  _stage7PushCheck_(
    checks,
    "Client routing policy map",
    routing && typeof routing === "object" ? "OK" : "FAIL",
    routing && typeof routing === "object"
      ? `routes=${Object.keys(routing).length}`
      : "routing map відсутній",
    "Оновіть ProjectMetadata.gs",
  );

  Object.keys(routing || {}).forEach(function (action) {
    const fnName = routing[action];
    _stage7PushCheck_(
      checks,
      `Client route ${action} -> ${fnName}`,
      _stage7HasFn_(fnName) ? "OK" : "FAIL",
      _stage7HasFn_(fnName)
        ? "Маршрут розвʼязується"
        : "Target function не знайдено",
      "Вирівняйте JavaScript.html та server API",
    );
  });

  return {
    ok:
      checks.filter(function (item) {
        return item.status === "FAIL";
      }).length === 0,
    status: checks.some(function (item) {
      return item.status === "FAIL";
    })
      ? "FAIL"
      : "OK",
    stage:
      typeof getProjectBundleMetadata_ === "function"
        ? getProjectBundleMetadata_().stageVersion
        : "7",
    mode: opts.mode || "structural",
    checks: checks,
    warnings: warnings,
    summary: "Historical structural lineage diagnostics завершено",
    ts: new Date().toISOString(),
  };
}

function runHistoricalCompatibilityDiagnosticsInternal_(options) {
  const opts = options || {};
  const checks = [];
  const warnings = [];
  const registry =
    typeof getStage4CompatibilityMap_ === "function"
      ? getStage4CompatibilityMap_()
      : [];
  const presentLegacy =
    typeof findPresentLegacyApiGlobals_ === "function"
      ? findPresentLegacyApiGlobals_()
      : [];

  _stage7PushCheck_(
    checks,
    "Compatibility registry empty",
    registry.length === 0 ? "OK" : "FAIL",
    "entries=" + registry.length,
    "DeprecatedRegistry не повинен містити активні compatibility wrappers",
  );

  _stage7PushCheck_(
    checks,
    "Legacy API globals absent",
    presentLegacy.length === 0 ? "OK" : "FAIL",
    presentLegacy.length
      ? "present=" + presentLegacy.join(", ")
      : "canonical-only",
    "Deploy без LegacyApiAliases / LegacyMaintenanceAliases",
  );

  [
    "apiStage7GetMonthsList",
    "apiStage7GetSidebarData",
    "apiGenerateSendPanelForDate",
    "apiStage7GetSendPanelData",
  ].forEach(function (name) {
    _stage7PushCheck_(
      checks,
      "Canonical public API " + name,
      _stage7HasFn_(name) ? "OK" : "FAIL",
      _stage7HasFn_(name) ? "Stage7ServerApi.gs" : "Не знайдено",
      "Відновіть canonical API у Stage7ServerApi.gs",
    );
  });

  return {
    ok:
      checks.filter(function (item) {
        return item.status === "FAIL";
      }).length === 0,
    status: checks.some(function (item) {
      return item.status === "FAIL";
    })
      ? "FAIL"
      : "OK",
    stage:
      typeof getProjectBundleMetadata_ === "function"
        ? getProjectBundleMetadata_().stageVersion
        : "7",
    mode: opts.mode || "compatibility",
    checks: checks,
    warnings: [...new Set(warnings)],
    summary: "Historical compatibility lineage diagnostics завершено",
    ts: new Date().toISOString(),
  };
}

function runHistoricalQuickDiagnosticsInternal_(options) {
  const opts = options || {};
  const structural = runHistoricalStructuralDiagnosticsInternal_({
    mode: "quick",
  });
  const checks = structural.checks.filter(function (item) {
    return (
      String(item.name || "").indexOf("Entrypoint ") === 0 ||
      String(item.name || "").indexOf("Client route ") === 0 ||
      String(item.name || "").indexOf("Required doc marker ") === 0 ||
      item.name === "Project bundle metadata" ||
      item.name === "Canonical HTML helper"
    );
  });

  return {
    ok:
      checks.filter(function (item) {
        return item.status === "FAIL";
      }).length === 0,
    status: checks.some(function (item) {
      return item.status === "FAIL";
    })
      ? "FAIL"
      : "OK",
    stage:
      typeof getProjectBundleMetadata_ === "function"
        ? getProjectBundleMetadata_().stageVersion
        : "7",
    mode: opts.mode || "quick",
    checks: checks,
    warnings: [],
    summary: "Historical quick lineage diagnostics завершено",
    ts: new Date().toISOString(),
  };
}

function runHistoricalFullDiagnosticsInternal_(options) {
  const opts = options || {};
  const structural = runHistoricalStructuralDiagnosticsInternal_({
    mode: "full",
  });
  const compatibility = runHistoricalCompatibilityDiagnosticsInternal_({
    mode: "full",
  });
  const checks = []
    .concat(runStage41ProjectConsistencyCheck_())
    .concat(structural.checks || [])
    .concat(compatibility.checks || []);
  const warnings = stage7MergeWarnings_(
    structural.warnings || [],
    compatibility.warnings || [],
  );

  return {
    ok:
      checks.filter(function (item) {
        return item.status === "FAIL";
      }).length === 0,
    status: checks.some(function (item) {
      return item.status === "FAIL";
    })
      ? "FAIL"
      : "OK",
    stage:
      typeof getProjectBundleMetadata_ === "function"
        ? getProjectBundleMetadata_().stageVersion
        : "7",
    mode: opts.mode || "full",
    checks: checks,
    warnings: warnings,
    summary: "Historical full lineage diagnostics завершено",
    ts: new Date().toISOString(),
  };
}

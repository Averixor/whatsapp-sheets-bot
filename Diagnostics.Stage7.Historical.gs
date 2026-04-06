function runStage41ProjectConsistencyCheck_() {
  const checks = [];
  const meta = typeof PROJECT_BUNDLE_METADATA_ === 'object' && PROJECT_BUNDLE_METADATA_
    ? PROJECT_BUNDLE_METADATA_
    : null;

  _stage7PushCheck_(
    checks,
    'Project bundle metadata',
    meta ? 'OK' : 'FAIL',
    meta ? 'PROJECT_BUNDLE_METADATA_ доступний' : 'PROJECT_BUNDLE_METADATA_ не знайдено',
    meta ? '' : 'Додайте ProjectMetadata.gs'
  );

  if (!meta) return checks;

  _stage7PushCheck_(
    checks,
    'Release stage marker',
    String(meta.stage || '') === '7.1' ? 'OK' : 'WARN',
    `stage=${meta.stage || 'n/a'}, stageVersion=${meta.stageVersion || 'n/a'}, label=${meta.stageLabel || 'n/a'}`,
    'Оновіть ProjectMetadata.gs до Stage 7.1'
  );

  _stage7PushCheck_(
    checks,
    'Root manifest declaration',
    meta.manifestIncluded ? 'OK' : 'FAIL',
    meta.manifestIncluded ? `manifestIncluded=true, path=${(meta.packagingPolicy && meta.packagingPolicy.manifestPath) || 'n/a'}` : 'manifestIncluded=false',
    'Вирівняйте packaging policy'
  );

  _stage7PushCheck_(
    checks,
    'Root manifest physical presence',
    _projectBundleHas_((meta.packagingPolicy && meta.packagingPolicy.manifestPath) || 'appsscript.json') ? 'OK' : 'FAIL',
    _projectBundleHas_((meta.packagingPolicy && meta.packagingPolicy.manifestPath) || 'appsscript.json')
      ? ((meta.packagingPolicy && meta.packagingPolicy.manifestPath) || 'appsscript.json')
      : 'appsscript.json відсутній у root bundle',
    'Додайте manifest до bundle root'
  );

  _stage7PushCheck_(
    checks,
    'Root clasp example omitted intentionally',
    (!meta.packagingPolicy || !meta.packagingPolicy.claspExamplePath || !_projectBundleHas_(meta.packagingPolicy.claspExamplePath)) ? 'OK' : 'WARN',
    (!meta.packagingPolicy || !meta.packagingPolicy.claspExamplePath || !_projectBundleHas_(meta.packagingPolicy.claspExamplePath))
      ? 'web-editor-ready archive intentionally omits .clasp.json.example'
      : ('Unexpected optional clasp example present: ' + meta.packagingPolicy.claspExamplePath),
    'Для web-editor bundle .clasp.json.example не потрібний'
  );

  _stage7PushCheck_(
    checks,
    'GAS-first policy marker',
    meta.gasFirst ? 'OK' : 'WARN',
    meta.gasFirst ? 'Bundle позначено як GAS-first' : 'gasFirst=false',
    'Зафіксуйте GAS-first політику в ProjectMetadata.gs'
  );

  const requiredDocs = Array.isArray(meta.requiredDocs) ? meta.requiredDocs : [];
  requiredDocs.forEach(function(doc) {
    _stage7PushCheck_(
      checks,
      `Required doc declared ${doc}`,
      requiredDocs.indexOf(doc) !== -1 ? 'OK' : 'FAIL',
      'Документ включено в metadata.requiredDocs',
      'Оновіть ProjectMetadata.gs'
    );
    _stage7PushCheck_(
      checks,
      `Required doc physical ${doc}`,
      _projectBundleHas_(doc) ? 'OK' : 'FAIL',
      _projectBundleHas_(doc) ? `present=${doc}` : `missing=${doc}`,
      'Вирівняйте bundle layout'
    );
  });

  const helperOk = typeof HtmlUtils_ === 'object'
    && typeof HtmlUtils_.escapeHtml === 'function'
    && typeof escapeHtml_ === 'function'
    && typeof _escapeHtml_ === 'function'
    && escapeHtml_('<b>') === HtmlUtils_.escapeHtml('<b>')
    && _escapeHtml_('<b>') === HtmlUtils_.escapeHtml('<b>');

  _stage7PushCheck_(
    checks,
    'Canonical HTML helper',
    helperOk ? 'OK' : 'FAIL',
    helperOk ? 'HtmlUtils_.escapeHtml() є source-of-truth, wrappers узгоджені' : 'Helper-layer розсинхронізований',
    helperOk ? '' : 'Перевірте HtmlUtils.gs / DeprecatedRegistry.gs'
  );

  return checks;
}
function runHistoricalStructuralDiagnosticsInternal_(options) {
  const opts = options || {};
  const checks = [];
  const warnings = [];
  const meta = typeof getProjectBundleMetadata_ === 'function' ? getProjectBundleMetadata_() : PROJECT_BUNDLE_METADATA_;
  const apiMap = typeof getStage4CanonicalApiMap_ === 'function' ? getStage4CanonicalApiMap_() : null;
  const routing = typeof getStage4ClientRoutingPolicy_ === 'function' ? getStage4ClientRoutingPolicy_() : null;

  _stage7PushCheck_(
    checks,
    'Canonical layer map',
    meta && meta.canonicalLayers ? 'OK' : 'FAIL',
    meta && meta.canonicalLayers ? JSON.stringify(meta.canonicalLayers) : 'canonicalLayers відсутній',
    'Оновіть ProjectMetadata.gs'
  );

  const canonicalLayerAliases = {
    applicationApi: ['applicationApi', 'sidebarApplicationApi'],
    maintenanceApi: ['maintenanceApi'],
    useCases: ['useCases'],
    workflow: ['workflow'],
    compatibility: ['compatibility', 'compatibilityFacade'],
    diagnostics: ['diagnostics'],
    tests: ['tests'],
    metadata: ['metadata']
  };

  Object.keys(canonicalLayerAliases).forEach(function(key) {
    const resolved = (canonicalLayerAliases[key] || [])
      .map(function(alias) { return meta && meta.canonicalLayers ? meta.canonicalLayers[alias] : ''; })
      .filter(Boolean)[0] || '';
    const ok = !!resolved;
    _stage7PushCheck_(checks, `Layer pointer ${key}`, ok ? 'OK' : 'FAIL', ok ? resolved : 'Не задано', 'Оновіть ProjectMetadata.gs');
  });

  ['application', 'maintenance', 'compatibility'].forEach(function(kind) {
    const list = apiMap && Array.isArray(apiMap[kind]) ? apiMap[kind] : [];
    _stage7PushCheck_(
      checks,
      `Canonical API map ${kind}`,
      list.length ? 'OK' : 'FAIL',
      list.length ? `entrypoints=${list.length}` : 'Список порожній',
      'Оновіть ProjectMetadata.gs'
    );

    list.forEach(function(fnName) {
      _stage7PushCheck_(
        checks,
        `Entrypoint ${fnName}`,
        _stage7HasFn_(fnName) ? 'OK' : 'FAIL',
        _stage7HasFn_(fnName) ? 'Доступний' : 'Не знайдено',
        'Перевірте відповідний файл API'
      );
    });
  });

  _stage7PushCheck_(
    checks,
    'Client routing policy map',
    routing && typeof routing === 'object' ? 'OK' : 'FAIL',
    routing && typeof routing === 'object' ? `routes=${Object.keys(routing).length}` : 'routing map відсутній',
    'Оновіть ProjectMetadata.gs'
  );

  Object.keys(routing || {}).forEach(function(action) {
    const fnName = routing[action];
    _stage7PushCheck_(
      checks,
      `Client route ${action} -> ${fnName}`,
      _stage7HasFn_(fnName) ? 'OK' : 'FAIL',
      _stage7HasFn_(fnName) ? 'Маршрут розвʼязується' : 'Target function не знайдено',
      'Вирівняйте JavaScript.html та server API'
    );
  });

  return {
    ok: checks.filter(function(item) { return item.status === 'FAIL'; }).length === 0,
    status: checks.some(function(item) { return item.status === 'FAIL'; }) ? 'FAIL' : 'OK',
    stage: (typeof getProjectBundleMetadata_ === 'function' ? getProjectBundleMetadata_().stageVersion : '7.1.2-final-clean'),
    mode: opts.mode || 'structural',
    checks: checks,
    warnings: warnings,
    summary: 'Historical structural lineage diagnostics завершено',
    ts: new Date().toISOString()
  };
}
function runHistoricalCompatibilityDiagnosticsInternal_(options) {
  const opts = options || {};
  const checks = [];
  const warnings = [];
  const registry = typeof getStage4CompatibilityMap_ === 'function' ? getStage4CompatibilityMap_() : [];

  _stage7PushCheck_(
    checks,
    'Compatibility registry',
    registry.length ? 'PSEUDO' : 'FAIL',
    registry.length ? `entries=${registry.length}` : 'Реєстр порожній',
    'Оновіть DeprecatedRegistry.gs'
  );

  registry.forEach(function(item) {
    const exists = _stage7HasFn_(item.name);
    _stage7PushCheck_(
      checks,
      `Compatibility function ${item.name}`,
      exists ? 'PSEUDO' : 'FAIL',
      exists ? `${item.scope || 'unknown scope'} -> ${item.replacement || ''}` : 'Функцію не знайдено',
      exists ? 'Нейтральний compatibility-only alias; не canonical-path' : 'Перевірте DeprecatedRegistry.gs / відповідний файл'
    );

    if (!exists || !item.verifySourceToken) return;
    try {
      const fn = _global_()[item.name];
      const src = typeof fn === 'function' ? String(fn) : '';
      const sourceOk = src.indexOf(item.verifySourceToken) !== -1;
      _stage7PushCheck_(
        checks,
        `Wrapper source ${item.name}`,
        sourceOk ? 'PSEUDO' : 'WARN',
        sourceOk ? `source -> ${item.verifySourceToken}` : 'Wrapper source не вказує на canonical replacement',
        'Перевірте, що wrapper лишається thin alias без нової бізнес-логіки'
      );
    } catch (e) {
      warnings.push(e && e.message ? e.message : String(e));
    }

    if (item.uiAllowed === false && item.scope === 'SidebarServer.gs') {
      _stage7PushCheck_(
        checks,
        `UI-ban marker ${item.name}`,
        item.status === 'compatibility-only' ? 'PSEUDO' : 'WARN',
        `uiAllowed=${item.uiAllowed}, status=${item.status}`,
        'Compatibility wrapper не повинен повертатися як canonical UI route'
      );
    }
  });

  return {
    ok: checks.filter(function(item) { return item.status === 'FAIL'; }).length === 0,
    status: checks.some(function(item) { return item.status === 'FAIL'; }) ? 'FAIL' : 'OK',
    stage: (typeof getProjectBundleMetadata_ === 'function' ? getProjectBundleMetadata_().stageVersion : '7.1.2-final-clean'),
    mode: opts.mode || 'compatibility',
    checks: checks,
    warnings: [...new Set(warnings)],
    summary: 'Historical compatibility lineage diagnostics завершено',
    ts: new Date().toISOString()
  };
}
function runHistoricalQuickDiagnosticsInternal_(options) {
  const opts = options || {};
  const structural = runHistoricalStructuralDiagnosticsInternal_({ mode: 'quick' });
  const checks = structural.checks.filter(function(item) {
    return String(item.name || '').indexOf('Entrypoint ') === 0
      || String(item.name || '').indexOf('Client route ') === 0
      || String(item.name || '').indexOf('Required doc marker ') === 0
      || item.name === 'Project bundle metadata'
      || item.name === 'Canonical HTML helper';
  });

  return {
    ok: checks.filter(function(item) { return item.status === 'FAIL'; }).length === 0,
    status: checks.some(function(item) { return item.status === 'FAIL'; }) ? 'FAIL' : 'OK',
    stage: (typeof getProjectBundleMetadata_ === 'function' ? getProjectBundleMetadata_().stageVersion : '7.1.2-final-clean'),
    mode: opts.mode || 'quick',
    checks: checks,
    warnings: [],
    summary: 'Historical quick lineage diagnostics завершено',
    ts: new Date().toISOString()
  };
}
function runHistoricalFullDiagnosticsInternal_(options) {
  const opts = options || {};
  const structural = runHistoricalStructuralDiagnosticsInternal_({ mode: 'full' });
  const compatibility = runHistoricalCompatibilityDiagnosticsInternal_({ mode: 'full' });
  const checks = []
    .concat(runStage41ProjectConsistencyCheck_())
    .concat(structural.checks || [])
    .concat(compatibility.checks || []);
  const warnings = stage7MergeWarnings_(structural.warnings || [], compatibility.warnings || []);

  return {
    ok: checks.filter(function(item) { return item.status === 'FAIL'; }).length === 0,
    status: checks.some(function(item) { return item.status === 'FAIL'; }) ? 'FAIL' : 'OK',
    stage: (typeof getProjectBundleMetadata_ === 'function' ? getProjectBundleMetadata_().stageVersion : '7.1.2-final-clean'),
    mode: opts.mode || 'full',
    checks: checks,
    warnings: warnings,
    summary: 'Historical full lineage diagnostics завершено',
    ts: new Date().toISOString()
  };
}

function runHistoricalStructuralDiagnosticsInternal_(options) {
  const opts = options || {};
  const checks = [];
  const warnings = [];
  const meta = typeof getProjectBundleMetadata_ === 'function' ? getProjectBundleMetadata_() : PROJECT_BUNDLE_METADATA_;
  const apiMap = typeof getCanonicalApiMap_ === 'function' ? getCanonicalApiMap_() : null;
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

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

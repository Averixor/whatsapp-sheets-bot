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

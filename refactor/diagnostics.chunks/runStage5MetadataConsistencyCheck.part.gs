function runStage5MetadataConsistencyCheck_() {
  const checks = [];
  const meta = typeof getProjectBundleMetadata_ === 'function' ? getProjectBundleMetadata_() : PROJECT_BUNDLE_METADATA_;
  const docs = typeof getProjectDocumentationMap_ === 'function' ? getProjectDocumentationMap_() : {};
  const maintenancePolicy = typeof getMaintenancePolicy_ === 'function' ? getMaintenancePolicy_() : (meta && meta.maintenanceLayerPolicy) || {};
  const release = typeof getProjectReleaseNaming_ === 'function' ? getProjectReleaseNaming_() : (meta && meta.release) || {};

  _stage7PushCheck_(checks, 'Project bundle metadata', meta ? 'OK' : 'FAIL', meta ? 'PROJECT_BUNDLE_METADATA_ доступний' : 'PROJECT_BUNDLE_METADATA_ не знайдено', meta ? '' : 'Додайте ProjectMetadata.gs');
  if (!meta) return checks;

  _stage7PushCheck_(checks, 'Release stage marker', String(meta.stage || '') === '7.1' ? 'OK' : 'FAIL', `stage=${meta.stage || 'n/a'}, stageVersion=${meta.stageVersion || 'n/a'}, label=${meta.stageLabel || 'n/a'}`, 'Оновіть ProjectMetadata.gs до Stage 7.1');
  _stage7PushCheck_(checks, 'Active baseline marker', meta.activeBaseline === 'stage7-1-2-final-clean-baseline' ? 'OK' : 'FAIL', `activeBaseline=${meta.activeBaseline || 'n/a'}`, 'Зафіксуйте Stage 7.1 як active baseline');
  _stage7PushCheck_(checks, 'Release archive naming', release && release.archiveFileName === 'gas_wasb_stage7_1_2_final_clean.zip' ? 'OK' : 'FAIL', release && release.archiveFileName ? release.archiveFileName : 'Не задано', 'Вирівняйте archive naming');
  _stage7PushCheck_(checks, 'Release root folder naming', release && release.rootFolderName === 'gas_wasb_stage7_1_2_final_clean' ? 'OK' : 'FAIL', release && release.rootFolderName ? release.rootFolderName : 'Не задано', 'Вирівняйте root folder naming');
  _stage7PushCheck_(checks, 'Packaging policy marker', meta.packagingPolicy && meta.packagingPolicy.policy === 'root-manifest-web-editor-only' ? 'OK' : 'FAIL', meta.packagingPolicy && meta.packagingPolicy.policy ? meta.packagingPolicy.policy : 'Не задано', 'Зафіксуйте web-editor-only packaging policy');
  _stage7PushCheck_(checks, 'Root manifest declared', meta.manifestIncluded === true ? 'OK' : 'FAIL', `manifestIncluded=${meta.manifestIncluded}`, 'Вирівняйте metadata');
  _stage7PushCheck_(checks, 'Root manifest physical', _projectBundleHas_((meta.packagingPolicy && meta.packagingPolicy.manifestPath) || 'appsscript.json') ? 'OK' : 'FAIL', _projectBundleHas_((meta.packagingPolicy && meta.packagingPolicy.manifestPath) || 'appsscript.json') ? ((meta.packagingPolicy && meta.packagingPolicy.manifestPath) || 'appsscript.json') : 'manifest missing', 'Додайте appsscript.json у root');
  _stage7PushCheck_(checks, 'Root clasp example omitted intentionally', (!meta.packagingPolicy || !meta.packagingPolicy.claspExamplePath || !_projectBundleHas_(meta.packagingPolicy.claspExamplePath)) ? 'OK' : 'WARN', (!meta.packagingPolicy || !meta.packagingPolicy.claspExamplePath || !_projectBundleHas_(meta.packagingPolicy.claspExamplePath)) ? 'web-editor-ready archive intentionally omits .clasp.json.example' : ('Unexpected optional clasp example present: ' + meta.packagingPolicy.claspExamplePath), 'Для web-editor bundle .clasp.json.example не потрібний');

  _stage7PushCheck_(checks, 'Maintenance layer marker', meta.maintenanceLayerStatus === 'stage7-canonical-maintenance-api' ? 'OK' : 'FAIL', `maintenanceLayerStatus=${meta.maintenanceLayerStatus || 'n/a'}`, 'Позначте canonical maintenance layer у metadata');
  _stage7PushCheck_(checks, 'Compatibility policy marker', meta.compatibilityPolicyMarker === 'stage7-compatible' ? 'OK' : 'WARN', `compatibilityPolicyMarker=${meta.compatibilityPolicyMarker || 'n/a'}`, 'Зафіксуйте Stage 7 compatibility marker');
  _stage7PushCheck_(checks, 'Sunset policy marker', meta.sunsetPolicyMarker === 'stage7-sunset-governed' ? 'OK' : 'WARN', `sunsetPolicyMarker=${meta.sunsetPolicyMarker || 'n/a'}`, 'Зафіксуйте Stage 7 sunset policy marker');

  _stage7PushCheck_(checks, 'Canonical maintenance file', maintenancePolicy && maintenancePolicy.canonicalFile === 'Stage7MaintenanceApi.gs' ? 'OK' : 'FAIL', maintenancePolicy && maintenancePolicy.canonicalFile ? maintenancePolicy.canonicalFile : 'Не задано', 'Оновіть maintenance policy');
  _stage7PushCheck_(checks, 'Compatibility maintenance facade', maintenancePolicy && maintenancePolicy.compatibilityFile === 'LegacyMaintenanceAliases.gs' ? 'OK' : 'WARN', maintenancePolicy && maintenancePolicy.compatibilityFile ? maintenancePolicy.compatibilityFile : 'Не задано', 'Явно позначте compatibility facade');

  const clientRuntimePolicy = meta && meta.clientRuntimePolicy || {};
  _stage7PushCheck_(checks, 'Client runtime file', clientRuntimePolicy.runtimeFile === 'JavaScript.html' ? 'OK' : 'FAIL', clientRuntimePolicy.runtimeFile || 'Не задано', 'Зафіксуйте JavaScript.html як canonical runtime');
  _stage7PushCheck_(checks, 'Client bootstrap mode', clientRuntimePolicy.bootstrapMode === 'sidebar-includeTemplate' ? 'OK' : 'FAIL', clientRuntimePolicy.bootstrapMode || 'Не задано', 'Використовуйте Sidebar.html -> includeTemplate(\'JavaScript\')');
  _stage7PushCheck_(checks, 'Client modular status', clientRuntimePolicy.modularStatus === 'active-js-include-chain' ? 'OK' : 'WARN', clientRuntimePolicy.modularStatus || 'Не задано', 'Позначте Js.*.html як non-active experimental/reference artifacts');
  _stage7PushCheck_(checks, 'Diagnostics wording policy', meta.diagnosticsPolicy && meta.diagnosticsPolicy.wording === 'stage7-1-2-final-clean-baseline' ? 'OK' : 'WARN', meta.diagnosticsPolicy && meta.diagnosticsPolicy.wording ? meta.diagnosticsPolicy.wording : 'Не задано', 'Зафіксуйте Stage 7.1 diagnostics wording policy');

  const requiredDocs = Array.isArray(meta.requiredDocs) ? meta.requiredDocs : [];
  requiredDocs.forEach(function(doc) {
    _stage7PushCheck_(checks, `Required doc declared ${doc}`, requiredDocs.indexOf(doc) !== -1 ? 'OK' : 'FAIL', 'Документ включено в metadata.requiredDocs', 'Оновіть ProjectMetadata.gs');
    _stage7PushCheck_(checks, `Required doc physical ${doc}`, _projectBundleHas_(doc) ? 'OK' : 'FAIL', _projectBundleHas_(doc) ? `present=${doc}` : `missing=${doc}`, 'Вирівняйте bundle layout');
  });

  const activeDocs = docs && docs.active ? Object.values(docs.active) : [];
  activeDocs.forEach(function(doc) {
    _stage7PushCheck_(checks, `Active doc path ${doc}`, String(doc || '').indexOf('_extras/') !== 0 ? 'OK' : 'FAIL', doc, 'Active docs мають лежати в корені bundle');
    _stage7PushCheck_(checks, `Active doc physical ${doc}`, _projectBundleHas_(doc) ? 'OK' : 'FAIL', _projectBundleHas_(doc) ? `present=${doc}` : `missing=${doc}`, 'Вирівняйте bundle layout');
  });

    const historicalDocs = Array.isArray(docs.historical) ? docs.historical : [];
  historicalDocs.forEach(function(doc) {
    _stage7PushCheck_(checks, `Historical doc path ${doc}`, String(doc || '').indexOf('_extras/history/') === 0 ? 'OK' : 'FAIL', doc, 'Historical docs мають лежати в _extras/history/');
  });

  ['README.md', 'ARCHITECTURE.md', 'RUNBOOK.md', 'SECURITY.md', 'CHANGELOG.md'].forEach(function(doc) {
    _stage7PushCheck_(checks, `Canonical reference doc ${doc}`, _projectBundleHas_(doc) ? 'OK' : 'FAIL', _projectBundleHas_(doc) ? `present=${doc}` : `missing=${doc}`, 'Відновіть canonical docs у root');
  });

  const helperOk = typeof HtmlUtils_ === 'object'
    && typeof HtmlUtils_.escapeHtml === 'function'
    && typeof escapeHtml_ === 'function'
    && typeof _escapeHtml_ === 'function'
    && escapeHtml_('<b>') === HtmlUtils_.escapeHtml('<b>')
    && _escapeHtml_('<b>') === HtmlUtils_.escapeHtml('<b>');

  _stage7PushCheck_(checks, 'Canonical HTML helper', helperOk ? 'OK' : 'FAIL', helperOk ? 'HtmlUtils_.escapeHtml() є source-of-truth, wrappers узгоджені' : 'Helper-layer розсинхронізований', helperOk ? '' : 'Перевірте HtmlUtils.gs / DeprecatedRegistry.gs');

  return checks;
}

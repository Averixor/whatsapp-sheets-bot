function _releaseStageLabel_() {
  var meta = typeof getProjectBundleMetadata_ === 'function' ? getProjectBundleMetadata_() : null;
  return meta && meta.stageLabel ? meta.stageLabel : 'Stage 7.1.2 — Security & Ops Hardened Baseline (Final Clean)';
}

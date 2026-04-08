function _projectBundleMissing_(paths) {
  return typeof getMissingProjectBundleFiles_ === 'function' ? getMissingProjectBundleFiles_(paths || []) : (paths || []).slice();
}

function _projectBundleHas_(path) {
  return typeof isProjectBundleFilePresent_ === 'function' ? isProjectBundleFilePresent_(path) : false;
}

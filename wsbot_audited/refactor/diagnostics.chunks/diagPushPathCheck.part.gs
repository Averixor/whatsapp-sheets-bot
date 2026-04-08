function _diagPushPathCheck_(checks, name, path, expectedKind) {
  const present = _projectBundleHas_(path);
  _stage7PushCheck_(
    checks,
    name,
    present ? 'OK' : 'FAIL',
    present ? `${expectedKind}: ${path}` : `${expectedKind} missing: ${path}`,
    present ? '' : `Відсутній файл ${path}`
  );
}

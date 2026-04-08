function _isProjectDocPath_(path) {
  const value = String(path || '').trim();
  if (!value) return false;
  if (/^[A-Z0-9_\-]+\.md$/i.test(value)) return true;
  return value.indexOf('_extras/history/') === 0;
}

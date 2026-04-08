function _errMsg_(e) {
  try {
    return String(e && e.message ? e.message : e);
  } catch (_) {
    return String(e);
  }
}

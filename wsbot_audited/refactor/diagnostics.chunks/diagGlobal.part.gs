function _diagGlobal_() {
  try {
    if (typeof globalThis !== 'undefined') return globalThis;
  } catch (_) {}
  try {
    return Function('return this')();
  } catch (_) {}
  return {};
}

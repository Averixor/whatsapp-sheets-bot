function _diagAppendCompatibilitySplitCheck_(checks) {
  try {
    var sunset = typeof getCompatibilitySunsetReport_ === 'function' ? getCompatibilitySunsetReport_() : { total: 0, counts: {} };
    _stage7PushCheck_(checks, 'Compatibility split report (informational)', 'PSEUDO', 'retained=' + (sunset.total || 0), 'Compatibility wrappers intentionally remain until explicit sunset plan');
  } catch (e) {
    _stage7PushCheck_(checks, 'Compatibility split report (informational)', 'WARN', e && e.message ? e.message : String(e), 'Перевірте DeprecatedRegistry.gs');
  }
}

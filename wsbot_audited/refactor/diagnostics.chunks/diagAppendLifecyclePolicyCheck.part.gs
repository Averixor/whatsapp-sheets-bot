function _diagAppendLifecyclePolicyCheck_(checks) {
  try {
    var policy = typeof OperationRepository_ === 'object' && typeof OperationRepository_.buildLifecyclePolicyReport === 'function'
      ? OperationRepository_.buildLifecyclePolicyReport()
      : null;
    _stage7PushCheck_(checks, 'Lifecycle policy report', policy ? 'OK' : 'FAIL', policy ? ('ttlScenarios=' + (policy.ttlScenarios || 0) + ', sheets=' + ((policy.serviceSheets || []).join(', '))) : 'Недоступно', policy ? '' : 'Перевірте OperationRepository_.buildLifecyclePolicyReport()');
  } catch (e) {
    _stage7PushCheck_(checks, 'Lifecycle policy report', 'FAIL', e && e.message ? e.message : String(e), 'Перевірте OperationRepository_.buildLifecyclePolicyReport()');
  }
}

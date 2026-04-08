function _diagAppendPendingRepairsCheck_(checks) {
  try {
    var pending = typeof OperationRepository_ === 'object' && typeof OperationRepository_.listPendingRepairs === 'function'
      ? OperationRepository_.listPendingRepairs({ limit: 25 })
      : { operations: [] };
    _stage7PushCheck_(checks, 'Pending repairs visibility', pending && Array.isArray(pending.operations) ? 'OK' : 'WARN', pending && Array.isArray(pending.operations) ? ('visible=' + pending.operations.length) : 'Недоступно', pending && Array.isArray(pending.operations) ? '' : 'Перевірте OperationRepository_.listPendingRepairs()');
  } catch (e) {
    _stage7PushCheck_(checks, 'Pending repairs visibility', 'FAIL', e && e.message ? e.message : String(e), 'Перевірте OperationRepository_.listPendingRepairs()');
  }
}

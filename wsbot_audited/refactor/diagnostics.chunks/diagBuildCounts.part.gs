function _diagBuildCounts_(checks) {
  var list = Array.isArray(checks) ? checks : [];
  var counts = {
    total: list.length,
    ok: 0,
    pseudo: 0,
    warnings: 0,
    failures: 0,
    byStatus: {
      OK: 0,
      PSEUDO: 0,
      WARN: 0,
      FAIL: 0
    },
    byUiGroup: {
      ok: 0,
      pseudo: 0,
      warnings: 0,
      critical: 0
    }
  };

  list.forEach(function(item) {
    var normalized = _diagNormalizeCheck_(item);
    var status = normalized.status;
    var uiGroup = normalized.uiGroup || 'ok';

    if (status === 'OK') counts.ok += 1;
    else if (status === 'PSEUDO') counts.pseudo += 1;
    else if (status === 'WARN') counts.warnings += 1;
    else if (status === 'FAIL') counts.failures += 1;

    if (counts.byStatus[status] === undefined) counts.byStatus[status] = 0;
    counts.byStatus[status] += 1;

    if (counts.byUiGroup[uiGroup] === undefined) counts.byUiGroup[uiGroup] = 0;
    counts.byUiGroup[uiGroup] += 1;
  });

  return counts;
}

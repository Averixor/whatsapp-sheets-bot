function _diagNormalizeReportChecks_(report, titlePrefix) {
  var list = report && Array.isArray(report.checks) ? report.checks : [];
  return list.map(function(item) {
    return _diagNormalizeCheck_(item, titlePrefix || '');
  });
}

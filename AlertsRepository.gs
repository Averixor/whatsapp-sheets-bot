/**
 * AlertsRepository.gs — lightweight alerts journal.
 */

const AlertsRepository_ = (function() {
  function _sheet() {
    const ss = SpreadsheetApp.getActive();
    const name = appGetCore('ALERTS_SHEET', 'ALERTS_LOG');
    let sh = ss.getSheetByName(name);
    if (!sh) {
      sh = ss.insertSheet(name);
      sh.getRange(1, 1, 1, 5).setValues([['Timestamp', 'JobName', 'Severity', 'Message', 'DetailsJson']]);
      sh.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#fde68a');
      sh.setFrozenRows(1);
    }
    return sh;
  }

  function appendAlert(record) {
    const item = Object.assign({ severity: 'warning' }, record || {});
    const sh = _sheet();
    sh.appendRow([
      item.timestamp || new Date(),
      item.jobName || '',
      item.severity || 'warning',
      item.message || '',
      stage4SafeStringify_(item.details || {}, 9000)
    ]);
    return { success: true, written: 1, sheet: sh.getName() };
  }

  return {
    appendAlert: appendAlert
  };
})();

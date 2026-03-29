/**
 * AlertsRepository.gs — structured alerts journal.
 */

const AlertsRepository_ = (function() {
  const HEADERS = ['Timestamp', 'Type', 'Severity', 'Action', 'Outcome', 'Role', 'DisplayName', 'UserKey', 'Email', 'Source', 'Message', 'DetailsJson'];

  function _sheet() {
    const ss = SpreadsheetApp.getActive();
    const name = appGetCore('ALERTS_SHEET', 'ALERTS_LOG');
    let sh = ss.getSheetByName(name);
    if (!sh) {
      sh = ss.insertSheet(name);
    }
    _ensureSchema_(sh);
    return sh;
  }

  function _ensureSchema_(sh) {
    const existing = sh.getLastRow() >= 1 ? sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), HEADERS.length)).getValues()[0] : [];
    let changed = false;
    for (let i = 0; i < HEADERS.length; i++) {
      if (String(existing[i] || '').trim() !== HEADERS[i]) {
        sh.getRange(1, i + 1).setValue(HEADERS[i]);
        changed = true;
      }
    }
    if (changed || sh.getFrozenRows() < 1) {
      sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#fde68a');
      sh.setFrozenRows(1);
    }
  }

  function ensureSheet() {
    const sh = _sheet();
    return { success: true, sheet: sh.getName(), lastRow: sh.getLastRow(), lastColumn: sh.getLastColumn(), headers: HEADERS.slice() };
  }

  function appendAlert(record) {
    const item = Object.assign({ severity: 'warning' }, record || {});
    const sh = _sheet();
    sh.appendRow([
      item.timestamp || new Date(),
      item.type || item.jobName || '',
      item.severity || 'warning',
      item.action || item.actionName || '',
      item.outcome || '',
      item.role || '',
      item.displayName || '',
      item.userKey || item.currentKey || '',
      item.email || '',
      item.source || '',
      item.message || '',
      stage7SafeStringify_(item.details || {}, 9000)
    ]);
    return { success: true, written: 1, sheet: sh.getName() };
  }

  return {
    ensureSheet: ensureSheet,
    appendAlert: appendAlert,
    HEADERS: HEADERS.slice()
  };
})();

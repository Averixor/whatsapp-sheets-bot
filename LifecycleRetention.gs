/**
 * LifecycleRetention.gs — retention cleanup for LOG and AUDIT_LOG sheets.
 */

function _cleanupSheetByAge_(sheetName, headerRow, retentionDays) {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(String(sheetName || '').trim());
  if (!sh) {
    return { sheet: String(sheetName || ''), found: false, removed: 0, kept: 0, retentionDays: Number(retentionDays || 0) };
  }

  const startRow = Math.max(Number(headerRow || 1) + 1, 2);
  const lastRow = sh.getLastRow();
  if (lastRow < startRow) {
    return { sheet: sheetName, found: true, removed: 0, kept: 0, retentionDays: Number(retentionDays || 0) };
  }

  const cutoffMs = Date.now() - (Math.max(Number(retentionDays || 0), 0) * 24 * 60 * 60 * 1000);
  const values = sh.getRange(startRow, 1, lastRow - startRow + 1, 1).getValues();
  const rowsToDelete = [];
  let kept = 0;

  values.forEach(function(row, index) {
    const raw = row[0];
    const parsed = raw instanceof Date ? raw : new Date(raw);
    if (Number.isFinite(parsed.getTime()) && parsed.getTime() < cutoffMs) {
      rowsToDelete.push(startRow + index);
    } else {
      kept += 1;
    }
  });

  for (let i = rowsToDelete.length - 1; i >= 0; i--) {
    try {
      sh.deleteRow(rowsToDelete[i]);
    } catch (_) {}
  }

  return {
    sheet: sheetName,
    found: true,
    removed: rowsToDelete.length,
    kept: kept,
    retentionDays: Number(retentionDays || 0)
  };
}

function cleanupLogsAndAuditRetention_(options) {
  const opts = Object.assign({}, options || {});
  const logRetentionDays = Number(opts.logRetentionDays || appGetCore('LOG_RETENTION_DAYS', 60)) || 60;
  const auditRetentionDays = Number(opts.auditRetentionDays || appGetCore('AUDIT_RETENTION_DAYS', 180)) || 180;
  const log = _cleanupSheetByAge_(CONFIG.LOG_SHEET || 'LOG', 1, logRetentionDays);
  const audit = _cleanupSheetByAge_(STAGE7_CONFIG.AUDIT_SHEET || 'AUDIT_LOG', STAGE7_CONFIG.AUDIT_HEADER_ROW || 1, auditRetentionDays);
  return {
    log: log,
    audit: audit,
    removed: Number(log.removed || 0) + Number(audit.removed || 0)
  };
}

/**
 * AuditTrail.gs — розширений audit/logging helper для stage 4.
 */

function ensureAuditTrailSheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(STAGE4_CONFIG.AUDIT_SHEET);
  const headers = [[
    'Timestamp', 'OperationId', 'Scenario', 'Level', 'Status', 'Initiator',
    'DryRun', 'Partial', 'AffectedSheets', 'AffectedEntities',
    'AppliedChanges', 'SkippedChanges', 'Warnings',
    'PayloadJson', 'BeforeJson', 'AfterJson', 'ChangesJson',
    'DiagnosticsJson', 'Message', 'Error'
  ]];

  if (!sh) {
    sh = ss.insertSheet(STAGE4_CONFIG.AUDIT_SHEET);
  }

  if (sh.getLastRow() < STAGE4_CONFIG.AUDIT_HEADER_ROW) {
    sh.getRange(STAGE4_CONFIG.AUDIT_HEADER_ROW, 1, 1, headers[0].length).setValues(headers);
    sh.getRange(STAGE4_CONFIG.AUDIT_HEADER_ROW, 1, 1, headers[0].length)
      .setFontWeight('bold')
      .setBackground('#e8eaed');
    sh.setFrozenRows(STAGE4_CONFIG.AUDIT_HEADER_ROW);
  }

  return sh;
}

const Stage4AuditTrail_ = (function() {
  function _rowFromEntry(entry) {
    const e = entry || {};
    return [
      e.timestamp || new Date(),
      e.operationId || '',
      e.scenario || '',
      e.level || 'AUDIT',
      e.status || '',
      e.initiator || '',
      !!e.dryRun,
      !!e.partial,
      stage4AsArray_(e.affectedSheets).join(', '),
      stage4AsArray_(e.affectedEntities).join(', '),
      Number(e.appliedChangesCount) || 0,
      Number(e.skippedChangesCount) || 0,
      stage4AsArray_(e.warnings).join(' | '),
      stage4SafeStringify_(e.payload, 12000),
      stage4SafeStringify_(e.before, 12000),
      stage4SafeStringify_(e.after, 12000),
      stage4SafeStringify_(e.changes, 12000),
      stage4SafeStringify_(e.diagnostics, 12000),
      String(e.message || ''),
      e.error ? String(e.error) : ''
    ];
  }

  function record(entry) {
    return recordBatch([entry]);
  }

  function recordBatch(entries) {
    const items = stage4AsArray_(entries).filter(Boolean);
    if (!items.length) return { written: 0, sheet: STAGE4_CONFIG.AUDIT_SHEET };
    const sh = ensureAuditTrailSheet_();
    const rows = items.map(_rowFromEntry);
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    return {
      written: rows.length,
      sheet: STAGE4_CONFIG.AUDIT_SHEET
    };
  }

  function writeCompactLegacyLog(entry) {
    try {
      const e = entry || {};
      return LogsRepository_.writeBatch([{
        timestamp: e.timestamp || new Date(),
        reportDateStr: (e.context && e.context.date) || (e.context && e.context.dateStr) || _todayStr_(),
        sheet: stage4AsArray_(e.affectedSheets)[0] || '',
        cell: e.operationId || '',
        fio: stage4AsArray_(e.affectedEntities)[0] || '',
        phone: '',
        code: '',
        service: '',
        place: '',
        tasks: '',
        message: `[${e.level || 'AUDIT'}] ${e.scenario || ''} :: ${e.message || ''}`.trim(),
        link: ''
      }]);
    } catch (err) {
      return errorResponse_(err, { function: 'Stage4AuditTrail_.writeCompactLegacyLog' });
    }
  }

  return {
    ensureSheet: ensureAuditTrailSheet_,
    record: record,
    recordBatch: recordBatch,
    writeCompactLegacyLog: writeCompactLegacyLog
  };
})();
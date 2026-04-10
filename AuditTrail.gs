/**
 * AuditTrail.gs — hardened audit/logging helper for stage 7.
 *
 * Призначення:
 * - структурований audit-log у лист AUDIT_LOG
 * - одиночний і batch запис
 * - compact legacy log через LogsRepository_
 * - зворотна сумісність через ensureAuditTrailSheet_()
 *
 * Принципи:
 * - м'яка деградація, якщо optional helper-и відсутні
 * - безпечна серіалізація
 * - lock для write-path
 * - мінімально агресивний repair header row
 */

const Stage7AuditTrail_ = (function () {
  const DEFAULT_AUDIT_SHEET = 'AUDIT_LOG';
  const DEFAULT_HEADER_ROW = 1;
  const DEFAULT_LEVEL = 'AUDIT';
  const MAX_JSON_LENGTH = 12000;
  const LOCK_TIMEOUT_MS = 30000;

  const HEADERS = [
    'Timestamp',
    'OperationId',
    'Scenario',
    'Level',
    'Status',
    'Initiator',
    'DryRun',
    'Partial',
    'AffectedSheets',
    'AffectedEntities',
    'AppliedChanges',
    'SkippedChanges',
    'Warnings',
    'PayloadJson',
    'BeforeJson',
    'AfterJson',
    'ChangesJson',
    'DiagnosticsJson',
    'Message',
    'Error'
  ];

  function _getConfig_() {
    if (typeof STAGE7_CONFIG !== 'undefined' && STAGE7_CONFIG) {
      return STAGE7_CONFIG;
    }
    return {
      AUDIT_SHEET: DEFAULT_AUDIT_SHEET,
      AUDIT_HEADER_ROW: DEFAULT_HEADER_ROW
    };
  }

  function _normalizeSheetName_(value) {
    const raw = String(value == null ? '' : value).trim();
    if (!raw) return DEFAULT_AUDIT_SHEET;

    // У Sheets заборонені деякі символи, а ще не треба диких довжин.
    const cleaned = raw.replace(/[\[\]\*\?:\/\\]/g, '_').substring(0, 99).trim();
    return cleaned || DEFAULT_AUDIT_SHEET;
  }

  function _normalizeHeaderRow_(value) {
    const row = Number(value);
    if (!isFinite(row)) return DEFAULT_HEADER_ROW;
    if (row < 1) return DEFAULT_HEADER_ROW;
    return Math.floor(row);
  }

  function _getSheetConfig_() {
    const cfg = _getConfig_();
    return {
      sheetName: _normalizeSheetName_(cfg.AUDIT_SHEET),
      headerRow: _normalizeHeaderRow_(cfg.AUDIT_HEADER_ROW)
    };
  }

  function _asArray_(value) {
    if (typeof stage7AsArray_ === 'function') {
      try {
        return stage7AsArray_(value);
      } catch (_) {}
    }

    if (value == null || value === '') return [];
    if (Array.isArray(value)) return value.slice();
    return [String(value)];
  }

  function _toBoolean_(value) {
    return value === true;
  }

  function _toCount_(value) {
    const n = Number(value);
    return isFinite(n) && n > 0 ? Math.floor(n) : 0;
  }

  function _truncate_(str, maxLength) {
    const s = String(str == null ? '' : str);
    const limit = Number(maxLength) || MAX_JSON_LENGTH;
    return s.length > limit ? s.substring(0, limit) + '…[truncated]' : s;
  }

  function _safeStringify_(obj, maxLength) {
    const limit = Number(maxLength) || MAX_JSON_LENGTH;

    if (typeof stage7SafeStringify_ === 'function') {
      try {
        return stage7SafeStringify_(obj, limit);
      } catch (_) {}
    }

    try {
      const json = JSON.stringify(obj);
      if (typeof json !== 'string') return '';
      return _truncate_(json, limit);
    } catch (e) {
      const errMsg = e && e.message ? e.message : String(e);
      return '{"error":"' + errMsg.replace(/"/g, '\\"') + '"}';
    }
  }

  function _safeErrorString_(value) {
    if (!value) return '';
    if (value instanceof Error) {
      return value.stack || value.message || String(value);
    }
    return String(value);
  }

  function _sanitizeEntry_(entry) {
    if (!entry || typeof entry !== 'object') return {};

    if (
      typeof SecurityRedaction_ === 'object' &&
      SecurityRedaction_ &&
      typeof SecurityRedaction_.sanitizeAuditEntry === 'function'
    ) {
      try {
        return SecurityRedaction_.sanitizeAuditEntry(entry);
      } catch (_) {}
    }

    return entry;
  }

  function _todayStr_() {
    try {
      const tz = Session.getScriptTimeZone() || 'UTC';
      return Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
    } catch (_) {
      return new Date().toISOString().slice(0, 10);
    }
  }

  function _now_() {
    return new Date();
  }

  function _getSpreadsheet_() {
    const ss = SpreadsheetApp.getActive();
    if (!ss) {
      throw new Error('Active spreadsheet is not available');
    }
    return ss;
  }

  function _getOrCreateSheet_() {
    const cfg = _getSheetConfig_();
    const ss = _getSpreadsheet_();

    let sh = ss.getSheetByName(cfg.sheetName);
    if (!sh) {
      sh = ss.insertSheet(cfg.sheetName);
      Logger.log('[Stage7AuditTrail] Created sheet: ' + cfg.sheetName);
    }
    return sh;
  }

  function _readHeaderRow_(sheet, headerRow) {
    const width = Math.max(sheet.getLastColumn(), HEADERS.length, 1);
    return sheet.getRange(headerRow, 1, 1, width).getValues()[0];
  }

  function _isHeaderValid_(sheet, headerRow) {
    if (sheet.getLastRow() < headerRow) return false;

    const existing = _readHeaderRow_(sheet, headerRow);
    for (let i = 0; i < HEADERS.length; i++) {
      if (String(existing[i] || '').trim() !== HEADERS[i]) {
        return false;
      }
    }
    return true;
  }

  function _ensureHeader_(sheet, headerRow) {
    const valid = _isHeaderValid_(sheet, headerRow);
    if (valid) return false;

    sheet.getRange(headerRow, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.getRange(headerRow, 1, 1, HEADERS.length)
      .setFontWeight('bold')
      .setBackground('#e8eaed');

    if (sheet.getFrozenRows() !== headerRow) {
      sheet.setFrozenRows(headerRow);
    }

    return true;
  }

  function _ensureSheet_() {
    const cfg = _getSheetConfig_();
    const sh = _getOrCreateSheet_();
    _ensureHeader_(sh, cfg.headerRow);
    return sh;
  }

  function _normalizeEntry_(entry) {
    const e = _sanitizeEntry_(entry || {});
    return {
      timestamp: e.timestamp || _now_(),
      operationId: String(e.operationId || ''),
      scenario: String(e.scenario || ''),
      level: String(e.level || DEFAULT_LEVEL),
      status: String(e.status || ''),
      initiator: String(e.initiator || ''),
      dryRun: _toBoolean_(e.dryRun),
      partial: _toBoolean_(e.partial),
      affectedSheets: _asArray_(e.affectedSheets),
      affectedEntities: _asArray_(e.affectedEntities),
      appliedChangesCount: _toCount_(e.appliedChangesCount),
      skippedChangesCount: _toCount_(e.skippedChangesCount),
      warnings: _asArray_(e.warnings),
      payload: e.payload,
      before: e.before,
      after: e.after,
      changes: e.changes,
      diagnostics: e.diagnostics,
      message: String(e.message || ''),
      error: _safeErrorString_(e.error),
      context: e.context || {}
    };
  }

  function _rowFromEntry_(entry) {
    const e = _normalizeEntry_(entry);

    return [
      e.timestamp,
      e.operationId,
      e.scenario,
      e.level,
      e.status,
      e.initiator,
      e.dryRun,
      e.partial,
      e.affectedSheets.join(', '),
      e.affectedEntities.join(', '),
      e.appliedChangesCount,
      e.skippedChangesCount,
      e.warnings.join(' | '),
      _safeStringify_(e.payload, MAX_JSON_LENGTH),
      _safeStringify_(e.before, MAX_JSON_LENGTH),
      _safeStringify_(e.after, MAX_JSON_LENGTH),
      _safeStringify_(e.changes, MAX_JSON_LENGTH),
      _safeStringify_(e.diagnostics, MAX_JSON_LENGTH),
      e.message,
      e.error
    ];
  }

  function _rowsFromEntries_(entries) {
    const items = _asArray_(entries).filter(function (item) {
      return !!item;
    });

    const rows = new Array(items.length);
    for (let i = 0; i < items.length; i++) {
      rows[i] = _rowFromEntry_(items[i]);
    }
    return rows;
  }

  function _withDocumentLock_(fn) {
    const lock = LockService.getDocumentLock();
    lock.waitLock(LOCK_TIMEOUT_MS);
    try {
      return fn();
    } finally {
      lock.releaseLock();
    }
  }

  function _appendRows_(rows) {
    if (!rows || !rows.length) {
      return {
        success: true,
        written: 0,
        sheet: _getSheetConfig_().sheetName
      };
    }

    return _withDocumentLock_(function () {
      const sh = _ensureSheet_();
      const targetRow = Math.max(sh.getLastRow() + 1, _getSheetConfig_().headerRow + 1);
      sh.getRange(targetRow, 1, rows.length, rows[0].length).setValues(rows);

      return {
        success: true,
        written: rows.length,
        sheet: sh.getName(),
        fromRow: targetRow,
        toRow: targetRow + rows.length - 1
      };
    });
  }

  function ensureSheet() {
    try {
      const sh = _withDocumentLock_(function () {
        return _ensureSheet_();
      });

      return {
        success: true,
        sheet: sh.getName(),
        lastRow: sh.getLastRow(),
        headers: HEADERS.slice()
      };
    } catch (e) {
      const errMsg = e && e.message ? e.message : String(e);
      Logger.log('[Stage7AuditTrail] ensureSheet error: ' + errMsg);
      return {
        success: false,
        error: errMsg
      };
    }
  }

  function record(entry) {
    if (!entry) {
      return {
        success: false,
        error: 'Entry is empty',
        written: 0
      };
    }

    try {
      return _appendRows_([_rowFromEntry_(entry)]);
    } catch (e) {
      const errMsg = e && e.message ? e.message : String(e);
      Logger.log('[Stage7AuditTrail] record error: ' + errMsg);
      return {
        success: false,
        error: errMsg,
        written: 0
      };
    }
  }

  function recordBatch(entries) {
    try {
      const rows = _rowsFromEntries_(entries);
      return _appendRows_(rows);
    } catch (e) {
      const errMsg = e && e.message ? e.message : String(e);
      Logger.log('[Stage7AuditTrail] recordBatch error: ' + errMsg);
      return {
        success: false,
        error: errMsg,
        written: 0
      };
    }
  }

  function writeCompactLegacyLog(entry) {
    try {
      if (
        typeof LogsRepository_ !== 'object' ||
        !LogsRepository_ ||
        typeof LogsRepository_.writeBatch !== 'function'
      ) {
        Logger.log('[Stage7AuditTrail] LogsRepository_.writeBatch not available');
        return {
          success: false,
          error: 'LogsRepository not available'
        };
      }

      const e = _normalizeEntry_(entry || {});
      const dateStr = e.context.date || e.context.dateStr || _todayStr_();

      const legacyRow = {
        timestamp: e.timestamp || _now_(),
        reportDateStr: dateStr,
        sheet: e.affectedSheets[0] || '',
        cell: e.operationId || '',
        fio: e.affectedEntities[0] || '',
        phone: '',
        code: '',
        service: '',
        place: '',
        tasks: '',
        message: _truncate_(
          ('[' + (e.level || DEFAULT_LEVEL) + '] ' + (e.scenario || '') + ' :: ' + (e.message || '')).trim(),
          1000
        ),
        link: ''
      };

      return LogsRepository_.writeBatch([legacyRow]);
    } catch (err) {
      const errMsg = err && err.message ? err.message : String(err);
      Logger.log('[Stage7AuditTrail] writeCompactLegacyLog error: ' + errMsg);
      return {
        success: false,
        error: errMsg
      };
    }
  }

  return {
    ensureSheet: ensureSheet,
    record: record,
    recordBatch: recordBatch,
    writeCompactLegacyLog: writeCompactLegacyLog
  };
})();

/**
 * Глобальна compatibility-обгортка
 */
function ensureAuditTrailSheet_() {
  const result = Stage7AuditTrail_.ensureSheet();
  if (!result.success) {
    throw new Error(result.error);
  }
  return SpreadsheetApp.getActive().getSheetByName(result.sheet);
}

/**
 * AlertsRepository.gs — structured alerts journal.
 *
 * Принципы:
 * - без setTimeout / in-memory очередей;
 * - быстрый single insert через setValues;
 * - batch insert через setValues;
 * - автоочистка по количеству строк;
 * - ручная очистка по возрасту;
 * - чтение последних записей с конца;
 * - защита от ручной сортировки при clearAlerts().
 */

  // ==================== CONSTANTS ====================

const AlertsRepository_ = (function () {

  const HEADERS = [
    'Timestamp',
    'Type',
    'Severity',
    'Action',
    'Outcome',
    'Role',
    'DisplayName',
    'UserKey',
    'Email',
    'Source',
    'Message',
    'DetailsJson'
  ];

  const MAX_ROWS = 1000;
  const CLEANUP_KEEP_ROWS = 500;
  const MAX_MESSAGE_LENGTH = 500;
  const MAX_DETAILS_LENGTH = 4000;
  const DEFAULT_CLEAR_DAYS = 30;

  const MIN_LIMIT = 1;
  const DEFAULT_LIMIT_RECENT = 50;
  const DEFAULT_LIMIT_FILTER = 100;
  const MAX_LIMIT = 1000;

  let _schemaChecked = false;

  // ==================== INTERNAL HELPERS ====================

  function _getSheetName_() {
    if (typeof appGetCore === 'function') {
      return appGetCore('ALERTS_LOG_SHEET', 'ALERTS_LOG');
    }
    return 'ALERTS_LOG';
  }

  function _getSheet_() {
    const ss = SpreadsheetApp.getActive();
    const name = _getSheetName_();
    let sh = ss.getSheetByName(name);

    if (!sh) {
      sh = ss.insertSheet(name);
      Logger.log('[AlertsRepository] Sheet created: ' + name);
      _ensureSchema_(sh);
      _schemaChecked = true;
      return sh;
    }

    if (!_schemaChecked) {
      _ensureSchema_(sh);
      _schemaChecked = true;
    }

    return sh;
  }

  function _ensureSchema_(sh) {
    const lastCol = Math.max(sh.getLastColumn(), HEADERS.length);
    let existingHeaders = [];

    if (sh.getLastRow() >= 1) {
      existingHeaders = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    }

    let changed = false;

    for (let i = 0; i < HEADERS.length; i++) {
      const current = String(existingHeaders[i] || '').trim();
      if (current !== HEADERS[i]) {
        sh.getRange(1, i + 1).setValue(HEADERS[i]);
        changed = true;
      }
    }

    if (changed || sh.getFrozenRows() < 1) {
      sh.getRange(1, 1, 1, HEADERS.length)
        .setFontWeight('bold')
        .setBackground('#fde68a');
      sh.setFrozenRows(1);
    }

    if (!sh.getFilter() && sh.getLastRow() >= 1) {
      try {
        sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), HEADERS.length).createFilter();
      } catch (e) {
        Logger.log('[AlertsRepository] Filter create skipped: ' + e.message);
      }
    }
  }

  function _normalizeNumber_(value, fallback) {
    const n = Number(value);
    return isFinite(n) && n > 0 ? Math.floor(n) : fallback;
  }

  function _normalizeLimit_(value, defaultLimit, maxLimit) {
    const effectiveMax = Number(maxLimit) > 0 ? Math.floor(maxLimit) : MAX_LIMIT;
    const n = Number(value);

    if (!isFinite(n) || n <= 0) {
      return defaultLimit;
    }

    return Math.max(MIN_LIMIT, Math.min(Math.floor(n), effectiveMax));
  }

  function _truncate_(value, maxLen) {
    return String(value || '').substring(0, maxLen);
  }

  function _validateRecord_(record) {
    const item = Object.assign({ severity: 'warning' }, record || {});

    if (item.details) {
      try {
        const raw = JSON.stringify(item.details);
        if (raw.length > MAX_DETAILS_LENGTH) {
          item.details = {
            truncated: true,
            originalSize: raw.length,
            preview: raw.substring(0, Math.floor(MAX_DETAILS_LENGTH / 2))
          };
        }
      } catch (e) {
        item.details = {
          error: 'Failed to stringify details',
          message: e.message
        };
      }
    }

    return item;
  }

  function _safeStringify_(obj, maxLength) {
    try {
      if (typeof stage7SafeStringify_ === 'function') {
        return stage7SafeStringify_(obj, maxLength);
      }

      const str = JSON.stringify(obj);
      if (str.length > maxLength) {
        return str.substring(0, maxLength) + '…[truncated]';
      }
      return str;
    } catch (e) {
      return JSON.stringify({ error: e.message });
    }
  }

  function _recordToRow_(item) {
    return [
      item.timestamp || new Date(),
      _truncate_(item.type || item.jobName || '', 255),
      _truncate_(item.severity || 'warning', 50),
      _truncate_(item.action || item.actionName || '', 255),
      _truncate_(item.outcome || '', 100),
      _truncate_(item.role || '', 50),
      _truncate_(item.displayName || '', 255),
      _truncate_(item.userKey || item.currentKey || '', 100),
      _truncate_(item.email || '', 255),
      _truncate_(item.source || '', 255),
      _truncate_(item.message || '', MAX_MESSAGE_LENGTH),
      _safeStringify_(item.details || {}, MAX_DETAILS_LENGTH)
    ];
  }

  function _appendRowFast_(sh, row) {
    const targetRow = sh.getLastRow() + 1;
    sh.getRange(targetRow, 1, 1, row.length).setValues([row]);
    return targetRow;
  }

  function _appendRowsFast_(sh, rows) {
    if (!rows || !rows.length) return 0;
    const startRow = sh.getLastRow() + 1;
    sh.getRange(startRow, 1, rows.length, HEADERS.length).setValues(rows);
    return rows.length;
  }

  function _getAllRows_(sh) {
    const lastRow = sh.getLastRow();
    if (lastRow < 2) return [];
    return sh.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  }

  function _rowToObject_(row) {
    const out = {};
    for (let i = 0; i < HEADERS.length; i++) {
      out[HEADERS[i]] = row[i];
    }
    return out;
  }

  function _cleanupByRowCount_(sh) {
    const lastRow = sh.getLastRow();
    if (lastRow <= MAX_ROWS) return 0;

    const rowsToDelete = lastRow - CLEANUP_KEEP_ROWS;
    if (rowsToDelete <= 0) return 0;

    sh.deleteRows(2, rowsToDelete);
    Logger.log('[AlertsRepository] Auto-cleanup deleted rows: ' + rowsToDelete);
    return rowsToDelete;
  }

  function _deleteRowsGrouped_(sh, rowNumbers) {
    if (!rowNumbers || !rowNumbers.length) return 0;

    const sorted = rowNumbers.slice().sort(function (a, b) { return a - b; });
    const groups = [];
    let start = sorted[0];
    let prev = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i];
      if (current === prev + 1) {
        prev = current;
        continue;
      }
      groups.push({ start: start, end: prev });
      start = current;
      prev = current;
    }
    groups.push({ start: start, end: prev });

    let deleted = 0;

    for (let j = groups.length - 1; j >= 0; j--) {
      const group = groups[j];
      const count = group.end - group.start + 1;
      sh.deleteRows(group.start, count);
      deleted += count;
    }

    return deleted;
  }

  // ==================== PUBLIC API ====================

  function ensureSheet() {
    const sh = _getSheet_();
    return {
      success: true,
      sheet: sh.getName(),
      lastRow: sh.getLastRow(),
      lastColumn: sh.getLastColumn(),
      headers: HEADERS.slice(),
      maxRows: MAX_ROWS,
      keepRows: CLEANUP_KEEP_ROWS
    };
  }

  function appendAlert(record) {
    if (!record) {
      return { success: false, error: 'Record is empty' };
    }

    try {
      const sh = _getSheet_();
      const item = _validateRecord_(record);
      const row = _recordToRow_(item);

      _appendRowFast_(sh, row);
      _cleanupByRowCount_(sh);

      return {
        success: true,
        written: 1,
        sheet: sh.getName()
      };
    } catch (e) {
      Logger.log('[AlertsRepository] appendAlert failed: ' + e.message);
      return { success: false, error: e.message };
    }
  }

  function appendAlertsBatch(records) {
    if (!records || !records.length) {
      return { success: false, error: 'Records array is empty' };
    }

    try {
      const sh = _getSheet_();
      const rows = [];

      for (let i = 0; i < records.length; i++) {
        rows.push(_recordToRow_(_validateRecord_(records[i])));
      }

      _appendRowsFast_(sh, rows);
      _cleanupByRowCount_(sh);

      return {
        success: true,
        written: rows.length,
        sheet: sh.getName()
      };
    } catch (e) {
      Logger.log('[AlertsRepository] appendAlertsBatch failed: ' + e.message);
      return { success: false, error: e.message };
    }
  }

  function getRecentAlerts(limit) {
    const sh = _getSheet_();
    const data = _getAllRows_(sh);
    if (!data.length) return [];

    const safeLimit = _normalizeLimit_(limit, DEFAULT_LIMIT_RECENT);
    const result = [];
    const startIdx = Math.max(0, data.length - safeLimit);

    for (let i = data.length - 1; i >= startIdx; i--) {
      result.push(_rowToObject_(data[i]));
    }

    return result;
  }

  function getAlertsByType(type, limit) {
    const sh = _getSheet_();
    const data = _getAllRows_(sh);
    if (!data.length) return [];

    const safeLimit = _normalizeLimit_(limit, DEFAULT_LIMIT_FILTER);
    const typeIdx = HEADERS.indexOf('Type');
    const wanted = String(type || '');
    const result = [];

    for (let i = data.length - 1; i >= 0 && result.length < safeLimit; i--) {
      if (String(data[i][typeIdx] || '') === wanted) {
        result.push(_rowToObject_(data[i]));
      }
    }

    return result;
  }

  function getAlertsBySeverity(severity, limit) {
    const sh = _getSheet_();
    const data = _getAllRows_(sh);
    if (!data.length) return [];

    const safeLimit = _normalizeLimit_(limit, DEFAULT_LIMIT_FILTER);
    const severityIdx = HEADERS.indexOf('Severity');
    const wanted = String(severity || '').toLowerCase();
    const result = [];

    for (let i = data.length - 1; i >= 0 && result.length < safeLimit; i--) {
      if (String(data[i][severityIdx] || '').toLowerCase() === wanted) {
        result.push(_rowToObject_(data[i]));
      }
    }

    return result;
  }

  function clearAlerts(olderThanDays) {
    const sh = _getSheet_();
    const lastRow = sh.getLastRow();
    if (lastRow < 2) {
      return {
        success: true,
        deleted: 0,
        olderThanDays: _normalizeNumber_(olderThanDays, DEFAULT_CLEAR_DAYS)
      };
    }

    const safeDays = _normalizeNumber_(olderThanDays, DEFAULT_CLEAR_DAYS);
    const timestampCol = HEADERS.indexOf('Timestamp') + 1;
    const timestamps = sh.getRange(2, timestampCol, lastRow - 1, 1).getValues();

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - safeDays);

    const rowNumbersToDelete = [];

    for (let i = 0; i < timestamps.length; i++) {
      const ts = new Date(timestamps[i][0]);
      if (!isNaN(ts.getTime()) && ts < cutoff) {
        rowNumbersToDelete.push(i + 2);
      }
    }

    const deleted = _deleteRowsGrouped_(sh, rowNumbersToDelete);

    return {
      success: true,
      deleted: deleted,
      olderThanDays: safeDays
    };
  }

  function getStatistics() {
    const sh = _getSheet_();
    const data = _getAllRows_(sh);

    if (!data.length) {
      return {
        total: 0,
        bySeverity: {},
        byType: {},
        oldest: null,
        newest: null
      };
    }

    const severityIdx = HEADERS.indexOf('Severity');
    const typeIdx = HEADERS.indexOf('Type');
    const timestampIdx = HEADERS.indexOf('Timestamp');

    const stats = {
      total: data.length,
      bySeverity: {},
      byType: {},
      oldest: null,
      newest: null
    };

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const severity = String(row[severityIdx] || 'unknown');
      const type = String(row[typeIdx] || 'unknown');
      const ts = new Date(row[timestampIdx]);

      stats.bySeverity[severity] = (stats.bySeverity[severity] || 0) + 1;
      stats.byType[type] = (stats.byType[type] || 0) + 1;

      if (!isNaN(ts.getTime())) {
        if (!stats.oldest || ts < stats.oldest) stats.oldest = ts;
        if (!stats.newest || ts > stats.newest) stats.newest = ts;
      }
    }

    return stats;
  }

  function resetSchemaCache() {
    _schemaChecked = false;
    return { success: true, reset: true };
  }

  return {
    ensureSheet: ensureSheet,
    appendAlert: appendAlert,
    appendAlertsBatch: appendAlertsBatch,
    getRecentAlerts: getRecentAlerts,
    getAlertsByType: getAlertsByType,
    getAlertsBySeverity: getAlertsBySeverity,
    clearAlerts: clearAlerts,
    getStatistics: getStatistics,
    resetSchemaCache: resetSchemaCache,
    HEADERS: HEADERS.slice()
  };
})();

// ==================== GLOBAL HELPERS ====================

function addAlert(type, severity, message, details) {
  return AlertsRepository_.appendAlert({
    type: type,
    severity: severity,
    message: message,
    details: details || {}
  });
}

function addAlertsBatch(alerts) {
  return AlertsRepository_.appendAlertsBatch(alerts);
}

function clearOldAlerts(days) {
  return AlertsRepository_.clearAlerts(days);
}

function getAlertsStatistics() {
  return AlertsRepository_.getStatistics();
}

function getRecentAlerts(limit) {
  return AlertsRepository_.getRecentAlerts(limit);
}

function resetAlertsSchemaCache() {
  return AlertsRepository_.resetSchemaCache();
}
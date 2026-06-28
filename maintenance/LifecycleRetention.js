/**
 * LifecycleRetention.gs — retention cleanup for LOG and AUDIT_LOG sheets.
 * Покладається на хелпери з SystemSheetsSelfHeal, якщо доступні.
 * Якщо SystemSheetsSelfHeal недоступний — працює автономно.
 */

function _retIsObject_(value) {
  return !!value && typeof value === 'object';
}

function _retSafeString_(value, fallback) {
  if (value === null || typeof value === 'undefined') return fallback || '';
  return String(value);
}

function _retTrimmedString_(value, fallback) {
  return _retSafeString_(value, fallback).trim();
}

function _retLog_(message, error) {
  try {
    if (typeof _sshLog_ === 'function') {
      _sshLog_(message, error);
      return;
    }
  } catch (e) {}

  try {
    Logger.log('[LifecycleRetention] ' + _retSafeString_(message, '') + (error ? ': ' + (error && error.message ? error.message : error) : ''));
  } catch (e2) {}
}

function _retConfigValue_(key, fallback) {
  try {
    if (typeof _sshConfigValue_ === 'function') {
      var viaSsh = _sshConfigValue_(key, fallback);
      if (viaSsh !== null && typeof viaSsh !== 'undefined' && viaSsh !== '') {
        return viaSsh;
      }
    }
  } catch (e) {}

  try {
    if (typeof appGetCore === 'function') {
      var viaAppGetCore = appGetCore(key, fallback);
      if (viaAppGetCore !== null && typeof viaAppGetCore !== 'undefined' && viaAppGetCore !== '') {
        return viaAppGetCore;
      }
    }
  } catch (e2) {}

  try {
    if (typeof CONFIG !== 'undefined' && _retIsObject_(CONFIG) && Object.prototype.hasOwnProperty.call(CONFIG, key)) {
      var viaConfig = CONFIG[key];
      if (viaConfig !== null && typeof viaConfig !== 'undefined' && viaConfig !== '') {
        return viaConfig;
      }
    }
  } catch (e3) {}

  return fallback;
}

function _retStage7Value_(key, fallback) {
  try {
    if (typeof STAGE7_CONFIG !== 'undefined' && _retIsObject_(STAGE7_CONFIG) && Object.prototype.hasOwnProperty.call(STAGE7_CONFIG, key)) {
      var viaStage7 = STAGE7_CONFIG[key];
      if (viaStage7 !== null && typeof viaStage7 !== 'undefined' && viaStage7 !== '') {
        return viaStage7;
      }
    }
  } catch (e) {}

  return fallback;
}

function _retGetSpreadsheet_() {
  var ss = null;

  try {
    ss = getWasbSpreadsheet_();
  } catch (e) {
    _retLog_('Не вдалося отримати активну таблицю через getWasbSpreadsheet_()', e);
  }

  if (!ss) {
    throw new Error('Активну таблицю не знайдено');
  }

  return ss;
}

function _retParseDateMs_(value) {
  if (value === null || typeof value === 'undefined' || value === '') {
    return null;
  }

  if (value instanceof Date) {
    var directMs = value.getTime();
    return isFinite(directMs) ? directMs : null;
  }

  if (typeof value === 'number') {
    if (!isFinite(value)) return null;

    if (value > 100000000000) {
      return value;
    }

    if (value > 1000000000) {
      return value * 1000;
    }

    if (value > 25569 && value < 80000) {
      return Math.round((value - 25569) * 24 * 60 * 60 * 1000);
    }

    return null;
  }

  if (typeof value === 'string') {
    var text = value.trim();
    if (!text) return null;

    var uaMatch = text.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
    if (uaMatch) {
      var day = Number(uaMatch[1]);
      var month = Number(uaMatch[2]);
      var year = Number(uaMatch[3]);
      var hour = Number(uaMatch[4] || 0);
      var minute = Number(uaMatch[5] || 0);
      var second = Number(uaMatch[6] || 0);

      var parsedUa = new Date(year, month - 1, day, hour, minute, second);
      if (
        parsedUa.getFullYear() === year &&
        parsedUa.getMonth() === month - 1 &&
        parsedUa.getDate() === day &&
        isFinite(parsedUa.getTime())
      ) {
        return parsedUa.getTime();
      }

      return null;
    }

    var parsed = new Date(text);
    var parsedMs = parsed.getTime();
    return isFinite(parsedMs) ? parsedMs : null;
  }

  return null;
}

function _retBuildDeleteGroupsDescending_(rows) {
  var sorted = Array.isArray(rows) ? rows.slice() : [];
  sorted.sort(function(a, b) {
    return b - a;
  });

  var groups = [];
  var currentStart = null;
  var currentCount = 0;
  var previousRow = null;

  for (var i = 0; i < sorted.length; i++) {
    var row = Number(sorted[i]);
    if (!isFinite(row) || row < 1) continue;

    if (previousRow === null || row === previousRow - 1) {
      currentStart = row;
      currentCount++;
      previousRow = row;
    } else {
      if (currentStart !== null && currentCount > 0) {
        groups.push({
          startRow: currentStart,
          count: currentCount
        });
      }

      currentStart = row;
      currentCount = 1;
      previousRow = row;
    }
  }

  if (currentStart !== null && currentCount > 0) {
    groups.push({
      startRow: currentStart,
      count: currentCount
    });
  }

  for (var j = 0; j < groups.length; j++) {
    groups[j].startRow = groups[j].startRow - groups[j].count + 1;
  }

  return groups;
}

function _cleanupSheetByAge_(sheetName, headerRow, retentionDays) {
  var normalizedSheetName = _retTrimmedString_(sheetName, '');
  var retention = Math.max(Number(retentionDays) || 0, 0);

  var result = {
    sheet: normalizedSheetName,
    found: false,
    removed: 0,
    plannedRemove: 0,
    kept: 0,
    scanned: 0,
    retentionDays: retention,
    deleteErrors: []
  };

  if (!normalizedSheetName) {
    result.error = 'Sheet name is empty';
    return result;
  }

  var ss = null;
  try {
    ss = _retGetSpreadsheet_();
  } catch (e) {
    result.error = e && e.message ? e.message : String(e);
    _retLog_('Retention cleanup failed: spreadsheet unavailable', e);
    return result;
  }

  var sh = null;
  try {
    sh = ss.getSheetByName(normalizedSheetName);
  } catch (e2) {
    result.error = e2 && e2.message ? e2.message : String(e2);
    _retLog_('Не вдалося отримати аркуш ' + normalizedSheetName, e2);
    return result;
  }

  if (!sh) {
    return result;
  }

  result.found = true;

  var startRow = Math.max(Number(headerRow) + 1, 2);
  if (!isFinite(startRow)) startRow = 2;

  var lastRow = 0;
  try {
    lastRow = Number(sh.getLastRow()) || 0;
  } catch (e3) {
    result.error = e3 && e3.message ? e3.message : String(e3);
    _retLog_('Не вдалося отримати lastRow для ' + normalizedSheetName, e3);
    return result;
  }

  if (lastRow < startRow) {
    return result;
  }

  var rowCount = lastRow - startRow + 1;
  var values = [];

  try {
    values = sh.getRange(startRow, 1, rowCount, 1).getValues();
  } catch (e4) {
    result.error = e4 && e4.message ? e4.message : String(e4);
    _retLog_('Не вдалося прочитати дати з аркуша ' + normalizedSheetName, e4);
    return result;
  }

  var cutoffMs = Date.now() - retention * 24 * 60 * 60 * 1000;
  var rowsToDelete = [];

  for (var i = 0; i < values.length; i++) {
    var timestampMs = _retParseDateMs_(values[i][0]);
    result.scanned++;

    if (timestampMs !== null && timestampMs < cutoffMs) {
      rowsToDelete.push(startRow + i);
    } else {
      result.kept++;
    }
  }

  result.plannedRemove = rowsToDelete.length;

  if (rowsToDelete.length < 1) {
    return result;
  }

  var groups = _retBuildDeleteGroupsDescending_(rowsToDelete);

  for (var j = 0; j < groups.length; j++) {
    var group = groups[j];

    try {
      sh.deleteRows(group.startRow, group.count);
      result.removed += group.count;
    } catch (e5) {
      var message = e5 && e5.message ? e5.message : String(e5);
      result.deleteErrors.push({
        startRow: group.startRow,
        count: group.count,
        error: message
      });
      _retLog_('Не вдалося видалити рядки з ' + normalizedSheetName + ' startRow=' + group.startRow + ' count=' + group.count, e5);
    }
  }

  if (result.deleteErrors.length > 0) {
    result.error = 'Some rows were not deleted';
  }

  return result;
}

function cleanupLogsAndAuditRetention_(options) {
  var opts = options || {};

  var logSheetName = opts.logSheetName || _retConfigValue_('LOG_SHEET', 'LOG');

  var auditSheetName = opts.auditSheetName ||
    _retConfigValue_('AUDIT_LOG_SHEET', _retStage7Value_('AUDIT_LOG_SHEET', 'AUDIT_LOG'));

  var logHeaderRow = opts.logHeaderRow !== undefined
    ? opts.logHeaderRow
    : Number(_retConfigValue_('LOG_HEADER_ROW', 1));

  var auditHeaderRow = opts.auditHeaderRow !== undefined
    ? opts.auditHeaderRow
    : Number(_retConfigValue_('AUDIT_HEADER_ROW', _retStage7Value_('AUDIT_HEADER_ROW', 1)));

  var logRetentionDays = opts.logRetentionDays !== undefined
    ? Number(opts.logRetentionDays)
    : Number(_retConfigValue_('LOG_RETENTION_DAYS', 60));

  var auditRetentionDays = opts.auditRetentionDays !== undefined
    ? Number(opts.auditRetentionDays)
    : Number(_retConfigValue_('AUDIT_RETENTION_DAYS', 180));

  if (!isFinite(logHeaderRow) || logHeaderRow < 1) logHeaderRow = 1;
  if (!isFinite(auditHeaderRow) || auditHeaderRow < 1) auditHeaderRow = 1;
  if (!isFinite(logRetentionDays) || logRetentionDays < 0) logRetentionDays = 60;
  if (!isFinite(auditRetentionDays) || auditRetentionDays < 0) auditRetentionDays = 180;

  var logResult = _cleanupSheetByAge_(logSheetName, logHeaderRow, logRetentionDays);
  var auditResult = _cleanupSheetByAge_(auditSheetName, auditHeaderRow, auditRetentionDays);

  if (logResult.removed > 0) {
    _retLog_('Видалено рядків з ' + logResult.sheet + ': ' + logResult.removed);
  }

  if (auditResult.removed > 0) {
    _retLog_('Видалено рядків з ' + auditResult.sheet + ': ' + auditResult.removed);
  }

  if (logResult.deleteErrors && logResult.deleteErrors.length > 0) {
    _retLog_('Помилки видалення в ' + logResult.sheet + ': ' + JSON.stringify(logResult.deleteErrors));
  }

  if (auditResult.deleteErrors && auditResult.deleteErrors.length > 0) {
    _retLog_('Помилки видалення в ' + auditResult.sheet + ': ' + JSON.stringify(auditResult.deleteErrors));
  }

  return {
    log: logResult,
    audit: auditResult,
    removed: (logResult.removed || 0) + (auditResult.removed || 0),
    plannedRemove: (logResult.plannedRemove || 0) + (auditResult.plannedRemove || 0),
    hasErrors: !!(
      logResult.error ||
      auditResult.error ||
      (logResult.deleteErrors && logResult.deleteErrors.length > 0) ||
      (auditResult.deleteErrors && auditResult.deleteErrors.length > 0)
    )
  };
}
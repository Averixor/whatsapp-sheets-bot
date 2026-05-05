/**
 * ServiceSheetsBootstrap.gs
 * Повна самодостатня версія для Google Apps Script / WASB.
 */

function _ssbIsObject_(value) {
  return !!value && typeof value === 'object';
}

function _ssbIsFunction_(value) {
  return typeof value === 'function';
}

function _ssbSafeString_(value, fallback) {
  if (value === null || typeof value === 'undefined') return fallback || '';
  return String(value);
}

function _ssbTrimmedString_(value, fallback) {
  return _ssbSafeString_(value, fallback).trim();
}

function _ssbGlobal_() {
  try {
    if (typeof globalThis !== 'undefined') return globalThis;
  } catch (e) {}
  try {
    return this;
  } catch (e) {}
  return {};
}

function _ssbConfigObject_() {
  try {
    if (typeof CONFIG !== 'undefined' && _ssbIsObject_(CONFIG)) return CONFIG;
  } catch (e) {}
  return {};
}

function _ssbStage7ConfigObject_() {
  try {
    if (typeof STAGE7_CONFIG !== 'undefined' && _ssbIsObject_(STAGE7_CONFIG)) return STAGE7_CONFIG;
  } catch (e) {}
  return {};
}

function _ssbConfigValue_(key, fallback) {
  try {
    if (typeof appGetCore === 'function') {
      var viaAppGetCore = appGetCore(key, fallback);
      if (typeof viaAppGetCore !== 'undefined' && viaAppGetCore !== null && viaAppGetCore !== '') {
        return viaAppGetCore;
      }
    }
  } catch (e) {}

  var cfg = _ssbConfigObject_();
  if (Object.prototype.hasOwnProperty.call(cfg, key) && cfg[key] !== null && typeof cfg[key] !== 'undefined' && cfg[key] !== '') {
    return cfg[key];
  }

  return fallback;
}

function _ssbStage7ConfigValue_(key, fallback) {
  var cfg = _ssbStage7ConfigObject_();
  if (Object.prototype.hasOwnProperty.call(cfg, key) && cfg[key] !== null && typeof cfg[key] !== 'undefined' && cfg[key] !== '') {
    return cfg[key];
  }
  return fallback;
}

function _ssbLog_(message, error) {
  try {
    Logger.log('[ServiceSheetsBootstrap] ' + _ssbSafeString_(message, '') + (error ? ': ' + (error && error.message ? error.message : error) : ''));
  } catch (e) {}
}

function _ssbUniqueStrings_(items) {
  var list = Array.isArray(items) ? items : [];
  var seen = {};
  var out = [];

  for (var i = 0; i < list.length; i++) {
    var value = _ssbTrimmedString_(list[i], '');
    if (!value) continue;
    if (seen[value]) continue;
    seen[value] = true;
    out.push(value);
  }

  return out;
}

function _ssbNowText_() {
  var tz = 'Etc/GMT';
  try {
    tz = Session.getScriptTimeZone() || tz;
  } catch (e) {}
  return Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm:ss');
}

function _ssbBuildMaintenanceResponse_(success, message, data, scenario, warnings, extra) {
  try {
    if (typeof _stage7BuildMaintenanceResponse_ === 'function') {
      return _stage7BuildMaintenanceResponse_(success, message, data, scenario, warnings, extra);
    }
  } catch (e) {}

  var safeExtra = _ssbIsObject_(extra) ? extra : {};

  return {
    success: !!success,
    message: _ssbSafeString_(message, ''),
    result: typeof data === 'undefined' ? null : data,
    scenario: _ssbSafeString_(scenario, ''),
    warnings: Array.isArray(warnings) ? warnings : [],
    changes: Array.isArray(safeExtra.changes) ? safeExtra.changes : [],
    affectedSheets: Array.isArray(safeExtra.affectedSheets) ? safeExtra.affectedSheets : [],
    affectedEntities: Array.isArray(safeExtra.affectedEntities) ? safeExtra.affectedEntities : [],
    appliedChangesCount: Number(safeExtra.appliedChangesCount || 0),
    skippedChangesCount: Number(safeExtra.skippedChangesCount || 0),
    timestamp: _ssbNowText_()
  };
}

function _ssbGetActiveSpreadsheet_() {
  try {
    return SpreadsheetApp.getActive();
  } catch (e) {
    _ssbLog_('Unable to get active spreadsheet', e);
    return null;
  }
}

function _ssbGetOrCreateSheetByName_(sheetName) {
  var ss = _ssbGetActiveSpreadsheet_();
  if (!ss) {
    throw new Error('Active spreadsheet not found');
  }

  var normalizedName = _ssbTrimmedString_(sheetName, '');
  if (!normalizedName) {
    throw new Error('Sheet name is required');
  }

  var sheet = ss.getSheetByName(normalizedName);
  if (sheet) return sheet;

  sheet = ss.insertSheet(normalizedName);
  return sheet;
}

function _ssbEnsureBasicSheetHeader_(sheet, headerValues) {
  if (!sheet || !Array.isArray(headerValues) || !headerValues.length) return;

  var lastRow = 0;
  var lastColumn = 0;

  try {
    lastRow = Number(sheet.getLastRow()) || 0;
    lastColumn = Number(sheet.getLastColumn()) || 0;
  } catch (e) {}

  if (lastColumn < headerValues.length) {
    try {
      sheet.insertColumnsAfter(Math.max(lastColumn, 1), headerValues.length - lastColumn);
    } catch (e) {
      if (lastColumn === 0) {
        try {
          sheet.getRange(1, 1, 1, headerValues.length);
        } catch (innerError) {}
      }
    }
  }

  var existingValues = [];
  try {
    existingValues = sheet.getRange(1, 1, 1, headerValues.length).getValues()[0];
  } catch (e) {
    existingValues = [];
  }

  var hasHeader = false;
  for (var i = 0; i < existingValues.length; i++) {
    if (_ssbTrimmedString_(existingValues[i], '')) {
      hasHeader = true;
      break;
    }
  }

  if (!hasHeader) {
    sheet.getRange(1, 1, 1, headerValues.length).setValues([headerValues]);
    try {
      sheet.setFrozenRows(1);
    } catch (e) {}
    try {
      sheet.getRange(1, 1, 1, headerValues.length).setFontWeight('bold').setBackground('#e8eaed');
    } catch (e) {}
  }
}

function _ssbExtractSheetNameFromEnsureResult_(result, fallbackName) {
  if (!result) return _ssbSafeString_(fallbackName, '');

  try {
    if (_ssbIsFunction_(result.getName)) {
      return _ssbTrimmedString_(result.getName(), fallbackName);
    }
  } catch (e) {}

  if (_ssbIsObject_(result)) {
    if (result.sheet && _ssbIsFunction_(result.sheet.getName)) {
      try {
        return _ssbTrimmedString_(result.sheet.getName(), fallbackName);
      } catch (e) {}
    }
    
    if (result.sheet && typeof result.sheet === 'string') {
      return _ssbTrimmedString_(result.sheet, fallbackName);
    }

    if (result.name) {
      return _ssbTrimmedString_(result.name, fallbackName);
    }
  }

  return _ssbSafeString_(fallbackName, '');
}

function _ssbEnsureJobRuntimeSheetFallback_() {
  var sheetName = _ssbStage7ConfigValue_('JOB_RUNTIME_SHEET', 'JOB_RUNTIME_LOG');
  var sheet = _ssbGetOrCreateSheetByName_(sheetName);

  _ssbEnsureBasicSheetHeader_(sheet, [
    'timestamp',
    'job_id',
    'scenario',
    'status',
    'message',
    'payload'
  ]);

  return sheet;
}

function _ssbEnsureAlertsSheetFallback_() {
  var sheetName = _ssbConfigValue_('ALERTS_SHEET', 'ALERTS_LOG');
  var sheet = _ssbGetOrCreateSheetByName_(sheetName);

  _ssbEnsureBasicSheetHeader_(sheet, [
    'timestamp',
    'type',
    'severity',
    'action',
    'outcome',
    'role',
    'display_name',
    'email',
    'source',
    'message',
    'details'
  ]);

  return sheet;
}

function _ssbEnsureAuditSheetFallback_() {
  var sheetName = _ssbStage7ConfigValue_('AUDIT_SHEET', 'AUDIT_LOG');
  var sheet = _ssbGetOrCreateSheetByName_(sheetName);

  _ssbEnsureBasicSheetHeader_(sheet, [
    'timestamp',
    'operation_id',
    'scenario',
    'level',
    'status',
    'initiator',
    'message',
    'payload'
  ]);

  return sheet;
}

function _ssbEnsureSheetViaRepository_(repositoryObject, fallbackEnsureFn, fallbackName) {
  var result = {
    success: false,
    sheet: _ssbSafeString_(fallbackName, ''),
    source: '',
    error: ''
  };

  try {
    if (_ssbIsObject_(repositoryObject) && _ssbIsFunction_(repositoryObject.ensureSheet)) {
      var ensured = repositoryObject.ensureSheet();
      result.success = true;
      result.sheet = _ssbExtractSheetNameFromEnsureResult_(ensured, fallbackName);
      result.source = 'repository';
      return result;
    }
  } catch (e) {
    result.error = e && e.message ? e.message : String(e);
    _ssbLog_('Repository ensureSheet failed for ' + fallbackName, e);
  }

  try {
    var fallbackSheet = fallbackEnsureFn();
    result.success = true;
    result.sheet = _ssbExtractSheetNameFromEnsureResult_(fallbackSheet, fallbackName);
    result.source = 'fallback';
    result.error = '';
    return result;
  } catch (e2) {
    result.success = false;
    result.sheet = _ssbSafeString_(fallbackName, '');
    result.source = 'fallback';
    result.error = e2 && e2.message ? e2.message : String(e2);
    _ssbLog_('Fallback ensureSheet failed for ' + fallbackName, e2);
    return result;
  }
}

function _ssbAssertAdminAccess_() {
  try {
    if (typeof AccessControl_ === 'object' && AccessControl_ && _ssbIsFunction_(AccessControl_.assertRoleAtLeast)) {
      AccessControl_.assertRoleAtLeast('admin', 'bootstrap runtime and alerts sheets');
      return;
    }
  } catch (e) {
    throw e;
  }
}

function bootstrapWasbRuntimeAndAlertsSheets() {
  var globalScope = _ssbGlobal_();
  var runtimeSheetName = _ssbStage7ConfigValue_('JOB_RUNTIME_SHEET', 'JOB_RUNTIME_LOG');
  var alertsSheetName = _ssbConfigValue_('ALERTS_SHEET', 'ALERTS_LOG');
  var auditSheetName = _ssbStage7ConfigValue_('AUDIT_SHEET', 'AUDIT_LOG');

  var result = {
    success: true,
    message: 'Службові листи журналів підготовлено',
    sheets: [],
    runtime: { success: false, sheet: runtimeSheetName, source: '', error: '' },
    alerts: { success: false, sheet: alertsSheetName, source: '', error: '' },
    audit: { success: false, sheet: auditSheetName, source: '', error: '' }
  };

  result.runtime = _ssbEnsureSheetViaRepository_(
    globalScope.JobRuntimeRepository_,
    _ssbEnsureJobRuntimeSheetFallback_,
    runtimeSheetName
  );

  result.alerts = _ssbEnsureSheetViaRepository_(
    globalScope.AlertsRepository_,
    _ssbEnsureAlertsSheetFallback_,
    alertsSheetName
  );

  result.audit = _ssbEnsureSheetViaRepository_(
    globalScope.Stage7AuditTrail_,
    _ssbEnsureAuditSheetFallback_,
    auditSheetName
  );

  result.sheets = _ssbUniqueStrings_([
    result.runtime.success ? result.runtime.sheet : '',
    result.alerts.success ? result.alerts.sheet : '',
    result.audit.success ? result.audit.sheet : ''
  ]);

  if (!result.runtime.success || !result.alerts.success || !result.audit.success) {
    result.success = false;
    result.message = 'Деякі службові листи не вдалося підготувати';
  }

  return result;
}

function apiStage7BootstrapRuntimeAndAlertsSheets() {
  try {
    _ssbAssertAdminAccess_();
  } catch (e) {
    return _ssbBuildMaintenanceResponse_(
      false,
      'Недостатньо прав для виконання операції',
      null,
      'stage7BootstrapRuntimeAndAlertsSheets',
      [e && e.message ? e.message : String(e)],
      {}
    );
  }

  var result = bootstrapWasbRuntimeAndAlertsSheets();
  var warnings = [];

  if (result.runtime && result.runtime.success === false) {
    warnings.push('Не вдалося підготувати лист runtime' + (result.runtime.error ? ': ' + result.runtime.error : ''));
  }

  if (result.alerts && result.alerts.success === false) {
    warnings.push('Не вдалося підготувати лист alerts' + (result.alerts.error ? ': ' + result.alerts.error : ''));
  }

  if (result.audit && result.audit.success === false) {
    warnings.push('Не вдалося підготувати лист audit' + (result.audit.error ? ': ' + result.audit.error : ''));
  }

  return _ssbBuildMaintenanceResponse_(
    result.success !== false,
    result.message || 'Службові листи журналів підготовлено',
    result,
    'stage7BootstrapRuntimeAndAlertsSheets',
    warnings,
    {
      affectedSheets: Array.isArray(result.sheets) ? result.sheets : [],
      appliedChangesCount: Array.isArray(result.sheets) ? result.sheets.length : 0,
      skippedChangesCount: warnings.length
    }
  );
}
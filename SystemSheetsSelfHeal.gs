/**
 * SystemSheetsSelfHeal.gs
 * Модуль відновлення та стандартизації системних листів.
 */

function _sshIsObject_(value) {
  return !!value && typeof value === 'object';
}

function _sshIsFunction_(value) {
  return typeof value === 'function';
}

function _sshSafeString_(value, fallback) {
  if (value === null || typeof value === 'undefined') return fallback || '';
  return String(value);
}

function _sshTrimmedString_(value, fallback) {
  return _sshSafeString_(value, fallback).trim();
}

function _sshConfigObject_() {
  try {
    if (typeof CONFIG !== 'undefined' && _sshIsObject_(CONFIG)) return CONFIG;
  } catch (e) {}
  return {};
}

function _sshVacationConfigObject_() {
  try {
    if (typeof VACATION_ENGINE_CONFIG !== 'undefined' && _sshIsObject_(VACATION_ENGINE_CONFIG)) {
      return VACATION_ENGINE_CONFIG;
    }
  } catch (e) {}
  return {};
}

function _sshConfigValue_(key, fallback) {
  try {
    if (typeof appGetCore === 'function') {
      var viaAppGetCore = appGetCore(key, fallback);
      if (typeof viaAppGetCore !== 'undefined' && viaAppGetCore !== null && viaAppGetCore !== '') {
        return viaAppGetCore;
      }
    }
  } catch (e) {}

  var cfg = _sshConfigObject_();
  if (Object.prototype.hasOwnProperty.call(cfg, key) && cfg[key] !== null && typeof cfg[key] !== 'undefined' && cfg[key] !== '') {
    return cfg[key];
  }

  return fallback;
}

function _sshVacationConfigValue_(key, fallback) {
  var cfg = _sshVacationConfigObject_();
  if (Object.prototype.hasOwnProperty.call(cfg, key) && cfg[key] !== null && typeof cfg[key] !== 'undefined' && cfg[key] !== '') {
    return cfg[key];
  }
  return fallback;
}

function _sshLog_(message, error) {
  try {
    Logger.log('[SystemSheetsSelfHeal] ' + _sshSafeString_(message, '') + (error ? ': ' + (error && error.message ? error.message : error) : ''));
  } catch (e) {}
}

function _sshFreeze_(value) {
  try {
    return Object.freeze(value);
  } catch (e) {
    return value;
  }
}

function _sshUniqueStrings_(items) {
  var list = Array.isArray(items) ? items : [];
  var seen = {};
  var out = [];

  for (var i = 0; i < list.length; i++) {
    var value = _sshTrimmedString_(list[i], '');
    if (!value) continue;
    if (seen[value]) continue;
    seen[value] = true;
    out.push(value);
  }

  return out;
}

function _sshGetSpreadsheet_() {
  var ss = null;
  try {
    ss = getWasbSpreadsheet_();
  } catch (e) {
    _sshLog_('Не вдалося отримати активну таблицю', e);
  }

  if (!ss) {
    throw new Error('Активну таблицю не знайдено');
  }
  return ss;
}

function _sshGetCurrentMonthSheetName_() {
  try {
    if (typeof getBotMonthSheetName_ === 'function') {
      var viaFn = _sshTrimmedString_(getBotMonthSheetName_(), '');
      if (viaFn) return viaFn;
    }
  } catch (e) {}

  var month = new Date().getMonth() + 1;
  return String(month).padStart(2, '0');
}

function _sshGetSheetSchemaSafe_(schemaKey) {
  try {
    if (typeof getSheetSchema_ === 'function') {
      return getSheetSchema_(schemaKey);
    }
  } catch (e) {
    _sshLog_('Помилка getSheetSchema_ для ключа ' + schemaKey, e);
  }
  return null;
}

function _sshGetSchemaLastColumnSafe_(schema) {
  try {
    if (typeof getSchemaLastColumn_ === 'function') {
      return Number(getSchemaLastColumn_(schema)) || 1;
    }
  } catch (e) {
    _sshLog_('Помилка getSchemaLastColumn_', e);
  }

  var fields = (schema && schema.fields) || {};
  var names = Object.keys(fields);
  var maxCol = 1;

  for (var i = 0; i < names.length; i++) {
    var field = fields[names[i]];
    var col = Number(field && field.col);
    if (isFinite(col) && col > maxCol) maxCol = col;
  }

  return maxCol;
}

function _sshBuildRegistry_() {
  return _sshFreeze_([
    {
      name: _sshConfigValue_('ACCESS_SHEET', 'ACCESS'),
      schemaKey: null,
      headers: [
        'email',
        'phone',
        'role',
        'enabled',
        'note',
        'display_name',
        'person_callsign',
        'self_bind_allowed',
        'user_key_current_hash',
        'user_key_prev_hash',
        'last_seen_at',
        'last_rotated_at',
        'failed_attempts',
        'locked_until_ms'
      ],
      minRows: 2
    },

    {
      name: _sshConfigValue_('LOG_SHEET', 'LOG'),
      schemaKey: 'log',
      headers: [
        'Timestamp',
        'ReportDate',
        'Sheet',
        'Cell',
        'FML',
        'Phone',
        'Code',
        'Service',
        'Place',
        'Tasks',
        'Message',
        'Link'
      ],
      minRows: 2
    },

    {
      name: _sshConfigValue_('TEMPLATES_SHEET', 'TEMPLATES'),
      schemaKey: null,
      headers: [
        'key',
        'text',
        'enabled',
        'tag_hint',
        'note'
      ],
      minRows: 2
    },

    {
      name: _sshConfigValue_('AUDIT_LOG_SHEET', 'AUDIT_LOG'),
      schemaKey: null,
      headers: [
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
      ],
      minRows: 2
    },

    {
      name: _sshConfigValue_('ACTIVE_OPERATIONS_SHEET', 'ACTIVE_OPERATIONS'),
      schemaKey: null,
      headers: [
        'OperationId',
        'Scenario',
        'Fingerprint',
        'Status',
        'StartedAt',
        'LastHeartbeat',
        'Initiator',
        'RunSource',
        'ExpiresAt',
        'LockHolder',
        'ParentOperationId',
        'Notes',
        'PayloadJson'
      ],
      minRows: 2
    },

    {
      name: _sshConfigValue_('ALERTS_LOG_SHEET', 'ALERTS_LOG'),
      schemaKey: null,
      headers: [
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
      ],
      minRows: 2
    },

    {
      name: _sshConfigValue_('OPS_LOG_SHEET', 'OPS_LOG'),
      schemaKey: null,
      headers: [
        'TimestampStarted',
        'TimestampFinished',
        'ID Операції',
        'ParentOperationId',
        'Сценарій',
        'RawScenario',
        'Ініціатор',
        'RunSource',
        'status',
        'Fingerprint',
        'AffectedRows',
        'AffectedEntities',
        'VerificationResult',
        'RepairNeeded',
        'Error',
        'TransitionReason',
        'Notes',
        'ResolvedByOperationId',
        'ResolvedAt',
        'ResolutionStatus',
        'LastHeartbeat',
        'ExpiresAt',
        'PayloadJson',
        'ResultJson',
        'CheckpointCount'
      ],
      minRows: 2
    },

    {
      name: _sshConfigValue_('CHECKPOINTS_SHEET', 'CHECKPOINTS'),
      schemaKey: null,
      headers: [
        'OperationId',
        'CheckpointIndex',
        'ProcessedUpTo',
        'LastProcessedEntity',
        'LastProcessedRow',
        'CheckpointTimestamp',
        'CheckpointPayload',
        'VerificationSnapshot'
      ],
      minRows: 2
    },

    {
      name: _sshConfigValue_('JOB_RUNTIME_LOG_SHEET', 'JOB_RUNTIME_LOG'),
      schemaKey: null,
      headers: [
        'TimestampStarted',
        'TimestampFinished',
        'jobName',
        'status',
        'source',
        'durationMs',
        'dryRun',
        'operationId',
        'Повідомлення',
        'Error',
        'initiatorEmail',
        'initiatorName',
        'initiatorRole',
        'initiatorCallsign',
        'entryPoint',
        'triggerId',
        'Notes'
      ],
      minRows: 2
    },

    {
      name: _sshConfigValue_('PHONES_SHEET', 'PHONES'),
      schemaKey: 'phones',
      headers: [
        'FML',
        'Phone',
        'Role',
        'Birthday',
        'Phone2'
      ],
      minRows: 2
    },

    {
      name: _sshVacationConfigValue_('VACATIONS_SHEET', 'VACATIONS'),
      schemaKey: 'vacations',
      headers: [
        'FML',
        'StartDate',
        'EndDate',
        'VacationNo',
        'Active',
        'Notify',
        'Note'
      ],
      minRows: 2
    },

    {
      name: _sshConfigValue_('DICT_SUM_SHEET', 'DICT_SUM'),
      schemaKey: 'dictSum',
      headers: [
        'Code',
        'Label',
        'SortOrder',
        'ShowZero'
      ],
      minRows: 2
    },

    {
      name: _sshConfigValue_('DICT_SHEET', 'DICT'),
      schemaKey: 'dict',
      headers: [
        'Code',
        'Service',
        'Place',
        'Tasks'
      ],
      minRows: 2
    },
    {
      name: _sshConfigValue_('SEND_PANEL_SHEET', 'SEND_PANEL'),
      schemaKey: 'sendPanel',
      headers: [
        'FML',
        'Phone',
        'Code',
        'Tasks',
        'Status',
        'Sent',
        'Action'
      ],
      minRows: 3
    }
  ]);
}

var SYSTEM_SHEETS_REGISTRY_ = _sshBuildRegistry_();

function _getSystemSheetsRegistry_() {
  SYSTEM_SHEETS_REGISTRY_ = _sshBuildRegistry_();
  return SYSTEM_SHEETS_REGISTRY_;
}

function getAllSystemSheetNames_() {
  return _getSystemSheetsRegistry_().map(function(item) {
    return item.name;
  });
}

function _systemSheetRecordByName_(name) {
  var target = _sshTrimmedString_(name, '');
  var registry = _getSystemSheetsRegistry_();

  for (var i = 0; i < registry.length; i++) {
    if (registry[i].name === target) return registry[i];
  }

  return null;
}

function _buildHeadersFromSchema_(schema) {
  var fields = (schema && schema.fields) || {};
  var names = Object.keys(fields);
  var maxCol = 0;

  for (var i = 0; i < names.length; i++) {
    var field = fields[names[i]];
    var col = Number(field && field.col);
    if (isFinite(col) && col > maxCol) maxCol = col;
  }

  if (maxCol < 1) return [];

  var headers = new Array(maxCol);
  for (var j = 0; j < maxCol; j++) headers[j] = '';

  for (var k = 0; k < names.length; k++) {
    var fieldName = names[k];
    var fieldCfg = fields[fieldName];
    var fieldCol = Number(fieldCfg && fieldCfg.col);
    if (isFinite(fieldCol) && fieldCol >= 1 && fieldCol <= maxCol) {
      headers[fieldCol - 1] = _sshSafeString_(fieldCfg.label || fieldName, '');
    }
  }

  return headers;
}

function _ensureSheetSize_(sheet, minRows, minCols) {
  var rows = Math.max(Number(minRows) || 1, 1);
  var cols = Math.max(Number(minCols) || 1, 1);
  var curRows = Math.max(Number(sheet.getMaxRows()) || 0, 1);
  var curCols = Math.max(Number(sheet.getMaxColumns()) || 0, 1);

  if (curRows < rows) {
    sheet.insertRowsAfter(curRows, rows - curRows);
  }
  
  if (curCols < cols) {
    sheet.insertColumnsAfter(curCols, cols - curCols);
  }
}

function _applyBasicSystemSheetStandards_(sheet, headerRow, lastCol) {
  try {
    sheet.setFrozenRows(Math.max(Number(headerRow) || 1, 1));
  } catch (e) {}

  try {
    sheet.setFrozenColumns(0);
  } catch (e) {}

  try {
    sheet.getRange(headerRow, 1, 1, Math.max(lastCol || 1, 1))
      .setFontWeight('bold')
      .setBackground('#e8eaed');
  } catch (e) {}

  try {
    if (typeof stage7ApplyTableTheme_ === 'function') {
      stage7ApplyTableTheme_(sheet, headerRow, Math.max(lastCol || 1, 1), { freeze: false });
    }
  } catch (e) {
    _sshLog_('Помилка застосування теми таблиці', e);
  }
}

function _applyAccessCheckboxes_(sheet) {
  if (!sheet) return;
  if (_sshTrimmedString_(sheet.getName(), '') !== _sshConfigValue_('ACCESS_SHEET', 'ACCESS')) return;

  var lastRow = Math.max(Number(sheet.getMaxRows()) || 0, 1);
  var checkboxRows = Math.max(lastRow - 1, 0);

  if (checkboxRows < 1) return;

  try {
    sheet.getRange(2, 4, checkboxRows, 1).insertCheckboxes();
  } catch (e) {
    _sshLog_('Checkbox enabled error', e);
  }

  try {
    sheet.getRange(2, 8, checkboxRows, 1).insertCheckboxes();
  } catch (e) {
    _sshLog_('Checkbox self_bind_allowed error', e);
  }
}

function _applySendPanelHeaderRowFormatting_(sheet, headerRow, lastCol) {
  if (!sheet) return;
  if (_sshTrimmedString_(sheet.getName(), '') !== _sshConfigValue_('SEND_PANEL_SHEET', 'SEND_PANEL')) return;

  try {
    if (headerRow > 1) {
      sheet.getRange(1, 1, headerRow - 1, Math.max(lastCol, 1)).setFontWeight('bold');
    }
  } catch (e) {}
}

function _resolveSheetSpec_(record) {
  if (!record) {
    throw new Error('System sheet record is required');
  }

  var schema = null;
  var headerRow = 1;
  var headers = [];
  var lastCol = 1;
  var minRows = Math.max(Number(record.minRows) || 2, 2);
  var sheetName = _sshTrimmedString_(record.name, '');
  var sendPanelName = _sshConfigValue_('SEND_PANEL_SHEET', 'SEND_PANEL');

  if (record.schemaKey) {
    schema = _sshGetSheetSchemaSafe_(record.schemaKey);
  }

  if (schema) {
    headerRow = Math.max(Number(schema.headerRow) || 1, 1);
    headers = _buildHeadersFromSchema_(schema);
    lastCol = Math.max(_sshGetSchemaLastColumnSafe_(schema), headers.length, 1);

    if (sheetName === sendPanelName) {
      var dataStartRow = Number(schema && schema.dataStartRow);
      if (isFinite(dataStartRow) && dataStartRow > 0) {
        minRows = Math.max(dataStartRow, minRows);
      } else {
        minRows = Math.max(headerRow + 1, minRows);
      }
    } else {
      minRows = Math.max(headerRow + 1, minRows);
    }
  } else {
    headers = Array.isArray(record.headers) ? record.headers.slice() : [];
    lastCol = Math.max(headers.length, 1);
    headerRow = 1;
    minRows = Math.max(headerRow + 1, minRows);
  }

  while (headers.length < lastCol) headers.push('');

  return {
    schema: schema,
    headerRow: headerRow,
    headers: headers,
    lastCol: lastCol,
    minRows: minRows
  };
}

function _writeHeadersIfNeeded_(sheet, headerRow, headers, forceRewrite) {
  if (!sheet || !headers || !headers.length) return false;

  var currentValues = [];
  try {
    currentValues = sheet.getRange(headerRow, 1, 1, headers.length).getDisplayValues()[0];
  } catch (e) {
    currentValues = [];
  }

  var hasDifferences = !!forceRewrite;
  if (!hasDifferences) {
    for (var i = 0; i < headers.length; i++) {
      var expected = _sshSafeString_(headers[i], '');
      var actual = _sshSafeString_(currentValues[i], '');
      if (expected !== actual) {
        hasDifferences = true;
        break;
      }
    }
  }

  if (hasDifferences) {
    sheet.getRange(headerRow, 1, 1, headers.length).setValues([headers]);
    return true;
  }

  return false;
}

function ensureSystemSheetByName_(sheetName) {
  var record = _systemSheetRecordByName_(sheetName);
  if (!record) throw new Error('Unknown system sheet: ' + sheetName);

  var ss = _sshGetSpreadsheet_();
  var sheet = ss.getSheetByName(record.name);
  var created = !sheet;

  if (!sheet) {
    sheet = ss.insertSheet(record.name);
  }

  var spec = _resolveSheetSpec_(record);

  _ensureSheetSize_(sheet, spec.minRows, spec.lastCol);
  var headersUpdated = _writeHeadersIfNeeded_(sheet, spec.headerRow, spec.headers, created);

  _applyBasicSystemSheetStandards_(sheet, spec.headerRow, spec.lastCol);
  _applyAccessCheckboxes_(sheet);
  _applySendPanelHeaderRowFormatting_(sheet, spec.headerRow, spec.lastCol);

  return {
    name: record.name,
    created: created,
    headerRow: spec.headerRow,
    columns: spec.lastCol,
    rowsEnsured: spec.minRows,
    headersUpdated: headersUpdated
  };
}

function ensureAllSystemSheets_() {
  var results = [];
  var registry = _getSystemSheetsRegistry_();

  for (var i = 0; i < registry.length; i++) {
    var record = registry[i];
    try {
      results.push(ensureSystemSheetByName_(record.name));
    } catch (e) {
      _sshLog_('Failed to ensure sheet ' + record.name, e);
      results.push({
        name: record.name,
        error: e && e.message ? e.message : String(e)
      });
    }
  }

  return results;
}
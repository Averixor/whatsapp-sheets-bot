const SYSTEM_SHEETS_REGISTRY_ = Object.freeze([
  { name: 'ACCESS', schemaKey: null, headers: ['Email', 'Name', 'Role', 'Callsign', 'Status', 'UpdatedAt'] },

  { name: 'SEND_PANEL', schemaKey: 'sendPanel' },
  { name: 'DICT', schemaKey: 'dict' },
  { name: 'DICT_SUM', schemaKey: 'dictSum' },
  { name: 'PHONES', schemaKey: 'phones' },

  { name: 'JOB_RUNTIME_LOG', schemaKey: null, headers: ['Timestamp', 'JobName', 'TsStart', 'TsEnd', 'Status', 'Source', 'OperationId', 'Message', 'Error', 'InitiatorEmail', 'InitiatorName', 'InitiatorRole', 'InitiatorCallsign', 'EntryPoint', 'TriggerId', 'Notes'] },
  { name: 'CHECKPOINTS', schemaKey: null, headers: ['Timestamp', 'CheckpointKey', 'Value', 'Meta'] },
  { name: 'OPS_LOG', schemaKey: null, headers: ['Timestamp', 'OperationId', 'Scenario', 'Status', 'Message', 'Error', 'Context'] },
  { name: 'ALERTS_LOG', schemaKey: null, headers: ['Timestamp', 'Level', 'Code', 'Message', 'Context', 'CreatedBy'] },
  { name: 'ACTIVE_OPERATIONS', schemaKey: null, headers: ['OperationId', 'Scenario', 'Status', 'StartedAt', 'UpdatedAt', 'Initiator', 'Context'] },
  { name: 'AUDIT_LOG', schemaKey: null, headers: ['Timestamp', 'OperationId', 'Scenario', 'Level', 'Status', 'Initiator', 'DryRun', 'Partial', 'AffectedSheets', 'AffectedEntities', 'AppliedChangesCount', 'SkippedChangesCount', 'Warnings', 'Payload', 'Before', 'After', 'Changes', 'Diagnostics', 'Message', 'Error', 'Context'] },

  { name: 'TEMPLATES', schemaKey: null, headers: ['Key', 'Title', 'Body', 'Channel', 'Lang', 'Active', 'UpdatedAt'] },
  { name: 'LOG', schemaKey: 'log' },
  { name: 'VACATIONS', schemaKey: 'vacations' },

  { name: 'ІСТОРІЯ_ЗВЕДЕНЬ', schemaKey: null, headers: ['Timestamp', 'Date', 'SummaryType', 'Payload', 'Author'] },
  { name: 'Графік_відпусток', schemaKey: null, headers: ['ПІБ', 'Початок', 'Кінець', 'Номер', 'Активна', 'Notify'] }
]);

function getAllSystemSheetNames_() {
  return SYSTEM_SHEETS_REGISTRY_.map(function(item) { return item.name; });
}

function _systemSheetRecordByName_(name) {
  const target = String(name || '').trim();
  for (let i = 0; i < SYSTEM_SHEETS_REGISTRY_.length; i++) {
    if (SYSTEM_SHEETS_REGISTRY_[i].name === target) return SYSTEM_SHEETS_REGISTRY_[i];
  }
  return null;
}

function _buildHeadersFromSchema_(schema) {
  const fields = (schema && schema.fields) || {};
  const names = Object.keys(fields);
  const headers = [];
  names.forEach(function(fieldName) {
    const field = fields[fieldName] || {};
    const col = Number(field.col) || 0;
    if (col < 1) return;
    headers[col - 1] = field.label || fieldName;
  });
  return headers.filter(function(v, i) { return i >= 0; });
}

function _ensureSheetSize_(sheet, minRows, minCols) {
  const rows = Math.max(Number(minRows) || 1, 1);
  const cols = Math.max(Number(minCols) || 1, 1);

  const curRows = Math.max(sheet.getMaxRows(), 1);
  const curCols = Math.max(sheet.getMaxColumns(), 1);

  if (curRows < rows) {
    sheet.insertRowsAfter(curRows, rows - curRows);
  }
  if (curCols < cols) {
    sheet.insertColumnsAfter(curCols, cols - curCols);
  }
}

function _applyBasicSystemSheetStandards_(sheet, headerRow, lastCol) {
  try {
    if (typeof applyFontStandardsToSheet_ === 'function') {
      applyFontStandardsToSheet_(sheet);
    }
  } catch (_) {}

  try {
    if (typeof applyColumnWidthsStandardsToSheet_ === 'function') {
      applyColumnWidthsStandardsToSheet_(sheet);
    }
  } catch (_) {}

  try {
    sheet.setFrozenRows(0);
    sheet.setFrozenColumns(0);
  } catch (_) {}

  try {
    if (typeof stage7ApplyTableTheme_ === 'function') {
      stage7ApplyTableTheme_(sheet, headerRow, Math.max(lastCol || 1, 1), { freeze: false });
    }
  } catch (_) {}
}

function ensureSystemSheetByName_(sheetName) {
  const record = _systemSheetRecordByName_(sheetName);
  if (!record) throw new Error('Unknown system sheet: ' + sheetName);

  const ss = SpreadsheetApp.getActive();
  let sheet = ss.getSheetByName(record.name);
  const created = !sheet;

  if (!sheet) {
    sheet = ss.insertSheet(record.name);
  }

  let headerRow = 1;
  let headers = [];
  let lastCol = 1;

  if (record.schemaKey && typeof getSheetSchema_ === 'function') {
    const schema = getSheetSchema_(record.schemaKey);
    headerRow = Math.max(Number(schema.headerRow) || 1, 1);
    headers = _buildHeadersFromSchema_(schema);
    lastCol = Math.max(typeof getSchemaLastColumn_ === 'function' ? getSchemaLastColumn_(schema) : headers.length, headers.length, 1);
  } else {
    headers = (record.headers || []).slice();
    lastCol = Math.max(headers.length, 1);
  }

  _ensureSheetSize_(sheet, Math.max(headerRow, 2), lastCol);

  if (headers.length) {
    while (headers.length < lastCol) headers.push('');
    sheet.getRange(headerRow, 1, 1, lastCol).setValues([headers]);
  }

  _applyBasicSystemSheetStandards_(sheet, headerRow, lastCol);

  return {
    name: record.name,
    created: created,
    headerRow: headerRow,
    columns: lastCol
  };
}

function ensureAllSystemSheets_() {
  const results = [];
  SYSTEM_SHEETS_REGISTRY_.forEach(function(record) {
    results.push(ensureSystemSheetByName_(record.name));
  });
  return results;
}

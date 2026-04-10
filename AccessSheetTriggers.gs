/**
 * AccessSheetTriggers.gs
 *
 * Simple spreadsheet triggers for ACCESS UI helpers and best-effort security audit.
 *
 * Принципы:
 * - мінімум логування в production;
 * - рання фільтрація подій;
 * - без сумнівних евристик по event object;
 * - ACCESS helper і security audit можуть працювати разом;
 * - тільки перевірені API Spreadsheet/Script.
 */

const TRIGGERS_CHANGE_TYPES_ = Object.freeze([
  'INSERT_GRID',
  'REMOVE_GRID',
  'INSERT_ROW',
  'REMOVE_ROW',
  'INSERT_COLUMN',
  'REMOVE_COLUMN'
]);

let _protectedSheetsCache_ = null;

// ==================== INTERNAL HELPERS ====================

function _getAccessSheetName_() {
  if (typeof appGetCore === 'function') {
    return appGetCore('ACCESS_SHEET', 'ACCESS');
  }
  return 'ACCESS';
}

function _getProtectedSheets_() {
  if (_protectedSheetsCache_ !== null) {
    return _protectedSheetsCache_;
  }

  if (typeof AccessEnforcement_ === 'object' &&
      AccessEnforcement_ &&
      Array.isArray(AccessEnforcement_.PROTECTED_SHEETS)) {
    _protectedSheetsCache_ = AccessEnforcement_.PROTECTED_SHEETS.slice();
    return _protectedSheetsCache_;
  }

  _protectedSheetsCache_ = [];
  return _protectedSheetsCache_;
}

function _isProtectedSheet_(sheetName) {
  const protectedSheets = _getProtectedSheets_();
  for (let i = 0; i < protectedSheets.length; i++) {
    if (protectedSheets[i] === sheetName) {
      return true;
    }
  }
  return false;
}

function _isRelevantChangeType_(changeType) {
  if (!changeType) return false;

  for (let i = 0; i < TRIGGERS_CHANGE_TYPES_.length; i++) {
    if (TRIGGERS_CHANGE_TYPES_[i] === changeType) {
      return true;
    }
  }
  return false;
}

function _safeLog_(message) {
  try {
    Logger.log(message);
  } catch (_) {}
}

function _logError_(context, error, extraDetails) {
  const errorText = error && error.message ? error.message : String(error || 'Unknown error');
  const message = '[' + context + '] ' + errorText;

  _safeLog_(message);

  if (typeof AlertsRepository_ === 'object' &&
      AlertsRepository_ &&
      typeof AlertsRepository_.appendAlert === 'function') {
    try {
      AlertsRepository_.appendAlert({
        type: 'trigger_error',
        severity: 'error',
        source: context,
        message: message,
        details: {
          error: errorText,
          extra: extraDetails || {}
        }
      });
    } catch (_) {
      // best effort only
    }
  }
}

// ==================== TRIGGERS ====================

function onEdit(e) {
  if (!e || !e.range) return;

  const range = e.range;
  const sheet = range.getSheet();
  if (!sheet) return;

  const sheetName = sheet.getName();
  const accessSheetName = _getAccessSheetName_();
  const isAccessSheet = (sheetName === accessSheetName);
  const isProtectedSheet = _isProtectedSheet_(sheetName);

  // Быстрый выход: лист нам вообще не интересен
  if (!isAccessSheet && !isProtectedSheet) {
    return;
  }

  // 1. ACCESS helper
  if (isAccessSheet) {
    try {
      if (typeof AccessControl_ === 'object' &&
          AccessControl_ &&
          typeof AccessControl_.handleAccessSheetEdit === 'function') {
        AccessControl_.handleAccessSheetEdit(e);
      }
    } catch (error) {
      _logError_('onEdit.ACCESS', error, {
        sheetName: sheetName,
        a1Notation: typeof range.getA1Notation === 'function' ? range.getA1Notation() : ''
      });
    }
  }

  // 2. Security audit
  if (isProtectedSheet) {
    try {
      if (typeof stage7SecurityAuditOnEdit === 'function') {
        stage7SecurityAuditOnEdit(e);
      }
    } catch (error) {
      _logError_('onEdit.security', error, {
        sheetName: sheetName,
        a1Notation: typeof range.getA1Notation === 'function' ? range.getA1Notation() : ''
      });
    }
  }
}

function onChange(e) {
  if (!e || !e.changeType) return;
  if (!_isRelevantChangeType_(e.changeType)) return;

  try {
    if (typeof stage7SecurityAuditOnChange === 'function') {
      stage7SecurityAuditOnChange(e);
    }
  } catch (error) {
    _logError_('onChange', error, {
      changeType: e.changeType
    });
  }
}

// ==================== DIAGNOSTICS ====================

function validateTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  let onEditCount = 0;
  let onChangeCount = 0;

  for (let i = 0; i < triggers.length; i++) {
    const trigger = triggers[i];
    const handler = trigger.getHandlerFunction();
    const eventType = trigger.getEventType();

    if (handler === 'onEdit' && eventType === ScriptApp.EventType.ON_EDIT) {
      onEditCount++;
    }
    if (handler === 'onChange' && eventType === ScriptApp.EventType.ON_CHANGE) {
      onChangeCount++;
    }
  }

  const issues = [];
  if (onEditCount > 1) {
    issues.push('Знайдено ' + onEditCount + ' onEdit тригерів (рекомендується 1)');
  }
  if (onChangeCount > 1) {
    issues.push('Знайдено ' + onChangeCount + ' onChange тригерів (рекомендується 1)');
  }

  const result = {
    ok: issues.length === 0,
    totalTriggers: triggers.length,
    onEditCount: onEditCount,
    onChangeCount: onChangeCount,
    issues: issues
  };

  _safeLog_('[validateTriggers] ' + JSON.stringify(result));
  return result;
}

function getProtectedSheetsInfo() {
  const protectedSheets = _getProtectedSheets_();
  const ss = SpreadsheetApp.getActive();
  const sheets = ss.getSheets();

  const existingSheetNames = [];
  for (let i = 0; i < sheets.length; i++) {
    existingSheetNames.push(sheets[i].getName());
  }

  const missingSheets = [];
  for (let i = 0; i < protectedSheets.length; i++) {
    let found = false;
    for (let j = 0; j < existingSheetNames.length; j++) {
      if (existingSheetNames[j] === protectedSheets[i]) {
        found = true;
        break;
      }
    }
    if (!found) {
      missingSheets.push(protectedSheets[i]);
    }
  }

  return {
    accessSheet: _getAccessSheetName_(),
    protectedSheetsCount: protectedSheets.length,
    existingSheetsCount: existingSheetNames.length,
    protectedSheets: protectedSheets.slice(),
    missingSheets: missingSheets,
    allPresent: missingSheets.length === 0
  };
}

function resetProtectedSheetsCache() {
  _protectedSheetsCache_ = null;
  return { success: true, reset: true };
}
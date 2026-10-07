/**
 * AccessSheetTriggers.gs
 *
 * Simple spreadsheet triggers for ACCESS UI helpers and best-effort security audit.
 *
 * Принципи:
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
let _managedAuditTriggerCache_ = null;

// ==================== INTERNAL HELPERS ====================

function _hasManagedSecurityAuditTriggers_() {
  if (_managedAuditTriggerCache_ !== null) {
    return _managedAuditTriggerCache_;
  }

  try {
    if (typeof stage7GetFeatureFlag_ === 'function' && stage7GetFeatureFlag_('managedTriggers', true) === false) {
      _managedAuditTriggerCache_ = false;
      return _managedAuditTriggerCache_;
    }
  } catch (_) {}

  try {
    const props = PropertiesService.getDocumentProperties();
    const raw = props.getProperty('STAGE7:MANAGED_TRIGGERS_INSTALLED_AT');
    if (raw) {
      _managedAuditTriggerCache_ = true;
      return _managedAuditTriggerCache_;
    }
  } catch (_) {}

  try {
    const triggers = ScriptApp.getProjectTriggers();
    let hasEdit = false;
    let hasChange = false;

    for (let i = 0; i < triggers.length; i++) {
      const t = triggers[i];
      const fn = t.getHandlerFunction();
      if (fn === 'stage7SecurityAuditOnEdit') hasEdit = true;
      if (fn === 'stage7SecurityAuditOnChange') hasChange = true;
    }

    _managedAuditTriggerCache_ = hasEdit && hasChange;
    return _managedAuditTriggerCache_;
  } catch (_) {
    _managedAuditTriggerCache_ = false;
    return _managedAuditTriggerCache_;
  }
}

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
    } catch (_) {}
  }
}

// ==================== TRIGGERS ====================

function onEdit(e) {
  if (!e || !e.range) return;

  const range = e.range;
  const sheet = range.getSheet();
  if (!sheet) return;

  const sheetName = sheet.getName();

  try {
    if (
      typeof InventoryReconciliation_ === "object" &&
      InventoryReconciliation_ &&
      typeof InventoryReconciliation_.handleEdit === "function"
    ) {
      InventoryReconciliation_.handleEdit(e);
    }
  } catch (error) {
    _logError_("onEdit.inventoryReconciliation", error, {
      sheetName: sheetName,
      a1Notation:
        typeof range.getA1Notation === "function" ? range.getA1Notation() : "",
    });
  }

  try {
    if (
      typeof TemporaryPropertyRegister_ === "object" &&
      TemporaryPropertyRegister_ &&
      typeof TemporaryPropertyRegister_.handleEdit === "function"
    ) {
      TemporaryPropertyRegister_.handleEdit(e);
    }
  } catch (error) {
    _logError_("onEdit.temporaryProperty", error, {
      sheetName: sheetName,
      a1Notation:
        typeof range.getA1Notation === "function" ? range.getA1Notation() : "",
    });
  }

  const accessSheetName = _getAccessSheetName_();
  const isAccessSheet = (sheetName === accessSheetName);
  const isProtectedSheet = _isProtectedSheet_(sheetName);

  if (!isAccessSheet && !isProtectedSheet) {
    return;
  }

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

  if (isProtectedSheet) {
    try {
      if (!_hasManagedSecurityAuditTriggers_() && typeof stage7SecurityAuditOnEdit === 'function') {
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
    if (!_hasManagedSecurityAuditTriggers_() && typeof stage7SecurityAuditOnChange === 'function') {
      stage7SecurityAuditOnChange(e);
    }
  } catch (error) {
    _logError_('onChange', error, {
      changeType: e.changeType
    });
  }
}

// ==================== DIAGNOSTICS ====================

function _getStage7TriggerCompatibilityPolicy_() {
  return {
    legacyInstallable: [
      { handler: 'onEdit', eventType: ScriptApp.EventType.ON_EDIT, maxCount: 1 },
      { handler: 'onChange', eventType: ScriptApp.EventType.ON_CHANGE, maxCount: 1 }
    ]
  };
}

function validateTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  const policy = _getStage7TriggerCompatibilityPolicy_();
  const counts = {};
  const handlerCounts = {};

  for (let i = 0; i < triggers.length; i++) {
    const trigger = triggers[i];
    const handler = trigger.getHandlerFunction();
    const eventType = trigger.getEventType();
    const key = handler + '\n' + eventType;
    counts[key] = (counts[key] || 0) + 1;
    handlerCounts[handler] = (handlerCounts[handler] || 0) + 1;
  }

  const issues = [];
  const policyCounts = {};
  let wrongEventCount = 0;
  policy.legacyInstallable.forEach(function (rule) {
    const count = Number(counts[rule.handler + '\n' + rule.eventType] || 0);
    const wrongCount = Math.max(Number(handlerCounts[rule.handler] || 0) - count, 0);
    policyCounts[rule.handler] = count;
    if (count > rule.maxCount) {
      issues.push(
        'Знайдено ' + count + ' ' + rule.handler + ' тригерів (рекомендується ' +
          rule.maxCount + ')'
      );
    }
    if (wrongCount > 0) {
      wrongEventCount += wrongCount;
      issues.push(
        'Знайдено ' + wrongCount + ' ' + rule.handler +
          ' тригерів з неправильним типом події'
      );
    }
  });

  const result = {
    ok: issues.length === 0,
    totalTriggers: triggers.length,
    onEditCount: Number(policyCounts.onEdit || 0),
    onChangeCount: Number(policyCounts.onChange || 0),
    wrongEventCount: wrongEventCount,
    issues: issues
  };

  _safeLog_('[validateTriggers] ' + JSON.stringify(result));
  return result;
}

function getProtectedSheetsInfo() {
  const protectedSheets = _getProtectedSheets_();
  const ss = getWasbSpreadsheet_();
  const sheets = ss.getSheets();

  const existingSheetNames = [];
  for (let i = 0; i < sheets.length; i++) {
    existingSheetNames.push(sheets[i].getName());
  }

  const missingSheets = [];
  for (let i = 0; i < protectedSheets.length; i++) {
    var protectedName = protectedSheets[i];
    var found = false;
    if (typeof getLogicalSheet_ === "function") {
      try {
        found = !!getLogicalSheet_(protectedName, false);
      } catch (_) {
        found = false;
      }
    } else {
      for (let j = 0; j < existingSheetNames.length; j++) {
        if (existingSheetNames[j] === protectedName) {
          found = true;
          break;
        }
      }
    }
    if (!found) {
      missingSheets.push(protectedName);
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

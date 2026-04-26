/**
 * AccessPolicyChecks.gs
 *
 * Dry-run policy validation for access control and key-rotation contracts.
 * Канонічний Stage 7 файл для безпечних перевірок політик доступу.
 * Це набір безпечних перевірок політик доступу без побічних ефектів.
 */

// ==================== КОНФІГУРАЦІЯ ====================

var POLICY_CHECKS_CONFIG_ = {
  EXPECTED_PROTECTED_SHEETS: [
    'ACCESS',
    'ALERTS_LOG',
    'JOB_RUNTIME_LOG',
    'AUDIT_LOG',
    'OPS_LOG',
    'ACTIVE_OPERATIONS',
    'CHECKPOINTS',
    'DICT',
    'DICT_SUM',
    'TEMPLATES',
    'LOG',
    'VACATIONS',
    'VACATION_SCHEDULE',
    'SEND_PANEL',
    'PHONES'
  ],


  STRICT_PROTECTED_SHEETS_MODE: false,

  REQUIRED_MAINTENANCE_ACTIONS: [
    'repair', 
    'protections', 
    'triggers'
  ],

  ROLES_WITH_ACTIONS: [
    'viewer', 
    'operator', 
    'maintainer', 
    'admin', 
    'sysadmin', 
    'owner'
  ],

  SCRIPT_PROPERTY_ALLOW_TESTS: 'WASB_ALLOW_POLICY_TESTS'
};

if (typeof Object.freeze === 'function') {
  Object.freeze(POLICY_CHECKS_CONFIG_.EXPECTED_PROTECTED_SHEETS);
  Object.freeze(POLICY_CHECKS_CONFIG_.REQUIRED_MAINTENANCE_ACTIONS);
  Object.freeze(POLICY_CHECKS_CONFIG_.ROLES_WITH_ACTIONS);
  Object.freeze(POLICY_CHECKS_CONFIG_);
}

// ==================== ВНУТРІШНІ ДОПОМІЖНІ ФУНКЦІЇ ====================

/**
 * Створює помилку пропуску перевірки (SKIP).
 * @param {string} message
 * @returns {Error}
 */
function _createSkipError_(message) {
  var err = new Error(message || 'Check skipped');
  err.name = 'PolicyCheckSkipError';
  err.isPolicyCheckSkip = true;
  return err;
}

/**
 * Створює помилку блокування перевірки (BLOCKED).
 * @param {string} message
 * @returns {Error}
 */
function _createBlockedError_(message) {
  var err = new Error(message || 'Check blocked by safety policy');
  err.name = 'PolicyCheckBlockedError';
  err.isPolicyCheckBlocked = true;
  return err;
}

function _isSkipError_(error) {
  return !!(error && error.isPolicyCheckSkip === true);
}

function _isBlockedError_(error) {
  return !!(error && error.isPolicyCheckBlocked === true);
}

/**
 * Отримує версію Stage з метаданих проєкту.
 * @returns {string}
 */
function _getStageVersionForChecks_() {
  try {
    if (typeof getProjectBundleMetadata_ === 'function') {
      var meta = getProjectBundleMetadata_();
      if (meta && meta.stageVersion) return meta.stageVersion;
      if (meta && meta.stage) return String(meta.stage);
    }
  } catch (_) {}
  return 'unknown';
}

/**
 * Повертає поточний timestamp для логів.
 * @returns {string}
 */
function _getCurrentTimestampForChecks_() {
  try {
    return Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone() || 'UTC',
      'yyyy-MM-dd HH:mm:ss'
    );
  } catch (_) {
    return new Date().toISOString();
  }
}

function _safeLogPolicyChecks_(message) {
  try {
    Logger.log(message);
  } catch (_) {}
}

function _safeToString_(value) {
  if (value === null || value === undefined) return '';
  try {
    return String(value);
  } catch (_) {
    return '';
  }
}

function _safeCloneForLog_(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_) {
    return { note: 'unserializable-details' };
  }
}

/**
 * Логує результат перевірки в AlertsRepository (якщо доступний).
 */
function _logPolicyCheckToRepository_(checkName, status, message, details) {
  try {
    if (typeof AlertsRepository_ === 'object' &&
        AlertsRepository_ &&
        typeof AlertsRepository_.appendAlert === 'function') {
      var severity = 'info';
      if (status === 'FAIL') severity = 'error';
      else if (status === 'BLOCKED') severity = 'warning';

      AlertsRepository_.appendAlert({
        type: 'policy_check',
        severity: severity,
        action: checkName,
        outcome: status,
        message: message,
        details: _safeCloneForLog_(details || {})
      });
    }
  } catch (_) {}
}

/**
 * Нормалізує опції для перевірок.
 * @param {Object} options
 * @returns {Object}
 */
function _normalizeOptionsForPolicyChecks_(options) {
  var opts = options || {};
  return {
    forceRun: opts.forceRun === true,
    safeTestEnvironment: opts.safeTestEnvironment === true,
    strictProtectedSheetsMode: typeof opts.strictProtectedSheetsMode === 'boolean'
      ? opts.strictProtectedSheetsMode
      : POLICY_CHECKS_CONFIG_.STRICT_PROTECTED_SHEETS_MODE
  };
}

/**
 * Перевіряє, чи можна виконувати перевірки в поточному середовищі.
 * @param {Object} options
 * @returns {boolean}
 */
function _isSafeTestEnvironment_(options) {
  var opts = _normalizeOptionsForPolicyChecks_(options);

  if (opts.forceRun === true) return true;
  if (opts.safeTestEnvironment === true) return true;

  try {
    var props = PropertiesService.getScriptProperties();
    if (props.getProperty(POLICY_CHECKS_CONFIG_.SCRIPT_PROPERTY_ALLOW_TESTS) === 'true') {
      return true;
    }
  } catch (_) {}

  return false;
}

/**
 * Перевіряє, чи дозволено запускати перевірки.
 * @param {Object} options
 * @returns {Object}
 */
function _canRunPolicyChecks_(options) {
  if (_isSafeTestEnvironment_(options)) {
    return { allowed: true, reason: null };
  }

  return {
    allowed: false,
    reason: 'Policy checks blocked outside safe environment. ' +
            'Use { forceRun: true } or set script property ' +
            POLICY_CHECKS_CONFIG_.SCRIPT_PROPERTY_ALLOW_TESTS +
            '=true.'
  };
}

// ==================== ВАЛІДАЦІЙНІ ХЕЛПЕРИ ====================

function _requireObjectWithMethod_(obj, methodName, objectName) {
  if (typeof obj !== 'object' || !obj || typeof obj[methodName] !== 'function') {
    throw new Error(objectName + '.' + methodName + ' is not available');
  }
}

function _requireObject_(obj, objectName) {
  if (typeof obj !== 'object' || !obj) {
    throw new Error(objectName + ' is not available');
  }
}

function _requireArray_(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(label + ' should be an array');
  }
}

/**
 * Перетворює масив дій на об'єкт-множину (для швидкого пошуку).
 * @param {Array} actions
 * @returns {Object}
 */
function _asCanonicalActionSet_(actions) {
  _requireArray_(actions, 'Allowed actions');

  var map = {};
  for (var i = 0; i < actions.length; i++) {
    var raw = _safeToString_(actions[i]).trim();
    if (!raw) continue;
    map[raw] = true;
    map[raw.toLowerCase()] = true;
  }
  return map;
}

/**
 * Перевіряє, чи містить множина дій хоча б одну з кандидатів.
 * @param {Object} actionSet
 * @param {Array} candidates
 * @returns {boolean}
 */
function _actionSetHasAny_(actionSet, candidates) {
  for (var i = 0; i < candidates.length; i++) {
    var candidate = _safeToString_(candidates[i]).trim();
    if (!candidate) continue;
    if (actionSet[candidate] || actionSet[candidate.toLowerCase()]) {
      return true;
    }
  }
  return false;
}

/**
 * Отримує список дозволених дій для ролі (з AccessControl_).
 * @param {string} role
 * @returns {Array}
 */
function _getAllowedActionsForRoleOrSkip_(role) {
  if (typeof AccessControl_ !== 'object' ||
      !AccessControl_ ||
      typeof AccessControl_.listAllowedActionsForRole !== 'function') {
    throw _createSkipError_('AccessControl_.listAllowedActionsForRole is not available');
  }

  var actions = AccessControl_.listAllowedActionsForRole(role);
  if (!Array.isArray(actions)) {
    throw new Error('Allowed actions should be an array for role: ' + role);
  }

  return actions.slice();
}

// ==================== ФОРМУВАННЯ ЗВІТУ ====================

function _summarizeReportCounts_(report) {
  var summary = {
    ok: 0,
    fail: 0,
    skip: 0,
    blocked: 0,
    total: 0
  };

  var checks = Array.isArray(report && report.checks) ? report.checks : [];
  for (var i = 0; i < checks.length; i++) {
    var status = checks[i] && checks[i].status;
    if (status === 'OK') summary.ok++;
    else if (status === 'FAIL') summary.fail++;
    else if (status === 'SKIP') summary.skip++;
    else if (status === 'BLOCKED') summary.blocked++;
  }

  summary.total = checks.length;
  return summary;
}

function _pushPolicyCheck_(report, checkName, fn) {
  var item = {
    name: checkName,
    status: 'OK',
    details: null,
    timestamp: _getCurrentTimestampForChecks_()
  };

  try {
    var result = fn();
    item.details = (result === undefined || result === null) ? 'OK' : result;
  } catch (error) {
    if (_isBlockedError_(error)) {
      item.status = 'BLOCKED';
      item.details = error.message || 'Blocked';
      _logPolicyCheckToRepository_(checkName, 'BLOCKED', item.details, {});
    } else if (_isSkipError_(error)) {
      item.status = 'SKIP';
      item.details = error.message || 'Skipped';
    } else {
      report.ok = false;
      item.status = 'FAIL';
      item.details = error && error.message ? error.message : String(error);
      item.stack = error && error.stack
        ? String(error.stack).split('\n').slice(0, 3).join('\n')
        : '';
      _logPolicyCheckToRepository_(checkName, 'FAIL', item.details, { stack: item.stack });
    }
  }

  report.checks.push(item);
}

// ==================== ПЕРЕХОПЛЕННЯ ПОБІЧНИХ ЕФЕКТІВ ====================

function _patchSideEffectsForPolicyChecks_() {
  var originals = {
    accessReportViolation: null,
    mailSendEmail: null
  };

  try {
    if (typeof AccessEnforcement_ !== 'undefined' &&
        AccessEnforcement_ &&
        typeof AccessEnforcement_.reportViolation === 'function') {
      originals.accessReportViolation = AccessEnforcement_.reportViolation;
      AccessEnforcement_.reportViolation = function() {
        return {
          success: true,
          emailSent: false,
          alertLogged: false,
          dryRun: true
        };
      };
    }
  } catch (_) {}

  try {
    if (typeof MailApp !== 'undefined' &&
        MailApp &&
        typeof MailApp.sendEmail === 'function') {
      originals.mailSendEmail = MailApp.sendEmail;
      MailApp.sendEmail = function() { return undefined; };
    }
  } catch (_) {}

  return originals;
}

function _restoreSideEffectsForPolicyChecks_(originals) {
  var saved = originals || {};

  try {
    if (saved.accessReportViolation &&
        typeof AccessEnforcement_ !== 'undefined' &&
        AccessEnforcement_) {
      AccessEnforcement_.reportViolation = saved.accessReportViolation;
    }
  } catch (_) {}

  try {
    if (saved.mailSendEmail &&
        typeof MailApp !== 'undefined' &&
        MailApp) {
      MailApp.sendEmail = saved.mailSendEmail;
    }
  } catch (_) {}
}

function _buildBlockedReport_(message) {
  return {
    ok: true,
    blocked: true,
    stage: _getStageVersionForChecks_(),
    ts: _getCurrentTimestampForChecks_(),
    dryRun: true,
    status: 'BLOCKED',
    error: 'SAFETY_BLOCKED',
    message: message,
    checks: [],
    summary: {
      ok: 0,
      fail: 0,
      skip: 0,
      blocked: 1,
      total: 0
    }
  };
}

// ==================== ГОЛОВНА ФУНКЦІЯ ====================

/**
 * Запускає всі перевірки політик доступу.
 * @param {Object} options
 * @returns {Object}
 */
function runAccessPolicyChecks(options) {
  var opts = _normalizeOptionsForPolicyChecks_(options);
  var safety = _canRunPolicyChecks_(opts);

  if (!safety.allowed) {
    var blockedReport = _buildBlockedReport_(safety.reason);
    _logPolicyCheckToRepository_('runAccessPolicyChecks', 'BLOCKED', safety.reason, blockedReport);
    return blockedReport;
  }

  var report = {
    ok: true,
    blocked: false,
    status: 'OK',
    stage: _getStageVersionForChecks_(),
    ts: _getCurrentTimestampForChecks_(),
    dryRun: true,
    options: {
      strictProtectedSheetsMode: opts.strictProtectedSheetsMode
    },
    checks: []
  };

  var originals = _patchSideEffectsForPolicyChecks_();

  try {
    _pushPolicyCheck_(report, 'AccessControl.describe available', function() {
      _requireObjectWithMethod_(AccessControl_, 'describe', 'AccessControl_');
      return 'describe-ok';
    });

    _pushPolicyCheck_(report, 'descriptor exposes rotation policy contract', function() {
      _requireObjectWithMethod_(AccessControl_, 'describe', 'AccessControl_');

      var descriptor = AccessControl_.describe();
      _requireObject_(descriptor, 'AccessControl_.describe() result');

      if (!('rotationPolicy' in descriptor)) {
        throw new Error('rotationPolicy missing');
      }

      if (!('migrationModeEnabled' in descriptor)) {
        throw new Error('migrationModeEnabled missing');
      }

      if (!('allowedActions' in descriptor)) {
        throw new Error('allowedActions missing');
      }

      if (typeof descriptor.migrationModeEnabled !== 'boolean') {
        throw new Error('migrationModeEnabled should be boolean');
      }

      if (!Array.isArray(descriptor.allowedActions)) {
        throw new Error('allowedActions should be array');
      }

      return {
        rotationPolicyPresent: true,
        migrationModeEnabled: descriptor.migrationModeEnabled,
        allowedActionsCount: descriptor.allowedActions.length
      };
    });

    _pushPolicyCheck_(report, 'viewer may open only own card', function() {
      _requireObject_(AccessEnforcement_, 'AccessEnforcement_');
      if (typeof AccessEnforcement_.canOpenPersonCard !== 'function') {
        throw new Error('AccessEnforcement_.canOpenPersonCard is not available');
      }

      var viewer = {
        role: 'viewer',
        enabled: true,
        registered: true,
        personCallsign: 'ALFA'
      };

      if (!AccessEnforcement_.canOpenPersonCard(viewer, 'ALFA')) {
        throw new Error('Viewer own card should be allowed');
      }

      if (AccessEnforcement_.canOpenPersonCard(viewer, 'BRAVO')) {
        throw new Error('Viewer foreign card should be denied');
      }

      return 'viewer-self-card-ok';
    });

    _pushPolicyCheck_(report, 'viewer cannot use summaries or send panel', function() {
      _requireObject_(AccessEnforcement_, 'AccessEnforcement_');

      var methods = ['canUseDaySummary', 'canUseDetailedSummary', 'canUseSendPanel'];
      for (var i = 0; i < methods.length; i++) {
        if (typeof AccessEnforcement_[methods[i]] !== 'function') {
          throw new Error('AccessEnforcement_.' + methods[i] + ' is not available');
        }
      }

      var viewer = {
        role: 'viewer',
        enabled: true,
        registered: true,
        personCallsign: 'ALFA'
      };

      if (AccessEnforcement_.canUseDaySummary(viewer)) {
        throw new Error('Viewer day summary should be denied');
      }

      if (AccessEnforcement_.canUseDetailedSummary(viewer)) {
        throw new Error('Viewer detailed summary should be denied');
      }

      if (AccessEnforcement_.canUseSendPanel(viewer)) {
        throw new Error('Viewer send panel should be denied');
      }

      return 'viewer-restrictions-ok';
    });

    _pushPolicyCheck_(report, 'operator gets summaries but not working actions', function() {
      _requireObject_(AccessEnforcement_, 'AccessEnforcement_');

      var methods = ['canUseDaySummary', 'canUseDetailedSummary', 'canUseWorkingActions', 'canUseSendPanel'];
      for (var i = 0; i < methods.length; i++) {
        if (typeof AccessEnforcement_[methods[i]] !== 'function') {
          throw new Error('AccessEnforcement_.' + methods[i] + ' is not available');
        }
      }

      var operator = {
        role: 'operator',
        enabled: true,
        registered: true
      };

      if (!AccessEnforcement_.canUseDaySummary(operator)) {
        throw new Error('Operator day summary should be allowed');
      }

      if (!AccessEnforcement_.canUseDetailedSummary(operator)) {
        throw new Error('Operator detailed summary should be allowed');
      }

      if (AccessEnforcement_.canUseWorkingActions(operator)) {
        throw new Error('Operator working actions should be denied');
      }

      if (AccessEnforcement_.canUseSendPanel(operator)) {
        throw new Error('Operator send panel should be denied');
      }

      return 'operator-summaries-only-ok';
    });

    _pushPolicyCheck_(report, 'guest stays locked out of cards and send panel', function() {
      _requireObject_(AccessEnforcement_, 'AccessEnforcement_');

      if (typeof AccessEnforcement_.canOpenPersonCard !== 'function') {
        throw new Error('AccessEnforcement_.canOpenPersonCard is not available');
      }
      if (typeof AccessEnforcement_.canUseSendPanel !== 'function') {
        throw new Error('AccessEnforcement_.canUseSendPanel is not available');
      }

      var guest = {
        role: 'guest',
        enabled: true,
        registered: false
      };

      if (AccessEnforcement_.canOpenPersonCard(guest, 'ALFA')) {
        throw new Error('Guest person card should be denied');
      }
      if (AccessEnforcement_.canUseSendPanel(guest)) {
        throw new Error('Guest send panel should be denied');
      }

      return 'guest-restrictions-ok';
    });

    _pushPolicyCheck_(report, 'viewer allowed actions stay minimal and non-admin', function() {
      var actions = _getAllowedActionsForRoleOrSkip_('viewer');
      var set = _asCanonicalActionSet_(actions);

      var positive = ['власна картка', 'own-card', 'self-card', 'person-card:self'];
      var forbidden = ['коротке зведення', 'day-summary', 'summary:day', 'адмін-дії', 'admin-actions', 'send-panel', 'working-actions'];

      if (!_actionSetHasAny_(set, positive)) {
        throw new Error('Viewer expected own-card style permission is missing. Actions: ' + actions.join(', '));
      }
      if (_actionSetHasAny_(set, forbidden)) {
        throw new Error('Viewer received forbidden elevated action. Actions: ' + actions.join(', '));
      }

      return {
        actionsCount: actions.length,
        minimalProfile: true
      };
    });

    _pushPolicyCheck_(report, 'sysadmin has required maintenance actions', function() {
      var actions = _getAllowedActionsForRoleOrSkip_('sysadmin');
      var set = _asCanonicalActionSet_(actions);
      var required = POLICY_CHECKS_CONFIG_.REQUIRED_MAINTENANCE_ACTIONS;

      for (var i = 0; i < required.length; i++) {
        if (!_actionSetHasAny_(set, [required[i]])) {
          throw new Error('sysadmin missing action: ' + required[i]);
        }
      }

      return {
        requiredActions: required.slice(),
        actionsCount: actions.length
      };
    });

    _pushPolicyCheck_(report, 'core roles expose allowed actions map', function() {
      var out = {};
      var roles = POLICY_CHECKS_CONFIG_.ROLES_WITH_ACTIONS;

      for (var i = 0; i < roles.length; i++) {
        var role = roles[i];
        var actions = _getAllowedActionsForRoleOrSkip_(role);
        if (!actions.length) {
          throw new Error('Allowed actions missing or empty for role: ' + role);
        }
        out[role] = actions.length;
      }

      return out;
    });

    _pushPolicyCheck_(report, 'protected sheets contract matches configuration', function() {
      _requireObject_(AccessEnforcement_, 'AccessEnforcement_');
      if (!Array.isArray(AccessEnforcement_.PROTECTED_SHEETS)) {
        throw new Error('AccessEnforcement_.PROTECTED_SHEETS is not available');
      }

      var expected = POLICY_CHECKS_CONFIG_.EXPECTED_PROTECTED_SHEETS.slice();
      var actual = AccessEnforcement_.PROTECTED_SHEETS.slice();
      var missing = [];
      var extra = [];

      for (var i = 0; i < expected.length; i++) {
        if (actual.indexOf(expected[i]) === -1) missing.push(expected[i]);
      }
      for (var j = 0; j < actual.length; j++) {
        if (expected.indexOf(actual[j]) === -1) extra.push(actual[j]);
      }

      if (missing.length) {
        throw new Error('Missing protected sheets: ' + missing.join(', '));
      }
      if (opts.strictProtectedSheetsMode && extra.length) {
        throw new Error('Unexpected protected sheets in strict mode: ' + extra.join(', '));
      }

      return {
        mode: opts.strictProtectedSheetsMode ? 'strict' : 'lenient',
        expectedCount: expected.length,
        actualCount: actual.length,
        missingCount: missing.length,
        extraCount: extra.length,
        extraSheets: extra
      };
    });

    _pushPolicyCheck_(report, 'maintenance actions contract covers elevated roles', function() {
      var elevated = ['maintainer', 'admin', 'sysadmin', 'owner'];
      var output = {};

      for (var i = 0; i < elevated.length; i++) {
        var role = elevated[i];
        var actions = _getAllowedActionsForRoleOrSkip_(role);
        var set = _asCanonicalActionSet_(actions);

        output[role] = {
          count: actions.length,
          hasRepair: _actionSetHasAny_(set, ['repair']),
          hasProtections: _actionSetHasAny_(set, ['protections']),
          hasTriggers: _actionSetHasAny_(set, ['triggers'])
        };
      }

      return output;
    });

  } finally {
    _restoreSideEffectsForPolicyChecks_(originals);
  }

  report.summary = _summarizeReportCounts_(report);
  if (report.summary.fail > 0) {
    report.status = 'FAIL';
    report.ok = false;
  } else if (report.summary.blocked > 0) {
    report.status = 'BLOCKED';
  } else if (report.summary.skip > 0) {
    report.status = 'OK_WITH_SKIPS';
  } else {
    report.status = 'OK';
  }

  _safeLogPolicyChecks_('[runAccessPolicyChecks] ' + JSON.stringify({
    ok: report.ok,
    status: report.status,
    checks: report.summary.total,
    summary: report.summary,
    ts: report.ts
  }));

  return report;
}

// ==================== ДІАГНОСТИЧНІ ХЕЛПЕРИ ====================

function runAllPolicyChecks(options) {
  return runAccessPolicyChecks(options || {});
}

function getPolicyChecksConfig() {
  return {
    expectedProtectedSheets: POLICY_CHECKS_CONFIG_.EXPECTED_PROTECTED_SHEETS.slice(),
    strictProtectedSheetsMode: POLICY_CHECKS_CONFIG_.STRICT_PROTECTED_SHEETS_MODE,
    requiredMaintenanceActions: POLICY_CHECKS_CONFIG_.REQUIRED_MAINTENANCE_ACTIONS.slice(),
    rolesWithActions: POLICY_CHECKS_CONFIG_.ROLES_WITH_ACTIONS.slice(),
    scriptPropertyAllowTests: POLICY_CHECKS_CONFIG_.SCRIPT_PROPERTY_ALLOW_TESTS
  };
}
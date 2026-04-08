/**
 * AccessPolicyChecks.gs
 *
 * Dry-run policy validation for access control and key-rotation contracts.
 *
 * Канонічний Stage 7 файл для безпечних перевірок політик доступу.
 * AccessE2ETests.gs використовується лише як thin compatibility wrapper.
 *
 * Це не E2E-тести в класичному сенсі.
 * Це набір безпечних перевірок політик доступу без побічних ефектів.
 */

const POLICY_CHECKS_CONFIG_ = Object.freeze({
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
    'ИСТОРИЯ_ЗВЕДЕНЬ',
    'Графік_відпусток',
    'SEND_PANEL',
    'PHONES'
  ],

  /**
   * Базова політика:
   * false -> достатньо, що всі очікувані листи присутні
   * true  -> потрібен точний збіг без зайвих листів
   *
   * Для стабільності baseline краще тримати false.
   */
  STRICT_PROTECTED_SHEETS_MODE: false,

  REQUIRED_MAINTENANCE_ACTIONS: ['repair', 'protections', 'triggers'],
  ROLES_WITH_ACTIONS: ['viewer', 'operator', 'maintainer', 'admin', 'sysadmin', 'owner'],

  SCRIPT_PROPERTY_ALLOW_TESTS: 'WASB_ALLOW_POLICY_TESTS'
});

// ==================== INTERNAL HELPERS ====================

function _createSkipError_(message) {
  const err = new Error(message || 'Check skipped');
  err.name = 'PolicyCheckSkipError';
  err.isPolicyCheckSkip = true;
  return err;
}

function _createBlockedError_(message) {
  const err = new Error(message || 'Check blocked by safety policy');
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

function _getStageVersionForChecks_() {
  try {
    if (typeof getProjectBundleMetadata_ === 'function') {
      const meta = getProjectBundleMetadata_();
      if (meta && meta.stageVersion) return meta.stageVersion;
      if (meta && meta.stage) return String(meta.stage);
    }
  } catch (_) {}
  return 'unknown';
}

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

function _logPolicyCheckToRepository_(checkName, status, message, details) {
  try {
    if (typeof AlertsRepository_ === 'object' &&
        AlertsRepository_ &&
        typeof AlertsRepository_.appendAlert === 'function') {
      AlertsRepository_.appendAlert({
        type: 'policy_check',
        severity:
          status === 'FAIL'
            ? 'error'
            : status === 'BLOCKED'
              ? 'warning'
              : 'info',
        action: checkName,
        outcome: status,
        message: message,
        details: _safeCloneForLog_(details || {})
      });
    }
  } catch (_) {
    // best effort only
  }
}

function _normalizeOptionsForPolicyChecks_(options) {
  const opts = options || {};
  return {
    forceRun: opts.forceRun === true,
    safeTestEnvironment: opts.safeTestEnvironment === true,
    strictProtectedSheetsMode:
      typeof opts.strictProtectedSheetsMode === 'boolean'
        ? opts.strictProtectedSheetsMode
        : POLICY_CHECKS_CONFIG_.STRICT_PROTECTED_SHEETS_MODE
  };
}

function _isSafeTestEnvironment_(options) {
  const opts = _normalizeOptionsForPolicyChecks_(options);

  if (opts.forceRun === true) return true;
  if (opts.safeTestEnvironment === true) return true;

  try {
    const props = PropertiesService.getScriptProperties();
    if (props.getProperty(POLICY_CHECKS_CONFIG_.SCRIPT_PROPERTY_ALLOW_TESTS) === 'true') {
      return true;
    }
  } catch (_) {}

  return false;
}

function _canRunPolicyChecks_(options) {
  if (_isSafeTestEnvironment_(options)) {
    return { allowed: true, reason: null };
  }

  return {
    allowed: false,
    reason:
      'Policy checks blocked outside safe environment. ' +
      'Use { forceRun: true } or set script property ' +
      POLICY_CHECKS_CONFIG_.SCRIPT_PROPERTY_ALLOW_TESTS +
      '=true.'
  };
}

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

function _asCanonicalActionSet_(actions) {
  _requireArray_(actions, 'Allowed actions');

  const map = {};
  for (var i = 0; i < actions.length; i++) {
    const raw = _safeToString_(actions[i]).trim();
    if (!raw) continue;
    map[raw] = true;
    map[raw.toLowerCase()] = true;
  }
  return map;
}

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

function _getAllowedActionsForRoleOrSkip_(role) {
  if (typeof AccessControl_ !== 'object' ||
      !AccessControl_ ||
      typeof AccessControl_.listAllowedActionsForRole !== 'function') {
    throw _createSkipError_('AccessControl_.listAllowedActionsForRole is not available');
  }

  const actions = AccessControl_.listAllowedActionsForRole(role);
  if (!Array.isArray(actions)) {
    throw new Error('Allowed actions should be an array for role: ' + role);
  }

  return actions.slice();
}

function _summarizeReportCounts_(report) {
  const summary = {
    ok: 0,
    fail: 0,
    skip: 0,
    blocked: 0,
    total: 0
  };

  const checks = Array.isArray(report && report.checks) ? report.checks : [];
  for (var i = 0; i < checks.length; i++) {
    const status = checks[i] && checks[i].status;
    if (status === 'OK') summary.ok++;
    else if (status === 'FAIL') summary.fail++;
    else if (status === 'SKIP') summary.skip++;
    else if (status === 'BLOCKED') summary.blocked++;
  }

  summary.total = checks.length;
  return summary;
}

function _pushPolicyCheck_(report, checkName, fn) {
  const item = {
    name: checkName,
    status: 'OK',
    details: null,
    timestamp: _getCurrentTimestampForChecks_()
  };

  try {
    const result = fn();
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

function _patchSideEffectsForPolicyChecks_() {
  const originals = {
    accessReportViolation: null,
    mailSendEmail: null
  };

  try {
    if (typeof AccessEnforcement_ !== 'undefined' &&
        AccessEnforcement_ &&
        typeof AccessEnforcement_.reportViolation === 'function') {
      originals.accessReportViolation = AccessEnforcement_.reportViolation;
      AccessEnforcement_.reportViolation = function () {
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
      MailApp.sendEmail = function () {
        return undefined;
      };
    }
  } catch (_) {}

  return originals;
}

function _restoreSideEffectsForPolicyChecks_(originals) {
  const saved = originals || {};

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

// ==================== MAIN ====================

function runAccessPolicyChecks(options) {
  const opts = _normalizeOptionsForPolicyChecks_(options);
  const safety = _canRunPolicyChecks_(opts);

  if (!safety.allowed) {
    const blockedReport = _buildBlockedReport_(safety.reason);

    _logPolicyCheckToRepository_(
      'runAccessPolicyChecks',
      'BLOCKED',
      safety.reason,
      blockedReport
    );

    return blockedReport;
  }

  const report = {
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

  const originals = _patchSideEffectsForPolicyChecks_();

  try {
    _pushPolicyCheck_(report, 'AccessControl.describe available', function () {
      _requireObjectWithMethod_(AccessControl_, 'describe', 'AccessControl_');
      return 'describe-ok';
    });

    _pushPolicyCheck_(report, 'descriptor exposes rotation policy contract', function () {
      _requireObjectWithMethod_(AccessControl_, 'describe', 'AccessControl_');

      const descriptor = AccessControl_.describe();
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

    _pushPolicyCheck_(report, 'viewer may open only own card', function () {
      _requireObject_(AccessEnforcement_, 'AccessEnforcement_');
      if (typeof AccessEnforcement_.canOpenPersonCard !== 'function') {
        throw new Error('AccessEnforcement_.canOpenPersonCard is not available');
      }

      const viewer = {
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

    _pushPolicyCheck_(report, 'viewer cannot use summaries or send panel', function () {
      _requireObject_(AccessEnforcement_, 'AccessEnforcement_');

      const requiredMethods = [
        'canUseDaySummary',
        'canUseDetailedSummary',
        'canUseSendPanel'
      ];
      for (var i = 0; i < requiredMethods.length; i++) {
        if (typeof AccessEnforcement_[requiredMethods[i]] !== 'function') {
          throw new Error('AccessEnforcement_.' + requiredMethods[i] + ' is not available');
        }
      }

      const viewer = {
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

    _pushPolicyCheck_(report, 'operator gets summaries but not working actions', function () {
      _requireObject_(AccessEnforcement_, 'AccessEnforcement_');

      const requiredMethods = [
        'canUseDaySummary',
        'canUseDetailedSummary',
        'canUseWorkingActions',
        'canUseSendPanel'
      ];
      for (var i = 0; i < requiredMethods.length; i++) {
        if (typeof AccessEnforcement_[requiredMethods[i]] !== 'function') {
          throw new Error('AccessEnforcement_.' + requiredMethods[i] + ' is not available');
        }
      }

      const operator = {
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

    _pushPolicyCheck_(report, 'guest stays locked out of cards and send panel', function () {
      _requireObject_(AccessEnforcement_, 'AccessEnforcement_');

      if (typeof AccessEnforcement_.canOpenPersonCard !== 'function') {
        throw new Error('AccessEnforcement_.canOpenPersonCard is not available');
      }
      if (typeof AccessEnforcement_.canUseSendPanel !== 'function') {
        throw new Error('AccessEnforcement_.canUseSendPanel is not available');
      }

      const guest = {
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

    _pushPolicyCheck_(report, 'viewer allowed actions stay minimal and non-admin', function () {
      const actions = _getAllowedActionsForRoleOrSkip_('viewer');
      const set = _asCanonicalActionSet_(actions);

      const viewerPositiveCandidates = [
        'власна картка',
        'own-card',
        'self-card',
        'person-card:self'
      ];

      const viewerForbiddenCandidates = [
        'коротке зведення',
        'day-summary',
        'summary:day',
        'адмін-дії',
        'admin-actions',
        'send-panel',
        'working-actions'
      ];

      if (!_actionSetHasAny_(set, viewerPositiveCandidates)) {
        throw new Error(
          'Viewer expected own-card style permission is missing. Actions: ' + actions.join(', ')
        );
      }

      if (_actionSetHasAny_(set, viewerForbiddenCandidates)) {
        throw new Error(
          'Viewer received forbidden elevated action. Actions: ' + actions.join(', ')
        );
      }

      return {
        actionsCount: actions.length,
        minimalProfile: true
      };
    });

    _pushPolicyCheck_(report, 'sysadmin has required maintenance actions', function () {
      const actions = _getAllowedActionsForRoleOrSkip_('sysadmin');
      const set = _asCanonicalActionSet_(actions);

      for (var i = 0; i < POLICY_CHECKS_CONFIG_.REQUIRED_MAINTENANCE_ACTIONS.length; i++) {
        const action = POLICY_CHECKS_CONFIG_.REQUIRED_MAINTENANCE_ACTIONS[i];
        if (!_actionSetHasAny_(set, [action])) {
          throw new Error('sysadmin missing action: ' + action);
        }
      }

      return {
        requiredActions: POLICY_CHECKS_CONFIG_.REQUIRED_MAINTENANCE_ACTIONS.slice(),
        actionsCount: actions.length
      };
    });

    _pushPolicyCheck_(report, 'core roles expose allowed actions map', function () {
      const out = {};

      for (var i = 0; i < POLICY_CHECKS_CONFIG_.ROLES_WITH_ACTIONS.length; i++) {
        const role = POLICY_CHECKS_CONFIG_.ROLES_WITH_ACTIONS[i];
        const actions = _getAllowedActionsForRoleOrSkip_(role);

        if (!actions.length) {
          throw new Error('Allowed actions missing or empty for role: ' + role);
        }

        out[role] = actions.length;
      }

      return out;
    });

    _pushPolicyCheck_(report, 'protected sheets contract matches configuration', function () {
      _requireObject_(AccessEnforcement_, 'AccessEnforcement_');
      if (!Array.isArray(AccessEnforcement_.PROTECTED_SHEETS)) {
        throw new Error('AccessEnforcement_.PROTECTED_SHEETS is not available');
      }

      const expected = POLICY_CHECKS_CONFIG_.EXPECTED_PROTECTED_SHEETS.slice();
      const actual = AccessEnforcement_.PROTECTED_SHEETS.slice();
      const missing = [];
      const extra = [];

      for (var i = 0; i < expected.length; i++) {
        if (actual.indexOf(expected[i]) === -1) {
          missing.push(expected[i]);
        }
      }

      for (var j = 0; j < actual.length; j++) {
        if (expected.indexOf(actual[j]) === -1) {
          extra.push(actual[j]);
        }
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

    _pushPolicyCheck_(report, 'maintenance actions contract covers elevated roles', function () {
      const elevatedRoles = ['maintainer', 'admin', 'sysadmin', 'owner'];
      const output = {};

      for (var i = 0; i < elevatedRoles.length; i++) {
        const role = elevatedRoles[i];
        const actions = _getAllowedActionsForRoleOrSkip_(role);
        const set = _asCanonicalActionSet_(actions);

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

// ==================== DIAGNOSTIC HELPERS ====================

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

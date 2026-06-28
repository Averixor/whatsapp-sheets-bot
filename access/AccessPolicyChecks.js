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
    "ACCESS",
    "ALERTS_LOG",
    "JOB_RUNTIME_LOG",
    "AUDIT_LOG",
    "OPS_LOG",
    "ACTIVE_OPERATIONS",
    "CHECKPOINTS",
    "DICT",
    "DICT_SUM",
    "TEMPLATES",
    "LOG",
    "VACATIONS",
    "VACATION_REQUESTS",
    "VACATION_SCHEDULE",
    "VACATION_CHECK",
    "VACATION_OPTIONS",
    "SEND_PANEL",
    "PHONES",
    "PERSONNEL",
  ],

  STRICT_PROTECTED_SHEETS_MODE: false,

  REQUIRED_MAINTENANCE_ACTIONS: ["repair", "protections", "triggers"],

  ROLES_WITH_ACTIONS: [
    "viewer",
    "operator",
    "maintainer",
    "admin",
    "sysadmin",
    "owner",
  ],

  SCRIPT_PROPERTY_ALLOW_TESTS: "WASB_ALLOW_POLICY_TESTS",
};

/**
 * Evaluate whether a role may call an access API endpoint per ProjectMetadata policy.
 * @param {string} endpointName
 * @param {string} role
 * @returns {boolean}
 */
function isAccessApiEndpointAllowedForRole_(endpointName, role) {
  var policyMap =
    typeof getAccessApiEndpointRolePolicy_ === "function"
      ? getAccessApiEndpointRolePolicy_()
      : null;
  if (!policyMap || typeof policyMap !== "object") return false;

  var policy = policyMap[String(endpointName || "").trim()];
  if (!policy || typeof policy !== "object") return false;

  var normalizedRole = String(role || "guest").toLowerCase();
  if (typeof normalizeRole_ === "function") {
    normalizedRole = normalizeRole_(normalizedRole);
  }

  var roleOrder =
    typeof ROLE_ORDER === "object" && ROLE_ORDER
      ? ROLE_ORDER
      : {
          guest: 0,
          viewer: 1,
          operator: 2,
          maintainer: 3,
          admin: 4,
          sysadmin: 5,
          owner: 6,
        };

  if (policy.guestAllowed === true && normalizedRole === "guest") {
    return true;
  }

  if (policy.minRole) {
    var minRole = String(policy.minRole || "").toLowerCase();
    if (typeof normalizeRole_ === "function") {
      minRole = normalizeRole_(minRole);
    }
    return (roleOrder[normalizedRole] || 0) >= (roleOrder[minRole] || 0);
  }

  return policy.guestAllowed === true;
}

if (typeof Object.freeze === "function") {
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
  var err = new Error(message || "Check skipped");
  err.name = "PolicyCheckSkipError";
  err.isPolicyCheckSkip = true;
  return err;
}

/**
 * Створює помилку блокування перевірки (BLOCKED).
 * @param {string} message
 * @returns {Error}
 */
function _createBlockedError_(message) {
  var err = new Error(message || "Check blocked by safety policy");
  err.name = "PolicyCheckBlockedError";
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
    if (typeof getProjectBundleMetadata_ === "function") {
      var meta = getProjectBundleMetadata_();
      if (meta && meta.stageVersion) return meta.stageVersion;
      if (meta && meta.stage) return String(meta.stage);
    }
  } catch (_) {}
  return "unknown";
}

/**
 * Повертає поточний timestamp для логів.
 * @returns {string}
 */
function _getCurrentTimestampForChecks_() {
  try {
    return Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone() || "UTC",
      "yyyy-MM-dd HH:mm:ss",
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
  if (value === null || value === undefined) return "";
  try {
    return String(value);
  } catch (_) {
    return "";
  }
}

function _safeCloneForLog_(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_) {
    return { note: "unserializable-details" };
  }
}

/**
 * Логує результат перевірки в AlertsRepository (якщо доступний).
 */
function _logPolicyCheckToRepository_(checkName, status, message, details) {
  try {
    if (
      typeof AlertsRepository_ === "object" &&
      AlertsRepository_ &&
      typeof AlertsRepository_.appendAlert === "function"
    ) {
      var severity = "info";
      if (status === "FAIL") severity = "error";
      else if (status === "BLOCKED") severity = "warning";

      AlertsRepository_.appendAlert({
        type: "policy_check",
        severity: severity,
        action: checkName,
        outcome: status,
        message: message,
        details: _safeCloneForLog_(details || {}),
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
    strictProtectedSheetsMode:
      typeof opts.strictProtectedSheetsMode === "boolean"
        ? opts.strictProtectedSheetsMode
        : POLICY_CHECKS_CONFIG_.STRICT_PROTECTED_SHEETS_MODE,
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
    if (
      props.getProperty(POLICY_CHECKS_CONFIG_.SCRIPT_PROPERTY_ALLOW_TESTS) ===
      "true"
    ) {
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
    reason:
      "Policy checks blocked outside safe environment. " +
      "Use { forceRun: true } or set script property " +
      POLICY_CHECKS_CONFIG_.SCRIPT_PROPERTY_ALLOW_TESTS +
      "=true.",
  };
}

// ==================== ВАЛІДАЦІЙНІ ХЕЛПЕРИ ====================

function _requireObjectWithMethod_(obj, methodName, objectName) {
  if (
    typeof obj !== "object" ||
    !obj ||
    typeof obj[methodName] !== "function"
  ) {
    throw new Error(objectName + "." + methodName + " is not available");
  }
}

function _requireObject_(obj, objectName) {
  if (typeof obj !== "object" || !obj) {
    throw new Error(objectName + " is not available");
  }
}

function _requireArray_(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(label + " should be an array");
  }
}

/**
 * Перетворює масив дій на об'єкт-множину (для швидкого пошуку).
 * @param {Array} actions
 * @returns {Object}
 */
function _asCanonicalActionSet_(actions) {
  _requireArray_(actions, "Allowed actions");

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
  if (
    typeof AccessControl_ !== "object" ||
    !AccessControl_ ||
    typeof AccessControl_.listAllowedActionsForRole !== "function"
  ) {
    throw _createSkipError_(
      "AccessControl_.listAllowedActionsForRole is not available",
    );
  }

  var actions = AccessControl_.listAllowedActionsForRole(role);
  if (!Array.isArray(actions)) {
    throw new Error("Allowed actions should be an array for role: " + role);
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
    total: 0,
  };

  var checks = Array.isArray(report && report.checks) ? report.checks : [];
  for (var i = 0; i < checks.length; i++) {
    var status = checks[i] && checks[i].status;
    if (status === "OK") summary.ok++;
    else if (status === "FAIL") summary.fail++;
    else if (status === "SKIP") summary.skip++;
    else if (status === "BLOCKED") summary.blocked++;
  }

  summary.total = checks.length;
  return summary;
}

function _pushPolicyCheck_(report, checkName, fn) {
  var item = {
    name: checkName,
    status: "OK",
    details: null,
    timestamp: _getCurrentTimestampForChecks_(),
  };

  try {
    var result = fn();
    item.details = result === undefined || result === null ? "OK" : result;
  } catch (error) {
    if (_isBlockedError_(error)) {
      item.status = "BLOCKED";
      item.details = error.message || "Blocked";
      _logPolicyCheckToRepository_(checkName, "BLOCKED", item.details, {});
    } else if (_isSkipError_(error)) {
      item.status = "SKIP";
      item.details = error.message || "Skipped";
    } else {
      report.ok = false;
      item.status = "FAIL";
      item.details = error && error.message ? error.message : String(error);
      item.stack =
        error && error.stack
          ? String(error.stack).split("\n").slice(0, 3).join("\n")
          : "";
      _logPolicyCheckToRepository_(checkName, "FAIL", item.details, {
        stack: item.stack,
      });
    }
  }

  report.checks.push(item);
}

// ==================== ПЕРЕХОПЛЕННЯ ПОБІЧНИХ ЕФЕКТІВ ====================

function _patchSideEffectsForPolicyChecks_() {
  var originals = {
    accessReportViolation: null,
    mailSendEmail: null,
    scriptCacheFactory: null,
    scriptCacheStore: null,
  };

  try {
    if (
      typeof AccessEnforcement_ !== "undefined" &&
      AccessEnforcement_ &&
      typeof AccessEnforcement_.reportViolation === "function"
    ) {
      originals.accessReportViolation = AccessEnforcement_.reportViolation;
      AccessEnforcement_.reportViolation = function () {
        return {
          success: true,
          emailSent: false,
          alertLogged: false,
          dryRun: true,
        };
      };
    }
  } catch (_) {}

  try {
    if (
      typeof MailApp !== "undefined" &&
      MailApp &&
      typeof MailApp.sendEmail === "function"
    ) {
      originals.mailSendEmail = MailApp.sendEmail;
      MailApp.sendEmail = function () {
        return undefined;
      };
    }
  } catch (_) {}

  try {
    if (
      typeof CacheService !== "undefined" &&
      CacheService &&
      typeof CacheService.getScriptCache === "function"
    ) {
      originals.scriptCacheFactory = CacheService.getScriptCache;
      originals.scriptCacheStore = {};
      CacheService.getScriptCache = function () {
        var store = originals.scriptCacheStore;
        return {
          get: function (key) {
            return Object.prototype.hasOwnProperty.call(store, key)
              ? store[key]
              : null;
          },
          put: function (key, value) {
            store[key] = value;
          },
          remove: function (key) {
            delete store[key];
          },
        };
      };
    }
  } catch (_) {}

  return originals;
}

function _restoreSideEffectsForPolicyChecks_(originals) {
  var saved = originals || {};

  try {
    if (
      saved.accessReportViolation &&
      typeof AccessEnforcement_ !== "undefined" &&
      AccessEnforcement_
    ) {
      AccessEnforcement_.reportViolation = saved.accessReportViolation;
    }
  } catch (_) {}

  try {
    if (saved.mailSendEmail && typeof MailApp !== "undefined" && MailApp) {
      MailApp.sendEmail = saved.mailSendEmail;
    }
  } catch (_) {}

  try {
    if (
      saved.scriptCacheFactory &&
      typeof CacheService !== "undefined" &&
      CacheService
    ) {
      CacheService.getScriptCache = saved.scriptCacheFactory;
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
    status: "BLOCKED",
    error: "SAFETY_BLOCKED",
    message: message,
    checks: [],
    summary: {
      ok: 0,
      fail: 0,
      skip: 0,
      blocked: 1,
      total: 0,
    },
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
    _logPolicyCheckToRepository_(
      "runAccessPolicyChecks",
      "BLOCKED",
      safety.reason,
      blockedReport,
    );
    return blockedReport;
  }

  var report = {
    ok: true,
    blocked: false,
    status: "OK",
    stage: _getStageVersionForChecks_(),
    ts: _getCurrentTimestampForChecks_(),
    dryRun: true,
    options: {
      strictProtectedSheetsMode: opts.strictProtectedSheetsMode,
    },
    checks: [],
  };

  var originals = _patchSideEffectsForPolicyChecks_();

  try {
    _pushPolicyCheck_(report, "AccessControl.describe available", function () {
      _requireObjectWithMethod_(AccessControl_, "describe", "AccessControl_");
      return "describe-ok";
    });

    _pushPolicyCheck_(
      report,
      "descriptor exposes rotation policy contract",
      function () {
        _requireObjectWithMethod_(AccessControl_, "describe", "AccessControl_");

        var descriptor = AccessControl_.describe();
        _requireObject_(descriptor, "AccessControl_.describe() result");

        if (!("rotationPolicy" in descriptor)) {
          throw new Error("rotationPolicy missing");
        }

        if (!("migrationModeEnabled" in descriptor)) {
          throw new Error("migrationModeEnabled missing");
        }

        if (!("allowedActions" in descriptor)) {
          throw new Error("allowedActions missing");
        }

        if (typeof descriptor.migrationModeEnabled !== "boolean") {
          throw new Error("migrationModeEnabled should be boolean");
        }

        if (!Array.isArray(descriptor.allowedActions)) {
          throw new Error("allowedActions should be array");
        }

        return {
          rotationPolicyPresent: true,
          migrationModeEnabled: descriptor.migrationModeEnabled,
          allowedActionsCount: descriptor.allowedActions.length,
        };
      },
    );

    _pushPolicyCheck_(report, "viewer may open only own card", function () {
      _requireObject_(AccessEnforcement_, "AccessEnforcement_");
      if (typeof AccessEnforcement_.canOpenPersonCard !== "function") {
        throw new Error(
          "AccessEnforcement_.canOpenPersonCard is not available",
        );
      }

      var viewer = {
        role: "viewer",
        enabled: true,
        registered: true,
        personCallsign: "ALFA",
      };

      if (!AccessEnforcement_.canOpenPersonCard(viewer, "ALFA")) {
        throw new Error("Viewer own card should be allowed");
      }

      if (AccessEnforcement_.canOpenPersonCard(viewer, "BRAVO")) {
        throw new Error("Viewer foreign card should be denied");
      }

      return "viewer-self-card-ok";
    });

    _pushPolicyCheck_(
      report,
      "viewer cannot use summaries or send panel",
      function () {
        _requireObject_(AccessEnforcement_, "AccessEnforcement_");

        var methods = [
          "canUseDaySummary",
          "canUseDetailedSummary",
          "canUseSendPanel",
        ];
        for (var i = 0; i < methods.length; i++) {
          if (typeof AccessEnforcement_[methods[i]] !== "function") {
            throw new Error(
              "AccessEnforcement_." + methods[i] + " is not available",
            );
          }
        }

        var viewer = {
          role: "viewer",
          enabled: true,
          registered: true,
          personCallsign: "ALFA",
        };

        if (AccessEnforcement_.canUseDaySummary(viewer)) {
          throw new Error("Viewer day summary should be denied");
        }

        if (AccessEnforcement_.canUseDetailedSummary(viewer)) {
          throw new Error("Viewer detailed summary should be denied");
        }

        if (AccessEnforcement_.canUseSendPanel(viewer)) {
          throw new Error("Viewer send panel should be denied");
        }

        return "viewer-restrictions-ok";
      },
    );

    _pushPolicyCheck_(
      report,
      "operator gets summaries but not working actions",
      function () {
        _requireObject_(AccessEnforcement_, "AccessEnforcement_");

        var methods = [
          "canUseDaySummary",
          "canUseDetailedSummary",
          "canUseWorkingActions",
          "canUseSendPanel",
        ];
        for (var i = 0; i < methods.length; i++) {
          if (typeof AccessEnforcement_[methods[i]] !== "function") {
            throw new Error(
              "AccessEnforcement_." + methods[i] + " is not available",
            );
          }
        }

        var operator = {
          role: "operator",
          enabled: true,
          registered: true,
        };

        if (!AccessEnforcement_.canUseDaySummary(operator)) {
          throw new Error("Operator day summary should be allowed");
        }

        if (!AccessEnforcement_.canUseDetailedSummary(operator)) {
          throw new Error("Operator detailed summary should be allowed");
        }

        if (AccessEnforcement_.canUseWorkingActions(operator)) {
          throw new Error("Operator working actions should be denied");
        }

        if (AccessEnforcement_.canUseSendPanel(operator)) {
          throw new Error("Operator send panel should be denied");
        }

        return "operator-summaries-only-ok";
      },
    );

    _pushPolicyCheck_(
      report,
      "leave birthday check requires admin or system trigger",
      function () {
        _requireObject_(AccessEnforcement_, "AccessEnforcement_");

        if (typeof AccessEnforcement_.canRunLeaveBirthdayCheck !== "function") {
          throw new Error(
            "AccessEnforcement_.canRunLeaveBirthdayCheck is not available",
          );
        }

        var operator = {
          role: "operator",
          enabled: true,
          registered: true,
        };
        var maintainer = {
          role: "maintainer",
          enabled: true,
          registered: true,
        };
        var admin = {
          role: "admin",
          enabled: true,
          registered: true,
        };
        var systemTrigger = {
          role: "system",
          actorRole: "system",
          allowSystem: true,
          isSystemTrigger: true,
          enabled: true,
          source: "trigger",
          identityStatus: "system_trigger",
        };
        var partialSystem = Object.assign({}, systemTrigger, {
          isSystemTrigger: false,
        });

        if (AccessEnforcement_.canRunLeaveBirthdayCheck(operator)) {
          throw new Error("Operator leave/birthday check should be denied");
        }

        if (AccessEnforcement_.canRunLeaveBirthdayCheck(maintainer)) {
          throw new Error("Maintainer leave/birthday check should be denied");
        }

        if (!AccessEnforcement_.canRunLeaveBirthdayCheck(admin)) {
          throw new Error("Admin leave/birthday check should be allowed");
        }

        if (!AccessEnforcement_.canRunLeaveBirthdayCheck(systemTrigger)) {
          throw new Error(
            "System trigger leave/birthday check should be allowed",
          );
        }

        if (AccessEnforcement_.canRunLeaveBirthdayCheck(partialSystem)) {
          throw new Error("Partial system context should be denied");
        }

        if (
          typeof AccessEnforcement_.buildSystemTriggerAccessDescriptor !==
          "function"
        ) {
          throw new Error(
            "AccessEnforcement_.buildSystemTriggerAccessDescriptor is not available",
          );
        }

        var built = AccessEnforcement_.buildSystemTriggerAccessDescriptor({
          isSystemTrigger: true,
          allowSystem: true,
          actorRole: "system",
          accessSource: "system_trigger",
        });
        if (!built || !AccessEnforcement_.canRunLeaveBirthdayCheck(built)) {
          throw new Error(
            "Built system trigger descriptor should allow leave/birthday check",
          );
        }

        if (
          AccessEnforcement_.buildSystemTriggerAccessDescriptor({
            isSystemTrigger: true,
            allowSystem: false,
            actorRole: "system",
          })
        ) {
          throw new Error("Partial system payload should not build descriptor");
        }

        return "leave-birthday-guard-ok";
      },
    );

    _pushPolicyCheck_(
      report,
      "guest stays locked out of cards and send panel",
      function () {
        _requireObject_(AccessEnforcement_, "AccessEnforcement_");

        if (typeof AccessEnforcement_.canOpenPersonCard !== "function") {
          throw new Error(
            "AccessEnforcement_.canOpenPersonCard is not available",
          );
        }
        if (typeof AccessEnforcement_.canUseSendPanel !== "function") {
          throw new Error(
            "AccessEnforcement_.canUseSendPanel is not available",
          );
        }

        var guest = {
          role: "guest",
          enabled: true,
          registered: false,
        };

        if (AccessEnforcement_.canOpenPersonCard(guest, "ALFA")) {
          throw new Error("Guest person card should be denied");
        }
        if (AccessEnforcement_.canUseSendPanel(guest)) {
          throw new Error("Guest send panel should be denied");
        }

        return "guest-restrictions-ok";
      },
    );

    _pushPolicyCheck_(
      report,
      "guest cannot view sidebar personnel list",
      function () {
        _requireObject_(AccessEnforcement_, "AccessEnforcement_");
        if (typeof AccessEnforcement_.canViewSidebarPersonnel !== "function") {
          throw new Error(
            "AccessEnforcement_.canViewSidebarPersonnel is not available",
          );
        }

        var guest = {
          role: "guest",
          enabled: true,
          registered: false,
        };

        if (AccessEnforcement_.canViewSidebarPersonnel(guest)) {
          throw new Error("Guest sidebar personnel should be denied");
        }

        return "guest-sidebar-personnel-denied";
      },
    );

    _pushPolicyCheck_(
      report,
      "viewer sidebar personnel redacts phone link message",
      function () {
        _requireObject_(AccessEnforcement_, "AccessEnforcement_");
        if (typeof AccessEnforcement_.canViewSidebarPersonnel !== "function") {
          throw new Error(
            "AccessEnforcement_.canViewSidebarPersonnel is not available",
          );
        }
        if (
          typeof AccessEnforcement_.applySidebarPersonnelAccessPolicy !==
          "function"
        ) {
          throw new Error(
            "AccessEnforcement_.applySidebarPersonnelAccessPolicy is not available",
          );
        }

        var viewer = {
          role: "viewer",
          enabled: true,
          registered: true,
          personCallsign: "ALFA",
        };

        if (!AccessEnforcement_.canViewSidebarPersonnel(viewer)) {
          throw new Error("Viewer sidebar personnel should be allowed");
        }

        var sample = {
          month: "04",
          date: "01.04.2026",
          personnel: [
            {
              fml: "Test",
              phone: "+380501234567",
              link: "https://web.whatsapp.com/send?phone=380501234567",
              message: "secret",
              code: "БР",
              service: "svc",
              place: "place",
              tasks: "tasks",
              status: "ready",
            },
          ],
        };

        var redacted = AccessEnforcement_.applySidebarPersonnelAccessPolicy(
          sample,
          viewer,
        );
        var row = redacted.personnel && redacted.personnel[0];
        if (!row) {
          throw new Error("Redacted personnel row missing");
        }
        if (row.phone || row.link || row.message) {
          throw new Error(
            "Viewer sidebar personnel should redact phone/link/message",
          );
        }
        if (row.code !== "БР" || row.fml !== "Test") {
          throw new Error(
            "Viewer sidebar personnel should keep non-sensitive fields",
          );
        }

        var operator = { role: "operator", enabled: true, registered: true };
        var full = AccessEnforcement_.applySidebarPersonnelAccessPolicy(
          sample,
          operator,
        );
        var fullRow = full.personnel && full.personnel[0];
        if (!fullRow || !fullRow.phone || !fullRow.link || !fullRow.message) {
          throw new Error(
            "Operator sidebar personnel should keep sensitive fields",
          );
        }

        return "viewer-sidebar-redaction-ok";
      },
    );

    _pushPolicyCheck_(
      report,
      "viewer allowed actions stay minimal and non-admin",
      function () {
        var actions = _getAllowedActionsForRoleOrSkip_("viewer");
        var set = _asCanonicalActionSet_(actions);

        var positive = [
          "власна картка",
          "own-card",
          "self-card",
          "person-card:self",
        ];
        var forbidden = [
          "коротке зведення",
          "day-summary",
          "summary:day",
          "адмін-дії",
          "admin-actions",
          "send-panel",
          "working-actions",
        ];

        if (!_actionSetHasAny_(set, positive)) {
          throw new Error(
            "Viewer expected own-card style permission is missing. Actions: " +
              actions.join(", "),
          );
        }
        if (_actionSetHasAny_(set, forbidden)) {
          throw new Error(
            "Viewer received forbidden elevated action. Actions: " +
              actions.join(", "),
          );
        }

        return {
          actionsCount: actions.length,
          minimalProfile: true,
        };
      },
    );

    _pushPolicyCheck_(
      report,
      "sysadmin has required maintenance actions",
      function () {
        var actions = _getAllowedActionsForRoleOrSkip_("sysadmin");
        var set = _asCanonicalActionSet_(actions);
        var required = POLICY_CHECKS_CONFIG_.REQUIRED_MAINTENANCE_ACTIONS;

        for (var i = 0; i < required.length; i++) {
          if (!_actionSetHasAny_(set, [required[i]])) {
            throw new Error("sysadmin missing action: " + required[i]);
          }
        }

        return {
          requiredActions: required.slice(),
          actionsCount: actions.length,
        };
      },
    );

    _pushPolicyCheck_(
      report,
      "core roles expose allowed actions map",
      function () {
        var out = {};
        var roles = POLICY_CHECKS_CONFIG_.ROLES_WITH_ACTIONS;

        for (var i = 0; i < roles.length; i++) {
          var role = roles[i];
          var actions = _getAllowedActionsForRoleOrSkip_(role);
          if (!actions.length) {
            throw new Error(
              "Allowed actions missing or empty for role: " + role,
            );
          }
          out[role] = actions.length;
        }

        return out;
      },
    );

    _pushPolicyCheck_(
      report,
      "protected sheets contract matches configuration",
      function () {
        _requireObject_(AccessEnforcement_, "AccessEnforcement_");
        if (!Array.isArray(AccessEnforcement_.PROTECTED_SHEETS)) {
          throw new Error(
            "AccessEnforcement_.PROTECTED_SHEETS is not available",
          );
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
          throw new Error("Missing protected sheets: " + missing.join(", "));
        }
        if (opts.strictProtectedSheetsMode && extra.length) {
          throw new Error(
            "Unexpected protected sheets in strict mode: " + extra.join(", "),
          );
        }

        return {
          mode: opts.strictProtectedSheetsMode ? "strict" : "lenient",
          expectedCount: expected.length,
          actualCount: actual.length,
          missingCount: missing.length,
          extraCount: extra.length,
          extraSheets: extra,
        };
      },
    );

    _pushPolicyCheck_(
      report,
      "maintenance actions contract covers elevated roles",
      function () {
        var elevated = ["maintainer", "admin", "sysadmin", "owner"];
        var output = {};

        for (var i = 0; i < elevated.length; i++) {
          var role = elevated[i];
          var actions = _getAllowedActionsForRoleOrSkip_(role);
          var set = _asCanonicalActionSet_(actions);

          output[role] = {
            count: actions.length,
            hasRepair: _actionSetHasAny_(set, ["repair"]),
            hasProtections: _actionSetHasAny_(set, ["protections"]),
            hasTriggers: _actionSetHasAny_(set, ["triggers"]),
          };
        }

        return output;
      },
    );

    _pushPolicyCheck_(
      report,
      "ACCESS temp password plain lookup disabled by default",
      function () {
        if (typeof isAccessTempPasswordPlainLookupEnabled_ !== "function") {
          throw new Error("isAccessTempPasswordPlainLookupEnabled_ missing");
        }
        if (isAccessTempPasswordPlainLookupEnabled_()) {
          throw new Error(
            "Plain lookup is enabled via script property; disable for production checks",
          );
        }
        return { plainLookupEnabled: false };
      },
    );

    _pushPolicyCheck_(
      report,
      "ACCESS temp password plain is not persisted without migration flag",
      function () {
        if (typeof sanitizeAccessSecretFieldUpdates_ !== "function") {
          throw new Error("sanitizeAccessSecretFieldUpdates_ missing");
        }
        if (
          typeof resolveAccessTemporaryPasswordPlainForPersist_ !== "function"
        ) {
          throw new Error(
            "resolveAccessTemporaryPasswordPlainForPersist_ missing",
          );
        }

        var sanitized = sanitizeAccessSecretFieldUpdates_({
          temporary_password_plain: "WASB-TEST-PLAIN",
          temporary_password_hash: "hash",
        });
        if (
          Object.prototype.hasOwnProperty.call(
            sanitized,
            "temporary_password_plain",
          )
        ) {
          throw new Error("sanitizeAccessSecretFieldUpdates_ kept plain text");
        }

        var persisted =
          resolveAccessTemporaryPasswordPlainForPersist_("WASB-TEST-PLAIN");
        if (persisted) {
          throw new Error(
            "resolveAccessTemporaryPasswordPlainForPersist_ returned plain text",
          );
        }

        return {
          sanitizedKeys: Object.keys(sanitized).sort(),
          persistedLength: String(persisted || "").length,
        };
      },
    );

    _pushPolicyCheck_(
      report,
      "client access signal is allowlisted sanitized and rate limited",
      function () {
        _requireObject_(AccessEnforcement_, "AccessEnforcement_");

        if (typeof AccessEnforcement_.reportClientAccessSignal !== "function") {
          throw new Error(
            "AccessEnforcement_.reportClientAccessSignal is not available",
          );
        }
        if (
          typeof AccessEnforcement_.sanitizeClientSignalDetails !== "function"
        ) {
          throw new Error(
            "AccessEnforcement_.sanitizeClientSignalDetails is not available",
          );
        }

        var mailCalls = 0;
        var savedMail = null;
        var restoreMail = function () {
          if (savedMail) {
            try {
              MailApp.sendEmail = savedMail;
            } catch (_) {}
          }
        };
        try {
          if (typeof MailApp !== "undefined" && MailApp && MailApp.sendEmail) {
            savedMail = MailApp.sendEmail;
            MailApp.sendEmail = function () {
              mailCalls++;
            };
          }
        } catch (_) {}

        try {
          var sanitized = AccessEnforcement_.sanitizeClientSignalDetails({
            email: "x@test.com",
            payload: { nested: true },
            foo: "x".repeat(1000),
            source: "sidebar",
            callsign: "TEST",
          });

          if (Object.prototype.hasOwnProperty.call(sanitized, "email")) {
            throw new Error("sanitizeClientSignalDetails kept email");
          }
          if (Object.prototype.hasOwnProperty.call(sanitized, "payload")) {
            throw new Error("sanitizeClientSignalDetails kept payload");
          }
          if (Object.prototype.hasOwnProperty.call(sanitized, "foo")) {
            throw new Error("sanitizeClientSignalDetails kept unknown key foo");
          }
          if (String(sanitized.callsign || "").length > 120) {
            throw new Error(
              "sanitizeClientSignalDetails did not truncate callsign",
            );
          }

          var blocked = AccessEnforcement_.reportClientAccessSignal(
            "notAllowlistedAction",
            { source: "policy-check" },
          );
          if (!blocked || blocked.blocked !== true) {
            throw new Error("non-allowlisted client signal was not blocked");
          }

          var ok = AccessEnforcement_.reportClientAccessSignal(
            "sidebarActionUiDenied",
            {
              email: "x@test.com",
              payload: { nested: true },
              foo: "x".repeat(1000),
              source: "policy-check",
              requestedAction: "test",
            },
          );
          if (!ok || ok.success !== true) {
            throw new Error("allowlisted client signal failed");
          }
          if (ok.suppressed) {
            return {
              suppressed: true,
              reason: ok.message || "debounced",
              sanitizedKeys: Object.keys(sanitized).sort(),
              mailCalls: mailCalls,
            };
          }
          if (ok.emailSent === true) {
            throw new Error("client signal must not send email");
          }
          if (mailCalls > 0) {
            throw new Error("client signal triggered MailApp.sendEmail");
          }
          if (
            !ok.data ||
            !ok.data.sanitized ||
            Object.prototype.hasOwnProperty.call(ok.data.sanitized, "email")
          ) {
            throw new Error("client signal result kept unsanitized email");
          }

          return {
            sanitizedKeys: Object.keys(sanitized).sort(),
            alertLogged: ok.alertLogged === true,
            mailCalls: mailCalls,
          };
        } finally {
          restoreMail();
        }
      },
    );

    _pushPolicyCheck_(
      report,
      "access api role policy map is available",
      function () {
        if (typeof getAccessApiEndpointRolePolicy_ !== "function") {
          throw new Error("getAccessApiEndpointRolePolicy_ is not available");
        }
        var policyMap = getAccessApiEndpointRolePolicy_();
        var required = [
          "apiStage7SubmitAccessKeyRequest",
          "apiStage7RegisterAccessWithTemporaryPassword",
          "apiStage7LoginByIdentifierAndCallsign",
          "apiStage7LoginByAccessKey",
          "apiStage7ListBindableCallsigns",
          "apiStage7ReportAccessViolation",
          "apiStage7ReportClientAccessSignal",
          "apiGetActiveProjects",
          "apiSubmitRequest",
          "apiStage7RepairSystemSheets",
          "apiStage7NormalizeAllSheetHeadersToEnglish",
        ];
        for (var i = 0; i < required.length; i++) {
          if (!policyMap[required[i]]) {
            throw new Error("missing role policy for " + required[i]);
          }
        }
        return { policyCount: Object.keys(policyMap).length };
      },
    );

    _pushPolicyCheck_(
      report,
      "guest allowed access api endpoints",
      function () {
        var allowed = [
          "apiStage7SubmitAccessKeyRequest",
          "apiStage7RegisterAccessWithTemporaryPassword",
          "apiStage7LoginByIdentifierAndCallsign",
          "apiStage7LoginByAccessKey",
          "apiStage7ListBindableCallsigns",
          "apiStage7ReportClientAccessSignal",
          "apiStage7GetAccessDescriptorLite",
          "apiStage7BootstrapSidebar",
          "apiGetActiveProjects",
        ];
        for (var i = 0; i < allowed.length; i++) {
          if (!isAccessApiEndpointAllowedForRole_(allowed[i], "guest")) {
            throw new Error("guest should be allowed: " + allowed[i]);
          }
        }
        return { guestAllowedCount: allowed.length };
      },
    );

    _pushPolicyCheck_(report, "guest denied access api endpoints", function () {
      var denied = [
        "apiStage7ReportAccessViolation",
        "apiStage7BootstrapAccessSheet",
        "apiStage7NormalizeAccessSheetFormatting",
        "apiStage7ApplyProtections",
        "apiSubmitRequest",
        "apiStage7RepairSystemSheets",
        "apiStage7NormalizeAllSheetHeadersToEnglish",
      ];
      for (var i = 0; i < denied.length; i++) {
        if (isAccessApiEndpointAllowedForRole_(denied[i], "guest")) {
          throw new Error("guest should be denied: " + denied[i]);
        }
      }
      return { guestDeniedCount: denied.length };
    });

    _pushPolicyCheck_(
      report,
      "viewer operator admin inherit guest-allowed access api endpoints",
      function () {
        var allowed = [
          "apiStage7SubmitAccessKeyRequest",
          "apiStage7LoginByIdentifierAndCallsign",
          "apiStage7LoginByAccessKey",
          "apiStage7ListBindableCallsigns",
          "apiStage7ReportClientAccessSignal",
          "apiSubmitRequest",
        ];
        var roles = ["viewer", "operator", "admin"];
        for (var r = 0; r < roles.length; r++) {
          for (var i = 0; i < allowed.length; i++) {
            if (!isAccessApiEndpointAllowedForRole_(allowed[i], roles[r])) {
              throw new Error(roles[r] + " should be allowed: " + allowed[i]);
            }
          }
        }
        return { roles: roles, endpointCount: allowed.length };
      },
    );

    _pushPolicyCheck_(
      report,
      "sysadmin allowed on report access violation endpoint",
      function () {
        if (
          !isAccessApiEndpointAllowedForRole_(
            "apiStage7ReportAccessViolation",
            "sysadmin",
          )
        ) {
          throw new Error("sysadmin should be allowed reportAccessViolation");
        }
        if (
          isAccessApiEndpointAllowedForRole_(
            "apiStage7ReportAccessViolation",
            "admin",
          )
        ) {
          throw new Error("admin should be denied reportAccessViolation");
        }
        return { sysadminAllowed: true, adminDenied: true };
      },
    );

    _pushPolicyCheck_(
      report,
      "bindCurrentKeyToCallsign removed from public APIs",
      function () {
        if (
          typeof AccessControl_ !== "object" ||
          !AccessControl_ ||
          Object.prototype.hasOwnProperty.call(
            AccessControl_,
            "bindCurrentKeyToCallsign",
          )
        ) {
          throw new Error(
            "AccessControl_.bindCurrentKeyToCallsign should not be exported",
          );
        }
        if (typeof apiStage7BindCurrentKeyToCallsign === "function") {
          throw new Error(
            "apiStage7BindCurrentKeyToCallsign should be removed",
          );
        }
        if (typeof bindCurrentKeyToCallsign === "function") {
          throw new Error("bindCurrentKeyToCallsign helper should be removed");
        }
        return { exported: false, endpointPresent: false };
      },
    );
  } finally {
    _restoreSideEffectsForPolicyChecks_(originals);
  }

  report.summary = _summarizeReportCounts_(report);
  if (report.summary.fail > 0) {
    report.status = "FAIL";
    report.ok = false;
  } else if (report.summary.blocked > 0) {
    report.status = "BLOCKED";
  } else if (report.summary.skip > 0) {
    report.status = "OK_WITH_SKIPS";
  } else {
    report.status = "OK";
  }

  _safeLogPolicyChecks_(
    "[runAccessPolicyChecks] " +
      "Статус: " +
      report.status +
      "; перевірок: " +
      report.summary.total +
      "; OK: " +
      report.summary.ok +
      "; FAIL: " +
      report.summary.fail +
      "; SKIP: " +
      report.summary.skip +
      "; BLOCKED: " +
      report.summary.blocked +
      "; час: " +
      report.ts,
  );

  return report;
}

// ==================== ДІАГНОСТИЧНІ ХЕЛПЕРИ ====================

function runAllPolicyChecks(options) {
  return runAccessPolicyChecks(options || {});
}

function getPolicyChecksConfig() {
  return {
    expectedProtectedSheets:
      POLICY_CHECKS_CONFIG_.EXPECTED_PROTECTED_SHEETS.slice(),
    strictProtectedSheetsMode:
      POLICY_CHECKS_CONFIG_.STRICT_PROTECTED_SHEETS_MODE,
    requiredMaintenanceActions:
      POLICY_CHECKS_CONFIG_.REQUIRED_MAINTENANCE_ACTIONS.slice(),
    rolesWithActions: POLICY_CHECKS_CONFIG_.ROLES_WITH_ACTIONS.slice(),
    scriptPropertyAllowTests: POLICY_CHECKS_CONFIG_.SCRIPT_PROPERTY_ALLOW_TESTS,
  };
}

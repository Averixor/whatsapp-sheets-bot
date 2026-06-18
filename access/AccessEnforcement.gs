/**
 * AccessEnforcement.gs
 * Обмеження доступу для viewer, перевірка прав на картки,
 * зведення, send-panel та сповіщення про порушення.
 */

// ==================== КОНСТАНТИ ====================

var AccessEnforcement_ =
  AccessEnforcement_ ||
  (function () {
    var ROLE_ORDER = {
      unknown: -1,
      guest: 0,
      viewer: 1,
      operator: 2,
      maintainer: 3,
      admin: 4,
      sysadmin: 5,
      owner: 6,
    };

    var ROLE_LABELS = {
      unknown: "Не визначено",
      guest: "Гість",
      viewer: "Спостерігач",
      operator: "Оператор",
      maintainer: "Редактор",
      admin: "Адмін",
      sysadmin: "Сисадмін",
      owner: "Власник",
      system: "Система",
    };

    var HIGH_PRIVILEGE_ROLES = ["sysadmin", "owner"];

    var CLIENT_ACCESS_SIGNAL_ACTIONS = {
      sidebarActionUiDenied: true,
      openPersonCardUiDenied: true,
      personnelListUiDenied: true,
    };

    var CLIENT_SIGNAL_ALLOWED_DETAIL_KEYS = [
      "source",
      "requestedAction",
      "requiredRole",
      "currentRole",
      "callsign",
      "violation",
      "surface",
    ];

    var CLIENT_SIGNAL_MAX_FIELD_LEN = 120;
    var CLIENT_SIGNAL_MAX_JSON_LEN = 500;
    var CLIENT_SIGNAL_DEBOUNCE_SEC = 60;
    var CLIENT_SIGNAL_HOURLY_MAX = 12;
    var CLIENT_SIGNAL_RATE_PREFIX = "STAGE7:CLIENT_SIGNAL:";

    // ==================== ДОПОМІЖНІ ФУНКЦІЇ ====================

    function _global_() {
      try {
        if (typeof globalThis !== "undefined") return globalThis;
      } catch (_) {}
      try {
        return this;
      } catch (_) {}
      return {};
    }

    function _isFunction_(value) {
      return typeof value === "function";
    }

    function _isObject_(value) {
      return !!value && typeof value === "object";
    }

    function _safeString_(value, fallback) {
      if (value === null || typeof value === "undefined") return fallback || "";
      return String(value);
    }

    function _trimmedString_(value, fallback) {
      return _safeString_(value, fallback).trim();
    }

    function _lowerEmail_(value) {
      return _trimmedString_(value, "").toLowerCase();
    }

    function _arrayUniqueStrings_(items) {
      var input = Array.isArray(items) ? items : [];
      var seen = {};
      var result = [];

      for (var i = 0; i < input.length; i++) {
        var value = _trimmedString_(input[i], "");
        if (!value) continue;
        if (seen[value]) continue;
        seen[value] = true;
        result.push(value);
      }
      return result;
    }

    function _roleLevel_(role) {
      var key = _trimmedString_(role, "guest").toLowerCase();
      if (Object.prototype.hasOwnProperty.call(ROLE_ORDER, key)) {
        return ROLE_ORDER[key];
      }
      return ROLE_ORDER.guest;
    }

    function _configValue_(key, fallback) {
      try {
        if (_isFunction_(appGetCore)) {
          var viaCore = appGetCore(key, fallback);
          if (
            typeof viaCore !== "undefined" &&
            viaCore !== null &&
            viaCore !== ""
          ) {
            return viaCore;
          }
        }
      } catch (_) {}

      try {
        if (
          typeof CONFIG !== "undefined" &&
          _isObject_(CONFIG) &&
          typeof CONFIG[key] !== "undefined" &&
          CONFIG[key] !== null &&
          CONFIG[key] !== ""
        ) {
          return CONFIG[key];
        }
      } catch (_) {}

      return fallback;
    }

    function _stage7ConfigValue_(key, fallback) {
      try {
        if (
          typeof STAGE7_CONFIG !== "undefined" &&
          _isObject_(STAGE7_CONFIG) &&
          typeof STAGE7_CONFIG[key] !== "undefined" &&
          STAGE7_CONFIG[key] !== null &&
          STAGE7_CONFIG[key] !== ""
        ) {
          return STAGE7_CONFIG[key];
        }
      } catch (_) {}
      return fallback;
    }

    function _vacationConfigValue_(key, fallback) {
      try {
        if (
          typeof VACATION_ENGINE_CONFIG !== "undefined" &&
          _isObject_(VACATION_ENGINE_CONFIG) &&
          typeof VACATION_ENGINE_CONFIG[key] !== "undefined" &&
          VACATION_ENGINE_CONFIG[key] !== null &&
          VACATION_ENGINE_CONFIG[key] !== ""
        ) {
          return VACATION_ENGINE_CONFIG[key];
        }
      } catch (_) {}
      return fallback;
    }

    function _scriptTimeZone_() {
      try {
        var tz = Session.getScriptTimeZone();
        if (tz) return tz;
      } catch (_) {}
      return "Etc/GMT";
    }

    function _todayStrLocal_() {
      return Utilities.formatDate(new Date(), _scriptTimeZone_(), "yyyy-MM-dd");
    }

    function _safeUniqueId_(prefix) {
      var p = _trimmedString_(prefix, "id");
      try {
        if (_isFunction_(stage7UniqueId_)) {
          return stage7UniqueId_(p);
        }
      } catch (_) {}
      return (
        p +
        "-" +
        String(new Date().getTime()) +
        "-" +
        String(Math.floor(Math.random() * 1000000))
      );
    }

    function _safeStringify_(value, limit) {
      var maxLen = Number(limit) || 9000;

      try {
        if (_isFunction_(stage7SafeStringify_)) {
          var viaStage7 = stage7SafeStringify_(value, maxLen);
          if (typeof viaStage7 === "string") {
            return viaStage7.length > maxLen
              ? viaStage7.slice(0, maxLen)
              : viaStage7;
          }
        }
      } catch (_) {}

      var seen = [];
      var text = "";

      try {
        text = JSON.stringify(value, function (key, val) {
          if (val instanceof Date) {
            return Utilities.formatDate(
              val,
              _scriptTimeZone_(),
              "yyyy-MM-dd'T'HH:mm:ss",
            );
          }

          if (val instanceof Error) {
            return {
              name: val.name,
              message: val.message,
              stack: val.stack,
            };
          }

          if (_isObject_(val)) {
            if (seen.indexOf(val) !== -1) {
              return "[Circular]";
            }
            seen.push(val);
          }
          return val;
        });
      } catch (error) {
        text =
          "Не вдалося серіалізувати деталі: " +
          (error && error.message ? error.message : String(error));
      }

      if (typeof text !== "string") text = String(text);
      return text.length > maxLen ? text.slice(0, maxLen) : text;
    }

    function _normCallsign_(value) {
      return _safeString_(value, "").trim().toUpperCase();
    }

    function _descriptor_() {
      try {
        if (
          typeof AccessControl_ === "object" &&
          AccessControl_ &&
          _isFunction_(AccessControl_.describe)
        ) {
          var descriptor = AccessControl_.describe();
          if (_isObject_(descriptor)) return descriptor;
        }
      } catch (_) {}

      return {
        role: "guest",
        isAdmin: false,
        isOperator: false,
        enabled: true,
        registered: false,
        knownUser: false,
        source: "fallback",
        personCallsign: "",
        displayName: "",
        email: "",
        currentKeyHashMasked: "",
      };
    }

    function _roleLabel_(role) {
      var normalized = _trimmedString_(role, "guest").toLowerCase();
      return ROLE_LABELS[normalized] || ROLE_LABELS.guest;
    }

    function _roleAtLeast_(role, requiredRole) {
      return _roleLevel_(role) >= _roleLevel_(requiredRole);
    }

    function _notificationEmails_() {
      try {
        if (
          typeof AccessControl_ === "object" &&
          AccessControl_ &&
          _isFunction_(AccessControl_.listNotificationEmails)
        ) {
          return _arrayUniqueStrings_(
            (AccessControl_.listNotificationEmails() || []).map(
              function (email) {
                return _lowerEmail_(email);
              },
            ),
          );
        }
      } catch (_) {}

      try {
        if (
          typeof AccessControl_ === "object" &&
          AccessControl_ &&
          _isFunction_(AccessControl_.listAdminEmails)
        ) {
          return _arrayUniqueStrings_(
            (AccessControl_.listAdminEmails() || []).map(function (email) {
              return _lowerEmail_(email);
            }),
          );
        }
      } catch (_) {}

      return [];
    }

    function _isHighPrivilegeRole_(role) {
      var r = _trimmedString_(role, "").toLowerCase();
      return HIGH_PRIVILEGE_ROLES.indexOf(r) !== -1;
    }

    function _registeredLabel_(value) {
      if (value === true) return "так";
      if (value === false) return "ні";
      return "невідомо";
    }

    function _identityStatusLabel_(value) {
      var normalized = _trimmedString_(value, "").toLowerCase();
      if (normalized === "system_trigger") return "system_trigger";
      if (normalized === "resolved") return "встановлено";
      if (normalized === "unregistered") return "не зареєстровано";
      if (normalized === "unavailable") return "недоступно";
      return "невідомо";
    }

    function _protectedSheets_() {
      return _arrayUniqueStrings_([
        _configValue_("ACCESS_SHEET", "ACCESS"),
        _configValue_("ALERTS_LOG_SHEET", "ALERTS_LOG"),
        _stage7ConfigValue_("JOB_RUNTIME_LOG_SHEET", "JOB_RUNTIME_LOG"),
        _stage7ConfigValue_("AUDIT_LOG_SHEET", "AUDIT_LOG"),
        _configValue_("OPS_LOG_SHEET", "OPS_LOG"),
        _configValue_("ACTIVE_OPERATIONS_SHEET", "ACTIVE_OPERATIONS"),
        _configValue_("CHECKPOINTS_SHEET", "CHECKPOINTS"),
        _configValue_("DICT_SHEET", "DICT"),
        _configValue_("DICT_SUM_SHEET", "DICT_SUM"),
        _configValue_("TEMPLATES_SHEET", "TEMPLATES"),
        _configValue_("LOG_SHEET", "LOG"),
        _vacationConfigValue_("VACATIONS_SHEET", "VACATIONS"),
        "VACATION_REQUESTS",
        "VACATION_SCHEDULE",
        "VACATION_CHECK",
        "VACATION_OPTIONS",
        _configValue_("SEND_PANEL_SHEET", "SEND_PANEL"),
        _configValue_("PHONES_SHEET", "PHONES"),
      ]);
    }

    function _structuralChangeTypes_() {
      return [
        "INSERT_ROW",
        "INSERT_COLUMN",
        "REMOVE_ROW",
        "REMOVE_COLUMN",
        "INSERT_GRID",
        "REMOVE_GRID",
      ];
    }

    function _isStructuralChangeType_(changeType) {
      var normalized = _trimmedString_(changeType, "OTHER").toUpperCase();
      return _structuralChangeTypes_().indexOf(normalized) !== -1;
    }

    // ==================== ЛОГУВАННЯ ТА АУДИТ ====================

    function _appendAlert_(record) {
      try {
        if (typeof addAlert === "function") {
          var rec = record || {};
          addAlert(
            rec.type || rec.action || "security",
            rec.severity || "info",
            rec.message || "",
            rec.details || rec,
          );
          return;
        }
        if (
          typeof AlertsRepository_ === "object" &&
          AlertsRepository_ &&
          _isFunction_(AlertsRepository_.appendAlert)
        ) {
          AlertsRepository_.appendAlert(record || {});
          return;
        }
      } catch (_) {}

      try {
        Logger.log("[ALERT] " + _safeStringify_(record || {}, 9000));
      } catch (_) {}
    }

    function _appendAudit_(message, record) {
      try {
        if (
          typeof Stage7AuditTrail_ !== "object" ||
          !Stage7AuditTrail_ ||
          !_isFunction_(Stage7AuditTrail_.record)
        ) {
          return;
        }

        Stage7AuditTrail_.record({
          timestamp: new Date(),
          operationId: "security-" + _safeUniqueId_("access"),
          scenario: "security.accessViolation",
          level: "SECURITY",
          status: "BLOCKED",
          initiator:
            record.displayName ||
            record.email ||
            record.currentKeyHashMasked ||
            "unknown",
          dryRun: false,
          partial: false,
          affectedSheets: [
            _configValue_("ALERTS_LOG_SHEET", "ALERTS_LOG"),
            _stage7ConfigValue_("AUDIT_LOG_SHEET", "AUDIT_LOG"),
            _configValue_("LOG_SHEET", "LOG"),
          ],

          affectedEntities: [
            record.personCallsign ||
              record.displayName ||
              record.email ||
              record.currentKeyHashMasked ||
              "unknown",
          ],
          appliedChangesCount: 1,
          skippedChangesCount: 0,
          payload: record,
          diagnostics: {
            type: "access-violation",
            source: record.source || "",
            action: record.action || "",
          },

          message: message || "",
          error: "",
        });
      } catch (_) {}
    }

    function _appendLegacyLog_(message, record) {
      try {
        if (
          typeof Stage7AuditTrail_ !== "object" ||
          !Stage7AuditTrail_ ||
          !_isFunction_(Stage7AuditTrail_.writeCompactLegacyLog)
        ) {
          return;
        }

        var dateStr = "";
        try {
          if (_isFunction_(_todayStr_)) {
            dateStr = _todayStr_();
          } else {
            dateStr = _todayStrLocal_();
          }
        } catch (_) {
          dateStr = _todayStrLocal_();
        }

        Stage7AuditTrail_.writeCompactLegacyLog({
          timestamp: new Date(),
          level: "SECURITY",
          scenario: record.action || "accessViolation",
          message: message || "",
          affectedSheets: [_configValue_("ALERTS_LOG_SHEET", "ALERTS_LOG")],
          affectedEntities: [
            record.personCallsign ||
              record.displayName ||
              record.email ||
              record.currentKeyHashMasked ||
              "unknown",
          ],
          context: { dateStr: dateStr },
        });
      } catch (_) {}
    }

    function _securityActionLabel_(action) {
      var map = {
        accessKeyRequested: "Заявка на отримання ключа доступу",
        selfBindLoginDenied: "Відмовлено в самостійній привʼязці при вході",
        openPersonCardDenied: "Відмовлено у відкритті картки особи",
        daySummaryDenied: "Відмовлено у формуванні короткого зведення",
        detailedSummaryDenied: "Відмовлено у формуванні детального зведення",
        checkVacationsAndBirthdays:
          "Відмовлено у перевірці відпусток і днів народження",
        sendPanelDenied: "Відмовлено у доступі до SEND_PANEL",
        workingActionDenied: "Відмовлено у виконанні робочої дії",
      };

      return map[action] || action || "Невідома подія";
    }

    function _securityReasonLabel_(code) {
      var map = {
        "access.registration.requested":
          "Користувач подав заявку на ключ доступу",
        "access.self_bind.identifier_mismatch":
          "Невідповідність ідентифікатора при спробі самостійної привʼязки доступу",
        "access.self_bind.identifier_not_found":
          "Ідентифікатор не знайдено в ACCESS",
        "access.self_bind.call_sign_occupied":
          "Позивний уже привʼязаний до іншого ключа",
        "access.denied_unknown_user": "Користувача не знайдено в системі",
        "access.denied_unregistered_key":
          "Ключ користувача не зареєстровано в ACCESS",
        "access.denied_key_unavailable": "Ключ користувача недоступний",
      };

      return map[code] || code || "Невідома причина";
    }

    function _sourceLabel_(source) {
      var value = _safeString_(source || "", "").trim();
      if (!value || value === "unknown") return "невідомий";
      if (value === "access-key-request") return "заявка на ключ доступу";
      if (value === "system_trigger") return "trigger";
      return value;
    }

    function _preferredContactLabel_(value) {
      var normalized = _safeString_(value || "", "")
        .trim()
        .toLowerCase();
      var map = {
        whatsapp: "WhatsApp",
        "whats app": "WhatsApp",
        wa: "WhatsApp",
        telegram: "Telegram",
        tg: "Telegram",
        signal: "Signal",
        email: "Email",
        mail: "Email",
        phone: "Телефон",
        call: "Телефонний дзвінок",
        sms: "SMS",
      };
      return map[normalized] || _safeString_(value || "", "");
    }

    function _requestDisplayName_(info) {
      if (!info || typeof info !== "object") return "";
      var surname = _safeString_(
        info.surname || info.lastName || info.familyName || "",
        "",
      );
      var firstName = _safeString_(
        info.firstName || info.first_name || info.name || "",
        "",
      );
      var displayName = _safeString_(
        info.displayName || info.display_name || "",
        "",
      );
      var fullName = [surname, firstName]
        .filter(function (part) {
          return !!part;
        })
        .join(" ")
        .trim();
      return fullName || displayName;
    }

    function _outcomeLabelForAction_(action, outcome) {
      if (action === "accessKeyRequested")
        return "заявку отримано, очікує підтвердження";
      var normalized = _safeString_(outcome || "", "")
        .trim()
        .toLowerCase();
      if (normalized === "blocked") return "відхилено";
      if (normalized === "pending") return "очікує підтвердження";
      if (normalized === "accepted") return "прийнято";
      return normalized || "відхилено";
    }

    function _subjectForSecurityMail_(action, record) {
      if (action === "accessKeyRequested") {
        var callsign = _safeString_(
          (record && record.details && record.details.enteredCallsign) ||
            record.personCallsign ||
            "",
          "",
        );
        var name = _requestDisplayName_((record && record.details) || {});
        return (
          "WASB ACCESS REQUEST" +
          (callsign ? ": " + callsign : "") +
          (name ? " — " + name : "")
        );
      }
      return "WASB SECURITY ALERT: " + action;
    }

    function _formatSecurityDetails_(info) {
      if (!info || typeof info !== "object") {
        return _safeString_(info || "", "");
      }

      var lines = [];

      function add(label, value) {
        if (value === undefined || value === null || value === "") return;
        lines.push(label + ": " + value);
      }

      var displayName = _requestDisplayName_(info);
      var preferredContactLabel = _preferredContactLabel_(
        info.preferredContact || info.preferred_contact || "",
      );

      add("Код причини", _securityReasonLabel_(info.reasonCode));
      add("Причина", info.reasonMessage);

      add("ПІБ", displayName);
      add("Прізвище", info.surname || info.lastName || info.familyName);
      add("Імʼя", info.firstName || info.first_name || info.name);
      add("Телефон", info.phone);
      add("Email", info.email);
      add(
        "Позивний",
        info.enteredCallsign || info.callsign || info.personCallsign,
      );
      add("Бажаний канал звʼязку", preferredContactLabel);
      add(
        "Telegram username",
        info.telegramUsername || info.telegram || info.tgUsername,
      );
      add("Signal", info.signal || info.signalPhone);
      add("Статус заявки", info.registrationStatus || info.registration_status);

      add(
        "Тип ідентифікатора",
        info.identifierType === "phone" ? "телефон" : info.identifierType,
      );
      add("Ідентифікатор", info.identifierValue);
      add("Введений позивний", info.enteredCallsign);
      add("Спроба №", info.attemptNumber);
      add("Залишилось спроб", info.remainingAttempts);
      add(
        "Заблоковано",
        info.blocked === true ? "так" : info.blocked === false ? "ні" : "",
      );
      add("Блокування, хв", info.blockDurationMinutes);
      add("Час входу", info.enteredAtText);
      add(
        "Точка входу",
        String(info.loginPointText || "").replace(/^Точка входу:\s*/i, ""),
      );

      return lines.length
        ? lines.join("\n")
        : _safeStringify_(info || {}, 9000);
    }

    // ==================== CLIENT UI ACCESS SIGNALS ====================

    function _truncateClientSignalField_(value) {
      var text = _trimmedString_(value, "");
      if (text.length <= CLIENT_SIGNAL_MAX_FIELD_LEN) return text;
      return text.slice(0, CLIENT_SIGNAL_MAX_FIELD_LEN);
    }

    function sanitizeClientSignalDetails(details) {
      var input = _isObject_(details) ? details : {};
      var out = {};
      var i;
      for (i = 0; i < CLIENT_SIGNAL_ALLOWED_DETAIL_KEYS.length; i++) {
        var key = CLIENT_SIGNAL_ALLOWED_DETAIL_KEYS[i];
        if (!Object.prototype.hasOwnProperty.call(input, key)) continue;
        var raw = input[key];
        if (raw === null || typeof raw === "undefined") continue;
        if (typeof raw === "object") continue;
        out[key] = _truncateClientSignalField_(raw);
      }

      try {
        var json = JSON.stringify(out);
        while (json.length > CLIENT_SIGNAL_MAX_JSON_LEN) {
          var keys = Object.keys(out);
          if (!keys.length) break;
          delete out[keys[keys.length - 1]];
          json = JSON.stringify(out);
        }
      } catch (_) {}

      return out;
    }

    function _clientSignalActorKey_(descriptor) {
      var identity =
        descriptor && descriptor.identity ? descriptor.identity : {};
      return (
        _trimmedString_(
          descriptor.currentKeyHashMasked ||
            identity.currentKeyHashMasked ||
            descriptor.email ||
            identity.email ||
            "",
          "",
        ) || "guest"
      );
    }

    function _checkClientSignalRateLimit_(action, actorKey) {
      try {
        var cache = CacheService.getScriptCache();
        var debounceKey =
          CLIENT_SIGNAL_RATE_PREFIX + "db:" + action + ":" + actorKey;
        if (cache.get(debounceKey)) {
          return { blocked: true, reason: "debounced" };
        }
        cache.put(debounceKey, "1", CLIENT_SIGNAL_DEBOUNCE_SEC);

        var hourKey = CLIENT_SIGNAL_RATE_PREFIX + "hr:" + actorKey;
        var count = Number(cache.get(hourKey) || "0") || 0;
        if (count >= CLIENT_SIGNAL_HOURLY_MAX) {
          return { blocked: true, reason: "hourly_cap" };
        }
        cache.put(hourKey, String(count + 1), 3600);
        return { blocked: false };
      } catch (_) {
        return { blocked: false };
      }
    }

    function reportClientAccessSignal(actionName, details) {
      var action = _trimmedString_(actionName, "");
      if (!CLIENT_ACCESS_SIGNAL_ACTIONS[action]) {
        return {
          success: false,
          blocked: true,
          message: "Client access signal action is not allowlisted",
          emailSent: false,
          alertLogged: false,
        };
      }

      var descriptor = _descriptor_();
      var actorKey = _clientSignalActorKey_(descriptor);
      var rate = _checkClientSignalRateLimit_(action, actorKey);
      if (rate.blocked) {
        return {
          success: true,
          blocked: true,
          suppressed: true,
          message:
            rate.reason === "hourly_cap"
              ? "Client access signal hourly cap reached"
              : "Client access signal debounced",
          emailSent: false,
          alertLogged: false,
        };
      }

      var sanitized = sanitizeClientSignalDetails(details);
      var role =
        _trimmedString_(descriptor.role, "guest").toLowerCase() || "guest";

      _appendAlert_({
        timestamp: new Date(),
        type: "client_access_signal",
        severity: "info",
        action: action,
        outcome: "logged",
        role: role,
        displayName: descriptor.displayName || "",
        userKey: descriptor.currentKeyHashMasked || "",
        message: "Client UI access signal: " + action,
        details: {
          action: action,
          role: role,
          sanitized: sanitized,
        },
      });

      return {
        success: true,
        blocked: false,
        message: "Client access signal recorded",
        emailSent: false,
        alertLogged: true,
        data: {
          action: action,
          sanitized: sanitized,
        },
      };
    }

    // ==================== ОСНОВНА ФУНКЦІЯ ПОВІДОМЛЕННЯ ====================

    function reportViolation(actionName, details, descriptorOpt) {
      var descriptor = descriptorOpt || _descriptor_();
      var identity =
        descriptor && descriptor.identity ? descriptor.identity : {};
      var audit = descriptor && descriptor.audit ? descriptor.audit : {};
      var action = _trimmedString_(actionName, "unknownAction");
      var info = _isObject_(details) ? Object.assign({}, details) : {};
      var role = _trimmedString_(descriptor.role, "guest").toLowerCase();

      if (!role) role = "guest";
      if (!Object.prototype.hasOwnProperty.call(ROLE_LABELS, role)) {
        role = "guest";
      }

      var knownUser =
        typeof descriptor.knownUser === "boolean"
          ? descriptor.knownUser
          : !!(
              descriptor.email ||
              identity.email ||
              descriptor.currentKeyHashMasked ||
              identity.currentKeyHashMasked
            );

      var registered =
        typeof descriptor.registered === "boolean"
          ? descriptor.registered
          : null;
      var identityStatus = _trimmedString_(descriptor.identityStatus, "");

      if (!identityStatus) {
        if (!knownUser) {
          identityStatus = "unavailable";
        } else if (registered === true) {
          identityStatus = "resolved";
        } else {
          identityStatus = "unregistered";
        }
      }

      var requestDisplayName = _requestDisplayName_(info);
      var requestEmail = _safeString_(info.email || "", "").trim();
      var requestPhone = _safeString_(info.phone || "", "").trim();
      var requestCallsign = _safeString_(
        info.enteredCallsign || info.callsign || info.personCallsign || "",
        "",
      ).trim();
      var requestPreferredContact = _preferredContactLabel_(
        info.preferredContact || info.preferred_contact || "",
      );

      var message =
        action === "accessKeyRequested"
          ? "Заявка на отримання ключа доступу"
          : "Спроба доступу без прав: " +
            action +
            " (" +
            _roleLabel_(role) +
            ")";

      var record = {
        timestamp: _nowText_(),
        type: "access_violation",
        severity: "critical",
        action: action,
        outcome: "blocked",
        role: role,
        roleLabel: _roleLabel_(role),
        displayName:
          descriptor.displayName ||
          identity.displayName ||
          requestDisplayName ||
          "",
        source:
          descriptor.source ||
          audit.source ||
          (action === "accessKeyRequested" ? "access-key-request" : ""),
        knownUser: knownUser,
        registered: registered,
        identityStatus: identityStatus,
        enabled: descriptor.enabled !== false,
        email: descriptor.email || identity.email || requestEmail || "",
        phone: requestPhone || "",
        preferredContact: requestPreferredContact || "",
        currentKeyHashMasked:
          descriptor.currentKeyHashMasked ||
          identity.currentKeyHashMasked ||
          "",
        personCallsign:
          descriptor.personCallsign ||
          identity.personCallsign ||
          requestCallsign ||
          "",
        details: info,
      };

      _appendAlert_({
        timestamp: new Date(),
        type: "access_violation",
        severity: record.severity,
        action: action,
        outcome: record.outcome,
        role: role,
        displayName: record.displayName,
        userKey: record.currentKeyHashMasked,
        email: record.email,
        phone: record.phone,
        preferredContact: record.preferredContact,
        source: record.source,
        message: message,
        details: record,
      });

      _appendAudit_(message, record);
      _appendLegacyLog_(message, record);

      var emailBodyParts = [
        "⚠️WASB SECURITY ATTENTION⚠️",
        "=============================",
        "Час: " + record.timestamp,
        "Подія: " + _securityActionLabel_(action),
        "Підсумок: " + _outcomeLabelForAction_(action, record.outcome),
        "Роль: " + record.roleLabel,
        "Ім'я: " + (record.displayName || "не визначено"),
        "Джерело доступу: " + _sourceLabel_(record.source),
        "Ідентифікація: " + _identityStatusLabel_(record.identityStatus),
        "Зареєстровано: " + _registeredLabel_(record.registered),
        "Email: " + (record.email || "не визначено"),
        "Телефон: " + (record.phone || "не визначено"),
        "Бажаний канал звʼязку: " + (record.preferredContact || "не визначено"),
        "User key: " + (record.currentKeyHashMasked || "не визначено"),
        "Прив'язаний позивний: " + (record.personCallsign || "не задано"),
        "",
        "Деталі:",
      ];

      emailBodyParts.push(_formatSecurityDetails_(info));

      var emailBody = emailBodyParts.join("\n");

      var fullEmailBodyParts = emailBodyParts.slice();
      for (var i = 0; i < fullEmailBodyParts.length; i++) {
        if (fullEmailBodyParts[i].indexOf("User key:") === 0) {
          var fullKey =
            typeof getCurrentUserKeyHash_ === "function"
              ? getCurrentUserKeyHash_()
              : "";
          fullEmailBodyParts[i] =
            "User key: " +
            (fullKey || record.currentKeyHashMasked || "не визначено");
        }
      }
      var fullEmailBody = fullEmailBodyParts.join("\n");
      var ownerEmail =
        typeof getWasbOwnerEmail_ === "function" ? getWasbOwnerEmail_() : "";
      var recipients = _notificationEmails_();

      var mailResult = { sent: false, recipients: [] };

      recipients.forEach(function (email) {
        var isOwner =
          !!ownerEmail && String(email).toLowerCase() === ownerEmail;
        var bodyToSend = isOwner ? fullEmailBody : emailBody;

        try {
          MailApp.sendEmail(
            email,
            _subjectForSecurityMail_(action, record),
            bodyToSend,
          );
          mailResult.sent = true;
          mailResult.recipients.push(email);
        } catch (e) {
          mailResult.error = e.message;
        }
      });

      if (mailResult && mailResult.error) {
        _appendAlert_({
          timestamp: new Date(),
          type: "access_violation_mail_error",
          severity: "error",
          action: action,
          outcome: "mail_error",
          role: role,
          displayName: record.displayName,
          userKey: record.currentKeyHashMasked,
          email: record.email,
          source: record.source,
          message:
            "Не вдалося надіслати email-сповіщення про порушення доступу",
          details: {
            error: mailResult.error,
            original: record,
          },
        });
      }

      return {
        success: true,
        message: message,
        alertLogged: true,
        emailSent: !!(mailResult && mailResult.sent),
        recipients:
          mailResult && mailResult.recipients ? mailResult.recipients : [],
        data: record,
      };
    }

    // ==================== ПЕРЕВІРКИ ДОСТУПУ ====================

    function canViewSidebarPersonnel(descriptor) {
      var access = descriptor || _descriptor_();
      if (access.enabled === false) return false;
      return _roleAtLeast_(access.role, "viewer");
    }

    function assertCanViewSidebarPersonnel(actionName, descriptorOpt) {
      var descriptor = descriptorOpt || _descriptor_();
      if (canViewSidebarPersonnel(descriptor)) return descriptor;

      reportViolation(
        _safeString_(actionName, "sidebarPersonnelDenied"),
        { violation: "sidebar-personnel-access" },
        descriptor,
      );

      throw new Error(
        "Недостатньо прав для перегляду списку особового складу.",
      );
    }

    function shouldRedactSidebarPersonnelSensitiveFields(descriptor) {
      var access = descriptor || _descriptor_();
      if (access.enabled === false) return true;
      return !_roleAtLeast_(access.role, "operator");
    }

    function applySidebarPersonnelAccessPolicy(sidebar, descriptorOpt) {
      if (!sidebar || typeof sidebar !== "object") return sidebar;

      var descriptor = descriptorOpt || _descriptor_();
      if (!shouldRedactSidebarPersonnelSensitiveFields(descriptor)) {
        return sidebar;
      }

      var personnel = Array.isArray(sidebar.personnel) ? sidebar.personnel : [];
      var redacted = personnel.map(function (item) {
        var row = Object.assign({}, item || {});
        row.phone = "";
        row.link = "";
        row.message = "";
        return row;
      });

      return Object.assign({}, sidebar, { personnel: redacted });
    }

    function canOpenPersonCard(descriptor, callsign) {
      var access = descriptor || _descriptor_();
      var target = _normCallsign_(callsign);

      if (!target) return false;
      if (access.enabled === false) return false;
      if (_roleAtLeast_(access.role, "operator")) return true;
      if (_trimmedString_(access.role, "guest").toLowerCase() !== "viewer")
        return false;

      var own = _normCallsign_(access.personCallsign || "");
      return !!own && own === target;
    }

    function assertCanOpenPersonCard(callsign, dateStr, descriptorOpt) {
      var descriptor = descriptorOpt || _descriptor_();
      if (canOpenPersonCard(descriptor, callsign)) return descriptor;

      reportViolation(
        "openPersonCardDenied",
        {
          requestedCallsign: _safeString_(callsign, ""),
          requestedDate: _safeString_(dateStr, ""),
          violation: "viewer-card-access",
        },
        descriptor,
      );

      throw new Error("Недостатньо прав для відкриття цієї картки.");
    }

    function canUseDaySummary(descriptor) {
      var access = descriptor || _descriptor_();
      return !!(
        access.enabled !== false && _roleAtLeast_(access.role, "operator")
      );
    }

    function assertCanUseDaySummary(dateStr, descriptorOpt) {
      var descriptor = descriptorOpt || _descriptor_();
      if (canUseDaySummary(descriptor)) return descriptor;

      reportViolation(
        "daySummaryDenied",
        {
          requestedDate: _safeString_(dateStr, ""),
          violation: "day-summary-access",
        },
        descriptor,
      );

      throw new Error("Недостатньо прав для короткого зведення.");
    }

    function canUseDetailedSummary(descriptor) {
      var access = descriptor || _descriptor_();
      return !!(
        access.enabled !== false && _roleAtLeast_(access.role, "operator")
      );
    }

    function assertCanUseDetailedSummary(dateStr, descriptorOpt) {
      var descriptor = descriptorOpt || _descriptor_();
      if (canUseDetailedSummary(descriptor)) return descriptor;

      reportViolation(
        "detailedSummaryDenied",
        {
          requestedDate: _safeString_(dateStr, ""),
          violation: "viewer-detailed-summary-access",
        },
        descriptor,
      );

      throw new Error("Недостатньо прав для детального зведення.");
    }

    function canUseWorkingActions(descriptor) {
      var access = descriptor || _descriptor_();
      return !!(
        access.enabled !== false && _roleAtLeast_(access.role, "maintainer")
      );
    }

    function buildSystemTriggerAccessDescriptor(payload) {
      var input = payload && typeof payload === "object" ? payload : {};
      var actorRole = _trimmedString_(
        input.actorRole || input.initiatorRole || "",
        "",
      ).toLowerCase();

      if (
        input.isSystemTrigger !== true ||
        input.allowSystem !== true ||
        actorRole !== "system"
      ) {
        return null;
      }

      return {
        role: "system",
        actorRole: "system",
        allowSystem: true,
        isSystemTrigger: true,
        enabled: true,
        knownUser: true,
        registered: true,
        source: "trigger",
        accessSource: _trimmedString_(
          input.accessSource || input.source || "system_trigger",
          "system_trigger",
        ),
        identityStatus: "system_trigger",
        displayName: "system-trigger",
        email: "",
        phone: "",
        personCallsign: "",
        currentKeyHashMasked: "",
      };
    }

    function _isSystemTriggerContext_(descriptor) {
      var access = descriptor || {};
      var source = _trimmedString_(
        access.source || access.accessSource,
        "",
      ).toLowerCase();
      var actorRole = _trimmedString_(
        access.actorRole || access.initiatorRole || access.role,
        "",
      ).toLowerCase();

      return !!(
        access.allowSystem === true &&
        access.isSystemTrigger === true &&
        actorRole === "system" &&
        (source === "trigger" || source === "system_trigger")
      );
    }

    function canRunLeaveBirthdayCheck(descriptor) {
      var access = descriptor || _descriptor_();
      if (access.enabled === false) return false;
      if (_isSystemTriggerContext_(access)) return true;
      return (
        _trimmedString_(access.role, "guest").toLowerCase() === "admin" ||
        _roleAtLeast_(access.role, "sysadmin")
      );
    }

    function assertCanRunLeaveBirthdayCheck(details, descriptorOpt) {
      var descriptor = descriptorOpt || _descriptor_();
      if (canRunLeaveBirthdayCheck(descriptor)) return descriptor;

      reportViolation(
        "checkVacationsAndBirthdays",
        Object.assign(
          { violation: "leave-birthday-check-access" },
          _isObject_(details) ? details : {},
        ),
        descriptor,
      );

      throw new Error(
        "Недостатньо прав для перевірки відпусток і днів народження.",
      );
    }

    function assertCanUseWorkingActions(actionName, details, descriptorOpt) {
      var descriptor = descriptorOpt || _descriptor_();
      if (canUseWorkingActions(descriptor)) return descriptor;

      reportViolation(
        _safeString_(actionName, "workingActionDenied"),
        Object.assign(
          { violation: "working-action-access" },
          _isObject_(details) ? details : {},
        ),
        descriptor,
      );

      throw new Error("Недостатньо прав для робочої дії.");
    }

    function canUseSendPanel(descriptor) {
      var access = descriptor || _descriptor_();
      return !!(
        access.enabled !== false && _roleAtLeast_(access.role, "maintainer")
      );
    }

    function assertCanUseSendPanel(actionName, details, descriptorOpt) {
      var descriptor = descriptorOpt || _descriptor_();
      if (canUseSendPanel(descriptor)) return descriptor;

      reportViolation(
        _safeString_(actionName, "sendPanelDenied"),
        Object.assign(
          { violation: "send-panel-access" },
          _isObject_(details) ? details : {},
        ),
        descriptor,
      );

      throw new Error("Недостатньо прав для SEND_PANEL.");
    }

    function describeEditActorByEmail(email) {
      var normalized = "";

      try {
        if (
          typeof AccessControl_ === "object" &&
          AccessControl_ &&
          _isFunction_(AccessControl_.normalizeEmail)
        ) {
          normalized = AccessControl_.normalizeEmail(email);
        } else {
          normalized = _lowerEmail_(email);
        }
      } catch (_) {
        normalized = _lowerEmail_(email);
      }

      var row = null;

      try {
        if (
          typeof AccessControl_ === "object" &&
          AccessControl_ &&
          _isFunction_(AccessControl_.getAccessRowByEmail)
        ) {
          row = AccessControl_.getAccessRowByEmail(normalized);
        }
      } catch (_) {
        row = null;
      }

      if (!row) {
        if (!normalized) {
          return {
            email: "",
            role: "unknown",
            enabled: true,
            knownUser: false,
            registered: null,
            isAdmin: false,
            isOperator: false,
            isMaintainer: false,
            source: "edit-user-unavailable",
            personCallsign: "",
            displayName: "",
            currentKeyHashMasked: "",
            identityStatus: "unavailable",
          };
        }

        return {
          email: normalized,
          role: "guest",
          enabled: true,
          knownUser: true,
          registered: false,
          isAdmin: false,
          isOperator: false,
          isMaintainer: false,
          source: "ACCESS-email-unregistered",
          personCallsign: "",
          displayName: "",
          currentKeyHashMasked: "",
          identityStatus: "unregistered",
        };
      }

      var role = _trimmedString_(row.role, "guest").toLowerCase();

      return {
        email: normalized || row.email || "",
        role: role,
        enabled: row.enabled !== false,
        knownUser: !!(normalized || row.email),
        registered: true,
        isAdmin: _roleAtLeast_(role, "admin") && row.enabled !== false,
        isOperator: _roleAtLeast_(role, "operator") && row.enabled !== false,
        isMaintainer:
          _roleAtLeast_(role, "maintainer") && row.enabled !== false,
        source: row.source || "ACCESS",
        personCallsign: row.personCallsign || "",
        displayName: row.displayName || "",
        currentKeyHashMasked:
          row.currentKeyHashMasked || row.userKeyCurrentHashMasked || "",
        identityStatus: "resolved",
      };
    }

    // ==================== ПУБЛІЧНЕ API ====================

    return {
      reportViolation: reportViolation,
      reportClientAccessSignal: reportClientAccessSignal,
      sanitizeClientSignalDetails: sanitizeClientSignalDetails,
      canViewSidebarPersonnel: canViewSidebarPersonnel,
      assertCanViewSidebarPersonnel: assertCanViewSidebarPersonnel,
      shouldRedactSidebarPersonnelSensitiveFields:
        shouldRedactSidebarPersonnelSensitiveFields,
      applySidebarPersonnelAccessPolicy: applySidebarPersonnelAccessPolicy,
      canOpenPersonCard: canOpenPersonCard,
      assertCanOpenPersonCard: assertCanOpenPersonCard,
      canUseDaySummary: canUseDaySummary,
      assertCanUseDaySummary: assertCanUseDaySummary,
      canUseDetailedSummary: canUseDetailedSummary,
      assertCanUseDetailedSummary: assertCanUseDetailedSummary,
      canUseWorkingActions: canUseWorkingActions,
      assertCanUseWorkingActions: assertCanUseWorkingActions,
      canRunLeaveBirthdayCheck: canRunLeaveBirthdayCheck,
      assertCanRunLeaveBirthdayCheck: assertCanRunLeaveBirthdayCheck,
      buildSystemTriggerAccessDescriptor: buildSystemTriggerAccessDescriptor,
      isSystemTriggerContext: _isSystemTriggerContext_,
      canUseSendPanel: canUseSendPanel,
      assertCanUseSendPanel: assertCanUseSendPanel,
      describeEditActorByEmail: describeEditActorByEmail,
      PROTECTED_SHEETS: _protectedSheets_(),
      getProtectedSheets: _protectedSheets_,
      isStructuralChangeType: _isStructuralChangeType_,
      isHighPrivilegeRole: _isHighPrivilegeRole_,
    };
  })();

// ==================== ГЛОБАЛЬНІ ФУНКЦІЇ ДЛЯ ТРИГЕРІВ ====================

function stage7ReportAccessViolation(actionName, details) {
  return AccessEnforcement_.reportViolation(actionName, details || {});
}

function stage7SecurityAuditOnEdit(e) {
  try {
    if (!e || !e.range) return;

    var sheet = e.range.getSheet();
    if (!sheet) return;

    var sheetName = _safeStringForTrigger_(sheet.getName(), "");
    if (!sheetName) return;

    var accessSheetName = _configValueForTrigger_("ACCESS_SHEET", "ACCESS");
    if (sheetName === accessSheetName) {
      try {
        if (
          typeof AccessControl_ === "object" &&
          AccessControl_ &&
          typeof AccessControl_.handleAccessSheetEdit === "function"
        ) {
          AccessControl_.handleAccessSheetEdit(e);
        }
      } catch (accessEditError) {
        try {
          Logger.log(
            "stage7SecurityAuditOnEdit ACCESS helper error: " +
              (accessEditError && accessEditError.message
                ? accessEditError.message
                : accessEditError),
          );
        } catch (_) {}
      }
    }

    var protectedSheets = _getProtectedSheetsForTrigger_();
    var isProtectedSheet = protectedSheets.indexOf(sheetName) !== -1;
    if (!isProtectedSheet) return;

    var userEmail = _extractEventUserEmail_(e);
    var actor = AccessEnforcement_.describeEditActorByEmail(userEmail);

    var hasAccess = false;
    var role = _safeStringForTrigger_(actor.role, "").toLowerCase();

    if (sheetName === _configValueForTrigger_("ACCESS_SHEET", "ACCESS")) {
      hasAccess = !!actor.isAdmin && actor.enabled !== false;
    } else {
      hasAccess =
        AccessEnforcement_.isHighPrivilegeRole(role) && actor.enabled !== false;
    }

    if (hasAccess && actor.registered === true) return;

    AccessEnforcement_.reportViolation(
      "sheetEditDeniedOrSuspicious",
      {
        sheet: sheetName,
        a1Notation: _extractA1ForTrigger_(e),
        oldValue: typeof e.oldValue !== "undefined" ? e.oldValue : "",
        newValue: typeof e.value !== "undefined" ? e.value : "",
        isProtectedSheet: isProtectedSheet,
        editorEmailFromEvent: userEmail || "",
      },
      actor,
    );
  } catch (error) {
    try {
      Logger.log(
        "stage7SecurityAuditOnEdit error: " +
          (error && error.message ? error.message : error),
      );
    } catch (_) {}
  }
}

function stage7SecurityAuditOnChange(e) {
  try {
    var source = e && e.source ? e.source : getWasbSpreadsheet_();
    if (!source) return;

    var changeType =
      e && e.changeType
        ? _safeStringForTrigger_(e.changeType, "OTHER").toUpperCase()
        : "OTHER";

    if (!AccessEnforcement_.isStructuralChangeType(changeType)) {
      return;
    }

    var userEmail = _extractEventUserEmail_(e);
    var actor = AccessEnforcement_.describeEditActorByEmail(userEmail);
    var role = _safeStringForTrigger_(actor.role, "").toLowerCase();
    var isHighPrivilege =
      AccessEnforcement_.isHighPrivilegeRole(role) &&
      actor.enabled !== false &&
      actor.registered === true;

    if (isHighPrivilege) return;

    AccessEnforcement_.reportViolation(
      "sheetStructureChangeDeniedOrSuspicious",
      {
        spreadsheetId: _isFunctionForTrigger_(source.getId)
          ? source.getId()
          : "",
        spreadsheetName: _isFunctionForTrigger_(source.getName)
          ? source.getName()
          : "",
        changeType: changeType,
        editorEmailFromEvent: userEmail || "",
      },
      actor,
    );
  } catch (error) {
    try {
      Logger.log(
        "stage7SecurityAuditOnChange error: " +
          (error && error.message ? error.message : error),
      );
    } catch (_) {}
  }
}

// ==================== ДОПОМІЖНІ ГЛОБАЛЬНІ ФУНКЦІЇ ДЛЯ ТРИГЕРІВ ====================

function _isFunctionForTrigger_(value) {
  return typeof value === "function";
}

function _safeStringForTrigger_(value, fallback) {
  if (value === null || typeof value === "undefined") return fallback || "";
  return String(value);
}

function _extractEventUserEmail_(e) {
  var userEmail = "";

  try {
    if (e && e.user && _isFunctionForTrigger_(e.user.getEmail)) {
      userEmail = _safeStringForTrigger_(e.user.getEmail(), "")
        .trim()
        .toLowerCase();
    }
  } catch (_) {
    userEmail = "";
  }

  return userEmail;
}

function _extractA1ForTrigger_(e) {
  try {
    if (e && e.range && _isFunctionForTrigger_(e.range.getA1Notation)) {
      return e.range.getA1Notation();
    }
  } catch (_) {}
  return "";
}

function _configValueForTrigger_(key, fallback) {
  try {
    if (typeof appGetCore === "function") {
      var viaCore = appGetCore(key, fallback);
      if (
        typeof viaCore !== "undefined" &&
        viaCore !== null &&
        viaCore !== ""
      ) {
        return viaCore;
      }
    }
  } catch (_) {}

  try {
    if (
      typeof CONFIG !== "undefined" &&
      CONFIG &&
      typeof CONFIG[key] !== "undefined" &&
      CONFIG[key] !== null &&
      CONFIG[key] !== ""
    ) {
      return CONFIG[key];
    }
  } catch (_) {}

  return fallback;
}

function _getProtectedSheetsForTrigger_() {
  try {
    if (typeof AccessEnforcement_ === "object" && AccessEnforcement_) {
      if (_isFunctionForTrigger_(AccessEnforcement_.getProtectedSheets)) {
        return AccessEnforcement_.getProtectedSheets();
      }
      if (Array.isArray(AccessEnforcement_.PROTECTED_SHEETS)) {
        return AccessEnforcement_.PROTECTED_SHEETS.slice();
      }
    }
  } catch (_) {}

  return [
    _configValueForTrigger_("ACCESS_SHEET", "ACCESS"),
    _configValueForTrigger_("ALERTS_LOG_SHEET", "ALERTS_LOG"),
    _configValueForTrigger_("OPS_LOG_SHEET", "OPS_LOG"),
    _configValueForTrigger_("DICT_SHEET", "DICT"),
    _configValueForTrigger_("DICT_SUM_SHEET", "DICT_SUM"),
    _configValueForTrigger_("LOG_SHEET", "LOG"),
    _configValueForTrigger_("SEND_PANEL_SHEET", "SEND_PANEL"),
    _configValueForTrigger_("PHONES_SHEET", "PHONES"),
    "AUDIT_LOG",
    "JOB_RUNTIME_LOG",
    "ACTIVE_OPERATIONS",
    "CHECKPOINTS",
    "TEMPLATES",
    "VACATIONS",
    "VACATION_REQUESTS",
    "VACATION_SCHEDULE",
    "VACATION_CHECK",
    "VACATION_OPTIONS",
  ].filter(function (value, index, arr) {
    return value && arr.indexOf(value) === index;
  });
}

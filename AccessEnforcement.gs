/**
 * AccessEnforcement.gs — обмеження доступу для viewer, перевірка прав на картки,
 * зведення, send-panel та сповіщення про порушення.
 */

var AccessEnforcement_ = AccessEnforcement_ || (function() {
  // ==================== КОНСТАНТИ ====================
  var ROLE_ORDER = {
    guest: 0,
    viewer: 1,
    operator: 2,
    maintainer: 3,
    admin: 4,
    sysadmin: 5,
    owner: 6
  };

  var ROLE_LABELS = {
    guest: 'Гість',
    viewer: 'Спостерігач',
    operator: 'Оператор',
    maintainer: 'Редактор',
    admin: 'Адмін',
    sysadmin: 'Сисадмін',
    owner: 'Власник'
  };

  var PROTECTED_SHEETS = [
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
  ];

  var HIGH_PRIVILEGE_ROLES = ['sysadmin', 'owner'];


  // ==================== ДОПОМІЖНІ ФУНКЦІЇ ====================

  /**
   * Повертає поточний час у форматі 'yyyy-MM-dd HH:mm:ss'.
   * @returns {string}
   */
  function _nowText_() {
    return Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone() || 'Etc/GMT',
      'yyyy-MM-dd HH:mm:ss'
    );
  }

  /**
   * Нормалізує позивний (верхній регістр, обрізка).
   * @param {*} value
   * @returns {string}
   */
  function _normCallsign_(value) {
    return String(value || '').trim().toUpperCase();
  }

  /**
   * Отримує дескриптор доступу через AccessControl_.
   * @returns {Object}
   */
  function _descriptor_() {
    if (typeof AccessControl_ === 'object' && AccessControl_.describe) {
      return AccessControl_.describe();
    }
    // Fallback для ситуацій, коли AccessControl_ недоступний
    return {
      role: 'guest',
      isAdmin: false,
      isOperator: false,
      enabled: true,
      registered: false,
      source: 'fallback',
      personCallsign: ''
    };
  }

  /**
   * Повертає мітку ролі українською.
   * @param {string} role
   * @returns {string}
   */
  function _roleLabel_(role) {
    var normalized = String(role || 'guest').trim().toLowerCase();
    return ROLE_LABELS[normalized] || 'Гість';
  }

  /**
   * Перевіряє, чи роль має рівень не нижче заданого.
   * @param {string} role
   * @param {string} requiredRole
   * @returns {boolean}
   */
  function _roleAtLeast_(role, requiredRole) {
    var roleLevel = ROLE_ORDER[String(role || 'guest').trim().toLowerCase()] || 0;
    var requiredLevel = ROLE_ORDER[String(requiredRole || 'guest').trim().toLowerCase()] || 0;
    return roleLevel >= requiredLevel;
  }

  /**
   * Повертає список email для сповіщень.
   * @returns {Array}
   */
  function _notificationEmails_() {
    if (typeof AccessControl_ !== 'object' || !AccessControl_.listNotificationEmails) {
      return [];
    }
    return AccessControl_.listNotificationEmails();
  }

  /**
   * Перевіряє, чи роль має високі привілеї (sysadmin або owner).
   * @param {string} role
   * @returns {boolean}
   */
  function _isHighPrivilegeRole_(role) {
    var r = String(role || '').toLowerCase();
    return HIGH_PRIVILEGE_ROLES.indexOf(r) !== -1;
  }


  // ==================== ЛОГУВАННЯ ТА АУДИТ ====================

  /**
   * Додає запис до AlertsRepository (якщо доступний).
   * @param {Object} record
   */
  function _appendAlert_(record) {
    if (typeof AlertsRepository_ === 'object' && AlertsRepository_.appendAlert) {
      AlertsRepository_.appendAlert(record || {});
    }
  }

  /**
   * Додає запис до основного аудиту (Stage7AuditTrail_).
   * @param {string} message
   * @param {Object} record
   */
  function _appendAudit_(message, record) {
    if (typeof Stage7AuditTrail_ !== 'object' || typeof Stage7AuditTrail_.record !== 'function') {
      return;
    }
    var operationId = 'security-' + (typeof stage7UniqueId_ === 'function'
      ? stage7UniqueId_('access')
      : String(Date.now()));

    Stage7AuditTrail_.record({
      timestamp: new Date(),
      operationId: operationId,
      scenario: 'security.accessViolation',
      level: 'SECURITY',
      status: 'BLOCKED',
      initiator: record.displayName || record.email || record.currentKeyHashMasked || 'unknown',
      dryRun: false,
      partial: false,
      affectedSheets: [
        typeof appGetCore === 'function' ? appGetCore('ALERTS_SHEET', 'ALERTS_LOG') : 'ALERTS_LOG',
        typeof STAGE7_CONFIG !== 'undefined' ? STAGE7_CONFIG.AUDIT_SHEET : 'AUDIT',
        typeof CONFIG !== 'undefined' ? CONFIG.LOG_SHEET : 'LOG'
      ],
      affectedEntities: [record.personCallsign || record.displayName || record.email || record.currentKeyHashMasked || 'unknown'],
      appliedChangesCount: 1,
      skippedChangesCount: 0,
      payload: record,
      diagnostics: {
        type: 'access-violation',
        source: record.source || '',
        action: record.action || ''
      },
      message: message || '',
      error: ''
    });
  }

  /**
   * Додає запис до legacy-логу (Stage7AuditTrail_.writeCompactLegacyLog).
   * @param {string} message
   * @param {Object} record
   */
  function _appendLegacyLog_(message, record) {
    if (typeof Stage7AuditTrail_ !== 'object' || typeof Stage7AuditTrail_.writeCompactLegacyLog !== 'function') {
      return;
    }
    Stage7AuditTrail_.writeCompactLegacyLog({
      timestamp: new Date(),
      level: 'SECURITY',
      scenario: record.action || 'accessViolation',
      message: message || '',
      affectedSheets: [typeof appGetCore === 'function' ? appGetCore('ALERTS_SHEET', 'ALERTS_LOG') : 'ALERTS_LOG'],
      affectedEntities: [record.personCallsign || record.displayName || record.email || record.currentKeyHashMasked || 'unknown'],
      context: { dateStr: typeof _todayStr_ === 'function' ? _todayStr_() : '' }
    });
  }

  /**
   * Надсилає email сповіщення адміністраторам.
   * @param {string} subject
   * @param {string} body
   * @returns {Object}
   */
  function _sendMail_(subject, body) {
    var recipients = _notificationEmails_();
    if (!recipients.length) {
      return { sent: false, recipients: [] };
    }
    MailApp.sendEmail(recipients.join(','), subject, body);
    return { sent: true, recipients: recipients };
  }


  // ==================== ОСНОВНА ФУНКЦІЯ ПОВІДОМЛЕННЯ ====================

  /**
   * Реєструє порушення доступу: логує, надсилає сповіщення, створює аудит.
   * @param {string} actionName
   * @param {Object} details
   * @param {Object} descriptorOpt
   * @returns {Object}
   */
  function reportViolation(actionName, details, descriptorOpt) {
    var descriptor = descriptorOpt || _descriptor_();
    var identity = descriptor && descriptor.identity ? descriptor.identity : {};
    var audit = descriptor && descriptor.audit ? descriptor.audit : {};
    var action = String(actionName || 'unknownAction').trim();
    if (action === '') action = 'unknownAction';

    var info = Object.assign({}, details || {});
    var role = String(descriptor.role || 'guest').trim().toLowerCase();
    if (role === '') role = 'guest';

    var message = 'Спроба доступу без прав: ' + action + ' (' + _roleLabel_(role) + ')';

    var record = {
      timestamp: _nowText_(),
      type: 'access_violation',
      severity: 'critical',
      action: action,
      outcome: 'blocked',
      role: role,
      roleLabel: _roleLabel_(role),
      displayName: descriptor.displayName || identity.displayName || '',
      source: descriptor.source || audit.source || '',
      registered: !!descriptor.registered,
      enabled: descriptor.enabled !== false,
      email: descriptor.email || identity.email || '',
      currentKeyHashMasked: descriptor.currentKeyHashMasked || identity.currentKeyHashMasked || '',
      personCallsign: descriptor.personCallsign || identity.personCallsign || '',
      details: info
    };

    // Логування в різні системи
    _appendAlert_({
      timestamp: new Date(),
      type: 'access_violation',
      severity: record.severity,
      action: action,
      outcome: record.outcome,
      role: role,
      displayName: record.displayName,
      userKey: record.currentKeyHashMasked,
      email: record.email,
      source: record.source,
      message: message,
      details: record
    });

    _appendAudit_(message, record);
    _appendLegacyLog_(message, record);

    // Підготовка email-сповіщення
    var emailBodyParts = [
      'WASB SECURITY ALERT',
      '===================',
      'Час: ' + record.timestamp,
      'Подія: ' + action,
      'Підсумок: заблоковано / відхилено',
      'Роль: ' + record.roleLabel,
      'Display name: ' + (record.displayName || 'не визначено'),
      'Джерело доступу: ' + (record.source || 'не визначено'),
      'Зареєстровано: ' + (record.registered ? 'так' : 'ні'),
      'Email: ' + (record.email || 'не визначено'),
      'User key: ' + (record.currentKeyHashMasked || 'не визначено'),
      'Прив\'язаний позивний: ' + (record.personCallsign || 'не задано'),
      '',
      'Деталі:'
    ];

    var detailsStr = '';
    try {
      detailsStr = typeof stage7SafeStringify_ === 'function'
        ? stage7SafeStringify_(info || {}, 9000)
        : JSON.stringify(info || {});
    } catch (e) {
      detailsStr = 'Не вдалося серіалізувати деталі';
    }
    emailBodyParts.push(detailsStr);

    var emailBody = emailBodyParts.join('\n');
    var mailResult = { sent: false, recipients: [] };

    try {
      mailResult = _sendMail_('WASB SECURITY ALERT: ' + action, emailBody);
    } catch (error) {
      _appendAlert_({
        timestamp: new Date(),
        type: 'access_violation_mail_error',
        severity: 'error',
        action: action,
        outcome: 'mail_error',
        role: role,
        displayName: record.displayName,
        userKey: record.currentKeyHashMasked,
        email: record.email,
        source: record.source,
        message: 'Не вдалося надіслати email-сповіщення про порушення доступу',
        details: {
          error: error && error.message ? error.message : String(error),
          original: record
        }
      });
    }

    return {
      success: true,
      message: message,
      alertLogged: true,
      emailSent: !!mailResult.sent,
      recipients: mailResult.recipients || [],
      data: record
    };
  }


  // ==================== ПЕРЕВІРКИ ДОСТУПУ ====================

  /**
   * Чи може користувач відкрити картку за позивним?
   * @param {Object} descriptor
   * @param {string} callsign
   * @returns {boolean}
   */
  function canOpenPersonCard(descriptor, callsign) {
    var access = descriptor || _descriptor_();
    var target = _normCallsign_(callsign);
    if (!target) return false;
    if (access.enabled === false) return false;
    if (_roleAtLeast_(access.role, 'operator')) return true;
    if (String(access.role || 'guest').toLowerCase() !== 'viewer') return false;
    var own = _normCallsign_(access.personCallsign || '');
    return !!own && own === target;
  }

  function assertCanOpenPersonCard(callsign, dateStr, descriptorOpt) {
    var descriptor = descriptorOpt || _descriptor_();
    if (canOpenPersonCard(descriptor, callsign)) return descriptor;
    reportViolation('openPersonCardDenied', {
      requestedCallsign: String(callsign || ''),
      requestedDate: String(dateStr || ''),
      violation: 'viewer-card-access'
    }, descriptor);
    throw new Error('Недостатньо прав для відкриття цієї картки.');
  }

  function canUseDaySummary(descriptor) {
    var access = descriptor || _descriptor_();
    return !!(access.enabled !== false && _roleAtLeast_(access.role, 'operator'));
  }

  function assertCanUseDaySummary(dateStr, descriptorOpt) {
    var descriptor = descriptorOpt || _descriptor_();
    if (canUseDaySummary(descriptor)) return descriptor;
    reportViolation('daySummaryDenied', {
      requestedDate: String(dateStr || ''),
      violation: 'day-summary-access'
    }, descriptor);
    throw new Error('Недостатньо прав для короткого зведення.');
  }

  function canUseDetailedSummary(descriptor) {
    var access = descriptor || _descriptor_();
    return !!(access.enabled !== false && _roleAtLeast_(access.role, 'operator'));
  }

  function assertCanUseDetailedSummary(dateStr, descriptorOpt) {
    var descriptor = descriptorOpt || _descriptor_();
    if (canUseDetailedSummary(descriptor)) return descriptor;
    reportViolation('detailedSummaryDenied', {
      requestedDate: String(dateStr || ''),
      violation: 'viewer-detailed-summary-access'
    }, descriptor);
    throw new Error('Недостатньо прав для детального зведення.');
  }

  function canUseWorkingActions(descriptor) {
    var access = descriptor || _descriptor_();
    return !!(access.enabled !== false && _roleAtLeast_(access.role, 'maintainer'));
  }

  function assertCanUseWorkingActions(actionName, details, descriptorOpt) {
    var descriptor = descriptorOpt || _descriptor_();
    if (canUseWorkingActions(descriptor)) return descriptor;
    reportViolation(String(actionName || 'workingActionDenied'),
      Object.assign({ violation: 'working-action-access' }, details || {}),
      descriptor);
    throw new Error('Недостатньо прав для робочої дії.');
  }

  function canUseSendPanel(descriptor) {
    var access = descriptor || _descriptor_();
    return !!(access.enabled !== false && _roleAtLeast_(access.role, 'maintainer'));
  }

  function assertCanUseSendPanel(actionName, details, descriptorOpt) {
    var descriptor = descriptorOpt || _descriptor_();
    if (canUseSendPanel(descriptor)) return descriptor;
    reportViolation(String(actionName || 'sendPanelDenied'),
      Object.assign({ violation: 'send-panel-access' }, details || {}),
      descriptor);
    throw new Error('Недостатньо прав для SEND_PANEL.');
  }

  /**
   * Повертає дескриптор користувача за email (для аудиту редагувань).
   * @param {string} email
   * @returns {Object}
   */
  function describeEditActorByEmail(email) {
    var normalized = '';
    if (typeof AccessControl_ === 'object' && AccessControl_.normalizeEmail) {
      normalized = AccessControl_.normalizeEmail(email);
    } else {
      normalized = String(email || '').trim().toLowerCase();
    }

    var row = null;
    if (typeof AccessControl_ === 'object' && AccessControl_.getAccessRowByEmail) {
      row = AccessControl_.getAccessRowByEmail(normalized);
    }

    if (!row) {
      return {
        email: normalized,
        role: 'guest',
        enabled: true,
        knownUser: !!normalized,
        registered: false,
        isAdmin: false,
        isOperator: false,
        isMaintainer: false,
        source: normalized ? 'ACCESS-email-unregistered' : 'edit-user-unavailable',
        personCallsign: '',
        displayName: ''
      };
    }

    var role = String(row.role || 'guest').toLowerCase();
    return {
      email: normalized || row.email || '',
      role: role,
      enabled: row.enabled !== false,
      knownUser: !!normalized,
      registered: true,
      isAdmin: _roleAtLeast_(role, 'admin') && row.enabled !== false,
      isOperator: _roleAtLeast_(role, 'operator') && row.enabled !== false,
      isMaintainer: _roleAtLeast_(role, 'maintainer') && row.enabled !== false,
      source: row.source || 'ACCESS',
      personCallsign: row.personCallsign || '',
      displayName: row.displayName || ''
    };
  }


  // ==================== ПУБЛІЧНЕ API ====================
  return {
    reportViolation: reportViolation,
    canOpenPersonCard: canOpenPersonCard,
    assertCanOpenPersonCard: assertCanOpenPersonCard,
    canUseDaySummary: canUseDaySummary,
    assertCanUseDaySummary: assertCanUseDaySummary,
    canUseDetailedSummary: canUseDetailedSummary,
    assertCanUseDetailedSummary: assertCanUseDetailedSummary,
    canUseWorkingActions: canUseWorkingActions,
    assertCanUseWorkingActions: assertCanUseWorkingActions,
    canUseSendPanel: canUseSendPanel,
    assertCanUseSendPanel: assertCanUseSendPanel,
    describeEditActorByEmail: describeEditActorByEmail,
    PROTECTED_SHEETS: PROTECTED_SHEETS
  };
})();


// ==================== ГЛОБАЛЬНІ ФУНКЦІЇ ДЛЯ ТРИГЕРІВ ====================

function stage7ReportAccessViolation(actionName, details) {
  return AccessEnforcement_.reportViolation(actionName, details || {});
}

function stage7SecurityAuditOnEdit(e) {
  try {
    // Перевірка вхідних даних
    if (!e || !e.range) return;
    var sheet = e.range.getSheet();
    if (!sheet) return;

    var sheetName = sheet.getName();
    if (!sheetName) return;

    var userEmail = '';
    try {
      if (e.user && e.user.getEmail) {
        userEmail = String(e.user.getEmail() || '');
      }
    } catch (err) {
      // Ігноруємо помилки отримання email
    }

    var actor = AccessEnforcement_.describeEditActorByEmail(userEmail);
    var protectedSheets = AccessEnforcement_.PROTECTED_SHEETS;
    var isProtectedSheet = protectedSheets.indexOf(sheetName) !== -1;
    if (!isProtectedSheet) return;

    var hasAccess = false;
    if (sheetName === 'ACCESS') {
      hasAccess = !!actor.isAdmin;
    } else {
      var role = String(actor.role || '').toLowerCase();
      var isHighPrivilege = (role === 'sysadmin' || role === 'owner');
      hasAccess = isHighPrivilege && actor.enabled !== false;
    }

    // Якщо доступ дозволено і користувач зареєстрований — виходимо
    if (hasAccess && actor.registered) return;

    // Логування порушення
    AccessEnforcement_.reportViolation('sheetEditDeniedOrSuspicious', {
      sheet: sheetName,
      a1Notation: e.range.getA1Notation ? e.range.getA1Notation() : '',
      oldValue: typeof e.oldValue !== 'undefined' ? e.oldValue : '',
      newValue: typeof e.value !== 'undefined' ? e.value : '',
      isProtectedSheet: isProtectedSheet,
      editorEmailFromEvent: userEmail || ''
    }, actor);

  } catch (error) {
    // Тихе завершення — не порушуємо роботу таблиці
    console.error('stage7SecurityAuditOnEdit error:', error);
  }
}

function stage7SecurityAuditOnChange(e) {
  try {
    var source = (e && e.source) ? e.source : SpreadsheetApp.getActive();
    if (!source) return;

    var userEmail = '';
    try {
      if (e && e.user && e.user.getEmail) {
        userEmail = String(e.user.getEmail() || '');
      }
    } catch (err) {
      // Ігноруємо
    }

    var actor = AccessEnforcement_.describeEditActorByEmail(userEmail);
    var changeType = (e && e.changeType) ? String(e.changeType) : 'OTHER';

    var role = String(actor.role || '').toLowerCase();
    var isHighPrivilege = (role === 'sysadmin' || role === 'owner');
    var shouldAlert = !isHighPrivilege || !actor.knownUser || !actor.registered;
    if (!shouldAlert) return;

    // Логування порушення
    AccessEnforcement_.reportViolation('sheetStructureChangeDeniedOrSuspicious', {
      spreadsheetId: source.getId ? source.getId() : '',
      spreadsheetName: source.getName ? source.getName() : '',
      changeType: changeType,
      editorEmailFromEvent: userEmail || ''
    }, actor);

  } catch (error) {
    // Тихе завершення — не порушуємо роботу таблиці
    console.error('stage7SecurityAuditOnChange error:', error);
  }
}

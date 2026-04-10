/**
 * AccessEnforcement.gs — viewer self-card restrictions, summary restrictions,
 * send-panel restrictions, and access violation alerts.
 */

var AccessEnforcement_ = AccessEnforcement_ || (function() {
  // ==================== КОНСТАНТИ ====================
  const ROLE_ORDER = {
    guest: 0,
    viewer: 1,
    operator: 2,
    maintainer: 3,
    admin: 4,
    sysadmin: 5,
    owner: 6
  };

  const ROLE_LABELS = {
    guest: 'Гість',
    viewer: 'Спостерігач',
    operator: 'Оператор',
    maintainer: 'Редактор',
    admin: 'Адмін',
    sysadmin: 'Сисадмін',
    owner: 'Власник'
  };

  const PROTECTED_SHEETS = [
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

  const HIGH_PRIVILEGE_ROLES = ['sysadmin', 'owner'];

  // ==================== ДОПОМІЖНІ ФУНКЦІЇ ====================
  function _nowText_() {
    return Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone() || 'Etc/GMT',
      'yyyy-MM-dd HH:mm:ss'
    );
  }

  function _normCallsign_(value) {
    return String(value || '').trim().toUpperCase();
  }

  function _descriptor_() {
    if (typeof AccessControl_ === 'object' && AccessControl_.describe) {
      return AccessControl_.describe();
    }
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

  function _roleLabel_(role) {
    return ROLE_LABELS[String(role || 'guest').trim().toLowerCase()] || 'Гість';
  }

  function _roleAtLeast_(role, requiredRole) {
    const roleLevel = ROLE_ORDER[String(role || 'guest').trim().toLowerCase()] || 0;
    const requiredLevel = ROLE_ORDER[String(requiredRole || 'guest').trim().toLowerCase()] || 0;
    return roleLevel >= requiredLevel;
  }

  function _notificationEmails_() {
    if (typeof AccessControl_ !== 'object' || !AccessControl_.listNotificationEmails) {
      return [];
    }
    return AccessControl_.listNotificationEmails();
  }

  function _isHighPrivilegeRole_(role) {
    return HIGH_PRIVILEGE_ROLES.indexOf(String(role || '').toLowerCase()) !== -1;
  }

  // ==================== ЛОГУВАННЯ ====================
  function _appendAlert_(record) {
    if (typeof AlertsRepository_ === 'object' && AlertsRepository_.appendAlert) {
      AlertsRepository_.appendAlert(record || {});
    }
  }

  function _appendAudit_(message, record) {
    if (typeof Stage7AuditTrail_ === 'object' && Stage7AuditTrail_.record) {
      Stage7AuditTrail_.record({
        timestamp: new Date(),
        operationId: 'security-' + (typeof stage7UniqueId_ === 'function' ? stage7UniqueId_('access') : Date.now()),
        scenario: 'security.accessViolation',
        level: 'SECURITY',
        status: 'BLOCKED',
        initiator: record.displayName || record.email || record.currentKey || 'unknown',
        dryRun: false,
        partial: false,
        affectedSheets: [
          typeof appGetCore === 'function' ? appGetCore('ALERTS_SHEET', 'ALERTS_LOG') : 'ALERTS_LOG',
          typeof STAGE7_CONFIG !== 'undefined' ? STAGE7_CONFIG.AUDIT_SHEET : 'AUDIT',
          typeof CONFIG !== 'undefined' ? CONFIG.LOG_SHEET : 'LOG'
        ],
        affectedEntities: [record.personCallsign || record.displayName || record.email || record.currentKey || 'unknown'],
        appliedChangesCount: 1,
        skippedChangesCount: 0,
        payload: record,
        diagnostics: { type: 'access-violation', source: record.source || '', action: record.action || '' },
        message: message || '',
        error: ''
      });
    }
  }

  function _appendLegacyLog_(message, record) {
    if (typeof Stage7AuditTrail_ === 'object' && Stage7AuditTrail_.writeCompactLegacyLog) {
      Stage7AuditTrail_.writeCompactLegacyLog({
        timestamp: new Date(),
        level: 'SECURITY',
        scenario: record.action || 'accessViolation',
        message: message || '',
        affectedSheets: [typeof appGetCore === 'function' ? appGetCore('ALERTS_SHEET', 'ALERTS_LOG') : 'ALERTS_LOG'],
        affectedEntities: [record.personCallsign || record.displayName || record.email || record.currentKey || 'unknown'],
        context: { dateStr: typeof _todayStr_ === 'function' ? _todayStr_() : '' }
      });
    }
  }

  function _sendMail_(subject, body) {
    const recipients = _notificationEmails_();
    if (!recipients.length) {
      return { sent: false, recipients: [] };
    }
    MailApp.sendEmail(recipients.join(','), subject, body);
    return { sent: true, recipients: recipients };
  }

  // ==================== ОСНОВНІ ФУНКЦІЇ ====================
  function reportViolation(actionName, details, descriptorOpt) {
    const descriptor = descriptorOpt || _descriptor_();
    const action = String(actionName || 'unknownAction').trim() || 'unknownAction';
    const info = Object.assign({}, details || {});
    const role = String(descriptor.role || 'guest').trim().toLowerCase() || 'guest';
    const message = 'Спроба доступу без прав: ' + action + ' (' + _roleLabel_(role) + ')';

    const record = {
      timestamp: _nowText_(),
      type: 'access_violation',
      severity: 'critical',
      action: action,
      outcome: 'blocked',
      role: role,
      roleLabel: _roleLabel_(role),
      displayName: descriptor.displayName || '',
      source: descriptor.source || '',
      registered: !!descriptor.registered,
      enabled: descriptor.enabled !== false,
      email: descriptor.email || '',
      currentKey: descriptor.currentKey || '',
      personCallsign: descriptor.personCallsign || '',
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
      userKey: record.currentKey,
      email: record.email,
      source: record.source,
      message: message,
      details: record
    });

    _appendAudit_(message, record);
    _appendLegacyLog_(message, record);

    // Надсилання email-сповіщення
    const emailBody = [
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
      'User key: ' + (record.currentKey || 'не визначено'),
      'Прив\'язаний позивний: ' + (record.personCallsign || 'не задано'),
      '',
      'Деталі:',
      typeof stage7SafeStringify_ === 'function' ? stage7SafeStringify_(info || {}, 9000) : JSON.stringify(info || {})
    ].join('\n');

    let mailResult = { sent: false, recipients: [] };
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
        userKey: record.currentKey,
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
  function canOpenPersonCard(descriptor, callsign) {
    const access = descriptor || _descriptor_();
    const target = _normCallsign_(callsign);
    if (!target) return false;
    if (access.enabled === false) return false;
    if (_roleAtLeast_(access.role, 'operator')) return true;
    if (String(access.role || 'guest').toLowerCase() !== 'viewer') return false;
    const own = _normCallsign_(access.personCallsign || '');
    return !!own && own === target;
  }

  function assertCanOpenPersonCard(callsign, dateStr, descriptorOpt) {
    const descriptor = descriptorOpt || _descriptor_();
    if (canOpenPersonCard(descriptor, callsign)) return descriptor;
    reportViolation('openPersonCardDenied', {
      requestedCallsign: String(callsign || ''),
      requestedDate: String(dateStr || ''),
      violation: 'viewer-card-access'
    }, descriptor);
    throw new Error('Недостатньо прав для відкриття цієї картки.');
  }

  function canUseDaySummary(descriptor) {
    const access = descriptor || _descriptor_();
    return !!(access.enabled !== false && _roleAtLeast_(access.role, 'operator'));
  }

  function assertCanUseDaySummary(dateStr, descriptorOpt) {
    const descriptor = descriptorOpt || _descriptor_();
    if (canUseDaySummary(descriptor)) return descriptor;
    reportViolation('daySummaryDenied', {
      requestedDate: String(dateStr || ''),
      violation: 'day-summary-access'
    }, descriptor);
    throw new Error('Недостатньо прав для короткого зведення.');
  }

  function canUseDetailedSummary(descriptor) {
    const access = descriptor || _descriptor_();
    return !!(access.enabled !== false && _roleAtLeast_(access.role, 'operator'));
  }

  function assertCanUseDetailedSummary(dateStr, descriptorOpt) {
    const descriptor = descriptorOpt || _descriptor_();
    if (canUseDetailedSummary(descriptor)) return descriptor;
    reportViolation('detailedSummaryDenied', {
      requestedDate: String(dateStr || ''),
      violation: 'viewer-detailed-summary-access'
    }, descriptor);
    throw new Error('Недостатньо прав для детального зведення.');
  }

  function canUseWorkingActions(descriptor) {
    const access = descriptor || _descriptor_();
    return !!(access.enabled !== false && _roleAtLeast_(access.role, 'maintainer'));
  }

  function assertCanUseWorkingActions(actionName, details, descriptorOpt) {
    const descriptor = descriptorOpt || _descriptor_();
    if (canUseWorkingActions(descriptor)) return descriptor;
    reportViolation(String(actionName || 'workingActionDenied'),
      Object.assign({ violation: 'working-action-access' }, details || {}),
      descriptor);
    throw new Error('Недостатньо прав для робочої дії.');
  }

  function canUseSendPanel(descriptor) {
    const access = descriptor || _descriptor_();
    return !!(access.enabled !== false && _roleAtLeast_(access.role, 'maintainer'));
  }

  function assertCanUseSendPanel(actionName, details, descriptorOpt) {
    const descriptor = descriptorOpt || _descriptor_();
    if (canUseSendPanel(descriptor)) return descriptor;
    reportViolation(String(actionName || 'sendPanelDenied'),
      Object.assign({ violation: 'send-panel-access' }, details || {}),
      descriptor);
    throw new Error('Недостатньо прав для SEND_PANEL.');
  }

  function describeEditActorByEmail(email) {
    const normalized = (typeof AccessControl_ === 'object' && AccessControl_.normalizeEmail)
      ? AccessControl_.normalizeEmail(email)
      : String(email || '').trim().toLowerCase();

    const row = (typeof AccessControl_ === 'object' && AccessControl_.getAccessRowByEmail)
      ? AccessControl_.getAccessRowByEmail(normalized)
      : null;

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

    const role = String(row.role || 'guest').toLowerCase();
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
    PROTECTED_SHEETS: PROTECTED_SHEETS  // Експортуємо константу для зовнішнього використання
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

    const sheet = e.range.getSheet();
    if (!sheet) return;

    const sheetName = sheet.getName();
    if (!sheetName) return;

    // Отримання інформації про користувача
    let userEmail = '';
    try {
      if (e.user && e.user.getEmail) {
        userEmail = String(e.user.getEmail() || '');
      }
    } catch (err) {
      // Ігноруємо помилки отримання email
    }

    const actor = AccessEnforcement_.describeEditActorByEmail(userEmail);
    const protectedSheets = AccessEnforcement_.PROTECTED_SHEETS;

    // Перевірка, чи змінюється захищений лист
    const isProtectedSheet = protectedSheets.indexOf(sheetName) !== -1;
    if (!isProtectedSheet) return;

    // Визначення прав доступу
    let hasAccess = false;
    if (sheetName === 'ACCESS') {
      hasAccess = !!actor.isAdmin;
    } else {
      const role = String(actor.role || '').toLowerCase();
      const isHighPrivilege = ['sysadmin', 'owner'].indexOf(role) !== -1;
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
    // Отримання джерела зміни
    const source = (e && e.source) ? e.source : SpreadsheetApp.getActive();
    if (!source) return;

    // Отримання інформації про користувача
    let userEmail = '';
    try {
      if (e && e.user && e.user.getEmail) {
        userEmail = String(e.user.getEmail() || '');
      }
    } catch (err) {
      // Ігноруємо помилки отримання email
    }

    const actor = AccessEnforcement_.describeEditActorByEmail(userEmail);
    const changeType = (e && e.changeType) ? String(e.changeType) : 'OTHER';

    // Перевірка, чи потрібно надсилати сповіщення
    const role = String(actor.role || '').toLowerCase();
    const isHighPrivilege = ['sysadmin', 'owner'].indexOf(role) !== -1;
    const shouldAlert = !isHighPrivilege || !actor.knownUser || !actor.registered;

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
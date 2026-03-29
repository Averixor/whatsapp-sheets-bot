/**
 * AccessEnforcement.gs — viewer self-card restrictions, summary restrictions,
 * send-panel restrictions, and access violation alerts.
 */

var AccessEnforcement_ = AccessEnforcement_ || (function() {
  const ROLE_ORDER = { guest: 0, viewer: 1, operator: 2, maintainer: 3, admin: 4, sysadmin: 5, owner: 6 };

  function _nowText_() {
    return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Etc/GMT', 'yyyy-MM-dd HH:mm:ss');
  }

  function _normCallsign_(value) {
    return String(value || '').trim().toUpperCase();
  }

  function _descriptor_() {
    return (typeof AccessControl_ === 'object' && AccessControl_.describe)
      ? AccessControl_.describe()
      : { role: 'guest', isAdmin: false, isOperator: false, enabled: true, registered: false, source: 'fallback', personCallsign: '' };
  }

  function _roleLabel_(role) {
    var map = { guest: 'Гість', viewer: 'Перегляд', operator: 'Оператор', maintainer: 'Редактор', admin: 'Адмін', sysadmin: 'Сис. адмін', owner: 'Власник' };
    return map[String(role || 'guest').trim().toLowerCase()] || 'Гість';
  }

  function _roleAtLeast_(role, requiredRole) {
    return (ROLE_ORDER[String(role || 'guest').trim().toLowerCase()] || 0) >= (ROLE_ORDER[String(requiredRole || 'guest').trim().toLowerCase()] || 0);
  }

  function _notificationEmails_() {
    if (typeof AccessControl_ !== 'object' || !AccessControl_.listNotificationEmails) return [];
    return AccessControl_.listNotificationEmails();
  }

  function _appendAlert_(record) {
    if (typeof AlertsRepository_ !== 'object' || !AlertsRepository_.appendAlert) return;
    AlertsRepository_.appendAlert(record || {});
  }

  function _appendAudit_(message, record) {
    if (typeof Stage4AuditTrail_ !== 'object' || !Stage4AuditTrail_.record) return;
    Stage4AuditTrail_.record({
      timestamp: new Date(),
      operationId: 'security-' + stage4UniqueId_('access'),
      scenario: 'security.accessViolation',
      level: 'SECURITY',
      status: 'BLOCKED',
      initiator: record.displayName || record.email || record.currentKey || 'unknown',
      dryRun: false,
      partial: false,
      affectedSheets: [appGetCore('ALERTS_SHEET', 'ALERTS_LOG'), STAGE4_CONFIG.AUDIT_SHEET, CONFIG.LOG_SHEET],
      affectedEntities: [record.personCallsign || record.displayName || record.email || record.currentKey || 'unknown'],
      appliedChangesCount: 1,
      skippedChangesCount: 0,
      payload: record,
      diagnostics: { type: 'access-violation', source: record.source || '', action: record.action || '' },
      message: message || '',
      error: ''
    });
  }

  function _appendLegacyLog_(message, record) {
    if (typeof Stage4AuditTrail_ === 'object' && Stage4AuditTrail_.writeCompactLegacyLog) {
      Stage4AuditTrail_.writeCompactLegacyLog({
        timestamp: new Date(),
        level: 'SECURITY',
        scenario: record.action || 'accessViolation',
        message: message || '',
        affectedSheets: [appGetCore('ALERTS_SHEET', 'ALERTS_LOG')],
        affectedEntities: [record.personCallsign || record.displayName || record.email || record.currentKey || 'unknown'],
        context: { dateStr: _todayStr_() }
      });
    }
  }

  function _sendMail_(subject, body) {
    var recipients = _notificationEmails_();
    if (!recipients.length) return { sent: false, recipients: [] };
    MailApp.sendEmail(recipients.join(','), subject, body);
    return { sent: true, recipients: recipients };
  }

  function reportViolation(actionName, details, descriptorOpt) {
    var descriptor = descriptorOpt || _descriptor_();
    var action = String(actionName || 'unknownAction').trim() || 'unknownAction';
    var info = Object.assign({}, details || {});
    var role = String(descriptor.role || 'guest').trim().toLowerCase() || 'guest';
    var message = 'Спроба доступу без прав: ' + action + ' (' + _roleLabel_(role) + ')';
    var record = {
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

    var body = [
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
      stage4SafeStringify_(info || {}, 9000)
    ].join('\n');

    var mailResult = { sent: false, recipients: [] };
    try {
      mailResult = _sendMail_('WASB SECURITY ALERT: ' + action, body);
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
    return !!(access.enabled !== false && _roleAtLeast_(access.role, 'viewer'));
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
    return !!(access.enabled !== false && _roleAtLeast_(access.role, 'operator'));
  }

  function assertCanUseWorkingActions(actionName, details, descriptorOpt) {
    var descriptor = descriptorOpt || _descriptor_();
    if (canUseWorkingActions(descriptor)) return descriptor;
    reportViolation(String(actionName || 'workingActionDenied'), Object.assign({ violation: 'working-action-access' }, details || {}), descriptor);
    throw new Error('Недостатньо прав для робочої дії.');
  }

  function canUseSendPanel(descriptor) {
    var access = descriptor || _descriptor_();
    return !!(access.enabled !== false && _roleAtLeast_(access.role, 'operator'));
  }

  function assertCanUseSendPanel(actionName, details, descriptorOpt) {
    var descriptor = descriptorOpt || _descriptor_();
    if (canUseSendPanel(descriptor)) return descriptor;
    reportViolation(String(actionName || 'sendPanelDenied'), Object.assign({ violation: 'send-panel-access' }, details || {}), descriptor);
    throw new Error('Недостатньо прав для SEND_PANEL.');
  }

  function describeEditActorByEmail(email) {
    var normalized = (typeof AccessControl_ === 'object' && AccessControl_.normalizeEmail)
      ? AccessControl_.normalizeEmail(email)
      : String(email || '').trim().toLowerCase();
    var row = (typeof AccessControl_ === 'object' && AccessControl_.getAccessRowByEmail)
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
    describeEditActorByEmail: describeEditActorByEmail
  };
})();

function stage7ReportAccessViolation(actionName, details) {
  return AccessEnforcement_.reportViolation(actionName, details || {});
}

function stage7SecurityAuditOnEdit(e) {
  try {
    var sheet = e && e.range ? e.range.getSheet() : null;
    var sheetName = sheet ? sheet.getName() : '';
    var userEmail = '';
    try { userEmail = e && e.user && e.user.getEmail ? String(e.user.getEmail() || '') : ''; } catch (_) {}
    var actor = AccessEnforcement_.describeEditActorByEmail(userEmail);
    var protectedSheets = ['ACCESS', 'ALERTS_LOG', 'JOB_RUNTIME_LOG', 'AUDIT_LOG', 'OPS_LOG', 'ACTIVE_OPERATIONS', 'CHECKPOINTS'];
    var editedProtectedSheet = protectedSheets.indexOf(sheetName) !== -1;
    if (!editedProtectedSheet) return;

    var allow = false;
    if (sheetName === 'ACCESS') {
      allow = !!actor.isAdmin;
    } else {
      allow = ['sysadmin', 'owner'].indexOf(String(actor.role || '').toLowerCase()) !== -1 && actor.enabled !== false;
    }

    if (allow && actor.registered) return;
    AccessEnforcement_.reportViolation('sheetEditDeniedOrSuspicious', {
      sheet: sheetName,
      a1Notation: e && e.range && e.range.getA1Notation ? e.range.getA1Notation() : '',
      oldValue: e && typeof e.oldValue !== 'undefined' ? e.oldValue : '',
      newValue: e && typeof e.value !== 'undefined' ? e.value : '',
      editedProtectedSheet: editedProtectedSheet,
      editorEmailFromEvent: userEmail || ''
    }, actor);
  } catch (_) {}
}

function stage7SecurityAuditOnChange(e) {
  try {
    var source = e && e.source ? e.source : SpreadsheetApp.getActive();
    var userEmail = '';
    try { userEmail = e && e.user && e.user.getEmail ? String(e.user.getEmail() || '') : ''; } catch (_) {}
    var actor = AccessEnforcement_.describeEditActorByEmail(userEmail);
    var changeType = e && e.changeType ? String(e.changeType) : 'OTHER';
    var shouldAlert = ['sysadmin', 'owner'].indexOf(String(actor.role || '').toLowerCase()) === -1 || !actor.knownUser || !actor.registered;
    if (!shouldAlert) return;
    AccessEnforcement_.reportViolation('sheetStructureChangeDeniedOrSuspicious', {
      spreadsheetId: source && source.getId ? source.getId() : '',
      spreadsheetName: source && source.getName ? source.getName() : '',
      changeType: changeType,
      editorEmailFromEvent: userEmail || ''
    }, actor);
  } catch (_) {}
}

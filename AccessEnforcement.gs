/**
 * AccessEnforcement.gs — viewer self-card restrictions, detailed summary restrictions,
 * and access violation alerts.
 */

var AccessEnforcement_ = AccessEnforcement_ || (function() {
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

  function _notificationEmails_() {
    if (typeof AccessControl_ !== 'object' || !AccessControl_.listNotificationEmails) return [];
    return AccessControl_.listNotificationEmails();
  }

  function _appendAlert_(severity, message, details) {
    if (typeof AlertsRepository_ !== 'object' || !AlertsRepository_.appendAlert) return;
    AlertsRepository_.appendAlert({
      timestamp: new Date(),
      jobName: 'accessViolation',
      severity: severity || 'warning',
      message: message || '',
      details: details || {}
    });
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
      action: action,
      role: role,
      roleLabel: _roleLabel_(role),
      source: descriptor.source || '',
      registered: !!descriptor.registered,
      enabled: descriptor.enabled !== false,
      email: descriptor.email || '',
      currentKey: descriptor.currentKey || '',
      personCallsign: descriptor.personCallsign || '',
      details: info
    };

    _appendAlert_('critical', message, record);

    var body = [
      'WAPB SECURITY ALERT',
      '===================',
      'Час: ' + record.timestamp,
      'Подія: ' + action,
      'Роль: ' + record.roleLabel,
      'Джерело доступу: ' + record.source,
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
      mailResult = _sendMail_('WAPB SECURITY ALERT: ' + action, body);
    } catch (error) {
      _appendAlert_('error', 'Не вдалося надіслати email-сповіщення про порушення доступу', {
        action: action,
        error: error && error.message ? error.message : String(error),
        original: record
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
    if (access.isOperator || access.isAdmin) return true;
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

  function canUseDetailedSummary(descriptor) {
    var access = descriptor || _descriptor_();
    return !!(access.enabled !== false && ((access.isOperator || access.isAdmin) || ['operator', 'maintainer', 'admin', 'sysadmin', 'owner'].indexOf(String(access.role || '').toLowerCase()) !== -1));
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
        personCallsign: ''
      };
    }
    var role = String(row.role || 'guest').toLowerCase();
    return {
      email: normalized || row.email || '',
      role: role,
      enabled: row.enabled !== false,
      knownUser: !!normalized,
      registered: true,
      isAdmin: ['admin', 'sysadmin', 'owner'].indexOf(role) !== -1 && row.enabled !== false,
      isOperator: ['operator', 'maintainer', 'admin', 'sysadmin', 'owner'].indexOf(role) !== -1 && row.enabled !== false,
      isMaintainer: ['maintainer', 'admin', 'sysadmin', 'owner'].indexOf(role) !== -1 && row.enabled !== false,
      source: row.source || 'ACCESS',
      personCallsign: row.personCallsign || ''
    };
  }

  return {
    reportViolation: reportViolation,
    canOpenPersonCard: canOpenPersonCard,
    assertCanOpenPersonCard: assertCanOpenPersonCard,
    canUseDetailedSummary: canUseDetailedSummary,
    assertCanUseDetailedSummary: assertCanUseDetailedSummary,
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
    var role = String(actor.role || 'guest').toLowerCase();
    var protectedSheets = ['ACCESS', 'ALERTS_LOG', 'JOB_RUNTIME_LOG', 'AUDIT_LOG', 'OPS_LOG', 'ACTIVE_OPERATIONS', 'CHECKPOINTS'];
    var editedProtectedSheet = protectedSheets.indexOf(sheetName) !== -1;
    var shouldAlert = (role === 'guest' || role === 'viewer' || !actor.registered || !actor.knownUser || (editedProtectedSheet && !actor.isAdmin));
    if (!shouldAlert) return;
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
    var shouldAlert = (!actor.isAdmin) || !actor.knownUser || !actor.registered;
    if (!shouldAlert) return;
    AccessEnforcement_.reportViolation('sheetStructureChangeDeniedOrSuspicious', {
      spreadsheetId: source && source.getId ? source.getId() : '',
      spreadsheetName: source && source.getName ? source.getName() : '',
      changeType: changeType,
      editorEmailFromEvent: userEmail || ''
    }, actor);
  } catch (_) {}
}

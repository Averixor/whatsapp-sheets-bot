/**
 * AccessControl.gs — lightweight RBAC for WAPB maintenance/admin actions.
 */

const AccessControl_ = (function() {
  const ACCESS_SHEET = appGetCore('ACCESS_SHEET', 'ACCESS');
  const ADMIN_PROP = 'WAPB_ACCESS_ADMIN_EMAILS';
  const OPERATOR_PROP = 'WAPB_ACCESS_OPERATOR_EMAILS';
  const VIEWER_PROP = 'WAPB_ACCESS_VIEWER_EMAILS';
  const ROLE_ORDER = Object.freeze({ viewer: 0, operator: 1, admin: 2 });
  const SHEET_HEADERS = Object.freeze(['email', 'role', 'enabled', 'note']);

  function normalizeEmail_(value) {
    return String(value || '').trim().toLowerCase();
  }

  function normalizeRole_(value) {
    const role = String(value || '').trim().toLowerCase();
    if (role === 'admin' || role === 'operator' || role === 'viewer') return role;
    return 'viewer';
  }

  function safeGetUserEmail_() {
    try {
      return normalizeEmail_(Session.getActiveUser().getEmail());
    } catch (_) {
      return '';
    }
  }

  function _getSheet_(createIfMissing) {
    const ss = SpreadsheetApp.getActive();
    let sh = ss.getSheetByName(ACCESS_SHEET);
    if (!sh && createIfMissing) {
      sh = ss.insertSheet(ACCESS_SHEET);
      sh.getRange(1, 1, 1, SHEET_HEADERS.length).setValues([SHEET_HEADERS]);
      sh.getRange(1, 1, 1, SHEET_HEADERS.length).setFontWeight('bold').setBackground('#e8eaed');
      sh.setFrozenRows(1);
    }
    return sh;
  }

  function bootstrapSheet() {
    const existed = !!_getSheet_(false);
    const sh = _getSheet_(true);
    return {
      success: true,
      sheet: ACCESS_SHEET,
      created: !existed,
      message: existed ? 'Лист ACCESS вже існує' : 'Лист ACCESS створено'
    };
  }

  function _parseEmailsList_(value) {
    return String(value || '')
      .split(/[;,\s]+/)
      .map(normalizeEmail_)
      .filter(Boolean);
  }

  function _getProperties_() {
    return PropertiesService.getScriptProperties();
  }

  function listEmailsByRole(role) {
    const normalizedRole = normalizeRole_(role);
    const propName = normalizedRole === 'admin' ? ADMIN_PROP : (normalizedRole === 'operator' ? OPERATOR_PROP : VIEWER_PROP);
    return _parseEmailsList_(_getProperties_().getProperty(propName));
  }

  function listAdminEmails() {
    return listEmailsByRole('admin');
  }

  function _findInSheet_(email) {
    const normalizedEmail = normalizeEmail_(email);
    if (!normalizedEmail) return null;
    const sh = _getSheet_(false);
    if (!sh || sh.getLastRow() < 2) return null;
    const values = sh.getRange(2, 1, sh.getLastRow() - 1, Math.max(sh.getLastColumn(), SHEET_HEADERS.length)).getValues();
    for (let i = 0; i < values.length; i++) {
      const row = values[i];
      if (normalizeEmail_(row[0]) !== normalizedEmail) continue;
      const enabledRaw = String(row[2] === '' || row[2] === null ? 'TRUE' : row[2]).trim().toLowerCase();
      const enabled = !(enabledRaw === 'false' || enabledRaw === '0' || enabledRaw === 'no' || enabledRaw === 'ні');
      return {
        email: normalizedEmail,
        role: normalizeRole_(row[1]),
        enabled: enabled,
        note: String(row[3] || ''),
        source: ACCESS_SHEET,
        sheetRow: i + 2
      };
    }
    return null;
  }

  function _findInProperties_(email) {
    const normalizedEmail = normalizeEmail_(email);
    if (!normalizedEmail) return null;
    if (listEmailsByRole('admin').indexOf(normalizedEmail) !== -1) {
      return { email: normalizedEmail, role: 'admin', enabled: true, note: '', source: 'scriptProperties' };
    }
    if (listEmailsByRole('operator').indexOf(normalizedEmail) !== -1) {
      return { email: normalizedEmail, role: 'operator', enabled: true, note: '', source: 'scriptProperties' };
    }
    if (listEmailsByRole('viewer').indexOf(normalizedEmail) !== -1) {
      return { email: normalizedEmail, role: 'viewer', enabled: true, note: '', source: 'scriptProperties' };
    }
    return null;
  }

  function describe(email) {
    const userEmail = normalizeEmail_(email) || safeGetUserEmail_();
    const sheetEntry = _findInSheet_(userEmail);
    const propEntry = !sheetEntry ? _findInProperties_(userEmail) : null;
    const match = sheetEntry || propEntry;
    const role = match ? normalizeRole_(match.role) : 'viewer';
    const knownUser = !!userEmail;
    const readOnly = role === 'viewer';
    const enabled = match ? match.enabled !== false : true;
    const reason = !knownUser
      ? 'Email користувача недоступний; небезпечні дії переведені в safe-mode.'
      : (match
        ? ''
        : 'Роль не налаштовано. Доступ до maintenance-операцій заборонено.');

    return {
      email: userEmail,
      role: role,
      enabled: enabled,
      knownUser: knownUser,
      readOnly: readOnly,
      isAdmin: role === 'admin' && enabled,
      isOperator: (ROLE_ORDER[role] || 0) >= ROLE_ORDER.operator && enabled,
      source: match ? match.source : 'default',
      note: match && match.note ? String(match.note) : '',
      accessSheet: ACCESS_SHEET,
      reason: reason,
      adminEmailsConfigured: listAdminEmails().length,
      availableRoles: Object.keys(ROLE_ORDER)
    };
  }

  function assertRoleAtLeast(requiredRole, actionLabel) {
    const descriptor = describe();
    const need = normalizeRole_(requiredRole || 'viewer');
    const current = normalizeRole_(descriptor.role);
    if (!descriptor.enabled || (ROLE_ORDER[current] || 0) < (ROLE_ORDER[need] || 0)) {
      const label = String(actionLabel || 'ця дія');
      throw new Error('Недостатньо прав для дії: ' + label + '. Поточна роль: ' + current + '.');
    }
    return descriptor;
  }

  return {
    ROLE_ORDER: ROLE_ORDER,
    describe: describe,
    assertRoleAtLeast: assertRoleAtLeast,
    bootstrapSheet: bootstrapSheet,
    listAdminEmails: listAdminEmails,
    listEmailsByRole: listEmailsByRole,
    normalizeRole: normalizeRole_,
    normalizeEmail: normalizeEmail_,
    safeGetUserEmail: safeGetUserEmail_
  };
})();

function bootstrapWapbAccessSheet() {
  return AccessControl_.bootstrapSheet();
}

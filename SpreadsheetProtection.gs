/**
 * SpreadsheetProtection.gs — protection helpers for service sheets.
 */

function _wasbServiceSheets_() {
  return [
    CONFIG.LOG_SHEET || 'LOG',
    STAGE4_CONFIG.AUDIT_SHEET || 'AUDIT_LOG',
    STAGE5_CONFIG.JOB_RUNTIME_SHEET || 'JOB_RUNTIME_LOG',
    appGetCore('OPS_LOG_SHEET', 'OPS_LOG'),
    appGetCore('ACTIVE_OPERATIONS_SHEET', 'ACTIVE_OPERATIONS'),
    appGetCore('CHECKPOINTS_SHEET', 'CHECKPOINTS'),
    appGetCore('ALERTS_SHEET', 'ALERTS_LOG'),
    appGetCore('ACCESS_SHEET', 'ACCESS'),
    'SEND_PANEL'
  ].filter(Boolean).filter(function(value, index, arr) { return arr.indexOf(value) === index; });
}

function applySpreadsheetProtections_(options) {
  const opts = Object.assign({ dryRun: true }, options || {});
  const ss = SpreadsheetApp.getActive();
  const adminEmails = (typeof AccessControl_ === 'object' && AccessControl_.listAdminEmails)
    ? AccessControl_.listAdminEmails()
    : [];
  const fallbackEditor = (typeof Session !== 'undefined' && Session.getEffectiveUser)
    ? String(Session.getEffectiveUser().getEmail() || '').trim().toLowerCase()
    : '';
  const allowEditors = [fallbackEditor].concat(adminEmails).filter(Boolean).filter(function(value, index, arr) { return arr.indexOf(value) === index; });
  const warningOnly = !adminEmails.length;
  const summary = {
    dryRun: !!opts.dryRun,
    warningOnly: warningOnly,
    adminEmails: adminEmails,
    plannedSheets: [],
    protectedSheets: [],
    missingSheets: [],
    warnings: []
  };

  _wasbServiceSheets_().forEach(function(sheetName) {
    const sh = ss.getSheetByName(sheetName);
    if (!sh) {
      summary.missingSheets.push(sheetName);
      return;
    }
    summary.plannedSheets.push(sheetName);
    if (opts.dryRun) return;

    try {
      const protection = sh.protect();
      protection.setDescription('WASB service sheet protection');
      protection.setWarningOnly(warningOnly);
      if (!warningOnly) {
        try {
          if (protection.canDomainEdit && protection.canDomainEdit()) protection.setDomainEdit(false);
        } catch (_) {}
        try {
          const currentEditors = protection.getEditors ? protection.getEditors() : [];
          const removable = currentEditors.filter(function(user) {
            const email = String(user && user.getEmail ? user.getEmail() : '').trim().toLowerCase();
            return email && allowEditors.indexOf(email) === -1;
          });
          if (removable.length && protection.removeEditors) protection.removeEditors(removable);
        } catch (_) {}
        try {
          if (allowEditors.length && protection.addEditors) protection.addEditors(allowEditors);
        } catch (_) {}
      }
      summary.protectedSheets.push(sheetName);
    } catch (error) {
      summary.warnings.push('Не вдалося захистити лист ' + sheetName + ': ' + (error && error.message ? error.message : error));
    }
  });

  if (warningOnly) {
    summary.warnings.push('Адміністратори не налаштовані — застосовано warningOnly protection.');
  }

  return summary;
}

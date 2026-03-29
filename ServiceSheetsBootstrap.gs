/**
 * ServiceSheetsBootstrap.gs — explicit bootstrap helpers for service journal sheets.
 */

function bootstrapWasbRuntimeAndAlertsSheets() {
  const runtime = (typeof JobRuntimeRepository_ === 'object' && JobRuntimeRepository_.ensureSheet)
    ? JobRuntimeRepository_.ensureSheet()
    : { success: false, sheet: (typeof STAGE7_CONFIG !== 'undefined' ? STAGE7_CONFIG.JOB_RUNTIME_SHEET : 'JOB_RUNTIME_LOG') };
  const alerts = (typeof AlertsRepository_ === 'object' && AlertsRepository_.ensureSheet)
    ? AlertsRepository_.ensureSheet()
    : { success: false, sheet: (typeof appGetCore === 'function' ? appGetCore('ALERTS_SHEET', 'ALERTS_LOG') : 'ALERTS_LOG') };
  const audit = (typeof Stage7AuditTrail_ === 'object' && Stage7AuditTrail_.ensureSheet)
    ? { success: true, sheet: Stage7AuditTrail_.ensureSheet().getName() }
    : { success: false, sheet: (typeof STAGE7_CONFIG !== 'undefined' ? STAGE7_CONFIG.AUDIT_SHEET : 'AUDIT_LOG') };

  return {
    success: runtime.success !== false && alerts.success !== false && audit.success !== false,
    message: 'Службові листи журналів підготовлено',
    sheets: [runtime.sheet, alerts.sheet, audit.sheet].filter(Boolean),
    runtime: runtime,
    alerts: alerts,
    audit: audit
  };
}

function apiStage7BootstrapRuntimeAndAlertsSheets() {
  if (typeof AccessControl_ === 'object' && AccessControl_.assertRoleAtLeast) AccessControl_.assertRoleAtLeast('admin', 'bootstrap runtime and alerts sheets');
  const result = bootstrapWasbRuntimeAndAlertsSheets();
  return _stage7BuildMaintenanceResponse_(
    result.success !== false,
    result.message || 'Службові листи журналів підготовлено',
    result,
    'stage7BootstrapRuntimeAndAlertsSheets',
    result.success === false ? ['Не вдалося підготувати службові листи журналів'] : [],
    { affectedSheets: result.sheets || [] }
  );
}

/**
 * DeprecatedRegistry.gs — compatibility / historical / sunset registry for the final baseline.
 */


const DeprecatedRegistry_ = Object.freeze({
  add: function(name, replacement, sunset) {
    return Object.freeze({
      name: String(name || '').trim(),
      replacement: String(replacement || '').trim(),
      sunset: String(sunset || '').trim() || 'planned',
      status: 'compatibility-wrapper',
      scope: 'LegacyMaintenanceAliases.gs',
      uiAllowed: false,
      risk: 'low'
    });
  }
});

const STAGE7_MAINTENANCE_WRAPPER_MAP_ = Object.freeze([
  DeprecatedRegistry_.add('apiStage4ClearCache', 'apiStage7ClearCache', 'Stage 7.2'),
  DeprecatedRegistry_.add('apiStage4ClearLog', 'apiStage7ClearLog', 'Stage 7.2'),
  DeprecatedRegistry_.add('apiStage4ClearPhoneCache', 'apiStage7ClearPhoneCache', 'Stage 7.2'),
  DeprecatedRegistry_.add('apiStage4RestartBot', 'apiStage7RestartBot', 'Stage 7.2'),
  DeprecatedRegistry_.add('apiStage4SetupVacationTriggers', 'apiStage7SetupVacationTriggers', 'Stage 7.2'),
  DeprecatedRegistry_.add('apiStage4CleanupDuplicateTriggers', 'apiStage7CleanupDuplicateTriggers', 'Stage 7.2'),
  DeprecatedRegistry_.add('apiStage4DebugPhones', 'apiStage7DebugPhones', 'Stage 7.2'),
  DeprecatedRegistry_.add('apiStage4BuildBirthdayLink', 'apiStage7BuildBirthdayLink', 'Stage 7.2'),
  DeprecatedRegistry_.add('apiStage4HealthCheck', 'apiStage7HealthCheck', 'Stage 7.2'),
  DeprecatedRegistry_.add('apiRunStage4RegressionTests', 'apiRunStage7RegressionTests', 'Stage 7.2'),
  DeprecatedRegistry_.add('apiStage4ListPendingRepairs', 'apiStage7ListPendingRepairs', 'Stage 7.2'),
  DeprecatedRegistry_.add('apiStage4GetOperationDetails', 'apiStage7GetOperationDetails', 'Stage 7.2'),
  DeprecatedRegistry_.add('apiStage4RunRepair', 'apiStage7RunRepair', 'Stage 7.2'),
  DeprecatedRegistry_.add('apiStage4RunLifecycleRetentionCleanup', 'apiStage7RunLifecycleRetentionCleanup', 'Stage 7.2'),
  DeprecatedRegistry_.add('apiStage4GetAccessDescriptor', 'apiStage7GetAccessDescriptor', 'Stage 7.2'),
  DeprecatedRegistry_.add('apiStage4ApplyProtections', 'apiStage7ApplyProtections', 'Stage 7.2'),
  DeprecatedRegistry_.add('apiStage4BootstrapAccessSheet', 'apiStage7BootstrapAccessSheet', 'Stage 7.2')
]);

const STAGE7_COMPATIBILITY_MAP_ = Object.freeze([
  {
    name: 'getMonthsList',
    replacement: 'apiStage7GetMonthsList()',
    scope: 'SidebarServer.gs',
    status: 'compatibility-only',
    uiAllowed: false,
    risk: 'medium',
    sunset: 'remove after all external sidebar callers are migrated',
    verifySourceToken: 'apiStage7GetMonthsList'
  },
  {
    name: 'getSidebarData',
    replacement: 'apiStage7GetSidebarData(dateStr)',
    scope: 'SidebarServer.gs',
    status: 'compatibility-only',
    uiAllowed: false,
    risk: 'medium',
    sunset: 'remove after all external sidebar callers are migrated',
    verifySourceToken: 'apiStage7GetSidebarData'
  },
  {
    name: 'generateSendPanelSidebar',
    replacement: 'apiGenerateSendPanelForDate(options)',
    scope: 'SidebarServer.gs',
    status: 'compatibility-only',
    uiAllowed: false,
    risk: 'medium',
    sunset: 'remove after all external sidebar callers are migrated',
    verifySourceToken: 'apiGenerateSendPanelForDate'
  },
  {
    name: 'getSendPanelSidebarData',
    replacement: 'apiStage7GetSendPanelData()',
    scope: 'SidebarServer.gs',
    status: 'compatibility-only',
    uiAllowed: false,
    risk: 'medium',
    sunset: 'remove after all external sidebar callers are migrated',
    verifySourceToken: 'apiStage7GetSendPanelData'
  },
  {
    name: 'getDaySummaryByDate',
    replacement: 'apiBuildDaySummary(dateStr)',
    scope: 'SidebarServer.gs',
    status: 'compatibility-only',
    uiAllowed: false,
    risk: 'medium',
    sunset: 'remove after all external sidebar callers are migrated',
    verifySourceToken: 'apiBuildDaySummary'
  },
  {
    name: 'getDetailedDaySummaryByDate',
    replacement: 'apiBuildDetailedSummary(dateStr)',
    scope: 'SidebarServer.gs',
    status: 'compatibility-only',
    uiAllowed: false,
    risk: 'medium',
    sunset: 'remove after all external sidebar callers are migrated',
    verifySourceToken: 'apiBuildDetailedSummary'
  },
  {
    name: 'checkVacationsAndNotifySidebar',
    replacement: 'apiCheckVacationsAndBirthdays(dateStr)',
    scope: 'SidebarServer.gs',
    status: 'compatibility-only',
    uiAllowed: false,
    risk: 'medium',
    sunset: 'remove after all external sidebar callers are migrated',
    verifySourceToken: 'apiCheckVacationsAndBirthdays'
  },
  {
    name: 'createNextMonthSheetSidebar',
    replacement: 'apiStage7CreateNextMonth({ switchToNewMonth: true })',
    scope: 'SidebarServer.gs',
    status: 'compatibility-only',
    uiAllowed: false,
    risk: 'medium',
    sunset: 'remove after all external sidebar callers are migrated',
    verifySourceToken: 'apiStage7CreateNextMonth'
  },
  {
    name: 'switchBotToMonthSidebar',
    replacement: 'apiStage7SwitchBotToMonth(monthSheetName)',
    scope: 'SidebarServer.gs',
    status: 'compatibility-only',
    uiAllowed: false,
    risk: 'medium',
    sunset: 'remove after all external sidebar callers are migrated',
    verifySourceToken: 'apiStage7SwitchBotToMonth'
  },
  {
    name: 'markMultipleAsSentFromSidebar',
    replacement: 'apiMarkPanelRowsAsSent(rowNumbers, opts)',
    scope: 'SidebarServer.gs',
    status: 'compatibility-only',
    uiAllowed: false,
    risk: 'medium',
    sunset: 'remove after all external sidebar callers are migrated',
    verifySourceToken: 'apiMarkPanelRowsAsSent'
  },
  {
    name: 'markMultipleAsUnsentFromSidebar',
    replacement: 'apiMarkPanelRowsAsUnsent(rowNumbers, opts)',
    scope: 'SidebarServer.gs',
    status: 'compatibility-only',
    uiAllowed: false,
    risk: 'medium',
    sunset: 'remove after all external sidebar callers are migrated',
    verifySourceToken: 'apiMarkPanelRowsAsUnsent'
  },
  {
    name: 'apiGetMonthsList',
    replacement: 'apiStage7GetMonthsList()',
    scope: 'removed Stage7 legacy api',
    status: 'legacy-api-wrapper',
    uiAllowed: false,
    risk: 'medium',
    sunset: 'remove after all stage 7 callers are migrated',
    verifySourceToken: 'apiStage7GetMonthsList'
  },
  {
    name: 'apiGetSidebarData',
    replacement: 'apiStage7GetSidebarData(dateStr)',
    scope: 'removed Stage7 legacy api',
    status: 'legacy-api-wrapper',
    uiAllowed: false,
    risk: 'medium',
    sunset: 'remove after all stage 7 callers are migrated',
    verifySourceToken: 'loadCalendarDay'
  },
  {
    name: 'apiGenerateSendPanel',
    replacement: 'apiGenerateSendPanelForDate(options)',
    scope: 'removed Stage7 legacy api',
    status: 'legacy-api-wrapper',
    uiAllowed: false,
    risk: 'medium',
    sunset: 'remove after all stage 7 callers are migrated',
    verifySourceToken: 'generateSendPanelForDate'
  },
  {
    name: 'apiGetSendPanelData',
    replacement: 'apiStage7GetSendPanelData()',
    scope: 'removed Stage7 legacy api',
    status: 'legacy-api-wrapper',
    uiAllowed: false,
    risk: 'medium',
    sunset: 'remove after all stage 7 callers are migrated',
    verifySourceToken: 'SendPanelRepository_.readRows'
  },
  {
    name: 'apiMarkSendPanelRowsAsSent',
    replacement: 'apiMarkPanelRowsAsSent(rowNumbers, options)',
    scope: 'removed Stage7 legacy api',
    status: 'legacy-api-wrapper',
    uiAllowed: false,
    risk: 'medium',
    sunset: 'remove after all stage 7 callers are migrated',
    verifySourceToken: 'markPanelRowsAsSent'
  },
  {
    name: 'apiGetDaySummary',
    replacement: 'apiBuildDaySummary(dateStr)',
    scope: 'removed Stage7 legacy api',
    status: 'legacy-api-wrapper',
    uiAllowed: false,
    risk: 'medium',
    sunset: 'remove after all stage 7 callers are migrated',
    verifySourceToken: 'buildDaySummary'
  },
  {
    name: 'apiGetDetailedDaySummary',
    replacement: 'apiBuildDetailedSummary(dateStr)',
    scope: 'removed Stage7 legacy api',
    status: 'legacy-api-wrapper',
    uiAllowed: false,
    risk: 'medium',
    sunset: 'remove after all stage 7 callers are migrated',
    verifySourceToken: 'buildDetailedSummary'
  },
  {
    name: 'apiCheckVacations',
    replacement: 'apiCheckVacationsAndBirthdays(dateStr)',
    scope: 'removed Stage7 legacy api',
    status: 'legacy-api-wrapper',
    uiAllowed: false,
    risk: 'medium',
    sunset: 'remove after all stage 7 callers are migrated',
    verifySourceToken: 'checkVacationsAndBirthdays'
  },
  {
    name: 'apiGetBirthdays',
    replacement: 'apiCheckVacationsAndBirthdays(dateStr)',
    scope: 'removed Stage7 legacy api',
    status: 'legacy-api-wrapper',
    uiAllowed: false,
    risk: 'medium',
    sunset: 'remove after all stage 7 callers are migrated',
    verifySourceToken: 'checkVacationsAndBirthdays'
  },
  {
    name: 'apiBuildBirthdayLink',
    replacement: 'apiStage4BuildBirthdayLink(phone, name)',
    scope: 'removed Stage7 legacy api',
    status: 'legacy-api-wrapper',
    uiAllowed: false,
    risk: 'medium',
    sunset: 'remove after card UI is fully Stage 7 only',
    verifySourceToken: 'apiStage4BuildBirthdayLink'
  },
  {
    name: 'apiGetPersonCardData',
    replacement: 'apiOpenPersonCard(callsign, dateStr)',
    scope: 'removed Stage7 legacy api',
    status: 'legacy-api-wrapper',
    uiAllowed: false,
    risk: 'medium',
    sunset: 'remove after all stage 7 callers are migrated',
    verifySourceToken: 'openPersonCard'
  },
  {
    name: 'apiSwitchBotToMonth',
    replacement: 'apiStage7SwitchBotToMonth(monthSheetName)',
    scope: 'removed Stage7 legacy api',
    status: 'legacy-api-wrapper',
    uiAllowed: false,
    risk: 'medium',
    sunset: 'remove after all stage 7 callers are migrated',
    verifySourceToken: 'validateMonthSwitch_'
  },
  {
    name: 'apiCreateNextMonth',
    replacement: 'apiStage7CreateNextMonth(options)',
    scope: 'removed Stage7 legacy api',
    status: 'legacy-api-wrapper',
    uiAllowed: false,
    risk: 'medium',
    sunset: 'remove after all stage 7 callers are migrated',
    verifySourceToken: 'createNextMonth'
  },
  {
    name: 'apiSetupVacationTriggers',
    replacement: 'apiStage4SetupVacationTriggers()',
    scope: 'removed Stage7 legacy api',
    status: 'legacy-api-wrapper',
    uiAllowed: false,
    risk: 'medium',
    sunset: 'remove after all legacy maintenance callers are migrated',
    verifySourceToken: 'apiStage4SetupVacationTriggers'
  },
  {
    name: 'apiCleanupDuplicateTriggers',
    replacement: 'apiStage4CleanupDuplicateTriggers(functionName)',
    scope: 'removed Stage7 legacy api',
    status: 'legacy-api-wrapper',
    uiAllowed: false,
    risk: 'medium',
    sunset: 'remove after all legacy maintenance callers are migrated',
    verifySourceToken: 'apiStage4CleanupDuplicateTriggers'
  },
  {
    name: 'apiDebugPhones',
    replacement: 'apiStage4DebugPhones()',
    scope: 'removed Stage7 legacy api',
    status: 'legacy-api-wrapper',
    uiAllowed: false,
    risk: 'medium',
    sunset: 'remove after all legacy maintenance callers are migrated',
    verifySourceToken: 'apiStage4DebugPhones'
  },
  {
    name: 'apiClearCache',
    replacement: 'apiStage4ClearCache()',
    scope: 'removed Stage7 legacy api',
    status: 'legacy-api-wrapper',
    uiAllowed: false,
    risk: 'medium',
    sunset: 'remove after all legacy maintenance callers are migrated',
    verifySourceToken: 'apiStage4ClearCache'
  },
  {
    name: 'apiClearPhoneCache',
    replacement: 'apiStage4ClearPhoneCache()',
    scope: 'removed Stage7 legacy api',
    status: 'legacy-api-wrapper',
    uiAllowed: false,
    risk: 'medium',
    sunset: 'remove after all legacy maintenance callers are migrated',
    verifySourceToken: 'apiStage4ClearPhoneCache'
  },
  {
    name: 'apiClearLog',
    replacement: 'apiStage4ClearLog()',
    scope: 'removed Stage7 legacy api',
    status: 'legacy-api-wrapper',
    uiAllowed: false,
    risk: 'medium',
    sunset: 'remove after all legacy maintenance callers are migrated',
    verifySourceToken: 'apiStage4ClearLog'
  },
  {
    name: 'apiHealthCheck',
    replacement: 'apiStage4HealthCheck(options)',
    scope: 'removed Stage7 legacy api',
    status: 'legacy-api-wrapper',
    uiAllowed: false,
    risk: 'medium',
    sunset: 'remove after all legacy maintenance callers are migrated',
    verifySourceToken: 'apiStage4HealthCheck'
  },
  {
    name: 'apiRunRegressionTests',
    replacement: 'apiRunStage4RegressionTests(options)',
    scope: 'removed Stage7 legacy api',
    status: 'legacy-api-wrapper',
    uiAllowed: false,
    risk: 'medium',
    sunset: 'remove after all legacy maintenance callers are migrated',
    verifySourceToken: 'apiRunStage4RegressionTests'
  },
  {
    name: '_parseUaDate_',
    replacement: 'DateUtils_.parseUaDate()',
    scope: 'shared helpers',
    status: 'deprecated-helper-wrapper',
    uiAllowed: false,
    risk: 'low',
    sunset: 'remove after full helper cleanup'
  },
  {
    name: 'normalizeDate_',
    replacement: 'DateUtils_.normalizeDate()',
    scope: 'shared helpers',
    status: 'deprecated-helper-wrapper',
    uiAllowed: false,
    risk: 'low',
    sunset: 'remove after full helper cleanup'
  },
  {
    name: '_parseDate_',
    replacement: 'DateUtils_.parseDateAny() / _veParseDate_()',
    scope: 'shared helpers',
    status: 'deprecated-helper-wrapper',
    uiAllowed: false,
    risk: 'low',
    sunset: 'remove after full helper cleanup'
  },
  {
    name: 'escapeHtml_',
    replacement: 'HtmlUtils_.escapeHtml()',
    scope: 'shared helpers',
    status: 'deprecated-helper-wrapper',
    uiAllowed: false,
    risk: 'low',
    sunset: 'remove after full helper cleanup'
  },
  {
    name: '_escapeHtml_',
    replacement: 'HtmlUtils_.escapeHtml()',
    scope: 'shared helpers',
    status: 'deprecated-helper-wrapper',
    uiAllowed: false,
    risk: 'low',
    sunset: 'remove after full helper cleanup'
  }
]);

function _stage7EnrichCompatibilityRecord_(item) {
  const record = Object.assign({}, item || {});
  const status = String(record.status || '').trim() || 'compatibility-only';

  const usageScope = record.scope && String(record.scope).indexOf('Sidebar') !== -1
    ? 'legacy sidebar'
    : record.scope && String(record.scope).indexOf('Stage7') !== -1
      ? 'legacy api'
      : record.uiAllowed
        ? 'spreadsheet ui'
        : 'manual editor run';

  let sunsetStatus = 'sunset planned';
  if (status === 'canonical') sunsetStatus = 'canonical';
  else if (status === 'compatibility-only') sunsetStatus = 'compatibility-only';
  else if (status === 'legacy-api-wrapper') sunsetStatus = 'historical';
  else if (status.indexOf('deprecated') !== -1) sunsetStatus = 'deprecated';

  return Object.assign(record, {
    migrationStatus: record.migrationStatus || (sunsetStatus === 'canonical' ? 'migrated' : 'pending'),
    usageScope: record.usageScope || usageScope,
    sunsetStatus: record.sunsetStatus || sunsetStatus,
    removalCondition: record.removalCondition || record.sunset || '',
    removableAfterMigration: record.removableAfterMigration === true || sunsetStatus === 'deprecated'
  });
}

function getDeprecatedRegistry_() {
  return STAGE7_COMPATIBILITY_MAP_.concat(STAGE7_MAINTENANCE_WRAPPER_MAP_).map(_stage7EnrichCompatibilityRecord_);
}

function getStage4CompatibilityMap_() {
  return getDeprecatedRegistry_();
}

function getCompatibilitySunsetReport_() {
  const items = getDeprecatedRegistry_();
  const counts = {};

  items.forEach(function(item) {
    const key = item.sunsetStatus || 'unknown';
    counts[key] = (counts[key] || 0) + 1;
  });

  return {
    total: items.length,
    counts: counts,
    missingSunsetMarkers: items.filter(function(item) {
      return !String(item.removalCondition || '').trim();
    }).length,
    items: items
  };
}
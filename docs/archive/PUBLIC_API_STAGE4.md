# PUBLIC API — Stage 4.2

> Historical/reference document. The active canonical public API document is `PUBLIC_API_STAGE5.md`.

## Canonical application API

### Read / UI bootstrap
- `apiStage4GetMonthsList()`
- `apiStage4GetSidebarData(dateStr)`
- `apiStage4GetSendPanelData()`
- `apiLoadCalendarDay(dateStr)`

### SEND_PANEL scenarios
- `apiGenerateSendPanelForDate(options)`
- `apiGenerateSendPanelForRange(options)`
- `apiMarkPanelRowsAsSent(rowNumbers, options)`
- `apiMarkPanelRowsAsUnsent(rowNumbers, options)`
- `apiSendPendingRows(options)`

### Summary / card scenarios
- `apiBuildDaySummary(dateStr)`
- `apiBuildDetailedSummary(dateStr)`
- `apiOpenPersonCard(callsign, dateStr)`
- `apiCheckVacationsAndBirthdays(dateStr)`

### Month / reconciliation scenarios
- `apiStage4SwitchBotToMonth(monthSheetName)`
- `apiCreateNextMonthStage4(options)`
- `apiRunReconciliation(options)`

## Canonical maintenance / admin API

### Cache / log / utility operations
- `apiStage4ClearCache()`
- `apiStage4ClearLog()`
- `apiStage4ClearPhoneCache()`
- `apiStage4DebugPhones()`
- `apiStage4BuildBirthdayLink(phone, name)`

### Trigger / job operations
- `apiStage4SetupVacationTriggers()`
- `apiStage4CleanupDuplicateTriggers(functionName)`
- `apiInstallStage4Jobs()`
- `apiListStage4Jobs()`
- `apiRunStage4Job(jobName, options)`

### Diagnostics / regression / maintenance orchestration
- `apiRunMaintenanceScenario(options)`
- `apiStage4HealthCheck(options)`
- `apiRunStage4RegressionTests(options)`

## Compatibility wrappers

### Sidebar compatibility layer (`SidebarServer.gs`)
- `getMonthsList`
- `getSidebarData`
- `generateSendPanelSidebar`
- `getSendPanelSidebarData`
- `getDaySummaryByDate`
- `getDetailedDaySummaryByDate`
- `checkVacationsAndNotifySidebar`
- `createNextMonthSheetSidebar`
- `switchBotToMonthSidebar`
- `markMultipleAsSentFromSidebar`
- `markMultipleAsUnsentFromSidebar`

### Stage 3 facade compatibility (`Stage3ServerApi.gs`)
Старые публичные имена сохранены только как legacy wrappers.
Они не считаются каноническими и должны вести в Stage 4.2 replacements, перечисленные в `DeprecatedRegistry.gs`.

## Что не считать каноном

- прямые вызовы stage 3 utility entrypoints из UI;
- новая бизнес-логика в `SidebarServer.gs`;
- параллельные public entrypoints для одной операции без compatibility-статуса;
- новые helper duplicate implementations.

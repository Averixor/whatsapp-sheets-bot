# PUBLIC API — Stage 5 Canonical API within Stage 6 Final

This is the **canonical reference API document** for the current release.

Release stage:
- **release label:** `Stage 6 Final`
- **functional API lineage:** `Stage 5 Final RC2`
- **hardening overlay:** `Stage 6A`

The API names remain Stage 4 / Stage 5–oriented by design.  
The release identity is Stage 6 Final.

## 1. Sidebar / operational application API
The stable sidebar / operational surface remains in `Stage4ServerApi.gs`.

Key routes:
- `apiStage4GetMonthsList()`
- `apiStage4GetSidebarData(dateStr)`
- `apiStage4GetSendPanelData()`
- `apiGenerateSendPanelForDate(options)`
- `apiGenerateSendPanelForRange(options)`
- `apiMarkPanelRowsAsSent(rowNumbers, options)`
- `apiMarkPanelRowsAsUnsent(rowNumbers, options)`
- `apiSendPendingRows(options)`
- `apiBuildDaySummary(dateStr)`
- `apiBuildDetailedSummary(dateStr)`
- `apiOpenPersonCard(callsign, dateStr)`
- `apiCheckVacationsAndBirthdays(dateStr)`
- `apiStage4SwitchBotToMonth(monthSheetName)`
- `apiCreateNextMonthStage4(options)`
- `apiRunReconciliation(options)`

## 2. Spreadsheet / manual action API
Canonical file: `SpreadsheetActionsApi.gs`

- `apiPreviewSelectionMessage(options)`
- `apiPreviewMultipleMessages(options)`
- `apiPreviewGroupedMessages(options)`
- `apiPrepareRangeMessages(options)`
- `apiBuildCommanderSummaryPreview(options)`
- `apiBuildCommanderSummaryLink(options)`
- `apiLogPreparedMessages(options)`
- `apiRunSelectionDiagnostics(options)`

## 3. Canonical maintenance / diagnostics / jobs API
Canonical file: `Stage5MaintenanceApi.gs`

- `apiStage5ClearCache()`
- `apiStage5ClearLog()`
- `apiStage5ClearPhoneCache()`
- `apiStage5SetupVacationTriggers()`
- `apiStage5CleanupDuplicateTriggers(functionName)`
- `apiStage5DebugPhones()`
- `apiStage5BuildBirthdayLink(phone, name)`
- `apiRunStage5MaintenanceScenario(options)`
- `apiInstallStage5Jobs()`
- `apiListStage5Jobs()`
- `apiRunStage5Job(jobName, options)`
- `apiStage5HealthCheck(options)`
- `apiRunStage5Diagnostics(options)`
- `apiRunStage5RegressionTests(options)`
- `apiListStage5JobRuntime()`

## 4. Active client runtime policy
The active sidebar runtime policy in this release is:
- `Sidebar.html` loads `JavaScript.html` via `includeTemplate('JavaScript')`
- `JavaScript.html` is the canonical active runtime script
- `Js.*.html` files remain non-active reference artifacts

## 5. Unified response contract
Canonical routes return:
- `success`
- `message`
- `error`
- `data.result`
- `data.meta`
- `context`
- `warnings`

### Stage 6A safety mirror for critical writes
Critical write routes also mirror selected safety fields at the top level:
- `operationId`
- `scenario`
- `dryRun`
- `affectedSheets`
- `affectedEntities`
- `appliedChangesCount`
- `skippedChangesCount`
- `partial`
- `retrySafe`
- `lockUsed`
- `lockRequired`

## 6. Compatibility policy
- `Stage4MaintenanceApi.gs` is compatibility-only
- historical wrappers remain preserved
- compatibility wrappers must stay thin
- release wording and metadata worldview remain Stage 6 Final–aligned even through compatibility paths

## 7. Documentation map for this release

### Active root docs
- `README.md`
- `ARCHITECTURE.md`
- `RUNBOOK.md`
- `STAGE6_FINAL_REPORT.md`

### Canonical reference docs
- `docs/reference/PUBLIC_API_STAGE5.md`
- `docs/reference/CHANGELOG_STAGE5.md`
- `docs/reference/STAGE5_REPORT.md`
- `docs/reference/STAGE6A_REPORT.md`

### Historical docs
- `docs/archive/*`

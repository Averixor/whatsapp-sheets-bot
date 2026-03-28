# Canonical APIs / services

## Public/canonical APIs
- `apiStage4GetMonthsList`
- `apiStage4GetSidebarData`
- `apiGenerateSendPanelForDate`
- `apiGenerateSendPanelForRange`
- `apiMarkPanelRowsAsSent`
- `apiMarkPanelRowsAsUnsent`
- `apiSendPendingRows`
- `apiBuildDaySummary`
- `apiBuildDetailedSummary`
- `apiOpenPersonCard`
- `apiCheckVacationsAndBirthdays`
- `apiStage4SwitchBotToMonth`
- `apiCreateNextMonthStage4`
- `apiRunReconciliation`
- `apiStage5ClearCache`
- `apiStage5ClearLog`
- `apiStage5ClearPhoneCache`
- `apiStage5SetupVacationTriggers`
- `apiStage5CleanupDuplicateTriggers`
- `apiStage5DebugPhones`
- `apiStage5HealthCheck`
- `apiRunStage5Diagnostics`
- `apiRunStage5RegressionTests`

## Canonical internal services
- `loadPhonesProfiles_()`
- `findPhone_()`
- `findPhoneProfile_()`
- `buildPayloadForCell_({ sheet, row, col, phonesMap, dictMap })`
- `DictionaryRepository_` accessors
- `PersonsRepository_` accessors

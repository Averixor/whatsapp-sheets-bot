# Stage 4.2 report

> Historical/reference document. The active report is `STAGE5_REPORT.md`.

## Что стало canonical

### Application API
- `Stage4ServerApi.gs`
- прикладные entrypoints Stage 4.2 для sidebar / SEND_PANEL / сводок / карточек / месяца / reconciliation

### Maintenance / admin API
- `Stage4MaintenanceApi.gs`
- cache / log / phone cache cleanup
- trigger setup / duplicate cleanup
- debug utilities
- jobs
- diagnostics / regression / maintenance orchestration

### Client routing
- `Stage4Api` — только application path
- `MaintenanceApi` / `DiagnosticsApi` — только service path
- `ActionDispatcher` — единый launcher
- `RenderCoordinator` — канонический post-operation sync coordinator

## Какие service entrypoints нормализованы

- `apiClearCache` → `apiStage4ClearCache`
- `apiClearLog` → `apiStage4ClearLog`
- `apiClearPhoneCache` → `apiStage4ClearPhoneCache`
- `apiSetupVacationTriggers` → `apiStage4SetupVacationTriggers`
- `apiCleanupDuplicateTriggers` → `apiStage4CleanupDuplicateTriggers`
- `apiDebugPhones` → `apiStage4DebugPhones`
- `apiBuildBirthdayLink` → `apiStage4BuildBirthdayLink`

## Какие compatibility wrappers сохранены

### Sidebar compatibility
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

### Stage 3 facade compatibility
Старые `api*` entrypoints оставлены только как legacy bridge и должны вести в canonical Stage 4.2 replacements.

## Что усилено

- metadata и docs hierarchy
- diagnostics под canonical layers / routing / compatibility policy
- regression suite под реальные Stage 4.2 contracts
- GAS-first эксплуатационная пригодность без обязательного внешнего toolchain

## Что сознательно не трогалось

- предметная логика отпусков / карточек / сводок / SEND_PANEL
- радикальный редизайн UI
- миграция на внешний backend
- обязательный `clasp` workflow

## Итог

Проект доведён до состояния Stage 4.2 canonical GAS-base:
- application и maintenance маршруты разделены;
- compatibility layer сжат и каталогизирован;
- diagnostics, tests и docs соответствуют фактической архитектуре;
- дальнейшие доработки можно добавлять без возврата к utility-хаосу.

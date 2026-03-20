# CHANGELOG — Stage 4.2

> Historical/reference document. The active changelog is `CHANGELOG_STAGE5.md`.

## Added
- `Stage4MaintenanceApi.gs` как отдельный canonical maintenance/admin layer
- Stage 4.2 metadata markers в `ProjectMetadata.gs`
- compatibility registry / policy map в `DeprecatedRegistry.gs`
- Stage 4.2 diagnostics modes:
  - `runStage42QuickDiagnostics_()`
  - `runStage42StructuralDiagnostics_()`
  - `runStage42CompatibilityDiagnostics_()`
  - `runStage42FullDiagnostics_()`
- `STAGE4_2_REPORT.md`

## Changed
- `JavaScript.html` разделён на `Stage4Api` и `MaintenanceApi`
- сервисные UI-действия переведены с stage 3 utility entrypoints на Stage 4.2 maintenance routes
- `Stage4ServerApi.gs` закреплён только за application scenarios
- `UseCases.gs` расширен maintenance scenario catalog без изменения предметной логики
- `Stage3ServerApi.gs` дополнительно ужат до legacy wrappers для maintenance / diagnostics
- `Diagnostics.gs` и `SmokeTests.gs` выровнены под Stage 4.2 architecture map

## Hardened
- compatibility layer зафиксирован как compatibility-only
- helper source-of-truth формализован в metadata и diagnostics
- routing policy, maintenance policy и docs hierarchy описаны как явные правила сопровождения

## Not changed on purpose
- бизнес-логика отпусков, карточек, сводок и SEND_PANEL
- радикальный редизайн sidebar / календаря / SEND_PANEL
- миграция на внешний backend
- обязательный переход на TypeScript / React / Vue / build system

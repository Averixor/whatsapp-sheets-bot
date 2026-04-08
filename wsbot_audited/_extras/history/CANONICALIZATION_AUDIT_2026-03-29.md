# Canonicalization audit

Base: 30.zip
Goal: turn Stage 7 into the only canonical API layer and move legacy Stage 4/5 names into compatibility wrappers.

## What changed
- Stage7ServerApi.gs now exposes only canonical Stage 7 application entrypoints.
- Stage7MaintenanceApi.gs now exposes only canonical Stage 7 maintenance entrypoints.
- Added Stage7CompatibilityApi.gs for old application aliases.
- Stage7CompatibilityMaintenanceApi.gs now maps Stage 4 and Stage 5 maintenance names to Stage 7.
- ServiceSheetsBootstrap.gs now exposes canonical `apiStage7BootstrapRuntimeAndAlertsSheets()`.
- Stage7Config.gs rebuilt so `APP_CONFIG` is source of truth and `STAGE7_CONFIG` is a flattened canonical runtime config.
- Routing registry, metadata, smoke tests, sidebar wrappers and JS client now point to Stage 7 names.

## Intent
Keep runtime behavior as close as possible to archive 30, but remove false canonicality where Stage 7 files were still advertising Stage 4 / Stage 5 entrypoints as primary.

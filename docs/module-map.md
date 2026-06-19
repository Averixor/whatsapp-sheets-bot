# Module map

Practical index: **where to look** and **what CI proves it**. Structural rules: [ADR-002](./adr/002-domain-folder-map.md). Mechanical change rules: [ADR-001](./adr/001-structural-changes.md).

| Domain | Folder | Main files | CI / verification | Notes |
| ------ | ------ | ---------- | ----------------- | ----- |
| Reports | `reports/` | `Report_*.gs`, `Summaries.gs`, `Summary*.gs`, `MonthlyReport.gs` | `npm run ci`, `npm run ci:workbook` | |
| Vacations | `vacations/` | `Vacation*.gs` (11 modules) | `npm run ci:vacations` | Vacation HTML compatibility shell lives in `ui/`. |
| Send panel | `sendpanel/` | `SendPanel*.gs`, `SelectionActionService.gs`, `UseCases.SendPanel.gs`, `Stage7PhoneDictPayloadShims.gs` | `npm run ci`, `npm run ci:recipients` | |
| Maintenance / formats | `maintenance/` | `ConditionalFormat*.gs`, `JobRuntime*.gs`, `Template*.gs`, `LifecycleRetention.gs` | `npm run ci:format-rules` | Sheet self-heal lives in `sheets/`. |
| Diagnostics | `diagnostics/` | `Diagnostics.*.gs` (runtime) | `npm run ci` | `tests/Diagnostics.Debug.gs` — clasp-excluded. |
| Access | `access/` | `AccessControl.*.gs`, `AccessEnforcement.gs`, autofill hotfix | `npm run ci` (access-api governance) | Move-only in structural PRs. |
| Personnel | `personnel/` | `PersonnelRepository.gs`, `PersonsRepository.gs`, `PersonCards.gs`, `AlertsRepository.gs` | `npm run ci`, personnel contracts | Callsign/Status — workspace rules. |
| API entrypoints | `api/` | `Stage7ServerApi.gs`, `Stage7MaintenanceApi.gs`, `SpreadsheetActionsApi.gs` | `npm run ci` | Public `api*` surface and spreadsheet actions. |
| Core runtime | `core/` | `Code.gs`, `Stage7Config.gs`, `ProjectMetadata.gs`, shared helpers | `npm run ci` | Cross-cutting GAS globals, routing, config, responses. |
| Data repositories | `data/` | `DataAccess.gs`, `DictionaryRepository.gs`, `LogsRepository.gs`, `OperationRepository.gs` | `npm run ci` | Shared repository/data access helpers. |
| Sheet/workbook | `sheets/` | `Sheet*.gs`, `MonthSheets.gs`, validation/protection/self-heal | `npm run ci:workbook` | Workbook schema, month sheets, protections. |
| Use cases | `usecases/` | `UseCases*.gs` | `npm run ci`, `npm run ci:workbook` | Application facade and domain use-case modules. |
| UI server helpers | `ui-server/` | `SidebarServer.gs`, dialogs, `HtmlUtils.gs` | `npm run ci:client` | HtmlService server-side host/helpers. |
| Security/audit | `security/` | `AuditTrail.gs`, `SecurityRedaction.gs` | `npm run ci` | Audit and redaction utilities. |
| Operations | `operations/` | `Actions.gs`, triggers, reconciliation, project requests | `npm run ci` | Operational workflows outside one domain. |
| Production smoke | `smoke/` | `SmokeTests.gs`, `SmokeTests.Helpers.gs` | `npm run ci`, remote smoke | Production smoke entrypoints included in clasp push. |
| Tests (local) | `tests/` | `Stage7TestRunner*.gs`, `*Tests.gs`, `GasRuntimeSmoke.gs` | `npm run ci` | **Clasp-excluded** per-file under `tests/`. |
| UI (HTML/JS) | `ui/` | `Sidebar.html`, `JavaScript.html`, `Js.*.html`, `Styles*.html` | `npm run ci:client` | Phase 3 complete — `include()` resolves legacy basenames. |

## Root stays non-runtime only

Repository metadata and tooling config stay at root: `appsscript.json`, `package.json`, `.claspignore`, docs index files, and similar non-runtime files. GAS runtime files (`.gs`, `.html`) live in purpose-named folders.

## Clasp push reminder

Nested files: `!**/*.gs`, `!**/*.html`, then re-exclude `node_modules/**`, `.git/**`, `_backup*/**`, and local test paths under `tests/`. Run `npx clasp status` before production push.

# Module map

Practical index: **where to look** and **what CI proves it**. Structural rules: [ADR-003](./adr/003-working-domain-layout.md) (working layout), [ADR-002](./adr/002-domain-folder-map.md) (phased history), [ADR-001](./adr/001-structural-changes.md) (mechanical moves).

| Domain | Folder | Main files | CI / verification | Notes |
| ------ | ------ | ---------- | ----------------- | ----- |
| Reports | `reports/` | `Report_*.gs`, `Summaries.gs`, `Summary*.gs`, `MonthlyReport.gs`, `MonthJournalMaterialize.gs` | `npm run ci`, `npm run ci:workbook`, `npm run ci:materialize` | Includes daily summaries and derived month journal sheets. |
| Vacations | `vacations/` | `Vacation*.gs` | `npm run ci:vacations` | Vacation UI partials live in `ui/Js.Vacations.*.html`; monthly sync in `VacationMonthlySync.gs`. |
| Inventory | `inventory/` | `InventoryReconciliation.gs` | `npm run ci` (access-api, client includes, oauth scopes) | Sidebar **Звірка**; sheets `INVENTORY_RECONCILIATION` / `INVENTORY_RECONCILIATION_FILES`. |
| Send panel | `sendpanel/` | `SendPanel*.gs`, `SelectionActionService.gs`, `UseCases.SendPanel.gs`, `Stage7PhoneDictPayloadShims.gs` | `npm run ci`, `npm run ci:recipients` | |
| Maintenance / formats | `maintenance/` | `ConditionalFormat*.gs`, `JobRuntime*.gs`, `Template*.gs`, `LifecycleRetention.gs` | `npm run ci:format-rules` | Sheet self-heal lives in `sheets/`. |
| Diagnostics | `diagnostics/` | `Diagnostics.*.gs` (runtime) | `npm run ci` | `tests/Diagnostics.Debug.gs` — clasp-excluded. |
| Access | `access/` | `AccessControl.*.gs`, `AccessEnforcement.gs`, autofill hotfix | `npm run ci` (access-api governance) | Move-only in structural PRs. |
| Personnel | `personnel/` | `PersonnelRepository.gs`, `PersonsRepository.gs`, `PersonCards.gs`, `AlertsRepository.gs` | `npm run ci`, personnel contracts | Callsign/Status — workspace rules; `Status` header self-heal lives here. |
| API entrypoints | `api/` | `Stage7ServerApi.gs`, `Stage7MaintenanceApi.gs`, `SpreadsheetActionsApi.gs` | `npm run ci` | Public `api*` surface and spreadsheet actions. |
| Core runtime | `core/` | `Code.gs`, `Stage7Config.gs`, `ProjectMetadata.gs`, shared helpers | `npm run ci` | Cross-cutting GAS globals, routing, config, responses. |
| Data repositories | `data/` | `DataAccess.gs`, `DictionaryRepository.gs`, `LogsRepository.gs`, `OperationRepository.gs` | `npm run ci`, `npm run ci:workbook` | `ReferenceSheetsRepository_` in `DictionaryRepository.gs` owns `PHONE_DIRECTORY` / `CAR` / `WEAPON`. |
| Sheet/workbook | `sheets/` | `Sheet*.gs`, `MonthSheets.gs`, validation/protection/self-heal | `npm run ci:workbook` | Workbook schema, month sheets, protections. |
| Use cases | `usecases/` | `UseCases*.gs` | `npm run ci`, `npm run ci:workbook` | Application facade and domain use-case modules. |
| UI server helpers | `ui-server/` | `SidebarServer.gs`, dialogs, `HtmlUtils.gs` | `npm run ci:client` | HtmlService server-side host/helpers. |
| Security/audit | `security/` | `AuditTrail.gs`, `SecurityRedaction.gs` | `npm run ci` | Audit and redaction utilities. |
| Operations | `operations/` | `Actions.gs`, triggers, reconciliation, project requests | `npm run ci` | Operational workflows outside one domain. |
| UI (HTML/JS) | `ui/` | `Sidebar.html`, `JavaScript.html`, `Js.*.html`, `Styles*.html` | `npm run ci:client`, `verify-user-facing-copy.mjs` | Phases 1–4 complete (#34); `include()` resolves legacy basenames. |

## Root stays non-runtime only

Repository metadata and tooling config stay at root: `appsscript.json`, `package.json`, `.claspignore`, docs index files, and similar non-runtime files. GAS runtime files (`.gs`, `.html`) live in purpose-named folders.

## Clasp push reminder

Nested files: `!**/*.gs`, `!**/*.html`, then re-exclude `node_modules/**`, `.git/**`, `_backup*/**`, and local test paths under `tests/`. Run `npx clasp status` before production push.

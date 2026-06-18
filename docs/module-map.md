# Module map

Practical index: **where to look** and **what CI proves it**. Structural rules: [ADR-002](./adr/002-domain-folder-map.md). Mechanical change rules: [ADR-001](./adr/001-structural-changes.md).

| Domain | Folder | Main files | CI / verification | Notes |
| ------ | ------ | ---------- | ----------------- | ----- |
| Reports | `reports/` | `Report_*.gs`, `Summaries.gs`, `Summary*.gs`, `MonthlyReport.gs` | `npm run ci`, `npm run ci:workbook` | Daily summaries + summary services. |
| Vacations | `vacations/` | `Vacation*.gs` (11 modules) | `npm run ci:vacations` | `Js.Vacations.html`, `VacationSidebar.html` stay root until `ui/` phase. |
| Send panel | `sendpanel/` | `SendPanel*.gs`, `SelectionActionService.gs`, `UseCases.SendPanel.gs`, `Stage7PhoneDictPayloadShims.gs` | `npm run ci`, `npm run ci:recipients` | |
| Maintenance / formats | `maintenance/` | `ConditionalFormat*.gs`, `SystemSheetsSelfHeal.gs`, `JobRuntime*.gs`, `Template*.gs`, `LifecycleRetention.gs` | `npm run ci:format-rules` | |
| Diagnostics | `diagnostics/` | `Diagnostics.*.gs` (runtime) | `npm run ci` | `tests/Diagnostics.Debug.gs` — clasp-excluded. |
| Access | `access/` | `AccessControl.*.gs`, `AccessEnforcement.gs`, `AccessPolicyChecks.gs`, `AccessSheetTriggers.gs`, autofill hotfix | `npm run ci` (access-api governance) | Move-only; never merge in structural PRs. |
| Personnel | `personnel/` | `PersonnelRepository.gs`, `PersonsRepository.gs`, `PersonCards.gs`, `AlertsRepository.gs` | `npm run ci`, personnel contracts | Callsign/Status semantics — see workspace rules. |
| Tests (local) | `tests/` | `Stage7TestRunner*.gs`, `*Tests.gs`, `SmokeTests*.gs`, `GasRuntimeSmoke.gs` | `npm run ci` (bundle index) | **Clasp-excluded** via `tests/**` in `.claspignore`. |
| UI (HTML/JS) | root → `ui/` (Phase 3) | `Sidebar.html`, `JavaScript.html`, `Js.*.html`, `Styles*.html` | `npm run ci:client`, manual sidebar smoke | Touches `include()` chain and `client-includes.contract.json`. Last phase. |

## Root stays (for now)

Entrypoints and cross-cutting modules remain at root until explicitly mapped: `Code.gs`, `Stage7ServerApi.gs`, `Stage7MaintenanceApi.gs`, `SidebarServer.gs`, `DataAccess.gs`, `Triggers.gs`, `UseCases.gs`, `MonthSheets.gs`, repositories (`DictionaryRepository`, `LogsRepository`, …), etc.

## Clasp push reminder

Nested files require `.claspignore` patterns `!**/*.gs` and `!**/*.html`, then re-exclude `node_modules/**`, `.git/**`, `_backup*/**`, and `tests/**`. Run `npx clasp status` before every production push.

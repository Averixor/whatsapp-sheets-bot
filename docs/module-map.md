# Module map

Practical index: **where to look** and **what CI proves it**. Structural rules: [ADR-002](./adr/002-domain-folder-map.md). Mechanical change rules: [ADR-001](./adr/001-structural-changes.md).

| Domain | Folder | Main files | CI / verification | Notes |
| ------ | ------ | ---------- | ----------------- | ----- |
| Reports | `reports/` | `Report_*.gs`, `Summaries.gs`, `Summary*.gs`, `MonthlyReport.gs` | `npm run ci`, `npm run ci:workbook` | |
| Vacations | `vacations/` | `Vacation*.gs` (11 modules) | `npm run ci:vacations` | HTML stays root until `ui/` phase. |
| Send panel | `sendpanel/` | `SendPanel*.gs`, `SelectionActionService.gs`, `UseCases.SendPanel.gs`, `Stage7PhoneDictPayloadShims.gs` | `npm run ci`, `npm run ci:recipients` | |
| Maintenance / formats | `maintenance/` | `ConditionalFormat*.gs`, `JobRuntime*.gs`, `Template*.gs`, `LifecycleRetention.gs` | `npm run ci:format-rules` | `SystemSheetsSelfHeal.gs` stays **root** (PERSONNEL schema). |
| Diagnostics | `diagnostics/` | `Diagnostics.*.gs` (runtime) | `npm run ci` | `tests/Diagnostics.Debug.gs` — clasp-excluded. |
| Access | `access/` | `AccessControl.*.gs`, `AccessEnforcement.gs`, autofill hotfix | `npm run ci` (access-api governance) | Move-only in structural PRs. |
| Personnel | `personnel/` | `PersonnelRepository.gs`, `PersonsRepository.gs`, `PersonCards.gs`, `AlertsRepository.gs` | `npm run ci`, personnel contracts | Callsign/Status — workspace rules. |
| Tests (local) | `tests/` | `Stage7TestRunner*.gs`, `*Tests.gs`, `GasRuntimeSmoke.gs` | `npm run ci` | **Clasp-excluded** per-file under `tests/`. **`SmokeTests.gs` + `SmokeTests.Helpers.gs` stay root** (production). |
| UI (HTML/JS) | root → `ui/` (Phase 3) | `Sidebar.html`, `JavaScript.html`, `Js.*.html` | `npm run ci:client` | Last phase — `include()` chain. |

## Root stays

Entrypoints and cross-cutting: `Code.gs`, `Stage7ServerApi.gs`, `Stage7MaintenanceApi.gs`, `SidebarServer.gs`, `DataAccess.gs`, `Triggers.gs`, `UseCases.gs`, `SystemSheetsSelfHeal.gs`, `SmokeTests.gs`, …

## Clasp push reminder

Nested files: `!**/*.gs`, `!**/*.html`, then re-exclude `node_modules/**`, `.git/**`, `_backup*/**`, and local test paths under `tests/`. Run `npx clasp status` before production push.

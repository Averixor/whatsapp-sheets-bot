# Module map

Practical index: **where to look** and **what CI proves it**. Structural rules: [ADR-002](./adr/002-domain-folder-map.md). Mechanical change rules: [ADR-001](./adr/001-structural-changes.md).

| Domain | Folder | Main files | CI / verification | Notes |
| ------ | ------ | ---------- | ----------------- | ----- |
| Reports | `reports/` | `Report_DailySimple.gs`, `Report_SummaryData.gs`, `Report_DailyDetailed.gs`, `Summaries.gs` (root) | `npm run ci`, `npm run ci:workbook` | **Moved** (pilot). Summary repos/services still root until a later PR. |
| Vacations | `vacations/` | `Vacation*.gs` (11 modules) | `npm run ci:vacations` | **Moved.** `Js.Vacations.html`, `VacationSidebar.html` stay root until `ui/` phase. |
| Send panel | root → `sendpanel/` (planned) | `SendPanel*.gs`, `SelectionActionService.gs`, `UseCases.SendPanel.gs` | `npm run ci`, `npm run ci:recipients` | After vacations pattern stable. |
| Maintenance / formats | root → `maintenance/` (planned) | `ConditionalFormat*.gs`, `SystemSheetsSelfHeal.gs` | `npm run ci:format-rules` | Low risk; no PERSONNEL key logic. |
| Diagnostics | root → `diagnostics/` (planned) | `Diagnostics.*.gs` | `npm run ci` | Runtime diagnostics only. `Stage7TestRunner*`, `*Tests.gs` — repo folder OK; stay **clasp-excluded**. |
| Access | root → `access/` (Phase 2) | `AccessControl.*.gs`, `AccessEnforcement.gs`, `AccessPolicyChecks.gs`, `AccessSheetTriggers.gs` | `npm run ci` (access-api governance) | **High risk** — move only, never merge in structural PRs. |
| Personnel | root (future TBD) | `PersonnelRepository.gs`, `PersonsRepository.gs`, `PersonCards.gs` | `npm run ci`, personnel contracts | Callsign/Status semantics — see workspace rules. |
| UI (HTML/JS) | root → `ui/` (Phase 3) | `Sidebar.html`, `JavaScript.html`, `Js.*.html`, `Styles*.html` | `npm run ci:client`, manual sidebar smoke | Touches `include()` chain and `client-includes.contract.json`. Last phase. |

## Root stays (for now)

Entrypoints and cross-cutting modules remain at root until explicitly mapped: `Code.gs`, `Stage7ServerApi.gs`, `Stage7MaintenanceApi.gs`, `SidebarServer.gs`, `DataAccess.gs`, `Triggers.gs`, `UseCases.gs`, etc.

## Clasp push reminder

Nested files require `.claspignore` patterns `!**/*.gs` and `!**/*.html`, then re-exclude `node_modules/**`, `.git/**`, `_backup*/**`. Run `npx clasp status` before every production push.

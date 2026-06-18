# WASB Architecture

## 1. Runtime shape

WASB is a spreadsheet-bound Google Apps Script application.

### Server runtime

- Google Apps Script V8
- `.gs` server modules live at the repository root and in ADR-approved domain folders (`reports/`, `vacations/`); GAS loads them into one global namespace regardless of folder
- spreadsheet remains the primary data store and operational surface

### Client runtime

- `Sidebar.html` is the sidebar shell
- `JavaScript.html` aggregates the modular client runtime
- `Styles.html` bundles CSS partials via GAS `include()` (see partials `Styles_*.html`)
- active JS include chain (via `JavaScript.html`):
  - `Js.Core.html`
  - `Js.State.html`
  - `Js.Api.html`
  - `Js.Render.Panel.html`
  - `Js.Render.Calendar.html`
  - `Js.Render.Results.html`
  - `Js.Diagnostics.html`
  - `Js.Security.Boot.html`
  - `Js.Security.Util.html`
  - `Js.Security.Access.html`
  - `Js.Security.Debug.html`
  - `Js.Security.Login.html`
  - `Js.Security.DebugView.html`
  - `Js.Security.Policy.html`
  - `Js.Security.Guards.html`
  - `Js.Security.Forms.html`
  - `Js.Security.Exports.html`
  - `Js.Helpers.html`
  - `Js.Events.html`
  - `Js.Actions.html`
- `Js.Security.html` is a legacy shim and is not in the loader chain

### Packaging policy

- GAS runtime (`.gs`, `.html`, `appsscript.json`) deploys from the repository root and domain folders via `clasp`; see [`docs/module-map.md`](./docs/module-map.md)
- Markdown is excluded from `clasp push` by `.claspignore`
- Git operational docs are the human source of truth; contracts are machine-readable policy
- one-off audits, production workbook snapshots, and transitional notes are not kept in the repository

## 2. Canonical server layers

### Application API

- file: `Stage7ServerApi.gs`
- purpose: user-facing application routes for sidebar and spreadsheet-driven work

Representative entrypoints:

- `apiStage7BootstrapSidebar()`
- `apiStage7GetAccessDescriptorLite()`
- `apiStage7GetMonthsList()`
- `apiStage7GetSidebarData()`
- `apiStage7GetSendPanelData()`
- `apiGenerateSendPanelForDate()`
- `apiBuildDaySummary()`
- `apiBuildDetailedSummary()`
- `apiOpenPersonCard()`
- `apiLoadCalendarDay()`
- `apiCheckVacationsAndBirthdays()`
- `apiGetActiveProjects()` / `apiSubmitRequest()` — sidebar projects & requests (`ProjectRequests.gs`)

### Maintenance API

- file: `Stage7MaintenanceApi.gs`
- purpose: diagnostics, access administration, protections, triggers, cache/system maintenance, repair flows

Representative entrypoints:

- `apiStage7GetAccessDescriptor()`
- `apiStage7DebugAccess()`
- `apiStage7LoginByIdentifierAndCallsign()`
- `apiStage7ApplyProtections()`
- `apiStage7QuickHealthCheck()`
- `apiStage7HealthCheck()`
- `apiRunStage7Diagnostics()`
- `apiRunStage7RegressionTests()`
- `apiStage7ListPendingRepairs()`
- `apiStage7RunRepair()`

### Compatibility facade

- file: `SidebarServer.gs`
- purpose: historical callers and compatibility shims
- rule: compatibility wrappers may exist, but they are not the canonical path

### Use-case and orchestration layer

- `UseCases.gs`
- `WorkflowOrchestrator.gs`
- `Validation.gs`
- `AuditTrail.gs`
- `Reconciliation.gs`

This layer is used for heavier or sensitive workflows. Lightweight read-only routes should not be forced through the heaviest orchestration path unless they truly need it.

## 3. Repository and service layer

Key repositories and services (domain folders — see [`docs/module-map.md`](./docs/module-map.md)):

- `personnel/PersonnelRepository.gs`, `personnel/PersonsRepository.gs`, `personnel/PersonCards.gs`, `personnel/AlertsRepository.gs`
- `sendpanel/SendPanelRepository.gs`, `sendpanel/SendPanelService.gs`, `sendpanel/SelectionActionService.gs`
- `reports/SummaryRepository.gs`, `reports/SummaryService.gs`
- `reports/Report_SummaryData.gs` — read short-summary values from monthly formula block
- `reports/Report_DailySimple.gs` — format short daily summary text
- `reports/Report_DailyDetailed.gs` — detailed daily summary (people + DICT_SUM groups)
- `reports/Summaries.gs` — legacy entrypoints (`buildDaySummaryForColumn_`, summary dialogs)
- `vacations/VacationsRepository.gs`
- `vacations/VacationPlannerService.gs`, `vacations/VacationMonthCalendar.gs`, `vacations/Vacation_Suggestions.gs`
- `vacations/VacationSidebarService.gs`
- `LogsRepository.gs`
- `maintenance/JobRuntimeRepository.gs`
- `PreviewLinkService.gs`

The repository layer is the boundary between domain/application logic and spreadsheet storage details.

## 4. Identity and access model

### Primary identity

Primary identity is `Session.getTemporaryActiveUserKey()`.

That value is treated as the session identity anchor. The project stores **hashes** of it inside `ACCESS`, not raw keys.

The `ACCESS` bootstrap creates the full header set from `SHEET_HEADERS` in `access/AccessControl.Core.gs` (including `registration_status` and extended registration columns). Operational docs list the minimum admin-facing subset in **`README.md`** and **`RUNBOOK.md`**.

### Resolution order

The access descriptor resolves in this order:

1. `ACCESS.user_key_current_hash`
2. `ACCESS.user_key_prev_hash`
3. optional emergency email bridge, only when explicitly enabled by script property
4. bootstrap-owner mode, only when the access system is effectively unconfigured

### Current login flow

Normal operation:

- registered user → admitted by current key hash
- rotated key → auto-promoted from previous hash to current hash
- unregistered user with permitted self-bind record → logs in by **email/phone + callsign** and binds the current key

### Read-only descriptor rule

`AccessControl_.describe()` is intended to be a read-only access descriptor path.
Mutating actions such as login/self-bind, rotation binding, and access administration must stay in dedicated write flows.

## 5. Role model

Role order:
`guest < viewer < operator < maintainer < admin < sysadmin < owner`

Operational meaning:

- `guest` — safe-only mode
- `viewer` — personnel list and own card only
- `operator` — person cards and short/detailed summaries
- `maintainer` — operator rights plus SEND_PANEL, working actions, diagnostics, and operational inspection
- `admin` — access/log administration
- `sysadmin` — protections, triggers, repair, cache/system maintenance
- `owner` — full access

## 6. Server-side security boundary

UI hiding is not a security boundary.
Dangerous actions must be enforced on the server.

This bundle applies server-side checks to:

- person card access
- detailed summary access
- send-panel and send actions
- maintenance/admin/sysadmin actions
- repair and lifecycle maintenance actions

### System trigger context (headless jobs)

Scheduled jobs run **without** a sidebar UI session. They must **not** fall through user-key resolution as `guest`.

Managed jobs (`Triggers.gs` → `Stage7Triggers_.runJob`) attach an explicit system context when `trigger: true`:

- `actorRole: "system"`, `role: "system"`
- `allowSystem: true`, `isSystemTrigger: true`
- `source: "trigger"`, `accessSource: "system_trigger"`
- `identityStatus: "system_trigger"`

Canonical builder: `AccessEnforcement_.buildSystemTriggerAccessDescriptor(payload)`.
Validator: `AccessEnforcement_.isSystemTriggerContext(descriptor)`.

User-initiated actions still resolve through `AccessControl_.describe()` and the normal RBAC guards (`assertCanOpenPersonCard`, `assertCanUseSendPanel`, etc.).

Jobs that call user-guarded use cases pass the system descriptor explicitly. Example: `checkVacationsAndBirthdays` uses `assertCanRunLeaveBirthdayCheck`, which allows **admin**, **sysadmin**, **owner**, or a **full** system trigger context — not operator/maintainer/guest.

Maintenance jobs routed through `runMaintenanceScenario` (`healthCheck`, `cleanupCaches`, `cleanupLifecycleRetention`, …) do not use user RBAC guards; they rely on the system job path and `WASB_SPREADSHEET_ID` for headless spreadsheet binding.

Manual job launch from the GAS editor (`apiRunStage7Job` with `trigger: false`) **does not** inherit system context; it requires the sysadmin session that invoked the API.

Spreadsheet audit handlers (`stage7SecurityAuditOnEdit`, `stage7SecurityAuditOnChange`) are also installed by `Triggers.gs`, but they do **not** use the system actor to bypass checks. They resolve the editor from the Apps Script event and log suspicious protected-sheet edits or structural changes when the actor is not allowed.

## 7. Data and service sheets

Main operational sheets typically include:

- month sheets (`01`..`12`) — schedule codes (позивний + графік по датах); **нижній формульний блок** на кожному листі дає показники короткого зведення дня (див. [`docs/daily-summary-architecture.md`](./docs/daily-summary-architecture.md))
- `PERSONNEL` — **canonical** personal data (header-based via `personnel/PersonnelRepository.gs`). **Schedule key: Callsign** (monthly sheets). **Lookup: Callsign → FML**. `ID` = optional Армія+ (not a system key). `Position` = org slot, not person key. **Status dropdown (9 UA values):** `В наявності`, `У відрядженні`, `Вибув`, `Відпустка`, `Лікарняний`, `Тимчасовий`, `Гусачівка`, `БЗВП`, `СЗЧ`. Runtime-active: all except **Вибув** / **СЗЧ**; empty defaults to **В наявності**. Contract: `contracts/personnel-status.contract.json`.
- `PHONES` — legacy fallback when `PERSONNEL` is empty/unavailable (`loadPhonesIndex_` prefers `PERSONNEL`)
- `DICT`
- `DICT_SUM`
- `SEND_PANEL`
- `VACATIONS` — legacy vacation source (`A:I` only; `K:Q` presentation/migration)
- `VACATION_REQUESTS` — opt-in flat vacation source; activated explicitly with
  Script Property `WASB_VACATION_SOURCE=VACATION_REQUESTS`
- `LOG`
- `TEMPLATES`

Protected / service sheets include:

- `ACCESS`
- `OPS_LOG`
- `ACTIVE_OPERATIONS`
- `CHECKPOINTS`
- `AUDIT_LOG`
- `JOB_RUNTIME_LOG`
- `ALERTS_LOG`

### Optional business sheets (auto-seeded)

Три аркуші для заявок із сайдбару та місячного звіту за даними таблиці:

| Sheet (name) | Primary module                                         | Seeded when                         |
| ------------ | ------------------------------------------------------ | ----------------------------------- |
| `Дані`       | `MonthlyReport.gs` (`MonthlyReport_.ensureDataSheet_`) | Sidebar bootstrap; empty sheet only |
| `Проєкти`    | `ProjectRequests.gs` (`ensureProjectsSheet_`)          | same                                |
| `Заявки`     | `ProjectRequests.gs` (`ensureRequestsSheet_`)          | same                                |

Тригер входу: **`apiStage7BootstrapSidebar()`** → **`_ensureOptionalBusinessSheetsQuiet_()`** in `Stage7ServerApi.gs`. Деталі колонок і шаблонних рядків — **`RUNBOOK.md` §20**.

## 7.1 Daily summaries (short and detailed)

**Short summary** reads precomputed values from the **lower formula block** on the
active month sheet (`01`..`12`). Apps Script does not recount personnel or
DICT_SUM for the short summary.

**Detailed summary** is separate: monthly sheet column + PERSONNEL + DICT_SUM +
schedule codes, grouped by dictionary rules.

| Layer | Module | Role |
| ----- | ------ | ---- |
| Read | `reports/Report_SummaryData.gs` | Find date column and formula block; parse indicator values |
| Format | `reports/Report_DailySimple.gs` | Build short summary text (`За штатом` … `БР`) |
| Detailed | `reports/Report_DailyDetailed.gs` | People lists per code/group |
| Repository | `SummaryRepository.gs` | `buildDaySummary` / `buildDetailedSummary` |
| API | `Stage7ServerApi.gs` | `apiBuildDaySummary`, `apiBuildDetailedSummary` |
| UI | Sidebar (`Js.Render.Calendar.html`) | Buttons **Зведення дня** / **Детальне зведення** |

Top spreadsheet menu: **`WASB` → `Відкрити панель` only** (no separate `Звіти` menu).

Full design: [`docs/daily-summary-architecture.md`](./docs/daily-summary-architecture.md).

## 7.2 Vacation planner and mini-calendar

Vacation planning runs in the sidebar **Відпустки** tab (`Js.Vacations.html`).
Source adapter: `vacations/VacationsRepository.gs` (default `VACATIONS` `A:I`).

| Layer | Module | Role |
| ----- | ------ | ---- |
| Config | `vacations/VacationPlannerConfig.gs` | Rules (`MAX_CONCURRENT: 3`, overload 4/3d, min 15 days, …) |
| Logic | `vacations/VacationPlannerService.gs` | Validate options, build schedule audit |
| Calendar | `vacations/VacationMonthCalendar.gs` | Month grid, day `loadLevel`, previews |
| Suggestions | `vacations/Vacation_Suggestions.gs` | Safe move proposals per issue |
| API | `vacations/VacationSidebarService.gs` | Sidebar entrypoints |
| UI | `Js.Vacations.html` | Tabs, mini-calendar, problems, bulk fix |

Mini-calendar: count-only cells, informative tooltip (`buildVacationDayTooltip_`),
day details via `getVacationCalendarDayDetailsFromSidebar`. Footer shows only
**Проблемних дат** / **Навантажених днів**.

Full design: [`docs/vacation-planner.md`](./docs/vacation-planner.md). Contract:
`scripts/verify-vacation-planner.mjs`.

## 8. Sidebar runtime principles

- first paint should stay lightweight
- access status should be cheap to resolve
- heavy diagnostics should not run implicitly on sidebar load
- send-panel data should be loaded when needed, not preloaded blindly
- UI role hints must stay aligned with server policy

## 9. Diagnostics and tests

Main validation tools:

- `apiStage7QuickHealthCheck()`
- `apiStage7HealthCheck()`
- `apiRunStage7Diagnostics()`
- `apiRunStage7RegressionTests()`
- `SmokeTests.gs`
- `AccessE2ETests.gs`
- `DomainTests.gs`

Diagnostics are for verification, not as a replacement for server-side enforcement.

## 10. Script properties and spreadsheet binding

Canonical resolver: **`DataAccess.gs`**.

| Property                                 | Purpose                                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------------------ |
| `WASB_SPREADSHEET_ID`                    | Spreadsheet for headless/trigger runs                                                |
| `WASB_OWNER_EMAIL`                       | Owner email for privileged security notifications                                    |
| `WASB_ACCESS_MIGRATION_EMAIL_BRIDGE`     | Emergency email bridge; off in normal operation                                      |
| `WASB_ACCESS_TEMP_PASSWORD_PLAIN_LOOKUP` | Legacy plaintext temp-password lookup during migration only; off in normal operation |

Service sheet bootstrap: **`ServiceSheetsBootstrap.gs`** → `apiStage7BootstrapRuntimeAndAlertsSheets()`.

Never hardcode production spreadsheet IDs in source files.

## 11. Documentation and truth alignment

Operational truth belongs in `README.md`, `ARCHITECTURE.md`, `RUNBOOK.md`,
`SECURITY.md`, `CONTRIBUTING.md`, `AGENTS.md`, and `CHANGELOG.md`.
Machine-readable truth belongs in `contracts/` and `scripts/snapshots/`.
Production status must be verified from current CI, clasp, smoke, and GAS
diagnostics rather than copied into a static audit document.

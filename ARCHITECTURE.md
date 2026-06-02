# WASB Architecture

## 1. Runtime shape

WASB is a spreadsheet-bound Google Apps Script application.

### Server runtime

- Google Apps Script V8
- root `.gs` files are the canonical server bundle
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
  - `Js.Helpers.html`
  - `Js.Security.html`
  - `Js.Events.html`
  - `Js.Actions.html`
  - `Js.Render.html` — legacy shim only (not in loader chain)

### Packaging policy

- runtime files stay in the repository root for easy GAS web-editor import
- active docs stay in the repository root
- historical and transitional materials are intentionally excluded from this compact GAS import ZIP

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

Key repositories and services:

- `PersonsRepository.gs`
- `SendPanelRepository.gs`
- `SummaryRepository.gs`
- `VacationsRepository.gs`
- `AlertsRepository.gs`
- `LogsRepository.gs`
- `JobRuntimeRepository.gs`
- `SelectionActionService.gs`
- `PreviewLinkService.gs`

The repository layer is the boundary between domain/application logic and spreadsheet storage details.

## 4. Identity and access model

### Primary identity

Primary identity is `Session.getTemporaryActiveUserKey()`.

That value is treated as the session identity anchor. The project stores **hashes** of it inside `ACCESS`, not raw keys.

The `ACCESS` bootstrap creates the full header set from `SHEET_HEADERS` in `AccessControl.Core.gs` (including `registration_status` and extended registration columns). Operational docs list the minimum admin-facing subset in **`README.md`** and **`RUNBOOK.md`**.

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
- `operator` — daily operational work
- `maintainer` — diagnostics and operational inspection
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

Manual job launch from the GAS editor (`apiRunStage7Job` with `trigger: false`) **does not** inherit system context; it runs under the maintainer/sysadmin session that invoked the API.

Spreadsheet audit handlers (`stage7SecurityAuditOnEdit`, `stage7SecurityAuditOnChange`) are also installed by `Triggers.gs`, but they do **not** use the system actor to bypass checks. They resolve the editor from the Apps Script event and log suspicious protected-sheet edits or structural changes when the actor is not allowed.

## 7. Data and service sheets

Main operational sheets typically include:

- month sheets (`01`..`12`) — schedule codes only (позивний + графік по датах)
- `PERSONNEL` — **canonical** personal data (header-based via `PersonnelRepository.gs`). **Schedule key: Callsign** (monthly sheets). **Lookup: Callsign → FML**. `ID` = optional Армія+ (not a system key). `Position` = org slot, not person key. `Status` in sheet: **Дієвий / Тимчасовий / Відрядження** (active) vs **Вибув** (inactive).
- `PHONES` — legacy fallback when `PERSONNEL` is empty/unavailable (`loadPhonesIndex_` prefers `PERSONNEL`)
- `DICT`
- `DICT_SUM`
- `SEND_PANEL`
- `VACATIONS`
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

Тригер входу: **`apiStage7BootstrapSidebar()`** → **`_ensureOptionalBusinessSheetsQuiet_()`** in `Stage7ServerApi.gs`. Деталі колонок і шаблонних рядків — **`RUNBOOK.md` §18**.

## 8. Sidebar runtime principles

- first paint should stay lightweight
- access status should be cheap to resolve
- heavy diagnostics should not run implicitly on sidebar load
- send-panel data should be loaded when needed, not preloaded blindly
- UI role hints must stay aligned with server policy

### Sidebar theme (client-only)

The sidebar (`Sidebar.html` + `Styles_01_Themes.html` + `Js.Theme.html`) supports three **preference** modes stored in browser `localStorage` (`wasb.sidebar.theme`):

| Preference | Behaviour |
|------------|-----------|
| `system` | UI label **Як система** — resolved via `prefers-color-scheme` (browser/OS; not guaranteed to match Sheets or Dark Reader) |
| `light` | Force light palette |
| `dark` | Force dark palette (also the **default** when `localStorage` has no prior choice) |

The **resolved** palette is applied as `document.documentElement.dataset.theme = "light" | "dark"`. A short hint under the header switcher tells users to pick **Темна** manually when the spreadsheet is darkened by an extension. Semantic CSS variables (`--wasb-bg`, `--wasb-surface`, `--wasb-card`, `--wasb-text`, …) map to legacy `--bg-*` / `--text-*` aliases so existing styles keep working.

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

| Property | Purpose |
| -------- | ------- |
| `WASB_SPREADSHEET_ID` | Spreadsheet for headless/trigger runs |
| `WASB_OWNER_EMAIL` | Owner email for privileged security notifications |
| `WASB_ACCESS_MIGRATION_EMAIL_BRIDGE` | Emergency email bridge; off in normal operation |

Service sheet bootstrap: **`ServiceSheetsBootstrap.gs`** → `apiStage7BootstrapRuntimeAndAlertsSheets()`.

Never hardcode production spreadsheet IDs in source files.

## 11. Documentation and truth alignment

Active documentation is intentionally limited to five root markdown files.
Historical notes, one-off reports, and transition artifacts are not shipped in this compact GAS import ZIP. Keep them in a separate repository/archive so the runtime bundle stays readable and import-safe.

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
- active JS include chain:
  - `Js.Core.html`
  - `Js.State.html`
  - `Js.Api.html`
  - `Js.Render.html`
  - `Js.Diagnostics.html`
  - `Js.Helpers.html`
  - `Js.Security.html`
  - `Js.Events.html`
  - `Js.Actions.html`

### Packaging policy
- runtime files stay in the repository root for easy GAS web-editor import
- active docs stay in the repository root
- historical and transitional materials live under `_extras/history/`

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
- `apiCheckVacationsAndBirthdays()`

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

## 7. Data and service sheets
Main operational sheets typically include:
- month sheets (`01`..`12`)
- `PHONES`
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

## 10. Documentation and truth alignment
Active documentation is intentionally limited to five root markdown files.
Historical notes, one-off reports, and transition artifacts belong under `_extras/history/` only.

That split keeps the runtime bundle readable while preserving the audit trail.

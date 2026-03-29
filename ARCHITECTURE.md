# WASB Architecture

## Runtime shape
- Server runtime: Google Apps Script.
- UI runtime: `Sidebar.html` + `JavaScript.html` include chain (`Js.Core`, `Js.State`, `Js.Api`, `Js.Render`, `Js.Diagnostics`, `Js.Helpers`, `Js.Security`, `Js.Events`, `Js.Actions`).
- Packaging policy: root bundle is GAS-ready; historical materials live under `_extras/history/`.

## Canonical layers
- Application API: `Stage4ServerApi.gs`
- Maintenance API: `Stage5MaintenanceApi.gs`
- Compatibility facade: `SidebarServer.gs`
- Use cases: `UseCases.gs`
- Workflow orchestration: `WorkflowOrchestrator.gs`
- Access control: `AccessControl.gs`
- Access enforcement / alerts: `AccessEnforcement.gs`
- Diagnostics: `Diagnostics.gs`
- Regression suite: `SmokeTests.gs`

## Role model
Internal roles:
- `guest`
- `viewer`
- `operator`
- `maintainer`
- `admin`
- `sysadmin`
- `owner`

Role order:
`guest < viewer < operator < maintainer < admin < sysadmin < owner`

Display labels are intentionally preserved:
- guest → Гість
- viewer → Перегляд
- operator → Оператор
- maintainer → Редактор
- admin → Адмін
- sysadmin → Сис. адмін
- owner → Власник

## Access model
Primary identity is `Session.getTemporaryActiveUserKey()`.

Resolution order:
1. `ACCESS.user_key_current`
2. `ACCESS.user_key_prev`
3. optional **emergency migration bridge by email** if explicitly enabled by script property
4. bootstrap-owner only when the system has no configured access at all

### Rotation logic
When the current session key matches `user_key_prev`:
- previous `user_key_current` is moved to `user_key_prev`
- current session key is written into `user_key_current`
- `last_rotated_at` is updated
- `last_seen_at` is updated

This makes the 30-day Google key rotation survivable without manual firefighting on every user.

### Why this is the “ideal enough” policy here
- No silent fallback to viewer.
- No silent fallback to sysadmin.
- No role-based guesswork.
- Migration fallback exists, but only behind an explicit switch.
- Rotation is automatic when Google gives a new temporary key.

## Security boundaries
- Viewer can open only their own card.
- Viewer cannot open the detailed summary.
- Operator and higher can use working tools.
- Maintainer can run diagnostics and inspect operational state.
- Admin manages access and logs.
- Sysadmin handles protections, triggers, repairs, cache/system maintenance.
- Owner has full priority access.

## Service sheets
Protected / audited sheets:
- `ACCESS`
- `OPS_LOG`
- `ACTIVE_OPERATIONS`
- `CHECKPOINTS`
- `AUDIT_LOG`
- `JOB_RUNTIME_LOG`
- `ALERTS_LOG`

## Client runtime cleanup
The client runtime is still modular HTML Service JS, but it is leaner now:
- role gating is centralized with `data-role-min`
- action access is centralized via a single role map
- repeated legacy UI guards were collapsed into shared helpers
- old one-off permission checks were reduced to server-backed policy

## Tests
- `SmokeTests.gs` remains the regression entrypoint.
- Access and security dry-run E2E checks are included to validate role separation and key-rotation behaviour without modifying business data.

Historical stage reports, reference maps, and transition notes were moved to `_extras/history/`.

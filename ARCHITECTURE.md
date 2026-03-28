# Architecture — Stage 7.1.1 Final Stabilized Repair Baseline

## Release truth model

The project is now described as:

- **Release stage:** `Stage 7.1.1 — Final Stabilized Repair Baseline`
- **Functional lineage:** stabilized **Stage 5 Final RC2** baseline + preserved **Stage 6A** hardening overlay
- **Maintenance API lineage:** Stage 5 canonical maintenance API remains active by design
- **Compatibility lineage:** Stage 4 compatibility facade remains intentionally preserved
- **Semantic status:** active wording, comments, diagnostics summaries, and smoke expectations are aligned to the final release identity

This removes the last visible split-brain leftovers where the bundle worked as one release but talked like several generations were still wrestling in the stairwell.

## Canonical runtime and layers

### Public application API
- `Stage4ServerApi.gs` — stable sidebar / operational application surface
- `SpreadsheetActionsApi.gs` — canonical spreadsheet/manual action API
- `Stage5MaintenanceApi.gs` — canonical maintenance / diagnostics / jobs API

### Application / orchestration
- `UseCases.gs`
- `WorkflowOrchestrator.gs`
- `Validation.gs`
- `AuditTrail.gs`

### Domain services
- `SendPanelService.gs`
- `SummaryService.gs`
- `VacationService.gs`
- `PreviewLinkService.gs`
- `SelectionActionService.gs`

### Repository / data access
- `SendPanelRepository.gs`
- `SummaryRepository.gs`
- `VacationsRepository.gs`
- `PersonsRepository.gs`
- `DictionaryRepository.gs`
- `DataAccess.gs`

### Presentation
- `DialogPresenter.gs`
- `DialogTemplates.gs`
- `Sidebar.html`
- `Styles.html`
- `JavaScript.html` — active modular client runtime
- `Js.*.html` — active modular client artifacts

### Reconciliation / maintenance / observability
- `Reconciliation.gs`
- `Triggers.gs`
- `JobRuntime.gs`
- `JobRuntimeRepository.gs`
- `Diagnostics.gs`
- `SmokeTests.gs`

### Template governance
- `Templates.gs`
- `TemplateRegistry.gs`
- `TemplateResolver.gs`

### Compatibility / historical bridge
- `Stage4MaintenanceApi.gs`
- `SidebarServer.gs`
- `Stage3ServerApi.gs`
- `Actions.gs`
- `Dialogs.gs`
- `DeprecatedRegistry.gs`

## Client bootstrap policy

The active client runtime remains deliberately conservative:

1. `showSidebar()` renders `Sidebar.html`
2. `Sidebar.html` includes `Styles.html`
3. `Sidebar.html` loads `JavaScript.html` via `includeTemplate('JavaScript')`
4. `JavaScript.html` contains the full active runtime script

The modular `Js.*.html` runtime chain is production-active in this release and must remain aligned with `JavaScript.html`.

## Diagnostics model

The diagnostics stack is split into three honest buckets:

- **active release diagnostics** — Stage 7.1.1 — Final Stabilized Repair Baseline wording
- **historical / compatibility diagnostics** — clearly marked as historical lineage
- **informational compatibility reporting** — explicitly labeled as informational, not masked as an acceptance assert

This keeps compatibility lineage visible without letting it cosplay as the active release identity.

## Documentation hierarchy

### Active root docs
- `README.md`
- `ARCHITECTURE.md`
- `RUNBOOK.md`
- `STAGE7_REPORT.md`

### Canonical reference docs
- `docs/reference/PUBLIC_API_STAGE5.md`
- `docs/reference/CHANGELOG_STAGE5.md`
- `docs/reference/STAGE5_REPORT.md`
- `docs/reference/STAGE6A_REPORT.md`
- `docs/reference/SPREADSHEET_ACTION_API.md`
- `docs/reference/JOBS_RUNTIME.md`
- `docs/reference/SUNSET_POLICY.md`

### Historical docs
Everything in `docs/archive/` is historical or archival material and must not be interpreted as active.

## Packaging policy

The release follows **root manifest policy**:

- `appsscript.json` lives in bundle root
- No `.clasp` files are required in the web-editor-ready bundle

This layout is aligned with metadata, diagnostics, smoke tests, and archive naming.

## Intentional non-goals of the final freeze

This stage does not:

- replace the modular runtime
- migrate to TypeScript / bundlers / React / Vite
- redesign sidebar UX
- rewrite SEND_PANEL logic
- remove Stage 4 compatibility
- change domain semantics of summaries, vacations, birthdays, or reconciliation

It is a semantic cleanup and release freeze, not a new feature stage.

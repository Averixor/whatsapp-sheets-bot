# GAS WAPB — Stage 7.1 Reliability Hardened Baseline

This bundle is the frozen final baseline of the current GAS-first WAPB project.

It does **not** introduce a new runtime, a new UI stack, or new business logic.
This pass closes the release semantically: the system already worked, and now its metadata, docs, diagnostics, smoke tests, and active comments speak with one release voice.

## Release identity

**Official release:** `Stage 7.1 — Reliability Hardened Baseline`  
**Version:** `7.1.1-reliability-hardened-merged`  
**Archive / root folder:** `gas_wapb_stage7_1_reliability_hardened_baseline`

Functional lineage remains intentionally preserved:

- canonical runtime / business baseline: **Stage 5 Final RC2**
- operational hardening overlay: **Stage 6A**
- frozen release marker: **Stage 7.1 — Reliability Hardened Baseline**

In plain language: this is the stabilized baseline, hardened and semantically cleaned, then frozen under one final release identity.

This merged 7.1 bundle keeps the fuller diagnostics/smoke surface from the earlier 7.1 build and backports the stronger lifecycle hardening improvements from the later 7.2 iteration.

## What this pass changes

This pass does **not** change the business behavior of:

- sidebar workflows
- SEND_PANEL logic
- summaries
- person cards
- vacation / birthday logic
- spreadsheet / manual actions
- reconciliation domain rules

This pass changes the semantic layer around the working system:

- active diagnostics wording is aligned to the final release
- historical / compatibility diagnostics stay visible but are framed as historical or informational
- **Baseline health** stays the neutral health summary
- the compatibility split stays explicit **informational** reporting
- active runtime comments and UI text no longer carry RC2 / Stage 5 transitional markers
- smoke tests guard semantic cleanliness of the active public layer

## Packaging policy

The bundle uses **root manifest policy**.

Present in bundle root:

- `appsscript.json`
- `.clasp.json.example`

## Documentation layout

### Active docs in root
- `README.md`
- `ARCHITECTURE.md`
- `RUNBOOK.md`
- `STAGE7_REPORT.md`

### Canonical reference docs
Stored in `docs/reference/`:
- `PUBLIC_API_STAGE5.md`
- `CHANGELOG_STAGE5.md`
- `STAGE5_REPORT.md`
- `STAGE6A_REPORT.md`
- `SPREADSHEET_ACTION_API.md`
- `JOBS_RUNTIME.md`
- `SUNSET_POLICY.md`

### Historical docs
Stored in `docs/archive/`:
- Stage 3 / Stage 4 reports
- historical API docs
- historical changelogs
- legacy merge/build notes

Anything under `docs/archive/` is historical by definition and must not be treated as active.

## Canonical code surfaces

### Application / operational API
- `Stage4ServerApi.gs`

### Spreadsheet / manual actions
- `SpreadsheetActionsApi.gs`

### Maintenance / diagnostics / jobs
- `Stage5MaintenanceApi.gs`

### Compatibility facade kept intentionally
- `Stage4MaintenanceApi.gs`

### Active sidebar runtime
- `Sidebar.html`
- `Styles.html`
- `JavaScript.html`

The active runtime remains **modular** and template-loaded through:

`Sidebar.html -> includeTemplate('JavaScript')`

`Js.*.html` files remain **active modular artifacts**.

## First files a new maintainer should open

1. `README.md`
2. `ARCHITECTURE.md`
3. `RUNBOOK.md`
4. `STAGE7_REPORT.md`
5. `ProjectMetadata.gs`

Now the project reads like one release instead of a haunted warehouse of leftover labels.

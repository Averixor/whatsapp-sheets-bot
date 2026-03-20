# RUNBOOK — Stage 7.1 Reliability Hardened Baseline

## How to treat this release

Treat the bundle as **Stage 7.1 — Reliability Hardened Baseline**.

That means:

- release naming and metadata are Stage 7.1 — Reliability Hardened Baseline
- canonical maintenance API is still `Stage5MaintenanceApi.gs`
- the Stage 6A hardening layer remains preserved as lineage
- Stage 4 compatibility wrappers remain preserved
- the active client runtime is still modular `JavaScript.html`
- active public diagnostics / UI wording must stay aligned to the final release marker

## Where the truth lives

Open these first:

1. `ProjectMetadata.gs`
2. `README.md`
3. `ARCHITECTURE.md`
4. `STAGE7_REPORT.md`

## Packaging policy

This release uses **root manifest policy**.

Expected in bundle root:

- `appsscript.json`
- `.clasp.json.example`

## Active docs vs reference docs

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

### Historical docs
- `docs/archive/*`

Do not treat anything under `docs/archive/` as active.

## Normal operations

### Sidebar / application routes
Use `Stage4ServerApi.gs`.

### Spreadsheet / manual actions
Use `SpreadsheetActionsApi.gs`.

### Maintenance / diagnostics / jobs
Use `Stage5MaintenanceApi.gs`.

### Compatibility-only maintenance facade
`Stage4MaintenanceApi.gs` is preserved only for historical callers.

## Diagnostics order

Recommended order:

1. `apiStage5HealthCheck({ mode: 'quick' })`
2. `apiRunStage5Diagnostics({ mode: 'structural' })`
3. `apiRunStage5Diagnostics({ mode: 'operational' })`
4. `apiRunStage5Diagnostics({ mode: 'compatibility sunset' })`
5. `apiRunStage5Diagnostics({ mode: 'full' })`

The function names remain Stage 5–named by design, but the active wording and release identity are aligned to **Stage 7.1 — Reliability Hardened Baseline**.

## Regression tests

- Canonical: `apiRunStage5RegressionTests(options)`
- Historical compatibility wrapper: `apiRunStage4RegressionTests(options)`

## Sidebar bootstrap troubleshooting

If the sidebar breaks with HtmlService bootstrap issues:

1. verify `Code.gs` still exposes `include()` and `includeTemplate()`
2. verify `Sidebar.html` uses `<?!= includeTemplate('JavaScript'); ?>`
3. verify `JavaScript.html` remains self-contained
4. verify `JavaScript.html` still aggregates the active `Js.*.html` runtime chain in canonical order
5. verify no one smuggled legacy transitional wording back into active UI text

## What must not be “fixed” into something else

Do not accidentally turn this release into:

- a docs-only rename
- a compatibility report pretending to be an active acceptance check
- a diagnostics layer framed like a previous epoch
- a runtime comment dump leaking transitional labels
- a fake “final” that still drips old markers from active output

Мотор не чіпай. Табличку на капоті — тримай правильно.

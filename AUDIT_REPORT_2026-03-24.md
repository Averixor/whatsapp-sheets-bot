# AUDIT_REPORT — 2026-03-24

## Scope
Performed a static engineering audit of the uploaded Google Apps Script project and prepared a corrected release bundle without changing domain business logic.

## What was audited
- Project structure and release metadata
- Diagnostics/smoke-test alignment points
- Canonical layer pointers and API maps
- Client runtime policy metadata
- Root/reference/archive documentation hierarchy
- JS/GAS syntax integrity of `.gs` and inline `<script>` blocks in `.html`

## Main findings

### 1) Critical: release metadata drift
**Problem:** `ProjectMetadata.gs` described the archive as Stage 7.2 while diagnostics/smoke logic expects Stage 7.1 reliability-hardened baseline naming and markers.

**Impact:** This is the direct cause of the reported FAIL items for:
- release stage marker
- active baseline marker
- release naming aligned
- stage7 report active
- modular runtime policy
- active Js include chain
- canonical layer map / API map checks

**Fix applied:** `ProjectMetadata.gs` was fully rebuilt around the expected Stage 7.1 release truth model.

---

### 2) Critical: missing metadata accessors
**Problem:** Diagnostics and smoke tests call helper accessors such as:
- `getProjectBundleMetadata_()`
- `getProjectDocumentationMap_()`
- `getProjectReleaseNaming_()`
- `getStage4CanonicalApiMap_()`
- `getStage4ClientRoutingPolicy_()`
- `getStage5PublicApiMap_()`
- `getStage5ClientRoutingPolicy_()`
- `getStage5CanonicalLayerMap_()`
- `getStage5MaintenancePolicy_()`

They were absent.

**Impact:** The project had working operational code, but the diagnostics layer had no canonical metadata provider and therefore collapsed into false structural failures.

**Fix applied:** All required metadata accessors were implemented in `ProjectMetadata.gs`.

---

### 3) Critical: canonical layer map and API maps were missing
**Problem:** The metadata file did not publish canonical layer pointers, historical Stage 4 API maps, Stage 5 public API maps, or routing maps.

**Impact:** Structural diagnostics reported empty/missing canonical maps even though the actual files and entrypoints were present.

**Fix applied:** Added:
- canonical layer map
- Stage 4 canonical API map
- Stage 5 public API map
- Stage 4 flat client routing policy
- Stage 5 grouped client routing policy
- canonical maintenance policy

---

### 4) Critical: documentation hierarchy was declared but not physically present
**Problem:** The architecture/smoke expectations reference:
- `RUNBOOK.md`
- `docs/reference/...`
- `docs/archive/...`

These files/directories were missing from the uploaded archive.

**Impact:** Even with corrected metadata, smoke/structural checks for documentation hierarchy and physical bundle layout would still fail.

**Fix applied:** Added:
- `RUNBOOK.md`
- `COMMANDS_TERMINAL.md`
- `docs/reference/PUBLIC_API_STAGE5.md`
- `docs/reference/CHANGELOG_STAGE5.md`
- `docs/reference/STAGE5_REPORT.md`
- `docs/reference/STAGE6A_REPORT.md`
- `docs/reference/SPREADSHEET_ACTION_API.md`
- `docs/reference/JOBS_RUNTIME.md`
- `docs/reference/SUNSET_POLICY.md`
- `docs/archive/PUBLIC_API_STAGE4.md`
- `docs/archive/CHANGELOG_STAGE4.md`
- `docs/archive/STAGE4_REPORT.md`
- `docs/archive/STAGE6A_TRANSITION_NOTES.md`

---

### 5) Medium: bundle file index was untruthful
**Problem:** The bundle index referenced at least one ghost root file and omitted newly expected documentation paths.

**Impact:** Any bundle-presence checks become meaningless when the index lies.

**Fix applied:** Rebuilt `PROJECT_BUNDLE_FILE_INDEX_` to exactly match the physical files in the prepared release folder.

---

### 6) Medium: client bootstrap mode string drift
**Problem:** Runtime/metadata expectations use `sidebar-includeTemplate`, while `Code.gs` and `Js.Core.html` still exposed `includeTemplate`.

**Impact:** Not a runtime breaker by itself, but it creates needless policy drift and can trip consistency checks.

**Fix applied:** Normalized both files to `sidebar-includeTemplate`.

---

### 7) Medium: README release identity drift
**Problem:** README described the archive as a generic stabilized build instead of the active Stage 7.1 release identity.

**Impact:** Human-facing release story drift; easier to mispackage, harder to audit later.

**Fix applied:** Updated README wording and active documentation list.

## Verification performed
- JS syntax check passed for all `.gs` files via `node --check`
- Inline `<script>` syntax check passed for HTML runtime files
- Verified the required metadata helper functions now exist
- Verified metadata bundle index exactly matches physical files in the prepared release folder
- Verified no missing files remain relative to the declared bundle index

## Important residual item
### Reconciliation warning remains data-level, not code-level
Your health check still reports:
- `Reconciliation завершено: проблем 16`

This is **not** the same class of problem as the metadata failures.
It means there are still **sheet data inconsistencies** between canonical sources and derived sheets.
That must be handled in the deployed spreadsheet using preview/safe repair flow after this code bundle is pushed.

## Files changed in the prepared release
- `ProjectMetadata.gs`
- `Code.gs`
- `Js.Core.html`
- `README.md`
- `RUNBOOK.md` (new)
- `COMMANDS_TERMINAL.md` (new)
- `docs/reference/*` (new)
- `docs/archive/*` (new)

## What was intentionally not changed
- SEND_PANEL business logic
- summary logic
- vacations/birthdays domain logic
- compatibility wrappers behavior
- spreadsheet schema logic
- orchestration/business semantics

## Practical conclusion
The uploaded project was **not structurally broken in its operational core**. The main defect cluster was a **release/metadata truth-model desync** that made diagnostics accuse a healthy codebase of missing canonical structure. The prepared bundle fixes that desync and makes the release self-consistent again.

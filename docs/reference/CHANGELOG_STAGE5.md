# CHANGELOG_STAGE5

> Canonical reference changelog for the Stage 5 API lineage preserved inside the Stage 6 Final release.

## 6.0.0-final

### Changed
- release naming aligned to `Stage 6 Final`
- active diagnostics wording cleaned from leftover Stage 5 / Stage 4.2 framing
- `Baseline health` replaced the old `Stage 5 health bridge` wording
- compatibility split counters were relabeled as explicit informational reporting
- active runtime comments and UI text were cleaned from RC2 / Stage 5 / Stage 6A transitional markers
- smoke tests now assert absence of legacy wording in active runtime and maintenance responses

## 6.0.0-final-rc3

### Changed
- release naming aligned to `Stage 6 Final RC3`
- `ProjectMetadata.gs` rewritten to use path-aware docs, truthful packaging policy, and explicit release lineage
- root manifest policy finalized with real `appsscript.json` and `.clasp.json.example` in bundle root
- active docs moved to root; canonical reference docs moved to `docs/reference/`
- Stage 5 / 6A documents removed from `docs/archive/`
- `Diagnostics.gs` now distinguishes metadata declaration checks from physical bundle checks
- `SmokeTests.gs` now checks actual bundle paths from the bundle file index and no longer contains weakened `|| true` assertions
- release naming, archive naming, stage label, baseline label, overlay label, and docs layout were aligned

## 5.0.2-final-rc2

### Changed
- `Diagnostics.gs` public summaries and metadata prompts were reworded to Stage 5 semantics for the active baseline
- `Code.gs` exposes `includeTemplate(filename)` for template-safe HtmlService includes
- `Sidebar.html` loads `JavaScript.html` through `includeTemplate('JavaScript')`
- `JavaScript.html` was stabilized as a self-contained monolithic runtime script
- `ProjectMetadata.gs` recorded the Stage 5 Final RC2 client runtime policy and diagnostics wording policy
- `SmokeTests.gs` validated the template bootstrap path, monolithic runtime status and absence of Stage 4.2 wording in active public diagnostics output

## 5.0.1-final

### Added
- `Stage5MaintenanceApi.gs` as the canonical maintenance / diagnostics / jobs facade for the Stage 5 baseline
- Stage 5 metadata helpers in `ProjectMetadata.gs`
- explicit active / historical docs hierarchy in metadata and docs
- standalone Stage 5 diagnostics modes: quick, structural, operational, compatibility sunset, full

## 5.0.0

### Added
- `SpreadsheetActionsApi.gs`
- `SelectionActionService.gs`
- `DialogPresenter.gs` + `DialogTemplates.gs`
- `SendPanelService.gs`, `SummaryService.gs`, `VacationService.gs`, `PreviewLinkService.gs`
- `JobRuntime.gs` + `JobRuntimeRepository.gs`
- `TemplateRegistry.gs` + `TemplateResolver.gs`
- Stage 5 diagnostics and regression suite

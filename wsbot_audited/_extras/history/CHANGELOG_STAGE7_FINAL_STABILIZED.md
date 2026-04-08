# Stage 7 Final Stabilized — changelog

## Runtime/code changes
- Removed `eval`-based symbol checks from `Diagnostics.gs` and `SmokeTests.gs`; replaced with safe global/registry lookup.
- Canonicalized phone/profile lookup via `loadPhonesProfiles_()`, `findPhone_()`, and compatibility wrapper `findPhoneByRole_()`.
- Added centralized `CACHE_KEYS` and `cacheKeyProfiles_()`; cache clearing paths now use the same keys as readers.
- Migrated `buildPayloadForCell_()` to an object-contract API with backward-compatible positional adapter.
- Updated payload call sites in `PersonsRepository.gs`, `SelectionActionService.gs`, `SendPanel.gs`, and `SendPanelRepository.gs`.
- `buildPayloadForCell_()` now resolves phone numbers through canonical lookup, not direct flat map indexing.
- `Templates.gs` now supports both `{name}` and `{{name}}`.
- `VacationEngine.gs` commander-phone lookup now uses canonical phone service.
- Reworked serial send flow in `Js.Render.html` from bare `setInterval` to a controlled chained timeout runner.

## Notes
- Business logic, sidebar UX, SEND_PANEL semantics, message composition intent, and maintenance/public API surface were preserved.
- UI inline handlers were not fully removed in this patch; current archive keeps compatibility-first runtime behavior.

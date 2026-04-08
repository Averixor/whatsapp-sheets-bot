# Patch notes — 2026-04-09

## What was fixed

### Sidebar startup hardening
- Prevented duplicate sidebar bootstrap runs.
- Switched startup binding to `DOMContentLoaded` with guarded immediate fallback.
- Prevented duplicate `beforeunload` binding.
- Prevented duplicate global runtime error/unhandled rejection listeners.

### SEND_PANEL refresh deduplication
- Added in-flight promise deduplication for `refreshSendPanelDataFromServer()`.
- Prevented parallel refresh storms from multiple silent/UI refresh callers.
- Preserved existing fallback behavior for empty server responses.

### Months list loading optimization
- Added cached `ensureMonthsLoaded_()` helper with TTL-based reuse.
- Reused month list loads in sidebar sync/month switcher instead of fetching repeatedly.

### Access descriptor loading optimization
- Added in-flight promise deduplication and TTL-based caching for `loadAccessDescriptor()`.
- Stored bootstrap access load timestamp so follow-up UI flows do not immediately refetch access data.

## Files changed
- `Js.Core.html`
- `Js.Events.html`
- `Js.State.html`
- `Js.Helpers.html`
- `Js.Security.html`
- `Js.Render.html`
- `Js.Actions.html`

## Validation performed
- Static syntax validation passed via `_extras/validate-gs-syntax.js`
- Static checks passed via `_extras/static-checks.js`

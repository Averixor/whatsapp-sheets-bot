# Stabilization notes — 2026-03-22

## Core SEND_PANEL fixes

- Added canonical SEND_PANEL status layer in `SendPanelConstants.gs`.
- Removed automatic send confirmation after opening WhatsApp in sidebar flow.
- Added explicit pending state before manual confirmation.
- Rebuild now preserves SEND_PANEL state from the sheet for the same panel date.
- Panel metadata now stores month/date in SEND_PANEL.
- `getSendPanelData()` now returns real panel date from metadata.
- WhatsApp links now use one named sender tab.

## Runtime and tooling fixes

- Sidebar bootstrap now exposes a fallback `window.SidebarApp` early.
- `dev-shell.ps1` rewritten into a self-consistent shell.
- `watch-sync-simple.ps1` now checks exit codes and retries `clasp push`.
- `README.md` and `ProjectMetadata.gs` rewritten to match archive contents.

## Notes

This build focuses on stabilization and contract alignment. It does not claim a full architectural rewrite of every legacy helper in the repository.

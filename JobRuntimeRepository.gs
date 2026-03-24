# Implementation report — 2026-03-22

## Implemented

- Canonical SEND_PANEL status layer added in `SendPanelConstants.gs`.
- Sidebar send flow changed to: open chat -> pending confirmation -> confirm sent / mark unsent.
- Auto-mark-as-sent after opening WhatsApp removed from single and batch sidebar flows.
- One named WhatsApp sender tab enforced in sidebar and generated WA links.
- `SendPanelRepository.rebuild()` now uses explicit panel date metadata and preserves sheet state for the same panel date.
- `getSendPanelData()` now returns stored panel date metadata.
- Validation no longer silently falls back to today in deep date normalization helpers.
- `dev-shell.ps1` rewritten into a self-consistent shell.
- `watch-sync-simple.ps1` hardened with exit-code checks and retry.
- `README.md` and `ProjectMetadata.gs` aligned to actual archive contents.

## Partially addressed / not fully rewritten

- Legacy helpers in `SendPanel.gs` remain present for compatibility, but active sidebar flow now uses the repository/service path.
- The broader repository still contains historical code paths outside the stabilized SEND_PANEL contour.
- PowerShell files were hardened by code review and rewrite, but not executed in this Linux container.

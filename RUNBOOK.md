# RUNBOOK — Stage 7.1.1 Final Stabilized Repair Baseline

## Purpose
This runbook describes the practical operating rules for the active Stage 7.1 baseline.

## Safe operating sequence
1. Open the sidebar from the custom menu.
2. Verify the active month and the target date.
3. Regenerate `SEND_PANEL` only when needed.
4. Open WhatsApp chats through the single named sender tab/window.
5. Confirm sent rows manually so sheet state matches reality.
6. Use diagnostics before and after structural changes.
7. Use reconciliation in preview/dry-run first when inconsistencies are reported.

## Maintenance guardrails
- Do not rewrite domain business logic while fixing metadata or diagnostics alignment.
- Prefer canonical Stage 4/5/7 entrypoints over compatibility wrappers.
- Use dry-run for repair / reconciliation / risky write scenarios whenever supported.
- Keep `.clasp.json` local and out of version control.

## Release identity
- Active release: `Stage 7.1.1 — Final Stabilized Repair Baseline`
- Active release report: `STAGE7_REPORT.md`
- Canonical runtime: `JavaScript.html` via `Sidebar.html -> includeTemplate('JavaScript')`


## Local shell / sync
- Use `dev-shell.ps1` as the canonical PowerShell entrypoint.
- Portable Node under `Documents\node-v20.20.1-win-x64\node.exe` is supported without admin rights.
- Use `repair-deps -Full` when `clasp` or transitive packages are damaged.


## Packaging note
This repack is intended for direct use through the Google Apps Script web editor. See `GAS_WEB_EDITOR_IMPORT_GUIDE.md`.

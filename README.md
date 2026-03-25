# whatsapp-sheets-bot — Stage 7.1 Reliability Hardened Baseline

> This repack is prepared for **Google Apps Script Web Editor use without VS Code**.
> Local PowerShell / Node helper scripts were intentionally removed from this archive.
> See `GAS_WEB_EDITOR_IMPORT_GUIDE.md` for the step-by-step import flow.


This archive is the **Stage 7.1 Reliability Hardened Baseline** with the preserved SEND_PANEL stabilization and lifecycle hardening layers.

## What was fixed in this build

- SEND_PANEL no longer treats opening WhatsApp as automatic sending.
- Canonical status model added:
  - `✅ Готово`
  - `🟡 Очікує підтвердження`
  - `↩️ Не відправлено`
  - `📤 Відправлено`
  - `❌ ...`
- SEND_PANEL state is preserved from the sheet itself during rebuild for the same panel date.
- Panel date is read from explicit SEND_PANEL metadata instead of silently returning "today".
- WhatsApp links use one named sender tab instead of `_blank`.
- Sidebar flow now supports manual confirmation after opening a chat.
- `dev-shell.ps1` was rewritten into a self-consistent shell with real aliases and soft clasp detection.
- `watch-sync-simple.ps1` now checks exit codes, retries clasp push, and hashes relative paths.
- `ProjectMetadata.gs` and this README were rewritten to match the actual archive contents.

## What this archive deliberately does not claim

- It does not claim that nonexistent docs or root files are present.
- It does not ship `.git` or `node_modules`.
- This repair archive includes a ready `.clasp.json` for the provided GAS scriptId; keep it ignored in Git.

## Repository hygiene

Keep only `.clasp.json.example` in version control.
Keep `.clasp.json` ignored in Git even though this repair archive includes a ready local copy for immediate use.

## Main files to review first

- `SendPanelConstants.gs`
- `SendPanel.gs`
- `SendPanelRepository.gs`
- `SendPanelService.gs`
- `UseCases.gs`
- `Js.Core.html`
- `Js.State.html`
- `Js.Render.html`
- `dev-shell.ps1`
- `gas-push.ps1`
- `gas-status.ps1`
- `repair-deps.ps1`
- `watch-sync-simple.ps1`
- `ProjectMetadata.gs`

## Archive composition

This release contains only the files physically present in the archive root. See `ProjectMetadata.gs` for the exact index.


## Active documentation set

- `README.md`
- `ARCHITECTURE.md`
- `RUNBOOK.md`
- `STAGE7_REPORT.md`


## Local shell reliability

- `dev-shell.ps1` auto-detects portable Node in common locations, including `Documents\node-v20.20.1-win-x64\node.exe`.
- `claspx` is now a real helper function inside `dev-shell.ps1`.
- `repair-deps` can rebuild broken `node_modules` without administrator rights.

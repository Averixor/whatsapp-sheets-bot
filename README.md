# whatsapp-sheets-bot — Stage 7.1.1 Final Stabilized Repair Baseline

> This repack is prepared for **Google Apps Script Web Editor use without VS Code**.
> Local PowerShell / Node helper scripts are **not included** in this archive.
> See `GAS_WEB_EDITOR_IMPORT_GUIDE.md` for the import flow.

This archive is the **Stage 7.1.1 Final Stabilized Repair Baseline** with preserved SEND_PANEL stabilization and lifecycle hardening.

## What is included

- All active `.gs` source files
- All active `.html` source files
- `appsscript.json`
- Active root documentation:
  - `README.md`
  - `ARCHITECTURE.md`
  - `RUNBOOK.md`
  - `STAGE7_REPORT.md`

## What was fixed in this build

- SEND_PANEL treats sidebar opening of the stored Action link as the sending fixation point.
- Canonical status model is preserved:
  - `Status`: `✔` або `✘`
  - `Sent`: `✔` або `✘`
  - `Action`: готове посилання з листа
  - `✕ ...`
- SEND_PANEL rebuild preserves state from the sheet for the same panel date.
- Panel date is read from explicit SEND_PANEL metadata instead of silently falling back to "today".
- WhatsApp links use one named sender tab instead of `_blank`.
- Sidebar flow supports manual confirmation after opening a chat.
- Diagnostics/reporting are aligned with the actual web-editor-ready package.

## What is intentionally not included

- `.git`
- `node_modules`
- `.clasp.json`
- `.clasp.json.example`
- local PowerShell helper scripts such as `dev-shell.ps1`, `gas-push.ps1`, `gas-status.ps1`, `repair-deps.ps1`, `watch-sync-simple.ps1`

## Main files to review first

- `SendPanelConstants.gs`
- `SendPanel.gs`
- `SendPanelRepository.gs`
- `SendPanelService.gs`
- `UseCases.gs`
- `Js.Core.html`
- `Js.State.html`
- `Js.Render.html`
- `Js.Diagnostics.html`
- `ProjectMetadata.gs`

## Archive composition

This release is a **web-editor-ready** package. The source of truth is the set of files physically present in the archive root.

## Active documentation set

- `README.md`
- `ARCHITECTURE.md`
- `RUNBOOK.md`
- `STAGE7_REPORT.md`

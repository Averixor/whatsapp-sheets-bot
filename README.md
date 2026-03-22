# whatsapp-sheets-bot — stabilized build

This archive is the **stabilized SEND_PANEL-oriented build** prepared against the uploaded stabilization brief.

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
- It does not ship `.git`, `node_modules`, or a real `.clasp.json`.

## Repository hygiene

Keep only `.clasp.json.example` in version control.
Keep the real `.clasp.json` local and ignored.

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
- `watch-sync-simple.ps1`
- `ProjectMetadata.gs`

## Archive composition

This release contains only the files physically present in the archive root. See `ProjectMetadata.gs` for the exact index.

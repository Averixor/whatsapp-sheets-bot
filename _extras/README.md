# WASB — Google Apps Script release bundle

This is the web-editor-ready WASB bundle for Google Apps Script.

## What is active in this release
- **Strict user-key access model** based on `Session.getTemporaryActiveUserKey()`.
- **Controlled key rotation** with automatic promotion `user_key_prev -> user_key_current`.
- **Optional emergency migration bridge** by email, disabled by default and intended only for temporary rollout.
- **Viewer hardening**: viewer can see the personnel list, but may open only their own card and cannot open the detailed summary.
- **Role-separated maintenance access**: maintainer, admin, sysadmin, owner are split by real permissions instead of one giant admin bucket.
- **GAS-friendly packaging**: root contains only `.gs`, `.html`, and `appsscript.json`; non-runtime materials live in `_extras/`.

## Main documents
- `ARCHITECTURE.md` — current architecture, layers, access model, client/runtime notes.
- `RUNBOOK.md` — setup, migration, deployment, post-import checks, and operational procedures.
- `SECURITY.md` — roles, access rules, key rotation, alerts, audit, protections.
- `CHANGELOG.md` — concise release history for maintainers.

Historical reports and one-off notes were moved to `_extras/history/` so the active docs stop looking like a hydra with twenty heads.

## Quick import checklist
1. Upload all root `.gs`, `.html`, and `appsscript.json` files into the GAS web editor.
2. Keep the files from `_extras/` only as reference; they are not runtime dependencies.
3. Run `apiStage5BootstrapRuntimeAndAlertsSheets()` once.
4. Run `apiStage5BootstrapAccessSheet()` once.
5. Fill `ACCESS` with roles and user keys.
6. Verify the `🧑‍💻` block in the sidebar for each user.
7. Enable protections with `apiStage5ApplyProtections({ dryRun: false })` when the access sheet is ready.

## ACCESS columns
Required columns:
- `email`
- `role`
- `enabled`
- `note`
- `display_name`
- `person_callsign`
- `user_key_current`
- `user_key_prev`
- `last_seen_at`
- `last_rotated_at`

## Migration note
The project now assumes **strict user-key access**. The only fallback left is the **explicit emergency migration bridge** controlled by script property:
- `WASB_ACCESS_MIGRATION_EMAIL_BRIDGE = true`

Leave it off in normal operation. Turn it on only during a short migration window, then turn it back off when keys are registered.

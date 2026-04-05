# WASB Runbook

## 1. Scope
This runbook covers:
- first import into the GAS web editor
- initial bootstrap
- `ACCESS` configuration
- key registration / self-bind workflow
- protections and health checks
- routine maintenance checks
- safe rollback rules

## 2. First import into GAS
1. Open the target spreadsheet-bound Apps Script project.
2. Upload all root `.gs`, `.html`, and `appsscript.json` files.
3. Do **not** upload `_extras/` into runtime. `_extras/` is reference-only.
4. Save the project.
5. Reload the Apps Script editor once to make sure all files are visible.

## 3. Initial bootstrap sequence
Run these in order:
1. `apiStage7BootstrapRuntimeAndAlertsSheets()`
2. `apiStage7BootstrapAccessSheet()`
3. fill `ACCESS`
4. `apiStage7ApplyProtections({ dryRun: true })`
5. fix any issues found by the dry run
6. `apiStage7ApplyProtections({ dryRun: false })`
7. `apiStage7QuickHealthCheck()`

Recommended final verification:
- `apiStage7HealthCheck()`
- `apiRunStage7Diagnostics({ mode: 'quick' })`

## 4. ACCESS setup
### Required columns
The sheet bootstrap creates these columns:
- `email`
- `phone`
- `role`
- `enabled`
- `note`
- `display_name`
- `person_callsign`
- `self_bind_allowed`
- `user_key_current_hash`
- `user_key_prev_hash`
- `last_seen_at`
- `last_rotated_at`
- `failed_attempts`
- `locked_until_ms`

### Setup rules
For each active user:
- set the correct `role`
- set `enabled = TRUE`
- fill `display_name` if you want a friendly UI label
- fill `person_callsign` for any user tied to a specific callsign
- fill `email` and/or `phone` if that user may use self-bind login
- set `self_bind_allowed` intentionally; do not leave the policy ambiguous
- keep the key hash columns empty until the user is actually registered or self-bound

## 5. How users are registered now
### Preferred normal path
1. User opens the sidebar.
2. The app checks whether the current temporary user key is already registered.
3. If not registered but allowed to self-bind, the login form asks for **email or phone + callsign**.
4. The server verifies the pair against `ACCESS`.
5. The server binds the **current key hash** to that record.
6. The next sidebar load should resolve the user directly by key.

### Manual admin-assisted path
Use this only for debugging or controlled setup:
1. Open the `🧑‍💻` block.
2. Reveal/copy the full current key hash only in the technical/admin view.
3. Paste it into `ACCESS.user_key_current_hash`.
4. Save and reload the sidebar.

## 6. When Google rotates a key
Expected behavior:
- the old current hash becomes the previous hash
- the new current session hash is promoted into `user_key_current_hash`
- `last_rotated_at` is updated
- `last_seen_at` is updated

If the user suddenly loses recognition:
1. check the `🧑‍💻` block
2. compare the current hash with `ACCESS`
3. confirm whether the old key is present in `user_key_prev_hash`
4. verify the account is still `enabled`
5. use `apiStage7DebugAccess()` if needed

## 7. Emergency migration bridge
Script property:
- `WASB_ACCESS_MIGRATION_EMAIL_BRIDGE = true`

Use only when:
- you are migrating from email-based identity to user-key identity
- some users are still not registered by key
- you need a short transition window to avoid access loss

After migration:
- set the property back to `false`
- verify that users resolve by key, not by bridge
- leave bridge mode disabled in normal operation

## 8. Routine post-deploy checks
### Role checks
- viewer sees the personnel list
- viewer can open only their own card
- viewer cannot open the detailed summary
- operator can use send-panel and routine work actions
- maintainer can run diagnostics and inspect state
- admin can manage access and logs
- sysadmin can run protections, trigger cleanup, and repair flows

### Infrastructure checks
- `ACCESS` exists and has the expected schema
- `ALERTS_LOG`, `AUDIT_LOG`, `JOB_RUNTIME_LOG`, `OPS_LOG`, `ACTIVE_OPERATIONS`, `CHECKPOINTS` exist
- protections are applied to the expected sheets
- quick health check is green

### Sidebar checks
- `🧑‍💻` shows the expected role and source
- the sidebar opens without implicit heavy diagnostics
- send-panel data loads when requested
- login errors do not block the form itself

## 9. Troubleshooting cheatsheet
### User is seen as guest but should not be
Check:
- `enabled`
- key hash registration
- bridge mode status
- `failed_attempts`
- `locked_until_ms`
- role spelling
- callsign/identifier match for self-bind users

### Login by identifier + callsign fails
Check:
- `email` or `phone` normalization
- `person_callsign`
- `self_bind_allowed`
- whether the record is already bound to a different key
- login lockout state

### Sidebar feels slow
Check:
- quick health first
- then full health / diagnostics
- whether a heavy route is being called on sidebar load
- whether send-panel data is being loaded too early
- whether diagnostics are being triggered automatically by UI actions

## 10. Safe rollback rule
Do **not** roll back by restoring silent role fallbacks.
If something breaks:
- fix the `ACCESS` record
- temporarily use the explicit migration bridge if truly necessary
- keep dangerous actions server-guarded

## 11. Recommended release hygiene
- keep `main` stable
- do active work in `dev`
- tag release points
- keep `CHANGELOG.md` concise and current
- archive one-off reports under `_extras/history/`

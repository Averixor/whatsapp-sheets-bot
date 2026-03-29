# WAPB Runbook

## First import into GAS
1. Create/open the target spreadsheet-bound Apps Script project.
2. Upload all root runtime files.
3. Keep `_extras/` locally or in Drive as reference; do not treat them as runtime dependencies.
4. Save the project.

## Initial bootstrap
Run in this order:
1. `apiStage5BootstrapRuntimeAndAlertsSheets()`
2. `apiStage5BootstrapAccessSheet()`
3. `apiStage5ApplyProtections({ dryRun: true })`
4. fill `ACCESS`
5. `apiStage5ApplyProtections({ dryRun: false })`

## ACCESS setup
For each user:
- set `role`
- set `enabled = TRUE`
- set `display_name`
- for `viewer`, set `person_callsign`
- paste the actual `user_key_current`
- leave `user_key_prev` for the previous rotated key if needed

## How to register a user key
1. Ask the user to open the sidebar.
2. Open the `🧑‍💻` service block.
3. Copy the current `user key`.
4. Paste it into `ACCESS.user_key_current`.
5. Save.

## When a key rotates
If the user suddenly becomes guest/safe-mode but was previously registered:
1. Ask them to open `🧑‍💻`.
2. Compare the new key with `ACCESS`.
3. If the old key is in `user_key_prev`, the system should auto-promote the new one.
4. If not, paste the new key into `user_key_current` and move the old one into `user_key_prev`.

## Emergency migration bridge
Script property:
- `WAPB_ACCESS_MIGRATION_EMAIL_BRIDGE = true`

Use only when:
- the project is being migrated from email identity to user keys
- several users are still not registered by key
- you need a short emergency window to avoid downtime

After migration:
- set the property back to `false`
- rely only on `user_key_current` / `user_key_prev`

## Post-deploy checks
- viewer sees only their own card
- viewer does not see or open the detailed summary
- operator can use send panel and summaries
- maintainer can run diagnostics but not sysadmin-only actions
- admin can manage ACCESS and read alerts
- sysadmin can run protections / triggers / repair actions
- `ALERTS_LOG`, `AUDIT_LOG`, `JOB_RUNTIME_LOG` exist
- `🧑‍💻` shows the correct role, source, registration state, and key

## Safe rollback rule
Do **not** roll back by reintroducing silent role fallbacks. If something breaks, fix the access record or temporarily enable the emergency bridge instead of guessing a role.

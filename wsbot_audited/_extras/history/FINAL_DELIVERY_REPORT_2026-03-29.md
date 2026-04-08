# FINAL DELIVERY REPORT — 2026-03-29

## Base selection
- `22.zip` was reviewed but not used as the direct base because it contained a broken state: `AccessControl.gs` and `AccessEnforcement.gs` were overwritten by a duplicate of `WorkflowOrchestrator.gs`.
- The final bundle was assembled on top of the healthy `19.zip` baseline, with only the safe and useful deltas selectively ported from `22.zip`.

## What was finalized in this pass

### 1. Strict key rotation model brought to the final form
- `Session.getTemporaryActiveUserKey()` is the primary identity source.
- Lookup order is strict: `user_key_current` -> `user_key_prev`.
- On match by `user_key_prev`, the system automatically rotates keys:
  - current key is shifted into `user_key_prev`
  - fresh session key is stored into `user_key_current`
  - `last_rotated_at` is updated
  - `last_seen_at` is updated
- Normal implicit fallback by email is disabled.
- The only remaining fallback is the explicit migration bridge controlled by script property:
  - `WASB_ACCESS_MIGRATION_EMAIL_BRIDGE = true`
- This migration bridge is intended only for short rollout windows.

### 2. Access enforcement completed end-to-end
- Viewer: only own person card, no detailed summary, no send panel, no dangerous actions.
- Operator and above: working access restored according to role level.
- Admin / Sysadmin / Owner: separated by actual privileges instead of a single broad bucket.
- Violations are routed into structured alerts/audit logging and best-effort email notifications.

### 3. Documentation consolidated
Active docs are reduced to:
- `README.md`
- `ARCHITECTURE.md`
- `RUNBOOK.md`
- `SECURITY.md`
- `CHANGELOG.md`

Historical reports and one-off notes were moved into `_extras/history/`.

### 4. Legacy cleanup
- Broken/bad access files from the newer archive were discarded.
- Branding and naming drift was normalized to the canonical `WASB` form.
- Metadata, diagnostics, smoke-tests, and physical bundle layout were aligned to the new docs structure.
- Compatibility wrappers remain only where they are still required for stability; their status is explicitly documented in the deprecated registry.

### 5. Client runtime cleanup
- Role-gated UI visibility is centralized through client helper logic and `data-role-min` policy.
- Access debug output in the `🧑‍💻` block was cleaned up and expanded with rotation state and allowed actions.
- The runtime was reduced by moving permission branching into shared helper logic instead of spreading it across handlers.

### 6. Tests
- Added `AccessE2ETests.gs` with minimal dry-run access E2E coverage.
- Smoke tests now verify:
  - consolidated doc structure
  - active changelog mapping
  - access E2E dry-run contract
  - physical presence of the new files

## Validation performed in this environment
- Static syntax validation: `74 / 74` files OK.
- Bundle naming and file layout checked.
- Text-level consistency checks for docs paths and branding performed.

## What still must be validated in the live GAS workbook
Because this container is not a live Google Apps Script runtime attached to your spreadsheet, the following must still be verified after import:
- `Session.getTemporaryActiveUserKey()` with real users
- trigger execution (`onEdit`, `onChange`)
- `MailApp` delivery
- spreadsheet protections against real editors
- role behavior in the actual sidebar session

## Delivery result
The bundle is ready for import into the Google Apps Script web editor.

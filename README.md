# WASB — Google Apps Script bundle

WASB is a spreadsheet-bound Google Apps Script bundle for personnel tracking, daily summaries, person cards, calendar views, send-panel workflows, and operational maintenance inside a single Google Sheets project.

This repository is packaged for the **GAS web editor first**:
- runtime files stay in the repository root (`.gs`, `.html`, `appsscript.json`)
- active operational documentation stays in the repository root
- this compact ZIP ships only runtime files and the five active root markdown documents

## Active release baseline
- **Stage:** 7.1
- **Release label:** Stage 7.1.2 — Security & Ops Hardened Baseline (Final Clean)
- **Identity model:** strict user-key access based on `Session.getTemporaryActiveUserKey()`
- **Current access flow:** automatic key recognition first, self-bind login by **email/phone + callsign** only when the current key is not registered
- **Runtime style:** modular HtmlService sidebar (`Sidebar.html` → `JavaScript.html` → `Js.*` chain)
- **Packaging policy:** exactly **5 active root markdown documents**

## What is active in this release
- strict user-key access with no silent fallback to elevated roles
- automatic promotion from `user_key_prev_hash` to `user_key_current_hash` when Google rotates the temporary user key
- optional emergency email bridge controlled by script property and disabled by default
- viewer hardening: viewer may see the personnel list, but may open only their own card and cannot open the detailed summary
- role-separated maintenance access: maintainer, admin, sysadmin, and owner have different server-side permissions
- lightweight sidebar bootstrap and read-only access descriptor support for faster UI startup

## Documentation map
These are the only active root markdown files:
- `README.md` — release overview, layout, quick start, document map
- `ARCHITECTURE.md` — runtime shape, canonical layers, data flow, service sheets, client/runtime policy
- `RUNBOOK.md` — import, bootstrap, access setup, deploy checks, troubleshooting, rollback rules
- `SECURITY.md` — identity, login flow, roles, lockouts, alerts, protections, security boundaries
- `CHANGELOG.md` — concise release history for maintainers

Additional documentation:
- Historical/audit materials are intentionally not shipped in this compact ZIP. Keep them in the repository history or a separate archive, not in the GAS import bundle.

## Repository layout
```text
.
├── *.gs / *.html / appsscript.json   # GAS runtime files
├── README.md                         # active docs
├── ARCHITECTURE.md
├── RUNBOOK.md
├── SECURITY.md
├── CHANGELOG.md
└── no _extras/ in this compact release ZIP
```

## Quick import checklist
1. Open the spreadsheet-bound Apps Script project.
2. Upload all root `.gs`, `.html`, and `appsscript.json` files.
3. Import only the root runtime files shipped in this ZIP; no `_extras/` files are required for GAS.
4. Run `apiStage7BootstrapRuntimeAndAlertsSheets()` once.
5. Run `apiStage7BootstrapAccessSheet()` once.
6. Fill the `ACCESS` sheet.
7. Run `apiStage7ApplyProtections({ dryRun: true })` and review the report.
8. Run `apiStage7ApplyProtections({ dryRun: false })` after `ACCESS` is correct.
9. Run `apiStage7QuickHealthCheck()`.
10. Verify the `🧑‍💻` sidebar block for each role you actually use.

## ACCESS sheet schema
The bootstrap creates these columns:
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

Notes:
- `email` and/or `phone` are used for self-bind login by identifier + callsign.
- `user_key_current_hash` and `user_key_prev_hash` store **hashes**, not raw keys.
- `person_callsign` is mandatory for viewers and for self-bind workflows tied to a callsign.
- `self_bind_allowed` should be explicitly controlled for any record that may use the self-bind flow.

## Identity and login in one minute
1. The server first tries to recognize the current session by `Session.getTemporaryActiveUserKey()`.
2. If the current key is already registered, the user is admitted by key.
3. If the key is not registered but self-bind is allowed for a matching record, the user logs in with **email or phone + callsign**.
4. The server binds the current key hash to that record.
5. If Google rotates the temporary key and the new one matches `user_key_prev_hash`, the system promotes it automatically.

Regular users do **not** need to manually copy hashes during normal operation.

## Emergency migration bridge
Script property:
- `WASB_ACCESS_MIGRATION_EMAIL_BRIDGE = true`

Keep it **off** in normal operation.
Turn it on only for a short migration window when users are moving from email-based access to user-key registration.
Turn it back off immediately after the needed keys are registered.

## High-value maintenance entrypoints
- `apiStage7QuickHealthCheck()` — shallow health report for routine checks
- `apiStage7HealthCheck()` — full health report
- `apiRunStage7Diagnostics()` — structured diagnostics report
- `apiRunStage7RegressionTests()` — regression suite entrypoint
- `apiStage7ApplyProtections()` — spreadsheet protections
- `apiStage7BootstrapRuntimeAndAlertsSheets()` — service sheet bootstrap
- `apiStage7BootstrapAccessSheet()` — `ACCESS` bootstrap

## Non-goals for this bundle
- it is not an external-backend rewrite
- it is not a framework migration
- it is not a generic multi-tenant SaaS product
- it does not treat UI visibility as the security boundary

For operational details, continue in `RUNBOOK.md`. For access and role rules, go to `SECURITY.md`.

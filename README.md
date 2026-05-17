# WASB — Google Apps Script bundle

WASB is a spreadsheet-bound Google Apps Script bundle for personnel tracking, daily summaries, person cards, calendar views, send-panel workflows, and operational maintenance inside a single Google Sheets project.

This repository is packaged for the **GAS web editor first**:

- runtime files stay in the repository root (`.gs`, `.html`, `appsscript.json`)
- active operational documentation stays in the repository root
- this compact ZIP ships only runtime files and the **five** operational root markdown documents (see Documentation map)

## Active release baseline

- **Stage:** 7.1
- **Release label:** Stage 7 — Maintenance & repository hygiene
- **Identity model:** strict user-key access based on `Session.getTemporaryActiveUserKey()`
- **Current access flow:** automatic key recognition first, self-bind login by **email/phone + callsign** only when the current key is not registered
- **Runtime style:** modular HtmlService sidebar (`Sidebar.html` → `JavaScript.html` → `Js.*` chain)
- **Packaging policy:** compact GAS bundle ships **5 operational root markdown files** (runtime docs only; see Documentation map)
- **Production status:** **CLOSED** (Stage 7.1) — [`WASB_RELEASE_AUDIT.md`](./WASB_RELEASE_AUDIT.md)

## What is active in this release

- strict user-key access with no silent fallback to elevated roles
- automatic promotion from `user_key_prev_hash` to `user_key_current_hash` when Google rotates the temporary user key
- optional emergency email bridge controlled by script property and disabled by default
- viewer hardening: viewer may see the personnel list, but may open only their own card and cannot open the detailed summary
- role-separated maintenance access: maintainer, admin, sysadmin, and owner have different server-side permissions
- lightweight sidebar bootstrap and read-only access descriptor support for faster UI startup

## Maintainer workflow

**Primary** (PowerShell profile with project aliases):

```powershell
Set-Location "C:\Users\User\Desktop\whatsapp-sheets-bot"
wcheck
wpush -Message "7"
```

**Fallback** (no aliases — same checks, standard git + clasp):

```powershell
Set-Location "C:\Users\User\Desktop\whatsapp-sheets-bot"
node .\scripts\ci-gas-sanity.mjs
node .\scripts\audit-function-graph.mjs
git add .
git commit -m "7"
git push origin main
clasp push
```

Or: `npm run ci` then commit/push/clasp as needed.

- **Script property** for headless/triggers: set **`WASB_SPREADSHEET_ID`** in Apps Script → Project settings → Script properties (see `RUNBOOK.md`).
- After **PHONES** / birthday changes: run **`apiStage7ClearPhoneCache()`** in the GAS editor, then reload the sidebar.

Full workflow, release checklist, and post-deploy checks: **`CONTRIBUTING.md`** and **`RUNBOOK.md`**.

## GitHub Actions CI

The repository runs a lightweight CI workflow on **`push`** and **`pull_request`** to **`main`**, and **`workflow_dispatch`**.

It checks:

- GAS source sanity: `node scripts/ci-gas-sanity.mjs`
- Function graph audit: `node scripts/audit-function-graph.mjs`

The workflow does not deploy to Apps Script. Deployment remains local via **`clasp push`** / **`wpush`**.

## Documentation map

**Operational set (typical compact GAS import / ZIP):**

- `README.md` — release overview, layout, quick start, document map
- `ARCHITECTURE.md` — runtime shape, canonical layers, data flow, service sheets, client/runtime policy
- `RUNBOOK.md` — import, bootstrap, access setup, deploy checks, troubleshooting, rollback rules
- `SECURITY.md` — identity, login flow, roles, lockouts, alerts, protections, security boundaries
- `CHANGELOG.md` — concise release history for maintainers

**Also in this Git repository (maintainers; usually not uploaded into the GAS editor):**

- [`WASB_RELEASE_AUDIT.md`](./WASB_RELEASE_AUDIT.md) — повний технічний аналіз WASB і фінальний статус production-релізу Stage 7.1.
- `CONTRIBUTING.md` — local workflow, fallback commands, GitHub Actions CI, commit policy, Script properties

**Other root markdown (optional / meta):**

- `CODE_OF_CONDUCT.md`, `WASB_REPAIR_NOTES.md` — policy and ad-hoc notes; not part of the GAS runtime bundle

Historical/audit materials beyond the above are kept outside the compact import ZIP when you package for GAS.

## Repository layout

```text
.
├── *.gs / *.html / appsscript.json   # GAS runtime files
├── README.md                         # ops docs (+ CONTRIBUTING.md, etc. — see Documentation map)
├── ARCHITECTURE.md
├── RUNBOOK.md
├── SECURITY.md
├── CHANGELOG.md
└── no _extras/ in compact GAS release ZIP
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

Після першого відкриття сайдбару (або явного виклику **`apiStage7BootstrapSidebar()`**) за потреби створюються порожні optional аркуші **`Дані`**, **`Проєкти`**, **`Заявки`** із заголовками й одним шаблонним рядком; якщо аркуш уже має дані, вміст не перезаписується. Див. **`RUNBOOK.md`** §18.

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

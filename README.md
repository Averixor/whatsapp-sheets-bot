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
- **Production status:** **NOT CLOSED** (smoke blocked) — [`WASB_RELEASE_AUDIT.md`](./WASB_RELEASE_AUDIT.md)

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

- **Script properties** (Apps Script → Project settings → Script properties):
  - **`WASB_SPREADSHEET_ID`** — headless/triggers (see `RUNBOOK.md` §14)
  - **`WASB_OWNER_EMAIL`** — security mail with full user key for owner
  - **`WASB_ACCESS_MIGRATION_EMAIL_BRIDGE`** — off in normal operation
  - **`WASB_ACCESS_TEMP_PASSWORD_PLAIN_LOOKUP`** — legacy plaintext temp-password lookup during migration only; off in normal operation
- After **PHONES** / birthday changes: run **`apiStage7ClearPhoneCache()`** in the GAS editor, then reload the sidebar.

Full workflow, release checklist, and post-deploy checks: **`CONTRIBUTING.md`** and **`RUNBOOK.md`**.

## GitHub Actions CI

The repository runs a lightweight CI workflow on **`push`** and **`pull_request`** to **`main`**, and **`workflow_dispatch`**.

It checks (via `npm run ci`):

- GAS source sanity, workbook + recipient contracts, function graph audit
- Client includes / JS / layer deps, XSS, envelope compat
- UseCase facade, snapshot governance, bridge flags, access API governance, OAuth scopes, jsconfig

See [`.github/workflows/ci.yml`](./.github/workflows/ci.yml) (Node 24, `actions/checkout@v5`, `actions/setup-node@v5`).

The workflow does not deploy to Apps Script. Deployment remains local via **`clasp push`** / **`wpush`**.

## Documentation map

**Operational set (typical compact GAS import / ZIP — 5 files):**

| File | Purpose |
|------|---------|
| `README.md` | Release overview, layout, quick start |
| `ARCHITECTURE.md` | Runtime shape, layers, data flow |
| `RUNBOOK.md` | Import, bootstrap, ACCESS, deploy, troubleshooting |
| `SECURITY.md` | Identity, roles, lockouts, protections |
| `CHANGELOG.md` | Release history |

**Also in Git (maintainers; not uploaded to GAS editor):**

| File | Purpose |
|------|---------|
| [`CONTRIBUTING.md`](./CONTRIBUTING.md) | Local workflow, CI, clasp, commit policy |
| [`AGENTS.md`](./AGENTS.md) | Cursor / cloud agent instructions |
| [`docs/README.md`](./docs/README.md) | Index: audits + `docs/refactor/` governance |

**Audit / release tracking:**

| File | Purpose |
|------|---------|
| [`WASB_RELEASE_AUDIT.md`](./WASB_RELEASE_AUDIT.md) | Short production status (PASS / BLOCKED / CLOSED) |
| [`WASB_FULL_TECH_AUDIT_2026-06-03.md`](./WASB_FULL_TECH_AUDIT_2026-06-03.md) | Full codebase technical audit |
| [`WASB_WORKBOOK_AUDIT_2026-06-07.md`](./WASB_WORKBOOK_AUDIT_2026-06-07.md) | Production workbook «Книга Взводу Охорони» |

**Meta:** `CODE_OF_CONDUCT.md` — community policy (not part of GAS bundle).

Historical refactor notes live under [`docs/refactor/`](./docs/refactor/). Removed: `WASB_REPAIR_NOTES.md` (one-off recovery log), `g2-governance-roadmap.md` (G2 implemented → see `contracts/client-layers.contract.json`).

## Repository layout

```text
.
├── *.gs / *.html / appsscript.json   # GAS runtime files
├── README.md                         # ops docs (see Documentation map)
├── ARCHITECTURE.md
├── RUNBOOK.md
├── SECURITY.md
├── CHANGELOG.md
├── docs/                             # governance + audit index (Git only)
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

`apiStage7BootstrapAccessSheet()` creates the full header row from `SHEET_HEADERS` in `AccessControl.Core.gs`.

**Core columns (configure per user):**

- `email`, `phone`, `role`, `enabled`, `note`, `display_name`, `person_callsign`, `self_bind_allowed`
- `user_key_current_hash`, `user_key_prev_hash`
- `registration_status` — lifecycle state (`pending_review`, `approved`, `key_sent`, `active`, `rejected`, `blocked`, `expired`); fully registered users normally need **`active`**

**System-managed columns:**

- `last_seen_at`, `last_rotated_at`, `failed_attempts`, `locked_until_ms`

**Extended registration / approval columns (optional; used by access workflows):**

- `login`, `password_hash`, `password_salt`, `preferred_contact`, `surname`, `first_name`
- `request_user_key_hash`, `request_created_at`
- `temporary_password_hash`, `temporary_password_salt`, `temporary_password_expires_at`, `temporary_password_used_at`
- `temporary_password_plain` — legacy column; not populated in normal operation (hash-only storage; plaintext shown once at request time)
- `approved_by`, `approved_at`, `activated_at`, `telegram_username`

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
- `apiStage7BootstrapSidebar()` — sidebar bootstrap + optional business sheets
- `apiStage7BootstrapRuntimeAndAlertsSheets()` — service sheet bootstrap (`ServiceSheetsBootstrap.gs`)
- `apiStage7BootstrapAccessSheet()` — `ACCESS` bootstrap

## Non-goals for this bundle

- it is not an external-backend rewrite
- it is not a framework migration
- it is not a generic multi-tenant SaaS product
- it does not treat UI visibility as the security boundary

For operational details, continue in `RUNBOOK.md`. For access and role rules, go to `SECURITY.md`.

# WASB — Google Apps Script bundle

WASB is a spreadsheet-bound Google Apps Script bundle for personnel tracking, daily summaries, person cards, calendar views, send-panel workflows, and operational maintenance inside a single Google Sheets project.

This repository is packaged for Google Apps Script through `clasp`:

- runtime files stay in the repository root (`.gs`, `.html`, `appsscript.json`)
- operational documentation stays in Git and is excluded from `clasp push`

## Active release baseline

- **Stage:** 7.1
- **Release label:** Stage 7 — Maintenance & repository hygiene
- **Identity model:** strict user-key access based on `Session.getTemporaryActiveUserKey()`
- **Current access flow:** automatic key recognition first, self-bind login by **email/phone + callsign** only when the current key is not registered
- **Runtime style:** modular HtmlService sidebar (`Sidebar.html` → `JavaScript.html` → `Js.*` chain)
- **Packaging policy:** Markdown is excluded from `clasp push`; root docs are the operational source of truth

## What is active in this release

- strict user-key access with no silent fallback to elevated roles
- automatic promotion from `user_key_prev_hash` to `user_key_current_hash` when Google rotates the temporary user key
- optional emergency email bridge controlled by script property and disabled by default
- viewer hardening: viewer may see the personnel list, but may open only their own card and cannot open the detailed summary
- role-separated maintenance access: maintainer, admin, sysadmin, and owner have different server-side permissions
- lightweight sidebar bootstrap and read-only access descriptor support for faster UI startup

## Maintainer workflow

```bash
npm ci
npm run ci
npx clasp status
npx clasp push
apiStage7ClearPhoneCache() # run in the production GAS editor
```

Use Node.js 24 (`.nvmrc`). `npm run deploy:prod` runs local CI and pushes the
production project with `executionApi.access = MYSELF`.

Remote smoke is deliberately separate from production:

```bash
cp .clasp.smoke.example.json .clasp.smoke.json
npm run deploy:smoke
```

The smoke config must target a separate non-production Apps Script project and
test spreadsheet. It stages `appsscript.smoke.json` (`executionApi: ANYONE`) in
`/tmp/wasb-smoke-bundle`; production never receives that manifest or
`GasRuntimeSmoke.gs`.

- **Script properties** (Apps Script → Project settings → Script properties):
  - **`WASB_SPREADSHEET_ID`** — headless/triggers (see `RUNBOOK.md` §15)
  - **`WASB_OWNER_EMAIL`** — security mail with full user key for owner
  - **`WASB_ACCESS_MIGRATION_EMAIL_BRIDGE`** — off in normal operation
  - **`WASB_ACCESS_TEMP_PASSWORD_PLAIN_LOOKUP`** — legacy plaintext temp-password lookup during migration only; off in normal operation
- After every production deploy and after **PERSONNEL**, **PHONES**, or birthday changes: run **`apiStage7ClearPhoneCache()`** in the GAS editor, then reload the sidebar.

Full workflow, release checklist, and post-deploy checks: **`CONTRIBUTING.md`** and **`RUNBOOK.md`**.

## GitHub Actions CI

The repository runs a lightweight CI workflow on **`push`** and **`pull_request`** to **`main`**, and **`workflow_dispatch`**.

It runs 18 checks via `npm run ci`, including:

- GAS source sanity, workbook + recipient + personnel-status contracts, function graph audit
- Client includes / JS / layer deps, XSS, envelope compat
- UseCase facade, snapshot governance, bridge flags, access API governance, OAuth scopes, jsconfig

See [`.github/workflows/ci.yml`](./.github/workflows/ci.yml) (Node 24, `actions/checkout@v5`, `actions/setup-node@v5`).

The workflow does not deploy to Apps Script. Deployment remains local via
**`npx clasp push`** or `npm run deploy:prod`.

## Documentation map

**Operational source-of-truth set:**

| File              | Purpose                                            |
| ----------------- | -------------------------------------------------- |
| `README.md`       | Release overview, layout, quick start              |
| `ARCHITECTURE.md` | Runtime shape, layers, data flow                   |
| `RUNBOOK.md`      | Import, bootstrap, ACCESS, deploy, troubleshooting |
| `SECURITY.md`     | Identity, roles, lockouts, protections             |
| `CHANGELOG.md`    | Release history                                    |

**Also in Git (maintainers; not uploaded to GAS editor):**

| File                                   | Purpose                                  |
| -------------------------------------- | ---------------------------------------- |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md) | Local workflow, CI, clasp, commit policy |
| [`AGENTS.md`](./AGENTS.md)             | Cursor / cloud agent instructions        |
| [`docs/README.md`](./docs/README.md)   | Documentation index and ownership rules  |

Contracts and snapshots are machine-readable governance artifacts under
`contracts/` and `scripts/snapshots/`. Do not commit one-off audits, production
workbook exports, personal data, or local workbook paths.

## Repository layout

```text
.
├── *.gs / *.html / appsscript.json   # GAS runtime files
├── README.md                         # ops docs (see Documentation map)
├── ARCHITECTURE.md
├── RUNBOOK.md
├── SECURITY.md
├── CHANGELOG.md
├── docs/README.md                    # documentation index (Git only)
├── contracts/                        # machine-readable policy/contracts
├── scripts/                          # local CI and governance checks
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

Після першого відкриття сайдбару (або явного виклику **`apiStage7BootstrapSidebar()`**) за потреби створюються порожні optional аркуші **`Дані`**, **`Проєкти`**, **`Заявки`** із заголовками й одним шаблонним рядком; якщо аркуш уже має дані, вміст не перезаписується. Див. **`RUNBOOK.md`** §20.

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

## PERSONNEL model

- Monthly sheets store **Callsign + schedule**; `PERSONNEL` stores person fields.
- `Callsign` is the schedule/lookup key. `FML` is the fallback display identity (synthesized from `Last name` + `First name` + `Patronymic` when the reference workbook "Книга Взводу Охорони.xlsx" layout is used; `TEMPLATE` column supplies the callsign value).
- `ID` is optional Армія+ data; `Position` is not a person key.
- Active UA statuses (dropdown, 9 values): `В наявності`, `У відрядженні`,
  `Вибув`, `Відпустка`, `Лікарняний`, `Тимчасовий`, `Гусачівка`, `БЗВП`, `СЗЧ`.
  Runtime-active (schedule, phones, cards): all except **`Вибув`** and **`СЗЧ`**.
  Empty status defaults to **`В наявності`**. Legacy labels (`Дієвий`, `Active`,
  `Відрядження`, EN) map on read only — see `PersonnelRepository.gs`.
- Runtime reads by header names and supports documented aliases (split names, TEMPLATE, OSH 4, etc.). After edits,
  run `apiStage7ClearPhoneCache()`.

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

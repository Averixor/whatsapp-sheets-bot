# WASB — Google Apps Script bundle

WASB is a spreadsheet-bound Google Apps Script bundle for personnel tracking, daily summaries, person cards, calendar views, send-panel workflows, reference directories, derived month journals, and operational maintenance inside a single Google Sheets project.

This repository is packaged for Google Apps Script through `clasp`:

- runtime files live in purpose-named folders (`api/`, `core/`, `sheets/`, `reports/`, `vacations/`, `ui/`, etc.); the repository root is for manifests and tooling config
- operational documentation stays in Git and is excluded from `clasp push`

## Active release baseline

- **Stage:** 7.1
- **Release label:** Stage 7 — Maintenance & repository hygiene
- **Identity model:** strict user-key access based on `Session.getTemporaryActiveUserKey()`
- **Current access flow:** automatic key recognition first, self-bind login by **email/phone + callsign** only when the current key is not registered
- **Runtime style:** modular HtmlService sidebar (`ui/Sidebar.html` → `ui/JavaScript.html` → `ui/Js.*` chain)
- **Packaging policy:** Markdown is excluded from `clasp push`; Git docs are the operational source of truth; nested `.gs` deploy via `!**/*.gs` in `.claspignore` (see [`docs/module-map.md`](./docs/module-map.md))

## What is active in this release

- strict user-key access with no silent fallback to elevated roles
- automatic promotion from `user_key_prev_hash` to `user_key_current_hash` when Google rotates the temporary user key
- optional emergency email bridge controlled by script property and disabled by default
- viewer hardening: viewer may see the personnel list, but may open only their own card and cannot open the detailed summary
- role-separated maintenance access: maintainer, admin, sysadmin, and owner have different server-side permissions
- lightweight sidebar bootstrap and read-only access descriptor support for faster UI startup
- derived month journal sheets per month: `ЖУРНАЛ_MM` and `ПІДСУМОК_MM`
- optional sidebar reference sheets: `PHONE_DIRECTORY` (service phones), `CAR` (vehicle register), and `WEAPON` (weapons/property register)
- inventory reconciliation sidebar (**Звірка**): month checkboxes on `INVENTORY_RECONCILIATION`, Drive document links, auto-sync index
- temporary-property register: dependent category/model dropdowns, automatic units and kit components, returns, balances, fuel details, and person-card integration
- vacation monthly sync: approved/applied vacations → month sheet `Відпус` (`vacations/VacationMonthlySync.gs`; conflicts in **Конфлікти з відпустками**)

## Maintainer workflow

**Typical two-step flow (one production GAS project):**

```bash
npm ci
npm run check              # all local verify scripts (alias: npm run ci)
git add -A && git commit -m "fix: …"
npm run push:remote        # GitHub + production clasp push (no second CI run)
apiStage7MaterializeComputedData()  # after PERSONNEL / PHONES / VACATIONS / birthday / Status changes
apiStage7MaterializeMonthJournal({ monthSheet: "07" })  # if a month journal/summary must be refreshed
apiStage7ClearPhoneCache()          # run in the production GAS editor after deploy
```

**Alternatives:**

| Command | Use when |
| -------- | -------- |
| `npm run deploy:prod` | Full CI + clasp push in one step (no git push) |
| `npm run ship -- "msg"` | Map refresh + CI + clasp push + commit + GitHub |
| `npm run gas:open` | Open the bound GAS project in the browser |

Use Node.js 24 (`.nvmrc`). `npm run deploy:prod` runs local CI and pushes the
production project with `executionApi.access = MYSELF`.

**Clasp config (local, not in git):** copy `.clasp.example.json` → `.clasp.json` once.

- **Script properties** (Apps Script → Project settings → Script properties):
  - **`WASB_SPREADSHEET_ID`** — headless/triggers (see `RUNBOOK.md` §15)
  - **`WASB_OWNER_EMAIL`** — security mail with full user key for owner
  - **`WASB_ACCESS_MIGRATION_EMAIL_BRIDGE`** — off in normal operation
  - **`WASB_ACCESS_TEMP_PASSWORD_PLAIN_LOOKUP`** — legacy plaintext temp-password lookup during migration only; off in normal operation
- After every production deploy and after **PERSONNEL**, **PHONES**, **VACATIONS**, birthday, or `Status` changes: run **`apiStage7MaterializeComputedData()`** when derived columns may be stale. If you changed a month sheet and need refreshed fact/history views, run **`apiStage7MaterializeMonthJournal({ monthSheet: "MM" })`** for that month. Then run **`apiStage7ClearPhoneCache()`** in the GAS editor and reload the sidebar.

Full workflow, release checklist, and post-deploy checks: **`CONTRIBUTING.md`** and **`RUNBOOK.md`**.

## GitHub Actions CI

The repository runs a lightweight CI workflow on **`push`** and **`pull_request`** to **`main`**, and **`workflow_dispatch`**.

It runs the full **`npm run ci`** suite (**35** Node verify/audit scripts after `npm run precheck` — see `package.json` and **RUNBOOK.md** §12), including:

- GAS sanity, clasp push patterns, **Ukrainian/Russian language** (`verify-no-russian-text.mjs`), **user-facing copy** (`verify-user-facing-copy.mjs`)
- Reference workbook layout, reference repositories, workbook contract, monthly callsign sync, send-panel bounds, temporary-property register, materialize / month-journal / age-birthday countdown
- Vacation planner, recipient, personnel-status, format-rules contracts
- Function graph audit; client includes, HTML labels, JS parse, layer deps, XSS, envelope compat
- UseCase facade, snapshot governance, bridge flags, access API governance, access policy checks, access hotfixes
- OAuth scopes, project-files map, jsconfig

See [`.github/workflows/ci.yml`](./.github/workflows/ci.yml) (CI pins Node 24; `engines.node` is `>=24`, `actions/checkout@v5`, `actions/setup-node@v5`).

The workflow does not deploy to Apps Script. Deployment remains local via
**`npm run push:remote`**, **`npm run deploy:prod`**, or **`npm run gas:push`**.

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
| [`docs/developer-guide.md`](./docs/developer-guide.md) | First-week maintainer map: layers, safe zones |
| [`docs/module-map.md`](./docs/module-map.md) | Domain folders: where GAS modules live, which CI guards them |
| [`docs/adr/002-domain-folder-map.md`](./docs/adr/002-domain-folder-map.md) | Phased folder moves (ADR-002) |
| [`docs/daily-summary-architecture.md`](./docs/daily-summary-architecture.md) | Short/detailed day summary: formula block, modules, sidebar flow |
| [`docs/vacation-planner.md`](./docs/vacation-planner.md) | Vacation planner, concurrent rules, mini-calendar UX |
| [`docs/inventory-reconciliation.md`](./docs/inventory-reconciliation.md) | Inventory month tracking, Drive folder scan, sidebar **Звірка** |
| [`docs/temporary-property-register.md`](./docs/temporary-property-register.md) | Temporary issue/return register, catalog, kits, migration |
| [`docs/user-facing-copy.md`](./docs/user-facing-copy.md) | UX copy policy; enforced by `verify-user-facing-copy.mjs` |
| [`docs/format-rules-governance.md`](./docs/format-rules-governance.md) | Manual conditional-format registry |
| [`docs/adr/003-working-domain-layout.md`](./docs/adr/003-working-domain-layout.md) | Working domain folder layout (post-#34) |

Contracts and snapshots are machine-readable governance artifacts under
`contracts/` and `scripts/snapshots/`. Do not commit one-off audits, production
workbook exports, personal data, or local workbook paths.

## Repository layout

```text
.
├── appsscript.json                   # GAS manifest (repo root only)
├── core/ api/ data/ sheets/ usecases/ ui-server/   # server runtime
├── reports/ vacations/ sendpanel/ access/ personnel/ inventory/
├── ui/                               # all .html (Sidebar, JavaScript, Js.*, Styles*)
├── tests/                            # Stage7TestRunner + domain/manual tests (deployed)
├── docs/ contracts/ scripts/         # Git-only tooling and documentation
└── README.md RUNBOOK.md ARCHITECTURE.md …
```

Runtime layout is documented in [`docs/module-map.md`](docs/module-map.md) and
[ADR-003](docs/adr/003-working-domain-layout.md). After PR #34 there are **0**
runtime `.gs` at repo root; all `.html` live in `ui/`.

## Quick import checklist

1. Open the spreadsheet-bound Apps Script project.
2. Deploy with **`clasp push`** from this repository (nested `!**/*.gs` and `!**/*.html` from all domain folders per `.claspignore`), or upload the same tree in the GAS editor.
3. Import only GAS runtime files from this repository; there is no `_extras/` folder in the compact bundle.
4. Run `apiStage7BootstrapRuntimeAndAlertsSheets()` once.
5. Run `apiSetupTemporaryPropertyRegister()` once to create or migrate the temporary-property register.
6. Run `apiStage7BootstrapAccessSheet()` once.
7. Fill the `ACCESS` sheet.
8. Run `apiStage7ApplyProtections({ dryRun: true })` and review the report.
9. Run `apiStage7ApplyProtections({ dryRun: false })` after `ACCESS` is correct.
10. Run `apiStage7QuickHealthCheck()`.
11. Verify the `🧑‍💻` sidebar block for each role you actually use.

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
- `Callsign` is the schedule/lookup key (reference xlsx: column **M** on PERSONNEL, values like `ГРАФ`). `FML` is the fallback display identity (synthesized from `Last name` + `First name` + `Patronymic`). `TEMPLATE` is legacy-only (not in the reference workbook).
- `ID` is optional Армія+ data; `Position` is not a person key.
- Active UA statuses (dropdown, 9 values): `В наявності`, `У відрядженні`,
  `Вибув`, `Відпустка`, `Лікарняний`, `Тимчасовий`, `Гусачівка`, `БЗВП`, `СЗЧ`.
  Runtime-active (schedule, phones, cards): all except **`Вибув`** and **`СЗЧ`**.
  Empty status defaults to **`В наявності`**. If the `Status` header is missing, runtime self-heal seeds it in the reference column (**Q**) or appends a safe new column before validation. Legacy labels (`Дієвий`, `Active`, `Відрядження`, EN) map on read only — see `personnel/PersonnelRepository.gs`.
- Runtime reads by header names and supports documented aliases (split names, `ID v/s`, OSH 4, legacy TEMPLATE, etc.). After edits,
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
- `apiStage7BootstrapRuntimeAndAlertsSheets()` — service sheet bootstrap (`sheets/ServiceSheetsBootstrap.gs`)
- `apiStage7BootstrapAccessSheet()` — `ACCESS` bootstrap
- `apiStage7MaterializeComputedData()` — helper columns, PHONES/BIRTHDAY/VACATIONS/panel materialize, status validation, monthly callsign sync
- `apiStage7MaterializeMonthJournal()` — derived `ЖУРНАЛ_MM` / `ПІДСУМОК_MM` for the active or requested month

## Non-goals for this bundle

- it is not an external-backend rewrite
- it is not a framework migration
- it is not a generic multi-tenant SaaS product
- it does not treat UI visibility as the security boundary

For operational details, continue in `RUNBOOK.md`. For access and role rules, go to `SECURITY.md`.

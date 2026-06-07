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
3. Import only root runtime files from this repository; there is no `_extras/` folder in the compact bundle.
4. Save the project.
5. Reload the Apps Script editor once to make sure all files are visible.

## 3. Initial bootstrap sequence

Run these in order:

1. `apiStage7BootstrapRuntimeAndAlertsSheets()` — `ServiceSheetsBootstrap.gs`
2. `apiStage7BootstrapAccessSheet()` — `AccessControl.PublicApi.gs`
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

`apiStage7BootstrapAccessSheet()` creates the full header row from `SHEET_HEADERS` in `AccessControl.Core.gs`.

**Core columns (configure per user):**

- `email`, `phone`, `role`, `enabled`, `note`, `display_name`, `person_callsign`, `self_bind_allowed`
- `user_key_current_hash`, `user_key_prev_hash`
- `registration_status`

**System-managed columns:**

- `last_seen_at`, `last_rotated_at`, `failed_attempts`, `locked_until_ms`

**Extended registration / approval columns (optional):**

- `login`, `password_hash`, `password_salt`, `preferred_contact`, `surname`, `first_name`
- `request_user_key_hash`, `request_created_at`
- `temporary_password_*` (hash/salt/expiry/used; plain column legacy and cleared on normalize), `approved_by`, `approved_at`, `activated_at`, `telegram_username`

Temporary registration codes (`WASB-…`) are shown **once** in the sidebar when the user submits a key request. Only hash + salt are written to `ACCESS`. To scrub legacy plaintext from existing rows, run **`apiStage7NormalizeAccessSheetFormatting()`** with migration plain lookup disabled.

See **`README.md`** for the full column list.

### Setup rules

For each active user:

- set the correct `role`
- set `enabled = TRUE`
- fill `display_name` if you want a friendly UI label
- fill `person_callsign` for any user tied to a specific callsign
- fill `email` and/or `phone` if that user may use self-bind login
- set `self_bind_allowed` intentionally; do not leave the policy ambiguous
- set `registration_status` to **`active`** for fully registered operational users (other values: `pending_review`, `approved`, `key_sent`, `rejected`, `blocked`, `expired`)
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
- managed triggers installed: `apiInstallStage7Jobs()` (or verify in Apps Script → Triggers)
- **`WASB_SPREADSHEET_ID`** set before relying on headless trigger runs

### Managed trigger jobs (Stage 7)

Installed by `Stage7Triggers_.installManagedTriggers()` (`Triggers.gs`):

| Handler | Schedule | Purpose |
| ------- | -------- | ------- |
| `stage7JobLifecycleRetentionCleanup` | daily 04:00 | OPS/ACTIVE/CHECKPOINTS/LOG/AUDIT retention |
| `stage7JobCleanupCaches` | daily 05:00 | cache cleanup |
| `stage7JobScheduledHealthCheck` | daily 06:00 | shallow health diagnostics |
| `stage7JobScheduledReconciliation` | daily 07:00 | reconciliation report (`dryRun`) |
| `stage7JobDailyVacationsAndBirthdays` | daily 08:00 | vacation/birthday engine |
| `stage7JobDetectStaleOperations` | every 15 min | stale lifecycle operations |
| `stage7SecurityAuditOnEdit` | on edit | protected sheet edit audit |
| `stage7SecurityAuditOnChange` | on change | structural change audit |

Time-based handlers run with **system trigger context** (`actorRole: system`, not user `guest`). After deploy, run one handler manually from the GAS editor (e.g. `stage7JobScheduledHealthCheck()`) and confirm **no** spurious `WASB SECURITY ATTENTION` alerts for blocked guest access.

Spreadsheet audit handlers are different: `stage7SecurityAuditOnEdit` and `stage7SecurityAuditOnChange` inspect the editor from the event and may intentionally write `WASB SECURITY ATTENTION` for unauthorized protected-sheet edits or structural changes. They do not use the system actor as an access bypass.

Manual replay from maintenance API: `apiRunStage7Job(jobName, { trigger: false })` — requires **sysadmin** session; does **not** use system context.

### Sidebar checks

- `🧑‍💻` shows the expected role and source
- the sidebar opens without implicit heavy diagnostics
- send-panel data loads when requested
- login errors do not block the form itself

## 9. Troubleshooting cheatsheet

### Scheduled job fires `WASB SECURITY ATTENTION` as guest

Symptom: time-based trigger (e.g. daily vacations) logs access violation with role **Гість** / identification **недоступно**.

Check:

- job is launched via `stage7Job*` handler or `Stage7Triggers_.runJob(..., { trigger: true })`, not a raw use-case call without system context
- payload includes `allowSystem: true`, `isSystemTrigger: true`, `actorRole: "system"`
- guarded use cases (e.g. `checkVacationsAndBirthdays`) receive descriptor from `AccessEnforcement_.buildSystemTriggerAccessDescriptor`
- **`WASB_SPREADSHEET_ID`** is set for headless runs

Fix path: redeploy `Triggers.gs`, `AccessEnforcement.gs`, `UseCases.Maintenance.gs`; re-run `stage7JobDailyVacationsAndBirthdays()` from the GAS editor.

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
- keep one-off reports outside this compact GAS import ZIP

## 12. Release checklist (GitHub + Apps Script)

### GitHub Actions CI

The repository runs CI automatically on **`push`** and **`pull_request`** to **`main`**, and **`workflow_dispatch`**.

Local equivalent: **`npm run ci`** (or `wcheck` if configured).

| Script | Purpose |

|--------|---------|
| `ci-gas-sanity.mjs` | Syntax check all `.gs` files |
| `audit-function-graph.mjs` | Bound entrypoint refs vs definitions |
| `verify-client-includes.mjs` | `JavaScript.html` include order |
| `verify-client-js.mjs` | Combined sidebar client parse-check |
| `verify-client-deps.mjs` | Client layer graph / cross-layer refs (`contracts/client-layers.contract.json`) |
| `audit-client-xss.mjs` | Unsafe `innerHTML` / `setHtml` interpolations |
| `audit-envelope-compat.mjs` | Server envelope + client adapters + transport bridge |
| `verify-usecase-facade.mjs` | `Stage7UseCases_` contract vs snapshot |
| `verify-snapshot-governance.mjs` | Snapshot mutations require `contracts/SNAPSHOT_CHANGELOG.md` + metadata |
| `verify-bridge-flags.mjs` | `USE_NEW_API_PATH` registry vs codebase (`contracts/bridge-flags.registry.json`) |
| `verify-jsconfig.mjs` | `jsconfig.json` include/exclude globs resolve to tsserver inputs |

There is **no** Apps Script deployment in CI (`clasp` is local only). See `.github/workflows/ci.yml`.

---

1. Run local checks (`wcheck` or `npm run ci`, or the two `node scripts/...` commands—see `CONTRIBUTING.md`).
2. Confirm `audit-function-graph` ends with **`MISSING: none`**.
3. Commit using the **current version string** for release drops (example: **`7`**). Avoid vague messages for version cuts.
4. **`git push origin main`**.
5. **`clasp status`** then **`clasp push`** — GitHub alone does not update the bound script project.
6. In Apps Script → **Project settings → Script properties**: ensure **`WASB_SPREADSHEET_ID`** is set if you rely on triggers/headless runs (use your production spreadsheet ID).
7. Reload the spreadsheet UI; close and reopen the sidebar.
8. Run smoke when appropriate (see §13 — `npm run gas:smoke` or manual editor checks).
9. After **`PERSONNEL`** structure or data changes (see §15a): run **`apiStage7ClearPhoneCache()`**, then re-check a person card and personnel modal.

## 13. Post-deploy checks

### Production runtime smoke (automated via clasp)

After `clasp push`, run remote GAS smoke from the repo root (Node 24 + `clasp login`):

```bash
npm run gas:smoke
```

Entrypoint: **`apiRunProductionSmokeChecks`** in `GasRuntimeSmoke.gs` (bundled with `clasp push`).

Full deploy flow:

```bash
npm run deploy:prod
```

(`npm run ci` → `clasp push` → `npm run gas:smoke`)

**Expectations:**

| Field | Expected |
| ----- | -------- |
| `ok` | `true` |
| `checks.migrationFlag` | not `'true'` (null/empty OK) |
| `checks.clientSignal.success` | `true` |
| `checks.clientSignal.data.result.emailSent` | `false` |
| `checks.clientSignal.data.result.alertLogged` | `true` |
| `checks.accessPolicy.ok` | `true` (or `OK_WITH_SKIPS` status without FAIL) |

**Troubleshooting `clasp run`:**

- Enable **Apps Script API** for the Google account / Cloud project used by clasp.
- `clasp login` — refresh OAuth if expired.
- `appsscript.json` must include `"executionApi": { "access": "ANYONE" }`.
- Run `clasp push` before smoke; create/update **API executable** deployment if required by the script project.

### Manual GAS functions (editor)

Run from the Apps Script editor when relevant after a deploy or config change:

- `apiStage7GetAccessDescriptor()` — lightweight descriptor sanity
- `apiStage7DebugAccess()` — access debug payload
- `runAccessPolicyChecks()` — access policy assertions
- `runSmokeTests()` — smoke bundle
- `apiStage7ClearPhoneCache()` — invalidate phone/profile/PERSONNEL caches (required after **PERSONNEL** or **PHONES** edits)

## 15a. PERSONNEL sheet (canonical people data)

**Rule:** monthly sheet = **Callsign + schedule**; **PERSONNEL** = all person fields; **Status** = activity filter.

### Final header row (row 1)

`ID | FML | Birthday | Age | Days_until_birthday | Phone | 2_Phone | Callsign | Title | Position | OSH_4 | Unit | Status`

Column order may vary; code reads by **header names**, not column index.
Required headers: `FML`, `Birthday`, `Phone`, `2_Phone`, `Callsign`, `Title`, `Position`, `OSH_4`, `Status`.
`ID`, `Age`, `Days_until_birthday`, and `Unit` are recommended but optional; `Age` / `Days_until_birthday` may be computed helper columns.

### One-time / migration in the spreadsheet

1. Add column **`Status`** if missing (or run **`apiStage7BootstrapRuntimeAndAlertsSheets`** / self-heal to seed headers on empty `PERSONNEL`).
2. For everyone on duty: leave **`Status` empty** or set **`Дієвий`** (both count as active). **`Тимчасовий`** and **`Відрядження`** also stay in runtime lists. Do **not** mix EN/UA in the same column.
3. For departed personnel (including transferred out of the unit): set **`Вибув`** — do not delete the row immediately unless you prefer a hard delete. Do **not** use **`Переведений`** (legacy values map to **`Вибув`** on read).

**Data validation (dropdown):** apply to the **whole** Status column from row 2, e.g. `PERSONNEL!M2:M`, not a single cell like `M10`. After deploy, run **`applyPersonnelStatusColumnValidation()`** in the Apps Script editor, or **`ensureSystemSheetByName_('PERSONNEL')`** / bootstrap self-heal to apply the list automatically.

**`ID`** (Армія+) may stay empty or temporary; it is not required for cards, schedule, phones, or birthdays.

### After `clasp push` (mandatory)

In Apps Script editor (or maintenance menu):

```text
apiStage7ClearPhoneCache()
```

Then reload the spreadsheet and reopen the sidebar. Verify one **person card**, **personnel modal** (callsign list), and **SEND_PANEL** row.

Optional: `npm run gas:smoke` or `apiStage7QuickHealthCheck()` — health fails on duplicate **active** Callsign values.

## 14. Script properties

Canonical resolver (**`DataAccess.gs`**):

| Property | Purpose |
| -------- | ------- |
| **`WASB_SPREADSHEET_ID`** | Target spreadsheet for headless runs (triggers, executions without open UI). Required when no container spreadsheet context exists. |
| **`WASB_OWNER_EMAIL`** | Owner email for security notifications that may include the full user key. Quick health warns if unset. |
| **`WASB_ACCESS_MIGRATION_EMAIL_BRIDGE`** | Emergency email bridge during migration only. Keep disabled (`false` / unset) in normal operation. |
| **`WASB_ACCESS_TEMP_PASSWORD_PLAIN_LOOKUP`** | Legacy plaintext temp-password column lookup during migration only. Keep disabled in normal operation; run `apiStage7NormalizeAccessSheetFormatting()` to clear `temporary_password_plain`. |

If **`WASB_SPREADSHEET_ID`** is unset, the code falls back to **`SpreadsheetApp.getActiveSpreadsheet()`** when the script is bound and a spreadsheet context exists.

Headless executions (scheduled triggers without an open UI) **require** `WASB_SPREADSHEET_ID`, or they fail with a clear error.

Do **not** hardcode production spreadsheet IDs in source files; use Script properties instead.

## 15. PHONES cache and birthday (ДН)

Runtime prefers **`PERSONNEL`** for phones/profiles when the sheet has data; **PHONES** remains a legacy fallback.

After editing **PERSONNEL**, **PHONES**, or birthday logic, run **`apiStage7ClearPhoneCache()`**, then reopen the sidebar and verify person cards (**ДН** / phone).

Operational detail: **`loadPhonesIndex_()`** builds from **PERSONNEL** (active rows) when available (`PersonnelRepository.gs`); otherwise from **PHONES** headers (`Stage7PhoneDictPayloadShims.gs`).

## 19. Operational stewardship (refactor doctrine)

See **`docs/refactor/operational-stewardship.md`** for owner/backup roles, monthly checklist, handoff, and emergency exceptions.

| Item | Location |

|------|----------|
| Owner / backup | `docs/refactor/operational-stewardship.md` — update on handoff |
| **Contracts (G1)** | `contracts/` — envelope, facade, access, bridge-flags, xss-policy, client-includes |
| **Client layers (G2)** | `contracts/client-layers.contract.json` + `scripts/verify-client-deps.mjs` |
| Envelope migration | `contracts/envelope-migration.contract.json` — version bump checklist |
| Snapshot governance | `docs/refactor/snapshot-governance.md`, `contracts/SNAPSHOT_CHANGELOG.md` |
| Canary spreadsheet | Script Property `WASB_CANARY_SPREADSHEET_ID` (non-production; owner-maintained) |
| Facade contract CI | `contracts/facade.contract.json` + `scripts/snapshots/stage7-usecases-facade.json` + `npm run ci` |
| Access baseline | `contracts/access.contract.json` + `scripts/snapshots/access-debug-baseline.json` (capture from `apiStage7DebugAccess()` on canary) |
| Access baseline bootstrap | `scripts/bootstrap-access-baseline.mjs` — merge canary JSON via `ACCESS_DESCRIPTOR_JSON=...` (descriptor stays `null` until capture) |
| Bridge flags | `contracts/bridge-flags.registry.json` — `USE_NEW_API_PATH` owner/sunset/telemetry |
| Entropy review | `docs/refactor/entropy-review-YYYY-QN.md` (quarterly; latest: `entropy-review-2026-Q2.md`) |
| Rollback tags | `wasb-pre-pr7-*`, `wasb-pre-phase2-access` before high-risk merges |

**Cadences:** monthly stewardship checklist (~30 min); quarterly entropy + canary parity (~2 h).

**Freeze window:** no `blast-radius-high` merges Fri 16:00 – Mon 10:00 local, or during send-panel peak / month rollover (owner may mark additional freeze periods here).

## 20. Canary spreadsheet (refactor / runtime PR gate)

Permanent non-production copy for automated and manual smoke before runtime-critical merges (`requires-canary`, PR3+).

### Setup

1. Create or designate a **separate spreadsheet** (never production).
2. In the **canary** Apps Script project → Script properties: set **`WASB_CANARY_SPREADSHEET_ID`** to that spreadsheet ID.
3. Set **`WASB_SPREADSHEET_ID`** on the canary deployment to the same ID (headless runs).
4. Reduced dataset: 2–3 monthly sheets, minimal `SEND_PANEL`, synthetic `ACCESS` rows.
5. Synthetic edge cases: guest / operator / admin roles, incomplete registration, empty panel row.

Do **not** commit production spreadsheet IDs to source; record the canary ID only in Script properties and owner notes.

### Smoke flows (after PR3, PR6, PR7+)

Run on canary before merging `requires-canary` PRs:

| Flow | API / action |

|------|----------------|
| Generate panel | `generateSendPanelForDate` |
| Calendar load | `loadCalendarDay` |
| Person card | `openPersonCard` |
| Access policy | `apiStage7DebugAccess` |
| Maintenance | `runMaintenanceScenario` (shallow health) |

Gate: canary smoke **PASS** before merge of runtime-critical PRs.

### Quarterly canary parity review

Every **3 months** or after major production change (owner + backup):

| Check | Action |

|-------|--------|
| Schema drift | Compare `SheetSchemas` / ACCESS columns canary vs production |
| New edge cases | Add synthetic rows from production incidents (anonymized) |
| Role matrix | Verify guest / operator / admin / incomplete registration |
| Smoke flows | Re-run full canary automation; refresh `access-debug-baseline.json` if needed |

If parity review is **overdue > 90 days**, block merge of `rollback-required` PRs until refresh (see `docs/refactor/entropy-review-checklist.md`).

## 16. Legacy aliases (removed)

`LegacyApiAliases.gs`, `LegacyMaintenanceAliases.gs`, and `Stage7LegacyFunctionShims.gs` were **removed**. Canonical surface:

- Application / maintenance: `apiStage7*` in `Stage7ServerApi.gs` / `Stage7MaintenanceApi.gs`
- Sidebar `google.script.run` entry points: `SidebarServer.gs` (`getMonthsList`, `generateSendPanelSidebar`, …)
- Removed-global inventory: `DeprecatedRegistry.gs` → `findPresentLegacyApiGlobals_()`, `getRemovedLegacyApiNames_()`

Do **not** reintroduce `apiStage4*` / `apiGet*` globals. Before adding any alias, verify **all** of the following:

1. No HTML/sidebar/client call references the alias.
2. `node scripts/audit-function-graph.mjs` reports **`MISSING: none`** after the removal.
3. Historical/manual GAS entrypoints have documented Stage7 replacements.
4. **`DeprecatedRegistry.gs`** marks the alias as removable (replacement and sunset conditions recorded).
5. At least **one release** has passed after documentation of the replacement.

**Current policy:**

- **Stage4/5 maintenance aliases:** **KEEP** until external/manual callers are migrated.
- **Legacy non-staged API aliases:** **DEPRECATE_DOC_ONLY** in operational docs; remove only after migration verification.
- **Sidebar / global compatibility shims:** **KEEP** unless verified unused by UI and manual calls.
- **Deprecated helper wrappers** (listed in **`DeprecatedRegistry.gs`**, e.g. `escapeHtml_`, `_parseUaDate_`): **REMOVE_LATER** only after a dedicated helper cleanup and parity tests.
- **Diagnostics compatibility checks:** **KEEP**; they guard the sunset process.

For day-to-day operations, prefer calling **`apiStage7*`** and documented Stage7 routes from §13 and **`CONTRIBUTING.md`**.

## 17. Reflective helpers: eval / `Function('return this')` (P2.e audit)

| Location                         | Usage                                                                                                                                | Role                               | Risk                                        | Decision                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------- |
| **`Stage7TestRunner.gs`**        | ~~`eval(name)`~~ removed; explicit registry **`getStage7TestRunnerExplicitRegistry_()`** + **`globalThis[name]`** for discovery only | Manual / menu test runner          | Was **medium** (string eval); now **lower** | **DONE (P2.e)** — registered task names bind to real functions; no runtime `eval` |
| **`SmokeTests.gs`**              | `Function("return this")()` only if `globalThis` is unavailable                                                                      | Smoke / symbol resolution fallback | Low in V8 (branch rarely taken)             | **DEFER** — replace only if a zero-`Function` pattern is validated on all hosts   |
| **`Diagnostics.Core.gs`**        | `_global_()` → `Function('return this')()`                                                                                           | Diagnostics global scope           | Low                                         | **DEFER**                                                                         |
| **`Diagnostics.Stage7.Core.gs`** | `_diagGlobal_()` → same pattern after `globalThis`                                                                                   | Stage7 diagnostics                 | Low                                         | **DEFER**                                                                         |

Do **not** reintroduce `eval` for resolving test or handler names; extend **`getStage7TestRunnerExplicitRegistry_()`** when adding fixed registry tasks.

## 18. Optional business sheets (Дані / Проєкти / Заявки)

Ці три аркуші **не** створюються «ядром» bootstrap сервісних таблиць (`apiStage7BootstrapRuntimeAndAlertsSheets`). Вони підтягуються окремо:

- **`apiStage7BootstrapSidebar()`** (`Stage7ServerApi.gs`) викликає **`_ensureOptionalBusinessSheetsQuiet_()`**: якщо аркуша немає — вставляє його; якщо аркуш **повністю порожній** (`getLastRow() < 1`) — записує заголовки, один шаблонний рядок і базове оформлення (frozen row 1, жирний заголовок, фон `#eef2ff`, `autoResizeColumns` де можливо).

Якщо аркуш уже існує і містить хоч один рядок даних, **`ensure*`** його **не перезаписує** — правити структуру доведеться вручну або через окремі утиліти.

### «Дані» (`MonthlyReport.gs`, `MonthlyReport_.ensureDataSheet_`)

Заголовки колонок: **Дата**, **Подія / опис**, **Проєкт**, **Категорія**, **Кількість / години**, **Примітки**. Шаблонний другий рядок містить дату **01.01.2000**, щоб вона не потрапляла в звичні місячні вікна звітів.

### «Проєкти» (`ProjectRequests_.ensureProjectsSheet_`)

Заголовки: **id**, **проєкт**, **активний**, **email менеджера**. Шаблон другого рядка має **`активний = false`**, тому **`readProjects_`** його не показує у сайдбарі, доки не заміниш дані й не увімкнеш активність.

### «Заявки» (`ProjectRequests_.ensureRequestsSheet_`)

Заголовки рядка 1 збігаються з порядком **`appendRow`** у **`apiSubmitRequest`**: **timestamp**, **user_email**, **project_id**, **project_name**, **title**, **details**, **dedupe_key**, **status**. Шаблон: **`dedupe_key`** = `wasb-template-row-v1`, **`status`** = `template`; **`findDuplicate_`** сканує колонку dedupe по всіх даних рядках до останнього заповненого рядка.

### Перевірка

У **`runSmokeTests()`** є крок **«Optional business sheets ensured …»** (`SmokeTests.gs`): ті самі **`ensure*`** потім перевіряють, що всі три назви існують (`skipOnError`).

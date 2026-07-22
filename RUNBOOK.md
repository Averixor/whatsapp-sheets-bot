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
- debug decision tree for incidents (see §9)

## 2. First import into GAS

1. Open the target spreadsheet-bound Apps Script project.
2. Deploy with **`clasp push`** from this repository (all domain `**/*.gs` and `ui/**/*.html` per `.claspignore`), or upload the same tree in the GAS editor.
3. Import only GAS runtime files from this repository; there is no `_extras/` folder in the compact bundle.
4. Save the project.
5. Reload the Apps Script editor once to make sure all files are visible.

## 3. Initial bootstrap sequence

Run these in order:

1. `apiStage7BootstrapRuntimeAndAlertsSheets()` — `sheets/ServiceSheetsBootstrap.gs`
2. `apiStage7BootstrapAccessSheet()` — `access/AccessControl.PublicApi.gs`
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
- operator can open person cards and build short/detailed summaries
- maintainer can use SEND_PANEL, working actions, diagnostics, and inspect state
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

Installed by `Stage7Triggers_.installManagedTriggers()` (`operations/Triggers.gs`):

| Handler                               | Schedule     | Purpose                                    |
| ------------------------------------- | ------------ | ------------------------------------------ |
| `stage7JobLifecycleRetentionCleanup`  | daily 04:00  | OPS/ACTIVE/CHECKPOINTS/LOG/AUDIT retention |
| `stage7JobCleanupCaches`              | daily 05:00  | cache cleanup                              |
| `stage7JobScheduledHealthCheck`       | daily 06:00  | shallow health diagnostics                 |
| `stage7JobScheduledReconciliation`    | daily 07:00  | reconciliation report (`dryRun`)           |
| `stage7JobDailyVacationsAndBirthdays` | daily 08:00  | vacation/birthday engine                   |
| `stage7JobDetectStaleOperations`      | every 15 min | stale lifecycle operations                 |
| `stage7SecurityAuditOnEdit`           | on edit      | protected sheet edit audit                 |
| `stage7SecurityAuditOnChange`         | on change    | structural change audit                    |

Time-based handlers run with **system trigger context** (`actorRole: system`, not user `guest`). After deploy, run one handler manually from the GAS editor (e.g. `stage7JobScheduledHealthCheck()`) and confirm **no** spurious `WASB SECURITY ATTENTION` alerts for blocked guest access.

Spreadsheet audit handlers are different: `stage7SecurityAuditOnEdit` and `stage7SecurityAuditOnChange` inspect the editor from the event and may intentionally write `WASB SECURITY ATTENTION` for unauthorized protected-sheet edits or structural changes. They do not use the system actor as an access bypass.

Manual replay from maintenance API: `apiRunStage7Job(jobName, { trigger: false })` — requires **sysadmin** session; does **not** use system context.

### Sidebar checks

- `🧑‍💻` shows the expected role and source
- the sidebar opens without implicit heavy diagnostics
- send-panel data loads when requested
- login errors do not block the form itself

## 9. Troubleshooting

Операційна карта для maintainer: [developer-guide.md](./docs/developer-guide.md) (шари системи, перший тиждень). Нижче — маршрут під час інциденту та вузькі сценарії.

### Debug decision tree: швидкий маршрут під час інциденту

Цей підрозділ потрібен, коли система поводиться неправильно, а часу на повний аналіз немає. Мета — швидко визначити шар: UI, `api*`, `AccessEnforcement_`, `AccessControl_`, дані в аркушах або deploy/config.

#### Базове правило

Не починати з випадкового редагування ACCESS, PERSONNEL або коду. Спочатку — симптом → шар → файл або аркуш.

```text
Симптом
  ↓
Який api* / сценарій викликано?
  ↓
Це проблема дозволу дії чи розпізнавання користувача?
  ↓
Перевірити відповідний шар:
  - UI / Sidebar
  - api* endpoint
  - AccessEnforcement_
  - AccessControl_
  - ACCESS / PERSONNEL / місячний аркуш
  - Script Properties / deploy / cache
```

#### 1. Користувач не входить / бачить guest / не розпізнається

**Ймовірний шар:** `AccessControl_` + аркуш ACCESS.

**Не починати з:** `AccessEnforcement_`, sidebar-кнопок, ручного переписування ролей у коді.

**Перевірити:**

- чи є користувач в ACCESS;
- чи коректний ключ / phone / callsign;
- чи немає помилки в статусі або ролі;
- чи не застарів cache після deploy;
- чи коректні Script Properties.

**Типовий маршрут:**

```text
guest / login fail
  → AccessControl_
  → AuthResolver / ACCESS lookup
  → ACCESS row
  → cache / script properties
```

**Команди / дії:** `npm run ci` (локально, якщо підозра на код). У GAS: `apiStage7DebugAccess()`, `apiStage7QuickHealthCheck()`.

#### 2. Користувач входить, але дія заборонена

Приклад: бачить систему, але не може відкрити картку, зведення, send panel або дію з персоналом.

**Ймовірний шар:** `api*` + `AccessEnforcement_`.

**Не починати з:** зміни ролі в ACCESS, зміни UI, видалення guard'ів, ручного обходу перевірок.

**Перевірити:**

- який саме сценарій викликано;
- який `api*` відповідає за дію;
- який guard / assertion на endpoint;
- чи дія дозволена цій ролі;
- чи це не очікувана поведінка (UI приховав правильно).

**Типовий маршрут:**

```text
"Недостатньо прав"
  → визначити api*
  → AccessEnforcement_
  → assertCan... (картка, send panel, summary)
  → role/action policy
  → тільки потім ACCESS
```

**Важливо:** якщо UI приховав кнопку — це не обов'язково баг. Server-side guard залишається джерелом правди.

#### 3. Кнопки немає в sidebar

**Ймовірний шар:** UI / `Js.*` + server permissions.

**Не починати з:** зміни `AccessControl_`, обхідного endpoint, ручного відкриття забороненої дії.

**Перевірити:**

- чи роль повинна бачити кнопку;
- чи UI отримав context (`apiStage7GetAccessDescriptorLite`, bootstrap);
- чи endpoint у `contracts/access-api.contract.json`;
- чи server guard дозволяє дію;
- чи не зламані client includes (`npm run ci:client`).

**Типовий маршрут:**

```text
немає кнопки
  → Js.* / sidebar rendering
  → user context
  → api* contract
  → AccessEnforcement_
```

#### 4. Дані неправильні: ПІБ, телефон, callsign, статус

**Ймовірний шар:** PERSONNEL + cache.

**Не починати з:** `AccessEnforcement_`, зміни endpoint, зміни guard marker.

**Перевірити:**

- рядок у PERSONNEL (Email у колонці L, Callsign у колонці M, Status українською);
- телефон / `2_Phone`;
- після змін даних або deploy — **`apiStage7ClearPhoneCache()`**.

**Типовий маршрут:**

```text
не той телефон / ПІБ / callsign
  → PERSONNEL
  → нормалізація ключів
  → phone cache
  → повторна перевірка UI
```

#### 5. Зведення дня неправильне

**Ймовірний шар:** `Report_*` + формульний блок на місячному аркуші.

**Не починати з:** ручного PERSONNEL без потреби, зміни AccessControl, зміни sidebar.

**Перевірити:**

- правильна дата і колонка дня;
- формульний блок, рядок `За_списком`, `За_штатом` над ним;
- порядок labels;
- `npm run ci:workbook`.

**Типовий маршрут:**

```text
неправильне зведення
  → reports/Report_SummaryData.gs / reports/Report_DailySimple.gs
  → дата / колонка
  → formula block
  → verify-workbook-contract
```

Деталі: [daily-summary-architecture.md](./docs/daily-summary-architecture.md).

#### 6. Відпустки / міні-календар працюють неправильно

**Ймовірний шар:** Vacation modules + `VACATIONS` / `VACATION_CHECK` / `VACATION_SCHEDULE`.

**Перевірити:**

- обраний місяць у UI (навігація ◀/▶ передає `{ year, month }`);
- обмеження одночасних відпусток (max 3, overload ≤3 дні);
- проблемні / навантажені дати;
- `npm run ci:vacations`.

**Типовий маршрут:**

```text
помилка у відпустках
  → vacation UI (`ui/Js.Vacations.*.html` partials)
  → vacations/VacationPlannerService.gs, vacations/VacationMonthCalendar.gs
  → selected month
  → VACATIONS / VACATION_REQUESTS
  → planner suggestions
```

Деталі: [vacation-planner.md](./docs/vacation-planner.md).

#### 7. Після deploy усе «раптово зламалось»

**Ймовірний шар:** deploy / config / cache.

**Не починати з:** масового редагування коду, переписування ACCESS, видалення guards.

**Перевірити (у такому порядку):**

1. `npm run ci` локально.
2. `clasp status` — правильний script project.
3. Script Properties: `WASB_SPREADSHEET_ID`, `WASB_OWNER_EMAIL`.
4. ACCESS bootstrap не зламаний.
5. **`apiStage7MaterializeComputedData()`** після змін PERSONNEL / PHONES / Birthday / VACATIONS або коли потрібно оновити вік, дні до ДН, відпусткові колонки та **синхронізацію відпусток із місячним графіком** (автозаповнення порожніх клітинок; конфлікти — у панелі **Конфлікти з відпустками**).
6. **`apiStage7ClearPhoneCache()`** після кожного production deploy (лише інвалідація кешу телефонів).
7. `apiStage7QuickHealthCheck()` / `apiStage7HealthCheck()`.
8. contract parity (`verify-access-api-governance` у CI).

**Типовий маршрут:**

```text
після deploy все зламалось
  → npm run ci
  → clasp / remote
  → Script Properties
  → ACCESS bootstrap
  → apiStage7MaterializeComputedData()   # якщо змінювали довідники / відпустки
  → apiStage7ClearPhoneCache()
  → health check
```

Повний checklist: §12–§13.

#### 8. Додали новий `api*`, CI впав

**Ймовірний шар:** governance / contracts.

**Перевірити:**

- public чи excluded (`contracts/access-api.contract.json`);
- server-side guard marker для non-guest endpoints;
- немає дубля endpoint;
- `npm run ci` зелений (recursive `api*` scan).

**Типовий маршрут:**

```text
новий api* → CI fail
  → public або excluded + reason
  → оновити contract + ProjectMetadata role policy
  → guard marker
  → npm run ci
```

#### 9. Коротка таблиця «симптом → шар»

| Симптом | Перший шар | Не чіпати першим |
| -------- | ----------- | ----------------- |
| Guest / не входить | `AccessControl_`, ACCESS | `AccessEnforcement_` |
| «Недостатньо прав» | `api*`, `AccessEnforcement_` | PERSONNEL |
| Немає кнопки | UI / `Js.*`, user context | ролі в коді |
| Не той телефон / ПІБ | PERSONNEL, phone cache | guards |
| Неправильне зведення | `Report_*`, formula block | ACCESS |
| Проблеми з відпустками | Vacation modules, vacation sheets | access layer |
| Після deploy усе зламалось | config, clasp, properties, cache | масовий refactor |
| CI впав на `api*` | contract parity, guard markers | runtime logic |

#### 10. Правило зупинки

Якщо причина не знайдена за 15–20 хвилин — не робити хаотичні правки. Зафіксувати:

1. Симптом
2. Хто користувач / роль
3. Який сценарій
4. Який `api*`
5. Який guard
6. Який аркуш зачеплено
7. Що вже перевірено
8. Останній deploy / commit

Продовжувати від конкретного шару, а не «перекопувати весь проєкт».

### Scheduled job fires `WASB SECURITY ATTENTION` as guest

Symptom: time-based trigger (e.g. daily vacations) logs access violation with role **Гість** / identification **недоступно**.

Check:

- job is launched via `stage7Job*` handler or `Stage7Triggers_.runJob(..., { trigger: true })`, not a raw use-case call without system context
- payload includes `allowSystem: true`, `isSystemTrigger: true`, `actorRole: "system"`
- guarded use cases (e.g. `checkVacationsAndBirthdays`) receive descriptor from `AccessEnforcement_.buildSystemTriggerAccessDescriptor`
- **`WASB_SPREADSHEET_ID`** is set for headless runs

Fix path: redeploy `operations/Triggers.gs`, `access/AccessEnforcement.gs`, `usecases/UseCases.Maintenance.gs`; re-run `stage7JobDailyVacationsAndBirthdays()` from the GAS editor.

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
- do active work on short-lived feature branches (merge into `main`; there is no long-lived remote `dev` branch)
- tag release points
- keep `CHANGELOG.md` concise and current
- keep one-off reports outside this compact GAS import ZIP

## 12. Release checklist (GitHub + Apps Script)

### GitHub Actions CI

The repository runs CI automatically on **`push`** and **`pull_request`** to **`main`**, and **`workflow_dispatch`**.

Local equivalent: **`npm run check`** (alias **`npm run ci`**).

| Script                                    | Purpose                                                                                |
| ----------------------------------------- | -------------------------------------------------------------------------------------- |
| `verify-node-version.mjs`                 | Node `>=24` engine gate (`precheck`; honors explicit `<` / `<=` if set)                |
| `ci-gas-sanity.mjs`                       | Syntax check all `.gs` files                                                           |
| `verify-clasp-push-patterns.mjs`          | `.claspignore` / push patterns (also runs `verify-inventory-reconciliation.mjs`)       |
| `verify-no-russian-text.mjs`              | Ban Russian markers in project text                                                    |
| `verify-user-facing-copy.mjs`             | Ban technical tokens in user-visible copy (`contracts/user-facing-copy.contract.json`) |
| `verify-reference-workbook-layout.mjs`    | Reference xlsx header layout contract                                                  |
| `verify-reference-repositories.mjs`       | `PHONE_DIRECTORY` / `CAR` / `WEAPON` parser semantics and workbook coverage            |
| `verify-workbook-contract.mjs`            | Monthly layout geometry, formula-block short summary, detailed summary grouping        |
| `verify-monthly-callsign-sync.mjs`        | PERSONNEL → monthly «Позивні» sync contract                                            |
| `verify-send-panel-bounds.mjs`            | SEND_PANEL row bounds contract                                                         |
| `verify-temporary-property-register.mjs`  | Temporary-property register headers, catalog/kits, status math (`ci:workbook`)         |
| `verify-materialize-computed-data.mjs`    | PERSONNEL materialize / computed columns API contract                                  |
| `verify-month-journal-materialize.mjs`    | `ЖУРНАЛ_MM` / `ПІДСУМОК_MM` wiring, API, access, sidebar                               |
| `verify-age-birthday-countdown.mjs`       | Birthday `DD.MM.YYYY р. н.`, Age `N р.`, countdown UA labels                           |
| `verify-vacation-planner.mjs`             | Vacation planner rules, calendar, repository contracts                                 |
| `verify-vacation-monthly-sync.mjs`        | One-way vacation → monthly sheet sync (auto-fill, conflicts, removals)                 |
| `verify-recipient-contract.mjs`           | Recipient routing and dark-select UI contract                                          |
| `verify-personnel-status-contract.mjs`    | PERSONNEL Status dropdown/active/inactive vs `personnel/PersonnelRepository.gs`        |
| `verify-format-rules-governance.mjs`      | Manual conditional-format registry                                                     |
| `audit-function-graph.mjs`                | Bound entrypoint refs vs definitions                                                   |
| `verify-client-includes.mjs`              | `ui/JavaScript.html` include order                                                     |
| `verify-html-label-for.mjs`               | HTML `label for=` hygiene                                                              |
| `verify-client-js.mjs`                    | Combined sidebar client parse-check                                                    |
| `verify-client-deps.mjs`                  | Client layer graph (`contracts/client-layers.contract.json`)                           |
| `audit-client-xss.mjs`                    | Unsafe `innerHTML` / `setHtml` interpolations                                          |
| `audit-envelope-compat.mjs`               | Server envelope + client adapters + transport bridge                                   |
| `verify-usecase-facade.mjs`               | `Stage7UseCases_` contract vs snapshot                                                 |
| `verify-snapshot-governance.mjs`          | Snapshot mutations require `contracts/SNAPSHOT_CHANGELOG.md`                           |
| `verify-bridge-flags.mjs`                 | `USE_NEW_API_PATH` registry (`contracts/bridge-flags.registry.json`)                   |
| `verify-access-api-governance.mjs`        | Access endpoints, role policies, client routes                                         |
| `verify-access-policy-checks.mjs`         | Access policy check surface vs contract                                                |
| `verify-access-autofill-hotfix.mjs`       | ACCESS row autofill hotfix contract                                                    |
| `verify-access-temp-password-reissue.mjs` | Temporary password reissue flow                                                        |
| `verify-oauth-scopes.mjs`                 | Manifest scopes vs allowlist (`drive.readonly` for inventory reconciliation)           |
| `verify-project-files-map.mjs`            | `docs/project-files-complete.txt` matches working tree                                 |
| `verify-jsconfig.mjs`                     | `jsconfig.json` include/exclude globs                                                  |

There is **no** Apps Script deployment in CI (`clasp` is local only). See `.github/workflows/ci.yml`.

---

0. If the change adds, removes, or moves repository files, refresh the map:

   ```bash
   npm run map:project-files
   git diff -- docs/project-files-complete.txt
   ```

   (`npm run release:check` / `npm run ci` fails if the map is stale.)
1. Run local checks (`npm run check`; see `CONTRIBUTING.md`).
2. Confirm `audit-function-graph` ends with **`MISSING: none`**.
3. Commit with a short descriptive message; avoid version-only or vague messages.
4. **`npm run push:remote`** — or `git push origin <branch>` then **`npm run gas:push`**.
5. **`npm run gas:status`** before push if you changed `.claspignore` or folder layout — confirm tracked `.gs` / `.html` set.
6. In Apps Script → **Project settings → Script properties**: ensure **`WASB_SPREADSHEET_ID`** is set if you rely on triggers/headless runs (use your production spreadsheet ID).
7. Reload the spreadsheet UI; close and reopen the sidebar.
8. Confirm production `appsscript.json` still has `executionApi.access = MYSELF`.
9. After PERSONNEL / PHONES / VACATIONS / birthday / `Status` edits: **`apiStage7MaterializeComputedData()`**, then **`apiStage7ClearPhoneCache()`** after every deploy; re-check a person card and personnel modal. If you changed a month sheet and rely on derived fact/history views, also run **`apiStage7MaterializeMonthJournal({ monthSheet: "MM" })`** for that month.

### Repository file map

Canonical tree: **`docs/project-files-complete.txt`**. Regenerate after structural file changes:

```bash
cd ~/git/whatsapp-sheets-bot   # or your clone path
npm run map:project-files
git status --short
git diff -- docs/project-files-complete.txt
npm run release:check
```

The generator uses **depth-first** ordering (same layout as the committed map). It does not require the `tree` CLI.

Optional (`tree` installed: `sudo apt install -y tree`):

```bash
{
  echo "# WASB — повний список файлів репозиторію"
  echo "# Порядок: tree -a -F --dirsfirst"
  echo "# Виключено: .git/, node_modules/"
  echo "# Файлів: $(find . -type f -not -path './.git/*' -not -path './node_modules/*' | wc -l)"
  echo "# Оновлено: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo
  tree -a -F --dirsfirst -I '.git|node_modules' --noreport
} > docs/project-files-complete.txt
```

Prefer **`npm run map:project-files`** so local CI and release checks stay aligned.

## 13. Post-deploy checks

### Production deployment (closed Execution API)

Production deployment never opens Execution API to other users:

```bash
npm run deploy:prod
```

This runs `npm run ci` and `npx clasp push`. Production uses
`appsscript.json` with `executionApi.access = MYSELF`.

Immediately after push, run in the production GAS editor:

```text
apiStage7MaterializeComputedData()
apiStage7MaterializeMonthJournal({ monthSheet: "07" })   # when the month journal / summary must be refreshed
apiStage7ClearPhoneCache()
```

Then reload the spreadsheet/sidebar and verify a person card, personnel modal,
SEND_PANEL row, and the expected role.

### Clasp config (one production project)

| File | Commit? | Notes |
| ------ | -------- | ------ |
| `.clasp.example.json` | yes | Placeholder template — copy to `.clasp.json` locally and fill real IDs only there |
| `.clasp.json` | **no** | Your production `scriptId` |

Open the bound script: **`npm run gas:open`** (`clasp open-script` in clasp 3.x).

### Manual GAS functions (editor)

Run from the Apps Script editor when relevant after a deploy or config change:

- `apiStage7GetAccessDescriptor()` — lightweight descriptor sanity
- `apiStage7DebugAccess()` — access debug payload
- `apiStage7ReissueOwnerTemporaryPasswordManual()` — owner-only temporary password reissue helper; requires Script Properties **`WASB_OWNER_EMAIL`** and **`WASB_OWNER_LOGIN`**; logs only redacted metadata (`success`, row number, role, non-sensitive changed-column summary)
- `runAccessPolicyChecks()` — access policy assertions
- `runSmokeTests()` — regression bundle (`smoke/SmokeTests.gs`, deployed with production)
- `apiStage7MaterializeComputedData()` — перезбірка обчислюваних колонок (PERSONNEL helper, PHONES, Birthday, VACATIONS, Status панелі), auto-heal/validation `PERSONNEL.Status`, monthly callsign sync; sidebar: **Оновити обчислювані дані**
- `apiStage7MaterializeMonthJournal({ monthSheet: "07" })` — derived `ЖУРНАЛ_MM` / `ПІДСУМОК_MM`; sidebar: **Оновити журнал місяця**
- `apiStage7ClearPhoneCache()` — invalidate phone/profile caches (після кожного production deploy; **не** замінює materialize)

## 14. PERSONNEL sheet (canonical people data)

**Rule:** monthly sheet = **Callsign + schedule**; **PERSONNEL** = all person fields; **Status** = activity filter.

### Final header row (row 1)

Logical (canonical): `Cells | ID_VS | ID | LastName | FirstName | Patronymic | Birthday | Age | Days_until_birthday | Phone | 2_Phone | Email | Callsign | Rank | Position | OSH_4 | Status`

**Reference workbook "Книга Взводу Охорони" physical layout (supported):**

Contract: `contracts/reference-workbook-layout.contract.json` (headers extracted from the reference xlsx).

**PERSONNEL (row 1, columns A–Q):**

| Col | Header | Role |
| --- | --- | --- |
| A | Cells | Ignored (sheet row marker) |
| B | ID v/s | Optional internal id (`ID_VS`) |
| C | ID Army+ | Армія+ (optional data) |
| D–F | Last name / First name / Patronymic | Code synthesizes `FML` |
| G–I | Birthday / Age / Days until birthday | Materialized display: **Birthday** `DD.MM.YYYY р. н.` (space before suffix; legacy `… р.` normalizes on read); **Age** `N р.` (e.g. `25 р.`); **Days until birthday** — UA countdown (`N м.`, `N д.`, `N м. N д.`, or `Сьогодні`; space before abbreviation; `personnel/PersonnelMaterialize.gs`) |
| J–K | Phone / Phone 2 | Phones |
| L | Email | Optional contact email |
| **M** | **Callsign** | **Working callsign** (e.g. `ГРАФ`) — schedule key |
| N | Rank | Rank (instead of Title) |
| O | Position | Position |
| P | OSH 4 | OSH_4 (space ok) |
| Q | Status | UA dropdown (9 values) |

**Monthly sheets:**

- **07 (compact/current):** **B = Позивний**, dates from **C** (`C2:AG32` code range). **06** remains a compact historical sheet (`C2:AF30`).
- **02–05 (standard):** A = ТЕЛЕФОН, **B = ПОЗИВНИЙ**, dates from **H**.

**Monthly «Позивні» sync:** `Callsign` from PERSONNEL → monthly callsign column; empty Callsign → `Last name` (row-aligned). See `sheets/MonthlyCallsignSync.gs`.

`TEMPLATE` column is supported only in **legacy** workbooks (not in the reference xlsx). Code reads **exclusively by header names** (aliases for UA/EN/split variants).

Required (logical): `FML` (or split name parts), `Birthday`, `Phone`, `Callsign`, `Position`, `OSH_4` (or "OSH 4"), `Status`, `Title` or `Rank`.
`ID`, `Age`, `Days_until_birthday`, `2_Phone`/`Phone 2`, `ID v/s`, `TEMPLATE`, `Unit`, and split name columns are optional; computed helpers are tolerated.

### One-time / migration in the spreadsheet

1. If column **`Status`** is missing, runtime self-heal creates header **`Status`** in reference column **Q** (or appends a safe new column if P is occupied), then applies dropdown validation.
2. For everyone on duty: leave **`Status` empty** (defaults to **`В наявності`**) or pick an active dropdown value:
   **`В наявності`**, **`У відрядженні`**, **`Відпустка`**, **`Лікарняний`**, **`Тимчасовий`**, **`Гусачівка`**, **`БЗВП`**. Do not mix EN/UA in the same column.
3. For departed or absent-without-leave: set **`Вибув`** or **`СЗЧ`** — excluded from schedule, phones, and cards. Do **not** use **`Переведений`** (legacy values map to **`Вибув`** on read).

**Dropdown order (9 values):** `В наявності` → `У відрядженні` → `Вибув` → `Відпустка` → `Лікарняний` → `Тимчасовий` → `Гусачівка` → `БЗВП` → `СЗЧ`. Legacy labels (`Дієвий`, `Відрядження`, `Active`, EN) normalize on read.

**Data validation (dropdown):** apply to the **whole** Status column from row 2, e.g. `PERSONNEL!Q2:Q`, not a single cell like `P10`. After deploy, run **`applyPersonnelStatusColumnValidation()`** in the Apps Script editor, **`ensurePersonnelStatusColumn()`** for header + dropdown self-heal, or **`ensureSystemSheetByName_('PERSONNEL')`** / bootstrap self-heal to apply the list automatically.

**`ID`** (Армія+) may stay empty or temporary; it is not required for cards, schedule, phones, or birthdays.

### After every production `clasp push` (mandatory)

In Apps Script editor (or maintenance menu):

```text
apiStage7ClearPhoneCache()
```

Then reload the spreadsheet and reopen the sidebar. Verify one **person card**, **personnel modal** (callsign list), and **SEND_PANEL** row.

Callsign values.

## 15. Script properties

Canonical resolver (**`DataAccess.gs`**):

| Property                                     | Purpose                                                                                                                                                                                     |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`WASB_SPREADSHEET_ID`**                    | Target spreadsheet for headless runs (triggers, executions without open UI). Required when no container spreadsheet context exists.                                                         |
| **`WASB_OWNER_EMAIL`**                       | Owner email for security notifications that may include the full user key. Quick health warns if unset.                                                                                     |
| **`WASB_OWNER_LOGIN`**                       | Owner `ACCESS.login` value used only by `apiStage7ReissueOwnerTemporaryPasswordManual()` to identify the owner row without hardcoded source values.                                         |
| **`WASB_ACCESS_MIGRATION_EMAIL_BRIDGE`**     | Emergency email bridge during migration only. Keep disabled (`false` / unset) in normal operation.                                                                                          |
| **`WASB_ACCESS_TEMP_PASSWORD_PLAIN_LOOKUP`** | Legacy plaintext temp-password column lookup during migration only. Keep disabled in normal operation; run `apiStage7NormalizeAccessSheetFormatting()` to clear `temporary_password_plain`. |

If **`WASB_SPREADSHEET_ID`** is unset, the code falls back to **`SpreadsheetApp.getActiveSpreadsheet()`** when the script is bound and a spreadsheet context exists.

Headless executions (scheduled triggers without an open UI) **require** `WASB_SPREADSHEET_ID`, or they fail with a clear error.

Do **not** hardcode production spreadsheet IDs in source files; use Script properties instead.

## 16. PHONES cache and birthday (ДН)

Runtime prefers **`PERSONNEL`** for phones/profiles when the sheet has data; **PHONES** remains a legacy fallback.

After editing **PERSONNEL**, **PHONES**, or birthday logic, run **`apiStage7MaterializeComputedData()`**, then **`apiStage7ClearPhoneCache()`**, then reopen the sidebar and verify person cards (**ДН** / phone).

Operational detail: **`loadPhonesIndex_()`** builds from **PERSONNEL** (active rows) when available (`personnel/PersonnelRepository.gs`); otherwise from **PHONES** headers (`sendpanel/Stage7PhoneDictPayloadShims.gs`).

## 17. Contract and snapshot governance

- Machine-readable policy lives under `contracts/`.
- Snapshot captures live under `scripts/snapshots/`.
- Any snapshot mutation must include `reviewedAt`, `changeReason`, and a matching
  entry in `contracts/SNAPSHOT_CHANGELOG.md`.
- `npm run ci` enforces facade, snapshot, bridge-flag, client-layer, access API,
  XSS, envelope, workbook, recipient, and OAuth contracts.
- Before high-risk runtime changes, validate on a separate non-production
  spreadsheet with synthetic data; never commit production workbook exports,
  spreadsheet IDs, or personal data.

## 18. Legacy aliases (removed)

`LegacyApiAliases.gs`, `LegacyMaintenanceAliases.gs`, and `Stage7LegacyFunctionShims.gs` were **removed**. Canonical surface:

- Application / maintenance: `apiStage7*` in `api/Stage7ServerApi.gs` / `api/Stage7MaintenanceApi.gs`
- Sidebar `google.script.run` entry points: `ui-server/SidebarServer.gs` (`getMonthsList`, `generateSendPanelSidebar`, …)
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

## 19. Reflective helpers: eval / `Function('return this')`

| Location                              | Usage                                                                                                                                | Role                      | Risk                                        | Decision                                                                          |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------- |
| **`Stage7TestRunner.gs`**             | ~~`eval(name)`~~ removed; explicit registry **`getStage7TestRunnerExplicitRegistry_()`** + **`globalThis[name]`** for discovery only | Manual / menu test runner | Was **medium** (string eval); now **lower** | **DONE (P2.e)** — registered task names bind to real functions; no runtime `eval` |
| **`diagnostics/Diagnostics.Core.gs`** | `_global_()` → `Function('return this')()`                                                                                           | Diagnostics global scope  | Low                                         | **DEFER**                                                                         |
| **`Diagnostics.Stage7.Core.gs`**      | `_diagGlobal_()` → same pattern after `globalThis`                                                                                   | Stage7 diagnostics        | Low                                         | **DEFER**                                                                         |

Do **not** reintroduce `eval` for resolving test or handler names; extend **`getStage7TestRunnerExplicitRegistry_()`** when adding fixed registry tasks.

## 20. Optional business sheets (Дані / Проєкти / Заявки)

Ці три аркуші **не** створюються «ядром» bootstrap сервісних таблиць (`apiStage7BootstrapRuntimeAndAlertsSheets`). Вони підтягуються окремо:

- **`apiStage7BootstrapSidebar()`** (`api/Stage7ServerApi.gs`) викликає **`_ensureOptionalBusinessSheetsQuiet_()`**: якщо аркуша немає — вставляє його; якщо аркуш **повністю порожній** (`getLastRow() < 1`) — записує заголовки, один шаблонний рядок і базове оформлення (frozen row 1, жирний заголовок, фон `#eef2ff`, `autoResizeColumns` де можливо).

Якщо аркуш уже існує і містить хоч один рядок даних, **`ensure*`** його **не перезаписує** — правити структуру доведеться вручну або через окремі утиліти.

### «Дані» (`reports/MonthlyReport.gs`, `MonthlyReport_.ensureDataSheet_`)

Заголовки колонок: **Дата**, **Подія / опис**, **Проєкт**, **Категорія**, **Кількість / години**, **Примітки**. Шаблонний другий рядок містить дату **01.01.2000**, щоб вона не потрапляла в звичні місячні вікна звітів.

### «Проєкти» (`operations/ProjectRequests.gs`, `ProjectRequests_.ensureProjectsSheet_`)

Заголовки: **id**, **проєкт**, **активний**, **email менеджера**. Шаблон другого рядка має **`активний = false`**, тому **`readProjects_`** його не показує у сайдбарі, доки не заміниш дані й не увімкнеш активність.

### «Заявки» (`operations/ProjectRequests.gs`, `ProjectRequests_.ensureRequestsSheet_`)

Заголовки рядка 1 збігаються з порядком **`appendRow`** у **`apiSubmitRequest`**: **timestamp**, **user_email**, **project_id**, **project_name**, **title**, **details**, **dedupe_key**, **status**. Шаблон: **`dedupe_key`** = `wasb-template-row-v1`, **`status`** = `template`; **`findDuplicate_`** сканує колонку dedupe по всіх даних рядках до останнього заповненого рядка.

### Перевірка

## 21. Vacation source migration

`VACATIONS` remains the default legacy source. The flat `VACATION_REQUESTS`
source is opt-in and must be migrated explicitly by a sysadmin.

1. Deploy and run `previewVacationRequestsMigration()` in the GAS editor.
2. Confirm `invalidActiveRows === 0` and `requestRows === legacyRows`.
3. Run `applyVacationRequestsMigration()`.
4. Confirm Script Property `WASB_VACATION_SOURCE` equals
   `VACATION_REQUESTS`.
5. Run `checkVacationRulesFromMenu()` and `apiCheckVacationsAndBirthdays()`.
6. Verify `VACATION_CHECK`, the main vacation panel, and reminder output.

The migration refuses to overwrite a non-empty `VACATION_REQUESTS`. Roll back
reads and writes with `rollbackVacationRequestsToLegacy()`; migrated rows remain
intact for diagnosis. Do not delete `VACATIONS` during the compatibility period.

## 22. Daily summaries (зведення дня)

Коротке та детальне зведення запускаються з **бокової панелі WASB** (кнопки
**Зведення дня** / **Детальне зведення** → календар → результат у панелі).
Верхнє меню містить лише **`WASB` → `Відкрити панель`**.

Повний опис модулів: [`docs/daily-summary-architecture.md`](./docs/daily-summary-architecture.md).

### Коротке зведення

- Джерело даних: **нижній формульний блок** на місячному листі (`01`…`12`), не
  перерахунок у Apps Script.
- Модулі: `reports/Report_SummaryData.gs` (читання) → `reports/Report_DailySimple.gs`
  (форматування) → `reports/Summaries.gs` (`buildDaySummaryForColumn_`).
- Показники (порядок): За штатом, За списком, В наявності, У відрядженні, У
  відпустці, Гусачівка, Drone Camp, ППД, КП, БР.
- У таблиці метки можуть бути з `_`; у тексті звіту — без `_`.
- Відсутній показник у блоці → `0` у звіті.

### Детальне зведення

- Окрема логіка: `reports/Report_DailyDetailed.gs` + `PERSONNEL` + `DICT_SUM` + коди
  графіка за обраний день.
- Роль `operator` і вище (див. `SECURITY.md`); `viewer` не має доступу.

### Типові помилки

| Повідомлення | Причина |
| ------------ | ------- |
| `Не знайдено колонку дати … на аркуші …` | Дата відсутня в рядку дат місячного листа |
| `Не знайдено формульний блок зведення на аркуші …` | Немає рядка `За_списком` / `За списком` під графіком |
| `Некоректна дата зведення` | Невалідний формат дати в запиті |

### Перевірка після деплою

1. Відкрити панель → **Зведення дня** → порівняти цифри з нижнім блоком на
   листі `06` (або поточному місяці).
2. Переконатися, що перший рядок — `За штатом: …`.
3. **Детальне зведення** → перевірити групи людей.
4. Локально: `node scripts/verify-workbook-contract.mjs` (частина `npm run ci`).

## 23. Vacation mini-calendar (міні-календар відпусток)

Панель: **WASB → Відкрити панель → 🏖️ Відпустки → Огляд або План**.

Повний опис: [`docs/vacation-planner.md`](./docs/vacation-planner.md).

### Що перевірити після деплою (міні-календар)

1. Під сіткою лише **Проблемних дат** і **Навантажених днів** (без рядків про «Макс. одночасно» / «Коротке перевантаження»).
2. **◀ / ▶** реально змінюють місяць і рік (у т.ч. Грудень ↔ Січень).
3. У клітинці: число дня, роздільник, кількість людей (без ПІБ).
4. Tooltip при наведенні — дата, кількість, статус, підказка про клік (не лише `YYYY-MM-DD`).
5. Клік по проблемному дню — деталі + варіанти переносу.

### Локальна перевірка (міні-календар)

```bash
npm run ci:vacations
node scripts/verify-vacation-monthly-sync.mjs
npm run ci
```

### Синхронізація з місячним графіком

`VacationMonthlySync_` (`vacations/VacationMonthlySync.gs`) заповнює порожні
клітинки кодом `Відпус` після `apiStage7CreateNextMonth()` і
`apiStage7MaterializeComputedData()`. Конфлікти з уже заповненими клітинками —
у панелі **Конфлікти з відпустками** (`ui/Js.VacationSync.html`). Деталі:
[`docs/vacation-planner.md`](./docs/vacation-planner.md) § Monthly schedule sync.

## 24. Inventory reconciliation (звірка)

Панель: **WASB → Відкрити панель → Звірка**.

Повний опис: [`docs/inventory-reconciliation.md`](./docs/inventory-reconciliation.md).

### Що перевірити після деплою (звірка)

1. Після першого deploy з модулем звірки — повторно авторизувати OAuth scope **`drive.readonly`** (перегляд наявних файлів/папок Drive).
2. **sysadmin** задає кореневу папку Drive; інші ролі бачать прогрес місяців і можуть відкривати прив’язані документи.
3. Поточний і майбутні місяці лишаються без заливки; зелений статус дозволено лише минулому місяцю з усіма позначками та документами.
4. Кнопка **Синхронізувати файли** оновлює прихований захищений `INVENTORY_RECONCILIATION_FILES` і примітки клітинок.
5. Для поточної книги перевірте 9 служб і 108 очікуваних документів; кількість обчислюється динамічно.

### Локальна перевірка (звірка)

```bash
npm run ci
npx clasp status
npm audit --audit-level=moderate
```

`scripts/verify-inventory-reconciliation.mjs` входить у CI як side-effect імпорт
з `verify-clasp-push-patterns.mjs` (`npm run ci:gas`); його також можна
запускати окремо.

## 25. Temporary property register (тимчасово видане майно)

Аркуші: `Property_issued_for_temporary_u`, `PROPERTY_CATALOG`, `PROPERTY_KITS`.
Модуль: `inventory/TemporaryPropertyRegister.gs` (edit routing —
`access/AccessSheetTriggers.gs`). Картки людей показують залишки в секції
**Тимчасово видане майно**.

Одноразова ініціалізація / міграція з GAS editor:

```javascript
apiSetupTemporaryPropertyRegister()
```

Повний опис: [`docs/temporary-property-register.md`](./docs/temporary-property-register.md).

### Локальна перевірка (тимчасове майно)

```bash
npm run ci:workbook
```

### Тимчасово прийнятий ризик npm

Станом на 2026-07-12 `@google/clasp@3.3.0` є останньою доступною версією. П'ять
`moderate`-попереджень походять від транзитивної `uuid@9.x` у ланцюжку
`@google/clasp` → `googleapis` / `googleapis-common` → `gaxios`. Це локальний
інструментарій розгортання, а не код Apps Script. Не застосовувати
`npm audit fix --force`: запропонований npm перехід на `@google/clasp@2.5.0`
є несумісним і не вважається виправленням. Повторно перевірити після виходу
новішої версії `@google/clasp`.

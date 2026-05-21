# WASB — повний технічний аналіз і статус production-релізу

**Проєкт:** whatsapp-sheets-bot / WASB
**Версія:** Stage 7.1 (maintenance baseline)
**Платформа:** Google Apps Script V8 + Google Sheets + HtmlService
**Дата оновлення статусу:** 2026-05-17
**Стан репозиторію:** `main`, CI зелений (95 `.gs`, 1045 defs, 86 bound refs, 0 missing) — перевірено `node scripts/audit-function-graph.mjs`

---

## 1. Що це за система

**WASB** — операційний застосунок у Google Sheets для щоденного обліку персоналу, зведень, send-panel і адміністрування доступу.

| Домен          | Модулі                                    | Призначення                           |
| -------------- | ----------------------------------------- | ------------------------------------- |
| Місячні аркуші | `Code.gs`, `MonthSheets.gs`               | Коди розташування, FML, дати          |
| Зведення       | `Summaries.gs`, `SummaryService.gs`       | Денне / детальне summary              |
| Send-panel     | `SendPanel*.gs`                           | `wa.me` / Web WhatsApp (без Meta API) |
| Персонал       | `PersonCards.gs`, `PersonCalendar.html`   | Картки, календар                      |
| Відпустки / ДН | `VacationEngine.gs`, `Triggers.gs`        | Нагадування, jobs                     |
| Доступ         | `AccessControl.*`, `AccessEnforcement.gs` | RBAC + user key                       |
| Maintenance    | `Stage7MaintenanceApi.gs`, diagnostics    | Health, protections, repair           |
| Заявки / звіти | `ProjectRequests.gs`, `MonthlyReport.gs`  | `Дані`, `Проєкти`, `Заявки`           |

Це **не** зовнішній WhatsApp-бот на Node; назва репозиторію історична.

---

## 2. Масштаб кодової бази

| Метрика           | Значення                                                          |
| ----------------- | ----------------------------------------------------------------- |
| `.gs` файлів      | 95                                                                |
| Top-level функцій | ~1045                                                             |
| Bound entrypoints | 86 (0 missing)                                                    |
| Найбільші модулі  | `Stage7TestRunner`, `UseCases`, `SmokeTests`, `AccessEnforcement` |
| `SheetSchemas.gs` | ~597 рядків (після revert випадкового mass-format)                |

---

## 3. Архітектура

**Шари:** HtmlService client → `Stage7ServerApi` / `Stage7MaintenanceApi` → `UseCases` / `WorkflowOrchestrator` → repositories → `DataAccess` + `SheetSchemas` → Google Sheets.

**Канонічні API:**

- Користувач: `Stage7ServerApi.gs`
- Адмін: `Stage7MaintenanceApi.gs`
- Сумісність: `Legacy*`, `DeprecatedRegistry.gs`, `SidebarServer.gs`

**Відповіді:** `ServerResponse.gs` → уніфікований envelope (`success`, `message`, `data.result`, `data.meta`, top-level `dryRun`).

---

## 4. Дані та Script Properties

| Key                                  | Роль                             | Production  |
| ------------------------------------ | -------------------------------- | ----------- |
| `WASB_SPREADSHEET_ID`                | Headless / тригери               | ✅ задано   |
| `WASB_OWNER_EMAIL`                   | Security-листи з повним user key | ✅ задано   |
| `WASB_ACCESS_MIGRATION_EMAIL_BRIDGE` | Emergency email bridge           | ✅ вимкнено |
| `MANAGER_EMAILS`                     | Місячний звіт (fallback)         | за потреби  |

Resolver: `DataAccess.gs` → `openById` або container spreadsheet.

---

## 5. Безпека та доступ

- Ідентичність: `Session.getTemporaryActiveUserKey()` → SHA-256 hashes в `ACCESS`
- Ролі: `guest` … `owner`, server-side enforcement (`AccessEnforcement.gs`)
- Self-bind: email/phone + callsign, lockout
- Redaction: `SecurityRedaction.gs`
- Execution API: `MYSELF`
- Bootstrap-owner: **вимкнено** після налаштування ACCESS

---

## 6. Операційні підсистеми

- Managed triggers: vacations, reconciliation, health, cache, stale ops, retention, security audit
- `OperationSafety.gs`, `LockHelpers.gs`, `JobRuntime`, `Reconciliation`, `SystemSheetsSelfHeal`
- Protections: `SpreadsheetProtection.gs` + `apiStage7ApplyProtections()`

---

## 7. Тестування та CI

**GitHub / локально:**

- `ci-gas-sanity.mjs` ✅
- `audit-function-graph.mjs` ✅
- pre-prod checklist у GitHub Step Summary

**GAS (production validation — PASS):**

- Project test pack 36/36
- `apiStage7DebugAccess()` — PASS
- Regression / access / Stage7 diagnostics — PASS
- `apiStage7ApplyProtections({ dryRun: false })` — OK

---

## 8. Недавні релізні зміни (код)

| Зміна                                        | Коміти / файли                                                        |
| -------------------------------------------- | --------------------------------------------------------------------- |
| `WASB_OWNER_EMAIL` замість hardcode          | `ba6eb4d`, `DataAccess.gs`, `AccessEnforcement.gs`                    |
| Pre-prod diagnostics + CI checklist          | `Diagnostics.*`, `.github/workflows/ci.yml`                           |
| Revert `SheetSchemas` mass-format            | `7c676d4`                                                             |
| `apiStage7ApplyProtections` передає `dryRun` | `8185c2c`                                                             |
| Envelope `dryRun` узгодження                 | `dbff5ab`, `52cda5c` — `Stage7MaintenanceApi.gs`, `ServerResponse.gs` |

---

## 9. Технічний борг (post-release, не блокери)

- Звузити OAuth scopes (`drive`, `documents`) після smoke на копії
- ~~Дописати `WASB_OWNER_EMAIL` у `RUNBOOK.md` / `SECURITY.md`~~ — **done (2026-05-21)**
- Розбити великі файли: `Stage7TestRunner.gs`, `UseCases.gs`, `SmokeTests.gs`
- Окремий XSS-аудит `innerHTML` у клієнті
- Commit messages `"7"` — покращити читабельність історії git

---

## 10. OAuth scopes (рекомендація)

У `appsscript.json` залишаються `drive` + `documents`; у коді немає `DriveApp` / `DocumentApp`. Звуження — post-release після smoke.

---

## 11. Оцінка готовності до production

| Критерій             | Оцінка     | Коментар                                                               |
| -------------------- | ---------- | ---------------------------------------------------------------------- |
| Архітектура          | **8/10**   | Чіткі шари, Stage7 API                                                 |
| Безпека              | **8.5/10** | RBAC + user key + server enforcement                                   |
| Код / Git            | **9/10**   | CI зелений, робоче дерево clean, `main` синхронізований                |
| Деплой GAS           | **9/10**   | `clasp push` виконано, 115 файлів pushed                               |
| Production config    | **OK**     | `WASB_SPREADSHEET_ID`, `WASB_OWNER_EMAIL`, bridge off                  |
| ACCESS / RBAC        | **OK**     | owner/admin активний, strict user key mode, lockout off                |
| Операційна валідація | **PASS**   | project test pack 36/36, regression/access/stage7 diagnostics OK       |
| Protections          | **OK**     | 9/9 службових листів захищено                                          |
| Envelope dryRun      | **FIXED**  | `data.result.dryRun`, `data.meta.dryRun`, top-level `dryRun` узгоджені |

### Загалом: **production release CLOSED**

Код, GitHub, GAS, ACCESS, diagnostics, protections і envelope-response узгоджені.

---

## 12. Pre-prod checklist — виконано

Усі колишні BLOCKER-пункти закриті:

- [x] `WASB_SPREADSHEET_ID` у Script Properties
- [x] `WASB_OWNER_EMAIL` у Script Properties
- [x] `WASB_ACCESS_MIGRATION_EMAIL_BRIDGE` вимкнено / не `true`
- [x] `apiStage7BootstrapRuntimeAndAlertsSheets()`
- [x] `apiStage7BootstrapAccessSheet()`
- [x] ACCESS: enabled owner/admin/sysadmin, `user_key_current_hash` заповнений
- [x] `apiStage7DebugAccess()`: `bootstrapAllowed=false`, `adminConfigured=true`
- [x] `apiStage7QuickHealthCheck()`: `ownerEmailConfigured=true`, без критичних FAIL
- [x] `apiRunStage7RegressionTests()` / project test pack — PASS
- [x] `apiStage7ApplyProtections({ dryRun: true })` — переглянуто
- [x] `apiStage7ApplyProtections({ dryRun: false })` — застосовано
- [x] GAS синхронізовано з Git після revert `SheetSchemas` + envelope fix
- [x] `npm run ci` локально — PASS

---

## 13. Фінальний статус релізу

```text
WASB production release — CLOSED
Git working tree — CLEAN
GitHub main — UP TO DATE
GAS — PUSHED
CI local — PASS
Function graph audit — PASS
Project test pack — PASS
Access diagnostics — PASS
Protections apply — OK
dryRun/meta mismatch — FIXED
```

### Підтверджено

```text
ci-gas-sanity: OK
audit-function-graph: OK, MISSING: none
apiStage7DebugAccess: owner/admin, strict user key, bridge off
apiStage7ApplyProtections({ dryRun: false }): success
protectedSheets: 9/9
missingSheets: []
warnings: []
data.result.dryRun: false
data.meta.dryRun: false
top-level dryRun: false
```

### Вердикт: **GO / CLOSED**

Реліз production завершено. Пункти з розділу 9 — post-release backlog, не блокери.

### Пост-релізні задачі

Не блокують production:

1. Звузити OAuth scopes у `appsscript.json` після smoke на копії.
2. ~~Дописати `WASB_OWNER_EMAIL` у `RUNBOOK.md` / `SECURITY.md`.~~ — **done (2026-05-21)**
3. Пізніше розбити великі файли: `Stage7TestRunner.gs`, `UseCases.gs`, `SmokeTests.gs`.
4. Провести окремий XSS-аудит місць з `innerHTML`.

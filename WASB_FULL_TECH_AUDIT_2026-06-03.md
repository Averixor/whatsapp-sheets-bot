# WASB — повний технічний аудит проєкту

**Дата аудиту:** 2026-06-03 (метрики оновлено 2026-06-07)  
**Версія:** Stage 7.1 (`package.json` `"version": "7"`)  
**Платформа:** Google Apps Script V8 + Google Sheets + HtmlService  
**Репозиторій:** `main` @ `5f7eab2`  
**Пов'язані документи:** [WASB_RELEASE_AUDIT.md](./WASB_RELEASE_AUDIT.md) · [WASB_WORKBOOK_AUDIT_2026-06-07.md](./WASB_WORKBOOK_AUDIT_2026-06-07.md) · [docs/README.md](./docs/README.md)

---

## 1. Резюме для керівництва

| Область | Оцінка | Стан |
|---------|--------|------|
| Архітектура | **8.5/10** | Чіткі шари, контракти, facade |
| Безпека (RBAC + access) | **8.5/10** | Server-side enforcement, governance CI |
| Якість коду / CI | **9/10** | 15 перевірок, усі PASS |
| Клієнт (sidebar) | **8/10** | Шарова модель, XSS-аудит |
| Операційна готовність | **7/10** | Smoke через `clasp run` заблокований |
| Технічний борг | **помірний** | Великі модулі, bridge-flag sunset |
| **Загалом** | **8.2/10** | Production-ready з одним відкритим пунктом smoke |

**Вердикт:** система зріла, добре керована статичним CI. Єдиний системний прогалина — **віддалена production smoke** (`npm run gas:smoke`) через відсутність дозволу Apps Script Execution API у поточній clasp-авторизації. Локальний CI і GAS-код узгоджені.

---

## 2. Що це за система

**WASB** (whatsapp-sheets-bot) — операційний застосунок у Google Sheets для:

- щоденного обліку персоналу на місячних аркушах (`06`, `07`, …);
- денних і детальних зведень;
- send-panel (WhatsApp-посилання без Meta API);
- карток персоналу, календаря, відпусток, ДН;
- RBAC-доступу через лист `ACCESS`;
- maintenance/diagnostics для адмінів.

Це **не** Node.js WhatsApp-бот — назва репозиторію історична. Runtime повністю в GAS.

| Домен | Модулі | Призначення |
|-------|--------|-------------|
| Місячні аркуші | `Code.gs`, `MonthSheets.gs`, `SheetSchemas.gs` | Коди, FML, compact layout |
| Зведення | `Summaries.gs`, `SummaryService.gs` | Денне / детальне summary |
| Send-panel | `SendPanel*.gs` | `web.whatsapp.com` (без Meta API) |
| Персонал | `PersonCards.gs`, `PersonnelRepository.gs` | Картки, PERSONNEL |
| Відпустки / ДН | `VacationEngine.gs`, `Triggers.gs` | Нагадування, jobs |
| Доступ | `AccessControl.*`, `AccessEnforcement.gs` | RBAC + user key |
| Maintenance | `Stage7MaintenanceApi.gs`, `Diagnostics.*` | Health, protections, repair |
| Заявки / звіти | `ProjectRequests.gs`, `MonthlyReport.gs` | `Дані`, `Проєкти`, `Заявки` |

---

## 3. Масштаб кодової бази

| Метрика | Значення |
|---------|----------|
| `.gs` файлів | **112** (CI `ci-gas-sanity`) |
| `.html` файлів | **35** |
| Загальний обсяг (gs+html) | **~57 700 рядків** |
| Top-level функцій | **1061** |
| Bound entrypoints (меню/тригери) | **81** (missing: **0**) |
| Stage7 application API | **22** entrypoints (`Stage7ServerApi.gs`) |
| Stage7 maintenance API | **39** entrypoints (`Stage7MaintenanceApi.gs`) |
| UseCases facade | **17** публічних методів |
| Access API governance | **17** endpoints / **17** role policies |
| Клієнтські символи (deps contract) | **226** |
| Domain tests | `DomainTests.gs` (~560 рядків, PR #13–#14) |

### Найбільші модулі (рядків)

| Файл | ~рядків | Роль |
|------|---------|------|
| `AccessEnforcement.gs` | 1609 | RBAC, guards, descriptor |
| `AccessControl.AuthResolver.gs` | 1560 | Ідентичність, hash, bridge |
| `SmokeTests.gs` | 1490 | Production/regression smoke |
| `AccessControl.SheetRepository.gs` | 1460 | CRUD ACCESS sheet |
| `AccessPolicyChecks.gs` | 1455 | Policy invariants |
| `Stage7TestRunner.Reporting.gs` | 1158 | Test reporting |
| `SheetSchemas.gs` | 1087 | Схеми аркушів, compact layout |
| `VacationEngine.gs` | 1030 | Відпустки / нагадування |
| `PersonnelRepository.gs` | 842 | PERSONNEL (header-based) |

`Stage7TestRunner` розбитий на **11** підмодулів (`Stage7TestRunner.*.gs`).

---

## 4. Архітектура

**Шари:** HtmlService client → `Stage7ServerApi` / `Stage7MaintenanceApi` → `UseCases` / `WorkflowOrchestrator` → repositories → `DataAccess` + `SheetSchemas` → Google Sheets.

### Серверні шари

1. **Application API** — `Stage7ServerApi.gs`: sidebar bootstrap, summaries, send-panel, person cards, calendar.
2. **Maintenance API** — `Stage7MaintenanceApi.gs`: access admin, health, protections, repairs, regression.
3. **UseCases facade** — `UseCases.gs` + `UseCases.*.gs`: бізнес-операції з уніфікованим envelope.
4. **Repositories** — `PersonnelRepository`, `PersonsRepository`, `SendPanelRepository`, `SummaryRepository`, …
5. **DataAccess** — resolver spreadsheet ID, `openById`, container fallback.

### Канонічні API

- Користувач: `Stage7ServerApi.gs`
- Адмін: `Stage7MaintenanceApi.gs`
- Сумісність: `SidebarServer.gs`, `DeprecatedRegistry.gs`

### Envelope (відповіді сервера)

Контракт: `contracts/envelope.contract.json`

```text
success | message | data.result | data.meta | dryRun (top-level + nested)
```

Адаптери на клієнті: `unwrapStage4Result`, `adaptStage4PanelResponse`, `adaptStage4SummaryResponse`, `normalizeApiResponse` — перевіряються `audit-envelope-compat.mjs`.

### Compatibility / legacy

- `SidebarServer.gs` — тонкий шар сумісності (send*, commander).
- `DeprecatedRegistry.gs` — інвентар видалених globals (CI перевіряє відсутність).
- Bridge flag `USE_NEW_API_PATH` (default `true`, sunset **2026-09-30**, `contracts/bridge-flags.registry.json`).

Детальніше: [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## 5. Клієнтський runtime

### Завантаження (`JavaScript.html`)

```text
Core → State → Api → Render.* → Diagnostics
→ Security.Boot/Util/Access/Debug/Login/DebugView/Policy/Guards/Forms/Exports
→ Helpers → Events → Actions
```

### Шарова модель (`contracts/client-layers.contract.json`)

| Шар | Файли | Залежності |
|-----|-------|------------|
| **core** | `Js.Core`, `Js.State`, `Js.Api` | ∅ |
| **render** | `Js.Render.Panel/Calendar/Results` | core |
| **features** | Security.*, Helpers, Events, Actions, Diagnostics | core + render |

**Заборони (CI enforced):**

- core не викликає UI напряму;
- render не викликає features (крім `SidebarApp.*` bridge);
- нижчі шари не залежать від вищих.

### Security client (`Js.Security.*`)

37 публічних `window.*` експортів у `Js.Security.Exports.html` — усі реалізовані в `Js.Security.Access/Debug/DebugView/Login/Policy/Guards`.

### XSS

- `innerHTML`: **14** використань у **7** файлах.
- CI `audit-client-xss.mjs`: **93** дозволених safe-patterns, reviewed 2026-05-29.
- Рекомендовані sinks: `escapeHtml`, `escapeAttr`, `escapeJsString`, `setHtml`, `setText`.
- Контракт: `contracts/xss-policy.contract.json`.

### Bootstrap / надійність sidebar

- `withPromiseTimeout_` у `Js.Core.html`;
- `startSidebarBootTimeout(20s)` + `showFatalSidebarError` у `Js.State.html`;
- таймаути на bootstrap/access/months у `Js.Helpers.html`.

---

## 6. Модель даних

### PERSONNEL (ключі)

| Колонка | Роль |
|---------|------|
| **Callsign** | Основний ключ для місячного графіка і lookup |
| **FML** | Практичний ключ разом із Callsign |
| **ID** | Армія+ — опційне поле, не системний ключ |
| **Position** | Структура, **не** ключ людини |
| **Status** | Лише UA в аркуші |

**Активні статуси:** `Дієвий`, `Тимчасовий`, `Відрядження`, `В наявності`, `Відпустка`, `Гусачівка`, `Відкомандерований`

**Неактивний:** `Вибув`

Читання — тільки за назвами заголовків (`PersonnelRepository.gs`). Після змін PERSONNEL — `apiStage7ClearPhoneCache()`.

### Місячні аркуші

- `SheetSchemas.gs`: `detectMonthlyLayoutFromSheet_`, compact layout (`06`: дати з колонки C).
- Workbook contract (локальний): `06` → діапазон `C2:AF30`, **personnel=29** (footer не рахується).

### ACCESS

- Ідентичність: `Session.getTemporaryActiveUserKey()` → SHA-256 hashes.
- Ролі: `guest < viewer < operator < maintainer < admin < sysadmin < owner`.
- Self-bind: email/phone + callsign, lockout на failed login.
- Bootstrap-owner: вимкнено після налаштування ACCESS.
- Emergency bridge: `WASB_ACCESS_MIGRATION_EMAIL_BRIDGE` — має бути off у prod.

### Script Properties (production)

| Key | Призначення |
|-----|-------------|
| `WASB_SPREADSHEET_ID` | Headless / тригери |
| `WASB_OWNER_EMAIL` | Security-листи з повним user key |
| `WASB_ACCESS_MIGRATION_EMAIL_BRIDGE` | Emergency (off) |
| `MANAGER_EMAILS` | Місячний звіт (опційно) |

---

## 7. Безпека

### Сильні сторони

1. **Server-side RBAC** — `AccessEnforcement.gs`, guards на кожному чутливому API.
2. **Access API governance** — 17 endpoints з role policies; guest bootstrap не створює аркуші.
3. **Redaction** — `SecurityRedaction.gs` для debug/descriptor.
4. **Protections** — `SpreadsheetProtection.gs`, `apiStage7ApplyProtections()`.
5. **Security audit triggers** — `stage7SecurityAuditOnEdit/OnChange`.
6. **OAuth scopes звужені** — `drive` і `documents` прибрані; **6** scope (`contracts/oauth-scopes.contract.json`).

### Execution API

```json
"executionApi": { "access": "ANYONE" }
```

Доступ до функцій обмежується внутрішніми role guards. Trade-off для `clasp run` smoke.

Детальніше: [SECURITY.md](./SECURITY.md).

### Ризики

| Ризик | Рівень | Коментар |
|-------|--------|----------|
| Execution API ANYONE | середній | Компенсується RBAC усередині entrypoints |
| innerHTML (14 місць) | низький | Під governance XSS-аудиту |
| Великі Access-модулі | низький | Складність супроводу |
| clasp uuid CVE (moderate) | низький | Тільки devDependency |

---

## 8. Операційні підсистеми

### Managed triggers

| Тригер | Призначення |
|--------|-------------|
| `stage7JobDailyVacationsAndBirthdays` | Щоденні відпустки/ДН |
| `stage7JobScheduledReconciliation` | Reconciliation |
| `stage7JobScheduledHealthCheck` | Health |
| `stage7JobCleanupCaches` | Cache cleanup |
| `stage7JobDetectStaleOperations` | Stale ops |
| `stage7JobLifecycleRetentionCleanup` | Retention |
| `stage7SecurityAuditOnEdit/OnChange` | Security audit |
| `wasbAccessAutoFillOnEdit_` | ACCESS autofill |
| `wasbAccessSheetOnEditAutofillHotfix_` | Hotfix autofill |
| `autoVacationReminder` / `autoBirthdayReminder` | Legacy reminders |

### Допоміжні

- `OperationSafety.gs`, `LockHelpers.gs`, `JobRuntime.gs`, `Reconciliation.gs`
- `SystemSheetsSelfHeal`, `LifecycleRetention.gs`
- `GasRuntimeSmoke.gs` — `apiRunProductionSmokeChecks()`

### WhatsApp-посилання

Центральний генератор: `buildWhatsAppWebLink_` у `Utils.gs` → `web.whatsapp.com/send`. Legacy `wa.me` у HYPERLINK приймається при читанні.

### Commander recipient

- Bootstrap: `commanderRole`, `commanderRecipients` (`Stage7ServerApi.gs`);
- UI: select «Отримувач» у sidebar;
- Override при send: `SidebarServer.gs` + `Js.Actions.html`.

---

## 9. CI/CD і якість

### Повний pipeline (`npm run ci`)

| Скрипт | Що перевіряє |
|--------|--------------|
| `verify-node-version` | Node 24 |
| `ci-gas-sanity` | 112 .gs, структура GAS |
| `verify-workbook-contract` | Compact `06`, personnel=29 |
| `audit-function-graph` | 81 bound refs, 0 missing |
| `verify-client-includes` | Include chain |
| `verify-client-js` | Синтаксис клієнта |
| `verify-client-deps` | 3 шари, 224 символи |
| `audit-client-xss` | 17 файлів, 93 patterns |
| `audit-envelope-compat` | 4 адаптери |
| `verify-usecase-facade` | 17 методів |
| `verify-snapshot-governance` | Snapshots не змінені |
| `verify-bridge-flags` | 1 flag |
| `verify-access-api-governance` | 17/17 policies |
| `verify-oauth-scopes` | 6 scopes |
| `verify-jsconfig` | IDE/tsserver inputs |

### GitHub Actions

`.github/workflows/ci.yml`: Node 24, `npm ci` + `npm run ci` на push/PR до `main`. Job `preprod-checklist` публікує ручний GAS-checklist у Step Summary.

### Деплой

```bash
npm run deploy:prod   # ci + clasp push + gas:smoke
```

Детальніше: [AGENTS.md](./AGENTS.md), [RUNBOOK.md](./RUNBOOK.md).

---

## 10. Тестування

### Локальне (без Google credentials)

- Увесь `npm run ci` — автоматизовано.
- Workbook contract — VM-симуляція compact layout `06`.

### Віддалене (GAS)

| Тест | Entrypoint | Статус |
|------|------------|--------|
| Production smoke | `apiRunProductionSmokeChecks` | BLOCKED (clasp auth) |
| Regression | `apiRunStage7RegressionTests` | PASS (ручний, за RUNBOOK) |
| Health quick | `apiStage7QuickHealthCheck` | PASS (за RUNBOOK) |
| Access debug | `apiStage7DebugAccess` | PASS (owner/admin, bridge off) |
| Protections | `apiStage7ApplyProtections` | 9/9 sheets |

### Покриття gaps

- Немає E2E браузерних тестів sidebar (обмеження GAS/HtmlService).
- Немає автоматичного post-push smoke в CI (потрібні Google credentials).

---

## 11. Залежності

```json
devDependencies: @google/clasp ^3.3.0
dependencies: uuid ^14.0.0
```

**npm audit:** 5 moderate (uuid у transitive deps clasp/googleapis).  
**Не використовувати** `npm audit fix --force` — відкотить clasp до 2.5.0.

Runtime GAS не залежить від npm-пакетів.

---

## 12. Документація

| Документ | Стан |
|----------|------|
| `ARCHITECTURE.md` | Актуальний |
| `RUNBOOK.md` | Повний bootstrap/access/maintenance |
| `SECURITY.md` | Identity, roles, lockout |
| `AGENTS.md` | CI/deploy |
| `WASB_RELEASE_AUDIT.md` | Короткий release-status |
| `docs/README.md` | Індекс audit + governance |
| `docs/refactor/` | Governance, access matrix (див. docs/README) |
| `contracts/*` | 10+ machine-readable контрактів |

**Слабке місце:** commit messages — серія `"7"`, погана читабельність git-історії.

---

## 13. Технічний борг (пріоритизований)

### P1 — операційне

1. Закрити production smoke — ручний запуск + налаштування clasp Execution API.
2. Покращити commit messages — conventional commits замість `"7"`.

### P2 — супровід коду

3. Розбити `SmokeTests.gs`, `AccessEnforcement.gs`, `AccessControl.AuthResolver.gs`.
4. Bridge flag `USE_NEW_API_PATH` — видалити до **2026-09-30**.
5. Міграція `innerHTML` → sanitizer sinks.

### P3 — дані (не код)

6. Виправити Callsign у книзі: `ВАМПИР`→`ВАМПІР`, `МАЛОЙ`→`МАЛИЙ`.
7. Після deploy PERSONNEL — `apiStage7ClearPhoneCache()`.

### Закритий борг

- OAuth scopes звужені ✅
- `WASB_OWNER_EMAIL` у RUNBOOK/SECURITY ✅
- `Stage7TestRunner` розбитий на підмодулі ✅
- Envelope `dryRun` узгодження ✅
- WhatsApp `web.whatsapp.com` ✅

---

## 14. Матриця готовності до production

| Критерій | Статус |
|----------|--------|
| Локальний CI | ✅ PASS |
| Git main синхронізований | ✅ |
| GAS deploy (clasp push) | ✅ |
| Script Properties | ✅ |
| ACCESS / RBAC | ✅ |
| Protections 9/9 | ✅ |
| Workbook regression 06 | ✅ personnel=29 |
| Access API governance 17/17 | ✅ |
| Production smoke (clasp) | ❌ BLOCKED |
| OAuth scopes | ✅ 6 scopes (narrowed) |

### Фінальний вердикт

```text
WASB — PRODUCTION-READY (CODE + CI)
Release closure — PENDING smoke authorization
Overall grade — 8.2/10
```

---

## 15. Рекомендовані наступні кроки

1. Власник — один раз у GAS Editor: `apiRunProductionSmokeChecks()`.
2. Перевірити clasp: Apps Script API enabled, `clasp login`, `executionApi.access: ANYONE`, API executable deployment.
3. `npm run gas:smoke` — має повернути `ok === true`.
4. У книзі — виправити Callsign, потім `apiStage7ClearPhoneCache()`.
5. Ручна перевірка sidebar: bootstrap < 20s, «Командиру» → `web.whatsapp.com`.

Після успішного smoke — змінити вердикт у [WASB_RELEASE_AUDIT.md](./WASB_RELEASE_AUDIT.md) на `WASB production release — CLOSED`.

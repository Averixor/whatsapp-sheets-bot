# WASB — production release status

**Проєкт:** whatsapp-sheets-bot / WASB
**Версія:** Stage 7.1
**Дата оновлення:** 2026-06-03
**Повний аудит:** [WASB_FULL_TECH_AUDIT_2026-06-03.md](./WASB_FULL_TECH_AUDIT_2026-06-03.md)

---

## Поточний статус

```text
WASB — PRODUCTION-READY (CODE + CI)
Release closure — PENDING smoke authorization
Production smoke — BLOCKED BY APPS SCRIPT AUTHORIZATION
Git — CLEAN
GitHub main — UP TO DATE
GAS — PUSHED
CI — PASS
Workbook regression 06 — PASS, personnel=29
Access API governance — PASS, 17/17 policies
OAuth scopes — NARROWED, 6 scopes
Final verdict — NOT CLOSED UNTIL GAS SMOKE PASS
```

---

## Що PASS

| Перевірка | Результат |
|-----------|-----------|
| `npm run ci` (локально + GitHub Actions) | PASS — 14 скриптів |
| Function graph audit | 81 bound refs, 0 missing, 1052 defs |
| Workbook contract `06` | `C2:AF30`, personnel=29 |
| Access API governance | 17/17 endpoints + role policies |
| OAuth scopes | 6 (без `drive`, без `documents`) |
| Protections | 9/9 службових листів |
| ACCESS / RBAC | owner/admin, strict user key, bridge off |
| Script Properties | `WASB_SPREADSHEET_ID`, `WASB_OWNER_EMAIL` задані |
| GAS deploy | `npx clasp push` виконано |
| Git | clean working tree, `main` = `origin/main` |

---

## Що BLOCKED

| Блокер | Причина | Обхід |
|--------|---------|-------|
| `npm run gas:smoke` | clasp не має дозволу на Execution API | Власник один раз запускає `apiRunProductionSmokeChecks()` в Apps Script UI |

---

## Pre-prod checklist

### Виконано

- [x] `WASB_SPREADSHEET_ID` у Script Properties
- [x] `WASB_OWNER_EMAIL` у Script Properties
- [x] `WASB_ACCESS_MIGRATION_EMAIL_BRIDGE` вимкнено
- [x] `apiStage7BootstrapRuntimeAndAlertsSheets()`
- [x] `apiStage7BootstrapAccessSheet()`
- [x] ACCESS: enabled owner/admin/sysadmin, `user_key_current_hash` заповнений
- [x] `apiStage7DebugAccess()`: `bootstrapAllowed=false`, `adminConfigured=true`
- [x] `apiStage7QuickHealthCheck()` — без критичних FAIL
- [x] `apiRunStage7RegressionTests()` — PASS
- [x] `apiStage7ApplyProtections({ dryRun: true })` — переглянуто
- [x] `apiStage7ApplyProtections({ dryRun: false })` — застосовано
- [x] GAS синхронізовано з локальним кодом (`clasp push`)
- [x] `npm run ci` — PASS
- [x] OAuth scopes звужено до 6
- [x] Git clean, GitHub `main` up to date

### Залишилось для CLOSED

- [ ] Власник один раз вручну запускає `apiRunProductionSmokeChecks()` в Apps Script UI
- [ ] `npm run gas:smoke` — PASS (`ok === true`)

---

## Закриття релізу

Після ручного smoke в Apps Script:

```bash
cd ~/git/whatsapp-sheets-bot
npm run gas:smoke
npm run ci
```

Якщо smoke PASS — оновити цей файл:

```text
WASB production release — CLOSED
Final verdict — CLOSED
```

---

## Пост-реліз (не блокери)

1. Покращити commit messages (замість `"7"`).
2. Розбити великі модулі: `SmokeTests.gs`, `AccessEnforcement.gs`, `AccessControl.AuthResolver.gs`.
3. Видалити bridge flag `USE_NEW_API_PATH` до 2026-09-30.
4. Міграція `innerHTML` → sanitizer sinks.
5. Дані в книзі: Callsign `ВАМПИР`→`ВАМПІР`, `МАЛОЙ`→`МАЛИЙ`; потім `apiStage7ClearPhoneCache()`.

# WASB — release status

**Проєкт:** whatsapp-sheets-bot / WASB
**Версія:** Stage 7.1
**Дата оновлення:** 2026-06-03
**Повний технічний аудит:** [WASB_FULL_TECH_AUDIT_2026-06-03.md](WASB_FULL_TECH_AUDIT_2026-06-03.md)

---

## Поточний статус (one-liner)

```text
WASB — PRODUCTION-READY (CODE + CI)
Release closure — PENDING smoke authorization
Final verdict — NOT CLOSED UNTIL GAS SMOKE PASS
```

---

## Стан перевірок

| Перевірка | Статус |
|-----------|--------|
| Git working tree | **CLEAN** |
| GitHub `main` | **UP TO DATE** (synced with `origin/main`) |
| GAS deploy (`clasp push`) | **PUSHED** |
| `npm run ci` (локально / GitHub Actions) | **PASS** |
| Function graph audit | **PASS** — 81 bound refs, 0 missing |
| Workbook regression `06` | **PASS** — `C2:AF30`, personnel=29 |
| Access API governance | **PASS** — 17/17 policies |
| OAuth scopes | **NARROWED** — 6 scopes (`drive`/`documents` removed) |
| Protections | **OK** — 9/9 service sheets |
| Production smoke (`npm run gas:smoke`) | **BLOCKED** — Apps Script authorization |

### Кодова база (snapshot)

| Метрика | Значення |
|---------|----------|
| `.gs` файлів | 112 |
| `.html` файлів | 35 |
| Рядків (gs+html) | ~57 700 |
| Top-level функцій | 1052 |

---

## Єдиний блокер до CLOSED

1. **Власник** один раз вручну запускає `apiRunProductionSmokeChecks()` в Apps Script UI.
2. Потім локально:

```bash
cd ~/git/whatsapp-sheets-bot
npm run gas:smoke
```

Очікування: `ok === true`, `checks.migrationFlag !== 'true'`, `checks.clientSignal` — envelope `success: true`.

Якщо `clasp run` падає з permission error:

- увімкнути **Google Apps Script API** у Google Cloud Console;
- `npx clasp login`, перевірити `.clasp.json` scriptId;
- `appsscript.json` → `"executionApi": { "access": "ANYONE" }`;
- оновити **API executable** deployment у Apps Script UI.

---

## Pre-prod checklist

### Виконано

- [x] `WASB_SPREADSHEET_ID` у Script Properties
- [x] `WASB_OWNER_EMAIL` у Script Properties
- [x] `WASB_ACCESS_MIGRATION_EMAIL_BRIDGE` вимкнено
- [x] `apiStage7BootstrapRuntimeAndAlertsSheets()`
- [x] `apiStage7BootstrapAccessSheet()`
- [x] ACCESS: owner/admin/sysadmin, `user_key_current_hash` заповнений
- [x] `apiStage7DebugAccess()`: `bootstrapAllowed=false`, `adminConfigured=true`
- [x] `apiStage7QuickHealthCheck()` — без критичних FAIL
- [x] `apiRunStage7RegressionTests()` — PASS
- [x] `apiStage7ApplyProtections({ dryRun: true/false })` — застосовано
- [x] GAS синхронізовано з репозиторієм (`clasp push`)
- [x] `npm run ci` — PASS
- [x] OAuth scopes звужені (6 scopes)
- [x] Git clean, `main` на GitHub актуальний

### Залишилось

- [ ] `apiRunProductionSmokeChecks()` — ручний запуск власником у GAS UI
- [ ] `npm run gas:smoke` — PASS
- [ ] Оновити цей файл: `Final verdict — CLOSED`

---

## Після smoke PASS

```bash
npm run gas:smoke
npm run ci
```

Якщо все зелене — змінити вердикт у цьому файлі на:

```text
WASB production release — CLOSED
```

---

## Пост-реліз (не блокери)

1. Розбити великі модулі: `SmokeTests.gs`, `AccessEnforcement.gs`, `AccessControl.AuthResolver.gs`.
2. Видалити bridge flag `USE_NEW_API_PATH` до 2026-09-30.
3. Покращити commit messages (замість `"7"`).
4. Дані в книзі: Callsign `ВАМПИР`→`ВАМПІР`, `МАЛОЙ`→`МАЛИЙ`; потім `apiStage7ClearPhoneCache()`.

Детальний борг і архітектура — у [WASB_FULL_TECH_AUDIT_2026-06-03.md](WASB_FULL_TECH_AUDIT_2026-06-03.md).

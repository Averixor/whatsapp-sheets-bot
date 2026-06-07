# WASB — production release status

**Проєкт:** whatsapp-sheets-bot / WASB  
**Версія:** Stage 7.1  
**Дата оновлення:** 2026-06-07  
**Пов’язані документи:** [WASB_FULL_TECH_AUDIT_2026-06-03.md](./WASB_FULL_TECH_AUDIT_2026-06-03.md) (код) · [WASB_WORKBOOK_AUDIT_2026-06-07.md](./WASB_WORKBOOK_AUDIT_2026-06-07.md) (книга) · [docs/README.md](./docs/README.md)

---

## Поточний статус

```text
WASB production release — HOTFIX DEPLOYED, SMOKE BLOCKED
Production smoke — BLOCKED BY APPS SCRIPT AUTHORIZATION
Git — CLEAN
GitHub main — UP TO DATE (5f7eab2)
GAS — PUSHED
CI — PASS (15 scripts)
Workbook regression 06 — PASS, personnel=29
Access API governance — PASS, 17/17 policies
OAuth scopes — NARROWED, 6 scopes
Final verdict — NOT CLOSED YET
```

---

## Operational UI blockers

| Пункт | Статус |
|-------|--------|
| Dark theme select/options contrast | **FIXED** |
| Recipient routing (commander / birthday / vacation) | **FIXED** |
| Sticky back header (sidebar result screens) | **FIXED** (`5cd9181`) |
| Access banner label («Режим доступу», не «Статус») | **FIXED** (`d77261e`) |

`PersonCalendar.html` — окремий діалог; не змінювався (навмисно).

---

## Що PASS

| Перевірка | Результат |
|-----------|-----------|
| `npm run ci` (локально + GitHub Actions) | PASS — 15 скриптів |
| Function graph audit | 81 bound refs, 0 missing, 1061 defs |
| Domain tests (`DomainTests.gs`) | personnel + monthly layouts (#13–#14) |
| Workbook contract `06` | `C2:AF30`, personnel=29 |
| Recipient routing contract | selected recipient + guarded fallback |
| Access API governance | 17/17 endpoints + role policies |
| OAuth scopes | 6 (без `drive`, без `documents`) |
| Protections | 9/9 службових листів |
| ACCESS / RBAC | owner/admin, strict user key, bridge off |
| Script Properties | `WASB_SPREADSHEET_ID`, `WASB_OWNER_EMAIL` задані |
| Production workbook | 29 осіб, compact `06` — див. workbook audit |
| GAS deploy | `npx clasp push` виконано |
| Git | clean working tree, `main` = `origin/main` |

---

## Hotfix 2026-06-06 — 2026-06-07

- [x] Dark theme `select` / `option` / `optgroup`
- [x] `resolveMessageRecipient_()` + commander/birthday/vacation routing
- [x] `verify-recipient-contract.mjs` у CI
- [x] Sticky header «← Назад» (`5cd9181`)
- [x] Access banner: «Режим доступу» (`d77261e`)
- [x] GitHub Actions: Node 24 actions (`checkout@v5`, `setup-node@v5`)
- [x] Domain regression: personnel + monthly layouts (`5f7eab2`)

---

## Що BLOCKED

| Блокер | Причина | Обхід |
|--------|---------|-------|
| `npm run gas:smoke` | clasp без дозволу Execution API | Власник: `apiRunProductionSmokeChecks()` в Apps Script UI |

---

## Pre-prod checklist

### Виконано

- [x] Script Properties, ACCESS, protections, bootstrap
- [x] `apiRunStage7RegressionTests()` — PASS
- [x] `npm run ci` — PASS
- [x] UI/ops hotfixes — FIXED (див. вище)
- [x] GAS + GitHub `main` синхронізовані

### Залишилось для CLOSED

- [ ] `apiRunProductionSmokeChecks()` — один раз у GAS UI (власник)
- [ ] `npm run gas:smoke` — PASS (`ok === true`)

---

## Закриття релізу

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
2. Розбити великі модулі: `SmokeTests.gs`, `AccessEnforcement.gs`.
3. Bridge flag `USE_NEW_API_PATH` — sunset 2026-09-30.
4. Дані в книзі: mixed-case Callsign (8 рядків); після правок PERSONNEL — `apiStage7ClearPhoneCache()`.

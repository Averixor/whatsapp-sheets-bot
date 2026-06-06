# WASB — production release status

**Проєкт:** whatsapp-sheets-bot / WASB
**Версія:** Stage 7.1
**Дата оновлення:** 2026-06-06
**Повний аудит:** [WASB_FULL_TECH_AUDIT_2026-06-03.md](./WASB_FULL_TECH_AUDIT_2026-06-03.md)

---

## Поточний статус

```text
WASB production release — HOTFIX DEPLOYED, SMOKE BLOCKED
Release closure — PENDING smoke authorization + Git commit/push
Production smoke — BLOCKED BY APPS SCRIPT AUTHORIZATION
Git working tree — LOCAL CHANGES
GitHub main — NOT UPDATED
GAS — PUSHED
CI local — PASS
Workbook regression 06 — PASS, personnel=29
Access API governance — PASS, 17/17 policies
Recipient/UI regression — PASS
OAuth scopes — NARROWED, 6 scopes
Final verdict — NOT CLOSED UNTIL SMOKE + GIT PASS
```

---

## Що PASS

| Перевірка | Результат |
|-----------|-----------|
| `npm run ci` (локально) | PASS — 15 скриптів |
| Function graph audit | 81 bound refs, 0 missing, 1057 defs |
| Workbook contract `06` | `C2:AF30`, personnel=29 |
| Access API governance | 17/17 endpoints + role policies |
| Dark theme dropdown contract | `select`, `option`, `optgroup` — PASS |
| Recipient routing contract | selected recipient + guarded commander fallback — PASS |
| OAuth scopes | 6 (без `drive`, без `documents`) |
| Protections | 9/9 службових листів |
| ACCESS / RBAC | owner/admin, strict user key, bridge off |
| Script Properties | `WASB_SPREADSHEET_ID`, `WASB_OWNER_EMAIL` задані |
| GAS deploy | `npx clasp push` виконано |
| Git baseline | `main` початково синхронізований з `origin/main`; hotfix ще не закомічений |

---

## Hotfix 2026-06-06

- [x] Виправлено контраст усіх `select` / `option` / `optgroup` у темній темі.
- [x] Додано єдиний `resolveMessageRecipient_()` для вибраного отримувача та commander fallback.
- [x] Денне й детальне зведення використовують спільний recipient resolver.
- [x] Spreadsheet commander preview/link і legacy detailed-send використовують спільний resolver.
- [x] Commander-повідомлення про відпустки та дні народження використовують поточний вибір `Отримувач`.
- [x] Особисті повідомлення бійцю та імениннику залишаються адресованими самій особі.
- [x] Новий sidebar send-route захищений fail-closed RBAC guard.
- [x] Додано `verify-recipient-contract.mjs` до повного `npm run ci`.

---

## Що BLOCKED

| Блокер | Причина | Обхід |
|--------|---------|-------|
| `npm run gas:smoke` | clasp не має дозволу на Execution API | Власник один раз запускає `apiRunProductionSmokeChecks()` в Apps Script UI |
| Git working tree | Hotfix має локальні зміни | Після успішного smoke створити commit |
| GitHub `main` | Hotfix ще не опублікований | Після commit виконати `git push origin main` |

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
- [x] Dark theme dropdown contrast — PASS
- [x] Recipient routing regression — PASS
- [x] Hotfix завантажено в GAS через `npx clasp push`

### Залишилось для CLOSED

- [ ] Власник один раз вручну запускає `apiRunProductionSmokeChecks()` в Apps Script UI
- [ ] `npm run gas:smoke` — PASS (`ok === true`)
- [ ] Локальні hotfix-зміни закомічено
- [ ] Commit запушено в GitHub `main`

---

## Закриття релізу

Після ручного smoke в Apps Script:

```bash
cd ~/git/whatsapp-sheets-bot
npm run gas:smoke
npm run ci
git diff --check
git status
```

Якщо все PASS:

```bash
git add .
git commit -m "fix: improve dark theme select and recipient routing"
git push origin main
```

Після smoke, commit і push оновити цей файл:

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

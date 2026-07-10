# WASB Developer Guide

Коротка «карта місцевості» для maintainer у перший тиждень. Операційний маршрут під час інциденту — у [RUNBOOK.md](../RUNBOOK.md) §9 (debug decision tree).

## Головна ідея

WASB — не випадковий набір `.gs` файлів, а **шари**. Перед зміною зрозумій, який шар відповідає за задачу.

```
Sidebar / Client UI (ui/Js.*, ui/Sidebar.html)
  ↓
api* server endpoints (`api/Stage7ServerApi.gs`, `api/SpreadsheetActionsApi.gs`, …)
  ↓
AccessEnforcement_  — чи дозволена конкретна дія
  ↓
AccessControl_      — хто користувач, роль, ключ
  ↓
Google Sheets       — ACCESS, PERSONNEL, місячні листи, …
```

## Шари системи

| Шар | За що відповідає |
| ----- | ----------------- |
| Sidebar / `ui/Js.*` | Що бачить користувач у UI |
| `api*` | Який server-side сценарій викликано |
| `AccessEnforcement_` | Чи дозволена конкретна дія (картка, send panel, summary) |
| `AccessControl_` | Хто користувач, яка роль, ключ у ACCESS |
| ACCESS | Доступи, ролі, bootstrap, lockout |
| PERSONNEL | Люди, Callsign, Status (UA), телефони |
| Місячні аркуші (`01`…`12`) | Добовий графік, формульний блок |
| `MonthJournalMaterialize` | Derived `ЖУРНАЛ_MM` / `ПІДСУМОК_MM` from month sheets + PERSONNEL + DICT |
| `ReferenceSheetsRepository_` | Optional sidebar reference sheets `PHONE_DIRECTORY` / `CAR` / `WEAPON` |
| `Report_*` | Зведення дня (short з formula block, detailed окремо) — modules in `reports/` |
| Vacation modules | Відпустки, перевірки, міні-календар — server modules in `vacations/` |
| `contracts/` + `scripts/verify-*` | Захист від тихої деградації (governance CI) |

Детальніша архітектура: [ARCHITECTURE.md](../ARCHITECTURE.md). Доступ і RBAC: [SECURITY.md](../SECURITY.md).

## Що не чіпати в перший тиждень без окремого рішення

| Зона | Чому небезпечно |
| ---- | ---------------- |
| `AccessControl_*` | Розпізнавання користувача, login, self-bind |
| `AccessEnforcement_*` | Server-side дозволи на дії |
| `contracts/access-api.contract.json` | Публічна поверхня API + parity з кодом |
| Guard markers (`_stage7AssertRole_`, `assertCan…`) | Обхід permissions |
| PERSONNEL keys (Callsign, Status UA) | Графік, картки, телефони, health; Status auto-heal/validation |
| Formula block на місячних листах | Short summary ([daily-summary-architecture.md](./daily-summary-architecture.md)) |
| `ЖУРНАЛ_MM` / `ПІДСУМОК_MM` derived sheets | Фактична історія місяця; окремий materialize path |
| Bootstrap ACCESS / protections | Login для всіх користувачів |
| Production `clasp` remote | Ризик deploy не в той script project |

## Як думати під час зміни

Перед PR відповідай на п'ять питань:

1. **Який симптом або задача?**
2. **Який шар відповідає?** (див. таблицю вище або RUNBOOK §9)
3. **Який `api*` endpoint зачеплено?**
4. **Чи змінюється security surface?** (ролі, guards, ACCESS schema)
5. **Чи оновлено contract / CI / docs?**

Якщо додаєш або змінюєш `api*`, зміна **не завершена**, поки не проходить `verify-access-api-governance` (recursive scan, contract parity, guard markers).

Якщо змінюєш derived місячний журнал або reference sheets, зміна **не завершена**, поки не проходять відповідні перевірки: `verify-month-journal-materialize`, `verify-reference-repositories`, `verify-reference-workbook-layout`.

Структурні зміни (move/split/merge): [ADR-001](./adr/001-structural-changes.md). **Робоча** карта папок: [ADR-003](./adr/003-working-domain-layout.md), [module-map.md](./module-map.md). Історичні фази: [ADR-002](./adr/002-domain-folder-map.md).

## Де лежать файли

Коротка таблиця domain → folder → CI: [module-map.md](./module-map.md). Після PR #34 усі runtime `.gs` / `.html` у доменних папках (`core/`, `api/`, `ui/`, `reports/`, `vacations/`, …); у корені лишаються конфіг і документація. Структура **робоча**, не фінальна — уточнення через ADR-003.

## Правило для refactor

Move / split / merge файлів — лише **механічна** зміна: ті самі публічні `api*`, guards, контракти, поведінка.

Якщо змінюється поведінка endpoint, guard, role policy або contract — це **функціональна** зміна, не refactor (окремий ADR / review).

## Мінімальна перевірка

```bash
npm run check    # alias: npm run ci
```

**Typical deploy (one production GAS):**

```bash
git add -A && git commit -m "fix: …"
npm run push:remote
```

Or CI + clasp only: `npm run deploy:prod`. Full pipeline with map refresh: `npm run ship -- "fix: …"`.

Після deploy у GAS editor: **`apiStage7MaterializeComputedData()`** (після змін PERSONNEL/PHONES/VACATIONS/birthday/Status), за потреби **`apiStage7MaterializeMonthJournal({ monthSheet: "MM" })`** (якщо мінявся місячний лист або потрібні `ЖУРНАЛ_MM` / `ПІДСУМОК_MM`), потім **`apiStage7ClearPhoneCache()`**, потім перевірка картки людини, reference sidebar views, і health (`apiStage7QuickHealthCheck()`). Повний checklist: [RUNBOOK.md](../RUNBOOK.md) §12–§13.

## Куди далі

| Питання | Документ |
| -------- | -------- |
| Інцидент о 3-й ночі | [RUNBOOK.md §9](../RUNBOOK.md) |
| Bootstrap, ACCESS, deploy | [RUNBOOK.md](../RUNBOOK.md) |
| Identity, lockout, RBAC | [SECURITY.md](../SECURITY.md) |
| Зведення дня | [daily-summary-architecture.md](./daily-summary-architecture.md) |
| Відпустки | [vacation-planner.md](./vacation-planner.md) |
| Локальний workflow | [CONTRIBUTING.md](../CONTRIBUTING.md) |

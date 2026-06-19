# WASB Developer Guide

Коротка «карта місцевості» для maintainer у перший тиждень. Операційний маршрут під час інциденту — у [RUNBOOK.md](../RUNBOOK.md) §9 (debug decision tree).

## Головна ідея

WASB — не випадковий набір `.gs` файлів, а **шари**. Перед зміною зрозумій, який шар відповідає за задачу.

```
Sidebar / Client UI (ui/Js.*, ui/Sidebar.html)
  ↓
api* server endpoints (Stage7ServerApi, SpreadsheetActionsApi, …)
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
| PERSONNEL keys (Callsign, Status UA) | Графік, картки, телефони, health |
| Formula block на місячних листах | Short summary ([daily-summary-architecture.md](./daily-summary-architecture.md)) |
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

Структурні зміни (move/split/merge): [ADR-001](./adr/001-structural-changes.md). План папок по доменах: [ADR-002](./adr/002-domain-folder-map.md), [module-map.md](./module-map.md).

## Де лежать файли

Коротка таблиця domain → folder → CI: [module-map.md](./module-map.md). Зараз у підпапках: `reports/` (3 модулі), `vacations/` (11 модулів). Решта runtime — у root до наступних фаз ADR-002.

## Правило для refactor

Move / split / merge файлів — лише **механічна** зміна: ті самі публічні `api*`, guards, контракти, поведінка.

Якщо змінюється поведінка endpoint, guard, role policy або contract — це **функціональна** зміна, не refactor (окремий ADR / review).

## Мінімальна перевірка

```bash
npm run ci
```

Перед production deploy (з правильною clasp-авторизацією і production script project):

```bash
npx clasp push
```

Після deploy у GAS editor: **`apiStage7ClearPhoneCache()`**, потім перевірка картки людини та health (`apiStage7QuickHealthCheck()`). Повний checklist: [RUNBOOK.md](../RUNBOOK.md) §12–§13.

## Куди далі

| Питання | Документ |
| -------- | -------- |
| Інцидент о 3-й ночі | [RUNBOOK.md §9](../RUNBOOK.md) |
| Bootstrap, ACCESS, deploy | [RUNBOOK.md](../RUNBOOK.md) |
| Identity, lockout, RBAC | [SECURITY.md](../SECURITY.md) |
| Зведення дня | [daily-summary-architecture.md](./daily-summary-architecture.md) |
| Відпустки | [vacation-planner.md](./vacation-planner.md) |
| Локальний workflow | [CONTRIBUTING.md](../CONTRIBUTING.md) |

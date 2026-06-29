# ADR-003: Робоча доменна структура файлів

## Status

Accepted (робоча домовленість; **не** фінальна архітектурна межа)

## Date

2026-06-19

## Context

У проєкті ~125 `.gs` і ~33 `.html` runtime-модулів. Плоский корінь ускладнював супровід, review і onboarding.

[Pilot і фази ADR-002](./002-domain-folder-map.md) (`reports/`, `vacations/`, clasp nested push) довели механічний pipeline. PR [#34](https://github.com/Averixor/whatsapp-sheets-bot/pull/34) розклав **усі** runtime `.gs` / `.html` по доменних папках.

Цей ADR фіксує **поточну робочу структуру** як практичний орієнтир: де шукати код, куди додавати модулі, які CI запускати. Структура **може уточнюватися** окремим ADR/PR (нові домени, split/merge, перейменування папок).

Механічні правила переносу — [ADR-001](./001-structural-changes.md). Жива таблиця доменів — [module-map.md](../module-map.md).

## Decision

### Принцип

Кожен runtime-файл лежить у папці за **призначенням**, не в корені репозиторію. Корінь — конфіг, документація, tooling (`README.md`, `appsscript.json`, `package.json`, `.claspignore`, `contracts/`, `scripts/`, `docs/`).

### Робоча карта папок

| Папка | Призначення | Приклади |
| ----- | ----------- | -------- |
| `reports/` | Зведення, денні/місячні звіти | `Report_*.gs`, `Summaries.gs`, `Summary*.gs` |
| `vacations/` | Відпустки, перевірки, календар | `Vacation*.gs` |
| `sendpanel/` | Панель надсилання, отримувачі | `SendPanel*.gs`, `UseCases.SendPanel.gs` |
| `access/` | Доступ, ролі, ACCESS | `AccessControl.*.gs`, `AccessEnforcement.gs` |
| `personnel/` | Особовий склад, картки | `PersonnelRepository.gs`, `PersonCards.gs` |
| `api/` | Публічні серверні `api*` | `Stage7ServerApi.gs`, `Stage7MaintenanceApi.gs` |
| `core/` | Системні утиліти, конфіг, маршрутизація | `Code.gs`, `ProjectMetadata.gs`, `RoutingRegistry.gs` |
| `data/` | Репозиторії, доступ до даних | `DataAccess.gs`, `*Repository.gs` (спільні) |
| `sheets/` | Структура аркушів, схеми, захист | `SheetSchemas.gs`, `MonthSheets.gs`, `Validation.gs` |
| `usecases/` | Фасад use-case і доменні сценарії (окрім sendpanel) | `UseCases.gs`, `UseCases.Summaries.gs` |
| `ui/` | HTML/JS/CSS клієнта | `Sidebar.html`, `JavaScript.html`, `Js.*.html` |
| `ui-server/` | Серверні хелпери sidebar/діалогів | `SidebarServer.gs`, `Dialogs.gs` |
| `maintenance/` | Обслуговування, шаблони, формати | `ConditionalFormat*.gs`, `Template*.gs` |
| `diagnostics/` | Health і runtime-діагностика | `Diagnostics.*.gs` (production) |
| `security/` | Аудит, редагування чутливих даних | `AuditTrail.gs`, `SecurityRedaction.gs` |
| `operations/` | Операційні сценарії, тригери | `Triggers.gs`, `Reconciliation.gs` |
| `tests/` | Локальні test runners (clasp **excluded**) | `Stage7TestRunner*.gs`, `*Tests.gs` |

`contracts/`, `scripts/`, `docs/` — як і раніше, не GAS runtime.

### Обов'язкові правила переносу

1. Не перейменовувати basenames без окремої потреби (глобальний namespace GAS).
2. Не об'єднувати файли під час structural PR.
3. Не змінювати поведінку функцій у PR «тільки move».
4. Не змішувати structural move з функціональним рефакторингом.
5. Не ламати `clasp push` (див. `.claspignore`: `!**/*.gs`, `!**/*.html`, потім re-exclude).
6. Оновлювати `ProjectMetadata.gs`, contracts і verify-скрипти, якщо вони посилаються на шляхи.
7. `npm run ci` (+ доменний CI з [module-map.md](../module-map.md)) — зелений перед merge.

### Дозволено в одному structural PR

- `git mv` + оновлення шляхів у docs / CI / `ProjectMetadata.gs`
- `module-map.md`, ARCHITECTURE, RUNBOOK (шляхи)

### Заборонено в structural PR

- Зміна бізнес-логіки, API-контрактів, role policy
- Merge/split великих модулів
- Unrelated bugfix
- Прихований рефакторинг під виглядом move
- Зміна user-facing copy без окремої задачі

## Consequences

- **0** runtime `.gs` у корені після #34; усі `.html` у `ui/`.
- `readRepoFileByBasename` — basename-first для CI; hardcoded `path.join(repoRoot, …)` оновлювати в тому ж PR.
- `usecases/` — практичне розширення карти ADR-002 (фасад окремо від `core/` і `sendpanel/`).
- Фізичні назви вкладок таблиці (`PERSONNEL`, `SEND_PANEL`) **не** є частиною цієї структури repo — окрема міграція/ADR.

## Критерії готовності (поточний етап)

| # | Критерій | Стан |
| - | -------- | ---- |
| 1 | Runtime `.gs` / `.html` у смислових папках | ✅ #34 |
| 2 | Немає випадкових runtime-файлів у корені | ✅ |
| 3 | Структура в документації | ✅ `module-map.md`, цей ADR |
| 4 | `module-map`: домен → папка → CI | ✅ |
| 5 | `.claspignore` не відсікає nested runtime | ✅ |
| 6 | `npm run ci` | ✅ на main після #34 |
| 7 | Доменні CI за потреби | workbook / vacations / client / format-rules |
| 8 | `npx clasp status` перед prod push | обов'язково вручну |
| 9 | У PR зазначено: структура робоча, може уточнюватися | шаблон нижче |

## Формулювання для structural PR

> Приводимо файли до **поточної робочої** доменної структури (ADR-003). Лише mechanical move + paths/docs/CI. Поведінка без змін. Структура не фінальна — уточнення окремим ADR за потреби.

## Related

- [ADR-001](./001-structural-changes.md) — mechanical changes
- [ADR-002](./002-domain-folder-map.md) — історичні фази (pilot → #34)
- [user-facing-copy.md](../user-facing-copy.md) — UI-тексти (окремо від folder layout)

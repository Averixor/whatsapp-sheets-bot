# Архітектура зведення дня (коротке та детальне)

Цей проєкт працює в Google Apps Script (V8) і прив'язаний до Google Sheets. **Джерелом розрахунків є формули в таблиці**, а скрипт лише **зчитує готові значення** й формує текст повідомлення.

## Принцип

```text
Формули в Google Sheets рахують → Apps Script читає готові значення → Apps Script формує повідомлення
```

Коротке зведення **не** повторно обходить `PERSONNEL` / `DICT_SUM` і **не** дублює формули таблиці.

## Місячні листи

Місячні листи мають назви `01`…`12`. На кожному:

- **рядок дат** (зазвичай `CONFIG.DATE_ROW`, рядок 1) з датами місяця;
- **матриця графіка** (коди по людях і днях);
- **нижній формульний блок** (після зони графіка) з підсумками по кожному дню.

У таблиці метки блоку можуть бути з `_` (`За_штатом`, `Drone_Camp`). У фінальному тексті — **без підкреслень**.

### Канонічні показники короткого зведення

Порядок виводу (фіксований у `SIMPLE_DAILY_SUMMARY_ORDER`):

| Ключ у таблиці | Текст у звіті |
| -------------- | ------------- |
| `За_штатом` | За штатом |
| `За_списком` | За списком |
| `В_наявності` | В наявності |
| `У_відрядженні` | У відрядженні |
| `У_відпустці` | У відпустці |
| `Гусачівка` | Гусачівка |
| `Drone_Camp` | Drone Camp |
| `ППД` | ППД |
| `КП` | КП |
| `БР` | БР |

Якщо показник відсутній у формульному блоці — у повідомленні виводиться `0`.

### Приклад короткого зведення

```text
14.06

За штатом: 30
За списком: 29
В наявності: 23
У відрядженні: 2
У відпустці: 1
Гусачівка: 3
Drone Camp: 0
ППД: 9
КП: 2
БР: 5
```

## Пошук нижнього формульного блоку

Реалізація: `findSummaryBlockLocation_()` у `reports/Report_SummaryData.gs`.

1. Визначити кінець зони графіка (`getMonthlyCodeRangeA1ForSheet_()` / `MONTHLY_CONFIG.LAST_DATA_ROW`).
2. Нижче цієї зони просканувати колонки меток: мінімум `B:C`, для широкого лейауту — `A:D`.
3. Знайти рядок, де нормалізована метка = `За_списком` (якір).
4. Якщо рядком вище — `За_штатом`, `startRow` зсувається на нього.
5. `endRow` — до першої порожньої клітинки в колонці меток.

Нормалізація ключів: `normalizeSummaryKey_()` — `trim`, пробіли → `_`, злиття `_+`.

Парсер чисел: `parseSummaryNumber_()` — стійкий до `"29 осіб"`, ком, пробілів; порожнє → `0`.

## Пошук колонки дати

`findDateColumnInMonthSheet_()` / `findTodayColumn_()` — порівняння по даті без часу, без жорсткої прив'язки до номера колонки.

Типові помилки:

- `Не знайдено колонку дати {dd.MM.yyyy} на аркуші {mm}`
- `Не знайдено формульний блок зведення на аркуші {mm}`

## Модулі та відповідальність

| Файл | Роль |
| ---- | ---- |
| `reports/Report_SummaryData.gs` | Читання: константи, нормалізація, пошук блоку/дати, `readDailySummaryFromFormulaBlock*` |
| `reports/Report_DailySimple.gs` | Форматування короткого зведення: `formatSimpleDailySummary_`, `buildSimpleDailySummaryFromFormulaBlock_` |
| `reports/Report_DailyDetailed.gs` | Детальне зведення: `collectPeopleDetailed_`, `formatDetailedSummary_`, `sendDetailedSummaryToCommander` |
| `reports/Summaries.gs` | Legacy-точка входу `buildDaySummaryForColumn_()` → делегує в `reports/Report_DailySimple.gs`; UI-діалог `showDetailedSummaryDialog_` |
| `reports/SummaryRepository.gs` | Канонічна збірка: `buildDaySummary`, `buildDetailedSummary` |
| `reports/SummaryService.gs` | Domain service для меню/GAS editor: `buildDay`, `buildDetailed` |
| `usecases/UseCases.Summaries.gs` | Use-case + RBAC: `buildDaySummary`, `buildDetailedSummary` |

### Детальне зведення

Окрема логіка. Використовує місячний лист, колонку дня, `PERSONNEL`, `DICT_SUM`, коди графіка. Не підміняє коротке зведення.

## Ланцюжок викликів (бокова панель)

Основний UI — **бокова панель WASB**, не верхнє меню.

| Кнопка | Клієнт | Сервер | Результат |
| ------ | ------ | ------ | --------- |
| **Зведення дня** | `handleMenuAction('daySummary')` → календар → `Stage7Api.buildDaySummary()` | `apiBuildDaySummary` → `UseCases.Summaries` → `SummaryRepository_.buildDaySummary` → `buildDaySummaryForColumn_` → формульний блок | текст у панелі |
| **Детальне зведення** | `handleMenuAction('detailedDay')` → календар → `Stage7Api.buildDetailedSummary()` | `apiBuildDetailedSummary` → `reports/Report_DailyDetailed.gs` | текст у панелі |

Верхнє меню Google Sheets:

```text
WASB
 └─ Відкрити панель
```

Окреме меню `Звіти` **не використовується**.

Допоміжні server-side обгортки (GAS editor, за потреби):

- `uiShowSimpleDaySummary()` — модальний діалог з коротким зведенням
- `uiShowDetailedDaySummary()` — модальний діалог з детальним зведенням

## Локальні тести

`scripts/verify-workbook-contract.mjs` (без Google credentials):

- compact layout і геометрія місячного листа;
- динамічний пошук формульного блоку (`startRow` на `За_штатом`, якщо він над `За_списком`);
- читання значень і форматування короткого зведення;
- наявність `За штатом` у виводі, відсутність `_` у фінальному тексті;
- помилки при відсутній даті / відсутньому блоці;
- базові перевірки детального зведення (групи `БР`, `КП`, `Відпустка`, `Відрядрядження`, порядок `DICT_SUM`).

## Ручна перевірка після деплою

1. `WASB` → `Відкрити панель`.
2. **Зведення дня** → обрати дату → переконатися, що цифри збігаються з нижнім формульним блоком на місячному листі.
3. Перший рядок — `За штатом: …`, без `_` у назвах.
4. **Детальне зведення** → перевірити групування людей по кодах.
5. Після `clasp push`: `apiStage7ClearPhoneCache()` у GAS editor.

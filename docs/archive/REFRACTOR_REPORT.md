# Рефакторинг GAS-системи — stage 2 package

## Що зроблено

### 1. Code.gs реально розвантажено
З вихідного `Code.gs` виділено окремі модулі:
- `Log.gs`
- `SheetStandards.gs`
- `DataAccess.gs`
- `MonthSheets.gs`
- `SendPanel.gs`
- `Actions.gs`
- `Summaries.gs`
- `SidebarServer.gs`
- `Dialogs.gs`

У `Code.gs` залишено конфігурацію, базові фасади, bot-month state, include/menu та системні entry-point-и.

### 2. Впроваджено canonical helper-layer
Додано:
- `DateUtils.gs` — єдина canonical-точка для парсингу, нормалізації та форматування дат;
- `HtmlUtils.gs` — єдина canonical-реалізація HTML-екранування;
- `ServerResponse.gs` — спільний контракт server-side відповідей;
- `SmokeTests.gs` — мінімальний smoke-test набір.

У `Utils.gs` старі date/html helper-и переведено на thin-wrapper сумісності.

### 3. Sidebar client переведено на один namespace
У `JavaScript.html` прибрано flat-export у `window`.
Тепер зовнішній API sidebar експортується через один глобальний namespace:
- `window.SidebarApp`

`Sidebar.html` і динамічний HTML у `JavaScript.html` оновлені на виклики виду `SidebarApp.method(...)`.

### 4. Контекстніші помилки
`buildPayloadForCell_()` тепер формує помилки через `buildContextError_()` з контекстом:
- function
- sheet
- row
- col
- a1

### 5. Diagnostics посилено
`healthCheck()` тепер додатково перевіряє:
- наявність `DateUtils_`
- наявність `HtmlUtils_`
- наявність `runSmokeTests()`
- наявність thin-wrapper layer для backward compatibility

### 6. Smoke tests додано
`runSmokeTests()` перевіряє мінімум:
- `buildMessage_()`
- `healthCheck()`
- date helpers
- `escapeHtml_()`
- `getMonthsList()`
- `getSendPanelSidebarData()`
- dry-run `markMultipleAsSentFromSidebar()`

## Що не робилося навмисно
- Бізнес-логіка повідомлень, відпусток, сводок і картки не переписувалась з нуля.
- Старі modal/dialog сценарії не переводились на новий frontend API повністю, якщо це не було критичним для основного sidebar-потоку.
- Не додавалась зовнішня БД, framework чи сторонній backend.

## Ризики / залишки
- Старі server-generated dialogs усе ще містять окремі локальні inline-script рішення — це контрольований legacy-шар, а не основний sidebar runtime.
- Автоматично перевірено синтаксис і структуру, але не бойові Spreadsheet-дані користувача.

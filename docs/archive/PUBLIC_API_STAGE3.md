# PUBLIC_API_STAGE3.md

## Canonical server-side API

Все методы ниже возвращают единый контракт:

```javascript
{
  success: true | false,
  message: string,
  error: string | null,
  data: any,
  context: object | null,
  warnings: []
}
```

## Methods

### Sidebar / panel
- `apiGetMonthsList()` — список доступных месячных листов и активный месяц.
- `apiGetSidebarData(dateStr)` — агрегированные данные sidebar на дату.
- `apiGenerateSendPanel(options)` — dry-run/real generation SEND_PANEL.
- `apiGetSendPanelData()` — данные текущей панели отправки.
- `apiMarkSendPanelRowsAsSent(rowNumbers, options)` — отметка строк как отправленных.

### Summaries
- `apiGetDaySummary(dateStr)` — дневная сводка.
- `apiGetDetailedDaySummary(dateStr)` — детальная сводка.

### Person card / birthdays
- `apiGetPersonCardData(callsign, dateStr)` — карточка бойца.
- `apiGetBirthdays(dateStr)` — день рождения/сообщения.
- `apiBuildBirthdayLink(phone, name)` — ссылка для поздравления.

### Vacations
- `apiCheckVacations(dateStr)` — состояние отпусков и подготовленные уведомления.
- `apiSetupVacationTriggers()` — настройка триггеров.
- `apiCleanupDuplicateTriggers(functionName)` — cleanup дублей триггеров.

### Maintenance / admin
- `apiSwitchBotToMonth(monthSheetName)`
- `apiCreateNextMonth()`
- `apiDebugPhones()`
- `apiClearCache()`
- `apiClearPhoneCache()`
- `apiClearLog()`
- `apiHealthCheck(options)`
- `apiRunRegressionTests(options)`

## Canonical client-side service layer

`JavaScript.html` использует:
- `Api.run(method, ...args)`
- `SidebarApi`
- `SummaryApi`
- `CardApi`
- `DiagnosticsApi`

Новый UI-код должен ходить к серверу через эти сервисы, а не напрямую плодить новые `google.script.run`-вызовы.

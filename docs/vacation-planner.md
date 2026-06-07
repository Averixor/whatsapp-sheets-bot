# Vacation Planner

WASB vacation workflow is embedded in the main sidebar:

```text
WASB → 📱 ПАНЕЛЬ → 🏖️ Відпустки
PERSONNEL → VACATIONS → planner/checks → VACATION_SCHEDULE / VACATION_CHECK
```

There is no separate top-level `WASB → Відпустки` menu and no second
`HtmlService.showSidebar()` for vacations. `VacationSidebar.html` is legacy
only (deprecated).

Runtime modules: `VacationPlannerConfig.gs`, `VacationPlannerService.gs`,
`VacationOptionsWriter.gs`, `VacationSidebarService.gs`, `VacationsRepository.gs`,
client `Js.Vacations.html`.

## Sources of truth

- `PERSONNEL` — active people (`Callsign — FML` in selectors).
- `VACATIONS` — only vacation records (`A:I` slot 1, `K:S` slot 2).
- `VacationsRepository_.listAll()` merges both blocks before any calculation.
- `VACATION_OPTIONS` is not used in the main-panel workflow.

Formula blocks in production may expose calculated columns; writes go to
writable input cells in `A:I`. Calculated rows (`manageable === false`) are
read-only in UI.

## Main panel tabs

| Tab       | Actions                                                               |
| --------- | --------------------------------------------------------------------- |
| Огляд     | stats, active list, refresh, **🔔 reminders**, rebuild, open calendar |
| Графік    | rebuild, open calendar                                                |
| Додати    | add В1/В2/ВД/СО                                                       |
| Підібрати | planner top options + apply                                           |
| Перенести | move active vacation                                                  |
| Перевірка | all rules + single-date validation                                    |
| Звіт      | unit report                                                           |

Reminders call `apiCheckVacationsAndBirthdays` inside the vacations screen
(legacy `vacationReminder` action remains for tests only).

## Server entrypoints (unchanged)

`getVacationSidebarState`, `addVacationFromSidebar`, `findVacationSidebarOptions`,
`applyVacationOptionFromSidebar`, `moveVacationFromSidebar`, `cancelVacationFromSidebar`,
`rebuildVacationScheduleFromSidebar`, `checkVacationRulesFromSidebar`,
`validateVacationDateFromSidebar`, `generateVacationReportFromSidebar`,
`openVacationScheduleFromSidebar`.

Client: `SidebarApp.handleMenuAction('vacations')` → `showVacationsModule()`.

## Local verification

```bash
npm run ci:vacations
npm run ci
```

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
| Проблеми  | understandable problem cards, suggestions, jump to date picker        |
| Звіт      | unit report                                                           |

Reminders call `apiCheckVacationsAndBirthdays` inside the vacations screen
(legacy `vacationReminder` action remains for tests only).

`VACATION_CHECK` remains a technical audit sheet for administrators. End users
see **Проблемні питання** with human-readable labels (never internal codes like
`GAP_TOO_SHORT`), explanations, suggestions, and a safe jump to `Підібрати`.
Reports and the overview card point to **Проблемні питання** instead of the
audit sheet.

`VACATION_SCHEDULE` keeps `QUANTITY | FML` in columns `A:B`. Only calendar
cells from `C2` are colored: `В1`, `В2`, `ВД`, `СО`, and mixed markers use
distinct fills, while blanks stay white. A medium right border marks every
month transition across the full calendar height.

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

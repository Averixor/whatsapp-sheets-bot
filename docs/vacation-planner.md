# Vacation Planner

WASB uses a sidebar-first vacation workflow:

```text
PERSONNEL -> VACATIONS -> VacationSidebar -> VACATION_SCHEDULE -> VACATION_CHECK
```

`VacationSidebar.html` is the only vacation-management interface. Sheets are
data or generated views, not the primary user interface.

Runtime modules: `VacationPlannerConfig.gs`, `VacationPlannerTypes.gs`,
`VacationPlannerService.gs`, `VacationOptionsWriter.gs`,
`VacationSidebarService.gs`, `VacationsRepository.gs`.

## Sources of truth

- `PERSONNEL` is the source of people. Sidebar selectors show active people as
  `Callsign - FML`.
- `VACATIONS` is the only source of vacation records.
- `VACATION_DATA` must not be created.
- `VACATION_OPTIONS` is optional debug/cache output and is not used by the
  sidebar workflow.

`VACATIONS` contains two equal source blocks:

| Block | Columns | Slot |
| --- | --- | --- |
| First | `A:I` | vacation slot 1 |
| Second | `K:S` | vacation slot 2 |

`VacationsRepository_.listAll()` merges both blocks before planning, checks,
cards, or notifications.

The production sheet uses array formulas for calculated columns such as
`End date`, `Active`, `Notify`, `Days left`, and `Interval check`. Sidebar
writes touch only the input cells (`FML`, `Start date`, `Vacation №`, `Travel`);
cancel clears the start date and lets the existing formulas recalculate.

## Sidebar workflow

Open `WASB > Відпустки > Панель керування`.

The sidebar contains:

- `Графік`: statistics, active vacations, cancel, rebuild, open calendar.
- `Додати`: add `В1`, `В2`, `ВД`, or `СО`.
- `Підібрати`: show up to five scored options and apply one directly.
- `Перенести`: move an existing vacation.
- `Перевірка`: check all rules or validate one date.
- `Звіт`: generate the vacation summary.

Applying an option revalidates it under a document lock, writes directly to
`VACATIONS`, then rebuilds `VACATION_SCHEDULE` and `VACATION_CHECK`.

## Generated sheets

`VACATION_SCHEDULE` is a calendar:

```text
QUANTITY | FML | 01.01 | 02.01 | 03.01 | ...
15       | ... | В1    | В1    | В1    |
```

Markers: `В1` first, `В2` second, `ВД` additional, `СО` family circumstances.
`QUANTITY` is the total active vacation days for the person.

`VACATION_CHECK` columns:

```text
Date | Type | FML | Description | Severity
```

Public violation types are `MAX_CONCURRENT`, `START_TOO_CLOSE`,
`GAP_TOO_SHORT`, `YEAR_LIMIT`, and `INVALID_DATE`.

## Rules

- No more than two active vacations per person per year.
- At least 150 days between one person's vacations.
- No more than four people on vacation at once.
- Different people's starts must be at least two days apart.
- End date must equal start date plus days minus one.

## Menu handlers

GAS menus call global wrappers only:

| Action | Global wrapper |
| --- | --- |
| Панель керування | `showVacationSidebar()` |
| Оновити графік | `rebuildVacationScheduleFromMenu()` |
| Перевірити порушення | `checkVacationRulesFromMenu()` |

## Verification

```bash
npm run ci:vacations
npm run ci
npx clasp status
```

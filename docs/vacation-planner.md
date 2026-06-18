# Vacation Planner

WASB vacation workflow is embedded in the main sidebar:

```text
WASB → 📱 ПАНЕЛЬ → 🏖️ Відпустки
PERSONNEL → active vacation source → planner/checks → VACATION_SCHEDULE / VACATION_CHECK
```

There is no separate top-level `WASB → Відпустки` menu and no second
`HtmlService.showSidebar()` for vacations. `VacationSidebar.html` is legacy
only (deprecated).

## Runtime modules

| Module | Role |
| ------ | ---- |
| `vacations/VacationPlannerConfig.gs` | Rules, sheet names, source headers |
| `vacations/VacationPlannerService.gs` | Validation, audit, scoring |
| `vacations/VacationOptionsWriter.gs` | Schedule/check rebuild, reports |
| `vacations/VacationSidebarService.gs` | Sidebar entrypoints |
| `vacations/VacationsRepository.gs` | Active source adapter |
| `vacations/VacationMonthCalendar.gs` | Month mini-calendar payload |
| `vacations/Vacation_Suggestions.gs` | Fix suggestions for audit issues |
| `vacations/VacationBulkFix.gs` | Bulk fix plan/apply |
| `Js.Vacations.html` | Vacations tab UI |
| `Styles_30_Personnel.html` | Mini-calendar styles |

## Sources of truth

- `PERSONNEL` — active people (`Callsign — FML` in selectors).
- `VACATIONS` — default legacy source (`A:I` only; `K:Q` is presentation/migration only).
- `VACATION_REQUESTS` — opt-in flat source with one request per row.
- `VacationsRepository_.listAll()` hides the active physical source from the
  planner, sidebar, person cards, reports, and reminder engine.
- `VACATION_OPTIONS` is retired; date suggestions stay in the main panel and
  are applied directly. An existing sheet may remain as a protected technical
  archive, but runtime code no longer reads or writes it.

The source defaults to `VACATIONS`. `VACATION_REQUESTS` becomes active only
when Script Property `WASB_VACATION_SOURCE` is exactly `VACATION_REQUESTS`.
There is no silent fallback while request mode is active: a missing or invalid
request sheet is an explicit error, preventing split-brain writes.

`VACATION_REQUESTS` columns:

`ID | PersonKey | FML | Year | VacationNo | Type | DesiredStart | ApprovedStart | EndDate | Days | TravelDays | Status | Notify | CreatedAt | UpdatedAt | Comment`

Every non-empty request row must have a unique `ID`; active rows must also have
`PersonKey` and `FML`. Request-mode move and cancel operations address the row
by `ID`, not by a fragile FML/type combination. `PersonKey` is the stable
Callsign-first identity used by planning and plan/fact reconciliation; FML
remains the display value and fallback alias.

Active planning statuses are `Proposed`, `Approved`, and `Applied`. `Draft` and
`Cancelled` stay in the source but do not participate in schedule calculations.
Only `Approved` and `Applied` are operational records and may produce
reminders. Only `Applied` is expected to have matching daily codes in monthly
sheets. Legacy active rows keep their previous operational/fact behavior.

Legacy formula blocks may expose calculated columns; legacy writes go to
writable input cells in `A:I`. Calculated rows (`manageable === false`) are
read-only in UI.

## Safe source migration

Run these global functions from the GAS editor as a sysadmin:

1. `previewVacationRequestsMigration()` — dry-run only.
2. `applyVacationRequestsMigration()` — creates and fills
   `VACATION_REQUESTS`, then activates it only after migration succeeds.
3. Run `checkVacationRulesFromMenu()` and `apiCheckVacationsAndBirthdays()`.

Migration never overwrites a non-empty `VACATION_REQUESTS`. To roll back reads
and writes without deleting migrated data, run
`rollbackVacationRequestsToLegacy()`. Active legacy rows migrate as `Applied`
so switching sources preserves their reminder and fact-audit behavior.
Migration and rollback hold the document lock used by panel writes.

## Main panel tabs

| Tab       | Actions                                                        |
| --------- | -------------------------------------------------------------- |
| Огляд     | stats, refresh, **🔔 reminders**, rebuild, mini-calendar       |
| План      | active plan, move/cancel, rebuild, mini-calendar               |
| Додати    | add В1/В2/ВД/СО                                                |
| Підібрати | planner top options + apply                                    |
| Проблеми  | understandable problem cards, suggestions, jump to date picker |
| Звіт      | unit report                                                    |

Reminders call `apiCheckVacationsAndBirthdays` inside the vacations screen
(legacy `vacationReminder` action remains for tests only).

`VACATION_CHECK` remains a technical audit sheet for administrators. End users
see **Проблемні питання** with human-readable labels (never internal codes like
`GAP_TOO_SHORT`), explanations, concrete fix suggestions (`Vacation_Suggestions.gs`),
and a safe jump to `Підібрати`. Each actionable suggestion shows old/new dates,
expected effect, risks, and **Застосувати** when auto-apply is safe.
Reports and the overview card point to **Проблемні питання** instead of the
audit sheet.

The audit is non-mutating and also reconciles plan and fact:

- overlapping active vacations for the same person;
- `PERSONNEL.Status = Відпустка` without a current approved/applied plan record;
- monthly `Відпус` codes without a matching approved/applied plan record;
- `Applied` plan dates without `Відпус` where that person/date exists in a
  monthly sheet;
- active `PERSONNEL` without any planned vacation in the audit year (`MIN_PERSON_YEAR`).

Missing future monthly sheets do not produce false positives. The audit never
changes `PERSONNEL`, monthly sheets, reminders, or `Calculation_OS`.

## Planner rules (`VACATION_PLANNER_CONFIG.RULES`)

Canonical values in `vacations/VacationPlannerConfig.gs`:

| Rule | Value | Meaning |
| ---- | ----- | ------- |
| `MAX_CONCURRENT` | 3 | Normal maximum people on vacation at once |
| `OVERLOAD_CONCURRENT` | 4 | Short overload allowed up to `OVERLOAD_MAX_CONSECUTIVE_DAYS` |
| `OVERLOAD_MAX_CONSECUTIVE_DAYS` | 3 | Max consecutive days with 4 people |
| `ABSOLUTE_MAX_CONCURRENT` | 5 | Always an error |
| `MIN_VACATION_DAYS` | 15 | Minimum duration of one vacation |
| `MIN_VACATIONS_PER_PERSON_YEAR` | 1 | Each active person needs ≥1 vacation/year |
| `MAX_VACATIONS_PER_PERSON_YEAR` | 2 | Maximum vacations per person per year |
| `MIN_DAYS_GAP` | 150 | Minimum gap between vacations of the same person (~5 months) |
| `MIN_START_GAP_DAYS` | 2 | Minimum gap between start dates of different people |
| `MONTH_START_WARNING` | 5 | Warning when ≥5 vacation starts in one month |

### Blocking writes (`BLOCKING_RULES`)

Invalid option/date/duration, person overlap, interval too short (`PERSON_GAP`),
start dates too close (`START_GAP`), no vacation in audit year (`MIN_PERSON_YEAR`),
more than two vacations per person/year (`MAX_PERSON_YEAR`), **5+ people** on one
day (`MAX_CONCURRENT`), **4 people for more than 3 consecutive days**
(`OVERLOAD_STREAK`).

### Warnings (`WARNING_RULES`)

Borderline load (`HIGH_LOAD_PERIOD`): exactly 3 people, or 4 people within the
short-overload window. Month balance (`MONTH_BALANCE`): many starts in one month.
Warnings are visible but do not block the write.

## Month mini-calendar (Огляд / План)

The sidebar mini-calendar reads the same `A:I` vacation source as the planner
(`vacations/VacationMonthCalendar.gs` → `readVacationSource_()`).

### Cell layout

Cells show **only**:

```text
22        ← day number
────────  ← divider
2         ← people count (⚠ / ❌ prefix when warning/error)
```

No callsigns, FML, or truncated names inside the grid.

| Count / prefix | `loadLevel` | Meaning |
| -------------- | ----------- | ------- |
| 0–2 | `normal` | normal load |
| 3 | `max` | maximum allowed load |
| ⚠ 4 | `warning` | short overload (≤3 consecutive days) |
| ❌ 5+ | `error` | rule violation |

CSS classes: `--max`, `--warning`, `--overload`.

### Navigation

- **◀ / ▶** — previous/next month (passes explicit `{ year, month }` to the
  server; does not re-read stale select values).
- **Рік** / **Місяць** selectors + **Показати місяць**.
- Cross-month vacations appear in every month they touch.

### Footer summary

Only dynamic month stats (no static rule text):

```text
Проблемних дат: …
Навантажених днів: …
```

### Tooltip (hover)

Built client-side by `buildVacationDayTooltip_()` in `Js.Vacations.html`.
Shows human-readable date, people count, problems count, status label, optional
`peoplePreview` / `problemsPreview`, and click hint. ISO date alone is not used
as the tooltip.

### Click (day details)

`getVacationCalendarDayDetailsFromSidebar` returns full name list, vacation
ranges, problems, and up to five validated move suggestions from
`Vacation_Suggestions.gs`.

### Day payload (server)

Each calendar day includes at minimum:

```js
{
  isoDate: "2026-12-22",
  dateIso: "2026-12-22",
  day: 22,
  vacationsCount: 2,
  loadLevel: "normal",
  problemsCount: 0,
  peoplePreview: [{ name, startText, endText, … }],
  problemsPreview: [{ type, message }]
}
```

`VACATION_SCHEDULE` keeps `QUANTITY | FML` in columns `A:B`. Only calendar
cells from `C2` are colored: `В1`, `В2`, `ВД`, `СО`, and mixed markers use
distinct fills, while blanks stay white. A medium right border marks every
month transition across the full calendar height.

## Server entrypoints (sidebar)

`getVacationSidebarState`, `addVacationFromSidebar`, `findVacationSidebarOptions`,
`applyVacationOptionFromSidebar`, `moveVacationFromSidebar`, `cancelVacationFromSidebar`,
`rebuildVacationScheduleFromSidebar`, `checkVacationRulesFromSidebar`,
`validateVacationDateFromSidebar`, `generateVacationReportFromSidebar`,
`openVacationScheduleFromSidebar`, `openUpdatedVacationScheduleFromSidebar`,
`applyVacationSuggestionFromSidebar`, `buildVacationBulkFixPlanFromSidebar`,
`applyVacationBulkFixPlanFromSidebar`, `getVacationMonthCalendarFromSidebar`,
`getVacationCalendarDayDetailsFromSidebar`, `applyRightPanelMigrationFromSidebar`.

Client: `SidebarApp.handleMenuAction('vacations')` → `showVacationsModule()`.

## Local verification

```bash
npm run ci:vacations
npm run ci
```

Contract checks in `scripts/verify-vacation-planner.mjs` cover rules, calendar
payload, tooltip helpers, cell layout, navigation, and absence of static rule
text in the footer summary.

Manual check after deploy: **WASB → ПАНЕЛЬ → Відпустки → Огляд/План** —
◀/▶ month switch, tooltip content, day click details, problem highlighting.

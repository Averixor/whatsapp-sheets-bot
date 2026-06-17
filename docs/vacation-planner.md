# Vacation Planner

WASB vacation workflow is embedded in the main sidebar:

```text
WASB → 📱 ПАНЕЛЬ → 🏖️ Відпустки
PERSONNEL → active vacation source → planner/checks → VACATION_SCHEDULE / VACATION_CHECK
```

There is no separate top-level `WASB → Відпустки` menu and no second
`HtmlService.showSidebar()` for vacations. `VacationSidebar.html` is legacy
only (deprecated).

Runtime modules: `VacationPlannerConfig.gs`, `VacationPlannerService.gs`,
`VacationOptionsWriter.gs`, `VacationSidebarService.gs`, `VacationsRepository.gs`,
client `Js.Vacations.html`.

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
| Огляд     | stats, refresh, **🔔 reminders**, rebuild, open calendar       |
| План      | active plan, move/cancel, rebuild, open calendar               |
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
  monthly sheet.

Missing future monthly sheets do not produce false positives. The audit never
changes `PERSONNEL`, monthly sheets, reminders, or `Calculation_OS`.

## Blocking rules and warnings

Blocking rules prevent a write: invalid option/date/duration, a person's own
overlap, more than two vacations per person/year, and exceeding the hard
concurrent limit (**5+ people** on one day, or **4 people for more than 3
consecutive days**).

Warnings remain visible but allow the write: a short preferred gap, close start
dates, **exactly 3 people** (borderline load), **4 people for up to 3 consecutive
days** (short overload), and three or more vacation starts in one month.
Main-panel actions explicitly report when a vacation was applied with warnings.

Normal concurrent load: **up to 3 people** at once.

## Month mini-calendar (Огляд / План)

The sidebar mini-calendar reads the same `A:I` vacation source as the planner.
Cells show **only the day number and how many people are on vacation** — no
callsigns or truncated names inside the grid.

| Count in cell | Meaning |
| ------------- | ------- |
| 0–2 | normal load |
| 3 | maximum allowed load |
| ⚠ 4 | short overload (allowed up to 3 consecutive days) |
| ❌ 5+ | error |

Navigation: **◀ / ▶**, year/month selectors, **Показати місяць**. Cross-month
vacations appear in every month they touch.

Click a day to open details: full name list, vacation ranges, problem text, and
up to five validated move suggestions from `Vacation_Suggestions.gs`
(`getVacationCalendarDayDetailsFromSidebar`).

Annual audit checks active `PERSONNEL` rows against the selected audit year:
every active person must have at least one planned vacation, and no person may
have more than two.

Footer summary under the grid shows only dynamic month stats:

```text
Проблемних дат: …
Навантажених днів: …
```

Day cells use a divider between day number and count. Tooltip shows human-readable
load/status text (not ISO-only). Navigation `◀` / `▶` loads the adjacent month
via explicit year/month state, not stale select values.

Modules: `VacationMonthCalendar.gs`, client `Js.Vacations.html`,
`Styles_30_Personnel.html`.

`VACATION_SCHEDULE` keeps `QUANTITY | FML` in columns `A:B`. Only calendar
cells from `C2` are colored: `В1`, `В2`, `ВД`, `СО`, and mixed markers use
distinct fills, while blanks stay white. A medium right border marks every
month transition across the full calendar height.

## Server entrypoints (unchanged)

`getVacationSidebarState`, `addVacationFromSidebar`, `findVacationSidebarOptions`,
`applyVacationOptionFromSidebar`, `moveVacationFromSidebar`, `cancelVacationFromSidebar`,
`rebuildVacationScheduleFromSidebar`, `checkVacationRulesFromSidebar`,
`validateVacationDateFromSidebar`, `generateVacationReportFromSidebar`,
`openVacationScheduleFromSidebar`, `getVacationMonthCalendarFromSidebar`,
`getVacationCalendarDayDetailsFromSidebar`.

Client: `SidebarApp.handleMenuAction('vacations')` → `showVacationsModule()`.

## Local verification

```bash
npm run ci:vacations
npm run ci
```

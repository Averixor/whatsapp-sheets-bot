/**
 * VacationPlannerConfig.gs — configuration for the vacation scheduler (WASB).
 *
 * Source adapter:
 *   default = VACATIONS A:I (single source of truth)
 *   opt-in  = flat VACATION_REQUESTS
 *
 * K:Q/K:S on VACATIONS is presentation-only, never a read source.
 * `VacationsRepository_.listAll()` hides the active physical source.
 */

const VACATION_PLANNER_CONFIG = Object.freeze({
  SHEETS: Object.freeze({
    SOURCE: "VACATIONS",
    REQUESTS: "VACATION_REQUESTS",
    SCHEDULE: "VACATION_SCHEDULE",
    CHECK: "VACATION_CHECK",
  }),

  SOURCE_MODE_PROPERTY: "WASB_VACATION_SOURCE",

  SOURCE_MODES: Object.freeze({
    LEGACY: "VACATIONS",
    REQUESTS: "VACATION_REQUESTS",
  }),

  SOURCE_HEADERS: Object.freeze([
    "FML",
    "Start date",
    "End date",
    "Vacation №",
    "Active",
    "Notify",
    "Days left",
    "Travel",
    "Interval check",
  ]),

  /** Canonical legacy source range on VACATIONS. */
  SOURCE_RANGE: Object.freeze({
    startCol: 1,
    width: 9,
    startRow: 2,
  }),

  /** Legacy right-side panel — presentation / migration source only. */
  RIGHT_PANEL: Object.freeze({
    startCol: 11,
    width: 9,
    headerLabel: "Представлення — не редагувати",
    warningMessage:
      "Увага: знайдено дані у правій таблиці K:Q. Вона не є джерелом істини. Перенесіть ці записи в основний список A:I або очистіть праву таблицю.",
  }),

  BLOCKS: Object.freeze([
    Object.freeze({
      key: "main",
      label: "Основне джерело",
      vacationNumber: 0,
      startCol: 1,
    }),
  ]),

  REQUEST_HEADERS: Object.freeze([
    "ID",
    "PersonKey",
    "FML",
    "Year",
    "VacationNo",
    "Type",
    "DesiredStart",
    "ApprovedStart",
    "EndDate",
    "Days",
    "TravelDays",
    "Status",
    "Notify",
    "CreatedAt",
    "UpdatedAt",
    "Comment",
  ]),

  REQUEST_ACTIVE_STATUSES: Object.freeze(["Proposed", "Approved", "Applied"]),
  REQUEST_OPERATIONAL_STATUSES: Object.freeze(["Approved", "Applied"]),
  REQUEST_FACT_STATUSES: Object.freeze(["Applied"]),
  REQUEST_REMINDER_STATUSES: Object.freeze(["Approved", "Applied"]),

  RULES: Object.freeze({
    MIN_VACATIONS_PER_PERSON_YEAR: 1,
    MAX_VACATIONS_PER_PERSON_YEAR: 2,
    MIN_VACATION_DAYS: 15,
    MIN_DAYS_GAP: 150,
    PREFERRED_GAP_DAYS: 180,
    MAX_CONCURRENT: 3,
    OVERLOAD_CONCURRENT: 4,
    OVERLOAD_MAX_CONSECUTIVE_DAYS: 3,
    ABSOLUTE_MAX_CONCURRENT: 5,
    MIN_START_GAP_DAYS: 2,
    MONTH_START_WARNING: 5,
  }),

  BLOCKING_RULES: Object.freeze([
    "INVALID_OPTION",
    "INVALID_DATE",
    "INVALID_DURATION",
    "PERSON_OVERLAP",
    "PERSON_GAP",
    "START_GAP",
    "MIN_PERSON_YEAR",
    "MAX_PERSON_YEAR",
    "MAX_CONCURRENT",
    "OVERLOAD_STREAK",
  ]),

  WARNING_RULES: Object.freeze([
    "HIGH_LOAD_PERIOD",
    "MONTH_BALANCE",
  ]),

  FACT_CODES: Object.freeze(["Відпус", "Відпустка"]),

  OPTIONS: Object.freeze({
    MAX_VARIANTS: 5,
    DEFAULT_SEARCH_WINDOW_DAYS: 30,
    MAX_SEARCH_WINDOW_DAYS: 180,
    DEFAULT_DURATION_DAYS: 15,
    MAX_DURATION_DAYS: 60,
    MAX_CANDIDATES: 500,
  }),

  SCORING: Object.freeze({
    OVER_LIMIT: 1000,
    START_TOO_CLOSE: 500,
    INTERVAL_TOO_SHORT: 300,
    HIGH_LOAD_PERIOD: 100,
    OVERLOADED_MONTH: 50,
    END_NEAR_OTHER_START: 5,
    DAY_DEVIATION: 10,
    RESERVE_LOAD: 25,
    PEAK_NEAR_LIMIT: 40,
    PEAK_AT_LIMIT: 80,
    MONTH_OVER_BALANCE: 2,
  }),
});

/** Sheet/rule names alias (TZ); full scheduler config is VACATION_PLANNER_CONFIG. */
const VACATION_SCHEDULE_CONFIG = Object.freeze({
  SHEETS: VACATION_PLANNER_CONFIG.SHEETS,
  RULES: VACATION_PLANNER_CONFIG.RULES,
});

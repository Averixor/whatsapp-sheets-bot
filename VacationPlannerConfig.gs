/**
 * VacationPlannerConfig.gs — configuration for the vacation scheduler (WASB).
 *
 * Source of truth for sheet names:
 *   SOURCE  = VACATIONS  (never VACATION)
 *   Block 1 = A:I (перша відпустка)
 *   Block 2 = K:S (друга відпустка)
 *
 * `VacationsRepository_.listAll()` merges both blocks before any calculation.
 */

const VACATION_PLANNER_CONFIG = Object.freeze({
  SHEETS: Object.freeze({
    SOURCE: "VACATIONS",
    OPTIONS: "VACATION_OPTIONS",
    SCHEDULE: "VACATION_SCHEDULE",
    CHECK: "VACATION_CHECK",
  }),

  SOURCE_HEADERS: Object.freeze([
    "FML",
    "Start date",
    "End date",
    "Vacation №",
    "Active",
    "Notify",
    "Days",
    "Travel",
    "Interval check",
  ]),

  BLOCKS: Object.freeze([
    Object.freeze({
      key: "first",
      label: "Перша відпустка",
      vacationNumber: 1,
      startCol: 1,
    }),
    Object.freeze({
      key: "second",
      label: "Друга відпустка",
      vacationNumber: 2,
      startCol: 11,
    }),
  ]),

  RULES: Object.freeze({
    MAX_VACATIONS_PER_PERSON_YEAR: 2,
    MIN_DAYS_GAP: 150,
    PREFERRED_GAP_DAYS: 180,
    MAX_CONCURRENT: 4,
    MIN_START_GAP_DAYS: 2,
  }),

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

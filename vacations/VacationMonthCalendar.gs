/**
 * VacationMonthCalendar.gs — month mini-calendar built from A:I vacation source.
 */

const VacationMonthCalendar_ = (function () {
  const MONTHS_UA = [
    "Січень",
    "Лютий",
    "Березень",
    "Квітень",
    "Травень",
    "Червень",
    "Липень",
    "Серпень",
    "Вересень",
    "Жовтень",
    "Листопад",
    "Грудень",
  ];

  function _trim_(value) {
    return String(value == null ? "" : value)
      .replace(/\s+/g, " ")
      .trim();
  }

  function _rules_() {
    const rules =
      (typeof VACATION_PLANNER_CONFIG === "object" &&
        VACATION_PLANNER_CONFIG &&
        VACATION_PLANNER_CONFIG.RULES) ||
      {};
    return {
      normalMax: Number(rules.MAX_CONCURRENT) || 3,
      overloadCount: Number(rules.OVERLOAD_CONCURRENT) || 4,
      overloadMaxStreak: Number(rules.OVERLOAD_MAX_CONSECUTIVE_DAYS) || 3,
      errorMin: Number(rules.ABSOLUTE_MAX_CONCURRENT) || 5,
      minStartGapDays: Number(rules.MIN_START_GAP_DAYS) || 2,
    };
  }

  function _timeZone_() {
    try {
      if (typeof getTimeZone_ === "function") return getTimeZone_();
    } catch (_) {}
    return Session.getScriptTimeZone();
  }

  function _dateKey_(value) {
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
      return value.trim();
    }
    if (!(value instanceof Date) || isNaN(value.getTime())) return "";
    return Utilities.formatDate(value, _timeZone_(), "yyyy-MM-dd");
  }

  function _parseDate_(value) {
    if (value instanceof Date && !isNaN(value.getTime())) {
      return new Date(
        value.getFullYear(),
        value.getMonth(),
        value.getDate(),
        12,
        0,
        0,
        0,
      );
    }
    if (
      typeof DateUtils_ === "object" &&
      DateUtils_ &&
      typeof DateUtils_.parseDateAny === "function"
    ) {
      const parsed = DateUtils_.parseDateAny(value);
      if (parsed instanceof Date && !isNaN(parsed.getTime())) {
        return new Date(
          parsed.getFullYear(),
          parsed.getMonth(),
          parsed.getDate(),
          12,
          0,
          0,
          0,
        );
      }
    }
    return null;
  }

  function _vacationNumber_(vacationNo) {
    const text = String(vacationNo || "").trim().toLowerCase();
    if (!text) return 1;
    if (text.indexOf("друга") !== -1 || text === "2" || text === "в2") return 2;
    if (text.indexOf("перша") !== -1 || text === "1" || text === "в1") return 1;
    if (text.indexOf("додатков") !== -1 || text === "вд") return 0;
    if (text.indexOf("сімейн") !== -1 || text === "со") return 0;
    return 1;
  }

  function _typeCode_(vacationNo, vacationNumber) {
    const text = String(vacationNo || "").trim().toLowerCase();
    if (text.indexOf("додатков") !== -1) return "ВД";
    if (text.indexOf("сімейн") !== -1) return "СО";
    return Number(vacationNumber) === 2 ? "В2" : "В1";
  }

  function _shortLabel_(fml) {
    try {
      if (
        typeof PersonnelRepository_ === "object" &&
        PersonnelRepository_ &&
        typeof PersonnelRepository_.getByFml === "function"
      ) {
        const person = PersonnelRepository_.getByFml(fml, { activeOnly: false });
        if (person && _trim_(person.callsign)) return _trim_(person.callsign);
      }
    } catch (_) {}
    const parts = _trim_(fml).split(/\s+/);
    return parts[0] || _trim_(fml);
  }

  function _callsignForFml_(fml) {
    try {
      if (
        typeof PersonnelRepository_ === "object" &&
        PersonnelRepository_ &&
        typeof PersonnelRepository_.getByFml === "function"
      ) {
        const person = PersonnelRepository_.getByFml(fml, { activeOnly: false });
        if (person && _trim_(person.callsign)) return _trim_(person.callsign);
      }
    } catch (_) {}
    return "";
  }

  function _normalizeSourceVacations_() {
    return readVacationSource_()
      .map(function (row) {
        const startDate = _parseDate_(row.startDate || row.startDateRaw);
        const endDate = _parseDate_(row.endDate || row.endDateRaw);
        if (!startDate || !endDate || !_trim_(row.fml)) return null;
        const vacationNumber = _vacationNumber_(row.vacationNo);
        return {
          fml: _trim_(row.fml),
          callsign: _callsignForFml_(row.fml),
          shortLabel: _shortLabel_(row.fml),
          type: _typeCode_(row.vacationNo, vacationNumber),
          vacationNumber: vacationNumber || 1,
          startDate: startDate,
          endDate: endDate,
          startIso: _dateKey_(startDate),
          endIso: _dateKey_(endDate),
          active: row.active !== false,
        };
      })
      .filter(Boolean);
  }

  function _mondayFirstOffset_(date) {
    const day = date.getDay();
    return day === 0 ? 6 : day - 1;
  }

  function _addDays_(date, amount) {
    const copy = new Date(date.getTime());
    copy.setDate(copy.getDate() + amount);
    return copy;
  }

  function _addDaysFromIso_(dateIso, amount) {
    const parsed = _parseDate_(dateIso);
    if (!parsed) return null;
    return _addDays_(parsed, amount);
  }

  function _vacationsOnDate_(dateIso, vacations) {
    return vacations.filter(function (item) {
      return dateIso >= item.startIso && dateIso <= item.endIso;
    });
  }

  function _buildDailyCounts_(vacations) {
    const counts = {};
    vacations.forEach(function (item) {
      let cursor = new Date(item.startDate.getTime());
      const end = item.endDate;
      let guard = 0;
      while (cursor.getTime() <= end.getTime() && guard < 730) {
        const key = _dateKey_(cursor);
        counts[key] = (counts[key] || 0) + 1;
        cursor = _addDays_(cursor, 1);
        guard++;
      }
    });
    return counts;
  }

  function _buildFourPersonStreakByDate_(dailyCounts, overloadCount) {
    const streakByDate = {};
    const dates = Object.keys(dailyCounts).sort();
    let streakStart = "";
    let streakLen = 0;

    function flushStreak() {
      if (!streakStart || streakLen <= 0) return;
      for (let offset = 0; offset < streakLen; offset++) {
        const day = _addDaysFromIso_(streakStart, offset);
        const key = _dateKey_(day);
        if (key) streakByDate[key] = streakLen;
      }
    }

    dates.forEach(function (dateIso) {
      if (Number(dailyCounts[dateIso]) === overloadCount) {
        if (!streakStart) {
          streakStart = dateIso;
          streakLen = 1;
        } else {
          streakLen++;
        }
      } else {
        flushStreak();
        streakStart = "";
        streakLen = 0;
      }
    });
    flushStreak();
    return streakByDate;
  }

  function _classifyDayLoad_(count, fourStreakLen, rules) {
    if (count >= rules.errorMin) {
      return {
        loadLevel: "error",
        severity: "ERROR",
        rule: "MAX_CONCURRENT",
        message:
          count +
          " осіб одночасно у відпустці. Допускається максимум " +
          rules.normalMax +
          ".",
        explanation:
          "Одночасно " +
          count +
          " людей — це завжди порушення (ліміт " +
          rules.normalMax +
          ", коротке перевантаження лише " +
          rules.overloadCount +
          " особи до " +
          rules.overloadMaxStreak +
          " днів).",
      };
    }
    if (count === rules.overloadCount) {
      if (fourStreakLen > rules.overloadMaxStreak) {
        return {
          loadLevel: "error",
          severity: "ERROR",
          rule: "OVERLOAD_STREAK",
          message:
            rules.overloadCount +
            " особи одночасно більше " +
            rules.overloadMaxStreak +
            " днів підряд.",
          explanation:
            rules.overloadCount +
            " особи дозволено лише як коротке перевантаження до " +
            rules.overloadMaxStreak +
            " днів.",
        };
      }
      return {
        loadLevel: "warning",
        severity: "WARNING",
        rule: "HIGH_LOAD_PERIOD",
        message:
          rules.overloadCount +
          " особи одночасно (коротке перевантаження до " +
          rules.overloadMaxStreak +
          " днів).",
        explanation:
          "Допускається максимум " +
          rules.normalMax +
          " людини. " +
          rules.overloadCount +
          " особи — лише до " +
          rules.overloadMaxStreak +
          " днів.",
      };
    }
    if (count === rules.normalMax) {
      return {
        loadLevel: "max",
        severity: "INFO",
        rule: "",
        message: count + " особи — граничне навантаження.",
        explanation: "Максимальна допустима одночасна навантаження.",
      };
    }
    return {
      loadLevel: "normal",
      severity: "INFO",
      rule: "",
      message: "",
      explanation: "",
    };
  }

  function _formatShortDate_(dateIso) {
    const match = String(dateIso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return String(dateIso || "");
    return match[3] + "." + match[2];
  }

  function _buildPeoplePreview_(dayVacations) {
    return dayVacations.slice(0, 5).map(function (item) {
      return {
        name: item.fml,
        callsign: item.callsign,
        startText: _formatShortDate_(item.startIso),
        endText: _formatShortDate_(item.endIso),
        startIso: item.startIso,
        endIso: item.endIso,
      };
    });
  }

  function _buildProblemsPreview_(problems) {
    return (Array.isArray(problems) ? problems : []).slice(0, 3).map(
      function (item) {
        return {
          type: item.rule || "",
          message: item.message || "",
        };
      },
    );
  }
  function _daysBetweenIso_(leftIso, rightIso) {
    const left = _parseDate_(leftIso);
    const right = _parseDate_(rightIso);
    if (!left || !right) return NaN;
    return Math.round((right.getTime() - left.getTime()) / 86400000);
  }

  function _startsTooCloseProblems_(dateIso, vacations, rules) {
    const problems = [];
    const starters = vacations.filter(function (item) {
      return item.startIso === dateIso;
    });
    if (!starters.length) return problems;

    const closeNames = {};
    starters.forEach(function (starter) {
      vacations.forEach(function (other) {
        if (starter === other) return;
        if (_trim_(starter.fml).toUpperCase() === _trim_(other.fml).toUpperCase()) {
          return;
        }
        const gap = Math.abs(_daysBetweenIso_(starter.startIso, other.startIso));
        if (Number.isFinite(gap) && gap < rules.minStartGapDays) {
          closeNames[starter.fml] = true;
          closeNames[other.fml] = true;
        }
      });
    });

    const people = Object.keys(closeNames);
    if (people.length < 2) return problems;
    problems.push({
      rule: "START_GAP",
      severity: "ERROR",
      message:
        "Старт відпусток ближче ніж " +
        rules.minStartGapDays +
        " дні: " +
        people.join(", ") +
        ".",
      explanation:
        "Між стартами різних людей має бути не менше " +
        rules.minStartGapDays +
        " днів.",
      fml: people.join(" / "),
    });
    return problems;
  }

  function _buildDayProblems_(dateIso, dayVacations, loadInfo, rules, vacations) {
    const problems = [];
    if (loadInfo.rule && loadInfo.loadLevel !== "normal" && loadInfo.loadLevel !== "max") {
      problems.push({
        rule: loadInfo.rule,
        severity: loadInfo.severity,
        message: loadInfo.message,
        explanation: loadInfo.explanation,
      });
    }
    problems.push.apply(
      problems,
      _startsTooCloseProblems_(dateIso, vacations, rules),
    );
    return problems;
  }

  function getVacationMonthCalendar_(options) {
    const opts = options || {};
    const year = Number(opts.year);
    const month = Number(opts.month);
    if (
      !Number.isInteger(year) ||
      year < 1900 ||
      year > 9999 ||
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12
    ) {
      return {
        success: false,
        message: "Некоректний рік або місяць.",
      };
    }

    const rules = _rules_();
    const vacations = _normalizeSourceVacations_();
    const dailyCounts = _buildDailyCounts_(vacations);
    const fourStreakByDate = _buildFourPersonStreakByDate_(
      dailyCounts,
      rules.overloadCount,
    );
    const monthStart = new Date(year, month - 1, 1, 12, 0, 0, 0);
    const monthEnd = new Date(year, month, 0, 12, 0, 0, 0);
    const monthStartIso = _dateKey_(monthStart);
    const monthEndIso = _dateKey_(monthEnd);
    const monthVacations = vacations.filter(function (item) {
      return item.startIso <= monthEndIso && item.endIso >= monthStartIso;
    });

    const gridStart = _addDays_(monthStart, -_mondayFirstOffset_(monthStart));
    const gridEnd = _addDays_(
      monthEnd,
      6 - _mondayFirstOffset_(monthEnd),
    );

    const weeks = [];
    let loadedDays = 0;
    let maxConcurrentCount = 0;
    let problemDays = 0;
    let warningDays = 0;
    let cursor = new Date(gridStart.getTime());

    while (cursor.getTime() <= gridEnd.getTime()) {
      const week = [];
      for (let weekday = 0; weekday < 7; weekday++) {
        const dateIso = _dateKey_(cursor);
        const inMonth =
          cursor.getFullYear() === year && cursor.getMonth() === month - 1;
        const dayVacations = _vacationsOnDate_(dateIso, monthVacations);
        const vacationsCount = Number(dailyCounts[dateIso] || dayVacations.length);
        const fourStreakLen = Number(fourStreakByDate[dateIso] || 0);
        const loadInfo = _classifyDayLoad_(vacationsCount, fourStreakLen, rules);
        const problems = _buildDayProblems_(
          dateIso,
          dayVacations,
          loadInfo,
          rules,
          monthVacations,
        );
        const overload = loadInfo.loadLevel === "error";
        const full = loadInfo.loadLevel === "max";

        if (inMonth) {
          if (vacationsCount > 0) loadedDays++;
          if (vacationsCount > maxConcurrentCount) {
            maxConcurrentCount = vacationsCount;
          }
          const hasBlockingProblem =
            overload ||
            problems.some(function (item) {
              return item.rule === "START_GAP";
            });
          if (hasBlockingProblem) problemDays++;
          else if (loadInfo.loadLevel === "warning") warningDays++;
        }

        week.push({
          isoDate: dateIso,
          dateIso: dateIso,
          day: cursor.getDate(),
          inMonth: inMonth,
          isWeekend: cursor.getDay() === 0 || cursor.getDay() === 6,
          vacationsCount: vacationsCount,
          loadLevel: loadInfo.loadLevel,
          problemsCount: problems.length,
          overload: overload,
          full: full,
          fourPersonStreak: fourStreakLen,
          peoplePreview: _buildPeoplePreview_(dayVacations),
          problemsPreview: _buildProblemsPreview_(problems),
          vacations: dayVacations.map(function (item) {
            return {
              fml: item.fml,
              callsign: item.callsign,
              shortLabel: item.shortLabel,
              type: item.type,
              startIso: item.startIso,
              endIso: item.endIso,
            };
          }),
          problems: problems,
        });
        cursor = _addDays_(cursor, 1);
      }
      weeks.push(week);
    }

    return {
      success: true,
      year: year,
      month: month,
      monthLabel: MONTHS_UA[month - 1] + " " + year,
      source: "A:I",
      weeks: weeks,
      rules: {
        normalMax: rules.normalMax,
        overloadCount: rules.overloadCount,
        overloadMaxStreak: rules.overloadMaxStreak,
      },
      summary: {
        allowedMaxConcurrent: rules.normalMax,
        overloadRule:
          rules.overloadCount +
          " особи до " +
          rules.overloadMaxStreak +
          " днів",
        maxConcurrent: maxConcurrentCount,
        problemDays: problemDays,
        warningDays: warningDays,
        loadedDays: loadedDays,
        vacationRecords: monthVacations.length,
        overloadedDays: problemDays,
        fullDays: warningDays,
        totalVacationDays: loadedDays,
      },
    };
  }

  function _findDayInCalendar_(calendar, dateIso) {
    if (!calendar || !calendar.success || !dateIso) return null;
    let found = null;
    (calendar.weeks || []).forEach(function (week) {
      week.forEach(function (day) {
        if (day.dateIso === dateIso) found = day;
      });
    });
    return found;
  }

  function _formatUaDate_(dateIso) {
    const match = String(dateIso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return dateIso;
    return match[3] + "." + match[2] + "." + match[1];
  }

  function _primaryIssueForDay_(day) {
    if (!day || !Array.isArray(day.problems) || !day.problems.length) {
      return null;
    }
    const priority = ["MAX_CONCURRENT", "OVERLOAD_STREAK", "HIGH_LOAD_PERIOD", "START_GAP"];
    for (let i = 0; i < priority.length; i++) {
      const match = day.problems.find(function (item) {
        return item.rule === priority[i];
      });
      if (match) {
        return {
          rule: match.rule === "OVERLOAD_STREAK" ? "MAX_CONCURRENT" : match.rule,
          date: day.dateIso,
          fml: match.fml || (day.vacations || [])
            .map(function (item) {
              return item.fml;
            })
            .join(", "),
          severity: match.severity,
          details: match.message,
        };
      }
    }
    return null;
  }

  function getVacationCalendarDayDetails_(options) {
    const opts = options || {};
    const dateIso = _trim_(opts.dateIso);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
      return { success: false, message: "Некоректна дата." };
    }

    const parts = dateIso.split("-");
    const calendar = getVacationMonthCalendar_({
      year: Number(parts[0]),
      month: Number(parts[1]),
    });
    if (!calendar.success) return calendar;

    const day = _findDayInCalendar_(calendar, dateIso);
    if (!day) {
      return { success: false, message: "Дату не знайдено в календарі." };
    }

    const issue = _primaryIssueForDay_(day);
    let fixSuggestions = [];
    if (
      issue &&
      typeof VacationSuggestions_ === "object" &&
      VacationSuggestions_ &&
      typeof VacationSuggestions_.buildVacationFixSuggestions_ === "function" &&
      typeof VacationSuggestions_.buildSuggestionContext_ === "function"
    ) {
      const context = VacationSuggestions_.buildSuggestionContext_(
        [],
        _normalizeSourceVacations_(),
      );
      const result = VacationSuggestions_.buildVacationFixSuggestions_(
        issue,
        context,
      );
      fixSuggestions = Array.isArray(result && result.suggestions)
        ? result.suggestions
        : [];
    }

    return {
      success: true,
      dateIso: dateIso,
      dateLabel: _formatUaDate_(dateIso),
      vacationsCount: day.vacationsCount,
      loadLevel: day.loadLevel,
      vacations: day.vacations,
      problems: day.problems,
      fixSuggestions: fixSuggestions,
      suggestionTexts:
        typeof VacationSuggestions_ === "object" &&
        VacationSuggestions_ &&
        typeof VacationSuggestions_.formatSuggestionTexts_ === "function"
          ? VacationSuggestions_.formatSuggestionTexts_(fixSuggestions)
          : [],
    };
  }

  return {
    getVacationMonthCalendar_: getVacationMonthCalendar_,
    getVacationCalendarDayDetails_: getVacationCalendarDayDetails_,
  };
})();

function getVacationMonthCalendarFromSidebar(formData) {
  return VacationMonthCalendar_.getVacationMonthCalendar_(formData || {});
}

function getVacationMonthCalendar_(options) {
  return VacationMonthCalendar_.getVacationMonthCalendar_(options || {});
}

function getVacationCalendarDayDetailsFromSidebar(formData) {
  return VacationMonthCalendar_.getVacationCalendarDayDetails_(formData || {});
}

function getVacationCalendarDayDetails_(options) {
  return VacationMonthCalendar_.getVacationCalendarDayDetails_(options || {});
}

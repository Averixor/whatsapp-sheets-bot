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

  function _vacationsOnDate_(dateIso, vacations) {
    return vacations.filter(function (item) {
      return dateIso >= item.startIso && dateIso <= item.endIso;
    });
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

    const maxConcurrent =
      (VACATION_PLANNER_CONFIG &&
        VACATION_PLANNER_CONFIG.RULES &&
        VACATION_PLANNER_CONFIG.RULES.MAX_CONCURRENT) ||
      4;
    const vacations = _normalizeSourceVacations_();
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
    let totalVacationDays = 0;
    let maxConcurrentCount = 0;
    let overloadedDays = 0;
    let fullDays = 0;
    let cursor = new Date(gridStart.getTime());

    while (cursor.getTime() <= gridEnd.getTime()) {
      const week = [];
      for (let weekday = 0; weekday < 7; weekday++) {
        const dateIso = _dateKey_(cursor);
        const inMonth =
          cursor.getFullYear() === year && cursor.getMonth() === month - 1;
        const dayVacations = _vacationsOnDate_(dateIso, monthVacations);
        const vacationsCount = dayVacations.length;
        const full = vacationsCount === maxConcurrent;
        const overload = vacationsCount > maxConcurrent;
        const problems = [];
        if (overload) {
          problems.push({
            rule: "MAX_CONCURRENT",
            message: vacationsCount + "/" + maxConcurrent,
          });
        } else if (full) {
          problems.push({
            rule: "HIGH_LOAD_PERIOD",
            message: vacationsCount + "/" + maxConcurrent,
          });
        }

        if (inMonth && vacationsCount > 0) {
          totalVacationDays += vacationsCount;
          if (vacationsCount > maxConcurrentCount) {
            maxConcurrentCount = vacationsCount;
          }
          if (overload) overloadedDays++;
          if (full) fullDays++;
        }

        week.push({
          dateIso: dateIso,
          day: cursor.getDate(),
          inMonth: inMonth,
          isWeekend: cursor.getDay() === 0 || cursor.getDay() === 6,
          vacationsCount: vacationsCount,
          overload: overload,
          full: full,
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
      summary: {
        totalVacationDays: totalVacationDays,
        maxConcurrent: maxConcurrentCount,
        overloadedDays: overloadedDays,
        fullDays: fullDays,
        vacationRecords: monthVacations.length,
      },
    };
  }

  return {
    getVacationMonthCalendar_: getVacationMonthCalendar_,
  };
})();

function getVacationMonthCalendarFromSidebar(formData) {
  return VacationMonthCalendar_.getVacationMonthCalendar_(formData || {});
}

function getVacationMonthCalendar_(options) {
  return VacationMonthCalendar_.getVacationMonthCalendar_(options || {});
}

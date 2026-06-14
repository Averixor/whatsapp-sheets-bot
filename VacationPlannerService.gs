/**
 * VacationPlannerService.gs — pure vacation candidate generation and scoring.
 */

const VacationPlannerService_ = (function () {
  const DAY_MS = 86400000;

  function _trim_(value) {
    return String(value == null ? "" : value)
      .replace(/\s+/g, " ")
      .trim();
  }

  function _fmlKey_(value) {
    if (typeof _normFml_ === "function") return _normFml_(value);
    return _trim_(value)
      .toUpperCase()
      .replace(/[’'`"ʼ]/g, "'");
  }

  function _personAliases_(source) {
    const item = source || {};
    if (Array.isArray(item.personAliases)) return item.personAliases.slice();
    const seen = {};
    return [item.personKey, item.callsign, item.fml, item.FML]
      .map(_fmlKey_)
      .filter(function (key) {
        if (!key || seen[key]) return false;
        seen[key] = true;
        return true;
      });
  }

  function _samePerson_(left, right) {
    const rightAliases = {};
    _personAliases_(right).forEach(function (key) {
      rightAliases[key] = true;
    });
    return _personAliases_(left).some(function (key) {
      return rightAliases[key] === true;
    });
  }

  function _toNoon_(value) {
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

    const source = _trim_(value);
    if (!source) return null;

    let match = source.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (match) {
      return _strictDate_(Number(match[1]), Number(match[2]), Number(match[3]));
    }

    match = source.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);
    if (match) {
      return _strictDate_(Number(match[3]), Number(match[2]), Number(match[1]));
    }

    try {
      if (
        typeof DateUtils_ === "object" &&
        DateUtils_ &&
        typeof DateUtils_.parseDateAny === "function"
      ) {
        return _toNoon_(DateUtils_.parseDateAny(value));
      }
    } catch (_) {}

    return null;
  }

  function _strictDate_(year, month, day) {
    const date = new Date(year, month - 1, day, 12, 0, 0, 0);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }
    return date;
  }

  function _dayOrdinal_(value) {
    const date = _toNoon_(value);
    if (!date) return null;
    return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS;
  }

  function daysBetween(fromDate, toDate) {
    const from = _dayOrdinal_(fromDate);
    const to = _dayOrdinal_(toDate);
    if (from === null || to === null) return NaN;
    return to - from;
  }

  function addDays(date, days) {
    const source = _toNoon_(date);
    if (!source) return null;
    return new Date(
      source.getFullYear(),
      source.getMonth(),
      source.getDate() + Number(days || 0),
      12,
      0,
      0,
      0,
    );
  }

  function calculateEndDate(startDate, durationDays) {
    return addDays(startDate, Number(durationDays) - 1);
  }

  function _vacationNumber_(value) {
    if (value === 1 || value === 2) return value;
    const text = _trim_(value).toLowerCase();
    if (/^1$/.test(text) || text.indexOf("перш") !== -1) return 1;
    if (/^2$/.test(text) || text.indexOf("друг") !== -1) return 2;
    return 0;
  }

  function _isActive_(vacation) {
    const item = vacation || {};
    const hasActive = Object.prototype.hasOwnProperty.call(item, "active");
    const hasIsActive = Object.prototype.hasOwnProperty.call(item, "isActive");
    if (!hasActive && !hasIsActive) return true;
    const value = hasActive ? item.active : item.isActive;
    if (value === true) return true;
    return ["TRUE", "1", "YES", "Y", "ТАК"].indexOf(
      _trim_(value).toUpperCase(),
    ) !== -1;
  }

  function _normalizeVacation_(item) {
    const source = item || {};
    const personAliases = _personAliases_(source);
    return {
      fml: _trim_(source.fml),
      fmlKey: _fmlKey_(source.fml),
      personKey: _trim_(source.personKey || source.callsign || source.fml),
      personKeyKey: personAliases[0] || "",
      personAliases: personAliases,
      startDate: _toNoon_(source.startDate || source.startDateRaw),
      endDate: _toNoon_(source.endDate || source.endDateRaw),
      vacationNumber: _vacationNumber_(
        source.vacationNumber || source.vacationNo || source.no,
      ),
      active: _isActive_(source),
      source: source,
    };
  }

  function _normalizedActiveVacations_(allVacations) {
    return (Array.isArray(allVacations) ? allVacations : [])
      .map(_normalizeVacation_)
      .filter(function (item) {
        return item.active && item.personKeyKey && item.startDate && item.endDate;
      });
  }

  function normalizeRequest(request) {
    const source = request || {};
    const fml = _trim_(source.fml);
    const vacationNumber = _vacationNumber_(
      source.vacationNumber || source.vacationNo,
    );
    const desiredStart = _toNoon_(source.desiredStart);
    const durationValue =
      source.durationDays != null
        ? source.durationDays
        : source.duration != null
          ? source.duration
          : VACATION_PLANNER_CONFIG.OPTIONS.DEFAULT_DURATION_DAYS;
    const durationDays = Number(durationValue);
    const before = Number(
      source.searchWindowBefore != null
        ? source.searchWindowBefore
        : source.searchWindow != null
          ? source.searchWindow
          : VACATION_PLANNER_CONFIG.OPTIONS.DEFAULT_SEARCH_WINDOW_DAYS,
    );
    const after = Number(
      source.searchWindowAfter != null
        ? source.searchWindowAfter
        : source.searchWindow != null
          ? source.searchWindow
          : VACATION_PLANNER_CONFIG.OPTIONS.DEFAULT_SEARCH_WINDOW_DAYS,
    );

    if (!fml) throw new Error("Вкажіть ФІО військовослужбовця");
    if (vacationNumber !== 1 && vacationNumber !== 2) {
      throw new Error("Номер відпустки має бути 1 або 2");
    }
    if (!desiredStart) throw new Error("Вкажіть коректну бажану дату");
    if (
      !Number.isInteger(durationDays) ||
      durationDays < 1 ||
      durationDays > VACATION_PLANNER_CONFIG.OPTIONS.MAX_DURATION_DAYS
    ) {
      throw new Error(
        "Тривалість має бути від 1 до " +
          VACATION_PLANNER_CONFIG.OPTIONS.MAX_DURATION_DAYS +
          " днів",
      );
    }
    [before, after].forEach(function (windowDays) {
      if (
        !Number.isInteger(windowDays) ||
        windowDays < 0 ||
        windowDays > VACATION_PLANNER_CONFIG.OPTIONS.MAX_SEARCH_WINDOW_DAYS
      ) {
        throw new Error(
          "Вікно пошуку має бути від 0 до " +
            VACATION_PLANNER_CONFIG.OPTIONS.MAX_SEARCH_WINDOW_DAYS +
            " днів",
        );
      }
    });
    if (
      before + after + 1 >
      VACATION_PLANNER_CONFIG.OPTIONS.MAX_CANDIDATES
    ) {
      throw new Error("Вікно пошуку створює забагато кандидатів");
    }

    return {
      fml: fml,
      fmlKey: _fmlKey_(fml),
      personKey: _trim_(source.personKey || source.callsign || fml),
      personAliases: _personAliases_({
        personKey: source.personKey || source.callsign,
        fml: fml,
      }),
      vacationNumber: vacationNumber,
      desiredStart: desiredStart,
      durationDays: durationDays,
      searchWindowBefore: before,
      searchWindowAfter: after,
      travel: _trim_(source.travel),
    };
  }

  function _isTargetSlot_(vacation, option) {
    const requestId = _trim_(option && option.requestId);
    const source = (vacation && vacation.source) || {};
    if (requestId) {
      return _trim_(source.requestId || source.id) === requestId;
    }
    if (source._meta && source._meta.schema === "vacation_requests") {
      return false;
    }
    return (
      _samePerson_(vacation, option) &&
      vacation.vacationNumber > 0 &&
      vacation.vacationNumber === _vacationNumber_(option.vacationNumber)
    );
  }

  function _overlaps_(startA, endA, startB, endB) {
    return (
      _dayOrdinal_(startA) <= _dayOrdinal_(endB) &&
      _dayOrdinal_(endA) >= _dayOrdinal_(startB)
    );
  }

  function _gapBetweenRanges_(startA, endA, startB, endB) {
    if (_overlaps_(startA, endA, startB, endB)) return -1;
    if (_dayOrdinal_(endA) < _dayOrdinal_(startB)) {
      return daysBetween(endA, startB);
    }
    return daysBetween(endB, startA);
  }

  function _dateKey_(date) {
    const value = _toNoon_(date);
    if (!value) return "";
    return [
      value.getFullYear(),
      String(value.getMonth() + 1).padStart(2, "0"),
      String(value.getDate()).padStart(2, "0"),
    ].join("-");
  }

  function _isVacationFactCode_(value) {
    const key = _trim_(value).toUpperCase();
    const configured =
      VACATION_PLANNER_CONFIG &&
      Array.isArray(VACATION_PLANNER_CONFIG.FACT_CODES)
        ? VACATION_PLANNER_CONFIG.FACT_CODES
        : ["Відпус", "Відпустка"];
    return configured.some(function (code) {
      return _trim_(code).toUpperCase() === key;
    });
  }

  function _dateRangeLabel_(dates) {
    const keys = (Array.isArray(dates) ? dates : [])
      .map(_dateKey_)
      .filter(Boolean)
      .sort();
    if (!keys.length) return "";
    return keys.length === 1 ? keys[0] : keys[0] + " / " + keys[keys.length - 1];
  }

  function _vacationCoversDate_(vacation, date) {
    return (
      _dayOrdinal_(vacation.startDate) <= _dayOrdinal_(date) &&
      _dayOrdinal_(vacation.endDate) >= _dayOrdinal_(date)
    );
  }

  function _personnelHasVacationStatus_(person) {
    const canonical = _trim_(person && person.statusCanonical).toUpperCase();
    const status = _trim_(
      person && (person.status || person.Status),
    ).toUpperCase();
    return canonical === "VACATION" || status === "ВІДПУСТКА";
  }

  function _sourceFlag_(vacation, key, defaultValue) {
    const source = (vacation && vacation.source) || {};
    return Object.prototype.hasOwnProperty.call(source, key)
      ? source[key] === true
      : defaultValue;
  }

  /**
   * Non-mutating reconciliation between planned vacations and operational facts.
   * Monthly facts must include blank codes so a represented person/date can be
   * distinguished from a month that does not exist yet.
   */
  function buildConsistencyAudit(
    allVacations,
    personnelRows,
    monthlyFacts,
    auditDate,
  ) {
    const checks = [];
    const vacations = _normalizedActiveVacations_(allVacations);
    const operationalVacations = vacations.filter(function (vacation) {
      return _sourceFlag_(vacation, "operationalActive", true);
    });
    const factExpectedVacations = vacations.filter(function (vacation) {
      return _sourceFlag_(vacation, "factExpected", true);
    });
    const today = _toNoon_(auditDate) || _toNoon_(new Date());

    (Array.isArray(personnelRows) ? personnelRows : []).forEach(
      function (person) {
        const fml = _trim_(person && (person.fml || person.FML));
        const personIdentity = {
          personKey: person && (person.personKey || person.callsign),
          fml: fml,
        };
        if (
          !_personAliases_(personIdentity).length ||
          !_personnelHasVacationStatus_(person)
        ) {
          return;
        }
        const hasCurrentVacation = operationalVacations.some(
          function (vacation) {
            return (
              _samePerson_(vacation, personIdentity) &&
              _vacationCoversDate_(vacation, today)
            );
          },
        );
        if (hasCurrentVacation) return;
        checks.push({
          severity: "ERROR",
          rule: "PERSONNEL_VACATION_WITHOUT_PLAN",
          date: _dateKey_(today),
          fml: fml,
          details:
            "У PERSONNEL встановлено статус «Відпустка», але на цю дату немає затвердженої або застосованої відпустки у джерелі плану",
        });
      },
    );

    const facts = (Array.isArray(monthlyFacts) ? monthlyFacts : [])
      .map(function (fact) {
        const fml = _trim_(fact && (fact.fml || fact.FML || fact.callsign));
        const personAliases = _personAliases_({
          personKey: fact && fact.personKey,
          callsign: fact && fact.callsign,
          fml: fml,
        });
        return {
          fml: fml,
          fmlKey: _fmlKey_(fml),
          personKeyKey: personAliases[0] || "",
          personAliases: personAliases,
          date: _toNoon_(fact && fact.date),
          code: _trim_(fact && fact.code),
          source: fact || {},
        };
      })
      .filter(function (fact) {
        return fact.personKeyKey && fact.date;
      });

    const factsByPersonDate = {};
    facts.forEach(function (fact) {
      fact.personAliases.forEach(function (alias) {
        const key = alias + "|" + _dateKey_(fact.date);
        if (!factsByPersonDate[key]) factsByPersonDate[key] = [];
        factsByPersonDate[key].push(fact);
      });
    });

    const monthlyWithoutPlan = {};
    facts.forEach(function (fact) {
      if (!_isVacationFactCode_(fact.code)) return;
      const hasPlan = operationalVacations.some(function (vacation) {
        return (
          _samePerson_(vacation, fact) &&
          _vacationCoversDate_(vacation, fact.date)
        );
      });
      if (hasPlan) return;
      if (!monthlyWithoutPlan[fact.personKeyKey]) {
        monthlyWithoutPlan[fact.personKeyKey] = { fml: fact.fml, dates: [] };
      }
      monthlyWithoutPlan[fact.personKeyKey].dates.push(fact.date);
    });
    Object.keys(monthlyWithoutPlan).forEach(function (key) {
      const item = monthlyWithoutPlan[key];
      checks.push({
        severity: "ERROR",
        rule: "MONTHLY_VACATION_WITHOUT_PLAN",
        date: _dateRangeLabel_(item.dates),
        fml: item.fml,
        details:
          "У місячному графіку код «Відпус» стоїть " +
          item.dates.length +
          " дн., але відповідної затвердженої або застосованої відпустки у джерелі плану немає",
      });
    });

    factExpectedVacations.forEach(function (vacation) {
      const missingDates = [];
      let current = vacation.startDate;
      let guard = 0;
      while (
        _dayOrdinal_(current) <= _dayOrdinal_(vacation.endDate) &&
        guard < 730
      ) {
        const representedFacts = [];
        vacation.personAliases.forEach(function (alias) {
          const key = alias + "|" + _dateKey_(current);
          (factsByPersonDate[key] || []).forEach(function (fact) {
            if (representedFacts.indexOf(fact) === -1) {
              representedFacts.push(fact);
            }
          });
        });
        if (
          representedFacts.length &&
          !representedFacts.some(function (fact) {
            return _isVacationFactCode_(fact.code);
          })
        ) {
          missingDates.push(current);
        }
        current = addDays(current, 1);
        guard++;
      }
      if (!missingDates.length) return;
      checks.push({
        severity: "ERROR",
        rule: "PLAN_WITHOUT_MONTHLY_VACATION",
        date: _dateRangeLabel_(missingDates),
        fml: vacation.fml,
        details:
          "У джерелі плану є застосована відпустка, але у місячному графіку відсутній код «Відпус» на " +
          missingDates.length +
          " дн.",
        vacationNumber: vacation.vacationNumber,
        startDate: vacation.startDate,
        endDate: vacation.endDate,
        days: daysBetween(vacation.startDate, vacation.endDate) + 1,
        sourceRow:
          (vacation.source &&
            vacation.source._meta &&
            vacation.source._meta.rowNumber) ||
          "",
        sourceStartColumn:
          (vacation.source &&
            vacation.source._meta &&
            vacation.source._meta.startColumn) ||
          "",
      });
    });

    return checks;
  }

  function countConcurrentVacations(startDate, endDate, vacations) {
    const list = _normalizedActiveVacations_(vacations);
    const dailyCounts = [];
    let current = _toNoon_(startDate);
    const end = _toNoon_(endDate);

    while (current && end && _dayOrdinal_(current) <= _dayOrdinal_(end)) {
      const people = {};
      list.forEach(function (vacation) {
        if (
          _overlaps_(
            current,
            current,
            vacation.startDate,
            vacation.endDate,
          )
        ) {
          people[vacation.personKeyKey] = true;
        }
      });
      dailyCounts.push(Object.keys(people).length);
      current = addDays(current, 1);
    }

    const max = dailyCounts.length ? Math.max.apply(null, dailyCounts) : 0;
    const sum = dailyCounts.reduce(function (total, value) {
      return total + value;
    }, 0);
    return {
      max: max,
      avgLoad: dailyCounts.length ? sum / dailyCounts.length : 0,
      dailyCounts: dailyCounts,
    };
  }

  function _blockingValidation_(rule, message) {
    const violation = {
      rule: rule,
      severity: "CRITICAL",
      message: message,
    };
    return {
      isValid: false,
      violations: [violation],
      blockingViolations: [violation],
      warnings: [],
    };
  }

  function validateVacationOption(option, allVacations) {
    const startDate = _toNoon_(option && option.startDate);
    const endDate = _toNoon_(option && option.endDate);
    const fml = _trim_(option && option.fml);
    const fmlKey = _fmlKey_(fml);
    const personAliases = _personAliases_({
      personKey: option && option.personKey,
      fml: fml,
    });
    const vacationNumber = _vacationNumber_(
      option && option.vacationNumber,
    );
    const violations = [];

    if (!personAliases.length || vacationNumber < 1) {
      return _blockingValidation_(
        "INVALID_OPTION",
        "Варіант має неповні або некоректні дані",
      );
    }
    if (!startDate || !endDate) {
      return _blockingValidation_(
        "INVALID_DATE",
        "Варіант містить некоректну дату початку або завершення",
      );
    }
    const durationDays = daysBetween(startDate, endDate) + 1;
    if (
      !Number.isInteger(durationDays) ||
      durationDays < 1 ||
      durationDays > VACATION_PLANNER_CONFIG.OPTIONS.MAX_DURATION_DAYS
    ) {
      return _blockingValidation_(
        "INVALID_DURATION",
        "Тривалість варіанта має бути від 1 до " +
          VACATION_PLANNER_CONFIG.OPTIONS.MAX_DURATION_DAYS +
          " днів",
      );
    }

    const normalizedOption = {
      requestId: _trim_(option && option.requestId),
      fml: fml,
      fmlKey: fmlKey,
      personKey: _trim_((option && option.personKey) || fml),
      personKeyKey: personAliases[0] || "",
      personAliases: personAliases,
      vacationNumber: vacationNumber,
      startDate: startDate,
      endDate: endDate,
    };
    const vacations = _normalizedActiveVacations_(allVacations).filter(
      function (vacation) {
        return !_isTargetSlot_(vacation, normalizedOption);
      },
    );
    const personVacations = vacations.filter(function (vacation) {
      return _samePerson_(vacation, normalizedOption);
    });
    const otherVacations = vacations.filter(function (vacation) {
      return !_samePerson_(vacation, normalizedOption);
    });
    const rules = VACATION_PLANNER_CONFIG.RULES;
    const requestYear = startDate.getFullYear();
    const yearCount = personVacations.filter(function (vacation) {
      return vacation.startDate.getFullYear() === requestYear;
    }).length;

    if (yearCount >= rules.MAX_VACATIONS_PER_PERSON_YEAR) {
      violations.push({
        rule: "MAX_PERSON_YEAR",
        severity: "CRITICAL",
        message:
          "У " +
          fml +
          " вже є " +
          rules.MAX_VACATIONS_PER_PERSON_YEAR +
          " відпустки у " +
          requestYear +
          " році",
      });
    }

    let nearestPersonGap = null;
    personVacations.forEach(function (vacation) {
      const gap = _gapBetweenRanges_(
        startDate,
        endDate,
        vacation.startDate,
        vacation.endDate,
      );
      if (nearestPersonGap === null || gap < nearestPersonGap) {
        nearestPersonGap = gap;
      }
      if (gap < 0) {
        violations.push({
          rule: "PERSON_OVERLAP",
          severity: "CRITICAL",
          message: "Відпустка перетинається з іншою відпусткою цієї людини",
        });
      } else if (gap < rules.MIN_DAYS_GAP) {
        violations.push({
          rule: "PERSON_GAP",
          severity: "WARNING",
          message:
            "Інтервал між відпустками " +
            gap +
            " днів, мінімум " +
            rules.MIN_DAYS_GAP,
        });
      }
    });

    const nearStarts = [];
    otherVacations.forEach(function (vacation) {
      const gap = Math.abs(daysBetween(startDate, vacation.startDate));
      if (gap < rules.MIN_START_GAP_DAYS) {
        nearStarts.push({
          fml: vacation.fml,
          startDate: vacation.startDate,
          gap: gap,
        });
      }
    });
    if (nearStarts.length) {
      violations.push({
        rule: "START_GAP",
        severity: "WARNING",
        message:
          "Старт надто близько до: " +
          nearStarts
            .map(function (item) {
              return item.fml;
            })
            .join(", "),
      });
    }

    const load = countConcurrentVacations(startDate, endDate, otherVacations);
    const maxWithCandidate = load.max + 1;
    if (maxWithCandidate > rules.MAX_CONCURRENT) {
      violations.push({
        rule: "MAX_CONCURRENT",
        severity: "CRITICAL",
        message:
          "Одночасно буде " +
          maxWithCandidate +
          " людей, максимум " +
          rules.MAX_CONCURRENT,
      });
    } else if (maxWithCandidate === rules.MAX_CONCURRENT) {
      violations.push({
        rule: "HIGH_LOAD_PERIOD",
        severity: "WARNING",
        message:
          "Період досягає граничного навантаження: одночасно " +
          maxWithCandidate +
          " людей",
      });
    }

    const monthStats = _monthStats_(normalizedOption, allVacations);
    if (monthStats.starts + 1 >= rules.MONTH_START_WARNING) {
      violations.push({
        rule: "MONTH_BALANCE",
        severity: "WARNING",
        message:
          "У цьому місяці буде " +
          (monthStats.starts + 1) +
          " стартів відпусток",
      });
    }

    const warnings = violations.filter(function (violation) {
      return violation.severity === "WARNING";
    });
    const blockingViolations = violations.filter(function (violation) {
      return violation.severity !== "WARNING";
    });
    return {
      isValid: blockingViolations.length === 0,
      violations: violations,
      blockingViolations: blockingViolations,
      warnings: warnings,
      concurrentCount: {
        max: load.max,
        maxWithCandidate: maxWithCandidate,
        avgLoad: load.avgLoad,
        avgWithCandidate: load.avgLoad + 1,
      },
      nearStarts: nearStarts,
      nearestPersonGap: nearestPersonGap,
    };
  }

  function _monthStats_(option, allVacations) {
    const vacations = _normalizedActiveVacations_(allVacations);
    const month = option.startDate.getMonth();
    const year = option.startDate.getFullYear();
    let starts = 0;
    let days = 0;

    vacations.forEach(function (vacation) {
      if (
        vacation.startDate.getFullYear() === year &&
        vacation.startDate.getMonth() === month
      ) {
        starts++;
        days += daysBetween(vacation.startDate, vacation.endDate) + 1;
      }
    });

    return { starts: starts, days: days, year: year, month: month };
  }

  function _yearMonthLoads_(allVacations, year) {
    const loads = Array(12).fill(0);
    _normalizedActiveVacations_(allVacations).forEach(function (vacation) {
      if (vacation.startDate.getFullYear() !== year) return;
      loads[vacation.startDate.getMonth()] +=
        daysBetween(vacation.startDate, vacation.endDate) + 1;
    });
    return loads;
  }

  function _medianMonthLoad_(loads) {
    const sorted = loads
      .slice()
      .sort(function (a, b) {
        return a - b;
      });
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
  }

  function _endNearStarts_(option, allVacations) {
    return _normalizedActiveVacations_(allVacations).filter(function (vacation) {
      if (_samePerson_(vacation, option)) return false;
      const gap = Math.abs(daysBetween(option.endDate, vacation.startDate));
      return gap > 0 && gap <= 3;
    }).length;
  }

  function scoreVacationOption(option, allVacations, request, validation) {
    const config = VACATION_PLANNER_CONFIG.SCORING;
    const rules = VACATION_PLANNER_CONFIG.RULES;
    const check = validation || validateVacationOption(option, allVacations);
    const deviation = Math.abs(
      daysBetween(request.desiredStart, option.startDate),
    );
    let score = deviation * config.DAY_DEVIATION;

    if (check.concurrentCount) {
      const peak = check.concurrentCount.maxWithCandidate;
      const avgLoad = check.concurrentCount.avgWithCandidate || 0;

      score += Math.max(peak - 1, 0) * config.HIGH_LOAD_PERIOD;
      score += Math.max(avgLoad - 2, 0) * config.RESERVE_LOAD;
      if (peak >= rules.MAX_CONCURRENT) {
        score += config.PEAK_AT_LIMIT;
      } else if (peak === rules.MAX_CONCURRENT - 1) {
        score += config.PEAK_NEAR_LIMIT;
      }
      if (peak > rules.MAX_CONCURRENT) {
        score += config.OVER_LIMIT;
      }
    }

    const normalized = _normalizedActiveVacations_(allVacations);
    normalized.forEach(function (vacation) {
      if (_samePerson_(vacation, option)) return;
      const gap = Math.abs(daysBetween(option.startDate, vacation.startDate));
      if (gap >= rules.MIN_START_GAP_DAYS && gap <= 4) {
        score += Math.round(config.START_TOO_CLOSE / gap);
      }
    });

    if (
      check.nearestPersonGap !== null &&
      check.nearestPersonGap < rules.PREFERRED_GAP_DAYS
    ) {
      score +=
        config.INTERVAL_TOO_SHORT +
        (rules.PREFERRED_GAP_DAYS - check.nearestPersonGap);
    }

    const monthStats = _monthStats_(option, allVacations);
    score += monthStats.starts * config.OVERLOADED_MONTH;
    const optionDays = daysBetween(option.startDate, option.endDate) + 1;
    const monthLoads = _yearMonthLoads_(allVacations, monthStats.year);
    const medianLoad = _medianMonthLoad_(monthLoads);
    const projectedMonthLoad = monthLoads[monthStats.month] + optionDays;
    if (medianLoad > 0 && projectedMonthLoad > medianLoad * 1.2) {
      score +=
        config.MONTH_OVER_BALANCE *
        Math.round(projectedMonthLoad - medianLoad * 1.2);
    }

    score += _endNearStarts_(option, allVacations) * config.END_NEAR_OTHER_START;

    return Math.round(score);
  }

  function generateCandidateDates(request) {
    const result = [];
    const first = addDays(request.desiredStart, -request.searchWindowBefore);
    const last = addDays(request.desiredStart, request.searchWindowAfter);
    let current = first;

    while (
      current &&
      _dayOrdinal_(current) <= _dayOrdinal_(last) &&
      result.length < VACATION_PLANNER_CONFIG.OPTIONS.MAX_CANDIDATES
    ) {
      result.push(current);
      current = addDays(current, 1);
    }
    return result;
  }

  function _explanation_(option, request, validation) {
    const parts = [];
    const deviation = Math.abs(
      daysBetween(request.desiredStart, option.startDate),
    );
    parts.push(
      deviation === 0
        ? "Бажана дата"
        : "Відхилення від бажаної дати: " + deviation + " дн.",
    );
    parts.push(
      "Пік одночасних відпусток: " +
        validation.concurrentCount.maxWithCandidate,
    );
    if (validation.concurrentCount.avgWithCandidate != null) {
      parts.push(
        "Середнє навантаження періоду: " +
          validation.concurrentCount.avgWithCandidate.toFixed(1),
      );
    }
    if (validation.nearestPersonGap !== null) {
      parts.push(
        "Інтервал до найближчої власної відпустки: " +
          validation.nearestPersonGap +
          " дн.",
      );
    }
    if (validation.warnings && validation.warnings.length) {
      parts.push(
        "Попередження: " +
          validation.warnings
            .map(function (warning) {
              return warning.message;
            })
            .join("; "),
      );
    }
    return parts.join("; ");
  }

  function _rejectedOption_(request, reason) {
    return {
      rank: 0,
      personKey: request.personKey,
      fml: request.fml,
      vacationNumber: request.vacationNumber,
      startDate: request.desiredStart,
      endDate: calculateEndDate(request.desiredStart, request.durationDays),
      days: request.durationDays,
      score: 9999,
      status: "REJECTED",
      explanation: reason,
      selectedForApply: false,
    };
  }

  function suggestVacationOptions(request, allVacations) {
    const normalizedRequest = normalizeRequest(request);
    const sourceVacations = Array.isArray(allVacations)
      ? allVacations
      : typeof VacationsRepository_ === "object" &&
          VacationsRepository_ &&
          typeof VacationsRepository_.listAll === "function"
        ? VacationsRepository_.listAll()
        : [];
    const options = [];
    const rejectionCounts = {};

    generateCandidateDates(normalizedRequest).forEach(function (startDate) {
      const option = {
        personKey: normalizedRequest.personKey,
        fml: normalizedRequest.fml,
        vacationNumber: normalizedRequest.vacationNumber,
        startDate: startDate,
        endDate: calculateEndDate(
          startDate,
          normalizedRequest.durationDays,
        ),
        days: normalizedRequest.durationDays,
        score: 0,
        status: "VALID",
        explanation: "",
        selectedForApply: false,
        travel: normalizedRequest.travel,
      };
      const validation = validateVacationOption(option, sourceVacations);
      if (!validation.isValid) {
        validation.violations.forEach(function (violation) {
          rejectionCounts[violation.message] =
            (rejectionCounts[violation.message] || 0) + 1;
        });
        return;
      }

      option.status =
        validation.warnings && validation.warnings.length
          ? "COMPROMISE"
          : "VALID";
      option.score = scoreVacationOption(
        option,
        sourceVacations,
        normalizedRequest,
        validation,
      );
      option.explanation = _explanation_(
        option,
        normalizedRequest,
        validation,
      );
      options.push(option);
    });

    options.sort(function (a, b) {
      if (a.score !== b.score) return a.score - b.score;
      const aDeviation = Math.abs(
        daysBetween(normalizedRequest.desiredStart, a.startDate),
      );
      const bDeviation = Math.abs(
        daysBetween(normalizedRequest.desiredStart, b.startDate),
      );
      if (aDeviation !== bDeviation) return aDeviation - bDeviation;
      return _dayOrdinal_(a.startDate) - _dayOrdinal_(b.startDate);
    });

    const top = options.slice(
      0,
      VACATION_PLANNER_CONFIG.OPTIONS.MAX_VARIANTS,
    );
    top.forEach(function (option, index) {
      option.rank = index + 1;
    });
    if (top.length) return top;

    const commonReasons = Object.keys(rejectionCounts)
      .sort(function (a, b) {
        return rejectionCounts[b] - rejectionCounts[a];
      })
      .slice(0, 3);
    return [
      _rejectedOption_(
        normalizedRequest,
        commonReasons.length
          ? "Допустимих дат не знайдено. " + commonReasons.join("; ")
          : "Допустимих дат не знайдено",
      ),
    ];
  }

  function buildScheduleAudit(allVacations) {
    const checks = [];
    const rules = VACATION_PLANNER_CONFIG.RULES;
    const normalizedSource = (Array.isArray(allVacations) ? allVacations : [])
      .map(_normalizeVacation_)
      .filter(function (vacation) {
        return vacation.active && vacation.personKeyKey;
      });
    normalizedSource.forEach(function (vacation) {
      if (!vacation.startDate || !vacation.endDate) {
        checks.push({
          severity: "ERROR",
          rule: "INVALID_DATE",
          date: "",
          fml: vacation.fml,
          details: "Активний рядок містить некоректну дату",
        });
        return;
      }
      const durationDays =
        daysBetween(vacation.startDate, vacation.endDate) + 1;
      const declaredDays = Number(
        vacation.source && vacation.source.declaredDurationDays,
      );
      if (
        durationDays < 1 ||
        durationDays > VACATION_PLANNER_CONFIG.OPTIONS.MAX_DURATION_DAYS
      ) {
        checks.push({
          severity: "ERROR",
          rule: "INVALID_DURATION",
          date:
            _dateKey_(vacation.startDate) +
            " / " +
            _dateKey_(vacation.endDate),
          fml: vacation.fml,
          details:
            "Тривалість " +
            durationDays +
            " дн., допустимо 1-" +
            VACATION_PLANNER_CONFIG.OPTIONS.MAX_DURATION_DAYS,
        });
      } else if (
        Number.isInteger(declaredDays) &&
        declaredDays > 0 &&
        declaredDays !== durationDays
      ) {
        checks.push({
          severity: "ERROR",
          rule: "INVALID_DATE",
          date:
            _dateKey_(vacation.startDate) +
            " / " +
            _dateKey_(vacation.endDate),
          fml: vacation.fml,
          details:
            "Дата завершення не відповідає тривалості: вказано " +
            declaredDays +
            " дн., фактично " +
            durationDays,
        });
      }
    });
    const vacations = normalizedSource.filter(function (vacation) {
      return vacation.startDate && vacation.endDate;
    });

    const byPersonYear = {};
    vacations.forEach(function (vacation) {
      const key =
        vacation.personKeyKey + "|" + String(vacation.startDate.getFullYear());
      if (!byPersonYear[key]) byPersonYear[key] = [];
      byPersonYear[key].push(vacation);
    });
    Object.keys(byPersonYear).forEach(function (key) {
      const items = byPersonYear[key];
      if (items.length > rules.MAX_VACATIONS_PER_PERSON_YEAR) {
        checks.push({
          severity: "ERROR",
          rule: "MAX_PERSON_YEAR",
          date: String(items[0].startDate.getFullYear()),
          fml: items[0].fml,
          details:
            "Відпусток у році: " +
            items.length +
            ", максимум: " +
            rules.MAX_VACATIONS_PER_PERSON_YEAR,
        });
      }
    });

    const startsByMonth = {};
    vacations.forEach(function (vacation) {
      const key =
        String(vacation.startDate.getFullYear()) +
        "-" +
        String(vacation.startDate.getMonth() + 1).padStart(2, "0");
      if (!startsByMonth[key]) startsByMonth[key] = [];
      startsByMonth[key].push(vacation);
    });
    Object.keys(startsByMonth).forEach(function (key) {
      const items = startsByMonth[key];
      if (items.length < rules.MONTH_START_WARNING) return;
      checks.push({
        severity: "WARNING",
        rule: "MONTH_BALANCE",
        date: key,
        fml: items
          .map(function (item) {
            return item.fml;
          })
          .join(", "),
        details: "Стартів відпусток у місяці: " + items.length,
      });
    });

    for (let i = 0; i < vacations.length; i++) {
      for (let j = i + 1; j < vacations.length; j++) {
        const left = vacations[i];
        const right = vacations[j];
        if (_samePerson_(left, right)) {
          const gap = _gapBetweenRanges_(
            left.startDate,
            left.endDate,
            right.startDate,
            right.endDate,
          );
          if (gap < rules.MIN_DAYS_GAP) {
            checks.push({
              severity: gap < 0 ? "ERROR" : "WARNING",
              rule: gap < 0 ? "PERSON_OVERLAP" : "PERSON_GAP",
              date:
                _dateKey_(left.startDate) +
                " / " +
                _dateKey_(right.startDate),
              fml: left.fml,
              details:
                gap < 0
                  ? "Відпустки перетинаються"
                  : "Інтервал " +
                    gap +
                    " днів, мінімум " +
                    rules.MIN_DAYS_GAP,
            });
          }
        } else {
          const startGap = Math.abs(
            daysBetween(left.startDate, right.startDate),
          );
          if (startGap < rules.MIN_START_GAP_DAYS) {
            checks.push({
              severity: "WARNING",
              rule: "START_GAP",
              date: _dateKey_(left.startDate),
              fml: left.fml + " / " + right.fml,
              details:
                "Різниця стартів " +
                startGap +
                " дн., мінімум " +
                rules.MIN_START_GAP_DAYS,
            });
          }
        }
      }
    }

    const dailyPeople = {};
    vacations.forEach(function (vacation) {
      let current = vacation.startDate;
      let guard = 0;
      while (
        _dayOrdinal_(current) <= _dayOrdinal_(vacation.endDate) &&
        guard < 730
      ) {
        const key = _dateKey_(current);
        if (!dailyPeople[key]) dailyPeople[key] = {};
        dailyPeople[key][vacation.personKeyKey] = vacation.fml;
        current = addDays(current, 1);
        guard++;
      }
    });
    Object.keys(dailyPeople)
      .sort()
      .forEach(function (dateKey) {
        const people = Object.keys(dailyPeople[dateKey]).map(function (key) {
          return dailyPeople[dateKey][key];
        });
        if (people.length >= rules.MAX_CONCURRENT) {
          checks.push({
            severity:
              people.length > rules.MAX_CONCURRENT ? "ERROR" : "WARNING",
            rule:
              people.length > rules.MAX_CONCURRENT
                ? "MAX_CONCURRENT"
                : "HIGH_LOAD_PERIOD",
            date: dateKey,
            fml: people.join(", "),
            details:
              "Одночасно " +
              people.length +
              " людей, максимум " +
              rules.MAX_CONCURRENT,
          });
        }
      });

    const schedule = vacations
      .slice()
      .sort(function (a, b) {
        return _dayOrdinal_(a.startDate) - _dayOrdinal_(b.startDate);
      })
      .map(function (vacation) {
        return {
          fml: vacation.fml,
          vacationNumber: vacation.vacationNumber,
          startDate: vacation.startDate,
          endDate: vacation.endDate,
          days: daysBetween(vacation.startDate, vacation.endDate) + 1,
          vacationType:
            (vacation.source &&
              (vacation.source.vacationNo ||
                vacation.source.vacationType ||
                vacation.source.type)) ||
            "",
          active: vacation.active,
          block:
            (vacation.source &&
              vacation.source._meta &&
              vacation.source._meta.block) ||
            "",
          sourceRow:
            (vacation.source &&
              vacation.source._meta &&
              vacation.source._meta.rowNumber) ||
            "",
          sourceStartColumn:
            (vacation.source &&
              vacation.source._meta &&
              vacation.source._meta.startColumn) ||
            "",
        };
      });

    return { schedule: schedule, checks: checks };
  }

  return {
    normalizeRequest: normalizeRequest,
    suggestVacationOptions: suggestVacationOptions,
    validateVacationOption: validateVacationOption,
    scoreVacationOption: scoreVacationOption,
    generateCandidateDates: generateCandidateDates,
    countConcurrentVacations: countConcurrentVacations,
    calculateEndDate: calculateEndDate,
    daysBetween: daysBetween,
    buildConsistencyAudit: buildConsistencyAudit,
    buildScheduleAudit: buildScheduleAudit,
  };
})();

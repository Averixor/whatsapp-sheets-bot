/**
 * Vacation_Suggestions.gs — concrete fix proposals for vacation audit issues.
 */

const VacationSuggestions_ = (function () {
  const MONTHS_UA = [
    "січень",
    "лютий",
    "березень",
    "квітень",
    "травень",
    "червень",
    "липень",
    "серпень",
    "вересень",
    "жовтень",
    "листопад",
    "грудень",
  ];
  const RULE_ALIASES = {
    GAP_TOO_SHORT: "PERSON_GAP",
    START_TOO_CLOSE: "START_GAP",
    YEAR_LIMIT: "MAX_PERSON_YEAR",
  };
  const MAX_SUGGESTIONS = 5;
  const SEARCH_FORWARD_DAYS = 90;
  const SHIFT_OFFSETS = [
    1, 2, 3, 7, 14, 21, 28, 35, 42, 49, 56, 63, 70, 77, 84, 90,
  ];

  function _trim_(value) {
    return String(value == null ? "" : value)
      .replace(/\s+/g, " ")
      .trim();
  }

  function _ruleKey_(issue) {
    const raw = String((issue && (issue.rule || issue.type)) || "").trim();
    return RULE_ALIASES[raw] || raw;
  }

  function _service_() {
    return typeof VacationPlannerService_ === "object" &&
      VacationPlannerService_
      ? VacationPlannerService_
      : null;
  }

  function _rules_(context) {
    return (
      (context && context.rules) ||
      (VACATION_PLANNER_CONFIG && VACATION_PLANNER_CONFIG.RULES) ||
      {}
    );
  }

  function _vacations_(context) {
    return Array.isArray(context && context.vacations) ? context.vacations : [];
  }

  function _schedule_(context) {
    return Array.isArray(context && context.schedule) ? context.schedule : [];
  }

  function _dateKey_(value) {
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
      return value.trim();
    }
    const service = _service_();
    if (service && typeof service.daysBetween === "function") {
      const noon =
        value instanceof Date
          ? value
          : typeof DateUtils_ === "object" &&
              DateUtils_ &&
              typeof DateUtils_.parseDateAny === "function"
            ? DateUtils_.parseDateAny(value)
            : null;
      if (noon instanceof Date && !isNaN(noon.getTime())) {
        const month = String(noon.getMonth() + 1).padStart(2, "0");
        const day = String(noon.getDate()).padStart(2, "0");
        return noon.getFullYear() + "-" + month + "-" + day;
      }
    }
    return _trim_(value);
  }

  function _parseDates_(value) {
    return (
      String(value || "").match(/\d{4}-\d{2}-\d{2}/g) ||
      String(value || "").match(/\d{4}-\d{1,2}-\d{1,2}/g) ||
      []
    ).map(_dateKey_);
  }

  function _splitPeople_(value) {
    return String(value || "")
      .split(/\s*(?:\/|,)\s*/)
      .map(_trim_)
      .filter(Boolean);
  }

  function _monthLabel_(yearMonth) {
    const match = String(yearMonth || "").match(/^(\d{4})-(\d{1,2})$/);
    if (!match) return String(yearMonth || "");
    const monthIndex = Number(match[2]) - 1;
    return MONTHS_UA[monthIndex] + " " + match[1];
  }

  function _formatUa_(dateKey) {
    const match = String(dateKey || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return String(dateKey || "");
    return match[3] + "." + match[2] + "." + match[1];
  }

  function _toDate_(value) {
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

  function _addDays_(date, days) {
    const source = _toDate_(date);
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

  function _calculateEnd_(startDate, durationDays) {
    return _addDays_(startDate, Number(durationDays) - 1);
  }

  function _durationDays_(startDate, endDate) {
    const service = _service_();
    if (service && typeof service.daysBetween === "function") {
      return service.daysBetween(startDate, endDate) + 1;
    }
    const start = _toDate_(startDate);
    const end = _toDate_(endDate);
    if (!start || !end) return 0;
    return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  }

  function _normalized_(context) {
    if (context && Array.isArray(context.normalizedVacations)) {
      return context.normalizedVacations;
    }
    const service = _service_();
    if (!service) return [];
    const raw = _vacations_(context);
    return raw
      .map(function (item) {
        return {
          fml: _trim_(item.fml),
          personKey: _trim_(item.personKey || item.callsign || item.fml),
          vacationNumber: Number(item.vacationNumber) || 0,
          startDate: item.startDate,
          endDate: item.endDate,
          active: item.active !== false,
          requestId: _trim_(item.requestId),
          intervalCheck: _trim_(item.intervalCheck),
          status: _trim_(item.status),
          sourceRow:
            item.sourceRow || (item._meta && item._meta.rowNumber) || "",
          sourceStartColumn:
            item.sourceStartColumn ||
            (item._meta && item._meta.startColumn) ||
            "",
          writable:
            item._meta && item._meta.writable !== undefined
              ? item._meta.writable
              : true,
          source: item,
        };
      })
      .filter(function (item) {
        return (
          item.fml && item.startDate && item.endDate && item.active !== false
        );
      });
  }

  function _slotKey_(vacation) {
    return (
      String(vacation.fml || "").toUpperCase() +
      "|" +
      String(vacation.vacationNumber || 0) +
      "|" +
      _dateKey_(vacation.startDate)
    );
  }

  function _isLocked_(vacation, context) {
    const item = vacation || {};
    const intervalCheck = String(item.intervalCheck || "").toUpperCase();
    if (
      intervalCheck === "LOCKED" ||
      intervalCheck.indexOf("ФІКСОВАНО") !== -1 ||
      intervalCheck.indexOf("FIXED") !== -1
    ) {
      return true;
    }
    const lockedKeys = (context && context.lockedSlotKeys) || {};
    return lockedKeys[_slotKey_(item)] === true;
  }

  function _monthStartCount_(yearMonth, vacations) {
    const prefix = String(yearMonth || "").slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(prefix)) return 0;
    return vacations.filter(function (item) {
      return _dateKey_(item.startDate).slice(0, 7) === prefix;
    }).length;
  }

  function _findVacationCoveringDate_(fml, issueDate, context) {
    const key = _trim_(fml).toUpperCase();
    const issueKey = _dateKey_(issueDate);
    if (!key || !issueKey) return null;
    const matches = _normalized_(context).filter(function (item) {
      if (item.fml.toUpperCase() !== key) return false;
      const start = _dateKey_(item.startDate);
      const end = _dateKey_(item.endDate);
      return issueKey >= start && issueKey <= end;
    });
    if (!matches.length) return null;
    return matches.sort(function (left, right) {
      return _dateKey_(left.startDate).localeCompare(
        _dateKey_(right.startDate),
      );
    })[0];
  }

  function _findVacation_(fml, dates, context, vacationNumber) {
    const people = fml ? [_trim_(fml)] : [];
    const normalized = _normalized_(context);
    const targetKey = people.length ? people[0].toUpperCase() : "";
    const matches = normalized.filter(function (item) {
      if (targetKey && item.fml.toUpperCase() !== targetKey) return false;
      if (
        vacationNumber &&
        Number(item.vacationNumber) !== Number(vacationNumber)
      ) {
        return false;
      }
      if (!dates || !dates.length) return true;
      const start = _dateKey_(item.startDate);
      const end = _dateKey_(item.endDate);
      return dates.indexOf(start) !== -1 || dates.indexOf(end) !== -1;
    });
    if (matches.length) {
      return matches.sort(function (left, right) {
        return _dateKey_(left.startDate).localeCompare(
          _dateKey_(right.startDate),
        );
      })[matches.length - 1];
    }
    if (dates && dates.length) return null;
    if (!targetKey) return null;
    return (
      normalized
        .filter(function (item) {
          return item.fml.toUpperCase() === targetKey;
        })
        .sort(function (left, right) {
          return _dateKey_(left.startDate).localeCompare(
            _dateKey_(right.startDate),
          );
        })
        .pop() || null
    );
  }

  function _findPersonVacations_(fml, context) {
    const key = _trim_(fml).toUpperCase();
    return _normalized_(context)
      .filter(function (item) {
        return item.fml.toUpperCase() === key;
      })
      .sort(function (left, right) {
        return _dateKey_(left.startDate).localeCompare(
          _dateKey_(right.startDate),
        );
      });
  }

  function _replaceVacation_(vacations, target, candidate) {
    return vacations.map(function (item) {
      if (
        item.fml.toUpperCase() === target.fml.toUpperCase() &&
        Number(item.vacationNumber) === Number(target.vacationNumber) &&
        _dateKey_(item.startDate) === _dateKey_(target.startDate)
      ) {
        return Object.assign({}, item, candidate);
      }
      return item;
    });
  }

  function _peopleOnDate_(dateKey, vacations) {
    const people = {};
    vacations.forEach(function (vacation) {
      const start = _dateKey_(vacation.startDate);
      const end = _dateKey_(vacation.endDate);
      if (dateKey >= start && dateKey <= end) {
        people[vacation.fml] = true;
      }
    });
    return Object.keys(people);
  }

  function _peakConcurrent_(vacations, startDate, endDate) {
    const service = _service_();
    if (!service || typeof service.countConcurrentVacations !== "function") {
      return { max: 0 };
    }
    return service.countConcurrentVacations(startDate, endDate, vacations);
  }

  function _buildCandidate_(target, newStart, durationDays) {
    const endDate = _calculateEnd_(newStart, durationDays);
    return {
      requestId: target.requestId || "",
      personKey: target.personKey || target.fml,
      fml: target.fml,
      vacationNumber: target.vacationNumber,
      startDate: newStart,
      endDate: endDate,
      days: durationDays,
      sourceRow: target.sourceRow,
      sourceStartColumn: target.sourceStartColumn,
      writable: target.writable,
      intervalCheck: target.intervalCheck,
      status: target.status,
    };
  }

  function validateVacationCandidate_(candidate, context) {
    const service = _service_();
    const rules = _rules_(context);
    const hardErrors = [];
    const warnings = [];
    const explanation = [];
    let disqualified = false;

    if (!service) {
      return {
        ok: false,
        disqualified: true,
        hardErrors: ["Сервіс планувальника недоступний"],
        warnings: [],
        score: 9999,
        explanation: [],
      };
    }

    if (_isLocked_(candidate.target || candidate, context)) {
      hardErrors.push("Відпустку позначено як LOCKED");
    }

    const target = candidate.target || candidate;
    const newStart = candidate.newStart || candidate.startDate;
    const newEnd =
      candidate.newEnd ||
      candidate.endDate ||
      _calculateEnd_(newStart, candidate.days || candidate.durationDays);
    const durationDays =
      Number(candidate.days || candidate.durationDays) ||
      _durationDays_(target.startDate, target.endDate);
    const oldDuration = _durationDays_(target.startDate, target.endDate);

    if (durationDays !== oldDuration) {
      hardErrors.push("Тривалість відпустки змінилась");
    }

    const option = _buildCandidate_(target, newStart, durationDays);
    const modified = _replaceVacation_(_normalized_(context), target, option);
    const rawModified = modified.map(function (item) {
      return Object.assign({}, item.source || item, {
        fml: item.fml,
        personKey: item.personKey,
        vacationNumber: item.vacationNumber,
        startDate: item.startDate,
        endDate: item.endDate,
        active: true,
        requestId: item.requestId,
        intervalCheck: item.intervalCheck,
        status: item.status,
        _meta: {
          rowNumber: item.sourceRow,
          startColumn: item.sourceStartColumn,
          writable: item.writable,
        },
      });
    });

    const validation = service.validateVacationOption(option, rawModified);
    (validation.blockingViolations || []).forEach(function (item) {
      hardErrors.push(item.message || item.rule);
    });
    (validation.warnings || []).forEach(function (item) {
      const rule = String(item.rule || "").trim();
      if (rule === "START_GAP" || rule === "MAX_CONCURRENT") {
        hardErrors.push(item.message || item.rule);
      } else if (rule !== "PERSON_GAP") {
        warnings.push(item.message || item.rule);
      }
    });

    const personVacations = _findPersonVacations_(target.fml, context).filter(
      function (item) {
        return !(
          item.fml.toUpperCase() === target.fml.toUpperCase() &&
          Number(item.vacationNumber) === Number(target.vacationNumber) &&
          _dateKey_(item.startDate) === _dateKey_(target.startDate)
        );
      },
    );
    const newStartKey = _dateKey_(newStart);
    const prevVacation = personVacations
      .filter(function (item) {
        return _dateKey_(item.startDate) < newStartKey;
      })
      .pop();
    const nextVacation = personVacations.find(function (item) {
      return _dateKey_(item.startDate) > newStartKey;
    });
    if (prevVacation && service.daysBetween) {
      const gap = service.daysBetween(prevVacation.endDate, newStart);
      if (gap < rules.MIN_DAYS_GAP) {
        hardErrors.push(
          "Інтервал між відпустками " +
            gap +
            " днів, мінімум " +
            rules.MIN_DAYS_GAP,
        );
      }
    }
    if (nextVacation && service.daysBetween) {
      const gap = service.daysBetween(newEnd, nextVacation.startDate);
      if (gap < rules.MIN_DAYS_GAP) {
        hardErrors.push(
          "Не можна застосувати автоматично: порушується інтервал до наступної відпустки " +
            _formatUa_(_dateKey_(nextVacation.startDate)) +
            " – " +
            _formatUa_(_dateKey_(nextVacation.endDate)),
        );
      }
    }

    if (candidate.reducesMonthSkew) {
      const oldMonth = _dateKey_(target.startDate).slice(0, 7);
      const newMonth = _dateKey_(newStart).slice(0, 7);
      if (oldMonth === newMonth) {
        disqualified = true;
      } else {
        const oldCount = _monthStartCount_(oldMonth, _normalized_(context));
        const newCount = _monthStartCount_(oldMonth, modified);
        if (newCount >= oldCount) {
          disqualified = true;
        }
      }
    }

    if (candidate.fixesError && candidate.issueDate) {
      const issueKey = _dateKey_(candidate.issueDate);
      const beforeCount = _peopleOnDate_(
        issueKey,
        _normalized_(context),
      ).length;
      const afterCount = _peopleOnDate_(issueKey, modified).length;
      const errorAt =
        Number(rules.ABSOLUTE_MAX_CONCURRENT) ||
        Number(rules.OVERLOAD_CONCURRENT) + 1 ||
        5;
      const overloadAt =
        Number(rules.OVERLOAD_CONCURRENT) ||
        Number(rules.MAX_CONCURRENT) + 1 ||
        4;
      if (afterCount >= errorAt) {
        hardErrors.push(
          "Кандидат не виправляє перевищення одночасного навантаження",
        );
      } else if (beforeCount >= errorAt && afterCount >= beforeCount) {
        disqualified = true;
      } else if (
        beforeCount > overloadAt &&
        afterCount >= beforeCount
      ) {
        disqualified = true;
      } else if (
        beforeCount > rules.MAX_CONCURRENT &&
        afterCount > rules.MAX_CONCURRENT &&
        afterCount >= beforeCount
      ) {
        disqualified = true;
      }
    }

    const shiftDays = Math.abs(
      service.daysBetween(target.startDate, newStart) || 0,
    );
    explanation.push("Зсув старту: " + shiftDays + " дн.");

    return {
      ok: hardErrors.length === 0 && !disqualified,
      disqualified: disqualified,
      hardErrors: hardErrors,
      warnings: warnings,
      score: calculateSuggestionScore_(
        {
          target: target,
          newStart: newStart,
          newEnd: newEnd,
          days: durationDays,
          shiftDays: shiftDays,
          fixesError: candidate.fixesError === true,
          reducesMonthSkew: candidate.reducesMonthSkew === true,
          reducesOverlap: candidate.reducesOverlap === true,
          crossesMonthBoundary:
            _dateKey_(target.startDate).slice(0, 7) !==
            _dateKey_(newStart).slice(0, 7),
        },
        context,
        {
          hardErrors: hardErrors,
          warnings: warnings,
          disqualified: disqualified,
        },
      ),
      explanation: explanation,
    };
  }

  function calculateSuggestionScore_(candidate, context, validation) {
    let score = Number(candidate.shiftDays || 0);
    const validationResult = validation || {};
    if (validationResult.disqualified) {
      return 9999;
    }
    if ((validationResult.hardErrors || []).length) {
      return 9999;
    }
    if (candidate.fixesError) score -= 200;
    score += (validationResult.warnings || []).length * 25;
    if (candidate.reducesMonthSkew) score -= 40;
    if (candidate.reducesOverlap) score -= 60;
    if (candidate.crossesMonthBoundary) score -= 50;
    return Math.round(score);
  }

  function _buildSuggestionEffects_(
    target,
    newStart,
    context,
    meta,
    validation,
  ) {
    const effects = [];
    if (meta && meta.fixesError && meta.issueDate) {
      (meta.effect || []).forEach(function (line) {
        effects.push(line);
      });
    } else if (meta && meta.effect) {
      meta.effect.forEach(function (line) {
        effects.push(line);
      });
    }
    if (meta && meta.reducesMonthSkew && !validation.disqualified) {
      const oldMonth = _dateKey_(target.startDate).slice(0, 7);
      const modified = _replaceVacation_(
        _normalized_(context),
        target,
        _buildCandidate_(
          target,
          newStart,
          _durationDays_(target.startDate, target.endDate),
        ),
      );
      const oldCount = _monthStartCount_(oldMonth, _normalized_(context));
      const newCount = _monthStartCount_(oldMonth, modified);
      if (newCount < oldCount) {
        effects.push("Зменшує кількість стартів у " + _monthLabel_(oldMonth));
      }
    }
    if (
      meta &&
      meta.fixesError &&
      meta.issueDate &&
      _dateKey_(target.startDate).slice(0, 7) !==
        _dateKey_(newStart).slice(0, 7)
    ) {
      const oldMonth = _dateKey_(target.startDate).slice(0, 7);
      const modified = _replaceVacation_(
        _normalized_(context),
        target,
        _buildCandidate_(
          target,
          newStart,
          _durationDays_(target.startDate, target.endDate),
        ),
      );
      const oldCount = _monthStartCount_(oldMonth, _normalized_(context));
      const newCount = _monthStartCount_(oldMonth, modified);
      if (
        newCount < oldCount &&
        effects.indexOf(
          "Зменшує кількість стартів у " + _monthLabel_(oldMonth),
        ) === -1
      ) {
        effects.push("Зменшує кількість стартів у " + _monthLabel_(oldMonth));
      }
    }
    return effects;
  }

  function _makeSuggestion_(issue, target, newStart, newEnd, meta) {
    const oldStartKey = _dateKey_(target.startDate);
    const newStartKey = _dateKey_(newStart);
    const crossesMonthBoundary =
      oldStartKey.slice(0, 7) !== newStartKey.slice(0, 7);
    const validation = validateVacationCandidate_(
      {
        target: target,
        newStart: newStart,
        newEnd: newEnd,
        days: _durationDays_(target.startDate, target.endDate),
        fixesError: !!(meta && meta.fixesError),
        reducesMonthSkew: !!(meta && meta.reducesMonthSkew),
        reducesOverlap: !!(meta && meta.reducesOverlap),
        crossesMonthBoundary: crossesMonthBoundary,
        issueDate: meta && meta.issueDate,
        issueRule: meta && meta.issueRule,
      },
      meta && meta.context ? meta.context : {},
    );
    if (validation.disqualified) return null;

    const context = meta && meta.context ? meta.context : {};
    const canAutoApply =
      validation.hardErrors.length === 0 &&
      !_isLocked_(target, context) &&
      target.writable !== false &&
      !!target.sourceRow &&
      !!target.sourceStartColumn;
    const autoApplyReason = canAutoApply
      ? ""
      : validation.hardErrors.length
        ? validation.hardErrors[0]
        : _isLocked_(target, context)
          ? "Відпустку позначено LOCKED"
          : "Авто застосування недоступне для цього джерела";

    return {
      suggestionId:
        (meta && meta.suggestionId) ||
        Utilities.getUuid().slice(0, 12).toUpperCase(),
      title: (meta && meta.title) || "Перенести " + target.fml,
      personName: target.fml,
      personKey: target.personKey || target.fml,
      vacationNumber: target.vacationNumber,
      requestId: target.requestId || "",
      oldStart: _formatUa_(_dateKey_(target.startDate)),
      oldEnd: _formatUa_(_dateKey_(target.endDate)),
      oldStartIso: _dateKey_(target.startDate),
      oldEndIso: _dateKey_(target.endDate),
      newStart: _formatUa_(_dateKey_(newStart)),
      newEnd: _formatUa_(_dateKey_(newEnd)),
      newStartIso: _dateKey_(newStart),
      newEndIso: _dateKey_(newEnd),
      days: _durationDays_(target.startDate, target.endDate),
      effect: _buildSuggestionEffects_(
        target,
        newStart,
        context,
        meta,
        validation,
      ),
      risks: validation.warnings || [],
      score: validation.score,
      crossesMonthBoundary: crossesMonthBoundary,
      canAutoApply: canAutoApply,
      autoApplyReason: autoApplyReason,
      sourceRow: target.sourceRow,
      sourceStartColumn: target.sourceStartColumn,
    };
  }

  function _collectCandidates_(target, startDates, context, meta) {
    const suggestions = [];
    const durationDays = _durationDays_(target.startDate, target.endDate);
    const oldMonth = _dateKey_(target.startDate).slice(0, 7);
    const dates = (Array.isArray(startDates) ? startDates : []).filter(
      function (startDate) {
        if (!startDate) return false;
        if (meta && meta.reducesMonthSkew) {
          return _dateKey_(startDate).slice(0, 7) !== oldMonth;
        }
        return true;
      },
    );
    dates.forEach(function (startDate) {
      const endDate = _calculateEnd_(startDate, durationDays);
      const suggestion = _makeSuggestion_(null, target, startDate, endDate, {
        context: context,
        effect: (meta && meta.effect) || [],
        fixesError: meta && meta.fixesError,
        reducesMonthSkew: meta && meta.reducesMonthSkew,
        reducesOverlap: meta && meta.reducesOverlap,
        issueDate: meta && meta.issueDate,
        issueRule: meta && meta.issueRule,
        title: meta && meta.title,
      });
      if (suggestion) suggestions.push(suggestion);
    });
    suggestions.sort(function (left, right) {
      if (left.score !== right.score) return left.score - right.score;
      return left.newStartIso.localeCompare(right.newStartIso);
    });
    return suggestions;
  }

  function _dedupeSuggestions_(suggestions) {
    const seen = {};
    return suggestions.filter(function (item) {
      const key =
        item.personName + "|" + item.newStartIso + "|" + item.newEndIso;
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function _topSuggestions_(suggestions) {
    return _dedupeSuggestions_(suggestions)
      .filter(function (item) {
        return Number(item.score) < 9999;
      })
      .sort(function (left, right) {
        if (left.score !== right.score) return left.score - right.score;
        return String(left.newStartIso || "").localeCompare(
          String(right.newStartIso || ""),
        );
      })
      .slice(0, MAX_SUGGESTIONS);
  }

  function suggestForTooManyOverlaps_(issue, context) {
    const rules = _rules_(context);
    const dates = _parseDates_(issue && issue.date);
    const overlapDate = dates[0] || _dateKey_(issue && issue.date);
    if (!overlapDate) return [];

    const normalized = _normalized_(context);
    const overloaded = _peopleOnDate_(overlapDate, normalized);
    if (overloaded.length <= rules.MAX_CONCURRENT) return [];

    overloaded.sort(function (leftName, rightName) {
      const leftVacation = _findVacationCoveringDate_(
        leftName,
        overlapDate,
        context,
      );
      const rightVacation = _findVacationCoveringDate_(
        rightName,
        overlapDate,
        context,
      );
      const leftStartsOnOverlap =
        leftVacation && _dateKey_(leftVacation.startDate) === overlapDate
          ? 0
          : 1;
      const rightStartsOnOverlap =
        rightVacation && _dateKey_(rightVacation.startDate) === overlapDate
          ? 0
          : 1;
      if (leftStartsOnOverlap !== rightStartsOnOverlap) {
        return leftStartsOnOverlap - rightStartsOnOverlap;
      }
      return String(leftName).localeCompare(String(rightName));
    });

    const suggestions = [];
    overloaded.forEach(function (fml) {
      const target = _findVacationCoveringDate_(fml, overlapDate, context);
      if (!target || _isLocked_(target, context)) return;

      const durationDays = _durationDays_(target.startDate, target.endDate);
      const startDates = [];
      startDates.push(target.endDate);
      SHIFT_OFFSETS.forEach(function (offset) {
        startDates.push(_addDays_(target.startDate, offset));
        startDates.push(_addDays_(target.endDate, offset));
      });
      startDates.push(_addDays_(overlapDate, rules.MIN_START_GAP_DAYS));
      const overlapDateObj =
        typeof DateUtils_ === "object" &&
        DateUtils_ &&
        typeof DateUtils_.parseDateAny === "function"
          ? DateUtils_.parseDateAny(overlapDate)
          : null;
      if (overlapDateObj instanceof Date && !isNaN(overlapDateObj.getTime())) {
        startDates.push(
          new Date(
            overlapDateObj.getFullYear(),
            overlapDateObj.getMonth() + 1,
            4,
            12,
            0,
            0,
            0,
          ),
        );
      }

      const collected = _collectCandidates_(target, startDates, context, {
        fixesError: true,
        reducesOverlap: true,
        issueDate: overlapDate,
        issueRule: "MAX_CONCURRENT",
        effect: [
          "Прибирає перевищення максимуму " +
            rules.MAX_CONCURRENT +
            " людей одночасно " +
            _formatUa_(overlapDate),
        ],
      });
      suggestions.push.apply(suggestions, collected);
    });

    return _topSuggestions_(suggestions);
  }

  function suggestForMinInterval_(issue, context) {
    const rules = _rules_(context);
    const dates = _parseDates_(issue && issue.date);
    const fml = _trim_(issue && (issue.primaryFml || issue.fml));
    const personVacations = _findPersonVacations_(fml, context);
    if (personVacations.length < 2) return [];

    let earlier = null;
    let later = null;
    if (dates.length >= 2) {
      earlier = _findVacation_(fml, [dates[0]], context);
      later = _findVacation_(fml, [dates[1]], context);
    } else {
      later = personVacations[personVacations.length - 1];
      earlier = personVacations[personVacations.length - 2];
    }
    if (!later || !earlier) return [];
    if (_isLocked_(later, context)) return [];

    const minStart = _addDays_(earlier.endDate, rules.MIN_DAYS_GAP);
    const startDates = [minStart];
    for (let offset = 1; offset <= SEARCH_FORWARD_DAYS; offset++) {
      startDates.push(_addDays_(minStart, offset));
    }

    return _topSuggestions_(
      _collectCandidates_(later, startDates, context, {
        fixesError: false,
        effect: [
          "Виправляє інтервал " +
            rules.MIN_DAYS_GAP +
            " днів між стартами відпусток",
        ],
        title: "Перенести " + later.fml,
      }),
    );
  }

  function suggestForMonthStartSkew_(issue, context) {
    const rules = _rules_(context);
    const monthKey = String((issue && issue.date) || "").trim();
    const monthMatch = monthKey.match(/^(\d{4})-(\d{1,2})$/);
    if (!monthMatch) return [];

    const year = Number(monthMatch[1]);
    const month = Number(monthMatch[2]) - 1;
    const monthVacations = _normalized_(context).filter(function (item) {
      const start = item.startDate;
      return (
        start instanceof Date &&
        !isNaN(start.getTime()) &&
        start.getFullYear() === year &&
        start.getMonth() === month
      );
    });
    if (monthVacations.length < rules.MONTH_START_WARNING) return [];

    const suggestions = [];
    monthVacations.forEach(function (target) {
      if (_isLocked_(target, context)) return;
      const startDates = [
        _addDays_(new Date(year, month + 1, 1, 12, 0, 0, 0), 3),
        _addDays_(new Date(year, month + 1, 1, 12, 0, 0, 0), 10),
        _addDays_(new Date(year, month + 1, 1, 12, 0, 0, 0), 17),
      ];

      suggestions.push.apply(
        suggestions,
        _collectCandidates_(target, startDates, context, {
          reducesMonthSkew: true,
          issueDate: monthKey,
          issueRule: "MONTH_BALANCE",
          title: "Перенести " + target.fml,
        }),
      );
    });

    return _topSuggestions_(suggestions);
  }

  function suggestForStartsTooClose_(issue, context) {
    const rules = _rules_(context);
    const people = _splitPeople_(issue && issue.fml);
    const dates = _parseDates_(issue && issue.date);
    if (people.length < 2 && dates.length < 2) return [];

    const leftFml = people[0] || _trim_(issue && issue.primaryFml);
    const rightFml = people[1] || leftFml;
    const left = _findVacation_(leftFml, dates.slice(0, 1), context);
    const right =
      _findVacation_(rightFml, dates.slice(1, 2), context) ||
      _findVacation_(rightFml, dates, context);
    if (!left && !right) return [];

    const suggestions = [];
    [left, right].forEach(function (target) {
      if (!target || _isLocked_(target, context)) return;
      const startDates = SHIFT_OFFSETS.map(function (offset) {
        return _addDays_(target.startDate, offset);
      });
      startDates.push(_addDays_(target.startDate, rules.MIN_START_GAP_DAYS));
      suggestions.push.apply(
        suggestions,
        _collectCandidates_(target, startDates, context, {
          effect: [
            "Розводить старти мінімум на " + rules.MIN_START_GAP_DAYS + " дні",
          ],
          title: "Перенести " + target.fml,
        }),
      );
    });

    return _topSuggestions_(suggestions);
  }

  function buildVacationFixSuggestions_(issue, context) {
    const rule = _ruleKey_(issue);
    let suggestions = [];
    if (rule === "MAX_CONCURRENT") {
      suggestions = suggestForTooManyOverlaps_(issue, context);
    } else if (rule === "PERSON_GAP" || rule === "PERSON_OVERLAP") {
      suggestions = suggestForMinInterval_(issue, context);
    } else if (rule === "MONTH_BALANCE") {
      suggestions = suggestForMonthStartSkew_(issue, context);
    } else if (rule === "START_GAP") {
      suggestions = suggestForStartsTooClose_(issue, context);
    } else if (rule === "HIGH_LOAD_PERIOD") {
      suggestions = suggestForTooManyOverlaps_(issue, context);
    }

    return {
      issueId:
        _trim_(issue && issue.issueId) ||
        rule +
          "|" +
          String((issue && issue.date) || "") +
          "|" +
          _trim_(issue && issue.fml),
      suggestions: _topSuggestions_(suggestions),
    };
  }

  function buildSuggestionContext_(schedule, vacations, options) {
    const opts = options || {};
    const list =
      vacations ||
      (typeof VacationsRepository_ === "object" &&
      VacationsRepository_ &&
      typeof VacationsRepository_.listAll === "function"
        ? VacationsRepository_.listAll()
        : []);
    const normalized = _normalized_({
      vacations: list,
      schedule: schedule,
    });
    return {
      vacations: list,
      normalizedVacations: normalized,
      schedule: Array.isArray(schedule) ? schedule : [],
      rules: VACATION_PLANNER_CONFIG.RULES,
      lockedSlotKeys: opts.lockedSlotKeys || {},
    };
  }

  function attachSuggestionsToProblems_(problems, context) {
    return (Array.isArray(problems) ? problems : []).map(
      function (problem, index) {
        const enriched = Object.assign({}, problem);
        const result = buildVacationFixSuggestions_(enriched, context);
        enriched.issueId = result.issueId || "issue-" + index;
        enriched.fixSuggestions = result.suggestions || [];
        enriched.suggestionTexts = formatSuggestionTexts_(
          enriched.fixSuggestions,
        );
        return enriched;
      },
    );
  }

  function formatSuggestionTexts_(suggestions) {
    return (Array.isArray(suggestions) ? suggestions : []).map(
      function (item, index) {
        const lines = [
          String(index + 1) + ". " + item.title,
          "   Було: " + item.oldStart + " – " + item.oldEnd,
          "   Стало: " + item.newStart + " – " + item.newEnd,
        ];
        if (item.effect && item.effect.length) {
          lines.push("   Ефект:");
          item.effect.forEach(function (effect) {
            lines.push("   • " + effect);
          });
        }
        if (item.risks && item.risks.length) {
          lines.push("   Ризик:");
          item.risks.forEach(function (risk) {
            lines.push("   • " + risk);
          });
        }
        return lines.join("\n");
      },
    );
  }

  function formatIssueMonthLabel_(issue) {
    const rule = _ruleKey_(issue);
    if (rule !== "MONTH_BALANCE") return "";
    return _monthLabel_(issue && issue.date);
  }

  return {
    buildVacationFixSuggestions_: buildVacationFixSuggestions_,
    suggestForTooManyOverlaps_: suggestForTooManyOverlaps_,
    suggestForMinInterval_: suggestForMinInterval_,
    suggestForMonthStartSkew_: suggestForMonthStartSkew_,
    suggestForStartsTooClose_: suggestForStartsTooClose_,
    validateVacationCandidate_: validateVacationCandidate_,
    calculateSuggestionScore_: calculateSuggestionScore_,
    buildSuggestionContext_: buildSuggestionContext_,
    attachSuggestionsToProblems_: attachSuggestionsToProblems_,
    formatSuggestionTexts_: formatSuggestionTexts_,
    formatIssueMonthLabel_: formatIssueMonthLabel_,
    isVacationLocked_: _isLocked_,
  };
})();

function buildVacationSuggestionContext_(schedule, vacations, options) {
  return VacationSuggestions_.buildSuggestionContext_(
    schedule,
    vacations,
    options,
  );
}

function buildVacationFixSuggestions_(issue, context) {
  return VacationSuggestions_.buildVacationFixSuggestions_(issue, context);
}

function suggestForTooManyOverlaps_(issue, context) {
  return VacationSuggestions_.suggestForTooManyOverlaps_(issue, context);
}

function suggestForMinInterval_(issue, context) {
  return VacationSuggestions_.suggestForMinInterval_(issue, context);
}

function suggestForMonthStartSkew_(issue, context) {
  return VacationSuggestions_.suggestForMonthStartSkew_(issue, context);
}

function suggestForStartsTooClose_(issue, context) {
  return VacationSuggestions_.suggestForStartsTooClose_(issue, context);
}

function validateVacationCandidate_(candidate, context) {
  return VacationSuggestions_.validateVacationCandidate_(candidate, context);
}

function calculateSuggestionScore_(candidate, context, validation) {
  return VacationSuggestions_.calculateSuggestionScore_(
    candidate,
    context,
    validation,
  );
}

function _resolveSuggestionDurationDays_(data) {
  const source = data && typeof data === "object" ? data : {};
  const direct = Number(
    source.days != null
      ? source.days
      : source.durationDays != null
        ? source.durationDays
        : source.duration,
  );
  if (Number.isInteger(direct) && direct > 0) return direct;

  const startIso = String(source.newStartIso || source.startDate || "").trim();
  const endIso = String(source.newEndIso || "").trim();
  if (!startIso || !endIso) return NaN;

  const service =
    typeof VacationPlannerService_ === "object" ? VacationPlannerService_ : null;
  if (!service || typeof service.daysBetween !== "function") return NaN;

  const start = new Date(startIso + "T12:00:00");
  const end = new Date(endIso + "T12:00:00");
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return NaN;
  return service.daysBetween(start, end) + 1;
}

function applyVacationSuggestion_(suggestionId, payload) {
  const data = payload || {};
  if (
    typeof VacationSidebarService_ !== "object" ||
    !VacationSidebarService_ ||
    typeof VacationSidebarService_.moveVacation !== "function"
  ) {
    throw new Error("Сервіс перенесення відпусток недоступний");
  }
  if (!data.fml || !data.newStartIso) {
    throw new Error("Неповні дані для застосування пропозиції");
  }
  const days = _resolveSuggestionDurationDays_(data);
  if (
    !Number.isInteger(days) ||
    days < 1 ||
    days > VACATION_PLANNER_CONFIG.OPTIONS.MAX_DURATION_DAYS
  ) {
    throw new Error(
      "Тривалість має бути від 1 до " +
        VACATION_PLANNER_CONFIG.OPTIONS.MAX_DURATION_DAYS +
        " днів",
    );
  }
  const result = VacationSidebarService_.moveVacation({
    requestId: data.requestId || "",
    personKey: data.personKey || data.fml,
    fml: data.fml,
    vacationNumber: Number(data.vacationNumber),
    startDate: data.newStartIso,
    days: days,
    sourceRow: data.sourceRow,
    sourceStartColumn: data.sourceStartColumn,
    comment:
      "Автоматично перенесено для виправлення проблеми: " +
      String(data.issueId || suggestionId || ""),
  });
  if (typeof SpreadsheetApp !== "undefined" && SpreadsheetApp.getActive) {
    const ss = SpreadsheetApp.getActive();
    if (ss && typeof ss.toast === "function") {
      ss.toast(
        "Відпустку " +
          data.fml +
          " перенесено на " +
          (data.newStart || data.newStartIso),
        "WASB",
        5,
      );
    }
  }
  return result;
}

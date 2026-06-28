/**
 * VacationBulkFix.gs — coordinated bulk fix plan for vacation audit problems.
 */

const VacationBulkFix_ = (function () {
  const BULK_FIXABLE_RULES = Object.freeze([
    "MAX_CONCURRENT",
    "PERSON_GAP",
    "PERSON_OVERLAP",
    "START_GAP",
    "MONTH_BALANCE",
    "HIGH_LOAD_PERIOD",
  ]);
  const RULE_ALIASES = {
    GAP_TOO_SHORT: "PERSON_GAP",
    START_TOO_CLOSE: "START_GAP",
    YEAR_LIMIT: "MAX_PERSON_YEAR",
  };

  function _trim_(value) {
    return String(value == null ? "" : value)
      .replace(/\s+/g, " ")
      .trim();
  }

  function _ruleKey_(issue) {
    const raw = String((issue && (issue.rule || issue.type)) || "").trim();
    return RULE_ALIASES[raw] || raw;
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

  function _parseIsoDate_(iso) {
    if (!iso) return null;
    const match = String(iso).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    return new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      12,
      0,
      0,
      0,
    );
  }

  function _typeCode_(vacation) {
    const text = String(
      (vacation &&
        (vacation.vacationType ||
          vacation.type ||
          vacation.vacationNo ||
          vacation.vacationNumber)) ||
        "",
    )
      .trim()
      .toLowerCase();
    if (text === "вд" || text.indexOf("додаткова") !== -1) return "ВД";
    if (text === "со" || text.indexOf("сімейн") !== -1) return "СО";
    return Number(vacation && vacation.vacationNumber) === 2 ? "В2" : "В1";
  }

  function _problemKey_(problem) {
    return (
      _ruleKey_(problem) +
      "|" +
      String((problem && problem.date) || "") +
      "|" +
      _trim_(problem && problem.fml).slice(0, 160)
    );
  }

  function _moveSlotKey_(move) {
    return (
      _trim_(move.fml || move.personName).toUpperCase() +
      "|" +
      String(Number(move.vacationNumber) || 0) +
      "|" +
      String(move.oldStartIso || "")
    );
  }

  function _sourceFingerprint_() {
    return readVacationSource_()
      .map(function (row) {
        return [
          row.row,
          _trim_(row.fml),
          _dateKey_(row.startDate),
          _dateKey_(row.endDate),
          _trim_(row.vacationNo),
          _trim_(row.intervalCheck),
        ].join(":");
      })
      .join("\n");
  }

  function _cloneVacations_(vacations) {
    return (Array.isArray(vacations) ? vacations : []).map(function (item) {
      return Object.assign({}, item, {
        startDate:
          item.startDate instanceof Date
            ? new Date(item.startDate.getTime())
            : item.startDate,
        endDate:
          item.endDate instanceof Date
            ? new Date(item.endDate.getTime())
            : item.endDate,
      });
    });
  }

  function _applyMoveToVacations_(vacations, move) {
    const fmlKey = _trim_(move.fml || move.personName).toUpperCase();
    const vacationNumber = Number(move.vacationNumber) || 0;
    const oldStartIso = String(move.oldStartIso || "");
    const newStart = _parseIsoDate_(move.newStartIso);
    const newEnd = _parseIsoDate_(move.newEndIso);
    if (!fmlKey || !oldStartIso || !newStart || !newEnd) return vacations;

    return vacations.map(function (item) {
      if (
        _trim_(item.fml).toUpperCase() === fmlKey &&
        Number(item.vacationNumber) === vacationNumber &&
        _dateKey_(item.startDate) === oldStartIso
      ) {
        return Object.assign({}, item, {
          startDate: newStart,
          endDate: newEnd,
          startDateRaw: newStart,
          endDateRaw: newEnd,
        });
      }
      return item;
    });
  }

  function _applyMovesToVacations_(vacations, moves) {
    return (Array.isArray(moves) ? moves : []).reduce(function (list, move) {
      return _applyMoveToVacations_(list, move);
    }, vacations);
  }

  function _scheduleProblems_(vacations) {
    const list = Array.isArray(vacations) ? vacations : [];
    const audit = VacationPlannerService_.buildScheduleAudit(list);
    return VacationOptionsWriter_.normalizeProblems(
      audit.checks || [],
      audit.schedule || [],
    );
  }

  function _isBulkFixable_(problem) {
    return BULK_FIXABLE_RULES.indexOf(_ruleKey_(problem)) !== -1;
  }

  function _countSeverity_(problems) {
    let errors = 0;
    let warnings = 0;
    (Array.isArray(problems) ? problems : []).forEach(function (item) {
      const severity = String((item && item.severity) || "ERROR").toUpperCase();
      if (severity === "WARNING" || severity === "WARN") warnings++;
      else errors++;
    });
    return { errors: errors, warnings: warnings };
  }

  function _remainingFixable_(beforeProblems, afterProblems) {
    const afterKeys = {};
    (Array.isArray(afterProblems) ? afterProblems : []).forEach(function (item) {
      afterKeys[_problemKey_(item)] = true;
    });
    return (Array.isArray(beforeProblems) ? beforeProblems : []).filter(
      function (item) {
        return _isBulkFixable_(item) && afterKeys[_problemKey_(item)] === true;
      },
    );
  }

  function _resolvedFixable_(beforeProblems, afterProblems) {
    const afterKeys = {};
    (Array.isArray(afterProblems) ? afterProblems : []).forEach(function (item) {
      afterKeys[_problemKey_(item)] = true;
    });
    return (Array.isArray(beforeProblems) ? beforeProblems : []).filter(
      function (item) {
        return _isBulkFixable_(item) && afterKeys[_problemKey_(item)] !== true;
      },
    );
  }

  function _formatMove_(suggestion, fixes) {
    const risks = Array.isArray(suggestion.risks) ? suggestion.risks.slice() : [];
    return {
      suggestionId: suggestion.suggestionId || "",
      fml: suggestion.personName || suggestion.fml || "",
      personKey: suggestion.personKey || suggestion.personName || suggestion.fml,
      requestId: suggestion.requestId || "",
      vacationNumber: Number(suggestion.vacationNumber) || 0,
      type: _typeCode_({
        vacationNumber: suggestion.vacationNumber,
        vacationNo: suggestion.vacationNumber === 2 ? "друга відпустка" : "перша відпустка",
      }),
      oldStartIso: suggestion.oldStartIso || "",
      oldEndIso: suggestion.oldEndIso || "",
      newStartIso: suggestion.newStartIso || "",
      newEndIso: suggestion.newEndIso || "",
      days: Number(suggestion.days) || 0,
      fixes: fixes || [],
      risks: risks,
      canAutoApply: suggestion.canAutoApply === true,
      sourceRow: suggestion.sourceRow,
      sourceStartColumn: suggestion.sourceStartColumn,
      oldStart: suggestion.oldStart || "",
      oldEnd: suggestion.oldEnd || "",
      newStart: suggestion.newStart || "",
      newEnd: suggestion.newEnd || "",
      title: suggestion.title || "",
    };
  }

  function buildVacationBulkFixPlan_(options) {
    const fingerprint = _sourceFingerprint_();
    const checkResult = VacationOptionsWriter_.checkVacationScheduleOnly();
    const allProblems = checkResult.checks || [];
    const initialFixable = allProblems.filter(_isBulkFixable_);
    const baseVacations = VacationsRepository_.listAll();
    const plannedMoves = [];
    const usedSlots = {};
    const maxIterations = Math.max(initialFixable.length * 4, 8);

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      const simulatedVacations = _applyMovesToVacations_(
        _cloneVacations_(baseVacations),
        plannedMoves,
      );
      const currentProblems = _scheduleProblems_(simulatedVacations);
      const fixableCurrent = currentProblems.filter(_isBulkFixable_);
      if (!fixableCurrent.length) break;

      let bestCandidate = null;
      fixableCurrent.forEach(function (problem) {
        (problem.fixSuggestions || []).forEach(function (suggestion) {
          if (!suggestion || suggestion.canAutoApply !== true) return;
          const slotKey = _moveSlotKey_({
            fml: suggestion.personName || suggestion.fml,
            vacationNumber: suggestion.vacationNumber,
            oldStartIso: suggestion.oldStartIso,
          });
          if (usedSlots[slotKey]) return;

          const candidateMove = _formatMove_(suggestion, [_ruleKey_(problem)]);
          const testVacations = _applyMoveToVacations_(
            simulatedVacations,
            candidateMove,
          );
          const testProblems = _scheduleProblems_(testVacations);
          const resolved = _resolvedFixable_(fixableCurrent, testProblems);
          if (!resolved.length) return;

          const resolvedRules = {};
          resolved.forEach(function (item) {
            resolvedRules[_ruleKey_(item)] = true;
          });
          const fixes = Object.keys(resolvedRules);
          const score =
            fixes.length * 100000 -
            (Number(suggestion.score) || 0) -
            plannedMoves.length;

          if (
            !bestCandidate ||
            score > bestCandidate.score ||
            (score === bestCandidate.score &&
              fixes.length > bestCandidate.fixes.length)
          ) {
            bestCandidate = {
              score: score,
              suggestion: suggestion,
              move: _formatMove_(suggestion, fixes),
              resolvedCount: resolved.length,
            };
          }
        });
      });

      if (!bestCandidate) break;
      plannedMoves.push(bestCandidate.move);
      usedSlots[_moveSlotKey_(bestCandidate.move)] = true;
    }

    const finalVacations = _applyMovesToVacations_(
      _cloneVacations_(baseVacations),
      plannedMoves,
    );
    const finalScheduleProblems = _scheduleProblems_(finalVacations);
    const finalProblemKeys = {};
    finalScheduleProblems.forEach(function (item) {
      finalProblemKeys[_problemKey_(item)] = true;
    });
    const remainingProblems = allProblems
      .filter(function (problem) {
        return finalProblemKeys[_problemKey_(problem)] === true;
      })
      .map(function (item) {
        return {
          type: _ruleKey_(item),
          fml: item.fml || "",
          date: item.date || "",
          description: item.description || item.details || "",
          severity: item.severity || "ERROR",
        };
      });
    const resolvedFixable = _resolvedFixable_(initialFixable, finalScheduleProblems);
    const remainingFixable = _remainingFixable_(initialFixable, finalScheduleProblems);

    const warnings = [];
    if (remainingFixable.length) {
      warnings.push(
        "Не всі проблеми можна вирішити автоматично. Потрібне ручне рішення.",
      );
    }

    return {
      success: true,
      sourceFingerprint: fingerprint,
      canApply:
        plannedMoves.length > 0 &&
        plannedMoves.every(function (move) {
          return move.canAutoApply === true;
        }),
      totalProblems: allProblems.length,
      resolvedProblems: resolvedFixable.length,
      unresolvedProblems: remainingProblems.length,
      fixableProblems: initialFixable.length,
      unresolvedFixableProblems: remainingFixable.length,
      moves: plannedMoves,
      remainingProblems: remainingProblems,
      warnings: warnings,
      summary: {
        errorCount: _countSeverity_(allProblems).errors,
        warningCount: _countSeverity_(allProblems).warnings,
        criticalRemaining: _countSeverity_(remainingProblems).errors,
      },
    };
  }

  function validateVacationBulkFixPlan_(plan) {
    const payload = plan || {};
    if (!payload.sourceFingerprint) {
      return {
        valid: false,
        code: "vacation.bulk_plan.invalid",
        message: "План не містить контрольну мітку даних.",
      };
    }
    if (_sourceFingerprint_() !== payload.sourceFingerprint) {
      return {
        valid: false,
        code: "vacation.bulk_plan.stale",
        message:
          "Дані відпусток змінилися. Оновіть план і спробуйте ще раз.",
      };
    }
    const moves = Array.isArray(payload.moves) ? payload.moves : [];
    if (!moves.length) {
      return {
        valid: false,
        code: "vacation.bulk_plan.empty",
        message: "План не містить перенесень для застосування.",
      };
    }

    const vacations = VacationsRepository_.listAll();
    let simulated = _cloneVacations_(vacations);
    for (let index = 0; index < moves.length; index++) {
      const move = moves[index];
      if (move.canAutoApply !== true) {
        return {
          valid: false,
          code: "vacation.bulk_plan.not_auto",
          message: "План містить перенесення без автозастосування.",
        };
      }
      const target = simulated.find(function (item) {
        return (
          _trim_(item.fml).toUpperCase() ===
            _trim_(move.fml).toUpperCase() &&
          Number(item.vacationNumber) === Number(move.vacationNumber) &&
          _dateKey_(item.startDate) === String(move.oldStartIso || "")
        );
      });
      if (!target) {
        return {
          valid: false,
          code: "vacation.bulk_plan.stale",
          message:
            "Дані відпусток змінилися. Оновіть план і спробуйте ще раз.",
        };
      }
      if (
        typeof VacationSuggestions_ === "object" &&
        VacationSuggestions_ &&
        typeof VacationSuggestions_.validateVacationCandidate_ === "function"
      ) {
        const context = VacationSuggestions_.buildSuggestionContext_(
          null,
          simulated,
        );
        const validation = VacationSuggestions_.validateVacationCandidate_(
          {
            target: target,
            newStart: _parseIsoDate_(move.newStartIso),
            newEnd: _parseIsoDate_(move.newEndIso),
            days: move.days,
            fixesError: true,
          },
          context,
        );
        if (!validation.ok || validation.hardErrors.length) {
          return {
            valid: false,
            code: "vacation.bulk_plan.invalid_move",
            message:
              validation.hardErrors[0] ||
              "План більше не відповідає правилам відпусток.",
          };
        }
      }
      simulated = _applyMoveToVacations_(simulated, move);
    }

    return { valid: true };
  }

  function applyVacationBulkFixPlan_(plan) {
    const validation = validateVacationBulkFixPlan_(plan);
    if (!validation.valid) {
      return Object.assign({ success: false }, validation);
    }
    if (typeof applyVacationSuggestion_ !== "function") {
      throw new Error("Модуль застосування пропозицій недоступний");
    }

    const moves = Array.isArray(plan && plan.moves) ? plan.moves : [];
    const applied = [];
    moves.forEach(function (move) {
      const result = applyVacationSuggestion_(move.suggestionId || "", move);
      applied.push({
        fml: move.fml,
        oldStartIso: move.oldStartIso,
        newStartIso: move.newStartIso,
        result: result,
      });
    });

    const afterCheck = VacationOptionsWriter_.checkVacationScheduleOnly();
    return {
      success: true,
      appliedCount: applied.length,
      applied: applied,
      problemSummary: afterCheck.problemSummary || null,
      checks: afterCheck.checks || [],
      errorCount: afterCheck.errorCount || 0,
      warningCount: afterCheck.warningCount || 0,
      problemCount: afterCheck.problemCount || 0,
      message: "Пакетне рішення застосовано.",
    };
  }

  return {
    buildVacationBulkFixPlan_: buildVacationBulkFixPlan_,
    validateVacationBulkFixPlan_: validateVacationBulkFixPlan_,
    applyVacationBulkFixPlan_: applyVacationBulkFixPlan_,
  };
})();

function buildVacationBulkFixPlanFromSidebar(formData) {
  return VacationBulkFix_.buildVacationBulkFixPlan_(formData || {});
}

function applyVacationBulkFixPlanFromSidebar(formData) {
  const plan =
    formData && formData.plan && typeof formData.plan === "object"
      ? formData.plan
      : formData || {};
  return VacationBulkFix_.applyVacationBulkFixPlan_(plan);
}

function buildVacationBulkFixPlan_(options) {
  return VacationBulkFix_.buildVacationBulkFixPlan_(options || {});
}

function validateVacationBulkFixPlan_(plan) {
  return VacationBulkFix_.validateVacationBulkFixPlan_(plan);
}

function applyVacationBulkFixPlan_(plan) {
  return VacationBulkFix_.applyVacationBulkFixPlan_(plan);
}

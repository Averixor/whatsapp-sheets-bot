/**
 * VacationSidebarService.gs — single vacation-management UI orchestration.
 */

const VacationSidebarService_ = (function () {
  function _spreadsheet_() {
    if (
      typeof DataAccess_ === "object" &&
      DataAccess_ &&
      typeof DataAccess_.getSpreadsheet === "function"
    ) {
      return DataAccess_.getSpreadsheet();
    }
    return getWasbSpreadsheet_();
  }

  function _assertWorkingAccess_(actionName) {
    if (
      typeof AccessEnforcement_ === "object" &&
      AccessEnforcement_ &&
      typeof AccessEnforcement_.assertCanUseWorkingActions === "function"
    ) {
      AccessEnforcement_.assertCanUseWorkingActions(actionName, {
        source: "vacationSidebar",
      });
    }
  }

  function _withDocumentLock_(callback) {
    const lock = LockService.getDocumentLock();
    lock.waitLock(30000);
    try {
      return callback();
    } finally {
      lock.releaseLock();
    }
  }

  function _timeZone_() {
    try {
      if (typeof getTimeZone_ === "function") return getTimeZone_();
    } catch (_) {}
    return Session.getScriptTimeZone();
  }

  function _isoDate_(value) {
    if (!(value instanceof Date) || isNaN(value.getTime())) return "";
    return Utilities.formatDate(value, _timeZone_(), "yyyy-MM-dd");
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

  function _typeVacationNumber_(type) {
    const code = String(type || "")
      .trim()
      .toUpperCase();
    if (code === "В1") return 1;
    if (code === "В2") return 2;
    return 0;
  }

  function _personnel_() {
    if (
      typeof PersonnelRepository_ !== "object" ||
      !PersonnelRepository_ ||
      typeof PersonnelRepository_.getActiveRows !== "function"
    ) {
      throw new Error("Довідник особового складу недоступний");
    }
    return PersonnelRepository_.getActiveRows()
      .filter(function (person) {
        return person && String(person.fml || "").trim();
      })
      .map(function (person) {
        return {
          id: String(person.callsign || person.id || person.fml || "").trim(),
          fml: String(person.fml || "").trim(),
          callsign: String(person.callsign || "").trim(),
          rank: String(person.rank || person.title || "").trim(),
          position: String(person.position || "").trim(),
        };
      })
      .sort(function (left, right) {
        const leftLabel = left.callsign || left.fml;
        const rightLabel = right.callsign || right.fml;
        return String(leftLabel).localeCompare(String(rightLabel), "uk");
      });
  }

  function _assertActivePerson_(fml) {
    if (
      typeof PersonnelRepository_ !== "object" ||
      !PersonnelRepository_ ||
      typeof PersonnelRepository_.getByFml !== "function"
    ) {
      throw new Error("Довідник особового складу недоступний");
    }
    const person = PersonnelRepository_.getByFml(fml, { activeOnly: true });
    if (!person) {
      throw new Error("Активну людину не знайдено в PERSONNEL");
    }
    return person;
  }

  function _vacations_() {
    return VacationsRepository_.listAll();
  }

  function _activeVacations_() {
    return _vacations_().filter(function (vacation) {
      return vacation && vacation.active === true;
    });
  }

  function _serializeVacation_(vacation) {
    return {
      requestId: String(vacation.requestId || vacation.id || "").trim(),
      personKey: String(vacation.personKey || "").trim(),
      fml: vacation.fml,
      status: String(vacation.status || "").trim(),
      vacationNumber: vacation.vacationNumber,
      type: _typeCode_(vacation),
      startDate: _isoDate_(vacation.startDate),
      endDate: _isoDate_(vacation.endDate),
      days:
        VacationPlannerService_.daysBetween(
          vacation.startDate,
          vacation.endDate,
        ) + 1,
      active: vacation.active === true,
      manageable: !vacation._meta || vacation._meta.writable !== false,
      block:
        (vacation._meta && vacation._meta.block) ||
        (Number(vacation.vacationNumber) === 2 ? "second" : "first"),
      sourceRow: (vacation._meta && vacation._meta.rowNumber) || 0,
      sourceStartColumn: (vacation._meta && vacation._meta.startColumn) || 0,
    };
  }

  function _serializeOption_(option) {
    const accepted = option.status !== "REJECTED";
    const compromise = option.status === "COMPROMISE";
    return {
      rank: Number(option.rank) || 0,
      personKey: String(option.personKey || "").trim(),
      fml: option.fml,
      vacationNumber: option.vacationNumber,
      type: Number(option.vacationNumber) === 2 ? "В2" : "В1",
      startDate: _isoDate_(option.startDate),
      endDate: _isoDate_(option.endDate),
      days: Number(option.days) || 0,
      score: Number(option.score) || 0,
      status: accepted ? option.status : "REJECTED",
      label: compromise
        ? "З попередженням"
        : accepted && Number(option.rank) === 1
          ? "Найкращий"
          : accepted && Number(option.rank) === 2
            ? "Допустимий"
            : accepted
              ? "Запасний"
              : "Відхилено",
      explanation: option.explanation || "",
    };
  }

  function _resolveAddSlot_(fml, type) {
    const fixed = _typeVacationNumber_(type);
    const occupied = {};
    _activeVacations_().forEach(function (vacation) {
      if (
        String(vacation.fml || "")
          .trim()
          .toUpperCase() ===
        String(fml || "")
          .trim()
          .toUpperCase()
      ) {
        occupied[Number(vacation.vacationNumber)] = true;
      }
    });
    if (fixed) {
      if (occupied[fixed]) {
        throw new Error(
          "Цей слот відпустки вже зайнятий. Використайте перенесення.",
        );
      }
      return fixed;
    }
    if (!occupied[1]) return 1;
    if (!occupied[2]) return 2;
    throw new Error("У людини вже заповнені обидва слоти відпусток");
  }

  function _optionFromForm_(formData, vacationNumber, type) {
    const source = formData || {};
    const startDate = source.startDate || source.desiredStart;
    const days = Number(source.days || source.durationDays || source.duration);
    const normalized = VacationPlannerService_.normalizeRequest({
      fml: source.fml,
      vacationNumber: vacationNumber,
      desiredStart: startDate,
      durationDays: days,
      searchWindow: 0,
    });
    return {
      requestId: String(source.requestId || "").trim(),
      personKey: String(source.personKey || "").trim(),
      fml: normalized.fml,
      vacationNumber: normalized.vacationNumber,
      vacationType: type || (vacationNumber === 2 ? "В2" : "В1"),
      startDate: normalized.desiredStart,
      endDate: VacationPlannerService_.calculateEndDate(
        normalized.desiredStart,
        normalized.durationDays,
      ),
      days: normalized.durationDays,
    };
  }

  function _validateAndWrite_(option) {
    const validation = VacationPlannerService_.validateVacationOption(
      option,
      _vacations_(),
    );
    if (!validation.isValid) {
      const blocking =
        validation.blockingViolations || validation.violations || [];
      throw new Error(
        blocking
          .map(function (violation) {
            return violation.message;
          })
          .join("; "),
      );
    }
    const write = VacationOptionsWriter_.writeVacationToSource(option);
    const rebuild = VacationOptionsWriter_.rebuildVacationSystem();
    return {
      vacation: _serializeVacation_(Object.assign({ active: true }, option)),
      write: write,
      rebuild: rebuild,
      warnings: (validation.warnings || []).map(function (warning) {
        return {
          rule: warning.rule,
          severity: warning.severity,
          message: warning.message,
        };
      }),
    };
  }

  function show() {
    _assertWorkingAccess_("showVacationSidebar");
    throw new Error(
      "Окремий sidebar відпусток вимкнено. Відкрийте WASB → Відкрити панель → 🏖️ Відпустки.",
    );
  }

  function _scheduleYearOptions_() {
    const current = new Date().getFullYear();
    return [current, current + 1, current + 2];
  }

  function getState() {
    _assertWorkingAccess_("getVacationSidebarState");
    const vacations = _activeVacations_().map(_serializeVacation_);
    const people = {};
    vacations.forEach(function (vacation) {
      people[String(vacation.fml || "").toUpperCase()] = true;
    });
    return {
      personnel: _personnel_(),
      vacations: vacations,
      stats: {
        total: vacations.length,
        activePeople: Object.keys(people).length,
      },
      scheduleYear: VacationOptionsWriter_.resolveScheduleYear({}),
      scheduleYearOptions: _scheduleYearOptions_(),
      problemSummary: VacationOptionsWriter_.summarizeVacationProblems(),
      rightPanelMigration: _rightPanelMigrationState_(),
    };
  }

  function findOptions(formData) {
    _assertWorkingAccess_("findVacationSidebarOptions");
    const person = _assertActivePerson_(formData && formData.fml);
    return VacationPlannerService_.suggestVacationOptions(
      Object.assign({}, formData, {
        fml: person.fml,
        personKey: person.callsign || person.fml,
      }),
      _vacations_(),
    ).map(_serializeOption_);
  }

  function addVacation(formData) {
    _assertWorkingAccess_("addVacationFromSidebar");
    return _withDocumentLock_(function () {
      const person = _assertActivePerson_(formData && formData.fml);
      const type = String((formData && formData.type) || "В1").toUpperCase();
      const vacationNumber = _resolveAddSlot_(person.fml, type);
      return _validateAndWrite_(
        _optionFromForm_(
          Object.assign({}, formData, {
            fml: person.fml,
            personKey: person.callsign || person.fml,
          }),
          vacationNumber,
          type,
        ),
      );
    });
  }

  function applyOption(optionData) {
    _assertWorkingAccess_("applyVacationOptionFromSidebar");
    return _withDocumentLock_(function () {
      const person = _assertActivePerson_(optionData && optionData.fml);
      const vacationNumber = Number(optionData && optionData.vacationNumber);
      return _validateAndWrite_(
        _optionFromForm_(
          Object.assign({}, optionData, {
            fml: person.fml,
            personKey: person.callsign || person.fml,
          }),
          vacationNumber,
          vacationNumber === 2 ? "В2" : "В1",
        ),
      );
    });
  }

  function moveVacation(formData) {
    _assertWorkingAccess_("moveVacationFromSidebar");
    return _withDocumentLock_(function () {
      const person = _assertActivePerson_(formData && formData.fml);
      const vacationNumber = Number(formData && formData.vacationNumber);
      const existing = _activeVacations_().filter(function (vacation) {
        const sourceRow = Number(formData && formData.sourceRow);
        const sourceStartColumn = Number(
          formData && formData.sourceStartColumn,
        );
        if (
          sourceRow &&
          sourceStartColumn &&
          vacation._meta &&
          Number(vacation._meta.rowNumber) === sourceRow &&
          Number(vacation._meta.startColumn) === sourceStartColumn
        ) {
          return true;
        }
        return (
          String(vacation.fml || "")
            .trim()
            .toUpperCase() ===
            String(person.fml || "")
              .trim()
              .toUpperCase() &&
          Number(vacation.vacationNumber) === vacationNumber
        );
      })[0];
      if (!existing) throw new Error("Відпустку для перенесення не знайдено");
      return _validateAndWrite_(
        _optionFromForm_(
          Object.assign({}, formData, {
            fml: person.fml,
            personKey: person.callsign || person.fml,
          }),
          vacationNumber,
          _typeCode_(existing),
        ),
      );
    });
  }

  function cancelVacation(formData) {
    _assertWorkingAccess_("cancelVacationFromSidebar");
    return _withDocumentLock_(function () {
      _assertActivePerson_(formData && formData.fml);
      const write = VacationOptionsWriter_.setVacationActive(
        formData.fml,
        Number(formData.vacationNumber),
        false,
        formData.type,
        formData,
      );
      return {
        write: write,
        rebuild: VacationOptionsWriter_.rebuildVacationSystem(),
      };
    });
  }

  function validateDate(formData) {
    _assertWorkingAccess_("validateVacationDateFromSidebar");
    const person = _assertActivePerson_(formData && formData.fml);
    const vacationNumber = Number(formData && formData.vacationNumber);
    const option = _optionFromForm_(
      Object.assign({}, formData, {
        fml: person.fml,
        personKey: person.callsign || person.fml,
      }),
      vacationNumber,
    );
    const validation = VacationPlannerService_.validateVacationOption(
      option,
      _vacations_(),
    );
    const checks = (validation.violations || []).map(function (item) {
      return {
        rule: item.rule,
        date: _isoDate_(option.startDate),
        fml: option.fml,
        details: item.message,
        severity: item.severity,
        vacationNumber: option.vacationNumber,
        startDate: option.startDate,
        endDate: option.endDate,
        days: option.days,
      };
    });
    return {
      isValid: validation.isValid,
      violations: VacationOptionsWriter_.normalizeProblems(checks, [option]),
    };
  }

  function rebuildSchedule(formData) {
    _assertWorkingAccess_("rebuildVacationScheduleFromSidebar");
    return _withDocumentLock_(function () {
      const year = Number(formData && formData.year);
      return VacationOptionsWriter_.rebuildVacationSystem(
        year >= 1900 && year <= 9999 ? { year: year } : {},
      );
    });
  }

  function checkViolations() {
    _assertWorkingAccess_("checkVacationRulesFromSidebar");
    return _withDocumentLock_(function () {
      return VacationOptionsWriter_.checkVacationScheduleOnly();
    });
  }

  function generateReport() {
    _assertWorkingAccess_("generateVacationReportFromSidebar");
    return VacationOptionsWriter_.generateVacationReport();
  }

  function openSchedule() {
    _assertWorkingAccess_("openVacationScheduleFromSidebar");
    const spreadsheet = _spreadsheet_();
    const sheet = spreadsheet.getSheetByName(
      VACATION_PLANNER_CONFIG.SHEETS.SCHEDULE,
    );
    if (!sheet) {
      throw new Error("Аркуш VACATION_SCHEDULE не знайдено");
    }
    spreadsheet.setActiveSheet(sheet);
    return { ok: true, sheetName: sheet.getName() };
  }

  function openUpdatedSchedule(formData) {
    _assertWorkingAccess_("openUpdatedVacationScheduleFromSidebar");
    return _withDocumentLock_(function () {
      const year = Number(formData && formData.year);
      const rebuild = VacationOptionsWriter_.rebuildVacationSystem(
        year >= 1900 && year <= 9999 ? { year: year } : {},
      );
      const opened = openSchedule();
      const scheduleYear =
        Number(rebuild && rebuild.scheduleYear) ||
        (year >= 1900 && year <= 9999 ? year : 0) ||
        VacationOptionsWriter_.resolveScheduleYear({});
      return {
        ok: true,
        year: scheduleYear,
        rebuild: rebuild,
        opened: opened,
        message:
          "Графік відпусток за " + scheduleYear + " рік оновлено і відкрито",
      };
    });
  }

  function applyFixSuggestion(formData) {
    _assertWorkingAccess_("applyVacationSuggestionFromSidebar");
    return _withDocumentLock_(function () {
      if (typeof applyVacationSuggestion_ !== "function") {
        throw new Error("Модуль пропозицій відпусток недоступний");
      }
      return applyVacationSuggestion_(
        String((formData && formData.suggestionId) || ""),
        formData || {},
      );
    });
  }

  function buildBulkFixPlan(formData) {
    _assertWorkingAccess_("buildVacationBulkFixPlanFromSidebar");
    return _withDocumentLock_(function () {
      if (
        typeof VacationBulkFix_ !== "object" ||
        !VacationBulkFix_ ||
        typeof VacationBulkFix_.buildVacationBulkFixPlan_ !== "function"
      ) {
        throw new Error("Модуль пакетного виправлення недоступний");
      }
      return VacationBulkFix_.buildVacationBulkFixPlan_(formData || {});
    });
  }

  function applyBulkFixPlan(formData) {
    _assertWorkingAccess_("applyVacationBulkFixPlanFromSidebar");
    return _withDocumentLock_(function () {
      if (
        typeof VacationBulkFix_ !== "object" ||
        !VacationBulkFix_ ||
        typeof VacationBulkFix_.applyVacationBulkFixPlan_ !== "function"
      ) {
        throw new Error("Модуль пакетного виправлення недоступний");
      }
      const plan =
        formData && formData.plan && typeof formData.plan === "object"
          ? formData.plan
          : formData || {};
      return VacationBulkFix_.applyVacationBulkFixPlan_(plan);
    });
  }

  function getMonthCalendar(formData) {
    _assertWorkingAccess_("getVacationMonthCalendarFromSidebar");
    if (
      typeof VacationMonthCalendar_ !== "object" ||
      !VacationMonthCalendar_ ||
      typeof VacationMonthCalendar_.getVacationMonthCalendar_ !== "function"
    ) {
      throw new Error("Модуль місячного календаря недоступний");
    }
    return VacationMonthCalendar_.getVacationMonthCalendar_(formData || {});
  }

  function getCalendarDayDetails(formData) {
    _assertWorkingAccess_("getVacationCalendarDayDetailsFromSidebar");
    if (
      typeof VacationMonthCalendar_ !== "object" ||
      !VacationMonthCalendar_ ||
      typeof VacationMonthCalendar_.getVacationCalendarDayDetails_ !==
        "function"
    ) {
      throw new Error("Деталі дня календаря недоступні");
    }
    return VacationMonthCalendar_.getVacationCalendarDayDetails_(
      formData || {},
    );
  }

  function applyRightPanelMigration() {
    _assertWorkingAccess_("applyRightPanelMigrationFromSidebar");
    return _withDocumentLock_(function () {
      if (typeof migrateRightVacationTableToMainSource_ !== "function") {
        throw new Error("Міграцію правої таблиці недоступно");
      }
      const migration = migrateRightVacationTableToMainSource_();
      let rebuild = null;
      if (Number(migration && migration.migrated) > 0) {
        rebuild = VacationOptionsWriter_.rebuildVacationSystem();
      }
      const vacations = _activeVacations_().map(_serializeVacation_);
      const people = {};
      vacations.forEach(function (vacation) {
        people[String(vacation.fml || "").toUpperCase()] = true;
      });
      return {
        migration: migration,
        rebuild: rebuild,
        vacations: vacations,
        stats: {
          total: vacations.length,
          activePeople: Object.keys(people).length,
        },
        rightPanelMigration: _rightPanelMigrationState_(),
        problemSummary: VacationOptionsWriter_.summarizeVacationProblems(),
      };
    });
  }

  function _rightPanelMigrationState_() {
    if (typeof VacationsRepository_.detectRightPanelManualData !== "function") {
      return { hasData: false, count: 0, fmlSummary: "", message: "" };
    }
    const panel = VacationsRepository_.detectRightPanelManualData();
    return {
      hasData: !!(panel && panel.hasData),
      count: panel && panel.count ? panel.count : 0,
      fmlSummary: (panel && panel.fmlSummary) || "",
      message: (panel && panel.message) || "",
    };
  }

  return {
    show: show,
    getState: getState,
    findOptions: findOptions,
    addVacation: addVacation,
    applyOption: applyOption,
    moveVacation: moveVacation,
    cancelVacation: cancelVacation,
    validateDate: validateDate,
    rebuildSchedule: rebuildSchedule,
    checkViolations: checkViolations,
    generateReport: generateReport,
    openSchedule: openSchedule,
    openUpdatedSchedule: openUpdatedSchedule,
    applyFixSuggestion: applyFixSuggestion,
    buildBulkFixPlan: buildBulkFixPlan,
    applyBulkFixPlan: applyBulkFixPlan,
    getMonthCalendar: getMonthCalendar,
    getCalendarDayDetails: getCalendarDayDetails,
    applyRightPanelMigration: applyRightPanelMigration,
  };
})();

function showVacationSidebar() {
  return VacationSidebarService_.show();
}

function rebuildVacationScheduleFromMenu() {
  return VacationSidebarService_.rebuildSchedule();
}

function checkVacationRulesFromMenu() {
  return VacationSidebarService_.checkViolations();
}

function getVacationSidebarState() {
  return VacationSidebarService_.getState();
}

function findVacationSidebarOptions(formData) {
  return VacationSidebarService_.findOptions(formData);
}

function addVacationFromSidebar(formData) {
  return VacationSidebarService_.addVacation(formData);
}

function applyVacationOptionFromSidebar(optionData) {
  return VacationSidebarService_.applyOption(optionData);
}

function moveVacationFromSidebar(formData) {
  return VacationSidebarService_.moveVacation(formData);
}

function cancelVacationFromSidebar(formData) {
  return VacationSidebarService_.cancelVacation(formData);
}

function validateVacationDateFromSidebar(formData) {
  return VacationSidebarService_.validateDate(formData);
}

function rebuildVacationScheduleFromSidebar(formData) {
  return VacationSidebarService_.rebuildSchedule(formData);
}

function checkVacationRulesFromSidebar() {
  return VacationSidebarService_.checkViolations();
}

function generateVacationReportFromSidebar() {
  return VacationSidebarService_.generateReport();
}

function openVacationScheduleFromSidebar() {
  return VacationSidebarService_.openSchedule();
}

function openUpdatedVacationScheduleFromSidebar(formData) {
  return VacationSidebarService_.openUpdatedSchedule(formData);
}

function applyVacationSuggestionFromSidebar(formData) {
  return VacationSidebarService_.applyFixSuggestion(formData);
}

function buildVacationBulkFixPlanFromSidebar(formData) {
  return VacationSidebarService_.buildBulkFixPlan(formData);
}

function applyVacationBulkFixPlanFromSidebar(formData) {
  return VacationSidebarService_.applyBulkFixPlan(formData);
}

function getVacationMonthCalendarFromSidebar(formData) {
  return VacationSidebarService_.getMonthCalendar(formData);
}

function getVacationCalendarDayDetailsFromSidebar(formData) {
  return VacationSidebarService_.getCalendarDayDetails(formData);
}

function applyRightPanelMigrationFromSidebar() {
  return VacationSidebarService_.applyRightPanelMigration();
}

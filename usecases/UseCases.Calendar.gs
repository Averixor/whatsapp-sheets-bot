/**
 * UseCases.Calendar.gs — calendar / person card / months list (PR7 domain split).
 */

var UseCasesCalendar_ = (function () {
  function openPersonCard(options, dateStr) {
    const payload =
      typeof options === "string"
        ? { callsign: options, date: dateStr || _todayStr_() }
        : Object.assign({}, options || {});
    return WorkflowOrchestrator_.run({
      scenario: "openPersonCard",
      payload: payload,
      write: false,
      lock: false,
      validate: function (input) {
        const info = validatePersonLookupPayload_(input);
        if (
          typeof AccessEnforcement_ === "object" &&
          AccessEnforcement_.assertCanOpenPersonCard
        ) {
          AccessEnforcement_.assertCanOpenPersonCard(
            info.payload.callsign || "",
            info.payload.dateStr || info.payload.date || "",
          );
        }
        return { payload: info.payload, warnings: [] };
      },
      execute: function (input) {
        const person = PersonsRepository_.getPersonByCallsign(
          input.callsign,
          input.dateStr || input.date,
        );
        return {
          success: true,
          message: "Картку бійця зібрано",
          result: person,
          changes: [],
          affectedSheets: [person.sheet],
          affectedEntities: [person.callsign || person.fml],
          appliedChangesCount: 0,
          skippedChangesCount: 0,
          warnings: person.phone ? [] : ["Для бійця не знайдено телефон"],
        };
      },
    });
  }

  function loadCalendarDay(options) {
    const payload =
      typeof options === "string"
        ? { date: options }
        : Object.assign({}, options || {});
    return WorkflowOrchestrator_.run({
      scenario: "loadCalendarDay",
      payload: payload,
      write: false,
      lock: false,
      validate: function (input) {
        const info = validateDatePayload_(input, "date");
        return { payload: info.payload, warnings: [] };
      },
      execute: function (input) {
        let descriptor = null;
        if (
          typeof AccessEnforcement_ === "object" &&
          AccessEnforcement_.assertCanViewSidebarPersonnel
        ) {
          descriptor =
            AccessEnforcement_.assertCanViewSidebarPersonnel("loadCalendarDay");
        }
        let sidebar = PersonsRepository_.getSidebarPersonnel(
          input.dateStr || input.date,
        );
        if (
          typeof AccessEnforcement_ === "object" &&
          AccessEnforcement_.applySidebarPersonnelAccessPolicy
        ) {
          sidebar = AccessEnforcement_.applySidebarPersonnelAccessPolicy(
            sidebar,
            descriptor,
          );
        }
        return {
          success: true,
          message: "Дані дня завантажено",
          result: sidebar,
          changes: [],
          affectedSheets: [sidebar.month],
          affectedEntities: [],
          appliedChangesCount: 0,
          skippedChangesCount: 0,
          partial: false,
        };
      },
    });
  }

  function listMonths(options) {
    const payload = Object.assign({}, options || {});
    return WorkflowOrchestrator_.run({
      scenario: "listMonths",
      payload: payload,
      write: false,
      lock: false,
      execute: function () {
        const ss = getWasbSpreadsheet_();
        const months = ss
          .getSheets()
          .map(function (sheet) {
            return sheet.getName();
          })
          .filter(function (name) {
            return /^\d{2}$/.test(name);
          })
          .sort();
        const current = getBotMonthSheetName_();
        return {
          success: true,
          message: "Місяці завантажено",
          result: {
            months: months,
            current: current,
          },
          changes: [],
          affectedSheets: months,
          affectedEntities: [],
          appliedChangesCount: 0,
          skippedChangesCount: 0,
          partial: false,
        };
      },
    });
  }

  return {
    openPersonCard: openPersonCard,
    loadCalendarDay: loadCalendarDay,
    listMonths: listMonths,
  };
})();

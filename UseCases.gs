/**

 * UseCases.gs — Stage7UseCases_ thin facade (PR7 domain split).

 * Domains: UseCases.PanelHelpers.gs, UseCases.SendPanel.gs, UseCases.Summaries.gs,

 * UseCases.Calendar.gs, UseCases.Maintenance.gs, UseCases.MonthOps.gs

 *

 * Delegates at call time (not init) so domain IIFEs load first in GAS file order.

 */

var Stage7UseCases_ = (function () {
  return {
    generateSendPanelForDate: function () {
      return UseCasesSendPanel_.generateSendPanelForDate.apply(null, arguments);
    },

    generateSendPanelForRange: function () {
      return UseCasesSendPanel_.generateSendPanelForRange.apply(
        null,
        arguments,
      );
    },

    markPanelRowsAsPending: function () {
      return UseCasesSendPanel_.markPanelRowsAsPending.apply(null, arguments);
    },

    markPanelRowsAsSent: function () {
      return UseCasesSendPanel_.markPanelRowsAsSent.apply(null, arguments);
    },

    markPanelRowsAsUnsent: function () {
      return UseCasesSendPanel_.markPanelRowsAsUnsent.apply(null, arguments);
    },

    sendPendingRows: function () {
      return UseCasesSendPanel_.sendPendingRows.apply(null, arguments);
    },

    getSendPanelData: function () {
      return UseCasesSendPanel_.getSendPanelData.apply(null, arguments);
    },

    listMonths: function () {
      return UseCasesCalendar_.listMonths.apply(null, arguments);
    },

    buildDaySummary: function () {
      return UseCasesSummaries_.buildDaySummary.apply(null, arguments);
    },

    buildDetailedSummary: function () {
      return UseCasesSummaries_.buildDetailedSummary.apply(null, arguments);
    },

    openPersonCard: function () {
      return UseCasesCalendar_.openPersonCard.apply(null, arguments);
    },

    loadCalendarDay: function () {
      return UseCasesCalendar_.loadCalendarDay.apply(null, arguments);
    },

    checkVacationsAndBirthdays: function () {
      return UseCasesMaintenance_.checkVacationsAndBirthdays.apply(
        null,
        arguments,
      );
    },

    switchBotToMonth: function () {
      return UseCasesMonthOps_.switchBotToMonth.apply(null, arguments);
    },

    createNextMonth: function () {
      return UseCasesMonthOps_.createNextMonth.apply(null, arguments);
    },

    runReconciliation: function () {
      return UseCasesMaintenance_.runReconciliation.apply(null, arguments);
    },

    runMaintenanceScenario: function () {
      return UseCasesMaintenance_.runMaintenanceScenario.apply(null, arguments);
    },
  };
})();

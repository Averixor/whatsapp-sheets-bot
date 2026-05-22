/**
 * UseCases.gs — Stage7UseCases_ thin facade (PR7 domain split).
 * Domains: UseCases.PanelHelpers.gs, UseCases.SendPanel.gs, UseCases.Summaries.gs,
 * UseCases.Calendar.gs, UseCases.Maintenance.gs, UseCases.MonthOps.gs
 */

var Stage7UseCases_ = (function () {
  return {
    generateSendPanelForDate: UseCasesSendPanel_.generateSendPanelForDate,
    generateSendPanelForRange: UseCasesSendPanel_.generateSendPanelForRange,
    markPanelRowsAsPending: UseCasesSendPanel_.markPanelRowsAsPending,
    markPanelRowsAsSent: UseCasesSendPanel_.markPanelRowsAsSent,
    markPanelRowsAsUnsent: UseCasesSendPanel_.markPanelRowsAsUnsent,
    sendPendingRows: UseCasesSendPanel_.sendPendingRows,
    getSendPanelData: UseCasesSendPanel_.getSendPanelData,
    listMonths: UseCasesCalendar_.listMonths,
    buildDaySummary: UseCasesSummaries_.buildDaySummary,
    buildDetailedSummary: UseCasesSummaries_.buildDetailedSummary,
    openPersonCard: UseCasesCalendar_.openPersonCard,
    loadCalendarDay: UseCasesCalendar_.loadCalendarDay,
    checkVacationsAndBirthdays: UseCasesMaintenance_.checkVacationsAndBirthdays,
    switchBotToMonth: UseCasesMonthOps_.switchBotToMonth,
    createNextMonth: UseCasesMonthOps_.createNextMonth,
    runReconciliation: UseCasesMaintenance_.runReconciliation,
    runMaintenanceScenario: UseCasesMaintenance_.runMaintenanceScenario,
  };
})();

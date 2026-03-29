/**
 * Stage7ServerApi.gs — stable sidebar / operational application API retained in the final baseline.
 *
 * В этом файле живут только прикладные сценарии.
 * Maintenance / admin / diagnostics routes live in Stage7MaintenanceApi.gs; Stage7MaintenanceApi.gs remains compatibility-only.
 */

function apiStage4GetMonthsList() {
  return Stage7UseCases_.listMonths({});
}

function apiStage4GetSidebarData(dateStr) {
  return Stage7UseCases_.loadCalendarDay({ date: dateStr || _todayStr_() });
}

function apiStage4GetSendPanelData() {
  return Stage7UseCases_.getSendPanelData({});
}

function apiStage4SwitchBotToMonth(monthSheetName) {
  return Stage7UseCases_.switchBotToMonth({ month: monthSheetName || '' });
}

function apiGenerateSendPanelForDate(options) {
  return Stage7UseCases_.generateSendPanelForDate(options || {});
}

function apiGenerateSendPanelForRange(options) {
  return Stage7UseCases_.generateSendPanelForRange(options || {});
}

function apiMarkPanelRowsAsPending(rowNumbers, options) {
  return Stage7UseCases_.markPanelRowsAsPending(rowNumbers, options || {});
}

function apiMarkPanelRowsAsSent(rowNumbers, options) {
  return Stage7UseCases_.markPanelRowsAsSent(rowNumbers, options || {});
}

function apiMarkPanelRowsAsUnsent(rowNumbers, options) {
  return Stage7UseCases_.markPanelRowsAsUnsent(rowNumbers, options || {});
}

function apiSendPendingRows(options) {
  return Stage7UseCases_.sendPendingRows(options || {});
}

function apiBuildDaySummary(dateStr) {
  return Stage7UseCases_.buildDaySummary({ date: dateStr || _todayStr_() });
}

function apiBuildDetailedSummary(dateStr) {
  return Stage7UseCases_.buildDetailedSummary({ date: dateStr || _todayStr_() });
}

function apiOpenPersonCard(callsign, dateStr) {
  return Stage7UseCases_.openPersonCard({
    callsign: callsign || '',
    date: dateStr || _todayStr_()
  });
}

function apiLoadCalendarDay(dateStr) {
  return Stage7UseCases_.loadCalendarDay({ date: dateStr || _todayStr_() });
}

function apiCheckVacationsAndBirthdays(dateStr) {
  return Stage7UseCases_.checkVacationsAndBirthdays({ date: dateStr || _todayStr_() });
}

function apiCreateNextMonthStage4(options) {
  return Stage7UseCases_.createNextMonth(options || {});
}

function apiRunReconciliation(options) {
  return Stage7UseCases_.runReconciliation(options || {});
}
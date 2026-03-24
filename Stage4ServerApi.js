/**
 * Stage4ServerApi.gs — stable sidebar / operational application API retained in the final baseline.
 *
 * В этом файле живут только прикладные сценарии.
 * Maintenance / admin / diagnostics routes live in Stage5MaintenanceApi.gs; Stage4MaintenanceApi.gs remains compatibility-only.
 */

function apiStage4GetMonthsList() {
  return Stage4UseCases_.listMonths({});
}

function apiStage4GetSidebarData(dateStr) {
  return Stage4UseCases_.loadCalendarDay({ date: dateStr || _todayStr_() });
}

function apiStage4GetSendPanelData() {
  return Stage4UseCases_.getSendPanelData({});
}

function apiStage4SwitchBotToMonth(monthSheetName) {
  return Stage4UseCases_.switchBotToMonth({ month: monthSheetName || '' });
}

function apiGenerateSendPanelForDate(options) {
  return Stage4UseCases_.generateSendPanelForDate(options || {});
}

function apiGenerateSendPanelForRange(options) {
  return Stage4UseCases_.generateSendPanelForRange(options || {});
}

function apiMarkPanelRowsAsPending(rowNumbers, options) {
  return Stage4UseCases_.markPanelRowsAsPending(rowNumbers, options || {});
}

function apiMarkPanelRowsAsSent(rowNumbers, options) {
  return Stage4UseCases_.markPanelRowsAsSent(rowNumbers, options || {});
}

function apiMarkPanelRowsAsUnsent(rowNumbers, options) {
  return Stage4UseCases_.markPanelRowsAsUnsent(rowNumbers, options || {});
}

function apiSendPendingRows(options) {
  return Stage4UseCases_.sendPendingRows(options || {});
}

function apiBuildDaySummary(dateStr) {
  return Stage4UseCases_.buildDaySummary({ date: dateStr || _todayStr_() });
}

function apiBuildDetailedSummary(dateStr) {
  return Stage4UseCases_.buildDetailedSummary({ date: dateStr || _todayStr_() });
}

function apiOpenPersonCard(callsign, dateStr) {
  return Stage4UseCases_.openPersonCard({
    callsign: callsign || '',
    date: dateStr || _todayStr_()
  });
}

function apiLoadCalendarDay(dateStr) {
  return Stage4UseCases_.loadCalendarDay({ date: dateStr || _todayStr_() });
}

function apiCheckVacationsAndBirthdays(dateStr) {
  return Stage4UseCases_.checkVacationsAndBirthdays({ date: dateStr || _todayStr_() });
}

function apiCreateNextMonthStage4(options) {
  return Stage4UseCases_.createNextMonth(options || {});
}

function apiRunReconciliation(options) {
  return Stage4UseCases_.runReconciliation(options || {});
}
/**
 * Stage7ServerApi.gs — canonical Stage 7 application API.
 *
 * Stage 7 is the only canonical application surface in this baseline.
 * Historical Stage 4 aliases live in Stage7CompatibilityApi.gs.
 */

function apiStage7GetMonthsList() {
  return Stage7UseCases_.listMonths({});
}

function apiStage7GetSidebarData(dateStr) {
  return Stage7UseCases_.loadCalendarDay({ date: dateStr || _todayStr_() });
}

function apiStage7GetSendPanelData() {
  return Stage7UseCases_.getSendPanelData({});
}

function apiStage7SwitchBotToMonth(monthSheetName) {
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

function apiStage7CreateNextMonth(options) {
  return Stage7UseCases_.createNextMonth(options || {});
}

function apiRunReconciliation(options) {
  return Stage7UseCases_.runReconciliation(options || {});
}

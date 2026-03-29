/**
 * Stage7CompatibilityApi.gs — historical application aliases.
 *
 * These wrappers preserve old Stage 4 / pre-canonical public entrypoints while routing
 * everything into the canonical Stage 7 application API.
 */

function apiStage4GetMonthsList() {
  return apiStage7GetMonthsList();
}

function apiStage4GetSidebarData(dateStr) {
  return apiStage7GetSidebarData(dateStr || _todayStr_());
}

function apiStage4GetSendPanelData() {
  return apiStage7GetSendPanelData();
}

function apiStage4SwitchBotToMonth(monthSheetName) {
  return apiStage7SwitchBotToMonth(monthSheetName || '');
}

function apiCreateNextMonthStage4(options) {
  return apiStage7CreateNextMonth(options || {});
}

function apiGetMonthsList() {
  return apiStage7GetMonthsList();
}

function apiGetSidebarData(dateStr) {
  return apiStage7GetSidebarData(dateStr || _todayStr_());
}

function apiGenerateSendPanel(options) {
  return apiGenerateSendPanelForDate(options || {});
}

function apiGetSendPanelData() {
  return apiStage7GetSendPanelData();
}

function apiMarkSendPanelRowsAsSent(rowNumbers, options) {
  return apiMarkPanelRowsAsSent(rowNumbers, options || {});
}

function apiGetDaySummary(dateStr) {
  return apiBuildDaySummary(dateStr || _todayStr_());
}

function apiGetDetailedDaySummary(dateStr) {
  return apiBuildDetailedSummary(dateStr || _todayStr_());
}

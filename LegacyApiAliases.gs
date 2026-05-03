/**
 * LegacyApiAliases.gs — canonical compatibility aliases for the Stage 7 baseline.
 *
 * This file intentionally centralizes:
 * 1) historical Stage 4 application aliases;
 * 2) legacy non-staged application aliases;
 * 3) thin helper shims still referenced by diagnostics/tests.
 *
 * Goal: keep exactly one compatibility surface for application routes,
 * without duplicating the same public function names across multiple files.
 */

// -----------------------------------------------------------------------------
// Historical Stage 4 application aliases -> canonical Stage 7 application API
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// Legacy non-staged application aliases
// -----------------------------------------------------------------------------

function apiGetMonthsList() {
  return apiStage7GetMonthsList();
}

function apiGetSidebarData(dateStr) {
  return apiStage7GetSidebarData(dateStr || '');
}

function apiGenerateSendPanel(options) {
  return apiGenerateSendPanelForDate(options || {});
}

function apiGetSendPanelData() {
  return apiStage7GetSendPanelData();
}

function apiMarkSendPanelRowsAsSent(rowNumbers, options) {
  return apiMarkPanelRowsAsSent(rowNumbers || [], options || {});
}

function apiGetDaySummary(dateStr) {
  return apiBuildDaySummary(dateStr || '');
}

function apiGetDetailedDaySummary(dateStr) {
  return apiBuildDetailedSummary(dateStr || '');
}

function apiCheckVacations(dateStr) {
  return apiCheckVacationsAndBirthdays(dateStr || '');
}

function apiGetBirthdays(dateStr) {
  return apiCheckVacationsAndBirthdays(dateStr || '');
}

function apiBuildBirthdayLink(phone, name) {
  return apiStage7BuildBirthdayLink(phone || '', name || '');
}

function apiGetPersonCardData(callsign, dateStr) {
  return apiOpenPersonCard(callsign || '', dateStr || '');
}

function apiSwitchBotToMonth(monthSheetName) {
  return apiStage7SwitchBotToMonth(monthSheetName || '');
}

function apiCreateNextMonth(options) {
  return apiStage7CreateNextMonth(options || {});
}

// -----------------------------------------------------------------------------
// Thin helper shim retained for historical tests/diagnostics
// -----------------------------------------------------------------------------

function _pickTestCallsign() {
  return _pickTestCallsign_();
}

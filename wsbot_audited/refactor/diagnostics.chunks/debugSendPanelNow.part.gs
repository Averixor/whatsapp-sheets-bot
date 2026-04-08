function debugSendPanelNow() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(CONFIG.SEND_PANEL_SHEET);

  const out = {
    botMonth: getBotMonthSheetName_(),
    panelSheetExists: !!sh,
    panelLastRow: sh ? sh.getLastRow() : 0,
    rawRowsCount: 0
  };

  if (sh && sh.getLastRow() >= CONFIG.SEND_PANEL_DATA_START_ROW) {
    const count = sh.getLastRow() - (CONFIG.SEND_PANEL_DATA_START_ROW - 1);
    const raw = sh.getRange(CONFIG.SEND_PANEL_DATA_START_ROW, 1, count, 7).getDisplayValues();
    out.rawRowsCount = raw.length;
  }

  let apiRowsCount = 0;
  let apiMonth = '';
  let apiError = '';

  try {
    const response = apiStage7GetSendPanelData();
    const result = (response && response.data && response.data.result) ? response.data.result : {};
    apiRowsCount = Array.isArray(result.rows) ? result.rows.length : 0;
    apiMonth = result.month || '';
    apiError = response && response.error ? response.error : '';
  } catch (e) {
    apiError = e && e.message ? e.message : String(e);
  }

  SpreadsheetApp.getUi().alert(
    'botMonth: ' + out.botMonth + '\n' +
    'panelSheetExists: ' + out.panelSheetExists + '\n' +
    'panelLastRow: ' + out.panelLastRow + '\n' +
    'rawRowsCount: ' + out.rawRowsCount + '\n' +
    'apiRowsCount: ' + apiRowsCount + '\n' +
    'apiMonth: ' + apiMonth + '\n' +
    'apiError: ' + (apiError || '—')
  );
}

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
function debugSendPanelBridge_() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(CONFIG.SEND_PANEL_SHEET);

  const out = {
    botMonth: getBotMonthSheetName_(),
    panelSheetExists: !!sh,
    panelLastRow: sh ? sh.getLastRow() : 0,
    rawRowsCount: 0,
    rawSample: [],
    repoRowsCount: 0,
    repoSample: [],
    apiSuccess: false,
    apiRowsCount: 0,
    apiMonth: '',
    apiDate: '',
    apiError: ''
  };

  if (sh && sh.getLastRow() >= CONFIG.SEND_PANEL_DATA_START_ROW) {
    const count = sh.getLastRow() - (CONFIG.SEND_PANEL_DATA_START_ROW - 1);
    const raw = sh.getRange(CONFIG.SEND_PANEL_DATA_START_ROW, 1, count, 7).getDisplayValues();
    out.rawRowsCount = raw.length;
    out.rawSample = raw.slice(0, 5);
  }

  try {
    const repoRows = SendPanelRepository_.readRows();
    out.repoRowsCount = repoRows.length;
    out.repoSample = repoRows.slice(0, 5);
  } catch (e) {
    out.repoError = e && e.message ? e.message : String(e);
  }

  try {
    const apiResponse = apiStage7GetSendPanelData();
    out.apiSuccess = !!apiResponse?.success;
    out.apiRowsCount = Array.isArray(apiResponse?.data?.result?.rows)
      ? apiResponse.data.result.rows.length
      : 0;
    out.apiMonth = apiResponse?.data?.result?.month || '';
    out.apiDate = apiResponse?.data?.result?.date || '';
    out.apiError = apiResponse?.error || '';
  } catch (e) {
    out.apiError = e && e.message ? e.message : String(e);
  }

  Logger.log(JSON.stringify(out, null, 2));
  SpreadsheetApp.getUi().alert(
    'DEBUG SEND_PANEL\\n' +
    'botMonth: ' + out.botMonth + '\\n' +
    'sheetExists: ' + out.panelSheetExists + '\\n' +
    'panelLastRow: ' + out.panelLastRow + '\\n' +
    'rawRowsCount: ' + out.rawRowsCount + '\\n' +
    'repoRowsCount: ' + out.repoRowsCount + '\\n' +
    'apiRowsCount: ' + out.apiRowsCount + '\\n' +
    'apiMonth: ' + out.apiMonth + '\\n' +
    'apiError: ' + (out.apiError || '—')
  );
}

function debugAccess() {
  Logger.log(JSON.stringify(AccessControl_.describe(), null, 2));
}

function debugSpreadsheetAccess_() {
  var id = '1v8ixM67nG_Bfy5NzcDZbmSjwVOYbkN02ibfP6YqI384';
  var ss = SpreadsheetApp.openById(id);
  Logger.log(ss.getName());
}


function debugWhoAmI_() {
  var result = {
    activeUser: '',
    effectiveUser: '',
    scriptTimeZone: '',
    openByIdOk: false,
    spreadsheetName: '',
    spreadsheetId: '1v8ixM67nG_Bfy5NzcDZbmSjwVOYbkN02ibfP6YqI384',
    error: ''
  };

  try {
    result.activeUser = Session.getActiveUser().getEmail();
  } catch (e1) {
    result.activeUser = 'ERROR: ' + e1.message;
  }

  try {
    result.effectiveUser = Session.getEffectiveUser().getEmail();
  } catch (e2) {
    result.effectiveUser = 'ERROR: ' + e2.message;
  }

  try {
    result.scriptTimeZone = Session.getScriptTimeZone();
  } catch (e3) {
    result.scriptTimeZone = 'ERROR: ' + e3.message;
  }

  try {
    var ss = SpreadsheetApp.openById(result.spreadsheetId);
    result.openByIdOk = true;
    result.spreadsheetName = ss.getName();
  } catch (e4) {
    result.openByIdOk = false;
    result.error = e4 && e4.message ? e4.message : String(e4);
  }

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

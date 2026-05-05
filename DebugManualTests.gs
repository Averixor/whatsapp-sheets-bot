function debugOpenPersonCardShahtar_() {
  return apiOpenPersonCard('ШАХТАР', '28.04.2026');
}

function debugOpenPersonCardGraf_() {
  return apiOpenPersonCard('ГРАФ', '28.04.2026');
}

function runStage6ADomainTestsManual() {
  var result = runStage6ADomainTests_({ dryRun: true });
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function debugFindPhoneContractManual() {
  var index = {
    byFml: { 'Петренко Іван Іванович': '+380661111111' },
    byNorm: { 'петренко іван іванович': '+380661111111' },
    byRole: { 'ГРАФ': '+380662222222' },
    byCallsign: { 'РОЛАНД': '+380663333333' },
    items: []
  };

  var result = {
    byFml: findPhone_({ fml: 'Петренко Іван Іванович' }, { index: index }),
    byRole: findPhone_({ role: 'ГРАФ' }, { index: index }),
    byCallsign: findPhone_({ callsign: 'роланд' }, { index: index })
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}


function debugDataAccessContractManual() {
  var out = {
    dataAccessType: typeof DataAccess_,
    keys: typeof DataAccess_ === 'object' && DataAccess_ ? Object.keys(DataAccess_) : [],
    hasGetSheet: typeof DataAccess_ !== 'undefined' && DataAccess_ && typeof DataAccess_.getSheet,
    hasReadRows: typeof DataAccess_ !== 'undefined' && DataAccess_ && typeof DataAccess_.readRows,
    hasReadObjects: typeof DataAccess_ !== 'undefined' && DataAccess_ && typeof DataAccess_.readObjects,
    hasAppendObjects: typeof DataAccess_ !== 'undefined' && DataAccess_ && typeof DataAccess_.appendObjects
  };

  Logger.log(JSON.stringify(out, null, 2));
  return out;
}


function debugDataAccessContractManual() {
  var out = {
    dataAccessType: typeof DataAccess_,
    keys: typeof DataAccess_ === 'object' && DataAccess_ ? Object.keys(DataAccess_) : [],
    hasGetSheet: typeof DataAccess_ !== 'undefined' && DataAccess_ && typeof DataAccess_.getSheet,
    hasReadRows: typeof DataAccess_ !== 'undefined' && DataAccess_ && typeof DataAccess_.readRows,
    hasReadObjects: typeof DataAccess_ !== 'undefined' && DataAccess_ && typeof DataAccess_.readObjects,
    hasAppendObjects: typeof DataAccess_ !== 'undefined' && DataAccess_ && typeof DataAccess_.appendObjects
  };

  Logger.log(JSON.stringify(out, null, 2));
  return out;
}


function debugSendPanelBlockedRowsManual() {
  var rows = SendPanelRepository_.readRows();
  var blocked = rows.filter(function(item) {
    return normalizeSendPanelStatus_(item.status) !== SendPanelConstants_.STATUS_READY;
  });

  var out = blocked.map(function(item) {
    return {
      row: item.row,
      fml: item.fml,
      phone: item.phone,
      code: item.code,
      tasks: item.tasks,
      status: item.status,
      sent: item.sent,
      hasLink: !!item.link
    };
  });

  Logger.log(JSON.stringify({
    total: rows.length,
    blocked: out.length,
    rows: out
  }, null, 2));

  return out;
}


function debugSendPanelSheetStateManual() {
  var ss = getWasbSpreadsheet_();
  var sheetName = (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.SEND_PANEL_SHEET)
    ? CONFIG.SEND_PANEL_SHEET
    : 'SEND_PANEL';

  var sh = ss.getSheetByName(sheetName);
  var schema = SheetSchemas_.get('SEND_PANEL');

  var out = {
    spreadsheetName: ss.getName(),
    spreadsheetId: ss.getId(),
    sheetName: sheetName,
    sheetExists: !!sh,
    schemaName: schema.name,
    schemaDataStartRow: schema.dataStartRow,
    schemaHeaderRow: schema.headerRow,
    lastRow: sh ? sh.getLastRow() : 0,
    lastColumn: sh ? sh.getLastColumn() : 0,
    rawPreview: [],
    repositoryRowsCount: 0,
    repositoryRows: []
  };

  if (sh) {
    var maxRows = Math.min(Math.max(sh.getLastRow(), 1), 20);
    var maxCols = Math.min(Math.max(sh.getLastColumn(), 1), 10);
    out.rawPreview = sh.getRange(1, 1, maxRows, maxCols).getDisplayValues();
  }

  try {
    var rows = SendPanelRepository_.readRows();
    out.repositoryRowsCount = rows.length;
    out.repositoryRows = rows.slice(0, 10);
  } catch (e) {
    out.repositoryReadError = e && e.message ? e.message : String(e);
  }

  Logger.log(JSON.stringify(out, null, 2));
  return out;
}

function debugSendPanelPreviewForDateManual() {
  var dateStr = '30.04.2026';
  var out = SendPanelRepository_.preview(dateStr);

  Logger.log(JSON.stringify({
    date: out.date,
    month: out.month,
    rowsCount: out.rows ? out.rows.length : 0,
    stats: out.stats,
    firstRows: (out.rows || []).slice(0, 10)
  }, null, 2));

  return out;
}


function debugSendPanelBuildRawForDateManual() {
  var dateStr = '30.04.2026';

  var ctx = PersonsRepository_.getDateContext(dateStr);
  var source = ctx.sheet;
  var ref = source.getRange(CONFIG.CODE_RANGE_A1);
  var start = ref.getRow();
  var num = ref.getNumRows();

  var codes = source.getRange(start, ctx.col, num, 1).getDisplayValues();
  var fmls = source.getRange(start, CONFIG.FML_COL, num, 1).getDisplayValues();

  var sourceRows = [];
  for (var i = 0; i < num; i++) {
    var code = String(codes[i][0] || '').trim();
    var fml = String(fmls[i][0] || '').trim();

    if (code || fml) {
      sourceRows.push({
        row: start + i,
        fml: fml,
        code: code
      });
    }
  }

  var built = null;
  var builtError = '';
  try {
    built = SendPanelRepository_.buildRowsForDate(dateStr);
  } catch (e) {
    builtError = e && e.message ? e.message : String(e);
  }

  var preview = null;
  var previewError = '';
  try {
    preview = SendPanelRepository_.preview(dateStr);
  } catch (e2) {
    previewError = e2 && e2.message ? e2.message : String(e2);
  }

  var out = {
    date: dateStr,
    context: {
      sheet: source.getName(),
      dateStr: ctx.dateStr,
      col: ctx.col,
      codeRange: CONFIG.CODE_RANGE_A1,
      startRow: start,
      rowCount: num,
      fmlCol: CONFIG.FML_COL
    },
    sourceRowsCount: sourceRows.length,
    sourceRowsFirst20: sourceRows.slice(0, 20),
    buildRowsForDateError: builtError,
    builtRowsCount: built && built.rows ? built.rows.length : 0,
    builtRowsFirst10: built && built.rows ? built.rows.slice(0, 10) : [],
    previewError: previewError,
    previewRowsCount: preview && preview.rows ? preview.rows.length : 0,
    previewStats: preview ? preview.stats : null,
    previewRowsFirst10: preview && preview.rows ? preview.rows.slice(0, 10) : []
  };

  Logger.log(JSON.stringify(out, null, 2));
  return out;
}

function debugManualSheetAccess_() {
  var spreadsheetId = '1v8ixM67nG_Bfy5NzcDZbmSjwVOYbkN02ibfP6YqI384';

  var result = {
    activeSpreadsheetOk: false,
    activeSpreadsheetId: '',
    activeSpreadsheetName: '',
    openByIdOk: false,
    openByIdName: '',
    accessSheetOk: false,
    accessSheetLastRow: 0,
    accessSheetLastColumn: 0,
    error: ''
  };

  try {
    var active = getWasbSpreadsheet_();

    if (active) {
      result.activeSpreadsheetOk = true;
      result.activeSpreadsheetId = active.getId();
      result.activeSpreadsheetName = active.getName();
    }
  } catch (e1) {
    result.activeSpreadsheetError = e1 && e1.message ? e1.message : String(e1);
  }

  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);

    result.openByIdOk = true;
    result.openByIdName = ss.getName();

    var accessSheet = ss.getSheetByName('ACCESS');
    result.accessSheetOk = !!accessSheet;

    if (accessSheet) {
      result.accessSheetLastRow = accessSheet.getLastRow();
      result.accessSheetLastColumn = accessSheet.getLastColumn();
    }
  } catch (e2) {
    result.error = e2 && e2.message ? e2.message : String(e2);
  }

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
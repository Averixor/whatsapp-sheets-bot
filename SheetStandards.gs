/************ SHEET STANDARDS ************/

function _sheetStandardsGetConfigObject_() {
  try {
    if (typeof CONFIG !== 'undefined' && CONFIG && typeof CONFIG === 'object') {
      return CONFIG;
    }
  } catch (e) {}
  return {};
}

function _sheetStandardsGetConfigValue_(key, fallbackValue) {
  var cfg = _sheetStandardsGetConfigObject_();
  if (Object.prototype.hasOwnProperty.call(cfg, key) && cfg[key] !== null && typeof cfg[key] !== 'undefined' && cfg[key] !== '') {
    return cfg[key];
  }
  return fallbackValue;
}

function _sheetStandardsGetSendPanelSheetName_() {
  return String(_sheetStandardsGetConfigValue_('SEND_PANEL_SHEET', 'SEND_PANEL') || 'SEND_PANEL').trim();
}

function _sheetStandardsGetCodeRangeA1_() {
  return String(_sheetStandardsGetConfigValue_('CODE_RANGE_A1', 'H2:AL40') || 'H2:AL40').trim();
}

function _sheetStandardsGetDateRow_() {
  var value = Number(_sheetStandardsGetConfigValue_('DATE_ROW', 1));
  return isFinite(value) && value > 0 ? value : 1;
}

function _sheetStandardsGetTimeZone_() {
  try {
    if (typeof getTimeZone_ === 'function') {
      var fromFunction = getTimeZone_();
      if (fromFunction) return String(fromFunction);
    }
  } catch (e) {}

  var cfgTimeZone = _sheetStandardsGetConfigValue_('TIME_ZONE', '');
  if (cfgTimeZone) return String(cfgTimeZone);

  try {
    var sessionTimeZone = Session.getScriptTimeZone();
    if (sessionTimeZone) return String(sessionTimeZone);
  } catch (e) {}

  return 'Etc/GMT';
}

function _sheetStandardsIsMonthlySheet_(sheetName) {
  return /^\d{2}$/.test(String(sheetName || '').trim());
}

function _sheetStandardsIsSendPanelSheet_(sheetName) {
  return String(sheetName || '').trim() === _sheetStandardsGetSendPanelSheetName_();
}

function _sheetStandardsShouldApply_(sheetName) {
  return _sheetStandardsIsMonthlySheet_(sheetName) || _sheetStandardsIsSendPanelSheet_(sheetName);
}

function _sheetStandardsLog_(message, error) {
  try {
    Logger.log('[SheetStandards] ' + String(message || '') + (error ? ': ' + (error && error.message ? error.message : error) : ''));
  } catch (e) {}
}

function _sheetStandardsNormalizeDate_(value, displayValue, timeZone) {
  try {
    if (typeof DateUtils_ !== 'undefined' && DateUtils_ && typeof DateUtils_.normalizeDate === 'function') {
      return String(DateUtils_.normalizeDate(value, displayValue) || '').trim();
    }
  } catch (e) {}

  try {
    if (value instanceof Date && !isNaN(value.getTime())) {
      return Utilities.formatDate(value, timeZone, 'dd.MM.yyyy');
    }
  } catch (e) {}

  var displayText = String(displayValue || '').trim();
  if (displayText) return displayText;

  var rawText = String(value || '').trim();
  return rawText;
}

function _sheetStandardsSafeGetRange_(sheet, a1Notation) {
  try {
    return sheet.getRange(a1Notation);
  } catch (e) {
    return null;
  }
}

function applyGlobalSheetStandards_() {
  var ss;
  try {
    ss = SpreadsheetApp.getActive();
  } catch (e) {
    _sheetStandardsLog_('Unable to get active spreadsheet', e);
    return;
  }

  if (!ss) return;

  var sheets;
  try {
    sheets = ss.getSheets();
  } catch (e) {
    _sheetStandardsLog_('Unable to get sheets', e);
    return;
  }

  for (var i = 0; i < sheets.length; i++) {
    var sh = sheets[i];
    var name = '';

    try {
      name = sh.getName();
    } catch (e) {
      _sheetStandardsLog_('Unable to read sheet name', e);
      continue;
    }

    if (_sheetStandardsShouldApply_(name)) {
      applyFontStandardsToSheet_(sh);
      applyFreezeStandardsToSheet_(sh);
      applyColumnWidthsStandardsToSheet_(sh);
    }
  }
}

function applyFontStandardsToSheet_(sheet) {
  try {
    if (!sheet) return;

    var lastRow = Number(sheet.getLastRow()) || 0;
    var lastCol = Number(sheet.getLastColumn()) || 0;

    if (lastRow < 1 || lastCol < 1) return;

    sheet.getRange(1, 1, lastRow, lastCol)
      .setFontFamily('Times New Roman')
      .setFontSize(12);
  } catch (e) {
    _sheetStandardsLog_('Font apply error', e);
  }
}

function applyFreezeStandardsToSheet_(sheet) {
  try {
    if (!sheet) return;

    var sheetName = String(sheet.getName() || '').trim();
    var maxCols = Number(sheet.getMaxColumns()) || 0;

    sheet.setFrozenRows(1);

    if (_sheetStandardsIsMonthlySheet_(sheetName)) {
      sheet.setFrozenColumns(Math.min(7, Math.max(maxCols, 0)));
    } else if (_sheetStandardsIsSendPanelSheet_(sheetName)) {
      sheet.setFrozenColumns(0);
    }
  } catch (e) {
    _sheetStandardsLog_('Freeze apply error', e);
  }
}

function applyColumnWidthsStandardsToSheet_(sheet) {
  try {
    if (!sheet) return;

    var isSendPanel = _sheetStandardsIsSendPanelSheet_(sheet.getName());
    var maxCols = Number(sheet.getMaxColumns()) || 0;
    var widths = isSendPanel
      ? [320, 120, 80, 150, 80, 80, 120]
      : [110, 110, 110, 110, 150, 40, 315];

    for (var i = 0; i < Math.min(widths.length, maxCols); i++) {
      if (Number(widths[i]) > 0) {
        try {
          sheet.setColumnWidth(i + 1, widths[i]);
        } catch (e) {
          _sheetStandardsLog_('Column width apply error on column ' + (i + 1), e);
        }
      }
    }
  } catch (e) {
    _sheetStandardsLog_('Column widths apply error', e);
  }
}

/************ FIND TODAY COLUMN ************/

function findTodayColumn_(sheet, todayStr) {
  if (!sheet) return -1;

  var timeZone = _sheetStandardsGetTimeZone_();
  var resolvedToday = String(todayStr || Utilities.formatDate(new Date(), timeZone, 'dd.MM.yyyy')).trim();
  var codeRangeA1 = _sheetStandardsGetCodeRangeA1_();
  var dateRow = _sheetStandardsGetDateRow_();

  var codeRef = _sheetStandardsSafeGetRange_(sheet, codeRangeA1);
  if (!codeRef) return -1;

  var lastCol = Number(sheet.getLastColumn()) || 0;
  if (lastCol < 1) return -1;

  var dateRowValues;
  var dateDisplayValues;

  try {
    dateRowValues = sheet.getRange(dateRow, 1, 1, lastCol).getValues()[0];
    dateDisplayValues = sheet.getRange(dateRow, 1, 1, lastCol).getDisplayValues()[0];
  } catch (e) {
    _sheetStandardsLog_('Date row read error', e);
    return -1;
  }

  var startCol = Number(codeRef.getColumn()) || 1;
  var endCol = Math.min(Number(codeRef.getLastColumn()) || 1, lastCol);

  for (var c = startCol; c <= endCol; c++) {
    var idx = c - 1;

    if (idx >= dateRowValues.length) continue;

    try {
      var normalized = _sheetStandardsNormalizeDate_(dateRowValues[idx], dateDisplayValues[idx], timeZone);
      if (normalized === resolvedToday) return c;
    } catch (e) {}
  }

  return -1;
}
/************ СТАНДАРТИ ДЛЯ ЛИСТІВ ************/
function applyGlobalSheetStandards_() {
  const ss = SpreadsheetApp.getActive();
  ss.getSheets().forEach(sh => {
    const name = sh.getName();
    if (/^\d{2}$/.test(name) || name === CONFIG.SEND_PANEL_SHEET) {
      applyFontStandardsToSheet_(sh);
      applyFreezeStandardsToSheet_(sh);
      applyColumnWidthsStandardsToSheet_(sh);
    }
  });
}

function applyFontStandardsToSheet_(sheet) {
  const maxR = sheet.getMaxRows();
  const maxC = sheet.getMaxColumns();
  if (maxR < 1 || maxC < 1) return;
  sheet.getRange(1, 1, maxR, maxC)
    .setFontFamily('Times New Roman')
    .setFontSize(12);
}

function applyFreezeStandardsToSheet_(sheet) {
  try {
    sheet.setFrozenRows(1);
    sheet.setFrozenColumns(7);
  } catch (e) { }
}

function applyColumnWidthsStandardsToSheet_(sheet) {
  const isSendPanel = sheet.getName() === CONFIG.SEND_PANEL_SHEET;
  const maxCols = sheet.getMaxColumns();
  const widths = isSendPanel
    ? [320, 110, 90, 150, 95, 125, 95].slice(0, maxCols)
    : [110, 110, 110, 110, 150, 40, 315].slice(0, maxCols);

  widths.forEach((w, i) => {
    if (Number(w) > 0) {
      try { sheet.setColumnWidth(i + 1, w); } catch (e) { }
    }
  });
}

/************ ПОШУК СЬОГОДНІШНЬОГО СТОВПЦЯ ************/
function findTodayColumn_(sheet, todayStr) {
  todayStr = todayStr || Utilities.formatDate(new Date(), CONFIG.TZ, 'dd.MM.yyyy');
  const codeRef = sheet.getRange(CONFIG.CODE_RANGE_A1);
  const row = Number(CONFIG.DATE_ROW) || 1;

  const lastCol = sheet.getLastColumn();
  const dateRowValues = sheet.getRange(row, 1, 1, lastCol).getValues()[0];
  const dateDisplayValues = sheet.getRange(row, 1, 1, lastCol).getDisplayValues()[0];

  const startCol = codeRef.getColumn();
  const endCol = Math.min(codeRef.getLastColumn(), lastCol);

  for (let c = startCol; c <= endCol; c++) {
    const idx = c - 1;
    try {
      if (idx < dateRowValues.length) {
        const normalized = normalizeDate_(dateRowValues[idx], dateDisplayValues[idx]);
        if (normalized === todayStr) return c;
      }
    } catch (e) { }
  }
  return -1;
}
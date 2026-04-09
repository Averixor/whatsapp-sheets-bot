/************ СТАНДАРТИ ДЛЯ ЛИСТІВ ************/
function applyGlobalSheetStandards_() {
  if (typeof ensureAllSystemSheets_ === 'function') {
    try { ensureAllSystemSheets_(); } catch (_) {}
  }
  const ss = SpreadsheetApp.getActive();
  ss.getSheets().forEach(sh => {
    const name = sh.getName();
    const isMonth = /^\d{2}$/.test(name);

    if (isMonth) {
      applyFreezeStandardsToSheet_(sh);
      return;
    }

    if (typeof stage7IsRequiredNonMonthSheet_ === 'function' && stage7IsRequiredNonMonthSheet_(name)) {
      try {
        sh.setFrozenRows(1);
        sh.setFrozenColumns(0);
      } catch (_) {}
      if (typeof stage7ApplyTableTheme_ === 'function') {
        stage7ApplyTableTheme_(sh, 1, Math.max(sh.getLastColumn(), 1), { freeze: false });
      }
    }
  });
}

function applyFreezeStandardsToSheet_(sheet) {
  try {
    if (/^\d{2}$/.test(String(sheet.getName() || '').trim())) {
      sheet.setFrozenRows(1);
      sheet.setFrozenColumns(7);
    } else {
      sheet.setFrozenRows(1);
      sheet.setFrozenColumns(0);
    }
  } catch (e) { }
}

/************ ПОШУК СЬОГОДНІШНЬОГО СТОВПЦЯ ************/
function findTodayColumn_(sheet, todayStr) {
  todayStr = todayStr || Utilities.formatDate(new Date(), getTimeZone_(), 'dd.MM.yyyy');
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
        const normalized = DateUtils_.normalizeDate(dateRowValues[idx], dateDisplayValues[idx]);
        if (normalized === todayStr) return c;
      }
    } catch (e) { }
  }
  return -1;
}
function _ensureSendPanelTechnicalSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(CONFIG.SEND_PANEL_SHEET);
  let created = false;

  if (!sh) {
    sh = ss.insertSheet(CONFIG.SEND_PANEL_SHEET);
    created = true;
  }

  if (sh.getLastRow() < 1) {
    sh.getRange(1, 1, 1, 7)
      .merge()
      .setValue(`🤖 Активний місяць: ${getBotMonthSheetName_()}`)
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setBackground('#fff3cd');
  }

  if (sh.getLastRow() < 2) {
    sh.getRange(2, 1, 1, 7)
      .setValues([['FIO', 'Phone', 'Code', 'Tasks', 'Status', 'Sent', 'Action']])
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setBackground('#f0f0f0');
  }

  sh.setFrozenRows(2);
  return { sheet: sh, created: created };
}

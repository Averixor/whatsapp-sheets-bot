function _getSS_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Не вдалося отримати активну таблицю');
  return ss;
}

function _diagServiceSheetCheck_(checks, name) {
  try {
    var ss = SpreadsheetApp.getActive();
    var sh = ss.getSheetByName(name);
    _stage7PushCheck_(
      checks,
      'Service sheet ' + name,
      sh ? 'OK' : 'WARN',
      sh ? 'Доступний' : 'Ще не створений; буде створений автоматично при першій lifecycle-операції',
      sh ? '' : 'Запустіть будь-яку критичну write-операцію або ensureServiceSheets()'
    );
  } catch (e) {
    _stage7PushCheck_(checks, 'Service sheet ' + name, 'FAIL', e && e.message ? e.message : String(e), 'Перевірте доступ до SpreadsheetApp');
  }
}

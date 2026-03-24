/************ LOG WRITER ************/
function _ensureLogSheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(CONFIG.LOG_SHEET);

  if (!sh) {
    sh = ss.insertSheet(CONFIG.LOG_SHEET);
  }

  const headers = [
    'Timestamp',
    'ReportDate',
    'Sheet',
    'Cell',
    'FIO',
    'Phone',
    'Code',
    'Service',
    'Place',
    'Tasks',
    'Message',
    'Link'
  ];

  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#f0f0f0');
  }

  return sh;
}

function writeLogsBatch_(items) {
  items = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!items.length) {
    return { success: true, count: 0, message: 'Немає логів для запису' };
  }

  const sh = _ensureLogSheet_();

  const rows = items.map(item => {
    if (Array.isArray(item)) return item;

    const o = item || {};
    return [
      o.timestamp || new Date(),
      o.reportDateStr || '',
      o.sheet || '',
      o.cell || '',
      o.fio || '',
      o.phone || '',
      o.code || '',
      o.service || '',
      o.place || '',
      o.tasks || '',
      o.message || '',
      o.link || ''
    ];
  });

  sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);

  return {
    success: true,
    count: rows.length,
    message: `Записано ${rows.length} логів`
  };
}
/************ ПАНЕЛЬ ВІДПРАВКИ ************/
function extractHyperlinkUrl_(formula) {
  const m = String(formula).match(/HYPERLINK\("([^"]+)"/i);
  return m ? m[1] : '';
}

function makeSendPanelKey_(f, p, c) {
  return [normalizeFIO_(f || ''), String(p || '').replace(/[^\d]/g, ''), String(c || '').trim()].join('|');
}

function readSendPanelSentMap_(panel) {
  const map = {};
  const last = panel.getLastRow();
  if (last < CONFIG.SEND_PANEL_DATA_START_ROW) return map;
  const vals = panel.getRange(CONFIG.SEND_PANEL_DATA_START_ROW, 1,
    last - (CONFIG.SEND_PANEL_DATA_START_ROW - 1), 7)
    .getValues();
  vals.forEach(row => {
    const [fio, phone, code, tasks, status, action, sent] = row;
    if (fio && phone && code && sent) map[makeSendPanelKey_(fio, phone, code)] = true;
  });
  return map;
}

function getSendPanelReadyStatus_() {
  return '✅';
}

function getSendPanelSentStatus_() {
  return '📤 Відправлено';
}

function getSendPanelErrorPrefix_() {
  return '❌';
}

function ensureSendPanelStructure_(panel, botMonth) {
  panel.clearContents();
  panel.getRange(1, 1, 1, 7)
    .merge()
    .setValue(`🤖 Активний місяць: ${botMonth}`)
    .setFontWeight('bold')
    .setFontSize(14)
    .setHorizontalAlignment('center')
    .setBackground('#fff3cd');

  panel.getRange(CONFIG.SEND_PANEL_HEADER_ROW, 1, 1, 7)
    .setValues([['ПІБ', 'Телефон', 'Код', 'Завдання', 'Статус', 'Дія', 'Відправлено']])
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setBackground('#f0f0f0');
}

function rebuildSendPanelCore_() {
  const ss = SpreadsheetApp.getActive();
  const source = getBotSheet_();
  let panel = ss.getSheetByName(CONFIG.SEND_PANEL_SHEET);
  const prevSent = panel ? readSendPanelSentMap_(panel) : {};
  if (!panel) panel = ss.insertSheet(CONFIG.SEND_PANEL_SHEET);

  const botMonth = getBotMonthSheetName_();
  ensureSendPanelStructure_(panel, botMonth);

  const phones = loadPhonesMap_();
  const dict = loadDictMap_();
  const today = Utilities.formatDate(new Date(), CONFIG.TZ, 'dd.MM.yyyy');
  const ref = source.getRange(CONFIG.CODE_RANGE_A1);
  const col = findTodayColumn_(source, today);
  if (col === -1) {
    throw new Error(`Колонка ${today} не знайдена в аркуші "${source.getName()}"`);
  }

  const rows = [];
  const start = ref.getRow();
  const num = ref.getNumRows();
  const codes = source.getRange(start, col, num, 1).getDisplayValues();
  const fios = source.getRange(start, CONFIG.FIO_COL, num, 1).getDisplayValues();

  for (let i = 0; i < num; i++) {
    const code = String(codes[i][0] || '').trim();
    const fio = String(fios[i][0] || '').trim();
    if (!code || !fio) continue;

    try {
      const payload = buildPayloadForCell_(source, start + i, col, phones, dict);
      const linkFormula = `=HYPERLINK("${payload.link}"; "📱 НАДІСЛАТИ")`;
      const key = makeSendPanelKey_(payload.fio, payload.phone, payload.code);
      let formattedPhone = String(payload.phone || '').trim();
      if (formattedPhone.startsWith('+')) {
        formattedPhone = "'" + formattedPhone;
      }

      rows.push([
        payload.fio,
        formattedPhone || '—',
        payload.code,
        payload.tasks || '—',
        getSendPanelReadyStatus_(),
        linkFormula,
        prevSent[key] === true
      ]);
    } catch (e) {
      rows.push([
        fio,
        '—',
        code,
        '—',
        `${getSendPanelErrorPrefix_()} ${e && e.message ? e.message : String(e)}`,
        '',
        false
      ]);
    }
  }

  if (!rows.length) {
    throw new Error('На сьогодні немає даних для SEND_PANEL');
  }

  panel.getRange(CONFIG.SEND_PANEL_DATA_START_ROW, 1, rows.length, 7).setValues(rows);
  panel.getRange(CONFIG.SEND_PANEL_DATA_START_ROW, 7, rows.length, 1).insertCheckboxes();
  applyColumnWidthsStandardsToSheet_(panel);

  const statusRng = panel.getRange(CONFIG.SEND_PANEL_DATA_START_ROW, 5, rows.length, 1);
  panel.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenTextContains(getSendPanelReadyStatus_()).setBackground('#e6f4e6').setRanges([statusRng]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextContains(getSendPanelErrorPrefix_()).setBackground('#ffe6e6').setRanges([statusRng]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextContains(getSendPanelSentStatus_()).setBackground('#ede9fe').setRanges([statusRng]).build()
  ]);

  panel.setFrozenRows(CONFIG.SEND_PANEL_HEADER_ROW);

  return {
    panel: panel,
    rowsWritten: rows.length,
    month: botMonth,
    date: today
  };
}

function readSendPanelSidebarData_() {
  const panel = SpreadsheetApp.getActive().getSheetByName(CONFIG.SEND_PANEL_SHEET);
  if (!panel) return [];

  const lastRow = panel.getLastRow();
  if (lastRow < CONFIG.SEND_PANEL_DATA_START_ROW) return [];

  const dataRowCount = lastRow - (CONFIG.SEND_PANEL_DATA_START_ROW - 1);
  const values = panel.getRange(CONFIG.SEND_PANEL_DATA_START_ROW, 1, dataRowCount, 7).getDisplayValues();
  const formulas = panel.getRange(CONFIG.SEND_PANEL_DATA_START_ROW, 6, dataRowCount, 1).getFormulas().flat();
  const sentValues = panel.getRange(CONFIG.SEND_PANEL_DATA_START_ROW, 7, dataRowCount, 1).getValues().flat();

  return values.map((row, index) => {
    const status = String(row[4] || '').trim();
    const sent = sentValues[index] === true || String(sentValues[index]).toUpperCase() === 'TRUE';
    return {
      fio: String(row[0] || '').trim(),
      phone: String(row[1] || '').replace(/^'/, '').trim() || '—',
      code: String(row[2] || '').trim(),
      tasks: String(row[3] || '').trim() || '—',
      status: status,
      link: extractHyperlinkUrl_(formulas[index] || ''),
      sent: sent,
      row: CONFIG.SEND_PANEL_DATA_START_ROW + index
    };
  }).filter(item => item.fio || item.code || item.phone !== '—');
}

function buildSendPanelSidebarResponse_(meta) {
  const data = readSendPanelSidebarData_();
  return {
    success: true,
    data: data,
    totalCount: data.length,
    readyCount: data.filter(item => item.status === getSendPanelReadyStatus_() && item.link && !item.sent).length,
    errorCount: data.filter(item => String(item.status || '').indexOf(getSendPanelErrorPrefix_()) === 0).length,
    sentCount: data.filter(item => item.sent === true || item.status === getSendPanelSentStatus_()).length,
    month: meta && meta.month ? meta.month : getBotMonthSheetName_(),
    date: meta && meta.date ? meta.date : Utilities.formatDate(new Date(), CONFIG.TZ, 'dd.MM.yyyy')
  };
}

function generateSendPanel() {
  const ui = SpreadsheetApp.getUi();
  try {
    const result = rebuildSendPanelCore_();
    result.panel.activate();
    ui.alert(`✅ Панель створена (${result.rowsWritten} записів)
Місяць бота: ${result.month}`);
  } catch (e) {
    ui.alert(`❌ ${e && e.message ? e.message : String(e)}`);
  }
}

function sendAllFromSendPanel() {
  const ui = SpreadsheetApp.getUi();
  const panel = SpreadsheetApp.getActive().getSheetByName(CONFIG.SEND_PANEL_SHEET);
  if (!panel) return ui.alert('❌ Спочатку створіть панель');

  const last = panel.getLastRow();
  if (last < CONFIG.SEND_PANEL_DATA_START_ROW) return ui.alert('❌ Панель порожня');

  const countRows = last - (CONFIG.SEND_PANEL_DATA_START_ROW - 1);
  const formulas = panel.getRange(CONFIG.SEND_PANEL_DATA_START_ROW, 6, countRows, 1).getFormulas().flat();
  const sent = panel.getRange(CONFIG.SEND_PANEL_DATA_START_ROW, 7, countRows, 1).getValues().flat();

  const items = [];
  formulas.forEach((f, i) => {
    if (sent[i]) return;
    const url = extractHyperlinkUrl_(f);
    if (url && url.startsWith('https://wa.me/')) items.push({ url, row: CONFIG.SEND_PANEL_DATA_START_ROW + i });
  });

  if (!items.length) return ui.alert('✅ Усе вже відправлено');
  showSendPanelDialog_(items);
}

function markSendPanelSent_(row) {
  const panel = SpreadsheetApp.getActive().getSheetByName(CONFIG.SEND_PANEL_SHEET);
  if (!panel) return;
  panel.getRange(row, 7).setValue(true);
  panel.getRange(row, 5).setValue('📤 Відправлено');
}

function showSendPanelDialog_(items) {
  items = Array.isArray(items) ? items : [];
  const safeJson = JSON.stringify(items);

  const html = HtmlService.createHtmlOutput(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body{font-family:Arial,sans-serif;padding:16px}
    h3{margin:0 0 16px;color:#075e54}
    .stats{background:#f0f0f0;padding:12px;border-radius:8px;margin-bottom:16px}
    .buttons{display:flex;gap:10px;margin:16px 0;flex-wrap:wrap}
    button{padding:12px 20px;border:none;border-radius:8px;font-weight:bold;cursor:pointer;transition:.2s}
    .btn-start{background:#25D366;color:white}
    .btn-stop{background:#dc3545;color:white}
    .btn-stop:disabled{background:#999;cursor:not-allowed}
    .btn-one{background:#007bff;color:white}
    #log{
      background:#f8f9fa;border:1px solid #dee2e6;border-radius:8px;
      padding:12px;height:250px;overflow-y:auto;font-family:monospace;
      font-size:12px;white-space:pre-wrap
    }
    .warning{color:#856404;background:#fff3cd;padding:8px;border-radius:4px;margin:8px 0}
  </style>
</head>
<body>
  <h3>📤 Відправка повідомлень</h3>

  <div class="stats">
    <strong>До відправки:</strong> <span id="totalCount">${items.length}</span><br>
    <strong>Інтервал:</strong> 1.5 секунди
  </div>

  <div class="buttons">
    <button class="btn-start" id="btnStart">▶️ Старт</button>
    <button class="btn-stop" id="btnStop" disabled>🛑 Стоп</button>
    <button class="btn-one" id="btnOne">➕ Відкрити 1</button>
  </div>

  <div class="warning">⚠️ Якщо браузер блокує спливаючі вікна — дозвольте їх для цього сайту</div>
  <div id="log">Готово до відправки...</div>

  <script>
    const items = ${safeJson};
    let currentIndex = 0;
    let timer = null;

    const btnStart  = document.getElementById('btnStart');
    const btnStop   = document.getElementById('btnStop');
    const btnOne    = document.getElementById('btnOne');
    const totalSpan = document.getElementById('totalCount');
    const logEl     = document.getElementById('log');

    function updateUI(){
      if (totalSpan) totalSpan.textContent = String(items.length - currentIndex);
    }

    function log(message){
      if (!logEl) return;
      const time = new Date().toLocaleTimeString();
      logEl.textContent += "\\n[" + time + "] " + message;
      logEl.scrollTop = logEl.scrollHeight;
    }

    function markSent(row){
      try { google.script.run.markSendPanelSent_(row); } catch(e) {}
    }

    function openItem(item){
      log("#" + (currentIndex + 1) + ": Відкриваю...");
      window.open(item.url, "_blank");
      markSent(item.row);
      currentIndex++;
      updateUI();
    }

    function openNext(){
      if (currentIndex >= items.length){
        log("✅ Всі повідомлення відправлені!");
        stop();
        return;
      }
      openItem(items[currentIndex]);
    }

    function start(){
      if (timer) return;
      if (btnStart) btnStart.disabled = true;
      if (btnStop)  btnStop.disabled  = false;
      if (btnOne)   btnOne.disabled   = true;

      log("▶️ Запуск серії...");
      timer = setInterval(openNext, 1500);
      openNext();
    }

    function stop(){
      if (timer){ clearInterval(timer); timer = null; }
      if (btnStart) btnStart.disabled = false;
      if (btnStop)  btnStop.disabled  = true;
      if (btnOne)   btnOne.disabled   = false;
      log("⏹️ Зупинено");
    }

    function openOne(){
      if (currentIndex >= items.length){
        log("✅ Більше немає повідомлень");
        return;
      }
      openItem(items[currentIndex]);
    }

    if (btnStart) btnStart.addEventListener('click', start);
    if (btnStop)  btnStop.addEventListener('click', stop);
    if (btnOne)   btnOne.addEventListener('click', openOne);

    updateUI();
  </script>
</body>
</html>
`).setWidth(600).setHeight(550);

  SpreadsheetApp.getUi().showModalDialog(html, '🚀 Відправка повідомлень');
}

/************ ПАНЕЛЬ ВІДПРАВКИ ************/

function extractHyperlinkUrl_(formula) {
  const m = String(formula || '').match(/HYPERLINK\("([^"]+)"/i);
  return m ? m[1] : '';
}

function makeSendPanelKey_(f, p, c) {
  return [
    normalizeFIO_(f || ''),
    String(p || '').replace(/[^\d]/g, ''),
    String(c || '').trim()
  ].join('|');
}

function getSendPanelReadyStatus_() {
  return '✅ Готово';
}

function getSendPanelOpenedStatus_() {
  return '🟦 Відкрито';
}

function getSendPanelSentStatus_() {
  return '📤 Відправлено';
}

function getSendPanelNotSentStatus_() {
  return '↩️ Не відправлено';
}

function getSendPanelErrorPrefix_() {
  return '❌';
}

function getSendPanelMetaDateCellA1_() {
  return 'H1';
}

function getSendPanelWhatsappTabName_() {
  return 'wapb_whatsapp_tab';
}

function readSendPanelStoredDate_(panel) {
  if (!panel) return '';
  return String(panel.getRange(getSendPanelMetaDateCellA1_()).getDisplayValue() || '').trim();
}

function readSendPanelStateMap_(panel) {
  const map = {};
  const last = panel.getLastRow();
  if (last < CONFIG.SEND_PANEL_DATA_START_ROW) return map;

  const vals = panel.getRange(
    CONFIG.SEND_PANEL_DATA_START_ROW,
    1,
    last - (CONFIG.SEND_PANEL_DATA_START_ROW - 1),
    7
  ).getValues();

  vals.forEach(row => {
    const [fio, phone, code, tasks, status, action, sent] = row;
    if (!fio || !phone || !code) return;

    map[makeSendPanelKey_(fio, phone, code)] = {
      status: String(status || '').trim(),
      sent: sent === true || String(sent).toUpperCase() === 'TRUE'
    };
  });

  return map;
}

function normalizeSendPanelState_(state) {
  if (!state) {
    return { status: getSendPanelReadyStatus_(), sent: false };
  }

  if (state.sent === true || state.status === getSendPanelSentStatus_()) {
    return { status: getSendPanelSentStatus_(), sent: true };
  }

  if (state.status === getSendPanelOpenedStatus_()) {
    return { status: getSendPanelOpenedStatus_(), sent: false };
  }

  if (state.status === getSendPanelNotSentStatus_()) {
    return { status: getSendPanelNotSentStatus_(), sent: false };
  }

  return { status: getSendPanelReadyStatus_(), sent: false };
}

function ensureSendPanelStructure_(panel, botMonth, panelDate) {
  panel.clearContents();

  panel.getRange(1, 1, 1, 7).breakApart();
  panel.getRange(1, 1, 1, 7)
    .merge()
    .setValue(`🤖 Активний місяць: ${botMonth} | Дата панелі: ${panelDate}`)
    .setFontWeight('bold')
    .setFontSize(14)
    .setHorizontalAlignment('center')
    .setBackground('#fff3cd');

  panel.getRange(CONFIG.SEND_PANEL_HEADER_ROW, 1, 1, 7)
    .setValues([['ПІБ', 'Телефон', 'Код', 'Завдання', 'Статус', 'Дія', 'Відправлено']])
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setBackground('#f0f0f0');

  panel.getRange(getSendPanelMetaDateCellA1_()).setValue(panelDate);

  try {
    panel.hideColumns(8);
  } catch (e) {
    // якщо з якоїсь причини не вийде — не критично
  }
}

function ensureSendPanelFreshForToday_() {
  const ss = SpreadsheetApp.getActive();
  const today = Utilities.formatDate(new Date(), CONFIG.TZ, 'dd.MM.yyyy');
  let panel = ss.getSheetByName(CONFIG.SEND_PANEL_SHEET);

  if (!panel) {
    return rebuildSendPanelCore_();
  }

  const storedDate = readSendPanelStoredDate_(panel);
  if (storedDate !== today) {
    return rebuildSendPanelCore_();
  }

  return {
    panel: panel,
    rowsWritten: Math.max(0, panel.getLastRow() - (CONFIG.SEND_PANEL_DATA_START_ROW - 1)),
    month: getBotMonthSheetName_(),
    date: today
  };
}

function rebuildSendPanelCore_() {
  const ss = SpreadsheetApp.getActive();
  const source = getBotSheet_();
  const today = Utilities.formatDate(new Date(), CONFIG.TZ, 'dd.MM.yyyy');

  let panel = ss.getSheetByName(CONFIG.SEND_PANEL_SHEET);
  let prevState = {};

  if (panel) {
    const storedDate = readSendPanelStoredDate_(panel);
    if (storedDate === today) {
      prevState = readSendPanelStateMap_(panel);
    }
  }

  if (!panel) panel = ss.insertSheet(CONFIG.SEND_PANEL_SHEET);

  const botMonth = getBotMonthSheetName_();
  ensureSendPanelStructure_(panel, botMonth, today);

  const phones = loadPhonesMap_();
  const dict = loadDictMap_();
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
      const restored = normalizeSendPanelState_(prevState[key]);

      let formattedPhone = String(payload.phone || '').trim();
      if (formattedPhone.startsWith('+')) {
        formattedPhone = "'" + formattedPhone;
      }

      rows.push([
        payload.fio,
        formattedPhone || '—',
        payload.code,
        payload.tasks || '—',
        restored.status,
        linkFormula,
        restored.sent
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
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextContains(getSendPanelReadyStatus_())
      .setBackground('#e6f4e6')
      .setRanges([statusRng])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextContains(getSendPanelOpenedStatus_())
      .setBackground('#e6f0ff')
      .setRanges([statusRng])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextContains(getSendPanelNotSentStatus_())
      .setBackground('#fff3cd')
      .setRanges([statusRng])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextContains(getSendPanelErrorPrefix_())
      .setBackground('#ffe6e6')
      .setRanges([statusRng])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextContains(getSendPanelSentStatus_())
      .setBackground('#ede9fe')
      .setRanges([statusRng])
      .build()
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
  ensureSendPanelFreshForToday_();

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
  const fresh = meta || ensureSendPanelFreshForToday_();
  const data = readSendPanelSidebarData_();

  return {
    success: true,
    data: data,
    totalCount: data.length,
    readyCount: data.filter(item => item.status === getSendPanelReadyStatus_() && item.link && !item.sent).length,
    openedCount: data.filter(item => item.status === getSendPanelOpenedStatus_() && !item.sent).length,
    notSentCount: data.filter(item => item.status === getSendPanelNotSentStatus_() && !item.sent).length,
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
    ui.alert(`✅ Панель створена (${result.rowsWritten} записів)\nМісяць бота: ${result.month}`);
  } catch (e) {
    ui.alert(`❌ ${e && e.message ? e.message : String(e)}`);
  }
}

function isSendPanelCurrentDate_() {
  const panel = SpreadsheetApp.getActive().getSheetByName(CONFIG.SEND_PANEL_SHEET);
  if (!panel) return false;

  const storedDate = readSendPanelStoredDate_(panel);
  const today = Utilities.formatDate(new Date(), CONFIG.TZ, 'dd.MM.yyyy');
  return storedDate === today;
}

function sendAllFromSendPanel() {
  const ui = SpreadsheetApp.getUi();
  const panel = SpreadsheetApp.getActive().getSheetByName(CONFIG.SEND_PANEL_SHEET);

  if (!panel) return ui.alert('❌ Спочатку створіть панель');

  if (!isSendPanelCurrentDate_()) {
    return ui.alert('⚠️ Панель застаріла. Спочатку пересоберіть панель на поточну дату.');
  }

  const last = panel.getLastRow();
  if (last < CONFIG.SEND_PANEL_DATA_START_ROW) return ui.alert('❌ Панель порожня');

  const countRows = last - (CONFIG.SEND_PANEL_DATA_START_ROW - 1);
  const values = panel.getRange(CONFIG.SEND_PANEL_DATA_START_ROW, 1, countRows, 5).getDisplayValues();
  const formulas = panel.getRange(CONFIG.SEND_PANEL_DATA_START_ROW, 6, countRows, 1).getFormulas().flat();
  const sent = panel.getRange(CONFIG.SEND_PANEL_DATA_START_ROW, 7, countRows, 1).getValues().flat();

  const items = [];
  values.forEach((row, i) => {
    const isSent = sent[i] === true || String(sent[i]).toUpperCase() === 'TRUE';
    if (isSent) return;

    const url = extractHyperlinkUrl_(formulas[i] || '');
    if (!url || !url.startsWith('https://wa.me/')) return;

    items.push({
      fio: String(row[0] || '').trim(),
      phone: String(row[1] || '').replace(/^'/, '').trim(),
      code: String(row[2] || '').trim(),
      tasks: String(row[3] || '').trim(),
      status: String(row[4] || '').trim(),
      url: url,
      row: CONFIG.SEND_PANEL_DATA_START_ROW + i
    });
  });

  if (!items.length) return ui.alert('✅ Усе вже відправлено');

  showSendPanelDialog_(items);
}

function markSendPanelOpened_(row) {
  const panel = SpreadsheetApp.getActive().getSheetByName(CONFIG.SEND_PANEL_SHEET);
  if (!panel) return;

  const sent = panel.getRange(row, 7).getValue() === true;
  const currentStatus = String(panel.getRange(row, 5).getDisplayValue() || '').trim();

  if (sent) return;
  if (currentStatus.indexOf(getSendPanelErrorPrefix_()) === 0) return;

  panel.getRange(row, 5).setValue(getSendPanelOpenedStatus_());
}

function markSendPanelConfirmed_(row) {
  const panel = SpreadsheetApp.getActive().getSheetByName(CONFIG.SEND_PANEL_SHEET);
  if (!panel) return;

  panel.getRange(row, 7).setValue(true);
  panel.getRange(row, 5).setValue(getSendPanelSentStatus_());
}

function markSendPanelNotSent_(row) {
  const panel = SpreadsheetApp.getActive().getSheetByName(CONFIG.SEND_PANEL_SHEET);
  if (!panel) return;

  panel.getRange(row, 7).setValue(false);
  panel.getRange(row, 5).setValue(getSendPanelNotSentStatus_());
}

function showSendPanelDialog_(items) {
  items = Array.isArray(items) ? items : [];
  const safeJson = JSON.stringify(items).replace(/</g, '\\u003c');
  const tabName = getSendPanelWhatsappTabName_();

  const html = HtmlService.createHtmlOutput(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body{
      font-family:Arial,sans-serif;
      padding:16px;
      color:#1f2937;
    }
    h3{
      margin:0 0 12px;
      color:#075e54;
    }
    .stats, .card, .warning{
      border-radius:10px;
      padding:12px;
      margin-bottom:12px;
    }
    .stats{
      background:#f3f4f6;
    }
    .card{
      background:#f8fafc;
      border:1px solid #e5e7eb;
    }
    .warning{
      color:#856404;
      background:#fff3cd;
    }
    .buttons{
      display:flex;
      gap:10px;
      flex-wrap:wrap;
      margin:12px 0 16px;
    }
    button{
      padding:12px 16px;
      border:none;
      border-radius:10px;
      font-weight:bold;
      cursor:pointer;
      transition:.2s;
    }
    button:disabled{
      opacity:.55;
      cursor:not-allowed;
    }
    .btn-launch{background:#075e54;color:#fff;}
    .btn-open{background:#25D366;color:#fff;}
    .btn-ok{background:#4f46e5;color:#fff;}
    .btn-no{background:#f59e0b;color:#fff;}
    .btn-close{background:#6b7280;color:#fff;}
    #log{
      background:#111827;
      color:#e5e7eb;
      border-radius:10px;
      padding:12px;
      height:220px;
      overflow-y:auto;
      font-family:monospace;
      font-size:12px;
      white-space:pre-wrap;
    }
    .muted{
      color:#6b7280;
      font-size:12px;
    }
    .row{
      margin:4px 0;
    }
    .label{
      font-weight:bold;
    }
  </style>
</head>
<body>
  <h3>📤 Відправка повідомлень</h3>

  <div class="stats">
    <div class="row"><span class="label">Усього до обробки:</span> <span id="totalCount">${items.length}</span></div>
    <div class="row"><span class="label">Залишилось:</span> <span id="leftCount">${items.length}</span></div>
    <div class="row"><span class="label">WhatsApp-вкладка:</span> одна і та сама, без плодіння табів</div>
  </div>

  <div class="card">
    <div class="row"><span class="label">Поточний запис:</span></div>
    <div id="currentInfo">Немає даних</div>
    <div class="muted" style="margin-top:8px;">
      Схема роботи: відкрив чат → відправив у WhatsApp → повернувся сюди → підтвердив або відмітив як не відправлено.
    </div>
  </div>

  <div class="buttons">
    <button class="btn-launch" id="btnLaunch">🟢 Запустити WhatsApp</button>
    <button class="btn-open" id="btnOpen">📱 Відкрити поточний чат</button>
    <button class="btn-ok" id="btnConfirm" disabled>✅ Підтвердити</button>
    <button class="btn-no" id="btnNotSent" disabled>↩️ Не відправлено</button>
    <button class="btn-close" id="btnClose">✖ Закрити</button>
  </div>

  <div class="warning">
    ⚠️ Якщо браузер блокує відкриття вкладки — дозволь спливаючі вікна для Google Sheets / Apps Script.
  </div>

  <div id="log">Готово до роботи...</div>

  <script>
    const items = ${safeJson};
    const TAB_NAME = ${JSON.stringify(tabName)};

    let currentIndex = 0;
    let awaitingDecision = false;

    const btnLaunch = document.getElementById('btnLaunch');
    const btnOpen = document.getElementById('btnOpen');
    const btnConfirm = document.getElementById('btnConfirm');
    const btnNotSent = document.getElementById('btnNotSent');
    const btnClose = document.getElementById('btnClose');

    const totalSpan = document.getElementById('totalCount');
    const leftSpan = document.getElementById('leftCount');
    const currentInfo = document.getElementById('currentInfo');
    const logEl = document.getElementById('log');

    function getCurrentItem() {
      return currentIndex < items.length ? items[currentIndex] : null;
    }

    function log(message) {
      const time = new Date().toLocaleTimeString();
      logEl.textContent += "\\n[" + time + "] " + message;
      logEl.scrollTop = logEl.scrollHeight;
    }

    function updateUI() {
      const item = getCurrentItem();
      const left = Math.max(0, items.length - currentIndex);

      totalSpan.textContent = String(items.length);
      leftSpan.textContent = String(left);

      if (!item) {
        currentInfo.innerHTML = "<b>✅ Усі записи цього запуску оброблені</b>";
        btnOpen.disabled = true;
        btnConfirm.disabled = true;
        btnNotSent.disabled = true;
        return;
      }

      currentInfo.innerHTML =
        "<div><b>ПІБ:</b> " + escapeHtml(item.fio || "—") + "</div>" +
        "<div><b>Телефон:</b> " + escapeHtml(item.phone || "—") + "</div>" +
        "<div><b>Код:</b> " + escapeHtml(item.code || "—") + "</div>" +
        "<div><b>Завдання:</b> " + escapeHtml(item.tasks || "—") + "</div>" +
        "<div><b>Статус:</b> " + escapeHtml(item.status || "—") + "</div>";

      btnOpen.disabled = false;
      btnConfirm.disabled = !awaitingDecision;
      btnNotSent.disabled = !awaitingDecision;
    }

    function escapeHtml(str) {
      return String(str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    function launchWhatsappHome() {
      const win = window.open("https://web.whatsapp.com/", TAB_NAME);
      if (win) {
        log("🟢 WhatsApp-вкладка відкрита / переиспользована");
      } else {
        log("⚠️ Браузер заблокував відкриття вкладки");
      }
    }

    function openCurrentChat() {
      const item = getCurrentItem();
      if (!item) {
        log("✅ Більше немає записів");
        updateUI();
        return;
      }

      const win = window.open(item.url, TAB_NAME);
      if (!win) {
        log("⚠️ Браузер заблокував відкриття чату");
        return;
      }

      awaitingDecision = true;
      btnConfirm.disabled = false;
      btnNotSent.disabled = false;

      try {
        google.script.run.markSendPanelOpened_(item.row);
      } catch (e) {}

      log("📱 Відкрито чат для: " + (item.fio || "без ПІБ"));
      log("⌛ Після фактичної відправки повернись сюди і натисни підтвердження");
      updateUI();
    }

    function confirmCurrent() {
      const item = getCurrentItem();
      if (!item || !awaitingDecision) {
        log("⚠️ Немає відкритого запису для підтвердження");
        return;
      }

      try {
        google.script.run.markSendPanelConfirmed_(item.row);
      } catch (e) {}

      log("✅ Підтверджено відправку: " + (item.fio || "без ПІБ"));

      currentIndex++;
      awaitingDecision = false;
      updateUI();
    }

    function markCurrentNotSent() {
      const item = getCurrentItem();
      if (!item || !awaitingDecision) {
        log("⚠️ Немає відкритого запису для відмітки");
        return;
      }

      try {
        google.script.run.markSendPanelNotSent_(item.row);
      } catch (e) {}

      log("↩️ Відмічено як не відправлено: " + (item.fio || "без ПІБ"));

      currentIndex++;
      awaitingDecision = false;
      updateUI();
    }

    btnLaunch.addEventListener('click', launchWhatsappHome);
    btnOpen.addEventListener('click', openCurrentChat);
    btnConfirm.addEventListener('click', confirmCurrent);
    btnNotSent.addEventListener('click', markCurrentNotSent);
    btnClose.addEventListener('click', () => google.script.host.close());

    updateUI();
  </script>
</body>
</html>
  `).setWidth(760).setHeight(620);

  SpreadsheetApp.getUi().showModalDialog(html, '🚀 Відправка повідомлень');
}
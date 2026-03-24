/************ ПАНЕЛЬ ВІДПРАВКИ ************/

var SEND_PANEL_STATE_STORE_PREFIX_ = 'SEND_PANEL_SENT_V2|';
var SEND_PANEL_WHATSAPP_TARGET_ = 'WAPB_WHATSAPP_SENDER_TAB';

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
  return SendPanelConstants_.STATUS_READY;
}

function getSendPanelSentStatus_() {
  return SendPanelConstants_.STATUS_SENT;
}

function getSendPanelErrorPrefix_() {
  return SendPanelConstants_.STATUS_ERROR_PREFIX;
}

function getSendPanelToday_() {
  return Utilities.formatDate(new Date(), CONFIG.TZ, 'dd.MM.yyyy');
}

function resolveSendPanelStateDate_(arg) {
  if (!arg) return getSendPanelToday_();

  if (Object.prototype.toString.call(arg) === '[object Date]' && !isNaN(arg.getTime())) {
    return Utilities.formatDate(arg, CONFIG.TZ, 'dd.MM.yyyy');
  }

  if (typeof arg === 'string') {
    const s = String(arg).trim();

    if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) {
      return s;
    }

    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
      return Utilities.formatDate(parsed, CONFIG.TZ, 'dd.MM.yyyy');
    }
  }

  return getSendPanelToday_();
}

function getSendPanelStateStoreKey_(dateStr) {
  return SEND_PANEL_STATE_STORE_PREFIX_ + resolveSendPanelStateDate_(dateStr);
}

/**
 * compatibility alias
 */
function getSendPanelSentStoreKey_(dateStr) {
  return getSendPanelStateStoreKey_(dateStr);
}

/**
 * legacy helper:
 * читає чекбокси прямо з листа SEND_PANEL
 * потрібен лише як fallback для старого коду
 */
function readSendPanelSentMap_(panel) {
  const map = {};
  if (!panel || typeof panel.getLastRow !== 'function') return map;

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
    if (!fio || !code) return;

    const key = makeSendPanelKey_(fio, phone, code);
    map[key] = (sent === true || String(sent).toUpperCase() === 'TRUE');
  });

  return map;
}

/**
 * основна функція:
 * читає стан відправки ПО ДАТІ із ScriptProperties
 *
 * arg може бути:
 * - undefined
 * - рядок dd.MM.yyyy
 * - Date
 * - sheet/panel (тоді спрацює fallback зі sheet)
 */
function readSendPanelStateMap_(arg) {
  const dateStr = resolveSendPanelStateDate_(arg);
  const raw = PropertiesService.getScriptProperties().getProperty(getSendPanelStateStoreKey_(dateStr));

  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    } catch (e) { }
  }

  // fallback для старого коду: якщо передали panel/sheet
  if (arg && typeof arg.getLastRow === 'function') {
    const mapFromSheet = readSendPanelSentMap_(arg) || {};
    writeSendPanelStateMap_(dateStr, mapFromSheet);
    return mapFromSheet;
  }

  return {};
}

/**
 * compatibility alias
 */
function readSendPanelSentMapForDate_(dateStr) {
  return readSendPanelStateMap_(dateStr);
}

function writeSendPanelStateMap_(arg, map) {
  const dateStr = resolveSendPanelStateDate_(arg);
  const safeMap = (map && typeof map === 'object') ? map : {};

  PropertiesService.getScriptProperties().setProperty(
    getSendPanelStateStoreKey_(dateStr),
    JSON.stringify(safeMap)
  );

  return true;
}

/**
 * compatibility alias
 */
function writeSendPanelSentMapForDate_(dateStr, map) {
  return writeSendPanelStateMap_(dateStr, map);
}

function clearSendPanelStateMap_(arg) {
  const dateStr = resolveSendPanelStateDate_(arg);
  PropertiesService.getScriptProperties().deleteProperty(getSendPanelStateStoreKey_(dateStr));
  return true;
}

function resetSendPanelTodayState_() {
  const ok = clearSendPanelStateMap_(getSendPanelToday_());
  const panel = SpreadsheetApp.getActive().getSheetByName(CONFIG.SEND_PANEL_SHEET);
  if (panel) normalizeSendPanelDailyState_(panel);
  return ok;
}

function cleanupOldSendPanelStateMaps_(keepDays) {
  const props = PropertiesService.getScriptProperties();
  const all = props.getProperties();
  const now = new Date();
  const keep = Math.max(1, Number(keepDays || 7));

  Object.keys(all).forEach(key => {
    if (String(key).indexOf(SEND_PANEL_STATE_STORE_PREFIX_) !== 0) return;

    const dateStr = key.substring(SEND_PANEL_STATE_STORE_PREFIX_.length);
    const m = String(dateStr).match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (!m) return;

    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    if (isNaN(d.getTime())) return;

    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays > keep) {
      props.deleteProperty(key);
    }
  });

  return true;
}

/**
 * compatibility alias
 */
function cleanupOldSendPanelSentState_(keepDays) {
  return cleanupOldSendPanelStateMaps_(keepDays);
}

function ensureSendPanelStructure_(panel, botMonth, panelDate) {
  panel.clearContents();

  const safeMonth = String(botMonth || '').trim();
  const safeDate = assertUaDateString_(panelDate || resolveSendPanelStateDate_(panelDate || getSendPanelToday_()));

  panel.getRange(1, 1, 1, 7)
    .merge()
    .setValue(`🤖 Активний місяць: ${safeMonth} | Дата панелі: ${safeDate}`)
    .setFontWeight('bold')
    .setFontSize(14)
    .setHorizontalAlignment('center')
    .setBackground('#fff3cd');

  panel.getRange(CONFIG.SEND_PANEL_HEADER_ROW, 1, 1, 7)
    .setValues([['ПІБ', 'Телефон', 'Код', 'Завдання', 'Статус', 'Дія', 'Відправлено']])
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setBackground('#f0f0f0');

  setSendPanelMetadata_(panel, safeMonth, safeDate);
}

function setSendPanelMetadata_(panel, botMonth, panelDate) {
  if (!panel) return false;
  panel.getRange(SendPanelConstants_.METADATA_MONTH_CELL).setValue(String(botMonth || '').trim());
  panel.getRange(SendPanelConstants_.METADATA_DATE_CELL).setValue(assertUaDateString_(panelDate || getSendPanelToday_()));
  return true;
}

function getSendPanelMetadata_(panel) {
  const sheet = panel || SpreadsheetApp.getActive().getSheetByName(CONFIG.SEND_PANEL_SHEET);
  if (!sheet) {
    return { month: '', date: '', hasMetadata: false };
  }

  const month = String(sheet.getRange(SendPanelConstants_.METADATA_MONTH_CELL).getDisplayValue() || '').trim();
  const rawDate = String(sheet.getRange(SendPanelConstants_.METADATA_DATE_CELL).getDisplayValue() || '').trim();
  const safeDate = /^\d{2}\.\d{2}\.\d{4}$/.test(rawDate) ? rawDate : '';

  return {
    month: month,
    date: safeDate,
    hasMetadata: !!(month || safeDate)
  };
}

function readSendPanelStateObjectMap_(panel) {
  const map = {};
  const sheet = panel || SpreadsheetApp.getActive().getSheetByName(CONFIG.SEND_PANEL_SHEET);
  if (!sheet || typeof sheet.getLastRow !== 'function') return map;

  const last = sheet.getLastRow();
  if (last < CONFIG.SEND_PANEL_DATA_START_ROW) return map;

  const rowCount = last - (CONFIG.SEND_PANEL_DATA_START_ROW - 1);
  const values = sheet.getRange(CONFIG.SEND_PANEL_DATA_START_ROW, 1, rowCount, 7).getDisplayValues();
  const formulas = sheet.getRange(CONFIG.SEND_PANEL_DATA_START_ROW, 6, rowCount, 1).getFormulas().flat();
  const sentValues = sheet.getRange(CONFIG.SEND_PANEL_DATA_START_ROW, 7, rowCount, 1).getValues().flat();

  values.forEach(function(row, index) {
    const fio = String(row[0] || '').trim();
    const phone = String(row[1] || '').replace(/^'/, '').trim();
    const code = String(row[2] || '').trim();
    if (!fio || !code) return;

    const key = makeSendPanelKey_(fio, phone, code);
    const normalizedStatus = normalizeSendPanelStatus_(row[4]);
    const sent = sentValues[index] === true || String(sentValues[index]).toUpperCase() === 'TRUE' || isSendPanelSentStatusValue_(normalizedStatus);

    map[key] = {
      status: normalizedStatus,
      sent: !!sent,
      link: extractHyperlinkUrl_(formulas[index] || '')
    };
  });

  return map;
}

function normalizeSendPanelDailyState_(panel) {
  panel = panel || SpreadsheetApp.getActive().getSheetByName(CONFIG.SEND_PANEL_SHEET);
  if (!panel) return false;

  const last = panel.getLastRow();
  if (last < CONFIG.SEND_PANEL_DATA_START_ROW) return true;

  const rowCount = last - (CONFIG.SEND_PANEL_DATA_START_ROW - 1);
  const values = panel.getRange(CONFIG.SEND_PANEL_DATA_START_ROW, 1, rowCount, 7).getDisplayValues();
  const formulas = panel.getRange(CONFIG.SEND_PANEL_DATA_START_ROW, 6, rowCount, 1).getFormulas().flat();
  const sentMap = readSendPanelStateMap_(getSendPanelToday_());

  const statuses = [];
  const sentFlags = [];

  for (let i = 0; i < rowCount; i++) {
    const fio = String(values[i][0] || '').trim();
    const phone = String(values[i][1] || '').replace(/^'/, '').trim();
    const code = String(values[i][2] || '').trim();
    const currentStatus = String(values[i][4] || '').trim();
    const link = extractHyperlinkUrl_(formulas[i] || '');

    if (!fio || !code) {
      statuses.push([currentStatus]);
      sentFlags.push([false]);
      continue;
    }

    if (currentStatus.indexOf(getSendPanelErrorPrefix_()) === 0) {
      statuses.push([currentStatus]);
      sentFlags.push([false]);
      continue;
    }

    const key = makeSendPanelKey_(fio, phone, code);
    const sentToday = (sentMap[key] === true);

    statuses.push([sentToday ? getSendPanelSentStatus_() : getSendPanelReadyStatus_()]);
    sentFlags.push([sentToday && !!link]);
  }

  panel.getRange(CONFIG.SEND_PANEL_DATA_START_ROW, 7, rowCount, 1).insertCheckboxes();
  panel.getRange(CONFIG.SEND_PANEL_DATA_START_ROW, 5, rowCount, 1).setValues(statuses);
  panel.getRange(CONFIG.SEND_PANEL_DATA_START_ROW, 7, rowCount, 1).setValues(sentFlags);

  return true;
}

function rebuildSendPanelCore_() {
  cleanupOldSendPanelStateMaps_(7);

  const ss = SpreadsheetApp.getActive();
  const source = getBotSheet_();
  let panel = ss.getSheetByName(CONFIG.SEND_PANEL_SHEET);
  if (!panel) panel = ss.insertSheet(CONFIG.SEND_PANEL_SHEET);

  const botMonth = getBotMonthSheetName_();
  ensureSendPanelStructure_(panel, botMonth);

  const phones = loadPhonesMap_();
  const dict = loadDictMap_();
  const today = getSendPanelToday_();
  const sentMap = readSendPanelStateMap_(today);

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
      const linkFormula = payload.link
        ? `=HYPERLINK("${payload.link}"; "📱 НАДІСЛАТИ")`
        : '';

      const key = makeSendPanelKey_(payload.fio, payload.phone, payload.code);
      const sentToday = sentMap[key] === true;

      let formattedPhone = String(payload.phone || '').trim();
      if (formattedPhone.startsWith('+')) {
        formattedPhone = "'" + formattedPhone;
      }

      rows.push([
        payload.fio,
        formattedPhone || '—',
        payload.code,
        payload.tasks || '—',
        sentToday ? getSendPanelSentStatus_() : getSendPanelReadyStatus_(),
        linkFormula,
        sentToday
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

  normalizeSendPanelDailyState_(panel);

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

  normalizeSendPanelDailyState_(panel);

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
    date: meta && meta.date ? meta.date : getSendPanelToday_()
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

function sendAllFromSendPanel() {
  const ui = SpreadsheetApp.getUi();
  const panel = SpreadsheetApp.getActive().getSheetByName(CONFIG.SEND_PANEL_SHEET);
  if (!panel) return ui.alert('❌ Спочатку створіть панель');

  normalizeSendPanelDailyState_(panel);

  const last = panel.getLastRow();
  if (last < CONFIG.SEND_PANEL_DATA_START_ROW) return ui.alert('❌ Панель порожня');

  const countRows = last - (CONFIG.SEND_PANEL_DATA_START_ROW - 1);
  const values = panel.getRange(CONFIG.SEND_PANEL_DATA_START_ROW, 1, countRows, 7).getDisplayValues();
  const formulas = panel.getRange(CONFIG.SEND_PANEL_DATA_START_ROW, 6, countRows, 1).getFormulas().flat();
  const sent = panel.getRange(CONFIG.SEND_PANEL_DATA_START_ROW, 7, countRows, 1).getValues().flat();

  const items = [];
  for (let i = 0; i < countRows; i++) {
    if (sent[i] === true) continue;

    const status = String(values[i][4] || '').trim();
    if (status.indexOf(getSendPanelErrorPrefix_()) === 0) continue;

    const url = extractHyperlinkUrl_(formulas[i]);
    if (url && url.startsWith('https://wa.me/')) {
      items.push({
        url: url,
        row: CONFIG.SEND_PANEL_DATA_START_ROW + i,
        fio: String(values[i][0] || '').trim(),
        phone: String(values[i][1] || '').replace(/^'/, '').trim(),
        code: String(values[i][2] || '').trim(),
        tasks: String(values[i][3] || '').trim()
      });
    }
  }

  if (!items.length) return ui.alert('✅ На сьогодні все вже підтверджено як відправлене');
  showSendPanelDialog_(items);
}

function markSendPanelSent_(row) {
  const panel = SpreadsheetApp.getActive().getSheetByName(CONFIG.SEND_PANEL_SHEET);
  if (!panel) return false;

  const fio = String(panel.getRange(row, 1).getDisplayValue() || '').trim();
  const phone = String(panel.getRange(row, 2).getDisplayValue() || '').replace(/^'/, '').trim();
  const code = String(panel.getRange(row, 3).getDisplayValue() || '').trim();
  const status = String(panel.getRange(row, 5).getDisplayValue() || '').trim();

  if (!fio || !code) return false;
  if (status.indexOf(getSendPanelErrorPrefix_()) === 0) return false;

  const key = makeSendPanelKey_(fio, phone, code);
  const dateStr = getSendPanelToday_();
  const map = readSendPanelStateMap_(dateStr);

  map[key] = true;
  writeSendPanelStateMap_(dateStr, map);

  panel.getRange(row, 7).insertCheckboxes().setValue(true);
  panel.getRange(row, 5).setValue(getSendPanelSentStatus_());

  return true;
}

function markSendPanelUnsent_(row) {
  const panel = SpreadsheetApp.getActive().getSheetByName(CONFIG.SEND_PANEL_SHEET);
  if (!panel) return false;

  const fio = String(panel.getRange(row, 1).getDisplayValue() || '').trim();
  const phone = String(panel.getRange(row, 2).getDisplayValue() || '').replace(/^'/, '').trim();
  const code = String(panel.getRange(row, 3).getDisplayValue() || '').trim();
  const status = String(panel.getRange(row, 5).getDisplayValue() || '').trim();

  if (!fio || !code) return false;
  if (status.indexOf(getSendPanelErrorPrefix_()) === 0) return false;

  const key = makeSendPanelKey_(fio, phone, code);
  const dateStr = getSendPanelToday_();
  const map = readSendPanelStateMap_(dateStr);

  delete map[key];
  writeSendPanelStateMap_(dateStr, map);

  panel.getRange(row, 7).insertCheckboxes().setValue(false);
  panel.getRange(row, 5).setValue(getSendPanelReadyStatus_());

  return true;
}

function showSendPanelDialog_(items) {
  items = Array.isArray(items) ? items : [];
  const safeJson = JSON.stringify(items);
  const safeTarget = JSON.stringify(getSendPanelWhatsAppTarget_());

  const html = HtmlService.createHtmlOutput(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body{
      font-family:Arial,sans-serif;
      padding:16px;
      background:#f7f7f7;
      color:#222;
    }
    h3{
      margin:0 0 14px;
      color:#075e54;
    }
    .card{
      background:#fff;
      border:1px solid #ddd;
      border-radius:12px;
      padding:14px;
      margin-bottom:14px;
      box-shadow:0 1px 4px rgba(0,0,0,.06);
    }
    .meta{
      display:grid;
      grid-template-columns:110px 1fr;
      gap:8px 10px;
      font-size:13px;
      line-height:1.35;
    }
    .meta b{
      color:#555;
    }
    .stats{
      background:#eef7f1;
      border:1px solid #cfe8d7;
      border-radius:10px;
      padding:12px;
      margin-bottom:14px;
      font-size:13px;
    }
    .buttons{
      display:flex;
      flex-wrap:wrap;
      gap:10px;
      margin:14px 0;
    }
    button{
      padding:11px 16px;
      border:none;
      border-radius:10px;
      font-weight:bold;
      cursor:pointer;
      transition:.15s;
    }
    button:hover{
      transform:translateY(-1px);
    }
    button:disabled{
      opacity:.6;
      cursor:not-allowed;
      transform:none;
    }
    .btn-wa{background:#25D366;color:#fff;}
    .btn-open{background:#0d6efd;color:#fff;}
    .btn-ok{background:#198754;color:#fff;}
    .btn-no{background:#dc3545;color:#fff;}
    .btn-skip{background:#6c757d;color:#fff;}
    .btn-close{background:#343a40;color:#fff;}
    .hint{
      font-size:12px;
      color:#666;
      margin-top:6px;
    }
    #log{
      background:#111;
      color:#d6f5d6;
      border-radius:10px;
      padding:12px;
      height:220px;
      overflow-y:auto;
      font-family:Consolas,Monaco,monospace;
      font-size:12px;
      white-space:pre-wrap;
      line-height:1.45;
    }
    .done{
      color:#198754;
      font-weight:bold;
    }
  </style>
</head>
<body>
  <h3>📤 Підтвердження відправки WhatsApp</h3>

  <div class="stats">
    <div><b>Схема роботи:</b> спочатку відкриваєш повідомлення у WhatsApp, потім після фактичної відправки повертаєшся сюди і тиснеш <b>Підтверджено</b>.</div>
    <div class="hint">Використовується одна і та сама вкладка WhatsApp. Нові вкладки на кожне повідомлення не плодяться.</div>
  </div>

  <div class="card">
    <div id="progress"></div>
    <div class="meta" id="meta"></div>
  </div>

  <div class="buttons">
    <button class="btn-wa" id="btnPrepare">🟢 Підготувати вкладку WhatsApp</button>
    <button class="btn-open" id="btnOpen">📱 Відкрити поточне</button>
    <button class="btn-ok" id="btnConfirm">✅ Підтверджено</button>
    <button class="btn-no" id="btnReject">↩️ Не відправлено</button>
    <button class="btn-skip" id="btnSkip">⏭️ Пропустити</button>
    <button class="btn-close" id="btnClose">✖ Закрити</button>
  </div>

  <div id="log">Готово до роботи...</div>

  <script>
    const items = ${safeJson};
    const WA_TARGET = ${safeTarget};
    let currentIndex = 0;

    const progressEl = document.getElementById('progress');
    const metaEl = document.getElementById('meta');
    const logEl = document.getElementById('log');

    const btnPrepare = document.getElementById('btnPrepare');
    const btnOpen = document.getElementById('btnOpen');
    const btnConfirm = document.getElementById('btnConfirm');
    const btnReject = document.getElementById('btnReject');
    const btnSkip = document.getElementById('btnSkip');
    const btnClose = document.getElementById('btnClose');

    function log(message){
      const time = new Date().toLocaleTimeString();
      logEl.textContent += "\\n[" + time + "] " + message;
      logEl.scrollTop = logEl.scrollHeight;
    }

    function escapeHtml(s){
      return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    function getCurrentItem(){
      return items[currentIndex] || null;
    }

    function renderCurrent(){
      const item = getCurrentItem();

      if (!item) {
        progressEl.innerHTML = '<span class="done">✅ Усі записи оброблені</span>';
        metaEl.innerHTML = '<div><b>Статус</b></div><div>Більше немає повідомлень у черзі.</div>';
        btnOpen.disabled = true;
        btnConfirm.disabled = true;
        btnReject.disabled = true;
        btnSkip.disabled = true;
        return;
      }

      progressEl.innerHTML =
        '<b>Поточний запис:</b> ' + (currentIndex + 1) + ' / ' + items.length +
        ' &nbsp; | &nbsp; <b>Залишилось:</b> ' + (items.length - currentIndex);

      metaEl.innerHTML =
        '<b>ПІБ</b><div>' + escapeHtml(item.fio || '—') + '</div>' +
        '<b>Телефон</b><div>' + escapeHtml(item.phone || '—') + '</div>' +
        '<b>Код</b><div>' + escapeHtml(item.code || '—') + '</div>' +
        '<b>Завдання</b><div>' + escapeHtml(item.tasks || '—') + '</div>';
    }

    function prepareWhatsAppTab(){
      try {
        window.open('https://web.whatsapp.com/', WA_TARGET);
        log('🟢 Вкладка WhatsApp підготовлена: ' + WA_TARGET);
      } catch (e) {
        log('❌ Не вдалося відкрити вкладку WhatsApp: ' + (e && e.message ? e.message : e));
      }
    }

    function openCurrent(){
      const item = getCurrentItem();
      if (!item) {
        log('✅ Черга порожня');
        return;
      }

      try {
        window.open(item.url, WA_TARGET);
        log('📱 Відкрито у вкладці WhatsApp: ' + (item.fio || 'без імені'));
      } catch (e) {
        log('❌ Не вдалося відкрити повідомлення: ' + (e && e.message ? e.message : e));
      }
    }

    function confirmCurrent(){
      const item = getCurrentItem();
      if (!item) return;

      google.script.run
        .withSuccessHandler(function(){
          log('✅ Підтверджено як відправлене: ' + (item.fio || 'без імені'));
          currentIndex++;
          renderCurrent();
        })
        .withFailureHandler(function(err){
          log('❌ Помилка підтвердження: ' + (err && err.message ? err.message : err));
        })
        .markSendPanelSent_(item.row);
    }

    function rejectCurrent(){
      const item = getCurrentItem();
      if (!item) return;

      google.script.run
        .withSuccessHandler(function(){
          log('↩️ Позначено як НЕ відправлене: ' + (item.fio || 'без імені'));
          currentIndex++;
          renderCurrent();
        })
        .withFailureHandler(function(err){
          log('❌ Помилка скидання статусу: ' + (err && err.message ? err.message : err));
        })
        .markSendPanelUnsent_(item.row);
    }

    function skipCurrent(){
      const item = getCurrentItem();
      if (!item) return;

      log('⏭️ Пропущено: ' + (item.fio || 'без імені'));
      currentIndex++;
      renderCurrent();
    }

    btnPrepare.addEventListener('click', prepareWhatsAppTab);
    btnOpen.addEventListener('click', openCurrent);
    btnConfirm.addEventListener('click', confirmCurrent);
    btnReject.addEventListener('click', rejectCurrent);
    btnSkip.addEventListener('click', skipCurrent);
    btnClose.addEventListener('click', function(){ google.script.host.close(); });

    renderCurrent();
  </script>
</body>
</html>
  `).setWidth(760).setHeight(620);

  SpreadsheetApp.getUi().showModalDialog(html, '🚀 Підтвердження відправки');
}
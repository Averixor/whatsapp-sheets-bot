/************ МІСЯЧНІ АРКУШІ ************/
function _inferMonthYearFromSheet_(sheet) {
  const ref = sheet.getRange(CONFIG.CODE_RANGE_A1);
  const row = Number(CONFIG.DATE_ROW) || 1;
  const startCol = ref.getColumn();
  const endCol = ref.getLastColumn();
  const vals = sheet.getRange(row, startCol, 1, endCol - startCol + 1).getValues()[0];
  const disp = sheet.getRange(row, startCol, 1, endCol - startCol + 1).getDisplayValues()[0];

  for (let i = 0; i < vals.length; i++) {
    try {
      const ddmmyyyy = normalizeDate_(vals[i], disp[i]);
      const m = ddmmyyyy.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
      if (m) {
        const mm = parseInt(m[2], 10);
        const yy = parseInt(m[3], 10);
        if (mm >= 1 && mm <= 12 && yy >= 2000) return { month: mm, year: yy };
      }
    } catch (e) { }
  }

  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

function _setMonthDatesRow_(sheet, month, year) {
  const ref = sheet.getRange(CONFIG.CODE_RANGE_A1);
  const row = Number(CONFIG.DATE_ROW) || 1;
  const startCol = ref.getColumn();
  const width = ref.getLastColumn() - startCol + 1;

  const daysInMonth = new Date(year, month, 0).getDate();
  const out = new Array(width).fill('');

  const n = Math.min(width, daysInMonth);
  for (let d = 1; d <= n; d++) {
    out[d - 1] = new Date(year, month - 1, d);
  }

  sheet.getRange(row, startCol, 1, width).setValues([out]);
}

function createNextMonthSheet() {
  const ui = SpreadsheetApp.getUi();
  try {
    const ss = SpreadsheetApp.getActive();
    const src = ss.getActiveSheet();
    const srcName = String(src.getName()).trim();

    if (!/^\d{2}$/.test(srcName)) {
      throw new Error(`Активний лист "${srcName}" не є місячним. Потрібна назва виду "02", "03", "04"...`);
    }

    let nextNum = parseInt(srcName, 10) + 1;
    if (nextNum > 12) nextNum = 1;
    if (nextNum < 1) nextNum = 1;

    const nextName = String(nextNum).padStart(2, '0');

    if (ss.getSheetByName(nextName)) {
      throw new Error(`Лист "${nextName}" вже існує. Я його не перезаписую.`);
    }

    const newSheet = src.copyTo(ss).setName(nextName);

    const srcMY = _inferMonthYearFromSheet_(src);
    const targetMonth = nextNum;
    const targetYear = (targetMonth < srcMY.month) ? (srcMY.year + 1) : srcMY.year;

    _setMonthDatesRow_(newSheet, targetMonth, targetYear);
    newSheet.getRange(CONFIG.CODE_RANGE_A1).clearContent();

    applyGlobalSheetStandards_();
    newSheet.activate();
    highlightActiveMonthTab_(nextName);

    ui.alert('✅', `Створено "${nextName}" на основі "${srcName}"`, ui.ButtonSet.OK);
  } catch (error) {
    ui.alert('❌ Помилка', String(error), ui.ButtonSet.OK);
    console.error(error);
  }
}

/************ ПЕРЕМИКАННЯ БОТА НА ІНШИЙ МІСЯЦЬ ************/
function switchBotToSheet() {
  const ss = SpreadsheetApp.getActive();
  const months = ss.getSheets().map(s => s.getName()).filter(n => /^\d{2}$/.test(n)).sort();
  if (!months.length) return SpreadsheetApp.getUi().alert('❌ Немає аркушів місяців (01..12)');

  const current = getBotMonthSheetName_();
  const options = months.map(n => `<option value="${n}" ${n === current ? 'selected' : ''}>${n}</option>`).join('');

  const html = HtmlService.createHtmlOutput(`
    <div style="font-family:Arial;padding:16px">
      <h3 style="margin:0 0 12px;color:#075e54">🔁 Перемкнути бота на місяць</h3>
      <div style="margin:10px 0">
        <div style="font-size:12px;color:#666;margin-bottom:6px">Поточний: <b>${escapeHtml_(current)}</b></div>
        <select id="m" style="padding:10px;width:100%;border:1px solid #ddd;border-radius:10px;font-size:16px">
          ${options}
        </select>
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:14px">
        <button onclick="google.script.host.close()" style="padding:10px 14px;border:1px solid #ddd;border-radius:10px;background:#f8f9fa;cursor:pointer">Скасувати</button>
        <button onclick="go()" style="padding:10px 16px;border:0;border-radius:10px;background:#25D366;color:#fff;font-weight:bold;cursor:pointer">✅ Перемкнути</button>
      </div>
      <script>
        function go(){
          const v = document.getElementById('m').value;
          google.script.run.withSuccessHandler(()=>google.script.host.close()).switchBotToMonth_(v);
        }
      </script>
    </div>
  `).setWidth(420).setHeight(240);

  SpreadsheetApp.getUi().showModalDialog(html, '🔁 Перемикання');
}

function switchBotToMonth_(monthSheetName) {
  setBotMonthSheetName_(monthSheetName);
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(monthSheetName);
  if (sh) sh.activate();
  SpreadsheetApp.getUi().toast(`Бот активний: ${monthSheetName}`, ' WhatsApp-Sheets-Bot', 3);
}
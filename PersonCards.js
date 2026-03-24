const PERSON_PHONE_COL = 1;
const PERSON_CALLSIGN_COL = 2;
const PERSON_POSITION_COL = 3;
const PERSON_OSHS_COL = 4;
const PERSON_RANK_COL = 5;
const PERSON_BR_DAYS_COL = 6;
const PERSON_FIO_COL = 7;

function _getSheetByDateStr_(dateStr) {
  const d = _parseUaDate_(dateStr);
  const ss = SpreadsheetApp.getActive();
  if (d) {
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const sh = ss.getSheetByName(mm);
    if (sh) return sh;
  }
  return getBotSheet_();
}

function _getPrevMonthSheetByDateStr_(dateStr) {
  const d = _parseUaDate_(dateStr);
  if (!d) return null;
  const ss = SpreadsheetApp.getActive();
  const prev = new Date(d);
  prev.setMonth(prev.getMonth() - 1);
  const mm = String(prev.getMonth() + 1).padStart(2, '0');
  return ss.getSheetByName(mm);
}

function _findRowByCallsign_(sheet, callsign) {
  const ref = sheet.getRange(CONFIG.CODE_RANGE_A1);
  const startRow = ref.getRow();
  const numRows = ref.getNumRows();
  const values = sheet.getRange(startRow, PERSON_CALLSIGN_COL, numRows, 1).getValues();
  const key = _normCallsignKey_(callsign);
  for (let i = 0; i < values.length; i++) {
    const v = _normCallsignKey_(values[i][0]);
    if (v && v === key) return startRow + i;
  }
  return null;
}

function _formatPhoneDisplay_(phone) {
  if (!phone || phone === '—') return '—';
  const d = String(phone).replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('380')) {
    return `+380 ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10, 12)}`;
  }
  return String(phone);
}

function getNextVacationForFio_(fio) {
  return VacationsRepository_.getNextForFio(fio, _todayStr_());
}

function getVacationInfoByFio_(fio, dateStr) {
  return VacationsRepository_.getCurrentForFio(fio, dateStr);
}

function getPersonGroupForDate_(sheet, row, dateStr) {
  const col = findTodayColumn_(sheet, dateStr);
  if (col === -1) return '—';
  const codeRef = sheet.getRange(CONFIG.CODE_RANGE_A1);
  if (row < codeRef.getRow() || row > codeRef.getLastRow()) return '—';
  const code = String(sheet.getRange(row, col).getDisplayValue() || '').trim();
  if (!code) return '—';
  for (const [group, codes] of Object.entries(SUMMARY_GROUPS)) {
    if (codes.includes(code)) return displayNameForCode_(group);
  }
  return displayNameForCode_(code) || 'Інше';
}

function _buildPersonCardData_(callsign, dateStr) {
  const data = PersonsRepository_.getPersonByCallsign(callsign, dateStr);
  return Object.assign({ ok: true }, data);
}

function getPersonCardData(callsign, dateStr) {
  const context = { function: 'getPersonCardData', callsign: callsign || '', date: dateStr || '' };
  try {
    const data = PersonsRepository_.getPersonByCallsign(callsign, dateStr);
    return Object.assign(okResponse_(data, 'Дані картки завантажено', context), data, { ok: true });
  } catch (e) {
    return Object.assign(errorResponse_(e, context), { ok: false });
  }
}

function openPersonCardByCallsign_(callsign) {
  return openPersonCardByCallsignAndDate_(callsign, _todayStr_());
}

function openPersonCardByCallsignAndDate_(callsign, dateStr) {
  const data = getPersonCardData(callsign, dateStr);
  if (!data || !data.ok) {
    throw new Error(data && data.error ? data.error : 'Не вдалося відкрити картку');
  }

  const currentVacHtml = data.vac && data.vac.inVacation && Array.isArray(data.vac.matches)
    ? `<div style="margin-top:14px;padding:12px;border-radius:12px;background:#fff3cd;border:1px solid #ffc107;">
        <b>Відпустка зараз</b><br>
        ${data.vac.matches.map(v => `${escapeHtml_(v.no)}: ${escapeHtml_(v.start)} — ${escapeHtml_(v.end)}`).join('<br>')}
      </div>`
    : '';

  const nextVacHtml = data.nextVacation
    ? `<div style="margin-top:14px;padding:12px;border-radius:12px;background:#e3f2fd;border:1px solid #2196F3;">
        <b>Найближча відпустка</b><br>
        ${escapeHtml_(data.nextVacation.word || '—')}<br>
        ${escapeHtml_(data.nextVacation.start || '—')} — ${escapeHtml_(data.nextVacation.end || '—')}<br>
        Залишилось: ${escapeHtml_(String(data.nextVacation.daysUntil ?? '—'))} дн.
      </div>`
    : '';

  const htmlContent = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8">
        <base target="_top">
        <style>
          body {
            font-family: Arial;
            margin: 0;
            padding: 12px;
            background: #0f172a;
            color: #f8fafc;
          }
          .card {
            background: #111827;
            border: 1px solid #334155;
            border-radius: 16px;
            padding: 16px;
          }
          .title {
            font-size: 22px;
            font-weight: 700;
            margin-bottom: 6px;
          }
          .sub {
            color: #94a3b8;
            margin-bottom: 14px;
          }
          .grid {
            display: grid;
            grid-template-columns: 120px 1fr;
            gap: 8px 12px;
            font-size: 13px;
          }
          .lbl {
            color: #94a3b8;
          }
          .val {
            word-break: break-word;
          }
          .actions {
            display: flex;
            gap: 8px;
            margin-top: 16px;
            flex-wrap: wrap;
          }
          .btn {
            padding: 10px 14px;
            border-radius: 999px;
            border: 1px solid #334155;
            background: #1f2937;
            color: #fff;
            text-decoration: none;
            cursor: pointer;
            font-weight: 700;
          }
          .btn.primary {
            background: #0ea5e9;
            border-color: #0ea5e9;
          }
          pre {
            white-space: pre-wrap;
            background: #0b1220;
            border: 1px solid #334155;
            border-radius: 12px;
            padding: 12px;
            margin-top: 14px;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="title">${escapeHtml_(data.callsign)}</div>
          <div class="sub">${escapeHtml_(data.dateStr)}</div>

          <div class="grid">
            <div class="lbl">ПІБ</div>
            <div class="val">${escapeHtml_(data.fio)}</div>

            <div class="lbl">Звання</div>
            <div class="val">${escapeHtml_(data.rank)}</div>

            <div class="lbl">Посада</div>
            <div class="val">${escapeHtml_(data.position)}</div>

            <div class="lbl">ОШС</div>
            <div class="val">${escapeHtml_(data.oshs)}</div>

            <div class="lbl">Телефон</div>
            <div class="val">${escapeHtml_(data.phoneDisplay)}</div>

            <div class="lbl">ДН</div>
            <div class="val">${escapeHtml_(data.birthday)}</div>

            <div class="lbl">Група</div>
            <div class="val">${escapeHtml_(data.todayGroup)}</div>

            <div class="lbl">БР цей місяць</div>
            <div class="val">${escapeHtml_(data.brDaysThisMonth)}</div>

            <div class="lbl">БР минулий</div>
            <div class="val">${escapeHtml_(data.brDaysPrevMonth)}</div>
          </div>

          ${currentVacHtml}
          ${nextVacHtml}

          <div class="actions">
            ${data.waLink ? `<a class="btn primary" href="${data.waLink}" target="WAPB_WHATSAPP_SENDER_TAB">WhatsApp</a>` : ''}
            <button class="btn" onclick="navigator.clipboard.writeText(document.getElementById('msg').innerText)">Копіювати</button>
            <button class="btn" onclick="openCalendar()">Календар</button>
            <button class="btn" onclick="openMainSidebar()">В меню</button>
          </div>

          <pre id="msg">${escapeHtml_(data.message || '')}</pre>
        </div>
        <script>
          function normalizeError(error) {
            if (!error) return 'Невідома помилка';
            if (typeof error === 'string') return error;
            if (error.message) return String(error.message);
            return String(error);
          }
          function gsRun(method) {
            const args = Array.prototype.slice.call(arguments, 1);
            return new Promise((resolve, reject) => {
              try {
                let runner = google.script.run
                  .withSuccessHandler(resolve)
                  .withFailureHandler(err => reject(normalizeError(err)));
                if (typeof runner[method] !== 'function') {
                  reject('Метод не знайдено: ' + method);
                  return;
                }
                runner[method].apply(runner, args);
              } catch (error) {
                reject(normalizeError(error));
              }
            });
          }
          function openCalendar() {
            gsRun('openPersonCalendar', '${escapeHtml_(data.callsign)}')
              .catch(err => alert('❌ ' + normalizeError(err)));
          }
          function openMainSidebar() {
            gsRun('showSidebar')
              .catch(err => alert('❌ ' + normalizeError(err)));
          }
        </script>
      </body>
    </html>
  `;

  const html = HtmlService.createHtmlOutput(htmlContent)
    .setTitle(`👤 ${data.callsign}`)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  SpreadsheetApp.getUi().showSidebar(html);
  return true;
}

function openPersonCalendar_(callsign) {
  const t = HtmlService.createTemplateFromFile('PersonCalendar');
  t.callsign = String(callsign || '').trim();
  t.today = _todayStr_();
  const html = t.evaluate()
    .setTitle(`📅 ${callsign}`)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  SpreadsheetApp.getUi().showSidebar(html);
}

function openPersonCalendar(callsign) {
  return openPersonCalendar_(callsign);
}

function openPersonCardByCallsignAndDate(callsign, dateStr) {
  return openPersonCardByCallsignAndDate_(callsign, dateStr);
}
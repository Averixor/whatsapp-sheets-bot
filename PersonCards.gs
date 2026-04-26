const PERSON_PHONE_COL = 1;
const PERSON_CALLSIGN_COL = 2;
const PERSON_POSITION_COL = 3;
const PERSON_OSHS_COL = 4;
const PERSON_RANK_COL = 5;
const PERSON_BR_DAYS_COL = 6;
const PERSON_FML_COL = 7;

function _personCardSafeHtml_(value) {
  var text = value === null || typeof value === 'undefined' ? '' : String(value);
  try {
    if (typeof HtmlUtils_ === 'object' && HtmlUtils_ && typeof HtmlUtils_.escapeHtml === 'function') {
      return HtmlUtils_.escapeHtml(text);
    }
  } catch (e) {}
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function _personCardJsString_(value) {
  return JSON.stringify(value === null || typeof value === 'undefined' ? '' : String(value));
}

function _getSheetByDateStr_(dateStr) {
  const d = DateUtils_.parseUaDate(dateStr);
  const ss = SpreadsheetApp.getActive();
  if (d) {
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const sh = ss.getSheetByName(mm);
    if (sh) return sh;
  }
  return getBotSheet_();
}

function _getPrevMonthSheetByDateStr_(dateStr) {
  const d = DateUtils_.parseUaDate(dateStr);
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

function getNextVacationForFml_(fml) {
  return VacationsRepository_.getNextForFml(fml, _todayStr_());
}

function getVacationInfoByFml_(fml, dateStr) {
  return VacationsRepository_.getCurrentForFml(fml, dateStr);
}

function getPersonGroupForDate_(sheet, row, dateStr) {
  const col = findTodayColumn_(sheet, dateStr);
  if (col === -1) return '—';
  const codeRef = sheet.getRange(CONFIG.CODE_RANGE_A1);
  if (row < codeRef.getRow() || row > codeRef.getLastRow()) return '—';
  const code = String(sheet.getRange(row, col).getDisplayValue() || '').trim();
  if (!code) return '—';
  for (const group of Object.keys(SUMMARY_GROUPS)) {
    const codes = SUMMARY_GROUPS[group];
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
    if (typeof AccessEnforcement_ === 'object' && AccessEnforcement_.assertCanOpenPersonCard) {
      AccessEnforcement_.assertCanOpenPersonCard(callsign || '', dateStr || '');
    }
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

  const escapedCallsign = _personCardSafeHtml_(data.callsign || '');
  const escapedDateStr = _personCardSafeHtml_(data.dateStr || '');
  const escapedFml = _personCardSafeHtml_(data.fml || '—');
  const escapedRank = _personCardSafeHtml_(data.rank || '—');
  const escapedPosition = _personCardSafeHtml_(data.position || '—');
  const escapedOshs = _personCardSafeHtml_(data.oshs || '—');
  const escapedPhoneDisplay = _personCardSafeHtml_(data.phoneDisplay || '—');
  const escapedBirthday = _personCardSafeHtml_(data.birthday || '—');
  const escapedTodayGroup = _personCardSafeHtml_(data.todayGroup || '—');
  const escapedBrDaysThisMonth = _personCardSafeHtml_(data.brDaysThisMonth || '—');
  const escapedBrDaysPrevMonth = _personCardSafeHtml_(data.brDaysPrevMonth || '—');
  const escapedMessage = _personCardSafeHtml_(data.message || '');
  const callsignJs = _personCardJsString_(data.callsign || '');
  const waLink = String(data.waLink || '').trim();

  const currentVacHtml = data.vac && data.vac.inVacation && Array.isArray(data.vac.matches)
    ? `<div class="vacation-card vacation-card-current">
        <div class="vacation-card-title">Відпустка зараз</div>
        <div class="vacation-card-list">${data.vac.matches.map(function(v) {
          return `<div class="vacation-card-line">${_personCardSafeHtml_(v.no || '—')}: ${_personCardSafeHtml_(v.start || '—')} — ${_personCardSafeHtml_(v.end || '—')}</div>`;})
          .join('')}
        </div>
      </div>`
    : '';

  const nextVacHtml = data.nextVacation
    ? `<div class="vacation-card vacation-card-next">
        <div class="vacation-card-title">Найближча відпустка</div>
        <div class="vacation-card-subtitle">${_personCardSafeHtml_(data.nextVacation.word || '—')}</div>
        <div class="vacation-card-dates">${_personCardSafeHtml_(data.nextVacation.start || '—')} — ${_personCardSafeHtml_(data.nextVacation.end || '—')}</div>
        <div class="vacation-card-remaining">Залишилось: ${_personCardSafeHtml_(String(data.nextVacation.daysUntil ?? '—'))} дн.</div>
      </div>`
    : '';

  const whatsappHtml = waLink
    ? `<a class="btn btn-primary action-button" id="waButton" href="${_personCardSafeHtml_(waLink)}" target="_blank" rel="noopener noreferrer">WhatsApp</a>`
    : '';

  const htmlContent = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8">
        <base target="_top">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          :root {
            --bg-primary: #0A0A0A;
            --bg-secondary: #141414;
            --bg-tertiary: #1E1E1E;
            --card-bg: #06152f;
            --card-border: #2f4f78;
            --text-primary: #FFFFFF;
            --text-secondary: #9fb2cb;
            --accent-blue: #2D72D2;
            --accent-blue-light: #3B82F6;
            --btn-bg: #1f2f49;
            --btn-border: #36557d;
            --danger: #ef4444;
            --radius: 16px;
          }

          * {
            box-sizing: border-box;
          }

          html,
          body {
            margin: 0;
            padding: 0;
            min-height: 100%;
          }

          body {
            font-family: Arial, sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            padding: 12px;
          }

          body.loading-active {
            overflow: hidden;
          }

          .card {
            background: linear-gradient(180deg, #07142d 0%, #08142c 100%);
            border: 1px solid var(--card-border);
            border-radius: 16px;
            padding: 14px;
            box-shadow: inset 0 0 0 1px rgba(86, 146, 222, 0.08);
          }

          .header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 10px;
            margin-bottom: 10px;
          }

          .title-wrap {
            min-width: 0;
            flex: 1;
          }

          .title {
            font-size: 22px;
            line-height: 1.1;
            font-weight: 700;
            color: #ffffff;
            margin: 0 0 8px 0;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .sub {
            color: #8fb0d8;
            font-size: 12px;
            margin: 0;
          }

          .close-btn {
            appearance: none;
            border: none;
            background: transparent;
            color: #8fb0d8;
            font-size: 22px;
            line-height: 1;
            cursor: pointer;
            padding: 2px 4px;
            flex-shrink: 0;
          }

          .close-btn:hover:not(:disabled) {
            color: #ffffff;
          }

          .info-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
            margin-top: 12px;
          }

          .info-item {
            display: block;
            min-width: 0;
          }

          .lbl {
            display: block;
            color: #9fb2cb;
            font-size: 12px;
            line-height: 1.2;
            margin: 0 0 4px 0;
          }

          .val {
            display: block;
            color: #ffffff;
            line-height: 1.35;
            word-break: break-word;
            font-weight: 600;
            font-size: 13px;
            margin: 0;
          }

          @media (max-width: 520px) {
            .card {
              padding: 12px;
            }
            .title {
              font-size: 20px;
            }
          }

          .vacation-card {
            margin-top: 14px;
            border-radius: 14px;
            padding: 14px 16px;
          }

          .vacation-card-current {
            background: #fff3cd;
            border: 1px solid #facc15;
          }

          .vacation-card-next {
            background: #dbeafe;
            border: 2px solid #60a5fa;
            box-shadow: inset 0 0 0 1px rgba(255,255,255,0.18);
          }

          .vacation-card,
          .vacation-card * {
            color: #0f172a !important;
          }

          .vacation-card-title {
            font-size: 0.98rem;
            font-weight: 700;
            line-height: 1.25;
            margin-bottom: 4px;
          }

          .vacation-card-subtitle {
            font-size: 0.9rem;
            font-weight: 600;
            color: #64748b !important;
            margin-bottom: 6px;
            line-height: 1.25;
          }

          .vacation-card-dates {
            font-size: 1rem;
            font-weight: 700;
            color: #0f172a !important;
            margin-bottom: 4px;
            line-height: 1.3;
          }

          .vacation-card-remaining {
            font-size: 0.9rem;
            font-weight: 600;
            color: #334155 !important;
            line-height: 1.25;
          }

          .vacation-card-list {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .vacation-card-line {
            font-size: 0.92rem;
            line-height: 1.35;
          }

          .actions {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            margin-top: 14px;
          }

          .btn {
            appearance: none;
            min-height: 38px;
            padding: 10px 14px;
            border-radius: 999px;
            border: 1px solid var(--btn-border);
            background: var(--btn-bg);
            color: #ffffff;
            font-size: 13px;
            font-weight: 700;
            line-height: 1;
            text-decoration: none;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.15s ease, opacity 0.15s ease, background 0.15s ease, border-color 0.15s ease;
          }

          .btn:hover:not(:disabled) {
            transform: translateY(-1px);
          }

          .btn:disabled {
            opacity: 0.65;
            cursor: not-allowed;
            transform: none;
          }

          .btn-primary {
            background: #0ea5e9;
            border-color: #0ea5e9;
            color: #ffffff;
          }

          .btn-primary:hover:not(:disabled) {
            background: #38bdf8;
            border-color: #38bdf8;
          }

          .inline-error {
            margin-top: 12px;
            min-height: 18px;
            color: var(--danger);
            font-size: 12px;
            display: none;
            white-space: pre-wrap;
            word-break: break-word;
          }

          .inline-error.visible {
            display: block;
          }

          pre {
            white-space: pre-wrap;
            background: #081124;
            border: 1px solid #2c4464;
            border-radius: 12px;
            padding: 12px;
            margin-top: 14px;
            color: #ffffff;
            overflow-x: auto;
            font-family: Georgia, 'Times New Roman', serif;
            font-size: 12px;
            line-height: 1.35;
          }

          .loading-overlay {
            position: fixed;
            inset: 0;
            background: rgba(10, 10, 10, 0.92);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            opacity: 0;
            visibility: hidden;
            pointer-events: none;
            transition: opacity 0.2s ease, visibility 0.2s ease;
            padding: 16px;
          }

          .loading-overlay.visible {
            opacity: 1;
            visibility: visible;
            pointer-events: all;
          }

          .loading-card {
            width: 100%;
            max-width: 320px;
            background: #141414;
            border: 1px solid #2A2A2A;
            border-radius: 16px;
            padding: 24px 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 14px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
          }

          .loading-spinner {
            width: 42px;
            height: 42px;
            border-radius: 50%;
            border: 3px solid rgba(45, 114, 210, 0.18);
            border-top-color: #3B82F6;
            animation: spin 0.8s linear infinite;
            flex-shrink: 0;
          }

          .loading-title {
            font-size: 0.95rem;
            font-weight: 700;
            color: #ffffff;
            text-align: center;
          }

          .loading-subtitle {
            font-size: 0.82rem;
            color: #8A8A8A;
            text-align: center;
            line-height: 1.45;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <div class="title-wrap">
              <div class="title">${escapedCallsign}</div>
              <div class="sub">${escapedDateStr}</div>
            </div>
            <button class="close-btn action-button" id="menuButtonTop" onclick="openMainSidebar()" title="В меню">×</button>
          </div>

          <div class="info-list">
            <div class="info-item">
              <span class="lbl">ПІБ</span>
              <span class="val">${escapedFml}</span>
            </div>

            <div class="info-item">
              <span class="lbl">Звання</span>
              <span class="val">${escapedRank}</span>
            </div>

            <div class="info-item">
              <span class="lbl">Посада</span>
              <span class="val">${escapedPosition}</span>
            </div>

            <div class="info-item">
              <span class="lbl">ОШС</span>
              <span class="val">${escapedOshs}</span>
            </div>

            <div class="info-item">
              <span class="lbl">Телефон</span>
              <span class="val">${escapedPhoneDisplay}</span>
            </div>

            <div class="info-item">
              <span class="lbl">ДН</span>
              <span class="val">${escapedBirthday}</span>
            </div>

            <div class="info-item">
              <span class="lbl">Група</span>
              <span class="val">${escapedTodayGroup}</span>
            </div>

            <div class="info-item">
              <span class="lbl">БР цей місяць</span>
              <span class="val">${escapedBrDaysThisMonth}</span>
            </div>

            <div class="info-item">
              <span class="lbl">БР минулий місяць</span>
              <span class="val">${escapedBrDaysPrevMonth}</span>
            </div>
          </div>

          ${currentVacHtml}
          ${nextVacHtml}

          <div class="actions">
            ${whatsappHtml}
            <button class="btn action-button" id="copyButton" onclick="copyMessage()">Копіювати</button>
            <button class="btn action-button" id="calendarButton" onclick="openCalendar()">Календар</button>
            <button class="btn action-button" id="menuButtonBottom" onclick="openMainSidebar()">В меню</button>
          </div>

          <div id="inlineError" class="inline-error"></div>

          <pre id="msg">${escapedMessage}</pre>
        </div>

        <div class="loading-overlay" id="loadingOverlay" aria-hidden="true">
          <div class="loading-card" role="status" aria-live="polite">
            <div class="loading-spinner"></div>
            <div class="loading-subtitle" id="loadingSubtitle">Зачекайте, відкриваю наступний екран…</div>
          </div>
        </div>

        <script>
          const CALLSIGN = ${callsignJs};
          let isSubmitting = false;

          function normalizeError(error) {
            if (!error) return 'Невідома помилка';
            if (typeof error === 'string') return error;
            if (error.message) return String(error.message);
            if (error.text) return String(error.text);
            if (error.code && error.details) return '[' + error.code + '] ' + error.details;
            if (error.code) return String(error.code);
            try {
              return JSON.stringify(error);
            } catch (e) {
              return String(error);
            }
          }

          function getLoadingElements() {
            return {
              overlay: document.getElementById('loadingOverlay'),
              title: document.getElementById('loadingTitle'),
              subtitle: document.getElementById('loadingSubtitle')
            };
          }

          function showLoading(title, subtitle) {
            const els = getLoadingElements();

            if (els.subtitle) {
              els.subtitle.textContent = String(subtitle || 'Зачекайте, відкриваю наступний екран…');
            }

            if (els.overlay) {
              els.overlay.classList.add('visible');
              els.overlay.setAttribute('aria-hidden', 'false');
            }

            document.body.classList.add('loading-active');
          }

          function hideLoading() {
            const els = getLoadingElements();

            if (els.overlay) {
              els.overlay.classList.remove('visible');
              els.overlay.setAttribute('aria-hidden', 'true');
            }

            document.body.classList.remove('loading-active');
          }

          function setBusy(busy) {
            isSubmitting = !!busy;
            const buttons = document.querySelectorAll('.action-button');
            buttons.forEach(function(btn) {
              btn.disabled = isSubmitting;
            });
          }

          function beginScreenTransition(title, subtitle) {
            setBusy(true);
            showLoading(title, subtitle);
          }

          function endScreenTransition() {
            hideLoading();
            setBusy(false);
          }

          function clearInlineError() {
            const el = document.getElementById('inlineError');
            if (!el) return;
            el.textContent = '';
            el.classList.remove('visible');
          }

          function showInlineError(message) {
            const el = document.getElementById('inlineError');
            if (!el) return;
            el.textContent = String(message || 'Невідома помилка');
            el.classList.add('visible');
          }

          function gsRun(method) {
            const args = Array.prototype.slice.call(arguments, 1);
            return new Promise((resolve, reject) => {
              try {
                let runner = google.script.run
                  .withSuccessHandler(resolve)
                  .withFailureHandler(function(err) {
                    reject(normalizeError(err));
                  });

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

          async function copyMessage() {
            if (isSubmitting) return;
            clearInlineError();

            const text = document.getElementById('msg') ? document.getElementById('msg').innerText : '';
            if (!text) {
              showInlineError('Немає тексту для копіювання');
              return;
            }

            try {
              if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
              } else {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.focus();
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
              }
            } catch (error) {
              showInlineError('✕ ' + normalizeError(error));
            }
          }

          async function openCalendar() {
            if (isSubmitting) return;

            clearInlineError();
            beginScreenTransition('Зачекайте, відкриваю календар персоналу…');

            try {
              await gsRun('openPersonCalendar', CALLSIGN);
            } catch (error) {
              endScreenTransition();
              showInlineError('✕ ' + normalizeError(error));
            }
          }

          async function openMainSidebar() {
            if (isSubmitting) return;

            clearInlineError();
            beginScreenTransition('Зачекайте, відкриваю головний екран…');

            try {
              await gsRun('showSidebar');
            } catch (error) {
              endScreenTransition();
              showInlineError('✕ ' + normalizeError(error));
            }
          }

          hideLoading();
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
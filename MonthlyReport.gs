/**
 * MonthlyReport.gs — місячні email-звіти (GAS).
 *
 * Вимоги:
 * - чистий GAS (без зовнішніх бібліотек)
 * - мінімум викликів сервісів
 * - повна обробка помилок + зрозумілі повідомлення
 * - логування етапів
 */

const MonthlyReport_ = (function () {
  const DATA_SHEET_NAME = "Дані";
  const PROJECTS_SHEET_NAME = "Проєкти";
  const EMAIL_SENDER_NAME = "Звітність";
  const MONTH_SHEET_REGEX = /^\d{2}$/;
  const MONTH_SHEET_DEFAULT = "05";

  function isValidEmail_(value) {
    const s = String(value || "").trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  }

  function _logInfo(stage, details) {
    console.log(
      `[sendMonthlyReport] ${stage}${details ? ` | ${details}` : ""}`,
    );
  }

  function _logError(stage, error) {
    const msg =
      error && error.message
        ? error.message
        : String(error || "Невідома помилка");
    console.error(`[sendMonthlyReport] ${stage} | ${msg}`, error);
  }

  /**
   * @param {string} monthYear формат YYYY-MM (наприклад "2026-05")
   * @returns {{monthYear:string, start: Date, endExclusive: Date}}
   */
  function parseMonthYear_(monthYear) {
    const raw = String(monthYear || "").trim();
    if (!/^\d{4}-\d{2}$/.test(raw)) {
      throw new Error(
        'Некоректний monthYear. Очікується формат YYYY-MM, наприклад "2026-05".',
      );
    }
    const year = Number(raw.slice(0, 4));
    const month = Number(raw.slice(5, 7));
    if (
      !Number.isFinite(year) ||
      !Number.isFinite(month) ||
      month < 1 ||
      month > 12
    ) {
      throw new Error("Некоректний monthYear. Місяць має бути 01..12.");
    }
    const start = new Date(year, month - 1, 1);
    const endExclusive = new Date(year, month, 1);
    return { monthYear: raw, start, endExclusive };
  }

  function getSheetRequired_(ss, name) {
    const sheet = ss.getSheetByName(name);
    if (!sheet) throw new Error(`Аркуш "${name}" не знайдено`);
    return sheet;
  }

  function normalizeHeader_(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function findColumnIndex_(headers, variants) {
    const norm = headers.map(normalizeHeader_);
    for (let i = 0; i < norm.length; i++) {
      const h = norm[i];
      if (!h) continue;
      if (variants.some((v) => h === v || h.indexOf(v) !== -1)) return i;
    }
    return -1;
  }

  /**
   * Читає дані аркуша "Дані" і повертає рядки за місяць.
   * Очікує колонку дати з заголовком на кшталт "дата".
   *
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
   * @param {Date} start
   * @param {Date} endExclusive
   */
  function readMonthlyRows_(sheet, start, endExclusive) {
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow < 2 || lastCol < 1) return { headers: [], rows: [] };

    const range = sheet.getRange(1, 1, lastRow, lastCol);
    const values = range.getValues();
    const displayValues = range.getDisplayValues();

    const headers = (displayValues[0] || []).map((v) => String(v || "").trim());
    const dateIdx = findColumnIndex_(headers, ["дата", "date"]);
    if (dateIdx === -1) {
      throw new Error(
        'Не знайдено колонку дати в аркуші "Дані" (очікував заголовок "Дата").',
      );
    }

    /** @type {Array<{date: Date, dateDisplay: string, cells: any[], cellsDisplay: string[]}>} */
    const rows = [];

    for (let r = 1; r < values.length; r++) {
      const row = values[r] || [];
      const rowDisp = displayValues[r] || [];
      const rawDate = row[dateIdx];

      if (!(rawDate instanceof Date) || !Number.isFinite(rawDate.getTime()))
        continue;
      if (rawDate < start || rawDate >= endExclusive) continue;

      rows.push({
        date: rawDate,
        dateDisplay: String(rowDisp[dateIdx] || ""),
        cells: row,
        cellsDisplay: rowDisp.map((v) => String(v ?? "")),
      });
    }

    return { headers, rows };
  }

  function readManagerEmails_(ss) {
    // Основний шлях: аркуш "Проєкти" має колонки типу "менеджер email" або "email менеджера"
    const warnings = [];
    let emails = [];

    try {
      const sh = ss.getSheetByName(PROJECTS_SHEET_NAME);
      if (!sh) throw new Error("missing");

      const lastRow = sh.getLastRow();
      const lastCol = sh.getLastColumn();
      if (lastRow < 2 || lastCol < 1) throw new Error("empty");

      const values = sh.getRange(1, 1, lastRow, lastCol).getDisplayValues();
      const headers = (values[0] || []).map((v) => String(v || "").trim());

      const emailIdx = findColumnIndex_(headers, [
        "email",
        "e-mail",
        "пошта",
        "менеджер",
      ]);
      const activeIdx = findColumnIndex_(headers, [
        "актив",
        "active",
        "enabled",
      ]);

      for (let i = 1; i < values.length; i++) {
        const row = values[i] || [];
        const email = String(row[emailIdx] || "").trim();
        if (!email) continue;
        if (!isValidEmail_(email)) continue;

        let active = true;
        if (activeIdx !== -1) {
          const raw = String(row[activeIdx] || "")
            .trim()
            .toLowerCase();
          if (raw === "false" || raw === "0" || raw === "ні" || raw === "no")
            active = false;
        }

        if (active) emails.push(email);
      }
    } catch (_) {
      warnings.push(
        'Не вдалося прочитати email менеджерів з аркуша "Проєкти".',
      );
    }

    emails = Array.from(new Set(emails))
      .map((e) => e.trim())
      .filter(Boolean);

    if (emails.length) return { emails, warnings };

    // Fallback: Script Properties "MANAGER_EMAILS" (comma/space separated)
    const raw =
      PropertiesService.getScriptProperties().getProperty("MANAGER_EMAILS") ||
      "";
    const fromProp = raw
      .split(/[,\s;]+/g)
      .map((s) => s.trim())
      .filter((s) => !!s && isValidEmail_(s));
    if (fromProp.length)
      return {
        emails: Array.from(new Set(fromProp)),
        warnings: warnings.concat([
          "Використано MANAGER_EMAILS зі Script Properties.",
        ]),
      };

    throw new Error(
      'Не знайдено email менеджерів. Додай їх в "Проєкти" або в Script Properties (MANAGER_EMAILS).',
    );
  }

  function buildHtml_(monthYear, headers, rows) {
    const esc = (s) =>
      String(s ?? "").replace(
        /[&<>"]/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
      );

    const title = `Місячний звіт — ${monthYear}`;
    const top = `
      <div style="font-family:Inter,Segoe UI,Arial,sans-serif;color:#111827;">
        <h2 style="margin:0 0 10px 0;">${esc(title)}</h2>
        <div style="color:#6b7280;font-size:13px;margin-bottom:14px;">
          Згенеровано: ${esc(new Date().toLocaleString("uk-UA"))}
        </div>
      </div>
    `;

    if (!rows.length) {
      return (
        top +
        `<div style="padding:12px;border:1px solid #e5e7eb;border-radius:12px;">За цей місяць даних не знайдено.</div>`
      );
    }

    // Таблиця: показуємо до 12 колонок, щоб лист був читабельним.
    const maxCols = Math.min(headers.length, 12);
    const headHtml = headers
      .slice(0, maxCols)
      .map(
        (h) =>
          `<th style="text-align:left;padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#374151;">${esc(h)}</th>`,
      )
      .join("");

    const bodyHtml = rows
      .slice()
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((r) => {
        const cells = r.cellsDisplay
          .slice(0, maxCols)
          .map(
            (v) =>
              `<td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;font-size:12.5px;">${esc(v)}</td>`,
          )
          .join("");
        return `<tr>${cells}</tr>`;
      })
      .join("");

    const table = `
      <div style="margin-top:12px;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
        <table style="border-collapse:collapse;width:100%;background:#fff;">
          <thead style="background:#f9fafb;">
            <tr>${headHtml}</tr>
          </thead>
          <tbody>${bodyHtml}</tbody>
        </table>
      </div>
      <div style="margin-top:10px;color:#6b7280;font-size:12px;">
        Рядків у звіті: <b>${rows.length}</b>
      </div>
    `;

    return top + table;
  }

  function normalizeHeaderUpper_(value) {
    return String(value || "")
      .trim()
      .toUpperCase();
  }

  /**
   * Місячний аркуш формату "05": збір персоналу і статусів по датах.
   * Мінімізує виклики сервісів: 1x getDataRange().getDisplayValues().
   *
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
   * @returns {{sheetName:string, personnelCount:number, statusSummary: Record<string, number>, html: string}}
   */
  function buildFromMonthSheet_(sheet) {
    const sheetName = sheet.getName();
    const data = sheet.getDataRange().getDisplayValues();
    if (!Array.isArray(data) || data.length < 2) {
      throw new Error(`Аркуш "${sheetName}" порожній`);
    }

    const headers = (data[0] || []).map(normalizeHeaderUpper_);
    const findIdx = (needles) =>
      headers.findIndex((h) => needles.some((n) => h.indexOf(n) !== -1));

    const col = {
      phone: findIdx(["ТЕЛЕФОН", "PHONE"]),
      callsign: findIdx(["ПОЗИВ", "CALLSIGN"]),
      position: findIdx(["ПОСАД", "POSITION"]),
      rank: findIdx(["ЗВАН", "RANK"]),
      fullName: findIdx(["ОСОБОВИЙ СКЛАД ПІБ", "П.І.Б", "ПІБ", "ПИБ", "FML"]),
    };

    if (col.fullName === -1) {
      throw new Error(
        `Аркуш "${sheetName}": не знайдено колонку ПІБ (шукав "Особовий склад ПІБ"/"П.І.Б.").`,
      );
    }

    /** @type {Record<string, number>} */
    const statusSummary = {};
    /** @type {Array<{fullName:string,callsign:string,rank:string,position:string,statuses:Array<{date:string,status:string}>}>} */
    const personnel = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i] || [];
      const fullName = String(row[col.fullName] || "").trim();
      if (!fullName) continue;

      const callsign =
        col.callsign >= 0 ? String(row[col.callsign] || "").trim() : "";
      const rank = col.rank >= 0 ? String(row[col.rank] || "").trim() : "";
      const position =
        col.position >= 0 ? String(row[col.position] || "").trim() : "";

      // Статуси по датах: за рекомендацією — з 8-ї колонки (індекс 7) і далі.
      /** @type {Array<{date:string,status:string}>} */
      const statuses = [];
      for (let j = 7; j < headers.length; j++) {
        const dateHeader = String((data[0] || [])[j] || "").trim();
        if (!dateHeader) continue;
        const status = String(row[j] || "").trim();
        if (!status) continue;
        statuses.push({ date: dateHeader, status });
        statusSummary[status] = (statusSummary[status] || 0) + 1;
      }

      personnel.push({
        fullName,
        callsign: callsign || "—",
        rank,
        position,
        statuses,
      });
    }

    const html = generateMonthlyReportHTML_(
      personnel,
      statusSummary,
      sheetName,
    );
    return { sheetName, personnelCount: personnel.length, statusSummary, html };
  }

  return {
    parseMonthYear_,
    readMonthlyRows_,
    readManagerEmails_,
    buildHtml_,
    buildFromMonthSheet_,
    getSheetRequired_,
    _logInfo,
    _logError,
    EMAIL_SENDER_NAME,
    MONTH_SHEET_REGEX,
    MONTH_SHEET_DEFAULT,
  };
})();

/**
 * Генерує красивий HTML-звіт по місяцю (для аркушів "02".."12").
 *
 * @param {Array<{fullName:string,callsign:string,position:string,rank:string,statuses:Array<{date:string,status:string}>}>} personnel Масив бійців
 * @param {Record<string, number>} statusSummary Підсумки статусів
 * @param {string} sheetName Назва аркуша (наприклад "05")
 * @returns {string}
 */
function generateMonthlyReportHTML_(personnel, statusSummary, sheetName) {
  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
    );

  const now = new Date();
  const year = now.getFullYear();
  const monthName = getMonthName_(sheetName);
  const dateStr = now.toLocaleDateString("uk-UA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const list = Array.isArray(personnel) ? personnel : [];

  /** @type {Record<string, typeof list>} */
  const groups = {};
  list.forEach((p) => {
    let groupName = "Інші";
    const pos = String(p?.position || "").toLowerCase();

    if (pos.includes("управління") || pos.includes("взвод"))
      groupName = "Управління взводу";
    else if (pos.includes("1 відд") || pos.includes("1 відділення"))
      groupName = "1 відділення";
    else if (pos.includes("2 відд") || pos.includes("2 відділення"))
      groupName = "2 відділення";
    else if (pos.includes("3 відд") || pos.includes("3 відділення"))
      groupName = "3 відділення";
    else if (pos.includes("супроводження"))
      groupName = "Відділення супроводження";

    if (!groups[groupName]) groups[groupName] = [];
    groups[groupName].push(p);
  });

  const dateOrder = [];
  const dateSeen = new Set();
  list.forEach((p) => {
    (Array.isArray(p?.statuses) ? p.statuses : []).forEach((s) => {
      const d = String(s?.date || "").trim();
      if (!d) return;
      if (dateSeen.has(d)) return;
      dateSeen.add(d);
      dateOrder.push(d);
    });
  });
  const heatmapDates = dateOrder.slice(0, 28);

  const toCssToken = (value) =>
    String(value || "")
      .trim()
      .replace(/[^\p{L}\p{N}_-]+/gu, "");

  let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, Helvetica, sans-serif; background: #f1f5f9; margin: 0; padding: 15px; }
    .container { max-width: 1300px; margin: auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 25px rgba(0,0,0,0.12); }
    .header { background: linear-gradient(135deg, #1e3a8a, #2563eb); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 29px; }
    .summary { padding: 20px; background: #f8fafc; display: flex; flex-wrap: wrap; gap: 15px; }
    .stat-card { background: white; padding: 16px 22px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.08); min-width: 170px; }
    .stat-card h3 { margin: 0 0 8px; color: #64748b; font-size: 14px; }
    .stat-card .value { font-size: 28px; font-weight: bold; }

    table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
    th, td { padding: 9px 12px; border-bottom: 1px solid #e2e8f0; text-align: left; }
    th { background: #1e40af; color: white; position: sticky; top: 0; z-index: 10; }
    .group-header { background: #334155; color: white; padding: 12px 15px; font-size: 18px; font-weight: bold; }
    .total-row { background: #e0f2fe; font-weight: bold; }

    .status { padding: 3px 10px; border-radius: 9999px; font-size: 13px; text-align: center; font-weight: 600; display:inline-block; }
    .st-БР { background:#22c55e; color:white; }
    .st-Резерв { background:#facc15; color:#1e2937; }
    .st-Відпус, .st-Відпустка { background:#a855f7; color:white; }
    .st-Eвак, .st-Лікарн { background:#ef4444; color:white; }
    .st-КП { background:#64748b; color:white; }
    .st-Black { background:#1e2937; color:white; }
    .st-Роланд { background:#f97316; color:white; }
    .st-default { background:#e2e8f0; color:#0f172a; }

    .heatmap { text-align: center; font-size: 12px; min-width: 38px; }
    .legend { padding: 20px; background: #f8fafc; display: flex; flex-wrap: wrap; gap: 12px; font-size: 14px; }
    .legend-item { display: flex; align-items: center; gap: 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Щомісячний звіт взводу охорони</h1>
      <p><strong>${esc(sheetName)}</strong> — ${esc(monthName)} ${esc(year)} • ${esc(dateStr)}</p>
    </div>

    <div class="summary">
      <div class="stat-card"><h3>Особовий склад</h3><div class="value">${esc(list.length)}</div></div>
`;

  Object.keys(statusSummary || {})
    .sort((a, b) => (statusSummary[b] || 0) - (statusSummary[a] || 0))
    .slice(0, 8)
    .forEach((st) => {
      html += `<div class="stat-card"><h3>${esc(st)}</h3><div class="value">${esc(statusSummary[st])}</div></div>`;
    });

  html += `</div>`;

  Object.keys(groups).forEach((group) => {
    const people = groups[group] || [];
    html += `
    <div class="group-header">${esc(group)} — ${esc(people.length)} осіб</div>
    <table>
      <thead>
        <tr>
          <th>П.І.Б.</th>
          <th>Позивний</th>
          <th>Посада / Звання</th>
          <th>Записів</th>
`;

    heatmapDates.forEach((d) => {
      html += `<th class="heatmap">${esc(d)}</th>`;
    });

    html += `</tr></thead><tbody>`;

    // Підсумок по групі: кількість БР по кожній даті.
    const brCounts = {};
    heatmapDates.forEach((d) => (brCounts[d] = 0));

    people.forEach((p) => {
      const statuses = Array.isArray(p?.statuses) ? p.statuses : [];
      const byDate = {};
      statuses.forEach((s) => {
        const d = String(s?.date || "").trim();
        if (!d) return;
        byDate[d] = String(s?.status || "").trim();
      });

      html += `
      <tr>
        <td><strong>${esc(p?.fullName || "")}</strong></td>
        <td>${esc(p?.callsign || "—")}</td>
        <td>${esc(p?.position || "")}<br><small>${esc(p?.rank || "")}</small></td>
        <td>${esc(statuses.length)}</td>`;

      heatmapDates.forEach((d) => {
        const st = String(byDate[d] || "").trim();
        const token = toCssToken(st);
        const cls = st ? `status st-${token || "default"}` : "";
        if (st && st.indexOf("БР") !== -1) brCounts[d] = (brCounts[d] || 0) + 1;
        html += `<td class="heatmap">${st ? `<span class="${esc(cls)}">${esc(st)}</span>` : ""}</td>`;
      });

      html += `</tr>`;
    });

    html += `<tr class="total-row">
      <td colspan="4"><strong>Підсумок по ${esc(group)} (БР)</strong></td>`;
    heatmapDates.forEach((d) => {
      html += `<td class="heatmap">${esc(brCounts[d] || 0)}</td>`;
    });
    html += `</tr>`;

    html += `</tbody></table>`;
  });

  html += `
    <div class="legend">
      <strong>Легенда:</strong>
      <div class="legend-item"><span class="status st-БР">БР</span> — Бойове розпорядження</div>
      <div class="legend-item"><span class="status st-Резерв">Резерв</span> — Резерв</div>
      <div class="legend-item"><span class="status st-Відпус">Відпус</span> — Відпустка</div>
      <div class="legend-item"><span class="status st-Eвак">Eвак</span> — Евакуація / Лікарняний</div>
      <div class="legend-item"><span class="status st-КП">КП</span> — Командний пункт</div>
      <div class="legend-item"><span class="status st-Black">Black</span> — Екіпаж Black</div>
      <div class="legend-item"><span class="status st-Роланд">Роланд</span> — Екіпаж Roland</div>
    </div>
`;

  html += `
    <div style="text-align:center; padding:25px; color:#64748b; font-size:14px; background:#f8fafc;">
      Звіт сформовано автоматично • WhatsApp Sheets Bot<br>
      ${esc(new Date().toLocaleString("uk-UA"))}
    </div>
  </div>
</body>
</html>`;

  return html;
}

/**
 * Допоміжна функція для назви місяця.
 * @param {string} sheetName
 * @returns {string}
 */
function getMonthName_(sheetName) {
  const months = {
    "01": "Січень",
    "02": "Лютий",
    "03": "Березень",
    "04": "Квітень",
    "05": "Травень",
    "06": "Червень",
    "07": "Липень",
    "08": "Серпень",
    "09": "Вересень",
    10: "Жовтень",
    11: "Листопад",
    12: "Грудень",
  };
  return (
    months[String(sheetName || "").trim()] || String(sheetName || "").trim()
  );
}

/**
 * Відправляє місячний звіт менеджерам.
 *
 * Підтримує 2 режими:
 * - `YYYY-MM` (наприклад "2026-05") — бере дані з аркуша "Дані"
 * - `MM` (наприклад "05") — бере дані з аркуша-місяця ("02", "03", ...), як у baseline WASB
 *
 * @param {string} monthYearOrSheetName "2026-05" або "05"
 * @returns {ReturnType<typeof okResponse_>}
 */
function sendMonthlyReport(monthYearOrSheetName) {
  const started = Date.now();
  try {
    const ss = getWasbSpreadsheet_();
    const { emails, warnings } = MonthlyReport_.readManagerEmails_(ss);
    if (!Array.isArray(emails) || emails.length === 0) {
      throw new Error("Не знайдено email отримувачів");
    }

    const input = String(monthYearOrSheetName || "").trim();
    const isSheetMode = MonthlyReport_.MONTH_SHEET_REGEX.test(input || "");

    if (isSheetMode) {
      const sheetName = input || MonthlyReport_.MONTH_SHEET_DEFAULT;
      MonthlyReport_._logInfo("start", `sheet=${sheetName}`);
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) throw new Error(`Аркуш "${sheetName}" не знайдено`);

      const built = MonthlyReport_.buildFromMonthSheet_(sheet);
      MonthlyReport_._logInfo("filter", `personnel=${built.personnelCount}`);
      MonthlyReport_._logInfo("recipients", emails.join(", "));

      const subject = `Щомісячний звіт — ${built.sheetName} (${new Date().toLocaleDateString("uk-UA")})`;
      const plain = `Щомісячний звіт — ${built.sheetName}\nОсобовий склад: ${built.personnelCount}\n\n(Відкрий лист в HTML-режимі.)`;
      emails.forEach((email) => {
        GmailApp.sendEmail(email, subject, plain, {
          htmlBody: built.html,
          name: MonthlyReport_.EMAIL_SENDER_NAME || "WASB",
        });
      });

      const durationMs = Date.now() - started;
      MonthlyReport_._logInfo(
        "done",
        `sent=${emails.length} durationMs=${durationMs}`,
      );
      return okResponse_(
        {
          sheetName: built.sheetName,
          recipients: emails,
          personnelCount: built.personnelCount,
        },
        `✓ Звіт по ${built.sheetName} відправлено (${emails.length} отримувачів)`,
        { function: "sendMonthlyReport", durationMs, mode: "sheet" },
        warnings,
      );
    }

    // monthYear mode (YYYY-MM via "Дані")
    const parsed = MonthlyReport_.parseMonthYear_(input);
    MonthlyReport_._logInfo("start", `monthYear=${parsed.monthYear}`);

    const dataSheet = MonthlyReport_.getSheetRequired_(ss, DATA_SHEET_NAME);
    MonthlyReport_._logInfo("read", DATA_SHEET_NAME);
    const { headers, rows } = MonthlyReport_.readMonthlyRows_(
      dataSheet,
      parsed.start,
      parsed.endExclusive,
    );
    MonthlyReport_._logInfo("filter", `rows=${rows.length}`);

    if (!rows.length) {
      const durationMs = Date.now() - started;
      return okResponse_(
        { monthYear: parsed.monthYear, recipients: [], rowCount: 0 },
        `За період ${parsed.monthYear} даних не знайдено.`,
        { function: "sendMonthlyReport", durationMs, mode: "data" },
        warnings,
      );
    }

    MonthlyReport_._logInfo("recipients", emails.join(", "));
    const htmlBody = MonthlyReport_.buildHtml_(parsed.monthYear, headers, rows);
    const subject = `Місячний звіт ${parsed.monthYear}`;
    const plain = `Місячний звіт ${parsed.monthYear}\nРядків: ${rows.length}\n\n(Відкрий лист в HTML-режимі для таблиці.)`;
    emails.forEach((email) => {
      GmailApp.sendEmail(email, subject, plain, {
        htmlBody,
        name: MonthlyReport_.EMAIL_SENDER_NAME || "WASB",
      });
    });

    const durationMs = Date.now() - started;
    MonthlyReport_._logInfo(
      "done",
      `sent=${emails.length} durationMs=${durationMs}`,
    );
    return okResponse_(
      {
        monthYear: parsed.monthYear,
        recipients: emails,
        rowCount: rows.length,
      },
      `✓ Звіт відправлено (${emails.length} отримувачів)`,
      { function: "sendMonthlyReport", durationMs, mode: "data" },
      warnings,
    );
  } catch (e) {
    MonthlyReport_._logError("fail", e);
    return errorResponse_(e, "✕ Не вдалося відправити місячний звіт", {
      function: "sendMonthlyReport",
      input: String(monthYearOrSheetName || ""),
    });
  }
}

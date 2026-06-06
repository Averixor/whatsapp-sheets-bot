/************ ЗВЕДЕННЯ ДНЯ — ПРОСТЕ ************/

/** Рядки місячного графіка з кодом і позивним на обрану дату (джерело для «ОС»). */
function getMonthlyScheduleEntriesForColumn_(sheet, col) {
  const ref = sheet.getRange(getMonthlyCodeRangeA1ForSheet_(sheet));
  const startRow = ref.getRow();
  const numRows = ref.getNumRows();
  const callsignCol = getMonthlyCallsignColForSheet_(sheet);
  const codes = sheet
    .getRange(startRow, col, numRows, 1)
    .getDisplayValues()
    .flat();
  const callsigns = sheet
    .getRange(startRow, callsignCol, numRows, 1)
    .getDisplayValues()
    .flat();
  const entries = [];
  for (let i = 0; i < codes.length; i++) {
    const code = String(codes[i] || "").trim();
    const rowCallsign = String(callsigns[i] || "").trim();
    if (code && rowCallsign) {
      entries.push({ rowIndex: startRow + i, code, callsign: rowCallsign });
    }
  }
  return entries;
}

/** Рядки місячного графіка з кодом і позивним на обрану дату (джерело для «ОС»). */
function countMonthlyScheduleRowsForColumn_(sheet, col) {
  const count = getMonthlyScheduleEntriesForColumn_(sheet, col).length;
  return count;
}

/**
 * ПІБ для зведення: активний PERSONNEL → будь-який Status → колонка FML на листі → позивний.
 * Наявність у графіку на дату не залежить від Status у PERSONNEL.
 */
function resolveSummaryPersonFml_(sheet, rowIndex, rowCallsign, personnelByCallsignAny) {
  const callsign = String(rowCallsign || "").trim();
  if (!callsign) return "";

  if (typeof resolvePersonnelForLookup_ === "function") {
    try {
      const personnel = resolvePersonnelForLookup_(callsign, "", "");
      if (personnel && personnel.fml) return String(personnel.fml).trim();
    } catch (_) {}
  }

  const key =
    typeof _normCallsignKey_ === "function"
      ? _normCallsignKey_(callsign)
      : callsign.toUpperCase();
  const byCall =
    personnelByCallsignAny && personnelByCallsignAny[key]
      ? personnelByCallsignAny[key]
      : typeof getPersonnelByCallsignAnyStatus_ === "function"
        ? getPersonnelByCallsignAnyStatus_(callsign)
        : null;
  if (byCall && byCall.fml) return String(byCall.fml).trim();

  let fmlCol = 0;
  try {
    if (typeof getMonthlyFmlColForSheet_ === "function") {
      fmlCol = Number(getMonthlyFmlColForSheet_(sheet)) || 0;
    } else {
      const schema = SheetSchemas_.get(sheet.getName());
      fmlCol = Number(schema && schema.columns && schema.columns.fml) || 0;
    }
  } catch (_) {
    fmlCol = Number(CONFIG.FML_COL) || 7;
  }

  if (fmlCol > 0) {
    try {
      const fmlFromSheet = String(
        sheet.getRange(rowIndex, fmlCol).getDisplayValue() || "",
      ).trim();
      if (fmlFromSheet) return fmlFromSheet;
    } catch (_) {}
  }

  return callsign;
}

function buildDaySummaryForColumn_(sheet, col) {
  const dateCell = sheet.getRange(Number(CONFIG.DATE_ROW) || 1, col);
  const reportDate = DateUtils_.normalizeDate(
    dateCell.getValue(),
    dateCell.getDisplayValue(),
  );
  const shortDate = reportDate.slice(0, 5);

  const entries = getMonthlyScheduleEntriesForColumn_(sheet, col);
  const freq = {};
  entries.forEach((entry) => {
    freq[entry.code] = (freq[entry.code] || 0) + 1;
  });

  const total = entries.length;

  const lines = [`${FULL_NAMES["ОС"] || "Особовий склад"} — ${total}`];

  [
    "БР",
    "Roland",
    "Black",
    "Евак",
    "1РБпАК",
    "2РБпАК",
    "1УРБпАК",
    "2УРБпАК",
    "КП",
    "Резерв",
    "Відряд",
    "Відпус",
    "Гусачі",
    "БЗВП",
    "Лікарн",
    "*ВМЗ",
    "*1РБпАК",
    "*2РБпАК",
    "*1УРБпАК",
    "*2УРБпАК",
    "*ВЗ",
  ].forEach((group) => {
    let cnt = 0;
    (SUMMARY_GROUPS[group] || []).forEach((code) => {
      cnt += freq[code] || 0;
    });

    if (cnt > 0) {
      lines.push(`${FULL_NAMES[group] || group} — ${cnt}`);
    }
  });

  return lines.length
    ? [shortDate, ...lines].join("\n")
    : `${shortDate}\nНемає даних`;
}

/************ ДЕТАЛЬНЕ ЗВЕДЕННЯ ************/

function collectPeopleDetailed_(sheet, col) {
  const entries = getMonthlyScheduleEntriesForColumn_(sheet, col);
  const personnelByCallsignAny =
    typeof getPersonnelMapByCallsignAll_ === "function"
      ? getPersonnelMapByCallsignAll_()
      : null;

  const people = [],
    seen = new Set();
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const fml = resolveSummaryPersonFml_(
      sheet,
      entry.rowIndex,
      entry.callsign,
      personnelByCallsignAny,
    );
    if (!fml) continue;
    const surname = fml.split(" ")[0];
    const key = surname + "|" + entry.code;
    if (seen.has(key)) continue;
    seen.add(key);
    people.push({ code: entry.code, fullName: fml, surname });
  }
  return people;
}

function formatDetailedSummary_(date, people) {
  try {
    const template = getTemplateText_("DETAILED_SUMMARY");
    const groupTemplate = getTemplateText_("GROUP_BLOCK");
    if (!template) return formatDetailedSummaryLegacy_(date, people);

    const all = new Set(people.map((p) => p.surname));
    const usedSurnames = new Set();
    let groupsBlock = "";

    const groupRules = readDictSum_();
    for (const rule of groupRules) {
      if (rule.code === "ОС") continue;

      const codes = SUMMARY_GROUPS[rule.code] || [rule.code];

      const subset = people.filter(
        (p) => codes.includes(p.code) && !usedSurnames.has(p.surname),
      );
      const set = new Set(subset.map((p) => p.surname));
      if (set.size === 0 && !rule.showZero) continue;

      const namesList = set.size > 0 ? Array.from(set).sort().join(", ") : "—";
      if (groupTemplate) {
        groupsBlock += renderTemplate_(groupTemplate, {
          groupLabel: rule.label,
          groupCount: String(set.size),
          namesList: namesList,
        });
      } else {
        groupsBlock += `*${rule.label}* — ${set.size}\n${namesList}.\n\n`;
      }
      set.forEach((s) => usedSurnames.add(s));
    }

    return renderTemplate_(template, {
      date: date,
      osLabel: FULL_NAMES["ОС"] || "Особовий склад",
      osCount: String(all.size),
      groupsBlock: groupsBlock,
    });
  } catch (e) {
    console.warn("Помилка в formatDetailedSummary_:", e);
    return formatDetailedSummaryLegacy_(date, people);
  }
}

function formatDetailedSummaryLegacy_(date, people) {
  let txt = `*＼（〇_ｏ）／*\n   *${date}*\n\n`;

  const all = new Set(people.map((p) => p.surname));
  txt += `*${FULL_NAMES["ОС"] || "Особовий склад"}* — ${all.size}\n\n`;

  const usedSurnames = new Set();
  const add = (group) => {
    const codes = SUMMARY_GROUPS[group] || [group];
    const subset = people.filter(
      (p) => codes.includes(p.code) && !usedSurnames.has(p.surname),
    );
    const set = new Set(subset.map((p) => p.surname));
    if (!set.size) return;
    txt += `*${FULL_NAMES[group] || group}* — ${set.size}\n${Array.from(set).sort().join(", ")}.\n\n`;
    set.forEach((s) => usedSurnames.add(s));
  };

  add("БР");
  add("Евак");
  add("Roland");
  add("Black");
  add("1РБпАК");
  add("2РБпАК");
  add("1УРБпАК");
  add("2УРБпАК");
  add("КП");
  add("Резерв");
  add("Відпус");
  add("Лікарн");
  add("*1РБпАК");
  add("*2РБпАК");
  add("*1УРБпАК");
  add("*2УРБпАК");
  add("*ВЗ");
  add("*ВМЗ");
  add("Гусачі");
  add("Відряд");
  add("БЗВП");

  return txt;
}

function createDetailedSheet_(date, people) {
  const sh = ensureSheet_(CONFIG.DETAIL_SHEET);
  sh.clear();
  sh.getRange(1, 1, 1, 4)
    .setValues([["Date", "Group", "Surname", "Code"]])
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setBackground("#f0f0f0");

  const groupOf = (code) => {
    for (const [g, arr] of Object.entries(SUMMARY_GROUPS))
      if (arr.includes(code)) return g;
    return "Інше";
  };

  const rows = [];
  people
    .slice()
    .sort(
      (a, b) =>
        groupOf(a.code).localeCompare(groupOf(b.code)) ||
        a.surname.localeCompare(b.surname),
    )
    .forEach((p) =>
      rows.push([
        date,
        displayNameForCode_(groupOf(p.code)),
        p.surname,
        p.code,
      ]),
    );

  if (rows.length) sh.getRange(2, 1, rows.length, 4).setValues(rows);
  sh.autoResizeColumns(1, 4);
}

function createDetailedDaySummary() {
  try {
    const sheet = SpreadsheetApp.getActiveSheet();
    const botName = getBotMonthSheetName_();
    if (sheet.getName() !== botName) throw new Error(`Тільки "${botName}"`);
    const col = sheet.getActiveRange().getColumn();
    const codeRangeA1 = getMonthlyCodeRangeA1ForSheet_(sheet);
    const ref = sheet.getRange(codeRangeA1);
    if (col < ref.getColumn() || col > ref.getLastColumn())
      throw new Error(`Стовпець поза ${codeRangeA1}`);
    const dateCell = sheet.getRange(Number(CONFIG.DATE_ROW) || 1, col);
    const date = DateUtils_.normalizeDate(
      dateCell.getValue(),
      dateCell.getDisplayValue(),
    );

    const people = collectPeopleDetailed_(sheet, col);
    const text = formatDetailedSummary_(date, people);

    createDetailedSheet_(date, people);
    showDetailedSummaryDialog_(date, text);
  } catch (e) {
    SpreadsheetApp.getUi().alert("✕ " + e.message);
  }
}

function sendDetailedSummaryToCommander() {
  try {
    const sheet = SpreadsheetApp.getActiveSheet();
    const botName = getBotMonthSheetName_();
    if (sheet.getName() !== botName) throw new Error(`Тільки "${botName}"`);
    const col = sheet.getActiveRange().getColumn();
    const codeRangeA1 = getMonthlyCodeRangeA1ForSheet_(sheet);
    const ref = sheet.getRange(codeRangeA1);
    if (col < ref.getColumn() || col > ref.getLastColumn())
      throw new Error(`Стовпець поза ${codeRangeA1}`);
    const dateCell = sheet.getRange(Number(CONFIG.DATE_ROW) || 1, col);
    const date = DateUtils_.normalizeDate(
      dateCell.getValue(),
      dateCell.getDisplayValue(),
    );

    const people = collectPeopleDetailed_(sheet, col);
    const text = formatDetailedSummary_(date, people);

    const phone = findPhone_({ role: CONFIG.COMMANDER_ROLE });
    if (!phone) {
      const ui = SpreadsheetApp.getUi();
      ui.alert(
        "✕ Телефон не знайдено",
        `Для ролі "${CONFIG.COMMANDER_ROLE}" не знайдено телефону.\n\n` +
          `Перевірте:\n` +
          `1. В аркуші PHONES є запис з роллю "${CONFIG.COMMANDER_ROLE}" в колонці C\n` +
          `2. В колонці B вказано номер телефону\n` +
          `3. Після додавання даних очистіть кеш`,
        ui.ButtonSet.OK,
      );
      return;
    }

    const safe = trimToEncoded_(text, CONFIG.MAX_WA_TEXT);
    DialogPresenter_.showLinkDialog({
      title: "📊 Детальне → командиру",
      url: buildWhatsAppWebLink_(phone, safe),
      description: "Натисніть, щоб відкрити WhatsApp",
    });
  } catch (e) {
    SpreadsheetApp.getUi().alert("✕ " + e.message);
  }
}

/**
 * Побудова повідомлення через шаблони
 */
function buildMessage_({ reportDate, service, place, tasks, brDays, minimal }) {
  const d = reportDate || "";
  const br = Number(brDays) || 0;

  function _fallback_() {
    if (minimal) {
      return [
        d,
        `Днів на БР: ${br}`,
        "",
        "*(ʢ ￣︿￣)*   *⨦*   *(￣︿￣ ʡ)*",
      ].join("\n");
    }

    const lines = [d, ""];

    if (service) {
      lines.push(`Вид служби: ${service}`);
    }

    lines.push(`Днів на БР: ${br}`);

    if (place) {
      lines.push(`\nМісце виконання:\n${place}`);
    }

    if (tasks) {
      lines.push(`\nВиконувані завдання:\n${tasks}`);
    }

    lines.push("\n*(ʢ ￣︿￣)*   *⨦*   *(￣︿￣ ʡ)*");

    return lines.join("\n");
  }

  function _cleanEnd_(value) {
    return String(value || "").replace(/\s+$/g, "");
  }

  function _line_(value) {
    const text = _cleanEnd_(value);
    return text ? text + "\n" : "";
  }

  function _block_(value) {
    const text = _cleanEnd_(value);
    return text ? text + "\n\n" : "";
  }

  try {
    if (minimal) {
      const template = getTemplateText_("MESSAGE_MINIMAL");

      if (template) {
        return renderTemplate_(template, {
          date: d,
          brDays: String(br),
        });
      }

      return _fallback_();
    }

    const mainTemplate = getTemplateText_("MESSAGE_FULL");

    if (!mainTemplate) {
      return _fallback_();
    }

    const serviceTemplate = getTemplateText_("MESSAGE_SERVICE_LINE");
    const brTemplate = getTemplateText_("MESSAGE_BR_LINE");
    const placeTemplate = getTemplateText_("MESSAGE_PLACE_BLOCK");
    const tasksTemplate = getTemplateText_("MESSAGE_TASKS_BLOCK");

    const serviceLine = service
      ? _line_(
          serviceTemplate
            ? renderTemplate_(serviceTemplate, { service })
            : `Вид служби: ${service}`
        )
      : "";

    const brLine = _line_(
      brTemplate
        ? renderTemplate_(brTemplate, { brDays: String(br) })
        : `Днів на БР: ${br}`
    );

    const placeBlock = place
      ? _block_(
          placeTemplate
            ? renderTemplate_(placeTemplate, { place })
            : `Місце виконання:\n${place}`
        )
      : "";

    const tasksBlock = tasks
      ? _block_(
          tasksTemplate
            ? renderTemplate_(tasksTemplate, { tasks })
            : `Виконувані завдання:\n${tasks}`
        )
      : "";

    return renderTemplate_(mainTemplate, {
      date: d,
      serviceLine,
      brLine,
      placeBlock,
      tasksBlock,
      service: service || "",
      brDays: String(br),
      place: place || "",
      tasks: tasks || "",
    });
  } catch (e) {
    console.warn("Помилка в buildMessage_, fallback:", e);
    return _fallback_();
  }
}

function showDetailedSummaryDialog_(date, text) {
  const safe = HtmlUtils_.escapeHtml(text);
  const html = HtmlService.createHtmlOutput(
    `
    <div style="font-family:Arial;padding:16px">
      <h3 style="color:#075e54">📊 Детальне зведення за ${HtmlUtils_.escapeHtml(date)}</h3>
      <div style="margin-bottom:12px">
        <button onclick="copyText()" style="padding:8px 16px;background:#25D366;color:white;border:none;border-radius:6px;cursor:pointer">📋 Копіювати</button>
      </div>
      <textarea id="t" style="width:100%;height:350px;padding:10px;border:1px solid #ddd;border-radius:8px;" readonly>${safe}</textarea>
      <script>
        function copyText() {
          const t = document.getElementById('t');
          t.select(); t.setSelectionRange(0,999999);
          navigator.clipboard.writeText(t.value).then(()=>alert('✓ Скопійовано'));
        }
      </script>
    </div>
  `,
  )
    .setWidth(700)
    .setHeight(500);
  SpreadsheetApp.getUi().showModalDialog(html, "📊 Детальне зведення");
}

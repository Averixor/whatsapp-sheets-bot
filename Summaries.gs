/************ ЗВЕДЕННЯ ДНЯ — ПРОСТЕ ************/
function buildDaySummaryForColumn_(sheet, col) {
  const codeRef = sheet.getRange(CONFIG.CODE_RANGE_A1);
  const dateCell = sheet.getRange(Number(CONFIG.DATE_ROW) || 1, col);
  const reportDate = DateUtils_.normalizeDate(dateCell.getValue(), dateCell.getDisplayValue());
  const shortDate = reportDate.slice(0, 5);

  const codes = sheet
    .getRange(codeRef.getRow(), col, codeRef.getNumRows(), 1)
    .getDisplayValues()
    .flat()
    .map(v => String(v || '').trim())
    .filter(Boolean);

  const freq = {};
  codes.forEach(code => {
    freq[code] = (freq[code] || 0) + 1;
  });

  const osRangeA1 = CONFIG.OS_FIO_RANGE_A1 || CONFIG.OS_FIO_RANGE;
  if (!osRangeA1) {
    throw new Error('У CONFIG не задано OS_FIO_RANGE_A1');
  }

  const total = sheet
    .getRange(osRangeA1)
    .getDisplayValues()
    .flat()
    .map(v => normalizeFIO_(v))
    .filter(Boolean)
    .length;

  const lines = [`${FULL_NAMES['ОС'] || 'Особовий склад'} — ${total}`];

  [
    'БР',
    'Роланд',
    'Чорний',
    'Евак',
    'РБпАК',
    '1УРБпАК',
    '2УРБпАК',
    'КП',
    'Резерв',
    'Відряд',
    'Відпус',
    'Гусачі',
    'БЗВП',
    'Лікарн',
    '*ВО',
    '*ВМЗ',
    '*РБпАК',
    '*1УРБпАК',
    '*2УРБпАК',
    '*ВЗ'
 ]
    .forEach(group => {
      let cnt = 0;
      (SUMMARY_GROUPS[group] || []).forEach(code => {
        cnt += freq[code] || 0;
      });

      if (cnt > 0) {
        lines.push(`${FULL_NAMES[group] || group} — ${cnt}`);
      }
    });

  return lines.length ? [shortDate, ...lines].join('\n') : `${shortDate}\nНемає даних`;
}

/************ ДЕТАЛЬНЕ ЗВЕДЕННЯ ************/
function collectPeopleDetailed_(sheet, col) {
  const ref = sheet.getRange(CONFIG.CODE_RANGE_A1);
  const codes = sheet.getRange(ref.getRow(), col, ref.getNumRows(), 1).getDisplayValues().flat();
  const fios = sheet.getRange(ref.getRow(), CONFIG.FIO_COL, ref.getNumRows(), 1).getDisplayValues().flat();

  const people = [], seen = new Set();
  for (let i = 0; i < codes.length; i++) {
    const code = String(codes[i] || '').trim();
    const fio = String(fios[i] || '').trim();
    if (!code || !fio) continue;
    const surname = fio.split(' ')[0];
    const key = surname + '|' + code;
    if (seen.has(key)) continue;
    seen.add(key);
    people.push({ code, fullName: fio, surname });
  }
  return people;
}

function formatDetailedSummary_(date, people) {
  try {
    const template = getTemplateText_('DETAILED_SUMMARY');
    const groupTemplate = getTemplateText_('GROUP_BLOCK');
    if (!template) return formatDetailedSummaryLegacy_(date, people);

    const all = new Set(people.map(p => p.surname));
    const usedSurnames = new Set();
    let groupsBlock = '';

    const groupRules = readDictSum_();
    for (const rule of groupRules) {
      if (rule.code === 'ОС') continue;

      const codes = SUMMARY_GROUPS[rule.code] || [rule.code];

      const subset = people.filter(p => codes.includes(p.code) && !usedSurnames.has(p.surname));
      const set = new Set(subset.map(p => p.surname));
      if (set.size === 0 && !rule.showZero) continue;

      const namesList = set.size > 0 ? Array.from(set).sort().join(', ') : '—';
      if (groupTemplate) {
        groupsBlock += renderTemplate_(groupTemplate, {
          groupLabel: rule.label,
          groupCount: String(set.size),
          namesList: namesList
        });
      } else {
        groupsBlock += `*${rule.label}* — ${set.size}\n${namesList}.\n\n`;
      }
      set.forEach(s => usedSurnames.add(s));
    }

    return renderTemplate_(template, {
      date: date,
      osLabel: FULL_NAMES['ОС'] || 'Особовий склад',
      osCount: String(all.size),
      groupsBlock: groupsBlock
    });
  } catch (e) {
    console.warn('Помилка в formatDetailedSummary_:', e);
    return formatDetailedSummaryLegacy_(date, people);
  }
}

function formatDetailedSummaryLegacy_(date, people) {
  let txt = `*＼（〇_ｏ）／*\n   *${date}*\n\n`;

  const all = new Set(people.map(p => p.surname));
  txt += `*${FULL_NAMES['ОС'] || 'Особовий склад'}* — ${all.size}\n\n`;

  const usedSurnames = new Set();
  const add = (group) => {
    const codes = SUMMARY_GROUPS[group] || [group];
    const subset = people.filter(p => codes.includes(p.code) && !usedSurnames.has(p.surname));
    const set = new Set(subset.map(p => p.surname));
    if (!set.size) return;
    txt += `*${FULL_NAMES[group] || group}* — ${set.size}\n${Array.from(set).sort().join(', ')}.\n\n`;
    set.forEach(s => usedSurnames.add(s));
  };

  add('БР'); add('РБпАК'); add('Евак'); add('Роланд'); add('Чорний'); add('РБпАК'); add('1УРБпАК'); add('2УРБпАК'); add('КП'); add('Резерв'); add('Відпус'); add('Лікарн'); add('*ВО'); add('*РБпАК'); add('*1УРБпАК'); add('*2УРБпАК'); add('*ВЗ'); add('*ВМЗ'); add('Гусачі'); add('Відряд'); add('БЗВП');

  return txt;
}

function saveDetailedSummaryToHistory_(date, people, text) {
  const sh = ensureSheet_(CONFIG.SUMMARY_HISTORY_SHEET);
  if (sh.getLastRow() === 0) sh.appendRow(['Дата', 'Час', 'Осіб', 'Текст', 'JSON(people)']);
  sh.appendRow([date, new Date(), new Set(people.map(p => p.surname)).size, text, JSON.stringify(people)]);
}

function createDetailedSheet_(date, people) {
  const sh = ensureSheet_(CONFIG.DETAIL_SHEET);
  sh.clear();
  sh.getRange(1, 1, 1, 4).setValues([['Дата', 'Група', 'Прізвище', 'Код']]).setFontWeight('bold').setHorizontalAlignment('center').setBackground('#f0f0f0');

  const groupOf = (code) => {
    for (const [g, arr] of Object.entries(SUMMARY_GROUPS)) if (arr.includes(code)) return g;
    return 'Інше';
  };

  const rows = [];
  people.slice().sort((a, b) => (groupOf(a.code).localeCompare(groupOf(b.code)) || a.surname.localeCompare(b.surname)))
    .forEach(p => rows.push([date, displayNameForCode_(groupOf(p.code)), p.surname, p.code]));

  if (rows.length) sh.getRange(2, 1, rows.length, 4).setValues(rows);
  sh.autoResizeColumns(1, 4);
}

function createDetailedDaySummary() {
  try {
    const sheet = SpreadsheetApp.getActiveSheet();
    const botName = getBotMonthSheetName_();
    if (sheet.getName() !== botName) throw new Error(`Тільки "${botName}"`);
    const col = sheet.getActiveRange().getColumn();
    const ref = sheet.getRange(CONFIG.CODE_RANGE_A1);
    if (col < ref.getColumn() || col > ref.getLastColumn()) throw new Error(`Стовпець поза ${CONFIG.CODE_RANGE_A1}`);
    const dateCell = sheet.getRange(Number(CONFIG.DATE_ROW) || 1, col);
    const date = DateUtils_.normalizeDate(dateCell.getValue(), dateCell.getDisplayValue());

    const people = collectPeopleDetailed_(sheet, col);
    const text = formatDetailedSummary_(date, people);

    saveDetailedSummaryToHistory_(date, people, text);
    createDetailedSheet_(date, people);
    showDetailedSummaryDialog_(date, text);
  } catch (e) { SpreadsheetApp.getUi().alert('✕ ' + e.message); }
}

function sendDetailedSummaryToCommander() {
  try {
    const sheet = SpreadsheetApp.getActiveSheet();
    const botName = getBotMonthSheetName_();
    if (sheet.getName() !== botName) throw new Error(`Тільки "${botName}"`);
    const col = sheet.getActiveRange().getColumn();
    const ref = sheet.getRange(CONFIG.CODE_RANGE_A1);
    if (col < ref.getColumn() || col > ref.getLastColumn()) throw new Error(`Стовпець поза ${CONFIG.CODE_RANGE_A1}`);
    const dateCell = sheet.getRange(Number(CONFIG.DATE_ROW) || 1, col);
    const date = DateUtils_.normalizeDate(dateCell.getValue(), dateCell.getDisplayValue());

    const people = collectPeopleDetailed_(sheet, col);
    const text = formatDetailedSummary_(date, people);

    const phone = findPhone_({ role: CONFIG.COMMANDER_ROLE });
    if (!phone) {
      const ui = SpreadsheetApp.getUi();
      ui.alert(
        '✕ Телефон не знайдено',
        `Для ролі "${CONFIG.COMMANDER_ROLE}" не знайдено телефону.\n\n` +
        `Перевірте:\n` +
        `1. В аркуші PHONES є запис з роллю "${CONFIG.COMMANDER_ROLE}" в колонці C\n` +
        `2. В колонці B вказано номер телефону\n` +
        `3. Після додавання даних очистіть кеш`,
        ui.ButtonSet.OK
      );
      return;
    }

    const safe = trimToEncoded_(text, CONFIG.MAX_WA_TEXT);
    showLinkDialogSimple_('📊 Детальне → командиру', `https://wa.me/${phone.replace('+', '')}?text=${encodeURIComponent(safe)}`);
  } catch (e) {
    SpreadsheetApp.getUi().alert('✕ ' + e.message);
  }
}

/**
 * Побудова повідомлення через шаблони
 */
function buildMessage_({ reportDate, service, place, tasks, brDays, minimal }) {
  const d = reportDate || '';
  const br = Number(brDays) || 0;

  function _fallback_() {
    if (minimal) {
      return [d, `Днів на БР: ${br}`, '', '*(ʢ ￣︿￣)*   *⨦*   *(￣︿￣ ʡ)*'].join('\n');
    }
    const lines = [d, ''];
    if (service) lines.push(`Вид служби: ${service}`);
    lines.push(`Днів на БР: ${br}`);
    if (place) lines.push(`\nМісце виконання:\n${place}`);
    if (tasks) lines.push(`\nВиконувані завдання:\n${tasks}`);
    lines.push('\n*(ʢ ￣︿￣)*   *⨦*   *(￣︿￣ ʡ)*');
    return lines.join('\n');
  }

  try {
    if (minimal) {
      const template = getTemplateText_('MESSAGE_MINIMAL');
      if (template) {
        return renderTemplate_(template, { date: d, brDays: String(br) });
      }
      return _fallback_();
    }

    const mainTemplate = getTemplateText_('MESSAGE_FULL');
    if (!mainTemplate) {
      return _fallback_();
    }

    const serviceLine = service
      ? (getTemplateText_('MESSAGE_SERVICE_LINE')
        ? renderTemplate_(getTemplateText_('MESSAGE_SERVICE_LINE'), { service })
        : `Вид служби: ${service}\n`)
      : '';

    const brLine = getTemplateText_('MESSAGE_BR_LINE')
      ? renderTemplate_(getTemplateText_('MESSAGE_BR_LINE'), { brDays: String(br) })
      : `Днів на БР: ${br}\n`;

    const placeBlock = place
      ? (getTemplateText_('MESSAGE_PLACE_BLOCK')
        ? renderTemplate_(getTemplateText_('MESSAGE_PLACE_BLOCK'), { place })
        : `Місце виконання:\n${place}\n\n`)
      : '';

    const tasksBlock = tasks
      ? (getTemplateText_('MESSAGE_TASKS_BLOCK')
        ? renderTemplate_(getTemplateText_('MESSAGE_TASKS_BLOCK'), { tasks })
        : `Виконувані завдання:\n${tasks}\n\n`)
      : '';

    return renderTemplate_(mainTemplate, {
      date: d, serviceLine, brLine, placeBlock, tasksBlock,
      service: service || '', brDays: String(br),
      place: place || '', tasks: tasks || ''
    });

  } catch (e) {
    console.warn('Помилка в buildMessage_, fallback:', e);
    return _fallback_();
  }
}

function showDetailedSummaryDialog_(date, text) {
  const safe = HtmlUtils_.escapeHtml(text);
  const html = HtmlService.createHtmlOutput(`
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
  `).setWidth(700).setHeight(500);
  SpreadsheetApp.getUi().showModalDialog(html, '📊 Детальне зведення');
}
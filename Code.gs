/************ КОНФІГУРАЦІЯ ************/
const CONFIG = {
  // Основні налаштування аркушів
  TARGET_SHEET: '03',
  PHONES_SHEET: 'PHONES',
  DICT_SHEET: 'DICT',
  DICT_SUM_SHEET: 'DICT_SUM',
  LOG_SHEET: 'LOG',
  SEND_PANEL_SHEET: 'SEND_PANEL',

  // Координати даних
  PHONE_COL: 1,
  FIO_COL: 7,
  DATE_ROW: 1,
  CALLSIGN_COL: 2,
  CODE_RANGE_A1: 'H2:AL40',
  OS_FIO_RANGE_A1: 'G2:G40',

  // Технічні параметри
  TZ: Session.getScriptTimeZone(),
  MAX_PAYLOADS: 300,
  MAX_WA_TEXT: 3800,
  CACHE_TTL_SEC: 300,
  COMMANDER_ROLE: 'ГРАФ',

  // Звіти та історія
  SUMMARY_HISTORY_SHEET: 'ІСТОРІЯ_ЗВЕДЕНЬ',
  DETAIL_SHEET: 'ЗВЕДЕННЯ_ПО_ДНЯХ',

  // Візуалізація
  ACTIVE_MONTH_TAB_COLOR: '#fbbc04',
  BOT_MONTH_PROP_KEY: 'BOT_MONTH_SHEET',

  // Панель відправки
  SEND_PANEL_TITLE_ROWS: 1,
  SEND_PANEL_HEADER_ROW: 2,
  SEND_PANEL_DATA_START_ROW: 3,

  // Налаштування бокової панелі
  SIDEBAR_WIDTH: 350,
  SEARCH_DEBOUNCE_MS: 300,
};

/** Налаштування для автоматизації місяців **/
const MONTHLY_CONFIG = {
  DATE_ROW: CONFIG.DATE_ROW,
  FIO_COL: CONFIG.FIO_COL,
  FIRST_DATA_ROW: 2,
  LAST_DATA_ROW: 40,
  CLEAR_RANGES: [CONFIG.CODE_RANGE_A1],
  MONTH_NAMES: {
    '01': 'Січень',
    '02': 'Лютий',
    '03': 'Березень',
    '04': 'Квітень',
    '05': 'Травень',
    '06': 'Червень',
    '07': 'Липень',
    '08': 'Серпень',
    '09': 'Вересень',
    '10': 'Жовтень',
    '11': 'Листопад',
    '12': 'Грудень'
  }
};

/************ ГРУПИ ТА НАЗВИ ************/
const SUMMARY_GROUPS = {
  'БР': ['БР'],
  'Чорний': ['Чорний'],
  'Роланд': ['Роланд'],
  'Евак': ['Евак'],
  'РБпАК': ['РБпАК'],
  '1УРБпАК': ['1УРБпАК'],
  '2УРБпАК': ['2УРБпАК'],
  'КП': ['КП'],
  'Відряд': ['Відряд', 'Київ'],
  'Резерв': ['Резерв'],
  'Відпус': ['Відпус'],
  'Лікарн': ['Лікарн'],
  'Гусачі': ['Гусачі'],
  'БЗВП': ['БЗВП'],
  '*ВО': ['*ВО'],
  '*ВМЗ': ['*ВМЗ'],
  '*ВЗ': ['*ВЗ'],
  '*РБпАК': ['*РБпАК'],
  '*1УРБпАК': ['*1УРБпАК'],
  '*2УРБпАК': ['*2УРБпАК']
};

const FULL_NAMES = {
  'ОС': 'Особовий склад',
  'БР': 'Бойове розпорядження',
  'Евак': 'Медевак',
  'Чорний': 'Екіпаж Чорний',
  'Роланд': 'Екіпаж Роланд',
  'РБпАК': 'Охорона позиції роти БпАК',
  '1УРБпАК': 'Охорона позиції 1 роти УБпАК',
  '2УРБпАК': 'Охорона позиції 2 роти УБпАК',
  'КП': 'Командний пункт',
  '*ВО': 'Підпорядкований/-і взводу охорони',
  '*ВМЗ': 'Підпорядкований/-і взводу матеріального забезпечення',
  '*ВЗ': 'Підпорядкований/-і взводу зв′язку',
  '*РБпАК': 'Підпорядкований/-і роті БпАК',
  '*1УРБпАК': 'Підпорядкований/-і 1 роті УБпАК',
  '*2УРБпАК': 'Підпорядкований/-і 2 роті УБпАК',
  'Резерв': 'Резерв',
  'Відпус': 'Відпустка',
  'Лікарн': 'Госпіталь',
  'СЗЧ': 'Самовільне залишення частини',
  'Відряд': 'Відрядження',
  'Гусачі': 'ППД Гусачівка, одягається, чекає БЗВП',
  'БЗВП': 'Базова військова підготовка'
};

/************ ДОПОМІЖНІ ФУНКЦІЇ ************/
function displayNameForCode_(code) {
  const s = String(code || '').trim();
  return FULL_NAMES[s] || s;
}

/************ BOT MONTH + ПІДСВІТКА ************/
function getBotMonthSheetName_() {
  const props = PropertiesService.getDocumentProperties();
  const p = props.getProperty(CONFIG.BOT_MONTH_PROP_KEY);
  const name = (p && String(p).trim()) ? String(p).trim() : CONFIG.TARGET_SHEET;
  const ss = SpreadsheetApp.getActive();
  return ss.getSheetByName(name) ? name : CONFIG.TARGET_SHEET;
}

function setBotMonthSheetName_(name) {
  name = String(name || '').trim();
  if (!name) throw new Error('Порожня назва аркуша');
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(name);
  if (!sh) throw new Error(`Аркуш "${name}" не знайдено`);
  PropertiesService.getDocumentProperties().setProperty(CONFIG.BOT_MONTH_PROP_KEY, name);
  highlightActiveMonthTab_(name);
}

function getBotSheet_() {
  const ss = SpreadsheetApp.getActive();
  const name = getBotMonthSheetName_();
  const sh = ss.getSheetByName(name);
  if (!sh) throw new Error(`Активний аркуш бота "${name}" не знайдено`);
  return sh;
}

function highlightActiveMonthTab_(activeName) {
  const ss = SpreadsheetApp.getActive();
  const sheets = ss.getSheets();
  sheets.forEach(s => {
    const n = s.getName();
    if (/^\d{2}$/.test(n)) s.setTabColor(null);
  });
  const active = ss.getSheetByName(activeName);
  if (active && /^\d{2}$/.test(activeName)) active.setTabColor(CONFIG.ACTIVE_MONTH_TAB_COLOR);
}

/************ Include функції для HTML ************/
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function includeTemplate(filename) {
  return HtmlService.createTemplateFromFile(filename).evaluate().getContent();
}

function getClientRuntimeContract_() {
  return {
    runtimeFile: 'JavaScript.html',
    bootstrapTemplate: 'Sidebar.html',
    bootstrapMode: 'sidebar-includeTemplate',
    styleInclude: 'Styles.html',
    policyMarker: 'stage7-sidebar-runtime',
    runtimeStatus: 'canonical-modular-runtime',
    runtimeModules: ['Js.Core.html', 'Js.State.html', 'Js.Api.html', 'Js.Render.html', 'Js.Diagnostics.html', 'Js.Helpers.html', 'Js.Events.html', 'Js.Actions.html']
  };
}

// ========== НАЛАШТУВАННЯ НАГАДУВАНЬ ==========
const RAPORT_SETTINGS_KEY = 'RAPORT_REMINDERS_ENABLED';

function normalizeBoolean_(value, defaultValue = true) {
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  return defaultValue;
}

function getRaportRemindersEnabled() {
  const props = PropertiesService.getScriptProperties();
  const value = props.getProperty(RAPORT_SETTINGS_KEY);
  return normalizeBoolean_(value, true);
}

function setRaportRemindersEnabled(enabled) {
  const props = PropertiesService.getScriptProperties();
  const normalized = normalizeBoolean_(enabled, true);
  props.setProperty(RAPORT_SETTINGS_KEY, String(normalized));
  return normalized;
}

function toggleRaportRemindersFromSidebar(enabled) {
  try {
    const normalized = setRaportRemindersEnabled(enabled);
    return {
      success: true,
      enabled: normalized,
      message: normalized
        ? '✓ Нагадування про рапорти ввімкнено'
        : '🔕 Нагадування про рапорти вимкнено'
    };
  } catch (e) {
    return {
      success: false,
      error: e && e.message ? e.message : String(e)
    };
  }
}

function getRaportRemindersState() {
  try {
    return {
      success: true,
      enabled: getRaportRemindersEnabled()
    };
  } catch (e) {
    return {
      success: false,
      error: e && e.message ? e.message : String(e)
    };
  }
}

/************ МЕНЮ ************/
function onOpen() {
  try {
    highlightActiveMonthTab_(getBotMonthSheetName_());
    SpreadsheetApp.getUi()
      .createMenu('🧐ПАНЕЛЬ')
      .addItem('📱 ПАНЕЛЬ', 'showSidebar')
      .addToUi();
  } catch (err) {
    console.error('onOpen error:', err);
  }
}

// ==================== НОВІ ФУНКЦІЇ ====================
function setupVacationTrigger() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    let removed = 0;

    triggers.forEach(t => {
      const fn = t.getHandlerFunction();
      if (fn === 'autoVacationReminder' || fn === 'autoBirthdayReminder') {
        ScriptApp.deleteTrigger(t);
        removed++;
      }
    });

    ScriptApp.newTrigger('autoVacationReminder')
      .timeBased()
      .everyDays(1)
      .atHour(9)
      .create();

    ScriptApp.newTrigger('autoBirthdayReminder')
      .timeBased()
      .everyDays(1)
      .atHour(8)
      .create();

    return {
      success: true,
      removed: removed,
      message: `✓ Тригери встановлено:\n• Відпустки — щодня о 9:00\n• Дні Народження — щодня о 8:00\nВидалено старих: ${removed}`
    };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function cleanupDuplicateTriggers(functionName) {
  try {
    const names = functionName
      ? [functionName]
      : ['autoVacationReminder', 'autoBirthdayReminder'];

    const allTriggers = ScriptApp.getProjectTriggers();
    let found = 0;
    let removed = 0;

    names.forEach(name => {
      const same = allTriggers.filter(t => t.getHandlerFunction() === name);
      found += same.length;

      same.slice(1).forEach(t => {
        ScriptApp.deleteTrigger(t);
        removed++;
      });
    });

    return { ok: true, found, removed };
  } catch (e) {
    return { ok: false, error: e.toString() };
  }
}

/** Діагностика аркуша PHONES — кнопка "📞 Діагностика" */
function debugPhones() {
  try {
    const ss = SpreadsheetApp.getActive();
    const sheet = ss.getSheetByName(CONFIG.PHONES_SHEET);

    if (!sheet) {
      return {
        success: false,
        error: `Аркуш ${CONFIG.PHONES_SHEET} не знайдено`
      };
    }

    const lastRow = sheet.getLastRow();
    const lastCol = Math.max(sheet.getLastColumn(), 4);

    if (lastRow < 1) {
      return {
        success: true,
        sheetName: CONFIG.PHONES_SHEET,
        totalRows: 0,
        contacts: [],
        stats: {
          total: 0,
          withPhone: 0,
          withoutPhone: 0,
          withRole: 0,
          withBirthday: 0
        }
      };
    }

    const values = sheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();
    const headers = values[0].map(function (v) {
      return String(v || '').trim();
    });

    const normalizedHeaders = headers.map(function (h) {
      return String(h || '').trim().toLowerCase();
    });

    function findCol(predicates, fallbackIndex) {
      const idx = normalizedHeaders.findIndex(function (h) {
        return predicates.some(function (p) {
          return h.indexOf(p) !== -1;
        });
      });
      return idx >= 0 ? idx : fallbackIndex;
    }

    const fioCol = findCol(['піб', 'фіо', 'фио'], 0);
    const phoneCol = findCol(['тел', 'phone'], 1);
    const roleCol = findCol(['роль', 'позив', 'callsign'], 2);
    const birthdayCol = findCol(['дн', 'д.н', 'дата народ', 'день народ', 'birthday'], 3);
    function cleanBirthday(value) {
      const s = String(value || '').trim();
      if (!s) return '';
      if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(s)) {
        const parts = s.split('.');
        return parts[0].padStart(2, '0') + '.' + parts[1].padStart(2, '0') + '.' + parts[2];
      }

      if (/^\d{1,2}\.\d{1,2}$/.test(s)) {
        const parts = s.split('.');
        return parts[0].padStart(2, '0') + '.' + parts[1].padStart(2, '0');
      }

      const m = s.match(/(\d{1,2})[.\-/ ](\d{1,2})[.\-/ ](\d{4})/);
      if (m) {
        return String(m[1]).padStart(2, '0') + '.' + String(m[2]).padStart(2, '0') + '.' + m[3];
      }

      return s;
    }

    function cleanPhone(value) {
      return String(value || '').trim();
    }

    const contacts = [];

    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const fio = String(row[fioCol] || '').trim();
      const phone = cleanPhone(row[phoneCol]);
      const role = String(row[roleCol] || '').trim();
      const birthday = cleanBirthday(row[birthdayCol]);

      if (!fio && !phone && !role && !birthday) continue;

      contacts.push({
        row: i + 1,
        fio: fio,
        phone: phone,
        role: role,
        birthday: birthday,
        hasPhone: !!phone,
        hasRole: !!role,
        hasBirthday: !!birthday
      });
    }

    const stats = {
      total: contacts.length,
      withPhone: contacts.filter(function (c) { return c.hasPhone; }).length,
      withoutPhone: contacts.filter(function (c) { return !c.hasPhone; }).length,
      withRole: contacts.filter(function (c) { return c.hasRole; }).length,
      withBirthday: contacts.filter(function (c) { return c.hasBirthday; }).length
    };

    return {
      success: true,
      sheetName: CONFIG.PHONES_SHEET,
      totalRows: contacts.length,
      headers: headers,
      contacts: contacts,
      stats: stats
    };

  } catch (e) {
    return {
      success: false,
      error: e && e.message ? e.message : String(e)
    };
  }
}
/************ КОНФІГУРАЦІЯ ************/
const CONFIG = {
  // Основні налаштування аркушів
  TARGET_SHEET: "06",
  PHONES_SHEET: "PHONES",
  PERSONNEL_SHEET: "PERSONNEL",
  DICT_SHEET: "DICT",
  DICT_SUM_SHEET: "DICT_SUM",
  LOG_SHEET: "LOG",
  SEND_PANEL_SHEET: "SEND_PANEL",

  // Координати даних
  PHONE_COL: 0,
  FML_COL: 0,
  BR_COL: 1,
  DATE_ROW: 1,
  CALLSIGN_COL: 2,
  CODE_RANGE_A1: "C2:AF30",
  OS_FML_RANGE_A1: "",

  // Технічні параметри
  TZ: Session.getScriptTimeZone(),
  MAX_PAYLOADS: 300,
  MAX_WA_TEXT: 3800,
  CACHE_TTL_SEC: 300,
  COMMANDER_ROLE: "ГРАФ",

  // Звіти та історія
  DETAIL_SHEET: "DAILY_SUMMARIES",

  // Візуалізація
  ACTIVE_MONTH_TAB_COLOR: "#fbbc04",
  BOT_MONTH_PROP_KEY: "BOT_MONTH_SHEET",

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
  FML_COL: CONFIG.FML_COL,
  FIRST_DATA_ROW: 2,
  LAST_DATA_ROW: 30,
  CLEAR_RANGES: [CONFIG.CODE_RANGE_A1],
  MONTH_NAMES: {
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
  },
};

/************ ГРУПИ ТА НАЗВИ ************/
const SUMMARY_GROUPS = {
  БР: ["БР"],
  Black: ["Black"],
  Roland: ["Roland"],
  Евак: ["Евак"],
  "1РБпАК": ["1РБпАК"],
  "2РБпАК": ["2РБпАК"],
  "1УРБпАК": ["1УРБпАК"],
  "2УРБпАК": ["2УРБпАК"],
  КП: ["КП"],
  Резерв: ["Резерв"],
  "*ВЗ": ["*ВЗ"],
  "*ВМЗ": ["*ВМЗ"],
  "*1РБпАК": ["*1РБпАК"],
  "*2РБпАК": ["*2РБпАК"],
  "*1УРБпАК": ["*1УРБпАК"],
  "*2УРБпАК": ["*2УРБпАК"],
  Відряд: ["Відряд"],
  Відпус: ["Відпус"],
  Лікарн: ["Лікарн"],
  Київ: ["Київ"],
  Гусачі: ["Гусачі"],
  DC: ["DC"],
  БЗВП: ["БЗВП"],
  СЗЧ: ["СЗЧ"],
  Вибув: ["Вибув"],
};

const FULL_NAMES = {
  ОС: "Особовий склад",
  Black: "Екіпаж Чорний",
  Roland: "Екіпаж Роланд",
  БР: "Бойове розпорядження",
  Евак: "Медевак",
  "1РБпАК": "Охорона позиції 1 роти БпАК",
  "2РБпАК": "Охорона позиції 2 роти БпАК",
  "1УРБпАК": "Охорона позиції 1 роти УБпАК",
  "2УРБпАК": "Охорона позиції 2 роти УБпАК",
  КП: "Командний пункт",
  Резерв: "Резерв",
  "*ВЗ": "Відряджений /-і до взводу зв′язку",
  "*ВМЗ": "Відряджений /-і до взводу МЗ",
  "*1РБпАК": "Відряджений /-і до 1 роти БпАК",
  "*2РБпАК": "Відряджений /-і до 2 роти БпАК",
  "*1УРБпАК": "Відряджений /-і до 1 роти УБпАК",
  "*2УРБпАК": "Відряджений /-і до 2 роти УБпАК",
  Відряд: "У відрядженні",
  Відпус: "Відпустка",
  Лікарн: "Ушпитален/Лікарняний",
  Київ: "ППД Київ",
  Гусачі: "Гусачівка",
  DC: "Drone Camp",
  БЗВП: "Базова військова підготовка",
  СЗЧ: "Самовільне залишення частини",
  Вибув: "Вибув",
};

/************ ДОПОМІЖНІ ФУНКЦІЇ ************/
function displayNameForCode_(code) {
  const s = String(code || "").trim();
  return FULL_NAMES[s] || s;
}

/************ BOT MONTH + ПІДСВІТКА ************/
function getBotMonthSheetName_() {
  const props = PropertiesService.getDocumentProperties();
  const p = props.getProperty(CONFIG.BOT_MONTH_PROP_KEY);
  const ss = getWasbSpreadsheet_();
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, "0");
  const fallback = ss.getSheetByName(currentMonth)
    ? currentMonth
    : CONFIG.TARGET_SHEET;
  const name = p && String(p).trim() ? String(p).trim() : fallback;
  return ss.getSheetByName(name) ? name : fallback;
}

function setBotMonthSheetName_(name) {
  name = String(name || "").trim();
  if (!name) throw new Error("Порожня назва аркуша");
  const ss = getWasbSpreadsheet_();
  const sh = ss.getSheetByName(name);
  if (!sh) throw new Error(`Аркуш "${name}" не знайдено`);
  PropertiesService.getDocumentProperties().setProperty(
    CONFIG.BOT_MONTH_PROP_KEY,
    name,
  );
  highlightActiveMonthTab_(name);
}

function getBotSheet_() {
  const ss = getWasbSpreadsheet_();
  const name = getBotMonthSheetName_();
  const sh = ss.getSheetByName(name);
  if (!sh) throw new Error(`Активний аркуш бота "${name}" не знайдено`);
  return sh;
}

function highlightActiveMonthTab_(activeName) {
  const ss = getWasbSpreadsheet_();
  const sheets = ss.getSheets();
  sheets.forEach((s) => {
    const n = s.getName();
    if (/^\d{2}$/.test(n)) s.setTabColor(null);
  });
  const active = ss.getSheetByName(activeName);
  if (active && /^\d{2}$/.test(activeName))
    active.setTabColor(CONFIG.ACTIVE_MONTH_TAB_COLOR);
}

/************ Include функції для HTML ************/

function resolveHtmlTemplateName_(filename) {
  const name = String(filename || "").trim();
  if (!name) return "";

  const candidates = name.indexOf("/") === -1 ? [name, "ui/" + name] : [name];
  let lastError = null;

  for (let i = 0; i < candidates.length; i++) {
    try {
      HtmlService.createHtmlOutputFromFile(candidates[i]).getContent();
      return candidates[i];
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError;
}

function include(filename) {
  filename = String(filename || "").trim();

  if (!filename) {
    return (
      "include(filename) — службова HTML-функція. " +
      "Її не потрібно запускати вручну. Для відкриття панелі запускай showSidebar()."
    );
  }

  return HtmlService.createHtmlOutputFromFile(resolveHtmlTemplateName_(filename)).getContent();
}

function includeTemplate(filename) {
  filename = String(filename || "").trim();

  if (!filename) {
    return (
      "includeTemplate(filename) — службова HTML-функція. " +
      "Її не потрібно запускати вручну. Для відкриття панелі запускай showSidebar()."
    );
  }

  return HtmlService.createTemplateFromFile(resolveHtmlTemplateName_(filename))
    .evaluate()
    .getContent();
}

function testIncludeSidebar() {
  return include("Sidebar");
}

function testIncludeJavaScript() {
  return include("JavaScript");
}

function testIncludeStyles() {
  return include("Styles");
}

function testIncludeTemplateSidebar() {
  return includeTemplate("Sidebar");
}

function getClientRuntimeContract_() {
  return {
    runtimeFile: "JavaScript.html",
    bootstrapTemplate: "Sidebar.html",
    bootstrapMode: "sidebar-includeTemplate",
    styleInclude: "Styles.html",
    policyMarker: "stage7-sidebar-runtime",
    runtimeStatus: "canonical-modular-runtime",
    runtimeModules: [
      "Js.Core.html",
      "Js.State.html",
      "Js.Api.html",
      "Js.Render.Panel.html",
      "Js.Render.Calendar.html",
      "Js.Render.Results.html",
      "Js.Vacations.html",
      "Js.Diagnostics.html",
      "Js.Security.Boot.html",
      "Js.Security.Util.html",
      "Js.Security.Access.html",
      "Js.Security.Debug.html",
      "Js.Security.Login.html",
      "Js.Security.DebugView.html",
      "Js.Security.Policy.html",
      "Js.Security.Guards.html",
      "Js.Security.Forms.html",
      "Js.Security.Exports.html",
      "Js.Helpers.html",
      "Js.Events.html",
      "Js.Actions.html",
    ],
  };
}

/************ МЕНЮ ************/

function onOpen(e) {
  try {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu("WASB").addItem("Відкрити панель", "showSidebar").addToUi();
  } catch (err) {
    console.error("onOpen menu error:", err);
  }

  try {
    if (
      typeof highlightActiveMonthTab_ === "function" &&
      typeof getBotMonthSheetName_ === "function"
    ) {
      highlightActiveMonthTab_(getBotMonthSheetName_());
    }
  } catch (err1) {
    console.error("onOpen highlightActiveMonthTab_ error:", err1);
  }

  try {
    const activeSheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    if (
      typeof AccessControl_ === "object" &&
      AccessControl_ &&
      typeof AccessControl_.refreshAccessSheetUi === "function" &&
      activeSheet.getName().toUpperCase() === "ACCESS"
    ) {
      AccessControl_.refreshAccessSheetUi({ forceRewriteNotes: false });
    }
  } catch (err2) {
    console.error("onOpen refreshAccessSheetUi error:", err2);
  }
}

function uiShowSimpleDaySummary(dateStr) {
  try {
    const ctx =
      typeof SummaryService_ === "object" && SummaryService_
        ? SummaryService_.buildDay(dateStr || _todayStr_())
        : null;
    const date = (ctx && ctx.date) || dateStr || _todayStr_();
    const text = (ctx && ctx.summary) || "";

    if (typeof showDetailedSummaryDialog_ === "function") {
      showDetailedSummaryDialog_(date, text);
      return { ok: true, date: date };
    }

    SpreadsheetApp.getUi().alert(text || "(порожнє зведення)");
    return { ok: true, date: date };
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    SpreadsheetApp.getUi().alert("Помилка: " + msg);
    return { ok: false, error: msg };
  }
}

function uiShowDetailedDaySummary(dateStr) {
  try {
    const ctx =
      typeof SummaryService_ === "object" && SummaryService_
        ? SummaryService_.buildDetailed(dateStr || _todayStr_())
        : null;
    const date = (ctx && ctx.date) || dateStr || _todayStr_();
    const text = (ctx && ctx.summary) || "";

    if (typeof showDetailedSummaryDialog_ === "function") {
      showDetailedSummaryDialog_(date, text);
      return { ok: true, date: date };
    }

    SpreadsheetApp.getUi().alert(text || "(порожнє зведення)");
    return { ok: true, date: date };
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    SpreadsheetApp.getUi().alert("Помилка: " + msg);
    return { ok: false, error: msg };
  }
}

// ==================== НОВІ ФУНКЦІЇ ====================

function setupVacationTrigger() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    let removed = 0;

    triggers.forEach((t) => {
      const fn = t.getHandlerFunction();
      if (fn === "autoVacationReminder" || fn === "autoBirthdayReminder") {
        ScriptApp.deleteTrigger(t);
        removed++;
      }
    });

    try {
      if (
        typeof stage7GetFeatureFlag_ === "function" &&
        stage7GetFeatureFlag_("managedTriggers", true) &&
        typeof Stage7Triggers_ === "object" &&
        Stage7Triggers_ &&
        typeof Stage7Triggers_.installManagedTriggers === "function"
      ) {
        const stage7 = Stage7Triggers_.installManagedTriggers();
        return {
          success: true,
          removed: removed,
          stage7: stage7,
          message:
            `✓ Stage7 jobs встановлено (managedTriggers).\n` +
            `Видалено legacy auto* тригерів: ${removed}`,
        };
      }
    } catch (_) {}

    ScriptApp.newTrigger("autoVacationReminder")
      .timeBased()
      .everyDays(1)
      .atHour(17)
      .create();

    ScriptApp.newTrigger("autoBirthdayReminder")
      .timeBased()
      .everyDays(1)
      .atHour(18)
      .create();

    return {
      success: true,
      removed: removed,
      message: `✓ Тригери встановлено:\n• Відпустки — щодня о 17:00\n• Дні Народження — щодня о 18:00\nВидалено старих: ${removed}`,
    };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function cleanupDuplicateTriggers(functionName) {
  try {
    const names = functionName
      ? [functionName]
      : ["autoVacationReminder", "autoBirthdayReminder"];

    const allTriggers = ScriptApp.getProjectTriggers();
    let found = 0;
    let removed = 0;

    names.forEach((name) => {
      const same = allTriggers.filter((t) => t.getHandlerFunction() === name);
      found += same.length;

      same.slice(1).forEach((t) => {
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
    const ss = getWasbSpreadsheet_();
    const sheet = ss.getSheetByName(CONFIG.PHONES_SHEET);

    if (!sheet) {
      return {
        success: false,
        error: `Аркуш ${CONFIG.PHONES_SHEET} не знайдено`,
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
          withBirthday: 0,
        },
      };
    }

    const values = sheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();
    const headers = values[0].map(function (v) {
      return String(v || "").trim();
    });

    const normalizedHeaders = headers.map(function (h) {
      return String(h || "")
        .trim()
        .toLowerCase();
    });

    function findCol(predicates, fallbackIndex) {
      const idx = normalizedHeaders.findIndex(function (h) {
        return predicates.some(function (p) {
          return h.indexOf(p) !== -1;
        });
      });
      return idx >= 0 ? idx : fallbackIndex;
    }

    const fmlCol = findCol(["піб", "фіо", "fml"], 0);
    const phoneCol = findCol(["тел", "телефон", "phones", "phone"], 1);
    const roleCol = findCol(["роль", "позив", "callsign", "role"], 2);
    const birthdayCol = findCol(
      ["дн", "д.н", "дата народ", "день народ", "birthday"],
      3,
    );
    function cleanBirthday(value) {
      const s = String(value || "").trim();
      if (!s) return "";
      if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(s)) {
        const parts = s.split(".");
        return (
          parts[0].padStart(2, "0") +
          "." +
          parts[1].padStart(2, "0") +
          "." +
          parts[2]
        );
      }

      if (/^\d{1,2}\.\d{1,2}$/.test(s)) {
        const parts = s.split(".");
        return parts[0].padStart(2, "0") + "." + parts[1].padStart(2, "0");
      }

      const m = s.match(/(\d{1,2})[.\-/ ](\d{1,2})[.\-/ ](\d{4})/);
      if (m) {
        return (
          String(m[1]).padStart(2, "0") +
          "." +
          String(m[2]).padStart(2, "0") +
          "." +
          m[3]
        );
      }
      return s;
    }

    function cleanPhone(value) {
      return String(value || "").trim();
    }

    const contacts = [];

    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const fml = String(row[fmlCol] || "").trim();
      const phone = cleanPhone(row[phoneCol]);
      const role = String(row[roleCol] || "").trim();
      const birthday = cleanBirthday(row[birthdayCol]);

      if (!fml && !phone && !role && !birthday) continue;

      contacts.push({
        row: i + 1,
        fml: fml,
        phone: phone,
        role: role,
        birthday: birthday,
        hasPhone: !!phone,
        hasRole: !!role,
        hasBirthday: !!birthday,
      });
    }

    const stats = {
      total: contacts.length,
      withPhone: contacts.filter(function (c) {
        return c.hasPhone;
      }).length,
      withoutPhone: contacts.filter(function (c) {
        return !c.hasPhone;
      }).length,
      withRole: contacts.filter(function (c) {
        return c.hasRole;
      }).length,
      withBirthday: contacts.filter(function (c) {
        return c.hasBirthday;
      }).length,
    };

    return {
      success: true,
      sheetName: CONFIG.PHONES_SHEET,
      totalRows: contacts.length,
      headers: headers,
      contacts: contacts,
      stats: stats,
    };
  } catch (e) {
    return {
      success: false,
      error: e && e.message ? e.message : String(e),
    };
  }
}

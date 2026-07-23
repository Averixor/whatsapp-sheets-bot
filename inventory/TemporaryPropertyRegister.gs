/**
 * TemporaryPropertyRegister.gs — облік майна, виданого у тимчасове користування.
 *
 * Аркуші:
 * - Property_issued_for_temporary_u — робочий журнал видачі та повернення;
 * - PROPERTY_CATALOG — довідник категорій, моделей і одиниць обліку;
 * - PROPERTY_KITS — склад комплектів.
 *
 * Основне правило: кількість зберігається числом, одиниця обліку — окремо.
 * Комплектуючі створюються пов'язаними службовими рядками та можуть
 * повертатися окремо від основного майна.
 */

const TemporaryPropertyRegister_ = (function () {
  const DEFAULTS = Object.freeze({
    SHEET_NAME: "Property_issued_for_temporary_u",
    CATALOG_SHEET_NAME: "PROPERTY_CATALOG",
    KITS_SHEET_NAME: "PROPERTY_KITS",
    PERSONNEL_SHEET_NAME: "PERSONNEL",
    HEADER_ROW: 1,
    FIRST_DATA_ROW: 2,
    MAX_VALIDATION_ROWS: 1000,
    HEADER_COLOR: "#1F4E78",
    HEADER_TEXT_COLOR: "#FFFFFF",
    COMPONENT_COLOR: "#EAF2F8",
    RETURNED_COLOR: "#D9EAD3",
    PARTIAL_COLOR: "#FFF2CC",
    OUTSTANDING_COLOR: "#F4CCCC",
    TECHNICAL_COLOR: "#E7E6E6",
  });

  const COL = Object.freeze({
    CALLSIGN: 1,
    POST: 2,
    CATEGORY: 3,
    MODEL: 4,
    ISSUED_QTY: 5,
    UNIT: 6,
    ISSUED_DATE: 7,
    RETURNED_QTY: 8,
    RETURNED_DATE: 9,
    BALANCE: 10,
    STATUS: 11,
    FUEL_TYPE: 12,
    FUEL_VOLUME: 13,
    NOTE: 14,
    RECORD_ID: 15,
    KIT_ID: 16,
    PARENT_ID: 17,
    ROW_TYPE: 18,
    CATALOG_CODE: 19,
    AUTO_ROW: 20,
  });

  const HEADERS = Object.freeze([
    "Позивний",
    "Пост / об'єкт",
    "Вид майна",
    "Найменування / модель",
    "Видано",
    "Од. обліку",
    "Дата видачі",
    "Повернуто",
    "Дата повернення",
    "Залишок",
    "Статус",
    "Вид палива",
    "Об'єм палива, л",
    "Комплектність / примітка",
    "ID запису",
    "ID комплекту",
    "Батьківський ID",
    "Тип рядка",
    "Код майна",
    "Авто-рядок",
  ]);

  const CATALOG_HEADERS = Object.freeze([
    "Код",
    "Вид майна",
    "Найменування / модель",
    "Од. обліку",
    "Комплект",
    "Потрібні дані про паливо",
    "Доступно для вибору",
    "Примітка",
    "Порядок",
  ]);

  const KIT_HEADERS = Object.freeze([
    "Код основного майна",
    "Комплектуюча",
    "Кількість",
    "Од. обліку",
    "Код комплектуючої",
    "Порядок",
  ]);

  const STATUS = Object.freeze({
    OUTSTANDING: "НЕ ПОВЕРНУТО",
    PARTIAL: "ЧАСТКОВО ПОВЕРНУТО",
    INCOMPLETE_KIT: "НЕПОВНИЙ КОМПЛЕКТ",
    RETURNED: "ПОВЕРНУТО",
  });

  const ROW_TYPE = Object.freeze({
    MAIN: "Основне",
    COMPONENT: "Комплектуюча",
  });

  const YES = "Так";
  const NO = "Ні";

  const DEFAULT_CATALOG = Object.freeze([
    ["BUREVII_RV_M7", "Зарядна станція", "Буревій РВ М7", "компл.", YES, NO, YES, "Станція та зарядний кабель", 10],
    ["WORKMATE_WM_S8", "Планшет", "WorkMate WM S8", "шт.", NO, NO, YES, "", 20],
    ["STARLINK_GEN2", "Супутникове обладнання", "Starlink Gen 2", "компл.", YES, NO, YES, "Термінал, кабель, роутер і платформа", 30],
    ["DELL_VOSTRO_3501", "Ноутбук", "Dell Vostro 3501", "компл.", YES, NO, YES, "Ноутбук та зарядний кабель", 40],
    ["MOTOROLA_DP4400E", "Радіостанція", "Motorola DP4400e", "шт.", YES, NO, YES, "Перехідник до павука та павук", 50],
    ["MOTOROLA_R7AN", "Радіостанція", "Motorola R7aН", "шт.", YES, NO, YES, "Антена та додаткова АКБ", 60],
    ["RADIO_CHARGER", "Зарядний пристрій", "Зарядний пристрій до радіостанцій", "компл.", YES, NO, YES, "Універсальний для Motorola DP4400e та Motorola R7aН", 70],
    ["SIM_BAKHMUT_TELECOM", "SIM-картка", "Бахмут Телеком", "шт.", NO, NO, YES, "", 80],
    ["TRANSFORMER_3KW", "Трансформатор", "Трансформатор 3 кВт", "шт.", NO, NO, YES, "", 90],
    ["GEN_MXR3500_3KW", "Інверторний генератор", "MXR 3500, 3 кВт", "шт.", NO, NO, YES, "", 100],
    ["GEN_2000_SUPER_QUIET", "Інверторний генератор", "2000 Super Quiet", "шт.", NO, NO, YES, "", 110],
    ["FOLDING_BED", "Побутове майно", "Розкладачка", "шт.", NO, NO, YES, "", 120],
    ["EXT_BLACK_15M", "Подовжувач", "Подовжувач чорний, 15 м", "шт.", NO, NO, YES, "", 130],
    ["EXT_YELLOW", "Подовжувач", "Подовжувач жовтий", "шт.", NO, NO, YES, "Довжину не уточнено", 140],
    ["LIGHT_EXT_5M", "Освітлення", "Подовжувач освітлення, 5 м", "шт.", NO, NO, YES, "Кабель 5 м, патрон із лампою та вилка", 150],
    ["SAFARI_RIFLE", "Зброя", "Рушниця Safari", "шт.", NO, NO, YES, "", 160],
    ["MASSIT", "Інструмент", "Массіть", "шт.", NO, NO, YES, "Назву збережено за первинним обліком", 170],
    ["FUEL_CAN", "ПММ", "Каністра з паливом", "шт.", NO, YES, YES, "Вид та фактичний об'єм палива заповнюються окремо", 180],
    ["AUTEL_BATTERY_4T4N", "АКБ БпЛА", "АКБ Autel EVO Max 4T/4N", "шт.", NO, NO, YES, "", 190],
    ["ROC4_SIGNAL_KIT", "Обладнання БпЛА", "Комплект обладнання для підсилення сигналів керування БпЛА ROC 4", "компл.", YES, NO, YES, "Склад комплекту поки не деталізовано", 200],
    ["AUTEL_EVO_MAX_4N", "БпЛА", "Autel EVO Max 4N", "шт.", NO, NO, YES, "", 210],
    ["BATTERY_4S1P", "АКБ", "АКБ 4S1P", "шт.", NO, NO, YES, "", 220],
    ["TOOLKITRC_Q6", "Зарядний пристрій", "ToolkitRC Q6", "шт.", NO, NO, YES, "", 230],

    // Окремі комплектуючі можна видавати як запасні або передавати в ремонт.
    ["RADIO_CHARGING_CUP", "Комплектуючі до радіостанцій", "Зарядний стакан до радіостанцій", "шт.", NO, NO, YES, "", 300],
    ["RADIO_POWER_SUPPLY", "Комплектуючі до радіостанцій", "Блок живлення зарядного пристрою", "шт.", NO, NO, YES, "", 310],
    ["R7AN_EXTRA_BATTERY", "Комплектуючі до радіостанцій", "Додаткова АКБ Motorola R7aН", "шт.", NO, NO, YES, "", 320],
    ["DP4400E_SPIDER_ADAPTER", "Комплектуючі до радіостанцій", "Перехідник до павука", "шт.", NO, NO, YES, "", 330],
    ["DP4400E_SPIDER", "Комплектуючі до радіостанцій", "Павук", "шт.", NO, NO, YES, "", 340],

    // Legacy-позиції залишаються для безпечної міграції, але не пропонуються в нових записах.
    ["LEGACY_CHUIKA", "Інше", "Чуйка", "шт.", NO, NO, NO, "Legacy-позиція з попереднього журналу", 900],
    ["LEGACY_GENERATOR", "Інверторний генератор", "Інверторний генератор — модель не уточнена", "шт.", NO, NO, NO, "Потрібно уточнити модель", 910],
  ]);

  const DEFAULT_KITS = Object.freeze([
    ["BUREVII_RV_M7", "Зарядний кабель Буревій РВ М7", 1, "шт.", "BUREVII_CHARGING_CABLE", 10],
    ["STARLINK_GEN2", "Кабель Starlink", 1, "шт.", "STARLINK_CABLE", 10],
    ["STARLINK_GEN2", "Роутер Starlink Gen 2", 1, "шт.", "STARLINK_ROUTER", 20],
    ["STARLINK_GEN2", "Платформа (ніжка / підставка)", 1, "шт.", "STARLINK_STAND", 30],
    ["DELL_VOSTRO_3501", "Зарядний кабель Dell Vostro 3501", 1, "шт.", "DELL_CHARGING_CABLE", 10],
    ["MOTOROLA_DP4400E", "Перехідник до павука", 1, "шт.", "DP4400E_SPIDER_ADAPTER", 10],
    ["MOTOROLA_DP4400E", "Павук", 1, "шт.", "DP4400E_SPIDER", 20],
    ["MOTOROLA_R7AN", "Антена Motorola R7aН", 1, "шт.", "R7AN_ANTENNA", 10],
    ["MOTOROLA_R7AN", "Додаткова АКБ Motorola R7aН", 1, "шт.", "R7AN_EXTRA_BATTERY", 20],
    ["RADIO_CHARGER", "Зарядний стакан до радіостанцій", 1, "шт.", "RADIO_CHARGING_CUP", 10],
    ["RADIO_CHARGER", "Блок живлення зарядного пристрою", 1, "шт.", "RADIO_POWER_SUPPLY", 20],
  ]);

  const LEGACY_ALIASES = Object.freeze({
    "r7a": "MOTOROLA_R7AN",
    "r7ан": "MOTOROLA_R7AN",
    "dp40": "MOTOROLA_DP4400E",
    "dp-40": "MOTOROLA_DP4400E",
    "dp4400e": "MOTOROLA_DP4400E",
    "зарядка": "RADIO_CHARGER",
    "зарядний пристрій": "RADIO_CHARGER",
    "чуйка": "LEGACY_CHUIKA",
    "стакан": "RADIO_CHARGING_CUP",
    "зарядний стакан": "RADIO_CHARGING_CUP",
    "старлінк": "STARLINK_GEN2",
    "starlink": "STARLINK_GEN2",
    "генератор": "LEGACY_GENERATOR",
    "буревій": "BUREVII_RV_M7",
    "роскладушка": "FOLDING_BED",
    "розкладушка": "FOLDING_BED",
    "розкладачка": "FOLDING_BED",
    "софарі": "SAFARI_RIFLE",
    "сафарі": "SAFARI_RIFLE",
    "safari": "SAFARI_RIFLE",
    "освітлення": "LIGHT_EXT_5M",
    "подовжувач": "EXT_BLACK_15M",
    "подовжувач жовтий": "EXT_YELLOW",
    "каністра бензину": "FUEL_CAN",
    "каністра з паливом": "FUEL_CAN",
    "массіть": "MASSIT",
    "павук": "DP4400E_SPIDER",
    "перехідник до павука": "DP4400E_SPIDER_ADAPTER",
    "перехидник до павука": "DP4400E_SPIDER_ADAPTER",
    "доп батарея r7a": "R7AN_EXTRA_BATTERY",
    "додаткова батарея r7a": "R7AN_EXTRA_BATTERY",
  });

  function config_() {
    const cfg = typeof CONFIG === "object" && CONFIG ? CONFIG : {};
    return {
      sheetName: cfg.TEMP_PROPERTY_SHEET || DEFAULTS.SHEET_NAME,
      catalogSheetName: cfg.PROPERTY_CATALOG_SHEET || DEFAULTS.CATALOG_SHEET_NAME,
      kitsSheetName: cfg.PROPERTY_KITS_SHEET || DEFAULTS.KITS_SHEET_NAME,
      personnelSheetName: cfg.PERSONNEL_SHEET || DEFAULTS.PERSONNEL_SHEET_NAME,
    };
  }

  let eventSpreadsheet_ = null;

  function spreadsheet_() {
    // Simple onEdit(e) triggers must work only with the spreadsheet that caused
    // the event. Calling SpreadsheetApp.openById() from a simple trigger may
    // require authorization and silently break dependent dropdowns.
    return eventSpreadsheet_ || getWasbSpreadsheet_();
  }

  function withEventSpreadsheet_(spreadsheet, callback) {
    const previous = eventSpreadsheet_;
    eventSpreadsheet_ = spreadsheet || previous;
    try {
      return callback();
    } finally {
      eventSpreadsheet_ = previous;
    }
  }

  function text_(value) {
    return String(value === null || typeof value === "undefined" ? "" : value).trim();
  }

  function key_(value) {
    return text_(value)
      .toLowerCase()
      .replace(/[’'`ʼ"]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function number_(value) {
    if (typeof value === "number" && isFinite(value)) return value;
    const normalized = text_(value)
      .replace(/\s+/g, "")
      .replace(",", ".")
      .replace(/[^0-9.-]/g, "");
    const parsed = Number(normalized);
    return isFinite(parsed) ? parsed : 0;
  }

  function roundQty_(value) {
    const n = Math.max(0, number_(value));
    return Math.round(n * 1000) / 1000;
  }

  function bool_(value) {
    const normalized = key_(value);
    return value === true || normalized === "так" || normalized === "true" || normalized === "1";
  }

  function sameHeaders_(actual, expected) {
    if (!Array.isArray(actual) || actual.length < expected.length) return false;
    for (let i = 0; i < expected.length; i++) {
      if (text_(actual[i]) !== expected[i]) return false;
    }
    return true;
  }

  function uniqueId_() {
    try {
      return Utilities.getUuid();
    } catch (e) {
      return "TP-" + new Date().getTime() + "-" + Math.floor(Math.random() * 1000000);
    }
  }

  function today_() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function getOrCreateSheet_(name) {
    const ss = spreadsheet_();
    return ss.getSheetByName(name) || ss.insertSheet(name);
  }

  function ensureColumns_(sheet, required) {
    const current = Math.max(Number(sheet.getMaxColumns()) || 0, 1);
    if (current < required) sheet.insertColumnsAfter(current, required - current);
  }

  function ensureRows_(sheet, required) {
    const current = Math.max(Number(sheet.getMaxRows()) || 0, 1);
    if (current < required) sheet.insertRowsAfter(current, required - current);
  }

  function formatHeader_(range) {
    range
      .setFontWeight("bold")
      .setFontColor(DEFAULTS.HEADER_TEXT_COLOR)
      .setBackground(DEFAULTS.HEADER_COLOR)
      .setHorizontalAlignment("center")
      .setVerticalAlignment("middle")
      .setWrap(true);
  }

  function applyRegisterFormatting_(sheet) {
    ensureColumns_(sheet, HEADERS.length);
    ensureRows_(sheet, DEFAULTS.MAX_VALIDATION_ROWS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    formatHeader_(sheet.getRange(1, 1, 1, HEADERS.length));
    sheet.setRowHeight(1, 38);

    const widths = [110, 190, 180, 300, 80, 90, 105, 90, 105, 90, 175, 115, 110, 300, 170, 170, 170, 110, 150, 90];
    widths.forEach(function (width, index) {
      sheet.setColumnWidth(index + 1, width);
    });

    sheet.getRange(DEFAULTS.FIRST_DATA_ROW, 1, DEFAULTS.MAX_VALIDATION_ROWS - 1, HEADERS.length)
      .setVerticalAlignment("middle")
      .setWrap(true);
    sheet.getRange(DEFAULTS.FIRST_DATA_ROW, COL.ISSUED_DATE, DEFAULTS.MAX_VALIDATION_ROWS - 1, 1).setNumberFormat("dd.MM.yy");
    sheet.getRange(DEFAULTS.FIRST_DATA_ROW, COL.RETURNED_DATE, DEFAULTS.MAX_VALIDATION_ROWS - 1, 1).setNumberFormat("dd.MM.yy");
    sheet.getRange(DEFAULTS.FIRST_DATA_ROW, COL.ISSUED_QTY, DEFAULTS.MAX_VALIDATION_ROWS - 1, 1).setNumberFormat("0.###");
    sheet.getRange(DEFAULTS.FIRST_DATA_ROW, COL.RETURNED_QTY, DEFAULTS.MAX_VALIDATION_ROWS - 1, 1).setNumberFormat("0.###");
    sheet.getRange(DEFAULTS.FIRST_DATA_ROW, COL.BALANCE, DEFAULTS.MAX_VALIDATION_ROWS - 1, 1).setNumberFormat("0.###");
    sheet.getRange(DEFAULTS.FIRST_DATA_ROW, COL.FUEL_VOLUME, DEFAULTS.MAX_VALIDATION_ROWS - 1, 1).setNumberFormat("0.###");

    sheet.getRange(1, COL.RECORD_ID, DEFAULTS.MAX_VALIDATION_ROWS, HEADERS.length - COL.RECORD_ID + 1)
      .setBackground(DEFAULTS.TECHNICAL_COLOR)
      .setFontColor("#666666");
    formatHeader_(sheet.getRange(1, COL.RECORD_ID, 1, HEADERS.length - COL.RECORD_ID + 1));
    sheet.hideColumns(COL.RECORD_ID, HEADERS.length - COL.RECORD_ID + 1);

    if (sheet.getFilter()) sheet.getFilter().remove();
    sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 2), HEADERS.length).createFilter();
  }

  function seedReferenceSheet_(sheet, headers, rows, widths) {
    ensureColumns_(sheet, headers.length);
    ensureRows_(sheet, Math.max(rows.length + 1, 100));
    sheet.getDataRange().clearContent().clearDataValidations();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    if (rows.length) sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    formatHeader_(sheet.getRange(1, 1, 1, headers.length));
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, rows.length + 1, headers.length).setWrap(true).setVerticalAlignment("middle");
    (widths || []).forEach(function (width, index) {
      sheet.setColumnWidth(index + 1, width);
    });
    if (sheet.getFilter()) sheet.getFilter().remove();
    sheet.getRange(1, 1, rows.length + 1, headers.length).createFilter();
  }

  function seedCatalogSheets_() {
    const cfg = config_();
    const catalogSheet = getOrCreateSheet_(cfg.catalogSheetName);
    const kitsSheet = getOrCreateSheet_(cfg.kitsSheetName);
    seedReferenceSheet_(catalogSheet, CATALOG_HEADERS, DEFAULT_CATALOG, [170, 210, 360, 100, 100, 170, 160, 380, 80]);
    seedReferenceSheet_(kitsSheet, KIT_HEADERS, DEFAULT_KITS, [190, 360, 100, 100, 190, 80]);
    return { catalogSheet: catalogSheet, kitsSheet: kitsSheet };
  }

  function readCatalog_() {
    const cfg = config_();
    const sheet = spreadsheet_().getSheetByName(cfg.catalogSheetName);
    const rows = sheet && sheet.getLastRow() >= 2
      ? sheet.getRange(2, 1, sheet.getLastRow() - 1, CATALOG_HEADERS.length).getDisplayValues()
      : DEFAULT_CATALOG;
    const items = [];
    const byCode = {};
    const byModel = {};
    const categories = {};

    rows.forEach(function (row) {
      const code = text_(row[0]);
      const category = text_(row[1]);
      const model = text_(row[2]);
      if (!code || !model) return;
      const item = {
        code: code,
        category: category,
        model: model,
        unit: text_(row[3]) || "шт.",
        isKit: bool_(row[4]),
        requiresFuel: bool_(row[5]),
        selectable: bool_(row[6]),
        note: text_(row[7]),
        order: number_(row[8]),
      };
      items.push(item);
      byCode[code] = item;
      byModel[key_(model)] = item;
      if (item.selectable && category) categories[category] = true;
    });

    items.sort(function (a, b) {
      return a.order - b.order || a.model.localeCompare(b.model, "uk");
    });
    return {
      items: items,
      byCode: byCode,
      byModel: byModel,
      categories: Object.keys(categories).sort(function (a, b) { return a.localeCompare(b, "uk"); }),
    };
  }

  function readKits_() {
    const cfg = config_();
    const sheet = spreadsheet_().getSheetByName(cfg.kitsSheetName);
    const rows = sheet && sheet.getLastRow() >= 2
      ? sheet.getRange(2, 1, sheet.getLastRow() - 1, KIT_HEADERS.length).getDisplayValues()
      : DEFAULT_KITS;
    const byParentCode = {};
    rows.forEach(function (row) {
      const parentCode = text_(row[0]);
      const name = text_(row[1]);
      if (!parentCode || !name) return;
      if (!byParentCode[parentCode]) byParentCode[parentCode] = [];
      byParentCode[parentCode].push({
        parentCode: parentCode,
        name: name,
        quantity: Math.max(roundQty_(row[2]), 1),
        unit: text_(row[3]) || "шт.",
        code: text_(row[4]),
        order: number_(row[5]),
      });
    });
    Object.keys(byParentCode).forEach(function (parentCode) {
      byParentCode[parentCode].sort(function (a, b) {
        return a.order - b.order || a.name.localeCompare(b.name, "uk");
      });
    });
    return byParentCode;
  }

  function isModernSheet_(sheet) {
    if (!sheet || sheet.getLastColumn() < HEADERS.length) return false;
    const actual = sheet.getRange(1, 1, 1, HEADERS.length).getDisplayValues()[0] || [];
    return sameHeaders_(actual, HEADERS);
  }

  function personnelCallsigns_() {
    const cfg = config_();
    const sheet = spreadsheet_().getSheetByName(cfg.personnelSheetName);
    if (!sheet || sheet.getLastRow() < 2) return [];
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0] || [];
    let callsignColumn = 0;
    headers.forEach(function (header, index) {
      const normalized = key_(header);
      if (normalized === "callsign" || normalized === "позивний") callsignColumn = index + 1;
    });
    if (!callsignColumn) return [];
    const seen = {};
    return sheet.getRange(2, callsignColumn, sheet.getLastRow() - 1, 1).getDisplayValues()
      .map(function (row) { return text_(row[0]); })
      .filter(function (value) {
        const normalized = key_(value);
        if (!normalized || seen[normalized]) return false;
        seen[normalized] = true;
        return true;
      })
      .sort(function (a, b) { return a.localeCompare(b, "uk"); });
  }

  function modelsForCategory_(catalog, category) {
    const normalized = key_(category);
    return catalog.items
      .filter(function (item) {
        return item.selectable && key_(item.category) === normalized;
      })
      .map(function (item) { return item.model; });
  }

  function listValidation_(values, allowInvalid) {
    const safe = (values || []).filter(Boolean);
    if (!safe.length) return null;
    return SpreadsheetApp.newDataValidation()
      .requireValueInList(safe, true)
      .setAllowInvalid(allowInvalid === true)
      .build();
  }

  function applyModelValidationForRow_(sheet, row, catalog) {
    const category = text_(sheet.getRange(row, COL.CATEGORY).getDisplayValue());
    const models = modelsForCategory_(catalog, category);
    const cell = sheet.getRange(row, COL.MODEL);
    const validation = listValidation_(models, false);
    if (validation) cell.setDataValidation(validation);
    else cell.clearDataValidations();
  }

  function applyValidations_(sheet) {
    const catalog = readCatalog_();
    const rowCount = DEFAULTS.MAX_VALIDATION_ROWS - DEFAULTS.FIRST_DATA_ROW + 1;
    const callsigns = personnelCallsigns_();
    const callsignValidation = listValidation_(callsigns, true);
    const categoryValidation = listValidation_(catalog.categories, false);
    const fuelValidation = listValidation_(["Бензин", "Дизельне паливо", "Інше"], true);

    if (callsignValidation) sheet.getRange(DEFAULTS.FIRST_DATA_ROW, COL.CALLSIGN, rowCount, 1).setDataValidation(callsignValidation);
    if (categoryValidation) sheet.getRange(DEFAULTS.FIRST_DATA_ROW, COL.CATEGORY, rowCount, 1).setDataValidation(categoryValidation);
    if (fuelValidation) sheet.getRange(DEFAULTS.FIRST_DATA_ROW, COL.FUEL_TYPE, rowCount, 1).setDataValidation(fuelValidation);

    const last = Math.max(sheet.getLastRow(), DEFAULTS.FIRST_DATA_ROW);
    for (let row = DEFAULTS.FIRST_DATA_ROW; row <= last; row++) {
      const rowType = text_(sheet.getRange(row, COL.ROW_TYPE).getDisplayValue());
      if (rowType === ROW_TYPE.COMPONENT) continue;
      applyModelValidationForRow_(sheet, row, catalog);
    }
  }

  function getRowValues_(sheet, row) {
    return sheet.getRange(row, 1, 1, HEADERS.length).getValues()[0] || [];
  }

  function setRowValues_(sheet, row, values) {
    const padded = Array.from({ length: HEADERS.length }, function (_, index) {
      return typeof values[index] === "undefined" ? "" : values[index];
    });
    sheet.getRange(row, 1, 1, HEADERS.length).setValues([padded]);
  }

  function styleStatusCell_(sheet, row, status) {
    let background = "#FFFFFF";
    let color = "#1F2937";
    let weight = "normal";
    if (status === STATUS.RETURNED) {
      background = DEFAULTS.RETURNED_COLOR;
      color = "#166534";
      weight = "bold";
    } else if (status === STATUS.PARTIAL || status === STATUS.INCOMPLETE_KIT) {
      background = DEFAULTS.PARTIAL_COLOR;
      color = "#854D0E";
      weight = "bold";
    } else if (status === STATUS.OUTSTANDING) {
      background = DEFAULTS.OUTSTANDING_COLOR;
      color = "#991B1B";
      weight = "bold";
    }
    sheet.getRange(row, COL.STATUS)
      .setBackground(background)
      .setFontColor(color)
      .setFontWeight(weight);
  }

  function calculateOwnStatus_(issued, returned) {
    const issuedQty = roundQty_(issued);
    const returnedQty = Math.min(roundQty_(returned), issuedQty);
    const balance = Math.max(roundQty_(issuedQty - returnedQty), 0);
    let status = STATUS.OUTSTANDING;
    if (balance === 0 && issuedQty > 0) status = STATUS.RETURNED;
    else if (returnedQty > 0) status = STATUS.PARTIAL;
    return { issued: issuedQty, returned: returnedQty, balance: balance, status: status };
  }

  function findRowByRecordId_(sheet, recordId) {
    const wanted = text_(recordId);
    if (!wanted || sheet.getLastRow() < DEFAULTS.FIRST_DATA_ROW) return 0;
    const values = sheet.getRange(DEFAULTS.FIRST_DATA_ROW, COL.RECORD_ID, sheet.getLastRow() - 1, 1).getDisplayValues();
    for (let i = 0; i < values.length; i++) {
      if (text_(values[i][0]) === wanted) return DEFAULTS.FIRST_DATA_ROW + i;
    }
    return 0;
  }

  function childRows_(sheet, parentId) {
    const wanted = text_(parentId);
    if (!wanted || sheet.getLastRow() < DEFAULTS.FIRST_DATA_ROW) return [];
    const values = sheet.getRange(DEFAULTS.FIRST_DATA_ROW, 1, sheet.getLastRow() - 1, HEADERS.length).getValues();
    const rows = [];
    values.forEach(function (row, index) {
      if (text_(row[COL.PARENT_ID - 1]) === wanted) {
        rows.push({ rowNumber: DEFAULTS.FIRST_DATA_ROW + index, values: row });
      }
    });
    return rows;
  }

  function normalizeReturnDate_(sheet, row, issuedQty, returnedQty) {
    const dateCell = sheet.getRange(row, COL.RETURNED_DATE);
    const current = dateCell.getValue();
    if (returnedQty > 0 && !current) dateCell.setValue(today_()).setNumberFormat("dd.MM.yy");
    if (returnedQty === 0 && current) dateCell.clearContent();
    if (issuedQty === 0 && current) dateCell.clearContent();
  }

  function recomputeRow_(sheet, row) {
    const issued = roundQty_(sheet.getRange(row, COL.ISSUED_QTY).getValue());
    let returned = roundQty_(sheet.getRange(row, COL.RETURNED_QTY).getValue());
    if (returned > issued) {
      returned = issued;
      sheet.getRange(row, COL.RETURNED_QTY).setValue(returned);
    }
    const computed = calculateOwnStatus_(issued, returned);
    sheet.getRange(row, COL.BALANCE).setValue(computed.balance);
    sheet.getRange(row, COL.STATUS).setValue(computed.status);
    styleStatusCell_(sheet, row, computed.status);
    normalizeReturnDate_(sheet, row, computed.issued, computed.returned);
    return computed;
  }

  function recomputeGroup_(sheet, parentRow) {
    if (!parentRow) return null;
    const parentValues = getRowValues_(sheet, parentRow);
    const parentId = text_(parentValues[COL.RECORD_ID - 1]);
    const parentComputed = recomputeRow_(sheet, parentRow);
    const children = childRows_(sheet, parentId);
    let childOutstanding = false;
    let childReturnedAny = false;

    children.forEach(function (child) {
      const result = recomputeRow_(sheet, child.rowNumber);
      if (result.balance > 0) childOutstanding = true;
      if (result.returned > 0) childReturnedAny = true;
    });

    let aggregateStatus = parentComputed.status;
    if (parentComputed.balance === 0 && childOutstanding) {
      aggregateStatus = STATUS.INCOMPLETE_KIT;
    } else if (parentComputed.balance > 0 && (parentComputed.returned > 0 || childReturnedAny)) {
      aggregateStatus = STATUS.PARTIAL;
    } else if (parentComputed.balance === 0 && !childOutstanding) {
      aggregateStatus = STATUS.RETURNED;
    }
    sheet.getRange(parentRow, COL.STATUS).setValue(aggregateStatus);
    styleStatusCell_(sheet, parentRow, aggregateStatus);
    return { parent: parentComputed, children: children.length, status: aggregateStatus };
  }

  function formatComponentRows_(sheet, rows) {
    (rows || []).forEach(function (row) {
      sheet.getRange(row, 1, 1, HEADERS.length).setBackground(DEFAULTS.COMPONENT_COLOR);
      sheet.getRange(row, COL.MODEL).setFontStyle("italic");
    });
  }

  function syncComponents_(sheet, parentRow, catalogItem) {
    const values = getRowValues_(sheet, parentRow);
    let recordId = text_(values[COL.RECORD_ID - 1]);
    if (!recordId) {
      recordId = uniqueId_();
      sheet.getRange(parentRow, COL.RECORD_ID).setValue(recordId);
    }
    sheet.getRange(parentRow, COL.KIT_ID).setValue(catalogItem.isKit ? recordId : "");
    sheet.getRange(parentRow, COL.PARENT_ID).clearContent();
    sheet.getRange(parentRow, COL.ROW_TYPE).setValue(ROW_TYPE.MAIN);
    sheet.getRange(parentRow, COL.AUTO_ROW).setValue(false);

    const desired = (readKits_()[catalogItem.code] || []).slice();
    const existing = childRows_(sheet, recordId);
    const existingByCode = {};
    existing.forEach(function (child) {
      const code = text_(child.values[COL.CATALOG_CODE - 1]);
      if (code && !existingByCode[code]) existingByCode[code] = child;
    });

    const touchedRows = [];
    let insertAfter = existing.length ? existing[existing.length - 1].rowNumber : parentRow;
    const parentQty = Math.max(roundQty_(sheet.getRange(parentRow, COL.ISSUED_QTY).getValue()), 1);
    const parentCallsign = sheet.getRange(parentRow, COL.CALLSIGN).getValue();
    const parentPost = sheet.getRange(parentRow, COL.POST).getValue();
    const parentDate = sheet.getRange(parentRow, COL.ISSUED_DATE).getValue();
    const parentModel = text_(sheet.getRange(parentRow, COL.MODEL).getDisplayValue());

    desired.forEach(function (component) {
      let target = existingByCode[component.code];
      if (!target) {
        sheet.insertRowAfter(insertAfter);
        target = { rowNumber: insertAfter + 1, values: [] };
        insertAfter += 1;
      }
      const existingReturned = target.values.length ? target.values[COL.RETURNED_QTY - 1] : "";
      const existingReturnDate = target.values.length ? target.values[COL.RETURNED_DATE - 1] : "";
      const existingNote = target.values.length ? text_(target.values[COL.NOTE - 1]) : "";
      const issuedQty = roundQty_(parentQty * component.quantity);
      const returnedQty = Math.min(roundQty_(existingReturned), issuedQty);
      const computed = calculateOwnStatus_(issuedQty, returnedQty);
      const rowValues = [
        parentCallsign,
        parentPost,
        "Комплектуючі",
        "↳ " + component.name,
        issuedQty,
        component.unit,
        parentDate,
        returnedQty || "",
        returnedQty > 0 ? existingReturnDate || today_() : "",
        computed.balance,
        computed.status,
        "",
        "",
        existingNote || ("До комплекту: " + parentModel),
        target.values.length ? text_(target.values[COL.RECORD_ID - 1]) || uniqueId_() : uniqueId_(),
        recordId,
        recordId,
        ROW_TYPE.COMPONENT,
        component.code,
        true,
      ];
      setRowValues_(sheet, target.rowNumber, rowValues);
      sheet.getRange(target.rowNumber, COL.ISSUED_DATE).setNumberFormat("dd.MM.yy");
      sheet.getRange(target.rowNumber, COL.RETURNED_DATE).setNumberFormat("dd.MM.yy");
      touchedRows.push(target.rowNumber);
      delete existingByCode[component.code];
    });

    Object.keys(existingByCode)
      .map(function (code) { return existingByCode[code]; })
      .sort(function (a, b) { return b.rowNumber - a.rowNumber; })
      .forEach(function (obsolete) {
        const returned = roundQty_(obsolete.values[COL.RETURNED_QTY - 1]);
        if (returned > 0) {
          const note = text_(obsolete.values[COL.NOTE - 1]);
          sheet.getRange(obsolete.rowNumber, COL.NOTE).setValue(
            [note, "Застаріла комплектуюча після зміни моделі"].filter(Boolean).join("; "),
          );
        } else {
          sheet.deleteRow(obsolete.rowNumber);
        }
      });

    formatComponentRows_(sheet, touchedRows);
    recomputeGroup_(sheet, findRowByRecordId_(sheet, recordId));
    return touchedRows;
  }

  function hydrateMainRow_(sheet, row) {
    const catalog = readCatalog_();
    const model = text_(sheet.getRange(row, COL.MODEL).getDisplayValue());
    if (!model) return false;
    const item = catalog.byModel[key_(model)];
    if (!item) return false;

    const currentCategory = text_(sheet.getRange(row, COL.CATEGORY).getDisplayValue());
    if (!currentCategory) sheet.getRange(row, COL.CATEGORY).setValue(item.category);
    if (!sheet.getRange(row, COL.ISSUED_QTY).getValue()) sheet.getRange(row, COL.ISSUED_QTY).setValue(1);
    sheet.getRange(row, COL.UNIT).setValue(item.unit);
    sheet.getRange(row, COL.CATALOG_CODE).setValue(item.code);
    sheet.getRange(row, COL.ROW_TYPE).setValue(ROW_TYPE.MAIN);
    sheet.getRange(row, COL.AUTO_ROW).setValue(false);
    if (!sheet.getRange(row, COL.RECORD_ID).getDisplayValue()) sheet.getRange(row, COL.RECORD_ID).setValue(uniqueId_());

    if (!item.requiresFuel) {
      sheet.getRange(row, COL.FUEL_TYPE, 1, 2).clearContent();
    }
    syncComponents_(sheet, row, item);
    recomputeGroup_(sheet, findRowByRecordId_(sheet, sheet.getRange(row, COL.RECORD_ID).getDisplayValue()));
    return true;
  }

  function parentRowForRow_(sheet, row) {
    const parentId = text_(sheet.getRange(row, COL.PARENT_ID).getDisplayValue());
    if (parentId) return findRowByRecordId_(sheet, parentId);
    const recordId = text_(sheet.getRange(row, COL.RECORD_ID).getDisplayValue());
    return recordId ? findRowByRecordId_(sheet, recordId) : row;
  }

  function handleEdit(e) {
    try {
      if (!e || !e.range) return false;
      const sheet = e.range.getSheet();
      if (!sheet || sheet.getName() !== config_().sheetName) return false;
      if (!isModernSheet_(sheet)) return false;

      const eventSpreadsheet =
        (e.source && typeof e.source.getSheetByName === "function")
          ? e.source
          : (typeof sheet.getParent === "function" ? sheet.getParent() : null);

      return withEventSpreadsheet_(eventSpreadsheet, function () {
        const startRow = e.range.getRow();
        const endRow = startRow + e.range.getNumRows() - 1;
        const startCol = e.range.getColumn();
        const endCol = startCol + e.range.getNumColumns() - 1;
        if (endRow < DEFAULTS.FIRST_DATA_ROW || startCol > HEADERS.length) return false;

        const catalog = readCatalog_();
        for (let row = Math.max(startRow, DEFAULTS.FIRST_DATA_ROW); row <= endRow; row++) {
          const rowType = text_(sheet.getRange(row, COL.ROW_TYPE).getDisplayValue());
          const isComponent = rowType === ROW_TYPE.COMPONENT;

          if (!isComponent && startCol <= COL.CATEGORY && endCol >= COL.CATEGORY) {
            sheet.getRange(row, COL.MODEL).clearContent();
            sheet.getRange(row, COL.UNIT).clearContent();
            sheet.getRange(row, COL.CATALOG_CODE).clearContent();
            applyModelValidationForRow_(sheet, row, catalog);
          }

          if (!isComponent && startCol <= COL.MODEL && endCol >= COL.MODEL) {
            hydrateMainRow_(sheet, row);
          }

          if (!isComponent && startCol <= COL.ISSUED_QTY && endCol >= COL.ISSUED_QTY) {
            const code = text_(sheet.getRange(row, COL.CATALOG_CODE).getDisplayValue());
            const item = catalog.byCode[code];
            if (item) syncComponents_(sheet, row, item);
          }

          if (
            startCol <= COL.RETURNED_DATE &&
            endCol >= COL.ISSUED_QTY
          ) {
            const parentRow = parentRowForRow_(sheet, row);
            recomputeGroup_(sheet, parentRow);
          }
        }
        return true;
      });
    } catch (error) {
      try {
        Logger.log("TemporaryPropertyRegister_.handleEdit: " + (error && error.message ? error.message : error));
      } catch (_) {}
      return false;
    }
  }

  function parseLegacyProperty_(raw) {
    const source = text_(raw);
    const match = source.match(/^(.+?)\s*-\s*(\d+(?:[.,]\d+)?)\s*(шт\.?|к-?т\.?|компл\.?)?\s*(?:\((.*)\))?\s*$/i);
    const name = text_(match ? match[1] : source);
    const quantity = match ? Math.max(roundQty_(match[2]), 1) : 1;
    const note = text_(match ? match[4] : "");
    let normalizedName = key_(name);
    if (normalizedName.indexOf("подовжувач") === 0 && key_(note).indexOf("жовт") !== -1) normalizedName = "подовжувач жовтий";
    let code = LEGACY_ALIASES[normalizedName] || "";
    if (!code && normalizedName.indexOf("каністра") === 0) code = "FUEL_CAN";
    if (!code && normalizedName.indexOf("подовжувач") === 0) code = "EXT_BLACK_15M";
    return { source: source, name: name, quantity: quantity, note: note, code: code };
  }

  function parseLegacyReturn_(returnedValue, notReturnedValue, issuedQty) {
    const issued = Math.max(roundQty_(issuedQty), 0);
    let returnedQty = 0;
    let returnedDate = "";
    const returnedText = text_(returnedValue);
    const remainingText = text_(notReturnedValue);

    if (returnedValue instanceof Date && !isNaN(returnedValue.getTime())) {
      returnedDate = returnedValue;
      returnedQty = issued;
    } else if (typeof returnedValue === "number" && returnedValue > 20000) {
      returnedDate = returnedValue;
      returnedQty = issued;
    } else if (returnedText) {
      const dateMatch = returnedText.match(/(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4})/);
      if (dateMatch) returnedDate = dateMatch[1];
      const qtyMatch = returnedText.match(/(?:-|\s)(\d+(?:[.,]\d+)?)\s*шт/i);
      returnedQty = qtyMatch ? roundQty_(qtyMatch[1]) : issued;
    }

    if (remainingText) {
      const qtyMatch = remainingText.match(/(\d+(?:[.,]\d+)?)\s*шт/i);
      if (qtyMatch) returnedQty = Math.max(issued - roundQty_(qtyMatch[1]), 0);
    }

    return { returnedQty: Math.min(returnedQty, issued), returnedDate: returnedDate };
  }

  function legacyRowsFromSheet_(sheet) {
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];
    const values = sheet.getRange(1, 1, lastRow, Math.min(Math.max(sheet.getLastColumn(), 5), 5)).getValues();
    const catalog = readCatalog_();
    let post = "";
    const out = [];

    for (let index = 1; index < values.length; index++) {
      const row = values[index];
      const callsign = text_(row[0]);
      const property = text_(row[1]);
      if (callsign && !property && !row[2] && !row[3] && !row[4]) {
        post = callsign;
        continue;
      }
      if (!callsign || !property) continue;
      const parsed = parseLegacyProperty_(property);
      const item = catalog.byCode[parsed.code] || null;
      const returned = parseLegacyReturn_(row[3], row[4], parsed.quantity);
      const fuelType = parsed.code === "FUEL_CAN" && key_(parsed.name).indexOf("бенз") !== -1 ? "Бензин" : "";
      const volumeMatch = (parsed.note || property).match(/(\d+(?:[.,]\d+)?)\s*л/i);
      out.push({
        callsign: callsign,
        post: post,
        category: item ? item.category : "Інше",
        model: item ? item.model : parsed.name,
        quantity: parsed.quantity,
        unit: item ? item.unit : "шт.",
        issuedDate: row[2],
        returnedQty: returned.returnedQty,
        returnedDate: returned.returnedDate,
        fuelType: fuelType,
        fuelVolume: volumeMatch ? roundQty_(volumeMatch[1]) : "",
        note: parsed.note,
        code: item ? item.code : "",
      });
    }
    return out;
  }

  function shouldAbsorbLegacyComponent_(entry, groupCodes) {
    if (!entry || !entry.code) return false;
    const note = key_(entry.note);
    if (note) return false;
    if ((entry.code === "DP4400E_SPIDER" || entry.code === "DP4400E_SPIDER_ADAPTER") && groupCodes.MOTOROLA_DP4400E) return true;
    if (entry.code === "R7AN_EXTRA_BATTERY" && groupCodes.MOTOROLA_R7AN) return true;
    return false;
  }

  function normalizeLegacyRows_(entries) {
    const groups = {};
    entries.forEach(function (entry) {
      const groupKey = [key_(entry.callsign), key_(entry.post), String(entry.issuedDate || "")].join("|");
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(entry);
    });
    const out = [];
    Object.keys(groups).forEach(function (groupKey) {
      const group = groups[groupKey];
      const codes = {};
      group.forEach(function (entry) { if (entry.code) codes[entry.code] = true; });
      group.forEach(function (entry) {
        if (!shouldAbsorbLegacyComponent_(entry, codes)) out.push(entry);
      });
    });
    return out;
  }

  function backupLegacySheet_(sheet) {
    const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmm");
    let name = "TEMP_PROPERTY_BACKUP_" + stamp;
    if (name.length > 31) name = name.slice(0, 31);
    let suffix = 1;
    while (spreadsheet_().getSheetByName(name)) {
      name = ("TEMP_PROPERTY_BACKUP_" + stamp + "_" + suffix).slice(0, 31);
      suffix += 1;
    }
    const copy = sheet.copyTo(spreadsheet_());
    copy.setName(name);
    return name;
  }

  function writeMigratedRows_(sheet, entries) {
    sheet.getDataRange().breakApart().clearContent().clearDataValidations();
    ensureColumns_(sheet, HEADERS.length);
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    let row = DEFAULTS.FIRST_DATA_ROW;
    const catalog = readCatalog_();
    entries.forEach(function (entry) {
      const item = catalog.byCode[entry.code] || catalog.byModel[key_(entry.model)] || null;
      const computed = calculateOwnStatus_(entry.quantity, entry.returnedQty);
      const recordId = uniqueId_();
      setRowValues_(sheet, row, [
        entry.callsign,
        entry.post,
        entry.category,
        entry.model,
        entry.quantity,
        entry.unit,
        entry.issuedDate,
        entry.returnedQty || "",
        entry.returnedDate || "",
        computed.balance,
        computed.status,
        entry.fuelType || "",
        entry.fuelVolume || "",
        entry.note || "",
        recordId,
        item && item.isKit ? recordId : "",
        "",
        ROW_TYPE.MAIN,
        entry.code || "",
        false,
      ]);
      row += 1;
    });

    // Комплектуючі додаються після запису основних рядків, щоб не втратити порядок.
    for (let current = sheet.getLastRow(); current >= DEFAULTS.FIRST_DATA_ROW; current--) {
      const code = text_(sheet.getRange(current, COL.CATALOG_CODE).getDisplayValue());
      const item = catalog.byCode[code];
      if (item) syncComponents_(sheet, current, item);
    }
  }

  function setup(options) {
    const opts = options || {};
    seedCatalogSheets_();
    const cfg = config_();
    const sheet = getOrCreateSheet_(cfg.sheetName);
    let backup = "";
    let migrated = 0;

    if (!isModernSheet_(sheet) && sheet.getLastRow() > 1 && opts.migrateLegacy !== false) {
      const legacyRows = normalizeLegacyRows_(legacyRowsFromSheet_(sheet));
      backup = backupLegacySheet_(sheet);
      writeMigratedRows_(sheet, legacyRows);
      migrated = legacyRows.length;
    } else if (!isModernSheet_(sheet)) {
      sheet.getDataRange().breakApart().clearContent().clearDataValidations();
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    }

    applyRegisterFormatting_(sheet);
    applyValidations_(sheet);

    const last = sheet.getLastRow();
    if (last >= DEFAULTS.FIRST_DATA_ROW) {
      const catalog = readCatalog_();
      for (let row = last; row >= DEFAULTS.FIRST_DATA_ROW; row--) {
        const rowType = text_(sheet.getRange(row, COL.ROW_TYPE).getDisplayValue());
        if (rowType === ROW_TYPE.COMPONENT) continue;
        const code = text_(sheet.getRange(row, COL.CATALOG_CODE).getDisplayValue());
        const item = catalog.byCode[code];
        if (item) {
          syncComponents_(sheet, row, item);
          recomputeGroup_(sheet, findRowByRecordId_(sheet, sheet.getRange(row, COL.RECORD_ID).getDisplayValue()));
        }
      }
    }

    return {
      success: true,
      sheet: cfg.sheetName,
      catalogSheet: cfg.catalogSheetName,
      kitsSheet: cfg.kitsSheetName,
      migratedRows: migrated,
      backupSheet: backup,
    };
  }

  function readForCallsign(callsign, includeReturned) {
    const cfg = config_();
    const sheet = spreadsheet_().getSheetByName(cfg.sheetName);
    if (!sheet || !isModernSheet_(sheet) || sheet.getLastRow() < DEFAULTS.FIRST_DATA_ROW) return [];
    const wanted = key_(callsign);
    if (!wanted) return [];
    const values = sheet.getRange(DEFAULTS.FIRST_DATA_ROW, 1, sheet.getLastRow() - 1, HEADERS.length).getDisplayValues();
    const parents = [];
    const byId = {};

    values.forEach(function (row, index) {
      if (key_(row[COL.CALLSIGN - 1]) !== wanted) return;
      const item = {
        rowNumber: DEFAULTS.FIRST_DATA_ROW + index,
        callsign: text_(row[COL.CALLSIGN - 1]),
        post: text_(row[COL.POST - 1]),
        category: text_(row[COL.CATEGORY - 1]),
        assetName: text_(row[COL.MODEL - 1]).replace(/^↳\s*/, ""),
        issued: roundQty_(row[COL.ISSUED_QTY - 1]),
        unit: text_(row[COL.UNIT - 1]),
        issuedDate: text_(row[COL.ISSUED_DATE - 1]),
        returned: roundQty_(row[COL.RETURNED_QTY - 1]),
        returnedDate: text_(row[COL.RETURNED_DATE - 1]),
        remaining: roundQty_(row[COL.BALANCE - 1]),
        status: text_(row[COL.STATUS - 1]),
        fuelType: text_(row[COL.FUEL_TYPE - 1]),
        fuelVolume: roundQty_(row[COL.FUEL_VOLUME - 1]),
        note: text_(row[COL.NOTE - 1]),
        recordId: text_(row[COL.RECORD_ID - 1]),
        parentId: text_(row[COL.PARENT_ID - 1]),
        rowType: text_(row[COL.ROW_TYPE - 1]),
        components: [],
      };
      if (!includeReturned && item.remaining === 0 && item.status === STATUS.RETURNED) return;
      if (item.rowType === ROW_TYPE.COMPONENT && item.parentId) {
        if (!byId[item.parentId]) byId[item.parentId] = { pending: [] };
        byId[item.parentId].pending.push(item);
      } else {
        parents.push(item);
        if (!byId[item.recordId]) byId[item.recordId] = { pending: [] };
        byId[item.recordId].parent = item;
      }
    });

    Object.keys(byId).forEach(function (id) {
      const group = byId[id];
      if (group.parent) group.parent.components = group.pending || [];
      else (group.pending || []).forEach(function (component) { parents.push(component); });
    });
    return parents;
  }

  function getCatalogSeed() {
    return DEFAULT_CATALOG.map(function (row) { return row.slice(); });
  }

  function getKitSeed() {
    return DEFAULT_KITS.map(function (row) { return row.slice(); });
  }

  return {
    HEADERS: HEADERS,
    CATALOG_HEADERS: CATALOG_HEADERS,
    KIT_HEADERS: KIT_HEADERS,
    COL: COL,
    STATUS: STATUS,
    ROW_TYPE: ROW_TYPE,
    handleEdit: handleEdit,
    setup: setup,
    readForCallsign: readForCallsign,
    parseLegacyProperty: parseLegacyProperty_,
    calculateOwnStatus: calculateOwnStatus_,
    getCatalogSeed: getCatalogSeed,
    getKitSeed: getKitSeed,
    isModernSheet: isModernSheet_,
  };
})();

/**
 * Одноразове налаштування/міграція журналу тимчасового майна.
 * Безпечно створює резервну копію старого аркуша перед перетворенням.
 */
function apiSetupTemporaryPropertyRegister() {
  return TemporaryPropertyRegister_.setup({ migrateLegacy: true });
}

/**
 * Безпечне повторне застосування перевірок, форматування та зведень без міграції.
 */
function apiRefreshTemporaryPropertyRegister() {
  return TemporaryPropertyRegister_.setup({ migrateLegacy: false });
}

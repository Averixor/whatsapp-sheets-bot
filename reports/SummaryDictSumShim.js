/**
 * Compatibility helper for Summaries.gs.
 *
 * Reads summary group rules from DICT_SUM and returns:
 * [{ code, label, order, showZero }]
 *
 * Expected DICT_SUM headers:
 * Код | Вид служби (або Назва) | Порядок
 * Legacy Label/Order/ShowZero headers are still accepted.
 */
function readDictSum_() {
  const defaults = getDefaultDictSumRules_();

  try {
    const ss = getWasbSpreadsheet_();
    if (!ss) return defaults;

    const sheetName =
      (typeof CONFIG !== "undefined" && CONFIG && CONFIG.DICT_SUM_SHEET) ||
      "DICT_SUM";

    const sh = ss.getSheetByName(sheetName);
    if (!sh) return defaults;

    const values = sh.getDataRange().getDisplayValues();
    if (!values || values.length < 2) return defaults;

    const headers = values[0].map(function (v) {
      return normalizeDictSumHeader_(v);
    });

    const idx = {
      code: findDictSumColumn_(headers, ["code", "код"]),
      label: findDictSumColumn_(headers, [
        "label",
        "назва",
        "name",
        "full_name",
        "fullname",
        "вид_служби",
      ]),
      order: findDictSumColumn_(headers, [
        "order",
        "порядок",
        "sort",
        "sort_order",
        "queue",
      ]),
      showZero: findDictSumColumn_(headers, [
        "showzero",
        "show_zero",
        "zero",
        "показувати_нуль",
        "показувати 0",
      ]),
    };

    if (idx.code < 0) return defaults;

    const rows = [];

    for (let r = 1; r < values.length; r++) {
      const row = values[r];

      const code = String(row[idx.code] || "").trim();
      if (!code) continue;

      const fallbackLabel =
        (typeof FULL_NAMES !== "undefined" && FULL_NAMES && FULL_NAMES[code]) ||
        code;

      const label =
        idx.label >= 0
          ? String(row[idx.label] || "").trim() || fallbackLabel
          : fallbackLabel;

      const orderRaw =
        idx.order >= 0 ? String(row[idx.order] || "").trim() : "";
      const order = orderRaw === "" ? 1000 + r : Number(orderRaw);

      const showZeroRaw = idx.showZero >= 0 ? row[idx.showZero] : "";
      const showZero = parseDictSumBoolean_(showZeroRaw);

      rows.push({
        code: code,
        label: label,
        order: Number.isFinite(order) ? order : 1000 + r,
        showZero: showZero,
      });
    }

    if (!rows.length) return defaults;

    return rows.sort(function (a, b) {
      if (a.order !== b.order) return a.order - b.order;
      return String(a.code).localeCompare(String(b.code), "uk-UA");
    });
  } catch (e) {
    console.warn("Помилка в readDictSum_:", e);
    return defaults;
  }
}

function getDefaultDictSumRules_() {
  const entries = [
    { code: "Black", order: 10 },
    { code: "Roland", order: 15 },
    { code: "БР", order: 20 },
    { code: "Евак", order: 25 },
    { code: "1РБпАК", order: 30 },
    { code: "2РБпАК", order: 35 },
    { code: "1УРБпАК", order: 40 },
    { code: "2УРБпАК", order: 100 },
    { code: "КП", order: 105 },
    { code: "Резерв", order: 140 },
    { code: "*ВЗ", order: 145 },
    { code: "*ВМЗ", order: 150 },
    { code: "*1РБпАК", order: 155 },
    { code: "*2РБпАК", order: 160 },
    { code: "*1УРБпАК", order: 165 },
    { code: "*2УРБпАК", order: 200 },
    { code: "Відрядження", order: 205 },
    { code: "Відпустка", order: 210 },
    { code: "Лікарняний", order: 215 },
    { code: "ППД Київ", order: 220 },
    { code: "Гусачівка", order: 225 },
    { code: "DC", order: 230 },
    { code: "БЗВП", order: 245 },
    { code: "СЗЧ", order: 300 },
    { code: "Вибув", order: 333 },
  ];

  return entries.map(function (entry) {
    return {
      code: entry.code,
      label:
        (typeof FULL_NAMES !== "undefined" &&
          FULL_NAMES &&
          FULL_NAMES[entry.code]) ||
        entry.code,
      order: entry.order,
      showZero: false,
    };
  });
}

function normalizeDictSumHeader_(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
}

function findDictSumColumn_(headers, names) {
  for (let i = 0; i < headers.length; i++) {
    if (names.indexOf(headers[i]) >= 0) return i;
  }
  return -1;
}

function parseDictSumBoolean_(value) {
  const s = String(value || "")
    .trim()
    .toLowerCase();

  return (
    ["true", "1", "yes", "y", "так", "да", "показувати", "+"].indexOf(s) >= 0
  );
}

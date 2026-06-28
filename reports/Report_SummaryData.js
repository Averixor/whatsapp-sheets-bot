/**
 * Report_SummaryData.gs — читання формульного блоку зведення з місячних аркушів.
 */

const SIMPLE_DAILY_SUMMARY_ORDER = Object.freeze([
  "За_штатом",
  "За_списком",
  "В_наявності",
  "У_відрядженні",
  "У_відпустці",
  "Гусачівка",
  "Drone_Camp",
  "ППД",
  "КП",
  "БР",
]);

const SIMPLE_DAILY_SUMMARY_LABELS = Object.freeze({
  За_штатом: "За штатом",
  За_списком: "За списком",
  В_наявності: "В наявності",
  У_відрядженні: "У відрядженні",
  У_відпустці: "У відпустці",
  Гусачівка: "Гусачівка",
  Drone_Camp: "Drone Camp",
  ППД: "ППД",
  КП: "КП",
  БР: "БР",
});

const SUMMARY_BLOCK_ANCHOR_KEY_ = "За_списком";
const SUMMARY_BLOCK_STAFF_KEY_ = "За_штатом";

function normalizeText_(value) {
  return String(value == null ? "" : value)
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDateOnly_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  const text = normalizeText_(value);
  if (!text) return "";

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return iso[1] + "-" + iso[2] + "-" + iso[3];

  if (typeof DateUtils_ === "object" && DateUtils_ && DateUtils_.parseUaDate) {
    const parsed = DateUtils_.parseUaDate(text);
    if (parsed) return normalizeDateOnly_(parsed);
  }

  const ua = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (ua) {
    return (
      ua[3] +
      "-" +
      String(Number(ua[2])).padStart(2, "0") +
      "-" +
      String(Number(ua[1])).padStart(2, "0")
    );
  }

  return "";
}

function isMonthSheetName_(name) {
  return /^\d{2}$/.test(String(name || "").trim());
}

function normalizeSummaryKey_(value) {
  return normalizeText_(value)
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_");
}

function parseSummaryNumber_(value) {
  const s = String(value == null ? "" : value)
    .trim()
    .replace(/\s+/g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function _summaryPersonnelEndRow_(sheet) {
  try {
    const codeRangeA1 =
      typeof getMonthlyCodeRangeA1ForSheet_ === "function"
        ? getMonthlyCodeRangeA1ForSheet_(sheet)
        : "";
    if (codeRangeA1) {
      const ref = sheet.getRange(codeRangeA1);
      return Number(ref.getLastRow()) || 2;
    }
  } catch (_) {}
  return Number(
    (typeof MONTHLY_CONFIG !== "undefined" &&
      MONTHLY_CONFIG &&
      MONTHLY_CONFIG.LAST_DATA_ROW) ||
      (CONFIG && CONFIG.LAST_DATA_ROW) ||
      30,
  );
}

function _summaryLabelScanCols_(sheet) {
  const cols = [2, 3];
  let firstDateCol = 3;
  try {
    if (typeof detectMonthlyLayoutFromSheet_ === "function") {
      const layout = detectMonthlyLayoutFromSheet_(sheet);
      if (layout && layout.matrix && layout.matrix.startCol) {
        firstDateCol = Number(layout.matrix.startCol) || firstDateCol;
      }
    }
  } catch (_) {}
  if (firstDateCol > 4) {
    return [1, 2, 3, 4];
  }
  return cols;
}

function _findSummaryBlockAnchor_(sheet, scanStartRow, lastRow, scanCols) {
  if (!sheet || scanStartRow > lastRow) return null;

  const rowCount = Math.max(lastRow - scanStartRow + 1, 1);
  for (let c = 0; c < scanCols.length; c++) {
    const col = scanCols[c];
    let labels = [];
    try {
      labels = sheet
        .getRange(scanStartRow, col, rowCount, 1)
        .getDisplayValues();
    } catch (_) {
      continue;
    }
    for (let i = 0; i < labels.length; i++) {
      const key = normalizeSummaryKey_(labels[i][0]);
      if (key === SUMMARY_BLOCK_ANCHOR_KEY_) {
        return {
          labelCol: col,
          anchorRow: scanStartRow + i,
        };
      }
    }
  }
  return null;
}

function findSummaryBlockLocation_(sheet) {
  if (!sheet || typeof sheet.getRange !== "function") return null;

  const personnelEndRow = _summaryPersonnelEndRow_(sheet);
  const lastRow = Math.max(Number(sheet.getLastRow()) || 0, personnelEndRow + 1);
  const scanStartRow = Math.max(personnelEndRow + 1, 2);
  const scanCols = _summaryLabelScanCols_(sheet);

  const anchor =
    _findSummaryBlockAnchor_(sheet, scanStartRow, lastRow, scanCols) ||
    _findSummaryBlockAnchor_(sheet, 1, lastRow, [1, 2, 3, 4]);

  if (!anchor || anchor.anchorRow < 1 || anchor.labelCol < 1) {
    return null;
  }

  const labelCol = anchor.labelCol;
  let startRow = anchor.anchorRow;
  if (startRow > 1) {
    const prevKey = normalizeSummaryKey_(
      sheet.getRange(startRow - 1, labelCol).getDisplayValue(),
    );
    if (prevKey === SUMMARY_BLOCK_STAFF_KEY_) {
      startRow = startRow - 1;
    }
  }

  let endRow = startRow;
  for (let row = startRow; row <= lastRow; row++) {
    const label = normalizeText_(sheet.getRange(row, labelCol).getDisplayValue());
    if (!label) break;
    endRow = row;
  }

  return {
    labelCol: labelCol,
    startRow: startRow,
    endRow: endRow,
    anchorRow: anchor.anchorRow,
  };
}

function getMonthSheetByDate_(date) {
  const dateStr =
    typeof date === "string"
      ? normalizeText_(date)
      : typeof DateUtils_ === "object" &&
          DateUtils_ &&
          typeof DateUtils_.formatUaDate === "function"
        ? DateUtils_.formatUaDate(date)
        : "";
  const parsed =
    typeof DateUtils_ === "object" && DateUtils_ && DateUtils_.parseUaDate
      ? DateUtils_.parseUaDate(dateStr)
      : null;
  if (!parsed) {
    throw new Error("Некоректна дата зведення: " + (dateStr || String(date)));
  }

  const monthSheetName = String(parsed.getMonth() + 1).padStart(2, "0");
  if (!isMonthSheetName_(monthSheetName)) {
    throw new Error("Не знайдено аркуш місяця " + monthSheetName);
  }

  const ss =
    typeof getWasbSpreadsheet_ === "function" ? getWasbSpreadsheet_() : null;
  if (!ss || typeof ss.getSheetByName !== "function") {
    throw new Error("Не знайдено аркуш місяця " + monthSheetName);
  }

  const sheet = ss.getSheetByName(monthSheetName);
  if (!sheet) {
    throw new Error("Не знайдено аркуш місяця " + monthSheetName);
  }

  return sheet;
}

function findDateColumnInMonthSheet_(sheet, date) {
  if (!sheet) return -1;

  const dateStr =
    typeof date === "string"
      ? normalizeText_(date)
      : typeof DateUtils_ === "object" &&
          DateUtils_ &&
          typeof DateUtils_.formatUaDate === "function"
        ? DateUtils_.formatUaDate(date)
        : "";

  if (typeof findTodayColumn_ === "function") {
    const col = findTodayColumn_(sheet, dateStr);
    if (col > 0) return col;
  }

  const dateRow = Number((CONFIG && CONFIG.DATE_ROW) || 1);
  const lastCol = Math.max(Number(sheet.getLastColumn()) || 0, 1);
  const values = sheet.getRange(dateRow, 1, 1, lastCol).getValues()[0] || [];
  const displays =
    sheet.getRange(dateRow, 1, 1, lastCol).getDisplayValues()[0] || [];

  for (let col = 1; col <= lastCol; col++) {
    const idx = col - 1;
    try {
      const normalized =
        typeof DateUtils_ === "object" &&
        DateUtils_ &&
        typeof DateUtils_.normalizeDate === "function"
          ? DateUtils_.normalizeDate(values[idx], displays[idx])
          : normalizeText_(displays[idx]);
      if (normalized === dateStr) return col;
    } catch (_) {}
  }

  return -1;
}

function readDailySummaryFromFormulaBlockForSheet_(sheet, dateStr, dateCol) {
  if (!sheet) {
    throw new Error("Місячний аркуш не передано");
  }

  const monthSheetName = sheet.getName();
  const reportDate = normalizeText_(dateStr);
  const col =
    Number(dateCol) > 0
      ? Number(dateCol)
      : findDateColumnInMonthSheet_(sheet, reportDate);

  if (col < 1) {
    throw new Error(
      "Не знайдено колонку дати " +
        reportDate +
        " на аркуші " +
        monthSheetName,
    );
  }

  const block = findSummaryBlockLocation_(sheet);
  if (!block || !block.startRow || !block.endRow) {
    throw new Error(
      "Не знайдено формульний блок зведення на аркуші " + monthSheetName,
    );
  }

  const rowCount = block.endRow - block.startRow + 1;
  const labelValues = sheet
    .getRange(block.startRow, block.labelCol, rowCount, 1)
    .getDisplayValues();
  const dateValues = sheet
    .getRange(block.startRow, col, rowCount, 1)
    .getDisplayValues();

  const values = {};
  for (let i = 0; i < labelValues.length; i++) {
    const key = normalizeSummaryKey_(labelValues[i][0]);
    if (!key) continue;
    values[key] = parseSummaryNumber_(dateValues[i][0]);
  }

  return {
    date: reportDate,
    monthSheetName: monthSheetName,
    dateColumn: col,
    dateCol: col,
    block: block,
    values: values,
  };
}

function readDailySummaryFromFormulaBlock_(date) {
  const sheet = getMonthSheetByDate_(date);
  const dateStr =
    typeof date === "string"
      ? normalizeText_(date)
      : typeof DateUtils_ === "object" &&
          DateUtils_ &&
          typeof DateUtils_.formatUaDate === "function"
        ? DateUtils_.formatUaDate(date)
        : "";
  return readDailySummaryFromFormulaBlockForSheet_(sheet, dateStr, 0);
}

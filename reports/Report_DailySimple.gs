/**
 * Report_DailySimple.gs — коротке (звичайне) зведення дня з формульного блоку.
 */

function formatSimpleDailySummary_(summaryData) {
  const payload = summaryData || {};
  const dateStr = normalizeText_(payload.date || "");
  const shortDate = dateStr.length >= 5 ? dateStr.slice(0, 5) : dateStr;

  const lines = SIMPLE_DAILY_SUMMARY_ORDER.map(function (key) {
    const displayLabel = SIMPLE_DAILY_SUMMARY_LABELS[key] || "";
    const raw = payload.values && payload.values[key];
    const num = parseSummaryNumber_(raw);
    return displayLabel + ": " + num;
  });

  return shortDate ? [shortDate, ""].concat(lines).join("\n") : lines.join("\n");
}

function buildSimpleDailySummaryFromFormulaBlock_(sheet, col) {
  const dateRow = Number((CONFIG && CONFIG.DATE_ROW) || 1);
  const dateCell = sheet.getRange(dateRow, col);
  const reportDate = DateUtils_.normalizeDate(
    dateCell.getValue(),
    dateCell.getDisplayValue(),
  );
  const summary = readDailySummaryFromFormulaBlockForSheet_(
    sheet,
    reportDate,
    col,
  );
  return formatSimpleDailySummary_(summary);
}

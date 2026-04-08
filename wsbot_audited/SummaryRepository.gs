/**
 * SummaryRepository.gs — canonical збірка зведень.
 */

const SummaryRepository_ = (function() {
  function getSheetAndColumn(dateStr) {
    const ctx = PersonsRepository_.getDateContext(dateStr);
    return {
      sheet: ctx.sheet,
      col: ctx.col,
      dateStr: ctx.dateStr
    };
  }

  function buildDaySummary(dateStr) {
    const ctx = getSheetAndColumn(dateStr);
    return {
      date: ctx.dateStr,
      sheet: ctx.sheet.getName(),
      summary: buildDaySummaryForColumn_(ctx.sheet, ctx.col)
    };
  }

  function buildDetailedSummary(dateStr) {
    const ctx = getSheetAndColumn(dateStr);
    const people = collectPeopleDetailed_(ctx.sheet, ctx.col);
    return {
      date: ctx.dateStr,
      sheet: ctx.sheet.getName(),
      summary: formatDetailedSummary_(ctx.dateStr, people),
      peopleCount: new Set(people.map(function(item) { return item.surname; })).size
    };
  }

  return {
    getSheetAndColumn: getSheetAndColumn,
    buildDaySummary: buildDaySummary,
    buildDetailedSummary: buildDetailedSummary
  };
})();

/**
 * SummaryService.gs — stage 5 domain service for summaries.
 */

const SummaryService_ = (function() {
  function buildDay(dateStr) {
    return SummaryRepository_.buildDaySummary(dateStr || _todayStr_());
  }

  function buildDetailed(dateStr) {
    return SummaryRepository_.buildDetailedSummary(dateStr || _todayStr_());
  }

  function buildCommanderPreview(dateStr) {
    const summary = buildDay(dateStr);
    const phone = findPhoneByRole_(CONFIG.COMMANDER_ROLE) || '';
    const link = phone
      ? PreviewLinkService_.buildWaLink(phone, summary.summary || '')
      : '';

    return {
      title: 'Зведення командиру',
      date: summary.date || dateStr || _todayStr_(),
      summary: summary.summary || '',
      phone: phone,
      link: link,
      sheet: summary.sheet || '',
      kind: 'commanderSummaryPreview'
    };
  }

  function buildCommanderLink(dateStr) {
    return buildCommanderPreview(dateStr);
  }

  return {
    buildDay: buildDay,
    buildDetailed: buildDetailed,
    buildCommanderPreview: buildCommanderPreview,
    buildCommanderLink: buildCommanderLink
  };
})();

/**
 * SummaryService.gs — stage 7 domain service for summaries.
 */

const SummaryService_ = (function() {
  function buildDay(dateStr) {
    return SummaryRepository_.buildDaySummary(dateStr || _todayStr_());
  }

  function buildDetailed(dateStr) {
    return SummaryRepository_.buildDetailedSummary(dateStr || _todayStr_());
  }

  function buildCommanderPreview(dateOrOptions) {
    const options =
      dateOrOptions && typeof dateOrOptions === 'object'
        ? Object.assign({}, dateOrOptions)
        : { date: dateOrOptions };
    const dateStr = options.date || options.dateStr || _todayStr_();
    const summary = buildDay(dateStr);
    const recipient = resolveMessageRecipient_(options);
    const phone = recipient.phone || '';
    const link = phone
      ? PreviewLinkService_.buildWaLink(phone, summary.summary || '')
      : '';

    return {
      title: 'Зведення командиру',
      date: summary.date || dateStr || _todayStr_(),
      summary: summary.summary || '',
      phone: phone,
      recipient: recipient,
      link: link,
      sheet: summary.sheet || '',
      kind: 'commanderSummaryPreview'
    };
  }

  function buildCommanderLink(dateOrOptions) {
    return buildCommanderPreview(dateOrOptions);
  }

  return {
    buildDay: buildDay,
    buildDetailed: buildDetailed,
    buildCommanderPreview: buildCommanderPreview,
    buildCommanderLink: buildCommanderLink
  };
})();

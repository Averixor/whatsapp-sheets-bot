
/**
 * PreviewLinkService.gs — stage 5 preview/link helper service.
 */

const PreviewLinkService_ = (function() {
  function escapeHtmlLocal(value) {
    if (typeof HtmlUtils_ === 'object' && typeof HtmlUtils_.escapeHtml === 'function') {
      return HtmlUtils_.escapeHtml(value);
    }
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function safeWaLink(url) {
    const u = String(url || '').trim();
    return /^https?:\/\/wa\.me\//i.test(u) ? u : '#';
  }

  function buildWaLink(phone, text) {
    const cleanedPhone = String(phone || '').replace(/\D/g, '');
    if (!cleanedPhone) return '';
    const body = trimToEncoded_(String(text || ''), CONFIG.MAX_WA_TEXT);
    return 'https://wa.me/' + cleanedPhone + '?text=' + encodeURIComponent(body);
  }

  function buildSinglePreview(payload, options) {
    const opts = options || {};
    const item = payload || {};
    return {
      kind: 'singleMessagePreview',
      title: opts.title || 'Повідомлення',
      logged: !!opts.logged,
      item: {
        fio: item.fio || '',
        phone: item.phone || '',
        code: item.code || '',
        cell: item.cell || '',
        reportDateStr: item.reportDateStr || '',
        message: item.message || '',
        link: safeWaLink(item.link || '')
      }
    };
  }

  function buildMultiplePreview(payloads, errors, options) {
    const opts = options || {};
    const list = Array.isArray(payloads) ? payloads : [];
    return {
      kind: 'multipleMessagesPreview',
      title: opts.title || 'Пакет повідомлень',
      logged: !!opts.logged,
      count: list.length,
      items: list.map(function(item) {
        return {
          fio: item.fio || '',
          phone: item.phone || '',
          code: item.code || '',
          cell: item.cell || '',
          reportDateStr: item.reportDateStr || '',
          message: item.message || '',
          link: safeWaLink(item.link || '')
        };
      }),
      errors: Array.isArray(errors) ? errors.map(function(item) {
        return typeof item === 'string'
          ? { message: item }
          : {
              cell: item.cell || '',
              fio: item.fio || '',
              code: item.code || '',
              message: item.error || item.message || ''
            };
      }) : []
    };
  }

  function buildSummaryPreview(payload, options) {
    const opts = options || {};
    const item = payload || {};
    return {
      kind: 'summaryPreview',
      title: opts.title || item.title || 'Зведення',
      logged: !!opts.logged,
      date: item.date || '',
      summary: item.summary || '',
      phone: item.phone || '',
      link: safeWaLink(item.link || '')
    };
  }

  return {
    escapeHtml: escapeHtmlLocal,
    safeWaLink: safeWaLink,
    buildWaLink: buildWaLink,
    buildSinglePreview: buildSinglePreview,
    buildMultiplePreview: buildMultiplePreview,
    buildSummaryPreview: buildSummaryPreview
  };
})();
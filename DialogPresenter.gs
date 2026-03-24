
/**
 * DialogPresenter.gs — stage 5 presentation-only dialog layer.
 */

const DialogPresenter_ = (function() {
  function _show(output, title) {
    SpreadsheetApp.getUi().showModalDialog(output, title || 'WASB');
  }

  function showLinkDialog(data) {
    const payload = Object.assign({ title: 'Посилання' }, data || {});
    _show(DialogTemplates_.linkDialog(payload), payload.title);
  }

  function showSinglePayloadPreview(data) {
    const payload = data || {};
    _show(DialogTemplates_.singleMessage(payload), payload.title || 'Повідомлення');
  }

  function showMultiplePayloadPreview(data) {
    const payload = data || {};
    _show(DialogTemplates_.multipleMessages(payload), payload.title || 'Пакет повідомлень');
  }

  function showSummaryPreview(data) {
    const payload = data || {};
    _show(DialogTemplates_.summaryDialog(payload), payload.title || 'Зведення');
  }

  function showPrepared(result) {
    const kind = String((result && result.kind) || '').trim();
    if (kind === 'singleMessagePreview') return showSinglePayloadPreview(result);
    if (kind === 'multipleMessagesPreview') return showMultiplePayloadPreview(result);
    if (kind === 'summaryPreview') return showSummaryPreview(result);
    if (kind === 'linkPreview') return showLinkDialog(result);
    throw new Error('Невідомий prepared dialog result');
  }

  return {
    showLinkDialog: showLinkDialog,
    showSinglePayloadPreview: showSinglePayloadPreview,
    showMultiplePayloadPreview: showMultiplePayloadPreview,
    showSummaryPreview: showSummaryPreview,
    showPrepared: showPrepared
  };
})();

/**
 * Dialogs.gs — stage 5 compatibility wrappers around presentation-only layer.
 */

function safeWaLink_(url) {
  return PreviewLinkService_.safeWaLink(url);
}

function uiCopyScript_() {
  return '';
}

function showLinkDialogSimple_(title, url) {
  return DialogPresenter_.showLinkDialog({
    title: title || 'Посилання',
    url: url || '',
    description: 'Натисніть, щоб відкрити WhatsApp'
  });
}

function showSingleDialog_(p, logged) {
  return DialogPresenter_.showSinglePayloadPreview(
    PreviewLinkService_.buildSinglePreview(p || {}, {
      title: logged ? '✓ Записано в LOG' : '📱 Повідомлення',
      logged: !!logged
    })
  );
}

function showMultipleDialog_(payloads, errors, logged) {
  return DialogPresenter_.showMultiplePayloadPreview(
    PreviewLinkService_.buildMultiplePreview(payloads || [], errors || [], {
      title: logged ? '✓ Записано в LOG' : '📦 Пакет повідомлень',
      logged: !!logged
    })
  );
}
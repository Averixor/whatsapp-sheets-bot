
/**
 * Actions.gs — stage 5 thin spreadsheet/menu wrappers.
 *
 * Новая логика сюда больше не растёт. Этот файл только перенаправляет
 * меню/manual сценарии в канонический spreadsheet action API и presenter-слой.
 */

function buildPayloadFromSelection_() {
  return SelectionActionService_.prepareSingleSelection().payload;
}

function _unwrapActionResult_(result) {
  if (!result || result.success !== true) {
    throw new Error((result && (result.error || result.message)) || 'Сценарій не виконано');
  }
  return (result.data && result.data.result) || null;
}

function _showActionError_(e) {
  SpreadsheetApp.getUi().alert('✕ ' + (e && e.message ? e.message : String(e)));
}

function waShowForSelection() {
  try {
    DialogPresenter_.showPrepared(_unwrapActionResult_(apiPreviewSelectionMessage({})));
  } catch (e) {
    _showActionError_(e);
  }
}

function waLogAndShowForSelection() {
  try {
    DialogPresenter_.showPrepared(_unwrapActionResult_(apiLogPreparedMessages({ mode: 'selection' })));
  } catch (e) {
    _showActionError_(e);
  }
}

function waShowForMultipleCells() {
  try {
    DialogPresenter_.showPrepared(_unwrapActionResult_(apiPreviewMultipleMessages({})));
  } catch (e) {
    _showActionError_(e);
  }
}

function waLogAndShowForMultipleCells() {
  try {
    DialogPresenter_.showPrepared(_unwrapActionResult_(apiLogPreparedMessages({ mode: 'multiple' })));
  } catch (e) {
    _showActionError_(e);
  }
}

function waMassByRange() {
  try {
    DialogPresenter_.showPrepared(_unwrapActionResult_(apiLogPreparedMessages({ mode: 'range' })));
  } catch (e) {
    _showActionError_(e);
  }
}

function waShowGroupedByPhone() {
  try {
    DialogPresenter_.showPrepared(_unwrapActionResult_(apiPreviewGroupedMessages({})));
  } catch (e) {
    _showActionError_(e);
  }
}

function waLogAndShowGroupedByPhone() {
  try {
    DialogPresenter_.showPrepared(_unwrapActionResult_(apiLogPreparedMessages({ mode: 'grouped' })));
  } catch (e) {
    _showActionError_(e);
  }
}

function processMultipleCells_(log) {
  if (log) return waLogAndShowForMultipleCells();
  return waShowForMultipleCells();
}

function processGroupedByPhone_(log) {
  if (log) return waLogAndShowGroupedByPhone();
  return waShowGroupedByPhone();
}

function sumShowForSelectedColumn() {
  try {
    DialogPresenter_.showPrepared(_unwrapActionResult_(apiBuildCommanderSummaryPreview({})));
  } catch (e) {
    _showActionError_(e);
  }
}

function sumWaToCommanderForSelectedColumn() {
  try {
    DialogPresenter_.showPrepared(_unwrapActionResult_(apiBuildCommanderSummaryLink({})));
  } catch (e) {
    _showActionError_(e);
  }
}

function diagnoseCommanderPhone() {
  try {
    const report = _unwrapActionResult_(apiRunSelectionDiagnostics({}));
    SpreadsheetApp.getUi().alert(
      '📱 Діагностика',
      [
        `Аркуш: ${report.sheet}`,
        `Bot sheet: ${report.botSheet}`,
        `Активне виділення: ${report.activeRange || '—'}`,
        `Діапазонів виділено: ${report.selectedRangesCount}`,
        `Payload: ${report.payloadCount}`,
        `Помилок: ${report.errorCount}`,
        `Командир (${report.commanderRole}): ${report.commanderPhonePresent ? 'є телефон' : 'немає телефону'}`
      ].join('\n'),
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (e) {
    _showActionError_(e);
  }
}
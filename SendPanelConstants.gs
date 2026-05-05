/**
 * SendPanelConstants.gs — canonical constants and helpers for SEND_PANEL.
 */

const SendPanelConstants_ = Object.freeze({
  STATUS_READY: '✔',
  STATUS_BLOCKED: '✘',
  SENT_MARK: '✔',
  UNSENT_MARK: '✘',
  STATUS_ERROR_PREFIX: '✗',
  LEGACY_STATUS_READY: '✓',
  LEGACY_STATUS_OPENED: 'Відкрито',
  LEGACY_STATUS_PENDING: 'Очікує',
  LEGACY_STATUS_UNSENT: 'Не відправлено',
  LEGACY_STATUS_SENT: 'Відправлено',
  ACTION_READY_LABEL: 'НАДІСЛАТИ',
  ACTION_SENT_LABEL: 'ВІДПРАВЛЕНО',
  ACTION_BLOCKED_LABEL: '',
  WA_SENDER_TARGET: 'WA_SENDER_WINDOW',
  METADATA_MONTH_CELL: 'H1',
  METADATA_DATE_CELL: 'H2'
});

function getSendPanelAllAllowedStatuses_() {
  return [
    SendPanelConstants_.STATUS_READY,
    SendPanelConstants_.STATUS_BLOCKED
  ];
}

function normalizeSendPanelStatus_(status) {
  const value = String(status || '').trim();
  if (!value) return SendPanelConstants_.STATUS_BLOCKED;
  if (value === SendPanelConstants_.STATUS_READY || value === SendPanelConstants_.LEGACY_STATUS_READY) return SendPanelConstants_.STATUS_READY;
  if (value === SendPanelConstants_.STATUS_BLOCKED) return SendPanelConstants_.STATUS_BLOCKED;
  if (value === SendPanelConstants_.LEGACY_STATUS_OPENED) return SendPanelConstants_.STATUS_READY;
  if (value === SendPanelConstants_.LEGACY_STATUS_PENDING) return SendPanelConstants_.STATUS_READY;
  if (value === SendPanelConstants_.LEGACY_STATUS_UNSENT) return SendPanelConstants_.STATUS_READY;
  if (value === SendPanelConstants_.LEGACY_STATUS_SENT) return SendPanelConstants_.STATUS_READY;
  if (value.indexOf(SendPanelConstants_.STATUS_ERROR_PREFIX) === 0) return SendPanelConstants_.STATUS_BLOCKED;
  return value === 'TRUE' ? SendPanelConstants_.STATUS_READY : SendPanelConstants_.STATUS_BLOCKED;
}

function normalizeSendPanelSentMark_(mark) {
  const value = String(mark == null ? '' : mark).trim().toUpperCase();
  if (mark === true || value === 'TRUE' || value === SendPanelConstants_.SENT_MARK) return SendPanelConstants_.SENT_MARK;
  if (value === SendPanelConstants_.LEGACY_STATUS_SENT.toUpperCase()) return SendPanelConstants_.SENT_MARK;
  return SendPanelConstants_.UNSENT_MARK;
}

function isSendPanelReadyLikeStatus_(status) {
  return normalizeSendPanelStatus_(status) === SendPanelConstants_.STATUS_READY;
}

function isSendPanelPendingStatus_(status) {
  return false;
}

function isSendPanelSentStatusValue_(status) {
  return false;
}

function isSendPanelSentMark_(mark) {
  return normalizeSendPanelSentMark_(mark) === SendPanelConstants_.SENT_MARK;
}

function isSendPanelErrorStatus_(status) {
  return normalizeSendPanelStatus_(status) === SendPanelConstants_.STATUS_BLOCKED;
}

function getSendPanelSentMark_() {
  return SendPanelConstants_.SENT_MARK;
}

function getSendPanelUnsentMark_() {
  return SendPanelConstants_.UNSENT_MARK;
}

function getSendPanelActionReadyLabel_() {
  return SendPanelConstants_.ACTION_READY_LABEL;
}

function getSendPanelActionSentLabel_() {
  return SendPanelConstants_.ACTION_SENT_LABEL;
}

function resolveSendPanelFormulaArgSeparator_() {
  try {
    const locale = String(getWasbSpreadsheet_().getSpreadsheetLocale() || '').trim().toLowerCase();
    if (!locale) return ';';
    const commaFirstLocales = ['en', 'zh', 'ja', 'ko'];
    return commaFirstLocales.some(function(prefix) {
      return locale.indexOf(prefix) === 0;
    }) ? ',' : ';';
  } catch (e) {
    return ';';
  }
}

function buildSendPanelActionFormula_(url, label) {
  const safeUrl = String(url || '').trim();
  if (!safeUrl) return '';
  const safeLabel = String(label || getSendPanelActionReadyLabel_()).replace(/"/g, '""');
  const separator = resolveSendPanelFormulaArgSeparator_();
  return `=HYPERLINK("${safeUrl.replace(/"/g, '""')}"${separator} "${safeLabel}")`;
}

function resolveSendPanelActionCellValue_(url, status, sent) {
  const normalizedStatus = normalizeSendPanelStatus_(status);
  const safeUrl = String(url || '').trim();
  if (!safeUrl || normalizedStatus !== SendPanelConstants_.STATUS_READY) {
    return SendPanelConstants_.ACTION_BLOCKED_LABEL;
  }
  return buildSendPanelActionFormula_(safeUrl, sent ? getSendPanelActionSentLabel_() : getSendPanelActionReadyLabel_());
}

function shouldTreatRowAsReadyToOpen_(row) {
  const item = row || {};
  return !!item.link && !item.sent && normalizeSendPanelStatus_(item.status) === SendPanelConstants_.STATUS_READY;
}

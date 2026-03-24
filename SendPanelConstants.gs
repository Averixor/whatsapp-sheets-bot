/**
 * SendPanelConstants.gs — canonical constants and helpers for SEND_PANEL.
 */

const SendPanelConstants_ = Object.freeze({
  STATUS_READY: '✅ Готово',
  STATUS_PENDING: '🟡 Очікує підтвердження',
  STATUS_UNSENT: '↩️ Не відправлено',
  STATUS_SENT: '📤 Відправлено',
  STATUS_ERROR_PREFIX: '❌',
  LEGACY_STATUS_READY: '✅',
  LEGACY_STATUS_OPENED: '🟦 Відкрито',
  WA_SENDER_TARGET: 'WAPB_WHATSAPP_SENDER_TAB',
  METADATA_MONTH_CELL: 'H1',
  METADATA_DATE_CELL: 'H2'
});

function getSendPanelAllAllowedStatuses_() {
  return [
    SendPanelConstants_.STATUS_READY,
    SendPanelConstants_.STATUS_PENDING,
    SendPanelConstants_.STATUS_UNSENT,
    SendPanelConstants_.STATUS_SENT
  ];
}

function normalizeSendPanelStatus_(status) {
  const value = String(status || '').trim();
  if (!value) return SendPanelConstants_.STATUS_READY;
  if (value === SendPanelConstants_.LEGACY_STATUS_READY) return SendPanelConstants_.STATUS_READY;
  if (value === SendPanelConstants_.LEGACY_STATUS_OPENED) return SendPanelConstants_.STATUS_PENDING;
  if (value === SendPanelConstants_.STATUS_READY) return SendPanelConstants_.STATUS_READY;
  if (value === SendPanelConstants_.STATUS_PENDING) return SendPanelConstants_.STATUS_PENDING;
  if (value === SendPanelConstants_.STATUS_UNSENT) return SendPanelConstants_.STATUS_UNSENT;
  if (value === SendPanelConstants_.STATUS_SENT) return SendPanelConstants_.STATUS_SENT;
  if (value.indexOf(SendPanelConstants_.STATUS_ERROR_PREFIX) === 0) return value;
  return value;
}

function isSendPanelReadyLikeStatus_(status) {
  const value = normalizeSendPanelStatus_(status);
  return value === SendPanelConstants_.STATUS_READY || value === SendPanelConstants_.STATUS_UNSENT;
}

function isSendPanelPendingStatus_(status) {
  return normalizeSendPanelStatus_(status) === SendPanelConstants_.STATUS_PENDING;
}

function isSendPanelSentStatusValue_(status) {
  return normalizeSendPanelStatus_(status) === SendPanelConstants_.STATUS_SENT;
}

function isSendPanelErrorStatus_(status) {
  return String(normalizeSendPanelStatus_(status) || '').indexOf(SendPanelConstants_.STATUS_ERROR_PREFIX) === 0;
}

function shouldTreatRowAsReadyToOpen_(row) {
  const item = row || {};
  return !!item.link && !item.sent && isSendPanelReadyLikeStatus_(item.status);
}

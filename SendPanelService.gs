
/**
 * SendPanelService.gs — stage 7 domain service for SEND_PANEL.
 *
 * Доменный слой остаётся тонким: он не меняет бизнес-логику, а даёт
 * каноническую точку входа поверх существующего repository/legacy-ядра.
 */

const SendPanelService_ = (function() {
  function preview(dateStr) {
    return SendPanelRepository_.preview(assertUaDateString_(dateStr));
  }
/**
 * SendPanelService.gs — stage 7 domain service for SEND_PANEL.
 *
 * Доменный слой остаётся тонким: он не меняет бизнес-логику, а даёт
 * каноническую точку входа поверх существующего repository/legacy-ядра.
 */

const SendPanelService_ = (function() {
  function preview(dateStr) {
    return SendPanelRepository_.preview(assertUaDateString_(dateStr));
  }

  function rebuild(dateStr) {
    return SendPanelRepository_.rebuild(assertUaDateString_(dateStr));
  }

  function readRows() {
    return SendPanelRepository_.readRows();
  }

  function getStats(rows) {
    const items = Array.isArray(rows) ? rows : readRows();
    const ready = items.filter(function(item) {
      return shouldTreatRowAsReadyToOpen_(item);
    }).length;
    const sent = items.filter(function(item) {
      return item.sent === true;
    }).length;
    const errors = items.filter(function(item) {
      return normalizeSendPanelStatus_(item.status) !== getSendPanelReadyStatus_();
    }).length;

    return {
      totalCount: items.length,
      readyCount: ready,
      sentCount: sent,
      errorCount: errors
    };
  }

  function normalizeRows(rows) {
    return stage7AsArray_(rows).map(function(item) {
      return {
        fml: String(item && item.fml || '').trim(),
        phone: String(item && item.phone || '').replace(/^'/, '').trim(),
        code: String(item && item.code || '').trim(),
        tasks: String(item && item.tasks || '—').trim() || '—',
        status: normalizeSendPanelStatus_(String(item && item.status || '').trim()),
        link: String(item && item.link || '').trim(),
        sent: item && item.sent === true
      };
    }).filter(function(item) {
      return item.fml || item.phone || item.code;
    });
  }

  function findDuplicateKeys(rows) {
    const seen = {};
    const duplicates = [];
    normalizeRows(rows).forEach(function(item) {
      const key = makeSendPanelKey_(item.fml, item.phone, item.code);
      if (!key || key === '||') return;
      seen[key] = (seen[key] || 0) + 1;
      if (seen[key] === 2) duplicates.push(key);
    });
    return duplicates;
  }

  function resolveTransition(row, action) {
    const item = Object.assign({}, row || {});
    const normalizedAction = String(action || '').trim();

    if (normalizedAction === 'markPending' || normalizedAction === 'openChat' || normalizedAction === 'sendPending') {
      item.sent = false;
      item.status = getSendPanelReadyStatus_();
      return item;
    }
    if (normalizedAction === 'markSent' || normalizedAction === 'confirmSent') {
      item.sent = true;
      item.status = getSendPanelReadyStatus_();
      return item;
    }
    if (normalizedAction === 'markUnsent') {
      item.sent = false;
      item.status = getSendPanelReadyStatus_();
      return item;
    }
    return item;
  }

  function markRowsAsPending(rowNumbers, options) {
    if (typeof SendPanelRepository_.markRowsAsPending === 'function') {
      return SendPanelRepository_.markRowsAsPending(rowNumbers, options || {});
    }
    return { dryRun: !!(options && options.dryRun), requestedRows: stage7AsArray_(rowNumbers) };
  }

  function markRowsAsSent(rowNumbers, options) {
    return SendPanelRepository_.markRowsAsSent(rowNumbers, options || {});
  }

  function markRowsAsUnsent(rowNumbers, options) {
    if (typeof SendPanelRepository_.markRowsAsUnsent === 'function') {
      return SendPanelRepository_.markRowsAsUnsent(rowNumbers, options || {});
    }
    return { dryRun: !!(options && options.dryRun), requestedRows: stage7AsArray_(rowNumbers) };
  }

  return {
    preview: preview,
    rebuild: rebuild,
    readRows: readRows,
    getStats: getStats,
    normalizeRows: normalizeRows,
    findDuplicateKeys: findDuplicateKeys,
    resolveTransition: resolveTransition,
    markRowsAsPending: markRowsAsPending,
    markRowsAsSent: markRowsAsSent,
    markRowsAsUnsent: markRowsAsUnsent
  };
})();

  function rebuild(dateStr) {
    return SendPanelRepository_.rebuild(assertUaDateString_(dateStr));
  }

  function readRows() {
    return SendPanelRepository_.readRows();
  }

  function getStats(rows) {
    const items = Array.isArray(rows) ? rows : readRows();
    const ready = items.filter(function(item) {
      return shouldTreatRowAsReadyToOpen_(item);
    }).length;
    const sent = items.filter(function(item) {
      return item.sent === true;
    }).length;
    const errors = items.filter(function(item) {
      return normalizeSendPanelStatus_(item.status) !== getSendPanelReadyStatus_();
    }).length;

    return {
      totalCount: items.length,
      readyCount: ready,
      sentCount: sent,
      errorCount: errors
    };
  }

  function normalizeRows(rows) {
    return stage7AsArray_(rows).map(function(item) {
      return {
        fml: String(item && item.fml || '').trim(),
        phone: String(item && item.phone || '').replace(/^'/, '').trim(),
        code: String(item && item.code || '').trim(),
        tasks: String(item && item.tasks || '—').trim() || '—',
        status: normalizeSendPanelStatus_(String(item && item.status || '').trim()),
        link: String(item && item.link || '').trim(),
        sent: item && item.sent === true
      };
    }).filter(function(item) {
      return item.fml || item.phone || item.code;
    });
  }

  function findDuplicateKeys(rows) {
    const seen = {};
    const duplicates = [];
    normalizeRows(rows).forEach(function(item) {
      const key = makeSendPanelKey_(item.fml, item.phone, item.code);
      if (!key || key === '||') return;
      seen[key] = (seen[key] || 0) + 1;
      if (seen[key] === 2) duplicates.push(key);
    });
    return duplicates;
  }

  function resolveTransition(row, action) {
    const item = Object.assign({}, row || {});
    const normalizedAction = String(action || '').trim();

    if (normalizedAction === 'markPending' || normalizedAction === 'openChat' || normalizedAction === 'sendPending') {
      item.sent = false;
      item.status = getSendPanelReadyStatus_();
      return item;
    }
    if (normalizedAction === 'markSent' || normalizedAction === 'confirmSent') {
      item.sent = true;
      item.status = getSendPanelReadyStatus_();
      return item;
    }
    if (normalizedAction === 'markUnsent') {
      item.sent = false;
      item.status = getSendPanelReadyStatus_();
      return item;
    }
    return item;
  }

  function markRowsAsPending(rowNumbers, options) {
    if (typeof SendPanelRepository_.markRowsAsPending === 'function') {
      return SendPanelRepository_.markRowsAsPending(rowNumbers, options || {});
    }
    return { dryRun: !!(options && options.dryRun), requestedRows: stage7AsArray_(rowNumbers) };
  }

  function markRowsAsSent(rowNumbers, options) {
    return SendPanelRepository_.markRowsAsSent(rowNumbers, options || {});
  }

  function markRowsAsUnsent(rowNumbers, options) {
    if (typeof SendPanelRepository_.markRowsAsUnsent === 'function') {
      return SendPanelRepository_.markRowsAsUnsent(rowNumbers, options || {});
    }
    return { dryRun: !!(options && options.dryRun), requestedRows: stage7AsArray_(rowNumbers) };
  }

  return {
    preview: preview,
    rebuild: rebuild,
    readRows: readRows,
    getStats: getStats,
    normalizeRows: normalizeRows,
    findDuplicateKeys: findDuplicateKeys,
    resolveTransition: resolveTransition,
    markRowsAsPending: markRowsAsPending,
    markRowsAsSent: markRowsAsSent,
    markRowsAsUnsent: markRowsAsUnsent
  };
})();

/**
 * SendPanelService.gs — stage 7 domain service for SEND_PANEL.
 *
 * Тонкий сервисный слой поверх repository/legacy-ядра.
 * С ленивой проверкой зависимостей, разделением на обязательные и опциональные.
 */

const SendPanelService_ = (function() {
  var _depsChecked = false;
  var _missingDeps = [];

  function ensureDependencies_() {
    if (_depsChecked) return;
    _missingDeps = [];

    if (typeof assertUaDateString_ !== 'function') _missingDeps.push('assertUaDateString_');
    if (typeof stage7AsArray_ !== 'function') _missingDeps.push('stage7AsArray_');
    if (typeof makeSendPanelKey_ !== 'function') _missingDeps.push('makeSendPanelKey_');
    if (typeof normalizeSendPanelStatus_ !== 'function') _missingDeps.push('normalizeSendPanelStatus_');
    if (typeof shouldTreatRowAsReadyToOpen_ !== 'function') _missingDeps.push('shouldTreatRowAsReadyToOpen_');
    if (typeof getSendPanelReadyStatus_ !== 'function') _missingDeps.push('getSendPanelReadyStatus_');

    if (typeof SendPanelRepository_ === 'undefined' || !SendPanelRepository_) {
      _missingDeps.push('SendPanelRepository_');
    } else {
      if (typeof SendPanelRepository_.preview !== 'function') _missingDeps.push('SendPanelRepository_.preview');
      if (typeof SendPanelRepository_.rebuild !== 'function') _missingDeps.push('SendPanelRepository_.rebuild');
      if (typeof SendPanelRepository_.readRows !== 'function') _missingDeps.push('SendPanelRepository_.readRows');
    }

    if (_missingDeps.length > 0) {
      throw new Error('SendPanelService_: missing mandatory dependencies - ' + _missingDeps.join(', '));
    }

    _depsChecked = true;
  }

  function buildFallbackResult_(rowNumbers, options, action) {
    return {
      success: false,
      supported: false,
      action: String(action || ''),
      dryRun: !!(options && options.dryRun),
      requestedRows: stage7AsArray_(rowNumbers),
      updated: 0
    };
  }

  function preview(dateStr) {
    ensureDependencies_();
    return SendPanelRepository_.preview(assertUaDateString_(dateStr));
  }

  function rebuild(dateStr) {
    ensureDependencies_();
    return SendPanelRepository_.rebuild(assertUaDateString_(dateStr));
  }

  function readRows() {
    ensureDependencies_();
    return SendPanelRepository_.readRows();
  }

  function getStats(rows) {
    ensureDependencies_();

    var items = Array.isArray(rows) ? rows : readRows();
    var ready = items.filter(function(item) {
      return shouldTreatRowAsReadyToOpen_(item);
    }).length;

    var sent = items.filter(function(item) {
      return item && item.sent === true;
    }).length;

    var errors = items.filter(function(item) {
      var statusStr = (item && item.status !== undefined && item.status !== null)
        ? String(item.status).trim()
        : '';
      return normalizeSendPanelStatus_(statusStr) !== getSendPanelReadyStatus_();
    }).length;

    return {
      totalCount: items.length,
      readyCount: ready,
      sentCount: sent,
      errorCount: errors
    };
  }

  function normalizeRows(rows) {
    ensureDependencies_();

    return stage7AsArray_(rows).map(function(item) {
      return {
        fml: String((item && item.fml) || '').trim(),
        phone: String((item && item.phone) || '').replace(/^'/, '').trim(),
        code: String((item && item.code) || '').trim(),
        tasks: String((item && item.tasks) || '—').trim() || '—',
        status: normalizeSendPanelStatus_(String((item && item.status) || '').trim()),
        link: String((item && item.link) || '').trim(),
        sent: item && item.sent === true
      };
    }).filter(function(item) {
      return item.fml || item.phone || item.code;
    });
  }

  function findDuplicateKeys(rows) {
    ensureDependencies_();

    var seen = {};
    var duplicates = [];

    normalizeRows(rows).forEach(function(item) {
      var key = makeSendPanelKey_(item.fml, item.phone, item.code);
      if (!key || key === '||') return;

      seen[key] = (seen[key] || 0) + 1;
      if (seen[key] === 2) duplicates.push(key);
    });

    return duplicates;
  }

  function resolveTransition(row, action) {
    ensureDependencies_();

    var item = Object.assign({}, row || {});
    var normalizedAction = String(action || '').trim();

    if (
      normalizedAction === 'markPending' ||
      normalizedAction === 'openChat' ||
      normalizedAction === 'sendPending'
    ) {
      item.sent = false;
      item.status = getSendPanelReadyStatus_();
      return item;
    }

    if (
      normalizedAction === 'markSent' ||
      normalizedAction === 'confirmSent'
    ) {
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
    ensureDependencies_();

    if (SendPanelRepository_ && typeof SendPanelRepository_.markRowsAsPending === 'function') {
      return SendPanelRepository_.markRowsAsPending(rowNumbers, options || {});
    }

    return buildFallbackResult_(rowNumbers, options, 'markRowsAsPending');
  }

  function markRowsAsSent(rowNumbers, options) {
    ensureDependencies_();

    if (SendPanelRepository_ && typeof SendPanelRepository_.markRowsAsSent === 'function') {
      return SendPanelRepository_.markRowsAsSent(rowNumbers, options || {});
    }

    return buildFallbackResult_(rowNumbers, options, 'markRowsAsSent');
  }

  function markRowsAsUnsent(rowNumbers, options) {
    ensureDependencies_();

    if (SendPanelRepository_ && typeof SendPanelRepository_.markRowsAsUnsent === 'function') {
      return SendPanelRepository_.markRowsAsUnsent(rowNumbers, options || {});
    }

    return buildFallbackResult_(rowNumbers, options, 'markRowsAsUnsent');
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
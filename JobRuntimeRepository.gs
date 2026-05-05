/**
 * JobRuntimeRepository.gs — stage 7 persistent job runtime storage.
 * Extended runtime journal with backward-compatible first 10 columns.
 */

const JobRuntimeRepository_ = (function() {
  const PREFIX = 'STAGE7:JOB_RUNTIME:';
  const LAST_PREFIX = PREFIX + 'LAST:';
  const HISTORY_PREFIX = PREFIX + 'HISTORY:';
  const ACTIVE_PREFIX = PREFIX + 'ACTIVE:';
  const BACKOFF_PREFIX = PREFIX + 'BACKOFF:';

  const BASE_COLUMNS = [
    'tsStart',
    'tsEnd',
    'jobName',
    'status',
    'source',
    'durationMs',
    'dryRun',
    'operationId',
    'message',
    'error'
  ];

  const EXTRA_COLUMNS = [
    'initiatorEmail',
    'initiatorName',
    'initiatorRole',
    'initiatorCallsign',
    'entryPoint',
    'triggerId',
    'notes'
  ];

  const ALL_COLUMNS = BASE_COLUMNS.concat(EXTRA_COLUMNS);

  function _props() {
    return PropertiesService.getDocumentProperties();
  }

  function _maxHistory() {
    return Number(STAGE7_CONFIG.MAX_RUNTIME_HISTORY) || 50;
  }

  function _maxLogRows() {
    return Number(STAGE7_CONFIG.MAX_RUNTIME_LOG_ROWS) || 500;
  }

  function _sheetName() {
    return String(STAGE7_CONFIG.JOB_RUNTIME_LOG_SHEET || 'JOB_RUNTIME_LOG');
  }

  function _ensureSheetColumns(sh, requiredCount) {
    const currentMax = sh.getMaxColumns();
    if (currentMax < requiredCount) {
      sh.insertColumnsAfter(currentMax, requiredCount - currentMax);
    }
  }

  function _headersEqual(actual, expected) {
    if (!actual || !expected || actual.length !== expected.length) return false;
    for (let i = 0; i < expected.length; i++) {
      if (String(actual[i] || '') !== String(expected[i] || '')) return false;
    }
    return true;
  }

  function _ensureHeader(sh) {
    _ensureSheetColumns(sh, ALL_COLUMNS.length);

    const current = sh.getRange(1, 1, 1, ALL_COLUMNS.length).getValues()[0];
    if (!_headersEqual(current, ALL_COLUMNS)) {
      sh.getRange(1, 1, 1, ALL_COLUMNS.length).setValues([ALL_COLUMNS]);
    }

    if (sh.getFrozenRows() < 1) {
      sh.setFrozenRows(1);
    }
  }

  function _sheet() {
    const ss = SpreadsheetApp.getActive();
    let sh = ss.getSheetByName(_sheetName());
    if (!sh) {
      sh = ss.insertSheet(_sheetName());
    }
    _ensureHeader(sh);
    return sh;
  }

  function ensureSheet() {
    const sh = _sheet();
    return {
      success: true,
      sheet: sh.getName(),
      lastRow: sh.getLastRow(),
      lastColumn: sh.getLastColumn(),
      expectedColumns: ALL_COLUMNS.slice()
    };
  }

  function _normalizeText(value) {
    return value === null || value === undefined ? '' : String(value);
  }

  function _normalizeBool(value) {
    return value === true;
  }

  function _normalizeNumber(value) {
    const num = Number(value);
    return isFinite(num) ? num : 0;
  }

  function _normalizeRecord(record) {
    const item = Object.assign({}, record || {});

    item.jobName = _normalizeText(item.jobName || 'unknownJob');
    item.tsStart = _normalizeText(item.tsStart || new Date().toISOString());
    item.tsEnd = _normalizeText(item.tsEnd || '');
    item.status = _normalizeText(item.status || '');
    item.source = _normalizeText(item.source || '');
    item.durationMs = _normalizeNumber(item.durationMs);
    item.dryRun = _normalizeBool(item.dryRun);
    item.operationId = _normalizeText(item.operationId || '');
    item.message = _normalizeText(item.message || '');
    item.error = _normalizeText(item.error || '');

    item.initiatorEmail = _normalizeText(item.initiatorEmail || '');
    item.initiatorName = _normalizeText(item.initiatorName || '');
    item.initiatorRole = _normalizeText(item.initiatorRole || '');
    item.initiatorCallsign = _normalizeText(item.initiatorCallsign || '');
    item.entryPoint = _normalizeText(item.entryPoint || '');
    item.triggerId = _normalizeText(item.triggerId || '');
    item.notes = _normalizeText(item.notes || '');

    return item;
  }

  function _recordToRow(item) {
    return [
      item.tsStart,
      item.tsEnd,
      item.jobName,
      item.status,
      item.source,
      item.durationMs,
      item.dryRun,
      item.operationId,
      item.message,
      item.error,
      item.initiatorEmail,
      item.initiatorName,
      item.initiatorRole,
      item.initiatorCallsign,
      item.entryPoint,
      item.triggerId,
      item.notes
    ];
  }

  function _trimLogSheet(sh) {
    const overflow = Math.max(sh.getLastRow() - 1 - _maxLogRows(), 0);
    if (overflow > 0) {
      sh.deleteRows(2, overflow);
    }
  }

  function append(record) {
    const item = _normalizeRecord(record);
    const props = _props();
    const historyKey = HISTORY_PREFIX + item.jobName;
    const lastKey = LAST_PREFIX + item.jobName;

    let history = [];
    try {
      history = JSON.parse(props.getProperty(historyKey) || '[]');
      if (!Array.isArray(history)) history = [];
    } catch (_) {
      history = [];
    }

    history.unshift(item);
    history = history.slice(0, _maxHistory());

    props.setProperty(historyKey, JSON.stringify(history));
    props.setProperty(lastKey, JSON.stringify(item));

    try {
      const sh = _sheet();
      sh.appendRow(_recordToRow(item));
      _trimLogSheet(sh);
    } catch (_) {
    }

    return item;
  }

  function getLast(jobName) {
    const raw = _props().getProperty(LAST_PREFIX + String(jobName || ''));
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function getHistory(jobName) {
    const raw = _props().getProperty(HISTORY_PREFIX + String(jobName || ''));
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function setActive(jobName, payload) {
    const item = Object.assign({ ts: Date.now() }, payload || {});
    _props().setProperty(ACTIVE_PREFIX + String(jobName || ''), JSON.stringify(item));
    return item;
  }

  function getActive(jobName) {
    const raw = _props().getProperty(ACTIVE_PREFIX + String(jobName || ''));
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function clearActive(jobName) {
    _props().deleteProperty(ACTIVE_PREFIX + String(jobName || ''));
    return true;
  }

  function setBackoff(jobName, payload) {
    const item = Object.assign({ ts: Date.now() }, payload || {});
    _props().setProperty(BACKOFF_PREFIX + String(jobName || ''), JSON.stringify(item));
    return item;
  }

  function getBackoff(jobName) {
    const raw = _props().getProperty(BACKOFF_PREFIX + String(jobName || ''));
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function clearBackoff(jobName) {
    _props().deleteProperty(BACKOFF_PREFIX + String(jobName || ''));
    return true;
  }

  function clearStorage() {
    const props = _props();
    const allProps = props.getProperties() || {};
    let removed = 0;

    Object.keys(allProps).forEach(function(key) {
      if (
        key.indexOf(LAST_PREFIX) === 0 ||
        key.indexOf(HISTORY_PREFIX) === 0 ||
        key.indexOf(ACTIVE_PREFIX) === 0 ||
        key.indexOf(BACKOFF_PREFIX) === 0
      ) {
        props.deleteProperty(key);
        removed++;
      }
    });

    return { success: true, removedKeys: removed };
  }

  function buildStoragePolicyReport() {
    const props = _props().getProperties() || {};
    const historyKeys = Object.keys(props).filter(function(key) {
      return key.indexOf(HISTORY_PREFIX) === 0;
    }).length;

    const lastKeys = Object.keys(props).filter(function(key) {
      return key.indexOf(LAST_PREFIX) === 0;
    }).length;

    const activeKeys = Object.keys(props).filter(function(key) {
      return key.indexOf(ACTIVE_PREFIX) === 0;
    }).length;
    
    const backoffKeys = Object.keys(props).filter(function(key) {
      return key.indexOf(BACKOFF_PREFIX) === 0;
    }).length;

    return {
      primaryJournal: _sheetName(),
      lightweightStateStore: 'PropertiesService',
      historyKeys: historyKeys,
      lastKeys: lastKeys,
      activeKeys: activeKeys,
      backoffKeys: backoffKeys,
      journalColumns: ALL_COLUMNS.slice(),
      journalColumnCount: ALL_COLUMNS.length,
      policy: 'hybrid-sheet-plus-properties',
      propertiesArePrimaryJournal: false
    };
  }

  function listLastRuns() {
    const props = _props().getProperties() || {};
    return Object.keys(props)
      .filter(function(key) {
        return key.indexOf(LAST_PREFIX) === 0;
      })
      .sort()
      .map(function(key) {
        try {
          return JSON.parse(props[key]);
        } catch (_) {
          return null;
        }
      })
      .filter(Boolean);
  }

  return {
    ensureSheet: ensureSheet,
    append: append,
    getLast: getLast,
    getHistory: getHistory,
    setActive: setActive,
    getActive: getActive,
    clearActive: clearActive,
    setBackoff: setBackoff,
    getBackoff: getBackoff,
    clearBackoff: clearBackoff,
    clearStorage: clearStorage,
    buildStoragePolicyReport: buildStoragePolicyReport,
    listLastRuns: listLastRuns
  };
})();

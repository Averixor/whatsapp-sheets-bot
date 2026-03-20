
/**
 * JobRuntimeRepository.gs — stage 5 persistent job runtime storage.
 */

const JobRuntimeRepository_ = (function() {
  const PREFIX = 'STAGE5:JOB_RUNTIME:';
  const LAST_PREFIX = PREFIX + 'LAST:';
  const HISTORY_PREFIX = PREFIX + 'HISTORY:';
  const ACTIVE_PREFIX = PREFIX + 'ACTIVE:';

  function _props() {
    return PropertiesService.getDocumentProperties();
  }

  function _sheet() {
    const ss = SpreadsheetApp.getActive();
    let sh = ss.getSheetByName(STAGE5_CONFIG.JOB_RUNTIME_SHEET);
    if (!sh) {
      sh = ss.insertSheet(STAGE5_CONFIG.JOB_RUNTIME_SHEET);
      sh.getRange(1, 1, 1, 10).setValues([[
        'tsStart', 'tsEnd', 'jobName', 'status', 'source', 'durationMs',
        'dryRun', 'operationId', 'message', 'error'
      ]]);
      sh.setFrozenRows(1);
    }
    return sh;
  }

  function append(record) {
    const item = Object.assign({}, record || {});
    const jobName = String(item.jobName || 'unknownJob');
    const historyKey = HISTORY_PREFIX + jobName;
    const lastKey = LAST_PREFIX + jobName;
    const props = _props();

    let history = [];
    try {
      history = JSON.parse(props.getProperty(historyKey) || '[]');
      if (!Array.isArray(history)) history = [];
    } catch (_) {
      history = [];
    }

    history.unshift(item);
    history = history.slice(0, Number(STAGE5_CONFIG.MAX_RUNTIME_HISTORY) || 50);
    props.setProperty(historyKey, JSON.stringify(history));
    props.setProperty(lastKey, JSON.stringify(item));

    try {
      const sh = _sheet();
      sh.appendRow([
        item.tsStart || '',
        item.tsEnd || '',
        jobName,
        item.status || '',
        item.source || '',
        Number(item.durationMs || 0),
        item.dryRun === true,
        item.operationId || '',
        item.message || '',
        item.error || ''
      ]);
      const overflow = Math.max(sh.getLastRow() - 1 - (Number(STAGE5_CONFIG.MAX_RUNTIME_LOG_ROWS) || 500), 0);
      if (overflow > 0) {
        sh.deleteRows(2, overflow);
      }
    } catch (_) {}

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

  function buildStoragePolicyReport() {
    const props = _props().getProperties();
    const historyKeys = Object.keys(props).filter(function(key) { return key.indexOf(HISTORY_PREFIX) === 0; }).length;
    const lastKeys = Object.keys(props).filter(function(key) { return key.indexOf(LAST_PREFIX) === 0; }).length;
    const activeKeys = Object.keys(props).filter(function(key) { return key.indexOf(ACTIVE_PREFIX) === 0; }).length;
    return {
      primaryJournal: STAGE5_CONFIG.JOB_RUNTIME_SHEET,
      lightweightStateStore: 'PropertiesService',
      historyKeys: historyKeys,
      lastKeys: lastKeys,
      activeKeys: activeKeys,
      policy: 'hybrid-sheet-plus-properties',
      propertiesArePrimaryJournal: false
    };
  }

  function listLastRuns() {
    const props = _props().getProperties();
    return Object.keys(props)
      .filter(function(key) { return key.indexOf(LAST_PREFIX) === 0; })
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
    append: append,
    getLast: getLast,
    getHistory: getHistory,
    setActive: setActive,
    getActive: getActive,
    clearActive: clearActive,
    buildStoragePolicyReport: buildStoragePolicyReport,
    listLastRuns: listLastRuns
  };
})();
/**
 * LogsRepository.gs — централізований запис логів.
 */

const LogsRepository_ = (function() {
  function writeBatch(entries) {
    const items = Array.isArray(entries) ? entries : [];
    if (!items.length) return okResponse_({ written: 0 }, 'Немає даних для LOG', { repository: 'LogsRepository_' });
    const result = writeLogsBatch_(items);
    return okResponse_({
      written: result && typeof result.count === 'number' ? result.count : items.length
    }, result && result.message ? result.message : 'Логи записано', {
      repository: 'LogsRepository_'
    });
  }

  function clear() {
    const ok = clearLogCore_();
    return okResponse_({
      cleared: !!ok
    }, ok ? 'LOG очищено' : 'LOG відсутній', {
      repository: 'LogsRepository_'
    }, ok ? [] : ['Лист LOG не знайдено']);
  }

  return {
    writeBatch: writeBatch,
    clear: clear
  };
})();
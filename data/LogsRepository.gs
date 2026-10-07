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
    const result = clearLogCore_();
    const cleared = !!(result && result.cleared);
    const clearedSheets = cleared ? (result.clearedSheets || []) : [];
    const missingSheets = result && result.missingSheets ? result.missingSheets : [];
    return okResponse_({
      cleared: cleared,
      clearedSheets: clearedSheets,
      missingSheets: missingSheets,
      details: result && result.details ? result.details : [],
      runtimeStorage: result && result.runtimeStorage ? result.runtimeStorage : null
    }, cleared
      ? ('Логи очищено: ' + clearedSheets.join(', '))
      : 'Жоден лог-аркуш не знайдено', {
      repository: 'LogsRepository_'
    }, cleared ? [] : ['Не знайдено жодного лог-аркуша для очищення']);
  }

  return {
    writeBatch: writeBatch,
    clear: clear
  };
})();

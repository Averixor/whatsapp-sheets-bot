/**
 * VacationsRepository.gs — canonical доступ до VACATIONS.
 */

const VacationsRepository_ = (function() {
  function listAll() {
    const rows = DataAccess_.readObjects('VACATIONS', {
      displayValues: false,
      required: false
    });

    return rows.map(function(item) {
      return {
        fio: String(item.fio || '').trim(),
        startDateRaw: item.startDate,
        endDateRaw: item.endDate,
        vacationNo: String(item.vacationNo || '').trim(),
        active: item.active === true || String(item.active || '').toUpperCase() === 'TRUE',
        notify: item.notify === true || String(item.notify || '').toUpperCase() === 'TRUE',
        startDate: _parseDate_(item.startDate),
        endDate: _parseDate_(item.endDate),
        _meta: item._meta
      };
    });
  }

  function findByFio(fio) {
    const key = _normFio_(fio);
    return listAll().filter(function(item) {
      return _normFio_(item.fio) === key;
    });
  }

  function getCurrentForFio(fio, dateStr) {
    const target = _parseUaDate_(dateStr) || new Date();
    target.setHours(12, 0, 0, 0);

    const matches = findByFio(fio).filter(function(item) {
      if (!item.active || !item.startDate || !item.endDate) return false;
      return target.getTime() >= item.startDate.getTime() && target.getTime() <= item.endDate.getTime();
    });

    return {
      inVacation: matches.length > 0,
      matches: matches.map(function(item) {
        return {
          no: item.vacationNo || '—',
          start: item.startDate ? Utilities.formatDate(item.startDate, getTimeZone_(), 'dd.MM.yyyy') : '',
          end: item.endDate ? Utilities.formatDate(item.endDate, getTimeZone_(), 'dd.MM.yyyy') : ''
        };
      })
    };
  }

  function getNextForFio(fio, dateStr) {
    const target = _parseUaDate_(dateStr) || new Date();
    target.setHours(0, 0, 0, 0);

    const future = findByFio(fio).filter(function(item) {
      return item.active && item.startDate && item.endDate && item.startDate.getTime() >= target.getTime();
    }).map(function(item) {
      return {
        no: _vacationWordToNumber_(item.vacationNo),
        word: item.vacationNo || '—',
        start: Utilities.formatDate(item.startDate, getTimeZone_(), 'dd.MM.yyyy'),
        end: Utilities.formatDate(item.endDate, getTimeZone_(), 'dd.MM.yyyy'),
        daysUntil: Math.ceil((item.startDate.getTime() - target.getTime()) / 86400000)
      };
    });

    if (!future.length) return null;
    future.sort(function(a, b) { return a.daysUntil - b.daysUntil; });
    return future[0];
  }

  return {
    listAll: listAll,
    findByFio: findByFio,
    getCurrentForFio: getCurrentForFio,
    getNextForFio: getNextForFio
  };
})();
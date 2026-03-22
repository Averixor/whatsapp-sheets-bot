
/**
 * VacationService.gs — stage 5 domain service for vacations / birthdays.
 */

const VacationService_ = (function() {
  function check(dateStr) {
    const target = _parseUaDate_(dateStr || _todayStr_()) || new Date();
    const vacations = runVacationEngine_(target);
    const birthdays = runBirthdayEngine_(target);

    return {
      date: Utilities.formatDate(target, getTimeZone_(), 'dd.MM.yyyy'),
      vacations: vacations || {},
      birthdays: birthdays || {},
      summary: {
        vacationRaports: Number((vacations && vacations.raportReminders || []).length),
        vacationSoldiers: Number((vacations && vacations.soldierMessages || []).length),
        vacationCommander: Number((vacations && vacations.commanderMessages || []).length),
        birthdayCommander: Number((birthdays && birthdays.commanderMessages || []).length),
        birthdayPeople: Number((birthdays && birthdays.birthdayMessages || []).length)
      }
    };
  }

  function buildBirthdayLinkSafe(phone, name) {
    return buildBirthdayLink(phone, name);
  }

  return {
    check: check,
    buildBirthdayLink: buildBirthdayLinkSafe
  };
})();
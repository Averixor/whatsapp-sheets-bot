/**
 * VacationService.gs — stage 7 domain service for vacations / birthdays.
 */

const VacationService_ = (function () {
  function check(dateOrOptions) {
    const options =
      dateOrOptions && typeof dateOrOptions === "object"
        ? Object.assign({}, dateOrOptions)
        : { date: dateOrOptions };
    const target =
      DateUtils_.parseUaDate(options.date || options.dateStr || _todayStr_()) ||
      new Date();
    const vacations = runVacationEngine_(target, options);
    const birthdays = runBirthdayEngine_(target, options);

    return {
      date: Utilities.formatDate(target, getTimeZone_(), "dd.MM.yyyy"),
      vacations: vacations || {},
      birthdays: birthdays || {},
      summary: {
        vacationSoldiers: Number(
          ((vacations && vacations.soldierMessages) || []).length,
        ),
        vacationCommander: Number(
          ((vacations && vacations.commanderMessages) || []).length,
        ),
        birthdayCommander: Number(
          ((birthdays && birthdays.commanderMessages) || []).length,
        ),
        birthdayPeople: Number(
          ((birthdays && birthdays.birthdayMessages) || []).length,
        ),
      },
    };
  }

  function buildBirthdayLinkSafe(phone, name) {
    return buildBirthdayLink(phone, name);
  }

  return {
    check: check,
    buildBirthdayLink: buildBirthdayLinkSafe,
  };
})();

/**
 * VacationsRepository.gs — canonical доступ до VACATIONS.
 */

const VacationsRepository_ = (function () {
  function _blocks_() {
    try {
      if (
        typeof VACATION_PLANNER_CONFIG === "object" &&
        VACATION_PLANNER_CONFIG &&
        Array.isArray(VACATION_PLANNER_CONFIG.BLOCKS)
      ) {
        return VACATION_PLANNER_CONFIG.BLOCKS;
      }
    } catch (_) {}
    return [
      { key: "first", vacationNumber: 1, startCol: 1 },
      { key: "second", vacationNumber: 2, startCol: 11 },
    ];
  }

  function _bool_(value, defaultValue) {
    if (value === true || value === false) return value;
    const normalized = String(value == null ? "" : value)
      .trim()
      .toUpperCase();
    if (["TRUE", "1", "YES", "Y", "ТАК"].indexOf(normalized) !== -1) {
      return true;
    }
    if (["FALSE", "0", "NO", "N", "НІ"].indexOf(normalized) !== -1) {
      return false;
    }
    return !!defaultValue;
  }

  function _sourceSheetName_() {
    try {
      if (
        typeof VACATION_PLANNER_CONFIG === "object" &&
        VACATION_PLANNER_CONFIG &&
        VACATION_PLANNER_CONFIG.SHEETS &&
        VACATION_PLANNER_CONFIG.SHEETS.SOURCE
      ) {
        return VACATION_PLANNER_CONFIG.SHEETS.SOURCE;
      }
    } catch (_) {}
    return "VACATIONS";
  }

  function listAll() {
    const sheet = DataAccess_.getSheet(_sourceSheetName_(), null, false);
    if (!sheet || sheet.getLastRow() < 2) return [];

    const rowCount = sheet.getLastRow() - 1;
    const out = [];
    _blocks_().forEach(function (block) {
      let headers = [];
      try {
        const headerRange = sheet.getRange(1, block.startCol, 1, 9);
        headers =
          typeof headerRange.getDisplayValues === "function"
            ? headerRange.getDisplayValues()[0]
            : headerRange.getValues()[0];
      } catch (_) {}
      const daysHeader = String(headers[6] || "")
        .trim()
        .toLowerCase();
      const rows = sheet
        .getRange(2, block.startCol, rowCount, 9)
        .getValues();
      rows.forEach(function (row, index) {
        const fml = String(row[0] || "").trim();
        if (!fml) return;
        const vacationNo = String(row[3] || "").trim();
        out.push({
          fml: fml,
          startDateRaw: row[1],
          endDateRaw: row[2],
          vacationNo: vacationNo,
          vacationNumber:
            Number(_vacationWordToNumber_(vacationNo)) ||
            Number(block.vacationNumber) ||
            0,
          active: _bool_(row[4], false),
          isActive: _bool_(row[4], false),
          notify: _bool_(row[5], true),
          days: Number(row[6]) || 0,
          declaredDurationDays:
            daysHeader === "days" ? Number(row[6]) || 0 : 0,
          daysMeaning: daysHeader || "",
          travel: String(row[7] || "").trim(),
          intervalCheck: String(row[8] || "").trim(),
          startDate: DateUtils_.parseDateAny(row[1]),
          endDate: DateUtils_.parseDateAny(row[2]),
          _meta: {
            schema: "vacations",
            sheetName: sheet.getName(),
            rowNumber: index + 2,
            block: block.key,
            startColumn: block.startCol,
          },
        });
      });
    });
    return out;
  }

  function findByFml(fml) {
    const key = _normFml_(fml);
    return listAll().filter(function (item) {
      return _normFml_(item.fml) === key;
    });
  }

  function getCurrentForFml(fml, dateStr) {
    const target = DateUtils_.parseUaDate(dateStr) || new Date();
    target.setHours(12, 0, 0, 0);

    const matches = findByFml(fml).filter(function (item) {
      if (!item.active || !item.startDate || !item.endDate) return false;
      return (
        target.getTime() >= item.startDate.getTime() &&
        target.getTime() <= item.endDate.getTime()
      );
    });

    return {
      inVacation: matches.length > 0,
      matches: matches.map(function (item) {
        return {
          no: item.vacationNo || "—",
          start: item.startDate
            ? Utilities.formatDate(item.startDate, getTimeZone_(), "dd.MM.yyyy")
            : "",
          end: item.endDate
            ? Utilities.formatDate(item.endDate, getTimeZone_(), "dd.MM.yyyy")
            : "",
        };
      }),
    };
  }

  function getNextForFml(fml, dateStr) {
    const target = DateUtils_.parseUaDate(dateStr) || new Date();
    target.setHours(0, 0, 0, 0);

    const future = findByFml(fml)
      .filter(function (item) {
        return (
          item.active &&
          item.startDate &&
          item.endDate &&
          item.startDate.getTime() >= target.getTime()
        );
      })
      .map(function (item) {
        return {
          no: _vacationWordToNumber_(item.vacationNo),
          word: item.vacationNo || "—",
          start: Utilities.formatDate(
            item.startDate,
            getTimeZone_(),
            "dd.MM.yyyy",
          ),
          end: Utilities.formatDate(item.endDate, getTimeZone_(), "dd.MM.yyyy"),
          daysUntil: Math.ceil(
            (item.startDate.getTime() - target.getTime()) / 86400000,
          ),
        };
      });

    if (!future.length) return null;
    future.sort(function (a, b) {
      return a.daysUntil - b.daysUntil;
    });
    return future[0];
  }

  return {
    listAll: listAll,
    findByFml: findByFml,
    getCurrentForFml: getCurrentForFml,
    getNextForFml: getNextForFml,
  };
})();

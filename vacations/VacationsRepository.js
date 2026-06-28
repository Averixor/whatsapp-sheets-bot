/**
 * VacationsRepository.gs — canonical vacation reads through a source adapter.
 *
 * Default: legacy VACATIONS A:I only (single source of truth).
 * K:Q is presentation / migration only — never read as vacation source.
 * Opt-in: flat VACATION_REQUESTS when Script Property
 * WASB_VACATION_SOURCE=VACATION_REQUESTS.
 */

const VacationsRepository_ = (function () {
  function _sourceRangeConfig_() {
    try {
      if (
        typeof VACATION_PLANNER_CONFIG === "object" &&
        VACATION_PLANNER_CONFIG &&
        VACATION_PLANNER_CONFIG.SOURCE_RANGE
      ) {
        return VACATION_PLANNER_CONFIG.SOURCE_RANGE;
      }
    } catch (_) {}
    return { startCol: 1, width: 9, startRow: 2 };
  }

  function _rightPanelConfig_() {
    try {
      if (
        typeof VACATION_PLANNER_CONFIG === "object" &&
        VACATION_PLANNER_CONFIG &&
        VACATION_PLANNER_CONFIG.RIGHT_PANEL
      ) {
        return VACATION_PLANNER_CONFIG.RIGHT_PANEL;
      }
    } catch (_) {}
    return {
      startCol: 11,
      width: 9,
      warningMessage:
        "Увага: знайдено дані у правій таблиці K:Q. Вона не є джерелом істини. Перенесіть ці записи в основний список A:I або очистіть праву таблицю.",
    };
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

  function _requestsSheetName_() {
    try {
      if (
        typeof VACATION_PLANNER_CONFIG === "object" &&
        VACATION_PLANNER_CONFIG &&
        VACATION_PLANNER_CONFIG.SHEETS &&
        VACATION_PLANNER_CONFIG.SHEETS.REQUESTS
      ) {
        return VACATION_PLANNER_CONFIG.SHEETS.REQUESTS;
      }
    } catch (_) {}
    return "VACATION_REQUESTS";
  }

  function _requestHeaders_() {
    try {
      if (
        typeof VACATION_PLANNER_CONFIG === "object" &&
        VACATION_PLANNER_CONFIG &&
        Array.isArray(VACATION_PLANNER_CONFIG.REQUEST_HEADERS)
      ) {
        return VACATION_PLANNER_CONFIG.REQUEST_HEADERS.slice();
      }
    } catch (_) {}
    return [
      "ID",
      "PersonKey",
      "FML",
      "Year",
      "VacationNo",
      "Type",
      "DesiredStart",
      "ApprovedStart",
      "EndDate",
      "Days",
      "TravelDays",
      "Status",
      "Notify",
      "CreatedAt",
      "UpdatedAt",
      "Comment",
    ];
  }

  function _sourceModeProperty_() {
    try {
      return (
        (VACATION_PLANNER_CONFIG &&
          VACATION_PLANNER_CONFIG.SOURCE_MODE_PROPERTY) ||
        "WASB_VACATION_SOURCE"
      );
    } catch (_) {
      return "WASB_VACATION_SOURCE";
    }
  }

  function _dateKey_(dateValue, rawValue) {
    if (dateValue instanceof Date && !isNaN(dateValue.getTime())) {
      return Utilities.formatDate(dateValue, getTimeZone_(), "yyyy-MM-dd");
    }
    return String(rawValue == null ? "" : rawValue)
      .trim()
      .toLowerCase();
  }

  function _vacationRowKey_(item) {
    const fmlKey =
      typeof _normFml_ === "function"
        ? _normFml_(item && item.fml)
        : String((item && item.fml) || "")
            .trim()
            .toUpperCase();
    return (
      fmlKey +
      "|" +
      _dateKey_(item && item.startDate, item && item.startDateRaw) +
      "|" +
      _dateKey_(item && item.endDate, item && item.endDateRaw)
    );
  }

  function getSourceMode() {
    if (
      typeof PropertiesService === "undefined" ||
      !PropertiesService ||
      typeof PropertiesService.getScriptProperties !== "function"
    ) {
      throw new Error(
        "Не вдалося визначити джерело відпусток: PropertiesService недоступний",
      );
    }
    let configured;
    try {
      configured = String(
        PropertiesService.getScriptProperties().getProperty(
          _sourceModeProperty_(),
        ) || "",
      )
        .trim()
        .toUpperCase();
    } catch (error) {
      throw new Error(
        "Не вдалося визначити джерело відпусток: " +
          (error && error.message ? error.message : String(error)),
      );
    }
    if (configured === _requestsSheetName_().toUpperCase()) return "requests";
    if (!configured || configured === _sourceSheetName_().toUpperCase()) {
      return "legacy";
    }
    throw new Error(
      "Невідоме значення " +
        _sourceModeProperty_() +
        ": " +
        configured +
        ". Дозволені джерела: аркуш відпусток або заявки на відпустку",
    );
  }

  function getSourceSheetName() {
    return getSourceMode() === "requests"
      ? _requestsSheetName_()
      : _sourceSheetName_();
  }

  function _spreadsheet_() {
    if (
      typeof DataAccess_ === "object" &&
      DataAccess_ &&
      typeof DataAccess_.getSpreadsheet === "function"
    ) {
      return DataAccess_.getSpreadsheet();
    }
    return getWasbSpreadsheet_();
  }

  function _requestHeaderIndex_(sheet) {
    const required = _requestHeaders_();
    const lastColumn = Math.max(sheet.getLastColumn(), required.length);
    const headers = sheet
      .getRange(1, 1, 1, lastColumn)
      .getDisplayValues()[0];
    const index = {};
    headers.forEach(function (header, position) {
      const key = String(header || "")
        .trim()
        .toUpperCase();
      if (key) index[key] = position;
    });
    const missing = required.filter(function (header) {
      return index[String(header).toUpperCase()] === undefined;
    });
    if (missing.length) {
      throw new Error(
        "VACATION_REQUESTS: відсутні колонки: " + missing.join(", "),
      );
    }
    return index;
  }

  function _requestValue_(row, index, header) {
    const position = index[String(header).toUpperCase()];
    return position === undefined ? "" : row[position];
  }

  function _requestVacationNumber_(vacationNo, type) {
    const direct = Number(vacationNo);
    if (direct === 1 || direct === 2) return direct;
    const typeKey = String(type || "")
      .trim()
      .toUpperCase();
    if (typeKey === "В1") return 1;
    if (typeKey === "В2") return 2;
    try {
      return Number(_vacationWordToNumber_(vacationNo)) || 0;
    } catch (_) {
      return 0;
    }
  }

  function _requestStatusMatches_(status, configKey, fallbackStatuses) {
    const key = String(status || "")
      .trim()
      .toUpperCase();
    let statuses = fallbackStatuses.map(function (value) {
      return String(value || "")
        .trim()
        .toUpperCase();
    });
    try {
      if (
        VACATION_PLANNER_CONFIG &&
        Array.isArray(VACATION_PLANNER_CONFIG[configKey])
      ) {
        statuses = VACATION_PLANNER_CONFIG[configKey].map(function (value) {
          return String(value || "")
            .trim()
            .toUpperCase();
        });
      }
    } catch (_) {}
    return statuses.indexOf(key) !== -1;
  }

  function _requestIsActive_(status) {
    return _requestStatusMatches_(status, "REQUEST_ACTIVE_STATUSES", [
      "Proposed",
      "Approved",
      "Applied",
    ]);
  }

  function _requestIsOperational_(status) {
    return _requestStatusMatches_(status, "REQUEST_OPERATIONAL_STATUSES", [
      "Approved",
      "Applied",
    ]);
  }

  function _requestExpectsFact_(status) {
    return _requestStatusMatches_(status, "REQUEST_FACT_STATUSES", ["Applied"]);
  }

  function _requestIsReminderEligible_(status) {
    return _requestStatusMatches_(status, "REQUEST_REMINDER_STATUSES", [
      "Approved",
      "Applied",
    ]);
  }

  function _legacyHeaderMeta_(sheet) {
    const rangeCfg = _sourceRangeConfig_();
    const startCol = rangeCfg.startCol || 1;
    const width = rangeCfg.width || 9;
    let headers = [];
    let headerFormulas = [];
    try {
      const headerRange = sheet.getRange(1, startCol, 1, width);
      headers =
        typeof headerRange.getDisplayValues === "function"
          ? headerRange.getDisplayValues()[0]
          : headerRange.getValues()[0];
      headerFormulas =
        typeof headerRange.getFormulas === "function"
          ? headerRange.getFormulas()[0]
          : [];
    } catch (_) {}
    const daysHeader = String(headers[6] || "")
      .trim()
      .toLowerCase();
    const writable = [0, 1, 3].every(function (index) {
      return !String(headerFormulas[index] || "").trim();
    });
    return {
      daysHeader: daysHeader,
      writable: writable,
      startCol: startCol,
    };
  }

  function readVacationSource() {
    const sheet = DataAccess_.getSheet(_sourceSheetName_(), null, false);
    if (!sheet || sheet.getLastRow() < 2) return [];

    const rangeCfg = _sourceRangeConfig_();
    const startCol = rangeCfg.startCol || 1;
    const width = rangeCfg.width || 9;
    const startRow = rangeCfg.startRow || 2;
    const rowCount = sheet.getLastRow() - startRow + 1;
    if (rowCount < 1) return [];

    const rows = sheet.getRange(startRow, startCol, rowCount, width).getValues();
    const out = [];
    rows.forEach(function (row, index) {
      const fml = String(row[0] || "").trim();
      if (!fml) return;
      out.push({
        row: index + startRow,
        fml: fml,
        startDate: DateUtils_.parseDateAny(row[1]),
        endDate: DateUtils_.parseDateAny(row[2]),
        vacationNo: String(row[3] || "").trim(),
        active: _bool_(row[4], false),
        notify: _bool_(row[5], true),
        daysLeft: Number(row[6]) || 0,
        travel: String(row[7] || "").trim(),
        intervalCheck: String(row[8] || "").trim(),
        startDateRaw: row[1],
        endDateRaw: row[2],
      });
    });
    return out;
  }

  function readRightPanelRows() {
    const sheet = DataAccess_.getSheet(_sourceSheetName_(), null, false);
    if (!sheet || sheet.getLastRow() < 2) return [];

    const panel = _rightPanelConfig_();
    const startCol = panel.startCol || 11;
    const width = panel.width || 9;
    const rowCount = sheet.getLastRow() - 1;
    if (rowCount < 1) return [];

    const rows = sheet.getRange(2, startCol, rowCount, width).getValues();
    const out = [];
    rows.forEach(function (row, index) {
      const fml = String(row[0] || "").trim();
      if (!fml) return;
      out.push({
        row: index + 2,
        fml: fml,
        startDate: DateUtils_.parseDateAny(row[1]),
        endDate: DateUtils_.parseDateAny(row[2]),
        vacationNo: String(row[3] || "").trim(),
        active: _bool_(row[4], false),
        notify: _bool_(row[5], true),
        daysLeft: Number(row[6]) || 0,
        travel: String(row[7] || "").trim(),
        intervalCheck: String(row[8] || "").trim(),
        startDateRaw: row[1],
        endDateRaw: row[2],
      });
    });
    return out;
  }

  function detectRightPanelManualData() {
    const rows = readRightPanelRows();
    const panel = _rightPanelConfig_();
    if (!rows.length) {
      return {
        hasData: false,
        count: 0,
        rows: [],
        message: "",
      };
    }
    return {
      hasData: true,
      count: rows.length,
      rows: rows,
      fmlSummary: rows
        .map(function (item) {
          return item.fml;
        })
        .slice(0, 5)
        .join(", "),
      message: panel.warningMessage,
    };
  }

  function listLegacy() {
    const sheet = DataAccess_.getSheet(_sourceSheetName_(), null, false);
    if (!sheet || sheet.getLastRow() < 2) return [];

    const headerMeta = _legacyHeaderMeta_(sheet);
    return readVacationSource().map(function (item) {
      const vacationNo = item.vacationNo;
      const active = item.active;
      return {
        fml: item.fml,
        startDateRaw: item.startDateRaw,
        endDateRaw: item.endDateRaw,
        vacationNo: vacationNo,
        vacationNumber: Number(_vacationWordToNumber_(vacationNo)) || 0,
        active: active,
        isActive: active,
        operationalActive: active,
        factExpected: active,
        reminderEligible: active,
        notify: item.notify,
        days: item.daysLeft,
        declaredDurationDays:
          headerMeta.daysHeader === "days" ? item.daysLeft : 0,
        daysMeaning: headerMeta.daysHeader || "",
        travel: item.travel,
        intervalCheck: item.intervalCheck,
        startDate: item.startDate,
        endDate: item.endDate,
        _meta: {
          schema: "vacations",
          sheetName: sheet.getName(),
          rowNumber: item.row,
          block: "main",
          startColumn: headerMeta.startCol,
          writable: headerMeta.writable,
        },
      };
    });
  }

  function _findNextMainSourceRow_(sheet, rangeCfg) {
    const startRow = rangeCfg.startRow || 2;
    const startCol = rangeCfg.startCol || 1;
    const width = rangeCfg.width || 9;
    const lastRow = Math.max(sheet.getLastRow(), startRow);
    const rowCount = Math.max(lastRow - startRow + 1, 1);
    const values = sheet
      .getRange(startRow, startCol, rowCount, width)
      .getValues();
    for (let index = 0; index < values.length; index++) {
      if (!String(values[index][0] || "").trim()) {
        return index + startRow;
      }
    }
    return lastRow + 1;
  }

  function migrateRightVacationTableToMainSource() {
    const sheet = DataAccess_.getSheet(_sourceSheetName_(), null, false);
    if (!sheet) {
      throw new Error("Аркуш відпусток не знайдено");
    }

    const panel = _rightPanelConfig_();
    const rangeCfg = _sourceRangeConfig_();
    const startCol = rangeCfg.startCol || 1;
    const width = rangeCfg.width || 9;
    const rightRows = readRightPanelRows();
    if (!rightRows.length) {
      return {
        migrated: 0,
        skipped: 0,
        cleared: false,
        message: "У правій таблиці K:Q немає записів для переносу",
      };
    }

    const existingKeys = {};
    readVacationSource().forEach(function (item) {
      existingKeys[_vacationRowKey_(item)] = true;
    });

    let migrated = 0;
    let skipped = 0;
    let targetRow = _findNextMainSourceRow_(sheet, rangeCfg);

    rightRows.forEach(function (item) {
      const key = _vacationRowKey_(item);
      if (existingKeys[key]) {
        skipped++;
        return;
      }
      let vacationNo = String(item.vacationNo || "").trim();
      if (!vacationNo) {
        vacationNo =
          Number(_vacationWordToNumber_(item.vacationNo)) === 2
            ? "друга відпустка"
            : "перша відпустка";
      }
      const rowData = [
        item.fml,
        item.startDateRaw || item.startDate,
        item.endDateRaw || item.endDate,
        vacationNo,
        item.active,
        item.notify,
        item.daysLeft,
        item.travel,
        item.intervalCheck || "OK",
      ];
      sheet.getRange(targetRow, startCol, 1, width).setValues([rowData]);
      sheet.getRange(targetRow, startCol + 1, 1, 2).setNumberFormat("dd.MM.yyyy");
      existingKeys[key] = true;
      migrated++;
      targetRow++;
    });

    const rowCount = Math.max(sheet.getLastRow() - 1, 1);
    sheet
      .getRange(2, panel.startCol || 11, rowCount, panel.width || 9)
      .clearContent();

    return {
      migrated: migrated,
      skipped: skipped,
      cleared: true,
      message:
        migrated > 0
          ? "Перенесено записів: " +
            migrated +
            (skipped ? ", пропущено дублів: " + skipped : "")
          : skipped > 0
            ? "Усі записи вже були в основному списку A:I"
            : "Немає записів для переносу",
    };
  }

  function verifySingleVacationSource() {
    const checks = [];
    const issues = [];
    let mainCount = 0;

    try {
      mainCount = readVacationSource().length;
      checks.push("Основне джерело A:I читається (" + mainCount + " рядків)");
    } catch (error) {
      issues.push(
        "Не вдалося прочитати A:I: " +
          (error && error.message ? error.message : String(error)),
      );
    }

    try {
      const legacy = listLegacy();
      const foreignColumns = legacy.filter(function (item) {
        return item._meta && Number(item._meta.startColumn) !== 1;
      });
      if (foreignColumns.length) {
        issues.push("listLegacy() читає дані поза основним діапазоном A:I");
      } else {
        checks.push("Валідатори отримують дані лише з A:I");
      }
    } catch (error) {
      issues.push(
        "listLegacy() недоступний: " +
          (error && error.message ? error.message : String(error)),
      );
    }

    const rightPanel = detectRightPanelManualData();
    if (rightPanel.hasData) {
      issues.push(rightPanel.message);
    } else {
      checks.push("У правій таблиці K:Q немає ручних записів відпусток");
    }

    return {
      ok: issues.length === 0,
      checks: checks,
      issues: issues,
      mainSourceRows: mainCount,
      rightPanelRows: rightPanel.count || 0,
    };
  }

  function listRequests(options) {
    const opts = options || {};
    const sheet = _spreadsheet_().getSheetByName(_requestsSheetName_());
    if (!sheet) {
      if (opts.required === true) {
        throw new Error(
          "Активне джерело заявок на відпустку не знайдено. Поверніть джерело відпусток у налаштуваннях або виконайте міграцію.",
        );
      }
      return [];
    }
    if (sheet.getLastRow() < 1) {
      if (opts.required === true) {
        throw new Error("Активне джерело заявок на відпустку порожнє");
      }
      return [];
    }
    const index = _requestHeaderIndex_(sheet);
    if (sheet.getLastRow() < 2) return [];
    const rowCount = sheet.getLastRow() - 1;
    const width = Math.max(sheet.getLastColumn(), _requestHeaders_().length);
    const rows = sheet.getRange(2, 1, rowCount, width).getValues();
    const seenIds = {};
    return rows
      .map(function (row, rowIndex) {
        const id = String(_requestValue_(row, index, "ID") || "").trim();
        const fml = String(_requestValue_(row, index, "FML") || "").trim();
        const hasContent = row.some(function (value) {
          return value instanceof Date || String(value || "").trim() !== "";
        });
        if (!hasContent) return null;
        if (!id) {
          throw new Error(
            "VACATION_REQUESTS: рядок " +
              (rowIndex + 2) +
              " не містить обов'язковий ID",
          );
        }
        const idKey = id.toUpperCase();
        if (seenIds[idKey]) {
          throw new Error(
            "VACATION_REQUESTS: дубль ID «" +
              id +
              "» у рядках " +
              seenIds[idKey] +
              " та " +
              (rowIndex + 2),
          );
        }
        seenIds[idKey] = rowIndex + 2;
        const vacationNo = _requestValue_(row, index, "VacationNo");
        const type = String(_requestValue_(row, index, "Type") || "").trim();
        const vacationNumber = _requestVacationNumber_(vacationNo, type);
        const vacationWord =
          vacationNumber === 2
            ? "друга відпустка"
            : vacationNumber === 1
              ? "перша відпустка"
              : String(vacationNo || type || "").trim();
        const status = String(
          _requestValue_(row, index, "Status") || "",
        ).trim();
        const approvedStart = _requestValue_(row, index, "ApprovedStart");
        const desiredStart = _requestValue_(row, index, "DesiredStart");
        const startDateRaw = approvedStart || desiredStart;
        const endDateRaw = _requestValue_(row, index, "EndDate");
        const days = Number(_requestValue_(row, index, "Days")) || 0;
        const active = _requestIsActive_(status);
        const operationalActive = _requestIsOperational_(status);
        const personKey = String(
          _requestValue_(row, index, "PersonKey") || "",
        ).trim();
        if (active && (!personKey || !fml)) {
          throw new Error(
            "VACATION_REQUESTS: активний рядок " +
              (rowIndex + 2) +
              " повинен містити PersonKey та FML",
          );
        }
        return {
          id: id,
          requestId: id,
          personKey: personKey,
          fml: fml,
          year: Number(_requestValue_(row, index, "Year")) || 0,
          requestVacationNo: vacationNo,
          vacationNo: vacationWord,
          vacationType: type,
          type: type,
          vacationNumber: vacationNumber,
          desiredStartRaw: desiredStart,
          approvedStartRaw: approvedStart,
          startDateRaw: startDateRaw,
          endDateRaw: endDateRaw,
          startDate: DateUtils_.parseDateAny(startDateRaw),
          endDate: DateUtils_.parseDateAny(endDateRaw),
          days: days,
          declaredDurationDays: days,
          daysMeaning: "days",
          travel: String(
            _requestValue_(row, index, "TravelDays") || "",
          ).trim(),
          status: status,
          active: active,
          isActive: active,
          operationalActive: operationalActive,
          factExpected: _requestExpectsFact_(status),
          reminderEligible: _requestIsReminderEligible_(status),
          notify: _bool_(_requestValue_(row, index, "Notify"), true),
          createdAt: _requestValue_(row, index, "CreatedAt"),
          updatedAt: _requestValue_(row, index, "UpdatedAt"),
          comment: String(
            _requestValue_(row, index, "Comment") || "",
          ).trim(),
          intervalCheck: "",
          _meta: {
            schema: "vacation_requests",
            sheetName: sheet.getName(),
            rowNumber: rowIndex + 2,
            block: "request",
            startColumn: 1,
            writable: true,
          },
        };
      })
      .filter(Boolean);
  }

  function listAll() {
    return getSourceMode() === "requests"
      ? listRequests({ required: true })
      : listLegacy();
  }

  function _personLookupKeys_(value) {
    const keys = {};
    function add(candidate) {
      const key = _normFml_(candidate);
      if (key) keys[key] = true;
    }
    add(value);
    try {
      if (
        typeof PersonnelRepository_ === "object" &&
        PersonnelRepository_ &&
        typeof PersonnelRepository_.getByFml === "function"
      ) {
        const person = PersonnelRepository_.getByFml(value, {
          activeOnly: false,
        });
        if (person) {
          add(person.callsign);
          add(person.fml);
        }
      }
    } catch (_) {}
    return keys;
  }

  function findByFml(fml) {
    const keys = _personLookupKeys_(fml);
    return listAll().filter(function (item) {
      return (
        keys[_normFml_(item.personKey)] === true ||
        keys[_normFml_(item.fml)] === true
      );
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
    listLegacy: listLegacy,
    listRequests: listRequests,
    readVacationSource: readVacationSource,
    readRightPanelRows: readRightPanelRows,
    detectRightPanelManualData: detectRightPanelManualData,
    migrateRightVacationTableToMainSource: migrateRightVacationTableToMainSource,
    verifySingleVacationSource: verifySingleVacationSource,
    getSourceMode: getSourceMode,
    getSourceSheetName: getSourceSheetName,
    findByFml: findByFml,
    getCurrentForFml: getCurrentForFml,
    getNextForFml: getNextForFml,
  };
})();

function readVacationSource_() {
  return VacationsRepository_.readVacationSource();
}

function migrateRightVacationTableToMainSource_() {
  return VacationsRepository_.migrateRightVacationTableToMainSource();
}

function verifySingleVacationSource_() {
  return VacationsRepository_.verifySingleVacationSource();
}

function migrateRightVacationTableFromMenu_() {
  const result = migrateRightVacationTableToMainSource_();
  const message =
    result && result.message
      ? result.message
      : "Міграцію правої таблиці завершено";
  try {
    getWasbSpreadsheet_().toast(message, "WASB", 5);
  } catch (_) {
    SpreadsheetApp.getUi().alert(message);
  }
  return result;
}

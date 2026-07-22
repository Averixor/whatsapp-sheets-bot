/**
 * VacationOptionsWriter.gs — spreadsheet I/O for vacation planner results.
 */

const VacationOptionsWriter_ = (function () {
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

  function _invalidateVacationRepositoryCache_() {
    try {
      if (
        typeof VacationsRepository_ === "object" &&
        VacationsRepository_ &&
        typeof VacationsRepository_.invalidateCache === "function"
      ) {
        VacationsRepository_.invalidateCache();
      }
    } catch (_) {}
  }

  function _fmlKey_(value) {
    if (typeof _normFml_ === "function") return _normFml_(value);
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
  }

  function _callsignKey_(value) {
    if (typeof _normCallsignKey_ === "function") {
      return _normCallsignKey_(value);
    }
    return String(value || "")
      .trim()
      .toUpperCase();
  }

  function _date_(value) {
    if (value instanceof Date && !isNaN(value.getTime())) {
      return new Date(
        value.getFullYear(),
        value.getMonth(),
        value.getDate(),
        12,
        0,
        0,
        0,
      );
    }
    if (
      typeof DateUtils_ === "object" &&
      DateUtils_ &&
      typeof DateUtils_.parseDateAny === "function"
    ) {
      return DateUtils_.parseDateAny(value);
    }
    return null;
  }

  function _vacationNumber_(value) {
    if (value === 1 || value === 2) return value;
    const text = String(value || "").toLowerCase();
    if (text === "1" || text.indexOf("перш") !== -1) return 1;
    if (text === "2" || text.indexOf("друг") !== -1) return 2;
    return 0;
  }

  function _vacationText_(number) {
    return Number(number) === 2 ? "друга відпустка" : "перша відпустка";
  }

  function _sourceVacationText_(option) {
    const code = String((option && (option.vacationType || option.type)) || "")
      .trim()
      .toUpperCase();
    if (code === "ВД") return "додаткова відпустка";
    if (code === "СО") return "сімейні обставини";
    return _vacationText_(option && option.vacationNumber);
  }

  function _vacationMarker_(item) {
    const text = String(
      (item && (item.vacationType || item.type || item.vacationNo)) || "",
    )
      .trim()
      .toLowerCase();
    if (text.indexOf("додаткова") !== -1 || text === "вд") return "ВД";
    if (text.indexOf("сімейн") !== -1 || text === "со") return "СО";
    return Number(item && item.vacationNumber) === 2 ? "В2" : "В1";
  }

  function _block_(vacationNumber) {
    const number = Number(vacationNumber);
    if (number !== 1 && number !== 2) {
      throw new Error("Номер відпустки має бути 1 або 2");
    }
    const main = VACATION_PLANNER_CONFIG.BLOCKS[0];
    return {
      key: main.key,
      label: main.label,
      startCol: main.startCol,
      vacationNumber: number,
    };
  }

  function _mainSourceRange_() {
    return (
      (VACATION_PLANNER_CONFIG && VACATION_PLANNER_CONFIG.SOURCE_RANGE) || {
        startCol: 1,
        width: 9,
        startRow: 2,
      }
    );
  }

  function _ensureSheet_(name) {
    const ss = _spreadsheet_();
    return ss.getSheetByName(name) || ss.insertSheet(name);
  }

  function _ensureSourceSheet_() {
    const sheet = _ensureSheet_(VACATION_PLANNER_CONFIG.SHEETS.SOURCE);
    const rangeCfg = _mainSourceRange_();
    const headerRange = sheet.getRange(
      1,
      rangeCfg.startCol,
      1,
      VACATION_PLANNER_CONFIG.SOURCE_HEADERS.length,
    );
    const headers = headerRange.getValues()[0];
    let changed = false;
    VACATION_PLANNER_CONFIG.SOURCE_HEADERS.forEach(function (header, index) {
      if (!String(headers[index] || "").trim()) {
        headers[index] = header;
        changed = true;
      }
    });
    if (changed) {
      headerRange.setValues([headers]);
    }
    return sheet;
  }

  function _ensureRequestsSheet_() {
    const sheet = _ensureSheet_(VACATION_PLANNER_CONFIG.SHEETS.REQUESTS);
    const headers = VACATION_PLANNER_CONFIG.REQUEST_HEADERS;
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    const current = headerRange.getValues()[0];
    let changed = false;
    headers.forEach(function (header, index) {
      const value = String(current[index] || "").trim();
      if (!value) {
        current[index] = header;
        changed = true;
        return;
      }
      if (value !== header) {
        throw new Error(
          "VACATION_REQUESTS: очікується колонка «" +
            header +
            "» у позиції " +
            (index + 1),
        );
      }
    });
    if (changed) headerRange.setValues([current]);
    headerRange.setFontWeight("bold").setBackground("#D9EAD3");
    sheet.setFrozenRows(1);
    return sheet;
  }

  function _sourceMode_() {
    if (
      typeof VacationsRepository_ !== "object" ||
      !VacationsRepository_ ||
      typeof VacationsRepository_.getSourceMode !== "function"
    ) {
      throw new Error(
        "VacationsRepository_ недоступний: запис джерела відпусток заборонено",
      );
    }
    return VacationsRepository_.getSourceMode();
  }

  function _setSourceMode_(sheetName) {
    if (
      typeof PropertiesService === "undefined" ||
      !PropertiesService ||
      typeof PropertiesService.getScriptProperties !== "function"
    ) {
      throw new Error("PropertiesService недоступний");
    }
    PropertiesService.getScriptProperties().setProperty(
      VACATION_PLANNER_CONFIG.SOURCE_MODE_PROPERTY,
      sheetName,
    );
  }

  function _uniqueRequestId_() {
    try {
      if (
        typeof Utilities !== "undefined" &&
        Utilities &&
        typeof Utilities.getUuid === "function"
      ) {
        return Utilities.getUuid();
      }
    } catch (_) {}
    return (
      "VAC-" +
      String(new Date().getTime()) +
      "-" +
      String(Math.floor(Math.random() * 1000000))
    );
  }

  function _personKeyForFml_(fml) {
    try {
      if (
        typeof PersonnelRepository_ === "object" &&
        PersonnelRepository_ &&
        typeof PersonnelRepository_.getByFml === "function"
      ) {
        const person = PersonnelRepository_.getByFml(fml, {
          activeOnly: false,
        });
        if (person) {
          return String(person.callsign || person.fml || fml || "").trim();
        }
      }
    } catch (_) {}
    return String(fml || "").trim();
  }

  function _requestStatusIsActive_(value) {
    const key = String(value || "")
      .trim()
      .toUpperCase();
    return ["PROPOSED", "APPROVED", "APPLIED"].indexOf(key) !== -1;
  }

  function _requestRowMatchesOption_(row, option, activeOnly) {
    const requestId = String((option && option.requestId) || "").trim();
    if (requestId) {
      return (
        String((row && row[0]) || "").trim() === requestId &&
        (!activeOnly || _requestStatusIsActive_((row && row[11]) || ""))
      );
    }
    const expectedType = _vacationMarker_(option);
    return (
      _fmlKey_((row && row[2]) || "") === _fmlKey_(option && option.fml) &&
      Number((row && row[4]) || 0) ===
        Number(option && option.vacationNumber) &&
      String((row && row[5]) || "")
        .trim()
        .toUpperCase() === expectedType &&
      (!activeOnly || _requestStatusIsActive_((row && row[11]) || ""))
    );
  }

  function _requestRowData_(option, existingRow, status) {
    const current = Array.isArray(existingRow) ? existingRow : [];
    const startDate = _date_(option && option.startDate);
    const endDate = _date_(option && option.endDate);
    const now = new Date();
    const notify = _hasOwn_(option, "notify")
      ? option.notify === true
      : current.length
        ? _isTrue_(current[12])
        : true;
    const travel = _hasOwn_(option, "travel")
      ? option.travel
      : current.length
        ? current[10]
        : "";
    return [
      String(current[0] || (option && option.requestId) || _uniqueRequestId_()),
      String(
        current[1] ||
          (option && option.personKey) ||
          _personKeyForFml_(option && option.fml),
      ),
      String((option && option.fml) || "").trim(),
      startDate ? startDate.getFullYear() : "",
      Number(option && option.vacationNumber) || "",
      _vacationMarker_(option),
      current[6] || startDate || "",
      startDate || "",
      endDate || "",
      Number(option && option.days) || 0,
      travel,
      status || "Approved",
      notify,
      current[13] || now,
      now,
      current[15] || "",
    ];
  }

  function _writeVacationToRequests_(option) {
    const sheet = _ensureRequestsSheet_();
    const width = VACATION_PLANNER_CONFIG.REQUEST_HEADERS.length;
    const rowCount = Math.max(sheet.getLastRow() - 1, 0);
    const rows = rowCount
      ? sheet.getRange(2, 1, rowCount, width).getValues()
      : [];
    let targetRow = 0;
    let existingRow = [];
    const requestId = String((option && option.requestId) || "").trim();
    if (requestId) {
      for (let index = 0; index < rows.length; index++) {
        if (_requestRowMatchesOption_(rows[index], option, true)) {
          targetRow = index + 2;
          existingRow = rows[index];
          break;
        }
      }
    }
    if (!targetRow && requestId) {
      throw new Error("Заявку для оновлення не знайдено");
    }
    if (!targetRow) targetRow = Math.max(sheet.getLastRow() + 1, 2);

    sheet
      .getRange(targetRow, 1, 1, width)
      .setValues([_requestRowData_(option, existingRow, "Approved")]);
    sheet.getRange(targetRow, 7, 1, 3).setNumberFormat("dd.MM.yyyy");
    _invalidateVacationRepositoryCache_();
    return {
      sheetName: sheet.getName(),
      rowNumber: targetRow,
      block: "request",
      startColumn: 1,
      requestedBlock: "request",
      formulaDriven: false,
      sourceMode: "requests",
    };
  }

  function _setRequestVacationActive_(
    fml,
    vacationNumber,
    active,
    vacationType,
    locator,
  ) {
    const sheet = _ensureRequestsSheet_();
    const width = VACATION_PLANNER_CONFIG.REQUEST_HEADERS.length;
    const rowCount = Math.max(sheet.getLastRow() - 1, 0);
    if (!rowCount) throw new Error("Відпустку для скасування не знайдено");
    const rows = sheet.getRange(2, 1, rowCount, width).getValues();
    const option = {
      fml: fml,
      vacationNumber: vacationNumber,
      vacationType: vacationType,
      requestId: locator && locator.requestId,
    };
    for (let index = 0; index < rows.length; index++) {
      if (!_requestRowMatchesOption_(rows[index], option, true)) continue;
      const rowNumber = index + 2;
      sheet
        .getRange(rowNumber, 12)
        .setValue(active === true ? "Approved" : "Cancelled");
      sheet.getRange(rowNumber, 15).setValue(new Date());
      _invalidateVacationRepositoryCache_();
      return {
        sheetName: sheet.getName(),
        rowNumber: rowNumber,
        block: "request",
        startColumn: 1,
        requestedBlock: "request",
        active: active === true,
        formulaDriven: false,
        sourceMode: "requests",
      };
    }
    throw new Error("Відпустку для скасування не знайдено");
  }

  function _resolveVacationMaterializeFn_() {
    var root = null;
    try {
      if (typeof globalThis !== "undefined") root = globalThis;
    } catch (_) {}
    if (!root) {
      try {
        root = Function("return this")();
      } catch (_) {}
    }
    if (
      root &&
      typeof root.materializeVacationComputedColumns_ === "function"
    ) {
      return root.materializeVacationComputedColumns_;
    }
    try {
      if (typeof materializeVacationComputedColumns_ === "function") {
        return materializeVacationComputedColumns_;
      }
    } catch (_) {}
    return null;
  }

  function _materializeVacationSheetIfManaged_(sheet, rowNumbers) {
    var materializeFn = _resolveVacationMaterializeFn_();
    if (!materializeFn) return null;
    var options = null;
    if (Array.isArray(rowNumbers) && rowNumbers.length) {
      options = { rows: rowNumbers };
    }
    return materializeFn(sheet, options);
  }

  function _isFormulaDrivenBlock_(sheet, block) {
    try {
      const range = sheet.getRange(
        1,
        block.startCol,
        1,
        VACATION_PLANNER_CONFIG.SOURCE_HEADERS.length,
      );
      if (typeof range.getFormulas !== "function") return false;
      const formulas = range.getFormulas()[0] || [];
      return [2, 4, 5, 6, 8].some(function (index) {
        return !!String(formulas[index] || "").trim();
      });
    } catch (_) {
      return false;
    }
  }

  function _usesPartialVacationSourceWrite_(sheet, block) {
    if (_isFormulaDrivenBlock_(sheet, block)) return true;
    return (
      typeof isVacationComputedColumnsManaged_ === "function" &&
      isVacationComputedColumnsManaged_()
    );
  }

  function _isTrue_(value) {
    if (value === true) return true;
    return (
      ["TRUE", "1", "YES", "Y", "ТАК"].indexOf(
        String(value == null ? "" : value)
          .trim()
          .toUpperCase(),
      ) !== -1
    );
  }

  function _rowMatchesOption_(row, option) {
    const expectedText = _sourceVacationText_(option).toLowerCase();
    const expectedNumber = Number(option && option.vacationNumber);
    const rowText = String((row && row[3]) || "")
      .trim()
      .toLowerCase();
    const special =
      expectedText.indexOf("додаткова") !== -1 ||
      expectedText.indexOf("сімейн") !== -1;
    return special
      ? rowText === expectedText
      : _vacationNumber_(rowText) === expectedNumber;
  }

  function _hasOwn_(object, key) {
    return !!object && Object.prototype.hasOwnProperty.call(object, key);
  }

  function _writeVacationToLegacy_(option) {
    const sheet = _ensureSourceSheet_();
    const block = _block_(option.vacationNumber);
    const rangeCfg = _mainSourceRange_();
    const startCol = rangeCfg.startCol || 1;
    const width = rangeCfg.width || 9;
    const startRow = rangeCfg.startRow || 2;
    const lastRow = Math.max(sheet.getLastRow(), startRow);
    const rowCount = Math.max(lastRow - startRow + 1, 1);
    const values = sheet
      .getRange(startRow, startCol, rowCount, width)
      .getValues();
    const targetKey = _fmlKey_(option.fml);
    let targetRow = 0;
    let existingTravel = "";

    for (let i = 0; i < values.length; i++) {
      if (
        _fmlKey_(values[i][0]) === targetKey &&
        _isTrue_(values[i][4]) &&
        _rowMatchesOption_(values[i], option)
      ) {
        targetRow = i + startRow;
        existingTravel = String(values[i][7] || "").trim();
        break;
      }
    }
    if (!targetRow) {
      for (let i = 0; i < values.length; i++) {
        if (!String(values[i][0] || "").trim()) {
          targetRow = i + startRow;
          break;
        }
      }
    }
    if (!targetRow) targetRow = lastRow + 1;

    if (_isFormulaDrivenBlock_(sheet, block)) {
      const durationAdjustment = Number(option.days) - 15;
      const travel = _hasOwn_(option, "travel")
        ? option.travel
        : isFinite(durationAdjustment)
          ? durationAdjustment
          : existingTravel;
      sheet.getRange(targetRow, startCol).setValue(option.fml);
      sheet
        .getRange(targetRow, startCol + 1)
        .setValue(_date_(option.startDate))
        .setNumberFormat("dd.MM.yyyy");
      sheet
        .getRange(targetRow, startCol + 3)
        .setValue(_sourceVacationText_(option));
      sheet.getRange(targetRow, startCol + 7).setValue(travel);
      _materializeVacationSheetIfManaged_(sheet, [targetRow]);
      _invalidateVacationRepositoryCache_();
      return {
        sheetName: sheet.getName(),
        rowNumber: targetRow,
        block: block.key,
        startColumn: startCol,
        requestedBlock: block.key,
        formulaDriven: true,
      };
    }

    const rowData = [
      option.fml,
      _date_(option.startDate),
      _date_(option.endDate),
      _sourceVacationText_(option),
      true,
      true,
      Number(option.days) || 0,
      option.travel || existingTravel,
      "OK",
    ];
    sheet.getRange(targetRow, startCol, 1, width).setValues([rowData]);
    sheet.getRange(targetRow, startCol + 1, 1, 2).setNumberFormat("dd.MM.yyyy");
    _materializeVacationSheetIfManaged_(sheet);
    _invalidateVacationRepositoryCache_();

    return {
      sheetName: sheet.getName(),
      rowNumber: targetRow,
      block: block.key,
      startColumn: startCol,
      requestedBlock: block.key,
      formulaDriven: false,
    };
  }

  function _setLegacyVacationActive_(
    fml,
    vacationNumber,
    active,
    vacationType,
  ) {
    const sheet = _ensureSourceSheet_();
    const block = _block_(vacationNumber);
    const rangeCfg = _mainSourceRange_();
    const startCol = rangeCfg.startCol || 1;
    const startRow = rangeCfg.startRow || 2;
    const rowCount = Math.max(sheet.getLastRow() - startRow + 1, 1);
    const values = sheet.getRange(startRow, startCol, rowCount, 9).getValues();
    const targetKey = _fmlKey_(fml);
    const option = {
      vacationNumber: vacationNumber,
      vacationType: vacationType,
    };
    for (let index = 0; index < values.length; index++) {
      if (
        _fmlKey_(values[index][0]) !== targetKey ||
        !_isTrue_(values[index][4]) ||
        !_rowMatchesOption_(values[index], option)
      ) {
        continue;
      }
      const rowNumber = index + startRow;
      if (_isFormulaDrivenBlock_(sheet, block)) {
        const startRange = sheet.getRange(rowNumber, startCol + 1);
        if (active === true) {
          throw new Error(
            "Для відновлення відпустки вкажіть нову дату початку",
          );
        }
        startRange.clearContent();
        _materializeVacationSheetIfManaged_(sheet, [rowNumber]);
        _invalidateVacationRepositoryCache_();
        return {
          sheetName: sheet.getName(),
          rowNumber: rowNumber,
          block: block.key,
          requestedBlock: block.key,
          active: false,
          formulaDriven: true,
        };
      }
      sheet.getRange(rowNumber, startCol + 4).setValue(active === true);
      sheet
        .getRange(rowNumber, startCol + 8)
        .setValue(active === true ? "OK" : "CANCELLED");
      _materializeVacationSheetIfManaged_(sheet);
      _invalidateVacationRepositoryCache_();
      return {
        sheetName: sheet.getName(),
        rowNumber: rowNumber,
        block: block.key,
        requestedBlock: block.key,
        active: active === true,
        formulaDriven: false,
      };
    }
    throw new Error("Відпустку для скасування не знайдено");
  }

  function writeVacationToSource(option) {
    return _sourceMode_() === "requests"
      ? _writeVacationToRequests_(option)
      : _writeVacationToLegacy_(option);
  }

  function setVacationActive(
    fml,
    vacationNumber,
    active,
    vacationType,
    locator,
  ) {
    return _sourceMode_() === "requests"
      ? _setRequestVacationActive_(
          fml,
          vacationNumber,
          active,
          vacationType,
          locator,
        )
      : _setLegacyVacationActive_(fml, vacationNumber, active, vacationType);
  }

  function migrateLegacyToRequests(options) {
    const opts = options || {};
    const dryRun = opts.dryRun !== false;
    const activate = opts.activate === true;
    const legacy = VacationsRepository_.listLegacy();
    const invalidActive = legacy.filter(function (vacation) {
      return (
        vacation.active === true &&
        (!vacation.fml ||
          !vacation.vacationNumber ||
          !vacation.startDate ||
          !vacation.endDate)
      );
    });
    if (activate && invalidActive.length) {
      throw new Error(
        "Міграцію не активовано: активних рядків з некоректними даними — " +
          invalidActive.length,
      );
    }

    const existingRequests = VacationsRepository_.listRequests();
    if (!dryRun && existingRequests.length) {
      throw new Error(
        "VACATION_REQUESTS вже містить дані. Міграція не перезаписує існуючи записи.",
      );
    }

    const now = new Date();
    const rows = legacy.map(function (vacation) {
      const startDate = _date_(vacation.startDate || vacation.startDateRaw);
      const endDate = _date_(vacation.endDate || vacation.endDateRaw);
      const comment =
        "Migrated from VACATIONS" +
        (vacation._meta
          ? " " +
            String(vacation._meta.block || "") +
            " row " +
            String(vacation._meta.rowNumber || "")
          : "");
      return [
        _uniqueRequestId_(),
        _personKeyForFml_(vacation.fml),
        vacation.fml,
        startDate ? startDate.getFullYear() : "",
        Number(vacation.vacationNumber) || "",
        _vacationMarker_(vacation),
        startDate || vacation.startDateRaw || "",
        startDate || vacation.startDateRaw || "",
        endDate || vacation.endDateRaw || "",
        Number(vacation.days) ||
          (startDate && endDate
            ? VacationPlannerService_.daysBetween(startDate, endDate) + 1
            : 0),
        vacation.travel || "",
        vacation.active === true ? "Applied" : "Cancelled",
        vacation.notify !== false,
        now,
        now,
        comment.trim(),
      ];
    });

    if (!dryRun) {
      const sheet = _ensureRequestsSheet_();
      if (rows.length) {
        sheet
          .getRange(
            2,
            1,
            rows.length,
            VACATION_PLANNER_CONFIG.REQUEST_HEADERS.length,
          )
          .setValues(rows);
        sheet.getRange(2, 7, rows.length, 3).setNumberFormat("dd.MM.yyyy");
      }
      if (activate) {
        _setSourceMode_(VACATION_PLANNER_CONFIG.SHEETS.REQUESTS);
      }
      _invalidateVacationRepositoryCache_();
    }

    return {
      dryRun: dryRun,
      activate: activate && !dryRun,
      legacyRows: legacy.length,
      requestRows: rows.length,
      invalidActiveRows: invalidActive.length,
      sourceModeAfter:
        activate && !dryRun ? "requests" : VacationsRepository_.getSourceMode(),
      affectedSheets: dryRun ? [] : [VACATION_PLANNER_CONFIG.SHEETS.REQUESTS],
    };
  }

  function switchSourceMode(mode) {
    const key = String(mode || "")
      .trim()
      .toUpperCase();
    const requestsName = VACATION_PLANNER_CONFIG.SHEETS.REQUESTS;
    const legacyName = VACATION_PLANNER_CONFIG.SHEETS.SOURCE;
    const useRequests = key === "REQUESTS" || key === requestsName;
    const targetName = useRequests ? requestsName : legacyName;
    const sheet = _spreadsheet_().getSheetByName(targetName);
    if (!sheet) throw new Error("Аркуш " + targetName + " не знайдено");
    if (
      useRequests &&
      !VacationsRepository_.listRequests({ required: true }).length
    ) {
      throw new Error("VACATION_REQUESTS не містить записів");
    }
    _setSourceMode_(targetName);
    return {
      sourceMode: useRequests ? "requests" : "legacy",
      sourceSheet: targetName,
    };
  }

  function _dateOrdinal_(value) {
    const date = _date_(value);
    if (!date) return null;
    return (
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000
    );
  }

  function buildVacationScheduleYearRange_(year) {
    const y = Number(year);
    if (!y || y < 1900 || y > 9999) {
      throw new Error("Некоректний рік графіка: " + year);
    }
    return {
      year: y,
      startDate: new Date(y, 0, 1, 12, 0, 0, 0),
      endDate: new Date(y, 11, 31, 12, 0, 0, 0),
      shortTitle: "Графік відпусток на " + y + " рік",
      title: "Графік відпусток: 01.01." + y + " – 31.12." + y,
    };
  }

  function resolveScheduleYear_(options) {
    const direct = Number(options && options.year);
    if (direct >= 1900 && direct <= 9999) return direct;
    try {
      const stored = Number(
        PropertiesService.getScriptProperties().getProperty(
          "WASB_VACATION_SCHEDULE_YEAR",
        ),
      );
      if (stored >= 1900 && stored <= 9999) return stored;
    } catch (_) {}
    return new Date().getFullYear();
  }

  function _persistScheduleYear_(year) {
    try {
      PropertiesService.getScriptProperties().setProperty(
        "WASB_VACATION_SCHEDULE_YEAR",
        String(year),
      );
    } catch (_) {}
  }

  function _vacationOverlapsYear_(item, year) {
    const start = _date_(item.startDate);
    const end = _date_(item.endDate);
    if (!start || !end) return false;
    const yearRange = buildVacationScheduleYearRange_(year);
    return (
      _dateOrdinal_(start) <= _dateOrdinal_(yearRange.endDate) &&
      _dateOrdinal_(end) >= _dateOrdinal_(yearRange.startDate)
    );
  }

  function _dateKey_(value) {
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
      return value.trim();
    }
    const date = _date_(value);
    if (!date) return "";
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return date.getFullYear() + "-" + month + "-" + day;
  }

  function buildScheduleCalendar(schedule, options) {
    const year = resolveScheduleYear_(options || {});
    const yearRange = buildVacationScheduleYearRange_(year);
    const minOrdinal = _dateOrdinal_(yearRange.startDate);
    const maxOrdinal = _dateOrdinal_(yearRange.endDate);
    const list = (Array.isArray(schedule) ? schedule : []).filter(
      function (item) {
        return (
          item &&
          _date_(item.startDate) &&
          _date_(item.endDate) &&
          _vacationOverlapsYear_(item, year)
        );
      },
    );

    const dates = [];
    for (let ordinal = minOrdinal; ordinal <= maxOrdinal; ordinal++) {
      const utc = new Date(ordinal * 86400000);
      dates.push(
        new Date(
          utc.getUTCFullYear(),
          utc.getUTCMonth(),
          utc.getUTCDate(),
          12,
          0,
          0,
          0,
        ),
      );
    }

    const people = {};
    list.forEach(function (item) {
      const key = _fmlKey_(item.fml);
      if (!people[key]) {
        people[key] = {
          fml: item.fml,
          quantity: 0,
          cells: Array(dates.length).fill(""),
        };
      }
      const marker = _vacationMarker_(item);
      const start = Math.max(_dateOrdinal_(item.startDate), minOrdinal);
      const end = Math.min(_dateOrdinal_(item.endDate), maxOrdinal);
      people[key].quantity += Number(item.days) || end - start + 1;
      for (let ordinal = start; ordinal <= end; ordinal++) {
        const index = ordinal - minOrdinal;
        const current = people[key].cells[index];
        people[key].cells[index] =
          current && current !== marker ? current + "/" + marker : marker;
      }
    });

    const rows = [["QUANTITY", "FML"].concat(dates)];
    Object.keys(people)
      .map(function (key) {
        return people[key];
      })
      .sort(function (a, b) {
        return String(a.fml).localeCompare(String(b.fml), "uk");
      })
      .forEach(function (person) {
        rows.push([person.quantity, person.fml].concat(person.cells));
      });
    return {
      rows: rows,
      dateCount: dates.length,
      personCount: rows.length - 1,
      year: year,
      startDate: yearRange.startDate,
      endDate: yearRange.endDate,
      shortTitle: yearRange.shortTitle,
      title: yearRange.title,
      headerRow: 1,
      dataStartRow: 2,
    };
  }

  function _ensureGridSize_(sheet, rowCount, columnCount) {
    const maxRows = sheet.getMaxRows();
    const maxColumns = sheet.getMaxColumns();
    if (maxRows < rowCount) sheet.insertRowsAfter(maxRows, rowCount - maxRows);
    if (maxColumns < columnCount) {
      sheet.insertColumnsAfter(maxColumns, columnCount - maxColumns);
    }
  }

  function _sheetCellKey_(value) {
    if (value instanceof Date && !isNaN(value.getTime())) {
      return "d:" + value.getTime();
    }
    if (typeof value === "boolean") {
      return value ? "1" : "0";
    }
    if (typeof value === "number" && isFinite(value)) {
      return "n:" + value;
    }
    return String(value == null ? "" : value).trim();
  }

  function _sheetRowsEqual_(left, right) {
    const a = Array.isArray(left) ? left : [];
    const b = Array.isArray(right) ? right : [];
    if (a.length !== b.length) return false;
    for (let r = 0; r < a.length; r++) {
      const leftRow = a[r] || [];
      const rightRow = b[r] || [];
      if (leftRow.length !== rightRow.length) return false;
      for (let c = 0; c < leftRow.length; c++) {
        if (_sheetCellKey_(leftRow[c]) !== _sheetCellKey_(rightRow[c])) {
          return false;
        }
      }
    }
    return true;
  }

  function _readSheetRowsIfSized_(sheet, rowCount, columnCount) {
    if (!sheet || rowCount < 1 || columnCount < 1) return null;
    if (sheet.getLastRow() < rowCount || sheet.getLastColumn() < columnCount) {
      return null;
    }
    try {
      return sheet.getRange(1, 1, rowCount, columnCount).getValues();
    } catch (_) {
      return null;
    }
  }

  function _monthlyScheduleSheetNames_() {
    const names = [];
    for (let month = 1; month <= 12; month++) {
      names.push((month < 10 ? "0" : "") + month);
    }
    return names;
  }

  function _scheduleCellColor_(value) {
    const text = String(value || "").trim();
    if (!text) return "#FFFFFF";
    if (text.indexOf("/") !== -1) return "#F4CCCC";
    if (text === "В1") return "#D9EAD3";
    if (text === "В2") return "#CFE2F3";
    if (text === "ВД") return "#FCE5CD";
    if (text === "СО") return "#EADCF8";
    return "#D9EAD3";
  }

  function _formatScheduleCalendar_(sheet, calendar) {
    const dateCount = calendar.dateCount;
    const dataRowCount = calendar.personCount;
    const dataStartRow = calendar.dataStartRow || 2;
    if (!dateCount || dataRowCount <= 0) return;

    const dataRange = sheet.getRange(dataStartRow, 3, dataRowCount, dateCount);
    const values = dataRange.getDisplayValues();
    const backgrounds = values.map(function (row) {
      return row.map(_scheduleCellColor_);
    });
    dataRange.setBackgrounds(backgrounds);
  }

  function _applyMonthSeparators_(sheet, calendar) {
    const dateCount = calendar.dateCount;
    const headerRow = calendar.headerRow || 1;
    const rowSpan = calendar.personCount + 1;
    if (!dateCount || rowSpan <= 0) return;

    const headerValues = sheet
      .getRange(headerRow, 3, 1, dateCount)
      .getValues()[0];
    for (let index = 0; index < headerValues.length - 1; index++) {
      const current = headerValues[index];
      const next = headerValues[index + 1];
      if (!(current instanceof Date) || !(next instanceof Date)) continue;

      const isMonthEnd =
        current.getMonth() !== next.getMonth() ||
        current.getFullYear() !== next.getFullYear();
      if (!isMonthEnd) continue;

      const column = 3 + index;
      sheet
        .getRange(headerRow, column, rowSpan, 1)
        .setBorder(
          null,
          null,
          null,
          true,
          null,
          null,
          "#000000",
          SpreadsheetApp.BorderStyle.SOLID_MEDIUM,
        );
    }
  }

  function _writeSchedule_(schedule, options) {
    const opts = options || {};
    const year = resolveScheduleYear_(opts);
    _persistScheduleYear_(year);
    const sheet = _ensureSheet_(VACATION_PLANNER_CONFIG.SHEETS.SCHEDULE);
    const calendar = buildScheduleCalendar(schedule, { year: year });
    const titleRow = [calendar.shortTitle];
    while (titleRow.length < calendar.rows[0].length) titleRow.push("");
    const rows = [titleRow].concat(calendar.rows);
    calendar.titleRow = 1;
    calendar.headerRow = 2;
    calendar.dataStartRow = 3;
    const width = rows[0].length;
    _ensureGridSize_(sheet, rows.length, width);

    const existingRows = _readSheetRowsIfSized_(sheet, rows.length, width);
    if (opts.skipUnchanged !== false && _sheetRowsEqual_(existingRows, rows)) {
      calendar.skippedWrite = true;
      calendar.skipReason = "schedule_unchanged";
      return calendar;
    }

    return preserveUserConditionalFormatRules_(
      sheet,
      function () {
        sheet.clear();
        sheet.getRange(1, 1, rows.length, width).setValues(rows);
        sheet.getRange(1, 1, 1, width).setFontWeight("bold");
        sheet
          .getRange(2, 1, 1, width)
          .setFontWeight("bold")
          .setBackground("#D9EAD3");
        sheet.setFrozenRows(2);
        sheet.setFrozenColumns(2);
        if (calendar.dateCount) {
          sheet
            .getRange(2, 3, 1, calendar.dateCount)
            .setNumberFormat("dd.MM.yy");
          sheet.setColumnWidths(3, calendar.dateCount, 42);
        }
        _formatScheduleCalendar_(sheet, calendar);
        _applyMonthSeparators_(sheet, calendar);
        sheet.autoResizeColumns(1, 2);
        return calendar;
      },
      { defaultMovePolicy: "RemapWithVacationCalendar" },
    );
  }

  const VACATION_RULE_HUMAN_LABELS = {
    GAP_TOO_SHORT: "Замалий інтервал між відпустками",
    PERSON_GAP: "Замалий інтервал між відпустками",
    PERSON_OVERLAP: "Відпустки однієї людини перетинаються",
    START_TOO_CLOSE: "Дати початку занадто близько",
    START_GAP: "Дати початку занадто близько",
    MIN_PERSON_YEAR: "Немає відпустки у році",
    YEAR_LIMIT: "Забагато відпусток у році",
    MAX_PERSON_YEAR: "Забагато відпусток у році",
    MAX_CONCURRENT: "Забагато людей одночасно у відпустці",
    INVALID_DATE: "Некоректна дата",
    INVALID_DURATION: "Некоректна тривалість",
    PERSONNEL_VACATION_WITHOUT_PLAN: "Статус особового складу не підтверджений планом",
    MONTHLY_VACATION_WITHOUT_PLAN:
      "Код у місячному графіку не підтверджений планом",
    PLAN_WITHOUT_MONTHLY_VACATION: "План не відображений у місячному графіку",
    HIGH_LOAD_PERIOD: "Період на межі допустимого навантаження",
    MONTH_BALANCE: "Перекіс стартів відпусток у місяці",
    RIGHT_PANEL_LEGACY_DATA: "Дані у правій таблиці K:Q (не джерело істини)",
  };

  const VACATION_RULE_SUMMARY_PHRASE = {
    GAP_TOO_SHORT: "замалим інтервалом між відпустками",
    PERSON_GAP: "замалим інтервалом між відпустками",
    PERSON_OVERLAP: "перетином відпусток однієї людини",
    START_TOO_CLOSE: "занадто близькими датами початку",
    START_GAP: "занадто близькими датами початку",
    MIN_PERSON_YEAR: "відсутністю відпустки у році",
    YEAR_LIMIT: "забагато відпусток у році",
    MAX_PERSON_YEAR: "забагато відпусток у році",
    MAX_CONCURRENT: "одночасною кількістю людей у відпустці",
    INVALID_DATE: "некоректними датами",
    INVALID_DURATION: "некоректною тривалістю",
    PERSONNEL_VACATION_WITHOUT_PLAN: "неузгодженим статусом особового складу",
    MONTHLY_VACATION_WITHOUT_PLAN: "кодом «Відпус» без плану",
    PLAN_WITHOUT_MONTHLY_VACATION: "планом без коду «Відпус»",
    HIGH_LOAD_PERIOD: "граничним навантаженням періоду",
    MONTH_BALANCE: "перекосом стартів у місяці",
  };

  function _humanRuleLabel_(code) {
    const key = String(code || "").trim();
    return VACATION_RULE_HUMAN_LABELS[key] || key || "Проблема";
  }

  function _groupProblemsByLabel_(errors) {
    const byLabel = {};
    (Array.isArray(errors) ? errors : []).forEach(function (item) {
      const label = _humanRuleLabel_(item.rule || item.type);
      byLabel[label] = (byLabel[label] || 0) + 1;
    });
    return byLabel;
  }

  function _buildProblemSummaryLine_(errors) {
    const list = Array.isArray(errors) ? errors : [];
    if (!list.length) return "";
    const labels = list.map(function (item) {
      return _humanRuleLabel_(item.rule || item.type);
    });
    const uniqueLabels = labels.filter(function (value, index, array) {
      return array.indexOf(value) === index;
    });
    if (uniqueLabels.length !== 1) return "";
    const phrases = list
      .map(function (item) {
        return VACATION_RULE_SUMMARY_PHRASE[item.rule || item.type];
      })
      .filter(Boolean);
    const uniquePhrases = phrases.filter(function (value, index, array) {
      return array.indexOf(value) === index;
    });
    if (uniquePhrases.length === 1) {
      return "Усі пов'язані із " + uniquePhrases[0] + ".";
    }
    return "Усі пов'язані з: " + String(uniqueLabels[0]).toLowerCase() + ".";
  }

  function _formatVacationReportSummary_(scheduleRows, problems) {
    const byLabel = _groupProblemsByLabel_(problems);
    const labels = Object.keys(byLabel).sort();
    const lines = [
      "🏖️ Графік відпусток",
      "",
      "Активних відпусток: " + scheduleRows,
    ];
    if (!problems.length) {
      lines.push("", "Графік відповідає обмеженням підрозділу.");
      return lines.join("\n");
    }
    lines.push("", "⚠️ Проблемні питання: " + problems.length);
    labels.forEach(function (label) {
      lines.push("• " + label + " — " + byLabel[label]);
    });
    lines.push(
      "",
      "Деталі та варіанти вирішення доступні в розділі «Проблемні питання».",
    );
    return lines.join("\n");
  }

  function _summarizeAuditProblems_(audit) {
    const problems = (audit.checks || []).filter(function (item) {
      return item.severity !== "OK";
    });
    const errors = problems.filter(function (item) {
      return item.severity === "ERROR";
    });
    const warnings = problems.filter(function (item) {
      return item.severity === "WARNING";
    });
    const byLabel = _groupProblemsByLabel_(problems);
    const items = Object.keys(byLabel)
      .sort()
      .map(function (label) {
        return { label: label, count: byLabel[label] };
      });
    return {
      errorCount: errors.length,
      warningCount: warnings.length,
      problemCount: problems.length,
      scheduleRows: (audit.schedule || []).length,
      byLabel: byLabel,
      items: items,
      summaryLine: _buildProblemSummaryLine_(problems),
    };
  }

  function _readCachedChecks_() {
    const sheet = _spreadsheet_().getSheetByName(
      VACATION_PLANNER_CONFIG.SHEETS.CHECK,
    );
    if (!sheet || sheet.getLastRow() < 2) return [];

    const lastRow = sheet.getLastRow();
    const values = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
    const checks = [];

    values.forEach(function (row) {
      const severity = String(row[4] || "")
        .trim()
        .toUpperCase();
      const typeLabel = String(row[1] || "").trim();
      if (!typeLabel || severity === "OK" || typeLabel === "ALL_RULES") return;
      checks.push({
        rule: typeLabel,
        severity: severity,
        fml: String(row[2] || "").trim(),
        date: String(row[0] || "").trim(),
        details: String(row[3] || "").trim(),
      });
    });

    return checks;
  }

  function summarizeVacationProblemsFromCache_() {
    const checks = _readCachedChecks_();
    if (!checks.length) return null;
    return _summarizeAuditProblems_({ checks: checks, schedule: [] });
  }

  function summarizeVacationProblems() {
    return _summarizeAuditProblems_(_loadAudit_());
  }

  function normalizeChecks(checks) {
    return (Array.isArray(checks) ? checks : []).map(function (item) {
      const rule = String((item && item.rule) || "").trim();
      return {
        date: item.date || "",
        type: rule,
        label: _humanRuleLabel_(rule),
        fml: item.fml || "",
        description: item.details || "",
        severity: item.severity || "ERROR",
      };
    });
  }

  function _extractProblemDates_(problem) {
    return (
      String((problem && problem.date) || "").match(/\d{4}-\d{2}-\d{2}/g) || []
    );
  }

  function _splitProblemFml_(value) {
    return String(value || "")
      .split(/\s*(?:\/|,)\s*/)
      .map(function (item) {
        return item.trim();
      })
      .filter(Boolean);
  }

  function _findProblemScheduleItem_(problem, schedule) {
    const list = Array.isArray(schedule) ? schedule : [];
    const people = _splitProblemFml_(problem && problem.fml);
    const dates = _extractProblemDates_(problem);
    const peopleKeys = people.map(_fmlKey_);

    const matches = list.filter(function (item) {
      const fmlMatches =
        !peopleKeys.length || peopleKeys.indexOf(_fmlKey_(item.fml)) !== -1;
      if (!fmlMatches) return false;
      if (!dates.length) return true;
      const start = _dateKey_(item.startDate);
      const end = _dateKey_(item.endDate);
      return dates.indexOf(start) !== -1 || dates.indexOf(end) !== -1;
    });

    if (matches.length) return matches[0];
    if (!peopleKeys.length) return null;
    return (
      list.filter(function (item) {
        return peopleKeys.indexOf(_fmlKey_(item.fml)) !== -1;
      })[0] || null
    );
  }

  function normalizeProblems(checks, schedule) {
    const problems = (Array.isArray(checks) ? checks : []).map(function (item) {
      const type = String((item && (item.rule || item.type)) || "").trim();
      const match = _findProblemScheduleItem_(item, schedule);
      const startDate =
        _dateKey_(item && item.startDate) ||
        _dateKey_(match && match.startDate);
      const endDate =
        _dateKey_(item && item.endDate) || _dateKey_(match && match.endDate);
      const days = Number((item && item.days) || (match && match.days)) || "";
      return {
        date: (item && item.date) || startDate || "",
        type: type || String((item && item.rule) || "").trim(),
        rule: type || "",
        fml: (item && item.fml) || "",
        primaryFml:
          (match && match.fml) || _splitProblemFml_(item && item.fml)[0] || "",
        description:
          (item && (item.details || item.message || item.description)) || "",
        details:
          (item && (item.details || item.message || item.description)) || "",
        severity: (item && item.severity) || "ERROR",
        vacationNumber:
          Number(
            (item && item.vacationNumber) || (match && match.vacationNumber),
          ) || "",
        startDate: startDate,
        endDate: endDate,
        days: days,
        sourceRow: (item && item.sourceRow) || (match && match.sourceRow) || "",
        sourceStartColumn:
          (item && item.sourceStartColumn) ||
          (match && match.sourceStartColumn) ||
          "",
      };
    });
    if (
      typeof VacationSuggestions_ === "object" &&
      VacationSuggestions_ &&
      typeof VacationSuggestions_.attachSuggestionsToProblems_ === "function"
    ) {
      const context = VacationSuggestions_.buildSuggestionContext_(
        schedule,
        null,
      );
      return VacationSuggestions_.attachSuggestionsToProblems_(
        problems,
        context,
      );
    }
    return problems;
  }

  function _writeChecks_(checks, options) {
    const opts = options || {};
    const sheet = _ensureSheet_(VACATION_PLANNER_CONFIG.SHEETS.CHECK);
    const headers = ["Date", "Type", "FML", "Description", "Severity"];
    const rows = [headers];
    if (!checks.length) {
      rows.push(["", "ALL_RULES", "", "Порушень не знайдено", "OK"]);
    } else {
      normalizeChecks(checks).forEach(function (item) {
        rows.push([
          item.date,
          item.label,
          item.fml,
          item.description,
          item.severity,
        ]);
      });
    }

    const existingRows = _readSheetRowsIfSized_(
      sheet,
      rows.length,
      headers.length,
    );
    if (opts.skipUnchanged !== false && _sheetRowsEqual_(existingRows, rows)) {
      return { skippedWrite: true, skipReason: "checks_unchanged", rowCount: rows.length };
    }

    return preserveUserConditionalFormatRules_(
      sheet,
      function () {
        sheet.clear();
        sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
        sheet
          .getRange(1, 1, 1, headers.length)
          .setFontWeight("bold")
          .setBackground("#FCE8B2");
        sheet.setFrozenRows(1);
        sheet.autoResizeColumns(1, headers.length);
        sheet.setColumnWidth(4, 420);
      },
      { defaultMovePolicy: "RemapWithSheet" },
    );
  }

  function _collectPersonnelRows_() {
    try {
      if (
        typeof PersonnelRepository_ === "object" &&
        PersonnelRepository_ &&
        typeof PersonnelRepository_.getRows === "function"
      ) {
        return PersonnelRepository_.getRows();
      }
    } catch (_) {}
    return [];
  }

  function _collectMonthlyVacationFacts_(options) {
    const opts = options || {};
    const ss = _spreadsheet_();
    if (!ss || typeof ss.getSheets !== "function") return [];
    if (typeof detectMonthlyLayoutFromSheet_ !== "function") return [];

    let personnelByCallsign = {};
    try {
      if (typeof getPersonnelMapByCallsignAll_ === "function") {
        personnelByCallsign = getPersonnelMapByCallsignAll_() || {};
      }
    } catch (_) {}

    const facts = [];
    const monthSheetNames = _monthlyScheduleSheetNames_();
    monthSheetNames.forEach(function (sheetName) {
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) return;

      let layout = null;
      try {
        layout = detectMonthlyLayoutFromSheet_(sheet);
      } catch (_) {}
      if (!layout || !layout.matrix || !layout.fields) return;

      const matrix = layout.matrix;
      const rowCount = matrix.endRow - matrix.startRow + 1;
      const colCount = matrix.endCol - matrix.startCol + 1;
      if (rowCount < 1 || colCount < 1) return;

      const codes = sheet
        .getRange(matrix.startRow, matrix.startCol, rowCount, colCount)
        .getDisplayValues();
      const callsigns = sheet
        .getRange(matrix.startRow, layout.fields.callsign, rowCount, 1)
        .getDisplayValues();
      const dateRow =
        typeof CONFIG === "object" && CONFIG && CONFIG.DATE_ROW
          ? Number(CONFIG.DATE_ROW) || 1
          : 1;
      const dateRange = sheet.getRange(dateRow, matrix.startCol, 1, colCount);
      const dateValues = dateRange.getValues()[0];
      const dateDisplays = dateRange.getDisplayValues()[0];

      let monthlyFmls = [];
      const fmlCol = Number(layout.fields.fml) || 0;
      if (fmlCol > 0) {
        monthlyFmls = sheet
          .getRange(matrix.startRow, fmlCol, rowCount, 1)
          .getDisplayValues();
      }

      for (let colIndex = 0; colIndex < colCount; colIndex++) {
        const date =
          _date_(dateValues[colIndex]) || _date_(dateDisplays[colIndex]);
        if (!date) continue;
        for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
          const callsign = String((callsigns[rowIndex] || [])[0] || "").trim();
          if (!callsign) continue;
          const personnel =
            personnelByCallsign[_callsignKey_(callsign)] || null;
          const monthlyFml = String(
            (monthlyFmls[rowIndex] || [])[0] || "",
          ).trim();
          facts.push({
            personKey: callsign,
            fml:
              (personnel && String(personnel.fml || "").trim()) ||
              monthlyFml ||
              callsign,
            callsign: callsign,
            date: date,
            code: String((codes[rowIndex] || [])[colIndex] || "").trim(),
            sheetName: sheet.getName(),
            rowNumber: matrix.startRow + rowIndex,
            columnNumber: matrix.startCol + colIndex,
          });
        }
      }
    });
    return facts;
  }

  function _loadAudit_(options) {
    const allVacations = VacationsRepository_.listAll();
    const audit = VacationPlannerService_.buildScheduleAudit(allVacations);
    const consistencyChecks = VacationPlannerService_.buildConsistencyAudit(
      allVacations,
      _collectPersonnelRows_(),
      _collectMonthlyVacationFacts_(options),
      new Date(),
    );
    audit.checks = audit.checks.concat(consistencyChecks);
    if (typeof VacationsRepository_.detectRightPanelManualData === "function") {
      const rightPanel = VacationsRepository_.detectRightPanelManualData();
      if (rightPanel && rightPanel.hasData) {
        audit.checks.push({
          rule: "RIGHT_PANEL_LEGACY_DATA",
          severity: "WARNING",
          fml: rightPanel.fmlSummary || "—",
          date: "",
          description: rightPanel.message || "",
        });
      }
    }
    return audit;
  }

  function rebuildVacationSystem(options) {
    const opts = options || {};
    const year = resolveScheduleYear_(opts);
    const writeOpts = { skipUnchanged: opts.skipUnchanged !== false };
    const audit = _loadAudit_(opts);
    const calendar = _writeSchedule_(audit.schedule, Object.assign({ year: year }, writeOpts));
    const checksWrite = _writeChecks_(audit.checks, writeOpts);
    const problemSummary = _summarizeAuditProblems_(audit);
    const affectedSheets = [];
    if (!calendar.skippedWrite) {
      affectedSheets.push(VACATION_PLANNER_CONFIG.SHEETS.SCHEDULE);
    }
    if (!checksWrite || !checksWrite.skippedWrite) {
      affectedSheets.push(VACATION_PLANNER_CONFIG.SHEETS.CHECK);
    }
    return {
      scheduleYear: year,
      scheduleTitle: calendar.shortTitle || calendar.title || "",
      scheduleRows: audit.schedule.length,
      schedulePeople: calendar.personCount,
      scheduleDays: calendar.dateCount,
      scheduleSkipped: calendar.skippedWrite === true,
      checksSkipped: !!(checksWrite && checksWrite.skippedWrite),
      checkRows: audit.checks.length,
      errorCount: problemSummary.errorCount,
      warningCount: problemSummary.warningCount,
      problemCount: problemSummary.problemCount,
      affectedSheets: affectedSheets,
      checks: normalizeProblems(audit.checks, audit.schedule),
      problemSummary: problemSummary,
    };
  }

  function checkVacationScheduleOnly() {
    const audit = _loadAudit_();
    _writeChecks_(audit.checks);
    const problemSummary = _summarizeAuditProblems_(audit);
    return {
      scheduleRows: audit.schedule.length,
      checkRows: audit.checks.length,
      errorCount: problemSummary.errorCount,
      warningCount: problemSummary.warningCount,
      problemCount: problemSummary.problemCount,
      affectedSheets: [VACATION_PLANNER_CONFIG.SHEETS.CHECK],
      checks: normalizeProblems(audit.checks, audit.schedule),
      problemSummary: problemSummary,
    };
  }

  function highlightVacationProblems() {
    const result = checkVacationScheduleOnly();
    const sheet = _spreadsheet_().getSheetByName(
      VACATION_PLANNER_CONFIG.SHEETS.CHECK,
    );
    if (!sheet || sheet.getLastRow() < 2) return result;

    const lastRow = sheet.getLastRow();
    const width = 5;
    const backgrounds = [];
    const values = sheet.getRange(2, 1, lastRow - 1, width).getValues();
    values.forEach(function (row) {
      const severity = String(row[4] || "")
        .trim()
        .toUpperCase();
      const color =
        severity === "ERROR"
          ? "#F4CCCC"
          : severity === "OK"
            ? "#D9EAD3"
            : "#FFF2CC";
      backgrounds.push(Array(width).fill(color));
    });
    if (backgrounds.length) {
      sheet
        .getRange(2, 1, backgrounds.length, width)
        .setBackgrounds(backgrounds);
    }
    return result;
  }

  function generateVacationReport() {
    const audit = _loadAudit_();
    const problemSummary = _summarizeAuditProblems_(audit);
    return {
      summary: _formatVacationReportSummary_(
        audit.schedule.length,
        audit.checks,
      ),
      scheduleRows: audit.schedule.length,
      errorCount: problemSummary.errorCount,
      warningCount: problemSummary.warningCount,
      problemCount: problemSummary.problemCount,
      checks: normalizeProblems(audit.checks, audit.schedule),
      problemSummary: problemSummary,
      adminSheet: VACATION_PLANNER_CONFIG.SHEETS.CHECK,
    };
  }

  return {
    writeVacationToSource: writeVacationToSource,
    setVacationActive: setVacationActive,
    buildScheduleCalendar: buildScheduleCalendar,
    buildVacationScheduleYearRange_: buildVacationScheduleYearRange_,
    resolveScheduleYear: resolveScheduleYear_,
    normalizeChecks: normalizeChecks,
    normalizeProblems: normalizeProblems,
    summarizeVacationProblems: summarizeVacationProblems,
    summarizeVacationProblemsFromCache_: summarizeVacationProblemsFromCache_,
    humanRuleLabel: _humanRuleLabel_,
    rebuildVacationSystem: rebuildVacationSystem,
    checkVacationScheduleOnly: checkVacationScheduleOnly,
    highlightVacationProblems: highlightVacationProblems,
    generateVacationReport: generateVacationReport,
    migrateLegacyToRequests: migrateLegacyToRequests,
    switchSourceMode: switchSourceMode,
  };
})();

function buildVacationScheduleYearRange_(year) {
  return VacationOptionsWriter_.buildVacationScheduleYearRange_(year);
}

function migrateVacationsToRequests(options) {
  if (typeof _stage7AssertRole_ !== "function") {
    throw new Error("Перевірка ролі недоступна: міграцію заборонено");
  }
  _stage7AssertRole_("sysadmin", "migrate vacations to VACATION_REQUESTS");
  return _withVacationMigrationLock_(function () {
    return VacationOptionsWriter_.migrateLegacyToRequests(options || {});
  });
}

function previewVacationRequestsMigration() {
  return migrateVacationsToRequests({ dryRun: true, activate: false });
}

function applyVacationRequestsMigration() {
  return migrateVacationsToRequests({ dryRun: false, activate: true });
}

function rollbackVacationRequestsToLegacy() {
  if (typeof _stage7AssertRole_ !== "function") {
    throw new Error("Перевірка ролі недоступна: перемикання заборонено");
  }
  _stage7AssertRole_("sysadmin", "rollback vacations to VACATIONS");
  return _withVacationMigrationLock_(function () {
    return VacationOptionsWriter_.switchSourceMode("legacy");
  });
}

function _withVacationMigrationLock_(callback) {
  if (
    typeof LockService === "undefined" ||
    !LockService ||
    typeof LockService.getDocumentLock !== "function"
  ) {
    throw new Error("Document lock недоступний: міграцію заборонено");
  }
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    return callback();
  } finally {
    lock.releaseLock();
  }
}

/**
 * VacationOptionsWriter.gs — spreadsheet I/O for vacation planner results.
 */

const VacationOptionsWriter_ = (function () {
  const OPTIONS_HEADERS = [
    "Rank",
    "FML",
    "Vacation №",
    "Start date",
    "End date",
    "Days",
    "Score",
    "Status",
    "Explanation",
    "Apply",
  ];

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

  function _fmlKey_(value) {
    if (typeof _normFml_ === "function") return _normFml_(value);
    return String(value || "")
      .replace(/\s+/g, " ")
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
    const code = String(
      (option && (option.vacationType || option.type)) || "",
    )
      .trim()
      .toUpperCase();
    if (code === "ВД") return "додаткова відпустка";
    if (code === "СО") return "сімейні обставини";
    return _vacationText_(option && option.vacationNumber);
  }

  function _vacationMarker_(item) {
    const text = String((item && item.vacationType) || "")
      .trim()
      .toLowerCase();
    if (text.indexOf("додатк") !== -1 || text === "вд") return "ВД";
    if (text.indexOf("сімейн") !== -1 || text === "со") return "СО";
    return Number(item && item.vacationNumber) === 2 ? "В2" : "В1";
  }

  function _block_(vacationNumber) {
    const number = Number(vacationNumber);
    const match = VACATION_PLANNER_CONFIG.BLOCKS.filter(function (block) {
      return block.vacationNumber === number;
    })[0];
    if (!match) throw new Error("Номер відпустки має бути 1 або 2");
    return match;
  }

  function _ensureSheet_(name) {
    const ss = _spreadsheet_();
    return ss.getSheetByName(name) || ss.insertSheet(name);
  }

  function _ensureSourceSheet_() {
    const sheet = _ensureSheet_(VACATION_PLANNER_CONFIG.SHEETS.SOURCE);
    VACATION_PLANNER_CONFIG.BLOCKS.forEach(function (block) {
      const headerRange = sheet.getRange(
        1,
        block.startCol,
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
    });
    return sheet;
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

  function _hasFormulaInputs_(sheet, block) {
    try {
      const range = sheet.getRange(
        1,
        block.startCol,
        1,
        VACATION_PLANNER_CONFIG.SOURCE_HEADERS.length,
      );
      if (typeof range.getFormulas !== "function") return false;
      const formulas = range.getFormulas()[0] || [];
      return [0, 1, 3].some(function (index) {
        return !!String(formulas[index] || "").trim();
      });
    } catch (_) {
      return false;
    }
  }

  function _writableBlock_(sheet, preferredBlock) {
    if (!_hasFormulaInputs_(sheet, preferredBlock)) return preferredBlock;
    const fallback = VACATION_PLANNER_CONFIG.BLOCKS.filter(function (block) {
      return !_hasFormulaInputs_(sheet, block);
    })[0];
    if (!fallback) {
      throw new Error("У VACATIONS немає доступного для запису блоку");
    }
    return fallback;
  }

  function _isTrue_(value) {
    if (value === true) return true;
    return ["TRUE", "1", "YES", "Y", "ТАК"].indexOf(
      String(value == null ? "" : value)
        .trim()
        .toUpperCase(),
    ) !== -1;
  }

  function _rowMatchesOption_(row, option) {
    const expectedText = _sourceVacationText_(option).toLowerCase();
    const expectedNumber = Number(option && option.vacationNumber);
    const rowText = String((row && row[3]) || "")
      .trim()
      .toLowerCase();
    const special =
      expectedText.indexOf("додатк") !== -1 ||
      expectedText.indexOf("сімейн") !== -1;
    return special
      ? rowText === expectedText
      : _vacationNumber_(rowText) === expectedNumber;
  }

  function _hasOwn_(object, key) {
    return !!object && Object.prototype.hasOwnProperty.call(object, key);
  }

  function writeVacationOptions(options) {
    const list = Array.isArray(options) ? options : [];
    const sheet = _ensureSheet_(VACATION_PLANNER_CONFIG.SHEETS.OPTIONS);
    sheet.clear();

    const rows = [OPTIONS_HEADERS.slice()];
    list.forEach(function (option) {
      const rejected = option.status === "REJECTED";
      rows.push([
        option.rank || 0,
        option.fml || "",
        _vacationText_(option.vacationNumber),
        _date_(option.startDate) || "",
        _date_(option.endDate) || "",
        Number(option.days) || 0,
        Number(option.score) || 0,
        rejected
          ? "Відхилено"
          : Number(option.rank) === 1
            ? "Кращий"
            : "Допустимий",
        option.explanation || "",
        false,
      ]);
    });

    sheet.getRange(1, 1, rows.length, OPTIONS_HEADERS.length).setValues(rows);
    _formatOptionsSheet_(sheet, rows.length);
    return sheet;
  }

  function _formatOptionsSheet_(sheet, rowCount) {
    const width = OPTIONS_HEADERS.length;
    sheet
      .getRange(1, 1, 1, width)
      .setFontWeight("bold")
      .setBackground("#E8EAF6");
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, width);
    sheet.setColumnWidth(9, 420);

    if (rowCount < 2) return;
    sheet.getRange(2, 4, rowCount - 1, 2).setNumberFormat("dd.MM.yyyy");
    sheet.getRange(2, width, rowCount - 1, 1).insertCheckboxes();

    const statuses = sheet.getRange(2, 8, rowCount - 1, 1).getValues();
    statuses.forEach(function (row, index) {
      const color =
        row[0] === "Кращий"
          ? "#C8E6C9"
          : row[0] === "Допустимий"
            ? "#FFF9C4"
            : "#FFCDD2";
      sheet.getRange(index + 2, 1, 1, width).setBackground(color);
    });
  }

  function readSelectedOption() {
    const sheet = _spreadsheet_().getSheetByName(
      VACATION_PLANNER_CONFIG.SHEETS.OPTIONS,
    );
    if (!sheet) {
      throw new Error(
        "Аркуш VACATION_OPTIONS не знайдено. Спочатку виконайте підбір.",
      );
    }
    const lastRow = sheet.getLastRow();
    if (lastRow < 2)
      throw new Error("На аркуші VACATION_OPTIONS немає варіантів");

    const values = sheet
      .getRange(2, 1, lastRow - 1, OPTIONS_HEADERS.length)
      .getValues();
    const selected = values.filter(function (row) {
      return row[9] === true;
    });
    if (!selected.length) {
      throw new Error("Не вибрано жодного варіанту в колонці Apply");
    }
    if (selected.length > 1) {
      throw new Error("Виберіть рівно один варіант у колонці Apply");
    }

    const row = selected[0];
    if (String(row[7] || "").trim() === "Відхилено") {
      throw new Error("Відхилений варіант не можна застосувати");
    }
    const option = {
      rank: Number(row[0]) || 0,
      fml: String(row[1] || "").trim(),
      vacationNumber: _vacationNumber_(row[2]),
      startDate: _date_(row[3]),
      endDate: _date_(row[4]),
      days: Number(row[5]) || 0,
      score: Number(row[6]) || 0,
      status: "VALID",
    };
    if (
      !option.fml ||
      !option.vacationNumber ||
      !option.startDate ||
      !option.endDate ||
      !Number.isInteger(option.days) ||
      option.days < 1 ||
      option.days > VACATION_PLANNER_CONFIG.OPTIONS.MAX_DURATION_DAYS
    ) {
      throw new Error("Вибраний рядок містить некоректні дані");
    }
    const expectedEnd = VacationPlannerService_.calculateEndDate(
      option.startDate,
      option.days,
    );
    if (
      VacationPlannerService_.daysBetween(expectedEnd, option.endDate) !== 0
    ) {
      throw new Error(
        "Дата завершення не відповідає тривалості. Виконайте підбір повторно",
      );
    }
    return option;
  }

  function writeVacationToSource(option) {
    const sheet = _ensureSourceSheet_();
    const requestedBlock = _block_(option.vacationNumber);
    const block = _writableBlock_(sheet, requestedBlock);
    const lastRow = Math.max(sheet.getLastRow(), 2);
    const rowCount = Math.max(lastRow - 1, 1);
    const values = sheet
      .getRange(
        2,
        block.startCol,
        rowCount,
        VACATION_PLANNER_CONFIG.SOURCE_HEADERS.length,
      )
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
        targetRow = i + 2;
        existingTravel = String(values[i][7] || "").trim();
        break;
      }
    }
    if (!targetRow) {
      for (let i = 0; i < values.length; i++) {
        if (!String(values[i][0] || "").trim()) {
          targetRow = i + 2;
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
      sheet.getRange(targetRow, block.startCol).setValue(option.fml);
      sheet
        .getRange(targetRow, block.startCol + 1)
        .setValue(_date_(option.startDate))
        .setNumberFormat("dd.MM.yyyy");
      sheet
        .getRange(targetRow, block.startCol + 3)
        .setValue(_sourceVacationText_(option));
      sheet.getRange(targetRow, block.startCol + 7).setValue(travel);
      return {
        sheetName: sheet.getName(),
        rowNumber: targetRow,
        block: block.key,
        startColumn: block.startCol,
        requestedBlock: requestedBlock.key,
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
    sheet
      .getRange(
        targetRow,
        block.startCol,
        1,
        VACATION_PLANNER_CONFIG.SOURCE_HEADERS.length,
      )
      .setValues([rowData]);
    sheet
      .getRange(targetRow, block.startCol + 1, 1, 2)
      .setNumberFormat("dd.MM.yyyy");

    return {
      sheetName: sheet.getName(),
      rowNumber: targetRow,
      block: block.key,
      startColumn: block.startCol,
      requestedBlock: requestedBlock.key,
      formulaDriven: false,
    };
  }

  function setVacationActive(fml, vacationNumber, active, vacationType) {
    const sheet = _ensureSourceSheet_();
    const requestedBlock = _block_(vacationNumber);
    const block = _writableBlock_(sheet, requestedBlock);
    const rowCount = Math.max(sheet.getLastRow() - 1, 1);
    const values = sheet.getRange(2, block.startCol, rowCount, 9).getValues();
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
      const rowNumber = index + 2;
      if (_isFormulaDrivenBlock_(sheet, block)) {
        const startRange = sheet.getRange(rowNumber, block.startCol + 1);
        if (active === true) {
          throw new Error("Для відновлення відпустки вкажіть нову дату початку");
        }
        startRange.clearContent();
        return {
          sheetName: sheet.getName(),
          rowNumber: rowNumber,
          block: block.key,
          requestedBlock: requestedBlock.key,
          active: false,
          formulaDriven: true,
        };
      }
      sheet.getRange(rowNumber, block.startCol + 4).setValue(active === true);
      sheet
        .getRange(rowNumber, block.startCol + 8)
        .setValue(active === true ? "OK" : "CANCELLED");
      return {
        sheetName: sheet.getName(),
        rowNumber: rowNumber,
        block: block.key,
        requestedBlock: requestedBlock.key,
        active: active === true,
        formulaDriven: false,
      };
    }
    throw new Error("Відпустку для скасування не знайдено");
  }

  function _dateOrdinal_(value) {
    const date = _date_(value);
    if (!date) return null;
    return (
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000
    );
  }

  function _dateKey_(value) {
    if (
      typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(value.trim())
    ) {
      return value.trim();
    }
    const date = _date_(value);
    if (!date) return "";
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return date.getFullYear() + "-" + month + "-" + day;
  }

  function buildScheduleCalendar(schedule) {
    const list = (Array.isArray(schedule) ? schedule : []).filter(
      function (item) {
        return item && _date_(item.startDate) && _date_(item.endDate);
      },
    );
    if (!list.length) {
      return {
        rows: [["QUANTITY", "FML"]],
        dateCount: 0,
        personCount: 0,
      };
    }

    let minOrdinal = null;
    let maxOrdinal = null;
    list.forEach(function (item) {
      const start = _dateOrdinal_(item.startDate);
      const end = _dateOrdinal_(item.endDate);
      if (minOrdinal === null || start < minOrdinal) minOrdinal = start;
      if (maxOrdinal === null || end > maxOrdinal) maxOrdinal = end;
    });

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
      const start = _dateOrdinal_(item.startDate);
      const end = _dateOrdinal_(item.endDate);
      people[key].quantity += Number(item.days) || end - start + 1;
      for (let ordinal = start; ordinal <= end; ordinal++) {
        const index = ordinal - minOrdinal;
        const current = people[key].cells[index];
        people[key].cells[index] = current && current !== marker
          ? current + "/" + marker
          : marker;
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
    const rowCount = calendar.personCount + 1;
    const dateCount = calendar.dateCount;
    if (!dateCount || rowCount <= 1) return;

    const dataRowCount = rowCount - 1;
    const dataRange = sheet.getRange(2, 3, dataRowCount, dateCount);
    const values = dataRange.getDisplayValues();
    const backgrounds = values.map(function (row) {
      return row.map(_scheduleCellColor_);
    });
    dataRange.setBackgrounds(backgrounds);
  }

  function _applyMonthSeparators_(sheet, calendar) {
    const rowCount = calendar.personCount + 1;
    const dateCount = calendar.dateCount;
    if (!dateCount || rowCount <= 0) return;

    const headerValues = sheet.getRange(1, 3, 1, dateCount).getValues()[0];
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
        .getRange(1, column, rowCount, 1)
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

  function _writeSchedule_(schedule) {
    const sheet = _ensureSheet_(VACATION_PLANNER_CONFIG.SHEETS.SCHEDULE);
    const calendar = buildScheduleCalendar(schedule);
    const rows = calendar.rows;
    const width = rows[0].length;
    _ensureGridSize_(sheet, rows.length, width);
    sheet.clear();
    sheet.getRange(1, 1, rows.length, width).setValues(rows);
    sheet
      .getRange(1, 1, 1, width)
      .setFontWeight("bold")
      .setBackground("#D9EAD3");
    sheet.setFrozenRows(1);
    sheet.setFrozenColumns(2);
    if (calendar.dateCount) {
      sheet.getRange(1, 3, 1, calendar.dateCount).setNumberFormat("dd.MM");
      sheet.setColumnWidths(3, calendar.dateCount, 42);
    }
    _formatScheduleCalendar_(sheet, calendar);
    _applyMonthSeparators_(sheet, calendar);
    sheet.autoResizeColumns(1, 2);
    return calendar;
  }

  function _checkType_(rule) {
    const map = {
      START_GAP: "START_TOO_CLOSE",
      PERSON_GAP: "GAP_TOO_SHORT",
      PERSON_OVERLAP: "GAP_TOO_SHORT",
      MAX_PERSON_YEAR: "YEAR_LIMIT",
      INVALID_DURATION: "INVALID_DATE",
    };
    return map[rule] || rule;
  }

  function normalizeChecks(checks) {
    return (Array.isArray(checks) ? checks : []).map(function (item) {
      return {
        date: item.date || "",
        type: _checkType_(item.rule),
        fml: item.fml || "",
        description: item.details || "",
        severity: item.severity || "ERROR",
      };
    });
  }

  function _extractProblemDates_(problem) {
    return (
      String((problem && problem.date) || "").match(/\d{4}-\d{2}-\d{2}/g) ||
      []
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
    return (Array.isArray(checks) ? checks : []).map(function (item) {
      const type = String((item && (item.rule || item.type)) || "").trim();
      const match = _findProblemScheduleItem_(item, schedule);
      const startDate =
        _dateKey_(item && item.startDate) || _dateKey_(match && match.startDate);
      const endDate =
        _dateKey_(item && item.endDate) || _dateKey_(match && match.endDate);
      const days = Number((item && item.days) || (match && match.days)) || "";
      return {
        date: (item && item.date) || startDate || "",
        type: type || _checkType_(item && item.rule),
        rule: type || "",
        fml: (item && item.fml) || "",
        primaryFml:
          (match && match.fml) ||
          _splitProblemFml_(item && item.fml)[0] ||
          "",
        description:
          (item && (item.details || item.message || item.description)) || "",
        details:
          (item && (item.details || item.message || item.description)) || "",
        severity: (item && item.severity) || "ERROR",
        vacationNumber:
          Number(
            (item && item.vacationNumber) || (match && match.vacationNumber),
          ) ||
          "",
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
  }

  function _writeChecks_(checks) {
    const sheet = _ensureSheet_(VACATION_PLANNER_CONFIG.SHEETS.CHECK);
    sheet.clear();
    const headers = ["Date", "Type", "FML", "Description", "Severity"];
    const rows = [headers];
    if (!checks.length) {
      rows.push(["", "ALL_RULES", "", "Порушень не знайдено", "OK"]);
    } else {
      normalizeChecks(checks).forEach(function (item) {
        rows.push([
          item.date,
          item.type,
          item.fml,
          item.description,
          item.severity,
        ]);
      });
    }
    sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
    sheet
      .getRange(1, 1, 1, headers.length)
      .setFontWeight("bold")
      .setBackground("#FCE8B2");
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, headers.length);
    sheet.setColumnWidth(4, 420);
  }

  function _loadAudit_() {
    const allVacations = VacationsRepository_.listAll();
    return VacationPlannerService_.buildScheduleAudit(allVacations);
  }

  function rebuildVacationSystem() {
    const audit = _loadAudit_();
    const calendar = _writeSchedule_(audit.schedule);
    _writeChecks_(audit.checks);
    return {
      scheduleRows: audit.schedule.length,
      schedulePeople: calendar.personCount,
      scheduleDays: calendar.dateCount,
      checkRows: audit.checks.length,
      errorCount: audit.checks.filter(function (item) {
        return item.severity === "ERROR";
      }).length,
      affectedSheets: [
        VACATION_PLANNER_CONFIG.SHEETS.SCHEDULE,
        VACATION_PLANNER_CONFIG.SHEETS.CHECK,
      ],
      checks: normalizeProblems(audit.checks, audit.schedule),
    };
  }

  function checkVacationScheduleOnly() {
    const audit = _loadAudit_();
    _writeChecks_(audit.checks);
    return {
      scheduleRows: audit.schedule.length,
      checkRows: audit.checks.length,
      errorCount: audit.checks.filter(function (item) {
        return item.severity === "ERROR";
      }).length,
      affectedSheets: [VACATION_PLANNER_CONFIG.SHEETS.CHECK],
      checks: normalizeProblems(audit.checks, audit.schedule),
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
    const errors = normalizeChecks(audit.checks).filter(function (item) {
      return item.severity === "ERROR";
    });
    const byRule = {};
    errors.forEach(function (item) {
      byRule[item.type] = (byRule[item.type] || 0) + 1;
    });
    const lines = [
      "Активних відпусток: " + audit.schedule.length,
      "Порушень: " + errors.length,
    ];
    Object.keys(byRule)
      .sort()
      .forEach(function (rule) {
        lines.push("  • " + rule + ": " + byRule[rule]);
      });
    if (!errors.length) {
      lines.push("Графік відповідає обмеженням підрозділу.");
    } else {
      lines.push(
        "Деталі — на аркуші " + VACATION_PLANNER_CONFIG.SHEETS.CHECK + ".",
      );
    }
    return {
      summary: lines.join("\n"),
      scheduleRows: audit.schedule.length,
      errorCount: errors.length,
      checks: errors,
    };
  }

  function applySelectedOption() {
    const option = readSelectedOption();
    const validation = VacationPlannerService_.validateVacationOption(
      option,
      VacationsRepository_.listAll(),
    );
    if (!validation.isValid) {
      throw new Error(
        "Варіант більше не доступний: " +
          validation.violations
            .map(function (item) {
              return item.message;
            })
            .join("; "),
      );
    }

    const write = writeVacationToSource(option);
    const rebuild = rebuildVacationSystem();
    return {
      option: option,
      write: write,
      rebuild: rebuild,
    };
  }

  return {
    writeVacationOptions: writeVacationOptions,
    readSelectedOption: readSelectedOption,
    writeVacationToSource: writeVacationToSource,
    setVacationActive: setVacationActive,
    buildScheduleCalendar: buildScheduleCalendar,
    normalizeChecks: normalizeChecks,
    normalizeProblems: normalizeProblems,
    rebuildVacationSystem: rebuildVacationSystem,
    checkVacationScheduleOnly: checkVacationScheduleOnly,
    highlightVacationProblems: highlightVacationProblems,
    generateVacationReport: generateVacationReport,
    applySelectedOption: applySelectedOption,
  };
})();

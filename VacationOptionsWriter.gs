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
    const block = _block_(option.vacationNumber);
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
      if (_fmlKey_(values[i][0]) === targetKey) {
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

    const rowData = [
      option.fml,
      _date_(option.startDate),
      _date_(option.endDate),
      _vacationText_(option.vacationNumber),
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
    };
  }

  function _writeSchedule_(schedule) {
    const sheet = _ensureSheet_(VACATION_PLANNER_CONFIG.SHEETS.SCHEDULE);
    sheet.clear();
    const headers = [
      "FML",
      "Vacation №",
      "Start date",
      "End date",
      "Days",
      "Active",
      "Source block",
      "Source row",
    ];
    const rows = [headers];
    schedule.forEach(function (item) {
      rows.push([
        item.fml,
        _vacationText_(item.vacationNumber),
        item.startDate,
        item.endDate,
        item.days,
        item.active,
        item.block,
        item.sourceRow,
      ]);
    });
    sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
    sheet
      .getRange(1, 1, 1, headers.length)
      .setFontWeight("bold")
      .setBackground("#D9EAD3");
    sheet.setFrozenRows(1);
    if (rows.length > 1) {
      sheet.getRange(2, 3, rows.length - 1, 2).setNumberFormat("dd.MM.yyyy");
    }
    sheet.autoResizeColumns(1, headers.length);
  }

  function _writeChecks_(checks) {
    const sheet = _ensureSheet_(VACATION_PLANNER_CONFIG.SHEETS.CHECK);
    sheet.clear();
    const headers = ["Severity", "Rule", "Date / period", "FML", "Details"];
    const rows = [headers];
    if (!checks.length) {
      rows.push(["OK", "ALL_RULES", "", "", "Порушень не знайдено"]);
    } else {
      checks.forEach(function (item) {
        rows.push([
          item.severity,
          item.rule,
          item.date,
          item.fml,
          item.details,
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
    sheet.setColumnWidth(5, 420);
  }

  function _loadAudit_() {
    const allVacations = VacationsRepository_.listAll();
    return VacationPlannerService_.buildScheduleAudit(allVacations);
  }

  function rebuildVacationSystem() {
    const audit = _loadAudit_();
    _writeSchedule_(audit.schedule);
    _writeChecks_(audit.checks);
    return {
      scheduleRows: audit.schedule.length,
      checkRows: audit.checks.length,
      errorCount: audit.checks.filter(function (item) {
        return item.severity === "ERROR";
      }).length,
      affectedSheets: [
        VACATION_PLANNER_CONFIG.SHEETS.SCHEDULE,
        VACATION_PLANNER_CONFIG.SHEETS.CHECK,
      ],
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
      const severity = String(row[0] || "")
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
    const errors = audit.checks.filter(function (item) {
      return item.severity === "ERROR";
    });
    const byRule = {};
    errors.forEach(function (item) {
      byRule[item.rule] = (byRule[item.rule] || 0) + 1;
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
      checks: audit.checks,
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
    rebuildVacationSystem: rebuildVacationSystem,
    checkVacationScheduleOnly: checkVacationScheduleOnly,
    highlightVacationProblems: highlightVacationProblems,
    generateVacationReport: generateVacationReport,
    applySelectedOption: applySelectedOption,
  };
})();

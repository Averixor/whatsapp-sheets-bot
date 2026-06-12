/**
 * Calculation_OS: independent daily personnel-state snapshot.
 *
 * This module intentionally uses only Google Apps Script built-ins. It does not
 * call WASB functions, menus, sidebars, or trigger installers.
 */

var Calculation_OS_ = (function () {
  var CALCULATION_OS_CONFIG_ = Object.freeze({
    outputSheet: "Calculation_OS",
    personnelSheet: "PERSONNEL",
    dictionarySheet: "DICT_SUM",
    metricHeader: "Показник",
    dateHeaderRow: 1,
    dataStartRow: 2,
    triggerHandler: "Calculation_OS_runDaily",
    spreadsheetIdProperty: "CALCULATION_OS_SPREADSHEET_ID",
    monthNotePrefix: "Calculation_OS.month:",
    snapshotNotePrefix: "Calculation_OS.snapshot:",
    metricNotePrefix: "Calculation_OS.metric:",
    groups: Object.freeze([
      Object.freeze({
        key: "detached",
        label: "Відкомандеровані",
        codes: Object.freeze([
          "*ВЗ",
          "*ВМЗ",
          "*1РБпАК",
          "*2РБпАК",
          "*1УРБпАК",
          "*2УРБпАК",
          "Відряд",
        ]),
      }),
      Object.freeze({
        key: "husachivka",
        label: "Гусачівка",
        codes: Object.freeze(["Гусачі ЧБ", "Гусачі ОД", "Гусачі ДК", "Гусачі"]),
      }),
      Object.freeze({
        key: "position_guard",
        label: "Охорона позиції",
        codes: Object.freeze(["1РБпАК", "2РБпАК", "1УРБпАК", "2УРБпАК"]),
      }),
    ]),
    standaloneCodes: Object.freeze([
      "Black",
      "Roland",
      "БР",
      "Евак",
      "КП",
      "Резерв",
      "Відпус",
      "Лікарн",
      "Київ",
      "Гусачі",
      "БЗВП",
      "СЗЧ",
      "Вибув",
    ]),
    compactDataEndRowFallback: 30,
    standardDataEndRowFallback: 44,
  });

  function Calculation_OS_text_(value) {
    return String(value == null ? "" : value).trim();
  }

  function Calculation_OS_normalizeHeader_(value) {
    return Calculation_OS_text_(value).toLocaleLowerCase().replace(/\s+/g, " ");
  }

  function Calculation_OS_requireSheet_(spreadsheet, name) {
    var sheet = spreadsheet.getSheetByName(name);
    if (!sheet) throw new Error('Не знайдено аркуш "' + name + '"');
    return sheet;
  }

  function Calculation_OS_getSpreadsheet_() {
    var active = null;
    try {
      active = SpreadsheetApp.getActiveSpreadsheet();
    } catch (_) {}
    var properties = PropertiesService.getScriptProperties();
    if (active) {
      properties.setProperty(
        CALCULATION_OS_CONFIG_.spreadsheetIdProperty,
        active.getId(),
      );
      return active;
    }
    var spreadsheetId = Calculation_OS_text_(
      properties.getProperty(CALCULATION_OS_CONFIG_.spreadsheetIdProperty),
    );
    if (!spreadsheetId) {
      throw new Error(
        "Не знайдено таблицю Calculation_OS. Один раз запустіть " +
          "Calculation_OS_installDailyTrigger вручну з прив'язаної таблиці.",
      );
    }
    return SpreadsheetApp.openById(spreadsheetId);
  }

  function Calculation_OS_findHeaderColumn_(sheet, expectedHeader) {
    var width = Math.max(Number(sheet.getLastColumn()) || 0, 1);
    var headers = sheet.getRange(1, 1, 1, width).getDisplayValues()[0];
    var expected = Calculation_OS_normalizeHeader_(expectedHeader);
    for (var index = 0; index < headers.length; index++) {
      if (Calculation_OS_normalizeHeader_(headers[index]) === expected) {
        return index + 1;
      }
    }
    throw new Error(
      'На аркуші "' +
        sheet.getName() +
        '" не знайдено стовпець "' +
        expectedHeader +
        '"',
    );
  }

  function Calculation_OS_countNonEmptyColumn_(sheet, column) {
    var lastRow = Math.max(Number(sheet.getLastRow()) || 0, 1);
    if (lastRow < CALCULATION_OS_CONFIG_.dataStartRow) return 0;
    return sheet
      .getRange(
        CALCULATION_OS_CONFIG_.dataStartRow,
        column,
        lastRow - CALCULATION_OS_CONFIG_.dataStartRow + 1,
        1,
      )
      .getDisplayValues()
      .reduce(function (count, row) {
        return count + (Calculation_OS_text_(row[0]) ? 1 : 0);
      }, 0);
  }

  function Calculation_OS_readPersonnelCounts_(spreadsheet) {
    var sheet = Calculation_OS_requireSheet_(
      spreadsheet,
      CALCULATION_OS_CONFIG_.personnelSheet,
    );
    return {
      cells: Calculation_OS_countNonEmptyColumn_(
        sheet,
        Calculation_OS_findHeaderColumn_(sheet, "Cells"),
      ),
      lastName: Calculation_OS_countNonEmptyColumn_(
        sheet,
        Calculation_OS_findHeaderColumn_(sheet, "Last name"),
      ),
    };
  }

  function Calculation_OS_readDictionary_(spreadsheet) {
    var sheet = Calculation_OS_requireSheet_(
      spreadsheet,
      CALCULATION_OS_CONFIG_.dictionarySheet,
    );
    var codeColumn = Calculation_OS_findHeaderColumn_(sheet, "Код");
    var labelColumn = Calculation_OS_findHeaderColumn_(sheet, "Вид служби");
    var orderColumn = Calculation_OS_findHeaderColumn_(sheet, "Порядок");
    var lastRow = Math.max(Number(sheet.getLastRow()) || 0, 1);
    if (lastRow < CALCULATION_OS_CONFIG_.dataStartRow) return {};

    var width = Math.max(codeColumn, labelColumn, orderColumn);
    var rows = sheet
      .getRange(
        CALCULATION_OS_CONFIG_.dataStartRow,
        1,
        lastRow - CALCULATION_OS_CONFIG_.dataStartRow + 1,
        width,
      )
      .getDisplayValues();
    var dictionary = {};
    rows.forEach(function (row, offset) {
      var code = Calculation_OS_text_(row[codeColumn - 1]);
      if (!code) return;
      if (dictionary[code]) {
        throw new Error(
          'DICT_SUM містить дубль коду "' +
            code +
            '" у рядку ' +
            (offset + CALCULATION_OS_CONFIG_.dataStartRow),
        );
      }
      var label = Calculation_OS_text_(row[labelColumn - 1]);
      var orderText = Calculation_OS_text_(row[orderColumn - 1]);
      var order = Number(orderText.replace(",", "."));
      if (!orderText || !isFinite(order)) {
        throw new Error(
          'DICT_SUM містить некоректний "Порядок" для коду "' + code + '"',
        );
      }
      dictionary[code] = {
        code: code,
        label: label,
        order: order,
      };
    });
    return dictionary;
  }

  function Calculation_OS_dateKey_(date, timezone) {
    return Utilities.formatDate(date, timezone, "yyyy-MM-dd");
  }

  function Calculation_OS_monthKey_(date, timezone) {
    return Utilities.formatDate(date, timezone, "yyyy-MM");
  }

  function Calculation_OS_dayText_(date, timezone) {
    return Utilities.formatDate(date, timezone, "dd");
  }

  function Calculation_OS_monthText_(date, timezone) {
    return Utilities.formatDate(date, timezone, "MM");
  }

  function Calculation_OS_headerMatchesDate_(
    value,
    displayValue,
    targetDate,
    timezone,
    allowDayOnly,
  ) {
    var targetKey = Calculation_OS_dateKey_(targetDate, timezone);
    if (value instanceof Date && !isNaN(value.getTime())) {
      return Calculation_OS_dateKey_(value, timezone) === targetKey;
    }

    var targetDay = Calculation_OS_dayText_(targetDate, timezone);
    var targetMonth = Calculation_OS_monthText_(targetDate, timezone);
    var targetYear = Utilities.formatDate(targetDate, timezone, "yyyy");
    var text = Calculation_OS_text_(displayValue || value);
    if (!text) return false;
    if (
      text === targetKey ||
      text === targetDay + "." + targetMonth + "." + targetYear ||
      text === targetDay + "." + targetMonth ||
      text === Number(targetDay) + "." + Number(targetMonth) + "." + targetYear
    ) {
      return true;
    }
    return allowDayOnly && Number(text) === Number(targetDay);
  }

  function Calculation_OS_looksLikeMonthlyDateHeader_(value) {
    if (value instanceof Date && !isNaN(value.getTime())) return true;
    var text = Calculation_OS_text_(value);
    if (!text) return false;
    if (/^\d{4,5}(\.\d+)?$/.test(text)) return true;
    if (/^\d{1,2}[.\-/]\d{1,2}([.\-/]\d{2,4})?$/.test(text)) return true;
    return false;
  }

  function Calculation_OS_monthlyLayoutHeaderNorm_(value) {
    return Calculation_OS_text_(value)
      .toLocaleLowerCase()
      .replace(/[''`"ʼ]/g, "")
      .replace(/\s+/g, " ");
  }

  function Calculation_OS_monthlyDataEndRow_(
    sheet,
    fallbackRow,
    markerColumns,
    requireAllMarkers,
  ) {
    var sheetLastRow = Math.max(Number(sheet.getLastRow()) || 0, 2);
    var scanLastRow = Math.min(Math.max(sheetLastRow, fallbackRow, 2), 1000);
    var markerValues = markerColumns.map(function (column) {
      if (scanLastRow < CALCULATION_OS_CONFIG_.dataStartRow) return [];
      return sheet
        .getRange(
          CALCULATION_OS_CONFIG_.dataStartRow,
          column,
          scanLastRow - CALCULATION_OS_CONFIG_.dataStartRow + 1,
          1,
        )
        .getDisplayValues();
    });

    for (var offset = markerValues[0].length - 1; offset >= 0; offset--) {
      var filled = 0;
      for (var index = 0; index < markerValues.length; index++) {
        if (Calculation_OS_text_((markerValues[index][offset] || [])[0])) {
          filled++;
        }
      }
      if (requireAllMarkers ? filled === markerColumns.length : filled > 0) {
        return offset + CALCULATION_OS_CONFIG_.dataStartRow;
      }
    }
    return Math.max(CALCULATION_OS_CONFIG_.dataStartRow, fallbackRow);
  }

  function Calculation_OS_detectMonthlyPersonnelLayout_(sheet) {
    var width = Math.max(Number(sheet.getLastColumn()) || 0, 1);
    var headers = sheet
      .getRange(CALCULATION_OS_CONFIG_.dateHeaderRow, 1, 1, width)
      .getDisplayValues()[0];
    var colA = Calculation_OS_monthlyLayoutHeaderNorm_(headers[0]);
    var colB = Calculation_OS_monthlyLayoutHeaderNorm_(headers[1]);
    var isPhoneHeaderA =
      colA.indexOf("тел") !== -1 || colA.indexOf("phone") !== -1;
    var isCallsignB = colB.indexOf("позивн") !== -1 || colB === "callsign";
    var compactDateCol = 3;
    var compactDateHeader = headers[compactDateCol - 1];

    if (
      isCallsignB &&
      Calculation_OS_looksLikeMonthlyDateHeader_(compactDateHeader) &&
      !isPhoneHeaderA
    ) {
      return {
        callsignColumn: 2,
        dataStartRow: CALCULATION_OS_CONFIG_.dataStartRow,
        dataEndRow: Calculation_OS_monthlyDataEndRow_(
          sheet,
          CALCULATION_OS_CONFIG_.compactDataEndRowFallback,
          [1, 2],
          true,
        ),
      };
    }

    var standardDateCol = 8;
    var standardDateHeader = headers[standardDateCol - 1];
    if (
      isPhoneHeaderA &&
      isCallsignB &&
      Calculation_OS_looksLikeMonthlyDateHeader_(standardDateHeader)
    ) {
      return {
        callsignColumn: 2,
        dataStartRow: CALCULATION_OS_CONFIG_.dataStartRow,
        dataEndRow: Calculation_OS_monthlyDataEndRow_(
          sheet,
          CALCULATION_OS_CONFIG_.standardDataEndRowFallback,
          [2],
          false,
        ),
      };
    }

    throw new Error(
      'Не вдалося визначити блок особового складу на аркуші "' +
        sheet.getName() +
        '"',
    );
  }

  function Calculation_OS_findDateColumn_(sheet, targetDate, timezone) {
    var width = Math.max(Number(sheet.getLastColumn()) || 0, 1);
    var range = sheet.getRange(
      CALCULATION_OS_CONFIG_.dateHeaderRow,
      1,
      1,
      width,
    );
    var values = range.getValues()[0];
    var displayValues = range.getDisplayValues()[0];
    var allowDayOnly =
      Calculation_OS_text_(sheet.getName()) ===
      Calculation_OS_monthText_(targetDate, timezone);

    for (var index = 0; index < values.length; index++) {
      if (
        Calculation_OS_headerMatchesDate_(
          values[index],
          displayValues[index],
          targetDate,
          timezone,
          allowDayOnly,
        )
      ) {
        return index + 1;
      }
    }
    return 0;
  }

  function Calculation_OS_resolveMonthSheet_(
    spreadsheet,
    targetDate,
    timezone,
  ) {
    var preferredName = Calculation_OS_monthText_(targetDate, timezone);
    var preferred = spreadsheet.getSheetByName(preferredName);
    if (preferred) {
      var preferredColumn = Calculation_OS_findDateColumn_(
        preferred,
        targetDate,
        timezone,
      );
      if (preferredColumn)
        return { sheet: preferred, dateColumn: preferredColumn };
    }

    var matches = spreadsheet
      .getSheets()
      .filter(function (sheet) {
        return /^\d{2}$/.test(Calculation_OS_text_(sheet.getName()));
      })
      .map(function (sheet) {
        return {
          sheet: sheet,
          dateColumn: Calculation_OS_findDateColumn_(
            sheet,
            targetDate,
            timezone,
          ),
        };
      })
      .filter(function (candidate) {
        return candidate.dateColumn > 0;
      });

    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
      throw new Error(
        "Поточну дату знайдено на кількох місячних аркушах: " +
          matches
            .map(function (candidate) {
              return candidate.sheet.getName();
            })
            .join(", "),
      );
    }
    throw new Error(
      'Не знайдено колонку поточної дати на місячному аркуші "' +
        preferredName +
        '"',
    );
  }

  function Calculation_OS_countCurrentCodes_(sheet, dateColumn, dictionary) {
    var layout = Calculation_OS_detectMonthlyPersonnelLayout_(sheet);
    var rowCount = layout.dataEndRow - layout.dataStartRow + 1;
    if (rowCount <= 0) return {};

    var codes = sheet
      .getRange(layout.dataStartRow, dateColumn, rowCount, 1)
      .getDisplayValues();
    var callsigns = sheet
      .getRange(layout.dataStartRow, layout.callsignColumn, rowCount, 1)
      .getDisplayValues();
    var counts = {};
    for (var index = 0; index < codes.length; index++) {
      var code = Calculation_OS_text_(codes[index][0]);
      var callsign = Calculation_OS_text_(callsigns[index][0]);
      if (!code || !callsign || !dictionary[code]) continue;
      counts[code] = (counts[code] || 0) + 1;
    }
    return counts;
  }

  function Calculation_OS_requireDictionaryEntry_(dictionary, code) {
    var entry = dictionary[code];
    if (!entry || !entry.label) {
      throw new Error(
        'Для коду "' + code + '" відсутній "Вид служби" у DICT_SUM',
      );
    }
    return entry;
  }

  function Calculation_OS_addMetric_(map, metric) {
    if (!metric || !(Number(metric.value) > 0)) return;
    var current = map[metric.key];
    if (!current || Number(metric.rank) < Number(current.rank)) {
      map[metric.key] = metric;
    }
  }

  function Calculation_OS_buildMetrics_(
    personnelCounts,
    codeCounts,
    dictionary,
  ) {
    var metrics = {};
    Calculation_OS_addMetric_(metrics, {
      key: "personnel:cells",
      label: "За штатом",
      value: personnelCounts.cells,
      rank: -2000000,
    });
    Calculation_OS_addMetric_(metrics, {
      key: "personnel:last-name",
      label: "За списком",
      value: personnelCounts.lastName,
      rank: -1999999,
    });

    CALCULATION_OS_CONFIG_.groups.forEach(function (group) {
      var total = group.codes.reduce(function (sum, code) {
        return sum + Number(codeCounts[code] || 0);
      }, 0);
      if (!(total > 0)) return;

      var allGroupEntries = group.codes.map(function (code) {
        return Calculation_OS_requireDictionaryEntry_(dictionary, code);
      });
      var firstOrder = allGroupEntries.reduce(function (minimum, entry) {
        return Math.min(minimum, entry.order);
      }, Number.MAX_SAFE_INTEGER);
      Calculation_OS_addMetric_(metrics, {
        key: "group:" + group.key,
        label: group.label,
        value: total,
        rank: firstOrder - 0.5,
      });
      allGroupEntries.forEach(function (entry) {
        Calculation_OS_addMetric_(metrics, {
          key: "code:" + entry.code,
          label: entry.label,
          value: Number(codeCounts[entry.code] || 0),
          rank: entry.order,
        });
      });
    });

    CALCULATION_OS_CONFIG_.standaloneCodes.forEach(function (code) {
      var value = Number(codeCounts[code] || 0);
      if (!(value > 0)) return;
      var entry = Calculation_OS_requireDictionaryEntry_(dictionary, code);
      Calculation_OS_addMetric_(metrics, {
        key: "code:" + code,
        label: entry.label,
        value: value,
        rank: entry.order,
      });
    });

    return Object.keys(metrics)
      .map(function (key) {
        return metrics[key];
      })
      .sort(function (left, right) {
        return (
          Number(left.rank) - Number(right.rank) ||
          left.key.localeCompare(right.key)
        );
      });
  }

  function Calculation_OS_parseMetricNote_(note) {
    var text = Calculation_OS_text_(note);
    if (text.indexOf(CALCULATION_OS_CONFIG_.metricNotePrefix) !== 0)
      return null;
    try {
      var parsed = JSON.parse(
        text.slice(CALCULATION_OS_CONFIG_.metricNotePrefix.length),
      );
      if (!parsed || !Calculation_OS_text_(parsed.key)) return null;
      return {
        key: Calculation_OS_text_(parsed.key),
        rank: Number(parsed.rank),
      };
    } catch (_) {
      return null;
    }
  }

  function Calculation_OS_metricNote_(metric) {
    return (
      CALCULATION_OS_CONFIG_.metricNotePrefix +
      JSON.stringify({ key: metric.key, rank: metric.rank })
    );
  }

  function Calculation_OS_readMetricRows_(sheet) {
    var lastRow = Math.max(Number(sheet.getLastRow()) || 0, 1);
    if (lastRow < CALCULATION_OS_CONFIG_.dataStartRow) return [];
    var height = lastRow - CALCULATION_OS_CONFIG_.dataStartRow + 1;
    var range = sheet.getRange(
      CALCULATION_OS_CONFIG_.dataStartRow,
      1,
      height,
      1,
    );
    var labels = range.getDisplayValues();
    var notes = range.getNotes();
    var rows = [];
    for (var offset = 0; offset < height; offset++) {
      var label = Calculation_OS_text_(labels[offset][0]);
      if (!label) continue;
      var metadata = Calculation_OS_parseMetricNote_(notes[offset][0]);
      rows.push({
        row: CALCULATION_OS_CONFIG_.dataStartRow + offset,
        label: label,
        key: metadata ? metadata.key : "",
        rank: metadata && isFinite(metadata.rank) ? metadata.rank : null,
      });
    }
    return rows;
  }

  function Calculation_OS_ensureRowExists_(sheet, row) {
    var maxRows = Math.max(Number(sheet.getMaxRows()) || 0, 1);
    if (row > maxRows) sheet.insertRowsAfter(maxRows, row - maxRows);
  }

  function Calculation_OS_ensureMetricRows_(sheet, metrics) {
    metrics.forEach(function (metric) {
      var rows = Calculation_OS_readMetricRows_(sheet);
      var existing = rows.filter(function (row) {
        return row.key === metric.key;
      })[0];
      if (existing) return;

      var legacy = rows.filter(function (row) {
        return !row.key && row.label === metric.label;
      })[0];
      if (legacy) {
        sheet
          .getRange(legacy.row, 1)
          .setNote(Calculation_OS_metricNote_(metric));
        return;
      }

      var before = rows
        .filter(function (row) {
          return row.rank !== null && Number(row.rank) > Number(metric.rank);
        })
        .sort(function (left, right) {
          return left.row - right.row;
        })[0];
      var targetRow;
      if (before) {
        sheet.insertRowBefore(before.row);
        targetRow = before.row;
      } else {
        targetRow = Math.max(Number(sheet.getLastRow()) + 1, 2);
        Calculation_OS_ensureRowExists_(sheet, targetRow);
      }
      sheet
        .getRange(targetRow, 1)
        .setValue(metric.label)
        .setNote(Calculation_OS_metricNote_(metric));
    });

    var result = {};
    Calculation_OS_readMetricRows_(sheet).forEach(function (row) {
      if (row.key) result[row.key] = row.row;
    });
    return result;
  }

  function Calculation_OS_sheetHasHistory_(sheet) {
    var lastRow = Math.max(Number(sheet.getLastRow()) || 0, 1);
    var lastColumn = Math.max(Number(sheet.getLastColumn()) || 0, 1);
    if (lastRow >= 2 && lastColumn >= 2) {
      var values = sheet
        .getRange(2, 2, lastRow - 1, lastColumn - 1)
        .getValues();
      for (var row = 0; row < values.length; row++) {
        for (var column = 0; column < values[row].length; column++) {
          if (values[row][column] !== "") return true;
        }
      }
    }
    if (lastColumn >= 2) {
      var notes = sheet.getRange(1, 2, 1, lastColumn - 1).getNotes()[0];
      return notes.some(function (note) {
        return (
          Calculation_OS_text_(note).indexOf(
            CALCULATION_OS_CONFIG_.snapshotNotePrefix,
          ) === 0
        );
      });
    }
    return false;
  }

  function Calculation_OS_ensureOutputSheet_(
    spreadsheet,
    targetDate,
    timezone,
  ) {
    var sheet = spreadsheet.getSheetByName(CALCULATION_OS_CONFIG_.outputSheet);
    if (!sheet)
      sheet = spreadsheet.insertSheet(CALCULATION_OS_CONFIG_.outputSheet);
    Calculation_OS_ensureRowExists_(sheet, 2);
    if (sheet.getMaxColumns() < 32) {
      sheet.insertColumnsAfter(
        sheet.getMaxColumns(),
        32 - sheet.getMaxColumns(),
      );
    }

    var metricHeader = Calculation_OS_text_(
      sheet.getRange(1, 1).getDisplayValue(),
    );
    if (metricHeader && metricHeader !== CALCULATION_OS_CONFIG_.metricHeader) {
      throw new Error(
        'Calculation_OS!A1 повинна містити "' +
          CALCULATION_OS_CONFIG_.metricHeader +
          '"',
      );
    }
    if (!metricHeader) {
      sheet.getRange(1, 1).setValue(CALCULATION_OS_CONFIG_.metricHeader);
    }

    for (var day = 1; day <= 31; day++) {
      var cell = sheet.getRange(1, day + 1);
      var expected = String(day).padStart(2, "0");
      var current = Calculation_OS_text_(cell.getDisplayValue());
      if (current && Number(current) !== day) {
        throw new Error(
          "Некоректний заголовок " +
            cell.getA1Notation() +
            ': очікується "' +
            expected +
            '"',
        );
      }
      if (!current) cell.setValue(expected).setNumberFormat("@");
    }

    var monthKey = Calculation_OS_monthKey_(targetDate, timezone);
    var monthNote = Calculation_OS_text_(sheet.getRange(1, 1).getNote());
    var expectedMonthNote = CALCULATION_OS_CONFIG_.monthNotePrefix + monthKey;
    if (monthNote && monthNote !== expectedMonthNote) {
      if (Calculation_OS_sheetHasHistory_(sheet)) {
        throw new Error(
          "Calculation_OS містить історію іншого місяця. " +
            "Архівуйте або перейменуйте аркуш перед першим запуском нового місяця.",
        );
      }
    } else if (!monthNote && Calculation_OS_sheetHasHistory_(sheet)) {
      throw new Error(
        "Calculation_OS містить історію без маркера місяця. " +
          "Автоматичний запис зупинено, щоб не змінити попередні дані.",
      );
    }
    if (monthNote !== expectedMonthNote) {
      sheet.getRange(1, 1).setNote(expectedMonthNote);
    }
    sheet.setFrozenRows(1);
    sheet.setFrozenColumns(1);
    return sheet;
  }

  function Calculation_OS_isDayRecorded_(sheet, dayColumn, dateKey) {
    var header = sheet.getRange(1, dayColumn);
    if (
      Calculation_OS_text_(header.getNote()) ===
      CALCULATION_OS_CONFIG_.snapshotNotePrefix + dateKey
    ) {
      return true;
    }
    var lastRow = Math.max(Number(sheet.getLastRow()) || 0, 1);
    if (lastRow < 2) return false;
    return sheet
      .getRange(2, dayColumn, lastRow - 1, 1)
      .getValues()
      .some(function (row) {
        return row[0] !== "";
      });
  }

  function Calculation_OS_writeSnapshot_(sheet, dayColumn, dateKey, metrics) {
    if (Calculation_OS_isDayRecorded_(sheet, dayColumn, dateKey)) {
      return { recorded: false, reason: "already-recorded", metrics: 0 };
    }
    var rowByKey = Calculation_OS_ensureMetricRows_(sheet, metrics);
    var lastRow = Math.max(Number(sheet.getLastRow()) || 0, 1);
    var values = Array.from({ length: Math.max(lastRow - 1, 0) }, function () {
      return [""];
    });
    metrics.forEach(function (metric) {
      var row = rowByKey[metric.key];
      if (!row) throw new Error("Не вдалося створити рядок " + metric.key);
      values[row - 2][0] = metric.value;
    });
    if (values.length) {
      sheet.getRange(2, dayColumn, values.length, 1).setValues(values);
    }
    sheet
      .getRange(1, dayColumn)
      .setNote(CALCULATION_OS_CONFIG_.snapshotNotePrefix + dateKey);
    return { recorded: true, reason: "created", metrics: metrics.length };
  }

  /**
   * Main manual and time-trigger entry point.
   */
  function Calculation_OS_runDaily() {
    var lock = LockService.getDocumentLock();
    if (!lock.tryLock(30000)) {
      throw new Error("Calculation_OS вже виконується");
    }
    try {
      var spreadsheet = Calculation_OS_getSpreadsheet_();
      var timezone =
        Calculation_OS_text_(spreadsheet.getSpreadsheetTimeZone()) ||
        Session.getScriptTimeZone();
      var now = new Date();
      var dateKey = Calculation_OS_dateKey_(now, timezone);
      var monthSource = Calculation_OS_resolveMonthSheet_(
        spreadsheet,
        now,
        timezone,
      );
      var personnelCounts = Calculation_OS_readPersonnelCounts_(spreadsheet);
      var dictionary = Calculation_OS_readDictionary_(spreadsheet);
      var codeCounts = Calculation_OS_countCurrentCodes_(
        monthSource.sheet,
        monthSource.dateColumn,
        dictionary,
      );
      var metrics = Calculation_OS_buildMetrics_(
        personnelCounts,
        codeCounts,
        dictionary,
      );
      var output = Calculation_OS_ensureOutputSheet_(
        spreadsheet,
        now,
        timezone,
      );
      var dayColumn = Number(Calculation_OS_dayText_(now, timezone)) + 1;
      var writeResult = Calculation_OS_writeSnapshot_(
        output,
        dayColumn,
        dateKey,
        metrics,
      );
      return {
        ok: true,
        date: dateKey,
        sourceSheet: monthSource.sheet.getName(),
        sourceDateColumn: monthSource.dateColumn,
        personnel: personnelCounts,
        countedCodes: Object.keys(codeCounts).length,
        metrics: metrics.length,
        recorded: writeResult.recorded,
        reason: writeResult.reason,
      };
    } finally {
      lock.releaseLock();
    }
  }

  /**
   * Installs exactly one Calculation_OS-owned daily trigger near 23:55.
   * Other project triggers are never changed.
   */
  function Calculation_OS_installDailyTrigger() {
    Calculation_OS_getSpreadsheet_();
    var handler = CALCULATION_OS_CONFIG_.triggerHandler;
    ScriptApp.getProjectTriggers()
      .filter(function (trigger) {
        return trigger.getHandlerFunction() === handler;
      })
      .forEach(function (trigger) {
        ScriptApp.deleteTrigger(trigger);
      });
    var trigger = ScriptApp.newTrigger(handler)
      .timeBased()
      .everyDays(1)
      .atHour(23)
      .nearMinute(55)
      .create();
    return {
      ok: true,
      handler: handler,
      uniqueId: trigger.getUniqueId(),
      schedule: "daily near 23:55",
    };
  }

  /**
   * Removes only Calculation_OS-owned triggers.
   */
  function Calculation_OS_removeDailyTrigger() {
    var handler = CALCULATION_OS_CONFIG_.triggerHandler;
    var removed = 0;
    ScriptApp.getProjectTriggers()
      .filter(function (trigger) {
        return trigger.getHandlerFunction() === handler;
      })
      .forEach(function (trigger) {
        ScriptApp.deleteTrigger(trigger);
        removed++;
      });
    return { ok: true, handler: handler, removed: removed };
  }

  return Object.freeze({
    runDaily: Calculation_OS_runDaily,
    installDailyTrigger: Calculation_OS_installDailyTrigger,
    removeDailyTrigger: Calculation_OS_removeDailyTrigger,
  });
})();

function Calculation_OS_runDaily() {
  return Calculation_OS_.runDaily();
}

function Calculation_OS_installDailyTrigger() {
  return Calculation_OS_.installDailyTrigger();
}

function Calculation_OS_removeDailyTrigger() {
  return Calculation_OS_.removeDailyTrigger();
}

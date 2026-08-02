/**
 * VacationMonthlySync.gs — one-way sync from approved vacation records into
 * monthly schedule fact cells.
 */

var VacationMonthlySync_ = (function () {
  var SYNC_VERSION = 1;
  var DEFAULT_MONTHLY_CODE = "Відпус";
  var METADATA_PROP = "WASB_VACATION_MONTHLY_SYNC_META_V1";
  var PENDING_PROP = "WASB_VACATION_MONTHLY_SYNC_PENDING_V1";
  var EXCEPTIONS_PROP = "WASB_VACATION_MONTHLY_SYNC_EXCEPTIONS_V1";
  var CHUNK_SIZE = 7600;

  function _text_(value) {
    return String(value == null ? "" : value).trim();
  }

  function _upper_(value) {
    return _text_(value).toUpperCase();
  }

  function _normCallsign_(value) {
    if (typeof _normCallsignKey_ === "function") return _normCallsignKey_(value);
    return _upper_(value);
  }

  function _normFmlKey_(value) {
    if (typeof _normFml_ === "function") return _normFml_(value);
    return _upper_(value).replace(/\s+/g, " ");
  }

  function _uniqStrings_(values) {
    var seen = {};
    var out = [];
    (values || []).forEach(function (value) {
      var text = _text_(value);
      var key = text.toUpperCase();
      if (!text || seen[key]) return;
      seen[key] = true;
      out.push(text);
    });
    return out;
  }

  function _dateStart_(value, displayValue) {
    var parsed =
      typeof DateUtils_ === "object" &&
      DateUtils_ &&
      typeof DateUtils_.toDayStart === "function"
        ? DateUtils_.toDayStart(value, displayValue)
        : null;
    if (parsed) return parsed;
    if (value instanceof Date && !isNaN(value.getTime())) {
      var dt = new Date(value);
      dt.setHours(0, 0, 0, 0);
      return dt;
    }
    return null;
  }

  function _dateKey_(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) return "";
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
  }

  function _dateLabel_(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) return "";
    if (
      typeof DateUtils_ === "object" &&
      DateUtils_ &&
      typeof DateUtils_.formatUaDate === "function"
    ) {
      return DateUtils_.formatUaDate(date);
    }
    return [
      String(date.getDate()).padStart(2, "0"),
      String(date.getMonth() + 1).padStart(2, "0"),
      date.getFullYear(),
    ].join(".");
  }

  function _dayOrdinal_(date) {
    return Math.floor(date.getTime() / 86400000);
  }

  function _monthBounds_(sheet) {
    var inferred =
      typeof _inferMonthYearFromSheet_ === "function"
        ? _inferMonthYearFromSheet_(sheet)
        : null;
    var now = new Date();
    var month = Number(inferred && inferred.month) || now.getMonth() + 1;
    var year = Number(inferred && inferred.year) || now.getFullYear();
    return {
      month: month,
      year: year,
      start: new Date(year, month - 1, 1, 0, 0, 0, 0),
      end: new Date(year, month, 0, 0, 0, 0, 0),
    };
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

  function _resolveSheet_(options) {
    var opts = options || {};
    if (opts.sheet && typeof opts.sheet.getRange === "function") return opts.sheet;
    var sheetName = _text_(opts.monthSheet || opts.sheetName);
    if (!sheetName && typeof getBotMonthSheetName_ === "function") {
      sheetName = _text_(getBotMonthSheetName_());
    }
    if (!sheetName) throw new Error("Не передано місячний аркуш для синхронізації відпусток");
    var sheet = _spreadsheet_().getSheetByName(sheetName);
    if (!sheet) throw new Error("Місячний аркуш \"" + sheetName + "\" не знайдено");
    return sheet;
  }

  function _docProps_() {
    if (
      typeof PropertiesService === "undefined" ||
      !PropertiesService ||
      typeof PropertiesService.getDocumentProperties !== "function"
    ) {
      return null;
    }
    return PropertiesService.getDocumentProperties();
  }

  function _deleteChunked_(props, key) {
    if (!props) return;
    var count = Number(props.getProperty(key + ":chunks") || 0);
    for (var i = 0; i < count; i++) props.deleteProperty(key + ":" + i);
    props.deleteProperty(key + ":chunks");
    props.deleteProperty(key);
  }

  function _readJson_(key, fallback) {
    var props = _docProps_();
    if (!props) return fallback;
    var raw = "";
    var count = Number(props.getProperty(key + ":chunks") || 0);
    if (count > 0) {
      for (var i = 0; i < count; i++) raw += props.getProperty(key + ":" + i) || "";
    } else {
      raw = props.getProperty(key) || "";
    }
    if (!raw) return fallback;
    try {
      return JSON.parse(raw);
    } catch (_) {
      return fallback;
    }
  }

  function _writeJson_(key, value) {
    var props = _docProps_();
    if (!props) return;
    var raw = JSON.stringify(value || {});
    _deleteChunked_(props, key);
    if (raw.length <= CHUNK_SIZE) {
      props.setProperty(key, raw);
      return;
    }
    var chunks = Math.ceil(raw.length / CHUNK_SIZE);
    props.setProperty(key + ":chunks", String(chunks));
    for (var i = 0; i < chunks; i++) {
      props.setProperty(key + ":" + i, raw.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
    }
  }

  function _readMetadata_() {
    var raw = _readJson_(METADATA_PROP, {});
    return raw && typeof raw === "object" ? raw : {};
  }

  function _writeMetadata_(metadata) {
    _writeJson_(METADATA_PROP, metadata || {});
  }

  function _readExceptions_() {
    var raw = _readJson_(EXCEPTIONS_PROP, {});
    return raw && typeof raw === "object" ? raw : {};
  }

  function _writeExceptions_(exceptions) {
    _writeJson_(EXCEPTIONS_PROP, exceptions || {});
  }

  function _deletePending_() {
    var props = _docProps_();
    if (props) _deleteChunked_(props, PENDING_PROP);
  }

  function _readPending_() {
    var raw = _readJson_(PENDING_PROP, null);
    return raw && typeof raw === "object" ? raw : null;
  }

  function _writePending_(plan) {
    if (!plan || !plan.pendingUserDecision) {
      _deletePending_();
      return;
    }
    _writeJson_(PENDING_PROP, _compactPendingPlan_(plan));
  }

  function _validationAllowedValues_(rule) {
    if (!rule || typeof rule.getCriteriaValues !== "function") return [];
    var values = [];
    try {
      var criteriaValues = rule.getCriteriaValues() || [];
      criteriaValues.forEach(function (item) {
        if (Array.isArray(item)) {
          values = values.concat(item);
          return;
        }
        if (item && typeof item.getDisplayValues === "function") {
          var grid = item.getDisplayValues() || [];
          grid.forEach(function (row) {
            (row || []).forEach(function (cell) {
              values.push(cell);
            });
          });
        }
      });
    } catch (_) {
      return [];
    }
    return _uniqStrings_(values);
  }

  function _vacationWriteCandidates_(vacation) {
    return _uniqStrings_([
      DEFAULT_MONTHLY_CODE,
      vacation && vacation.monthlyCode,
      vacation && vacation.factCode,
      vacation && vacation.vacationType,
      vacation && vacation.type,
      vacation && vacation.vacationNo,
      "Відпустка",
    ]);
  }

  function _resolveMonthlyCode_(vacation, validationRule) {
    var candidates = _vacationWriteCandidates_(vacation);
    var allowed = _validationAllowedValues_(validationRule);
    if (!allowed.length) {
      return { ok: true, value: candidates[0] || DEFAULT_MONTHLY_CODE, allowed: [] };
    }
    var allowedByKey = {};
    allowed.forEach(function (value) {
      allowedByKey[_upper_(value)] = _text_(value);
    });
    for (var i = 0; i < candidates.length; i++) {
      var match = allowedByKey[_upper_(candidates[i])];
      if (match) return { ok: true, value: match, allowed: allowed };
    }
    return {
      ok: false,
      value: "",
      allowed: allowed,
      candidates: candidates,
      reason: "unsupported_validation_value",
    };
  }

  function _rangeValues_(range, method, fallback) {
    try {
      if (range && typeof range[method] === "function") return range[method]();
    } catch (_) {}
    return fallback;
  }

  function _buildMonthlyContext_(sheet) {
    var codeA1 = getMonthlyCodeRangeA1ForSheet_(sheet);
    var codeRange = sheet.getRange(codeA1);
    var values = codeRange.getValues();
    var displayValues = _rangeValues_(codeRange, "getDisplayValues", values);
    var validations = _rangeValues_(codeRange, "getDataValidations", []);
    var notes = _rangeValues_(codeRange, "getNotes", []);
    var startRow = Number(codeRange.getRow()) || 2;
    var startCol = Number(codeRange.getColumn()) || 1;
    var numRows = Number(codeRange.getNumRows()) || values.length;
    var numCols = Number(codeRange.getNumColumns()) || (values[0] || []).length;
    var dateRow =
      Number((typeof CONFIG !== "undefined" && CONFIG && CONFIG.DATE_ROW) || 1) || 1;
    var header = sheet.getRange(dateRow, startCol, 1, numCols);
    var headerValues = header.getValues()[0] || [];
    var headerDisplay = _rangeValues_(header, "getDisplayValues", [headerValues])[0] || [];
    var dates = headerValues.map(function (value, index) {
      return _dateStart_(value, headerDisplay[index]);
    });
    var callsignCol = getMonthlyCallsignColForSheet_(sheet);
    var fmlCol = getMonthlyFmlColForSheet_(sheet);
    var callsigns =
      callsignCol > 0
        ? sheet.getRange(startRow, callsignCol, numRows, 1).getDisplayValues()
        : [];
    var fmls =
      fmlCol > 0 ? sheet.getRange(startRow, fmlCol, numRows, 1).getDisplayValues() : [];
    var rows = [];
    var rowsByCallsign = {};
    var rowsByFml = {};
    for (var r = 0; r < numRows; r++) {
      var callsign = _text_((callsigns[r] || [])[0]);
      var fml = _text_((fmls[r] || [])[0]);
      var rowInfo = {
        rowIndex: r,
        rowNumber: startRow + r,
        callsign: callsign,
        fml: fml,
      };
      rows.push(rowInfo);
      var callsignKey = _normCallsign_(callsign);
      if (callsignKey) {
        if (!rowsByCallsign[callsignKey]) rowsByCallsign[callsignKey] = [];
        rowsByCallsign[callsignKey].push(rowInfo);
      }
      var fmlKey = _normFmlKey_(fml);
      if (fmlKey) {
        if (!rowsByFml[fmlKey]) rowsByFml[fmlKey] = [];
        rowsByFml[fmlKey].push(rowInfo);
      }
    }
    var bounds = _monthBounds_(sheet);
    return {
      sheet: sheet,
      sheetName: sheet.getName(),
      codeA1: codeA1,
      codeRange: codeRange,
      values: values,
      displayValues: displayValues,
      validations: validations,
      notes: notes,
      startRow: startRow,
      startCol: startCol,
      numRows: numRows,
      numCols: numCols,
      dateRow: dateRow,
      dates: dates,
      rows: rows,
      rowsByCallsign: rowsByCallsign,
      rowsByFml: rowsByFml,
      month: bounds.month,
      year: bounds.year,
      monthStart: bounds.start,
      monthEnd: bounds.end,
    };
  }

  function _findPersonForVacation_(vacation) {
    var person = null;
    var personnelId = _text_(
      (vacation && (vacation.personnelId || vacation.personId || vacation.armyId)) || "",
    );
    var personKey = _text_(vacation && vacation.personKey);
    var callsign = _text_(vacation && vacation.callsign);
    var fml = _text_(vacation && vacation.fml);
    try {
      if (
        personnelId &&
        typeof PersonnelRepository_ === "object" &&
        PersonnelRepository_ &&
        typeof PersonnelRepository_.getById === "function"
      ) {
        person = PersonnelRepository_.getById(personnelId);
      }
    } catch (_) {}
    try {
      if (
        !person &&
        personKey &&
        typeof PersonnelRepository_ === "object" &&
        PersonnelRepository_ &&
        typeof PersonnelRepository_.getByCallsignAnyStatus === "function"
      ) {
        person = PersonnelRepository_.getByCallsignAnyStatus(personKey);
      }
    } catch (_) {}
    try {
      if (
        !person &&
        callsign &&
        callsign !== personKey &&
        typeof PersonnelRepository_ === "object" &&
        PersonnelRepository_ &&
        typeof PersonnelRepository_.getByCallsignAnyStatus === "function"
      ) {
        person = PersonnelRepository_.getByCallsignAnyStatus(callsign);
      }
    } catch (_) {}
    try {
      if (
        !person &&
        fml &&
        typeof PersonnelRepository_ === "object" &&
        PersonnelRepository_ &&
        typeof PersonnelRepository_.getByFml === "function"
      ) {
        person = PersonnelRepository_.getByFml(fml, { activeOnly: false });
      }
    } catch (_) {}
    return person || null;
  }

  function _matchMonthlyRow_(context, vacation) {
    var person = _findPersonForVacation_(vacation);
    var callsignCandidates = _uniqStrings_([
      vacation && vacation.personKey,
      vacation && vacation.callsign,
      person && person.callsign,
    ]);
    var fmlCandidates = _uniqStrings_([vacation && vacation.fml, person && person.fml]);
    var matches = [];
    callsignCandidates.forEach(function (callsign) {
      var list = context.rowsByCallsign[_normCallsign_(callsign)] || [];
      matches = matches.concat(list);
    });
    if (!matches.length) {
      fmlCandidates.forEach(function (fml) {
        var list = context.rowsByFml[_normFmlKey_(fml)] || [];
        matches = matches.concat(list);
      });
    }
    var byRow = {};
    matches = matches.filter(function (row) {
      if (!row || byRow[row.rowNumber]) return false;
      byRow[row.rowNumber] = true;
      return true;
    });
    if (matches.length === 1) {
      return {
        ok: true,
        row: matches[0],
        person: person,
        callsign: matches[0].callsign || callsignCandidates[0] || "",
        fml: matches[0].fml || fmlCandidates[0] || "",
      };
    }
    return {
      ok: false,
      reason: matches.length > 1 ? "ambiguous_person" : "person_not_found",
      person: person,
      callsign: callsignCandidates[0] || "",
      fml: fmlCandidates[0] || "",
      matchesCount: matches.length,
    };
  }

  function _vacationRecordId_(vacation, index) {
    var meta = (vacation && vacation._meta) || {};
    return _uniqStrings_([
      vacation && vacation.id,
      vacation && vacation.requestId,
      meta.sheetName && meta.rowNumber
        ? meta.sheetName + "#" + String(meta.rowNumber)
        : "",
      _text_(vacation && vacation.fml) +
        "|" +
        _dateKey_(_dateStart_(vacation && vacation.startDate, vacation && vacation.startDateRaw)) +
        "|" +
        _dateKey_(_dateStart_(vacation && vacation.endDate, vacation && vacation.endDateRaw)),
      "vacation-" + String(index + 1),
    ])[0];
  }

  function _vacationLabel_(vacation) {
    var no = _text_(
      (vacation && (vacation.vacationNo || vacation.vacationType || vacation.type)) || "",
    );
    return no || "Відпустка";
  }

  function _isActiveVacation_(vacation) {
    if (!vacation) return false;
    if (vacation.active === false || vacation.isActive === false) return false;
    if (vacation.operationalActive === false) return false;
    if (vacation.factExpected === false) return false;
    return true;
  }

  function _entryId_(prefix, key) {
    return prefix + "-" + String(key || "").replace(/[^A-Za-z0-9А-Яа-яІіЇїЄєҐґ_-]+/g, "-");
  }

  function _cellKey_(sheetName, rowNumber, colNumber) {
    return sheetName + "!R" + rowNumber + "C" + colNumber;
  }

  function _cellA1_(context, rowNumber, colNumber) {
    if (typeof _columnNumberToLetter_ === "function") {
      return _columnNumberToLetter_(colNumber) + String(rowNumber);
    }
    return "R" + rowNumber + "C" + colNumber;
  }

  function _buildEntry_(kind, context, row, colIndex, vacation, value, currentValue) {
    var colNumber = context.startCol + colIndex;
    var date = context.dates[colIndex];
    var key = _cellKey_(context.sheetName, row.rowNumber, colNumber);
    var recordId = _vacationRecordId_(vacation, 0);
    return {
      id: _entryId_(kind, key + "-" + recordId),
      kind: kind,
      key: key,
      sheet: context.sheetName,
      a1: _cellA1_(context, row.rowNumber, colNumber),
      rowIndex: row.rowIndex,
      colIndex: colIndex,
      rowNumber: row.rowNumber,
      columnNumber: colNumber,
      dateKey: _dateKey_(date),
      dateLabel: _dateLabel_(date),
      callsign: row.callsign || _text_(vacation && vacation.personKey),
      fml: row.fml || _text_(vacation && vacation.fml),
      vacationRecordId: recordId,
      vacationLabel: _vacationLabel_(vacation),
      previousValue: _text_(currentValue),
      newValue: _text_(value),
      sourceSheet:
        vacation && vacation._meta && vacation._meta.sheetName
          ? vacation._meta.sheetName
          : "",
      sourceRow:
        vacation && vacation._meta && vacation._meta.rowNumber
          ? vacation._meta.rowNumber
          : 0,
    };
  }

  function _exceptionKey_(entry) {
    return [entry.sheet, entry.rowNumber, entry.columnNumber, entry.vacationRecordId].join("|");
  }

  function _hasException_(exceptions, entry) {
    return !!(exceptions && exceptions[_exceptionKey_(entry)]);
  }

  function _buildPlan_(options) {
    var sheet = _resolveSheet_(options || {});
    var context = _buildMonthlyContext_(sheet);
    var vacations =
      typeof VacationsRepository_ === "object" &&
      VacationsRepository_ &&
      typeof VacationsRepository_.listAll === "function"
        ? VacationsRepository_.listAll()
        : [];
    var metadata = _readMetadata_();
    var exceptions = _readExceptions_();
    var now = new Date().toISOString();
    var plan = {
      ok: true,
      version: SYNC_VERSION,
      planId: "vac-month-" + context.sheetName + "-" + Date.now(),
      generatedAt: now,
      source: _text_((options && options.source) || "manual"),
      sheet: context.sheetName,
      month: context.month,
      year: context.year,
      codeRangeA1: context.codeA1,
      stats: {
        sourceRows: vacations.length,
        considered: 0,
        autoFill: 0,
        unchanged: 0,
        conflicts: 0,
        removals: 0,
        unresolved: 0,
        invalid: 0,
        unsupported: 0,
        exceptions: 0,
      },
      autoFill: [],
      conflicts: [],
      removals: [],
      unresolved: [],
      invalid: [],
      unsupported: [],
      warnings: [],
      desiredKeys: {},
    };

    vacations.forEach(function (vacation, vacationIndex) {
      if (!_isActiveVacation_(vacation)) return;
      plan.stats.considered++;
      var start = _dateStart_(vacation.startDate, vacation.startDateRaw);
      var end = _dateStart_(vacation.endDate, vacation.endDateRaw);
      var recordId = _vacationRecordId_(vacation, vacationIndex);
      if (!start || !end || _dayOrdinal_(end) < _dayOrdinal_(start)) {
        plan.invalid.push({
          vacationRecordId: recordId,
          fml: _text_(vacation && vacation.fml),
          reason: "invalid_date_range",
          message: "Некоректні дати відпустки",
        });
        plan.stats.invalid++;
        return;
      }
      if (_dayOrdinal_(end) < _dayOrdinal_(context.monthStart)) return;
      if (_dayOrdinal_(start) > _dayOrdinal_(context.monthEnd)) return;
      var matched = _matchMonthlyRow_(context, vacation);
      if (!matched.ok) {
        plan.unresolved.push({
          vacationRecordId: recordId,
          fml: matched.fml,
          callsign: matched.callsign,
          reason: matched.reason,
          message:
            matched.reason === "ambiguous_person"
              ? "Знайдено декілька рядків у місячному графіку"
              : "Особу не знайдено у місячному графіку",
        });
        plan.stats.unresolved++;
        return;
      }
      for (var c = 0; c < context.dates.length; c++) {
        var date = context.dates[c];
        if (!date) continue;
        var day = _dayOrdinal_(date);
        if (day < _dayOrdinal_(start) || day > _dayOrdinal_(end)) continue;
        var rule = ((context.validations[matched.row.rowIndex] || [])[c]) || null;
        var code = _resolveMonthlyCode_(vacation, rule);
        if (!code.ok) {
          plan.unsupported.push({
            vacationRecordId: recordId,
            fml: matched.fml,
            callsign: matched.callsign,
            dateLabel: _dateLabel_(date),
            allowed: code.allowed,
            candidates: code.candidates,
            message: "Код відпустки не дозволений dropdown-списком місячного графіку",
          });
          plan.stats.unsupported++;
          continue;
        }
        var current = _text_((context.displayValues[matched.row.rowIndex] || [])[c]);
        var entry = _buildEntry_(
          current ? "conflict" : "auto",
          context,
          matched.row,
          c,
          vacation,
          code.value,
          current,
        );
        entry.vacationRecordId = recordId;
        entry.id = _entryId_(entry.kind, entry.key + "-" + recordId);
        if (plan.desiredKeys[entry.key]) {
          plan.conflicts.push(
            Object.assign({}, entry, {
              kind: "duplicate",
              previousValue: current,
              message: "На одну клітинку припадає декілька відпусток",
            }),
          );
          plan.stats.conflicts++;
          continue;
        }
        plan.desiredKeys[entry.key] = true;
        if (!current) {
          if (_hasException_(exceptions, entry)) {
            plan.stats.exceptions++;
            continue;
          }
          plan.autoFill.push(entry);
          plan.stats.autoFill++;
        } else if (_upper_(current) === _upper_(code.value)) {
          plan.stats.unchanged++;
        } else if (_hasException_(exceptions, entry)) {
          plan.stats.exceptions++;
        } else {
          entry.message = "Клітинка вже заповнена іншим значенням";
          plan.conflicts.push(entry);
          plan.stats.conflicts++;
        }
      }
    });

    Object.keys(metadata || {}).forEach(function (key) {
      var item = metadata[key];
      if (!item || item.source !== "VACATION") return;
      if (item.sheet !== context.sheetName) return;
      if (item.year !== context.year || item.month !== context.month) return;
      if (plan.desiredKeys[key]) return;
      var rowIndex = Number(item.rowNumber) - context.startRow;
      var colIndex = Number(item.columnNumber) - context.startCol;
      if (
        rowIndex < 0 ||
        colIndex < 0 ||
        rowIndex >= context.numRows ||
        colIndex >= context.numCols
      ) {
        return;
      }
      var current = _text_((context.displayValues[rowIndex] || [])[colIndex]);
      if (_upper_(current) !== _upper_(item.value)) return;
      var row = context.rows[rowIndex] || {
        rowIndex: rowIndex,
        rowNumber: item.rowNumber,
        callsign: item.callsign || "",
        fml: item.fml || "",
      };
      var removal = {
        id: _entryId_("remove", key + "-" + String(item.vacationRecordId || "")),
        kind: "removal",
        key: key,
        sheet: context.sheetName,
        a1: _cellA1_(context, row.rowNumber, item.columnNumber),
        rowIndex: rowIndex,
        colIndex: colIndex,
        rowNumber: item.rowNumber,
        columnNumber: item.columnNumber,
        dateKey: item.dateKey || _dateKey_(context.dates[colIndex]),
        dateLabel: item.dateLabel || _dateLabel_(context.dates[colIndex]),
        callsign: item.callsign || row.callsign || "",
        fml: item.fml || row.fml || "",
        vacationRecordId: item.vacationRecordId || "",
        vacationLabel: item.vacationLabel || "Відпустка",
        previousValue: current,
        newValue: "",
        message: "У джерелі відпусток більше немає активного запису для цієї клітинки",
      };
      if (_hasException_(exceptions, removal)) {
        plan.stats.exceptions++;
        return;
      }
      plan.removals.push(removal);
      plan.stats.removals++;
    });

    plan.pendingUserDecision = plan.conflicts.length > 0 || plan.removals.length > 0;
    plan.groups = _groupPending_(plan);
    return { plan: plan, context: context, metadata: metadata };
  }

  function _metadataForEntry_(entry) {
    return {
      source: "VACATION",
      version: SYNC_VERSION,
      sheet: entry.sheet,
      month: Number(entry.dateKey.slice(5, 7)) || 0,
      year: Number(entry.dateKey.slice(0, 4)) || 0,
      key: entry.key,
      a1: entry.a1,
      rowNumber: entry.rowNumber,
      columnNumber: entry.columnNumber,
      dateKey: entry.dateKey,
      dateLabel: entry.dateLabel,
      callsign: entry.callsign,
      fml: entry.fml,
      value: entry.newValue,
      vacationRecordId: entry.vacationRecordId,
      vacationLabel: entry.vacationLabel,
      sourceSheet: entry.sourceSheet || "",
      sourceRow: entry.sourceRow || 0,
      appliedAt: new Date().toISOString(),
    };
  }

  function _applyAutoFill_(bundle) {
    var plan = bundle.plan;
    var context = bundle.context;
    var metadata = bundle.metadata || {};
    if (!plan.autoFill.length) return 0;
    plan.autoFill.forEach(function (entry) {
      context.values[entry.rowIndex][entry.colIndex] = entry.newValue;
      metadata[entry.key] = _metadataForEntry_(entry);
    });
    context.codeRange.setValues(context.values);
    _writeMetadata_(metadata);
    return plan.autoFill.length;
  }

  function _groupPending_(plan) {
    var groupsByKey = {};
    function add(entry) {
      var key =
        _upper_(entry.callsign || entry.fml) +
        "|" +
        String(entry.vacationRecordId || entry.vacationLabel || "");
      if (!groupsByKey[key]) {
        groupsByKey[key] = {
          person: entry.callsign || entry.fml || "—",
          fml: entry.fml || "",
          vacationRecordId: entry.vacationRecordId || "",
          vacationLabel: entry.vacationLabel || "Відпустка",
          conflicts: [],
          removals: [],
        };
      }
      if (entry.kind === "removal") groupsByKey[key].removals.push(entry);
      else groupsByKey[key].conflicts.push(entry);
    }
    (plan.conflicts || []).forEach(add);
    (plan.removals || []).forEach(add);
    return Object.keys(groupsByKey).map(function (key) {
      return groupsByKey[key];
    });
  }

  function _compactEntry_(entry) {
    return {
      id: entry.id,
      kind: entry.kind,
      key: entry.key,
      sheet: entry.sheet,
      a1: entry.a1,
      rowIndex: entry.rowIndex,
      colIndex: entry.colIndex,
      rowNumber: entry.rowNumber,
      columnNumber: entry.columnNumber,
      dateKey: entry.dateKey,
      dateLabel: entry.dateLabel,
      callsign: entry.callsign,
      fml: entry.fml,
      vacationRecordId: entry.vacationRecordId,
      vacationLabel: entry.vacationLabel,
      previousValue: entry.previousValue,
      newValue: entry.newValue,
      message: entry.message || "",
      sourceSheet: entry.sourceSheet || "",
      sourceRow: entry.sourceRow || 0,
    };
  }

  function _compactPendingPlan_(plan) {
    var compactConflicts = (plan.conflicts || []).map(_compactEntry_);
    var compactRemovals = (plan.removals || []).map(_compactEntry_);
    var compact = {
      ok: plan.ok !== false,
      version: plan.version,
      planId: plan.planId,
      generatedAt: plan.generatedAt,
      source: plan.source,
      sheet: plan.sheet,
      month: plan.month,
      year: plan.year,
      codeRangeA1: plan.codeRangeA1,
      stats: plan.stats,
      pendingUserDecision: compactConflicts.length > 0 || compactRemovals.length > 0,
      conflicts: compactConflicts,
      removals: compactRemovals,
      unresolved: plan.unresolved || [],
      invalid: plan.invalid || [],
      unsupported: plan.unsupported || [],
      warnings: plan.warnings || [],
    };
    compact.groups = _groupPending_(compact);
    return compact;
  }

  function _summarizeForReturn_(plan) {
    var out = _compactPendingPlan_(plan);
    out.autoFillApplied = Number(plan.autoFillApplied || 0);
    out.autoFill = (plan.autoFill || []).slice(0, 20).map(_compactEntry_);
    out.pendingUserDecision = out.conflicts.length > 0 || out.removals.length > 0;
    return out;
  }

  function sync(options) {
    var runner = function () {
      var bundle = _buildPlan_(options || {});
      var applied = (options && options.applyAutoFill === false) ? 0 : _applyAutoFill_(bundle);
      bundle.plan.autoFillApplied = applied;
      _writePending_(bundle.plan);
      return _summarizeForReturn_(bundle.plan);
    };
    if (typeof withScriptLock_ === "function") return withScriptLock_(runner, 30000);
    return runner();
  }

  function preview(options) {
    var bundle = _buildPlan_(Object.assign({}, options || {}, { applyAutoFill: false }));
    return _summarizeForReturn_(bundle.plan);
  }

  function _appendServiceNote_(existing, entry, action, reason) {
    var lines = [
      "[WASB VACATION SYNC]",
      "Дата рішення: " + new Date().toISOString(),
      "Дія: " + action,
      "Джерело: " + (entry.sourceSheet || "VACATION") + (entry.sourceRow ? " рядок " + entry.sourceRow : ""),
      "Відпустка: " + (entry.vacationLabel || "Відпустка"),
      "Дата графіку: " + (entry.dateLabel || entry.dateKey || ""),
      "Попереднє значення: " + (entry.previousValue || "порожньо"),
      "Нове значення: " + (entry.newValue || "порожньо"),
    ];
    if (reason) lines.push("Коментар: " + reason);
    var block = lines.join("\n");
    return existing ? String(existing) + "\n\n" + block : block;
  }

  function _selectedIds_(payload, pending) {
    var ids = payload && Array.isArray(payload.ids) ? payload.ids : [];
    if (!ids.length && payload && payload.id) ids = [payload.id];
    var selected = {};
    ids.forEach(function (id) {
      selected[String(id)] = true;
    });
    var allEntries = (pending.conflicts || []).concat(pending.removals || []);
    if (!ids.length || String(payload && payload.action || "").toLowerCase().indexOf("all") !== -1) {
      allEntries.forEach(function (entry) {
        selected[String(entry.id)] = true;
      });
    }
    return selected;
  }

  function _resolveAction_(payload) {
    var action = _text_(payload && payload.action).toLowerCase();
    if (!action) action = "apply";
    if (action === "applyall") return "apply";
    if (action === "deferall") return "defer";
    if (action === "exceptionall") return "exception";
    if (action === "apply" || action === "defer" || action === "exception") return action;
    throw new Error("Невідома дія для конфліктів відпусток: " + action);
  }

  function resolveDecisions(payload) {
    var runner = function () {
      var pending = _readPending_();
      if (!pending || !pending.pendingUserDecision) {
        return {
          ok: true,
          message: "Немає активних конфліктів синхронізації відпусток",
          applied: 0,
          deferred: 0,
          exceptions: 0,
          skipped: 0,
          remaining: 0,
        };
      }
      var expectedPlanId = _text_(payload && payload.planId);
      if (expectedPlanId && expectedPlanId !== pending.planId) {
        throw new Error("План синхронізації відпусток застарів. Запустіть оновлення ще раз.");
      }
      var action = _resolveAction_(payload || {});
      var selected = _selectedIds_(payload || {}, pending);
      var reason = _text_((payload && payload.reason) || "");
      var sheet = _resolveSheet_({ monthSheet: pending.sheet });
      var context = _buildMonthlyContext_(sheet);
      var metadata = _readMetadata_();
      var exceptions = _readExceptions_();
      var allEntries = (pending.conflicts || []).concat(pending.removals || []);
      var remaining = [];
      var applied = 0;
      var deferred = 0;
      var exceptionCount = 0;
      var skipped = 0;
      var valuesChanged = false;
      var notesChanged = false;
      var notes = context.notes && context.notes.length ? context.notes : context.values.map(function (row) {
        return row.map(function () {
          return "";
        });
      });

      allEntries.forEach(function (entry) {
        if (!selected[String(entry.id)]) {
          remaining.push(entry);
          return;
        }
        if (action === "defer") {
          deferred++;
          return;
        }
        if (action === "exception") {
          exceptions[_exceptionKey_(entry)] = {
            entry: _compactEntry_(entry),
            reason: reason,
            createdAt: new Date().toISOString(),
          };
          exceptionCount++;
          return;
        }
        var rowIndex = Number(entry.rowIndex);
        var colIndex = Number(entry.colIndex);
        if (
          rowIndex < 0 ||
          colIndex < 0 ||
          rowIndex >= context.values.length ||
          colIndex >= (context.values[rowIndex] || []).length
        ) {
          skipped++;
          return;
        }
        var current = _text_((context.displayValues[rowIndex] || [])[colIndex]);
        if (_upper_(current) !== _upper_(entry.previousValue)) {
          skipped++;
          remaining.push(entry);
          return;
        }
        context.values[rowIndex][colIndex] = entry.newValue || "";
        valuesChanged = true;
        notes[rowIndex][colIndex] = _appendServiceNote_(
          (notes[rowIndex] || [])[colIndex] || "",
          entry,
          entry.kind === "removal" ? "clear" : "replace",
          reason,
        );
        notesChanged = true;
        if (entry.kind === "removal") {
          delete metadata[entry.key];
        } else {
          metadata[entry.key] = _metadataForEntry_(entry);
        }
        applied++;
      });

      if (valuesChanged) context.codeRange.setValues(context.values);
      if (notesChanged && typeof context.codeRange.setNotes === "function") {
        context.codeRange.setNotes(notes);
      }
      _writeMetadata_(metadata);
      _writeExceptions_(exceptions);

      var nextPending = Object.assign({}, pending, {
        conflicts: remaining.filter(function (entry) {
          return entry.kind !== "removal";
        }),
        removals: remaining.filter(function (entry) {
          return entry.kind === "removal";
        }),
      });
      nextPending.pendingUserDecision =
        nextPending.conflicts.length > 0 || nextPending.removals.length > 0;
      nextPending.groups = _groupPending_(nextPending);
      if (nextPending.pendingUserDecision) _writeJson_(PENDING_PROP, nextPending);
      else _deletePending_();

      return {
        ok: true,
        message: "Рішення щодо синхронізації відпусток застосовано",
        planId: pending.planId,
        sheet: pending.sheet,
        applied: applied,
        deferred: deferred,
        exceptions: exceptionCount,
        skipped: skipped,
        remaining: remaining.length,
        pending: nextPending.pendingUserDecision ? nextPending : null,
      };
    };
    if (typeof withScriptLock_ === "function") return withScriptLock_(runner, 30000);
    return runner();
  }

  return {
    sync: sync,
    preview: preview,
    resolveDecisions: resolveDecisions,
    getPendingPlan: _readPending_,
    _buildPlanForTests: _buildPlan_,
    _validationAllowedValuesForTests: _validationAllowedValues_,
  };
})();

function syncVacationsWithMonthlySheet_(options) {
  return VacationMonthlySync_.sync(options || {});
}

function resolveVacationMonthlySyncDecisions_(payload) {
  return VacationMonthlySync_.resolveDecisions(payload || {});
}

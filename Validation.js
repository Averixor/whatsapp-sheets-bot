/**
 * Validation.gs — reusable validation / guard layer для stage 4.
 */

function _stage4Assert_(condition, functionName, context, message) {
  if (!condition) {
    throw buildContextError_(functionName || 'Validation', context || {}, message || 'Validation failed');
  }
}

function parseFlexibleDateInput_(value) {
  const safe = String(value || '').trim();
  if (!safe) return null;

  if (/^\d{2}\.\d{2}\.\d{4}$/.test(safe)) {
    const parsedUa = _parseUaDate_(safe);
    return parsedUa && !isNaN(parsedUa.getTime()) ? safe : null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(safe)) {
    const parsedIso = new Date(safe + 'T00:00:00');
    return isNaN(parsedIso.getTime()) ? null : Utilities.formatDate(parsedIso, CONFIG.TZ, 'dd.MM.yyyy');
  }

  const parsed = new Date(safe);
  return isNaN(parsed.getTime()) ? null : Utilities.formatDate(parsed, CONFIG.TZ, 'dd.MM.yyyy');
}

function assertUaDateString_(value) {
  const safe = String(value || '').trim();
  _stage4Assert_(/^\d{2}\.\d{2}\.\d{4}$/.test(safe), 'assertUaDateString_', { value: safe }, 'Очікувався формат dd.MM.yyyy');
  const parsed = _parseUaDate_(safe);
  _stage4Assert_(parsed instanceof Date && !isNaN(parsed.getTime()), 'assertUaDateString_', { value: safe }, 'Передано неіснуючу дату');
  return safe;
}

function _stage4NormalizeDateValue_(value) {
  const parsed = parseFlexibleDateInput_(value);
  _stage4Assert_(!!parsed, 'validateDatePayload_', { value: value }, 'Некоректна дата');
  return assertUaDateString_(parsed);
}

function validateDatePayload_(payload, fieldName) {
  const key = fieldName || 'date';
  const source = (payload && typeof payload === 'object') ? payload : { date: payload };
  const raw = source[key] || source.dateStr || source.date;
  const dateStr = _stage4NormalizeDateValue_(raw);
  const parsed = _parseUaDate_(dateStr);
  _stage4Assert_(parsed instanceof Date && !isNaN(parsed.getTime()), 'validateDatePayload_', { field: key, value: raw }, `Не вдалося розпізнати дату "${raw}"`);
  return {
    dateStr: dateStr,
    date: parsed,
    payload: Object.assign({}, source, { date: dateStr, dateStr: dateStr }),
    warnings: []
  };
}

function validateDateRangePayload_(payload) {
  const source = payload || {};
  const startRaw = source.startDate || source.dateFrom || source.start || source.date;
  const endRaw = source.endDate || source.dateTo || source.end || source.date || startRaw;
  const start = validateDatePayload_({ date: startRaw }, 'date');
  const end = validateDatePayload_({ date: endRaw }, 'date');

  _stage4Assert_(start.date.getTime() <= end.date.getTime(), 'validateDateRangePayload_', source, 'Дата початку більша за дату завершення');

  const diffDays = Math.floor((end.date.getTime() - start.date.getTime()) / 86400000) + 1;
  _stage4Assert_(diffDays <= STAGE4_CONFIG.MAX_RANGE_DAYS, 'validateDateRangePayload_', { startDate: start.dateStr, endDate: end.dateStr }, `Діапазон занадто великий: ${diffDays} дн.`);

  return {
    startDate: start.dateStr,
    endDate: end.dateStr,
    days: diffDays,
    payload: Object.assign({}, source, {
      startDate: start.dateStr,
      endDate: end.dateStr,
      dateFrom: start.dateStr,
      dateTo: end.dateStr
    }),
    warnings: diffDays > 14 ? [`Великий діапазон: ${diffDays} дн.`] : []
  };
}

function validatePanelRowSelection_(rowNumbers, options) {
  const opts = options || {};
  const rows = stage4AsArray_(rowNumbers)
    .map(function(v) { return Number(v); })
    .filter(function(v) { return Number.isFinite(v); });

  const uniqueRows = [...new Set(rows)].sort(function(a, b) { return a - b; });
  _stage4Assert_(uniqueRows.length > 0, 'validatePanelRowSelection_', {}, 'Не передано жодного рядка SEND_PANEL');
  _stage4Assert_(uniqueRows.length <= (Number(opts.maxRows) || STAGE4_CONFIG.MAX_BATCH_ROWS), 'validatePanelRowSelection_', { count: uniqueRows.length }, `Забагато рядків для batch-операції: ${uniqueRows.length}`);

  const panel = DataAccess_.getSheet('SEND_PANEL', null, false);
  if (panel) {
    const schema = SheetSchemas_.get('SEND_PANEL');
    const minRow = Number(schema.dataStartRow) || 3;
    const maxRow = Math.max(panel.getLastRow(), minRow - 1);
    const validRows = uniqueRows.filter(function(row) { return row >= minRow && row <= maxRow; });
    _stage4Assert_(validRows.length > 0, 'validatePanelRowSelection_', { count: uniqueRows.length }, 'Усі рядки поза межами SEND_PANEL');
    return {
      rows: validRows,
      warnings: validRows.length !== uniqueRows.length ? ['Частина рядків була відкинута як некоректна'] : []
    };
  }

  return { rows: uniqueRows, warnings: [] };
}

function validatePersonLookupPayload_(payload) {
  const source = payload || {};
  const callsign = String(source.callsign || source.person || '').trim();
  _stage4Assert_(!!callsign, 'validatePersonLookupPayload_', source, 'Не передано позивний');
  const dateInfo = validateDatePayload_(source, 'date');
  return {
    callsign: callsign,
    dateStr: dateInfo.dateStr,
    payload: Object.assign({}, source, { callsign: callsign, date: dateInfo.dateStr, dateStr: dateInfo.dateStr }),
    warnings: []
  };
}

function validateSendOperation_(payload) {
  const source = payload || {};
  const dryRun = !!source.dryRun;
  const limit = Number(source.limit) || STAGE4_CONFIG.MAX_BATCH_ROWS;
  _stage4Assert_(limit > 0 && limit <= STAGE4_CONFIG.MAX_BATCH_ROWS, 'validateSendOperation_', source, `Некоректний limit: ${limit}`);
  return {
    dryRun: dryRun,
    limit: limit,
    allowAlreadySent: !!source.allowAlreadySent,
    payload: Object.assign({}, source, { dryRun: dryRun, limit: limit }),
    warnings: dryRun ? ['Операція виконана в dry-run режимі'] : []
  };
}

function validateMonthSwitch_(monthSheetName) {
  const month = String(monthSheetName || '').trim();
  _stage4Assert_(/^\d{2}$/.test(month), 'validateMonthSwitch_', { month: month }, `Некоректна назва місяця "${month}"`);
  const sh = SpreadsheetApp.getActive().getSheetByName(month);
  _stage4Assert_(!!sh, 'validateMonthSwitch_', { month: month }, `Аркуш "${month}" не знайдено`);
  return {
    month: month,
    sheet: sh,
    warnings: []
  };
}

function validateRepairOperation_(payload) {
  const source = payload || {};
  const mode = String(source.mode || 'check').trim();
  _stage4Assert_(['check', 'report', 'repair', 'previewRepair', 'repairSelectedIssues', 'repairWithVerification'].indexOf(mode) !== -1, 'validateRepairOperation_', source, `Некоректний mode="${mode}"`);

  const dateInfo = validateDatePayload_(source, 'date');
  const repairLikeMode = ['repair', 'previewRepair', 'repairSelectedIssues', 'repairWithVerification'].indexOf(mode) !== -1;
  const dryRun = source.dryRun === undefined
    ? (repairLikeMode ? !!stage4GetFeatureFlag_('dryRunByDefaultForRepair', true) : false)
    : !!source.dryRun;

  const limit = Number(source.limit) || STAGE4_CONFIG.MAX_REPAIR_ITEMS;
  _stage4Assert_(limit > 0 && limit <= STAGE4_CONFIG.MAX_REPAIR_ITEMS, 'validateRepairOperation_', source, `Некоректний repair limit: ${limit}`);

  return {
    mode: mode,
    dryRun: dryRun,
    dateStr: dateInfo.dateStr,
    limit: limit,
    payload: Object.assign({}, source, {
      mode: mode,
      dryRun: dryRun,
      date: dateInfo.dateStr,
      dateStr: dateInfo.dateStr,
      limit: limit
    }),
    warnings: dryRun ? ['Repair переведено в dry-run'] : []
  };
}
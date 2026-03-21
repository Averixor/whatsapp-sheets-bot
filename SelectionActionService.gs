
/**
 * SelectionActionService.gs — stage 5 spreadsheet/manual selection domain service.
 */

const SelectionActionService_ = (function() {
  function _getContext() {
    const sheet = SpreadsheetApp.getActiveSheet();
    const range = sheet ? sheet.getActiveRange() : null;
    const botName = getBotMonthSheetName_();

    if (!sheet) throw new Error('Активний аркуш не знайдено');
    if (sheet.getName() !== botName) throw new Error(`Тільки аркуш "${botName}"`);

    return {
      sheet: sheet,
      range: range,
      botName: botName,
      codeRange: sheet.getRange(CONFIG.CODE_RANGE_A1)
    };
  }

  function _getDateForActiveColumn(sheet, col) {
    const dateCell = sheet.getRange(Number(CONFIG.DATE_ROW) || 1, col);
    return normalizeDate_(dateCell.getValue(), dateCell.getDisplayValue());
  }

  function prepareSingleSelection() {
    const ctx = _getContext();
    if (!ctx.range || ctx.range.getNumRows() !== 1 || ctx.range.getNumColumns() !== 1) {
      throw new Error('Виділіть ОДНУ клітинку');
    }

    const payload = buildPayloadForCell_(
      ctx.sheet,
      ctx.range.getRow(),
      ctx.range.getColumn(),
      loadPhonesMap_(),
      loadDictMap_()
    );

    return {
      selectionType: 'single',
      sheetName: ctx.sheet.getName(),
      date: payload.reportDateStr || _getDateForActiveColumn(ctx.sheet, ctx.range.getColumn()),
      payload: payload
    };
  }

  function prepareMultipleSelection() {
    const ctx = _getContext();
    const ranges = getSelectedRanges_(ctx.sheet);
    if (!ranges.length) throw new Error('Нічого не виділено');

    const res = collectPayloads_(ctx.sheet, ranges);
    return {
      selectionType: 'multiple',
      sheetName: ctx.sheet.getName(),
      rangesCount: ranges.length,
      payloads: res.payloads || [],
      errors: res.errors || []
    };
  }

  function prepareRangeMessages() {
    const ctx = _getContext();
    if (!ctx.range) throw new Error('Виділіть область');
    if (!rangesIntersect_(ctx.range, ctx.codeRange)) {
      throw new Error(`Область повинна перетинати ${CONFIG.CODE_RANGE_A1}`);
    }

    const res = collectPayloads_(ctx.sheet, [ctx.range]);
    return {
      selectionType: 'range',
      sheetName: ctx.sheet.getName(),
      payloads: res.payloads || [],
      errors: res.errors || [],
      rangeA1: ctx.range.getA1Notation()
    };
  }

  function prepareGroupedMessages() {
    const multi = prepareMultipleSelection();
    const groups = groupPayloadsByPhone_(multi.payloads || []);
    const aggregated = [];

    groups.forEach(function(group) {
      buildAggregatedPayloadsForPhone_(group.phone, group.items).forEach(function(item) {
        aggregated.push(item);
      });
    });

    return {
      selectionType: 'grouped',
      sheetName: multi.sheetName,
      payloads: aggregated,
      errors: multi.errors || [],
      groupsCount: groups.length
    };
  }

  function _resolvePayloadBundle(mode) {
    const kind = String(mode || 'selection').trim();
    if (kind === 'selection' || kind === 'single') {
      const one = prepareSingleSelection();
      return {
        selectionType: one.selectionType,
        sheetName: one.sheetName,
        payloads: [one.payload],
        errors: []
      };
    }
    if (kind === 'multiple') return prepareMultipleSelection();
    if (kind === 'range') return prepareRangeMessages();
    if (kind === 'grouped') return prepareGroupedMessages();
    throw new Error(`Невідомий selection mode: ${kind}`);
  }

  function prepareCommanderSummaryPreview(options) {
    const opts = options || {};
    const ctx = _getContext();
    const col = opts.col || (ctx.range ? ctx.range.getColumn() : ctx.codeRange.getColumn());
    if (col < ctx.codeRange.getColumn() || col > ctx.codeRange.getLastColumn()) {
      throw new Error(`Стовпець поза ${CONFIG.CODE_RANGE_A1}`);
    }

    const dateStr = opts.date || _getDateForActiveColumn(ctx.sheet, col);
    return SummaryService_.buildCommanderPreview(dateStr);
  }

  function prepareCommanderSummaryLink(options) {
    return SummaryService_.buildCommanderLink((prepareCommanderSummaryPreview(options || {})).date);
  }

  function logPayloads(payloads) {
    const list = Array.isArray(payloads) ? payloads.filter(Boolean) : [];
    if (!list.length) return { count: 0 };
    writeLogsBatch_(list);
    return { count: list.length };
  }

  function runDiagnostics() {
    const ctx = _getContext();
    const ranges = getSelectedRanges_(ctx.sheet);
    const multi = ranges.length ? collectPayloads_(ctx.sheet, ranges) : { payloads: [], errors: [] };
    const commanderPhone = findPhoneByRole_(CONFIG.COMMANDER_ROLE) || '';

    return {
      kind: 'selectionDiagnostics',
      sheet: ctx.sheet.getName(),
      botSheet: ctx.botName,
      activeRange: ctx.range ? ctx.range.getA1Notation() : '',
      selectedRanges: ranges.map(function(item) { return item.getA1Notation(); }),
      selectedRangesCount: ranges.length,
      payloadCount: (multi.payloads || []).length,
      errorCount: (multi.errors || []).length,
      commanderRole: CONFIG.COMMANDER_ROLE,
      commanderPhonePresent: !!commanderPhone,
      commanderPhoneMasked: commanderPhone ? String(commanderPhone).replace(/.(?=.{4})/g, '•') : '',
      codeRange: CONFIG.CODE_RANGE_A1
    };
  }

  return {
    prepareSingleSelection: prepareSingleSelection,
    prepareMultipleSelection: prepareMultipleSelection,
    prepareRangeMessages: prepareRangeMessages,
    prepareGroupedMessages: prepareGroupedMessages,
    resolvePayloadBundle: _resolvePayloadBundle,
    prepareCommanderSummaryPreview: prepareCommanderSummaryPreview,
    prepareCommanderSummaryLink: prepareCommanderSummaryLink,
    logPayloads: logPayloads,
    runDiagnostics: runDiagnostics
  };
})();
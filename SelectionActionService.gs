
/**
 * SelectionActionService.gs — stage 7 spreadsheet/manual selection domain service.
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
      codeRange: sheet.getRange(getMonthlyCodeRangeA1ForSheet_(sheet))
    };
  }

  function _getDateForActiveColumn(sheet, col) {
    const dateCell = sheet.getRange(Number(CONFIG.DATE_ROW) || 1, col);
    return DateUtils_.normalizeDate(dateCell.getValue(), dateCell.getDisplayValue());
  }


  function getSelectedRanges_(sheet) {
    const activeSheet = sheet || SpreadsheetApp.getActiveSheet();
    if (!activeSheet) return [];

    try {
      const rangeList = SpreadsheetApp.getActiveRangeList && SpreadsheetApp.getActiveRangeList();
      if (rangeList && typeof rangeList.getRanges === 'function') {
        return rangeList.getRanges().filter(function(range) {
          return range && range.getSheet && range.getSheet().getName() === activeSheet.getName();
        });
      }
    } catch (_) {}

    try {
      const range = activeSheet.getActiveRange();
      return range ? [range] : [];
    } catch (_) {
      return [];
    }
  }

  function collectPayloads_(sheet, ranges) {
    const source = sheet || SpreadsheetApp.getActiveSheet();
    const list = Array.isArray(ranges) ? ranges.filter(Boolean) : [];
    const payloads = [];
    const errors = [];
    const phones = loadPhonesIndex_();
    const dict = loadDictMap_();
    const codeRange = source.getRange(getMonthlyCodeRangeA1ForSheet_(source));

    list.forEach(function(range) {
      if (!range || !rangesIntersect_(range, codeRange)) return;

      const rowStart = Math.max(range.getRow(), codeRange.getRow());
      const rowEnd = Math.min(range.getLastRow(), codeRange.getLastRow());
      const colStart = Math.max(range.getColumn(), codeRange.getColumn());
      const colEnd = Math.min(range.getLastColumn(), codeRange.getLastColumn());

      for (let row = rowStart; row <= rowEnd; row++) {
        for (let col = colStart; col <= colEnd; col++) {
          const a1 = a1FromRowCol_(row, col);
          try {
            const raw = String(source.getRange(row, col).getDisplayValue() || '').trim();
            if (!raw) continue;

            const payload = buildPayloadForCell_(source, row, col, phones, dict);
            if (payload && payload.code) payloads.push(payload);
          } catch (e) {
            errors.push({
              cell: a1,
              error: e && e.message ? e.message : String(e)
            });
          }
        }
      }
    });

    return { payloads: payloads, errors: errors };
  }

  function groupPayloadsByPhone_(payloads) {
    const groupsByPhone = {};
    const noPhone = [];

    (Array.isArray(payloads) ? payloads : []).forEach(function(item) {
      if (!item) return;
      const phone = String(item.phone || '').trim();
      if (!phone) {
        noPhone.push(item);
        return;
      }
      if (!groupsByPhone[phone]) groupsByPhone[phone] = { phone: phone, items: [] };
      groupsByPhone[phone].items.push(item);
    });

    return Object.keys(groupsByPhone).sort().map(function(phone) {
      return groupsByPhone[phone];
    }).concat(noPhone.map(function(item) {
      return { phone: '', items: [item] };
    }));
  }

  function buildAggregatedPayloadsForPhone_(phone, items) {
    const list = Array.isArray(items) ? items.filter(Boolean) : [];
    if (!list.length) return [];
    if (list.length === 1) return [list[0]];

    const first = list[0];
    const lines = list.map(function(item) {
      return [
        item.date || item.reportDateStr || '',
        item.code || '',
        item.tasks || item.service || item.label || ''
      ].filter(Boolean).join(' — ');
    });

    let message = [
      first.fml ? 'ПІБ: ' + first.fml : '',
      first.callsign ? 'Позивний: ' + first.callsign : '',
      'Завдання:',
      lines.map(function(line) { return '• ' + line; }).join('\n')
    ].filter(Boolean).join('\n');

    if (typeof trimToEncoded_ === 'function') {
      try { message = trimToEncoded_(message, CONFIG.MAX_WA_TEXT || 3800); } catch (_) {}
    }

    const digits = String(phone || first.phone || '').replace(/[^\d]/g, '');
    const link = digits ? buildWhatsAppWebLink_(digits, message) : '';

    return [Object.assign({}, first, {
      phone: phone || first.phone || '',
      code: list.map(function(item) { return item.code; }).filter(Boolean).join(', '),
      tasks: lines.join('\n'),
      message: message,
      link: link,
      grouped: true,
      groupedCount: list.length
    })];
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
      loadPhonesIndex_(),
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
      throw new Error(
        `Область повинна перетинати ${getMonthlyCodeRangeA1ForSheet_(ctx.sheet)}`,
      );
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
      throw new Error(
        `Стовпець поза ${getMonthlyCodeRangeA1ForSheet_(ctx.sheet)}`,
      );
    }

    const dateStr = opts.date || _getDateForActiveColumn(ctx.sheet, col);
    return SummaryService_.buildCommanderPreview(
      Object.assign({}, opts, { date: dateStr }),
    );
  }

  function prepareCommanderSummaryLink(options) {
    const opts = options || {};
    const prepared = prepareCommanderSummaryPreview(opts);
    return SummaryService_.buildCommanderLink(
      Object.assign({}, opts, { date: prepared.date }),
    );
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
    const commanderPhone = findPhone_({ role: CONFIG.COMMANDER_ROLE }) || '';

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
      codeRange: getMonthlyCodeRangeA1ForSheet_(ctx.sheet)
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

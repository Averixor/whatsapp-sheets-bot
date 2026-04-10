/**
 * SendPanelRepository.gs — canonical синхронізація monthly sheet -> SEND_PANEL.
 */

const SendPanelRepository_ = (function() {
  function extractLinkUrl(formula) {
    return extractHyperlinkUrl_(formula);
  }

  function getPanelSheet(required) {
    return DataAccess_.getSheet('SEND_PANEL', null, required !== false);
  }

  function applyVisualState_(panel, rowCount) {
    if (!panel || !rowCount) return false;

    const schema = SheetSchemas_.get('SEND_PANEL');
    panel.getRange(schema.dataStartRow, 1, rowCount, 7).setBackground(null);
    panel.getRange(schema.dataStartRow, schema.columns.status, rowCount, 2).setHorizontalAlignment('center');
    return true;
  }

  function applyVisualStateToRows_(panel, rowNumbers) {
    if (!panel || !Array.isArray(rowNumbers) || !rowNumbers.length) return false;

    const schema = SheetSchemas_.get('SEND_PANEL');
    rowNumbers.forEach(function(row) {
      if (!Number.isFinite(row)) return;
      panel.getRange(row, 1, 1, 7).setBackground(null);
      panel.getRange(row, schema.columns.status, 1, 2).setHorizontalAlignment('center');
    });
    return true;
  }

  function readRowsByNumbers_(panel, rowNumbers) {
    if (!panel || !Array.isArray(rowNumbers) || !rowNumbers.length) return [];

    const schema = SheetSchemas_.get('SEND_PANEL');
    const formulasByRow = {};
    const valuesByRow = {};

    rowNumbers.forEach(function(row) {
      if (!Number.isFinite(row) || row < schema.dataStartRow) return;
      const values = panel.getRange(row, 1, 1, 7).getDisplayValues()[0] || [];
      const formula = panel.getRange(row, schema.columns.action, 1, 1).getFormulas()[0][0] || '';
      valuesByRow[row] = values;
      formulasByRow[row] = formula;
    });

    return rowNumbers.map(function(row) {
      const values = valuesByRow[row] || [];
      return {
        fio: String(values[0] || '').trim(),
        phone: String(values[1] || '').replace(/^'/, '').trim() || '—',
        code: String(values[2] || '').trim(),
        tasks: String(values[3] || '').trim() || '—',
        status: normalizeSendPanelStatus_(String(values[4] || '').trim()),
        sent: isSendPanelSentMark_(values[5]),
        link: extractLinkUrl(formulasByRow[row] || ''),
        row: row
      };
    }).filter(function(item) {
      return item.fio || item.code || item.phone !== '—';
    });
  }

  function readRows() {
    const panel = getPanelSheet(false);
    if (!panel) return [];

    const schema = SheetSchemas_.get('SEND_PANEL');
    const lastRow = panel.getLastRow();
    if (lastRow < schema.dataStartRow) return [];

    const count = lastRow - (schema.dataStartRow - 1);
    const values = panel.getRange(schema.dataStartRow, 1, count, 7).getDisplayValues();
    const formulas = panel.getRange(schema.dataStartRow, schema.columns.action, count, 1).getFormulas().flat();

    return values.map(function(row, index) {
      return {
        fio: String(row[0] || '').trim(),
        phone: String(row[1] || '').replace(/^'/, '').trim() || '—',
        code: String(row[2] || '').trim(),
        tasks: String(row[3] || '').trim() || '—',
        status: normalizeSendPanelStatus_(String(row[4] || '').trim()),
        sent: isSendPanelSentMark_(row[5]),
        link: extractLinkUrl(formulas[index] || ''),
        row: schema.dataStartRow + index
      };
    }).filter(function(item) {
      return item.fio || item.code || item.phone !== '—';
    });
  }

  function buildStats(rows) {
    const items = Array.isArray(rows) ? rows : [];
    const blockedCount = items.filter(function(item) {
      return normalizeSendPanelStatus_(item.status) !== SendPanelConstants_.STATUS_READY;
    }).length;
    return {
      totalCount: items.length,
      readyCount: items.filter(function(item) {
        return shouldTreatRowAsReadyToOpen_(item);
      }).length,
      pendingCount: 0,
      blockedCount: blockedCount,
      errorCount: blockedCount,
      sentCount: items.filter(function(item) {
        return item.sent === true;
      }).length
    };
  }

  function buildRowsForDate(dateStr) {
    const ctx = PersonsRepository_.getDateContext(dateStr);
    const source = ctx.sheet;
    const phones = DictionaryRepository_.getPhonesIndex();
    const dict = DictionaryRepository_.getDictMap();
    const ref = source.getRange(CONFIG.CODE_RANGE_A1);
    const start = ref.getRow();
    const num = ref.getNumRows();
    const codes = source.getRange(start, ctx.col, num, 1).getDisplayValues();
    const fios = source.getRange(start, CONFIG.FIO_COL, num, 1).getDisplayValues();

    const rows = [];
    const payloads = [];

    for (let i = 0; i < num; i++) {
      const code = String(codes[i][0] || '').trim();
      const fio = String(fios[i][0] || '').trim();
      if (!code || !fio) continue;

      try {
        const payload = buildPayloadForCell_(source, start + i, ctx.col, phones, dict);
        let formattedPhone = String(payload.phone || '').trim();
        if (formattedPhone.startsWith('+')) {
          formattedPhone = "'" + formattedPhone;
        }

        const effectiveStatus = deriveSendPanelStatusFromInputs_(payload.fio, formattedPhone, payload.code, payload.tasks);

        rows.push([
          payload.fio,
          formattedPhone || '',
          payload.code,
          payload.tasks || '',
          effectiveStatus,
          getSendPanelUnsentMark_(),
          resolveSendPanelActionCellValue_(payload.link, effectiveStatus, false)
        ]);

        payloads.push(payload);
      } catch (e) {
        rows.push([
          fio,
          '',
          code,
          '',
          SendPanelConstants_.STATUS_BLOCKED,
          getSendPanelUnsentMark_(),
          SendPanelConstants_.ACTION_BLOCKED_LABEL
        ]);
      }
    }

    return {
      month: source.getName(),
      date: ctx.dateStr,
      rows: rows,
      payloads: payloads,
      canonicalSource: {
        type: 'MONTHLY',
        sheet: source.getName(),
        date: ctx.dateStr
      }
    };
  }

  function preview(dateStr) {
    const built = buildRowsForDate(dateStr);
    const mapped = built.rows.map(function(row, index) {
      return {
        fio: String(row[0] || '').trim(),
        phone: String(row[1] || '').replace(/^'/, '').trim() || '—',
        code: String(row[2] || '').trim(),
        tasks: String(row[3] || '').trim() || '—',
        status: normalizeSendPanelStatus_(String(row[4] || '').trim()),
        sent: isSendPanelSentMark_(row[5]),
        link: extractLinkUrl(String(row[6] || '')),
        row: (Number(CONFIG.SEND_PANEL_DATA_START_ROW) || 3) + index
      };
    });

    return {
      month: built.month,
      date: built.date,
      canonicalSource: built.canonicalSource,
      rows: mapped,
      stats: buildStats(mapped)
    };
  }

  function rebuild(dateStr) {
    const ss = SpreadsheetApp.getActive();
    const built = buildRowsForDate(dateStr);
    let panel = ss.getSheetByName(CONFIG.SEND_PANEL_SHEET);
    const prevMeta = panel ? getSendPanelMetadata_(panel) : { month: '', date: '', hasMetadata: false };
    const preserveState = !!(panel && prevMeta.date && prevMeta.date === built.date);
    const prevState = preserveState ? readSendPanelStateObjectMap_(panel) : {};
    if (!panel) panel = ss.insertSheet(CONFIG.SEND_PANEL_SHEET);

    ensureSendPanelStructure_(panel, built.month, built.date);

    const rows = built.rows.map(function(row) {
      const key = makeSendPanelKey_(row[0], row[1], row[2]);
      const prev = prevState[key] || null;
      const effectiveStatus = normalizeSendPanelStatus_(row[4]);
      const sent = !!(prev && prev.sent);
      const actionUrl = extractLinkUrl(row[6] || '') || (prev && prev.link) || '';

      return [
        row[0],
        row[1],
        row[2],
        row[3],
        effectiveStatus,
        sent ? getSendPanelSentMark_() : getSendPanelUnsentMark_(),
        resolveSendPanelActionCellValue_(actionUrl, effectiveStatus, sent)
      ];
    });

    if (!rows.length) {
      throw new Error('На вибрану дату немає даних для SEND_PANEL');
    }

    panel.getRange(CONFIG.SEND_PANEL_DATA_START_ROW, 1, rows.length, 7).setValues(rows);
    ensureSendPanelStatusFormula_(panel);
    SpreadsheetApp.flush();
    applyColumnWidthsStandardsToSheet_(panel);
    panel.setFrozenRows(CONFIG.SEND_PANEL_HEADER_ROW);
    applyVisualState_(panel, rows.length);

    const rowsData = readRows();
    return {
      month: built.month,
      date: built.date,
      canonicalSource: built.canonicalSource,
      rows: rowsData,
      stats: buildStats(rowsData),
      rowsWritten: rows.length
    };
  }

  function getValidRows_(panel, rowNumbers) {
    const schema = SheetSchemas_.get('SEND_PANEL');
    const rows = Array.isArray(rowNumbers) ? rowNumbers.map(Number) : [];
    const firstDataRow = schema.dataStartRow;
    const lastDataRow = panel.getLastRow();

    return [...new Set(rows)].filter(function(row) {
      return Number.isFinite(row) && row >= firstDataRow && row <= lastDataRow;
    });
  }

  function markRowsAsPending(rowNumbers, opts) {
    const options = opts || {};
    const rows = Array.isArray(rowNumbers) ? rowNumbers.map(Number) : [];
    const previewRows = readRows();

    return {
      dryRun: !!options.dryRun,
      requestedRows: rows,
      updatedRows: rows.filter(function(v) { return Number.isFinite(v); }),
      rows: previewRows,
      stats: buildStats(previewRows),
      compatibilityMode: true
    };
  }

  function markRowsAsSent(rowNumbers, opts) {
    const options = opts || {};
    const rows = Array.isArray(rowNumbers) ? rowNumbers.map(Number) : [];
    if (options.dryRun) {
      const previewRows = readRows();
      return {
        dryRun: true,
        requestedRows: rows,
        updatedRows: rows.filter(function(v) { return Number.isFinite(v); }),
        rows: previewRows,
        stats: buildStats(previewRows)
      };
    }

    const panel = getPanelSheet(true);
    const schema = SheetSchemas_.get('SEND_PANEL');
    const validRows = getValidRows_(panel, rows);
    if (!validRows.length) throw new Error('Передано некоректні рядки SEND_PANEL');

    const beforeRows = readRowsByNumbers_(panel, validRows);
    const byRow = {};
    beforeRows.forEach(function(item) { byRow[item.row] = item; });

    const eligibleRows = validRows.filter(function(row) {
      return shouldTreatRowAsReadyToOpen_(byRow[row] || {});
    });
    if (!eligibleRows.length) throw new Error('Немає готових рядків SEND_PANEL для позначення як відправлені');

    eligibleRows.forEach(function(row) {
      const item = byRow[row] || {};
      panel.getRange(row, schema.columns.sent).setValue(getSendPanelSentMark_());
      panel.getRange(row, schema.columns.action).setValue(resolveSendPanelActionCellValue_(item.link || '', item.status || SendPanelConstants_.STATUS_READY, true));
    });

    if (options.targetedVisualUpdate) {
      applyVisualStateToRows_(panel, eligibleRows);
    } else {
      applyVisualState_(panel, Math.max(0, panel.getLastRow() - (schema.dataStartRow - 1)));
    }

    const logs = beforeRows.filter(function(item) { return eligibleRows.indexOf(item.row) !== -1; }).map(function(item) {
      return {
        timestamp: new Date(),
        reportDateStr: getSendPanelMetadata_(panel).date || _todayStr_(),
        sheet: CONFIG.SEND_PANEL_SHEET,
        cell: `ROW:${item.row}`,
        fio: item.fio,
        phone: item.phone,
        code: item.code,
        service: '',
        place: '',
        tasks: item.tasks || '',
        message: `Автоматична відправка: ${item.code}`,
        link: item.link || ''
      };
    });

    if (logs.length) {
      try { LogsRepository_.writeBatch(logs); } catch (_) {}
    }

    if (options.returnRows === false) {
      return { updatedRows: eligibleRows, rows: [], stats: null };
    }

    const afterRows = readRows();
    return { updatedRows: eligibleRows, rows: afterRows, stats: buildStats(afterRows) };
  }

  function markRowsAsUnsent(rowNumbers, opts) {
    const options = opts || {};
    const rows = Array.isArray(rowNumbers) ? rowNumbers.map(Number) : [];
    if (options.dryRun) {
      const previewRows = readRows();
      return {
        dryRun: true,
        requestedRows: rows,
        updatedRows: rows.filter(function(v) { return Number.isFinite(v); }),
        rows: previewRows,
        stats: buildStats(previewRows)
      };
    }

    const panel = getPanelSheet(true);
    const schema = SheetSchemas_.get('SEND_PANEL');
    const validRows = getValidRows_(panel, rows);
    if (!validRows.length) throw new Error('Передано некоректні рядки SEND_PANEL');

    const beforeRows = readRows().filter(function(item) {
      return validRows.indexOf(item.row) !== -1;
    });
    const byRow = {};
    beforeRows.forEach(function(item) { byRow[item.row] = item; });

    validRows.forEach(function(row) {
      const item = byRow[row] || {};
      const status = normalizeSendPanelStatus_(item.status);
      panel.getRange(row, schema.columns.sent).setValue(getSendPanelUnsentMark_());
      panel.getRange(row, schema.columns.action).setValue(resolveSendPanelActionCellValue_(item.link || '', status, false));
    });

    applyVisualState_(panel, Math.max(0, panel.getLastRow() - (schema.dataStartRow - 1)));

    const afterRows = readRows();
    return { updatedRows: validRows, rows: afterRows, stats: buildStats(afterRows) };
  }

  function getPanelMetadata() {
    return getSendPanelMetadata_(getPanelSheet(false));
  }

  return {
    readRows: readRows,
    buildStats: buildStats,
    buildRowsForDate: buildRowsForDate,
    preview: preview,
    rebuild: rebuild,
    markRowsAsPending: markRowsAsPending,
    markRowsAsSent: markRowsAsSent,
    markRowsAsUnsent: markRowsAsUnsent,
    getPanelMetadata: getPanelMetadata
  };
})();

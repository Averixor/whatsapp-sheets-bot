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

  function readRows() {
    const panel = getPanelSheet(false);
    if (!panel) return [];

    const schema = SheetSchemas_.get('SEND_PANEL');
    const lastRow = panel.getLastRow();
    if (lastRow < schema.dataStartRow) return [];

    const count = lastRow - (schema.dataStartRow - 1);
    const values = panel.getRange(schema.dataStartRow, 1, count, 7).getDisplayValues();
    const formulas = panel.getRange(schema.dataStartRow, 6, count, 1).getFormulas().flat();
    const sentValues = panel.getRange(schema.dataStartRow, 7, count, 1).getValues().flat();

    return values.map(function(row, index) {
      const status = normalizeSendPanelStatus_(String(row[4] || '').trim());
      const sent = sentValues[index] === true || String(sentValues[index]).toUpperCase() === 'TRUE' || isSendPanelSentStatusValue_(status);
      return {
        fio: String(row[0] || '').trim(),
        phone: String(row[1] || '').replace(/^'/, '').trim() || '—',
        code: String(row[2] || '').trim(),
        tasks: String(row[3] || '').trim() || '—',
        status: status,
        link: extractLinkUrl(formulas[index] || ''),
        sent: sent,
        row: schema.dataStartRow + index
      };
    }).filter(function(item) {
      return item.fio || item.code || item.phone !== '—';
    });
  }

  function buildStats(rows) {
    const items = Array.isArray(rows) ? rows : [];
    return {
      totalCount: items.length,
      readyCount: items.filter(function(item) {
        return shouldTreatRowAsReadyToOpen_(item);
      }).length,
      pendingCount: items.filter(function(item) {
        return isSendPanelPendingStatus_(item.status) && !item.sent;
      }).length,
      errorCount: items.filter(function(item) {
        return isSendPanelErrorStatus_(item.status);
      }).length,
      sentCount: items.filter(function(item) {
        return item.sent === true || isSendPanelSentStatusValue_(item.status);
      }).length
    };
  }

  function buildRowsForDate(dateStr) {
    const ctx = PersonsRepository_.getDateContext(dateStr);
    const source = ctx.sheet;
    const phones = DictionaryRepository_.getPhonesMap();
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

        const linkFormula = payload.link
          ? `=HYPERLINK("${payload.link}"; "📱 НАДІСЛАТИ")`
          : '';

        rows.push([
          payload.fio,
          formattedPhone || '—',
          payload.code,
          payload.tasks || '—',
          getSendPanelReadyStatus_(),
          linkFormula,
          false
        ]);

        payloads.push(payload);
      } catch (e) {
        rows.push([
          fio,
          '—',
          code,
          '—',
          `${getSendPanelErrorPrefix_()} ${e && e.message ? e.message : String(e)}`,
          '',
          false
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
        link: extractLinkUrl(String(row[5] || '')),
        sent: row[6] === true,
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
      const builtStatus = normalizeSendPanelStatus_(row[4]);
      const preservedStatus = prev && prev.status ? normalizeSendPanelStatus_(prev.status) : builtStatus;
      const preservedSent = !!(prev && prev.sent);

      return [
        row[0],
        row[1],
        row[2],
        row[3],
        preservedSent ? getSendPanelSentStatus_() : preservedStatus,
        row[5],
        preservedSent
      ];
    });

    if (!rows.length) {
      throw new Error('На вибрану дату немає даних для SEND_PANEL');
    }

    panel.getRange(CONFIG.SEND_PANEL_DATA_START_ROW, 1, rows.length, 7).setValues(rows);
    panel.getRange(CONFIG.SEND_PANEL_DATA_START_ROW, 7, rows.length, 1).insertCheckboxes();
    applyColumnWidthsStandardsToSheet_(panel);

    const statusRng = panel.getRange(CONFIG.SEND_PANEL_DATA_START_ROW, 5, rows.length, 1);
    panel.setConditionalFormatRules([
      SpreadsheetApp.newConditionalFormatRule().whenTextContains(getSendPanelReadyStatus_()).setBackground('#e6f4e6').setRanges([statusRng]).build(),
      SpreadsheetApp.newConditionalFormatRule().whenTextContains(SendPanelConstants_.STATUS_UNSENT).setBackground('#fff8db').setRanges([statusRng]).build(),
      SpreadsheetApp.newConditionalFormatRule().whenTextContains(SendPanelConstants_.STATUS_PENDING).setBackground('#fff3cd').setRanges([statusRng]).build(),
      SpreadsheetApp.newConditionalFormatRule().whenTextContains(getSendPanelErrorPrefix_()).setBackground('#ffe6e6').setRanges([statusRng]).build(),
      SpreadsheetApp.newConditionalFormatRule().whenTextContains(getSendPanelSentStatus_()).setBackground('#ede9fe').setRanges([statusRng]).build()
    ]);
    panel.setFrozenRows(CONFIG.SEND_PANEL_HEADER_ROW);

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

  function batchSetPanelState_(panel, rowNumbers, statusText, sentValue) {
    const schema = SheetSchemas_.get('SEND_PANEL');
    const validRows = [...new Set((Array.isArray(rowNumbers) ? rowNumbers : []).map(Number).filter(Number.isFinite))].sort(function(a, b) { return a - b; });
    const groups = [];

    validRows.forEach(function(row) {
      const last = groups[groups.length - 1];
      if (!last || row !== last.end + 1) {
        groups.push({ start: row, end: row, rows: [row] });
        return;
      }
      last.end = row;
      last.rows.push(row);
    });

    groups.forEach(function(group) {
      const count = group.rows.length;
      panel.getRange(group.start, schema.columns.status, count, 1)
        .setValues(group.rows.map(function() { return [statusText]; }));
      panel.getRange(group.start, schema.columns.sent, count, 1)
        .setValues(group.rows.map(function() { return [!!sentValue]; }));
    });

    return validRows;
  }

  function markRowsAsPending(rowNumbers, opts) {
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
    const firstDataRow = schema.dataStartRow;
    const lastDataRow = panel.getLastRow();
    const validRows = [...new Set(rows)].filter(function(row) {
      return Number.isFinite(row) && row >= firstDataRow && row <= lastDataRow;
    });
    if (!validRows.length) throw new Error('Передано некоректні рядки SEND_PANEL');

    batchSetPanelState_(panel, validRows, SendPanelConstants_.STATUS_PENDING, false);
    const afterRows = readRows();
    return { updatedRows: validRows, rows: afterRows, stats: buildStats(afterRows) };
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
    const firstDataRow = schema.dataStartRow;
    const lastDataRow = panel.getLastRow();
    const validRows = [...new Set(rows)].filter(function(row) {
      return Number.isFinite(row) && row >= firstDataRow && row <= lastDataRow;
    });

    if (!validRows.length) throw new Error('Передано некоректні рядки SEND_PANEL');

    const beforeRows = readRows().filter(function(item) {
      return validRows.indexOf(item.row) !== -1;
    });

    batchSetPanelState_(panel, validRows, getSendPanelSentStatus_(), true);

    const logs = beforeRows.map(function(item) {
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
        message: `Підтверджено відправку: ${item.code}`,
        link: item.link || ''
      };
    });

    if (logs.length) {
      try { LogsRepository_.writeBatch(logs); } catch (_) {}
    }

    const afterRows = readRows();
    return { updatedRows: validRows, rows: afterRows, stats: buildStats(afterRows) };
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
    const firstDataRow = schema.dataStartRow;
    const lastDataRow = panel.getLastRow();
    const validRows = [...new Set(rows)].filter(function(row) {
      return Number.isFinite(row) && row >= firstDataRow && row <= lastDataRow;
    });

    if (!validRows.length) throw new Error('Передано некоректні рядки SEND_PANEL');

    batchSetPanelState_(panel, validRows, SendPanelConstants_.STATUS_UNSENT, false);
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
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
      const status = String(row[4] || '').trim();
      const sent = sentValues[index] === true || String(sentValues[index]).toUpperCase() === 'TRUE';
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
        return item.status === getSendPanelReadyStatus_() && item.link && !item.sent;
      }).length,
      errorCount: items.filter(function(item) {
        return String(item.status || '').indexOf(getSendPanelErrorPrefix_()) === 0;
      }).length,
      sentCount: items.filter(function(item) {
        return item.sent === true || item.status === getSendPanelSentStatus_();
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
        status: String(row[4] || '').trim(),
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
    const prevSent = panel ? readSendPanelSentMap_(panel) : {};
    if (!panel) panel = ss.insertSheet(CONFIG.SEND_PANEL_SHEET);

    ensureSendPanelStructure_(panel, built.month);

    const rows = built.rows.map(function(row) {
      const key = makeSendPanelKey_(row[0], row[1], row[2]);
      return [
        row[0],
        row[1],
        row[2],
        row[3],
        row[4],
        row[5],
        prevSent[key] === true
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

  function markRowsAsSent(rowNumbers, opts) {
    const options = opts || {};
    const rows = Array.isArray(rowNumbers) ? rowNumbers.map(Number) : [];
    if (options.dryRun) {
      return {
        dryRun: true,
        requestedRows: rows,
        updatedRows: rows.filter(function(v) { return Number.isFinite(v); }),
        rows: readRows()
      };
    }

    const panel = getPanelSheet(true);
    const schema = SheetSchemas_.get('SEND_PANEL');
    const firstDataRow = schema.dataStartRow;
    const lastDataRow = panel.getLastRow();
    const validRows = [...new Set(rows)].filter(function(row) {
      return Number.isFinite(row) && row >= firstDataRow && row <= lastDataRow;
    });

    if (!validRows.length) {
      throw new Error('Передано некоректні рядки SEND_PANEL');
    }

    const beforeRows = readRows().filter(function(item) {
      return validRows.indexOf(item.row) !== -1;
    });

    validRows.forEach(function(row) {
      DataAccess_.updateRowFields('SEND_PANEL', row, {
        sent: true,
        status: getSendPanelSentStatus_()
      });
    });

    const logs = beforeRows.map(function(item) {
      return {
        timestamp: new Date(),
        reportDateStr: _todayStr_(),
        sheet: CONFIG.SEND_PANEL_SHEET,
        cell: `ROW:${item.row}`,
        fio: item.fio,
        phone: item.phone,
        code: item.code,
        service: '',
        place: '',
        tasks: item.tasks || '',
        message: `Позначено як відправлено: ${item.code}`,
        link: item.link || ''
      };
    });

    if (logs.length) {
      try { LogsRepository_.writeBatch(logs); } catch (_) {}
    }

    const afterRows = readRows();
    return {
      updatedRows: validRows,
      rows: afterRows,
      stats: buildStats(afterRows)
    };
  }


  function markRowsAsUnsent(rowNumbers, opts) {
    const options = opts || {};
    const rows = Array.isArray(rowNumbers) ? rowNumbers.map(Number) : [];
    if (options.dryRun) {
      return {
        dryRun: true,
        requestedRows: rows,
        updatedRows: rows.filter(function(v) { return Number.isFinite(v); }),
        rows: readRows(),
        stats: buildStats(readRows())
      };
    }

    const panel = getPanelSheet(true);
    const schema = SheetSchemas_.get('SEND_PANEL');
    const firstDataRow = schema.dataStartRow;
    const lastDataRow = panel.getLastRow();
    const validRows = [...new Set(rows)].filter(function(row) {
      return Number.isFinite(row) && row >= firstDataRow && row <= lastDataRow;
    });

    if (!validRows.length) {
      throw new Error('Передано некоректні рядки SEND_PANEL');
    }

    validRows.forEach(function(row) {
      DataAccess_.updateRowFields('SEND_PANEL', row, {
        sent: false,
        status: getSendPanelReadyStatus_()
      });
    });

    const afterRows = readRows();
    return {
      updatedRows: validRows,
      rows: afterRows,
      stats: buildStats(afterRows)
    };
  }
  return {
    readRows: readRows,
    buildStats: buildStats,
    buildRowsForDate: buildRowsForDate,
    preview: preview,
    rebuild: rebuild,
    markRowsAsSent: markRowsAsSent,
    markRowsAsUnsent: markRowsAsUnsent
  };
})();

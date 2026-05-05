/**
 * SendPanelFastPaths.gs — hot-path optimized APIs for SEND_PANEL.
 *
 * Goal:
 * - keep manual send / reset / build off the heavy workflow-combine path;
 * - avoid full rereads, reconciliation, audit-heavy chains and redundant rebuilds;
 * - operate on exact row/date targets with short bounded work.
 */

const SendPanelFastPaths_ = (function() {
  function _assertAccess_(action, details) {
    if (typeof AccessEnforcement_ === 'object' && AccessEnforcement_ && typeof AccessEnforcement_.assertCanUseSendPanel === 'function') {
      AccessEnforcement_.assertCanUseSendPanel(action, details || {});
    }
  }

  function _normalizeDate_(value) {
    const raw = String(value || '').trim();
    return assertUaDateString_(raw || _todayStr_());
  }

  function _getPanel_(required) {
    return DataAccess_.getSheet('SEND_PANEL', null, required !== false);
  }

  function _rowToObject_(rowValues, rowNumber, actionFormula, panelDate) {
    const values = Array.isArray(rowValues) ? rowValues : [];
    return {
      fml: String(values[0] || '').trim(),
      phone: String(values[1] || '').replace(/^'/, '').trim() || '—',
      code: String(values[2] || '').trim(),
      tasks: String(values[3] || '').trim() || '—',
      status: normalizeSendPanelStatus_(String(values[4] || '').trim()),
      sent: isSendPanelSentMark_(values[5]),
      link: extractHyperlinkUrl_(String(actionFormula || '')),
      row: Number(rowNumber),
      date: String(panelDate || '').trim()
    };
  }

  function _mapStoredRowsFromMatrix_(rows, startRow, panelDate) {
    const dateStr = String(panelDate || '').trim();
    return (Array.isArray(rows) ? rows : []).map(function(row, index) {
      return _rowToObject_(row, startRow + index, row[6] || '', dateStr);
    }).filter(function(item) {
      return item.fml || item.code || item.phone !== '—';
    });
  }

  function _fastBuildRowsForDate_(dateStr) {
    const safeDate = _normalizeDate_(dateStr);
    const ctx = PersonsRepository_.getDateContext(safeDate);
    const source = ctx.sheet;
    const ref = source.getRange(CONFIG.CODE_RANGE_A1);
    const startRow = ref.getRow();
    const rowCount = ref.getNumRows();
    const dateCol = ctx.col;

    const codeValues = source.getRange(startRow, dateCol, rowCount, 1).getDisplayValues();
    const fmlValues = source.getRange(startRow, CONFIG.FML_COL, rowCount, 1).getDisplayValues();
    const brValues = source.getRange(startRow, 6, rowCount, 1).getDisplayValues();

    const phonesIndex = DictionaryRepository_.getPhonesIndex();
    const dictMap = DictionaryRepository_.getDictMap();
    const rows = [];

    for (var i = 0; i < rowCount; i++) {
      var code = String(codeValues[i] && codeValues[i][0] || '').trim();
      var fmlRaw = String(fmlValues[i] && fmlValues[i][0] || '').trim();
      if (!code || !fmlRaw) continue;

      try {
        var fmlNorm = normalizeFML_(fmlRaw);
        var phone = findPhone_({ fml: fmlRaw, fmlNorm: fmlNorm }, { index: phonesIndex }) || '';
        var phoneDigits = phone ? String(phone).replace(/[^\d+]/g, '') : '';
        var waPhone = phoneDigits ? (phoneDigits.charAt(0) === '+' ? phoneDigits : '+' + phoneDigits) : '';

        var dict = dictMap && dictMap[code] ? dictMap[code] : null;
        var service = dict && dict.service ? String(dict.service).trim() : '';
        var place = dict && dict.place ? String(dict.place).trim() : '';
        var tasks = dict && dict.tasks ? String(dict.tasks).trim() : '';

        var brRaw = String(brValues[i] && brValues[i][0] || '').trim();
        var brDays = brRaw ? (Number(String(brRaw).replace(',', '.')) || 0) : 0;
        var msg = buildMessage_({
          reportDate: ctx.dateStr,
          service: service,
          place: place,
          tasks: tasks,
          brDays: brDays,
          minimal: false
        });
        var safeMessage = trimToEncoded_(msg, CONFIG.MAX_WA_TEXT);
        var formattedPhone = waPhone && waPhone.charAt(0) === '+' ? ("'" + waPhone) : String(waPhone || '').trim();
        var link = waPhone ? ('https://wa.me/' + waPhone.replace('+', '') + '?text=' + encodeURIComponent(safeMessage)) : '';
        var status = deriveSendPanelStatusFromInputs_(fmlRaw, formattedPhone, code, tasks);

        rows.push([
          fmlRaw,
          formattedPhone || '',
          code,
          tasks || '',
          status,
          getSendPanelUnsentMark_(),
          resolveSendPanelActionCellValue_(link, status, false)
        ]);
      } catch (error) {
        rows.push([
          fmlRaw,
          '',
          code,
          '',
          SendPanelConstants_.STATUS_BLOCKED,
          getSendPanelUnsentMark_(),
          SendPanelConstants_.ACTION_BLOCKED_LABEL
        ]);
      }
    }

    if (!rows.length) {
      throw new Error('На вибрану дату немає даних для SEND_PANEL');
    }

    return {
      month: source.getName(),
      date: ctx.dateStr,
      canonicalSource: {
        type: 'MONTHLY',
        sheet: source.getName(),
        date: ctx.dateStr
      },
      rows: rows
    };
  }

  function _ensureStructureFast_(panel, botMonth, panelDate) {
    var safeMonth = String(botMonth || '').trim();
    var safeDate = _normalizeDate_(panelDate || _todayStr_());
    var headerRow = Number(CONFIG.SEND_PANEL_HEADER_ROW) || 2;
    var dataStartRow = Number(CONFIG.SEND_PANEL_DATA_START_ROW) || 3;
    var dataLastRow = (typeof MONTHLY_CONFIG !== 'undefined' && Number(MONTHLY_CONFIG.LAST_DATA_ROW)) || 40;
    var clearUntilRow = Math.max(Number(panel.getLastRow() || 0), dataLastRow, dataStartRow);

    try { panel.getRange(1, 1, 1, 7).breakApart(); } catch (_) {}
    panel.getRange(1, 1, clearUntilRow, 7).clearContent();

    panel.getRange(1, 1, 1, 7)
      .merge()
      .setValue('Активний місяць: ' + safeMonth + ' | Дата панелі: ' + safeDate)
      .setFontWeight('bold')
      .setFontSize(12)
      .setHorizontalAlignment('center')
      .setBackground('#fff3cd');

    panel.getRange(headerRow, 1, 1, 7)
      .setValues([['FML', 'Phone', 'Code', 'Tasks', 'Status', 'Sent', 'Action']])
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setBackground(null);

    panel.getRange(dataStartRow, 1, Math.max(1, dataLastRow - dataStartRow + 1), 7).setBackground(null);
    try { panel.setFrozenRows(headerRow); } catch (_) {}
    try { applyColumnWidthsStandardsToSheet_(panel); } catch (_) {}
    setSendPanelMetadata_(panel, safeMonth, safeDate);
  }

  function _applyVisualStateToRows_(panel, rowNumbers) {
    var rows = Array.isArray(rowNumbers) ? rowNumbers : [];
    rows.forEach(function(row) {
      if (!Number.isFinite(row) || row < (Number(CONFIG.SEND_PANEL_DATA_START_ROW) || 3)) return;
      panel.getRange(row, 1, 1, 7).setBackground(null);
      panel.getRange(row, 5, 1, 2).setHorizontalAlignment('center');
    });
  }

  function _buildResponse_(message, result, warnings, contextExtras) {
    var stats = result && result.stats ? result.stats : null;
    var meta = {
      stage: (typeof STAGE7_CONFIG !== 'undefined' && STAGE7_CONFIG && STAGE7_CONFIG.VERSION) ? STAGE7_CONFIG.VERSION : '7',
      scenario: contextExtras && contextExtras.scenario ? contextExtras.scenario : 'sendPanel.fast',
      operationId: stage7UniqueId_(contextExtras && contextExtras.scenario ? contextExtras.scenario : 'sendPanel.fast'),
      dryRun: !!(contextExtras && contextExtras.dryRun),
      affectedSheets: [CONFIG.SEND_PANEL_SHEET],
      affectedEntities: [],
      appliedChangesCount: Number(contextExtras && contextExtras.appliedChangesCount || 0),
      skippedChangesCount: Number(contextExtras && contextExtras.skippedChangesCount || 0),
      partial: !!(contextExtras && contextExtras.partial),
      retrySafe: true,
      lockUsed: false,
      lockRequired: false
    };

    if (stats && !meta.appliedChangesCount && contextExtras && contextExtras.scenario === 'buildSendPanelFast') {
      meta.appliedChangesCount = Number(stats.totalCount || 0);
    }

    return buildServerResponse_(
      true,
      message,
      null,
      result || null,
      [],
      meta,
      { fastPath: true, scenario: meta.scenario },
      Object.assign({ fastPath: true }, contextExtras || {}),
      Array.isArray(warnings) ? warnings : []
    );
  }

  function buildSendPanelFast(dateStr) {
    var safeDate = _normalizeDate_(dateStr);
    _assertAccess_('buildSendPanelFast', { requestedDate: safeDate });

    var ss = getWasbSpreadsheet_();
    var built = _fastBuildRowsForDate_(safeDate);
    var panel = ss.getSheetByName(CONFIG.SEND_PANEL_SHEET);
    var previousMeta = panel ? getSendPanelMetadata_(panel) : { date: '', month: '', hasMetadata: false };
    var preserveState = !!(panel && previousMeta.date && previousMeta.date === built.date);
    var previousState = preserveState ? readSendPanelStateObjectMap_(panel) : {};

    if (!panel) panel = ss.insertSheet(CONFIG.SEND_PANEL_SHEET);
    _ensureStructureFast_(panel, built.month, built.date);

    var finalRows = built.rows.map(function(row) {
      var key = makeSendPanelKey_(row[0], row[1], row[2]);
      var prev = previousState[key] || null;
      var effectiveStatus = normalizeSendPanelStatus_(row[4]);
      var sent = !!(prev && prev.sent);
      var actionUrl = extractHyperlinkUrl_(row[6] || '') || (prev && prev.link) || '';

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

    panel.getRange(Number(CONFIG.SEND_PANEL_DATA_START_ROW) || 3, 1, finalRows.length, 7).setValues(finalRows);
    panel.getRange(Number(CONFIG.SEND_PANEL_DATA_START_ROW) || 3, 5, finalRows.length, 2).setHorizontalAlignment('center');
    panel.getRange(Number(CONFIG.SEND_PANEL_DATA_START_ROW) || 3, 1, finalRows.length, 7).setBackground(null);

    var mappedRows = _mapStoredRowsFromMatrix_(finalRows, Number(CONFIG.SEND_PANEL_DATA_START_ROW) || 3, built.date);
    var stats = SendPanelRepository_.buildStats(mappedRows);

    return _buildResponse_(
      'SEND_PANEL згенеровано швидким маршрутом',
      {
        rows: mappedRows,
        stats: stats,
        month: built.month,
        date: built.date,
        rowsWritten: finalRows.length,
        updatedRows: []
      },
      [],
      {
        scenario: 'buildSendPanelFast',
        route: 'sidebar.buildSendPanelFast',
        fastPath: true,
        appliedChangesCount: finalRows.length
      }
    );
  }

  function _assertPanelDateMatch_(panel, expectedDate) {
    var meta = getSendPanelMetadata_(panel);
    var safeExpected = expectedDate ? _normalizeDate_(expectedDate) : '';
    if (safeExpected && meta && meta.date && meta.date !== safeExpected) {
      throw new Error('SEND_PANEL вже прив\'язано до іншої дати: ' + meta.date + '. Спочатку перечитайте або пересоберіть панель.');
    }
    return meta;
  }

  function resetAllSentFast(dateStr) {
    var panel = _getPanel_(true);
    var meta = _assertPanelDateMatch_(panel, dateStr || '');
    _assertAccess_('resetAllSentFast', { requestedDate: dateStr || '', panelDate: meta.date || '' });

    var dataStartRow = Number(CONFIG.SEND_PANEL_DATA_START_ROW) || 3;
    var lastRow = panel.getLastRow();
    if (lastRow < dataStartRow) {
      return _buildResponse_('Немає рядків для скидання', {
        rows: [],
        updatedRows: [],
        stats: { totalCount: 0, readyCount: 0, errorCount: 0, sentCount: 0 },
        month: meta.month || '',
        date: meta.date || ''
      }, [], {
        scenario: 'resetAllSentFast',
        route: 'sidebar.resetAllSentFast',
        fastPath: true,
        skippedChangesCount: 0
      });
    }

    var rowCount = lastRow - (dataStartRow - 1);
    var values = panel.getRange(dataStartRow, 1, rowCount, 7).getDisplayValues();
    var formulas = panel.getRange(dataStartRow, 7, rowCount, 1).getFormulas().flat();
    var sentColumnValues = [];
    var actionColumnValues = [];
    var updatedRows = [];

    for (var i = 0; i < rowCount; i++) {
      var isSent = isSendPanelSentMark_(values[i][5]);
      var status = normalizeSendPanelStatus_(values[i][4]);
      var link = extractHyperlinkUrl_(formulas[i] || '');
      sentColumnValues.push([isSent ? getSendPanelUnsentMark_() : values[i][5]]);
      actionColumnValues.push([isSent ? resolveSendPanelActionCellValue_(link, status, false) : (formulas[i] || values[i][6] || '')]);
      if (isSent) updatedRows.push(dataStartRow + i);
    }

    if (updatedRows.length) {
      panel.getRange(dataStartRow, 6, rowCount, 1).setValues(sentColumnValues);
      panel.getRange(dataStartRow, 7, rowCount, 1).setValues(actionColumnValues);
      _applyVisualStateToRows_(panel, updatedRows);
    }

    return _buildResponse_(
      updatedRows.length ? ('Скинуто ' + updatedRows.length + ' відправлених рядків') : 'Відправлених рядків немає',
      {
        rows: [],
        updatedRows: updatedRows,
        stats: null,
        month: meta.month || '',
        date: meta.date || ''
      },
      [],
      {
        scenario: 'resetAllSentFast',
        route: 'sidebar.resetAllSentFast',
        fastPath: true,
        appliedChangesCount: updatedRows.length,
        skippedChangesCount: 0
      }
    );
  }

  function markRowSentFast(rowNum, dateStr, options) {
    var row = Number(rowNum);
    if (!Number.isFinite(row) || row <= 0) {
      throw new Error('Не передано коректний rowNum SEND_PANEL');
    }

    var panel = _getPanel_(true);
    var meta = _assertPanelDateMatch_(panel, dateStr || '');
    _assertAccess_('markRowSentFast', { rowNum: row, requestedDate: dateStr || '', panelDate: meta.date || '' });

    var dataStartRow = Number(CONFIG.SEND_PANEL_DATA_START_ROW) || 3;
    var lastRow = panel.getLastRow();
    if (row < dataStartRow || row > lastRow) {
      throw new Error('Рядок SEND_PANEL не існує');
    }

    var values = panel.getRange(row, 1, 1, 7).getDisplayValues()[0] || [];
    var formula = panel.getRange(row, 7, 1, 1).getFormulas()[0][0] || '';
    var item = _rowToObject_(values, row, formula, meta.date || '');

    if (!item.fml && !item.code && item.phone === '—') {
      throw new Error('Рядок SEND_PANEL порожній');
    }

    if (item.sent === true) {
      return _buildResponse_(
        'Рядок уже позначено як відправлений',
        {
          rows: [],
          updatedRows: [],
          stats: null,
          month: meta.month || '',
          date: meta.date || '',
          statusCode: 'already-sent',
          row: row
        },
        ['already-sent'],
        {
          scenario: 'markRowSentFast',
          route: 'sidebar.markRowSentFast',
          fastPath: true,
          appliedChangesCount: 0,
          skippedChangesCount: 1,
          partial: true
        }
      );
    }

    if (!shouldTreatRowAsReadyToOpen_(item)) {
      throw new Error('Немає готових рядків SEND_PANEL для позначення як відправлені');
    }

    panel.getRange(row, 6).setValue(getSendPanelSentMark_());
    panel.getRange(row, 7).setValue(resolveSendPanelActionCellValue_(item.link || '', item.status || SendPanelConstants_.STATUS_READY, true));
    _applyVisualStateToRows_(panel, [row]);

    return _buildResponse_(
      'Рядок швидко позначено як відправлений',
      {
        rows: [],
        updatedRows: [row],
        stats: null,
        month: meta.month || '',
        date: meta.date || '',
        statusCode: 'updated',
        row: row
      },
      [],
      {
        scenario: 'markRowSentFast',
        route: 'sidebar.markRowSentFast',
        fastPath: true,
        appliedChangesCount: 1,
        skippedChangesCount: 0
      }
    );
  }

  return {
    buildSendPanelFast: buildSendPanelFast,
    resetAllSentFast: resetAllSentFast,
    markRowSentFast: markRowSentFast
  };
})();

function buildSendPanelFast(dateOrOptions) {
  var payload = (dateOrOptions && typeof dateOrOptions === 'object' && !Array.isArray(dateOrOptions)) ? dateOrOptions : { date: dateOrOptions };
  return SendPanelFastPaths_.buildSendPanelFast(payload && payload.date || '');
}

function resetAllSentFast(dateOrOptions) {
  var payload = (dateOrOptions && typeof dateOrOptions === 'object' && !Array.isArray(dateOrOptions)) ? dateOrOptions : { date: dateOrOptions };
  return SendPanelFastPaths_.resetAllSentFast(payload && payload.date || '');
}

function markRowSentFast(rowNum, dateOrOptions, options) {
  var datePayload = (dateOrOptions && typeof dateOrOptions === 'object' && !Array.isArray(dateOrOptions)) ? dateOrOptions : { date: dateOrOptions };
  return SendPanelFastPaths_.markRowSentFast(rowNum, datePayload && datePayload.date || '', options || {});
}

function apiBuildSendPanelFast(options) {
  return buildSendPanelFast(options || {});
}

function apiGenerateSendPanelForDateFast(options) {
  return buildSendPanelFast(options || {});
}

function apiResetAllSentFast(options) {
  return resetAllSentFast(options || {});
}

function apiMarkRowSentFast(rowNum, dateOrOptions, options) {
  return markRowSentFast(rowNum, dateOrOptions || {}, options || {});
}

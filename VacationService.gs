/**
 * UseCases.gs — application / use-case layer для stage 4.
 */

function _stage4RowsToChangeList_(rows, type) {
  return stage4AsArray_(rows).map(function(item) {
    return {
      type: type || 'row',
      row: item.row,
      fio: item.fio || '',
      code: item.code || '',
      status: item.status || ''
    };
  });
}

function _stage4GroupContiguousRows_(rows) {
  const sorted = [...new Set(stage4AsArray_(rows).map(Number).filter(Number.isFinite))].sort(function(a, b) { return a - b; });
  const groups = [];
  sorted.forEach(function(row) {
    const last = groups[groups.length - 1];
    if (!last || row !== last.end + 1) {
      groups.push({ start: row, end: row, rows: [row] });
      return;
    }
    last.end = row;
    last.rows.push(row);
  });
  return groups;
}

function _stage4ApplyPanelState_(rowNumbers, sentValue, statusText) {
  const panel = DataAccess_.getSheet('SEND_PANEL', null, true);
  const schema = SheetSchemas_.get('SEND_PANEL');
  const groups = _stage4GroupContiguousRows_(rowNumbers);

  groups.forEach(function(group) {
    const count = group.rows.length;
    panel.getRange(group.start, schema.columns.status, count, 1)
      .setValues(group.rows.map(function() { return [statusText]; }));
    panel.getRange(group.start, schema.columns.sent, count, 1)
      .setValues(group.rows.map(function() { return [!!sentValue]; }));
  });

  return SendPanelRepository_.readRows();
}

function _stage4GetPanelReadyRows_() {
  return SendPanelRepository_.readRows().filter(function(item) {
    return shouldTreatRowAsReadyToOpen_(item);
  });
}

function _stage6AVerifyPanelStatuses_(rows, expectedStatus, expectedSent) {
  const selected = SendPanelRepository_.readRows().filter(function(item) {
    return stage4AsArray_(rows).map(Number).indexOf(Number(item.row)) !== -1;
  });
  const mismatches = selected.filter(function(item) {
    return String(item.status || '') !== String(expectedStatus || '') || !!item.sent !== !!expectedSent;
  });
  return {
    ok: mismatches.length === 0,
    verifiedRows: selected.length,
    mismatchCount: mismatches.length,
    partial: mismatches.length > 0,
    warnings: mismatches.length ? [`Післяопераційна перевірка виявила ${mismatches.length} невідповідностей`] : []
  };
}

function _stage6AVerifySendPanelBuild_(execution) {
  const result = execution && execution.result || {};
  const rows = stage4AsArray_(result.rows);
  const stats = result.stats || SendPanelRepository_.buildStats(rows);
  return {
    ok: rows.length > 0 || !!result.persisted,
    rows: rows.length,
    stats: stats,
    partial: false,
    warnings: []
  };
}

function _stage4CreateNextMonthCore_(payload) {
  const ss = SpreadsheetApp.getActive();
  const explicitSource = payload && payload.sourceMonth ? validateMonthSwitch_(payload.sourceMonth).sheet : getBotSheet_();
  const src = explicitSource;
  const srcName = String(src.getName()).trim();

  _stage4Assert_(/^\d{2}$/.test(srcName), '_stage4CreateNextMonthCore_', { sheet: srcName }, `Активний лист "${srcName}" не є місячним`);

  let nextNum = parseInt(srcName, 10) + 1;
  if (nextNum > 12) nextNum = 1;
  if (nextNum < 1) nextNum = 1;

  const nextName = String(nextNum).padStart(2, '0');
  _stage4Assert_(!ss.getSheetByName(nextName), '_stage4CreateNextMonthCore_', { sourceMonth: srcName, nextMonth: nextName }, `Лист "${nextName}" вже існує`);

  const newSheet = src.copyTo(ss).setName(nextName);
  const srcMY = _inferMonthYearFromSheet_(src);
  const targetMonth = nextNum;
  const targetYear = (targetMonth < srcMY.month) ? (srcMY.year + 1) : srcMY.year;

  _setMonthDatesRow_(newSheet, targetMonth, targetYear);
  newSheet.getRange(CONFIG.CODE_RANGE_A1).clearContent();

  try { applyGlobalSheetStandards_(); } catch (_) {}

  if (payload.switchToNewMonth !== false) {
    setBotMonthSheetName_(nextName);
  } else {
    highlightActiveMonthTab_(getBotMonthSheetName_());
  }

  return {
    sheet: newSheet,
    sourceMonth: srcName,
    createdMonth: nextName,
    switched: payload.switchToNewMonth !== false
  };
}

const Stage4UseCases_ = (function() {
  function generateSendPanelForDate(options) {
    const payload = Object.assign({}, options || {});
    return WorkflowOrchestrator_.run({
      scenario: 'generateSendPanelForDate',
      routeName: 'sidebar.generateSendPanelForDate',
      publicApiMethod: 'apiGenerateSendPanelForDate',
      payload: payload,
      write: true,
      validate: function(input) {
        const dateInfo = validateDatePayload_(input, 'date');
        return {
          payload: Object.assign({}, input, { date: dateInfo.dateStr, dateStr: dateInfo.dateStr, dryRun: !!input.dryRun }),
          warnings: dateInfo.warnings
        };
      },
      readBefore: function(input) {
        return {
          currentRows: SendPanelRepository_.readRows(),
          currentMonth: getBotMonthSheetName_(),
          date: input.dateStr || input.date || _todayStr_()
        };
      },
      plan: function(input) {
        const preview = SendPanelRepository_.preview(input.dateStr || input.date);
        const stats = preview.stats || SendPanelRepository_.buildStats(preview.rows || []);
        return {
          preview: preview,
          meta: {
            affectedSheets: [CONFIG.SEND_PANEL_SHEET, preview.month || getBotMonthSheetName_()],
            affectedEntities: [],
            plannedRows: stats.totalCount || 0
          },
          warnings: stats.errorCount > 0 ? [`У SEND_PANEL є рядки з помилками: ${stats.errorCount}`] : []
        };
      },
      execute: function(input, beforeState, plan) {
        const built = input.dryRun ? plan.preview : SendPanelRepository_.rebuild(input.dateStr || input.date);
        const stats = built.stats || SendPanelRepository_.buildStats(built.rows || []);
        return {
          success: true,
          message: input.dryRun ? 'SEND_PANEL перевірено без запису' : 'SEND_PANEL згенеровано',
          result: built,
          changes: input.dryRun ? [] : [{
            type: 'rebuildSendPanel',
            sheet: CONFIG.SEND_PANEL_SHEET,
            date: built.date,
            count: built.rowsWritten || (built.rows || []).length
          }],
          affectedSheets: [CONFIG.SEND_PANEL_SHEET, built.month || getBotMonthSheetName_()],
          affectedEntities: [],
          appliedChangesCount: input.dryRun ? 0 : ((built.rows || []).length || 0),
          skippedChangesCount: 0,
          partial: false,
          meta: {
            stats: stats
          },
          warnings: stats.errorCount > 0 ? [`У SEND_PANEL є рядки з помилками: ${stats.errorCount}`] : []
        };
      },
      sync: function(input, beforeState, plan, execution) {
        return {
          refresh: ['panel', 'sidebarCounters'],
          invalidateCaches: ['sendPanel', 'sidebar', 'summary'],
          month: execution.result && execution.result.month ? execution.result.month : getBotMonthSheetName_()
        };
      },
      verify: function(input, beforeState, plan, execution) {
        return _stage6AVerifySendPanelBuild_(execution);
      }
    });
  }

  function generateSendPanelForRange(options) {
    const payload = Object.assign({}, options || {});
    return WorkflowOrchestrator_.run({
      scenario: 'generateSendPanelForRange',
      routeName: 'sidebar.generateSendPanelForRange',
      publicApiMethod: 'apiGenerateSendPanelForRange',
      payload: payload,
      write: true,
      validate: function(input) {
        const range = validateDateRangePayload_(input);
        return {
          payload: Object.assign({}, input, range.payload, { dryRun: !!input.dryRun }),
          warnings: range.warnings
        };
      },
      execute: function(input, beforeState, plan, context) {
        const start = _parseUaDate_(input.startDate);
        const end = _parseUaDate_(input.endDate);
        const reports = [];
        let cursor = new Date(start);
        while (cursor.getTime() <= end.getTime()) {
          const dateStr = Utilities.formatDate(cursor, getTimeZone_(), 'dd.MM.yyyy');
          const preview = SendPanelRepository_.preview(dateStr);
          reports.push({
            date: dateStr,
            month: preview.month,
            stats: preview.stats,
            rows: preview.rows
          });
          cursor.setDate(cursor.getDate() + 1);
        }

        let persisted = null;
        const warnings = [];
        if (!input.dryRun && reports.length) {
          const lastDate = reports[reports.length - 1].date;
          persisted = SendPanelRepository_.rebuild(lastDate);
          warnings.push('Фізично записано лише останню дату діапазону, бо SEND_PANEL — один аркуш');
        }

        return {
          success: true,
          message: input.dryRun
            ? `Dry-run генерації SEND_PANEL для ${reports.length} дат`
            : `Підготовлено ${reports.length} дат, записано останню`,
          result: {
            range: {
              startDate: input.startDate,
              endDate: input.endDate,
              count: reports.length
            },
            reports: reports,
            persisted: persisted
          },
          changes: !input.dryRun && persisted ? [{
            type: 'rebuildSendPanel',
            sheet: CONFIG.SEND_PANEL_SHEET,
            date: persisted.date,
            count: persisted.rowsWritten || (persisted.rows || []).length
          }] : [],
          affectedSheets: !input.dryRun && persisted ? [CONFIG.SEND_PANEL_SHEET, persisted.month || getBotMonthSheetName_()] : [],
          affectedEntities: [],
          appliedChangesCount: !input.dryRun && persisted ? ((persisted.rows || []).length || 0) : 0,
          skippedChangesCount: input.dryRun ? reports.length : Math.max(reports.length - 1, 0),
          partial: !input.dryRun && reports.length > 1,
          warnings: warnings
        };
      },
      verify: function(input, beforeState, plan, execution) {
        return _stage6AVerifySendPanelBuild_(execution);
      }
    });
  }

  function markPanelRowsAsPending(rowNumbers, options) {
    const payload = Object.assign({}, options || {}, { rowNumbers: rowNumbers });
    return WorkflowOrchestrator_.run({
      scenario: 'markPanelRowsAsPending',
      routeName: 'sidebar.markPanelRowsAsPending',
      publicApiMethod: 'apiMarkPanelRowsAsPending',
      payload: payload,
      write: true,
      validate: function(input) {
        const rowsInfo = validatePanelRowSelection_(input.rowNumbers, { maxRows: input.maxRows });
        return {
          payload: Object.assign({}, input, { rowNumbers: rowsInfo.rows, dryRun: !!input.dryRun }),
          warnings: rowsInfo.warnings
        };
      },
      readBefore: function(input) {
        const rows = SendPanelRepository_.readRows();
        return {
          selectedRows: rows.filter(function(item) { return input.rowNumbers.indexOf(item.row) !== -1; }),
          allRows: rows
        };
      },
      execute: function(input, beforeState) {
        const targetRows = beforeState.selectedRows || [];
        if (input.dryRun) {
          return {
            success: true,
            message: `Dry-run: буде позначено ${targetRows.length} рядків як такі, що очікують підтвердження`,
            result: {
              rows: beforeState.allRows,
              updatedRows: input.rowNumbers,
              stats: SendPanelRepository_.buildStats(beforeState.allRows)
            },
            changes: [],
            affectedSheets: [CONFIG.SEND_PANEL_SHEET],
            affectedEntities: targetRows.map(function(item) { return item.fio; }),
            appliedChangesCount: 0,
            skippedChangesCount: 0,
            partial: false
          };
        }

        const result = SendPanelRepository_.markRowsAsPending(input.rowNumbers, {});
        return {
          success: true,
          message: `Позначено ${result.updatedRows.length} рядків як такі, що очікують підтвердження`,
          result: result,
          changes: _stage4RowsToChangeList_(targetRows, 'markPending'),
          affectedSheets: [CONFIG.SEND_PANEL_SHEET],
          affectedEntities: targetRows.map(function(item) { return item.fio; }),
          appliedChangesCount: result.updatedRows.length,
          skippedChangesCount: 0,
          partial: false
        };
      },
      sync: function() {
        return {
          refresh: ['panel', 'counters', 'summaryPreview'],
          invalidateCaches: ['sendPanel']
        };
      },
      verify: function(input) {
        return input.dryRun ? { ok: true, verifiedRows: 0, mismatchCount: 0 } : _stage6AVerifyPanelStatuses_(input.rowNumbers, SendPanelConstants_.STATUS_PENDING, false);
      }
    });
  }

  function markPanelRowsAsSent(rowNumbers, options) {
    const payload = Object.assign({}, options || {}, { rowNumbers: rowNumbers });
    return WorkflowOrchestrator_.run({
      scenario: 'markPanelRowsAsSent',
      routeName: 'sidebar.markPanelRowsAsSent',
      publicApiMethod: 'apiMarkPanelRowsAsSent',
      payload: payload,
      write: true,
      validate: function(input) {
        const rowsInfo = validatePanelRowSelection_(input.rowNumbers, { maxRows: input.maxRows });
        return {
          payload: Object.assign({}, input, { rowNumbers: rowsInfo.rows, dryRun: !!input.dryRun }),
          warnings: rowsInfo.warnings
        };
      },
      readBefore: function(input) {
        const rows = SendPanelRepository_.readRows();
        return {
          selectedRows: rows.filter(function(item) { return input.rowNumbers.indexOf(item.row) !== -1; }),
          allRows: rows
        };
      },
      execute: function(input, beforeState) {
        const targetRows = beforeState.selectedRows || [];
        const alreadySent = targetRows.filter(function(item) { return item.sent || item.status === getSendPanelSentStatus_(); });
        const warnings = alreadySent.length ? [`Уже відправлені рядки: ${alreadySent.length}`] : [];

        if (input.dryRun) {
          return {
            success: true,
            message: `Dry-run: буде позначено ${input.rowNumbers.length} рядків`,
            result: {
              rows: beforeState.allRows,
              updatedRows: input.rowNumbers,
              stats: SendPanelRepository_.buildStats(beforeState.allRows)
            },
            changes: [],
            affectedSheets: [CONFIG.SEND_PANEL_SHEET],
            affectedEntities: targetRows.map(function(item) { return item.fio; }),
            appliedChangesCount: 0,
            skippedChangesCount: alreadySent.length,
            partial: false,
            warnings: warnings
          };
        }

        const result = SendPanelRepository_.markRowsAsSent(input.rowNumbers, {});
        return {
          success: true,
          message: `Позначено ${result.updatedRows.length} рядків`,
          result: result,
          changes: _stage4RowsToChangeList_(targetRows, 'markSent'),
          affectedSheets: [CONFIG.SEND_PANEL_SHEET],
          affectedEntities: targetRows.map(function(item) { return item.fio; }),
          appliedChangesCount: result.updatedRows.length,
          skippedChangesCount: alreadySent.length,
          partial: alreadySent.length > 0,
          warnings: warnings
        };
      },
      sync: function() {
        return {
          refresh: ['panel', 'counters', 'summaryPreview'],
          invalidateCaches: ['sendPanel']
        };
      },
      verify: function(input) {
        return input.dryRun ? { ok: true, verifiedRows: 0, mismatchCount: 0 } : _stage6AVerifyPanelStatuses_(input.rowNumbers, getSendPanelSentStatus_(), true);
      }
    });
  }

  function markPanelRowsAsUnsent(rowNumbers, options) {
    const payload = Object.assign({}, options || {}, { rowNumbers: rowNumbers });
    return WorkflowOrchestrator_.run({
      scenario: 'markPanelRowsAsUnsent',
      routeName: 'sidebar.markPanelRowsAsUnsent',
      publicApiMethod: 'apiMarkPanelRowsAsUnsent',
      payload: payload,
      write: true,
      validate: function(input) {
        const rowsInfo = validatePanelRowSelection_(input.rowNumbers, { maxRows: input.maxRows });
        return {
          payload: Object.assign({}, input, { rowNumbers: rowsInfo.rows, dryRun: !!input.dryRun }),
          warnings: rowsInfo.warnings
        };
      },
      readBefore: function(input) {
        const rows = SendPanelRepository_.readRows();
        return {
          selectedRows: rows.filter(function(item) { return input.rowNumbers.indexOf(item.row) !== -1; }),
          allRows: rows
        };
      },
      execute: function(input, beforeState) {
        const targetRows = beforeState.selectedRows || [];
        if (input.dryRun) {
          return {
            success: true,
            message: `Dry-run: буде знято статус відправки з ${targetRows.length} рядків`,
            result: {
              rows: beforeState.allRows,
              updatedRows: input.rowNumbers,
              stats: SendPanelRepository_.buildStats(beforeState.allRows)
            },
            changes: [],
            affectedSheets: [CONFIG.SEND_PANEL_SHEET],
            affectedEntities: targetRows.map(function(item) { return item.fio; }),
            appliedChangesCount: 0,
            skippedChangesCount: 0,
          partial: false
          };
        }

        const result = SendPanelRepository_.markRowsAsUnsent(input.rowNumbers, {});
        return {
          success: true,
          message: `Знято статус відправки з ${result.updatedRows.length} рядків`,
          result: result,
          changes: _stage4RowsToChangeList_(targetRows, 'markUnsent'),
          affectedSheets: [CONFIG.SEND_PANEL_SHEET],
          affectedEntities: targetRows.map(function(item) { return item.fio; }),
          appliedChangesCount: result.updatedRows.length,
          skippedChangesCount: 0,
          partial: false
        };
      },
      sync: function() {
        return {
          refresh: ['panel', 'counters'],
          invalidateCaches: ['sendPanel']
        };
      },
      verify: function(input) {
        return input.dryRun ? { ok: true, verifiedRows: 0, mismatchCount: 0 } : _stage6AVerifyPanelStatuses_(input.rowNumbers, SendPanelConstants_.STATUS_UNSENT, false);
      }
    });
  }

  function sendPendingRows(options) {
    const payload = Object.assign({}, options || {});
    return WorkflowOrchestrator_.run({
      scenario: 'sendPendingRows',
      routeName: 'sidebar.sendPendingRows',
      publicApiMethod: 'apiSendPendingRows',
      payload: payload,
      write: true,
      validate: function(input) {
        const sendInfo = validateSendOperation_(input);
        return {
          payload: Object.assign({}, input, sendInfo.payload),
          warnings: sendInfo.warnings
        };
      },
      readBefore: function() {
        const readyRows = _stage4GetPanelReadyRows_();
        return {
          readyRows: readyRows,
          allRows: SendPanelRepository_.readRows()
        };
      },
      execute: function(input, beforeState) {
        const queue = (beforeState.readyRows || []).slice(0, input.limit);
        if (!queue.length) {
          return {
            success: true,
            message: 'Немає рядків для відкриття',
            result: {
              queue: [],
              rows: beforeState.allRows,
              stats: SendPanelRepository_.buildStats(beforeState.allRows)
            },
            changes: [],
            affectedSheets: [CONFIG.SEND_PANEL_SHEET],
            affectedEntities: [],
            appliedChangesCount: 0,
            skippedChangesCount: 0,
          partial: false
          };
        }

        if (input.dryRun) {
          return {
            success: true,
            message: `Dry-run: підготовлено ${queue.length} чатів без фіксації відправки`,
            result: {
              queue: queue,
              rows: beforeState.allRows,
              stats: SendPanelRepository_.buildStats(beforeState.allRows)
            },
            changes: [],
            affectedSheets: [CONFIG.SEND_PANEL_SHEET],
            affectedEntities: queue.map(function(item) { return item.fio; }),
            appliedChangesCount: 0,
            skippedChangesCount: 0,
          partial: false
          };
        }

        const result = SendPanelRepository_.markRowsAsPending(queue.map(function(item) { return item.row; }), {});
        return {
          success: true,
          message: `Позначено ${queue.length} рядків як такі, що очікують підтвердження`,
          result: {
            queue: queue,
            rows: result.rows,
            updatedRows: result.updatedRows,
            stats: result.stats
          },
          changes: _stage4RowsToChangeList_(queue, 'markPending'),
          affectedSheets: [CONFIG.SEND_PANEL_SHEET],
          affectedEntities: queue.map(function(item) { return item.fio; }),
          appliedChangesCount: queue.length,
          skippedChangesCount: 0,
          partial: false
        };
      },
      sync: function() {
        return {
          refresh: ['panel', 'counters'],
          invalidateCaches: ['sendPanel']
        };
      },
      verify: function(input, beforeState, plan, execution) {
        if (input.dryRun) return { ok: true, verifiedRows: 0, mismatchCount: 0 };
        const updatedRows = stage4AsArray_(execution && execution.result && execution.result.updatedRows);
        return _stage6AVerifyPanelStatuses_(updatedRows, SendPanelConstants_.STATUS_PENDING, false);
      }
    });
  }


  function listMonths(options) {
    const payload = Object.assign({}, options || {});
    return WorkflowOrchestrator_.run({
      scenario: 'listMonths',
      payload: payload,
      write: false,
      lock: false,
      execute: function() {
        const ss = SpreadsheetApp.getActive();
        const months = ss.getSheets()
          .map(function(sheet) { return sheet.getName(); })
          .filter(function(name) { return /^\d{2}$/.test(name); })
          .sort();
        const current = getBotMonthSheetName_();
        return {
          success: true,
          message: 'Місяці завантажено',
          result: {
            months: months,
            current: current
          },
          changes: [],
          affectedSheets: months,
          affectedEntities: [],
          appliedChangesCount: 0,
          skippedChangesCount: 0,
          partial: false
        };
      }
    });
  }

  function getSendPanelData(options) {
    const payload = Object.assign({}, options || {});
    return WorkflowOrchestrator_.run({
      scenario: 'getSendPanelData',
      payload: payload,
      write: false,
      lock: false,
      execute: function() {
        const rows = SendPanelRepository_.readRows();
        const stats = SendPanelRepository_.buildStats(rows);
        const panelMeta = typeof SendPanelRepository_.getPanelMetadata === 'function' ? SendPanelRepository_.getPanelMetadata() : { month: getBotMonthSheetName_(), date: '' };
        return {
          success: true,
          message: 'SEND_PANEL перечитано',
          result: {
            rows: rows,
            stats: stats,
            month: panelMeta.month || getBotMonthSheetName_(),
            date: panelMeta.date || ''
          },
          changes: [],
          affectedSheets: [CONFIG.SEND_PANEL_SHEET, getBotMonthSheetName_()],
          affectedEntities: [],
          appliedChangesCount: 0,
          skippedChangesCount: 0,
          warnings: stats.errorCount > 0 ? ['У SEND_PANEL є рядки з помилками: ' + stats.errorCount] : []
        };
      }
    });
  }

  function buildDaySummary(options) {
    const payload = typeof options === 'string' ? { date: options } : Object.assign({}, options || {});
    return WorkflowOrchestrator_.run({
      scenario: 'buildDaySummary',
      payload: payload,
      write: false,
      lock: false,
      validate: function(input) {
        const info = validateDatePayload_(input, 'date');
        return { payload: info.payload, warnings: [] };
      },
      execute: function(input, beforeState, plan, context) {
        const summary = SummaryRepository_.buildDaySummary(input.dateStr || input.date);
        const targetDate = _parseUaDate_(summary.date) || new Date();
        const vacations = runVacationEngine_(targetDate);
        const birthdays = runBirthdayEngine_(targetDate);
        return {
          success: true,
          message: 'Зведення сформовано',
          result: {
            summary: summary.summary,
            date: summary.date,
            vacations: vacations,
            birthdays: birthdays,
            sheet: summary.sheet
          },
          changes: [],
          affectedSheets: [summary.sheet],
          affectedEntities: [],
          appliedChangesCount: 0,
          skippedChangesCount: 0,
          partial: false
        };
      }
    });
  }

  function buildDetailedSummary(options) {
    const payload = typeof options === 'string' ? { date: options } : Object.assign({}, options || {});
    return WorkflowOrchestrator_.run({
      scenario: 'buildDetailedSummary',
      payload: payload,
      write: false,
      lock: false,
      validate: function(input) {
        const info = validateDatePayload_(input, 'date');
        return { payload: info.payload, warnings: [] };
      },
      execute: function(input, beforeState, plan, context) {
        const summary = SummaryRepository_.buildDetailedSummary(input.dateStr || input.date);
        const targetDate = _parseUaDate_(summary.date) || new Date();
        const vacations = runVacationEngine_(targetDate);
        const birthdays = runBirthdayEngine_(targetDate);
        return {
          success: true,
          message: 'Детальне зведення сформовано',
          result: {
            summary: summary.summary,
            date: summary.date,
            peopleCount: summary.peopleCount,
            vacations: vacations,
            birthdays: birthdays,
            sheet: summary.sheet
          },
          changes: [],
          affectedSheets: [summary.sheet],
          affectedEntities: [],
          appliedChangesCount: 0,
          skippedChangesCount: 0,
          partial: false
        };
      }
    });
  }

  function openPersonCard(options, dateStr) {
    const payload = (typeof options === 'string')
      ? { callsign: options, date: dateStr || _todayStr_() }
      : Object.assign({}, options || {});
    return WorkflowOrchestrator_.run({
      scenario: 'openPersonCard',
      payload: payload,
      write: false,
      lock: false,
      validate: function(input) {
        const info = validatePersonLookupPayload_(input);
        return { payload: info.payload, warnings: [] };
      },
      execute: function(input, beforeState, plan, context) {
        const person = PersonsRepository_.getPersonByCallsign(input.callsign, input.dateStr || input.date);
        return {
          success: true,
          message: 'Картку бійця зібрано',
          result: person,
          changes: [],
          affectedSheets: [person.sheet],
          affectedEntities: [person.callsign || person.fio],
          appliedChangesCount: 0,
          skippedChangesCount: 0,
          warnings: person.phone ? [] : ['Для бійця не знайдено телефон']
        };
      }
    });
  }

  function loadCalendarDay(options) {
    const payload = typeof options === 'string' ? { date: options } : Object.assign({}, options || {});
    return WorkflowOrchestrator_.run({
      scenario: 'loadCalendarDay',
      payload: payload,
      write: false,
      lock: false,
      validate: function(input) {
        const info = validateDatePayload_(input, 'date');
        return { payload: info.payload, warnings: [] };
      },
      execute: function(input, beforeState, plan, context) {
        const sidebar = PersonsRepository_.getSidebarPersonnel(input.dateStr || input.date);
        return {
          success: true,
          message: 'Дані дня завантажено',
          result: sidebar,
          changes: [],
          affectedSheets: [sidebar.month],
          affectedEntities: [],
          appliedChangesCount: 0,
          skippedChangesCount: 0,
          partial: false
        };
      }
    });
  }

  function checkVacationsAndBirthdays(options) {
    const payload = typeof options === 'string' ? { date: options } : Object.assign({}, options || {});
    return WorkflowOrchestrator_.run({
      scenario: 'checkVacationsAndBirthdays',
      payload: payload,
      write: false,
      lock: false,
      validate: function(input) {
        const info = validateDatePayload_(input, 'date');
        return { payload: info.payload, warnings: [] };
      },
      execute: function(input, beforeState, plan, context) {
        const targetDate = _parseUaDate_(input.dateStr || input.date) || new Date();
        const vacations = runVacationEngine_(targetDate) || {};
        const birthdays = runBirthdayEngine_(targetDate) || {};
        return {
          success: true,
          message: 'Перевірку відпусток і ДН виконано',
          result: {
            date: input.dateStr || input.date,
            vacations: vacations,
            birthdays: birthdays
          },
          changes: [],
          affectedSheets: [getBotMonthSheetName_(), CONFIG.PHONES_SHEET],
          affectedEntities: [],
          appliedChangesCount: 0,
          skippedChangesCount: 0,
          partial: false
        };
      }
    });
  }


  function switchBotToMonth(options, monthSheetName) {
    const payload = (typeof options === 'string')
      ? { month: options }
      : Object.assign({}, options || {}, monthSheetName ? { month: monthSheetName } : {});
    return WorkflowOrchestrator_.run({
      scenario: 'switchBotToMonth',
      payload: payload,
      write: true,
      validate: function(input) {
        const validated = validateMonthSwitch_(input.month || input.monthSheetName || input.sheetName || '');
        return {
          payload: Object.assign({}, input, { month: validated.month }),
          warnings: []
        };
      },
      execute: function(input, beforeState, plan, context) {
        setBotMonthSheetName_(input.month);
        return {
          success: true,
          message: 'Активний місяць перемкнуто',
          result: {
            month: input.month
          },
          changes: [{
            type: 'switchBotMonth',
            month: input.month
          }],
          affectedSheets: [input.month],
          affectedEntities: [],
          appliedChangesCount: 1,
          skippedChangesCount: 0,
          partial: false
        };
      },
      sync: function(input) {
        return {
          refresh: ['monthsList', 'currentMonth', 'panel'],
          invalidateCaches: ['sidebar', 'summary', 'sendPanel'],
          currentMonth: input.month
        };
      }
    });
  }

  function createNextMonth(options) {
    const payload = Object.assign({ switchToNewMonth: true }, options || {});
    return WorkflowOrchestrator_.run({
      scenario: 'createNextMonth',
      routeName: 'sidebar.createNextMonth',
      publicApiMethod: 'apiCreateNextMonthStage4',
      payload: payload,
      write: true,
      validate: function(input) {
        if (input.sourceMonth) validateMonthSwitch_(input.sourceMonth);
        return { payload: input, warnings: [] };
      },
      execute: function(input, beforeState, plan, context) {
        const created = _stage4CreateNextMonthCore_(input);
        return {
          success: true,
          message: `Місяць "${created.createdMonth}" створено`,
          result: created,
          changes: [{
            type: 'createMonthSheet',
            from: created.sourceMonth,
            to: created.createdMonth
          }],
          affectedSheets: [created.sourceMonth, created.createdMonth],
          affectedEntities: [],
          appliedChangesCount: 1,
          skippedChangesCount: 0,
          partial: false
        };
      },
      sync: function(input, beforeState, plan, execution) {
        return {
          refresh: ['monthsList', 'currentMonth'],
          invalidateCaches: ['sidebar', 'summary'],
          currentMonth: execution.result && execution.result.switched ? execution.result.createdMonth : getBotMonthSheetName_()
        };
      },
      verify: function(input, beforeState, plan, execution) {
        if (input.dryRun) return { ok: true, createdMonth: execution.result && execution.result.createdMonth || '', partial: false };
        const createdMonth = execution.result && execution.result.createdMonth || '';
        const exists = !!SpreadsheetApp.getActive().getSheetByName(createdMonth);
        return { ok: exists, createdMonth: createdMonth, partial: !exists, warnings: exists ? [] : ['Післяопераційна перевірка не знайшла створений місяць'] };
      }
    });
  }

  function runReconciliation(options) {
    const payload = Object.assign({}, options || {});
    return WorkflowOrchestrator_.run({
      scenario: 'runReconciliation',
      routeName: 'sidebar.runReconciliation',
      publicApiMethod: 'apiRunReconciliation',
      payload: payload,
      write: ['repair', 'previewRepair', 'repairSelectedIssues', 'repairWithVerification'].indexOf(String(payload.mode || 'check')) !== -1,
      validate: function(input) {
        const info = validateRepairOperation_(input);
        return { payload: info.payload, warnings: info.warnings };
      },
      execute: function(input, beforeState, plan, context) {
        const report = Reconciliation_.run(input);
        const mode = String(input.mode || 'check');
        const postCheck = report.postCheck || null;
        const success = ['check', 'report', 'previewRepair'].indexOf(mode) !== -1
          ? true
          : (postCheck ? Number(postCheck.criticalRemaining || 0) === 0 : true);
        return {
          success: success,
          message: report.message || 'Reconciliation завершено',
          result: report,
          changes: report.repairs || [],
          affectedSheets: report.affectedSheets || [],
          affectedEntities: [],
          appliedChangesCount: report.appliedChangesCount || 0,
          skippedChangesCount: report.skippedChangesCount || 0,
          partial: !!report.partial,
          warnings: report.warnings || []
        };
      },
      sync: function(input, beforeState, plan, execution) {
        return {
          refresh: ['panel', 'summaryPreview'],
          invalidateCaches: ['sendPanel', 'sidebar'],
          reconciliation: execution.result && execution.result.summary ? execution.result.summary : null
        };
      },
      verify: function(input, beforeState, plan, execution) {
        if (input.dryRun || ['repair', 'repairSelectedIssues', 'repairWithVerification'].indexOf(String(input.mode || '')) === -1) {
          return { ok: true, partial: false };
        }
        const postCheck = execution && execution.result && execution.result.postCheck || null;
        if (postCheck) {
          return { ok: Number(postCheck.criticalRemaining || 0) === 0, partial: Number(postCheck.remainingIssues || 0) > 0, remainingIssues: postCheck.remainingIssues || 0, criticalRemaining: postCheck.criticalRemaining || 0 };
        }
        return { ok: true, partial: false, warnings: ['Reconciliation verify повернувся без postCheck'] };
      }
    });
  }

  function resolveRestartBotMonth_() {
    const ss = SpreadsheetApp.getActive();
    let month = '';

    try { month = String(getBotMonthSheetName_() || '').trim(); } catch (_) {}
    if (month && ss.getSheetByName(month)) return month;

    const activeSheet = ss.getActiveSheet();
    const activeName = activeSheet ? String(activeSheet.getName() || '').trim() : '';
    if (/^\d{2}$/.test(activeName) && ss.getSheetByName(activeName)) return activeName;

    const currentMonth = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MM');
    if (ss.getSheetByName(currentMonth)) return currentMonth;

    const fallback = ss.getSheets()
      .map(function(sh) { return String(sh.getName() || '').trim(); })
      .find(function(name) { return /^\d{2}$/.test(name); });

    if (fallback && ss.getSheetByName(fallback)) return fallback;
    throw new Error('Не знайдено аркуш місяця для перезапуску бота');
  }

  function clearRestartBotTransientState_(options) {
    const docProps = PropertiesService.getDocumentProperties();
    const scriptProps = PropertiesService.getScriptProperties();

    const allDocProps = docProps.getProperties();
    const allScriptProps = scriptProps.getProperties();

    const report = {
      runtimeActiveCleared: 0,
      safetyActiveCleared: 0,
      blockingKeysCleared: 0,
      stage7ActiveCleared: 0,
      cachesCleared: true
    };

    Object.keys(allDocProps).forEach(function(key) {
      if (key.indexOf('STAGE5:JOB_RUNTIME:ACTIVE:') === 0) {
        docProps.deleteProperty(key);
        report.runtimeActiveCleared += 1;
        return;
      }

      if (key.indexOf('STAGE6A:SAFETY:') === 0 && key.indexOf(':ACTIVE:') !== -1) {
        docProps.deleteProperty(key);
        report.safetyActiveCleared += 1;
      }
    });

    Object.keys(allScriptProps).forEach(function(key) {
      if (typeof isKnownBlockingKey_ === 'function' && isKnownBlockingKey_(key)) {
        scriptProps.deleteProperty(key);
        report.blockingKeysCleared += 1;
      }
    });

    Object.keys(allDocProps).forEach(function(key) {
      if (typeof isKnownBlockingKey_ === 'function' && isKnownBlockingKey_(key)) {
        docProps.deleteProperty(key);
        report.blockingKeysCleared += 1;
      }
    });

    if (typeof OperationRepository_ === 'object') {
      try {
        const opts = options && typeof options === 'object' ? options : {};
        const abandoned = OperationRepository_.abandonAllActive('restart-bot', {
          excludeOperationId: opts.excludeOperationId || '',
          excludeOperationIds: stage4AsArray_(opts.excludeOperationIds)
        });
        report.stage7ActiveCleared = Number(abandoned && abandoned.total || 0);
      } catch (_) {}
    }

    clearCacheCore_();
    try { resetTemplatesCache_(); } catch (_) {}
    try { CacheService.getScriptCache().removeAll([cacheKeyPhones_(), 'PHONES_PROFILES_v4']); } catch (_) {}

    return report;
  }

  function runMaintenanceScenario(options) {
    const payload = Object.assign({ type: 'quick' }, options || {});
    const type = String(payload.type || 'quick');
    const writeTypes = {
      cleanupCaches: true,
      clearLog: true,
      clearPhoneCache: true,
      restartBot: true,
      setupVacationTriggers: true,
      cleanupDuplicateTriggers: true,
      cleanupLifecycleRetention: true
    };

    return WorkflowOrchestrator_.run({
      scenario: 'runMaintenanceScenario',
      payload: payload,
      write: !!writeTypes[type],
      validate: function(input) {
        if (String(input.type || '') === 'postCreateMonth' && input.month) {
          validateMonthSwitch_(input.month);
        }
        return { payload: input, warnings: [] };
      },
      execute: function(input, beforeState, plan, context) {
        switch (String(input.type || 'quick')) {
          case 'cleanupCaches':
            clearCacheCore_();
            try { resetTemplatesCache_(); } catch (_) {}
            try { CacheService.getScriptCache().removeAll([cacheKeyPhones_(), 'PHONES_PROFILES_v4']); } catch (_) {}
            return {
              success: true,
              message: 'Кеші очищено',
              result: { cleaned: true, type: 'cleanupCaches' },
              changes: [{ type: 'cleanupCaches' }],
              affectedSheets: [],
              affectedEntities: [],
              appliedChangesCount: 1,
              skippedChangesCount: 0,
              partial: false
            };

          case 'clearLog': {
            const response = normalizeServerResponse_(LogsRepository_.clear(), 'clearLog', {});
            const result = Object.assign({ type: 'clearLog' }, response.data || {});
            const cleared = !!result.cleared;
            return {
              success: response.success !== false,
              message: response.message || (cleared ? 'LOG очищено' : 'LOG не знайдено'),
              result: result,
              changes: cleared ? [{ type: 'clearLog' }] : [],
              affectedSheets: ['LOG'],
              affectedEntities: [],
              appliedChangesCount: cleared ? 1 : 0,
              skippedChangesCount: cleared ? 0 : 1,
              warnings: response.warnings || []
            };
          }

          case 'clearPhoneCache': {
            const keys = [cacheKeyPhones_(), 'PHONES_PROFILES_v4'];
            CacheService.getScriptCache().removeAll(keys);
            return {
              success: true,
              message: 'Кеш телефонів очищено',
              result: {
                cleaned: true,
                type: 'clearPhoneCache',
                keys: keys
              },
              changes: [{ type: 'clearPhoneCache', keys: keys }],
              affectedSheets: [],
              affectedEntities: [],
              appliedChangesCount: 1,
              skippedChangesCount: 0,
          partial: false
            };
          }

          case 'restartBot': {
            const month = resolveRestartBotMonth_();
            const restartReport = clearRestartBotTransientState_({
              excludeOperationId: context && context.operationId ? context.operationId : ''
            });
            setBotMonthSheetName_(month);
            highlightActiveMonthTab_(month);
            try {
              const sh = SpreadsheetApp.getActive().getSheetByName(month);
              if (sh) sh.activate();
            } catch (_) {}
            return {
              success: true,
              message: 'Бота повністю перезапущено',
              result: Object.assign({
                type: 'restartBot',
                restarted: true,
                month: month,
                restartedAt: stage4NowIso_()
              }, restartReport),
              changes: [{
                type: 'restartBot',
                month: month,
                runtimeActiveCleared: Number(restartReport.runtimeActiveCleared || 0),
                safetyActiveCleared: Number(restartReport.safetyActiveCleared || 0),
                blockingKeysCleared: Number(restartReport.blockingKeysCleared || 0),
                stage7ActiveCleared: Number(restartReport.stage7ActiveCleared || 0)
              }],
              affectedSheets: month ? [month] : [],
              affectedEntities: [],
              appliedChangesCount:
                1 +
                Number(restartReport.runtimeActiveCleared || 0) +
                Number(restartReport.safetyActiveCleared || 0) +
                Number(restartReport.blockingKeysCleared || 0) +
                Number(restartReport.stage7ActiveCleared || 0),
              skippedChangesCount: 0,
              partial: false
            };
          }

          case 'setupVacationTriggers': {
            const setup = setupVacationTrigger();
            return {
              success: setup.success !== false,
              message: setup.message || (setup.success === false ? 'Не вдалося налаштувати тригери' : 'Тригери налаштовано'),
              result: Object.assign({ type: 'setupVacationTriggers' }, setup || {}),
              changes: [{
                type: 'setupVacationTriggers',
                removed: Number(setup && setup.removed || 0)
              }],
              affectedSheets: [],
              affectedEntities: [],
              appliedChangesCount: 1,
              skippedChangesCount: Number(setup && setup.removed || 0),
              warnings: setup && setup.success === false ? [String(setup.error || 'Помилка setupVacationTriggers')] : []
            };
          }

          case 'cleanupDuplicateTriggers': {
            const cleanup = cleanupDuplicateTriggers(input.functionName || '');
            const success = cleanup && cleanup.ok !== false && cleanup.success !== false;
            return {
              success: success,
              message: success
                ? (Number(cleanup.removed || 0)
                    ? 'Дублі тригерів очищено'
                    : 'Дублі тригерів не знайдено')
                : 'Не вдалося очистити дублікати тригерів',
              result: Object.assign({ type: 'cleanupDuplicateTriggers' }, cleanup || {}),
              changes: Number(cleanup && cleanup.removed || 0)
                ? [{ type: 'cleanupDuplicateTriggers', removed: Number(cleanup.removed || 0) }]
                : [],
              affectedSheets: [],
              affectedEntities: [],
              appliedChangesCount: Number(cleanup && cleanup.removed || 0),
              skippedChangesCount: Math.max(Number(cleanup && cleanup.found || 0) - Number(cleanup && cleanup.removed || 0), 0),
              warnings: success ? [] : [String(cleanup && cleanup.error || 'Помилка cleanupDuplicateTriggers')]
            };
          }

          case 'debugPhones': {
            const debug = debugPhones();
            const success = debug && debug.success !== false;
            return {
              success: success,
              message: success ? 'Діагностику PHONES виконано' : 'Діагностика PHONES завершилась з помилкою',
              result: Object.assign({ type: 'debugPhones' }, debug || {}),
              changes: [],
              affectedSheets: [CONFIG.PHONES_SHEET],
              affectedEntities: [],
              appliedChangesCount: 0,
              skippedChangesCount: 0,
              warnings: success ? [] : [String(debug && debug.error || 'Помилка debugPhones')]
            };
          }

          case 'cleanupLifecycleRetention': {
            const cleanup = (typeof OperationRepository_ === 'object')
              ? OperationRepository_.runRetentionCleanup()
              : { archived: 0, removedActiveStale: 0, archivedCheckpoints: 0 };
            return {
              success: true,
              message: 'Lifecycle retention cleanup виконано',
              result: Object.assign({ type: 'cleanupLifecycleRetention' }, cleanup || {}),
              changes: [{
                type: 'cleanupLifecycleRetention',
                archived: Number(cleanup && cleanup.archived || 0),
                archivedCheckpoints: Number(cleanup && cleanup.archivedCheckpoints || 0),
                removedActiveStale: Number(cleanup && cleanup.removedActiveStale || 0)
              }],
              affectedSheets: ['OPS_LOG', 'ACTIVE_OPERATIONS', 'CHECKPOINTS'],
              affectedEntities: [],
              appliedChangesCount:
                Number(cleanup && cleanup.archived || 0) +
                Number(cleanup && cleanup.archivedCheckpoints || 0) +
                Number(cleanup && cleanup.removedActiveStale || 0),
              skippedChangesCount: 0,
              partial: false
            };
          }

          case 'postCreateMonth':
            if (input.month) validateMonthSwitch_(input.month);
            return {
              success: true,
              message: 'Post-create-month перевірку виконано',
              result: {
                month: input.month || getBotMonthSheetName_(),
                health: runStage4HealthCheck_({ shallow: true, includeReconciliationPreview: false })
              },
              changes: [],
              affectedSheets: [input.month || getBotMonthSheetName_()],
              affectedEntities: [],
              appliedChangesCount: 0,
              skippedChangesCount: 0,
          partial: false
            };

          case 'healthCheck':
            return {
              success: true,
              message: 'Health check виконано',
              result: runStage4HealthCheck_({
                shallow: !!input.shallow,
                includeReconciliationPreview: input.includeReconciliationPreview
              }),
              changes: [],
              affectedSheets: [],
              affectedEntities: [],
              appliedChangesCount: 0,
              skippedChangesCount: 0,
          partial: false
            };

          default:
            return {
              success: true,
              message: 'Quick maintenance виконано',
              result: {
                health: runStage4HealthCheck_({ shallow: true, includeReconciliationPreview: false })
              },
              changes: [],
              affectedSheets: [],
              affectedEntities: [],
              appliedChangesCount: 0,
              skippedChangesCount: 0,
          partial: false
            };
        }
      },
      sync: function(input) {
        switch (String(input.type || 'quick')) {
          case 'cleanupCaches':
            return {
              invalidateCaches: ['sidebar', 'summary', 'sendPanel', 'templates']
            };

          case 'clearPhoneCache':
            return {
              invalidateCaches: ['sidebar', 'summary']
            };

          case 'restartBot':
            return {
              refresh: ['currentMonth', 'monthsList', 'panel'],
              invalidateCaches: ['sidebar', 'summary', 'sendPanel', 'templates'],
              currentMonth: resolveRestartBotMonth_()
            };

          case 'clearLog':
          case 'setupVacationTriggers':
          case 'cleanupDuplicateTriggers':
          case 'debugPhones':
          case 'healthCheck':
          case 'postCreateMonth':
          default:
            return {};
        }
      }
    });
  }

  return {
    generateSendPanelForDate: generateSendPanelForDate,
    generateSendPanelForRange: generateSendPanelForRange,
    markPanelRowsAsPending: markPanelRowsAsPending,
    markPanelRowsAsSent: markPanelRowsAsSent,
    markPanelRowsAsUnsent: markPanelRowsAsUnsent,
    sendPendingRows: sendPendingRows,
    listMonths: listMonths,
    getSendPanelData: getSendPanelData,
    buildDaySummary: buildDaySummary,
    buildDetailedSummary: buildDetailedSummary,
    openPersonCard: openPersonCard,
    loadCalendarDay: loadCalendarDay,
    checkVacationsAndBirthdays: checkVacationsAndBirthdays,
    switchBotToMonth: switchBotToMonth,
    createNextMonth: createNextMonth,
    runReconciliation: runReconciliation,
    runMaintenanceScenario: runMaintenanceScenario
  };
})();
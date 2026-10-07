/**
 * UseCases.SendPanel.gs — SEND_PANEL use cases (PR7 domain split).
 */

var UseCasesSendPanel_ = (function () {
  function generateSendPanelForDate(options) {
    const payload = Object.assign({}, options || {});
    return WorkflowOrchestrator_.run({
      scenario: "generateSendPanelForDate",
      routeName: "sidebar.generateSendPanelForDate",
      publicApiMethod: "apiGenerateSendPanelForDate",
      payload: payload,
      write: true,
      validate: function (input) {
        const dateInfo = validateDatePayload_(input, "date");
        if (
          typeof AccessEnforcement_ === "object" &&
          AccessEnforcement_.assertCanUseSendPanel
        ) {
          AccessEnforcement_.assertCanUseSendPanel("generateSendPanelForDate", {
            requestedDate: dateInfo.dateStr,
          });
        }
        return {
          payload: Object.assign({}, input, {
            date: dateInfo.dateStr,
            dateStr: dateInfo.dateStr,
            dryRun: !!input.dryRun,
          }),
          warnings: dateInfo.warnings,
        };
      },
      readBefore: function (input) {
        return {
          currentRows: SendPanelRepository_.readRows(),
          currentMonth: getBotMonthSheetName_(),
          date: input.dateStr || input.date || _todayStr_(),
        };
      },
      plan: function (input) {
        const preview = SendPanelRepository_.preview(
          input.dateStr || input.date,
        );
        const stats =
          preview.stats || SendPanelRepository_.buildStats(preview.rows || []);
        return {
          preview: preview,
          meta: {
            affectedSheets: [
              CONFIG.SEND_PANEL_SHEET,
              preview.month || getBotMonthSheetName_(),
            ],
            affectedEntities: [],
            plannedRows: stats.totalCount || 0,
          },
          warnings: _stage7BuildSendPanelWarnings_(stats),
        };
      },
      execute: function (input, _beforeState, plan) {
        const built = input.dryRun
          ? plan.preview
          : SendPanelRepository_.rebuild(input.dateStr || input.date);
        const stats =
          built.stats || SendPanelRepository_.buildStats(built.rows || []);
        return {
          success: true,
          message: input.dryRun
            ? "Панель надсилання перевірено без запису"
            : "Панель надсилання згенеровано",
          result: built,
          changes: input.dryRun
            ? []
            : [
                {
                  type: "rebuildSendPanel",
                  sheet: CONFIG.SEND_PANEL_SHEET,
                  date: built.date,
                  count: built.rowsWritten || (built.rows || []).length,
                },
              ],
          affectedSheets: [
            CONFIG.SEND_PANEL_SHEET,
            built.month || getBotMonthSheetName_(),
          ],
          affectedEntities: [],
          appliedChangesCount: input.dryRun
            ? 0
            : (built.rows || []).length || 0,
          skippedChangesCount: 0,
          partial: false,
          meta: {
            stats: stats,
          },
          warnings: _stage7BuildSendPanelWarnings_(stats),
        };
      },
      sync: function (_input, _beforeState, _plan, execution) {
        return {
          refresh: ["panel", "sidebarCounters"],
          invalidateCaches: ["sendPanel", "sidebar", "summary"],
          month:
            execution.result && execution.result.month
              ? execution.result.month
              : getBotMonthSheetName_(),
        };
      },
      verify: function () {
        return _stage7AVerifySendPanelBuild_(arguments[3]);
      },
    });
  }

  function generateSendPanelForRange(options) {
    const payload = Object.assign({}, options || {});
    return WorkflowOrchestrator_.run({
      scenario: "generateSendPanelForRange",
      routeName: "sidebar.generateSendPanelForRange",
      publicApiMethod: "apiGenerateSendPanelForRange",
      payload: payload,
      write: true,
      validate: function (input) {
        const range = validateDateRangePayload_(input);
        if (
          typeof AccessEnforcement_ === "object" &&
          AccessEnforcement_.assertCanUseSendPanel
        ) {
          AccessEnforcement_.assertCanUseSendPanel(
            "generateSendPanelForRange",
            {
              startDate: range.payload.startDate,
              endDate: range.payload.endDate,
            },
          );
        }
        return {
          payload: Object.assign({}, input, range.payload, {
            dryRun: !!input.dryRun,
          }),
          warnings: range.warnings,
        };
      },
      execute: function (input) {
        const start = DateUtils_.parseUaDate(input.startDate);
        const end = DateUtils_.parseUaDate(input.endDate);
        const reports = [];
        let cursor = new Date(start);
        while (cursor.getTime() <= end.getTime()) {
          const dateStr = Utilities.formatDate(
            cursor,
            getTimeZone_(),
            "dd.MM.yyyy",
          );
          const preview = SendPanelRepository_.preview(dateStr);
          reports.push({
            date: dateStr,
            month: preview.month,
            stats: preview.stats,
            rows: preview.rows,
          });
          cursor.setDate(cursor.getDate() + 1);
        }

        let persisted = null;
        const warnings = [];
        if (!input.dryRun && reports.length) {
          const lastDate = reports[reports.length - 1].date;
          persisted = SendPanelRepository_.rebuild(lastDate);
          warnings.push(
            "Фізично записано лише останню дату діапазону, бо панель надсилання — один аркуш",
          );
        }

        return {
          success: true,
          message: input.dryRun
            ? `Перевірка генерації панелі надсилання для ${reports.length} дат`
            : `Підготовлено ${reports.length} дат, записано останню`,
          result: {
            range: {
              startDate: input.startDate,
              endDate: input.endDate,
              count: reports.length,
            },
            reports: reports,
            persisted: persisted,
          },
          changes:
            !input.dryRun && persisted
              ? [
                  {
                    type: "rebuildSendPanel",
                    sheet: CONFIG.SEND_PANEL_SHEET,
                    date: persisted.date,
                    count:
                      persisted.rowsWritten || (persisted.rows || []).length,
                  },
                ]
              : [],
          affectedSheets:
            !input.dryRun && persisted
              ? [
                  CONFIG.SEND_PANEL_SHEET,
                  persisted.month || getBotMonthSheetName_(),
                ]
              : [],
          affectedEntities: [],
          appliedChangesCount:
            !input.dryRun && persisted ? (persisted.rows || []).length || 0 : 0,
          skippedChangesCount: input.dryRun
            ? reports.length
            : Math.max(reports.length - 1, 0),
          partial: !input.dryRun && reports.length > 1,
          warnings: warnings,
        };
      },
      verify: function () {
        return _stage7AVerifySendPanelBuild_(arguments[3]);
      },
    });
  }

  function markPanelRowsAsPending(rowNumbers, options) {
    const payload = Object.assign({}, options || {}, {
      rowNumbers: rowNumbers,
    });
    return WorkflowOrchestrator_.run({
      scenario: "markPanelRowsAsPending",
      routeName: "sidebar.markPanelRowsAsPending",
      publicApiMethod: "apiMarkPanelRowsAsPending",
      payload: payload,
      write: true,
      validate: function (input) {
        const rowsInfo = validatePanelRowSelection_(input.rowNumbers, {
          maxRows: input.maxRows,
        });
        if (
          typeof AccessEnforcement_ === "object" &&
          AccessEnforcement_.assertCanUseSendPanel
        ) {
          AccessEnforcement_.assertCanUseSendPanel("markPanelRowsAsPending", {
            rowNumbers: rowsInfo.rows,
          });
        }
        return {
          payload: Object.assign({}, input, {
            rowNumbers: rowsInfo.rows,
            dryRun: !!input.dryRun,
          }),
          warnings: rowsInfo.warnings,
        };
      },
      readBefore: function (input) {
        const rows = SendPanelRepository_.readRows();
        return {
          selectedRows: rows.filter(function (item) {
            return input.rowNumbers.indexOf(item.row) !== -1;
          }),
          allRows: rows,
        };
      },
      execute: function (input, beforeState) {
        const targetRows = beforeState.selectedRows || [];
        if (input.dryRun) {
          return {
            success: true,
            message: `Dry-run: сумісний маршрут pending більше не змінює рядки`,
            result: {
              rows: beforeState.allRows,
              updatedRows: input.rowNumbers,
              stats: SendPanelRepository_.buildStats(beforeState.allRows),
            },
            changes: [],
            affectedSheets: [CONFIG.SEND_PANEL_SHEET],
            affectedEntities: targetRows.map(function (item) {
              return item.fml;
            }),
            appliedChangesCount: 0,
            skippedChangesCount: 0,
            partial: false,
          };
        }

        const result = SendPanelRepository_.markRowsAsPending(
          input.rowNumbers,
          {},
        );
        return {
          success: true,
          message: `Сумісний маршрут pending виконано без зміни стану рядків`,
          result: result,
          changes: _stage7RowsToChangeList_(targetRows, "markPending"),
          affectedSheets: [CONFIG.SEND_PANEL_SHEET],
          affectedEntities: targetRows.map(function (item) {
            return item.fml;
          }),
          appliedChangesCount: result.updatedRows.length,
          skippedChangesCount: 0,
          partial: false,
        };
      },
      sync: function () {
        return {
          refresh: ["panel", "counters", "summaryPreview"],
          invalidateCaches: ["sendPanel"],
        };
      },
      verify: function (input) {
        return input.dryRun
          ? { ok: true, verifiedRows: 0, mismatchCount: 0 }
          : _stage7AVerifyPanelStatuses_(input.rowNumbers, null, false);
      },
    });
  }

  function markPanelRowsAsSent(rowNumbers, options) {
    const payload = Object.assign({}, options || {}, {
      rowNumbers: rowNumbers,
    });
    return WorkflowOrchestrator_.run({
      scenario: "markPanelRowsAsSent",
      routeName: "sidebar.markPanelRowsAsSent",
      publicApiMethod: "apiMarkPanelRowsAsSent",
      payload: payload,
      write: true,
      validate: function (input) {
        const rowsInfo = validatePanelRowSelection_(input.rowNumbers, {
          maxRows: input.maxRows,
        });
        if (
          typeof AccessEnforcement_ === "object" &&
          AccessEnforcement_.assertCanUseSendPanel
        ) {
          AccessEnforcement_.assertCanUseSendPanel("markPanelRowsAsSent", {
            rowNumbers: rowsInfo.rows,
          });
        }
        return {
          payload: Object.assign({}, input, {
            rowNumbers: rowsInfo.rows,
            dryRun: !!input.dryRun,
          }),
          warnings: rowsInfo.warnings,
        };
      },
      readBefore: function (input) {
        const rows = SendPanelRepository_.readRows();
        return {
          selectedRows: rows.filter(function (item) {
            return input.rowNumbers.indexOf(item.row) !== -1;
          }),
          allRows: rows,
        };
      },
      execute: function (input, beforeState) {
        const targetRows = beforeState.selectedRows || [];
        const alreadySent = targetRows.filter(function (item) {
          return item.sent === true;
        });
        const warnings = alreadySent.length
          ? [`Уже відправлені рядки: ${alreadySent.length}`]
          : [];

        if (input.dryRun) {
          return {
            success: true,
            message: `Dry-run: буде позначено ${input.rowNumbers.length} рядків`,
            result: {
              rows: beforeState.allRows,
              updatedRows: input.rowNumbers,
              stats: SendPanelRepository_.buildStats(beforeState.allRows),
            },
            changes: [],
            affectedSheets: [CONFIG.SEND_PANEL_SHEET],
            affectedEntities: targetRows.map(function (item) {
              return item.fml;
            }),
            appliedChangesCount: 0,
            skippedChangesCount: alreadySent.length,
            partial: false,
            warnings: warnings,
          };
        }

        const result = SendPanelRepository_.markRowsAsSent(
          input.rowNumbers,
          {},
        );
        return {
          success: true,
          message: `Позначено ${result.updatedRows.length} рядків`,
          result: result,
          changes: _stage7RowsToChangeList_(targetRows, "markSent"),
          affectedSheets: [CONFIG.SEND_PANEL_SHEET],
          affectedEntities: targetRows.map(function (item) {
            return item.fml;
          }),
          appliedChangesCount: result.updatedRows.length,
          skippedChangesCount: alreadySent.length,
          partial: alreadySent.length > 0,
          warnings: warnings,
        };
      },
      sync: function () {
        return {
          refresh: ["panel", "counters", "summaryPreview"],
          invalidateCaches: ["sendPanel"],
        };
      },
      verify: function (input) {
        return input.dryRun
          ? { ok: true, verifiedRows: 0, mismatchCount: 0 }
          : _stage7AVerifyPanelStatuses_(input.rowNumbers, null, true);
      },
    });
  }

  function markPanelRowsAsUnsent(rowNumbers, options) {
    const payload = Object.assign({}, options || {}, {
      rowNumbers: rowNumbers,
    });
    return WorkflowOrchestrator_.run({
      scenario: "markPanelRowsAsUnsent",
      routeName: "sidebar.markPanelRowsAsUnsent",
      publicApiMethod: "apiMarkPanelRowsAsUnsent",
      payload: payload,
      write: true,
      validate: function (input) {
        const rowsInfo = validatePanelRowSelection_(input.rowNumbers, {
          maxRows: input.maxRows,
        });
        if (
          typeof AccessEnforcement_ === "object" &&
          AccessEnforcement_.assertCanUseSendPanel
        ) {
          AccessEnforcement_.assertCanUseSendPanel("markPanelRowsAsUnsent", {
            rowNumbers: rowsInfo.rows,
          });
        }
        return {
          payload: Object.assign({}, input, {
            rowNumbers: rowsInfo.rows,
            dryRun: !!input.dryRun,
          }),
          warnings: rowsInfo.warnings,
        };
      },
      readBefore: function (input) {
        const rows = SendPanelRepository_.readRows();
        return {
          selectedRows: rows.filter(function (item) {
            return input.rowNumbers.indexOf(item.row) !== -1;
          }),
          allRows: rows,
        };
      },
      execute: function (input, beforeState) {
        const targetRows = beforeState.selectedRows || [];
        if (input.dryRun) {
          return {
            success: true,
            message: `Dry-run: буде знято статус відправки з ${targetRows.length} рядків`,
            result: {
              rows: beforeState.allRows,
              updatedRows: input.rowNumbers,
              stats: SendPanelRepository_.buildStats(beforeState.allRows),
            },
            changes: [],
            affectedSheets: [CONFIG.SEND_PANEL_SHEET],
            affectedEntities: targetRows.map(function (item) {
              return item.fml;
            }),
            appliedChangesCount: 0,
            skippedChangesCount: 0,
            partial: false,
          };
        }

        const result = SendPanelRepository_.markRowsAsUnsent(
          input.rowNumbers,
          {},
        );
        return {
          success: true,
          message: `Знято статус відправки з ${result.updatedRows.length} рядків`,
          result: result,
          changes: _stage7RowsToChangeList_(targetRows, "markUnsent"),
          affectedSheets: [CONFIG.SEND_PANEL_SHEET],
          affectedEntities: targetRows.map(function (item) {
            return item.fml;
          }),
          appliedChangesCount: result.updatedRows.length,
          skippedChangesCount: 0,
          partial: false,
        };
      },
      sync: function () {
        return {
          refresh: ["panel", "counters"],
          invalidateCaches: ["sendPanel"],
        };
      },
      verify: function (input) {
        return input.dryRun
          ? { ok: true, verifiedRows: 0, mismatchCount: 0 }
          : _stage7AVerifyPanelStatuses_(input.rowNumbers, null, false);
      },
    });
  }

  function sendPendingRows(options) {
    const payload = Object.assign({}, options || {});
    return WorkflowOrchestrator_.run({
      scenario: "sendPendingRows",
      routeName: "sidebar.sendPendingRows",
      publicApiMethod: "apiSendPendingRows",
      payload: payload,
      write: true,
      validate: function (input) {
        const sendInfo = validateSendOperation_(input);
        if (
          typeof AccessEnforcement_ === "object" &&
          AccessEnforcement_.assertCanUseSendPanel
        ) {
          AccessEnforcement_.assertCanUseSendPanel("sendPendingRows", {
            limit: sendInfo.payload.limit || "",
          });
        }
        return {
          payload: Object.assign({}, input, sendInfo.payload),
          warnings: sendInfo.warnings,
        };
      },
      readBefore: function () {
        const readyRows = _stage7GetPanelReadyRows_();
        return {
          readyRows: readyRows,
          allRows: SendPanelRepository_.readRows(),
        };
      },
      execute: function (input, beforeState) {
        const queue = (beforeState.readyRows || []).slice(0, input.limit);
        if (!queue.length) {
          return {
            success: true,
            message: "Немає рядків для відкриття",
            result: {
              queue: [],
              rows: beforeState.allRows,
              stats: SendPanelRepository_.buildStats(beforeState.allRows),
            },
            changes: [],
            affectedSheets: [CONFIG.SEND_PANEL_SHEET],
            affectedEntities: [],
            appliedChangesCount: 0,
            skippedChangesCount: 0,
            partial: false,
          };
        }

        if (input.dryRun) {
          return {
            success: true,
            message: `Dry-run: буде автоматично зафіксовано ${queue.length} рядків після відкриття чатів`,
            result: {
              queue: queue,
              rows: beforeState.allRows,
              stats: SendPanelRepository_.buildStats(beforeState.allRows),
            },
            changes: [],
            affectedSheets: [CONFIG.SEND_PANEL_SHEET],
            affectedEntities: queue.map(function (item) {
              return item.fml;
            }),
            appliedChangesCount: 0,
            skippedChangesCount: 0,
            partial: false,
          };
        }

        const result = SendPanelRepository_.markRowsAsSent(
          queue.map(function (item) {
            return item.row;
          }),
          {},
        );
        return {
          success: true,
          message: `Автоматично зафіксовано ${queue.length} рядків як відправлені`,
          result: {
            queue: queue,
            rows: result.rows,
            updatedRows: result.updatedRows,
            stats: result.stats,
          },
          changes: _stage7RowsToChangeList_(queue, "markSentAuto"),
          affectedSheets: [CONFIG.SEND_PANEL_SHEET],
          affectedEntities: queue.map(function (item) {
            return item.fml;
          }),
          appliedChangesCount: queue.length,
          skippedChangesCount: 0,
          partial: false,
        };
      },
      sync: function () {
        return {
          refresh: ["panel", "counters"],
          invalidateCaches: ["sendPanel"],
        };
      },
      verify: function (input, _beforeState, _plan, execution) {
        if (input.dryRun)
          return { ok: true, verifiedRows: 0, mismatchCount: 0 };
        const updatedRows = stage7AsArray_(
          execution && execution.result && execution.result.updatedRows,
        );
        return _stage7AVerifyPanelStatuses_(updatedRows, null, true);
      },
    });
  }

  function getSendPanelData(options) {
    const payload = Object.assign({}, options || {});
    return WorkflowOrchestrator_.run({
      scenario: "getSendPanelData",
      payload: payload,
      write: false,
      lock: false,
      validate: function (input) {
        if (
          typeof AccessEnforcement_ === "object" &&
          AccessEnforcement_.assertCanUseSendPanel
        ) {
          AccessEnforcement_.assertCanUseSendPanel("getSendPanelData", {});
        }
        return { payload: input || {}, warnings: [] };
      },
      execute: function () {
        const rows = SendPanelRepository_.readRows();
        const stats = SendPanelRepository_.buildStats(rows);
        const panelMeta =
          typeof SendPanelRepository_.getPanelMetadata === "function"
            ? SendPanelRepository_.getPanelMetadata()
            : { month: getBotMonthSheetName_(), date: "" };
        return {
          success: true,
          message: "Панель надсилання оновлено",
          result: {
            rows: rows,
            stats: stats,
            month: panelMeta.month || getBotMonthSheetName_(),
            date: panelMeta.date || "",
          },
          changes: [],
          affectedSheets: [CONFIG.SEND_PANEL_SHEET, getBotMonthSheetName_()],
          affectedEntities: [],
          appliedChangesCount: 0,
          skippedChangesCount: 0,
          warnings: _stage7BuildSendPanelWarnings_(stats),
        };
      },
    });
  }

  return {
    generateSendPanelForDate: generateSendPanelForDate,
    generateSendPanelForRange: generateSendPanelForRange,
    markPanelRowsAsPending: markPanelRowsAsPending,
    markPanelRowsAsSent: markPanelRowsAsSent,
    markPanelRowsAsUnsent: markPanelRowsAsUnsent,
    sendPendingRows: sendPendingRows,
    getSendPanelData: getSendPanelData,
  };
})();


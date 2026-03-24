
/**
 * SpreadsheetActionsApi.gs — canonical public stage 5 spreadsheet/manual action API.
 */

function apiPreviewSelectionMessage(options) {
  return WorkflowOrchestrator_.run({
    scenario: 'previewSelectionMessage',
    payload: options || {},
    write: false,
    validate: function(input) {
      return { payload: input, warnings: [] };
    },
    execute: function() {
      const prepared = SelectionActionService_.prepareSingleSelection();
      return {
        success: true,
        message: 'Повідомлення за виділеною клітинкою підготовлено',
        result: PreviewLinkService_.buildSinglePreview(prepared.payload, {
          title: 'Повідомлення',
          logged: false
        }),
        changes: [],
        affectedSheets: [prepared.sheetName],
        affectedEntities: [prepared.payload.fio || '']
      };
    }
  });
}

function apiPreviewMultipleMessages(options) {
  return WorkflowOrchestrator_.run({
    scenario: 'previewMultipleMessages',
    payload: options || {},
    write: false,
    execute: function() {
      const prepared = SelectionActionService_.prepareMultipleSelection();
      return {
        success: true,
        message: `Підготовлено повідомлень: ${(prepared.payloads || []).length}`,
        result: PreviewLinkService_.buildMultiplePreview(prepared.payloads, prepared.errors, {
          title: 'Кілька повідомлень',
          logged: false
        }),
        changes: [],
        affectedSheets: [prepared.sheetName],
        affectedEntities: (prepared.payloads || []).map(function(item) { return item.fio || ''; })
      };
    }
  });
}

function apiPreviewGroupedMessages(options) {
  return WorkflowOrchestrator_.run({
    scenario: 'previewGroupedMessages',
    payload: options || {},
    write: false,
    execute: function() {
      const prepared = SelectionActionService_.prepareGroupedMessages();
      return {
        success: true,
        message: `Підготовлено згрупованих повідомлень: ${(prepared.payloads || []).length}`,
        result: PreviewLinkService_.buildMultiplePreview(prepared.payloads, prepared.errors, {
          title: 'Згруповані за телефоном',
          logged: false
        }),
        changes: [],
        affectedSheets: [prepared.sheetName],
        affectedEntities: (prepared.payloads || []).map(function(item) { return item.fio || ''; })
      };
    }
  });
}

function apiPrepareRangeMessages(options) {
  return WorkflowOrchestrator_.run({
    scenario: 'prepareRangeMessages',
    payload: options || {},
    write: false,
    execute: function() {
      const prepared = SelectionActionService_.prepareRangeMessages();
      return {
        success: true,
        message: `Підготовлено повідомлень із діапазону: ${(prepared.payloads || []).length}`,
        result: PreviewLinkService_.buildMultiplePreview(prepared.payloads, prepared.errors, {
          title: `Діапазон ${prepared.rangeA1 || ''}`.trim(),
          logged: false
        }),
        changes: [],
        affectedSheets: [prepared.sheetName],
        affectedEntities: (prepared.payloads || []).map(function(item) { return item.fio || ''; })
      };
    }
  });
}

function apiBuildCommanderSummaryPreview(options) {
  return WorkflowOrchestrator_.run({
    scenario: 'buildCommanderSummaryPreview',
    payload: options || {},
    write: false,
    execute: function(input) {
      const prepared = SelectionActionService_.prepareCommanderSummaryPreview(input || {});
      return {
        success: true,
        message: 'Зведення командиру підготовлено',
        result: PreviewLinkService_.buildSummaryPreview(prepared, {
          title: prepared.title || 'Зведення командиру'
        }),
        changes: [],
        affectedSheets: [prepared.sheet || getBotMonthSheetName_()],
        affectedEntities: [CONFIG.COMMANDER_ROLE]
      };
    }
  });
}

function apiBuildCommanderSummaryLink(options) {
  return WorkflowOrchestrator_.run({
    scenario: 'buildCommanderSummaryLink',
    payload: options || {},
    write: false,
    execute: function(input) {
      const prepared = SelectionActionService_.prepareCommanderSummaryPreview(input || {});
      return {
        success: true,
        message: prepared.link ? 'Посилання на зведення командиру підготовлено' : 'Телефон командира не знайдено',
        result: PreviewLinkService_.buildSummaryPreview(prepared, {
          title: prepared.title || 'Зведення командиру'
        }),
        changes: [],
        affectedSheets: [prepared.sheet || getBotMonthSheetName_()],
        affectedEntities: [CONFIG.COMMANDER_ROLE],
        warnings: prepared.link ? [] : ['Телефон для командира не знайдено']
      };
    }
  });
}

function apiLogPreparedMessages(options) {
  return WorkflowOrchestrator_.run({
    scenario: 'logPreparedMessages',
    payload: options || {},
    write: true,
    execute: function(input) {
      const prepared = SelectionActionService_.resolvePayloadBundle(input.mode || 'selection');
      if (!prepared.payloads || !prepared.payloads.length) {
        return {
          success: true,
          message: 'Немає payload для запису в LOG',
          result: PreviewLinkService_.buildMultiplePreview([], prepared.errors || [], {
            title: 'LOG preview',
            logged: false
          }),
          changes: [],
          affectedSheets: [prepared.sheetName, CONFIG.LOG_SHEET]
        };
      }

      if (!input.dryRun) {
        SelectionActionService_.logPayloads(prepared.payloads);
      }

      const preview = prepared.selectionType === 'single' && prepared.payloads.length === 1
        ? PreviewLinkService_.buildSinglePreview(prepared.payloads[0], {
            title: 'Записано в LOG',
            logged: true
          })
        : PreviewLinkService_.buildMultiplePreview(prepared.payloads, prepared.errors || [], {
            title: 'Записано в LOG',
            logged: true
          });

      return {
        success: true,
        message: input.dryRun
          ? `Dry-run LOG preview: ${(prepared.payloads || []).length}`
          : `У LOG записано: ${(prepared.payloads || []).length}`,
        result: preview,
        changes: [{
          type: 'writeLogsBatch',
          count: (prepared.payloads || []).length
        }],
        affectedSheets: [prepared.sheetName, CONFIG.LOG_SHEET],
        affectedEntities: (prepared.payloads || []).map(function(item) { return item.fio || ''; }),
        appliedChangesCount: input.dryRun ? 0 : (prepared.payloads || []).length,
        skippedChangesCount: input.dryRun ? (prepared.payloads || []).length : 0
      };
    }
  });
}

function apiRunSelectionDiagnostics(options) {
  return WorkflowOrchestrator_.run({
    scenario: 'runSelectionDiagnostics',
    payload: options || {},
    write: false,
    execute: function() {
      return {
        success: true,
        message: 'Діагностику selection-сценарію побудовано',
        result: SelectionActionService_.runDiagnostics(),
        changes: [],
        affectedSheets: [getBotMonthSheetName_()],
        affectedEntities: [CONFIG.COMMANDER_ROLE]
      };
    }
  });
}
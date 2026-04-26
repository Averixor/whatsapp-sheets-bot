/**
 * SpreadsheetActionsApi.gs
 * Полная исправленная версия для WASB.
 *
 * Ожидает, что в проекте уже существуют:
 * - WorkflowOrchestrator_
 * - SelectionActionService_
 * - PreviewLinkService_
 * - CONFIG
 * - getBotMonthSheetName_()   // если нет — будет использован текущий месяц
 */

// ==================== INTERNAL HELPERS ====================

function _saGetGlobalScope_() {
  try {
    if (typeof globalThis !== 'undefined') return globalThis;
  } catch (_) {}
  try {
    return this;
  } catch (_) {}
  return {};
}

function _saRequireDependency_(name) {
  const scope = _saGetGlobalScope_();
  if (typeof scope[name] === 'undefined' || scope[name] === null) {
    throw new Error('Missing global dependency: ' + name);
  }
  return scope[name];
}

function _saRequireDependencies_() {
  return {
    WorkflowOrchestrator_: _saRequireDependency_('WorkflowOrchestrator_'),
    SelectionActionService_: _saRequireDependency_('SelectionActionService_'),
    PreviewLinkService_: _saRequireDependency_('PreviewLinkService_')
  };
}

function _saNormalizeOptions_(options) {
  return options && typeof options === 'object' ? options : {};
}

function _saSafeArray_(value) {
  return Array.isArray(value) ? value : [];
}

function _saSafeString_(value) {
  return value === null || typeof value === 'undefined' ? '' : String(value);
}

function _saResolveCommanderRole_() {
  try {
    if (typeof CONFIG !== 'undefined' && CONFIG && typeof CONFIG.COMMANDER_ROLE !== 'undefined') {
      return CONFIG.COMMANDER_ROLE;
    }
  } catch (_) {}
  return '';
}

function _saResolveLogSheetName_() {
  try {
    if (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.LOG_SHEET) {
      return String(CONFIG.LOG_SHEET);
    }
  } catch (_) {}
  return 'LOG';
}

function _saResolveBotMonthSheetName_() {
  try {
    if (typeof getBotMonthSheetName_ === 'function') {
      return getBotMonthSheetName_();
    }
  } catch (_) {}
  const month = new Date().getMonth() + 1;
  return String(month).padStart(2, '0');
}

function _saBuildSinglePreviewSafe_(PreviewLinkService_, payload, options) {
  return PreviewLinkService_.buildSinglePreview(payload || {}, options || {});
}

function _saBuildMultiplePreviewSafe_(PreviewLinkService_, payloads, errors, options) {
  return PreviewLinkService_.buildMultiplePreview(
    _saSafeArray_(payloads),
    _saSafeArray_(errors),
    options || {}
  );
}

function _saBuildSummaryPreviewSafe_(PreviewLinkService_, prepared, options) {
  return PreviewLinkService_.buildSummaryPreview(prepared || {}, options || {});
}

function _saExtractAffectedEntitiesFromPayloads_(payloads) {
  return _saSafeArray_(payloads).map(function(item) {
    return item && item.fml ? item.fml : '';
  });
}

function _saExtractAffectedSheets_(primary, secondary) {
  const result = [];
  if (primary) result.push(primary);
  if (secondary && secondary !== primary) result.push(secondary);
  return result;
}

function _saEnsurePreparedObject_(prepared) {
  return prepared && typeof prepared === 'object' ? prepared : {};
}

function _saPreviewNoPayloadsResponse_(PreviewLinkService_, prepared, message, title) {
  const safePrepared = _saEnsurePreparedObject_(prepared);
  return {
    success: true,
    message: message,
    result: _saBuildMultiplePreviewSafe_(
      PreviewLinkService_,
      [],
      safePrepared.errors || [],
      {
        title: title,
        logged: false
      }
    ),
    changes: [],
    affectedSheets: _saExtractAffectedSheets_(safePrepared.sheetName || '', ''),
    affectedEntities: []
  };
}

// ==================== PUBLIC API ====================

function apiPreviewSelectionMessage(options) {
  const deps = _saRequireDependencies_();
  const WorkflowOrchestrator_ = deps.WorkflowOrchestrator_;
  const SelectionActionService_ = deps.SelectionActionService_;
  const PreviewLinkService_ = deps.PreviewLinkService_;

  return WorkflowOrchestrator_.run({
    scenario: 'previewSelectionMessage',
    payload: _saNormalizeOptions_(options),
    write: false,
    validate: function(input) {
      return { payload: input || {}, warnings: [] };
    },
    execute: function() {
      const prepared = _saEnsurePreparedObject_(SelectionActionService_.prepareSingleSelection());

      if (!prepared.payload) {
        return {
          success: true,
          message: 'Немає payload для попереднього перегляду',
          result: _saBuildMultiplePreviewSafe_(PreviewLinkService_, [], prepared.errors || [], {
            title: 'Повідомлення',
            logged: false
          }),
          changes: [],
          affectedSheets: _saExtractAffectedSheets_(prepared.sheetName || '', ''),
          affectedEntities: []
        };
      }

      return {
        success: true,
        message: 'Повідомлення за виділеною клітинкою підготовлено',
        result: _saBuildSinglePreviewSafe_(PreviewLinkService_, prepared.payload, {
          title: 'Повідомлення',
          logged: false
        }),
        changes: [],
        affectedSheets: _saExtractAffectedSheets_(prepared.sheetName || '', ''),
        affectedEntities: [prepared.payload && prepared.payload.fml ? prepared.payload.fml : '']
      };
    }
  });
}

function apiPreviewMultipleMessages(options) {
  const deps = _saRequireDependencies_();
  const WorkflowOrchestrator_ = deps.WorkflowOrchestrator_;
  const SelectionActionService_ = deps.SelectionActionService_;
  const PreviewLinkService_ = deps.PreviewLinkService_;

  return WorkflowOrchestrator_.run({
    scenario: 'previewMultipleMessages',
    payload: _saNormalizeOptions_(options),
    write: false,
    execute: function() {
      const prepared = _saEnsurePreparedObject_(SelectionActionService_.prepareMultipleSelection());
      const payloads = _saSafeArray_(prepared.payloads);

      return {
        success: true,
        message: 'Підготовлено повідомлень: ' + payloads.length,
        result: _saBuildMultiplePreviewSafe_(PreviewLinkService_, payloads, prepared.errors, {
          title: 'Кілька повідомлень',
          logged: false
        }),
        changes: [],
        affectedSheets: _saExtractAffectedSheets_(prepared.sheetName || '', ''),
        affectedEntities: _saExtractAffectedEntitiesFromPayloads_(payloads)
      };
    }
  });
}

function apiPreviewGroupedMessages(options) {
  const deps = _saRequireDependencies_();
  const WorkflowOrchestrator_ = deps.WorkflowOrchestrator_;
  const SelectionActionService_ = deps.SelectionActionService_;
  const PreviewLinkService_ = deps.PreviewLinkService_;

  return WorkflowOrchestrator_.run({
    scenario: 'previewGroupedMessages',
    payload: _saNormalizeOptions_(options),
    write: false,
    execute: function() {
      const prepared = _saEnsurePreparedObject_(SelectionActionService_.prepareGroupedMessages());
      const payloads = _saSafeArray_(prepared.payloads);

      return {
        success: true,
        message: 'Підготовлено згрупованих повідомлень: ' + payloads.length,
        result: _saBuildMultiplePreviewSafe_(PreviewLinkService_, payloads, prepared.errors, {
          title: 'Згруповані за телефоном',
          logged: false
        }),
        changes: [],
        affectedSheets: _saExtractAffectedSheets_(prepared.sheetName || '', ''),
        affectedEntities: _saExtractAffectedEntitiesFromPayloads_(payloads)
      };
    }
  });
}

function apiPrepareRangeMessages(options) {
  const deps = _saRequireDependencies_();
  const WorkflowOrchestrator_ = deps.WorkflowOrchestrator_;
  const SelectionActionService_ = deps.SelectionActionService_;
  const PreviewLinkService_ = deps.PreviewLinkService_;

  return WorkflowOrchestrator_.run({
    scenario: 'prepareRangeMessages',
    payload: _saNormalizeOptions_(options),
    write: false,
    execute: function() {
      const prepared = _saEnsurePreparedObject_(SelectionActionService_.prepareRangeMessages());
      const payloads = _saSafeArray_(prepared.payloads);

      return {
        success: true,
        message: 'Підготовлено повідомлень із діапазону: ' + payloads.length,
        result: _saBuildMultiplePreviewSafe_(PreviewLinkService_, payloads, prepared.errors, {
          title: ('Діапазон ' + _saSafeString_(prepared.rangeA1 || '')).trim(),
          logged: false
        }),
        changes: [],
        affectedSheets: _saExtractAffectedSheets_(prepared.sheetName || '', ''),
        affectedEntities: _saExtractAffectedEntitiesFromPayloads_(payloads)
      };
    }
  });
}

function apiBuildCommanderSummaryPreview(options) {
  const deps = _saRequireDependencies_();
  const WorkflowOrchestrator_ = deps.WorkflowOrchestrator_;
  const SelectionActionService_ = deps.SelectionActionService_;
  const PreviewLinkService_ = deps.PreviewLinkService_;

  return WorkflowOrchestrator_.run({
    scenario: 'buildCommanderSummaryPreview',
    payload: _saNormalizeOptions_(options),
    write: false,
    execute: function(input) {
      const prepared = _saEnsurePreparedObject_(SelectionActionService_.prepareCommanderSummaryPreview(input || {}));
      return {
        success: true,
        message: 'Зведення командиру підготовлено',
        result: _saBuildSummaryPreviewSafe_(PreviewLinkService_, prepared, {
          title: prepared.title || 'Зведення командиру'
        }),
        changes: [],
        affectedSheets: _saExtractAffectedSheets_(prepared.sheet || _saResolveBotMonthSheetName_(), ''),
        affectedEntities: [_saResolveCommanderRole_()]
      };
    }
  });
}

function apiBuildCommanderSummaryLink(options) {
  const deps = _saRequireDependencies_();
  const WorkflowOrchestrator_ = deps.WorkflowOrchestrator_;
  const SelectionActionService_ = deps.SelectionActionService_;
  const PreviewLinkService_ = deps.PreviewLinkService_;

  return WorkflowOrchestrator_.run({
    scenario: 'buildCommanderSummaryLink',
    payload: _saNormalizeOptions_(options),
    write: false,
    execute: function(input) {
      const prepared = _saEnsurePreparedObject_(SelectionActionService_.prepareCommanderSummaryPreview(input || {}));
      const hasLink = !!prepared.link;

      return {
        success: true,
        message: hasLink
          ? 'Посилання на зведення командиру підготовлено'
          : 'Телефон командира не знайдено',
        result: _saBuildSummaryPreviewSafe_(PreviewLinkService_, prepared, {
          title: prepared.title || 'Зведення командиру'
        }),
        changes: [],
        affectedSheets: _saExtractAffectedSheets_(prepared.sheet || _saResolveBotMonthSheetName_(), ''),
        affectedEntities: [_saResolveCommanderRole_()],
        warnings: hasLink ? [] : ['Телефон для командира не знайдено']
      };
    }
  });
}

function apiLogPreparedMessages(options) {
  const deps = _saRequireDependencies_();
  const WorkflowOrchestrator_ = deps.WorkflowOrchestrator_;
  const SelectionActionService_ = deps.SelectionActionService_;
  const PreviewLinkService_ = deps.PreviewLinkService_;

  return WorkflowOrchestrator_.run({
    scenario: 'logPreparedMessages',
    payload: _saNormalizeOptions_(options),
    write: true,
    execute: function(input) {
      const safeInput = _saNormalizeOptions_(input);
      const mode = safeInput.mode || 'selection';
      const prepared = _saEnsurePreparedObject_(SelectionActionService_.resolvePayloadBundle(mode));
      const payloads = _saSafeArray_(prepared.payloads);
      const logSheet = _saResolveLogSheetName_();

      if (!payloads.length) {
        return {
          success: true,
          message: 'Немає payload для запису в LOG',
          result: _saBuildMultiplePreviewSafe_(PreviewLinkService_, [], prepared.errors || [], {
            title: 'LOG preview',
            logged: false
          }),
          changes: [],
          affectedSheets: _saExtractAffectedSheets_(prepared.sheetName || '', logSheet),
          affectedEntities: [],
          appliedChangesCount: 0,
          skippedChangesCount: 0
        };
      }

      if (!safeInput.dryRun && typeof SelectionActionService_.logPayloads === 'function') {
        SelectionActionService_.logPayloads(payloads);
      }

      const preview = prepared.selectionType === 'single' && payloads.length === 1
        ? _saBuildSinglePreviewSafe_(PreviewLinkService_, payloads[0], {
            title: 'Записано в LOG',
            logged: true
          })
        : _saBuildMultiplePreviewSafe_(PreviewLinkService_, payloads, prepared.errors || [], {
            title: 'Записано в LOG',
            logged: true
          });

      return {
        success: true,
        message: safeInput.dryRun
          ? 'Dry-run LOG preview: ' + payloads.length
          : 'У LOG записано: ' + payloads.length,
        result: preview,
        changes: [{
          type: 'writeLogsBatch',
          count: payloads.length
        }],
        affectedSheets: _saExtractAffectedSheets_(prepared.sheetName || '', logSheet),
        affectedEntities: _saExtractAffectedEntitiesFromPayloads_(payloads),
        appliedChangesCount: safeInput.dryRun ? 0 : payloads.length,
        skippedChangesCount: safeInput.dryRun ? payloads.length : 0
      };
    }
  });
}

function apiRunSelectionDiagnostics(options) {
  const deps = _saRequireDependencies_();
  const WorkflowOrchestrator_ = deps.WorkflowOrchestrator_;
  const SelectionActionService_ = deps.SelectionActionService_;

  return WorkflowOrchestrator_.run({
    scenario: 'runSelectionDiagnostics',
    payload: _saNormalizeOptions_(options),
    write: false,
    execute: function() {
      const diagnostics = (typeof SelectionActionService_.runDiagnostics === 'function')
        ? SelectionActionService_.runDiagnostics()
        : { error: 'runDiagnostics not available' };

      return {
        success: true,
        message: 'Діагностику selection-сценарію побудовано',
        result: diagnostics,
        changes: [],
        affectedSheets: [_saResolveBotMonthSheetName_()],
        affectedEntities: [_saResolveCommanderRole_()]
      };
    }
  });
}
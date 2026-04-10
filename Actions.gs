/**
 * Actions.gs — stage 5 thin spreadsheet/menu wrappers.
 *
 * Новая логика сюда больше не растёт. Этот файл только перенаправляет
 * меню/manual сценарии в канонический spreadsheet action API и presenter-слой.
 * 
 * Важливо: всі функції перевіряють права доступу перед виконанням.
 */

// ==================== ДОПОМІЖНІ ФУНКЦІЇ ====================

function _checkAccessForAction_(requiredRole, actionName) {
  try {
    if (typeof AccessControl_ !== 'object') {
      throw new Error('AccessControl_ не доступний');
    }
    const descriptor = AccessControl_.describe();
    if (!descriptor.enabled) {
      throw new Error('Ваш обліковий запис вимкнено');
    }
    
    const roleOrder = AccessControl_.ROLE_ORDER || { guest: 0, viewer: 1, operator: 2, maintainer: 3, admin: 4, sysadmin: 5, owner: 6 };
    const currentLevel = roleOrder[descriptor.role] || 0;
    const requiredLevel = roleOrder[requiredRole] || 0;
    
    if (currentLevel < requiredLevel) {
      throw new Error(`Недостатньо прав для дії "${actionName}". Потрібна роль: ${requiredRole}, ваша роль: ${descriptor.role}`);
    }
    
    return descriptor;
  } catch (e) {
    if (typeof AccessEnforcement_ === 'object' && AccessEnforcement_.reportViolation) {
      AccessEnforcement_.reportViolation(actionName, { requiredRole: requiredRole }, { role: 'guest' });
    }
    throw e;
  }
}

function _auditAction_(actionName, result, details) {
  try {
    if (typeof Stage7AuditTrail_ === 'object' && Stage7AuditTrail_.record) {
      Stage7AuditTrail_.record({
        timestamp: new Date(),
        operationId: typeof stage7UniqueId_ === 'function' ? stage7UniqueId_('action') : Date.now().toString(),
        scenario: 'menu.action.' + actionName,
        level: 'INFO',
        status: result === 'success' ? 'COMMITTED' : 'FAILED',
        initiator: Session.getActiveUser().getEmail(),
        dryRun: false,
        partial: false,
        affectedSheets: [],
        affectedEntities: [],
        payload: { action: actionName, details: details || {} },
        message: `Виконано дію: ${actionName}`,
        error: result === 'error' ? String(details) : ''
      });
    }
  } catch (_) {}
}

function buildPayloadFromSelection_() {
  try {
    _checkAccessForAction_('viewer', 'buildPayloadFromSelection');
    return SelectionActionService_.prepareSingleSelection().payload;
  } catch (e) {
    _showActionError_(e);
    return null;
  }
}

function _unwrapActionResult_(result, actionName) {
  if (!result) {
    throw new Error('Сценарій не повернув результат');
  }
  if (result.success !== true) {
    const errorMsg = (result && (result.error || result.message)) || 'Сценарій не виконано';
    throw new Error(errorMsg);
  }
  
  // Перевіряємо наявність даних
  const data = (result.data && result.data.result) || result.data;
  if (data === null || data === undefined) {
    throw new Error('Сценарій виконано, але не повернуто даних для відображення');
  }
  
  return data;
}

function _showActionError_(e) {
  const errorMsg = e && e.message ? e.message : String(e);
  try {
    SpreadsheetApp.getUi().alert('Помилка', errorMsg, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (_) {
    // Якщо UI недоступний (наприклад, при виконанні з тригера)
    Logger.log('[Actions] Помилка: ' + errorMsg);
  }
}

// ==================== ФУНКЦІЇ ДЛЯ МЕНЮ ====================

function waShowForSelection() {
  const actionName = 'waShowForSelection';
  try {
    _checkAccessForAction_('viewer', actionName);
    const result = _unwrapActionResult_(apiPreviewSelectionMessage({}), actionName);
    if (result) {
      DialogPresenter_.showPrepared(result);
      _auditAction_(actionName, 'success', {});
    } else {
      throw new Error('Немає даних для відображення');
    }
  } catch (e) {
    _auditAction_(actionName, 'error', e.message);
    _showActionError_(e);
  }
}

function waLogAndShowForSelection() {
  const actionName = 'waLogAndShowForSelection';
  try {
    _checkAccessForAction_('operator', actionName);
    const result = _unwrapActionResult_(apiLogPreparedMessages({ mode: 'selection' }), actionName);
    if (result) {
      DialogPresenter_.showPrepared(result);
      _auditAction_(actionName, 'success', { mode: 'selection' });
    } else {
      throw new Error('Немає даних для відображення');
    }
  } catch (e) {
    _auditAction_(actionName, 'error', e.message);
    _showActionError_(e);
  }
}

function waShowForMultipleCells() {
  const actionName = 'waShowForMultipleCells';
  try {
    _checkAccessForAction_('viewer', actionName);
    const result = _unwrapActionResult_(apiPreviewMultipleMessages({}), actionName);
    if (result) {
      DialogPresenter_.showPrepared(result);
      _auditAction_(actionName, 'success', {});
    } else {
      throw new Error('Немає даних для відображення');
    }
  } catch (e) {
    _auditAction_(actionName, 'error', e.message);
    _showActionError_(e);
  }
}

function waLogAndShowForMultipleCells() {
  const actionName = 'waLogAndShowForMultipleCells';
  try {
    _checkAccessForAction_('operator', actionName);
    const result = _unwrapActionResult_(apiLogPreparedMessages({ mode: 'multiple' }), actionName);
    if (result) {
      DialogPresenter_.showPrepared(result);
      _auditAction_(actionName, 'success', { mode: 'multiple' });
    } else {
      throw new Error('Немає даних для відображення');
    }
  } catch (e) {
    _auditAction_(actionName, 'error', e.message);
    _showActionError_(e);
  }
}

function waMassByRange() {
  const actionName = 'waMassByRange';
  try {
    _checkAccessForAction_('maintainer', actionName);
    const result = _unwrapActionResult_(apiLogPreparedMessages({ mode: 'range' }), actionName);
    if (result) {
      DialogPresenter_.showPrepared(result);
      _auditAction_(actionName, 'success', { mode: 'range' });
    } else {
      throw new Error('Немає даних для відображення');
    }
  } catch (e) {
    _auditAction_(actionName, 'error', e.message);
    _showActionError_(e);
  }
}

function waShowGroupedByPhone() {
  const actionName = 'waShowGroupedByPhone';
  try {
    _checkAccessForAction_('viewer', actionName);
    const result = _unwrapActionResult_(apiPreviewGroupedMessages({}), actionName);
    if (result) {
      DialogPresenter_.showPrepared(result);
      _auditAction_(actionName, 'success', {});
    } else {
      throw new Error('Немає даних для відображення');
    }
  } catch (e) {
    _auditAction_(actionName, 'error', e.message);
    _showActionError_(e);
  }
}

function waLogAndShowGroupedByPhone() {
  const actionName = 'waLogAndShowGroupedByPhone';
  try {
    _checkAccessForAction_('operator', actionName);
    const result = _unwrapActionResult_(apiLogPreparedMessages({ mode: 'grouped' }), actionName);
    if (result) {
      DialogPresenter_.showPrepared(result);
      _auditAction_(actionName, 'success', { mode: 'grouped' });
    } else {
      throw new Error('Немає даних для відображення');
    }
  } catch (e) {
    _auditAction_(actionName, 'error', e.message);
    _showActionError_(e);
  }
}

function processMultipleCells_(log) {
  const actionName = 'processMultipleCells';
  try {
    _checkAccessForAction_(log ? 'operator' : 'viewer', actionName);
    if (log) {
      return waLogAndShowForMultipleCells();
    }
    return waShowForMultipleCells();
  } catch (e) {
    _showActionError_(e);
    return null;
  }
}

function processGroupedByPhone_(log) {
  const actionName = 'processGroupedByPhone';
  try {
    _checkAccessForAction_(log ? 'operator' : 'viewer', actionName);
    if (log) {
      return waLogAndShowGroupedByPhone();
    }
    return waShowGroupedByPhone();
  } catch (e) {
    _showActionError_(e);
    return null;
  }
}

function sumShowForSelectedColumn() {
  const actionName = 'sumShowForSelectedColumn';
  try {
    _checkAccessForAction_('operator', actionName);
    const result = _unwrapActionResult_(apiBuildCommanderSummaryPreview({}), actionName);
    if (result) {
      DialogPresenter_.showPrepared(result);
      _auditAction_(actionName, 'success', {});
    } else {
      throw new Error('Немає даних для відображення');
    }
  } catch (e) {
    _auditAction_(actionName, 'error', e.message);
    _showActionError_(e);
  }
}

function sumWaToCommanderForSelectedColumn() {
  const actionName = 'sumWaToCommanderForSelectedColumn';
  try {
    _checkAccessForAction_('maintainer', actionName);
    const result = _unwrapActionResult_(apiBuildCommanderSummaryLink({}), actionName);
    if (result) {
      DialogPresenter_.showPrepared(result);
      _auditAction_(actionName, 'success', {});
    } else {
      throw new Error('Немає даних для відображення');
    }
  } catch (e) {
    _auditAction_(actionName, 'error', e.message);
    _showActionError_(e);
  }
}

function diagnoseCommanderPhone() {
  const actionName = 'diagnoseCommanderPhone';
  try {
    _checkAccessForAction_('maintainer', actionName);
    const report = _unwrapActionResult_(apiRunSelectionDiagnostics({}), actionName);
    
    if (!report) {
      throw new Error('Не вдалося отримати діагностичний звіт');
    }
    
    const message = [
      'ДІАГНОСТИКА',
      '================',
      `Аркуш: ${report.sheet || '—'}`,
      `Bot sheet: ${report.botSheet || '—'}`,
      `Активне виділення: ${report.activeRange || '—'}`,
      `Діапазонів виділено: ${report.selectedRangesCount || 0}`,
      `Payload: ${report.payloadCount || 0}`,
      `Помилок: ${report.errorCount || 0}`,
      `Командир (${report.commanderRole || '—'}): ${report.commanderPhonePresent ? 'є телефон' : 'немає телефону'}`,
      '',
      report.errorCount > 0 ? `Виявлено ${report.errorCount} помилок. Перевірте журнал.` : 'Система працює нормально'
    ].join('\n');
    
    SpreadsheetApp.getUi().alert('Діагностика', message, SpreadsheetApp.getUi().ButtonSet.OK);
    _auditAction_(actionName, 'success', { errorCount: report.errorCount });
  } catch (e) {
    _auditAction_(actionName, 'error', e.message);
    _showActionError_(e);
  }
}

// ==================== ДОДАТКОВІ ФУНКЦІЇ ДЛЯ ЗРУЧНОСТІ ====================

function getAvailableActionsForCurrentUser() {
  try {
    if (typeof AccessControl_ !== 'object') {
      return { error: 'AccessControl_ не доступний' };
    }
    const descriptor = AccessControl_.describe();
    return {
      role: descriptor.role,
      allowedActions: descriptor.allowedActions || [],
      canView: descriptor.readOnly === false,
      canEdit: descriptor.isMaintainer || descriptor.isAdmin,
      canAdmin: descriptor.isAdmin
    };
  } catch (e) {
    return { error: e.message };
  }
}

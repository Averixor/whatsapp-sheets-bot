/**
 * SpreadsheetProtection.gs
 * Повна безпечна версія для Google Apps Script / WASB.
 */

function _spGlobal_() {
  try {
    if (typeof globalThis !== 'undefined') return globalThis;
  } catch (_) {}
  try {
    return this;
  } catch (_) {}
  return {};
}

function _spHasFunction_(value) {
  return typeof value === 'function';
}

function _spHasObject_(value) {
  return !!value && typeof value === 'object';
}

function _spSafeString_(value, fallback) {
  if (value === null || typeof value === 'undefined') return fallback || '';
  return String(value);
}

function _spNormalizeEmail_(value) {
  return _spSafeString_(value, '').trim().toLowerCase();
}

function _spUniqueStrings_(items) {
  const seen = {};
  const result = [];
  const list = Array.isArray(items) ? items : [];

  for (let i = 0; i < list.length; i++) {
    const value = _spSafeString_(list[i], '').trim();
    if (!value) continue;
    if (seen[value]) continue;
    seen[value] = true;
    result.push(value);
  }

  return result;
}

function _spLog_(message, error) {
  try {
    if (error) {
      Logger.log('[SpreadsheetProtection] ' + message + ': ' + (error && error.message ? error.message : error));
    } else {
      Logger.log('[SpreadsheetProtection] ' + message);
    }
  } catch (_) {}
}

function _spGetConfigValue_(container, key, fallback) {
  try {
    if (_spHasObject_(container) && typeof container[key] !== 'undefined' && container[key] !== null && container[key] !== '') {
      return container[key];
    }
  } catch (_) {}
  return fallback;
}

function _spGetCoreValue_(key, fallback) {
  try {
    if (_spHasFunction_(appGetCore)) {
      const value = appGetCore(key, fallback);
      return (typeof value === 'undefined' || value === null || value === '') ? fallback : value;
    }
  } catch (_) {}
  try {
    if (typeof CONFIG !== 'undefined' && _spHasObject_(CONFIG) && typeof CONFIG[key] !== 'undefined' && CONFIG[key] !== null && CONFIG[key] !== '') {
      return CONFIG[key];
    }
  } catch (_) {}
  return fallback;
}

function _spResolveSheetNames_(options) {
  const opts = _spHasObject_(options) ? options : {};
  const config = (typeof CONFIG !== 'undefined' && _spHasObject_(CONFIG)) ? CONFIG : {};
  const stage7 = (typeof STAGE7_CONFIG !== 'undefined' && _spHasObject_(STAGE7_CONFIG)) ? STAGE7_CONFIG : {};

  const includeSendPanel = typeof opts.includeSendPanel === 'boolean' ? opts.includeSendPanel : true;

  const names = [
    _spGetConfigValue_(config, 'LOG_SHEET', 'LOG'),
    _spGetConfigValue_(stage7, 'AUDIT_LOG_SHEET', 'AUDIT_LOG'),
    _spGetConfigValue_(stage7, 'JOB_RUNTIME_LOG_SHEET', 'JOB_RUNTIME_LOG'),
    _spGetCoreValue_('OPS_LOG_SHEET', 'OPS_LOG'),
    _spGetCoreValue_('ACTIVE_OPERATIONS_SHEET', 'ACTIVE_OPERATIONS'),
    _spGetCoreValue_('CHECKPOINTS_SHEET', 'CHECKPOINTS'),
    _spGetCoreValue_('ALERTS_LOG_SHEET', 'ALERTS_LOG'),
    _spGetCoreValue_('ACCESS_SHEET', 'ACCESS')
  ];

  if (includeSendPanel) {
    names.push(_spGetConfigValue_(config, 'SEND_PANEL_SHEET', 'SEND_PANEL'));
  }

  return _spUniqueStrings_(names);
}

function _spResolveAdminEmails_() {
  const scope = _spGlobal_();
  const result = [];

  try {
    if (_spHasObject_(scope.AccessControl_) && _spHasFunction_(scope.AccessControl_.listAdminEmails)) {
      const emails = scope.AccessControl_.listAdminEmails();
      const normalized = _spUniqueStrings_((emails || []).map(function(email) {
        return _spNormalizeEmail_(email);
      }));
      for (let i = 0; i < normalized.length; i++) {
        result.push(normalized[i]);
      }
    }
  } catch (error) {
    _spLog_('AccessControl_.listAdminEmails failed', error);
  }

  return _spUniqueStrings_(result);
}

function _spResolveFallbackEditor_() {
  try {
    if (typeof Session !== 'undefined' && _spHasFunction_(Session.getEffectiveUser)) {
      const user = Session.getEffectiveUser();
      if (user && _spHasFunction_(user.getEmail)) {
        return _spNormalizeEmail_(user.getEmail());
      }
    }
  } catch (error) {
    _spLog_('Unable to resolve fallback editor', error);
  }
  return '';
}

function _spCanCall_(target, methodName) {
  return !!target && typeof target[methodName] === 'function';
}

function _spRemoveDisallowedEditors_(protection, allowEditors, summary, sheetName) {
  try {
    if (!_spCanCall_(protection, 'getEditors')) return;

    const currentEditors = protection.getEditors() || [];
    const removable = [];

    for (let i = 0; i < currentEditors.length; i++) {
      const user = currentEditors[i];
      const email = _spNormalizeEmail_(user && _spHasFunction_(user.getEmail) ? user.getEmail() : '');
      if (!email) continue;
      if (allowEditors.indexOf(email) === -1) {
        removable.push(user);
      }
    }

    if (removable.length && _spCanCall_(protection, 'removeEditors')) {
      protection.removeEditors(removable);
      summary.removedEditors[sheetName] = removable.map(function(user) {
        return _spNormalizeEmail_(user && _spHasFunction_(user.getEmail) ? user.getEmail() : '');
      }).filter(Boolean);
    }
  } catch (error) {
    summary.warnings.push('Не вдалося видалити зайвих редакторів для листа ' + sheetName + ': ' + (error && error.message ? error.message : error));
  }
}

function _spAddAllowedEditors_(protection, allowEditors, summary, sheetName) {
  try {
    if (!allowEditors.length) return;
    if (_spCanCall_(protection, 'addEditors')) {
      protection.addEditors(allowEditors);
      summary.allowedEditors[sheetName] = allowEditors.slice();
    }
  } catch (error) {
    summary.warnings.push('Не вдалося додати дозволених редакторів для листа ' + sheetName + ': ' + (error && error.message ? error.message : error));
  }
}

function _spDisableDomainEdit_(protection, summary, sheetName) {
  try {
    if (_spCanCall_(protection, 'canDomainEdit') && protection.canDomainEdit()) {
      if (_spCanCall_(protection, 'setDomainEdit')) {
        protection.setDomainEdit(false);
        summary.domainEditDisabled.push(sheetName);
      }
    }
  } catch (error) {
    summary.warnings.push('Не вдалося вимкнути domain edit для листа ' + sheetName + ': ' + (error && error.message ? error.message : error));
  }
}

function _spProtectSheet_(sheet, allowEditors, warningOnly, summary, description) {
  const sheetName = _spSafeString_(sheet && _spHasFunction_(sheet.getName) ? sheet.getName() : '', '');

  try {
    if (!sheet || !_spCanCall_(sheet, 'protect')) {
      summary.warnings.push('Лист ' + sheetName + ' не підтримує protect()');
      return false;
    }

    const protection = sheet.protect();
    if (!protection) {
      summary.warnings.push('Не вдалося створити protection для листа ' + sheetName);
      return false;
    }

    if (_spCanCall_(protection, 'setDescription')) {
      protection.setDescription(description);
    }

    if (_spCanCall_(protection, 'setWarningOnly')) {
      protection.setWarningOnly(!!warningOnly);
    }

    if (!warningOnly && allowEditors.length) {
      _spDisableDomainEdit_(protection, summary, sheetName);
      _spRemoveDisallowedEditors_(protection, allowEditors, summary, sheetName);
      _spAddAllowedEditors_(protection, allowEditors, summary, sheetName);
    }

    summary.protectedSheets.push(sheetName);
    return true;
  } catch (error) {
    summary.warnings.push('Не вдалося захистити лист ' + sheetName + ': ' + (error && error.message ? error.message : error));
    return false;
  }
}

function _wasbServiceSheets_(options) {
  return _spResolveSheetNames_(options);
}

function applySpreadsheetProtections_(options) {
  const opts = Object.assign({
    dryRun: true,
    includeSendPanel: true,
    description: 'WASB service sheet protection'
  }, _spHasObject_(options) ? options : {});

  const summary = {
    dryRun: !!opts.dryRun,
    warningOnly: true,
    adminEmails: [],
    fallbackEditor: '',
    allowEditors: [],
    plannedSheets: [],
    protectedSheets: [],
    missingSheets: [],
    warnings: [],
    allowedEditors: {},
    removedEditors: {},
    domainEditDisabled: []
  };

  let ss;
  try {
    ss = SpreadsheetApp.getActive();
  } catch (error) {
    summary.warnings.push('Не вдалося отримати активну таблицю: ' + (error && error.message ? error.message : error));
    return summary;
  }

  if (!ss) {
    summary.warnings.push('Активна таблиця не знайдена');
    return summary;
  }

  const adminEmails = _spResolveAdminEmails_();
  const fallbackEditor = _spResolveFallbackEditor_();
  const allowEditors = _spUniqueStrings_([fallbackEditor].concat(adminEmails).map(function(email) {
    return _spNormalizeEmail_(email);
  }));

  summary.adminEmails = adminEmails.slice();
  summary.fallbackEditor = fallbackEditor;
  summary.allowEditors = allowEditors.slice();
  summary.warningOnly = allowEditors.length === 0;

  const sheetNames = _wasbServiceSheets_(opts);

  for (let i = 0; i < sheetNames.length; i++) {
    const sheetName = sheetNames[i];
    summary.plannedSheets.push(sheetName);

    let sheet = null;
    try {
      sheet = ss.getSheetByName(sheetName);
    } catch (error) {
      summary.warnings.push('Не вдалося отримати лист ' + sheetName + ': ' + (error && error.message ? error.message : error));
      continue;
    }

    if (!sheet) {
      summary.missingSheets.push(sheetName);
      continue;
    }

    if (opts.dryRun) continue;

    _spProtectSheet_(sheet, allowEditors, summary.warningOnly, summary, _spSafeString_(opts.description, 'WASB service sheet protection'));
  }

  if (summary.warningOnly) {
    summary.warnings.push('Адміністратори не налаштовані або email поточного редактора недоступний — застосовано warningOnly protection.');
  }

  return summary;
}
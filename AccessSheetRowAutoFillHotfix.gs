/**
 * WASB ACCESS sheet row autofill hotfix.
 *
 * Назначение:
 * - не удаляет строки ACCESS;
 * - не чистит содержимое;
 * - копирует выпадающие списки/формат из шаблонной строки;
 * - генерирует новый ключ только если хеш текущего ключа пустой;
 * - выводит plain-key в отдельный лист ACCESS_KEYS_OUTBOX, потому что из хеша ключ восстановить нельзя.
 */

var WASB_ACCESS_SHEET_NAME_HOTFIX_ = 'ACCESS';
var WASB_ACCESS_KEYS_OUTBOX_SHEET_NAME_HOTFIX_ = 'ACCESS_KEYS_OUTBOX';
var WASB_ACCESS_TEMPLATE_ROW_HOTFIX_ = 2;

function wasbAccessNormalizeHeaderHotfix_(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\u00a0/g, ' ')
    .replace(/[ʼ’`´]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function wasbAccessFindColHotfix_(headers, variants) {
  var normalized = headers.map(wasbAccessNormalizeHeaderHotfix_);

  for (var i = 0; i < variants.length; i++) {
    var wanted = wasbAccessNormalizeHeaderHotfix_(variants[i]);
    var idx = normalized.indexOf(wanted);
    if (idx >= 0) {
      return idx + 1;
    }
  }

  return 0;
}

function wasbAccessGetSheetHotfix_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(WASB_ACCESS_SHEET_NAME_HOTFIX_);

  if (!sheet) {
    throw new Error('Лист ACCESS не найден.');
  }

  return sheet;
}

function wasbAccessGetHeadersHotfix_(sheet) {
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0];
}

function wasbAccessSha256HexHotfix_(text) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(text || ''),
    Utilities.Charset.UTF_8
  );

  return bytes.map(function (b) {
    var v = b;
    if (v < 0) {
      v += 256;
    }
    return ('0' + v.toString(16)).slice(-2);
  }).join('');
}

function wasbAccessGeneratePlainKeyHotfix_() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var raw = '';

  for (var i = 0; i < 12; i++) {
    raw += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return 'WASB-' + raw.slice(0, 4) + '-' + raw.slice(4, 8) + '-' + raw.slice(8, 12);
}

function wasbAccessApplyTemplateToRowHotfix_(sheet, row) {
  if (!row || row <= 1) {
    return;
  }

  var templateRow = WASB_ACCESS_TEMPLATE_ROW_HOTFIX_;
  var lastCol = sheet.getLastColumn();

  if (lastCol < 1 || sheet.getLastRow() < templateRow) {
    return;
  }

  var source = sheet.getRange(templateRow, 1, 1, lastCol);
  var target = sheet.getRange(row, 1, 1, lastCol);

  source.copyTo(target, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
  source.copyTo(target, SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION, false);
}

function wasbAccessEnsureOutboxHotfix_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(WASB_ACCESS_KEYS_OUTBOX_SHEET_NAME_HOTFIX_);

  if (!sheet) {
    sheet = ss.insertSheet(WASB_ACCESS_KEYS_OUTBOX_SHEET_NAME_HOTFIX_);
    sheet.getRange(1, 1, 1, 7).setValues([[
      'created_at',
      'email',
      'login',
      'display_name',
      'callsign',
      'plain_access_key',
      'note'
    ]]);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

/**
 * Основная функция ремонта.
 * Запускать вручную после добавления новых строк в ACCESS.
 */
function wasbRepairAccessSheetRowsHotfix() {
  var sheet = wasbAccessGetSheetHotfix_();
  var headers = wasbAccessGetHeadersHotfix_(sheet);
  var lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return {
      ok: true,
      repairedRows: 0,
      generatedKeys: 0,
      message: 'ACCESS пустой.'
    };
  }

  var emailCol = wasbAccessFindColHotfix_(headers, [
    'електронна пошта',
    'email'
  ]);

  var loginCol = wasbAccessFindColHotfix_(headers, [
    'логін',
    'login'
  ]);

  var activeCol = wasbAccessFindColHotfix_(headers, [
    'активний',
    'enabled'
  ]);

  var displayCol = wasbAccessFindColHotfix_(headers, [
    'імʼя, що відображається',
    'ім’я, що відображається',
    'display_name',
    'display name'
  ]);

  var callsignCol = wasbAccessFindColHotfix_(headers, [
    'позивний користувача',
    'person_callsign',
    'callsign'
  ]);

  var selfBindCol = wasbAccessFindColHotfix_(headers, [
    'дозволена самостійна привʼязка',
    'дозволена самостійна прив’язка',
    'self_bind_allowed'
  ]);

  var currentHashCol = wasbAccessFindColHotfix_(headers, [
    'хеш поточного ключа',
    'user_key_current_hash'
  ]);

  var requestHashCol = wasbAccessFindColHotfix_(headers, [
    'хеш ключа із запиту',
    'request_user_key_hash'
  ]);

  var statusCol = wasbAccessFindColHotfix_(headers, [
    'статус реєстрації',
    'registration_status'
  ]);

  var approvedByCol = wasbAccessFindColHotfix_(headers, [
    'ким схвалено',
    'approved_by'
  ]);

  var approvedAtCol = wasbAccessFindColHotfix_(headers, [
    'час схвалення',
    'approved_at'
  ]);

  if (!currentHashCol) {
    throw new Error('Не найдена колонка "хеш поточного ключа" / user_key_current_hash.');
  }

  var outbox = wasbAccessEnsureOutboxHotfix_();
  var now = new Date();
  var repairedRows = 0;
  var generatedKeys = 0;
  var outboxRows = [];

  for (var row = 2; row <= lastRow; row++) {
    var rowValues = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];

    var email = emailCol ? rowValues[emailCol - 1] : '';
    var login = loginCol ? rowValues[loginCol - 1] : '';
    var displayName = displayCol ? rowValues[displayCol - 1] : '';
    var callsign = callsignCol ? rowValues[callsignCol - 1] : '';

    var hasPerson =
      String(email || '').trim() ||
      String(login || '').trim() ||
      String(displayName || '').trim() ||
      String(callsign || '').trim();

    if (!hasPerson) {
      continue;
    }

    wasbAccessApplyTemplateToRowHotfix_(sheet, row);
    repairedRows++;

    var currentHash = String(rowValues[currentHashCol - 1] || '').trim();

    if (!currentHash) {
      var plainKey = wasbAccessGeneratePlainKeyHotfix_();
      var hash = wasbAccessSha256HexHotfix_(plainKey);

      sheet.getRange(row, currentHashCol).setValue(hash);

      if (requestHashCol) {
        sheet.getRange(row, requestHashCol).setValue(hash);
      }

      if (selfBindCol && !String(rowValues[selfBindCol - 1] || '').trim()) {
        sheet.getRange(row, selfBindCol).setValue(true);
      }

      if (activeCol && !String(rowValues[activeCol - 1] || '').trim()) {
        sheet.getRange(row, activeCol).setValue(true);
      }

      if (statusCol && !String(rowValues[statusCol - 1] || '').trim()) {
        sheet.getRange(row, statusCol).setValue('key_sent');
      }

      if (approvedByCol && !String(rowValues[approvedByCol - 1] || '').trim()) {
        sheet.getRange(row, approvedByCol).setValue(Session.getActiveUser().getEmail() || 'admin');
      }

      if (approvedAtCol && !String(rowValues[approvedAtCol - 1] || '').trim()) {
        sheet.getRange(row, approvedAtCol).setValue(now);
      }

      outboxRows.push([
        now,
        email,
        login,
        displayName,
        callsign,
        plainKey,
        'Новий ключ створено hotfix-функцією. Передайте користувачу і після використання очистіть цей рядок.'
      ]);

      generatedKeys++;
    }
  }

  if (outboxRows.length) {
    outbox.getRange(outbox.getLastRow() + 1, 1, outboxRows.length, outboxRows[0].length)
      .setValues(outboxRows);
  }

  return {
    ok: true,
    repairedRows: repairedRows,
    generatedKeys: generatedKeys,
    outboxSheet: WASB_ACCESS_KEYS_OUTBOX_SHEET_NAME_HOTFIX_
  };
}

/**
 * Установить автообработчик редактирования ACCESS.
 * Запустить один раз вручную из Apps Script.
 */
function wasbInstallAccessSheetAutofillTriggerHotfix() {
  var triggers = ScriptApp.getProjectTriggers();

  triggers.forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'wasbAccessSheetOnEditAutofillHotfix_') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('wasbAccessSheetOnEditAutofillHotfix_')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();

  return {
    ok: true,
    installed: true,
    handler: 'wasbAccessSheetOnEditAutofillHotfix_'
  };
}

/**
 * Автозаполнение строки ACCESS при ручном редактировании.
 */
function wasbAccessSheetOnEditAutofillHotfix_(e) {
  if (!e || !e.range) {
    return;
  }

  var sheet = e.range.getSheet();

  if (!sheet || sheet.getName() !== WASB_ACCESS_SHEET_NAME_HOTFIX_) {
    return;
  }

  var row = e.range.getRow();

  if (row <= 1) {
    return;
  }

  wasbAccessApplyTemplateToRowHotfix_(sheet, row);
}

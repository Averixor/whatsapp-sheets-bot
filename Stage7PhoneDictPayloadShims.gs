/**
 * Stage7PhoneDictPayloadShims.gs
 *
 * Compatibility shims for diagnostics and older callers.
 * Canonical data still lives in PHONES / DICT / repositories.
 */

function _stage7ShimNormalizeHeader_(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[’'`"ʼ]/g, '')
    .replace(/\s+/g, ' ');
}

function _stage7ShimFindHeaderCol_(headers, names, fallbackIndex) {
  var normalized = (headers || []).map(_stage7ShimNormalizeHeader_);
  for (var i = 0; i < normalized.length; i++) {
    for (var j = 0; j < names.length; j++) {
      if (normalized[i].indexOf(names[j]) !== -1) return i;
    }
  }
  return typeof fallbackIndex === 'number' ? fallbackIndex : -1;
}

function loadPhonesIndex_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.PHONES_SHEET) ? CONFIG.PHONES_SHEET : 'PHONES';
  var sheet = ss.getSheetByName(sheetName);

  var out = {
    byCallsign: {},
    byFml: {},
    byNorm: {},
    byRole: {},
    byPhone: {},
    items: [],
    versionMarker: 'stage7-phones-index-compat-v1'
  };

  if (!sheet || sheet.getLastRow() < 2) {
    return out;
  }

  var range = sheet.getRange(1, 1, sheet.getLastRow(), Math.max(sheet.getLastColumn(), 1));
  var values = range.getDisplayValues();
  var headers = values[0] || [];
  var rows = values.slice(1);

  var fmlCol = _stage7ShimFindHeaderCol_(headers, ['піб', 'фио', 'fml', 'name'], 0);
  var phoneCol = _stage7ShimFindHeaderCol_(headers, ['тел', 'phone', 'номер'], 1);
  var callsignCol = _stage7ShimFindHeaderCol_(headers, ['позив', 'callsign', 'роль', 'role'], 2);
  var roleCol = _stage7ShimFindHeaderCol_(headers, ['роль', 'role', 'посада'], callsignCol);

  rows.forEach(function(row, idx) {
    var fml = fmlCol >= 0 ? String(row[fmlCol] || '').trim() : '';
    var rawPhone = phoneCol >= 0 ? row[phoneCol] : '';
    var phone = typeof normalizePhone_ === 'function' ? normalizePhone_(rawPhone) : String(rawPhone || '').trim();
    var callsign = callsignCol >= 0 ? String(row[callsignCol] || '').trim() : '';
    var role = roleCol >= 0 ? String(row[roleCol] || '').trim() : callsign;

    if (!fml && !phone && !callsign && !role) return;

    var item = {
      row: idx + 2,
      fml: fml,
      phone: phone,
      callsign: callsign,
      role: role,
      rawPhone: String(rawPhone || '').trim()
    };

    out.items.push(item);

    var fmlKey = typeof _normFmlForProfiles_ === 'function'
      ? _normFmlForProfiles_(fml)
      : String(fml || '').trim().toUpperCase();

    var normKey = typeof normalizeFML_ === 'function'
      ? normalizeFML_(fml)
      : String(fml || '').trim().toLowerCase();

    var callsignKey = typeof _normCallsignKey_ === 'function'
      ? _normCallsignKey_(callsign || role)
      : String(callsign || role || '').trim().toUpperCase();

    var roleKey = typeof _normCallsignKey_ === 'function'
      ? _normCallsignKey_(role || callsign)
      : String(role || callsign || '').trim().toUpperCase();

    if (fmlKey) out.byFml[fmlKey] = item;
    if (normKey) out.byNorm[normKey] = item;
    if (callsignKey) out.byCallsign[callsignKey] = item;
    if (roleKey) out.byRole[roleKey] = item;
    if (phone) out.byPhone[phone] = item;
  });

  return out;
}

function loadPhonesMap_() {
  var index = loadPhonesIndex_();
  var map = {};

  (index.items || []).forEach(function(item) {
    if (!item || !item.phone) return;

    if (item.fml) {
      map[item.fml] = item.phone;
      if (typeof normalizeFML_ === 'function') {
        map[normalizeFML_(item.fml)] = item.phone;
      }
      if (typeof _normFmlForProfiles_ === 'function') {
        map[_normFmlForProfiles_(item.fml)] = item.phone;
      }
    }

    if (item.callsign) {
      map[item.callsign] = item.phone;
      if (typeof _normCallsignKey_ === 'function') {
        map[_normCallsignKey_(item.callsign)] = item.phone;
      }
    }

    if (item.role) {
      map[item.role] = item.phone;
      if (typeof _normCallsignKey_ === 'function') {
        map[_normCallsignKey_(item.role)] = item.phone;
      }
    }
  });

  return map;
}

function findPhone_(query) {
  if (query === null || query === undefined) return '';

  if (typeof query === 'string') {
    query = { fml: query, callsign: query, role: query };
  }

  query = query || {};

  var index = loadPhonesIndex_();

  var fml = String(query.fml || query.name || '').trim();
  var callsign = String(query.callsign || '').trim();
  var role = String(query.role || '').trim();
  var phone = String(query.phone || '').trim();

  var normalizedPhone = typeof normalizePhone_ === 'function' ? normalizePhone_(phone) : phone;
  if (normalizedPhone) return normalizedPhone;

  var fmlKey = typeof _normFmlForProfiles_ === 'function'
    ? _normFmlForProfiles_(fml)
    : String(fml || '').trim().toUpperCase();

  var normKey = typeof normalizeFML_ === 'function'
    ? normalizeFML_(fml)
    : String(fml || '').trim().toLowerCase();

  var callsignKey = typeof _normCallsignKey_ === 'function'
    ? _normCallsignKey_(callsign)
    : String(callsign || '').trim().toUpperCase();

  var roleKey = typeof _normCallsignKey_ === 'function'
    ? _normCallsignKey_(role)
    : String(role || '').trim().toUpperCase();

  var item =
    (fmlKey && index.byFml && index.byFml[fmlKey]) ||
    (normKey && index.byNorm && index.byNorm[normKey]) ||
    (callsignKey && index.byCallsign && index.byCallsign[callsignKey]) ||
    (roleKey && index.byRole && index.byRole[roleKey]) ||
    null;

  return item && item.phone ? item.phone : '';
}

function loadDictMap_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.DICT_SHEET) ? CONFIG.DICT_SHEET : 'DICT';
  var sheet = ss.getSheetByName(sheetName);
  var map = {};

  if (!sheet || sheet.getLastRow() < 2) {
    return map;
  }

  var values = sheet.getDataRange().getDisplayValues();
  var headers = values[0] || [];
  var rows = values.slice(1);

  var codeCol = _stage7ShimFindHeaderCol_(headers, ['code', 'код'], 0);
  var labelCol = _stage7ShimFindHeaderCol_(headers, ['label', 'назва', 'послуга', 'service'], 1);
  var placeCol = _stage7ShimFindHeaderCol_(headers, ['place', 'місце', 'location'], 2);
  var taskCol = _stage7ShimFindHeaderCol_(headers, ['task', 'завдання', 'message', 'повідом'], 3);

  rows.forEach(function(row) {
    var code = codeCol >= 0 ? String(row[codeCol] || '').trim() : '';
    if (!code) return;

    map[code] = {
      code: code,
      label: labelCol >= 0 ? String(row[labelCol] || '').trim() : '',
      place: placeCol >= 0 ? String(row[placeCol] || '').trim() : '',
      task: taskCol >= 0 ? String(row[taskCol] || '').trim() : '',
      message: taskCol >= 0 ? String(row[taskCol] || '').trim() : ''
    };
  });

  return map;
}

function buildPayloadForCell_(options) {
  var input = options || {};
  var code = String(input.code || input.status || '').trim();
  var dict = loadDictMap_();
  var dictItem = code && dict[code] ? dict[code] : {};

  var fml = String(input.fml || input.name || '').trim();
  var phone = input.phone ? normalizePhone_(input.phone) : findPhone_({
    fml: fml,
    callsign: input.callsign || '',
    role: input.role || ''
  });

  var date = String(input.date || input.dateStr || '').trim();
  if (!date && typeof _todayStr_ === 'function') {
    date = _todayStr_();
  }

  var message = '';

  if (typeof buildMessage_ === 'function') {
    try {
      message = buildMessage_({
        date: date,
        reportDate: date,
        fml: fml,
        phone: phone,
        code: code,
        service: dictItem.label || code,
        label: dictItem.label || code,
        place: input.place || dictItem.place || '',
        tasks: input.tasks || input.task || dictItem.task || dictItem.message || '',
        status: code
      });
    } catch (e) {
      message = '';
    }
  }

  if (!message) {
    message = [
      date ? 'Дата: ' + date : '',
      fml ? 'ПІБ: ' + fml : '',
      code ? 'Код: ' + code : '',
      dictItem.label ? 'Статус: ' + dictItem.label : '',
      dictItem.place ? 'Місце: ' + dictItem.place : '',
      (dictItem.task || dictItem.message) ? 'Завдання: ' + (dictItem.task || dictItem.message) : ''
    ].filter(Boolean).join('\n');
  }

  return {
    fml: fml,
    phone: phone,
    code: code,
    date: date,
    service: dictItem.label || code,
    label: dictItem.label || code,
    place: input.place || dictItem.place || '',
    tasks: input.tasks || input.task || dictItem.task || dictItem.message || '',
    message: message
  };
}

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

function findPhone_(query, options) {
  if (query === null || query === undefined) return '';

  if (typeof query === 'string' || typeof query === 'number') {
    query = {
      fml: String(query),
      fio: String(query),
      fullName: String(query),
      name: String(query),
      callsign: String(query),
      role: String(query)
    };
  }

  query = query || {};
  options = options || {};

  var index = options.index || loadPhonesIndex_();

  function clean_(value) {
    return String(value || '').trim();
  }

  function normLower_(value) {
    return clean_(value)
      .toLowerCase()
      .replace(/[’']/g, '')
      .replace(/\s+/g, ' ');
  }

  function normUpper_(value) {
    return clean_(value)
      .toUpperCase()
      .replace(/[’']/g, '')
      .replace(/\s+/g, ' ');
  }

  function addCandidate_(list, value) {
    value = clean_(value);
    if (!value) return;

    list.push(value);
    list.push(value.toLowerCase());
    list.push(value.toUpperCase());
    list.push(normLower_(value));
    list.push(normUpper_(value));

    if (typeof normalizeFML_ === 'function') {
      try { list.push(normalizeFML_(value)); } catch (_) {}
    }

    if (typeof _normFmlForProfiles_ === 'function') {
      try { list.push(_normFmlForProfiles_(value)); } catch (_) {}
    }

    if (typeof _normCallsignKey_ === 'function') {
      try { list.push(_normCallsignKey_(value)); } catch (_) {}
    }
  }

  function unique_(list) {
    var seen = {};
    var out = [];

    for (var i = 0; i < list.length; i++) {
      var item = clean_(list[i]);
      if (!item || seen[item]) continue;
      seen[item] = true;
      out.push(item);
    }

    return out;
  }

  function phoneFromRecord_(record) {
    if (record === null || record === undefined) return '';

    // DomainTests передаёт телефон простой строкой:
    // byFml: { 'Петренко Іван Іванович': '+380661111111' }
    if (typeof record === 'string' || typeof record === 'number') {
      return clean_(record);
    }

    return clean_(
      record.phone ||
      record.phoneRaw ||
      record.phoneDisplay ||
      record.phoneNumber ||
      record.tel ||
      record.number ||
      record.value ||
      record.mobile ||
      record.mobilePhone ||
      record.Phone ||
      record.PHONE ||
      ''
    );
  }

  function tryMap_(map, keys) {
    if (!map) return '';

    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (!key) continue;

      if (Object.prototype.hasOwnProperty.call(map, key)) {
        var phone = phoneFromRecord_(map[key]);
        if (phone) return phone;
      }
    }

    return '';
  }

  var fml = query.fml || query.fio || query.fullName || query.name || '';
  var callsign = query.callsign || query.callSign || query.nick || '';
  var role = query.role || '';
  var directPhone = query.phone || query.phoneRaw || query.number || '';

  if (directPhone) {
    if (typeof normalizePhone_ === 'function') {
      try { return normalizePhone_(directPhone); } catch (_) {}
    }
    return clean_(directPhone);
  }

  var keys = [];
  addCandidate_(keys, fml);
  addCandidate_(keys, callsign);
  addCandidate_(keys, role);
  addCandidate_(keys, query.key);
  addCandidate_(keys, query.id);
  keys = unique_(keys);

  var maps = [
    index.byFml,
    index.byNorm,
    index.byRole,
    index.byCallsign,
    index.byCallSign,
    index.byFio,
    index.byName,
    index.byFullName,
    index.byPhone,
    index.fml,
    index.fio,
    index.names,
    index.roles,
    index.callsigns,
    index.phones,
    index
  ].filter(Boolean);

  for (var m = 0; m < maps.length; m++) {
    var found = tryMap_(maps[m], keys);
    if (found) return found;
  }

  var rows = [];
  if (Array.isArray(index.items)) rows = rows.concat(index.items);
  if (Array.isArray(index.rows)) rows = rows.concat(index.rows);

  for (var r = 0; r < rows.length; r++) {
    var row = rows[r] || {};
    var rowKeys = [];

    addCandidate_(rowKeys, row.fml || row.fio || row.fullName || row.name || '');
    addCandidate_(rowKeys, row.callsign || row.callSign || row.nick || '');
    addCandidate_(rowKeys, row.role || '');
    rowKeys = unique_(rowKeys);

    for (var a = 0; a < keys.length; a++) {
      for (var b = 0; b < rowKeys.length; b++) {
        if (keys[a] && rowKeys[b] && keys[a] === rowKeys[b]) {
          var rowPhone = phoneFromRecord_(row);
          if (rowPhone) return rowPhone;
        }
      }
    }
  }

  return '';
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


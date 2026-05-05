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
  var ss = getWasbSpreadsheet_();
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
  var ss = getWasbSpreadsheet_();
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

function buildPayloadForCell_(options, rowArg, colArg, phonesMapArg, dictMapArg) {
  var isSheetCall = options && typeof options.getRange === 'function';
  var input = {};
  var sheet = null;
  var row = 0;
  var col = 0;

  function cfg_(key, fallback) {
    try {
      if (typeof CONFIG !== 'undefined' && CONFIG && CONFIG[key] !== undefined && CONFIG[key] !== null && CONFIG[key] !== '') {
        return CONFIG[key];
      }
    } catch (_) {}
    return fallback;
  }

  function clean_(value) {
    return String(value || '').trim();
  }

  function normalizePhoneCompat_(value) {
    if (value === null || value === undefined) return '';
    if (typeof normalizePhone_ === 'function') {
      try {
        return normalizePhone_(value);
      } catch (_) {}
    }

    var digits = String(value || '').replace(/\D/g, '');
    if (!digits) return '';

    if (digits.length === 9) digits = '380' + digits;
    if (digits.length === 10 && digits.charAt(0) === '0') digits = '38' + digits;
    if (digits.length === 11 && digits.charAt(0) === '8') digits = '3' + digits;

    return digits ? '+' + digits : '';
  }

  function a1FromRowColCompat_(r, c) {
    if (typeof a1FromRowCol_ === 'function') {
      try {
        return a1FromRowCol_(r, c);
      } catch (_) {}
    }

    r = Number(r);
    c = Number(c);

    var letters = '';
    while (c > 0) {
      var mod = (c - 1) % 26;
      letters = String.fromCharCode(65 + mod) + letters;
      c = Math.floor((c - mod) / 26);
    }

    return letters + String(r);
  }

  function normalizeDateCompat_(cell) {
    if (!cell) return '';

    var value = '';
    var display = '';

    try { value = cell.getValue(); } catch (_) {}
    try { display = clean_(cell.getDisplayValue()); } catch (_) {}

    if (typeof DateUtils_ !== 'undefined' && DateUtils_ && typeof DateUtils_.normalizeDate === 'function') {
      try {
        return DateUtils_.normalizeDate(value, display);
      } catch (_) {}
    }

    if (display) return display;

    if (value instanceof Date && !isNaN(value.getTime())) {
      try {
        return Utilities.formatDate(value, getTimeZone_(), 'dd.MM.yyyy');
      } catch (_) {
        return Utilities.formatDate(value, Session.getScriptTimeZone(), 'dd.MM.yyyy');
      }
    }

    return clean_(value);
  }

  function getDictItem_(dict, code) {
    dict = dict || {};
    code = clean_(code);
    if (!code) return {};

    return dict[code] ||
      dict[code.toLowerCase()] ||
      dict[code.replace(/\s+/g, '')] ||
      dict[code.toLowerCase().replace(/\s+/g, '')] ||
      {};
  }

  if (isSheetCall) {
    sheet = options;
    row = Number(rowArg);
    col = Number(colArg);

    var fmlCol = Number(cfg_('FML_COL', cfg_('FIO_COL', 7))) || 7;
    var callsignCol = Number(cfg_('CALLSIGN_COL', 2)) || 2;
    var brCol = Number(cfg_('BR_COL', 6)) || 6;
    var dateRow = Number(cfg_('DATE_ROW', 1)) || 1;

    var fmlFromSheet = clean_(sheet.getRange(row, fmlCol).getDisplayValue());
    var callsignFromSheet = '';
    var codeFromSheet = clean_(sheet.getRange(row, col).getDisplayValue());
    var brRaw = '';
    var brDays = 0;

    try {
      callsignFromSheet = clean_(sheet.getRange(row, callsignCol).getDisplayValue());
    } catch (_) {}

    try {
      brRaw = clean_(sheet.getRange(row, brCol).getDisplayValue());
      brDays = brRaw ? (Number(String(brRaw).replace(',', '.')) || 0) : 0;
    } catch (_) {}

    var dateStr = normalizeDateCompat_(sheet.getRange(dateRow, col));

    input = {
      sheet: sheet,
      sheetName: sheet.getName(),
      row: row,
      col: col,
      cell: a1FromRowColCompat_(row, col),
      fml: fmlFromSheet,
      name: fmlFromSheet,
      callsign: callsignFromSheet,
      code: codeFromSheet,
      status: codeFromSheet,
      date: dateStr,
      dateStr: dateStr,
      brDays: brDays,
      phonesMap: phonesMapArg || null,
      dictMap: dictMapArg || null
    };
  } else {
    input = options || {};
    sheet = input.sheet || null;
    row = Number(input.row || 0);
    col = Number(input.col || 0);
  }

  var code = clean_(input.code || input.status || '');
  var dict = input.dictMap || dictMapArg || loadDictMap_();
  var dictItem = getDictItem_(dict, code);

  var fml = clean_(input.fml || input.fio || input.fullName || input.name || '');
  var callsign = clean_(input.callsign || input.callSign || input.nick || '');
  var role = clean_(input.role || '');

  var phone = '';
  if (input.phone) {
    phone = normalizePhoneCompat_(input.phone);
  } else {
    var findOptions = {};
    var phonesSource = input.phonesMap || phonesMapArg || null;
    if (phonesSource) findOptions.index = phonesSource;

    phone = findPhone_({
      fml: fml,
      fio: fml,
      fullName: fml,
      name: fml,
      callsign: callsign,
      role: role
    }, findOptions);

    phone = normalizePhoneCompat_(phone);
  }

  var date = clean_(input.date || input.dateStr || '');
  if (!date && typeof _todayStr_ === 'function') {
    try { date = _todayStr_(); } catch (_) {}
  }

  var service = clean_(input.service || dictItem.service || dictItem.label || code);
  var label = clean_(input.label || dictItem.label || service || code);
  var place = clean_(input.place || dictItem.place || '');
  var tasks = clean_(
    input.tasks ||
    input.task ||
    dictItem.tasks ||
    dictItem.task ||
    dictItem.message ||
    service ||
    label ||
    code
  );

  var brDaysOut = input.brDays === undefined || input.brDays === null ? 0 : input.brDays;

  var message = '';
  if (typeof buildMessage_ === 'function') {
    try {
      message = buildMessage_({
        date: date,
        reportDate: date,
        fml: fml,
        phone: phone,
        code: code,
        service: service,
        label: label,
        place: place,
        tasks: tasks,
        brDays: brDaysOut,
        status: code
      });
    } catch (_) {
      message = '';
    }
  }

  if (!message) {
    message = [
      date ? 'Дата: ' + date : '',
      fml ? 'ПІБ: ' + fml : '',
      code ? 'Код: ' + code : '',
      service ? 'Статус: ' + service : '',
      place ? 'Місце: ' + place : '',
      tasks ? 'Завдання: ' + tasks : ''
    ].filter(Boolean).join('\n');
  }

  var safeMessage = message;
  if (typeof trimToEncoded_ === 'function') {
    try {
      safeMessage = trimToEncoded_(message, cfg_('MAX_WA_TEXT', 3800));
    } catch (_) {}
  }

  var link = '';
  if (phone) {
    link = 'https://wa.me/' + String(phone).replace(/[^\d]/g, '') + '?text=' + encodeURIComponent(safeMessage);
  }

  return {
    timestamp: new Date(),
    sheet: input.sheetName || (sheet && typeof sheet.getName === 'function' ? sheet.getName() : ''),
    cell: input.cell || (row && col ? a1FromRowColCompat_(row, col) : ''),
    row: row || input.row || '',
    col: col || input.col || '',
    fml: fml,
    callsign: callsign,
    phone: phone,
    code: code,
    service: service,
    label: label,
    place: place,
    tasks: tasks,
    brDays: brDaysOut,
    message: message,
    date: date,
    reportDateStr: date,
    link: link
  };
}



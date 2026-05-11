/** 41_Raports_Data.gs — читання/ініціалізація листів модуля Raports. */
(function(root) {
  'use strict';

  var NS = root.RaportsModule_ || (root.RaportsModule_ = {});

  function getSpreadsheet_() {
    if (typeof getWasbSpreadsheet_ === 'function') return getWasbSpreadsheet_();
    return SpreadsheetApp.getActiveSpreadsheet();
  }

  function tz_() {
    try { return Session.getScriptTimeZone() || NS.FALLBACK_TZ || 'Europe/Kyiv'; }
    catch (_) { return NS.FALLBACK_TZ || 'Europe/Kyiv'; }
  }

  function str_(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  function bool_(value) {
    if (value === true) return true;
    var s = str_(value).toLowerCase();
    return s === '1' || s === 'true' || s === 'yes' || s === 'так' || s === 'y';
  }

  function normalizePhone_(value) {
    var s = str_(value).replace(/[^0-9+]/g, '');
    if (s && s.charAt(0) !== '+' && s.indexOf('380') === 0) s = '+' + s;
    return s;
  }

  function parseDate_(value) {
    if (value instanceof Date) return value;
    var s = str_(value);
    if (!s) return null;

    var m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));

    m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));

    var n = Number(s);
    if (isFinite(n) && n > 20000 && n < 80000) {
      return new Date(Math.round((n - 25569) * 86400 * 1000));
    }

    var d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  function fmtDate_(value) {
    var d = parseDate_(value);
    if (!d) return str_(value);
    return Utilities.formatDate(d, tz_(), NS.DATE_FORMAT || 'dd.MM.yyyy');
  }

  function getOrCreateSheet_(name) {
    var ss = getSpreadsheet_();
    return ss.getSheetByName(name) || ss.insertSheet(name);
  }

  function readTable_(sheetName) {
    var ss = getSpreadsheet_();
    var sh = ss.getSheetByName(sheetName);
    if (!sh) return { headers: [], rows: [], byKey: {} };

    var lastRow = sh.getLastRow();
    var lastCol = sh.getLastColumn();
    if (lastRow < 1 || lastCol < 1) return { headers: [], rows: [], byKey: {} };

    var values = sh.getRange(1, 1, lastRow, lastCol).getValues();
    var headers = values.shift().map(function(h) { return str_(h); });
    var rows = [];
    var byKey = {};

    values.forEach(function(row) {
      var obj = {};
      var has = false;
      headers.forEach(function(h, i) {
        if (!h) return;
        obj[h] = row[i];
        if (str_(row[i])) has = true;
      });
      if (!has) return;
      rows.push(obj);
      var key = str_(obj.KEY || obj.key || obj.ID || obj.VAC_ID || obj.SIGN_ID || obj.TPL_KEY);
      if (key) byKey[key] = obj;
    });

    return { headers: headers, rows: rows, byKey: byKey };
  }

  function getSettings_() {
    var table = readTable_(NS.SHEETS.SETTINGS);
    var result = {};
    table.rows.forEach(function(row) {
      var key = str_(row.KEY);
      if (key) result[key] = row.VALUE;
    });
    return result;
  }

  function getTemplate_(key) {
    key = str_(key || getSettings_().MAIN_TEMPLATE_KEY || NS.DEFAULT_TEMPLATE_KEY);
    var row = readTable_(NS.SHEETS.TEMPLATES).byKey[key];
    if (!row || !bool_(row.ACTIVE)) throw new Error('Шаблон не знайдено або вимкнено: ' + key);
    if (!str_(row.DOC_ID)) throw new Error('У RAPORTS_TEMPLATES не заповнений DOC_ID для шаблону: ' + key);
    return row;
  }

  function getPerson_(personId) {
    var row = readTable_(NS.SHEETS.PERSONS).byKey[str_(personId)];
    if (!row) throw new Error('Не знайдено PERSON_ID: ' + personId);
    if (!bool_(row.ACTIVE)) throw new Error('PERSON_ID неактивний/вакансія: ' + personId);
    return row;
  }

  function getVacation_(vacId) {
    var row = readTable_(NS.SHEETS.VACATIONS).byKey[str_(vacId)];
    if (!row) throw new Error('Не знайдено VAC_ID: ' + vacId);
    if (!bool_(row.ACTIVE)) throw new Error('VAC_ID неактивний: ' + vacId);
    return row;
  }

  function getActiveVacations_() {
    return readTable_(NS.SHEETS.VACATIONS).rows.filter(function(row) { return bool_(row.ACTIVE); });
  }

  function getDictRow_(sheetName, key, label) {
    key = str_(key);
    if (!key) return null;
    var row = readTable_(sheetName).byKey[key];
    if (!row) throw new Error('Не знайдено ключ ' + key + ' у ' + label);
    return row;
  }

  function getSign_(person, explicitSignKey) {
    var table = readTable_(NS.SHEETS.SIGNS);
    var key = str_(explicitSignKey || person.SIGN_KEY);
    var found = key ? table.byKey[key] : null;
    if (!found) {
      table.rows.some(function(row) {
        if (str_(row.PERSON_ID) === str_(person.ID) && bool_(row.ACTIVE)) {
          found = row;
          return true;
        }
        return false;
      });
    }
    return found || null;
  }

  function appendLog_(action, status, payload) {
    payload = payload || {};
    var sh = getOrCreateSheet_(NS.SHEETS.LOG);
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, 8).setValues([['TS', 'ACTION', 'STATUS', 'PERSON_ID', 'VAC_ID', 'DOC_ID', 'DOC_URL', 'MESSAGE']]);
    }
    sh.appendRow([
      new Date(), action || '', status || '', payload.personId || '', payload.vacId || '',
      payload.docId || '', payload.docUrl || '', payload.message || ''
    ]);
  }

  function styleSheet_(sh) {
    var lastCol = Math.max(sh.getLastColumn(), 1);
    if (sh.getLastRow() >= 1) {
      sh.getRange(1, 1, 1, lastCol).setFontWeight('bold').setBackground('#1f2937').setFontColor('#ffffff');
      sh.setFrozenRows(1);
    }
    sh.autoResizeColumns(1, Math.min(lastCol, 12));
  }

  function bootstrapSheets_(forceRewrite) {
    var ss = getSpreadsheet_();
    var created = [];
    Object.keys(NS.SEED_DATA || {}).forEach(function(sourceName) {
      var targetName = NS.SOURCE_TO_TARGET_SHEET[sourceName];
      if (!targetName) return;
      var sh = ss.getSheetByName(targetName);
      var rows = NS.SEED_DATA[sourceName] || [];
      if (!sh) {
        sh = ss.insertSheet(targetName);
        created.push(targetName);
      }
      if (forceRewrite || sh.getLastRow() === 0) {
        sh.clear();
        if (rows.length) {
          var width = rows.reduce(function(max, row) { return Math.max(max, row.length); }, 1);
          var normalized = rows.map(function(row) {
            var copy = row.slice();
            while (copy.length < width) copy.push('');
            return copy;
          });
          sh.getRange(1, 1, normalized.length, width).setValues(normalized);
        }
        styleSheet_(sh);
      }
    });
    return { ok: true, created: created, forceRewrite: !!forceRewrite };
  }

  NS.Data = {
    getSpreadsheet: getSpreadsheet_,
    getOrCreateSheet: getOrCreateSheet_,
    readTable: readTable_,
    getSettings: getSettings_,
    getTemplate: getTemplate_,
    getPerson: getPerson_,
    getVacation: getVacation_,
    getActiveVacations: getActiveVacations_,
    getDictRow: getDictRow_,
    getSign: getSign_,
    appendLog: appendLog_,
    bootstrapSheets: bootstrapSheets_,
    str: str_,
    bool: bool_,
    normalizePhone: normalizePhone_,
    parseDate: parseDate_,
    fmtDate: fmtDate_,
    tz: tz_
  };
})(this);

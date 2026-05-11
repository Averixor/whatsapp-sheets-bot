/**
 * 45_Raports_UI.gs — серверні API для форми рапортів у сайдбарі.
 *
 * Це адаптер між HTML-панеллю WASB і стабільним ядром RaportsModule_.
 * Ядро працює з листами RAPORTS_* та seed-даними з RAPORTS APP.xlsx.
 */

function raportsMakeOkResponse_(data, message, context) {
  if (typeof okResponse_ === 'function') return okResponse_(data, message || 'OK', context || {});
  return { success: true, ok: true, data: data, message: message || 'OK', context: context || {} };
}

function raportsMakeErrorResponse_(error, message, context) {
  if (typeof errorResponse_ === 'function') return errorResponse_(error, message || 'Помилка RaportsModule', context || {});
  return {
    success: false,
    ok: false,
    error: error && error.message ? error.message : String(error),
    message: message || 'Помилка RaportsModule',
    context: context || {}
  };
}

function raportsHealthCheck_() {
  var NS = RaportsModule_;
  var D = NS.Data;
  var ss = D.getSpreadsheet();
  var expected = Object.keys(NS.SHEETS).map(function(key) { return NS.SHEETS[key]; });
  var missing = expected.filter(function(name) { return !ss.getSheetByName(name); });
  var settings = {};
  var templateOk = false;
  var personsCount = 0;
  var activePersonsCount = 0;
  var vacationsCount = 0;
  var activeVacationsCount = 0;

  if (!missing.length) {
    settings = D.getSettings();
    var persons = D.readTable(NS.SHEETS.PERSONS).rows;
    var vacations = D.readTable(NS.SHEETS.VACATIONS).rows;
    personsCount = persons.length;
    activePersonsCount = persons.filter(function(row) { return D.bool(row.ACTIVE); }).length;
    vacationsCount = vacations.length;
    activeVacationsCount = vacations.filter(function(row) { return D.bool(row.ACTIVE); }).length;
    try {
      D.getTemplate(settings.MAIN_TEMPLATE_KEY || NS.DEFAULT_TEMPLATE_KEY);
      templateOk = true;
    } catch (_) {
      templateOk = false;
    }
  }

  return {
    ok: missing.length === 0,
    version: NS.VERSION || 'raports',
    expectedSheets: expected,
    missing: missing,
    settingsReady: !!(settings && Object.keys(settings).length),
    templateOk: templateOk,
    personsCount: personsCount,
    activePersonsCount: activePersonsCount,
    vacationsCount: vacationsCount,
    activeVacationsCount: activeVacationsCount
  };
}

function raportsListActivePersons_() {
  var NS = RaportsModule_;
  var D = NS.Data;
  D.bootstrapSheets(false);
  return D.readTable(NS.SHEETS.PERSONS).rows
    .filter(function(row) { return D.bool(row.ACTIVE); })
    .map(function(row) {
      return {
        id: D.str(row.ID),
        personId: D.str(row.ID),
        fioView: D.str(row.FIO_VIEW) || D.str(row.ID),
        phone: D.normalizePhone(row.PHONE),
        rankKey: D.str(row.RANK_KEY),
        posKey: D.str(row.POS_KEY),
        oshKey: D.str(row.OSH_KEY)
      };
    })
    .filter(function(row) { return !!row.id; });
}

function raportsUpsertVacationForSidebar_(payload) {
  payload = payload || {};
  var NS = RaportsModule_;
  var D = NS.Data;
  D.bootstrapSheets(false);

  var personId = D.str(payload.personId || payload.PERSON_ID);
  var ds = D.parseDate(payload.dateStart || payload.DS || payload.ds);
  var de = D.parseDate(payload.dateEnd || payload.DE || payload.de);
  var adr = D.str(payload.address || payload.ADR || payload.adr);
  var vacNum = D.str(payload.vacNum || payload.VAC_NUM || payload.num || 'чергова відпустка');

  if (!personId) throw new Error('Не вибрано військовослужбовця');
  D.getPerson(personId); // валідація існування/ACTIVE
  if (!ds || !de) throw new Error('Некоректні дати відпустки');
  if (de.getTime() < ds.getTime()) throw new Error('Дата завершення раніше дати початку');

  var days = Math.round((de.getTime() - ds.getTime()) / 86400000) + 1;
  var vacId = D.str(payload.vacId || payload.VAC_ID);
  if (!vacId) {
    vacId = 'ui_' + Utilities.formatDate(new Date(), D.tz(), 'yyyyMMdd_HHmmss') + '_' + personId;
  }

  var sh = D.getOrCreateSheet(NS.SHEETS.VACATIONS);
  var header = ['VAC_ID', 'PERSON_ID', 'DS', 'DE', 'VD', 'VAC_NUM', 'ADR', 'ACTIVE', 'NOTE'];
  if (sh.getLastRow() < 1) {
    sh.getRange(1, 1, 1, header.length).setValues([header]);
    sh.getRange(1, 1, 1, header.length).setFontWeight('bold').setBackground('#1f2937').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }

  var values = sh.getLastRow() >= 2 ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getDisplayValues() : [];
  var rowIndex = 0;
  for (var i = 0; i < values.length; i++) {
    if (D.str(values[i][0]) === vacId) {
      rowIndex = i + 2;
      break;
    }
  }
  if (!rowIndex) rowIndex = sh.getLastRow() + 1;

  sh.getRange(rowIndex, 1, 1, header.length).setValues([[
    vacId,
    personId,
    D.fmtDate(ds),
    D.fmtDate(de),
    days,
    vacNum,
    adr,
    1,
    'created from WASB sidebar'
  ]]);
  sh.autoResizeColumns(1, header.length);

  return { vacId: vacId, days: days };
}

function apiGetRaportsFormData() {
  var started = Date.now();
  try {
    var persons = raportsListActivePersons_();
    var health = raportsHealthCheck_();
    return raportsMakeOkResponse_({
      persons: persons,
      health: health,
      raportTypes: [{ id: 'vacation', name: 'Рапорт на відпустку' }]
    }, health.ok ? 'OK' : 'Модуль рапортів потребує налаштування листів', {
      function: 'apiGetRaportsFormData',
      durationMs: Date.now() - started
    });
  } catch (e) {
    return raportsMakeErrorResponse_(e, '✕ Не вдалося завантажити дані форми рапортів', {
      function: 'apiGetRaportsFormData',
      durationMs: Date.now() - started
    });
  }
}

function apiRaportsHealthCheck() {
  var started = Date.now();
  try {
    var health = raportsHealthCheck_();
    return raportsMakeOkResponse_(health, health.ok ? '✓ RaportsModule готовий' : '⚠ Не всі листи RaportsModule знайдено', {
      function: 'apiRaportsHealthCheck',
      durationMs: Date.now() - started
    });
  } catch (e) {
    return raportsMakeErrorResponse_(e, '✕ RaportsModule: помилка діагностики', {
      function: 'apiRaportsHealthCheck',
      durationMs: Date.now() - started
    });
  }
}

function showRaportsHealthCheck() {
  var res = apiRaportsHealthCheck();
  SpreadsheetApp.getUi().alert('RaportsModule', JSON.stringify(res, null, 2), SpreadsheetApp.getUi().ButtonSet.OK);
}

function apiCreateVacationRaport(payload) {
  var started = Date.now();
  try {
    var NS = RaportsModule_;
    var D = NS.Data;
    payload = payload || {};
    var saved = raportsUpsertVacationForSidebar_(payload);
    var result = NS.Generator.generateVacationReport(saved.vacId, {
      templateKey: payload.templateKey || NS.DEFAULT_TEMPLATE_KEY,
      exportPdf: payload.exportPdf !== false
    });
    var person = D.getPerson(result.personId);
    var response = {
      success: true,
      ok: true,
      vacId: result.vacId,
      personId: result.personId,
      personName: D.str(person.FIO_VIEW) || result.personId,
      docId: result.docId,
      docUrl: result.docUrl,
      pdf: result.pdf,
      days: saved.days,
      signInserted: !!result.signInserted
    };
    return raportsMakeOkResponse_(response, '✓ Рапорт створено', {
      function: 'apiCreateVacationRaport',
      durationMs: Date.now() - started
    });
  } catch (e) {
    try {
      RaportsModule_.Data.appendLog('apiCreateVacationRaport', 'ERROR', {
        personId: payload && payload.personId ? payload.personId : '',
        message: e && e.message ? e.message : String(e)
      });
    } catch (_) {}
    return raportsMakeErrorResponse_(e, '✕ Не вдалося створити рапорт', {
      function: 'apiCreateVacationRaport',
      durationMs: Date.now() - started
    });
  }
}

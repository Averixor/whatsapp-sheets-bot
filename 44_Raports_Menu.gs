/** 44_Raports_Menu.gs — меню та публічні команди модуля Raports. */
function raportsBootstrapSheets() {
  return RaportsModule_.Data.bootstrapSheets(false);
}

function raportsRebuildSheetsFromSeed() {
  return RaportsModule_.Data.bootstrapSheets(true);
}

function raportsShowSetupAlert() {
  var ui = SpreadsheetApp.getUi();
  ui.alert(
    'Рапорти: що заповнити',
    [
      '1) Запустіть “Створити/оновити листи Raports”.',
      '2) У RAPORTS_SETTINGS заповніть DOC_OUTPUT_FOLDER_ID, PDF_OUTPUT_FOLDER_ID, SIGNS_FOLDER_ID.',
      '3) У RAPORTS_TEMPLATES заповніть DOC_ID для vac_main.',
      '4) У RAPORTS_SIGNS заповніть FILE_ID для підписів.',
      '5) У RAPORTS_VACATIONS додайте активний рядок відпустки.',
      '',
      'Після цього запускайте raportsGenerateVacationReport("vac_0001").'
    ].join('\n'),
    ui.ButtonSet.OK
  );
}

function raportsOnOpen() {
  try {
    var ui = SpreadsheetApp.getUi();
    ui.createMenu('Рапорти')
      .addItem('Створити/оновити листи Raports', 'raportsBootstrapSheets')
      .addItem('Перестворити листи з RAPORTS APP seed', 'raportsRebuildSheetsFromSeed')
      .addItem('Імпортувати відпустки з WASB VACATIONS', 'raportsImportVacationsFromWasb')
      .addItem('Створити базовий Google Docs шаблон', 'raportsCreateDefaultVacationTemplate')
      .addItem('Перевірити модуль рапортів', 'showRaportsHealthCheck')
      .addSeparator()
      .addItem('Створити рапорт по першій активній відпустці', 'raportsGenerateFirstActiveVacationReport')
      .addSeparator()
      .addItem('Показати інструкцію налаштування', 'raportsShowSetupAlert')
      .addToUi();
  } catch (e) {
    console.error('raportsOnOpen error:', e);
  }
}

function raportsDebugPreviewFields(vacId) {
  return RaportsModule_.Builder.buildFields(vacId || 'vac_0001', {}).fields;
}

function raportsImportVacationsFromWasb() {
  var NS = RaportsModule_;
  var D = NS.Data;
  var ss = D.getSpreadsheet();
  var source = ss.getSheetByName('VACATIONS');
  if (!source) throw new Error('Лист VACATIONS не знайдено');

  // Гарантуємо наявність цільових листів.
  D.bootstrapSheets(false);

  var persons = D.readTable(NS.SHEETS.PERSONS).rows;
  var byFio = {};
  persons.forEach(function(p) {
    var fio = D.str(p.FIO_VIEW).toLowerCase();
    if (fio) byFio[fio] = p;
  });

  var lastRow = source.getLastRow();
  if (lastRow < 2) return { ok: true, imported: 0, skipped: 0 };

  var values = source.getRange(2, 1, lastRow - 1, 8).getValues();
  var rows = [];
  var skipped = [];

  values.forEach(function(row, i) {
    var fio = D.str(row[0]);
    if (!fio) return;
    var person = byFio[fio.toLowerCase()];
    if (!person) {
      skipped.push({ row: i + 2, fio: fio, reason: 'PERSON not found by FIO_VIEW' });
      return;
    }

    var ds = D.parseDate(row[1]);
    var de = D.parseDate(row[2]);
    var active = D.bool(row[4]);
    if (!ds || !de) {
      skipped.push({ row: i + 2, fio: fio, reason: 'bad dates' });
      return;
    }

    var days = Math.round((de.getTime() - ds.getTime()) / 86400000) + 1;
    var vacId = 'vac_' + Utilities.formatDate(ds, D.tz(), 'yyyyMMdd') + '_' + D.str(person.ID);
    rows.push([
      vacId,
      D.str(person.ID),
      D.fmtDate(ds),
      D.fmtDate(de),
      days,
      D.str(row[3]),
      D.str(row[7]),
      active ? 1 : 0,
      'imported from WASB VACATIONS row ' + (i + 2)
    ]);
  });

  var target = ss.getSheetByName(NS.SHEETS.VACATIONS);
  target.clear();
  target.getRange(1, 1, 1, 9).setValues([['VAC_ID', 'PERSON_ID', 'DS', 'DE', 'VD', 'VAC_NUM', 'ADR', 'ACTIVE', 'NOTE']]);
  if (rows.length) target.getRange(2, 1, rows.length, 9).setValues(rows);
  target.getRange(1, 1, 1, 9).setFontWeight('bold').setBackground('#1f2937').setFontColor('#ffffff');
  target.setFrozenRows(1);
  target.autoResizeColumns(1, 9);

  return { ok: true, imported: rows.length, skipped: skipped.length, skippedRows: skipped.slice(0, 20) };
}

function raportsCreateDefaultVacationTemplate() {
  var NS = RaportsModule_;
  var D = NS.Data;
  D.bootstrapSheets(false);
  var settings = D.getSettings();
  var doc = DocumentApp.create('TPL_RAPORT_VAC_MAIN');
  var body = doc.getBody();
  body.clear();
  body.appendParagraph('Командиру {{osh_g}}').setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
  body.appendParagraph('від {{r_g}} {{fp_g}}').setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
  body.appendParagraph('{{fio_g}}').setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
  body.appendParagraph('');
  body.appendParagraph('РАПОРТ').setAlignment(DocumentApp.HorizontalAlignment.CENTER).setBold(true);
  body.appendParagraph('');
  body.appendParagraph('Прошу надати мені щорічну основну відпустку з {{ds}} по {{de}} строком на {{vd}} календарних діб.');
  body.appendParagraph('Місце проведення відпустки: {{adr}}.');
  body.appendParagraph('Контактний телефон: {{tel}}.');
  body.appendParagraph('');
  body.appendParagraph('{{dd}}');
  body.appendParagraph('');
  body.appendParagraph('{{p1}}');
  body.appendParagraph('{{p2}}');
  body.appendParagraph('{{p3}}');
  body.appendParagraph('{{r_n}} {{fio_s}}').setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
  body.appendParagraph('{{sign_me}}').setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
  doc.saveAndClose();

  var docFile = DriveApp.getFileById(doc.getId());
  var folderId = D.str(settings.DOC_OUTPUT_FOLDER_ID);
  if (folderId) {
    try { DriveApp.getFolderById(folderId).addFile(docFile); } catch (_) {}
  }

  var sh = D.getOrCreateSheet(NS.SHEETS.TEMPLATES);
  sh.clear();
  sh.getRange(1, 1, 2, 5).setValues([
    ['TPL_KEY', 'TPL_NAME', 'DOC_ID', 'ACTIVE', 'NOTE'],
    ['vac_main', 'TPL_RAPORT_VAC_MAIN', doc.getId(), 1, 'default template generated by WASB Raports module']
  ]);
  sh.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#1f2937').setFontColor('#ffffff');
  sh.autoResizeColumns(1, 5);

  return { ok: true, docId: doc.getId(), docUrl: doc.getUrl() };
}

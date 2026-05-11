/** 43_Raports_Generator.gs — генерація Google Docs/PDF рапортів. */
(function(root) {
  'use strict';

  var NS = root.RaportsModule_ || (root.RaportsModule_ = {});
  var D = NS.Data;

  function escapeRegExp_(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function getFolderBySetting_(settings, key) {
    var id = D.str(settings[key]);
    if (!id) return null;
    try { return DriveApp.getFolderById(id); }
    catch (e) { throw new Error('Не відкривається папка ' + key + ': ' + e.message); }
  }

  function copyTemplate_(templateDocId, outputName, outputFolder) {
    var file = DriveApp.getFileById(templateDocId);
    if (outputFolder) return file.makeCopy(outputName, outputFolder);
    return file.makeCopy(outputName);
  }

  function replaceFields_(doc, fields) {
    var body = doc.getBody();
    Object.keys(fields).forEach(function(key) {
      var marker = '{{' + key + '}}';
      body.replaceText(escapeRegExp_(marker), String(fields[key] === null || fields[key] === undefined ? '' : fields[key]));
    });
  }

  function removeUnresolvedKnownPlaceholders_(doc) {
    var body = doc.getBody();
    (NS.PLACEHOLDERS || []).forEach(function(key) {
      body.replaceText(escapeRegExp_('{{' + key + '}}'), '');
    });
  }

  function setDocumentFormat_(doc, settings) {
    var body = doc.getBody();
    var font = D.str(settings.DOC_FONT) || 'Times New Roman';
    var fontSize = Number(settings.DOC_FONT_SIZE || 12) || 12;

    body.editAsText().setFontFamily(font).setFontSize(fontSize);

    var attrs = {};
    attrs[DocumentApp.Attribute.FONT_FAMILY] = font;
    attrs[DocumentApp.Attribute.FONT_SIZE] = fontSize;
    body.setAttributes(attrs);
  }

  function insertInlineImageAtMarker_(doc, marker, fileId, width, height) {
    if (!fileId) return false;
    var body = doc.getBody();
    var found = body.findText(escapeRegExp_(marker));
    if (!found) return false;

    var text = found.getElement().asText();
    var start = found.getStartOffset();
    var end = found.getEndOffsetInclusive();
    text.deleteText(start, end);

    var parent = text.getParent();
    var blob = DriveApp.getFileById(fileId).getBlob();
    var image;

    if (parent.getType && parent.getType() === DocumentApp.ElementType.PARAGRAPH) {
      image = parent.asParagraph().appendInlineImage(blob);
    } else {
      image = body.appendImage(blob);
    }

    width = Number(width || 0);
    height = Number(height || 0);
    if (width > 0) image.setWidth(width);
    if (height > 0) image.setHeight(height);
    return true;
  }

  function insertSigns_(doc, ctx) {
    var sign = ctx.sign;
    if (!sign || !D.bool(sign.ACTIVE)) return { inserted: false, reason: 'no-active-sign' };
    var fileId = D.str(sign.FILE_ID);
    if (!fileId) return { inserted: false, reason: 'empty-file-id' };
    var ok = insertInlineImageAtMarker_(doc, '{{sign_me}}', fileId, sign.WIDTH, sign.HEIGHT);
    return { inserted: ok, fileId: fileId };
  }

  function exportPdf_(docFile, outputFolder) {
    if (!outputFolder) return null;
    var blob = docFile.getBlob().getAs(MimeType.PDF);
    var pdfName = docFile.getName() + '.pdf';
    var pdf = outputFolder.createFile(blob).setName(pdfName);
    return { id: pdf.getId(), url: pdf.getUrl(), name: pdfName };
  }

  function makeOutputName_(ctx) {
    var f = ctx.fields;
    var safeFio = D.str(f.fio_n).replace(/[\\/:*?"<>|#%{}~&]/g, ' ').replace(/\s+/g, ' ').trim();
    return [NS.DEFAULT_OUTPUT_NAME_PREFIX, f.ds, safeFio].filter(Boolean).join(' — ');
  }

  function generateVacationReport_(vacId, options) {
    options = options || {};
    var settings = D.getSettings();
    var template = D.getTemplate(options.templateKey || settings.MAIN_TEMPLATE_KEY || NS.DEFAULT_TEMPLATE_KEY);
    var ctx = NS.Builder.buildFields(vacId, options);
    var outputFolder = getFolderBySetting_(settings, 'DOC_OUTPUT_FOLDER_ID');
    var pdfFolder = getFolderBySetting_(settings, 'PDF_OUTPUT_FOLDER_ID');
    var outputName = D.str(options.outputName) || makeOutputName_(ctx);

    var copied = copyTemplate_(D.str(template.DOC_ID), outputName, outputFolder);
    var doc = DocumentApp.openById(copied.getId());

    replaceFields_(doc, ctx.fields);
    var signResult = insertSigns_(doc, ctx);
    removeUnresolvedKnownPlaceholders_(doc);
    setDocumentFormat_(doc, settings);
    doc.saveAndClose();

    var pdf = options.exportPdf === false ? null : exportPdf_(copied, pdfFolder);
    var result = {
      ok: true,
      action: 'generateVacationReport',
      vacId: D.str(vacId),
      personId: D.str(ctx.person.ID),
      docId: copied.getId(),
      docUrl: copied.getUrl(),
      pdf: pdf,
      sign: signResult,
      signInserted: !!(signResult && signResult.inserted),
      fields: ctx.fields
    };

    D.appendLog('generateVacationReport', 'OK', {
      personId: result.personId,
      vacId: result.vacId,
      docId: result.docId,
      docUrl: result.docUrl,
      message: pdf && pdf.url ? 'PDF: ' + pdf.url : 'DOC created'
    });

    return result;
  }

  function generateFirstActiveVacationReport_() {
    var active = D.getActiveVacations();
    if (!active.length) throw new Error('У RAPORTS_VACATIONS немає активних відпусток');
    return generateVacationReport_(active[0].VAC_ID, {});
  }

  NS.Generator = {
    generateVacationReport: generateVacationReport_,
    generateFirstActiveVacationReport: generateFirstActiveVacationReport_
  };
})(this);

function raportsGenerateVacationReport(vacId, options) {
  return RaportsModule_.Generator.generateVacationReport(vacId, options || {});
}

function raportsGenerateFirstActiveVacationReport() {
  return RaportsModule_.Generator.generateFirstActiveVacationReport();
}

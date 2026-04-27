/**
 * OrderReport.gs — safe spreadsheet report module for WASB.
 *
 * This module is intentionally isolated from the main WASB roster sheets:
 * - it never clears the active sheet;
 * - it works only with the dedicated REPORT_ORDERS sheet;
 * - UI entrypoints and trigger entrypoints are separated;
 * - all table values are escaped before being injected into HTML email.
 */

const WASB_ORDER_REPORT_CONFIG_ = Object.freeze({
  sheetName: 'REPORT_ORDERS',
  triggerHandler: 'wasbSendOrderReportFromTrigger',
  dailyTriggerHour: 9,
  headers: Object.freeze(['Дата', 'Клієнт', 'Сума', 'Статус', 'Email для звіту'])
});

function wasbSetupOrderReportSheet() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = wasbGetOrCreateOrderReportSheet_(ss);
    const userEmail = wasbGetReportUserEmail_();
    const now = new Date();

    sheet.clear({ contentsOnly: true });
    sheet.clearFormats();

    const exampleData = [
      [now, 'Іван Іванов', 1500, 'Завершено', userEmail],
      [now, 'Марія Петренко', 2300, 'В процесі', userEmail]
    ];

    sheet.getRange(1, 1, 1, WASB_ORDER_REPORT_CONFIG_.headers.length)
      .setValues([WASB_ORDER_REPORT_CONFIG_.headers])
      .setFontWeight('bold')
      .setBackground('#f3f3f3');

    sheet.getRange(2, 1, exampleData.length, WASB_ORDER_REPORT_CONFIG_.headers.length)
      .setValues(exampleData);

    sheet.setFrozenRows(1);
    sheet.setColumnWidths(1, WASB_ORDER_REPORT_CONFIG_.headers.length, 150);
    sheet.getRange('A:A').setNumberFormat('dd.MM.yyyy');
    sheet.getRange('C:C').setNumberFormat('#,##0.00');

    SpreadsheetApp.getUi().alert(
      'Лист звіту налаштовано',
      'Створено/оновлено лист "' + WASB_ORDER_REPORT_CONFIG_.sheetName + '". Інші листи не очищались.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );

    return { success: true, sheetName: WASB_ORDER_REPORT_CONFIG_.sheetName };
  } catch (e) {
    wasbShowOrderReportError_('Помилка налаштування листа звіту', e);
    return { success: false, error: wasbErrorToString_(e) };
  }
}

function wasbSendOrderReportFromUi() {
  const result = wasbSendOrderReport_({ showUi: true, source: 'ui' });
  if (result && result.success) {
    SpreadsheetApp.getUi().alert(
      'Звіт надіслано',
      'Звіт надіслано на адресу: ' + result.to,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
  return result;
}

function wasbSendOrderReportFromTrigger() {
  return wasbSendOrderReport_({ showUi: false, source: 'trigger' });
}

function wasbCreateOrderReportTimeTrigger() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    let removed = 0;

    triggers.forEach(function(trigger) {
      if (trigger.getHandlerFunction() === WASB_ORDER_REPORT_CONFIG_.triggerHandler) {
        ScriptApp.deleteTrigger(trigger);
        removed++;
      }
    });

    ScriptApp.newTrigger(WASB_ORDER_REPORT_CONFIG_.triggerHandler)
      .timeBased()
      .everyDays(1)
      .atHour(WASB_ORDER_REPORT_CONFIG_.dailyTriggerHour)
      .create();

    SpreadsheetApp.getUi().alert(
      'Тригер створено',
      'Щоденний тригер звіту створено на ' + WASB_ORDER_REPORT_CONFIG_.dailyTriggerHour + ':00. Видалено старих тригерів: ' + removed,
      SpreadsheetApp.getUi().ButtonSet.OK
    );

    return { success: true, removed: removed, hour: WASB_ORDER_REPORT_CONFIG_.dailyTriggerHour };
  } catch (e) {
    wasbShowOrderReportError_('Помилка створення тригера звіту', e);
    return { success: false, error: wasbErrorToString_(e) };
  }
}

function wasbShowOrderReportAbout() {
  const userEmail = wasbGetReportUserEmail_();
  SpreadsheetApp.getUi().alert(
    'Звітний модуль WASB',
    'Модуль формує HTML-звіт із листа "' + WASB_ORDER_REPORT_CONFIG_.sheetName + '" і надсилає його на email поточного користувача.\n\n' +
      'Користувач: ' + (userEmail || 'email не визначено') + '\n' +
      'Тригер: ' + WASB_ORDER_REPORT_CONFIG_.triggerHandler + ', щодня о ' + WASB_ORDER_REPORT_CONFIG_.dailyTriggerHour + ':00\n\n' +
      'Модуль не очищає активний лист і не змінює бойові листи WASB.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function wasbSendOrderReport_(options) {
  const opts = options || {};
  const showUi = opts.showUi === true;

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(WASB_ORDER_REPORT_CONFIG_.sheetName);

    if (!sheet) {
      throw new Error('Лист "' + WASB_ORDER_REPORT_CONFIG_.sheetName + '" не знайдено. Спочатку запустіть "Звіт: налаштувати лист".');
    }

    const data = sheet.getDataRange().getValues();
    if (!data || data.length < 2) {
      throw new Error('Лист звіту порожній. Додайте дані або запустіть налаштування листа.');
    }

    const recipient = wasbGetReportUserEmail_();
    if (!recipient) {
      throw new Error('Не вдалося визначити email користувача для надсилання звіту.');
    }

    const reportTitle = 'Звіт по замовленнях: ' + ss.getName();
    const htmlBody = wasbBuildOrderReportHtml_(data, {
      spreadsheetName: ss.getName(),
      source: opts.source || 'manual',
      userEmail: recipient
    });

    MailApp.sendEmail({
      to: recipient,
      subject: reportTitle,
      htmlBody: htmlBody
    });

    return {
      success: true,
      to: recipient,
      rows: Math.max(0, data.length - 1),
      source: opts.source || 'manual'
    };
  } catch (e) {
    if (showUi) wasbShowOrderReportError_('Помилка надсилання звіту', e);
    console.error('wasbSendOrderReport_ error:', e);
    return { success: false, error: wasbErrorToString_(e), source: opts.source || 'manual' };
  }
}

function wasbBuildOrderReportHtml_(data, meta) {
  const timezone = Session.getScriptTimeZone() || 'Europe/Kyiv';
  const safeMeta = meta || {};
  const generatedAt = Utilities.formatDate(new Date(), timezone, 'dd.MM.yyyy HH:mm:ss');
  let html = '';

  html += '<div style="font-family:Arial,sans-serif;font-size:13px;color:#111;">';
  html += '<h3 style="margin:0 0 10px 0;">Звіт сформовано автоматично</h3>';
  html += '<p style="margin:0 0 12px 0;">';
  html += 'Таблиця: <b>' + wasbEscapeReportHtml_(safeMeta.spreadsheetName || '') + '</b><br>';
  html += 'Час: ' + wasbEscapeReportHtml_(generatedAt) + '<br>';
  html += 'Джерело: ' + wasbEscapeReportHtml_(safeMeta.source || 'manual') + '<br>';
  html += 'Користувач: ' + wasbEscapeReportHtml_(safeMeta.userEmail || '') + '</p>';

  html += '<table border="1" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #999;">';

  for (let i = 0; i < data.length; i++) {
    html += '<tr>';
    for (let j = 0; j < data[i].length; j++) {
      const tag = i === 0 ? 'th' : 'td';
      const style = i === 0
        ? 'padding:6px;background:#f3f3f3;text-align:left;font-weight:bold;border:1px solid #999;'
        : 'padding:6px;border:1px solid #999;';
      html += '<' + tag + ' style="' + style + '">' + wasbFormatReportCell_(data[i][j], timezone) + '</' + tag + '>';
    }
    html += '</tr>';
  }

  html += '</table>';
  html += '</div>';
  return html;
}

function wasbFormatReportCell_(value, timezone) {
  if (value instanceof Date) {
    return wasbEscapeReportHtml_(Utilities.formatDate(value, timezone, 'dd.MM.yyyy'));
  }
  if (value === null || typeof value === 'undefined') return '';
  return wasbEscapeReportHtml_(String(value));
}

function wasbGetOrCreateOrderReportSheet_(ss) {
  const name = WASB_ORDER_REPORT_CONFIG_.sheetName;
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function wasbGetReportUserEmail_() {
  try {
    const effective = Session.getEffectiveUser && Session.getEffectiveUser().getEmail
      ? Session.getEffectiveUser().getEmail()
      : '';
    if (effective) return String(effective).trim();
  } catch (_) {}

  try {
    const active = Session.getActiveUser && Session.getActiveUser().getEmail
      ? Session.getActiveUser().getEmail()
      : '';
    if (active) return String(active).trim();
  } catch (_) {}

  return '';
}

function wasbEscapeReportHtml_(value) {
  if (typeof escapeHtml_ === 'function') return escapeHtml_(value);
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function wasbShowOrderReportError_(title, error) {
  SpreadsheetApp.getUi().alert(
    title,
    wasbErrorToString_(error),
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function wasbErrorToString_(error) {
  if (!error) return 'Невідома помилка';
  if (error.message) return String(error.message);
  return String(error);
}

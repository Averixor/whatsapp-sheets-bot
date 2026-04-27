/**
 * OrderReportModule.gs — safe optional report/email demo module for WASB.
 *
 * This adapts the simple "orders report" GAS example without touching active sheets,
 * without declaring a second onOpen(), and without using UI alerts from triggers.
 */

const WASB_ORDER_REPORT_CONFIG_ = Object.freeze({
  SHEET_NAME: 'ORDER_REPORT',
  TRIGGER_HANDLER: 'wasbSendOrderReportDailyTrigger_',
  DEFAULT_TRIGGER_HOUR: 9,
  DATE_FORMAT: 'dd.MM.yyyy',
  CURRENCY_FORMAT: '#,##0.00',
  HEADER: Object.freeze(['Дата', 'Клієнт', 'Сума', 'Статус', 'Email для звіту'])
});

function addWasbOrderReportMenuItems_(menu) {
  if (!menu) return menu;
  return menu
    .addSeparator()
    .addItem('Звіт: налаштувати лист', 'wasbSetupOrderReportSheet')
    .addItem('Звіт: надіслати собі', 'wasbSendOrderReportToCurrentUser')
    .addItem('Звіт: встановити тригер 09:00', 'wasbInstallOrderReportDailyTrigger')
    .addItem('Звіт: про модуль', 'wasbShowOrderReportAbout');
}

function wasbSetupOrderReportSheet() {
  const result = setupOrderReportSheet_();
  showOrderReportUiAlert_(result.message);
  return result;
}

function wasbSendOrderReportToCurrentUser() {
  const result = sendOrderReport_({ source: 'ui', showUi: true });
  showOrderReportUiAlert_(result.message);
  return result;
}

function wasbSendOrderReportDailyTrigger_() {
  return sendOrderReport_({ source: 'trigger', showUi: false });
}

function wasbInstallOrderReportDailyTrigger() {
  const result = installOrderReportDailyTrigger_();
  showOrderReportUiAlert_(result.message);
  return result;
}

function wasbShowOrderReportAbout() {
  const email = getReportCurrentUserEmail_() || 'email недоступний';
  const sheetName = WASB_ORDER_REPORT_CONFIG_.SHEET_NAME;
  const message = [
    'WASB Order Report module',
    '',
    'Лист звіту: ' + sheetName,
    'Поточний користувач: ' + email,
    '',
    'Модуль не очищає активний лист і не замінює основне меню WASB.'
  ].join('\n');

  try {
    SpreadsheetApp.getUi().alert('Інфо', message, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (error) {
    Logger.log(message);
  }

  return { success: true, message: message };
}

function setupOrderReportSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateOrderReportSheet_();
  const email = getReportCurrentUserEmail_();
  const now = new Date();
  const header = WASB_ORDER_REPORT_CONFIG_.HEADER;
  const rows = [
    [now, 'Іван Іванов', 1500, 'Завершено', email],
    [now, 'Марія Петренко', 2300, 'В процесі', email]
  ];

  sheet.clear({ contentsOnly: true });
  sheet.clearFormats();
  sheet.getRange(1, 1, 1, header.length)
    .setValues([header])
    .setFontWeight('bold')
    .setBackground('#f3f3f3');
  sheet.getRange(2, 1, rows.length, header.length).setValues(rows);
  sheet.getRange(2, 1, rows.length, 1).setNumberFormat(WASB_ORDER_REPORT_CONFIG_.DATE_FORMAT);
  sheet.getRange(2, 3, rows.length, 1).setNumberFormat(WASB_ORDER_REPORT_CONFIG_.CURRENCY_FORMAT);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, header.length);

  return {
    success: true,
    sheetName: sheet.getName(),
    spreadsheetName: ss.getName(),
    rows: rows.length,
    message: 'Лист ' + sheet.getName() + ' налаштовано без очищення активних робочих листів.'
  };
}

function sendOrderReport_(options) {
  const opts = options || {};
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(WASB_ORDER_REPORT_CONFIG_.SHEET_NAME);

  if (!sheet) {
    return {
      success: false,
      message: 'Лист ' + WASB_ORDER_REPORT_CONFIG_.SHEET_NAME + ' не знайдено. Спочатку запусти “Звіт: налаштувати лист”.'
    };
  }

  const data = sheet.getDataRange().getValues();
  if (!data || data.length < 2) {
    return {
      success: false,
      message: 'Лист ' + sheet.getName() + ' порожній. Спочатку налаштуй або заповни дані.'
    };
  }

  const recipient = getReportRecipientEmail_(data) || getReportCurrentUserEmail_();
  if (!recipient) {
    return {
      success: false,
      message: 'Не вдалося визначити email отримувача звіту.'
    };
  }

  const reportTitle = 'Звіт по замовленнях: ' + ss.getName();
  const htmlBody = buildOrderReportHtml_(data, {
    spreadsheetName: ss.getName(),
    sheetName: sheet.getName(),
    executedBy: getReportCurrentUserEmail_() || 'trigger/system',
    source: opts.source || 'manual'
  });

  try {
    MailApp.sendEmail({
      to: recipient,
      subject: reportTitle,
      htmlBody: htmlBody
    });

    return {
      success: true,
      recipient: recipient,
      rows: data.length - 1,
      message: 'Звіт надіслано на адресу: ' + recipient
    };
  } catch (error) {
    return {
      success: false,
      recipient: recipient,
      message: 'Помилка при надсиланні: ' + getReportErrorMessage_(error),
      error: getReportErrorMessage_(error)
    };
  }
}

function installOrderReportDailyTrigger_() {
  const handler = WASB_ORDER_REPORT_CONFIG_.TRIGGER_HANDLER;
  let removed = 0;

  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === handler) {
      ScriptApp.deleteTrigger(trigger);
      removed++;
    }
  });

  ScriptApp.newTrigger(handler)
    .timeBased()
    .everyDays(1)
    .atHour(WASB_ORDER_REPORT_CONFIG_.DEFAULT_TRIGGER_HOUR)
    .create();

  return {
    success: true,
    removed: removed,
    handler: handler,
    hour: WASB_ORDER_REPORT_CONFIG_.DEFAULT_TRIGGER_HOUR,
    message: 'Створено щоденний тригер ' + handler + ' на ' + WASB_ORDER_REPORT_CONFIG_.DEFAULT_TRIGGER_HOUR + ':00.'
  };
}

function getOrCreateOrderReportSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const name = WASB_ORDER_REPORT_CONFIG_.SHEET_NAME;
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function getReportRecipientEmail_(data) {
  if (!data || data.length < 2) return '';
  const header = data[0].map(function(value) { return String(value || '').trim().toLowerCase(); });
  let emailCol = header.indexOf('email для звіту');
  if (emailCol === -1) emailCol = header.indexOf('email');
  if (emailCol === -1) return '';

  for (let i = 1; i < data.length; i++) {
    const email = String(data[i][emailCol] || '').trim();
    if (isValidReportEmail_(email)) return email;
  }

  return '';
}

function getReportCurrentUserEmail_() {
  try {
    const activeEmail = Session.getActiveUser().getEmail();
    if (activeEmail) return String(activeEmail).trim();
  } catch (error) {}

  try {
    const effectiveEmail = Session.getEffectiveUser().getEmail();
    if (effectiveEmail) return String(effectiveEmail).trim();
  } catch (error) {}

  return '';
}

function buildOrderReportHtml_(data, context) {
  const ctx = context || {};
  const timezone = getReportTimeZone_();
  let html = '';

  html += '<h3>Звіт сформовано автоматично</h3>';
  html += '<p><b>Таблиця:</b> ' + escapeReportHtml_(ctx.spreadsheetName || '') + '</p>';
  html += '<p><b>Лист:</b> ' + escapeReportHtml_(ctx.sheetName || '') + '</p>';
  html += '<table border="1" cellpadding="5" cellspacing="0" style="border-collapse:collapse;">';

  data.forEach(function(row, rowIndex) {
    html += '<tr>';
    row.forEach(function(value) {
      const tag = rowIndex === 0 ? 'th' : 'td';
      const style = rowIndex === 0 ? ' style="background:#f3f3f3;font-weight:bold;"' : '';
      html += '<' + tag + style + '>' + escapeReportHtml_(formatReportCell_(value, timezone)) + '</' + tag + '>';
    });
    html += '</tr>';
  });

  html += '</table>';
  html += '<p>Скрипт виконав: ' + escapeReportHtml_(ctx.executedBy || '') + '</p>';
  html += '<p>Джерело запуску: ' + escapeReportHtml_(ctx.source || '') + '</p>';

  return html;
}

function formatReportCell_(value, timezone) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, timezone, WASB_ORDER_REPORT_CONFIG_.DATE_FORMAT);
  }
  if (value === null || value === undefined) return '';
  return String(value);
}

function getReportTimeZone_() {
  try {
    return Session.getScriptTimeZone() || 'Europe/Kyiv';
  } catch (error) {
    return 'Europe/Kyiv';
  }
}

function escapeReportHtml_(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function isValidReportEmail_(value) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(value || '').trim());
}

function showOrderReportUiAlert_(message) {
  try {
    SpreadsheetApp.getUi().alert(String(message || 'Готово'));
  } catch (error) {
    Logger.log(String(message || 'Готово'));
  }
}

function getReportErrorMessage_(error) {
  return error && error.message ? error.message : String(error || 'Unknown error');
}

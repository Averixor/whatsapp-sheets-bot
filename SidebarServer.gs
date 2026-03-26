/************ БОКОВА ПАНЕЛЬ / COMPATIBILITY LAYER ************/
/**
 * Політика final baseline compatibility layer:
 * - тут не додається нова предметна логіка;
 * - файл виконує роль sidebar host / compatibility layer;
 * - активний client bootstrap: Sidebar.html + includeTemplate('JavaScript');
 * - legacy wrappers залишаються thin aliases і фіксуються в DeprecatedRegistry.gs.
 */

function showSidebar() {
  const html = HtmlService.createTemplateFromFile('Sidebar')
    .evaluate()
    .setTitle('\u00A0\u00A0\u00A0WhatsApp-Sheets-Bot')
  SpreadsheetApp.getUi().showSidebar(html);
}

function sendFromSidebar(personData) {
  try {
    if (!personData || !personData.link) {
      throw new Error('Немає даних для відправки');
    }

    const logEntry = {
      timestamp: new Date(),
      reportDateStr: personData.date || '',
      sheet: getBotMonthSheetName_(),
      cell: `${String.fromCharCode(64 + Number(personData.col || 0))}${personData.row || ''}`,
      fio: personData.fio || '',
      phone: personData.phone || '',
      code: personData.code || '',
      service: personData.service || '',
      place: personData.place || '',
      tasks: personData.tasks || '',
      message: personData.message || '',
      link: personData.link || ''
    };

    writeLogsBatch_([logEntry]);
    return okResponse_({ link: personData.link }, 'Посилання підготовлено', { function: 'sendFromSidebar' });
  } catch (e) {
    return errorResponse_(e, { function: 'sendFromSidebar' });
  }
}

function sendAllFromSidebar(personnelList) {
  try {
    if (!Array.isArray(personnelList) || !personnelList.length) {
      throw new Error('Немає даних для відправки');
    }

    const readyItems = personnelList.filter(function(item) {
      const status = String(item && item.status || '').toLowerCase();
      return ((status === 'ready') || status === 'ok' || status.indexOf('✓') === 0) && !!(item && item.link);
    });

    if (!readyItems.length) {
      throw new Error('Немає готових до відправки повідомлень');
    }

    writeLogsBatch_(readyItems.map(function(item) {
      return {
        timestamp: new Date(),
        reportDateStr: item.date || '',
        sheet: getBotMonthSheetName_(),
        cell: `${String.fromCharCode(64 + Number(item.col || 0))}${item.row || ''}`,
        fio: item.fio || '',
        phone: item.phone || '',
        code: item.code || '',
        service: item.service || '',
        place: item.place || '',
        tasks: item.tasks || '',
        message: String(item.message || '').substring(0, 100) + '...',
        link: item.link || ''
      };
    }));

    return okResponse_({
      count: readyItems.length,
      links: readyItems.map(function(item) { return item.link; })
    }, 'Пакет посилань підготовлено', { function: 'sendAllFromSidebar' });
  } catch (e) {
    return errorResponse_(e, { function: 'sendAllFromSidebar' });
  }
}

function sendDaySummaryToCommanderSidebar(dateStr, summaryText) {
  try {
    if (!summaryText) {
      throw new Error('Немає тексту зведення');
    }

    const phone = findPhone_({ role: CONFIG.COMMANDER_ROLE });
    if (!phone) {
      throw new Error(`Телефон для ролі "${CONFIG.COMMANDER_ROLE}" не знайдено в PHONES`);
    }

    const safe = trimToEncoded_(summaryText, CONFIG.MAX_WA_TEXT);
    const link = `https://wa.me/${phone.replace('+', '')}?text=${encodeURIComponent(safe)}`;

    writeLogsBatch_([{
      timestamp: new Date(),
      reportDateStr: dateStr || '',
      sheet: 'COMMANDER',
      cell: 'SUMMARY',
      fio: `Командир (${CONFIG.COMMANDER_ROLE})`,
      phone: phone,
      code: 'SUMMARY',
      message: String(summaryText).substring(0, 100) + '...',
      link: link
    }]);

    return okResponse_({ link: link }, 'Зведення для командира підготовлено', { function: 'sendDaySummaryToCommanderSidebar' });
  } catch (e) {
    return errorResponse_(e, { function: 'sendDaySummaryToCommanderSidebar' });
  }
}

function sendDetailedToCommanderSidebar(dateStr, detailedText) {
  try {
    if (!detailedText) {
      throw new Error('Немає тексту детального зведення');
    }

    const phone = findPhone_({ role: CONFIG.COMMANDER_ROLE });
    if (!phone) {
      throw new Error(`Телефон для ролі "${CONFIG.COMMANDER_ROLE}" не знайдено в PHONES`);
    }

    const safe = trimToEncoded_(detailedText, CONFIG.MAX_WA_TEXT);
    const link = `https://wa.me/${phone.replace('+', '')}?text=${encodeURIComponent(safe)}`;

    writeLogsBatch_([{
      timestamp: new Date(),
      reportDateStr: dateStr || '',
      sheet: 'COMMANDER',
      cell: 'DETAILED',
      fio: `Командир (${CONFIG.COMMANDER_ROLE})`,
      phone: phone,
      code: 'DETAILED',
      message: String(detailedText).substring(0, 100) + '...',
      link: link
    }]);

    return okResponse_({ link: link }, 'Детальне зведення для командира підготовлено', { function: 'sendDetailedToCommanderSidebar' });
  } catch (e) {
    return errorResponse_(e, { function: 'sendDetailedToCommanderSidebar' });
  }
}

function testCommanderPhone() {
  const ui = SpreadsheetApp.getUi();
  try {
    const phoneIndex = typeof loadPhonesIndex_ === 'function' ? loadPhonesIndex_() : null;
    const role = CONFIG.COMMANDER_ROLE;
    let result = `🔍 ПОШУК ТЕЛЕФОНУ КОМАНДИРА
`;
    result += `============================

`;
    result += `Роль в конфігу: "${role}"

`;
    result += `📞 Canonical lookup: ${findPhone_({ role: role }) || '✕'}
`;
    result += `📞 byRole[${role}]: ${phoneIndex && phoneIndex.byRole ? (phoneIndex.byRole[role] || phoneIndex.byRole[_normCallsignKey_(role)] || '✕') : '✕'}
`;
    result += `📞 byCallsign[${role}]: ${phoneIndex && phoneIndex.byCallsign ? (phoneIndex.byCallsign[role] || phoneIndex.byCallsign[_normCallsignKey_(role)] || '✕') : '✕'}

`;
    result += `📋 Можливі кандидати:
`;

    let found = 0;
    (phoneIndex && Array.isArray(phoneIndex.items) ? phoneIndex.items : []).forEach(function(item) {
      const probe = [item.role, item.callsign, item.fio].filter(Boolean).join(' | ');
      const upperProbe = probe.toUpperCase();
      if (upperProbe.indexOf('КОМАНДИР') !== -1 || upperProbe.indexOf('КВ') !== -1 || upperProbe.indexOf('ГРАФ') !== -1 || upperProbe.indexOf(String(role || '').toUpperCase()) !== -1) {
        result += `  ${probe} → ${item.phone || '—'}
`;
        found++;
      }
    });

    if (!found) {
      result += `  (нічого не знайдено)

`;
      result += `✕ В листі PHONES немає запису для командира. Додайте роль або позивний "${role}".`;
    }

    ui.alert('📱 Діагностика командира', result, ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('✕ Помилка', String(e && e.message ? e.message : e), ui.ButtonSet.OK);
  }
}

// ==================== THIN COMPATIBILITY WRAPPERS ====================
function getMonthsList() {
  return apiStage4GetMonthsList();
}

function getSidebarData(dateStr) {
  return apiStage4GetSidebarData(dateStr || _todayStr_());
}

function generateSendPanelSidebar(options) {
  return apiGenerateSendPanelForDate(options || {});
}

function getSendPanelSidebarData() {
  return apiStage4GetSendPanelData();
}

function getDaySummaryByDate(dateStr) {
  return apiBuildDaySummary(dateStr || _todayStr_());
}

function getDetailedDaySummaryByDate(dateStr) {
  return apiBuildDetailedSummary(dateStr || _todayStr_());
}

function checkVacationsAndNotifySidebar(dateStr) {
  return apiCheckVacationsAndBirthdays(dateStr || _todayStr_());
}

function createNextMonthSheetSidebar() {
  return apiCreateNextMonthStage4({ switchToNewMonth: true });
}

function switchBotToMonthSidebar(monthSheetName) {
  return apiStage4SwitchBotToMonth(monthSheetName || '');
}

function markMultipleAsSentFromSidebar(rowNumbers, opts) {
  return apiMarkPanelRowsAsSent(rowNumbers, opts || {});
}

function markMultipleAsUnsentFromSidebar(rowNumbers, opts) {
  return apiMarkPanelRowsAsUnsent(rowNumbers, opts || {});
}
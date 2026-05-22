/************ БОКОВА ПАНЕЛЬ / SIDEBAR ENTRY POINTS ************/
/**
 * Sidebar host for google.script.run:
 * - no new domain logic here;
 * - thin delegates to apiStage7* / apiGenerateSendPanelForDate;
 * - client bootstrap: Sidebar.html + includeTemplate('JavaScript').
 */

function showSidebar() {
  const html = HtmlService.createTemplateFromFile('Sidebar')
    .evaluate()
    .setTitle('\u00A0\u00A0\u00A0WhatsApp-Sheets-Bot')
  SpreadsheetApp.getUi().showSidebar(html);
}

function sendDaySummaryToCommanderSidebar(dateStr, summaryText) {
  try {
    if (typeof AccessEnforcement_ === 'object' && AccessEnforcement_.assertCanUseWorkingActions) {
      AccessEnforcement_.assertCanUseWorkingActions('sendDaySummaryToCommanderSidebar', { requestedDate: dateStr || '' });
    }
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
      fml: `Командир (${CONFIG.COMMANDER_ROLE})`,
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
    if (typeof AccessEnforcement_ === 'object' && AccessEnforcement_.assertCanUseDetailedSummary) {
      AccessEnforcement_.assertCanUseDetailedSummary(dateStr || '');
    }
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
      fml: `Командир (${CONFIG.COMMANDER_ROLE})`,
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
    const lines = [];
    lines.push('🔍 ПОШУК ТЕЛЕФОНУ КОМАНДИРА');
    lines.push('============================');
    lines.push('');
    lines.push(`Позивний в конфігу: "${role}"`);
    lines.push('');
    lines.push(`📞 Canonical lookup: ${findPhone_({ role: role }) || '✕'}`);
    lines.push(
      `📞 byRole[${role}]: ${
        phoneIndex && phoneIndex.byRole
          ? (phoneIndex.byRole[role] || phoneIndex.byRole[_normCallsignKey_(role)] || '✕')
          : '✕'
      }`
    );
    lines.push(
      `📞 byCallsign[${role}]: ${
        phoneIndex && phoneIndex.byCallsign
          ? (phoneIndex.byCallsign[role] || phoneIndex.byCallsign[_normCallsignKey_(role)] || '✕')
          : '✕'
      }`
    );
    lines.push('');
    lines.push('📋 Можливі кандидати:');
    lines.push('');

    let found = 0;
    (phoneIndex && Array.isArray(phoneIndex.items) ? phoneIndex.items : []).forEach(function(item) {
      const probe = [item.role, item.callsign, item.fml].filter(Boolean).join(' | ');
      const upperProbe = probe.toUpperCase();
      if (upperProbe.indexOf('КОМАНДИР') !== -1 || upperProbe.indexOf('ГРАФ') !== -1 || upperProbe.indexOf(String(role || '').toUpperCase()) !== -1) {
        lines.push(`  ${probe} → ${item.phone || '—'}`);
        found++;
      }
    });

    if (!found) {
      lines.push('  (нічого не знайдено)');
      lines.push('');
      lines.push(`✕ В листі PHONES немає запису для командира. Додайте роль або позивний "${role}".`);
    }

    const result = lines.join('\n');
    ui.alert('📱 Діагностика командира', result, ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('✕ Помилка', String(e && e.message ? e.message : e), ui.ButtonSet.OK);
  }
}

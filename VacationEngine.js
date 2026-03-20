// ========== VACATION + BIRTHDAY ENGINE ==========
const VACATION_ENGINE_CONFIG = {
  VACATIONS_SHEET: 'VACATIONS',
  NAME_COL: 1,
  START_COL: 2,
  END_COL: 3,
  NUM_COL: 4,
  ACTIVE_COL: 5,
  NOTIFY_COL: 6,
  RAPORT_DAYS: [20, 19, 18, 17],
  SOLDIER_DAYS: [3, 1],
  NOTIFY_COMMANDER: true,
  SOLDIER_RAPORT_TEMPLATE: 'SOLDIER_RAPORT_REMINDER',
  COMMANDER_RAPORT_TEMPLATE: 'COMMANDER_RAPORT_REMINDER',
  COMMANDER_SOON3_TEMPLATE: 'COMMANDER_VACATION_SOON_3',
  COMMANDER_TODAY_TEMPLATE: 'COMMANDER_VACATION_TODAY',
  SOLDIER_TEMPLATES: {
    3: ['SOLDIER_3_1',
      'SOLDIER_3_2',
      'SOLDIER_3_3',
      'SOLDIER_3_4',
      'SOLDIER_3_5',
      'SOLDIER_3_6'
    ],
    1: ['SOLDIER_1_1',
      'SOLDIER_1_2',
      'SOLDIER_1_3',
      'SOLDIER_1_4',
      'SOLDIER_1_5',
      'SOLDIER_1_6'
    ]
  }
};

const BIRTHDAY_ENGINE_CONFIG = {
  COMMANDER_DAYS: [3, 2, 1],
  PERSON_DAYS: [0],
  COMMANDER_TEMPLATE_3: 'BIRTHDAY_COMMANDER_3',
  COMMANDER_TEMPLATE_2: 'BIRTHDAY_COMMANDER_2',
  COMMANDER_TEMPLATE_1: 'BIRTHDAY_COMMANDER_1',
  PERSON_TEMPLATE: 'BIRTHDAY_GREETING'
};

// ==================== COMMON HELPERS ====================
function _veCommanderRole_() {
  try {
    return (
      typeof
      CONFIG !==
      'undefined' &&
      CONFIG &&
      CONFIG.COMMANDER_ROLE)
      ? String(CONFIG.COMMANDER_ROLE)
        .trim()
      : 'ГРАФ';
  } catch (_) {
    return 'ГРАФ';
  }
}

function _veTimeZone_() {
  try {
    if (typeof getTimeZone_ === 'function') {
      const tz = getTimeZone_();
      if (tz) return tz;
    }
  } catch (_) { }

  try {
    return (typeof CONFIG !==
      'undefined' &&
      CONFIG &&
      CONFIG.TZ)
      ? CONFIG.TZ
      : Session
        .getScriptTimeZone();
  } catch (_) {
    return 'Europe/Kiev';
  }
}

function _veBool_(
  value, defaultValue) {
  if (value === true
    || value === false)
    return value;
  const s = String(
    value == null ? '' : value)
    .trim()
    .toUpperCase();
  if (s === 'TRUE'
    || s === '1'
    || s === 'YES'
    || s === 'Y'
    || s === 'ON'
    || s === 'ДА'
  )
    return true;
  if (s === 'FALSE'
    || s === '0'
    || s === 'NO'
    || s === 'N'
    || s === 'OFF'
    || s === 'НІ'
  )
    return false;
  return !!defaultValue;
}

function _veRaportEnabled_() {
  try {
    if (typeof getRaportRemindersEnabled === 'function') {
      return !!getRaportRemindersEnabled();
    }
  } catch (_) { }
  return true;
}

function _veNormId_(fio) {
  try {
    if (typeof _normFioVac_ === 'function') return _normFioVac_(fio);
  } catch (_) { }
  return String(fio || '')
    .toLowerCase()
    .replace(/[ʼ'`’"]/g, '')
    .replace(/\s+/g, '_')
    .trim();
}

function _veParseDate_(value) {
  if (!value) return null;
  if (value instanceof Date && !isNaN(value.getTime())) {
    const d = new Date(value);
    d.setHours(12, 0, 0, 0);
    return d;
  }

  if (typeof value === 'number'
    && value > 25569
    && value < 60000) {
    const d = new Date((
      value - 25569) * 86400 * 1000);
    d.setHours(12, 0, 0, 0);
    return isNaN(d.getTime()) ?
      null : d;
  }

  const s = String(value)
    .trim();
  if (!s) return null;
  let m = s.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})$/);
  if (m) {
    let day = parseInt(m[1], 10);
    let month = parseInt(m[2], 10);
    let year = parseInt(m[3], 10);
    if (year < 100) year += 2000;
    const d = new Date(year, month - 1, day, 12, 0, 0);
    return isNaN(d.getTime()) ? null : d;
  }

  m = s.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/);
  if (m) {
    const year = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    const day = parseInt(m[3], 10);

    const d = new
      Date(year, month - 1, day, 12, 0, 0);
    return isNaN(d.getTime()) ?
      null : d;
  }

  try {
    if (typeof _parseUaDate_ === 'function') {
      const d = _parseUaDate_(s);
      if (d instanceof Date
        && !isNaN(d.getTime())) {
        d.setHours(12, 0, 0, 0);
        return d;
      }
    }
  } catch (_) { }
  return null;
}

function _veVacationWordToNumber_(word) {
  const words = {
    'нульова': 0,
    'перша': 1,
    'друга': 2,
    'третя': 3,
    'четверта': 4,
    "п'ята": 5,
    'пята': 5,
    'шоста': 6,
    'сьома': 7,
    'восьма': 8,
    "дев'ята": 9,
    'девята': 9,
    'десята': 10
  };

  const lower = String(word || '').trim().toLowerCase();
  return (words[lower] !== undefined) ?
    words[lower] : lower;
}

function _veNumberToVacationWord_(num) {
  const words = [
    'нульова',
    'перша',
    'друга',
    'третя',
    'четверта',
    "п'ята",
    'шоста',
    'сьома',
    'восьма',
    "дев'ята",
    'десята'
  ];

  if (typeof num ===
    'number' && num >= 0 && num <= 10)
    return words[num];
  return String(num || '');
}

function _vePrepareData_(data) {
  return {
    ...data,
    days: data.days != null ?
      data.days : (
        data.daysUntil != null ?
          data.daysUntil : ''),
    daysUntil: data.daysUntil != null ?
      data.daysUntil : (
        data.days != null ?
          data.days : ''),
    name: data.name ||
      data.callsign || '',
    callsign: data.callsign ||
      data.name || '',
    fio: data.fio || '',
    surname: data.surname || '',
    startDate: data.startDate ||
      data.date_start || '',
    endDate: data.endDate ||
      data.date_end || '',
    date_start: data.date_start ||
      data.startDate || '',
    date_end: data.date_end ||
      data.endDate || '',
    vacationWord: data.vacationWord ||
      data.vac_no || '',
    vac_no: data.vac_no ||
      data.vacationWord || '',
    rank: data.rank || '',
    birthday: data.birthday || '',
    age: data.age || ''
  };
}

function _veTemplateText_(key) {
  try {
    if (typeof getTemplateText_ === 'function') {
      return getTemplateText_(key);
    }
  } catch (e) {
    console.warn('Template read error:', key, e);
  }
  return '';
}

function _veRenderTemplateOrFallback_(key, data, fallbackText) {
  try {
    const tpl = _veTemplateText_(key);
    if (tpl && typeof renderTemplate_ === 'function') {
      return renderTemplate_(tpl, _vePrepareData_(data));
    }
  } catch (e) {
    console.warn('Template render error:', key, e);
  }
  return String(fallbackText || '');
}

function _veRandomTemplateOrFallback_(keys, data, fallbackText) {
  try {
    if (!Array.isArray(keys) || !keys.length) return String(fallbackText || '');
    const enabled = keys.filter(function (key) {
      return !!_veTemplateText_(key);
    });
    if (!enabled.length) return String(fallbackText || '');
    const picked = enabled[Math.floor(Math.random() * enabled.length)];
    return _veRenderTemplateOrFallback_(picked, data, fallbackText);
  } catch (e) {
    console.warn('Random template error:', e);
    return String(fallbackText || '');
  }
}

function _veWaLink_(phone, message) {
  const cleanedPhone = String(phone || '').replace(/\D/g, '');
  if (!cleanedPhone) return '';
  const maxLen = (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.MAX_WA_TEXT)
    ? CONFIG.MAX_WA_TEXT
    : 3800;
  const safeMessage = (typeof trimToEncoded_ === 'function')
    ? trimToEncoded_(String(message || ''), maxLen)
    : String(message || '');
  return `https://wa.me/${cleanedPhone}?text=${encodeURIComponent(safeMessage)}`;
}

function _veCommanderPhone_() {
  try {
    const role = _veCommanderRole_();
    if (typeof findPhoneByRole_ === 'function') {
      const phone = findPhoneByRole_(role);
      if (phone) return phone;
    }
    if (typeof loadPhonesMap_ === 'function') {
      const phonesMap = loadPhonesMap_() || {};
      return phonesMap[`role:${role}`]
        || phonesMap[role] || '';
    }
    return '';
  } catch (e) {
    console.error('_veCommanderPhone_ error:', e);
    return '';
  }
}

function _veProfilesList_() {
  try {
    if (
      typeof loadPhonesProfiles_ !== 'function')
      return [];
    const profiles = loadPhonesProfiles_();
    if (!profiles)
      return [];
    if (profiles.byFio &&
      typeof profiles.byFio === 'object') {
      return Object.values(profiles.byFio);
    }
    if (Array.isArray(profiles))
      return profiles;
    if (Array.isArray(profiles.items))
      return profiles.items;
    return [];
  } catch (e) {
    console.error('_veProfilesList_ error:', e);
    return [];
  }
}

// ==================== VACATION MESSAGE BUILDERS ====================
function _veBuildVacationSoldierRaportMessage_(data) {
  const d = _vePrepareData_(data);
  return _veRenderTemplateOrFallback_(
    VACATION_ENGINE_CONFIG.SOLDIER_RAPORT_TEMPLATE,
    d,
    `${d.callsign}, нагадую: через ${d.days} днів у тебе починається відпустка ${d.vacationWord}.\nПовідом, де саме будеш її проводити!\n\nПеріод: ${d.startDate} - ${d.endDate}`
  );
}

function _veBuildVacationSoldierMessage_(kind, data) {
  const d = _vePrepareData_(data);
  switch (kind) {
    case 'report':
      return _veBuildVacationSoldierRaportMessage_(d);
    case 'soon_3':
      return _veRandomTemplateOrFallback_(
        VACATION_ENGINE_CONFIG.SOLDIER_TEMPLATES[3],
        d,
        `${d.name}, нагадую: через 3 дні у тебе відпустка ${d.vacationWord} з ${d.startDate} по ${d.endDate}.`
      );

    case 'tomorrow':
      return _veRandomTemplateOrFallback_(
        VACATION_ENGINE_CONFIG.SOLDIER_TEMPLATES[1],
        d,
        `${d.name}, вітаю — завтра ти йдеш у відпустку ${d.vacationWord} з ${d.startDate} по ${d.endDate}.`
      );
    default:
      return `${d.name}, нагадування щодо відпустки з ${d.startDate} по ${d.endDate}.`;
  }
}

function _veBuildVacationCommanderMessage_(kind, data) {
  const d = _vePrepareData_(data);
  switch (kind) {
    case 'report':
      return _veRenderTemplateOrFallback_(
        VACATION_ENGINE_CONFIG.COMMANDER_RAPORT_TEMPLATE,
        d,
        `Боєць ${d.callsign} (${d.fio}) планує йти у відпустку через ${d.days} днів.\nУ період: ${d.startDate} - ${d.endDate}\n\nНеобхідно нагадати ШАХТАРЮ щоб він написав рапорт.`
      );
    case 'soon_3':
      return _veRenderTemplateOrFallback_(
        VACATION_ENGINE_CONFIG.COMMANDER_SOON3_TEMPLATE,
        d,
        `Боєць ${d.callsign} (${d.fio}) через 3 дні йде у відпустку.\nПеріод: ${d.startDate} - ${d.endDate}`
      );
    case 'tomorrow':
      return _veRenderTemplateOrFallback_(
        VACATION_ENGINE_CONFIG.COMMANDER_TODAY_TEMPLATE,
        d,
        `Боєць ${d.callsign} (${d.fio}) Завтра йде у відпустку!\nПеріод: ${d.startDate} - ${d.endDate}\n\nНе турбувати!`
      );
    default:
      return `Нагадування по відпустці: ${d.callsign} (${d.fio}).`;
  }
}

// ==================== VACATION ENGINE ====================
function runVacationEngine_(targetDate) {
  const result = {
    raportReminders: [],
    soldierMessages: [],
    commanderMessages: [],
    debug: {
      totalRows: 0,
      activeRows: 0,
      validDateRows: 0,
      futureRows: 0,
      processed: []
    }
  };

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(VACATION_ENGINE_CONFIG.VACATIONS_SHEET);
    if (!sh) {
      result.debug.error = `Лист "${VACATION_ENGINE_CONFIG.VACATIONS_SHEET}" не знайдено`;
      return result;
    }
    const lastRow = sh.getLastRow();
    if (lastRow < 2) return result;
    const rows = sh.getRange(2, 1, lastRow - 1, 6)
      .getValues();
    result.debug.totalRows = rows.length;
    const today = (targetDate instanceof Date) ?
      new Date(targetDate) : new Date();
    today.setHours(12, 0, 0, 0);
    const tz = _veTimeZone_();
    const raportEnabled = _veRaportEnabled_();
    const commanderPhone = VACATION_ENGINE_CONFIG.NOTIFY_COMMANDER ?
      _veCommanderPhone_() : '';
    for (const row of rows) {
      const fio = String(row[VACATION_ENGINE_CONFIG.NAME_COL - 1] || '').trim();
      const startValue = row[VACATION_ENGINE_CONFIG.START_COL - 1];
      const endValue = row[VACATION_ENGINE_CONFIG.END_COL - 1];
      const vacationWordRaw = String(row[VACATION_ENGINE_CONFIG.NUM_COL - 1] || '').trim();
      const isActive = _veBool_(row[VACATION_ENGINE_CONFIG.ACTIVE_COL - 1], false);
      const notifyPerson = _veBool_(row[VACATION_ENGINE_CONFIG.NOTIFY_COL - 1], true);
      if (!fio || !isActive) continue;
      result.debug.activeRows++;
      const startDate = _veParseDate_(startValue);
      const endDate = _veParseDate_(endValue);
      if (!startDate || !endDate) continue;
      result.debug.validDateRows++;
      const daysUntil = Math.round((startDate.getTime() - today.getTime()) / 86400000);
      if (daysUntil < 0) continue;
      result.debug.futureRows++;
      const surname = fio.split(' ')[0] || fio;
      const callsign =
        (typeof _getCallsignByFio_ ===
          'function' ? _getCallsignByFio_(fio) : '') ||
        surname;
      const name = String(callsign || surname || fio).trim();
      const vacationNum = _veVacationWordToNumber_(vacationWordRaw);
      const vacationWord = _veNumberToVacationWord_(vacationNum);
      const startStr = Utilities.formatDate(startDate, tz, 'dd.MM.yyyy');
      const endStr = Utilities.formatDate(endDate, tz, 'dd.MM.yyyy');
      const baseData = {
        fio: fio,
        surname: surname,
        callsign: callsign,
        name: name,
        days: daysUntil,
        daysUntil: daysUntil,
        vacationWord: vacationWord,
        vac_no: vacationWord,
        startDate: startStr,
        endDate: endStr,
        date_start: startStr,
        date_end: endStr,
        rank: ''
      };

      const soldierPhone =
        notifyPerson && typeof _getPhoneByFio_ === 'function'
          ? _getPhoneByFio_(fio)
          : '';

      if (raportEnabled && VACATION_ENGINE_CONFIG.RAPORT_DAYS.includes(daysUntil)) {
        result.raportReminders.push({
          fio: fio,
          surname: surname,
          callsign: callsign,
          startDate: startStr,
          endDate: endStr,
          daysUntil: daysUntil,
          vacationWord: vacationWord,
          id: `raport_${_veNormId_(fio)}_${startStr}_${daysUntil}`
        });

        if (commanderPhone) {
          const commanderMessage = _veBuildVacationCommanderMessage_(
            'report', baseData);
          result.commanderMessages.push({
            type: 'commander_report',
            fio: fio,
            callsign: callsign,
            daysUntil: daysUntil,
            startDate: startStr,
            endDate: endStr,
            vacationWord: vacationWord,
            message: commanderMessage,
            link: _veWaLink_(commanderPhone, commanderMessage),
            id: `commander_report_${_veNormId_(fio)}_${startStr}_${daysUntil}`
          });
        }

        if (soldierPhone) {
          const soldierMessage = _veBuildVacationSoldierMessage_(
            'report', baseData);
          result.soldierMessages.push({
            type: 'soldier_report',
            fio: fio,
            surname: surname,
            callsign: callsign,
            phone: soldierPhone,
            phoneDisplay: soldierPhone,
            daysUntil: daysUntil,
            startDate: startStr,
            endDate: endStr,
            vacationWord: vacationWord,
            message: soldierMessage,
            link: _veWaLink_(soldierPhone, soldierMessage),
            id: `soldier_report_${_veNormId_(fio)}_${startStr}_${daysUntil}`
          });
        }
        result.debug.processed.push(
          `РАПОРТ: ${fio} (
            ${daysUntil})
          `);
        continue;
      }

      if (daysUntil === 3) {
        if (commanderPhone) {
          const commanderMessage = _veBuildVacationCommanderMessage_('soon_3', baseData);

          result.commanderMessages.push({
            type: 'commander_soon_3',
            fio: fio,
            callsign: callsign,
            daysUntil: 3,
            startDate: startStr,
            endDate: endStr,
            vacationWord: vacationWord,
            message: commanderMessage,
            link: _veWaLink_(commanderPhone, commanderMessage),
            id: `commander_soon3_${_veNormId_(fio)}_${startStr}`
          });
        }

        if (soldierPhone) {
          const soldierMessage = _veBuildVacationSoldierMessage_('soon_3', baseData);

          result.soldierMessages.push({
            type: 'soldier_soon_3',
            fio: fio,
            surname: surname,
            callsign: callsign,
            phone: soldierPhone,
            phoneDisplay: soldierPhone,
            daysUntil: 3,
            startDate: startStr,
            endDate: endStr,
            vacationWord: vacationWord,
            message: soldierMessage,
            link: _veWaLink_(soldierPhone, soldierMessage),
            id: `soldier_soon3_${_veNormId_(fio)}_${startStr}`
          });
        }
        result.debug.processed.push(`ЗА 3 ДНІ: ${fio}`);
        continue;
      }

      if (daysUntil === 1) {
        if (commanderPhone) {
          const commanderMessage = _veBuildVacationCommanderMessage_('tomorrow', baseData);

          result.commanderMessages.push({
            type: 'commander_tomorrow',
            fio: fio,
            callsign: callsign,
            daysUntil: 1,
            startDate: startStr,
            endDate: endStr,
            vacationWord: vacationWord,
            message: commanderMessage,
            link: _veWaLink_(commanderPhone, commanderMessage),
            id: `commander_tomorrow_${_veNormId_(fio)}_${startStr}`
          });
        }

        if (soldierPhone) {
          const soldierMessage = _veBuildVacationSoldierMessage_('tomorrow', baseData);

          result.soldierMessages.push({
            type: 'soldier_tomorrow',
            fio: fio,
            surname: surname,
            callsign: callsign,
            phone: soldierPhone,
            phoneDisplay: soldierPhone,
            daysUntil: 1,
            startDate: startStr,
            endDate: endStr,
            vacationWord: vacationWord,
            message: soldierMessage,
            link: _veWaLink_(soldierPhone, soldierMessage),
            id: `soldier_tomorrow_${_veNormId_(fio)}_${startStr}`
          });
        }

        result.debug.processed.push(`ЗА 1 ДЕНЬ: ${fio}`);
      }
    }

    result.raportReminders.sort(function (a, b) { return a.daysUntil - b.daysUntil; });
    result.soldierMessages.sort(function (a, b) { return a.daysUntil - b.daysUntil; });
    result.commanderMessages.sort(function (a, b) { return a.daysUntil - b.daysUntil; });

  } catch (e) {
    console.error('runVacationEngine_ error:', e);
    result.debug.error = e && e.message ? e.message : String(e);
  }

  return result;
}

function testVacationEngine() {
  const res = runVacationEngine_(new Date());
  console.log('RAPORT:', res.raportReminders.length);
  console.log('SOLDIER:', res.soldierMessages.length);
  console.log('COMMANDER:', res.commanderMessages.length);
  console.log(res.debug);
  return res;
}

function checkVacationsAndNotify() {
  return runVacationEngine_(new Date());
}

function autoVacationReminder() {
  try {
    const result = runVacationEngine_(new Date());
    console.log(`🏖️ Автоперевірка відпусток: командиру ${result.commanderMessages.length}, бійцям ${result.soldierMessages.length}`);
    return result;
  } catch (e) {
    console.error('autoVacationReminder error:', e);
    return {
      raportReminders: [],
      soldierMessages: [],
      commanderMessages: [],
      error: e && e.message ? e.message : String(e)
    };
  }
}

// ==================== BIRTHDAY HELPERS ====================
function _veParseBirthdayParts_(birthday) {
  const s = String(birthday || '').trim();
  if (!s) return null;

  const parts = s.split('.');
  if (parts.length < 2) return null;

  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = (parts[2] && /^\d{4}$/.test(parts[2])) ? parseInt(parts[2], 10) : null;

  if (!day || !month) return null;
  return { day: day, month: month, year: year };
}

function _veBuildBirthdayCommanderMessage_(data) {
  const d = _vePrepareData_(data);

  if (d.daysUntil === 3) {
    return _veRenderTemplateOrFallback_(
      BIRTHDAY_ENGINE_CONFIG.COMMANDER_TEMPLATE_3,
      d,
      `🎂 Нагадування: у ${d.callsign} (${d.fio}) через 3 дні День Народження (${d.birthday}).`
    );
  }

  if (d.daysUntil === 2) {
    return _veRenderTemplateOrFallback_(
      BIRTHDAY_ENGINE_CONFIG.COMMANDER_TEMPLATE_2,
      d,
      `🎂 Нагадування: у ${d.callsign} (${d.fio}) через 2 дні День Народження (${d.birthday}).`
    );
  }

  return _veRenderTemplateOrFallback_(
    BIRTHDAY_ENGINE_CONFIG.COMMANDER_TEMPLATE_1,
    d,
    `🎂 Нагадування: у ${d.callsign} (${d.fio}) завтра День Народження (${d.birthday}).`
  );
}

function _veBuildBirthdayGreetingMessage_(data) {
  const d = _vePrepareData_(data);
  const tpl = _veTemplateText_(BIRTHDAY_ENGINE_CONFIG.PERSON_TEMPLATE);

  if (tpl && typeof renderTemplate_ === 'function') {
    return renderTemplate_(tpl, {
      callsign: d.name || d.callsign || '',
      name: d.name || d.callsign || '',
      age: d.age || '',
      fio: d.fio || ''
    });
  }

  const ageLine = d.age ? ` З ${d.age}-річчям!` : ' З Днем Народження!';
  return [
    `🎂 Вітаю, ${d.name}!`,
    '',
    `${ageLine}`,
    `Бажаю здоров'я, витримки, сил і мирного неба.`,
    `Нехай все буде чітко, рівно і без зайвого головняка. 🇺🇦`
  ].join('\n');
}

function _veBirthdayCommanderPhone_() {
  return _veCommanderPhone_();
}

// ==================== BIRTHDAY ENGINE ====================
function runBirthdayEngine_(targetDate) {
  const result = {
    commanderMessages: [],
    birthdayMessages: [],
    debug: []
  };

  try {
    const items = _veProfilesList_();
    const commanderPhone = _veBirthdayCommanderPhone_();
    const today = (targetDate instanceof Date) ? new Date(targetDate) : new Date();

    today.setHours(12, 0, 0, 0);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item || !item.fio || !item.birthday) continue;

      const birth = _veParseBirthdayParts_(item.birthday);
      if (!birth) continue;

      let nextBirthday = new Date(today.getFullYear(), birth.month - 1, birth.day, 12, 0, 0);
      if (isNaN(nextBirthday.getTime())) continue;

      if (nextBirthday.getTime() < today.getTime()) {
        nextBirthday = new Date(today.getFullYear() + 1, birth.month - 1, birth.day, 12, 0, 0);
      }

      const daysUntil = Math.round((nextBirthday.getTime() - today.getTime()) / 86400000);
      if ([3, 2, 1, 0].indexOf(daysUntil) === -1) continue;

      const callsign = String(item.role || '').trim() || String(item.fio).split(' ')[0];
      const name = callsign || item.fio;
      const age = (birth.year && daysUntil === 0) ? (today.getFullYear() - birth.year) : null;

      const baseData = {
        fio: item.fio,
        callsign: callsign,
        name: name,
        phone: item.phone || '',
        birthday: item.birthday,
        daysUntil: daysUntil,
        age: age
      };

      if (BIRTHDAY_ENGINE_CONFIG.COMMANDER_DAYS.indexOf(daysUntil) !== -1 && commanderPhone) {
        const message = _veBuildBirthdayCommanderMessage_(baseData);

        result.commanderMessages.push({
          type: 'birthday_commander_notice',
          fio: item.fio,
          callsign: callsign,
          birthday: item.birthday,
          daysUntil: daysUntil,
          message: message,
          link: _veWaLink_(commanderPhone, message),
          id: `birthday_commander_${_veNormId_(item.fio)}_${daysUntil}`
        });
      }

      if (BIRTHDAY_ENGINE_CONFIG.PERSON_DAYS.indexOf(daysUntil) !== -1) {
        const phone = String(item.phone || '').trim();
        const message = _veBuildBirthdayGreetingMessage_(baseData);

        result.birthdayMessages.push({
          type: 'birthday_person_greeting',
          fio: item.fio,
          displayName: name,
          birthday: item.birthday,
          daysUntil: 0,
          phone: phone,
          message: message,
          link: phone ? _veWaLink_(phone, message) : '',
          id: `birthday_person_${_veNormId_(item.fio)}`
        });
      }

      result.debug.push(`${item.fio}: ${daysUntil}`);
    }

    result.commanderMessages.sort(function (a, b) { return b.daysUntil - a.daysUntil; });
    result.birthdayMessages.sort(function (a, b) { return a.daysUntil - b.daysUntil; });

  } catch (e) {
    console.error('runBirthdayEngine_ error:', e);
    result.error = e && e.message ? e.message : String(e);
  }

  return result;
}

function checkBirthdayReminders() {
  return runBirthdayEngine_(new Date());
}

function autoBirthdayReminder() {
  try {
    const result = runBirthdayEngine_(new Date());
    console.log(`🎂 Автоперевірка ДН: командиру ${result.commanderMessages.length}, іменинникам ${result.birthdayMessages.length}`);
    return result;
  } catch (e) {
    console.error('autoBirthdayReminder error:', e);
    return {
      commanderMessages: [],
      birthdayMessages: [],
      error: e && e.message ? e.message : String(e)
    };
  }
}

function getBirthdaysSidebar() {
  try {
    const data = runBirthdayEngine_(new Date());

    return {
      success: true,
      commanderMessages: data.commanderMessages || [],
      birthdayMessages: data.birthdayMessages || [],
      totalCommander: (data.commanderMessages || []).length,
      totalBirthday: (data.birthdayMessages || []).length,
      message: `Командиру: ${(data.commanderMessages || []).length}, іменинникам: ${(data.birthdayMessages || []).length}`
    };
  } catch (e) {
    return {
      success: false,
      error: e && e.message ? e.message : String(e)
    };
  }
}

// ==================== BUILD WHATSAPP LINK FOR SIDEBAR ====================
function buildBirthdayLink(phone, name) {
  try {
    const cleanedPhone = String(phone || '').replace(/\D/g, '');
    if (!cleanedPhone) {
      return { success: false, error: 'Немає телефону' };
    }

    const msg = _veBuildBirthdayGreetingMessage_({
      name: name || 'друже',
      callsign: name || 'друже',
      age: ''
    });

    return {
      success: true,
      link: _veWaLink_(cleanedPhone, msg)
    };
  } catch (e) {
    return {
      success: false,
      error: e && e.message ? e.message : String(e)
    };
  }
}
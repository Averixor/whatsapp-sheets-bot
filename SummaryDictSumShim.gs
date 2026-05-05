/**
 * Compatibility helper for Summaries.gs.
 *
 * Reads summary group rules from DICT_SUM and returns:
 * [{ code, label, order, showZero }]
 *
 * Expected DICT_SUM headers:
 * Code | Label | Order | ShowZero
 */
function readDictSum_() {
  const defaults = getDefaultDictSumRules_();

  try {
    const ss = getWasbSpreadsheet_();
    if (!ss) return defaults;

    const sheetName =
      (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.DICT_SUM_SHEET) ||
      'DICT_SUM';

    const sh = ss.getSheetByName(sheetName);
    if (!sh) return defaults;

    const values = sh.getDataRange().getDisplayValues();
    if (!values || values.length < 2) return defaults;

    const headers = values[0].map(function (v) {
      return normalizeDictSumHeader_(v);
    });

    const idx = {
      code: findDictSumColumn_(headers, ['code', 'код']),
      label: findDictSumColumn_(headers, ['label', 'назва', 'name', 'full_name', 'fullname']),
      order: findDictSumColumn_(headers, ['order', 'порядок', 'sort', 'sort_order']),
      showZero: findDictSumColumn_(headers, ['showzero', 'show_zero', 'zero', 'показувати_нуль', 'показувати0'])
    };

    if (idx.code < 0) return defaults;

    const rows = [];

    for (let r = 1; r < values.length; r++) {
      const row = values[r];

      const code = String(row[idx.code] || '').trim();
      if (!code) continue;

      const fallbackLabel =
        (typeof FULL_NAMES !== 'undefined' && FULL_NAMES && FULL_NAMES[code]) ||
        code;

      const label = idx.label >= 0
        ? String(row[idx.label] || '').trim() || fallbackLabel
        : fallbackLabel;

      const orderRaw = idx.order >= 0 ? String(row[idx.order] || '').trim() : '';
      const order = orderRaw === '' ? 1000 + r : Number(orderRaw);

      const showZeroRaw = idx.showZero >= 0 ? row[idx.showZero] : '';
      const showZero = parseDictSumBoolean_(showZeroRaw);

      rows.push({
        code: code,
        label: label,
        order: Number.isFinite(order) ? order : 1000 + r,
        showZero: showZero
      });
    }

    if (!rows.length) return defaults;

    return rows.sort(function (a, b) {
      if (a.order !== b.order) return a.order - b.order;
      return String(a.code).localeCompare(String(b.code), 'uk');
    });
  } catch (e) {
    console.warn('Помилка в readDictSum_:', e);
    return defaults;
  }
}

function getDefaultDictSumRules_() {
  const order = [
    'ОС',
    'БР',
    'Евак',
    'Roland',
    'Black',
    'РБпАК',
    '1УРБпАК',
    '2УРБпАК',
    'КП',
    'Резерв',
    'Відпус',
    'Лікарн',
    '*РБпАК',
    '*1УРБпАК',
    '*2УРБпАК',
    '*ВЗ',
    '*ВМЗ',
    'Гусачі',
    'Відряд',
    'БЗВП'
  ];

  return order.map(function (code, index) {
    return {
      code: code,
      label:
        (typeof FULL_NAMES !== 'undefined' && FULL_NAMES && FULL_NAMES[code]) ||
        code,
      order: index + 1,
      showZero: false
    };
  });
}

function normalizeDictSumHeader_(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');
}

function findDictSumColumn_(headers, names) {
  for (let i = 0; i < headers.length; i++) {
    if (names.indexOf(headers[i]) >= 0) return i;
  }
  return -1;
}

function parseDictSumBoolean_(value) {
  const s = String(value || '').trim().toLowerCase();

  return [
    'true',
    '1',
    'yes',
    'y',
    'так',
    'да',
    'показувати',
    '+'
  ].indexOf(s) >= 0;
}

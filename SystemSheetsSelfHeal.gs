const SYSTEM_SHEETS_REGISTRY_ = Object.freeze([
  {
    name: 'ACCESS',
    schemaKey: null,
    headers: [
      'Електронна пошта',
      'Телефон',
      'Роль',
      'Активний',
      'Примітка',
      "Ім'я",
      'Позивний',
      'Самоприв'язка дозволена',
      'Хеш поточного ключа',
      'Хеш попереднього ключа',
      'Востаннє бачили',
      'Востаннє оновлено',
      'Невдалі спроби',
      'Заблоковано до (мс)'
    ]
  },

  {
    name: 'LOG',
    schemaKey: null,
    headers: [
      'Мітка часу',
      'Дата звіту',
      'Аркуш',
      'Клітинка',
      'ПІБ',
      'Телефон',
      'Код',
      'Служба',
      'Місце',
      'Завдання',
      'Повідомлення',
      'Посилання'
    ]
  },

  {
    name: 'TEMPLATES',
    schemaKey: null,
    headers: [
      'КЛЮЧ',
      'ТЕКСТ',
      'АКТИВНИЙ',
      'ПІДКАЗКА ТЕГІВ',
      'ПРИМІТКА'
    ]
  },

  {
    name: 'AUDIT_LOG',
    schemaKey: null,
    headers: [
      'Мітка часу',
      'ID Операції',
      'Сценарій',
      'Рівень',
      'Статус',
      'Ініціатор',
      'Тестовий запуск',
      'Частково',
      'Зачеплені аркуші',
      'Зачеплені об'єкти',
      'Застосовані зміни',
      'Пропущені зміни',
      'Попередження',
      'Дані JSON',
      'Стан ДО',
      'Стан ПІСЛЯ',
      'Зміни JSON',
      'Діагностика JSON',
      'Повідомлення',
      'Помилка'
    ]
  },

  {
    name: 'ACTIVE_OPERATIONS',
    schemaKey: null,
    headers: [
      'ID Операції',
      'Сценарій',
      'Відбиток',
      'Статус',
      'Початок',
      'Останній сигнал',
      'Ініціатор',
      'Джерело запуску',
      'Закінчується о',
      'Власник блокування',
      'ID батьківської операції',
      'Нотатки',
      'Дані JSON'
    ]
  },

  {
    name: 'ALERTS_LOG',
    schemaKey: null,
    headers: [
      'Мітка часу',
      'Тип',
      'Важливість',
      'Дія',
      'Результат',
      'Роль',
      "Ім'я",
      'Ключ користувача',
      'Ел. пошта',
      'Джерело',
      'Повідомлення',
      'Деталі JSON'
    ]
  },

  {
    name: 'OPS_LOG',
    schemaKey: null,
    headers: [
      'Час початку',
      'Час завершення',
      'ID Операції',
      'ID батьківської операції',
      'Сценарій',
      'Вихідний сценарій',
      'Ініціатор',
      'Джерело запуску',
      'Статус',
      'Відбиток',
      'Зачеплені рядки',
      'Зачеплені об'єкти',
      'Результат перевірки',
      'Потрібен ремонт',
      'Помилка',
      'Причина переходу',
      'Нотатки',
      'Вирішено операцією (ID)',
      'Вирішено о',
      'Статус вирішення',
      'Останній сигнал',
      'Закінчується о',
      'Дані JSON',
      'Результат JSON',
      'Кількість чекпоїнтів'
    ]
  },

  {
    name: 'CHECKPOINTS',
    schemaKey: null,
    headers: [
      'ID Операції',
      'Індекс точки',
      'Оброблено до',
      'Останній об'єкт',
      'Останній рядок',
      'Мітка часу точки',
      'Дані точки',
      'СSnapshot перевірки'
    ]
  },

  {
    name: 'JOB_RUNTIME_LOG',
    schemaKey: null,
    headers: [
      'Час початку',
      'Час завершення',
      'Назва завдання',
      'Статус',
      'Джерело',
      'Тривалість (мс)',
      'Тестовий запуск',
      'ID операції',
      'Повідомлення',
      'Помилка',
      'Email ініціатора',
      "Ім'я ініціатора",
      'Роль ініціатора',
      'Позивний ініціатора',
      'Точка входу',
      'ID тригера',
      'Нотатки'
    ]
  },

  {
    name: 'PHONES',
    schemaKey: null,
    headers: [
      'ПІБ',
      'Телефон',
      'Роль',
      'День народження',
      'Запасний телефон'
    ]
  },

  {
    name: 'VACATIONS',
    schemaKey: null,
    headers: [
      'ПІБ',
      'Початок',
      'Кінець',
      'Номер',
      'Активна',
      'Сповістити',
      'Примітка'
    ]
  },

  {
    name: 'DICT_SUM',
    schemaKey: null,
    headers: [
      'Код',
      'Мітка',
      'Порядок',
      'Показувати нулі'
    ]
  },

  {
    name: 'DICT',
    schemaKey: null,
    headers: [
      'Код',
      'Служба',
      'Місце',
      'Завдання'
    ]
  },

  {
    name: 'SEND_PANEL',
    schemaKey: null,
    headers: [
      'ПІБ',
      'Телефон',
      'Код',
      'Завдання',
      'Статус',
      'Відправлено',
      'Дія'
    ]
  }
]);

);

function getAllSystemSheetNames_() {
  return SYSTEM_SHEETS_REGISTRY_.map(function(item) { return item.name; });
}

function _systemSheetRecordByName_(name) {
  const target = String(name || '').trim();
  for (let i = 0; i < SYSTEM_SHEETS_REGISTRY_.length; i++) {
    if (SYSTEM_SHEETS_REGISTRY_[i].name === target) return SYSTEM_SHEETS_REGISTRY_[i];
  }
  return null;
}const fields = (schema && schema.fields) || {};
  const names = Object.keys(fields);
  const headers = [];
  names.forEach(function(fieldName) {
    const field = fields[fieldName] || {};
    const col = Number(field.col) || 0;
    if (col < 1) return;
    headers[col - 1] = field.label || fieldName;
  });
  return headers.filter(function(v, i) { return i >= 0; });
}

function _ensureSheetSize_(sheet, minRows, minCols) {
  const rows = Math.max(Number(minRows) || 1, 1);
  const cols = Math.max(Number(minCols) || 1, 1);

  const curRows = Math.max(sheet.getMaxRows(), 1);
  const curCols = Math.max(sheet.getMaxColumns(), 1);

  if (curRows < rows) {
    sheet.insertRowsAfter(curRows, rows - curRows);
  }
  if (curCols < cols) {
    sheet.insertColumnsAfter(curCols, cols - curCols);
  }
}

function _applyBasicSystemSheetStandards_(sheet, headerRow, lastCol) {
  try {
    if (typeof applyFontStandardsToSheet_ === 'function') {
      applyFontStandardsToSheet_(sheet);
    }
  } catch (_) {}

  try {
    if (typeof applyColumnWidthsStandardsToSheet_ === 'function') {
      applyColumnWidthsStandardsToSheet_(sheet);
    }
  } catch (_) {}

  try {
    sheet.setFrozenRows(0);
    sheet.setFrozenColumns(0);
  } catch (_) {}

  try {
    if (typeof stage7ApplyTableTheme_ === 'function') {
      stage7ApplyTableTheme_(sheet, headerRow, Math.max(lastCol || 1, 1), { freeze: false });
    }
  } catch (_) {}
}

function _applyAccessCheckboxes_(sheet) {
  if (!sheet || sheet.getName() !== 'ACCESS') return;

  const lastRow = Math.max(sheet.getMaxRows(), 2);

  // enabled = col 4
  sheet.getRange(2, 4, lastRow - 1, 1).insertCheckboxes();

  // self_bind_allowed = col 8
  sheet.getRange(2, 8, lastRow - 1, 1).insertCheckboxes();
}

function ensureSystemSheetByName_(sheetName) {
  const record = _systemSheetRecordByName_(sheetName);
  if (!record) throw new Error('Unknown system sheet: ' + sheetName);

  const ss = SpreadsheetApp.getActive();
  let sheet = ss.getSheetByName(record.name);
  const created = !sheet;

  if (!sheet) {
    sheet = ss.insertSheet(record.name);
  }

  let headerRow = 1;
  let headers = [];
  let lastCol = 1;

  if (record.schemaKey && typeof getSheetSchema_ === 'function') {
    const schema = getSheetSchema_(record.schemaKey);
    headerRow = Math.max(Number(schema.headerRow) || 1, 1);
    headers = _buildHeadersFromSchema_(schema);
    lastCol = Math.max(typeof getSchemaLastColumn_ === 'function' ? getSchemaLastColumn_(schema) : headers.length, headers.length, 1);
  } else {
    headers = (record.headers || []).slice();
    lastCol = Math.max(headers.length, 1);
  }

  _ensureSheetSize_(sheet, Math.max(headerRow, 2), lastCol);

  if (headers.length) {
    while (headers.length < lastCol) headers.push('');
    sheet.getRange(headerRow, 1, 1, lastCol).setValues([headers]);
  }

  _applyBasicSystemSheetStandards_(sheet, headerRow, lastCol);

  if (record.name === 'ACCESS') {
    _applyAccessCheckboxes_(sheet);
  }

  return {
    name: record.name,
    created: created,
    headerRow: headerRow,
    columns: lastCol
  };
}

function ensureAllSystemSheets_() {
  const results = [];
  SYSTEM_SHEETS_REGISTRY_.forEach(function(record) {
    results.push(ensureSystemSheetByName_(record.name));
  });
  return results;
}
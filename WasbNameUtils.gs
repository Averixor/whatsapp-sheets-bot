/**
 * WASB name normalization helpers.
 * Compatibility helper for AccessControl tests and legacy callers.
 */

/**
 * Нормализует ФИО/имя человека для сравнения:
 * - убирает лишние пробелы;
 * - приводит неразрывные пробелы к обычным;
 * - унифицирует апострофы;
 * - приводит строку к нижнему регистру.
 *
 * @param {*} value
 * @return {string}
 */
function normalizeHumanName_(value) {
  if (value === null || value === undefined) {
    return '';
  }

  var text = String(value)
    .replace(/\u00A0/g, ' ')
    .replace(/[ʼ’`´]/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/\s*-\s*/g, '-')
    .trim();

  if (!text) {
    return '';
  }

  return text.toLowerCase();
}

/**
 * Публично-безопасный алиас для модулей, где нужен такой же результат.
 *
 * @param {*} value
 * @return {string}
 */
function normalizeHumanNameForCompare_(value) {
  return normalizeHumanName_(value);
}

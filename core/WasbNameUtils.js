/**
 * WASB name normalization helpers.
 * Compatibility helper for AccessControl tests and legacy callers.
 */

/**
 * Normalizes a person's name/FML for comparison:
 * - trims excess whitespace;
 * - converts non-breaking spaces to regular spaces;
 * - unifies apostrophe variants;
 * - lowercases the string.
 *
 * @param {*} value
 * @return {string}
 */
function normalizeHumanName_(value) {
  if (value === null || value === undefined) {
    return "";
  }

  var text = String(value)
    .replace(/\u00A0/g, " ")
    .replace(/[ʼ’`´]/g, "'")
    .replace(/\s+/g, " ")
    .replace(/\s*-\s*/g, "-")
    .trim();

  if (!text) {
    return "";
  }

  return text.toLowerCase();
}

/**
 * Public-safe alias for modules that need the same result.
 *
 * @param {*} value
 * @return {string}
 */
function normalizeHumanNameForCompare_(value) {
  return normalizeHumanName_(value);
}

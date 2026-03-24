/**
 * HtmlUtils.gs — canonical layer для HTML-екранування.
 */
const HtmlUtils_ = {
  escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  escapeAttr(value) {
    return this.escapeHtml(value);
  },

  escapeJsString(value) {
    return String(value ?? '')
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\r/g, '')
      .replace(/\n/g, '\\n');
  }
};

function escapeHtml_(text) {
  return HtmlUtils_.escapeHtml(text);
}

var _escapeHtml_ = escapeHtml_;
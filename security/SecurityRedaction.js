/**
 * SecurityRedaction.gs — log/audit sanitization helpers.
 */

const SecurityRedaction_ = (function() {
  function _maskPhone(value) {
    const raw = String(value || '');
    const digits = raw.replace(/\D/g, '');
    if (!digits) return raw;
    if (digits.length >= 12 && digits.slice(0, 3) === '380') {
      return '+380 ** *** ** ' + digits.slice(-2);
    }
    if (digits.length >= 4) {
      return '*'.repeat(Math.max(digits.length - 2, 2)) + digits.slice(-2);
    }
    return '*'.repeat(digits.length);
  }

  function _sha256Hex(value) {
    const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value || ''), Utilities.Charset.UTF_8);
    return bytes.map(function(b) {
      const v = (b + 256) % 256;
      return ('0' + v.toString(16)).slice(-2);
    }).join('');
  }

  function _redactMessage(value) {
    const text = String(value || '');
    if (!text) return '';
    const prefix = text.slice(0, 24).replace(/\s+/g, ' ').trim();
    return prefix + ' … #' + _sha256Hex(text).slice(0, 12);
  }

  function _redactWaLink(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    const withoutQuery = text.split('?')[0];
    return withoutQuery.replace(/(wa\.me\/)(\d{5,})/i, function(_, p1, p2) {
      return p1 + _maskPhone(p2).replace(/\D/g, '');
    });
  }

  function _redactValue(key, value) {
    const normalizedKey = String(key || '').toLowerCase();
    if (value === null || value === undefined) return value;
    if (Array.isArray(value)) return value.map(function(item) { return sanitizeObject(item, normalizedKey); });
    if (typeof value === 'object') return sanitizeObject(value, normalizedKey);
    if (/(^|_)(phone|mobile|tel|number)$/.test(normalizedKey)) return _maskPhone(value);
    if (/(message|text|body)$/i.test(normalizedKey)) return _redactMessage(value);
    if (/(^|_)(link|url|walink)$/.test(normalizedKey)) return _redactWaLink(value);
    return value;
  }

  function sanitizeObject(value, parentKey) {
    if (value === null || value === undefined) return value;
    if (Array.isArray(value)) return value.map(function(item) { return sanitizeObject(item, parentKey); });
    if (typeof value !== 'object') return _redactValue(parentKey, value);
    const out = {};
    Object.keys(value).forEach(function(key) {
      out[key] = _redactValue(key, value[key]);
    });
    return out;
  }

  function sanitizeLogEntry(entry) {
    const item = Object.assign({}, entry || {});
    if (Object.prototype.hasOwnProperty.call(item, 'phone')) item.phone = _maskPhone(item.phone);
    if (Object.prototype.hasOwnProperty.call(item, 'message')) item.message = _redactMessage(item.message);
    if (Object.prototype.hasOwnProperty.call(item, 'link')) item.link = _redactWaLink(item.link);
    return item;
  }

  function sanitizeAuditEntry(entry) {
    const item = Object.assign({}, entry || {});
    item.payload = sanitizeObject(item.payload, 'payload');
    item.before = sanitizeObject(item.before, 'before');
    item.after = sanitizeObject(item.after, 'after');
    item.changes = sanitizeObject(item.changes, 'changes');
    item.diagnostics = sanitizeObject(item.diagnostics, 'diagnostics');
    if (item.error) item.error = String(item.error);
    if (item.message) item.message = String(item.message);
    return item;
  }

  return {
    sanitizeLogEntry: sanitizeLogEntry,
    sanitizeAuditEntry: sanitizeAuditEntry,
    sanitizeObject: sanitizeObject,
    maskPhone: _maskPhone,
    redactMessage: _redactMessage,
    redactWaLink: _redactWaLink
  };
})();

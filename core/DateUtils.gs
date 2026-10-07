/**
 * DateUtils.gs — canonical layer для роботи з датами.
 * Усі нові сценарії мають спиратися саме на DateUtils_.
 */
const DateUtils_ = {
  isValidTimeZone(value) {
    const tz = String(value || '').trim();
    if (!tz) return false;
    try {
      Utilities.formatDate(new Date(0), tz, 'dd.MM.yyyy');
      return true;
    } catch (_) {
      return false;
    }
  },

  getTimeZone() {
    const candidates = [
      (typeof CONFIG === 'object' && CONFIG && CONFIG.TZ) ? CONFIG.TZ : '',
      (typeof Session !== 'undefined' && Session && typeof Session.getScriptTimeZone === 'function')
        ? Session.getScriptTimeZone()
        : '',
      'Europe/Kyiv',
      'Europe/Kiev'
    ];

    for (let i = 0; i < candidates.length; i++) {
      const tz = String(candidates[i] || '').trim();
      if (this.isValidTimeZone(tz)) return tz;
    }

    return 'Europe/Kyiv';
  },

  todayStr() {
    return Utilities.formatDate(new Date(), this.getTimeZone(), 'dd.MM.yyyy');
  },

  formatUaDate(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      throw new Error('[DateUtils_.formatUaDate] Передано невалідну дату');
    }
    return Utilities.formatDate(date, this.getTimeZone(), 'dd.MM.yyyy');
  },

  parseUaDate(dateStr) {
    if (!dateStr) return null;
    const source = String(dateStr || '').trim();
    const match = source.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (!match) return null;

    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    const dt = new Date(year, month - 1, day, 12, 0, 0, 0);

    if (isNaN(dt.getTime())) return null;
    if (dt.getFullYear() !== year || dt.getMonth() !== (month - 1) || dt.getDate() !== day) return null;

    return dt;
  },

  normalizeDate(value, displayValue) {
    if (value instanceof Date && !isNaN(value.getTime())) {
      return this.formatUaDate(value);
    }

    if (typeof value === 'number' && value > 25569 && value < 60000) {
      const dt = new Date((value - 25569) * 86400 * 1000);
      if (!isNaN(dt.getTime())) return this.formatUaDate(dt);
    }

    const source = String(displayValue || value || '').trim();
    if (!source) throw new Error('[DateUtils_.normalizeDate] Порожня дата');

    const createStrict = (year, month, day) => {
      const dt = new Date(year, month - 1, day, 12, 0, 0, 0);
      if (isNaN(dt.getTime())) return null;
      if (dt.getFullYear() !== year || dt.getMonth() !== (month - 1) || dt.getDate() !== day) return null;
      return this.formatUaDate(dt);
    };

    let match = source.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})$/);
    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      const year = String(match[3]).length === 2 ? parseInt('20' + match[3], 10) : parseInt(match[3], 10);
      const normalized = createStrict(year, month, day);
      if (normalized) return normalized;
    }

    match = source.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      const day = parseInt(match[3], 10);
      const normalized = createStrict(year, month, day);
      if (normalized) return normalized;
    }

    match = source.match(/^(\d{1,2})[.\-/](\d{1,2})$/);
    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      const year = new Date().getFullYear();
      const normalized = createStrict(year, month, day);
      if (normalized) return normalized;
    }

    throw new Error(`[DateUtils_.normalizeDate] Некоректна або неіснуюча дата: "${source}"`);
  },

  parseDateAny(value, displayValue) {
    if (value instanceof Date && !isNaN(value.getTime())) {
      const dt = new Date(value);
      dt.setHours(12, 0, 0, 0);
      return dt;
    }

    try {
      const normalized = this.normalizeDate(value, displayValue == null ? value : displayValue);
      return this.parseUaDate(normalized);
    } catch (_) {
      return null;
    }
  },

  isValidDate(value, displayValue) {
    return !!this.parseDateAny(value, displayValue);
  },

  toDayStart(value, displayValue) {
    const dt = this.parseDateAny(value, displayValue);
    if (!dt) return null;
    dt.setHours(0, 0, 0, 0);
    return dt;
  }
};
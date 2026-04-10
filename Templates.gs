/**
 * Templates.gs — шаблонизатор + доступ к листу TEMPLATES + универсальная сборка WA-ссылки
 *
 * Лист TEMPLATES: A=KEY, B=TEXT, C=ENABLED(checkbox), D=TAGS_HINT, E=NOTE
 */

const TEMPLATES_SHEET_NAME = 'TEMPLATES';
const TPL_CACHE_KEY = 'TPL_MAP_V1';
const TPL_CACHE_TTL_SEC = 600;

function _templatesCacheKey_() {
  try {
    if (typeof cacheKeyTemplates_ === 'function') {
      const key = cacheKeyTemplates_();
      if (key) return key;
    }
  } catch (e) {}
  return TPL_CACHE_KEY;
}

function clearTemplatesCache_() {
  try {
    CacheService.getScriptCache().removeAll([_templatesCacheKey_(), TPL_CACHE_KEY]);
    return true;
  } catch (e) {
    return false;
  }
}

function renderTemplate_(tpl, data) {
  tpl = String(tpl ?? '')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n');

  data = data || {};

  return tpl.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}|\{\s*([a-zA-Z0-9_]+)\s*\}/g, function(m, keyDouble, keySingle) {
    const key = keyDouble || keySingle || '';
    const v = data[key] ?? data[String(key).toLowerCase()] ?? data[String(key).toUpperCase()];
    return (v === undefined || v === null) ? '' : String(v);
  });
}

/** Нормализация ENABLED: checkbox boolean или "TRUE"/"1"/"YES" */
function _isEnabled_(v) {
  if (v === true) return true;
  if (v === false) return false;
  const s = String(v ?? '').trim().toUpperCase();
  return (s === 'TRUE' || s === '1' || s === 'YES' || s === 'Y' || s === 'ON');
}

/** Забираем карту шаблонов из листа (и кладём в Cache) */
function _loadTemplatesMap_() {
  const cache = CacheService.getScriptCache();
  const primaryKey = _templatesCacheKey_();
  const cacheKeys = [primaryKey, TPL_CACHE_KEY].filter(function(key, index, arr) {
    return !!key && arr.indexOf(key) === index;
  });

  for (let i = 0; i < cacheKeys.length; i++) {
    const cached = cache.get(cacheKeys[i]);
    if (!cached) continue;
    try {
      const parsed = JSON.parse(cached);
      if (parsed && typeof parsed === 'object') {
        if (cacheKeys[i] !== primaryKey) {
          try { cache.put(primaryKey, cached, TPL_CACHE_TTL_SEC); } catch (e) {}
        }
        return parsed;
      }
    } catch (e) {}
  }

  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(TEMPLATES_SHEET_NAME);
  if (!sh) return {}; // листа нет — вернём пусто (HealthCheck скажет как исправить)

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return {};

  const values = sh.getRange(2, 1, lastRow - 1, 5).getValues();

  const map = {};
  for (const row of values) {
    const key = String(row[0] ?? '').trim();
    if (!key) continue;

    const text = String(row[1] ?? '');
    const enabled = _isEnabled_(row[2]);

    map[key] = {
      key,
      text,
      enabled,
      tagsHint: String(row[3] ?? ''),
      note: String(row[4] ?? '')
    };
  }

  cache.put(primaryKey, JSON.stringify(map), TPL_CACHE_TTL_SEC);
  return map;
}

/** Получить текст шаблона: если ENABLED=false или пусто — вернуть '' */
function getTemplateText_(templateKey) {
  templateKey = String(templateKey ?? '').trim();
  if (!templateKey) return '';

  const map = _loadTemplatesMap_();
  const item = map[templateKey];
  if (!item) return '';

  if (!item.enabled) return '';
  const text = String(item.text ?? '');
  return text.trim() ? text : '';
}

/**
 * Универсальный “чистый код”: берём текст из TEMPLATES и строим wa.me ссылку.
 * Возвращает link или null (если шаблон выключен/пустой/нет телефона).
 */
function notifyWithTemplate_(templateKey, data, targetPhone) {
  templateKey = String(templateKey || '').trim();
  if (!templateKey) throw new Error('templateKey пустой');

  const tplText = getTemplateText_(templateKey);

  if (!tplText) {
    console.warn(`[SKIP] Template "${templateKey}" disabled (ENABLED=false / empty / not found).`);
    return null;
  }

  const message = renderTemplate_(tplText, data || {});
  if (!String(message).trim()) {
    console.warn(`[SKIP] Template "${templateKey}" rendered empty message.`);
    return null;
  }

  const phone = String(targetPhone || '').trim();
  const digits = phone.replace(/\D/g, '');
  if (!digits) {
    console.warn(`[SKIP] Template "${templateKey}" no valid targetPhone: "${phone}"`);
    return null;
  }

  const safeMsg =
    (typeof trimToEncoded_ === 'function' && typeof CONFIG === 'object' && CONFIG && CONFIG.MAX_WA_TEXT)
      ? trimToEncoded_(message, CONFIG.MAX_WA_TEXT)
      : message;

  return `https://wa.me/${digits}?text=${encodeURIComponent(String(safeMsg))}`;
}

/** Сброс кеша шаблонов (удобно после правок в TEMPLATES) */
function resetTemplatesCache_() {
  CacheService.getScriptCache().remove(TPL_CACHE_KEY);
  return true;
}

/** Smoke test */
function testNotifyWithTemplate_() {
  const key = 'VACATION_REMIND_PERSON';
  const data = {
    surname: 'Петренко',
    callsign: 'ГРАФ',
    rank: 'мол. сержант',
    vac_no: 'перша',
    date_start: '01.03.2026',
    date_end: '10.03.2026',
    days: '5'
  };
  const phone = '+380661234567';

  const link = notifyWithTemplate_(key, data, phone);
  console.log('--- TEST notifyWithTemplate_ ---');
  console.log('KEY:', key);
  console.log('LINK:', link);

  if (link && link.includes('wa.me/') && link.includes('text=')) {
    console.log('✓ OK: WA link built');
  } else {
    console.error('✕ FAIL: WA link not built');
  }

  return link;
}

// =========================
// STAGE 7 MANAGED TEMPLATE LAYER
// =========================

const STAGE7_INLINE_TEMPLATES_ = Object.freeze({
  DAY_SUMMARY_HEADER: 'Зведення за {date}',
  DETAILED_SUMMARY_HEADER: 'Детальне зведення за {date}',
  BIRTHDAY_REMINDER: 'Вітаю з днем народження, {name}!',
  SERVICE_NOTIFICATION: '{title}\n{body}',
  DIAGNOSTIC_REPORT: 'Діагностика {scenario}\nСтатус: {status}\nПовідомлення: {message}',
  REPAIR_REPORT: 'Repair report\nДата: {date}\nПроблем: {problems}\nВиправлено: {fixed}'
});

const Stage7Templates_ = (function() {
  function getTemplate(key) {
    const external = getTemplateText_(key);
    if (external) return external;
    return STAGE7_INLINE_TEMPLATES_[String(key || '').trim()] || '';
  }

  function listKeys() {
    const externalMap = _loadTemplatesMap_();
    return [...new Set(Object.keys(STAGE7_INLINE_TEMPLATES_).concat(Object.keys(externalMap || {})))].sort();
  }

  function render(key, data, options) {
    const opts = options || {};
    const tpl = getTemplate(key);
    if (!tpl) return '';
    const rendered = renderTemplate_(tpl, data || {});
    if (!opts.preview) return rendered;
    const max = Number(opts.maxLen) || STAGE7_CONFIG.TEMPLATE_PREVIEW_LIMIT;
    return rendered.length > max ? rendered.slice(0, max) + '…' : rendered;
  }

  function preview(key, data, options) {
    return render(key, data, Object.assign({}, options || {}, { preview: true }));
  }

  return {
    getTemplate: getTemplate,
    listKeys: listKeys,
    render: render,
    preview: preview
  };
})();

function stage7RenderTemplate_(templateKey, data, options) {
  return Stage7Templates_.render(templateKey, data || {}, options || {});
}

function stage7PreviewTemplate_(templateKey, data, options) {
  return Stage7Templates_.preview(templateKey, data || {}, options || {});
}

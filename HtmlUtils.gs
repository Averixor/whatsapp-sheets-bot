/**
 * HtmlUtils.gs — canonical layer для безпечного екранування.
 *
 * Канонічне імʼя в цьому проєкті: HtmlUtils_
 *
 * Призначення:
 * - HTML: текст, атрибути, коментарі
 * - JavaScript: рядки
 * - URL: параметри
 * - CSS: значення
 * - RegExp: безпечне створення регулярних виразів із введення користувача
 * - Text cleanup: видалення HTML-тегів
 * - XML: CDATA-обгортка
 * - Utility: нормалізація пробілів, генерація HTML id/name, безпечна збірка атрибутів
 *
 * ВАЖЛИВО:
 * - Не перейменовувати HtmlUtils_ на HtmlUtils.
 * - Diagnostics, SmokeTests, MonthSheets, Summaries та інші модулі вже очікують HtmlUtils_.
 * - Глобальні wrappers escapeHtml_ та _escapeHtml_ залишені для сумісності.
 */

(function(root) {
  'use strict';

  if (root.HtmlUtils_ && typeof root.HtmlUtils_.escapeHtml === 'function') {
    return;
  }

  function repeatString_(value, count) {
    var str = String(value);
    var n = Number(count) || 0;

    if (n <= 0) return '';

    if (typeof str.repeat === 'function') {
      return str.repeat(n);
    }

    return new Array(n + 1).join(str);
  }

  function escapeHtml(value) {
    if (value === null || value === undefined) return '';

    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }

  function escapeHtmlComment(value) {
    if (value === null || value === undefined) return '';

    return String(value)
      .replace(/--/g, '- -')
      .replace(/-$/g, '- ');
  }

  function escapeJsString(value) {
    if (value === null || value === undefined) return '';

    return String(value)
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"')
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029')
      .replace(/</g, '\\x3C')
      .replace(/>/g, '\\x3E')
      .replace(/&/g, '\\x26');
  }

  function escapeUrl(value) {
    if (value === null || value === undefined) return '';
    return encodeURIComponent(String(value));
  }

  function escapeCssString(value) {
    if (value === null || value === undefined) return '';

    return String(value)
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\a ')
      .replace(/\r/g, '\\d ')
      .replace(/</g, '\\3c ')
      .replace(/>/g, '\\3e ');
  }

  function unescapeHtml(html) {
    if (html === null || html === undefined) return '';

    return String(html)
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&');
  }

  function escapeForRegExp(value) {
    if (value === null || value === undefined) return '';

    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function normalizeRegExpFlags_(flags) {
    if (flags === null || flags === undefined) return '';

    var raw = String(flags);
    var result = '';
    var allowed = {
      g: true,
      i: true,
      m: true,
      s: true,
      u: true,
      y: true
    };

    for (var i = 0; i < raw.length; i++) {
      var flag = raw.charAt(i);

      if (!allowed[flag]) {
        throw new Error('Unsupported RegExp flag: ' + flag);
      }

      if (result.indexOf(flag) === -1) {
        result += flag;
      }
    }

    return result;
  }

  function toRegExp(value, flags) {
    return new RegExp(escapeForRegExp(value), normalizeRegExpFlags_(flags));
  }

  function stripTags(html) {
    if (html === null || html === undefined) return '';

    return String(html)
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]*>/g, '');
  }

  function normalizeAllowedTags_(allowedTags) {
    var source = Array.isArray(allowedTags) ? allowedTags : [];
    var result = {};

    source.forEach(function(tag) {
      var clean = String(tag || '')
        .toLowerCase()
        .replace(/[^a-z0-9:-]/g, '');

      if (clean) {
        result[clean] = true;
      }
    });

    return result;
  }

  function stripTagsExcept(html, allowedTags) {
    if (html === null || html === undefined) return '';

    var allowed = normalizeAllowedTags_(allowedTags);

    return String(html)
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<\/?([a-zA-Z][a-zA-Z0-9:-]*)(?:\s[^>]*)?>/g, function(match, tagName) {
        var tag = String(tagName || '').toLowerCase();

        if (!allowed[tag]) {
          return '';
        }

        if (/^<\//.test(match)) {
          return '</' + tag + '>';
        }

        return '<' + tag + '>';
      });
  }

  function escapeHtmlPreserveWhitespace(value) {
    if (value === null || value === undefined) return '';

    return escapeHtml(value)
      .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;')
      .replace(/ {2,}/g, function(match) {
        return repeatString_('&nbsp;', match.length);
      })
      .replace(/\n/g, '<br>\n');
  }

  function wrapInCdata(value) {
    var str = value === null || value === undefined ? '' : String(value);

    if (str.indexOf(']]>') !== -1) {
      str = str.replace(/]]>/g, ']]]]><![CDATA[>');
    }

    return '<![CDATA[' + str + ']]>';
  }

  function normalizeWhitespace(value) {
    if (value === null || value === undefined) return '';

    return String(value)
      .replace(/\s+/g, ' ')
      .trim();
  }

  function safeId(prefix) {
    var rawPrefix = prefix === null || prefix === undefined ? '' : String(prefix);

    var cleanPrefix = rawPrefix
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/^_+/, '');

    if (!cleanPrefix) {
      cleanPrefix = 'id';
    }

    if (!/^[a-zA-Z]/.test(cleanPrefix)) {
      cleanPrefix = 'id_' + cleanPrefix;
    }

    return cleanPrefix + '_' + Math.random().toString(36).substring(2, 10);
  }

  function isHtmlEscaped(value) {
    if (typeof value !== 'string') return false;

    return /&(?:amp|lt|gt|quot|#39);/.test(value);
  }

  function normalizeAttributeName_(name) {
    var attr = String(name || '').trim();

    if (!attr) return '';

    if (!/^[a-zA-Z_:][a-zA-Z0-9:._-]*$/.test(attr)) {
      return '';
    }

    var lower = attr.toLowerCase();

    if (/^on/.test(lower)) {
      return '';
    }

    if (lower === 'srcdoc') {
      return '';
    }

    return attr;
  }

  function isUriAttribute_(attr) {
    var lower = String(attr || '').toLowerCase();

    return lower === 'href' ||
      lower === 'src' ||
      lower === 'action' ||
      lower === 'formaction' ||
      lower === 'poster' ||
      lower === 'xlink:href';
  }

  function isSafeUriValue_(value) {
    var raw = value === null || value === undefined ? '' : String(value).trim();

    if (!raw) return true;

    var lower = raw.toLowerCase();

    if (lower.charAt(0) === '#') return true;
    if (lower.charAt(0) === '/') return true;
    if (lower.indexOf('./') === 0) return true;
    if (lower.indexOf('../') === 0) return true;
    if (lower.indexOf('?') === 0) return true;

    if (/^(https?:|mailto:|tel:)/i.test(lower)) return true;

    return false;
  }

  function buildSafeAttributes(attrs) {
    if (!attrs || typeof attrs !== 'object') return '';

    return Object.keys(attrs)
      .map(function(key) {
        var attr = normalizeAttributeName_(key);
        var value = attrs[key];

        if (!attr) return '';
        if (value === null || value === undefined || value === false) return '';

        if (value === true) {
          return ' ' + attr;
        }

        if (Array.isArray(value)) {
          value = value
            .filter(function(item) {
              return item !== null && item !== undefined && item !== false;
            })
            .join(' ');
        }

        if (isUriAttribute_(attr) && !isSafeUriValue_(value)) {
          return '';
        }

        return ' ' + attr + '="' + escapeAttr(value) + '"';
      })
      .join('');
  }

  function escapeDeep(value) {
    var stack = [];

    function isCircular_(item) {
      return stack.indexOf(item) !== -1;
    }

    function walk(current) {
      if (current === null || current === undefined) return current;

      if (typeof current === 'string') {
        return escapeHtml(current);
      }

      if (Array.isArray(current)) {
        if (isCircular_(current)) return '[Circular]';

        stack.push(current);

        var arr = current.map(function(item) {
          return walk(item);
        });

        stack.pop();

        return arr;
      }

      if (Object.prototype.toString.call(current) === '[object Date]') {
        return new Date(current.getTime());
      }

      if (typeof current === 'object') {
        if (isCircular_(current)) return '[Circular]';

        stack.push(current);

        var result = {};

        Object.keys(current).forEach(function(key) {
          result[key] = walk(current[key]);
        });

        stack.pop();

        return result;
      }

      return current;
    }

    return walk(value);
  }

  function safeHtml(strings) {
    var values = Array.prototype.slice.call(arguments, 1);
    var result = String(strings[0] || '');

    for (var i = 0; i < values.length; i++) {
      result += escapeHtml(values[i]) + String(strings[i + 1] || '');
    }

    return result;
  }

  root.HtmlUtils_ = {
    escapeHtml: escapeHtml,
    escapeAttr: escapeAttr,
    escapeHtmlComment: escapeHtmlComment,
    escapeJsString: escapeJsString,
    escapeUrl: escapeUrl,
    escapeCssString: escapeCssString,
    unescapeHtml: unescapeHtml,
    escapeForRegExp: escapeForRegExp,
    toRegExp: toRegExp,
    stripTags: stripTags,
    stripTagsExcept: stripTagsExcept,
    escapeHtmlPreserveWhitespace: escapeHtmlPreserveWhitespace,
    wrapInCdata: wrapInCdata,
    normalizeWhitespace: normalizeWhitespace,
    safeId: safeId,
    isHtmlEscaped: isHtmlEscaped,
    buildSafeAttributes: buildSafeAttributes,
    escapeDeep: escapeDeep,
    safeHtml: safeHtml
  };

})(typeof globalThis !== 'undefined' ? globalThis : this);

function escapeHtml_(text) {
  return HtmlUtils_.escapeHtml(text);
}

var _escapeHtml_ = escapeHtml_;

/**
 * DialogTemplates.gs — stage 5 presentation templates.
 */

const DialogTemplates_ = (function () {
  function esc(value) {
    return PreviewLinkService_.escapeHtml(value);
  }

  function copyScript() {
    return `
      function fallbackCopy(text) {
        const el = document.createElement('textarea');
        el.value = text;
        el.style.position = 'fixed';
        el.style.left = '-9999px';
        document.body.appendChild(el);
        el.focus();
        el.select();
        try { document.execCommand('copy'); } catch (e) {}
        document.body.removeChild(el);
      }
      
      function copyTextSmart(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          return navigator.clipboard.writeText(text).catch(function() { fallbackCopy(text); });
        }
        fallbackCopy(text);
        return Promise.resolve();
      }
    `;
  }

  function baseShell(title, body, width, height) {
    return HtmlService.createHtmlOutput(`
      <div style="font-family:'Segoe UI',Arial,sans-serif;padding:18px;color:#111827;">
        <h3 style="margin:0 0 14px 0;color:#065f46;">${esc(title)}</h3>
        ${body}
      </div>
      <script>${copyScript()}</script>
    `).setWidth(width || 520).setHeight(height || 420);
  }

  function linkDialog(data) {
    const safe = PreviewLinkService_.safeWaLink((data && data.url) || '');
    const body = `
      <div style="text-align:center;padding:8px 4px 2px 4px;">
        <p style="margin:0 0 14px 0;color:#334155;">${esc((data && data.description) || 'Натисніть, щоб відкрити WhatsApp')}</p>
        <a href="${safe}" target="WAPB_WHATSAPP_SENDER_TAB" style="display:inline-block;padding:12px 24px;background:#25D366;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;">
          📱 ВІДКРИТИ
        </a>
      </div>
    `;
    return baseShell((data && data.title) || 'Посилання', body, 380, 180);
  }

  function singleMessage(data) {
    const item = (data && data.item) || {};
    const safe = PreviewLinkService_.safeWaLink(item.link || '');
    const body = `
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:14px;">
        <div style="margin-bottom:6px;"><b>📅 Дата:</b> ${esc(item.reportDateStr || '')}</div>
        <div style="margin-bottom:6px;"><b>👤 ПІБ:</b> ${esc(item.fio || '')}</div>
        <div style="margin-bottom:6px;"><b>📞 Телефон:</b> ${esc(item.phone || '')}</div>
        <div><b>🆔 Код / клітинка:</b> ${esc(item.code || '')} ${item.cell ? '(' + esc(item.cell) + ')' : ''}</div>
      </div>
      <textarea id="msgText" readonly style="width:100%;height:180px;border:1px solid #cbd5e1;border-radius:10px;padding:12px;box-sizing:border-box;">${esc(item.message || '')}</textarea>
      <div style="display:flex;gap:10px;justify-content:center;margin-top:14px;">
        <button onclick="copyTextSmart(document.getElementById('msgText').value)" style="padding:10px 16px;border:none;border-radius:10px;background:#0ea5e9;color:#fff;font-weight:700;cursor:pointer;">📋 Копіювати</button>
        <a href="${safe}" target="WAPB_WHATSAPP_SENDER_TAB" style="display:inline-block;padding:10px 16px;border-radius:10px;background:#25D366;color:#fff;text-decoration:none;font-weight:700;">📱 Відкрити</a>
      </div>
    `;
    return baseShell((data && data.title) || 'Повідомлення', body, 620, 480);
  }

  function multipleMessages(data) {
    const items = Array.isArray(data && data.items) ? data.items : [];
    const errors = Array.isArray(data && data.errors) ? data.errors : [];
    const cards = items.map(function (item, index) {
      return `
        <div style="border:1px solid #e2e8f0;border-radius:12px;padding:12px;margin-bottom:10px;background:#fff;">
          <div style="font-weight:700;color:#0f172a;margin-bottom:4px;">${index + 1}. ${esc(item.fio || '')}</div>
          <div style="font-size:12px;color:#475569;margin-bottom:8px;">${esc(item.phone || '')} · ${esc(item.code || '')} ${item.cell ? '· ' + esc(item.cell) : ''}</div>
          <textarea readonly style="width:100%;height:92px;border:1px solid #cbd5e1;border-radius:8px;padding:8px;box-sizing:border-box;">${esc(item.message || '')}</textarea>
          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px;">
            <button onclick="copyTextSmart(this.parentNode.previousElementSibling.value)" style="padding:8px 12px;border:none;border-radius:8px;background:#0ea5e9;color:#fff;cursor:pointer;">📋</button>
            <a href="${PreviewLinkService_.safeWaLink(item.link || '')}" target="WAPB_WHATSAPP_SENDER_TAB" style="display:inline-block;padding:8px 12px;border-radius:8px;background:#25D366;color:#fff;text-decoration:none;">📱</a>
          </div>
        </div>
      `;
    }).join('');

    const errorsBlock = errors.length ? `
      <div style="border:1px solid #fecaca;background:#fff1f2;border-radius:12px;padding:12px;margin-bottom:12px;">
        <div style="font-weight:700;color:#991b1b;margin-bottom:8px;">⁈ Помилки підготовки: ${errors.length}</div>
        ${errors.map(function (item) {
      return `<div style="font-size:12px;color:#7f1d1d;margin-bottom:4px;">${esc(item.cell || '')} ${esc(item.message || '')}</div>`;
    }).join('')}
      </div>
    ` : '';

    const body = `
      <div style="margin-bottom:10px;color:#334155;">Підготовлено повідомлень: <b>${items.length}</b></div>
      ${errorsBlock}
      <div style="max-height:430px;overflow:auto;padding-right:2px;">${cards || '<div style="color:#64748b;">Немає підготовлених повідомлень</div>'}</div>
    `;
    return baseShell((data && data.title) || 'Пакет повідомлень', body, 760, 620);
  }

  function summaryDialog(data) {
    const item = data || {};
    const body = `
      <div style="margin-bottom:10px;color:#334155;">Дата: <b>${esc(item.date || '')}</b></div>
      <textarea id="summaryText" readonly style="width:100%;height:260px;border:1px solid #cbd5e1;border-radius:10px;padding:12px;box-sizing:border-box;">${esc(item.summary || '')}</textarea>
      <div style="display:flex;gap:10px;justify-content:center;margin-top:14px;">
        <button onclick="copyTextSmart(document.getElementById('summaryText').value)" style="padding:10px 16px;border:none;border-radius:10px;background:#0ea5e9;color:#fff;font-weight:700;cursor:pointer;">📋 Копіювати</button>
        ${item.link ? `<a href="${PreviewLinkService_.safeWaLink(item.link)}" target="WAPB_WHATSAPP_SENDER_TAB" style="display:inline-block;padding:10px 16px;border-radius:10px;background:#25D366;color:#fff;text-decoration:none;font-weight:700;">📱 Відкрити</a>` : ''}
      </div>
    `;
    return baseShell(item.title || 'Зведення', body, 620, 520);
  }

  return {
    linkDialog: linkDialog,
    singleMessage: singleMessage,
    multipleMessages: multipleMessages,
    summaryDialog: summaryDialog
  };
})();
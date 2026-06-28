/************ ЗВЕДЕННЯ ДНЯ — сумісність і допоміжні UI ************/

/**
 * Коротке зведення: Report_DailySimple.gs
 * Детальне зведення: Report_DailyDetailed.gs
 * Читання формульного блоку: Report_SummaryData.gs
 */

function buildDaySummaryForColumn_(sheet, col) {
  return buildSimpleDailySummaryFromFormulaBlock_(sheet, col);
}

/**
 * Побудова повідомлення через шаблони
 */
function buildMessage_({ reportDate, service, place, tasks, brDays, minimal }) {
  const d = reportDate || "";
  const br = Number(brDays) || 0;

  function _fallback_() {
    if (minimal) {
      return [
        d,
        "Днів на БР: " + br,
        "",
        "*(ʢ ￣︿￣)*   *⨦*   *(￣︿￣ ʡ)*",
      ].join("\n");
    }

    const lines = [d, ""];

    if (service) {
      lines.push("Вид служби: " + service);
    }

    lines.push("Днів на БР: " + br);

    if (place) {
      lines.push("\nМісце виконання:\n" + place);
    }

    if (tasks) {
      lines.push("\nВиконані завдання:\n" + tasks);
    }

    lines.push("\n*(ʢ ￣︿￣)*   *⨦*   *(￣︿￣ ʡ)*");

    return lines.join("\n");
  }

  function _cleanEnd_(value) {
    return String(value || "").replace(/\s+$/g, "");
  }

  function _line_(value) {
    const text = _cleanEnd_(value);
    return text ? text + "\n" : "";
  }

  function _block_(value) {
    const text = _cleanEnd_(value);
    return text ? text + "\n\n" : "";
  }

  try {
    if (minimal) {
      const template = getTemplateText_("MESSAGE_MINIMAL");

      if (template) {
        return renderTemplate_(template, {
          date: d,
          brDays: String(br),
        });
      }

      return _fallback_();
    }

    const mainTemplate = getTemplateText_("MESSAGE_FULL");

    if (!mainTemplate) {
      return _fallback_();
    }

    const serviceTemplate = getTemplateText_("MESSAGE_SERVICE_LINE");
    const brTemplate = getTemplateText_("MESSAGE_BR_LINE");
    const placeTemplate = getTemplateText_("MESSAGE_PLACE_BLOCK");
    const tasksTemplate = getTemplateText_("MESSAGE_TASKS_BLOCK");

    const serviceLine = service
      ? _line_(
          serviceTemplate
            ? renderTemplate_(serviceTemplate, { service: service })
            : "Вид служби: " + service,
        )
      : "";

    const brLine = _line_(
      brTemplate
        ? renderTemplate_(brTemplate, { brDays: String(br) })
        : "Днів на БР: " + br,
    );

    const placeBlock = place
      ? _block_(
          placeTemplate
            ? renderTemplate_(placeTemplate, { place: place })
            : "Місце виконання:\n" + place,
        )
      : "";

    const tasksBlock = tasks
      ? _block_(
          tasksTemplate
            ? renderTemplate_(tasksTemplate, { tasks: tasks })
            : "Виконані завдання:\n" + tasks,
        )
      : "";

    return renderTemplate_(mainTemplate, {
      date: d,
      serviceLine: serviceLine,
      brLine: brLine,
      placeBlock: placeBlock,
      tasksBlock: tasksBlock,
      service: service || "",
      brDays: String(br),
      place: place || "",
      tasks: tasks || "",
    });
  } catch (e) {
    console.warn("Помилка в buildMessage_, fallback:", e);
    return _fallback_();
  }
}

function showDetailedSummaryDialog_(date, text) {
  const safe = HtmlUtils_.escapeHtml(text);
  const html = HtmlService.createHtmlOutput(
    [
      '<div style="font-family:Arial;padding:16px">',
      '<h3 style="color:#075e54">📊 Детальне зведення за ',
      HtmlUtils_.escapeHtml(date),
      "</h3>",
      '<div style="margin-bottom:12px">',
      '<button onclick="copyText()" style="padding:8px 16px;background:#25D366;color:white;border:none;border-radius:6px;cursor:pointer">📋 Копіювати</button>',
      "</div>",
      '<textarea id="t" style="width:100%;height:350px;padding:10px;border:1px solid #ddd;border-radius:8px;" readonly>',
      safe,
      "</textarea>",
      "<script>",
      "function copyText() {",
      "  const t = document.getElementById('t');",
      "  t.select(); t.setSelectionRange(0,999999);",
      "  navigator.clipboard.writeText(t.value).then(()=>alert('✓ Скопійовано'));",
      "}",
      "</script>",
      "</div>",
    ].join(""),
  )
    .setWidth(700)
    .setHeight(500);
  SpreadsheetApp.getUi().showModalDialog(html, "📊 Детальне зведення");
}

/**
 * Stage7TestRunner.Ui.gs — menus, dialog, results sheet reset.
 */

function stage7TestRunnerAttachUi_(ctx) {
  ctx.showDialog = function(report) {
    if (
      typeof _stage7TestRunnerAssertAdmin_ === "function" &&
      !_stage7TestRunnerAssertAdmin_("show test runner dialog")
    ) {
      return null;
    }

    if (!report) {
      report = ctx.runFast({
        writeToSheet: true,
        writeToLogger: true,
        useLock: false,
      });
    }

    var html = ctx.buildDialogHtml_(report);
    SpreadsheetApp.getUi().showModalDialog(
      HtmlService.createHtmlOutput(html).setWidth(980).setHeight(720),
      "WASB Test Runner",
    );

    if (report && report.done === true)
      ctx.normalizeTestResultsDetailsForRun_(report.runId);
    return report;
  }

  ctx.addMenu = function() {
    if (
      typeof _stage7TestRunnerCanUseUi_ === "function" &&
      !_stage7TestRunnerCanUseUi_()
    ) {
      return { ok: false, menu: "WASB Tests", skipped: "access-denied" };
    }

    SpreadsheetApp.getUi()
      .createMenu("WASB Tests")
      .addItem("Усі тести проєкту", "runStage7AllProjectTests")
      .addItem("Швидка перевірка", "runStage7TestsFast")
      .addSeparator()
      .addItem("Тільки Health", "runStage7HealthOnly")
      .addItem("Тільки Diagnostics", "runStage7DiagnosticsOnly")
      .addItem("Тільки Smoke/Regression", "runStage7SmokeOnly")
      .addItem("Тільки Access", "runStage7AccessOnly")
      .addItem("Тільки Domain", "runStage7DomainOnly")
      .addSeparator()
      .addItem("Показати звіт", "showStage7TestReport")
      .addItem("Очистити лист TEST_RESULTS", "resetStage7TestResultsSheet")
      .addSeparator()
      .addItem("Встановити onOpen-тригер меню", "installStage7TestRunner")
      .addToUi();

    return { ok: true, menu: "WASB Tests" };
  }

  ctx.installOpenTrigger = function() {
    var triggers = ScriptApp.getProjectTriggers();
    var exists = false;

    for (var i = 0; i < triggers.length; i++) {
      if (
        typeof triggers[i].getHandlerFunction === "function" &&
        triggers[i].getHandlerFunction() === "stage7TestRunnerOnOpen"
      ) {
        exists = true;
        break;
      }
    }

    if (!exists) {
      ScriptApp.newTrigger("stage7TestRunnerOnOpen")
        .forSpreadsheet(getWasbSpreadsheet_())
        .onOpen()
        .create();
    }

    ctx.addMenu();
    return { ok: true, installed: true, handler: "stage7TestRunnerOnOpen" };
  }

  ctx.resetResultsSheet = function() {
    var sheet = ctx.getOrCreateSheet_(ctx.DEFAULT_RESULT_SHEET_NAME);
    sheet.clear();
    ctx.ensureResultHeader_(sheet);
    return { ok: true, sheetName: ctx.DEFAULT_RESULT_SHEET_NAME };
  }

  ctx.buildDialogHtml_ = function(report) {
    var statusColor = report.ok ? "#0f7b3f" : "#9b1c1c";
    var statusText = report.ok ? "PASS" : "FAIL";
    var rows = (report.results || [])
      .map(function (item) {
        return (
          "<tr>" +
          "<td>" +
          HtmlUtils_.escapeHtml(item.group) +
          "</td>" +
          "<td>" +
          HtmlUtils_.escapeHtml(item.level) +
          "</td>" +
          "<td>" +
          HtmlUtils_.escapeHtml(item.name) +
          "</td>" +
          "<td>" +
          HtmlUtils_.escapeHtml(item.functionName) +
          "</td>" +
          '<td class="' +
          HtmlUtils_.escapeHtml(String(item.status).toLowerCase()) +
          '">' +
          HtmlUtils_.escapeHtml(item.status) +
          "</td>" +
          "<td>" +
          HtmlUtils_.escapeHtml(String(item.durationMs)) +
          "</td>" +
          "<td>" +
          HtmlUtils_.escapeHtml(item.message || "") +
          "</td>" +
          "</tr>"
        );
      })
      .join("");

    var warnings = "";
    if (report.warnings && report.warnings.length > 0) {
      warnings =
        '<div class="warnings">' +
        report.warnings
          .map(function (warning) {
            return "<div>" + HtmlUtils_.escapeHtml(warning) + "</div>";
          })
          .join("") +
        "</div>";
    }

    return (
      '<!doctype html><html><head><base target="_top"><meta charset="UTF-8"><style>' +
      "body{font-family:Arial,sans-serif;background:#111827;color:#e5e7eb;margin:0;padding:18px;}" +
      "h1{font-size:22px;margin:0 0 12px;}.badge{display:inline-block;padding:6px 12px;border-radius:999px;background:" +
      statusColor +
      ";color:#fff;font-weight:700;}" +
      ".grid{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin:16px 0;}.card{background:#1f2937;border:1px solid #374151;border-radius:12px;padding:12px;}" +
      ".label{color:#9ca3af;font-size:12px;margin-bottom:6px;}.value{font-size:18px;font-weight:700;}.warnings{background:#3b2f0b;border:1px solid #92400e;color:#fde68a;border-radius:12px;padding:10px;margin:12px 0;font-size:13px;}" +
      "table{width:100%;border-collapse:collapse;background:#111827;border:1px solid #374151;}th,td{border-bottom:1px solid #374151;padding:8px;text-align:left;font-size:12px;vertical-align:top;}th{background:#1f2937;color:#f9fafb;position:sticky;top:0;}" +
      ".pass,.ok{color:#22c55e;font-weight:700;}.fail{color:#ef4444;font-weight:700;}.warn{color:#f59e0b;font-weight:700;}.skipped{color:#93c5fd;font-weight:700;}.footer{margin-top:14px;color:#9ca3af;font-size:12px;}" +
      "</style></head><body>" +
      '<h1>WASB Project Test Runner <span class="badge">' +
      statusText +
      "</span></h1>" +
      '<div class="grid">' +
      '<div class="card"><div class="label">Total</div><div class="value">' +
      report.counts.total +
      "</div></div>" +
      '<div class="card"><div class="label">Passed</div><div class="value">' +
      report.counts.passed +
      "</div></div>" +
      '<div class="card"><div class="label">Failed</div><div class="value">' +
      report.counts.failed +
      "</div></div>" +
      '<div class="card"><div class="label">Warnings</div><div class="value">' +
      report.counts.warnings +
      "</div></div>" +
      '<div class="card"><div class="label">Skipped</div><div class="value">' +
      report.counts.skipped +
      "</div></div>" +
      '<div class="card"><div class="label">Discovered</div><div class="value">' +
      report.counts.discovered +
      "</div></div>" +
      "</div>" +
      warnings +
      "<table><thead><tr><th>Group</th><th>Level</th><th>Name</th><th>Function</th><th>Status</th><th>ms</th><th>Message</th></tr></thead><tbody>" +
      rows +
      "</tbody></table>" +
      '<div class="footer">RunId: ' +
      HtmlUtils_.escapeHtml(report.runId) +
      " | Mode: " +
      HtmlUtils_.escapeHtml(report.mode) +
      " | Started: " +
      HtmlUtils_.escapeHtml(report.startedAt) +
      " | Finished: " +
      HtmlUtils_.escapeHtml(report.finishedAt) +
      "</div>" +
      "</body></html>"
    );
  }
}

/**
 * Stage7TestRunner.Sheet.gs — TEST_RESULTS sheet IO.
 */

function stage7TestRunnerAttachSheet_(ctx) {
  ctx.writeReportToSheet_ = function(report, sheetName) {
    var sheet = ctx.getOrCreateSheet_(sheetName);
    ctx.ensureResultHeader_(sheet);

    var rows = report.results.map(function (item) {
      return [
        report.runId,
        report.mode,
        report.startedAt,
        report.finishedAt,
        report.durationMs,
        item.group,
        item.level,
        item.id,
        item.name,
        item.functionName,
        item.status,
        item.severity,
        item.discovered ? "yes" : "no",
        item.durationMs,
        item.message,
        ctx.safeJson_(item.details, 45000),
        item.errorStack || "",
      ];
    });

    if (rows.length > 0) {
      var startRow = sheet.getLastRow() + 1;
      sheet.getRange(startRow, 1, rows.length, 17).setValues(rows);
      ctx.styleResultRows_(sheet, startRow, rows.length);
    }

    try {
      sheet.autoResizeColumns(1, 17);
    } catch (error) {}
  }

  ctx.ensureResultHeader_ = function(sheet) {
    if (sheet.getLastRow() > 0) return;

    sheet
      .getRange(1, 1, 1, 17)
      .setValues([
        [
          "RunId",
          "Mode",
          "StartedAt",
          "FinishedAt",
          "RunDurationMs",
          "Group",
          "Level",
          "Id",
          "Name",
          "FunctionName",
          "Status",
          "Severity",
          "Discovered",
          "TaskDurationMs",
          "Message",
          "DetailsJson",
          "ErrorStack",
        ],
      ]);

    ctx.styleResultsSheet_(sheet);
  }

  ctx.getOrCreateSheet_ = function(sheetName) {
    var ss = getWasbSpreadsheet_();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) sheet = ss.insertSheet(sheetName);
    return sheet;
  }

  ctx.styleResultsSheet_ = function(sheet) {
    sheet.setFrozenRows(1);
    var headerRange = sheet.getRange(1, 1, 1, 17);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#111827");
    headerRange.setFontColor("#ffffff");
    headerRange.setHorizontalAlignment("center");
    sheet.getRange(1, 1, sheet.getMaxRows(), 17).setVerticalAlignment("middle");
  }

  ctx.styleResultRows_ = function(sheet, startRow, rowCount) {
    if (rowCount <= 0) return;

    var statusValues = sheet.getRange(startRow, 11, rowCount, 1).getValues();
    for (var i = 0; i < statusValues.length; i++) {
      var row = startRow + i;
      var status = String(statusValues[i][0] || "").toUpperCase();
      var range = sheet.getRange(row, 1, 1, 17);

      if (status === "PASS") range.setBackground("#ecfdf5");
      else if (status === "FAIL") range.setBackground("#fef2f2");
      else if (status === "WARN") range.setBackground("#fffbeb");
      else if (status === "SKIPPED") range.setBackground("#eff6ff");
    }
  }
}

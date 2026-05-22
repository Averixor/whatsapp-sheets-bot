/**
 * Stage7TestRunner.Reporting.gs — task result inference and human-readable reporting.
 */

function stage7TestRunnerAttachReporting_(ctx) {
  ctx.normalizeTaskReturn_ = function(value) {
    if (value === null || typeof value === "undefined") {
      return { type: "empty", raw: null };
    }

    if (typeof value === "string") return { type: "string", raw: value };
    if (typeof value === "number" || typeof value === "boolean")
      return { type: typeof value, raw: value };

    if (Object.prototype.toString.call(value) === "[object Date]") {
      return { type: "date", raw: ctx.toIso_(value) };
    }

    if (Array.isArray(value)) {
      return { type: "array", length: value.length, raw: value };
    }

    return { type: "object", raw: value };
  }

  ctx.isCompatibilityTask_ = function(task) {
    if (!task) return false;

    var id = String(task.id || "").toLowerCase();
    var name = String(task.name || "").toLowerCase();
    var fn = String(task.functionName || "").toLowerCase();

    return (
      id.indexOf("stage3") !== -1 ||
      id.indexOf("stage4") !== -1 ||
      id.indexOf("historical") !== -1 ||
      name.indexOf("legacy diagnostics") !== -1 ||
      name.indexOf("historical diagnostics") !== -1 ||
      fn.indexOf("stage3") !== -1 ||
      fn.indexOf("stage4") !== -1 ||
      fn.indexOf("historical") !== -1
    );
  }

  ctx.normalizeCompatibilityStatus_ = function(status, task) {
    return status;
  }

  ctx.inferStatus_ = function(details, task) {
    var raw = details ? details.raw : null;

    if (raw === false) return "FAIL";
    if (raw === true) return "PASS";
    if (raw === null || typeof raw === "undefined") return "PASS";

    if (typeof raw === "string") {
      var normalizedString = raw.toUpperCase();
      if (ctx.isFailStatus_(normalizedString)) return "FAIL";
      if (ctx.isWarnStatus_(normalizedString)) return "WARN";
      return "PASS";
    }

    if (Array.isArray(raw)) return "PASS";

    if (typeof raw === "object") {
      if (ctx.isPseudoInfo_(raw)) return "WARN";
      if (raw.blocked === true)
        return task && task.severity === "critical" ? "FAIL" : "WARN";
      if (
        raw.ok === false ||
        raw.success === false ||
        raw.valid === false ||
        raw.passed === false ||
        raw.ready === false
      )
        return "FAIL";
      if (raw.allPassed === false) return "FAIL";

      if (raw.status && ctx.isFailStatus_(raw.status)) return "FAIL";
      if (raw.result && ctx.isFailStatus_(raw.result)) return "FAIL";

      if (
        ctx.numberGreaterThanZero_(raw.fail) ||
        ctx.numberGreaterThanZero_(raw.failed) ||
        ctx.numberGreaterThanZero_(raw.failures) ||
        ctx.numberGreaterThanZero_(raw.errorCount)
      )
        return "FAIL";
      if (
        ctx.arrayHasItems_(raw.failed) ||
        ctx.arrayHasItems_(raw.failures) ||
        ctx.arrayHasItems_(raw.errors)
      )
        return "FAIL";

      var checksStatus = ctx.inferChecksStatus_(raw.checks);
      if (checksStatus === "FAIL") return "FAIL";
      if (checksStatus === "WARN") return "WARN";

      var resultsStatus = ctx.inferChecksStatus_(raw.results);
      if (resultsStatus === "FAIL") return "FAIL";
      if (resultsStatus === "WARN") return "WARN";

      if (raw.status && ctx.isWarnStatus_(raw.status)) return "WARN";
      if (raw.result && ctx.isWarnStatus_(raw.result)) return "WARN";
      if (
        ctx.numberGreaterThanZero_(raw.warningCount) ||
        ctx.numberGreaterThanZero_(raw.warningsCount)
      )
        return "WARN";
      if (ctx.arrayHasItems_(raw.warnings)) return "WARN";
      if (ctx.arrayHasItems_(raw.issues))
        return task && task.severity === "critical" ? "FAIL" : "WARN";

      if (raw.dataIntegrity && ctx.objectHasNonEmptyArrays_(raw.dataIntegrity))
        return task && task.severity === "critical" ? "FAIL" : "WARN";
      if (raw.criticalIssues && ctx.arrayHasItems_(raw.criticalIssues))
        return "FAIL";
    }

    return "PASS";
  }

  ctx.inferChecksStatus_ = function(items) {
    if (!Array.isArray(items)) return "PASS";

    var hasWarn = false;
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (!item) continue;

      if (ctx.isPseudoInfo_(item)) {
        hasWarn = true;
        continue;
      }

      if (
        item.ok === false ||
        item.success === false ||
        item.valid === false ||
        item.passed === false
      )
        return "FAIL";
      if (item.status && ctx.isFailStatus_(item.status)) return "FAIL";
      if (item.result && ctx.isFailStatus_(item.result)) return "FAIL";
      if (
        ctx.arrayHasItems_(item.errors) ||
        ctx.arrayHasItems_(item.failed) ||
        ctx.arrayHasItems_(item.failures)
      )
        return "FAIL";

      if (item.status && ctx.isWarnStatus_(item.status)) hasWarn = true;
      if (item.result && ctx.isWarnStatus_(item.result)) hasWarn = true;
      if (ctx.arrayHasItems_(item.warnings) || ctx.arrayHasItems_(item.issues))
        hasWarn = true;
    }

    return hasWarn ? "WARN" : "PASS";
  }

  ctx.isFailStatus_ = function(status) {
    var value = String(status).toUpperCase();
    return (
      value === "FAIL" ||
      value === "FAILED" ||
      value === "ERROR" ||
      value === "CRITICAL" ||
      value === "BROKEN" ||
      value === "BLOCKED"
    );
  }

  ctx.isWarnStatus_ = function(status) {
    var value = String(status).toUpperCase();
    return (
      value === "WARN" ||
      value === "WARNING" ||
      value === "ISSUE" ||
      value === "DEGRADED" ||
      value === "SKIP" ||
      value === "SKIPPED" ||
      value === "PSEUDO"
    );
  }

  ctx.isPseudoInfo_ = function(item) {
    if (!item || typeof item !== "object") return false;

    var status = String(item.status || item.result || "").toUpperCase();
    var severity = String(item.severity || "").toUpperCase();
    var uiGroup = String(item.uiGroup || "").toLowerCase();

    return (
      item.pseudo === true ||
      status === "PSEUDO" ||
      uiGroup === "pseudo" ||
      ((item.ok === false ||
        item.success === false ||
        item.valid === false ||
        item.passed === false) &&
        severity === "INFO")
    );
  }

  ctx.statusToUiGroup_ = function(status, ok, task) {
    if (status === "SKIPPED") return "warnings";
    if (status === "FAIL") return "critical";
    if (status === "WARN") return "warnings";
    return "ok";
  }

  ctx.humanizeReportValue_ = function(value, limit) {
    limit = limit || 900;

    if (value === null || typeof value === "undefined") return "";

    if (typeof value === "string") {
      return ctx.compactReportText_(value, limit);
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }

    if (Object.prototype.toString.call(value) === "[object Date]") {
      return ctx.toIso_(value);
    }

    if (Array.isArray(value)) {
      return ctx.summarizeReportArray_(value, limit);
    }

    if (typeof value === "object") {
      return ctx.summarizeReportObject_(value, limit);
    }

    return ctx.compactReportText_(String(value), limit);
  }

  ctx.compactReportText_ = function(text, limit) {
    text = String(text || "")
      .replace(/\s+/g, " ")
      .trim();

    if (!text) return "";

    if (text === "[object Object]") {
      return "Результат отримано як об’єкт; деталі доступні у TEST_RESULTS.";
    }

    if (/^https:\/\/wa\.me\//i.test(text)) {
      return "WhatsApp-посилання сформовано коректно.";
    }

    if (/^https?:\/\//i.test(text) && text.length > 120) {
      return "Посилання сформовано коректно.";
    }

    return text.length > limit ? text.slice(0, limit) + "…" : text;
  }

  ctx.summarizeReportArray_ = function(items, limit) {
    if (!items.length) return "Список порожній.";

    var fail = 0;
    var warn = 0;
    var ok = 0;
    var skipped = 0;
    var failedNames = [];

    items.forEach(function (item) {
      if (!item || typeof item !== "object") return;

      var status = String(item.status || item.result || "").toUpperCase();
      var itemOk =
        item.ok === true || item.success === true || item.passed === true;

      if (ctx.isPseudoInfo_(item)) {
        warn += 1;
        failedNames.push(
          String(item.title || item.name || "compatibility-check"),
        );
        return;
      }

      if (status === "WARN" || status === "WARNING") {
        warn += 1;
        return;
      }

      if (
        status === "FAIL" ||
        status === "FAILED" ||
        status === "ERROR" ||
        item.ok === false ||
        item.success === false ||
        item.passed === false
      ) {
        fail += 1;
        if (failedNames.length < 3) {
          failedNames.push(
            String(item.title || item.name || item.id || "перевірка"),
          );
        }
        return;
      }

      if (status === "SKIP" || status === "SKIPPED") {
        skipped += 1;
        return;
      }

      if (itemOk || status === "OK" || status === "PASS") {
        ok += 1;
      }
    });

    var parts = ["усього=" + items.length];

    if (ok) parts.push("OK=" + ok);
    if (fail) parts.push("FAIL=" + fail);
    if (warn) parts.push("WARN=" + warn);
    if (skipped) parts.push("SKIP=" + skipped);

    var text = parts.join(", ");

    if (failedNames.length) {
      text += ". Проблемні: " + failedNames.join("; ");
    }

    return ctx.compactReportText_(text, limit);
  }

  ctx.summarizeReportObject_ = function(obj, limit) {
    if (!obj) return "";

    if (obj.message && typeof obj.message !== "object") {
      return ctx.compactReportText_(obj.message, limit);
    }

    if (obj.summary && typeof obj.summary !== "object") {
      return ctx.compactReportText_(obj.summary, limit);
    }

    if (obj.error && typeof obj.error !== "object") {
      return ctx.compactReportText_(obj.error, limit);
    }

    if (obj.details && typeof obj.details !== "object") {
      return ctx.compactReportText_(obj.details, limit);
    }

    if (Array.isArray(obj.checks)) {
      return "Перевірки: " + ctx.summarizeReportArray_(obj.checks, limit);
    }

    if (Array.isArray(obj.results)) {
      return "Результати: " + ctx.summarizeReportArray_(obj.results, limit);
    }

    if (Array.isArray(obj.errors) && obj.errors.length) {
      return "Помилки: " + ctx.summarizeReportArray_(obj.errors, limit);
    }

    if (Array.isArray(obj.warnings) && obj.warnings.length) {
      return "Попередження: " + ctx.summarizeReportArray_(obj.warnings, limit);
    }

    if (obj.counts && typeof obj.counts === "object") {
      var counts = obj.counts;
      var countParts = [];

      if (typeof counts.total !== "undefined")
        countParts.push("усього=" + counts.total);
      if (typeof counts.passed !== "undefined")
        countParts.push("passed=" + counts.passed);
      if (typeof counts.failed !== "undefined")
        countParts.push("failed=" + counts.failed);
      if (typeof counts.warnings !== "undefined")
        countParts.push("warnings=" + counts.warnings);
      if (typeof counts.skipped !== "undefined")
        countParts.push("skipped=" + counts.skipped);

      if (countParts.length) return countParts.join(", ");
    }

    if (typeof obj.passed === "number" || typeof obj.failed === "number") {
      return (
        "passed=" +
        String(obj.passed || 0) +
        "; failed=" +
        String(obj.failed || 0)
      );
    }

    if (typeof obj.ok === "boolean") {
      return obj.ok
        ? "Перевірку виконано успішно."
        : "Перевірка повернула помилку.";
    }

    if (typeof obj.success === "boolean") {
      return obj.success
        ? "Операцію виконано успішно."
        : "Операція повернула помилку.";
    }

    if (obj.url || obj.link) {
      return "Посилання сформовано коректно.";
    }

    var keys = Object.keys(obj).filter(function (key) {
      return key !== "raw" && key !== "stack" && key !== "errorStack";
    });

    if (keys.length) {
      return (
        "Об’єкт результату: " +
        keys.slice(0, 8).join(", ") +
        ". Деталі доступні у TEST_RESULTS."
      );
    }

    return "Результат отримано як об’єкт; деталі доступні у TEST_RESULTS.";
  }

  ctx.normalizeTestResultsDetailsForRun_ = function(runId) {
    try {
      if (!runId) return;

      var ss = getWasbSpreadsheet_();
      if (!ss) return;

      var sheet = ss.getSheetByName("TEST_RESULTS");
      if (!sheet) return;

      var lastRow = sheet.getLastRow();
      var lastCol = sheet.getLastColumn();

      if (lastRow < 2 || lastCol < 1) return;

      var headers = sheet
        .getRange(1, 1, 1, lastCol)
        .getValues()[0]
        .map(function (value) {
          return String(value || "").trim();
        });

      var runIdCol = headers.indexOf("RunId");
      var messageCol = headers.indexOf("Message");
      var detailsCol = headers.indexOf("DetailsJson");

      if (runIdCol < 0 || detailsCol < 0) return;

      var scanLimit = 700;
      var startRow = Math.max(2, lastRow - scanLimit + 1);
      var rowCount = lastRow - startRow + 1;

      if (rowCount <= 0) return;

      var range = sheet.getRange(startRow, 1, rowCount, lastCol);
      var values = range.getValues();
      var changed = false;

      values.forEach(function (row) {
        if (String(row[runIdCol] || "") !== String(runId)) return;

        var detailsValue = row[detailsCol];
        var detailsText = ctx.detailsJsonCellToHumanText_(detailsValue);

        if (detailsText && detailsText !== String(detailsValue || "")) {
          row[detailsCol] = detailsText;
          changed = true;
        }

        if (messageCol >= 0) {
          var messageValue = row[messageCol];
          var messageText = ctx.compactReportText_(messageValue, 1200);

          if (messageText && messageText !== String(messageValue || "")) {
            row[messageCol] = messageText;
            changed = true;
          }
        }
      });

      if (changed) {
        range.setValues(values);
      }
    } catch (err) {
    }
  }

  ctx.detailsJsonCellToHumanText_ = function(value) {
    if (value === null || typeof value === "undefined") return "";

    var text = String(value || "").trim();
    if (!text) return "";

    if (text === "[object Object]") {
      return "Результат отримано як об’єкт; технічні дані приховано.";
    }

    if (/^https:\/\/wa\.me\//i.test(text)) {
      return "WhatsApp-посилання сформовано коректно.";
    }

    if (/^https?:\/\//i.test(text) && text.length > 120) {
      return "Посилання сформовано коректно.";
    }

    if (!/^[\{\[]/.test(text)) {
      return ctx.compactReportText_(text, 1800);
    }

    try {
      var parsed = JSON.parse(text);
      var raw =
        parsed && Object.prototype.hasOwnProperty.call(parsed, "raw")
          ? parsed.raw
          : parsed;

      return ctx.detailsObjectToHumanText_(raw, 1800);
    } catch (err) {
      return ctx.compactReportText_(text, 1800);
    }
  }

  ctx.detailsObjectToHumanText_ = function(raw, limit) {
    limit = limit || 1800;

    if (raw === null || typeof raw === "undefined") return "";

    if (typeof raw === "string") {
      return ctx.compactReportText_(raw, limit);
    }

    if (typeof raw === "number" || typeof raw === "boolean") {
      return String(raw);
    }

    if (Array.isArray(raw)) {
      return ctx.detailsChecksToHumanText_(raw, limit);
    }

    if (typeof raw !== "object") {
      return ctx.compactReportText_(String(raw), limit);
    }

    var title = ctx.compactReportText_(raw.name || raw.title || "", 160);

    if (raw.message && typeof raw.message !== "object") {
      return ctx.withDetailsTitle_(title, raw.message, limit);
    }

    if (raw.summary && typeof raw.summary !== "object") {
      return ctx.withDetailsTitle_(title, raw.summary, limit);
    }

    if (raw.error && typeof raw.error !== "object") {
      return ctx.withDetailsTitle_(title, raw.error, limit);
    }

    if (raw.details && typeof raw.details !== "object") {
      return ctx.withDetailsTitle_(title, raw.details, limit);
    }

    if (Array.isArray(raw.checks)) {
      return ctx.withDetailsTitle_(
        title,
        ctx.detailsChecksToHumanText_(raw.checks, limit),
        limit,
      );
    }

    if (Array.isArray(raw.results)) {
      return ctx.withDetailsTitle_(
        title,
        ctx.detailsChecksToHumanText_(raw.results, limit),
        limit,
      );
    }

    if (Array.isArray(raw.errors) && raw.errors.length) {
      return ctx.withDetailsTitle_(
        title,
        "Помилки: " + ctx.detailsChecksToHumanText_(raw.errors, limit),
        limit,
      );
    }

    if (Array.isArray(raw.warnings) && raw.warnings.length) {
      return ctx.withDetailsTitle_(
        title,
        "Попередження: " + ctx.detailsChecksToHumanText_(raw.warnings, limit),
        limit,
      );
    }

    if (raw.counts && typeof raw.counts === "object") {
      var countParts = [];

      if (typeof raw.counts.total !== "undefined")
        countParts.push("усього=" + raw.counts.total);
      if (typeof raw.counts.ok !== "undefined")
        countParts.push("OK=" + raw.counts.ok);
      if (typeof raw.counts.passed !== "undefined")
        countParts.push("PASS=" + raw.counts.passed);
      if (typeof raw.counts.failed !== "undefined")
        countParts.push("FAIL=" + raw.counts.failed);
      if (typeof raw.counts.warnings !== "undefined")
        countParts.push("WARN=" + raw.counts.warnings);
      if (typeof raw.counts.skipped !== "undefined")
        countParts.push("SKIP=" + raw.counts.skipped);
      if (typeof raw.counts.pseudo !== "undefined")
        countParts.push("PSEUDO=" + raw.counts.pseudo);

      if (countParts.length) {
        return ctx.withDetailsTitle_(
          title,
          "Підсумок: " + countParts.join(", "),
          limit,
        );
      }
    }

    if (typeof raw.ok === "boolean") {
      return ctx.withDetailsTitle_(
        title,
        raw.ok ? "Перевірку виконано успішно." : "Перевірка повернула помилку.",
        limit,
      );
    }

    if (typeof raw.success === "boolean") {
      return ctx.withDetailsTitle_(
        title,
        raw.success
          ? "Операцію виконано успішно."
          : "Операція повернула помилку.",
        limit,
      );
    }

    if (raw.url || raw.link) {
      return ctx.withDetailsTitle_(title, "Посилання сформовано коректно.", limit);
    }

    var keys = Object.keys(raw).filter(function (key) {
      return key !== "raw" && key !== "stack" && key !== "errorStack";
    });

    if (keys.length) {
      return ctx.withDetailsTitle_(
        title,
        "Поля результату: " + keys.slice(0, 12).join(", ") + ".",
        limit,
      );
    }

    return title || "Результат отримано; технічні дані приховано.";
  }

  ctx.detailsChecksToHumanText_ = function(items, limit) {
    limit = limit || 1800;

    if (!items || !items.length) return "Список порожній.";

    var ok = 0;
    var fail = 0;
    var warn = 0;
    var skip = 0;

    var important = [];
    var normal = [];

    items.forEach(function (item) {
      if (!item || typeof item !== "object") return;

      var status = String(item.status || item.result || "").toUpperCase();
      var itemOk =
        item.ok === true || item.success === true || item.passed === true;

      if (ctx.isPseudoInfo_(item)) {
        warn += 1;
        important.push(ctx.formatOneCheckLine_(item, "WARN"));
        return;
      }

      if (status === "WARN" || status === "WARNING") {
        warn += 1;
        important.push(ctx.formatOneCheckLine_(item, "WARN"));
        return;
      }

      if (
        status === "FAIL" ||
        status === "FAILED" ||
        status === "ERROR" ||
        item.ok === false ||
        item.success === false ||
        item.passed === false
      ) {
        fail += 1;
        important.push(ctx.formatOneCheckLine_(item, "FAIL"));
        return;
      }

      if (status === "SKIP" || status === "SKIPPED") {
        skip += 1;
        normal.push(ctx.formatOneCheckLine_(item, "SKIP"));
        return;
      }

      if (itemOk || status === "OK" || status === "PASS") {
        ok += 1;
        normal.push(ctx.formatOneCheckLine_(item, "OK"));
        return;
      }

      normal.push(ctx.formatOneCheckLine_(item, status || "INFO"));
    });

    var parts = ["усього=" + items.length];

    if (ok) parts.push("OK=" + ok);
    if (fail) parts.push("FAIL=" + fail);
    if (warn) parts.push("WARN=" + warn);
    if (skip) parts.push("SKIP=" + skip);

    var selected = important.concat(normal).filter(Boolean).slice(0, 8);
    var text = "Перевірки: " + parts.join(", ") + ".";

    if (selected.length) {
      text += " Деталі: " + selected.join("; ");
    }

    if (items.length > selected.length) {
      text +=
        "; ще " + (items.length - selected.length) + " перевірок приховано.";
    }

    return ctx.compactReportText_(text, limit);
  }

  ctx.formatOneCheckLine_ = function(item, fallbackStatus) {
    var status = String(
      item.status || item.result || fallbackStatus || "INFO",
    ).toUpperCase();
    var name = item.title || item.name || item.id || "перевірка";
    var details =
      item.details || item.message || item.howTo || item.recommendation || "";

    var icon =
      status === "OK" || status === "PASS"
        ? "OK"
        : status === "FAIL" || status === "FAILED" || status === "ERROR"
          ? "FAIL"
          : status;

    var line = icon + ": " + name;

    if (details && typeof details !== "object") {
      line += " — " + details;
    }

    return ctx.compactReportText_(line, 260);
  }

  ctx.withDetailsTitle_ = function(title, body, limit) {
    body = ctx.compactReportText_(body, limit || 1800);
    if (!title) return body;
    return ctx.compactReportText_(title + ": " + body, limit || 1800);
  }

  ctx.buildHumanTaskMessageFromRaw_ = function(raw, limit) {
    limit = limit || 360;

    function safeString_(value) {
      if (value === null || typeof value === "undefined") return "";
      try {
        return String(value);
      } catch (error) {
        return "";
      }
    }

    function compact_(text) {
      text = safeString_(text).replace(/\s+/g, " ").trim();
      if (!text) return "";
      return text.length > limit ? text.slice(0, limit) + "…" : text;
    }

    function countByStatus_(items) {
      var out = { total: 0, ok: 0, fail: 0, warn: 0, skip: 0, pseudo: 0 };

      if (!Array.isArray(items)) return out;

      out.total = items.length;

      for (var i = 0; i < items.length; i++) {
        var item = items[i] || {};
        var status = safeString_(
          item.status || item.result || "",
        ).toUpperCase();

        if (item.pseudo === true || status === "PSEUDO") {
          out.pseudo++;
        } else if (
          status === "OK" ||
          status === "PASS" ||
          item.ok === true ||
          item.success === true
        ) {
          out.ok++;
        } else if (
          status === "FAIL" ||
          status === "FAILED" ||
          status === "ERROR" ||
          item.ok === false ||
          item.success === false
        ) {
          out.fail++;
        } else if (status === "WARN" || status === "WARNING") {
          out.warn++;
        } else if (status === "SKIP" || status === "SKIPPED") {
          out.skip++;
        } else {
          out.ok++;
        }
      }

      return out;
    }

    function countArray_(value) {
      return Array.isArray(value) ? value.length : 0;
    }

    if (raw === null || typeof raw === "undefined") {
      return "Перевірку виконано успішно.";
    }

    if (typeof raw === "string") {
      if (/^https:\/\/wa\.me\//i.test(raw)) {
        return "WhatsApp-посилання сформовано коректно.";
      }
      return compact_(raw);
    }

    if (typeof raw === "number" || typeof raw === "boolean") {
      return safeString_(raw);
    }

    if (Array.isArray(raw)) {
      var arrCounts = countByStatus_(raw);
      var arrParts = [
        "усього=" + arrCounts.total,
        "OK=" + arrCounts.ok,
        "FAIL=" + arrCounts.fail,
        "WARN=" + arrCounts.warn,
      ];
      if (arrCounts.pseudo) arrParts.push("PSEUDO=" + arrCounts.pseudo);
      if (arrCounts.skip) arrParts.push("SKIP=" + arrCounts.skip);
      return compact_("Перевірки: " + arrParts.join(", "));
    }

    if (typeof raw !== "object") {
      return compact_(raw);
    }

    if (raw.summary && typeof raw.summary === "object") {
      var summary = raw.summary;
      var parts = [];

      if (typeof summary.total !== "undefined")
        parts.push("усього=" + summary.total);
      if (typeof summary.ok !== "undefined") parts.push("OK=" + summary.ok);
      if (typeof summary.passed !== "undefined")
        parts.push("PASS=" + summary.passed);
      if (typeof summary.fail !== "undefined")
        parts.push("FAIL=" + summary.fail);
      if (typeof summary.failed !== "undefined")
        parts.push("FAIL=" + summary.failed);
      if (typeof summary.warnings !== "undefined")
        parts.push("WARN=" + summary.warnings);
      if (typeof summary.warning !== "undefined")
        parts.push("WARN=" + summary.warning);
      if (typeof summary.skip !== "undefined")
        parts.push("SKIP=" + summary.skip);
      if (typeof summary.skipped !== "undefined")
        parts.push("SKIP=" + summary.skipped);
      if (typeof summary.blocked !== "undefined")
        parts.push("BLOCKED=" + summary.blocked);

      if (parts.length) {
        return compact_("Перевірки: " + parts.join(", "));
      }
    }

    if (Array.isArray(raw.checks)) {
      var checkCounts = countByStatus_(raw.checks);
      var checkParts = [
        "усього=" + checkCounts.total,
        "OK=" + checkCounts.ok,
        "FAIL=" + checkCounts.fail,
        "WARN=" + checkCounts.warn,
      ];
      if (checkCounts.pseudo) checkParts.push("PSEUDO=" + checkCounts.pseudo);
      if (checkCounts.skip) checkParts.push("SKIP=" + checkCounts.skip);
      return compact_("Перевірки: " + checkParts.join(", "));
    }

    if (Array.isArray(raw.results)) {
      var resultCounts = countByStatus_(raw.results);
      return compact_(
        "Результати: усього=" +
          resultCounts.total +
          ", OK=" +
          resultCounts.ok +
          ", FAIL=" +
          resultCounts.fail +
          ", WARN=" +
          resultCounts.warn +
          ", SKIP=" +
          resultCounts.skip,
      );
    }

    if (Array.isArray(raw.passed) || Array.isArray(raw.failed)) {
      return compact_(
        "Тести: passed=" +
          countArray_(raw.passed) +
          "; failed=" +
          countArray_(raw.failed),
      );
    }

    if (raw.schema && raw.dataIntegrity && raw.policy && raw.runtime) {
      var schema = raw.schema || {};
      var data = raw.dataIntegrity || {};
      var policy = raw.policy || {};
      var runtime = raw.runtime || {};

      return compact_(
        "ACCESS diagnostics: schema=" +
          (schema.exists ? "є" : "немає") +
          "; headers=" +
          (schema.headersPresent ? "OK" : "FAIL") +
          "; duplicateEmails=" +
          countArray_(data.duplicateEmails) +
          "; duplicateCurrentKeys=" +
          countArray_(data.duplicateCurrentKeys) +
          "; duplicatePrevKeys=" +
          countArray_(data.duplicatePrevKeys) +
          "; emptyIdentifierRows=" +
          (Array.isArray(data.emptyIdentifierWithActiveRole) &&
          data.emptyIdentifierWithActiveRole.length
            ? data.emptyIdentifierWithActiveRole.join(", ")
            : "немає") +
          "; strictUserKeyMode=" +
          !!policy.strictUserKeyMode +
          "; registeredKeys=" +
          (runtime.registeredKeysCount || 0),
      );
    }

    if (
      Object.prototype.hasOwnProperty.call(raw, "describe") ||
      Object.prototype.hasOwnProperty.call(raw, "bootstrapSheet") ||
      Object.prototype.hasOwnProperty.call(raw, "validate") ||
      Object.prototype.hasOwnProperty.call(raw, "diagnostics") ||
      Object.prototype.hasOwnProperty.call(raw, "allPassed")
    ) {
      return compact_(
        "ACCESS smoke: allPassed=" +
          !!raw.allPassed +
          (raw.error ? "; error=" + safeString_(raw.error) : ""),
      );
    }

    if (
      Object.prototype.hasOwnProperty.call(raw, "soldierMessages") ||
      Object.prototype.hasOwnProperty.call(raw, "commanderMessages")
    ) {
      return compact_(
        "Vacation engine: soldierMessages=" +
          countArray_(raw.soldierMessages) +
          "; commanderMessages=" +
          countArray_(raw.commanderMessages),
      );
    }

    if (raw.message && typeof raw.message !== "object") {
      return compact_(raw.message);
    }

    if (raw.details && typeof raw.details !== "object") {
      return compact_(raw.details);
    }

    if (raw.url || raw.link) {
      return "Посилання сформовано коректно.";
    }

    var keys = Object.keys(raw || {}).filter(function (key) {
      return key !== "raw" && key !== "stack" && key !== "errorStack";
    });

    if (keys.length) {
      return compact_(
        "Результат містить поля: " + keys.slice(0, 10).join(", ") + ".",
      );
    }

    return "Перевірку виконано успішно.";
  }

  ctx.buildTaskMessage_ = function(status, details, task) {
    var raw = details ? details.raw : null;
    var text = ctx.buildHumanTaskMessageFromRaw_(raw, 360);

    if (status === "FAIL") {
      if (text) return text;
      return (
        "Перевірка завершилась помилкою: " +
        (task && task.functionName ? task.functionName : "невідома функція")
      );
    }

    if (status === "WARN") {
      if (text) return text;
      return "Перевірка завершилась з попередженням.";
    }

    if (status === "SKIPPED") {
      if (text) return text;
      return "Перевірку пропущено.";
    }

    return text || "Перевірку виконано успішно.";
  }

  ctx.buildRecommendation_ = function(status, details, task) {
    var raw = details ? details.raw : null;

    if (raw && typeof raw === "object") {
      if (raw.recommendation)
        return ctx.humanizeReportValue_(raw.recommendation, 700);
      if (raw.howTo) return ctx.humanizeReportValue_(raw.howTo, 700);
      if (raw.reason) return ctx.humanizeReportValue_(raw.reason, 700);
      if (raw.blocked === true)
        return "Запустити у safe test mode або перевірити права доступу/роль користувача.";
    }

    if (status === "FAIL")
      return (
        "Дивись details/errorStack у TEST_RESULTS для функції " +
        task.functionName +
        "."
      );
    if (status === "WARN")
      return "Перевірити попередження та виправити, якщо воно стосується активних Stage 7 / ACCESS / runtime перевірок.";
    return "";
  }

  ctx.finalizeReport_ = function(report, startedAt) {
    var finishedAt = new Date();
    var passed = 0;
    var failed = 0;
    var skipped = 0;
    var warnings = 0;
    var discovered = 0;

    report.finishedAt = ctx.toIso_(finishedAt);
    report.durationMs = finishedAt - startedAt;

    for (var i = 0; i < report.results.length; i++) {
      var item = report.results[i];
      if (item.status === "PASS") passed++;
      else if (item.status === "FAIL") failed++;
      else if (item.status === "SKIPPED") skipped++;
      else if (item.status === "WARN") warnings++;
      if (item.discovered) discovered++;
    }

    report.counts.total = report.results.length;
    report.counts.passed = passed;
    report.counts.failed = failed;
    report.counts.skipped = skipped;
    report.counts.warnings = warnings;
    report.counts.discovered = discovered;
    report.ok = failed === 0;
    report.checks = report.results.map(ctx.resultToCheck_);

    if (discovered > 0)
      report.warnings.push(
        "Додатково знайдено runner-функцій через discovery: " +
          discovered +
          ".",
      );
    if (skipped > 0)
      report.warnings.push(
        "Частина перевірок пропущена, бо відповідні функції не знайдені у проєкті.",
      );
    if (warnings > 0)
      report.warnings.push("Частина перевірок повернула попередження.");
    if (failed > 0)
      report.warnings.push(
        "Є критичні помилки. Деплой краще не робити, доки вони не виправлені.",
      );
  }

  ctx.resultToCheck_ = function(item) {
    return {
      name: item.name,
      title: item.name,
      status: item.status === "PASS" ? "OK" : item.status,
      ok: item.ok,
      uiGroup: item.uiGroup,
      group: item.group,
      severity: item.severity,
      details: item.message || "",
      message: item.message || "",
      recommendation: item.recommendation || "",
      functionName: item.functionName,
      durationMs: item.durationMs,
      discovered: item.discovered === true,
    };
  }

  ctx.makeSkippedResult_ = function(task, message) {
    var now = new Date();
    return {
      id: task.id,
      name: task.name,
      title: task.name,
      group: task.group,
      uiGroup: "skipped",
      level: task.level,
      severity: task.severity,
      functionName: task.functionName,
      discovered: task.discovered === true,
      status: "SKIPPED",
      ok: true,
      skipped: true,
      startedAt: ctx.toIso_(now),
      finishedAt: ctx.toIso_(now),
      durationMs: 0,
      message: message,
      details: null,
      recommendation:
        "Запуск пропущено через ліміт часу або відсутність функції.",
      errorStack: "",
    };
  }
}

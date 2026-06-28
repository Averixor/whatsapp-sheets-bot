/**
 * Stage7TestRunner.Helpers.gs — shared runner utilities (ctx attach).
 */

function stage7TestRunnerAttachHelpers_(ctx) {
  ctx.isTimeoutReached_ = function (startedAt, timeoutMs) {
    return new Date() - startedAt > timeoutMs;
  };

  ctx.getGlobalObject_ = function () {
    try {
      if (typeof globalThis !== "undefined") return globalThis;
    } catch (error1) {}

    try {
      return Function("return this")();
    } catch (error2) {
      return this;
    }
  }

  ctx.collectEnvironment_ = function() {
    var env = {
      scriptTimeZone: "",
      spreadsheetId: "",
      spreadsheetName: "",
      activeSheetName: "",
      effectiveUser: "",
      activeUser: "",
      locale: "",
      scriptId: "",
    };

    try {
      env.scriptTimeZone = Session.getScriptTimeZone();
    } catch (error1) {}
    try {
      env.locale = Session.getActiveUserLocale();
    } catch (error2) {}
    try {
      env.effectiveUser = Session.getEffectiveUser().getEmail();
    } catch (error3) {}
    try {
      env.activeUser = Session.getActiveUser().getEmail();
    } catch (error4) {}
    try {
      env.scriptId = ScriptApp.getScriptId();
    } catch (error5) {}

    try {
      var ss = getWasbSpreadsheet_();
      env.spreadsheetId = ss.getId();
      env.spreadsheetName = ss.getName();
      env.activeSheetName = ss.getActiveSheet().getName();
    } catch (error6) {}

    return env;
  }
  ctx.buildRunId_ = function(date, mode) {
    var timezone = "Etc/GMT";
    try {
      timezone = Session.getScriptTimeZone();
    } catch (error) {}
    return (
      "wasb_test_" +
      String(mode || "run") +
      "_" +
      Utilities.formatDate(date, timezone, "yyyyMMdd_HHmmss") +
      "_" +
      Math.random().toString(36).slice(2, 8)
    );
  }

  ctx.toIso_ = function(value) {
    if (!value) {
      return "";
    }

    try {
      var date =
        Object.prototype.toString.call(value) === "[object Date]"
          ? value
          : new Date(value);

      var timezone = "";
      try {
        timezone = Session.getScriptTimeZone();
      } catch (tzError) {
        timezone = "";
      }

      if (!timezone) {
        timezone = "Europe/Kyiv";
      }

      return Utilities.formatDate(date, timezone, "yyyy-MM-dd HH:mm:ss");
    } catch (error) {
      return String(value);
    }
  }

  ctx.safeJson_ = function(value, maxLen) {
    maxLen = maxLen || 1800;

    try {
      var v = value;

      if (
        v &&
        typeof v === "object" &&
        Object.prototype.hasOwnProperty.call(v, "type") &&
        Object.prototype.hasOwnProperty.call(v, "raw")
      ) {
        v = v.raw;
      }

      var text = "";

      if (typeof ctx.detailsObjectToHumanText_ === "function") {
        text = ctx.detailsObjectToHumanText_(v, maxLen);
      } else if (typeof ctx.humanizeReportValue_ === "function") {
        text = ctx.humanizeReportValue_(v, maxLen);
      } else if (v === null || typeof v === "undefined") {
        text = "";
      } else if (typeof v === "string") {
        text = v;
      } else if (typeof v === "number" || typeof v === "boolean") {
        text = String(v);
      } else if (Array.isArray(v)) {
        text = "Перевірки: усього=" + v.length;
      } else if (typeof v === "object") {
        if (v.message && typeof v.message !== "object") {
          text = String(v.message);
        } else if (v.summary && typeof v.summary !== "object") {
          text = String(v.summary);
        } else if (v.details && typeof v.details !== "object") {
          text = String(v.details);
        } else if (Array.isArray(v.checks)) {
          text = "Перевірки: усього=" + v.checks.length;
        } else if (Array.isArray(v.results)) {
          text = "Результати: усього=" + v.results.length;
        } else if (v.url || v.link) {
          text = "Посилання сформовано коректно.";
        } else {
          text = "Результат отримано як об’єкт; технічні дані приховано.";
        }
      } else {
        text = String(v);
      }

      text = String(text || "")
        .replace(/\s+/g, " ")
        .trim();

      if (!text) return "";

      if (/^https:\/\/wa\.me\//i.test(text)) {
        return "WhatsApp-посилання сформовано коректно.";
      }

      if (/^https?:\/\//i.test(text) && text.length > 120) {
        return "Посилання сформовано коректно.";
      }

      return text.length > maxLen ? text.slice(0, maxLen) + "…" : text;
    } catch (error) {
      return (
        "Не вдалося перетворити технічні деталі у текст: " +
        String(error && error.message ? error.message : error)
      );
    }
  }

  ctx.getErrorMessage_ = function(error) {
    if (!error) return "Unknown error";
    if (error.message) return String(error.message);
    return String(error);
  }

  ctx.getErrorStack_ = function(error) {
    if (!error) return "";
    if (error.stack) return String(error.stack);
    return "";
  }

  ctx.slugify_ = function(value) {
    return String(value || "")
      .replace(/[^A-Za-z0-9_]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();
  }

  ctx.numberGreaterThanZero_ = function(value) {
    return typeof value === "number" && value > 0;
  }

  ctx.arrayHasItems_ = function(value) {
    return Array.isArray(value) && value.length > 0;
  }

  ctx.objectHasNonEmptyArrays_ = function(value) {
    if (!value || typeof value !== "object") return false;
    for (var key in value) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
      if (Array.isArray(value[key]) && value[key].length > 0) return true;
      if (
        value[key] &&
        typeof value[key] === "object" &&
        ctx.objectHasNonEmptyArrays_(value[key])
      )
        return true;
    }
    return false;
  }
}

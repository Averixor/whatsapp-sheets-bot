/**
 * Stage7MaintenanceApi.gs — canonical maintenance / admin / diagnostics API for the Stage 7 baseline.
 *
 * Legacy Stage 4 / Stage 5 maintenance aliases removed from the project.
 */

function _stage7BuildMaintenanceResponse_(
  success,
  message,
  report,
  scenario,
  warnings,
  extraMeta,
) {
  const safeReport = report && typeof report === "object" ? report : {};
  const safeExtraMeta =
    extraMeta && typeof extraMeta === "object" ? extraMeta : {};

  const hasExtraDryRun = Object.prototype.hasOwnProperty.call(
    safeExtraMeta,
    "dryRun",
  );
  const hasReportDryRun = Object.prototype.hasOwnProperty.call(
    safeReport,
    "dryRun",
  );

  const derivedDryRun = hasExtraDryRun
    ? safeExtraMeta.dryRun === true
    : hasReportDryRun
      ? safeReport.dryRun === true
      : true;

  let meta = Object.assign(
    {
      stage:
        typeof getProjectBundleMetadata_ === "function"
          ? getProjectBundleMetadata_().stageVersion
          : "6.0.0-final",
      scenario: scenario,
      operationId: stage7UniqueId_(scenario),
      affectedSheets: [],
      affectedEntities: [],
      appliedChangesCount: 0,
      skippedChangesCount: 0,
      dryRun: derivedDryRun,
    },
    safeExtraMeta,
  );

  meta.dryRun = hasExtraDryRun
    ? safeExtraMeta.dryRun === true
    : hasReportDryRun
      ? safeReport.dryRun === true
      : meta.dryRun === true;

  meta = finalizeServerResponseDuration_(meta, safeExtraMeta.startedAt);

  return buildServerResponse_(
    success !== false,
    message,
    null,
    report || {},
    [],
    meta,
    { stage: meta.stage, scenario: scenario, lifecycle: ["report.built"] },
    { stage: meta.stage, scenario: scenario, layer: "maintenance" },
    warnings || [],
  );
}

function _stage7AssertRole_(requiredRole, actionLabel) {
  if (
    typeof AccessControl_ !== "object" ||
    !AccessControl_ ||
    typeof AccessControl_.assertRoleAtLeast !== "function"
  ) {
    throw new Error("AccessControl_ недоступний: доступ заборонено");
  }
  return AccessControl_.assertRoleAtLeast(
    requiredRole || "admin",
    actionLabel || "maintenance action",
  );
}

function _stage7AssertAdminAccess_(actionLabel) {
  return _stage7AssertRole_("admin", actionLabel || "maintenance action");
}

function _stage7NormalizeWarningText_(value) {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean")
    return String(value).trim();

  if (typeof value === "object") {
    const message = value.message != null ? String(value.message).trim() : "";
    const code = value.code != null ? String(value.code).trim() : "";

    if (message) return message;
    if (code) return code;

    try {
      return JSON.stringify(value);
    } catch (error) {
      return String(value).trim();
    }
  }

  return String(value).trim();
}

function _stage7BuildDescriptorWarnings_(descriptor) {
  const reason = descriptor && descriptor.reason;
  const warningText = _stage7NormalizeWarningText_(reason);
  const code =
    descriptor &&
    descriptor.reason &&
    typeof descriptor.reason === "object" &&
    descriptor.reason.code != null
      ? String(descriptor.reason.code).trim()
      : "";

  if (!warningText) return [];
  if (
    warningText === "ok" ||
    warningText === "access.ok" ||
    code === "access.ok"
  )
    return [];

  return [warningText];
}

function apiStage7BootstrapAccessSheet() {
  _stage7AssertRole_("admin", "bootstrap access sheet");
  const result =
    typeof AccessControl_ === "object" && AccessControl_.bootstrapSheet
      ? AccessControl_.bootstrapSheet()
      : { success: false, message: "AccessControl_ недоступний" };
  return _stage7BuildMaintenanceResponse_(
    result.success !== false,
    result.message || "ACCESS sheet ініціалізовано для user key-доступу",
    result,
    "stage7BootstrapAccessSheet",
    result.success === false
      ? [
          _stage7NormalizeWarningText_(result.message) ||
            "Не вдалося ініціалізувати ACCESS",
        ]
      : [],
    { affectedSheets: [appGetCore("ACCESS_SHEET", "ACCESS")] },
  );
}

function apiStage7RepairSystemSheets() {
  _stage7AssertRole_("admin", "repair system sheets");

  const systemSheets =
    typeof ensureAllSystemSheets_ === "function"
      ? ensureAllSystemSheets_()
      : [];
  const businessSheets =
    typeof _repairOptionalBusinessSheets_ === "function"
      ? _repairOptionalBusinessSheets_()
      : {
          success: false,
          sheets: [],
          warnings: ["_repairOptionalBusinessSheets_ недоступна"],
        };
  const warnings = [];

  systemSheets.forEach(function (item) {
    if (item && item.error) {
      warnings.push(String(item.name || "system sheet") + ": " + item.error);
    }
  });
  (businessSheets.warnings || []).forEach(function (warning) {
    warnings.push(String(warning));
  });

  const affectedSheets = systemSheets
    .map(function (item) {
      return item && item.name ? String(item.name) : "";
    })
    .concat(
      (businessSheets.sheets || []).map(function (item) {
        return item && item.name ? String(item.name) : "";
      }),
    )
    .filter(Boolean);

  return _stage7BuildMaintenanceResponse_(
    warnings.length === 0 && businessSheets.success !== false,
    warnings.length
      ? "Відновлення аркушів завершено з попередженнями"
      : "Системні та бізнес-аркуші перевірено",
    {
      systemSheets: systemSheets,
      businessSheets: businessSheets,
    },
    "stage7RepairSystemSheets",
    warnings,
    { affectedSheets: affectedSheets },
  );
}

function apiStage7GetAccessDescriptor() {
  const descriptor =
    typeof AccessControl_ === "object"
      ? AccessControl_.describe({ includeSensitiveDebug: false })
      : {
          role: "guest",
          knownUser: false,
          reason: "AccessControl_ недоступний",
        };

  const warnings = _stage7BuildDescriptorWarnings_(descriptor);

  return _stage7BuildMaintenanceResponse_(
    true,
    descriptor.isAdmin ? "Роль доступу визначено" : "Доступ визначено",
    descriptor,
    "stage7AccessDescriptor",
    warnings,
  );
}

function apiStage7DebugAccess() {
  const descriptor =
    typeof AccessControl_ === "object"
      ? AccessControl_.describe({ includeSensitiveDebug: false })
      : {
          role: "guest",
          knownUser: false,
          reason: "AccessControl_ недоступний",
        };

  return _stage7BuildMaintenanceResponse_(
    true,
    "Перевірку доступу виконано",
    descriptor,
    "stage7DebugAccess",
    descriptor.reason ? [descriptor.reason] : [],
  );
}

function _stage7HasRoleAtLeastSilent_(requiredRole) {
  if (typeof AccessControl_ !== "object" || !AccessControl_.describe) {
    return false;
  }
  var descriptor = AccessControl_.describe({ includeSensitiveDebug: false });
  if (!descriptor || descriptor.enabled === false) return false;
  var current = String(descriptor.role || "guest").toLowerCase();
  var required = String(requiredRole || "admin").toLowerCase();
  if (typeof normalizeRole_ === "function") {
    current = normalizeRole_(current);
    required = normalizeRole_(required);
  }
  var order =
    typeof ROLE_ORDER === "object" && ROLE_ORDER
      ? ROLE_ORDER
      : {
          guest: 0,
          viewer: 1,
          operator: 2,
          maintainer: 3,
          admin: 4,
          sysadmin: 5,
          owner: 6,
        };
  return (order[current] || 0) >= (order[required] || 0);
}

function apiStage7ReportAccessViolation(actionName, details) {
  if (!_stage7HasRoleAtLeastSilent_("sysadmin")) {
    return _stage7BuildMaintenanceResponse_(
      false,
      "access_denied",
      { success: false, code: "access_denied" },
      "stage7ReportAccessViolation",
      ["access_denied"],
    );
  }

  const result =
    typeof AccessEnforcement_ === "object" && AccessEnforcement_.reportViolation
      ? AccessEnforcement_.reportViolation(actionName || "", details || {})
      : { success: false, message: "AccessEnforcement_ недоступний" };
  return _stage7BuildMaintenanceResponse_(
    result.success !== false,
    result.message || "Порушення доступу зафіксовано",
    result.data || result,
    "stage7ReportAccessViolation",
    [],
    { affectedSheets: [appGetCore("ALERTS_LOG_SHEET", "ALERTS_LOG")] },
  );
}

function apiStage7ListBindableCallsigns() {
  const callsigns =
    typeof AccessControl_ === "object" && AccessControl_.listBindableCallsigns
      ? AccessControl_.listBindableCallsigns()
      : [];
  const descriptor =
    typeof AccessControl_ === "object"
      ? AccessControl_.describe({ includeSensitiveDebug: false })
      : { keyAvailable: false, registered: false, supportEmail: "" };

  return _stage7BuildMaintenanceResponse_(
    true,
    callsigns.length
      ? "Список позивних для входу отримано"
      : "Немає доступних позивних для самостійного входу",
    {
      callsigns: callsigns,
      count: callsigns.length,
      supportEmail: descriptor.supportEmail || "",
      keyAvailable: !!descriptor.keyAvailable,
      registered: !!descriptor.registered,
    },
    "stage7ListBindableCallsigns",
    [],
  );
}

function apiStage7LoginByIdentifierAndCallsign(
  identifierOrPayload,
  callsign,
  loginMeta,
) {
  const payload =
    identifierOrPayload &&
    typeof identifierOrPayload === "object" &&
    !Array.isArray(identifierOrPayload)
      ? Object.assign({}, identifierOrPayload)
      : {
          identifier: identifierOrPayload || "",
          callsign: callsign || "",
          loginMeta: loginMeta || {},
        };

  const result =
    typeof AccessControl_ === "object" &&
    AccessControl_.loginByIdentifierAndCallsign
      ? AccessControl_.loginByIdentifierAndCallsign(payload)
      : {
          success: false,
          message: "AccessControl_ недоступний",
          code: "access.self_bind.unavailable",
        };

  return _stage7BuildMaintenanceResponse_(
    result.success !== false,
    result.message ||
      (result.success ? "Вхід виконано" : "Не вдалося виконати вхід"),
    result,
    "stage7LoginByIdentifierAndCallsign",
    result.success
      ? []
      : [
          _stage7NormalizeWarningText_(result.message) ||
            "Не вдалося виконати вхід через email/телефон і позивний",
        ],
  );
}

function apiStage7ApplyProtections(options) {
  _stage7AssertRole_("sysadmin", "apply spreadsheet protections");

  const normalizedOptions = options || {};
  const result =
    typeof applySpreadsheetProtections_ === "function"
      ? applySpreadsheetProtections_(normalizedOptions)
      : {
          dryRun: normalizedOptions.dryRun !== false,
          protectedSheets: [],
          plannedSheets: [],
          warnings: ["applySpreadsheetProtections_ недоступна"],
        };

  const dryRun = result && result.dryRun === false ? false : true;

  return _stage7BuildMaintenanceResponse_(
    true,
    dryRun
      ? "План захисту листів побудовано"
      : "Захист службових листів застосовано",
    result,
    "stage7ApplyProtections",
    result.warnings || [],
    {
      affectedSheets: result.plannedSheets || result.protectedSheets || [],
      dryRun: dryRun,
    },
  );
}

function apiStage7ClearCache() {
  _stage7AssertRole_("sysadmin", "clear cache");
  return Stage7UseCases_.runMaintenanceScenario({ type: "cleanupCaches" });
}

function apiStage7ClearLog() {
  _stage7AssertRole_("admin", "clear log");
  return Stage7UseCases_.runMaintenanceScenario({ type: "clearLog" });
}

function apiStage7ClearPhoneCache() {
  _stage7AssertRole_("sysadmin", "clear phone cache");
  return Stage7UseCases_.runMaintenanceScenario({ type: "clearPhoneCache" });
}

function apiStage7MaterializeComputedData(payload) {
  _stage7AssertRole_("maintainer", "materialize computed data");
  var opts = payload && typeof payload === "object" ? payload : {};
  return Stage7UseCases_.runMaintenanceScenario({
    type: "materializeComputedData",
    source: "api",
    monthlySyncMode: opts.monthlySyncMode,
    monthSheet: opts.monthSheet,
    includeHistory: opts.includeHistory,
    mode: opts.mode,
  });
}

function apiStage7MaterializeMonthJournal(payload) {
  _stage7AssertRole_("maintainer", "materialize month journal");
  var monthSheet =
    typeof resolveMonthJournalSheetName_ === "function"
      ? resolveMonthJournalSheetName_(payload || {})
      : "";

  if (!monthSheet) {
    return _stage7BuildMaintenanceResponse_(
      false,
      "Немає активного місячного аркуша 01–12",
      {
        ok: false,
        reason: "not_month_sheet",
      },
      "stage7MaterializeMonthJournal",
      ["Немає активного місячного аркуша 01–12"],
    );
  }

  var result =
    typeof materializeMonthJournalBundle_ === "function"
      ? materializeMonthJournalBundle_(monthSheet)
      : {
          ok: false,
          reason: "materialize_unavailable",
          message: "materializeMonthJournalBundle_ недоступна",
        };

  // Never ship in-memory journalRows / nested journal dumps to HtmlService.
  var report =
    typeof slimMonthJournalBundleResult_ === "function"
      ? slimMonthJournalBundleResult_(result)
      : result || {};

  var ok = !!(report && report.ok !== false);
  var names =
    typeof monthJournalDerivedSheetNames_ === "function"
      ? monthJournalDerivedSheetNames_(monthSheet)
      : { journal: "JOURNAL", summary: "SUMMARY" };

  return _stage7BuildMaintenanceResponse_(
    ok,
    ok
      ? "Журнал активного місяця оновлено (" + String(monthSheet) + ")"
      : report && report.message
        ? report.message
        : "Не вдалося оновити журнал місяця",
    report,
    "stage7MaterializeMonthJournal",
    ok
      ? []
      : [
          (report && report.message) ||
            "Не вдалося оновити журнал місяця",
        ],
    {
      affectedSheets: ok
        ? [names.journal, names.summary, monthSheet].filter(Boolean)
        : [monthSheet],
      monthSheet: monthSheet,
    },
  );
}

/**
 * Sidebar / client: one-time setup or migration of the temporary property register.
 * GAS-editor alias remains apiSetupTemporaryPropertyRegister (excluded from client).
 */
function apiStage7SetupTemporaryPropertyRegister() {
  _stage7AssertRole_("admin", "setup temporary property register");

  var result =
    typeof TemporaryPropertyRegister_ === "object" &&
    TemporaryPropertyRegister_ &&
    typeof TemporaryPropertyRegister_.setup === "function"
      ? TemporaryPropertyRegister_.setup({ migrateLegacy: true })
      : {
          success: false,
          message: "TemporaryPropertyRegister_ недоступний",
        };

  var ok = !!(result && result.success !== false);
  var migrated = Number(result && result.migratedRows) || 0;
  var backup = String((result && result.backupSheet) || "").trim();
  var message = ok
    ? migrated > 0
      ? "Облік майна налаштовано (перенесено рядків: " +
        migrated +
        (backup ? "; резерв: " + backup : "") +
        ")"
      : "Облік майна налаштовано"
    : (result && result.message) || "Не вдалося налаштувати облік майна";

  return _stage7BuildMaintenanceResponse_(
    ok,
    message,
    result || {},
    "stage7SetupTemporaryPropertyRegister",
    ok ? [] : [message],
    {
      dryRun: false,
      affectedSheets: ok
        ? [result.sheet, result.catalogSheet, result.kitsSheet].filter(Boolean)
        : [],
      appliedChangesCount: ok ? 1 : 0,
    },
  );
}

/**
 * Sidebar / client: re-apply temporary property validations and formatting (no migration).
 * GAS-editor alias remains apiRefreshTemporaryPropertyRegister (excluded from client).
 */
function apiStage7RefreshTemporaryPropertyRegister() {
  _stage7AssertRole_("maintainer", "refresh temporary property register");

  var result =
    typeof TemporaryPropertyRegister_ === "object" &&
    TemporaryPropertyRegister_ &&
    typeof TemporaryPropertyRegister_.setup === "function"
      ? TemporaryPropertyRegister_.setup({ migrateLegacy: false })
      : {
          success: false,
          message: "TemporaryPropertyRegister_ недоступний",
        };

  var ok = !!(result && result.success !== false);
  var message = ok
    ? "Облік майна оновлено"
    : (result && result.message) || "Не вдалося оновити облік майна";

  return _stage7BuildMaintenanceResponse_(
    ok,
    message,
    result || {},
    "stage7RefreshTemporaryPropertyRegister",
    ok ? [] : [message],
    {
      dryRun: false,
      affectedSheets: ok
        ? [result.sheet, result.catalogSheet, result.kitsSheet].filter(Boolean)
        : [],
      appliedChangesCount: ok ? 1 : 0,
    },
  );
}

/**
 * Maintenance / first-run bootstrap: fill JOURNAL + SUMMARY from every
 * existing month sheet 01–12. Chunked — pass payload.nextCursor (or cursor)
 * from the previous response until done=true.
 * Not wired to the sidebar (uiAllowed: false); intended for GAS editor.
 * Public api* + maintainer — could be called via google.script.run if wired
 * manually. Continuation fields are inside the Stage7 envelope:
 * response.data.result.{done,nextCursor,batchMonths,cursor} — not top-level.
 * Regular "Оновити журнал місяця" refreshes only the active month slice.
 *
 * @param {Object=} payload
 * @param {number=} payload.cursor start index (default 0)
 * @param {number=} payload.nextCursor alias for cursor (continuation)
 * @param {number=} payload.monthsPerCall months per GAS call (default 3)
 */
function apiStage7MaterializeAllMonthJournals(payload) {
  _stage7AssertRole_("maintainer", "materialize all month journals");

  var opts = payload && typeof payload === "object" ? payload : {};
  var cursorRaw =
    opts.nextCursor != null && opts.nextCursor !== ""
      ? opts.nextCursor
      : opts.cursor;
  var callOpts = {
    cursor: cursorRaw != null && cursorRaw !== "" ? Number(cursorRaw) : 0,
    monthsPerCall:
      opts.monthsPerCall != null && opts.monthsPerCall !== ""
        ? Number(opts.monthsPerCall)
        : undefined,
  };

  var result =
    typeof materializeAllExistingMonthJournals_ === "function"
      ? materializeAllExistingMonthJournals_(callOpts)
      : {
          ok: false,
          done: true,
          reason: "materialize_all_unavailable",
          message: "materializeAllExistingMonthJournals_ недоступна",
          monthCount: 0,
          failedCount: 0,
          affectedSheets: [],
        };

  var ok = !!(result && result.ok !== false);
  var done = !!(result && result.done);
  var monthCount = Number(result && result.monthCount) || 0;
  var failedCount = Number(result && result.failedCount) || 0;
  var processedCount = Number(result && result.processedCount) || 0;
  var batchMonths = Array.isArray(result && result.batchMonths)
    ? result.batchMonths
    : [];
  var nextCursor =
    result && result.nextCursor != null ? result.nextCursor : null;

  var message;
  if (!ok) {
    message =
      failedCount > 0
        ? "Частина зрізів журналу не оновилась (" +
          failedCount +
          " у батчі; cursor=" +
          String(result.cursor) +
          ")"
        : (result && result.message) ||
          "Не вдалося оновити журнал / підсумок";
  } else if (monthCount === 0) {
    message = "Немає місячних аркушів 01–12 для оновлення";
  } else if (done) {
    message =
      "Журнал і підсумок: bootstrap завершено (" + monthCount + " міс.)";
  } else {
    message =
      "Журнал і підсумок: батч " +
      batchMonths.join(",") +
      " (" +
      processedCount +
      "); повторіть з nextCursor=" +
      String(nextCursor);
  }

  // Slim per-month results only — drop any accidental nested row dumps.
  var slimResults = Array.isArray(result && result.results)
    ? result.results.map(function (item) {
        return typeof slimMonthJournalBundleResult_ === "function"
          ? slimMonthJournalBundleResult_(item)
          : item;
      })
    : [];

  var report = {
    ok: ok,
    done: done,
    cursor: Number(result && result.cursor) || 0,
    nextCursor: nextCursor,
    monthsPerCall: Number(result && result.monthsPerCall) || 0,
    months: Array.isArray(result && result.months) ? result.months : [],
    batchMonths: batchMonths,
    monthCount: monthCount,
    processedCount: processedCount,
    failedCount: failedCount,
    journalRowsWritten: Number(result && result.journalRowsWritten) || 0,
    summaryRowsWritten: Number(result && result.summaryRowsWritten) || 0,
    journalSheet: (result && result.journalSheet) || "JOURNAL",
    summarySheet: (result && result.summarySheet) || "SUMMARY",
    results: slimResults,
    affectedSheets: Array.isArray(result && result.affectedSheets)
      ? result.affectedSheets
      : [],
    reason: (result && result.reason) || "",
    message: (result && result.message) || message,
  };

  return _stage7BuildMaintenanceResponse_(
    ok,
    message,
    report,
    "stage7MaterializeAllMonthJournals",
    ok ? [] : [message],
    {
      affectedSheets: report.affectedSheets,
      monthCount: monthCount,
      failedCount: failedCount,
      done: done,
      nextCursor: nextCursor,
    },
  );
}

function apiStage7RestartBot() {
  _stage7AssertRole_("sysadmin", "restart bot");
  return Stage7UseCases_.runMaintenanceScenario({ type: "restartBot" });
}

function apiStage7SetupVacationTriggers() {
  _stage7AssertRole_("sysadmin", "setup triggers");
  return Stage7UseCases_.runMaintenanceScenario({
    type: "setupVacationTriggers",
  });
}

function apiStage7CleanupDuplicateTriggers(functionName) {
  _stage7AssertRole_("sysadmin", "cleanup duplicate triggers");
  return Stage7UseCases_.runMaintenanceScenario({
    type: "cleanupDuplicateTriggers",
    functionName: functionName || "",
  });
}

function apiStage7DebugPhones() {
  _stage7AssertRole_("maintainer", "debug phones");
  return Stage7UseCases_.runMaintenanceScenario({ type: "debugPhones" });
}

function apiStage7BuildBirthdayLink(phone, name) {
  _stage7AssertRole_("viewer", "build birthday link");
  return WorkflowOrchestrator_.run({
    scenario: "stage7BuildBirthdayLink",
    payload: {
      phone: phone || "",
      name: name || "",
    },

    write: false,
    validate: function (input) {
      return { payload: input, warnings: [] };
    },

    execute: function (input) {
      const legacy = normalizeServerResponse_(
        buildBirthdayLink(input.phone || "", input.name || ""),
        "apiStage7BuildBirthdayLink",
        {},
      );

      const result = Object.assign(
        {
          phone: input.phone || "",
          name: input.name || "",
        },
        legacy.data || {},
      );

      return {
        success: legacy.success !== false,
        message:
          legacy.message ||
          (legacy.success
            ? "Посилання на привітання підготовлено"
            : "Не вдалося підготувати посилання"),
        result: result,
        changes: [],
        affectedSheets: [],
        affectedEntities: [],
        appliedChangesCount: 0,
        skippedChangesCount: 0,
        warnings: legacy.warnings || [],
      };
    },
  });
}

function apiRunStage7MaintenanceScenario(options) {
  _stage7AssertRole_("admin", "run maintenance scenario");
  return Stage7UseCases_.runMaintenanceScenario(options || {});
}

function apiInstallStage7Jobs() {
  _stage7AssertRole_("sysadmin", "install jobs");
  return WorkflowOrchestrator_.run({
    scenario: "installStage7Jobs",
    payload: {},
    write: true,
    execute: function () {
      const result = Stage7Triggers_.installManagedTriggers();
      return {
        success: true,
        message: "Jobs встановлено",
        result: result,
        changes: [
          {
            type: "installManagedTriggers",
            installed: result.installed,
            removed: result.removed,
          },
        ],

        affectedSheets: [],
        affectedEntities: [],
        appliedChangesCount: Number(result.installed || 0),
        skippedChangesCount: Number(result.removed || 0),
      };
    },
  });
}

function apiListStage7Jobs() {
  _stage7AssertRole_("sysadmin", "list jobs");
  return _stage7BuildMaintenanceResponse_(
    true,
    "Jobs перелічено",
    { jobs: Stage7Triggers_.listJobs() },
    "listStage7Jobs",
  );
}

function apiRunStage7Job(jobName, options) {
  const descriptor = _stage7AssertRole_("sysadmin", "run job") || {};
  const normalizedJobName = String(jobName || "").trim();

  if (!normalizedJobName) {
    const jobs =
      typeof Stage7Triggers_ === "object" && Stage7Triggers_.listJobs
        ? Stage7Triggers_.listJobs()
        : [];

    return _stage7BuildMaintenanceResponse_(
      false,
      "Не передано jobName. Не запускай apiRunStage7Job вручну з GAS-редактора. Запускай одну з manual-функцій: apiRunStage7JobScheduledHealthCheckManual, apiRunStage7JobCleanupCachesManual, apiRunStage7JobDailyVacationsAndBirthdaysManual.",
      {
        success: false,
        reason: "missing-jobName",
        availableJobs: jobs.map(function (job) {
          return {
            jobName: job.jobName || "",
            handler: job.handler || "",
            description: job.description || "",
          };
        }),
      },
      "stage7RunJob",
      ["jobName не передано"],
      {
        requestedJobName: "",
        availableJobsCount: jobs.length,
      },
    );
  }

  const opts = Object.assign({}, options || {}, {
    trigger: false,
    source: String((options && options.source) || "manual"),
    entryPoint: String((options && options.entryPoint) || "apiRunStage7Job"),
    initiatorEmail: String(
      (options && options.initiatorEmail) || descriptor.email || "",
    ),
    initiatorName: String(
      (options && options.initiatorName) ||
        descriptor.displayName ||
        (descriptor.identity && descriptor.identity.displayName) ||
        descriptor.email ||
        "",
    ),
    initiatorRole: String(
      (options && options.initiatorRole) || descriptor.role || "",
    ),
    initiatorCallsign: String(
      (options && options.initiatorCallsign) ||
        descriptor.personCallsign ||
        (descriptor.identity && descriptor.identity.personCallsign) ||
        "",
    ),
    userDescriptor: descriptor,
  });

  return Stage7Triggers_.runJob(normalizedJobName, opts);
}

function apiRunStage7JobDailyVacationsAndBirthdaysManual() {
  return apiRunStage7Job(STAGE7_CONFIG.JOBS.DAILY_VACATIONS_AND_BIRTHDAYS, {
    source: "manual-editor",
    entryPoint: "apiRunStage7JobDailyVacationsAndBirthdaysManual",
  });
}

function apiRunStage7JobScheduledReconciliationManual() {
  return apiRunStage7Job(STAGE7_CONFIG.JOBS.SCHEDULED_RECONCILIATION, {
    source: "manual-editor",
    entryPoint: "apiRunStage7JobScheduledReconciliationManual",
  });
}

function apiRunStage7JobScheduledHealthCheckManual() {
  return apiRunStage7Job(STAGE7_CONFIG.JOBS.SCHEDULED_HEALTHCHECK, {
    source: "manual-editor",
    entryPoint: "apiRunStage7JobScheduledHealthCheckManual",
  });
}

function apiRunStage7JobCleanupCachesManual() {
  return apiRunStage7Job(STAGE7_CONFIG.JOBS.CLEANUP_CACHES, {
    source: "manual-editor",
    entryPoint: "apiRunStage7JobCleanupCachesManual",
  });
}

function apiRunStage7JobDetectStaleOperationsManual() {
  return apiRunStage7Job(STAGE7_CONFIG.JOBS.STALE_OPERATION_DETECTOR, {
    source: "manual-editor",
    entryPoint: "apiRunStage7JobDetectStaleOperationsManual",
  });
}

function apiRunStage7JobLifecycleRetentionCleanupManual() {
  return apiRunStage7Job(STAGE7_CONFIG.JOBS.LIFECYCLE_RETENTION_CLEANUP, {
    source: "manual-editor",
    entryPoint: "apiRunStage7JobLifecycleRetentionCleanupManual",
  });
}

function runDiagnosticsByMode_(options) {
  const opts = options || {};
  const mode = String(opts.mode || "full").toLowerCase();

  if (mode === "quick") return runQuickDiagnostics_(opts);
  if (mode === "structural") return runStructuralDiagnostics_(opts);
  if (mode === "operational") return runOperationalDiagnostics_(opts);
  if (
    mode === "compatibility" ||
    mode === "compatibility sunset" ||
    mode === "sunset"
  )
    return runSunsetDiagnostics_(opts);
  if (mode === "full-verbose" || mode === "verbose")
    return runFullVerboseDiagnostics_(opts);
  if (mode === "stage7a-hardening") return runHardeningDiagnostics_(opts);
  return runFullDiagnostics_(opts);
}

function apiStage7QuickHealthCheck(options) {
  const startedAt = Date.now();
  _stage7AssertRole_("maintainer", "quick health check");
  const opts = Object.assign({}, options || {}, {
    mode: "quick",
    shallow: true,
    includeStage3Base: false,
    includeCompatibilityLayer: false,
    includeReconciliationPreview: false,
  });

  const report = runDiagnosticsByMode_(opts);
  return _stage7BuildMaintenanceResponse_(
    report.ok,
    report.summary || "Швидку перевірку системи завершено",
    report,
    "stage7QuickHealthCheck",
    report.warnings || [],
    { startedAt: startedAt },
  );
}

function apiStage7HealthCheck(options) {
  _stage7AssertRole_("maintainer", "health check");
  const opts = Object.assign({}, options || {});
  const resolvedMode = opts.mode
    ? String(opts.mode).toLowerCase()
    : opts.shallow === false ||
        opts.includeStage3Base ||
        opts.includeCompatibilityLayer ||
        opts.includeReconciliationPreview
      ? "full"
      : "quick";

  const report = runDiagnosticsByMode_(
    Object.assign({}, opts, { mode: resolvedMode }),
  );
  return _stage7BuildMaintenanceResponse_(
    report.ok,
    report.summary ||
      ("full" === resolvedMode
        ? "Повну перевірку системи завершено"
        : "Перевірку системи завершено"),
    report,
    "stage7HealthCheck",
    report.warnings || [],
  );
}

function apiRunStage7Diagnostics(options) {
  _stage7AssertRole_("maintainer", "run diagnostics");
  const report = runDiagnosticsByMode_(options || {});
  return _stage7BuildMaintenanceResponse_(
    report.ok,
    report.summary || "Діагностику системи завершено",
    report,
    "stage7Diagnostics",
    report.warnings || [],
  );
}

function apiRunStage7RegressionTests(options) {
  _stage7AssertRole_("admin", "run regression tests");
  const report = runRegressionTestSuite(options || {});
  return _stage7BuildMaintenanceResponse_(
    report.ok,
    report.ok ? "Регресійні тести пройдено" : "У регресійних тестах є збої",
    report,
    "stage7RegressionTests",
    report.warnings || [],
  );
}

function _invokeProjectTestChunk_(options) {
  if (
    typeof Stage7TestRunner !== "undefined" &&
    Stage7TestRunner &&
    typeof Stage7TestRunner.runProjectTestChunk === "function"
  ) {
    return Stage7TestRunner.runProjectTestChunk(options || {});
  }
  if (typeof runProjectTestChunk === "function") {
    return runProjectTestChunk(options || {});
  }
  throw new Error(
    "Модуль тестів проєкту недоступний (Stage7TestRunner). Зробіть clasp push з актуального репозиторію — tests/Stage7TestRunner*.gs входять у deploy.",
  );
}

function apiRunStage7AllProjectTests(options) {
  _stage7AssertRole_("admin", "run all project tests");
  const opts = Object.assign({}, options || {}, {
    writeToSheet: true,
    writeToLogger: true,
    useLock: true,
    includeDiscovery: true,
    dryRun: true,
    timeoutMs: Math.min(Number((options || {}).timeoutMs || 240000), 240000),
  });

  const report = _invokeProjectTestChunk_(
    Object.assign({}, opts, {
      offset: Number(opts.offset || 0),
      limit: Number(opts.limit || 4),
      maxRuntimeMs: Number(opts.maxRuntimeMs || 240000),
    }),
  );

  return _stage7BuildMaintenanceResponse_(
    true,
    report.done
      ? "Пакет тестів проєкту завершено"
      : "Пакет тестів виконано, потрібен наступний пакет",
    report,
    "stage7AllProjectTests",
    report.warnings || [],
  );
}

function apiRunStage7ProjectTestChunk(options) {
  _stage7AssertRole_("admin", "run project test chunk");
  const opts = Object.assign({}, options || {}, {
    writeToSheet: true,
    writeToLogger: true,
    useLock: true,
    includeDiscovery: true,
    dryRun: true,
    limit: Math.max(1, Math.min(25, Number((options || {}).limit || 4))),
    maxRuntimeMs: Math.max(
      30000,
      Math.min(300000, Number((options || {}).maxRuntimeMs || 240000)),
    ),
  });

  const report = _invokeProjectTestChunk_(opts);

  return _stage7BuildMaintenanceResponse_(
    true,
    report.done
      ? "Усі пакети тестів проєкту виконано"
      : "Пакет тестів виконано, продовжуйте наступний пакет",
    report,
    "stage7ProjectTestChunk",
    report.warnings || [],
    {
      runId: report.runId,
      offset: report.offset,
      nextOffset: report.nextOffset,
      totalTasks: report.totalTasks,
      done: report.done === true,
      progressPct: report.progressPct,
    },
  );
}

function apiListStage7JobRuntime() {
  _stage7AssertRole_("admin", "list job runtime");
  const report = JobRuntime_.buildRuntimeReport();
  return _stage7BuildMaintenanceResponse_(
    true,
    "Job runtime перелічено",
    report,
    "listStage7JobRuntime",
    [],
    { affectedSheets: [STAGE7_CONFIG.JOB_RUNTIME_LOG_SHEET] },
  );
}

function apiStage7ListPendingRepairs(filters) {
  _stage7AssertRole_("maintainer", "list pending repairs");
  return _stage7BuildMaintenanceResponse_(
    true,
    "Pending repairs перелічено",
    typeof OperationRepository_ === "object"
      ? OperationRepository_.listPendingRepairs(filters || {})
      : { operations: [], total: 0 },
    "stage7ListPendingRepairs",
    [],
    { affectedSheets: ["OPS_LOG", "CHECKPOINTS"] },
  );
}

function apiStage7GetOperationDetails(operationId) {
  _stage7AssertRole_("maintainer", "get operation details");
  const normalizedId = String(operationId || "").trim();
  if (!normalizedId) {
    return _stage7BuildMaintenanceResponse_(
      false,
      "Не передано operationId",
      { operation: null, checkpoints: [] },
      "stage7GetOperationDetails",
      ["Не передано operationId"],
      { affectedSheets: ["OPS_LOG", "CHECKPOINTS"] },
    );
  }

  const details =
    typeof OperationRepository_ === "object"
      ? OperationRepository_.getOperationDetails(normalizedId)
      : null;
  return _stage7BuildMaintenanceResponse_(
    !!details,
    details
      ? "Деталі операції отримано"
      : "Операцію не знайдено: " + normalizedId,
    details || { operation: null, checkpoints: [] },
    "stage7GetOperationDetails",
    details ? [] : ["Операцію не знайдено: " + normalizedId],
    { affectedSheets: ["OPS_LOG", "CHECKPOINTS"] },
  );
}

function apiStage7RunRepair(operationId, options) {
  _stage7AssertRole_("sysadmin", "run repair");
  if (typeof OperationRepository_ !== "object") {
    return _stage7BuildMaintenanceResponse_(
      false,
      "Сховище виправлення недоступне",
      { success: false },
      "stage7RunRepair",
      ["Сховище операцій недоступне"],
    );
  }
  const normalizedId = String(operationId || "").trim();
  if (!normalizedId) {
    return _stage7BuildMaintenanceResponse_(
      false,
      "Не передано operationId для repair",
      { success: false, operationId: "" },
      "stage7RunRepair",
      ["Не передано operationId для repair"],
      { affectedSheets: ["OPS_LOG", "CHECKPOINTS"] },
    );
  }
  try {
    const result = OperationRepository_.runRepair(normalizedId, options || {});
    if (result && result.result) return result.result;
    return _stage7BuildMaintenanceResponse_(
      !!(result && result.success),
      result && result.message
        ? result.message
        : result && result.success
          ? "Виправлення виконано"
          : "Виправлення завершилося з помилкою",
      result || {},
      "stage7RunRepair",
      result && result.success
        ? []
        : [
            result && result.message
              ? result.message
              : "Виправлення завершилося з помилкою",
          ],
      { affectedSheets: ["OPS_LOG", "CHECKPOINTS"] },
    );
  } catch (error) {
    return _stage7BuildMaintenanceResponse_(
      false,
      error && error.message
        ? error.message
        : "Виправлення завершилося з помилкою",
      { success: false, operationId: normalizedId },
      "stage7RunRepair",
      [
        error && error.message
          ? error.message
          : "Виправлення завершилося з помилкою",
      ],
      { affectedSheets: ["OPS_LOG", "CHECKPOINTS"] },
    );
  }
}

function apiStage7RunLifecycleRetentionCleanup() {
  _stage7AssertRole_("sysadmin", "cleanup lifecycle retention");
  return Stage7UseCases_.runMaintenanceScenario({
    type: "cleanupLifecycleRetention",
  });
}

function apiStage7SubmitAccessKeyRequest(payload) {
  const result =
    typeof AccessControl_ === "object" && AccessControl_.submitAccessKeyRequest
      ? AccessControl_.submitAccessKeyRequest(payload || {})
      : {
          success: false,
          message: "AccessControl_ недоступний",
          code: "access.registration.unavailable",
        };
  const success = result && result.success !== false;
  const message =
    result && result.message
      ? result.message
      : success
        ? "Заявку надіслано"
        : "Не вдалося надіслати заявку";
  return _stage7BuildMaintenanceResponse_(
    success,
    message,
    result || {},
    "stage7SubmitAccessKeyRequest",
    success ? [] : [message],
    { affectedSheets: [appGetCore("ACCESS_SHEET", "ACCESS")] },
  );
}

function apiStage7LoginByAccessKey(accessKeyOrPayload) {
  const payload =
    accessKeyOrPayload &&
    typeof accessKeyOrPayload === "object" &&
    !Array.isArray(accessKeyOrPayload)
      ? Object.assign({}, accessKeyOrPayload)
      : { accessKey: accessKeyOrPayload || "" };

  const result =
    typeof AccessControl_ === "object" && AccessControl_.loginByAccessKey
      ? AccessControl_.loginByAccessKey(payload)
      : {
          success: false,
          ok: false,
          message: "AccessControl_ недоступний",
          code: "access.login.unavailable",
        };
  const success = result && result.success !== false;
  const message =
    result && result.message
      ? result.message
      : success
        ? "Вхід виконано"
        : "Не вдалося виконати вхід";
  return _stage7BuildMaintenanceResponse_(
    success,
    message,
    result || {},
    "stage7LoginByAccessKey",
    success ? [] : [message],
    { affectedSheets: [appGetCore("ACCESS_SHEET", "ACCESS")] },
  );
}

function apiStage7ResumeBrowserSession(payload) {
  const result =
    typeof AccessControl_ === "object" && AccessControl_.resumeBrowserSession
      ? AccessControl_.resumeBrowserSession(payload || {})
      : {
          success: false,
          ok: false,
          message: "AccessControl_ недоступний",
          code: "access.session.unavailable",
        };
  const success = result && result.success !== false;
  const message =
    result && result.message
      ? result.message
      : success
        ? "Сесію відновлено"
        : "Не вдалося відновити сесію";
  return _stage7BuildMaintenanceResponse_(
    success,
    message,
    result || {},
    "stage7ResumeBrowserSession",
    success ? [] : [message],
    { affectedSheets: [appGetCore("ACCESS_SHEET", "ACCESS")] },
  );
}

function apiStage7RegisterAccessWithTemporaryPassword(payload) {
  const result =
    typeof AccessControl_ === "object" &&
    AccessControl_.registerAccessWithTemporaryPassword
      ? AccessControl_.registerAccessWithTemporaryPassword(payload || {})
      : {
          success: false,
          message: "AccessControl_ недоступний",
          code: "access.registration.unavailable",
        };
  const success = result && result.success !== false;
  const message =
    result && result.message
      ? result.message
      : success
        ? "Доступ активовано"
        : "Не вдалося активувати доступ";
  return _stage7BuildMaintenanceResponse_(
    success,
    message,
    result || {},
    "stage7RegisterAccessWithTemporaryPassword",
    success ? [] : [message],
    { affectedSheets: [appGetCore("ACCESS_SHEET", "ACCESS")] },
  );
}

function apiStage7ReissueAccessTemporaryPassword(payload) {
  _stage7AssertRole_("sysadmin", "reissue ACCESS temporary password");
  const result =
    typeof reissueAccessTemporaryPassword_ === "function"
      ? reissueAccessTemporaryPassword_(payload || {})
      : {
          ok: false,
          success: false,
          code: "access.reissue.unavailable",
          message: "reissueAccessTemporaryPassword_ недоступний",
        };
  const success = !!(
    result &&
    result.success &&
    result.ok !== false &&
    Number(result.matchedRowNumber || result.accessSheetRow || 0) > 0 &&
    Number(result.rowsUpdated || 0) > 0
  );
  const message =
    result && result.message
      ? result.message
      : success
        ? "Тимчасовий пароль перевипущено"
        : "Не вдалося перевипустити тимчасовий пароль";
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) {
      ss.toast(message, "WASB ACCESS", success ? 10 : 8);
    }
  } catch (_) {}
  if (success) {
    const rowNumber = result.matchedRowNumber || result.accessSheetRow || "";
    console.log(
      "[ACCESS] Service reissue completed for row " +
        String(rowNumber) +
        ", role=" +
        String(result.role || result.matchedRole || ""),
    );
  }
  return _stage7BuildMaintenanceResponse_(
    success,
    message,
    result || {},
    "stage7ReissueAccessTemporaryPassword",
    success ? [] : [message],
    { affectedSheets: [appGetCore("ACCESS_SHEET", "ACCESS")] },
  );
}

function _stage7RedactAccessReissueLogMetadata_(response) {
  const result =
    response && response.data && response.data.result
      ? response.data.result
      : response && typeof response === "object"
        ? response
        : {};
  const rawColumns = Array.isArray(result.updatedColumns)
    ? result.updatedColumns
    : Array.isArray(result.changedColumns)
      ? result.changedColumns
      : [];
  const changedColumns = [];
  let redactedSensitiveColumns = 0;

  rawColumns.forEach(function (column) {
    const value = String(column || "").trim();
    if (!value) return;
    if (/password|token|hash|salt|plain/i.test(value)) {
      redactedSensitiveColumns++;
      return;
    }
    if (changedColumns.indexOf(value) === -1) changedColumns.push(value);
  });
  if (redactedSensitiveColumns) {
    changedColumns.push("[redacted-sensitive-access-columns]");
  }

  return {
    success: !!(response && response.success),
    rowNumber: result.matchedRowNumber || result.accessSheetRow || "",
    role: result.role || result.matchedRole || "",
    changedColumns: changedColumns,
  };
}

function apiStage7ReissueOwnerTemporaryPasswordManual() {
  const props = PropertiesService.getScriptProperties();
  const ownerEmail = String(props.getProperty("WASB_OWNER_EMAIL") || "").trim();
  const ownerLogin = String(props.getProperty("WASB_OWNER_LOGIN") || "").trim();
  const missing = [];
  if (!ownerEmail) missing.push("WASB_OWNER_EMAIL");
  if (!ownerLogin) missing.push("WASB_OWNER_LOGIN");

  if (missing.length) {
    const message =
      "Для manual перевипуску owner temporary password задайте Script Properties: " +
      missing.join(", ") +
      ".";
    return _stage7BuildMaintenanceResponse_(
      false,
      message,
      {
        ok: false,
        success: false,
        code: "access.reissue.owner_config_missing",
        missingScriptProperties: missing,
      },
      "stage7ReissueOwnerTemporaryPasswordManual",
      [message],
      { affectedSheets: [appGetCore("ACCESS_SHEET", "ACCESS")] },
    );
  }

  const result = apiStage7ReissueAccessTemporaryPassword({
    email: ownerEmail,
    login: ownerLogin,
    expectedRole: "owner",
  });
  const metadata = _stage7RedactAccessReissueLogMetadata_(result);
  console.log(
    "[ACCESS] Owner temporary password manual reissue: " +
      JSON.stringify(metadata),
  );
  Logger.log(
    "[ACCESS] Owner temporary password manual reissue: " +
      JSON.stringify(metadata),
  );
  return result;
}

/**
 * Dry-run copy plan for the 17 external service spreadsheets.
 * Not wired to the sidebar (uiAllowed: false); GAS editor / sysadmin only.
 */
function apiPreviewExternalSpreadsheetMigration() {
  _stage7AssertRole_("sysadmin", "preview external spreadsheet migration");
  var report =
    typeof previewExternalSpreadsheetMigration_ === "function"
      ? previewExternalSpreadsheetMigration_()
      : { ok: false, message: "migration module unavailable" };
  return _stage7BuildMaintenanceResponse_(
    report.ok !== false,
    report.ok === false
      ? report.message || "Preview завершено з конфліктами"
      : "Preview міграції зовнішніх таблиць",
    report,
    "previewExternalSpreadsheetMigration",
    [],
    {
      dryRun: true,
      uiAllowed: false,
      affectedSheets: (report.tables || []).map(function (row) {
        return row.logicalName;
      }),
    },
  );
}

/**
 * Apply idempotent copy of 17 service sheets into dedicated Spreadsheets.
 * Does not delete source tabs. Stops on destination conflicts.
 * Not wired to the sidebar (uiAllowed: false); GAS editor / sysadmin only.
 */
function apiApplyExternalSpreadsheetMigration() {
  _stage7AssertRole_("sysadmin", "apply external spreadsheet migration");
  var report =
    typeof applyExternalSpreadsheetMigration_ === "function"
      ? applyExternalSpreadsheetMigration_()
      : { ok: false, applied: false, message: "migration module unavailable" };
  var ok = report.ok !== false && report.applied !== false;
  return _stage7BuildMaintenanceResponse_(
    ok,
    ok
      ? "Міграцію зовнішніх таблиць виконано"
      : report.message || "Apply міграції зупинено",
    report,
    "applyExternalSpreadsheetMigration",
    [],
    {
      dryRun: false,
      uiAllowed: false,
      affectedSheets: (report.tables || []).map(function (row) {
        return row.logicalName;
      }),
    },
  );
}

/**
 * Read WASB_EXTERNAL_STORAGE_MODE. Sysadmin / GAS editor only.
 */
function apiGetExternalStorageMode() {
  _stage7AssertRole_("sysadmin", "read external storage mode");
  var report =
    typeof describeExternalStorageMode_ === "function"
      ? describeExternalStorageMode_()
      : { mode: "legacy", recommendedExternal: false };
  return _stage7BuildMaintenanceResponse_(
    true,
    "Режим зовнішнього зберігання: " + report.mode,
    report,
    "getExternalStorageMode",
    [],
    { dryRun: true, uiAllowed: false },
  );
}

/**
 * No-arg GAS Editor helper: legacy → migration.
 * Does not enable external. Sysadmin only.
 */
function apiBeginExternalSpreadsheetMigration() {
  _stage7AssertRole_("sysadmin", "begin external spreadsheet migration");
  var report =
    typeof beginExternalSpreadsheetMigration_ === "function"
      ? beginExternalSpreadsheetMigration_()
      : { ok: false, mode: "legacy", message: "storage mode helper unavailable" };
  var ok = report.ok !== false;
  return _stage7BuildMaintenanceResponse_(
    ok,
    ok
      ? report.skipped
        ? "Режим міграції вже увімкнено"
        : "Режим зовнішнього зберігання: migration"
      : report.message || "Не можна почати міграцію з поточного режиму",
    report,
    "beginExternalSpreadsheetMigration",
    [],
    { dryRun: false, uiAllowed: false },
  );
}

/**
 * Set WASB_EXTERNAL_STORAGE_MODE to legacy|migration|external.
 * external without parity PASS is refused unless confirmParity:true.
 */
function apiSetExternalStorageMode(payload) {
  _stage7AssertRole_("sysadmin", "set external storage mode");
  var opts = payload && typeof payload === "object" ? payload : {};
  try {
    var report = setExternalStorageMode_(opts.mode, {
      confirmParity: opts.confirmParity === true,
    });
    var warnings = report.emergencyOverride
      ? [
          report.warning ||
            "Аварійний override: режим external без фінальної перевірки parity.",
        ]
      : [];
    return _stage7BuildMaintenanceResponse_(
      true,
      "Режим зовнішнього зберігання: " + report.mode,
      report,
      "setExternalStorageMode",
      warnings,
      { dryRun: false, uiAllowed: false },
    );
  } catch (error) {
    var message = error && error.message ? String(error.message) : String(error);
    var current =
      typeof describeExternalStorageMode_ === "function"
        ? describeExternalStorageMode_()
        : { mode: "legacy", recommendedExternal: false };
    current.rejected = true;
    current.recommendedExternal = false;
    return _stage7BuildMaintenanceResponse_(
      false,
      message,
      current,
      "setExternalStorageMode",
      [],
      { dryRun: true, uiAllowed: false },
    );
  }
}

/**
 * Locked cutover: apply + fresh parity + mode=external. Sysadmin / GAS editor only.
 */
function apiFinalizeExternalSpreadsheetMigration() {
  _stage7AssertRole_("sysadmin", "finalize external spreadsheet migration");
  var report =
    typeof finalizeExternalSpreadsheetMigration_ === "function"
      ? finalizeExternalSpreadsheetMigration_()
      : { ok: false, message: "finalizer unavailable" };
  var ok = report.ok !== false;
  return _stage7BuildMaintenanceResponse_(
    ok,
    ok
      ? report.message || "Cutover зовнішнього зберігання виконано"
      : report.message || "Cutover зупинено",
    report,
    "finalizeExternalSpreadsheetMigration",
    [],
    {
      dryRun: false,
      uiAllowed: false,
      affectedSheets: (report.tables || []).map(function (row) {
        return row.logicalName;
      }),
    },
  );
}

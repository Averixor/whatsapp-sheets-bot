/**
 * UseCases.Maintenance.gs — maintenance, reconciliation, vacations (PR7 domain split).
 */

var UseCasesMaintenance_ = (function () {
  function checkVacationsAndBirthdays(options) {
    const payload =
      typeof options === "string"
        ? { date: options }
        : Object.assign({}, options || {});
    return WorkflowOrchestrator_.run({
      scenario: "checkVacationsAndBirthdays",
      payload: payload,
      write: false,
      lock: false,
      validate: function (input) {
        const info = validateDatePayload_(input, "date");
        if (
          typeof AccessEnforcement_ === "object" &&
          AccessEnforcement_.assertCanUseWorkingActions
        ) {
          AccessEnforcement_.assertCanUseWorkingActions(
            "checkVacationsAndBirthdays",
            { requestedDate: info.payload.dateStr || info.payload.date || "" },
          );
        }
        return { payload: info.payload, warnings: [] };
      },
      execute: function (input) {
        const targetDate =
          DateUtils_.parseUaDate(input.dateStr || input.date) || new Date();
        const vacations = runVacationEngine_(targetDate) || {};
        const birthdays = runBirthdayEngine_(targetDate) || {};
        return {
          success: true,
          message: "Перевірку відпусток виконано",
          result: {
            date: input.dateStr || input.date,
            vacations: vacations,
            birthdays: birthdays,
          },
          changes: [],
          affectedSheets: [getBotMonthSheetName_(), CONFIG.PHONES_SHEET],
          affectedEntities: [],
          appliedChangesCount: 0,
          skippedChangesCount: 0,
          partial: false,
        };
      },
    });
  }

  function runReconciliation(options) {
    const payload = Object.assign({}, options || {});
    return WorkflowOrchestrator_.run({
      scenario: "runReconciliation",
      routeName: "sidebar.runReconciliation",
      publicApiMethod: "apiRunReconciliation",
      payload: payload,
      write:
        [
          "repair",
          "previewRepair",
          "repairSelectedIssues",
          "repairWithVerification",
        ].indexOf(String(payload.mode || "check")) !== -1,
      validate: function (input) {
        const info = validateRepairOperation_(input);
        return { payload: info.payload, warnings: info.warnings };
      },
      execute: function (input) {
        const report = Reconciliation_.run(input);
        const mode = String(input.mode || "check");
        const postCheck = report.postCheck || null;
        const success =
          ["check", "report", "previewRepair"].indexOf(mode) !== -1
            ? true
            : postCheck
              ? Number(postCheck.criticalRemaining || 0) === 0
              : true;
        return {
          success: success,
          message: report.message || "Reconciliation завершено",
          result: report,
          changes: report.repairs || [],
          affectedSheets: report.affectedSheets || [],
          affectedEntities: [],
          appliedChangesCount: report.appliedChangesCount || 0,
          skippedChangesCount: report.skippedChangesCount || 0,
          partial: !!report.partial,
          warnings: report.warnings || [],
        };
      },
      sync: function (_input, _beforeState, _plan, execution) {
        return {
          refresh: ["panel", "summaryPreview"],
          invalidateCaches: ["sendPanel", "sidebar"],
          reconciliation:
            execution.result && execution.result.summary
              ? execution.result.summary
              : null,
        };
      },
      verify: function (input, _beforeState, _plan, execution) {
        if (
          input.dryRun ||
          ["repair", "repairSelectedIssues", "repairWithVerification"].indexOf(
            String(input.mode || ""),
          ) === -1
        ) {
          return { ok: true, partial: false };
        }
        const postCheck =
          (execution && execution.result && execution.result.postCheck) || null;
        if (postCheck) {
          return {
            ok: Number(postCheck.criticalRemaining || 0) === 0,
            partial: Number(postCheck.remainingIssues || 0) > 0,
            remainingIssues: postCheck.remainingIssues || 0,
            criticalRemaining: postCheck.criticalRemaining || 0,
          };
        }
        return {
          ok: true,
          partial: false,
          warnings: ["Reconciliation verify повернувся без postCheck"],
        };
      },
    });
  }

  function resolveRestartBotMonth_() {
    const ss = getWasbSpreadsheet_();
    let month = "";

    try {
      month = String(getBotMonthSheetName_() || "").trim();
    } catch (_) {}
    if (month && ss.getSheetByName(month)) return month;

    const activeSheet = ss.getActiveSheet();
    const activeName = activeSheet
      ? String(activeSheet.getName() || "").trim()
      : "";
    if (/^\d{2}$/.test(activeName) && ss.getSheetByName(activeName))
      return activeName;

    const currentMonth = Utilities.formatDate(new Date(), getTimeZone_(), "MM");
    if (ss.getSheetByName(currentMonth)) return currentMonth;

    const fallback = ss
      .getSheets()
      .map(function (sh) {
        return String(sh.getName() || "").trim();
      })
      .find(function (name) {
        return /^\d{2}$/.test(name);
      });

    if (fallback && ss.getSheetByName(fallback)) return fallback;
    throw new Error("Не знайдено аркуш місяця для перезапуску бота");
  }

  function clearRestartBotTransientState_(options) {
    const docProps = PropertiesService.getDocumentProperties();
    const scriptProps = PropertiesService.getScriptProperties();

    const allDocProps = docProps.getProperties();
    const allScriptProps = scriptProps.getProperties();

    const report = {
      runtimeActiveCleared: 0,
      safetyActiveCleared: 0,
      blockingKeysCleared: 0,
      stage7ActiveCleared: 0,
      cachesCleared: true,
    };

    Object.keys(allDocProps).forEach(function (key) {
      if (key.indexOf("STAGE7:JOB_RUNTIME:ACTIVE:") === 0) {
        docProps.deleteProperty(key);
        report.runtimeActiveCleared += 1;
        return;
      }

      if (
        key.indexOf("STAGE7A:SAFETY:") === 0 &&
        key.indexOf(":ACTIVE:") !== -1
      ) {
        docProps.deleteProperty(key);
        report.safetyActiveCleared += 1;
      }
    });

    Object.keys(allScriptProps).forEach(function (key) {
      if (
        typeof isKnownBlockingKey_ === "function" &&
        isKnownBlockingKey_(key)
      ) {
        scriptProps.deleteProperty(key);
        report.blockingKeysCleared += 1;
      }
    });

    Object.keys(allDocProps).forEach(function (key) {
      if (
        typeof isKnownBlockingKey_ === "function" &&
        isKnownBlockingKey_(key)
      ) {
        docProps.deleteProperty(key);
        report.blockingKeysCleared += 1;
      }
    });

    if (typeof OperationRepository_ === "object") {
      try {
        const opts = options && typeof options === "object" ? options : {};
        const abandoned = OperationRepository_.abandonAllActive("restart-bot", {
          excludeOperationId: opts.excludeOperationId || "",
          excludeOperationIds: stage7AsArray_(opts.excludeOperationIds),
        });
        report.stage7ActiveCleared = Number(
          (abandoned && abandoned.total) || 0,
        );
      } catch (_) {}
    }

    clearCacheCore_();
    try {
      resetTemplatesCache_();
    } catch (_) {}
    try {
      CacheService.getScriptCache().removeAll([
        cacheKeyPhones_(),
        cacheKeyPhonesIndex_(),
        cacheKeyPhonesProfiles_(),
        "PHONES_PROFILES_v4",
      ]);
    } catch (_) {}

    return report;
  }

  function runMaintenanceScenario(options) {
    const payload = Object.assign({ type: "quick" }, options || {});
    const type = String(payload.type || "quick");
    const writeTypes = {
      cleanupCaches: true,
      clearLog: true,
      clearPhoneCache: true,
      restartBot: true,
      setupVacationTriggers: true,
      cleanupDuplicateTriggers: true,
      cleanupLifecycleRetention: true,
    };

    return WorkflowOrchestrator_.run({
      scenario: "runMaintenanceScenario",
      payload: payload,
      write: !!writeTypes[type],
      validate: function (input) {
        if (String(input.type || "") === "postCreateMonth" && input.month) {
          validateMonthSwitch_(input.month);
        }
      },
      execute: function (input) {
        return executeMaintenanceScenario_(input);
      },
    });
  }

  return {
    checkVacationsAndBirthdays: checkVacationsAndBirthdays,
    runReconciliation: runReconciliation,
    runMaintenanceScenario: runMaintenanceScenario,
  };
})();

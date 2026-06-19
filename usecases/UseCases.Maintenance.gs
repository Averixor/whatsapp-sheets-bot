/**
 * UseCases.Maintenance.gs — maintenance, reconciliation, vacations (PR7 domain split).
 */

var UseCasesMaintenance_ = (function () {
  function buildLeaveBirthdayAccessDescriptor_(payload) {
    if (
      typeof AccessEnforcement_ === "object" &&
      AccessEnforcement_.buildSystemTriggerAccessDescriptor
    ) {
      return AccessEnforcement_.buildSystemTriggerAccessDescriptor(payload);
    }
    return null;
  }

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
          AccessEnforcement_.assertCanRunLeaveBirthdayCheck
        ) {
          AccessEnforcement_.assertCanRunLeaveBirthdayCheck(
            { requestedDate: info.payload.dateStr || info.payload.date || "" },
            buildLeaveBirthdayAccessDescriptor_(info.payload),
          );
        }
        return { payload: info.payload, warnings: [] };
      },
      execute: function (input) {
        const targetDate =
          DateUtils_.parseUaDate(input.dateStr || input.date) || new Date();
        const vacations = runVacationEngine_(targetDate, input) || {};
        const birthdays = runBirthdayEngine_(targetDate, input) || {};
        const emailDigest =
          typeof sendLeaveBirthdayReminderDigestEmail_ === "function"
            ? sendLeaveBirthdayReminderDigestEmail_(
                vacations,
                birthdays,
                input,
              )
            : null;
        return {
          success: true,
          message: "Перевірку відпусток виконано",
          result: {
            date: input.dateStr || input.date,
            vacations: vacations,
            birthdays: birthdays,
            emailDigest: emailDigest,
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
        return { payload: input, warnings: [] };
      },
      execute: function (input, beforeState, plan, context) {
        switch (String(input.type || "quick")) {
          case "cleanupCaches":
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
            return {
              success: true,
              message: "Кеші очищено",
              result: { cleaned: true, type: "cleanupCaches" },
              changes: [{ type: "cleanupCaches" }],
              affectedSheets: [],
              affectedEntities: [],
              appliedChangesCount: 1,
              skippedChangesCount: 0,
              partial: false,
            };

          case "clearLog": {
            const response = normalizeServerResponse_(
              LogsRepository_.clear(),
              "clearLog",
              {},
            );
            const result = Object.assign(
              { type: "clearLog" },
              response.data || {},
            );
            const cleared = !!result.cleared;
            const clearedSheets = stage7AsArray_(result.clearedSheets);
            return {
              success: response.success !== false,
              message:
                response.message ||
                (cleared ? "Логи очищено" : "Жоден лог-аркуш не знайдено"),
              result: result,
              changes: cleared
                ? [{ type: "clearLog", sheets: clearedSheets }]
                : [],
              affectedSheets: clearedSheets,
              affectedEntities: [],
              appliedChangesCount: clearedSheets.length,
              skippedChangesCount: cleared ? 0 : 1,
              warnings: response.warnings || [],
            };
          }

          case "clearPhoneCache": {
            if (typeof invalidatePersonnelCache_ === "function") {
              invalidatePersonnelCache_();
            }
            const keys = [
              cacheKeyPhones_(),
              cacheKeyPhonesIndex_(),
              cacheKeyPhonesProfiles_(),
              "PHONES_PROFILES_v4",
            ];
            CacheService.getScriptCache().removeAll(keys);
            return {
              success: true,
              message: "Кеш телефонів очищено",
              result: {
                cleaned: true,
                type: "clearPhoneCache",
                keys: keys,
              },
              changes: [{ type: "clearPhoneCache", keys: keys }],
              affectedSheets: [],
              affectedEntities: [],
              appliedChangesCount: 1,
              skippedChangesCount: 0,
              partial: false,
            };
          }

          case "restartBot": {
            const month = resolveRestartBotMonth_();
            const restartReport = clearRestartBotTransientState_({
              excludeOperationId:
                context && context.operationId ? context.operationId : "",
            });
            setBotMonthSheetName_(month);
            highlightActiveMonthTab_(month);
            try {
              const sh = getWasbSpreadsheet_().getSheetByName(month);
              if (sh) sh.activate();
            } catch (_) {}
            return {
              success: true,
              message: "Бота повністю перезапущено",
              result: Object.assign(
                {
                  type: "restartBot",
                  restarted: true,
                  month: month,
                  restartedAt: stage7NowIso_(),
                },
                restartReport,
              ),
              changes: [
                {
                  type: "restartBot",
                  month: month,
                  runtimeActiveCleared: Number(
                    restartReport.runtimeActiveCleared || 0,
                  ),
                  safetyActiveCleared: Number(
                    restartReport.safetyActiveCleared || 0,
                  ),
                  blockingKeysCleared: Number(
                    restartReport.blockingKeysCleared || 0,
                  ),
                  stage7ActiveCleared: Number(
                    restartReport.stage7ActiveCleared || 0,
                  ),
                },
              ],
              affectedSheets: month ? [month] : [],
              affectedEntities: [],
              appliedChangesCount:
                1 +
                Number(restartReport.runtimeActiveCleared || 0) +
                Number(restartReport.safetyActiveCleared || 0) +
                Number(restartReport.blockingKeysCleared || 0) +
                Number(restartReport.stage7ActiveCleared || 0),
              skippedChangesCount: 0,
              partial: false,
            };
          }

          case "setupVacationTriggers": {
            const setup = setupVacationTrigger();
            return {
              success: setup.success !== false,
              message:
                setup.message ||
                (setup.success === false
                  ? "Не вдалося налаштувати тригери"
                  : "Тригери налаштовано"),
              result: Object.assign(
                { type: "setupVacationTriggers" },
                setup || {},
              ),
              changes: [
                {
                  type: "setupVacationTriggers",
                  removed: Number((setup && setup.removed) || 0),
                },
              ],
              affectedSheets: [],
              affectedEntities: [],
              appliedChangesCount: 1,
              skippedChangesCount: Number((setup && setup.removed) || 0),
              warnings:
                setup && setup.success === false
                  ? [String(setup.error || "Помилка setupVacationTriggers")]
                  : [],
            };
          }

          case "cleanupDuplicateTriggers": {
            const cleanup = cleanupDuplicateTriggers(input.functionName || "");
            const success =
              cleanup && cleanup.ok !== false && cleanup.success !== false;
            return {
              success: success,
              message: success
                ? Number(cleanup.removed || 0)
                  ? "Дублі тригерів очищено"
                  : "Дублі тригерів не знайдено"
                : "Не вдалося очистити дублікати тригерів",
              result: Object.assign(
                { type: "cleanupDuplicateTriggers" },
                cleanup || {},
              ),
              changes: Number((cleanup && cleanup.removed) || 0)
                ? [
                    {
                      type: "cleanupDuplicateTriggers",
                      removed: Number(cleanup.removed || 0),
                    },
                  ]
                : [],
              affectedSheets: [],
              affectedEntities: [],
              appliedChangesCount: Number((cleanup && cleanup.removed) || 0),
              skippedChangesCount: Math.max(
                Number((cleanup && cleanup.found) || 0) -
                  Number((cleanup && cleanup.removed) || 0),
                0,
              ),
              warnings: success
                ? []
                : [
                    String(
                      (cleanup && cleanup.error) ||
                        "Помилка cleanupDuplicateTriggers",
                    ),
                  ],
            };
          }

          case "debugPhones": {
            const debug = debugPhones();
            const success = debug && debug.success !== false;
            return {
              success: success,
              message: success
                ? "Діагностику телефонів виконано"
                : "Діагностика телефонів завершилась з помилкою",
              result: Object.assign({ type: "debugPhones" }, debug || {}),
              changes: [],
              affectedSheets: [CONFIG.PHONES_SHEET],
              affectedEntities: [],
              appliedChangesCount: 0,
              skippedChangesCount: 0,
              warnings: success
                ? []
                : [String((debug && debug.error) || "Помилка debugPhones")],
            };
          }

          case "cleanupLifecycleRetention": {
            const cleanup =
              typeof OperationRepository_ === "object"
                ? OperationRepository_.runRetentionCleanup()
                : {
                    archived: 0,
                    removedActiveStale: 0,
                    archivedCheckpoints: 0,
                  };
            var alertsCleanup = null;
            if (typeof clearOldAlerts === "function") {
              try {
                alertsCleanup = clearOldAlerts(
                  Number(appGetCore("ALERTS_RETENTION_DAYS", 30)) || 30,
                );
              } catch (alertsErr) {
                alertsCleanup = {
                  success: false,
                  error:
                    alertsErr && alertsErr.message
                      ? alertsErr.message
                      : String(alertsErr),
                };
              }
            }
            return {
              success: true,
              message: "Lifecycle retention cleanup виконано",
              result: Object.assign(
                { type: "cleanupLifecycleRetention" },
                cleanup || {},
                {
                  alertsCleanup: alertsCleanup,
                },
              ),
              changes: [
                {
                  type: "cleanupLifecycleRetention",
                  archived: Number((cleanup && cleanup.archived) || 0),
                  archivedCheckpoints: Number(
                    (cleanup && cleanup.archivedCheckpoints) || 0,
                  ),
                  removedActiveStale: Number(
                    (cleanup && cleanup.removedActiveStale) || 0,
                  ),
                },
              ],
              affectedSheets: ["OPS_LOG", "ACTIVE_OPERATIONS", "CHECKPOINTS"],
              affectedEntities: [],
              appliedChangesCount:
                Number((cleanup && cleanup.archived) || 0) +
                Number((cleanup && cleanup.archivedCheckpoints) || 0) +
                Number((cleanup && cleanup.removedActiveStale) || 0),
              skippedChangesCount: 0,
              partial: false,
            };
          }

          case "postCreateMonth":
            if (input.month) validateMonthSwitch_(input.month);
            return {
              success: true,
              message: "Post-create-month перевірку виконано",
              result: {
                month: input.month || getBotMonthSheetName_(),
                health: runFullDiagnostics_({ mode: "full" }),
              },
              changes: [],
              affectedSheets: [input.month || getBotMonthSheetName_()],
              affectedEntities: [],
              appliedChangesCount: 0,
              skippedChangesCount: 0,
              partial: false,
            };

          case "healthCheck": {
            const diagnosticsMode = input.mode
              ? String(input.mode).toLowerCase()
              : input.shallow
                ? "quick"
                : "full";
            const diagnosticsReport =
              diagnosticsMode === "quick"
                ? runQuickDiagnostics_({
                    mode: "quick",
                    shallow: true,
                    includeStage3Base: false,
                    includeCompatibilityLayer: false,
                    includeReconciliationPreview: false,
                  })
                : runFullDiagnostics_({
                    mode: diagnosticsMode,
                    shallow: !!input.shallow,
                    includeReconciliationPreview:
                      input.includeReconciliationPreview,
                  });
            return {
              success: true,
              message:
                diagnosticsMode === "quick"
                  ? "Quick health check виконано"
                  : "Health check виконано",
              result: diagnosticsReport,
              changes: [],
              affectedSheets: [],
              affectedEntities: [],
              appliedChangesCount: 0,
              skippedChangesCount: 0,
              partial: false,
            };
          }

          default:
            return {
              success: true,
              message: "Quick maintenance виконано",
              result: {
                health: runFullDiagnostics_({ mode: "full" }),
              },
              changes: [],
              affectedSheets: [],
              affectedEntities: [],
              appliedChangesCount: 0,
              skippedChangesCount: 0,
              partial: false,
            };
        }
      },
      sync: function (input) {
        switch (String(input.type || "quick")) {
          case "cleanupCaches":
            return {
              invalidateCaches: [
                "sidebar",
                "summary",
                "sendPanel",
                "templates",
              ],
            };

          case "clearPhoneCache":
            return {
              invalidateCaches: ["sidebar", "summary"],
            };

          case "restartBot":
            return {
              refresh: ["currentMonth", "monthsList", "panel"],
              invalidateCaches: [
                "sidebar",
                "summary",
                "sendPanel",
                "templates",
              ],
              currentMonth: resolveRestartBotMonth_(),
            };

          case "clearLog":
          case "setupVacationTriggers":
          case "cleanupDuplicateTriggers":
          case "debugPhones":
          case "healthCheck":
          case "postCreateMonth":
          default:
            return {};
        }
      },
    });
  }

  return {
    checkVacationsAndBirthdays: checkVacationsAndBirthdays,
    runReconciliation: runReconciliation,
    runMaintenanceScenario: runMaintenanceScenario,
  };
})();

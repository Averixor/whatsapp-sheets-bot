/**
 * UseCases.MonthOps.gs — month switch / create next month (PR7 domain split).
 */

function _stage7CreateNextMonthCore_(payload) {
  const ss = getWasbSpreadsheet_();
  const explicitSource =
    payload && payload.sourceMonth
      ? validateMonthSwitch_(payload.sourceMonth).sheet
      : getBotSheet_();
  const src = explicitSource;
  const srcName = String(src.getName()).trim();

  _stage7Assert_(
    /^\d{2}$/.test(srcName),
    "_stage7CreateNextMonthCore_",
    { sheet: srcName },
    `Активний лист "${srcName}" не є місячним`,
  );

  let nextNum = parseInt(srcName, 10) + 1;
  if (nextNum > 12) nextNum = 1;
  if (nextNum < 1) nextNum = 1;

  const nextName = String(nextNum).padStart(2, "0");
  _stage7Assert_(
    !ss.getSheetByName(nextName),
    "_stage7CreateNextMonthCore_",
    { sourceMonth: srcName, nextMonth: nextName },
    `Лист "${nextName}" вже існує`,
  );

  const newSheet = src.copyTo(ss).setName(nextName);
  const srcMY = _inferMonthYearFromSheet_(src);
  const targetMonth = nextNum;
  const targetYear = targetMonth < srcMY.month ? srcMY.year + 1 : srcMY.year;

  const monthGrid = _setMonthDatesRow_(newSheet, targetMonth, targetYear);
  newSheet.getRange(monthGrid.clearRangeA1).clearContent();

  try {
    applyGlobalSheetStandards_();
  } catch (_) {}

  try {
    if (typeof syncMonthlyCallsignsFromPersonnel_ === "function") {
      syncMonthlyCallsignsFromPersonnel_(newSheet);
    }
  } catch (syncErr) {
    console.error(syncErr);
  }

  if (payload.switchToNewMonth !== false) {
    setBotMonthSheetName_(nextName);
  } else {
    highlightActiveMonthTab_(getBotMonthSheetName_());
  }

  return {
    sheet: newSheet,
    sourceMonth: srcName,
    createdMonth: nextName,
    switched: payload.switchToNewMonth !== false,
  };
}

var UseCasesMonthOps_ = (function () {
  function switchBotToMonth(options, monthSheetName) {
    const payload =
      typeof options === "string"
        ? { month: options }
        : Object.assign(
            {},
            options || {},
            monthSheetName ? { month: monthSheetName } : {},
          );
    return WorkflowOrchestrator_.run({
      scenario: "switchBotToMonth",
      payload: payload,
      write: true,
      idempotency: false,
      validate: function (input) {
        const validated = validateMonthSwitch_(
          input.month || input.monthSheetName || input.sheetName || "",
        );
        if (
          typeof AccessEnforcement_ === "object" &&
          AccessEnforcement_.assertCanUseWorkingActions
        ) {
          AccessEnforcement_.assertCanUseWorkingActions("switchBotToMonth", {
            requestedMonth: validated.month,
          });
        }
        return {
          payload: Object.assign({}, input, { month: validated.month }),
          warnings: [],
        };
      },
      execute: function (input) {
        setBotMonthSheetName_(input.month);
        try {
          const ss = getWasbSpreadsheet_();
          const sh = ss.getSheetByName(input.month);
          if (sh) sh.activate();
        } catch (_) {}
        return {
          success: true,
          message: "Активний місяць перемкнуто",
          result: {
            month: input.month,
          },
          changes: [
            {
              type: "switchBotMonth",
              month: input.month,
            },
          ],
          affectedSheets: [input.month],
          affectedEntities: [],
          appliedChangesCount: 1,
          skippedChangesCount: 0,
          partial: false,
        };
      },
      sync: function (input) {
        return {
          refresh: ["monthsList", "currentMonth", "panel"],
          invalidateCaches: ["sidebar", "summary", "sendPanel"],
          currentMonth: input.month,
        };
      },
    });
  }

  function createNextMonth(options) {
    const payload = Object.assign({ switchToNewMonth: true }, options || {});
    return WorkflowOrchestrator_.run({
      scenario: "createNextMonth",
      routeName: "sidebar.createNextMonth",
      publicApiMethod: "apiCreateNextMonthStage4",
      payload: payload,
      write: true,
      validate: function (input) {
        if (input.sourceMonth) validateMonthSwitch_(input.sourceMonth);
        if (
          typeof AccessEnforcement_ === "object" &&
          AccessEnforcement_.assertCanUseWorkingActions
        ) {
          AccessEnforcement_.assertCanUseWorkingActions("createNextMonth", {
            requestedSourceMonth: input.sourceMonth || "",
          });
        }
        return { payload: input, warnings: [] };
      },
      execute: function (input) {
        const created = _stage7CreateNextMonthCore_(input);
        return {
          success: true,
          message: `Місяць "${created.createdMonth}" створено`,
          result: created,
          changes: [
            {
              type: "createMonthSheet",
              from: created.sourceMonth,
              to: created.createdMonth,
            },
          ],
          affectedSheets: [created.sourceMonth, created.createdMonth],
          affectedEntities: [],
          appliedChangesCount: 1,
          skippedChangesCount: 0,
          partial: false,
        };
      },
      sync: function (_input, _beforeState, _plan, execution) {
        return {
          refresh: ["monthsList", "currentMonth"],
          invalidateCaches: ["sidebar", "summary"],
          currentMonth:
            execution.result && execution.result.switched
              ? execution.result.createdMonth
              : getBotMonthSheetName_(),
        };
      },
      verify: function (input, _beforeState, _plan, execution) {
        if (input.dryRun)
          return {
            ok: true,
            createdMonth:
              (execution.result && execution.result.createdMonth) || "",
            partial: false,
          };
        const createdMonth =
          (execution.result && execution.result.createdMonth) || "";
        const exists = !!getWasbSpreadsheet_().getSheetByName(createdMonth);
        return {
          ok: exists,
          createdMonth: createdMonth,
          partial: !exists,
          warnings: exists
            ? []
            : ["Післяопераційна перевірка не знайшла створений місяць"],
        };
      },
    });
  }

  return {
    switchBotToMonth: switchBotToMonth,
    createNextMonth: createNextMonth,
  };
})();

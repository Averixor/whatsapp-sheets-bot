/**
 * Remote GAS runtime smoke — post-deploy verification via clasp run.
 *
 *   npm run gas:smoke
 *   clasp -P .clasp.smoke.json run apiRunSmokeChecks
 */
function apiRunSmokeChecks() {
  var result = {
    ok: true,
    checks: {},
    errors: [],
  };

  try {
    result.checks.accessPolicy = runAccessPolicyChecks({
      safeTestEnvironment: true,
    });
    if (result.checks.accessPolicy && result.checks.accessPolicy.ok === false) {
      result.ok = false;
      result.errors.push({
        check: "accessPolicy",
        message: "runAccessPolicyChecks returned ok:false",
      });
    }
  } catch (err) {
    result.ok = false;
    result.errors.push({
      check: "accessPolicy",
      message: String((err && err.message) || err),
    });
  }

  try {
    result.checks.normalizeAccess = apiStage7NormalizeAccessSheetFormatting();
  } catch (err) {
    result.ok = false;
    result.errors.push({
      check: "normalizeAccess",
      message: String((err && err.message) || err),
    });
  }

  try {
    result.checks.clientSignal = apiStage7ReportClientAccessSignal(
      "sidebarActionUiDenied",
      {
        source: "ci-smoke",
        requestedAction: "runtime-test",
      },
    );
  } catch (err) {
    result.ok = false;
    result.errors.push({
      check: "clientSignal",
      message: String((err && err.message) || err),
    });
  }

  try {
    result.checks.health = apiStage7QuickHealthCheck();
  } catch (err) {
    result.ok = false;
    result.errors.push({
      check: "health",
      message: String((err && err.message) || err),
    });
  }

  try {
    result.checks.migrationFlag = PropertiesService.getScriptProperties().getProperty(
      "WASB_ACCESS_TEMP_PASSWORD_PLAIN_LOOKUP",
    );
    if (String(result.checks.migrationFlag || "").toLowerCase() === "true") {
      result.ok = false;
      result.errors.push({
        check: "migrationFlag",
        message: "WASB_ACCESS_TEMP_PASSWORD_PLAIN_LOOKUP must not be true",
      });
    }
  } catch (err) {
    result.ok = false;
    result.errors.push({
      check: "migrationFlag",
      message: String((err && err.message) || err),
    });
  }

  return result;
}

/**
 * Self-cleaning vacation runtime smoke for the separate smoke project.
 * It intentionally bypasses sidebar RBAC only inside this smoke-only bundle;
 * all domain, repository, writer, engine, and sheet operations stay real.
 */
function apiRunVacationRuntimeSmoke() {
  var token = "VAC-SMOKE-" + Utilities.getUuid().slice(0, 8).toUpperCase();
  var fml = token + " Тест";
  var callsign = token;
  var report = {
    ok: true,
    token: token,
    checks: {},
    cleanup: {},
    errors: [],
  };
  var context = {
    createdCalculationSheet: false,
    personnelRow: 0,
    requestId: "",
    previousSourceProperty: null,
  };
  var ss = null;
  var calculationSheet = null;
  var calculationBefore = "";

  try {
    ss = _vacationRuntimeSmokeSpreadsheet_();
    report.spreadsheetId = ss.getId();
    report.spreadsheetUrl = ss.getUrl();

    calculationSheet = ss.getSheetByName("Calculation_OS");
    if (!calculationSheet) {
      calculationSheet = ss.insertSheet("Calculation_OS");
      calculationSheet.getRange(1, 1).setValue("VACATION_RUNTIME_SMOKE_GUARD");
      context.createdCalculationSheet = true;
    }
    calculationBefore = _vacationRuntimeSmokeFingerprint_(calculationSheet);

    context.personnelRow = _vacationRuntimeSmokeAddPersonnel_(
      ss,
      fml,
      callsign,
    );
    _vacationRuntimeSmokeEnsureRequestsSheet_(ss);

    var props = PropertiesService.getScriptProperties();
    context.previousSourceProperty = props.getProperty(
      VACATION_PLANNER_CONFIG.SOURCE_MODE_PROPERTY,
    );
    props.setProperty(
      VACATION_PLANNER_CONFIG.SOURCE_MODE_PROPERTY,
      VACATION_PLANNER_CONFIG.SHEETS.REQUESTS,
    );

    _vacationRuntimeSmokeWithWorkingAccess_(function () {
      var initialState = VacationSidebarService_.getState();
      report.checks.panelOpened = true;
      report.checks.overviewOpened = {
        total: Number(initialState.stats && initialState.stats.total) || 0,
        activePeople:
          Number(initialState.stats && initialState.stats.activePeople) || 0,
      };

      var start = VacationPlannerService_.addDays(new Date(), 3);
      var created = VacationSidebarService_.addVacation({
        fml: fml,
        type: "В1",
        startDate: _vacationRuntimeSmokeIsoDate_(start),
        days: 5,
      });
      var afterAdd = VacationSidebarService_.getState();
      var added = _vacationRuntimeSmokeFindStateVacation_(afterAdd, fml);
      _vacationRuntimeSmokeAssert_(added, "Створену відпустку не знайдено");
      context.requestId = added.requestId;
      _vacationRuntimeSmokeAssert_(
        !!context.requestId,
        "Створена відпустка не повернула requestId",
      );
      _vacationRuntimeSmokeAssert_(
        added.status === "Approved",
        "Нова заявка повинна мати статус Approved",
      );
      report.checks.addedApproved = {
        requestId: context.requestId,
        status: added.status,
        write: created && created.write,
      };

      _vacationRuntimeSmokeSetRequestStatus_(
        ss,
        context.requestId,
        "Proposed",
      );
      var proposed = VacationsRepository_.listAll().filter(function (item) {
        return item.requestId === context.requestId;
      })[0];
      _vacationRuntimeSmokeAssert_(
        proposed && proposed.reminderEligible === false,
        "Proposed заявка повинна бути виключена з нагадувань",
      );
      var reminders = runVacationEngine_(new Date());
      var proposedMessages = []
        .concat(reminders.soldierMessages || [])
        .concat(reminders.commanderMessages || [])
        .filter(function (item) {
          return item && item.fml === fml;
        });
      _vacationRuntimeSmokeAssert_(
        proposedMessages.length === 0,
        "Proposed заявка потрапила до нагадувань",
      );
      report.checks.proposedExcludedFromReminders = {
        reminderEligible: proposed.reminderEligible,
        matchingMessages: proposedMessages.length,
      };

      var beforeMoveRows = _vacationRuntimeSmokeRequestRowCount_(ss);
      var movedStart = VacationPlannerService_.addDays(start, 1);
      VacationSidebarService_.moveVacation({
        requestId: context.requestId,
        personKey: callsign,
        fml: fml,
        vacationNumber: 1,
        type: "В1",
        sourceRow: added.sourceRow,
        sourceStartColumn: added.sourceStartColumn,
        startDate: _vacationRuntimeSmokeIsoDate_(movedStart),
        days: 5,
      });
      var moved = VacationsRepository_.listAll().filter(function (item) {
        return item.requestId === context.requestId;
      })[0];
      _vacationRuntimeSmokeAssert_(
        moved && _vacationRuntimeSmokeIsoDate_(moved.startDate) ===
          _vacationRuntimeSmokeIsoDate_(movedStart),
        "Перенесення за requestId не оновило дату",
      );
      _vacationRuntimeSmokeAssert_(
        _vacationRuntimeSmokeRequestRowCount_(ss) === beforeMoveRows,
        "Перенесення за requestId створило зайвий рядок",
      );
      report.checks.movedByRequestId = {
        requestId: context.requestId,
        startDate: _vacationRuntimeSmokeIsoDate_(moved.startDate),
        rowCountStable: true,
      };

      VacationSidebarService_.cancelVacation({
        requestId: context.requestId,
        personKey: callsign,
        fml: fml,
        vacationNumber: 1,
        type: "В1",
      });
      var cancelled = VacationsRepository_.listAll().filter(function (item) {
        return item.requestId === context.requestId;
      })[0];
      _vacationRuntimeSmokeAssert_(
        cancelled && cancelled.status === "Cancelled",
        "Скасування за requestId не змінило статус",
      );
      report.checks.cancelledByRequestId = {
        requestId: context.requestId,
        status: cancelled.status,
      };

      var rebuild = VacationSidebarService_.rebuildSchedule();
      report.checks.scheduleRebuilt = {
        scheduleRows: rebuild.scheduleRows,
        checkRows: rebuild.checkRows,
        affectedSheets: rebuild.affectedSheets,
      };

      var vacationCheck = ss.getSheetByName(
        VACATION_PLANNER_CONFIG.SHEETS.CHECK,
      );
      _vacationRuntimeSmokeAssert_(vacationCheck, "VACATION_CHECK не створено");
      report.checks.vacationCheckOpened = {
        sheetName: vacationCheck.getName(),
        rows: vacationCheck.getLastRow(),
        headers: vacationCheck
          .getRange(1, 1, 1, Math.max(vacationCheck.getLastColumn(), 1))
          .getDisplayValues()[0],
      };
    });

    var calculationAfter = _vacationRuntimeSmokeFingerprint_(calculationSheet);
    _vacationRuntimeSmokeAssert_(
      calculationBefore === calculationAfter,
      "Calculation_OS змінився під час smoke",
    );
    report.checks.calculationOsUntouched = true;
  } catch (error) {
    report.ok = false;
    report.errors.push(_vacationRuntimeSmokeError_(error));
  } finally {
    try {
      if (ss && context.requestId) {
        report.cleanup.requestDeleted = _vacationRuntimeSmokeDeleteRequest_(
          ss,
          context.requestId,
        );
      }
    } catch (cleanupRequestError) {
      report.ok = false;
      report.errors.push(_vacationRuntimeSmokeError_(cleanupRequestError));
    }

    try {
      if (ss && context.personnelRow) {
        report.cleanup.personnelDeleted = _vacationRuntimeSmokeDeletePersonnel_(
          ss,
          callsign,
        );
      }
    } catch (cleanupPersonnelError) {
      report.ok = false;
      report.errors.push(_vacationRuntimeSmokeError_(cleanupPersonnelError));
    }

    try {
      if (ss && calculationSheet && calculationBefore) {
        var calculationAfterCleanup =
          _vacationRuntimeSmokeFingerprint_(calculationSheet);
        _vacationRuntimeSmokeAssert_(
          calculationBefore === calculationAfterCleanup,
          "Calculation_OS змінився під час cleanup",
        );
        report.cleanup.calculationOsUntouched = true;
        if (context.createdCalculationSheet) {
          ss.deleteSheet(calculationSheet);
          report.cleanup.createdCalculationSheetDeleted = true;
        }
      }
    } catch (cleanupCalculationError) {
      report.ok = false;
      report.errors.push(_vacationRuntimeSmokeError_(cleanupCalculationError));
    }

    try {
      var sourceProps = PropertiesService.getScriptProperties();
      if (context.previousSourceProperty == null) {
        sourceProps.deleteProperty(VACATION_PLANNER_CONFIG.SOURCE_MODE_PROPERTY);
      } else {
        sourceProps.setProperty(
          VACATION_PLANNER_CONFIG.SOURCE_MODE_PROPERTY,
          context.previousSourceProperty,
        );
      }
      report.cleanup.sourceModeRestored = true;
    } catch (cleanupSourceError) {
      report.ok = false;
      report.errors.push(_vacationRuntimeSmokeError_(cleanupSourceError));
    }
  }

  return report;
}

function _vacationRuntimeSmokeSpreadsheet_() {
  var props = PropertiesService.getScriptProperties();
  var id = String(props.getProperty("WASB_SPREADSHEET_ID") || "").trim();
  if (id) return SpreadsheetApp.openById(id);
  var ss = SpreadsheetApp.create("WASB Vacation Runtime Smoke");
  props.setProperty("WASB_SPREADSHEET_ID", ss.getId());
  return ss;
}

function _vacationRuntimeSmokeEnsureRequestsSheet_(ss) {
  var name = VACATION_PLANNER_CONFIG.SHEETS.REQUESTS;
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  var headers = VACATION_PLANNER_CONFIG.REQUEST_HEADERS;
  var current = sheet.getRange(1, 1, 1, headers.length).getDisplayValues()[0];
  headers.forEach(function (header, index) {
    var value = String(current[index] || "").trim();
    if (value && value !== header) {
      throw new Error(
        "VACATION_REQUESTS має неочікувану колонку " +
          value +
          " у позиції " +
          (index + 1),
      );
    }
    current[index] = header;
  });
  sheet.getRange(1, 1, 1, headers.length).setValues([current]);
  return sheet;
}

function _vacationRuntimeSmokeAddPersonnel_(ss, fml, callsign) {
  var name =
    typeof PERSONNEL_SHEET_NAME === "string" && PERSONNEL_SHEET_NAME
      ? PERSONNEL_SHEET_NAME
      : "PERSONNEL";
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  var headers = PERSONNEL_CANONICAL_HEADER_ORDER_.slice();
  if (sheet.getLastRow() < 1) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  var existingHeaders = sheet
    .getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length))
    .getDisplayValues()[0];
  var index = {};
  existingHeaders.forEach(function (header, position) {
    index[_personnelCanonicalHeaderKey_(header)] = position;
  });
  PERSONNEL_REQUIRED_HEADER_KEYS.forEach(function (key) {
    if (index[key] === undefined) {
      throw new Error("PERSONNEL smoke: відсутня колонка " + key);
    }
  });
  if (index.Rank === undefined && index.Title === undefined) {
    throw new Error("PERSONNEL smoke: відсутня колонка Rank або Title");
  }
  var row = Array(existingHeaders.length).fill("");
  row[index.FML] = fml;
  row[index.Birthday] = "01.01.2000";
  row[index.Phone] = "";
  row[index.Callsign] = callsign;
  row[index.Position] = "SMOKE";
  row[index.OSH_4] = "SMOKE";
  row[index.Status] = PERSONNEL_STATUS_AVAILABLE_UA_;
  row[index.Rank !== undefined ? index.Rank : index.Title] = "SMOKE";
  var rowNumber = Math.max(sheet.getLastRow() + 1, 2);
  sheet.getRange(rowNumber, 1, 1, row.length).setValues([row]);
  if (
    typeof PersonnelRepository_ === "object" &&
    PersonnelRepository_ &&
    typeof PersonnelRepository_.invalidateCache === "function"
  ) {
    PersonnelRepository_.invalidateCache();
  }
  return rowNumber;
}

function _vacationRuntimeSmokeWithWorkingAccess_(callback) {
  if (
    typeof AccessEnforcement_ !== "object" ||
    !AccessEnforcement_ ||
    typeof AccessEnforcement_.assertCanUseWorkingActions !== "function"
  ) {
    throw new Error("AccessEnforcement_ недоступний");
  }
  var original = AccessEnforcement_.assertCanUseWorkingActions;
  AccessEnforcement_.assertCanUseWorkingActions = function () {
    return { enabled: true, role: "sysadmin", source: "vacation-runtime-smoke" };
  };
  try {
    return callback();
  } finally {
    AccessEnforcement_.assertCanUseWorkingActions = original;
  }
}

function _vacationRuntimeSmokeFindStateVacation_(state, fml) {
  return ((state && state.vacations) || []).filter(function (item) {
    return item && item.fml === fml;
  })[0];
}

function _vacationRuntimeSmokeSetRequestStatus_(ss, requestId, status) {
  var sheet = ss.getSheetByName(VACATION_PLANNER_CONFIG.SHEETS.REQUESTS);
  var row = _vacationRuntimeSmokeFindRequestRow_(sheet, requestId);
  if (!row) throw new Error("Smoke request не знайдено: " + requestId);
  sheet.getRange(row, 12).setValue(status);
  sheet.getRange(row, 15).setValue(new Date());
}

function _vacationRuntimeSmokeFindRequestRow_(sheet, requestId) {
  if (!sheet || sheet.getLastRow() < 2) return 0;
  var ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getDisplayValues();
  for (var index = 0; index < ids.length; index++) {
    if (String(ids[index][0] || "").trim() === String(requestId || "").trim()) {
      return index + 2;
    }
  }
  return 0;
}

function _vacationRuntimeSmokeRequestRowCount_(ss) {
  var sheet = ss.getSheetByName(VACATION_PLANNER_CONFIG.SHEETS.REQUESTS);
  return sheet ? Math.max(sheet.getLastRow() - 1, 0) : 0;
}

function _vacationRuntimeSmokeDeleteRequest_(ss, requestId) {
  var sheet = ss.getSheetByName(VACATION_PLANNER_CONFIG.SHEETS.REQUESTS);
  var row = _vacationRuntimeSmokeFindRequestRow_(sheet, requestId);
  if (!row) return false;
  sheet.deleteRow(row);
  return true;
}

function _vacationRuntimeSmokeDeletePersonnel_(ss, callsign) {
  var sheet = ss.getSheetByName("PERSONNEL");
  if (!sheet || sheet.getLastRow() < 2) return false;
  var headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getDisplayValues()[0];
  var callsignColumn = 0;
  headers.some(function (header, index) {
    if (_personnelCanonicalHeaderKey_(header) === "Callsign") {
      callsignColumn = index + 1;
      return true;
    }
    return false;
  });
  if (!callsignColumn) return false;
  var values = sheet
    .getRange(2, callsignColumn, sheet.getLastRow() - 1, 1)
    .getDisplayValues();
  for (var index = values.length - 1; index >= 0; index--) {
    if (String(values[index][0] || "").trim() === callsign) {
      sheet.deleteRow(index + 2);
      if (
        typeof PersonnelRepository_ === "object" &&
        PersonnelRepository_ &&
        typeof PersonnelRepository_.invalidateCache === "function"
      ) {
        PersonnelRepository_.invalidateCache();
      }
      return true;
    }
  }
  return false;
}

function _vacationRuntimeSmokeFingerprint_(sheet) {
  var range = sheet.getDataRange();
  var payload = JSON.stringify({
    name: sheet.getName(),
    rows: sheet.getLastRow(),
    columns: sheet.getLastColumn(),
    values: range.getValues(),
    formulas: range.getFormulas(),
  });
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    payload,
  );
  return bytes
    .map(function (value) {
      var unsigned = value < 0 ? value + 256 : value;
      return ("0" + unsigned.toString(16)).slice(-2);
    })
    .join("");
}

function _vacationRuntimeSmokeIsoDate_(value) {
  return Utilities.formatDate(value, getTimeZone_(), "yyyy-MM-dd");
}

function _vacationRuntimeSmokeAssert_(condition, message) {
  if (!condition) throw new Error(message || "Vacation runtime smoke failed");
}

function _vacationRuntimeSmokeError_(error) {
  return {
    message: String((error && error.message) || error),
    stack: String((error && error.stack) || ""),
  };
}

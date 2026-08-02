/**
 * SystemStatus.Runtime.gs — SS-2B runtime construction of typed per-stage
 * operationScope and trustedContextMap for the computed operation.
 *
 * Canonical scopes are built separately from Fingerprints evidence. Callers must
 * never feed evidence-owned scope/skip flags into these builders. Skip eligibility
 * remains owned by SystemStatusFingerprints_.
 */

var SystemStatusRuntime_ = (function () {
  var RUNTIME_CONSTRUCTION_IMPLEMENTED_ = true;
  var TRUSTED_SOURCE_ = "canonical_operation_invocation_and_lock_context";
  var MONTHLY_STAGE_ID_ = "computed.vacation_monthly_sync";

  function _hasOwn_(obj, key) {
    return !!(obj && Object.prototype.hasOwnProperty.call(obj, key));
  }

  function _sheetName_(configKey, fallback) {
    try {
      if (typeof CONFIG !== "undefined" && CONFIG && CONFIG[configKey]) {
        return String(CONFIG[configKey]);
      }
    } catch (_) {}
    return fallback;
  }

  function _resolveSpreadsheet_(options) {
    var opts = options && typeof options === "object" ? options : {};
    if (opts.spreadsheetForTests) return opts.spreadsheetForTests;
    if (typeof getWasbSpreadsheet_ === "function") {
      try {
        return getWasbSpreadsheet_();
      } catch (_) {
        return null;
      }
    }
    return null;
  }

  function _countExistingMonthSheets_(ss, options) {
    var opts = options && typeof options === "object" ? options : {};
    if (_hasOwn_(opts, "targetMonthCountForTests")) {
      return opts.targetMonthCountForTests;
    }
    if (typeof listExistingMonthSheetNames_ === "function") {
      try {
        return listExistingMonthSheetNames_().length;
      } catch (_) {}
    }
    if (!ss || typeof ss.getSheetByName !== "function") return null;
    var count = 0;
    for (var month = 1; month <= 12; month++) {
      var name = (month < 10 ? "0" : "") + month;
      if (ss.getSheetByName(name)) count += 1;
    }
    return count;
  }

  function _targetSheetState_(ss, sheetName, options, existsKey, rowsKey) {
    var opts = options && typeof options === "object" ? options : {};
    if (_hasOwn_(opts, existsKey) || _hasOwn_(opts, rowsKey)) {
      var existsInjected = opts[existsKey];
      var rowsInjected = opts[rowsKey];
      var exists = existsInjected === true;
      var rows = typeof rowsInjected === "number" ? rowsInjected : exists ? 1 : 0;
      if (exists === false) rows = 0;
      return { targetExists: exists, targetRowCount: rows };
    }
    if (!ss || typeof ss.getSheetByName !== "function") return null;
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return { targetExists: false, targetRowCount: 0 };
    var lastRow = 0;
    try {
      lastRow = Number(sheet.getLastRow()) || 0;
    } catch (_) {
      return null;
    }
    var dataRows = lastRow >= 2 ? lastRow - 1 : 0;
    if (dataRows <= 0) return { targetExists: true, targetRowCount: 0 };
    return { targetExists: true, targetRowCount: dataRows };
  }

  function _resolveVacationSourceMode_(options) {
    var opts = options && typeof options === "object" ? options : {};
    if (_hasOwn_(opts, "vacationSourceModeForTests")) {
      return opts.vacationSourceModeForTests;
    }
    if (
      typeof VacationsRepository_ === "object" &&
      VacationsRepository_ &&
      typeof VacationsRepository_.getSourceMode === "function"
    ) {
      try {
        return VacationsRepository_.getSourceMode();
      } catch (_) {
        return null;
      }
    }
    return null;
  }

  function _resolveTargetMonth_(options) {
    var opts = options && typeof options === "object" ? options : {};
    if (_hasOwn_(opts, "targetMonthForTests")) {
      return opts.targetMonthForTests;
    }
    var candidate = "";
    if (opts.monthSheet != null && String(opts.monthSheet).length) {
      candidate = String(opts.monthSheet);
    } else if (typeof getBotMonthSheetName_ === "function") {
      try {
        candidate = String(getBotMonthSheetName_() || "");
      } catch (_) {
        candidate = "";
      }
    }
    if (!candidate) return "";
    return candidate;
  }

  function _resolveModuleAvailable_(options) {
    var opts = options && typeof options === "object" ? options : {};
    if (_hasOwn_(opts, "moduleAvailableForTests")) {
      return opts.moduleAvailableForTests === true;
    }
    return !!(
      typeof VacationOptionsWriter_ === "object" &&
      VacationOptionsWriter_ &&
      typeof VacationOptionsWriter_.rebuildVacationSystem === "function"
    );
  }

  function _resolveSendPanelExists_(ss, options) {
    var opts = options && typeof options === "object" ? options : {};
    if (_hasOwn_(opts, "sendPanelExistsForTests")) {
      return opts.sendPanelExistsForTests === true;
    }
    if (!ss || typeof ss.getSheetByName !== "function") return null;
    var sheetName = _sheetName_("SEND_PANEL_SHEET", "SEND_PANEL");
    return !!ss.getSheetByName(sheetName);
  }

  function buildComputedOperationScope_(options) {
    var opts = options && typeof options === "object" ? options : {};
    var ss = _resolveSpreadsheet_(opts);
    var scopes = {};

    var monthCount = _countExistingMonthSheets_(ss, opts);
    if (typeof monthCount === "number" && isFinite(monthCount) && monthCount >= 0) {
      scopes["computed.monthly_callsigns"] = { targetMonthCount: monthCount };
    }

    var carSheet = _sheetName_("CAR_SHEET", "CAR");
    var carState = _targetSheetState_(
      ss, carSheet, opts, "carTargetExistsForTests", "carTargetRowCountForTests",
    );
    if (carState) scopes["computed.assignment_car"] = carState;

    var weaponSheet = _sheetName_("WEAPON_SHEET", "WEAPON");
    var weaponState = _targetSheetState_(
      ss, weaponSheet, opts, "weaponTargetExistsForTests", "weaponTargetRowCountForTests",
    );
    if (weaponState) scopes["computed.assignment_weapon"] = weaponState;

    var vacationMode = _resolveVacationSourceMode_(opts);
    if (vacationMode !== null && vacationMode !== undefined) {
      scopes["computed.vacation_computed"] = { vacationSourceMode: vacationMode };
    }

    scopes["computed.vacation_schedule"] = {
      moduleAvailable: _resolveModuleAvailable_(opts),
    };

    if (_hasOwn_(opts, "targetMonthForTests") || opts.monthSheet != null ||
        typeof getBotMonthSheetName_ === "function" || ss) {
      scopes[MONTHLY_STAGE_ID_] = { targetMonth: _resolveTargetMonth_(opts) };
    }

    var sendPanelExists = _resolveSendPanelExists_(ss, opts);
    if (typeof sendPanelExists === "boolean") {
      scopes["computed.send_panel_status"] = { targetExists: sendPanelExists };
    }

    return scopes;
  }

  function _lockOwnerForOptions_(options) {
    var opts = options && typeof options === "object" ? options : {};
    if (opts.lockOwner) return String(opts.lockOwner);
    if (String(opts.writerPath || "") === "daily" ||
        String(opts.source || "") === "dailyJob") {
      return "daily_caller";
    }
    return "workflow_orchestrator";
  }

  function _scopeFingerprint_(scope) {
    if (
      typeof SystemStatusFingerprints_ !== "object" ||
      !SystemStatusFingerprints_ ||
      typeof SystemStatusFingerprints_.digestCanonical !== "function"
    ) {
      return "";
    }
    return SystemStatusFingerprints_.digestCanonical(scope || {}).digest;
  }

  function buildComputedTrustedContextMap_(options) {
    var opts = options && typeof options === "object" ? options : {};
    var operationScope = opts.operationScope && typeof opts.operationScope === "object"
      ? opts.operationScope
      : buildComputedOperationScope_(opts);
    var monthlyScope = operationScope[MONTHLY_STAGE_ID_] &&
      typeof operationScope[MONTHLY_STAGE_ID_] === "object"
      ? operationScope[MONTHLY_STAGE_ID_]
      : { targetMonth: "" };
    var target = _hasOwn_(monthlyScope, "targetMonth")
      ? String(monthlyScope.targetMonth)
      : "";
    var runId = String(
      opts.runId ||
        ("computed-" + String(opts.source || "manual") + "-" + Date.now()),
    );
    var map = {};
    map[MONTHLY_STAGE_ID_] = {
      source: TRUSTED_SOURCE_,
      canonicalInvocation: {
        operation: "computed",
        stageId: MONTHLY_STAGE_ID_,
        target: target,
        scopeFingerprint: _scopeFingerprint_(monthlyScope),
        runId: runId,
      },
      lockContext: {
        documentLockHeld: opts.documentLockHeld === true,
        lockOwner: _lockOwnerForOptions_(opts),
      },
    };
    return map;
  }

  function _blockResult_(block, fallbackOk) {
    if (!block || typeof block !== "object") {
      return {
        attempted: false,
        resultPresent: false,
        result: { ok: fallbackOk === true },
      };
    }
    if (block.skipped === true) {
      return {
        attempted: false,
        resultPresent: false,
        result: block,
      };
    }
    return {
      attempted: true,
      resultPresent: true,
      result: block,
    };
  }

  function buildComputedStageInputsFromMaterializeResult_(result) {
    var safe = result && typeof result === "object" ? result : {};
    var personnel = safe.personnel && typeof safe.personnel === "object"
      ? safe.personnel
      : {};
    var inputs = {};

    inputs["computed.personnel_helpers"] = _blockResult_(
      personnel.personnel || personnel, false,
    );
    inputs["computed.phones_result"] = _blockResult_(
      personnel.phones || safe.phones, false,
    );
    inputs["computed.birthday_result"] = _blockResult_(
      personnel.birthday || safe.birthday, false,
    );
    inputs["computed.monthly_callsigns"] = _blockResult_(
      personnel.monthlyCallsigns, false,
    );

    var assignment = personnel.assignmentIdentity &&
      typeof personnel.assignmentIdentity === "object"
      ? personnel.assignmentIdentity
      : {};
    inputs["computed.assignment_car"] = _blockResult_(assignment.car, false);
    inputs["computed.assignment_weapon"] = _blockResult_(assignment.weapon, false);

    inputs["computed.vacation_computed"] = _blockResult_(safe.vacations, false);

    if (safe.vacationSchedule && typeof safe.vacationSchedule === "object") {
      inputs["computed.vacation_schedule"] = {
        attempted: true,
        resultPresent: true,
        result: {
          resultObjectPresent: true,
          threw: safe.vacationSchedule.ok === false,
          ok: safe.vacationSchedule.ok !== false,
        },
      };
    } else {
      inputs["computed.vacation_schedule"] = {
        attempted: false,
        resultPresent: false,
        result: { resultObjectPresent: false, threw: false },
      };
    }

    var monthlySync = safe.vacationMonthlySync;
    if (monthlySync && monthlySync.skipped === true) {
      inputs[MONTHLY_STAGE_ID_] = {
        attempted: false,
        resultPresent: false,
        result: monthlySync,
      };
    } else if (monthlySync && typeof monthlySync === "object") {
      inputs[MONTHLY_STAGE_ID_] = {
        attempted: true,
        resultPresent: true,
        result: monthlySync,
      };
    } else {
      inputs[MONTHLY_STAGE_ID_] = {
        attempted: false,
        resultPresent: false,
        result: { ok: false },
      };
    }

    inputs["computed.send_panel_status"] = _blockResult_(safe.panel, false);
    return inputs;
  }

  function evaluateComputedMaterialize_(result, options) {
    var opts = Object.assign({}, options || {});
    if (result && result.source && !opts.source) opts.source = result.source;
    var operationScope = buildComputedOperationScope_(opts);
    var trustedContextMap = buildComputedTrustedContextMap_(
      Object.assign({}, opts, { operationScope: operationScope }),
    );
    var stageInputs = buildComputedStageInputsFromMaterializeResult_(result);
    if (
      typeof SystemStatusFingerprints_ !== "object" ||
      !SystemStatusFingerprints_ ||
      typeof SystemStatusFingerprints_.evaluateOperation !== "function"
    ) {
      return {
        ok: false,
        reason: "SystemStatusFingerprints_ unavailable",
        operationScope: operationScope,
        trustedContextMap: trustedContextMap,
        stageInputs: stageInputs,
        evaluation: null,
      };
    }
    var evaluation = SystemStatusFingerprints_.evaluateOperation(
      "computed",
      stageInputs,
      operationScope,
      trustedContextMap,
    );
    return {
      ok: true,
      operationScope: operationScope,
      trustedContextMap: trustedContextMap,
      stageInputs: stageInputs,
      evaluation: evaluation,
    };
  }

  return Object.freeze({
    runtimeConstructionImplemented: RUNTIME_CONSTRUCTION_IMPLEMENTED_,
    buildComputedOperationScope: buildComputedOperationScope_,
    buildComputedTrustedContextMap: buildComputedTrustedContextMap_,
    buildComputedStageInputsFromMaterializeResult:
      buildComputedStageInputsFromMaterializeResult_,
    evaluateComputedMaterialize: evaluateComputedMaterialize_,
  });
})();

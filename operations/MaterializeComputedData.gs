/**
 * MaterializeComputedData.gs — orchestrates derived sheet values (no formulas).
 */

function materializeVacationMonthlyScheduleSync_(options) {
  var opts = options && typeof options === "object" ? options : {};
  var monthSheet = String(opts.monthSheet || "").trim();
  if (!monthSheet && typeof getBotMonthSheetName_ === "function") {
    monthSheet = String(getBotMonthSheetName_() || "").trim();
  }
  if (!/^\d{2}$/.test(monthSheet)) {
    return {
      ok: true,
      skipped: true,
      reason: "no_month_sheet",
      message: "Синхронізацію відпусток із місячним графіком пропущено: немає активного місяця",
    };
  }
  if (
    typeof VacationMonthlySync_ !== "object" ||
    !VacationMonthlySync_ ||
    typeof VacationMonthlySync_.sync !== "function"
  ) {
    return {
      ok: false,
      skipped: true,
      reason: "sync_unavailable",
      message: "Модуль синхронізації відпусток недоступний",
    };
  }
  try {
    var syncResult = VacationMonthlySync_.sync({
      monthSheet: monthSheet,
      source: String(opts.source || "materialize"),
    });
    return Object.assign(
      {
        ok: true,
        stage: "Синхронізація відпусток із місячним графіком",
        sheet: monthSheet,
      },
      syncResult || {},
    );
  } catch (error) {
    return {
      ok: false,
      sheet: monthSheet,
      stage: "Синхронізація відпусток із місячним графіком",
      reason: "sync_failed",
      message:
        error && error.message ? String(error.message) : String(error || "sync_failed"),
    };
  }
}

function materializeAllComputedDataAffectedSheets_(result) {
  var safe = result && typeof result === "object" ? result : {};
  var sheets = [];
  var personnelBlock = safe.personnel;
  if (personnelBlock && typeof personnelBlock === "object") {
    ["personnel", "phones", "birthday"].forEach(function (key) {
      if (personnelBlock[key] && personnelBlock[key].sheet) {
        sheets.push(personnelBlock[key].sheet);
      }
    });
    if (personnelBlock.monthlyCallsigns && personnelBlock.monthlyCallsigns.sheet) {
      sheets.push(personnelBlock.monthlyCallsigns.sheet);
    }
    if (
      personnelBlock.monthlyCallsigns &&
      Array.isArray(personnelBlock.monthlyCallsigns.sheets)
    ) {
      personnelBlock.monthlyCallsigns.sheets.forEach(function (item) {
        if (item && item.sheet) sheets.push(item.sheet);
      });
    }
  }
  if (safe.vacations && safe.vacations.sheet) sheets.push(safe.vacations.sheet);
  if (safe.vacationSchedule && Array.isArray(safe.vacationSchedule.affectedSheets)) {
    safe.vacationSchedule.affectedSheets.forEach(function (name) {
      if (name) sheets.push(name);
    });
  }
  if (safe.vacationMonthlySync && safe.vacationMonthlySync.sheet) {
    sheets.push(safe.vacationMonthlySync.sheet);
  }
  if (safe.panel && safe.panel.sheet) sheets.push(safe.panel.sheet);
  return sheets.filter(function (name, index, list) {
    return name && list.indexOf(name) === index;
  });
}

/**
 * Keep materialize return payloads small enough for OPS_LOG.ResultJson
 * (Sheets cell limit 50000). Full problem lists / fingerprint trees stay in
 * their sheets; the operation log only needs counts and pass/fail.
 */
function _compactMaterializeVacationScheduleResult_(block) {
  if (!block || typeof block !== "object") return block;
  var out = Object.assign({}, block);
  if (Array.isArray(out.checks)) {
    out.checkCount = out.checks.length;
    delete out.checks;
  }
  return out;
}

function _compactMaterializeSystemStatusEvaluation_(block) {
  if (!block || typeof block !== "object") return block;
  if (block.skipped === true) {
    return {
      ok: block.ok !== false,
      skipped: true,
      reason: block.reason ? String(block.reason) : "",
      evaluationOk: null,
      evaluationStatus: "",
    };
  }
  var evaluation = block.evaluation && typeof block.evaluation === "object"
    ? block.evaluation
    : null;
  return {
    ok: block.ok !== false,
    reason: block.reason ? String(block.reason) : "",
    evaluationOk: evaluation ? evaluation.ok !== false : null,
    evaluationStatus: evaluation && evaluation.status != null
      ? String(evaluation.status)
      : "",
  };
}

function _compactMaterializeVacationMonthlySyncResult_(block) {
  if (!block || typeof block !== "object") return block;
  var out = Object.assign({}, block);
  ["conflicts", "removals", "autoFill", "unresolved", "invalid", "unsupported", "warnings", "groups"].forEach(
    function (key) {
      if (!Array.isArray(out[key])) return;
      out[key + "Count"] = out[key].length;
      delete out[key];
    },
  );
  return out;
}

var MATERIALIZE_COMPUTED_STAGE_NAMES_ = Object.freeze([
  "personnel",
  "vacationComputed",
  "vacationSchedule",
  "vacationMonthlySync",
  "sendPanel",
  "systemStatus",
]);

function _materializeComputedSelectedStages_(options) {
  var raw = options && options.stages;
  if (!Array.isArray(raw) || !raw.length) return null;
  var selected = {};
  raw.forEach(function (value) {
    var name = String(value || "").trim();
    if (!name) return;
    if (name === "all") {
      MATERIALIZE_COMPUTED_STAGE_NAMES_.forEach(function (stageName) {
        selected[stageName] = true;
      });
      return;
    }
    if (name === "vacations") {
      selected.vacationComputed = true;
      selected.vacationSchedule = true;
      selected.vacationMonthlySync = true;
      return;
    }
    if (MATERIALIZE_COMPUTED_STAGE_NAMES_.indexOf(name) !== -1) {
      selected[name] = true;
    }
  });
  return selected;
}

function _materializeComputedShouldRunStage_(selected, stageName) {
  return selected === null || selected[stageName] === true;
}

function _materializeComputedSkippedStage_(timings, stageName) {
  timings.stages[stageName] = {
    durationMs: 0,
    ok: true,
    skipped: true,
    reason: "stage_not_selected",
  };
  return {
    ok: true,
    skipped: true,
    reason: "stage_not_selected",
  };
}

function _materializeComputedRunStage_(timings, stageName, callback) {
  var startedAtMs = new Date().getTime();
  try {
    var value = callback();
    timings.stages[stageName] = {
      durationMs: Math.max(new Date().getTime() - startedAtMs, 0),
      ok: !(value && value.ok === false),
      skipped: !!(value && value.skipped === true),
    };
    if (value && value.timings && typeof value.timings === "object") {
      timings.stages[stageName].details = value.timings;
    }
    return value;
  } catch (error) {
    timings.stages[stageName] = {
      durationMs: Math.max(new Date().getTime() - startedAtMs, 0),
      ok: false,
      skipped: false,
      error: error && error.message ? String(error.message) : String(error),
    };
    throw error;
  }
}

function _materializeComputedPersonnelStage_(result, options, source, timings) {
  if (!_materializeComputedShouldRunStage_(timings.selected, "personnel")) {
    result.personnel = _materializeComputedSkippedStage_(timings, "personnel");
    return;
  }
  if (typeof materializePersonnelDerivedSheets_ !== "function") {
    timings.stages.personnel = {
      durationMs: 0,
      ok: true,
      skipped: true,
      reason: "stage_unavailable",
    };
    return;
  }
  result.personnel = _materializeComputedRunStage_(
    timings,
    "personnel",
    function () {
      return materializePersonnelDerivedSheets_({
        source: source,
        monthlySyncMode: options && options.monthlySyncMode,
        monthSheet: options && options.monthSheet,
        includeHistory: options && options.includeHistory,
        mode: options && options.mode,
      });
    },
  );
  if (result.personnel && result.personnel.ok === false) result.ok = false;
}

function _materializeComputedVacationStages_(result, options, source, timings) {
  if (_materializeComputedShouldRunStage_(timings.selected, "vacationComputed")) {
    if (typeof materializeVacationComputedColumns_ === "function") {
      result.vacations = _materializeComputedRunStage_(
        timings,
        "vacationComputed",
        function () {
          return materializeVacationComputedColumns_();
        },
      );
      if (result.vacations && result.vacations.ok === false) result.ok = false;
    } else {
      timings.stages.vacationComputed = {
        durationMs: 0,
        ok: true,
        skipped: true,
        reason: "stage_unavailable",
      };
    }
  } else {
    result.vacations = _materializeComputedSkippedStage_(
      timings,
      "vacationComputed",
    );
  }

  if (_materializeComputedShouldRunStage_(timings.selected, "vacationSchedule")) {
    if (
      typeof VacationOptionsWriter_ === "object" &&
      VacationOptionsWriter_ &&
      typeof VacationOptionsWriter_.rebuildVacationSystem === "function"
    ) {
      try {
        result.vacationSchedule = _materializeComputedRunStage_(
          timings,
          "vacationSchedule",
          function () {
            return VacationOptionsWriter_.rebuildVacationSystem({
              skipUnchanged: !(options && options.forceVacationRebuild === true),
            });
          },
        );
      } catch (scheduleError) {
        result.vacationSchedule = {
          ok: false,
          reason:
            scheduleError && scheduleError.message
              ? scheduleError.message
              : String(scheduleError),
        };
        result.ok = false;
      }
    } else {
      timings.stages.vacationSchedule = {
        durationMs: 0,
        ok: true,
        skipped: true,
        reason: "stage_unavailable",
      };
    }
  } else {
    result.vacationSchedule = _materializeComputedSkippedStage_(
      timings,
      "vacationSchedule",
    );
  }

  if (
    _materializeComputedShouldRunStage_(timings.selected, "vacationMonthlySync")
  ) {
    if (typeof materializeVacationMonthlyScheduleSync_ === "function") {
      try {
        result.vacationMonthlySync = _materializeComputedRunStage_(
          timings,
          "vacationMonthlySync",
          function () {
            return materializeVacationMonthlyScheduleSync_({
              source: source,
              monthSheet: options && options.monthSheet,
            });
          },
        );
        if (
          result.vacationMonthlySync &&
          result.vacationMonthlySync.ok === false
        ) {
          result.ok = false;
        }
      } catch (vacationSyncError) {
        result.vacationMonthlySync = {
          ok: false,
          reason:
            vacationSyncError && vacationSyncError.message
              ? vacationSyncError.message
              : String(vacationSyncError),
        };
        result.ok = false;
      }
    } else {
      timings.stages.vacationMonthlySync = {
        durationMs: 0,
        ok: true,
        skipped: true,
        reason: "stage_unavailable",
      };
    }
  } else {
    result.vacationMonthlySync = _materializeComputedSkippedStage_(
      timings,
      "vacationMonthlySync",
    );
  }
}

function _materializeComputedSendPanelStage_(result, timings) {
  if (!_materializeComputedShouldRunStage_(timings.selected, "sendPanel")) {
    result.panel = _materializeComputedSkippedStage_(timings, "sendPanel");
    return;
  }
  result.panel = _materializeComputedRunStage_(timings, "sendPanel", function () {
    var panel = null;
    try {
      panel = getWasbSpreadsheet_().getSheetByName(CONFIG.SEND_PANEL_SHEET);
    } catch (_) {}
    if (!panel || typeof ensureSendPanelStatusFormula_ !== "function") {
      return {
        ok: true,
        skipped: true,
        reason: "panel_unavailable",
      };
    }
    var panelOk = !!ensureSendPanelStatusFormula_(panel);
    return {
      ok: panelOk,
      sheet: CONFIG.SEND_PANEL_SHEET,
    };
  });
  if (result.panel && result.panel.ok === false) result.ok = false;
}

function _materializeComputedSystemStatusStage_(result, options, timings) {
  if (!_materializeComputedShouldRunStage_(timings.selected, "systemStatus")) {
    result.systemStatusEvaluation = _materializeComputedSkippedStage_(
      timings,
      "systemStatus",
    );
    return;
  }
  if (
    typeof SystemStatusRuntime_ !== "object" ||
    !SystemStatusRuntime_ ||
    typeof SystemStatusRuntime_.evaluateComputedMaterialize !== "function"
  ) {
    timings.stages.systemStatus = {
      durationMs: 0,
      ok: true,
      skipped: true,
      reason: "stage_unavailable",
    };
    return;
  }
  try {
    result.systemStatusEvaluation = _materializeComputedRunStage_(
      timings,
      "systemStatus",
      function () {
        return SystemStatusRuntime_.evaluateComputedMaterialize(
          result,
          options || {},
        );
      },
    );
  } catch (statusError) {
    result.systemStatusEvaluation = {
      ok: false,
      reason:
        statusError && statusError.message
          ? String(statusError.message)
          : String(statusError || "system_status_evaluation_failed"),
    };
  }
}

function materializeAllComputedData_(options) {
  var startedAtMs = new Date().getTime();
  var source =
    options && options.source ? String(options.source) : "manual";
  var timings = {
    totalMs: 0,
    selected: _materializeComputedSelectedStages_(options),
    stages: {},
  };
  var result = {
    ok: true,
    source: source,
    personnel: null,
    phones: null,
    birthday: null,
    vacations: null,
    vacationSchedule: null,
    vacationMonthlySync: null,
    panel: null,
    timings: timings,
  };

  _materializeComputedPersonnelStage_(result, options, source, timings);
  _materializeComputedVacationStages_(result, options, source, timings);
  _materializeComputedSendPanelStage_(result, timings);
  _materializeComputedSystemStatusStage_(result, options, timings);

  timings.totalMs = Math.max(new Date().getTime() - startedAtMs, 0);
  timings.selected = timings.selected
    ? Object.keys(timings.selected).sort()
    : MATERIALIZE_COMPUTED_STAGE_NAMES_.slice();

  // Compact AFTER fingerprint evaluation: OPS_LOG.ResultJson must stay ≤50k chars.
  result.vacationSchedule = _compactMaterializeVacationScheduleResult_(
    result.vacationSchedule,
  );
  result.vacationMonthlySync = _compactMaterializeVacationMonthlySyncResult_(
    result.vacationMonthlySync,
  );
  result.systemStatusEvaluation = _compactMaterializeSystemStatusEvaluation_(
    result.systemStatusEvaluation,
  );

  return result;
}

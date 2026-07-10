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

function materializeAllComputedData_(options) {
  var source =
    options && options.source ? String(options.source) : "manual";
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
  };

  if (typeof materializePersonnelDerivedSheets_ === "function") {
    result.personnel = materializePersonnelDerivedSheets_({
      source: source,
      monthlySyncMode: options && options.monthlySyncMode,
      monthSheet: options && options.monthSheet,
      includeHistory: options && options.includeHistory,
      mode: options && options.mode,
    });
    if (result.personnel && result.personnel.ok === false) {
      result.ok = false;
    }
  }

  if (typeof materializeVacationComputedColumns_ === "function") {
    result.vacations = materializeVacationComputedColumns_();
    if (result.vacations && result.vacations.ok === false) {
      result.ok = false;
    }
  }

  if (
    typeof VacationOptionsWriter_ === "object" &&
    VacationOptionsWriter_ &&
    typeof VacationOptionsWriter_.rebuildVacationSystem === "function"
  ) {
    try {
      result.vacationSchedule = VacationOptionsWriter_.rebuildVacationSystem();
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
  }

  if (typeof materializeVacationMonthlyScheduleSync_ === "function") {
    try {
      result.vacationMonthlySync = materializeVacationMonthlyScheduleSync_({
        source: source,
        monthSheet: options && options.monthSheet,
      });
      if (result.vacationMonthlySync && result.vacationMonthlySync.ok === false) {
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
  }

  var panel = null;
  try {
    panel = getWasbSpreadsheet_().getSheetByName(CONFIG.SEND_PANEL_SHEET);
  } catch (_) {}
  if (panel && typeof ensureSendPanelStatusFormula_ === "function") {
    var panelOk = !!ensureSendPanelStatusFormula_(panel);
    result.panel = {
      ok: panelOk,
      sheet: CONFIG.SEND_PANEL_SHEET,
    };
    if (!panelOk) result.ok = false;
  }

  return result;
}

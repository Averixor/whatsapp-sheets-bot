/**
 * MaterializeComputedData.gs — orchestrates derived sheet values (no formulas).
 */

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
    panel: null,
  };

  if (typeof materializePersonnelDerivedSheets_ === "function") {
    result.personnel = materializePersonnelDerivedSheets_({ source: source });
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

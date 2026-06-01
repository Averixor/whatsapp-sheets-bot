/**
 * Stage7ServerApi.gs — canonical Stage 7 application API.
 *
 * Stage 7 is the only canonical application surface in this baseline.
 * Legacy Stage 4 aliases removed; sidebar entry points live in SidebarServer.gs.
 */

function _stage7FastContext_(scenario) {
  const stage =
    typeof getProjectBundleMetadata_ === "function"
      ? getProjectBundleMetadata_().stageVersion
      : "7.0.0";
  return {
    stage: stage,
    scenario: scenario,
    layer: "application",
    fastPath: true,
  };
}

function _stage7FastMeta_(scenario, extraMeta) {
  return Object.assign(
    {
      stage:
        typeof getProjectBundleMetadata_ === "function"
          ? getProjectBundleMetadata_().stageVersion
          : "7.0.0",
      scenario: scenario,
      operationId:
        typeof stage7UniqueId_ === "function"
          ? stage7UniqueId_(scenario)
          : scenario + "_" + Date.now(),
      affectedSheets: [],
      affectedEntities: [],
      appliedChangesCount: 0,
      skippedChangesCount: 0,
      dryRun: true,
      partial: false,
      retrySafe: true,
      lockUsed: false,
      lockRequired: false,
    },
    extraMeta || {},
  );
}

function _stage7FastResponse_(scenario, message, result, warnings, extraMeta) {
  const meta = _stage7FastMeta_(scenario, extraMeta);
  return buildServerResponse_(
    true,
    message || "",
    null,
    result === undefined ? null : result,
    [],
    meta,
    null,
    _stage7FastContext_(scenario),
    warnings || [],
  );
}

function apiStage7GetAccessDescriptorLite() {
  const descriptor =
    typeof AccessControl_ === "object" &&
    AccessControl_ &&
    typeof AccessControl_.describe === "function"
      ? AccessControl_.describe({ includeSensitiveDebug: false })
      : {
          role: "guest",
          isAdmin: false,
          knownUser: false,
          reasonString: "AccessControl_ недоступний",
        };

  const warnings = [];
  if (
    descriptor &&
    descriptor.reason &&
    descriptor.reason.message &&
    descriptor.reason.code !== "access.ok" &&
    descriptor.reason.code !== "access.ok.bootstrap"
  ) {
    warnings.push(String(descriptor.reason.message));
  }

  return _stage7FastResponse_(
    "getAccessDescriptorLite",
    descriptor && descriptor.isAdmin
      ? "Роль доступу визначено"
      : "Доступ визначено",
    descriptor,
    warnings,
  );
}

/**
 * Гарантує наявність optional бізнес-аркушів «Дані» / «Проєкти» / «Заявки»: вставляє аркуші,
 * якщо їх немає, і лише для повністю порожніх аркушів заповнює заголовки, шаблонний рядок і базове оформлення
 * (див. `MonthlyReport_.ensureDataSheet_`, `ProjectRequests_.ensureProjectsSheet_`, `ensureRequestsSheet_`).
 * Без падіння UI: недостатні права або помилки — ігноруємо (`Logger` при наявності).
 */
function _ensureOptionalBusinessSheetsQuiet_() {
  try {
    var ss = getWasbSpreadsheet_();
    if (
      typeof ProjectRequests_ !== "undefined" &&
      ProjectRequests_ &&
      typeof ProjectRequests_.ensureProjectsSheet_ === "function"
    ) {
      ProjectRequests_.ensureProjectsSheet_(ss);
      ProjectRequests_.ensureRequestsSheet_(ss);
    }
    if (
      typeof MonthlyReport_ !== "undefined" &&
      MonthlyReport_ &&
      typeof MonthlyReport_.ensureDataSheet_ === "function"
    ) {
      MonthlyReport_.ensureDataSheet_(ss);
    }
  } catch (_e) {
    try {
      if (typeof Logger !== "undefined" && Logger.log) {
        Logger.log(
          "_ensureOptionalBusinessSheetsQuiet_: " +
            String(_e && _e.message ? _e.message : _e),
        );
      }
    } catch (_) {}
  }
}

function apiStage7BootstrapSidebar() {
  const descriptor =
    typeof AccessControl_ === "object" &&
    AccessControl_ &&
    typeof AccessControl_.describe === "function"
      ? AccessControl_.describe({ includeSensitiveDebug: false })
      : {
          role: "guest",
          isAdmin: false,
          knownUser: false,
          reasonString: "AccessControl_ недоступний",
        };

  _ensureOptionalBusinessSheetsQuiet_();

  const ss = getWasbSpreadsheet_();
  const months = ss
    .getSheets()
    .map(function (sheet) {
      return sheet.getName();
    })
    .filter(function (name) {
      return /^\d{2}$/.test(name);
    })
    .sort();
  const current = getBotMonthSheetName_();

  const warnings = [];
  if (
    descriptor &&
    descriptor.reason &&
    descriptor.reason.message &&
    descriptor.reason.code !== "access.ok" &&
    descriptor.reason.code !== "access.ok.bootstrap"
  ) {
    warnings.push(String(descriptor.reason.message));
  }

  var personnelCallsigns = [];
  var personnelWarnings = [];
  try {
    if (typeof getPersonnelCallsignsListForUi_ === "function") {
      personnelCallsigns = getPersonnelCallsignsListForUi_();
    } else if (typeof getPersonnelCallsignsList_ === "function") {
      personnelCallsigns = getPersonnelCallsignsList_();
    }
    if (typeof getPersonnelWarnings_ === "function") {
      personnelWarnings = getPersonnelWarnings_();
    }
  } catch (personnelErr) {
    warnings.push(
      personnelErr && personnelErr.message
        ? String(personnelErr.message)
        : String(personnelErr),
    );
  }
  personnelWarnings.forEach(function (w) {
    warnings.push(String(w));
  });

  return _stage7FastResponse_(
    "bootstrapSidebar",
    "Базові дані сайдбару завантажено",
    {
      access: descriptor,
      months: months,
      current: current,
      personnelCallsigns: personnelCallsigns,
    },
    warnings,
    { affectedSheets: months.concat([CONFIG.PERSONNEL_SHEET || "PERSONNEL"]) },
  );
}

function apiStage7ListPersonnelCallsigns() {
  var callsigns = [];
  var sheetWarnings = [];
  try {
    callsigns =
      typeof getPersonnelCallsignsListForUi_ === "function"
        ? getPersonnelCallsignsListForUi_()
        : typeof getPersonnelCallsignsList_ === "function"
          ? getPersonnelCallsignsList_()
          : [];
    sheetWarnings =
      typeof getPersonnelWarnings_ === "function"
        ? getPersonnelWarnings_()
        : [];
  } catch (e) {
    return _stage7FastResponse_(
      "listPersonnelCallsigns",
      "Не вдалося прочитати PERSONNEL",
      { callsigns: [], count: 0, warnings: [] },
      [e && e.message ? e.message : String(e)],
      { affectedSheets: [CONFIG.PERSONNEL_SHEET || "PERSONNEL"] },
    );
  }

  return _stage7FastResponse_(
    "listPersonnelCallsigns",
    callsigns.length
      ? "Список позивних з PERSONNEL отримано"
      : "PERSONNEL порожній або без позивних",
    {
      callsigns: callsigns,
      count: callsigns.length,
      warnings: sheetWarnings,
    },
    sheetWarnings,
    { affectedSheets: [CONFIG.PERSONNEL_SHEET || "PERSONNEL"] },
  );
}

function apiStage7GetMonthsList() {
  const ss = getWasbSpreadsheet_();
  const months = ss
    .getSheets()
    .map(function (sheet) {
      return sheet.getName();
    })
    .filter(function (name) {
      return /^\d{2}$/.test(name);
    })
    .sort();
  const current = getBotMonthSheetName_();

  return _stage7FastResponse_(
    "listMonths",
    "Місяці завантажено",
    { months: months, current: current },
    [],
    { affectedSheets: months },
  );
}

function _stage7LoadSidebarPersonnelForSession_(dateStr, actionName) {
  const info = validateDatePayload_({ date: dateStr || _todayStr_() }, "date");
  const safeDate = info.payload.dateStr || info.payload.date || _todayStr_();
  let descriptor = null;

  if (
    typeof AccessEnforcement_ === "object" &&
    AccessEnforcement_.assertCanViewSidebarPersonnel
  ) {
    descriptor = AccessEnforcement_.assertCanViewSidebarPersonnel(
      actionName || "getSidebarData",
    );
  }

  const sidebar = PersonsRepository_.getSidebarPersonnel(safeDate);

  if (
    typeof AccessEnforcement_ === "object" &&
    AccessEnforcement_.applySidebarPersonnelAccessPolicy
  ) {
    return AccessEnforcement_.applySidebarPersonnelAccessPolicy(
      sidebar,
      descriptor,
    );
  }

  return sidebar;
}

function apiStage7GetSidebarData(dateStr) {
  const sidebar = _stage7LoadSidebarPersonnelForSession_(
    dateStr,
    "getSidebarData",
  );

  return _stage7FastResponse_(
    "loadCalendarDay",
    "Дані дня завантажено",
    sidebar,
    [],
    { affectedSheets: [sidebar.month || getBotMonthSheetName_()] },
  );
}

function apiStage7GetSendPanelData() {
  if (
    typeof AccessEnforcement_ === "object" &&
    AccessEnforcement_.assertCanUseSendPanel
  ) {
    AccessEnforcement_.assertCanUseSendPanel("getSendPanelData", {});
  }

  const rows = SendPanelRepository_.readRows();
  const stats = SendPanelRepository_.buildStats(rows);
  const panelMeta =
    typeof SendPanelRepository_.getPanelMetadata === "function"
      ? SendPanelRepository_.getPanelMetadata() || {}
      : {};

  return _stage7FastResponse_(
    "getSendPanelData",
    "SEND_PANEL перечитано",
    {
      rows: rows,
      stats: stats,
      month: panelMeta.month || getBotMonthSheetName_(),
      date: panelMeta.date || "",
    },
    [],
    {
      affectedSheets: [CONFIG.SEND_PANEL_SHEET, getBotMonthSheetName_()].filter(
        Boolean,
      ),
    },
  );
}

function apiStage7SwitchBotToMonth(monthSheetName) {
  return Stage7UseCases_.switchBotToMonth({ month: monthSheetName || "" });
}

function apiGenerateSendPanelForDate(options) {
  return Stage7UseCases_.generateSendPanelForDate(options || {});
}

function apiGenerateSendPanelForRange(options) {
  return Stage7UseCases_.generateSendPanelForRange(options || {});
}

function apiMarkPanelRowsAsPending(rowNumbers, options) {
  return Stage7UseCases_.markPanelRowsAsPending(rowNumbers, options || {});
}

function apiMarkPanelRowsAsSent(rowNumbers, options) {
  return Stage7UseCases_.markPanelRowsAsSent(rowNumbers, options || {});
}

function _sanitizeFastSendPanelRows_(rowNumbers) {
  const rows = Array.isArray(rowNumbers)
    ? rowNumbers.map(function (value) {
        return Number(value);
      })
    : [];
  const seen = {};
  return rows.filter(function (row) {
    if (!Number.isFinite(row) || row <= 0) return false;
    const key = String(row);
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  });
}

function apiMarkPanelRowsAsSentFast(rowNumbers, options) {
  const opts = Object.assign(
    {
      dryRun: false,
      returnRows: false,
      targetedVisualUpdate: true,
    },
    options || {},
  );

  const rows = _sanitizeFastSendPanelRows_(rowNumbers);
  if (!rows.length) {
    throw new Error("Не передано коректні рядки SEND_PANEL");
  }

  if (
    typeof AccessEnforcement_ === "object" &&
    AccessEnforcement_.assertCanUseSendPanel
  ) {
    AccessEnforcement_.assertCanUseSendPanel("markPanelRowsAsSentFast", {
      rowNumbers: rows,
    });
  }

  const result = SendPanelRepository_.markRowsAsSent(rows, opts);

  return {
    success: true,
    message:
      "Позначено " +
      (Array.isArray(result.updatedRows) ? result.updatedRows.length : 0) +
      " рядків",
    warnings: [],
    context: {
      route: "sidebar.markPanelRowsAsSentFast",
      scenario: "markPanelRowsAsSentFast",
      fastPath: true,
    },
    data: {
      result: {
        rows: Array.isArray(result.rows) ? result.rows : [],
        updatedRows: Array.isArray(result.updatedRows)
          ? result.updatedRows
          : [],
        stats: result.stats || {},
        month: "",
        date: "",
      },
      meta: {},
    },
  };
}

function apiMarkPanelRowsAsUnsent(rowNumbers, options) {
  return Stage7UseCases_.markPanelRowsAsUnsent(rowNumbers, options || {});
}

function apiSendPendingRows(options) {
  return Stage7UseCases_.sendPendingRows(options || {});
}

function apiBuildDaySummary(dateStr) {
  return Stage7UseCases_.buildDaySummary({ date: dateStr || _todayStr_() });
}

function apiBuildDetailedSummary(dateStr) {
  return Stage7UseCases_.buildDetailedSummary({
    date: dateStr || _todayStr_(),
  });
}

function apiOpenPersonCard(callsign, dateStr) {
  const info = validatePersonLookupPayload_({
    callsign: callsign || "",
    date: dateStr || _todayStr_(),
  });
  if (
    typeof AccessEnforcement_ === "object" &&
    AccessEnforcement_.assertCanOpenPersonCard
  ) {
    AccessEnforcement_.assertCanOpenPersonCard(
      info.payload.callsign || "",
      info.payload.dateStr || info.payload.date || "",
    );
  }

  const person = PersonsRepository_.getPersonByCallsign(
    info.payload.callsign,
    info.payload.dateStr || info.payload.date,
  );
  const warnings =
    person && person.phone ? [] : ["Для бійця не знайдено телефон"];

  return _stage7FastResponse_(
    "openPersonCard",
    "Картку бійця зібрано",
    person,
    warnings,
    {
      affectedSheets: [person.sheet || getBotMonthSheetName_()].filter(Boolean),
      affectedEntities: [person.callsign || person.fml || ""].filter(Boolean),
    },
  );
}

function apiLoadCalendarDay(dateStr) {
  return apiStage7GetSidebarData(dateStr || _todayStr_());
}

function apiCheckVacationsAndBirthdays(dateStr) {
  const info = validateDatePayload_({ date: dateStr || _todayStr_() }, "date");
  if (
    typeof AccessEnforcement_ === "object" &&
    AccessEnforcement_.assertCanRunLeaveBirthdayCheck
  ) {
    AccessEnforcement_.assertCanRunLeaveBirthdayCheck(
      { requestedDate: info.payload.dateStr || info.payload.date || "" },
    );
  }

  const daily =
    typeof VacationService_ === "object" &&
    VacationService_ &&
    typeof VacationService_.check === "function"
      ? VacationService_.check(
          info.payload.dateStr || info.payload.date || _todayStr_(),
        )
      : {
          date: info.payload.dateStr || info.payload.date || _todayStr_(),
          vacations:
            runVacationEngine_(
              DateUtils_.parseUaDate(
                info.payload.dateStr || info.payload.date,
              ) || new Date(),
            ) || {},
          birthdays:
            runBirthdayEngine_(
              DateUtils_.parseUaDate(
                info.payload.dateStr || info.payload.date,
              ) || new Date(),
            ) || {},
        };

  return _stage7FastResponse_(
    "checkVacationsAndBirthdays",
    "Перевірку відпусток виконано",
    {
      date:
        daily.date || info.payload.dateStr || info.payload.date || _todayStr_(),
      vacations: daily.vacations || {},
      birthdays: daily.birthdays || {},
      summary: daily.summary || {},
    },
    [],
    {
      affectedSheets: [getBotMonthSheetName_(), CONFIG.PHONES_SHEET].filter(
        Boolean,
      ),
    },
  );
}

function apiStage7CreateNextMonth(options) {
  return Stage7UseCases_.createNextMonth(options || {});
}

function apiRunReconciliation(options) {
  return Stage7UseCases_.runReconciliation(options || {});
}

function apiStage7ReportClientAccessSignal(actionName, details) {
  const result =
    typeof AccessEnforcement_ === "object" &&
    AccessEnforcement_.reportClientAccessSignal
      ? AccessEnforcement_.reportClientAccessSignal(
          actionName || "",
          details || {},
        )
      : {
          success: false,
          blocked: true,
          message: "AccessEnforcement_ недоступний",
          emailSent: false,
          alertLogged: false,
        };

  return _stage7FastResponse_(
    "reportClientAccessSignal",
    result.message || "Client access signal processed",
    result,
    [],
    {
      affectedSheets: [appGetCore("ALERTS_LOG_SHEET", "ALERTS_LOG")].filter(
        Boolean,
      ),
    },
  );
}

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

function _stage7FastStartedAt_() {
  return Date.now();
}

function _stage7FastMeta_(scenario, extraMeta) {
  var raw = extraMeta || {};
  var startedAt = raw.startedAt;
  var cleaned = Object.assign({}, raw);
  delete cleaned.startedAt;

  return finalizeServerResponseDuration_(
    Object.assign(
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
      cleaned,
    ),
    startedAt,
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
  const startedAt = _stage7FastStartedAt_();
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
    { startedAt: startedAt },
  );
}

function _repairOptionalBusinessSheets_() {
  var ss = getWasbSpreadsheet_();
  var results = [];
  var warnings = [];

  function ensureOne_(name, ensureFn) {
    try {
      var sheet = ensureFn();
      results.push({
        name: name,
        success: true,
        sheet: sheet && sheet.getName ? sheet.getName() : name,
      });
    } catch (e) {
      var message = e && e.message ? e.message : String(e);
      results.push({ name: name, success: false, error: message });
      warnings.push(name + ": " + message);
    }
  }

  ensureOne_("Проєкти", function () {
    return ProjectRequests_.ensureProjectsSheet_(ss);
  });
  ensureOne_("Заявки", function () {
    return ProjectRequests_.ensureRequestsSheet_(ss);
  });
  ensureOne_("Дані", function () {
    return MonthlyReport_.ensureDataSheet_(ss);
  });

  return {
    success: warnings.length === 0,
    sheets: results,
    warnings: warnings,
  };
}

function apiStage7BootstrapSidebar() {
  const startedAt = _stage7FastStartedAt_();
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
  const canViewPersonnel = _stage7CanViewSidebarPersonnel_(descriptor);
  if (canViewPersonnel) {
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
  }
  personnelWarnings.forEach(function (w) {
    warnings.push(String(w));
  });

  var commanderRole = String(
    typeof CONFIG !== "undefined" && CONFIG && CONFIG.COMMANDER_ROLE
      ? CONFIG.COMMANDER_ROLE
      : "ГРАФ",
  ).trim();
  var commanderRecipients = [];
  if (canViewPersonnel) {
    try {
      if (typeof getCommanderRecipientOptions_ === "function") {
        commanderRecipients = getCommanderRecipientOptions_();
      }
    } catch (commanderErr) {
      warnings.push(
        commanderErr && commanderErr.message
          ? String(commanderErr.message)
          : String(commanderErr),
      );
    }
  }

  return _stage7FastResponse_(
    "bootstrapSidebar",
    "Базові дані сайдбару завантажено",
    {
      access: descriptor,
      months: months,
      current: current,
      personnelCallsigns: personnelCallsigns,
      commanderRole: commanderRole,
      commanderRecipients: commanderRecipients,
      businessSheets: [
        "Дані",
        "Проєкти",
        "Заявки",
        CONFIG.PHONE_DIRECTORY_SHEET || "PHONE_DIRECTORY",
        CONFIG.CAR_SHEET || "CAR",
        CONFIG.WEAPON_SHEET || "WEAPON",
      ].map(function (name) {
        return { name: name, exists: !!ss.getSheetByName(name) };
      }),
    },
    warnings,
    {
      startedAt: startedAt,
      affectedSheets: months.concat([CONFIG.PERSONNEL_SHEET || "PERSONNEL"]),
    },
  );
}

function _stage7CanViewSidebarPersonnel_(descriptor) {
  return !!(
    typeof AccessEnforcement_ === "object" &&
    AccessEnforcement_ &&
    typeof AccessEnforcement_.canViewSidebarPersonnel === "function" &&
    AccessEnforcement_.canViewSidebarPersonnel(descriptor)
  );
}

function _stage7AssertCanViewSidebarPersonnel_(actionName, descriptorOpt) {
  if (
    typeof AccessEnforcement_ !== "object" ||
    !AccessEnforcement_ ||
    typeof AccessEnforcement_.assertCanViewSidebarPersonnel !== "function"
  ) {
    throw new Error("AccessEnforcement_ недоступний: доступ заборонено");
  }
  return AccessEnforcement_.assertCanViewSidebarPersonnel(
    actionName || "viewSidebarPersonnel",
    descriptorOpt,
  );
}

function apiStage7ListPersonnelCallsigns() {
  const startedAt = _stage7FastStartedAt_();
  _stage7AssertCanViewSidebarPersonnel_("listPersonnelCallsigns");
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
      "Не вдалося прочитати особовий склад",
      { callsigns: [], count: 0, warnings: [] },
      [e && e.message ? e.message : String(e)],
      {
        startedAt: startedAt,
        affectedSheets: [CONFIG.PERSONNEL_SHEET || "PERSONNEL"],
      },
    );
  }

  return _stage7FastResponse_(
    "listPersonnelCallsigns",
    callsigns.length
      ? "Список позивних з особового складу отримано"
      : "Особовий склад порожній або без позивних",
    {
      callsigns: callsigns,
      count: callsigns.length,
      warnings: sheetWarnings,
    },
    sheetWarnings,
    {
      startedAt: startedAt,
      affectedSheets: [CONFIG.PERSONNEL_SHEET || "PERSONNEL"],
    },
  );
}

function apiStage7GetMonthsList() {
  const startedAt = _stage7FastStartedAt_();
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
    { startedAt: startedAt, affectedSheets: months },
  );
}

function _stage7LoadSidebarPersonnelForSession_(
  dateStr,
  actionName,
  descriptorOpt,
) {
  const info = validateDatePayload_({ date: dateStr || _todayStr_() }, "date");
  const safeDate = info.payload.dateStr || info.payload.date || _todayStr_();
  const descriptor =
    descriptorOpt ||
    _stage7AssertCanViewSidebarPersonnel_(actionName || "getSidebarData");

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
  const startedAt = _stage7FastStartedAt_();
  const descriptor = _stage7AssertCanViewSidebarPersonnel_("getSidebarData");
  const sidebar = _stage7LoadSidebarPersonnelForSession_(
    dateStr,
    "getSidebarData",
    descriptor,
  );

  return _stage7FastResponse_(
    "loadCalendarDay",
    "Дані дня завантажено",
    sidebar,
    [],
    {
      startedAt: startedAt,
      affectedSheets: [sidebar.month || getBotMonthSheetName_()],
    },
  );
}


function apiStage7GetPhoneDirectory() {
  const startedAt = _stage7FastStartedAt_();
  _stage7AssertRole_("maintainer", "get phone directory");

  const data = ReferenceSheetsRepository_.readPhoneDirectory();
  return _stage7FastResponse_(
    "getPhoneDirectory",
    "Службові телефони завантажено",
    data,
    data.warnings || [],
    {
      startedAt: startedAt,
      affectedSheets: [CONFIG.PHONE_DIRECTORY_SHEET || "PHONE_DIRECTORY"],
    },
  );
}

function apiStage7GetCarsRegister() {
  const startedAt = _stage7FastStartedAt_();
  _stage7AssertRole_("maintainer", "get cars register");

  const data = ReferenceSheetsRepository_.readCarsRegister();
  return _stage7FastResponse_(
    "getCarsRegister",
    "Реєстр автотехніки завантажено",
    data,
    data.warnings || [],
    {
      startedAt: startedAt,
      affectedSheets: [CONFIG.CAR_SHEET || "CAR"],
    },
  );
}

function apiStage7GetWeaponsRegister() {
  const startedAt = _stage7FastStartedAt_();
  _stage7AssertRole_("maintainer", "get weapons register");

  const data = ReferenceSheetsRepository_.readWeaponsRegister();
  return _stage7FastResponse_(
    "getWeaponsRegister",
    "Реєстр озброєння та майна завантажено",
    data,
    data.warnings || [],
    {
      startedAt: startedAt,
      affectedSheets: [CONFIG.WEAPON_SHEET || "WEAPON"],
    },
  );
}

function apiStage7GetSendPanelData() {
  const startedAt = _stage7FastStartedAt_();
  _stage7AssertRole_("maintainer", "get send panel data");

  const rows = SendPanelRepository_.readRows();
  const stats = SendPanelRepository_.buildStats(rows);
  const panelMeta =
    typeof SendPanelRepository_.getPanelMetadata === "function"
      ? SendPanelRepository_.getPanelMetadata() || {}
      : {};

  return _stage7FastResponse_(
    "getSendPanelData",
    "Панель надсилання оновлено",
    {
      rows: rows,
      stats: stats,
      month: panelMeta.month || getBotMonthSheetName_(),
      date: panelMeta.date || "",
    },
    [],
    {
      startedAt: startedAt,
      affectedSheets: [CONFIG.SEND_PANEL_SHEET, getBotMonthSheetName_()].filter(
        Boolean,
      ),
    },
  );
}

function apiStage7SwitchBotToMonth(monthSheetName) {
  _stage7AssertRole_("maintainer", "switch bot month");
  return Stage7UseCases_.switchBotToMonth({ month: monthSheetName || "" });
}

function apiGenerateSendPanelForDate(options) {
  _stage7AssertRole_("maintainer", "generate send panel for date");
  return Stage7UseCases_.generateSendPanelForDate(options || {});
}

function apiGenerateSendPanelForRange(options) {
  _stage7AssertRole_("maintainer", "generate send panel for range");
  return Stage7UseCases_.generateSendPanelForRange(options || {});
}

function apiMarkPanelRowsAsPending(rowNumbers, options) {
  _stage7AssertRole_("maintainer", "mark panel rows as pending");
  return Stage7UseCases_.markPanelRowsAsPending(rowNumbers, options || {});
}

function apiMarkPanelRowsAsSent(rowNumbers, options) {
  _stage7AssertRole_("maintainer", "mark panel rows as sent");
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
  _stage7AssertRole_("maintainer", "mark panel rows as sent fast");
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
    throw new Error("Не передано коректні рядки панелі надсилання");
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
  _stage7AssertRole_("maintainer", "mark panel rows as unsent");
  return Stage7UseCases_.markPanelRowsAsUnsent(rowNumbers, options || {});
}

function apiSendPendingRows(options) {
  _stage7AssertRole_("maintainer", "send pending rows");
  return Stage7UseCases_.sendPendingRows(options || {});
}

function apiBuildDaySummary(dateStr) {
  _stage7AssertRole_("operator", "build day summary");
  return Stage7UseCases_.buildDaySummary({ date: dateStr || _todayStr_() });
}

function apiBuildDetailedSummary(dateStr) {
  _stage7AssertRole_("operator", "build detailed summary");
  return Stage7UseCases_.buildDetailedSummary({
    date: dateStr || _todayStr_(),
  });
}

function apiOpenPersonCard(callsign, dateStr) {
  const startedAt = _stage7FastStartedAt_();
  const info = validatePersonLookupPayload_({
    callsign: callsign || "",
    date: dateStr || _todayStr_(),
  });
  if (
    typeof AccessEnforcement_ !== "object" ||
    !AccessEnforcement_ ||
    typeof AccessEnforcement_.assertCanOpenPersonCard !== "function"
  ) {
    throw new Error("AccessEnforcement_ недоступний: доступ заборонено");
  }
  AccessEnforcement_.assertCanOpenPersonCard(
    info.payload.callsign || "",
    info.payload.dateStr || info.payload.date || "",
  );

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
      startedAt: startedAt,
      affectedSheets: [person.sheet || getBotMonthSheetName_()].filter(Boolean),
      affectedEntities: [person.callsign || person.fml || ""].filter(Boolean),
    },
  );
}

function apiLoadCalendarDay(dateStr) {
  return apiStage7GetSidebarData(dateStr || _todayStr_());
}

function apiCheckVacationsAndBirthdays(dateOrOptions) {
  const startedAt = _stage7FastStartedAt_();
  _stage7AssertRole_("admin", "check vacations and birthdays");
  const options =
    dateOrOptions && typeof dateOrOptions === "object"
      ? Object.assign({}, dateOrOptions)
      : { date: dateOrOptions || _todayStr_() };
  const info = validateDatePayload_(options, "date");
  const daily =
    typeof VacationService_ === "object" &&
    VacationService_ &&
    typeof VacationService_.check === "function"
      ? VacationService_.check(
          Object.assign({}, info.payload, {
            date: info.payload.dateStr || info.payload.date || _todayStr_(),
          }),
        )
      : {
          date: info.payload.dateStr || info.payload.date || _todayStr_(),
          vacations:
            runVacationEngine_(
              DateUtils_.parseUaDate(
                info.payload.dateStr || info.payload.date,
              ) || new Date(),
              info.payload,
            ) || {},
          birthdays:
            runBirthdayEngine_(
              DateUtils_.parseUaDate(
                info.payload.dateStr || info.payload.date,
              ) || new Date(),
              info.payload,
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
      startedAt: startedAt,
      affectedSheets: [getBotMonthSheetName_(), CONFIG.PHONES_SHEET].filter(
        Boolean,
      ),
    },
  );
}

function apiStage7CreateNextMonth(options) {
  _stage7AssertRole_("maintainer", "create next month");
  return Stage7UseCases_.createNextMonth(options || {});
}

function apiRunReconciliation(options) {
  _stage7AssertRole_("maintainer", "run reconciliation");
  return Stage7UseCases_.runReconciliation(options || {});
}

function apiStage7ReportClientAccessSignal(actionName, details) {
  const startedAt = _stage7FastStartedAt_();
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
      startedAt: startedAt,
      affectedSheets: [appGetCore("ALERTS_LOG_SHEET", "ALERTS_LOG")].filter(
        Boolean,
      ),
    },
  );
}

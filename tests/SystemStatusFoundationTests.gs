/** Pure GAS unit-style tests for SS-1. Safe to run without a spreadsheet. */

function _systemStatusTestAssert_(condition, message) {
  if (!condition) throw new Error(message || "System status assertion failed");
}

function _systemStatusTestEqual_(actual, expected, message) {
  _systemStatusTestAssert_(
    actual === expected,
    (message || "Unexpected value") + ': expected "' + expected + '", got "' + actual + '"',
  );
}

function _systemStatusTestPush_(report, name, callback) {
  try {
    callback();
    report.checks.push({ name: name, status: "OK" });
  } catch (error) {
    report.ok = false;
    report.checks.push({
      name: name,
      status: "FAIL",
      details: error && error.message ? error.message : String(error),
    });
  }
}

function _systemStatusTestTempRow_(callsign, issued, returned) {
  var row = Array(TemporaryPropertyRegister_.HEADERS.length).fill("");
  row[TemporaryPropertyRegister_.COL.CALLSIGN - 1] = callsign;
  row[TemporaryPropertyRegister_.COL.ISSUED_QTY - 1] = issued;
  row[TemporaryPropertyRegister_.COL.RETURNED_QTY - 1] = returned;
  return row;
}

function runSystemStatusFoundationTests_() {
  var report = { ok: true, checks: [] };

  _systemStatusTestPush_(report, "status reducer order", function () {
    _systemStatusTestEqual_(SystemStatusFoundation_.reduceOverall([]), "unavailable");
    _systemStatusTestEqual_(SystemStatusFoundation_.reduceOverall(["broken"]), "unavailable");
    _systemStatusTestEqual_(SystemStatusFoundation_.reduceOverall(["healthy"]), "healthy");
    _systemStatusTestEqual_(
      SystemStatusFoundation_.reduceOverall(["healthy", "broken"]),
      "attention",
    );
    _systemStatusTestEqual_(
      SystemStatusFoundation_.reduceOverall(["healthy", "unavailable"]),
      "attention",
    );
    _systemStatusTestEqual_(
      SystemStatusFoundation_.reduceOverall(["unavailable", "unavailable"]),
      "unavailable",
    );
    _systemStatusTestEqual_(
      SystemStatusFoundation_.reduceOverall(["critical", "unavailable"]),
      "critical",
    );
  });

  _systemStatusTestPush_(report, "presentation mapper allowlist", function () {
    var injected = {
      id: "key_data",
      title: "PERSONNEL",
      status: "attention",
      summary: "WASB_SPREADSHEET_ID",
      details: ["https://example.invalid/private"],
      reasonCodes: ["data_issues"],
      freshness: "current",
      checkedAt: "2026-07-31T10:00:00.000Z",
      metrics: {
        activePersonnel: 4,
        phoneRecords: 3,
        rawPhone: "+380661234567",
      },
      actionIds: ["materialize_computed_data", "open_inventory_reconciliation"],
      retryable: true,
      rawException: "secret failure",
      accessRows: [{ email: "private@example.invalid" }],
    };
    var mapped = SystemStatusFoundation_.mapSection(injected);
    var serialized = JSON.stringify(mapped);
    [
      "PERSONNEL",
      "WASB_SPREADSHEET_ID",
      "example.invalid",
      "+380661234567",
      "secret failure",
      "private@example.invalid",
      "open_inventory_reconciliation",
    ].forEach(function (forbidden) {
      _systemStatusTestAssert_(serialized.indexOf(forbidden) === -1, "Mapper leaked " + forbidden);
    });
    _systemStatusTestEqual_(mapped.title, "Ключові дані");
    _systemStatusTestEqual_(mapped.metrics.length, 2);
    _systemStatusTestEqual_(mapped.actionIds.length, 1);
    _systemStatusTestAssert_(
      Object.keys(mapped).every(function (key) {
        return SystemStatusFoundation_.presentationAllowlist.section.indexOf(key) !== -1;
      }),
      "Section contains a non-allowlisted field",
    );
  });

  _systemStatusTestPush_(report, "partial failure stays local", function () {
    var failed = SystemStatusProbes_.runSafelyForTests(
      "failed_probe",
      "temporary_property",
      function () {
        throw new Error("raw private exception");
      },
    );
    _systemStatusTestEqual_(failed.status, "unavailable");
    var mapped = SystemStatusFoundation_.mapSection(failed);
    _systemStatusTestAssert_(
      JSON.stringify(mapped).indexOf("raw private exception") === -1,
      "Raw exception reached presentation",
    );
    var snapshot = SystemStatusFoundation_.mapSnapshot({
      generatedAt: "2026-07-31T10:00:00.000Z",
      sections: [
        failed,
        { id: "launch_settings", status: "critical", freshness: "not_applicable" },
      ],
    });
    _systemStatusTestEqual_(snapshot.sections.length, 8);
    _systemStatusTestEqual_(snapshot.overall, "critical");
  });

  _systemStatusTestPush_(report, "incomplete snapshot fails closed", function () {
    var partial = SystemStatusFoundation_.mapSnapshot({
      sections: [{ id: "key_data", status: "healthy", freshness: "current" }],
    });
    _systemStatusTestEqual_(partial.sections.length, 8);
    _systemStatusTestEqual_(partial.overall, "attention");
    _systemStatusTestEqual_(partial.summary.unavailable, 7);

    var duplicate = SystemStatusFoundation_.mapSnapshot({
      sections: [
        { id: "key_data", status: "healthy" },
        { id: "key_data", status: "healthy" },
      ],
    });
    _systemStatusTestEqual_(duplicate.sections[0].status, "unavailable");
    _systemStatusTestEqual_(duplicate.overall, "unavailable");

    var malformed = SystemStatusFoundation_.mapSection({ id: "key_data", status: "broken" });
    _systemStatusTestEqual_(malformed.status, "unavailable");
  });

  _systemStatusTestPush_(report, "canonical personnel phone index includes phone 2", function () {
    var records = [{
      active: true,
      fml: "Тестова Особа",
      callsign: "Тест",
      phone: "",
      phone2: "+380671112233",
    }];
    var index = PersonnelRepository_.buildPhonesIndexFromRecordsForTests(records);
    index.sourceAvailable = true;
    var item = index.items[0];
    _systemStatusTestEqual_(item.phone, "+380671112233");
    _systemStatusTestAssert_(index.byPhone["+380671112233"] === item, "Phone 2 missing from index");
    var phoneMap = _stage7BuildPhonesMapFromIndex_(index);
    var consistency = _stage7SummarizePhonesIndexConsistency_(index, phoneMap);
    _systemStatusTestEqual_(consistency.validRecords, 1);
    _systemStatusTestEqual_(consistency.mapIndexMismatches, 0);
    ["byFml", "byNorm", "byCallsign", "byRole", "byPhone"].forEach(function (lookup) {
      var corrupted = PersonnelRepository_.buildPhonesIndexFromRecordsForTests(records);
      corrupted.sourceAvailable = true;
      corrupted[lookup] = {};
      var result = _stage7SummarizePhonesIndexConsistency_(
        corrupted,
        _stage7BuildPhonesMapFromIndex_(corrupted),
      );
      _systemStatusTestAssert_(
        result.mapIndexMismatches > 0,
        lookup + " drift stayed healthy",
      );
    });
  });

  _systemStatusTestPush_(report, "read-only personnel failure falls back to phones", function () {
    var values = [
      ["FML", "Phone", "Phone 2", "Callsign", "Role"],
      ["Резервна Особа", "", "+380681234567", "Резерв", "Резерв"],
    ];
    var fakeSheet = {
      getLastRow: function () { return values.length; },
      getLastColumn: function () { return values[0].length; },
      getRange: function () {
        return { getDisplayValues: function () { return values; } };
      },
    };
    var index = loadPhonesIndex_({
      readOnly: true,
      readOnlyPersonnelLoaderForTests: function () {
        throw new Error("transient personnel read failure");
      },
      spreadsheetForTests: {
        getSheetByName: function () { return fakeSheet; },
      },
    });
    _systemStatusTestEqual_(index.source, "PHONES");
    _systemStatusTestEqual_(index.items.length, 1);
    _systemStatusTestEqual_(index.items[0].phone, "+380681234567");
    var consistency = _stage7SummarizePhonesIndexConsistency_(
      index,
      _stage7BuildPhonesMapFromIndex_(index),
    );
    _systemStatusTestEqual_(consistency.mapIndexMismatches, 0);
  });

  _systemStatusTestPush_(report, "canonical normalized phone map aliases detect drift", function () {
    var values = [
      ["FML", "Phone", "Phone 2", "Callsign", "Role"],
      ["Тестова Особа", "", "+380681234568", "Сигнал", "Черговий"],
    ];
    var fakeSheet = {
      getLastRow: function () { return values.length; },
      getLastColumn: function () { return values[0].length; },
      getRange: function () {
        return { getDisplayValues: function () { return values; } };
      },
    };
    var index = loadPhonesIndex_({
      readOnly: true,
      readOnlyPersonnelLoaderForTests: function () { return null; },
      spreadsheetForTests: {
        getSheetByName: function () { return fakeSheet; },
      },
    });
    var item = index.items[0];
    var requiredAliases = [
      item.fml,
      normalizeFML_(item.fml),
      _normFmlForProfiles_(item.fml),
      item.callsign,
      _normCallsignKey_(item.callsign),
      item.role,
      _normCallsignKey_(item.role),
    ].filter(function (alias, position, aliases) {
      return alias && aliases.indexOf(alias) === position;
    });
    var canonicalMap = _stage7BuildPhonesMapFromIndex_(index);
    _systemStatusTestEqual_(
      _stage7SummarizePhonesIndexConsistency_(index, canonicalMap).mapIndexMismatches,
      0,
    );
    requiredAliases.forEach(function (alias) {
      _systemStatusTestAssert_(
        canonicalMap[alias] === item.phone,
        "Canonical alias missing before corruption: " + alias,
      );
      var corruptedMap = Object.assign({}, canonicalMap);
      delete corruptedMap[alias];
      var result = _stage7SummarizePhonesIndexConsistency_(index, corruptedMap);
      _systemStatusTestAssert_(
        result.mapIndexMismatches > 0,
        "Normalized map alias drift stayed healthy: " + alias,
      );
    });
  });

  _systemStatusTestPush_(report, "temporary property positive balance", function () {
    var result = TemporaryPropertyRegister_.summarizeOutstandingRowsForTests([
      _systemStatusTestTempRow_("Альфа", 2, 0),
      _systemStatusTestTempRow_("Альфа", 1, 1),
      _systemStatusTestTempRow_("Бета", 3, 2),
      _systemStatusTestTempRow_("Гамма", 0, 0),
    ]);
    _systemStatusTestEqual_(result.outstandingRecords, 2);
    _systemStatusTestEqual_(result.persons, 2);
  });

  _systemStatusTestPush_(report, "managed and legacy trigger duplicates", function () {
    var definitions = [{ handler: "stage7JobOne" }, { handler: "stage7JobTwo" }];
    function trigger(handler, eventType) {
      return {
        getHandlerFunction: function () { return handler; },
        getEventType: function () { return eventType || "TIME"; },
      };
    }
    var result = SystemStatusProbes_.summarizeManagedTriggersForTests(definitions, [
      trigger("stage7JobOne"),
      trigger("stage7JobOne"),
      trigger("stage7JobUnknown"),
      trigger("onEdit", "ON_EDIT"),
      trigger("onEdit", "ON_EDIT"),
      trigger("onChange", "ON_CHANGE"),
    ], {
      legacyInstallable: [
        { handler: "onEdit", eventType: "ON_EDIT", maxCount: 1 },
        { handler: "onChange", eventType: "ON_CHANGE", maxCount: 1 },
      ],
    });
    _systemStatusTestEqual_(result.status, "critical");
    _systemStatusTestEqual_(result.metrics.missing, 1);
    _systemStatusTestEqual_(result.metrics.duplicates, 2);
    _systemStatusTestEqual_(result.metrics.unexpected, 1);
  });

  _systemStatusTestPush_(report, "legacy trigger wrong event pair is unexpected", function () {
    function trigger(handler, eventType) {
      return {
        getHandlerFunction: function () { return handler; },
        getEventType: function () { return eventType; },
      };
    }
    var policy = {
      legacyInstallable: [
        { handler: "onEdit", eventType: "ON_EDIT", maxCount: 1 },
        { handler: "onChange", eventType: "ON_CHANGE", maxCount: 1 },
      ],
    };
    [
      trigger("onEdit", "ON_CHANGE"),
      trigger("onChange", "ON_EDIT"),
    ].forEach(function (wrongTrigger) {
      var result = SystemStatusProbes_.summarizeManagedTriggersForTests(
        [],
        [wrongTrigger],
        policy,
      );
      _systemStatusTestEqual_(result.status, "attention");
      _systemStatusTestEqual_(result.metrics.unexpected, 1);
    });
  });

  _systemStatusTestPush_(report, "required settings do not expose values", function () {
    var result = SystemStatusProbes_.summarizeRequiredSettingsForTests("", {
      configured: true,
      looksLikeEmail: false,
    });
    _systemStatusTestEqual_(result.status, "critical");
    _systemStatusTestEqual_(result.metrics.missing, 1);
    _systemStatusTestEqual_(result.metrics.invalid, 1);
    _systemStatusTestAssert_(
      JSON.stringify(result).indexOf("WASB_") === -1,
      "Property key leaked from settings summary",
    );
  });

  _systemStatusTestPush_(report, "access violations are counts only", function () {
    var result = SystemStatusProbes_.summarizeAccessDiagnosticsForTests({
      schema: { exists: false, missingHeaders: ["secret_header"] },
      dataIntegrity: {
        duplicateEmails: [{ email: "private@example.invalid" }],
        invalidRoleValues: [{ role: "secret" }],
      },
    });
    _systemStatusTestEqual_(result.schemaIssues, 2);
    _systemStatusTestEqual_(result.accessIssues, 2);
    _systemStatusTestAssert_(
      JSON.stringify(result).indexOf("private@example.invalid") === -1,
      "Access row leaked from summary",
    );
  });

  _systemStatusTestPush_(report, "personnel unavailable propagates to access", function () {
    var unavailable = SystemStatusProbes_.combineAccessDataQualityForTests(
      { schemaIssues: 0, accessIssues: 0 },
      {
        status: "unavailable",
        freshness: "unknown",
        reasonCodes: ["collector_failed"],
        metrics: {},
        retryable: true,
      },
    );
    _systemStatusTestEqual_(unavailable.status, "attention");
    _systemStatusTestEqual_(unavailable.freshness, "unknown");
    _systemStatusTestAssert_(unavailable.reasonCodes.indexOf("collector_failed") !== -1);

    var critical = SystemStatusProbes_.combineAccessDataQualityForTests(
      { schemaIssues: 0, accessIssues: 0 },
      { status: "critical", metrics: { duplicateActiveCallsigns: 2 }, reasonCodes: [] },
    );
    _systemStatusTestEqual_(critical.status, "critical");
  });

  _systemStatusTestPush_(report, "vacation pending and planner signals", function () {
    var pending = {
      version: 1,
      generatedAt: "2026-07-31T09:00:00.000Z",
      conflicts: [{ id: "x" }],
      removals: [],
      unresolved: [],
      invalid: [],
      unsupported: [],
    };
    var result = SystemStatusProbes_.summarizeVacationSignalsForTests(
      pending,
      { checks: [{ severity: "ERROR" }, { severity: "WARNING" }] },
    );
    _systemStatusTestEqual_(result.status, "critical");
    _systemStatusTestEqual_(result.metrics.plannerCritical, 1);
    _systemStatusTestEqual_(result.metrics.plannerWarnings, 1);
    _systemStatusTestEqual_(result.metrics.pendingConflicts, 1);
    _systemStatusTestEqual_(result.freshness, "unknown");
    _systemStatusTestAssert_(result.reasonCodes.indexOf("pending_check_unknown") !== -1);
  });

  _systemStatusTestPush_(report, "vacation pending never invents freshness policy", function () {
    var recentVersioned = { version: 1, generatedAt: "2026-07-31T09:00:00.000Z" };
    var stale = { version: 1, generatedAt: "2026-07-29T09:00:00.000Z" };
    var wrongVersion = { version: 0, generatedAt: "2026-07-31T09:00:00.000Z" };
    [recentVersioned, stale, wrongVersion, {}].forEach(function (pending) {
      var result = SystemStatusProbes_.summarizeVacationSignalsForTests(
        pending,
        { checks: [] },
      );
      _systemStatusTestEqual_(result.freshness, "unknown");
      _systemStatusTestAssert_(result.reasonCodes.indexOf("pending_check_unknown") !== -1);
    });
  });

  _systemStatusTestPush_(report, "inventory missing prerequisite is attention", function () {
    var result = SystemStatusProbes_.classifyInventoryForTests({
      available: true,
      configured: false,
      stale: true,
      incompletePastMonths: 0,
      missingFiles: 0,
      duplicateFiles: 0,
    });
    _systemStatusTestEqual_(result.status, "attention");
    _systemStatusTestAssert_(result.reasonCodes.indexOf("not_configured") !== -1);
    _systemStatusTestEqual_(result.freshness, "unknown");
    _systemStatusTestAssert_(result.reasonCodes.indexOf("scan_evidence_unknown") !== -1);
  });

  _systemStatusTestPush_(report, "inventory truncation and sync evidence", function () {
    var truncated = SystemStatusProbes_.classifyInventoryForTests({
      available: true,
      configured: true,
      scanTruncated: true,
      lastSyncedAt: "2026-07-31T09:00:00.000Z",
    });
    _systemStatusTestEqual_(truncated.status, "attention");
    _systemStatusTestAssert_(truncated.reasonCodes.indexOf("scan_truncated") !== -1);

    var complete = SystemStatusProbes_.classifyInventoryForTests({
      available: true,
      configured: true,
      scanTruncated: false,
      lastSyncedAt: "2026-07-31T09:00:00.000Z",
    });
    _systemStatusTestEqual_(complete.status, "healthy");
    _systemStatusTestEqual_(complete.freshness, "current");
    var mapped = SystemStatusFoundation_.mapSection({
      id: "inventory_reconciliation",
      status: complete.status,
      freshness: complete.freshness,
      metrics: complete.metrics,
    });
    _systemStatusTestAssert_(
      mapped.metrics.some(function (metric) {
        return metric.label === "Остання синхронізація" &&
          metric.value === "2026-07-31T09:00:00.000Z";
      }),
      "Inventory lastSyncedAt was not mapped",
    );
  });

  _systemStatusTestPush_(report, "journal freshness remains SS-2 unavailable", function () {
    var result = SystemStatusProbes_.currentMonthJournal();
    _systemStatusTestEqual_(result.status, "unavailable");
    _systemStatusTestEqual_(result.freshness, "unknown");
  });

  return report;
}

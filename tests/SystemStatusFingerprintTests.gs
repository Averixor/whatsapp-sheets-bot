/** Pure GAS unit-style tests for the SS-2A stage fingerprint contract. */

function _systemStatusFingerprintAssert_(condition, message) {
  if (!condition) throw new Error(message || "Fingerprint assertion failed");
}

function _systemStatusFingerprintEqual_(left, right, message) {
  _systemStatusFingerprintAssert_(
    left === right,
    (message || "Unexpected fingerprint value") +
      ': expected "' + right + '", got "' + left + '"',
  );
}

function _systemStatusFingerprintCheck_(report, name, callback) {
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

function _systemStatusFingerprintValue_(stageId, kind, projection, chunkBytes) {
  var method =
    kind === "result"
      ? SystemStatusFingerprints_.buildStageResultFingerprint
      : SystemStatusFingerprints_.buildStageSourceFingerprint;
  return method(stageId, projection, { chunkBytes: chunkBytes || 4096 }).fingerprint;
}

function _systemStatusFingerprintSuccessfulResult_(stageId) {
  if (stageId === "computed.monthly_callsigns") return { ok: true, mode: "single", failedCount: 0 };
  if (stageId === "computed.vacation_schedule") return { resultObjectPresent: true, threw: false };
  if (stageId === "computed.vacation_monthly_sync") {
    return { ok: true, transitionEvidence: _systemStatusMonthlyStructuredEvidence_() };
  }
  if (stageId === "computed.send_panel_status") return { ok: true };
  if (stageId === "month_journal.target_resolution") return { targetMonth: "07", sheetExists: true };
  if (stageId === "month_journal.source_projection") return { available: true };
  if (stageId === "month_journal.non_target_preservation") return { stable: true, ambiguous: false };
  return { ok: true };
}

function _systemStatusMonthlyStructuredEvidence_() {
  var digest = function (character) {
    return "sha256:" + String(character).repeat(64);
  };
  var binding = {
    stageId: "computed.vacation_monthly_sync",
    target: "07",
    scopeFingerprint: digest("a"),
    runId: "test-run-07",
  };
  var priorRows = [{ cellKey: "07:R2:C3", cellValue: "", cellDisplay: "", validationAllowed: ["В"], note: "", dateRaw: 1, dateDisplay: "01.07", callsign: "A", fml: "B" }];
  var expectedRows = [{ cellKey: "07:R2:C3", cellValue: "В", cellDisplay: "В", validationAllowed: ["В"], note: "", dateRaw: 1, dateDisplay: "01.07", callsign: "A", fml: "B" }];
  var proof = function (prior, expected, post) {
    return Object.assign({}, binding, {
      priorFingerprint: prior,
      expectedFingerprint: expected,
      postFingerprint: post,
    });
  };
  return {
    expectedBinding: binding,
    immutable: {
      preFingerprint: "immutable",
      postFingerprint: "immutable",
      preReadOrigin: "live",
      postReadOrigin: "live",
      preRequiredAvailable: true,
      postRequiredAvailable: true,
    },
    transition: {
      available: true,
      priorRows: priorRows,
      expectedRows: expectedRows,
      postRows: expectedRows,
      binding: binding,
      targetCells: proof(
        SystemStatusFingerprints_.digestCanonical(priorRows).digest,
        SystemStatusFingerprints_.digestCanonical(expectedRows).digest,
        SystemStatusFingerprints_.digestCanonical(expectedRows).digest,
      ),
      metadata: proof(digest("b"), digest("c"), digest("c")),
      pendingPlan: proof(digest("d"), digest("e"), digest("e")),
      conflicts: proof(digest("a"), digest("f"), digest("f")),
    },
    result: { available: true, fingerprint: "result", expectedFingerprint: "result" },
  };
}

function _systemStatusFingerprintEvidence_(stageId, result, scope, overrides) {
  return Object.assign({
    scopeKnown: true,
    attempted: true,
    resultPresent: true,
    required: SystemStatusFingerprints_.stagePolicy[stageId].policy === "required",
    optional: SystemStatusFingerprints_.stagePolicy[stageId].policy === "optional",
    skipPredicateSatisfied: false,
    scope: scope || {},
    result: result,
  }, overrides || {});
}

function _systemStatusFingerprintFixtureValue_(normalizer, changed) {
  if (normalizer === "boolean") return changed ? false : true;
  if (normalizer === "number") return changed ? 2 : 1;
  if (normalizer === "date_day") return changed ? "2026-08-01" : "2026-07-31";
  if (normalizer === "birthday_day") return changed ? "02.01.1990" : "01.01.1990";
  if (normalizer === "identity") return { marker: changed ? "changed" : "base" };
  return changed ? "Changed value" : "Base value";
}

function _systemStatusFingerprintBuilderFixture_(stageId, kind, mutation) {
  var dependencies = SystemStatusFingerprints_.executableManifest[stageId][kind];
  var injected = {};
  var ranges = {};
  var bindings = {};
  dependencies.forEach(function (dependency) {
    var row = {};
    dependency.fields.forEach(function (field) {
      var changed = mutation && mutation.dependencyId === dependency.id &&
        mutation.field === field[0];
      row[field[0]] = _systemStatusFingerprintFixtureValue_(field[1], changed);
    });
    dependency.ignoredFields.forEach(function (field) {
      row[field] = mutation && mutation.dependencyId === dependency.id &&
        mutation.ignoredField === field ? "changed ignored" : "base ignored";
    });
    if (dependency.kind === "injected") injected[dependency.id] = [row];
    else {
      ranges[dependency.id] = [row];
      bindings[dependency.id] = { sheet: "fixture", range: dependency.id };
    }
  });
  return {
    context: SystemStatusFingerprints_.createExecutionContext({
      spreadsheetId: "fixture-book",
      injected: injected,
      adapter: {
        readRange: function (request) {
          return ranges[request.range] || [];
        },
      },
    }),
    bindings: bindings,
  };
}

function runSystemStatusFingerprintTests_() {
  var report = { ok: true, checks: [] };

  _systemStatusFingerprintCheck_(report, "canonical object keys", function () {
    var left = _systemStatusFingerprintValue_(
      "computed.personnel_helpers",
      "source",
      { z: 1, a: "два", nested: { b: true, a: null } },
    );
    var right = _systemStatusFingerprintValue_(
      "computed.personnel_helpers",
      "source",
      { nested: { a: null, b: true }, a: "два", z: 1 },
    );
    _systemStatusFingerprintEqual_(left, right, "Object insertion order changed digest");
  });

  _systemStatusFingerprintCheck_(report, "chunk boundary independence", function () {
    var projection = { rows: [] };
    for (var i = 0; i < 400; i++) {
      projection.rows.push(["Рядок " + i, i, i % 2 === 0]);
    }
    var small = _systemStatusFingerprintValue_(
      "computed.vacation_schedule",
      "source",
      projection,
      64,
    );
    var large = _systemStatusFingerprintValue_(
      "computed.vacation_schedule",
      "source",
      projection,
      8192,
    );
    _systemStatusFingerprintEqual_(small, large, "Chunk size changed digest");
  });

  _systemStatusFingerprintCheck_(report, "known SHA-256 vector", function () {
    var empty = SystemStatusFingerprints_.digestCanonical("");
    _systemStatusFingerprintEqual_(
      empty.digest,
      "sha256:4a44ca33cb2ab92e0983a99b93ed982e7681f376253b3d3574c2a76b9e433c83",
      "Canonical s0:; SHA-256 vector mismatch",
    );
    var again = SystemStatusFingerprints_.digestCanonical("");
    _systemStatusFingerprintEqual_(empty.digest, again.digest);
  });

  _systemStatusFingerprintCheck_(report, "semantic personnel row order", function () {
    var policy = {
      schemaVersion: "personnel-source-v1",
      order: "semantic",
      duplicates: "preserve",
      ignoreEmptyTail: true,
      fields: [
        { name: "callsign", normalizer: "upper_key" },
        { name: "birthday", normalizer: "date_day" },
      ],
    };
    var first = SystemStatusFingerprints_.projectRows(
      { rows: [{ callsign: "А", birthday: "01.01.1990" }, { callsign: "Б", birthday: "02.02.1991" }] },
      policy,
    );
    var swapped = SystemStatusFingerprints_.projectRows(
      { rows: [{ callsign: "Б", birthday: "02.02.1991" }, { callsign: "А", birthday: "01.01.1990" }] },
      policy,
    );
    _systemStatusFingerprintAssert_(
      _systemStatusFingerprintValue_("computed.personnel_helpers", "source", first) !==
        _systemStatusFingerprintValue_("computed.personnel_helpers", "source", swapped),
      "Semantic PERSONNEL row order was ignored",
    );
  });

  _systemStatusFingerprintCheck_(report, "ignored fields and empty tail", function () {
    var policy = {
      schemaVersion: "phones-result-projection-v1",
      order: "semantic",
      duplicates: "preserve",
      ignoreEmptyTail: true,
      fields: [
        { name: "callsign", normalizer: "upper_key" },
        { name: "phone", normalizer: "text" },
      ],
    };
    var base = SystemStatusFingerprints_.projectRows(
      { rows: [{ callsign: "Тест", phone: "+380 67 111 22 33", color: "red" }] },
      policy,
    );
    var noisy = SystemStatusFingerprints_.projectRows(
      { rows: [{ callsign: " Тест ", phone: " +380 67 111 22 33 ", color: "blue" }, { callsign: "", phone: "" }] },
      policy,
    );
    _systemStatusFingerprintEqual_(
      _systemStatusFingerprintValue_("computed.phones_result", "result", base),
      _systemStatusFingerprintValue_("computed.phones_result", "result", noisy),
      "Ignored field or empty tail changed result",
    );
  });

  _systemStatusFingerprintCheck_(report, "phone formatting follows runtime trim", function () {
    var plain = _systemStatusFingerprintBuilderFixture_("computed.phones_result", "result");
    plain.context.adapter.readRange = function () {
      return [{ callsign: "A", phone: "+380 67", phone2: "" }];
    };
    var compact = _systemStatusFingerprintBuilderFixture_("computed.phones_result", "result");
    compact.context.adapter.readRange = function () {
      return [{ callsign: "A", phone: "+38067", phone2: "" }];
    };
    var left = SystemStatusFingerprints_.buildStageResultFingerprintFromContext(
      "computed.phones_result", plain.context, plain.bindings,
    ).fingerprint;
    var right = SystemStatusFingerprints_.buildStageResultFingerprintFromContext(
      "computed.phones_result", compact.context, compact.bindings,
    ).fingerprint;
    _systemStatusFingerprintAssert_(left !== right, "Phone punctuation was normalized beyond runtime trim");
  });

  _systemStatusFingerprintCheck_(report, "executable manifest semantic and ignored mutations", function () {
    Object.keys(SystemStatusFingerprints_.executableManifest).forEach(function (stageId) {
      ["source", "result"].forEach(function (kind) {
        var method = kind === "source"
          ? SystemStatusFingerprints_.buildStageSourceFingerprintFromContext
          : SystemStatusFingerprints_.buildStageResultFingerprintFromContext;
        var baseFixture = _systemStatusFingerprintBuilderFixture_(stageId, kind);
        var base = method(stageId, baseFixture.context, baseFixture.bindings).fingerprint;
        SystemStatusFingerprints_.executableManifest[stageId][kind].forEach(function (dependency) {
          dependency.fields.forEach(function (field) {
            var changedFixture = _systemStatusFingerprintBuilderFixture_(stageId, kind, {
              dependencyId: dependency.id,
              field: field[0],
            });
            var changed = method(stageId, changedFixture.context, changedFixture.bindings).fingerprint;
            _systemStatusFingerprintAssert_(base !== changed, stageId + " " + kind + " ignored semantic " + dependency.id + "." + field[0]);
          });
          dependency.ignoredFields.forEach(function (ignoredField) {
            var ignoredFixture = _systemStatusFingerprintBuilderFixture_(stageId, kind, {
              dependencyId: dependency.id,
              ignoredField: ignoredField,
            });
            var ignored = method(stageId, ignoredFixture.context, ignoredFixture.bindings).fingerprint;
            _systemStatusFingerprintEqual_(base, ignored, stageId + " " + kind + " included ignored " + dependency.id + "." + ignoredField);
          });
        });
      });
    });
  });

  _systemStatusFingerprintCheck_(report, "required dependency presence and empty success", function () {
    Object.keys(SystemStatusFingerprints_.executableManifest).forEach(function (stageId) {
      ["source", "result"].forEach(function (kind) {
        var method = kind === "source"
          ? SystemStatusFingerprints_.buildStageSourceFingerprintFromContext
          : SystemStatusFingerprints_.buildStageResultFingerprintFromContext;
        var dependencies = SystemStatusFingerprints_.executableManifest[stageId][kind];
        dependencies.forEach(function (dependency) {
          var missing = _systemStatusFingerprintBuilderFixture_(stageId, kind);
          if (dependency.kind === "range") delete missing.bindings[dependency.id];
          else delete missing.context.injected[dependency.id];
          var unavailable = method(stageId, missing.context, missing.bindings);
          _systemStatusFingerprintEqual_(unavailable.fingerprint, null, stageId + "." + dependency.id);
          _systemStatusFingerprintEqual_(unavailable.status, "unavailable", stageId + "." + dependency.id);
          _systemStatusFingerprintEqual_(unavailable.dependencyId, dependency.id);
        });

        var allMissing = _systemStatusFingerprintBuilderFixture_(stageId, kind);
        allMissing.bindings = {};
        allMissing.context.injected = {};
        var allUnavailable = method(stageId, allMissing.context, allMissing.bindings);
        _systemStatusFingerprintEqual_(allUnavailable.fingerprint, null, stageId + " all missing");
        _systemStatusFingerprintEqual_(allUnavailable.status, "unavailable", stageId + " all missing");

        var empty = _systemStatusFingerprintBuilderFixture_(stageId, kind);
        Object.keys(empty.context.injected).forEach(function (key) {
          empty.context.injected[key] = [];
        });
        empty.context.adapter.readRange = function () { return []; };
        var emptyEvidence = method(stageId, empty.context, empty.bindings);
        _systemStatusFingerprintAssert_(
          typeof emptyEvidence.fingerprint === "string" && emptyEvidence.fingerprint.indexOf("sha256:") === 0,
          stageId + " " + kind + " successful empty dependency was unavailable",
        );
      });
    });
  });

  _systemStatusFingerprintCheck_(report, "required adapter failure and unavailable range", function () {
    var thrown = _systemStatusFingerprintBuilderFixture_("computed.phones_result", "result");
    thrown.context.adapter.readRange = function () { throw new Error("fixture adapter failure"); };
    var failed = SystemStatusFingerprints_.buildStageResultFingerprintFromContext(
      "computed.phones_result", thrown.context, thrown.bindings,
    );
    _systemStatusFingerprintEqual_(failed.status, "unavailable");
    _systemStatusFingerprintEqual_(failed.reason, "adapter_read_failed");
    _systemStatusFingerprintEqual_(failed.fingerprint, null);

    var absent = _systemStatusFingerprintBuilderFixture_("computed.phones_result", "result");
    absent.context.adapter.readRange = function () { return { available: false, rows: [] }; };
    var unavailable = SystemStatusFingerprints_.buildStageResultFingerprintFromContext(
      "computed.phones_result", absent.context, absent.bindings,
    );
    _systemStatusFingerprintEqual_(unavailable.status, "unavailable");
    _systemStatusFingerprintEqual_(unavailable.reason, "range_unavailable");
    _systemStatusFingerprintEqual_(unavailable.fingerprint, null);
  });

  _systemStatusFingerprintCheck_(report, "monthly sync personnel lookup dependency", function () {
    var base = _systemStatusFingerprintBuilderFixture_("computed.vacation_monthly_sync", "source");
    var baseHash = SystemStatusFingerprints_.buildStageSourceFingerprintFromContext(
      "computed.vacation_monthly_sync", base.context, base.bindings,
    ).fingerprint;
    ["id", "personKey", "callsign", "fml", "lastName", "firstName", "patronymic"].forEach(function (field) {
      var changed = _systemStatusFingerprintBuilderFixture_("computed.vacation_monthly_sync", "source", {
        dependencyId: "vacationMonthlyPersonnel",
        field: field,
      });
      var changedHash = SystemStatusFingerprints_.buildStageSourceFingerprintFromContext(
        "computed.vacation_monthly_sync", changed.context, changed.bindings,
      ).fingerprint;
      _systemStatusFingerprintAssert_(baseHash !== changedHash, "PERSONNEL lookup ignored " + field);
    });
    ["status", "active", "position", "template"].forEach(function (field) {
      var ignored = _systemStatusFingerprintBuilderFixture_("computed.vacation_monthly_sync", "source", {
        dependencyId: "vacationMonthlyPersonnel",
        ignoredField: field,
      });
      var ignoredHash = SystemStatusFingerprints_.buildStageSourceFingerprintFromContext(
        "computed.vacation_monthly_sync", ignored.context, ignored.bindings,
      ).fingerprint;
      _systemStatusFingerprintEqual_(baseHash, ignoredHash, "PERSONNEL lookup included " + field);
    });
  });

  _systemStatusFingerprintCheck_(report, "personnel helpers exclude unproven fields", function () {
    var base = _systemStatusFingerprintBuilderFixture_("computed.personnel_helpers", "source");
    var baseHash = SystemStatusFingerprints_.buildStageSourceFingerprintFromContext(
      "computed.personnel_helpers", base.context, base.bindings,
    ).fingerprint;
    ["position", "status", "template"].forEach(function (field) {
      var changed = _systemStatusFingerprintBuilderFixture_("computed.personnel_helpers", "source", {
        dependencyId: "personnel",
        ignoredField: field,
      });
      var changedHash = SystemStatusFingerprints_.buildStageSourceFingerprintFromContext(
        "computed.personnel_helpers", changed.context, changed.bindings,
      ).fingerprint;
      _systemStatusFingerprintEqual_(baseHash, changedHash, "Unproven personnel field affected helper source: " + field);
    });
  });

  _systemStatusFingerprintCheck_(report, "manual PHONES result edit", function () {
    var before = { headers: ["Callsign", "Phone", "Phone 2"], rows: [["А", "+3801", ""]] };
    var after = { headers: ["Callsign", "Phone", "Phone 2"], rows: [["А", "+3802", ""]] };
    _systemStatusFingerprintAssert_(
      _systemStatusFingerprintValue_("computed.phones_result", "result", before) !==
        _systemStatusFingerprintValue_("computed.phones_result", "result", after),
      "Manual PHONES edit stayed current",
    );
  });

  _systemStatusFingerprintCheck_(report, "clock and timezone sensitivity", function () {
    var dayOne = { clockDay: "2026-07-31", timezone: "Europe/Kyiv", rows: [["01.08.1990"]] };
    var dayTwo = { clockDay: "2026-08-01", timezone: "Europe/Kyiv", rows: [["01.08.1990"]] };
    var zone = { clockDay: "2026-07-31", timezone: "UTC", rows: [["01.08.1990"]] };
    var base = _systemStatusFingerprintValue_("computed.birthday_result", "source", dayOne);
    _systemStatusFingerprintAssert_(base !== _systemStatusFingerprintValue_("computed.birthday_result", "source", dayTwo));
    _systemStatusFingerprintAssert_(base !== _systemStatusFingerprintValue_("computed.birthday_result", "source", zone));
  });

  _systemStatusFingerprintCheck_(report, "validation and notes sensitivity", function () {
    var base = {
      month: "07",
      values: [[""]],
      display: [[""]],
      validations: [["Відпустка|Лікарняний"]],
      notes: [[""]],
    };
    var validationChanged = Object.assign({}, base, { validations: [["Лікарняний"]] });
    var noteChanged = Object.assign({}, base, { notes: [["service ownership"]] });
    var hash = _systemStatusFingerprintValue_("computed.vacation_monthly_sync", "source", base);
    _systemStatusFingerprintAssert_(hash !== _systemStatusFingerprintValue_("computed.vacation_monthly_sync", "source", validationChanged));
    _systemStatusFingerprintAssert_(hash !== _systemStatusFingerprintValue_("computed.vacation_monthly_sync", "source", noteChanged));
  });

  _systemStatusFingerprintCheck_(report, "DICT order and duplicates sensitivity", function () {
    var first = { dictSum: [["A", "Alpha"], ["A", "Override"], ["B", "Beta"]] };
    var reordered = { dictSum: [["B", "Beta"], ["A", "Alpha"], ["A", "Override"]] };
    var deduped = { dictSum: [["A", "Override"], ["B", "Beta"]] };
    var base = _systemStatusFingerprintValue_("month_journal.source_projection", "source", first);
    _systemStatusFingerprintAssert_(base !== _systemStatusFingerprintValue_("month_journal.source_projection", "source", reordered));
    _systemStatusFingerprintAssert_(base !== _systemStatusFingerprintValue_("month_journal.source_projection", "source", deduped));
  });

  _systemStatusFingerprintCheck_(report, "month result headers and target slice", function () {
    var base = {
      targetMonth: "07",
      monthColumnIndex: 0,
      headers: ["Місяць", "Позивний", "A", "Інше", "Підсумок"],
      rows: [["06", "Старий", 1, "", ""], ["07", "Новий", 2, "", ""]],
    };
    var headerChanged = Object.assign({}, base, {
      headers: ["Місяць", "Позивний", "B", "Інше", "Підсумок"],
    });
    var targetChanged = Object.assign({}, base, {
      rows: [["06", "Старий", 1, "", ""], ["07", "Новий", 3, "", ""]],
    });
    var hash = SystemStatusFingerprints_.buildMonthResultFingerprint(
      "month_journal.summary_slice",
      base,
    ).fingerprint;
    _systemStatusFingerprintAssert_(
      hash !== SystemStatusFingerprints_.buildMonthResultFingerprint("month_journal.summary_slice", headerChanged).fingerprint,
      "SUMMARY header drift stayed current",
    );
    _systemStatusFingerprintAssert_(
      hash !== SystemStatusFingerprints_.buildMonthResultFingerprint("month_journal.summary_slice", targetChanged).fingerprint,
      "SUMMARY target slice drift stayed current",
    );
  });

  _systemStatusFingerprintCheck_(report, "non-target preservation", function () {
    var before = {
      targetMonth: "07",
      headers: ["Місяць", "Позивний", "Код"],
      rows: [["06", "А", "X"], ["07", "Б", "Y"]],
    };
    var targetOnly = Object.assign({}, before, {
      rows: [["06", "А", "X"], ["07", "Б", "Z"]],
    });
    var corrupted = Object.assign({}, before, {
      rows: [["06", "А", "Q"], ["07", "Б", "Z"]],
    });
    _systemStatusFingerprintAssert_(
      SystemStatusFingerprints_.simulateMonthPreservation(before, targetOnly).stable,
      "Target-only change failed preservation",
    );
    _systemStatusFingerprintAssert_(
      !SystemStatusFingerprints_.simulateMonthPreservation(before, corrupted).stable,
      "Non-target corruption was not detected",
    );

    var summaryBefore = {
      targetMonth: "07",
      headers: ["Місяць", "Позивний", "A", "Інше", "Підсумок"],
      rows: [["06", "А", 2, "", "06 A"]],
    };
    var summaryAfter = {
      targetMonth: "07",
      headers: ["Місяць", "Позивний", "A", "B", "Інше", "Підсумок"],
      rows: [["06", "А", 2, "", "", "06 A"]],
    };
    var remapped = SystemStatusFingerprints_.simulateMonthPreservation(
      summaryBefore,
      summaryAfter,
      { remapByHeaderName: true },
    );
    _systemStatusFingerprintAssert_(remapped.stable, "SUMMARY header growth lost non-target values");
    _systemStatusFingerprintAssert_(remapped.headersChanged, "SUMMARY header growth was not reported");

    var duplicateBefore = {
      targetMonth: "07",
      headers: ["Місяць", "Позивний", "A", "A", "Підсумок"],
      rows: [["06", "А", 1, 2, 3]],
    };
    var firstLost = Object.assign({}, duplicateBefore, {
      rows: [["06", "А", "", 2, 3]],
    });
    var secondLost = Object.assign({}, duplicateBefore, {
      rows: [["06", "А", 1, "", 3]],
    });
    var duplicateSwapped = Object.assign({}, duplicateBefore, {
      rows: [["06", "А", 2, 1, 3]],
    });
    [firstLost, secondLost, duplicateSwapped].forEach(function (after) {
      _systemStatusFingerprintAssert_(
        !SystemStatusFingerprints_.simulateMonthPreservation(
          duplicateBefore,
          after,
          { remapByHeaderName: true },
        ).stable,
        "Duplicate SUMMARY header concealed loss or reordering",
      );
    });
  });

  _systemStatusFingerprintCheck_(report, "read-mode-aware execution cache", function () {
    var calls = 0;
    var context = SystemStatusFingerprints_.createExecutionContext({
      spreadsheetId: "book-1",
      adapter: {
        readRange: function (request) {
          calls++;
          return [[request.readMode, "value"]];
        },
      },
      injected: { activeMonth: "07" },
    });
    var request = {
      sheet: "PERSONNEL",
      range: "A1:B2",
      readMode: "values",
      projectionVersion: "v1",
    };
    SystemStatusFingerprints_.readRange(context, request);
    SystemStatusFingerprints_.readRange(context, request);
    SystemStatusFingerprints_.readRange(
      context,
      Object.assign({}, request, { readMode: "display" }),
    );
    SystemStatusFingerprints_.readRange(
      context,
      Object.assign({}, request, { range: "A1:B3" }),
    );
    SystemStatusFingerprints_.readRange(
      context,
      Object.assign({}, request, { projectionVersion: "v2" }),
    );
    context.spreadsheetId = "book-2";
    SystemStatusFingerprints_.readRange(context, request);
    context.spreadsheetId = "book-1";
    _systemStatusFingerprintEqual_(calls, 5, "Cache key collapsed spreadsheet/range/read-mode/projection-version");
    _systemStatusFingerprintEqual_(context.counters.rangeReads, 5);
    _systemStatusFingerprintEqual_(context.counters.cacheHits, 1);
    _systemStatusFingerprintEqual_(
      SystemStatusFingerprints_.readInjected(context, "activeMonth"),
      "07",
    );

    var isolated = SystemStatusFingerprints_.readRange(context, request);
    isolated[0][1] = "mutated";
    var reread = SystemStatusFingerprints_.readRange(context, request);
    _systemStatusFingerprintEqual_(reread[0][1], "value", "Cache returned a mutable alias");
  });

  _systemStatusFingerprintCheck_(report, "numeric cost bounds", function () {
    var context = SystemStatusFingerprints_.createExecutionContext({
      adapter: { readRange: function () { return [[1, 2], [3, 4]]; } },
      maxCellsRead: 3,
    });
    var threw = false;
    try {
      SystemStatusFingerprints_.readRange(context, {
        sheet: "X",
        range: "A1:B2",
        readMode: "values",
        projectionVersion: "v1",
      });
    } catch (_) {
      threw = true;
    }
    _systemStatusFingerprintAssert_(threw, "Cell budget was not enforced");

    var callBound = SystemStatusFingerprints_.createExecutionContext({
      adapter: { readRange: function () { return [[1]]; } },
      maxSpreadsheetCalls: 1,
    });
    SystemStatusFingerprints_.readRange(callBound, { sheet: "X", range: "A1", readMode: "values", projectionVersion: "v1" });
    threw = false;
    try {
      SystemStatusFingerprints_.readRange(callBound, { sheet: "X", range: "A2", readMode: "values", projectionVersion: "v1" });
    } catch (_) { threw = true; }
    _systemStatusFingerprintAssert_(threw, "Spreadsheet-call budget was not enforced");

    var rangeBound = SystemStatusFingerprints_.createExecutionContext({
      adapter: { readRange: function () { return [[1]]; } },
      maxRangeReads: 1,
      maxSpreadsheetCalls: 5,
    });
    SystemStatusFingerprints_.readRange(rangeBound, { sheet: "X", range: "A1", readMode: "values", projectionVersion: "v1" });
    threw = false;
    try {
      SystemStatusFingerprints_.readRange(rangeBound, { sheet: "X", range: "A2", readMode: "values", projectionVersion: "v1" });
    } catch (_) { threw = true; }
    _systemStatusFingerprintAssert_(threw, "Range-read budget was not enforced");

    var byteBound = SystemStatusFingerprints_.createExecutionContext({
      adapter: { readRange: function () { return [["a long value"]]; } },
      maxBytesRead: 4,
    });
    threw = false;
    try {
      SystemStatusFingerprints_.readRange(byteBound, { sheet: "X", range: "A1", readMode: "values", projectionVersion: "v1" });
    } catch (_) { threw = true; }
    _systemStatusFingerprintAssert_(threw, "Read-byte budget was not enforced");

    threw = false;
    try {
      SystemStatusFingerprints_.digestCanonical({ large: new Array(300).join("x") }, { maxProjectionBytes: 64 });
    } catch (_) { threw = true; }
    _systemStatusFingerprintAssert_(threw, "Projection-byte budget was not enforced");

    var projectionBound = _systemStatusFingerprintBuilderFixture_("computed.phones_result", "source");
    projectionBound.context.limits.maxProjectionBytesTotal = 1;
    var operationBoundResult = SystemStatusFingerprints_.buildStageSourceFingerprintFromContext(
      "computed.phones_result",
      projectionBound.context,
      projectionBound.bindings,
    );
    _systemStatusFingerprintEqual_(operationBoundResult.fingerprint, null);
    _systemStatusFingerprintEqual_(operationBoundResult.reason, "operation_budget_projectionBytes");

    var stageBound = _systemStatusFingerprintBuilderFixture_("computed.phones_result", "source");
    var stageBoundResult = SystemStatusFingerprints_.buildStageSourceFingerprintFromContext(
      "computed.phones_result",
      stageBound.context,
      stageBound.bindings,
      { stageLimits: { maxProjectionBytes: 1 } },
    );
    _systemStatusFingerprintEqual_(stageBoundResult.fingerprint, null);
    _systemStatusFingerprintEqual_(stageBoundResult.reason, "budget_exceeded");
  });

  _systemStatusFingerprintCheck_(report, "automatic executable stage cost bounds", function () {
    function phoneResult_(bindingPatch, adapter) {
      var fixture = _systemStatusFingerprintBuilderFixture_("computed.phones_result", "result");
      fixture.bindings.phones = Object.assign({}, fixture.bindings.phones, bindingPatch || {});
      if (adapter) fixture.context.adapter.readRange = adapter;
      return SystemStatusFingerprints_.buildStageResultFingerprintFromContext(
        "computed.phones_result", fixture.context, fixture.bindings,
      );
    }

    var spreadsheet = phoneResult_({ spreadsheetCalls: 4 });
    _systemStatusFingerprintEqual_(spreadsheet.fingerprint, null);
    _systemStatusFingerprintEqual_(spreadsheet.reason, "stage_budget_spreadsheetCalls");

    var ranges = phoneResult_({ rangeReads: 3 });
    _systemStatusFingerprintEqual_(ranges.fingerprint, null);
    _systemStatusFingerprintEqual_(ranges.reason, "stage_budget_rangeReads");

    var cells = phoneResult_({}, function () {
      var rows = [];
      for (var i = 0; i < 34; i++) rows.push({ callsign: "A" + i, phone: "1", phone2: "2" });
      return rows;
    });
    _systemStatusFingerprintEqual_(cells.fingerprint, null);
    _systemStatusFingerprintEqual_(cells.reason, "stage_budget_cellsRead");

    var readBytes = phoneResult_({}, function () {
      return [{ callsign: "A", phone: "1", phone2: "2", ignoredNoise: new Array(25000).join("x") }];
    });
    _systemStatusFingerprintEqual_(readBytes.fingerprint, null);
    _systemStatusFingerprintEqual_(readBytes.reason, "stage_budget_bytesRead");

    var projection = _systemStatusFingerprintBuilderFixture_("computed.operation_summary", "source");
    projection.context.injected.computedStageEvidence = [{
      stageId: new Array(18000).join("x"),
      scopeKnown: true,
      attempted: true,
      resultPresent: true,
      status: "success",
    }];
    var projectionResult = SystemStatusFingerprints_.buildStageSourceFingerprintFromContext(
      "computed.operation_summary", projection.context, projection.bindings,
    );
    _systemStatusFingerprintEqual_(projectionResult.fingerprint, null);
    _systemStatusFingerprintEqual_(projectionResult.reason, "budget_exceeded");

    var cannotLoosen = _systemStatusFingerprintBuilderFixture_("computed.phones_result", "result");
    cannotLoosen.bindings.phones.spreadsheetCalls = 4;
    var loosened = SystemStatusFingerprints_.buildStageResultFingerprintFromContext(
      "computed.phones_result", cannotLoosen.context, cannotLoosen.bindings,
      { stageLimits: { maxSpreadsheetCalls: 999999, maxRangeReads: 999999, maxCells: 999999, maxBytes: 999999 } },
    );
    _systemStatusFingerprintEqual_(loosened.fingerprint, null);
    _systemStatusFingerprintEqual_(loosened.reason, "stage_budget_spreadsheetCalls");
  });

  _systemStatusFingerprintCheck_(report, "pre-post stability and stale cache", function () {
    _systemStatusFingerprintAssert_(
      SystemStatusFingerprints_.simulateSourceStability({
        preFingerprint: "same",
        postFingerprint: "same",
        preReadOrigin: "live",
        postReadOrigin: "live",
        preRequiredAvailable: true,
        postRequiredAvailable: true,
      }).stable,
    );
    _systemStatusFingerprintEqual_(
      SystemStatusFingerprints_.simulateSourceStability({
        preFingerprint: "same",
        postFingerprint: "same",
        preReadOrigin: "cross_execution_cache",
        postReadOrigin: "live",
        preRequiredAvailable: true,
        postRequiredAvailable: true,
      }).reason,
      "non_live_read",
    );
    _systemStatusFingerprintEqual_(
      SystemStatusFingerprints_.simulateSourceStability({
        preFingerprint: "before",
        postFingerprint: "after",
        preReadOrigin: "live",
        postReadOrigin: "live",
        preRequiredAvailable: true,
        postRequiredAvailable: true,
      }).reason,
      "source_changed",
    );
    _systemStatusFingerprintEqual_(
      SystemStatusFingerprints_.simulateSourceStability({
        preFingerprint: "same",
        postFingerprint: "same",
        preReadOrigin: "live",
        postReadOrigin: "live",
        preRequiredAvailable: true,
        postRequiredAvailable: false,
      }).reason,
      "required_dependency_unavailable",
    );
  });

  _systemStatusFingerprintCheck_(report, "cache invalidation simulation", function () {
    var invalidated = SystemStatusFingerprints_.simulateCacheInvalidation(
      [
        { cacheKey: "personnel-values", spreadsheetId: "book", sheet: "PERSONNEL", projectionId: "personnel" },
        { cacheKey: "dict-display", spreadsheetId: "book", sheet: "DICT", projectionId: "dict" },
      ],
      [{ spreadsheetId: "book", sheet: "PERSONNEL", affectedProjectionIds: ["personnel"] }],
    );
    _systemStatusFingerprintEqual_(invalidated.join(","), "personnel-values");
    var global = SystemStatusFingerprints_.simulateCacheInvalidation(
      [
        { cacheKey: "summary-values", spreadsheetId: "book", sheet: "SUMMARY", projectionId: "target" },
        { cacheKey: "summary-display", spreadsheetId: "book", sheet: "SUMMARY", projectionId: "non-target" },
      ],
      [{ spreadsheetId: "book", sheet: "SUMMARY", globalRewrite: true }],
    );
    _systemStatusFingerprintEqual_(global.join(","), "summary-display,summary-values");
    _systemStatusFingerprintAssert_(
      !SystemStatusFingerprints_.simulatePostWriteReread({
        requiredCacheKeys: global,
        invalidatedCacheKeys: global,
        postReadOrigin: "cache",
        insideCriticalSection: true,
      }).eligibleForCommit,
      "Cached post-write read was accepted",
    );
    _systemStatusFingerprintAssert_(
      SystemStatusFingerprints_.simulatePostWriteReread({
        requiredCacheKeys: global,
        invalidatedCacheKeys: global,
        postReadOrigin: "live",
        insideCriticalSection: true,
      }).eligibleForCommit,
      "Live invalidated post-write read was rejected",
    );
  });

  _systemStatusFingerprintCheck_(report, "required optional skipped policy", function () {
    _systemStatusFingerprintEqual_(
      SystemStatusFingerprints_.evaluateStage(
        "computed.vacation_computed",
        _systemStatusFingerprintEvidence_(
          "computed.vacation_computed",
          null,
          { vacationSourceMode: "requests" },
          { attempted: false, resultPresent: false, skipPredicateSatisfied: true },
        ),
      ).status,
      "skipped",
    );
    _systemStatusFingerprintEqual_(
      SystemStatusFingerprints_.evaluateStage(
        "computed.assignment_car",
        _systemStatusFingerprintEvidence_(
          "computed.assignment_car",
          { ok: false },
          { targetExists: true, targetRowCount: 2 },
        ),
      ).status,
      "failed",
    );
    _systemStatusFingerprintEqual_(
      SystemStatusFingerprints_.evaluateStage(
        "computed.assignment_car",
        _systemStatusFingerprintEvidence_(
          "computed.assignment_car",
          null,
          { targetExists: false, targetRowCount: 0 },
          { attempted: false, resultPresent: false, skipPredicateSatisfied: true },
        ),
      ).status,
      "skipped",
    );
    _systemStatusFingerprintEqual_(
      SystemStatusFingerprints_.evaluateStage("computed.assignment_car", {
        scopeKnown: false,
        attempted: false,
        resultPresent: false,
        skipPredicateSatisfied: true,
        scope: { targetExists: false, targetRowCount: 0 },
      }).status,
      "unknown",
      "Unknown scope was treated as proven skip",
    );
  });

  _systemStatusFingerprintCheck_(report, "every eligible stage failure", function () {
    var nonSkippingScope = {
      targetMonthCount: 1,
      targetExists: true,
      targetRowCount: 1,
      vacationSourceMode: "legacy",
      moduleAvailable: true,
      targetMonth: "07",
    };
    Object.keys(SystemStatusFingerprints_.stagePolicy).forEach(function (stageId) {
      var evaluated = SystemStatusFingerprints_.evaluateStage(
        stageId,
        _systemStatusFingerprintEvidence_(stageId, { ok: false }, nonSkippingScope),
      );
      _systemStatusFingerprintEqual_(evaluated.status, "failed", stageId + " failure policy");
    });
  });

  _systemStatusFingerprintCheck_(report, "every declared skip branch", function () {
    var cases = {
      "computed.monthly_callsigns": { targetMonthCount: 0 },
      "computed.assignment_car": { targetExists: false, targetRowCount: 0 },
      "computed.assignment_weapon": { targetExists: true, targetRowCount: 0 },
      "computed.vacation_computed": { vacationSourceMode: "requests" },
      "computed.vacation_schedule": { moduleAvailable: false },
      "computed.vacation_monthly_sync": { targetMonth: "" },
      "computed.send_panel_status": { targetExists: false },
    };
    Object.keys(cases).forEach(function (stageId) {
      _systemStatusFingerprintEqual_(
        SystemStatusFingerprints_.evaluateStage(
          stageId,
          _systemStatusFingerprintEvidence_(stageId, null, cases[stageId], {
            attempted: false,
            resultPresent: false,
            skipPredicateSatisfied: true,
          }),
        ).status,
        "skipped",
        stageId + " skip policy",
      );
    });
  });

  _systemStatusFingerprintCheck_(report, "operation full partial failed", function () {
    function computedInputs_(failedStage) {
      var inputs = {};
      Object.keys(SystemStatusFingerprints_.stagePolicy)
        .filter(function (stageId) { return stageId.indexOf("computed.") === 0; })
        .forEach(function (stageId) {
          inputs[stageId] = {
            scopeKnown: true,
            attempted: true,
            resultPresent: true,
            result: stageId === failedStage
              ? { ok: false }
              : _systemStatusFingerprintSuccessfulResult_(stageId),
            scope: {
              targetMonthCount: 1,
              targetExists: true,
              targetRowCount: 1,
              vacationSourceMode: "legacy",
              moduleAvailable: true,
              targetMonth: "07",
            },
          };
        });
      return inputs;
    }
    _systemStatusFingerprintEqual_(
      SystemStatusFingerprints_.evaluateOperation("computed", computedInputs_("")).status,
      "full",
    );
    _systemStatusFingerprintEqual_(
      SystemStatusFingerprints_.evaluateOperation(
        "computed",
        computedInputs_("computed.phones_result"),
      ).status,
      "partial",
    );
    [
      {},
      { "computed.personnel_helpers": { scopeKnown: true } },
      { "computed.personnel_helpers": "malformed" },
    ].forEach(function (input) {
      var evaluated = SystemStatusFingerprints_.evaluateOperation("computed", input);
      _systemStatusFingerprintAssert_(!evaluated.isFullSuccess, "Incomplete evidence returned full success");
      _systemStatusFingerprintAssert_(evaluated.status !== "full", "Malformed evidence returned full");
    });
    _systemStatusFingerprintAssert_(
      !SystemStatusFingerprints_.evaluateOperation("month_journal", {}).isFullSuccess,
      "Empty month-journal evidence returned full success",
    );
  });

  _systemStatusFingerprintCheck_(report, "monthly sync stage success requires structured transition evidence", function () {
    var stageId = "computed.vacation_monthly_sync";
    ["metadata", "pendingPlan", "conflicts"].forEach(function (field) {
      var result = _systemStatusFingerprintSuccessfulResult_(stageId);
      delete result.transitionEvidence.transition[field];
      _systemStatusFingerprintEqual_(
        SystemStatusFingerprints_.evaluateStage(
          stageId,
          _systemStatusFingerprintEvidence_(stageId, result, { targetMonth: "07" }),
        ).status,
        "failed",
        field + " proof was not fail-closed",
      );
    });
    _systemStatusFingerprintEqual_(
      SystemStatusFingerprints_.evaluateStage(
        stageId,
        _systemStatusFingerprintEvidence_(stageId, {
          ok: true,
          metadataConfirmed: true,
          pendingPlanConfirmed: true,
        }, { targetMonth: "07" }),
      ).status,
      "failed",
      "Naked booleans were accepted",
    );
  });

  _systemStatusFingerprintCheck_(report, "version mismatch hands off unknown", function () {
    var stageId = "computed.phones_result";
    var versions = SystemStatusFingerprints_.compatibilityVersions;
    var currentEvidence = {
      receiptVersion: versions.receiptVersion,
      manifestVersion: versions.manifestVersion,
      signatureVersion: versions.signatureVersion,
      algorithmVersion: versions.algorithmVersion,
      stageVersion: SystemStatusFingerprints_.stageVersions[stageId],
    };
    var comparable = SystemStatusFingerprints_.evaluateVersionCompatibility(stageId, currentEvidence);
    _systemStatusFingerprintAssert_(comparable.compatible, "Current versions were rejected");
    _systemStatusFingerprintEqual_(comparable.freshness, "comparable");
    _systemStatusFingerprintAssert_(comparable.freshness !== "current");

    ["receiptVersion", "manifestVersion", "signatureVersion", "algorithmVersion", "stageVersion"].forEach(function (field) {
      var oldEvidence = Object.assign({}, currentEvidence);
      oldEvidence[field] = "v1";
      var mismatch = SystemStatusFingerprints_.evaluateVersionCompatibility(stageId, oldEvidence);
      _systemStatusFingerprintAssert_(!mismatch.compatible, field + " mismatch was accepted");
      _systemStatusFingerprintEqual_(mismatch.freshness, "unknown", field);
      _systemStatusFingerprintAssert_(mismatch.mismatchedFields.indexOf(field) !== -1, field + " mismatch not reported");
      _systemStatusFingerprintAssert_(!mismatch.readTimeMigrationAllowed, field + " permitted migration");
      _systemStatusFingerprintAssert_(!mismatch.mutationAllowed, field + " permitted mutation");
    });
  });

  function stableImmutable_() {
    return {
      preFingerprint: "immutable-v1",
      postFingerprint: "immutable-v1",
      preReadOrigin: "live",
      postReadOrigin: "live",
      preRequiredAvailable: true,
      postRequiredAvailable: true,
    };
  }

  function matchingResult_() {
    return { available: true, fingerprint: "result-v1", expectedFingerprint: "result-v1" };
  }

  function proofDigest_(character) {
    return "sha256:" + String(character || "a").repeat(64).slice(0, 64);
  }

  function structuredProof_(binding, prior, expected, post) {
    return Object.assign({}, binding, {
      priorFingerprint: proofDigest_(prior || "a"),
      expectedFingerprint: proofDigest_(expected || "b"),
      postFingerprint: proofDigest_(post || expected || "b"),
    });
  }

  _systemStatusFingerprintCheck_(report, "dependency evidence roles are isolated", function () {
    var car = SystemStatusFingerprints_.executableManifest["computed.assignment_car"];
    _systemStatusFingerprintEqual_(car.source[0].evidenceRole, "immutable_input");
    _systemStatusFingerprintEqual_(car.source[1].evidenceRole, "mutable_target_prior_state");
    _systemStatusFingerprintEqual_(car.source[2].evidenceRole, "preservation_baseline");
    _systemStatusFingerprintEqual_(car.result[0].evidenceRole, "result");
    var fixture = _systemStatusFingerprintBuilderFixture_("computed.assignment_car", "source");
    var immutable = SystemStatusFingerprints_.buildStageProjection(
      "computed.assignment_car", "source", fixture.context, fixture.bindings, "immutable_input",
    );
    _systemStatusFingerprintEqual_(immutable.dependencies.length, 1);
    _systemStatusFingerprintEqual_(immutable.dependencies[0].dependencyId, "carPersonnel");
  });

  _systemStatusFingerprintCheck_(report, "CAR and WEAPON transitions are exact", function () {
    var car = {
      immutable: stableImmutable_(),
      transition: {
        available: true,
        priorRows: [{ rowKey: "1", ownerFml: "old", helperCallsign: "old", columnsBtoG: [1, 2] }],
        expectedRows: [{ rowKey: "1", ownerFml: "new", helperCallsign: "new", columnsBtoG: [1, 2] }],
        postRows: [{ rowKey: "1", ownerFml: "new", helperCallsign: "new", columnsBtoG: [1, 2] }],
      },
      result: matchingResult_(),
    };
    _systemStatusFingerprintAssert_(SystemStatusFingerprints_.evaluateTransitionEvidence("computed.assignment_car", car).eligibleForReceipt);
    car.transition.postRows[0].columnsBtoG = [9];
    _systemStatusFingerprintEqual_(SystemStatusFingerprints_.evaluateTransitionEvidence("computed.assignment_car", car).status, "failed");
    car.transition.postRows[0].columnsBtoG = [1, 2];
    car.transition.postRows[0].ownerFml = "unexpected";
    _systemStatusFingerprintEqual_(SystemStatusFingerprints_.evaluateTransitionEvidence("computed.assignment_car", car).status, "failed");
    car.transition.postRows[0].ownerFml = "new";
    ["", "1"].forEach(function (key, index) {
      var original = car.transition.postRows[0].rowKey;
      car.transition.postRows[0].rowKey = key;
      if (index === 1) car.transition.postRows.push(Object.assign({}, car.transition.postRows[0]));
      _systemStatusFingerprintEqual_(SystemStatusFingerprints_.evaluateTransitionEvidence("computed.assignment_car", car).status, "failed");
      car.transition.postRows = [car.transition.postRows[0]];
      car.transition.postRows[0].rowKey = original;
    });
    car.transition.expectedRows.push({ rowKey: "2", ownerFml: "", helperCallsign: "", columnsBtoG: [] });
    _systemStatusFingerprintEqual_(SystemStatusFingerprints_.evaluateTransitionEvidence("computed.assignment_car", car).status, "failed");
    car.transition.expectedRows.pop();
    car.transition.priorRows.push({ rowKey: "2", ownerFml: "", helperCallsign: "", columnsBtoG: [] });
    _systemStatusFingerprintEqual_(SystemStatusFingerprints_.evaluateTransitionEvidence("computed.assignment_car", car).status, "failed");
    car.transition.priorRows.pop();
    car.transition.priorRows.push({ rowKey: "2" });
    car.transition.expectedRows.push({ rowKey: "2" });
    car.transition.postRows.unshift({ rowKey: "2" });
    _systemStatusFingerprintEqual_(SystemStatusFingerprints_.evaluateTransitionEvidence("computed.assignment_car", car).status, "failed");

    var weapon = {
      immutable: stableImmutable_(),
      transition: {
        available: true,
        priorRows: [{ rowKey: "1", lastName: "old", firstName: "", patronymic: "", rank: "", phone: "", callsign: "", columnsFtoZ: ["keep"] }],
        expectedRows: [{ rowKey: "1", lastName: "new", firstName: "N", patronymic: "P", rank: "R", phone: "1", callsign: "C", columnsFtoZ: ["keep"] }],
        postRows: [{ rowKey: "1", lastName: "new", firstName: "N", patronymic: "P", rank: "R", phone: "1", callsign: "C", columnsFtoZ: ["keep"] }],
      },
      result: matchingResult_(),
    };
    _systemStatusFingerprintAssert_(SystemStatusFingerprints_.evaluateTransitionEvidence("computed.assignment_weapon", weapon).eligibleForReceipt);
    weapon.transition.postRows[0].columnsFtoZ = ["changed"];
    _systemStatusFingerprintEqual_(SystemStatusFingerprints_.evaluateTransitionEvidence("computed.assignment_weapon", weapon).status, "failed");
    weapon.transition.postRows[0].columnsFtoZ = ["keep"];
    weapon.transition.postRows[0].rowKey = "";
    _systemStatusFingerprintEqual_(SystemStatusFingerprints_.evaluateTransitionEvidence("computed.assignment_weapon", weapon).status, "failed");
    weapon.transition.postRows[0].rowKey = "1";
    weapon.transition.postRows.push(Object.assign({}, weapon.transition.postRows[0]));
    _systemStatusFingerprintEqual_(SystemStatusFingerprints_.evaluateTransitionEvidence("computed.assignment_weapon", weapon).status, "failed");
    weapon.transition.postRows.pop();
    weapon.transition.expectedRows.push({ rowKey: "2" });
    _systemStatusFingerprintEqual_(SystemStatusFingerprints_.evaluateTransitionEvidence("computed.assignment_weapon", weapon).status, "failed");
    weapon.transition.expectedRows.pop();
    weapon.transition.priorRows.push({ rowKey: "2" });
    weapon.transition.expectedRows.push({ rowKey: "2" });
    weapon.transition.postRows.unshift({ rowKey: "2" });
    _systemStatusFingerprintEqual_(SystemStatusFingerprints_.evaluateTransitionEvidence("computed.assignment_weapon", weapon).status, "failed");
  });

  _systemStatusFingerprintCheck_(report, "Birthday normalization is a keyed semantic transition", function () {
    var semantic = SystemStatusFingerprints_.normalizeBirthdaySemantic;
    _systemStatusFingerprintEqual_(semantic(new Date(1990, 1, 3)), "1990-02-03");
    _systemStatusFingerprintEqual_(semantic("1990-02-03"), "1990-02-03");
    _systemStatusFingerprintEqual_(semantic("03.02.1990"), "1990-02-03");
    _systemStatusFingerprintEqual_(semantic("03.02.1990 р. н."), "1990-02-03");
    var evidence = {
      immutable: stableImmutable_(),
      transition: {
        available: true,
        priorRows: [{ rowKey: "personnel:2", birthdaySemantic: semantic(new Date(1990, 1, 3)) }],
        expectedRows: [{ rowKey: "personnel:2", birthdaySemantic: semantic("03.02.1990") }],
        postRows: [{ rowKey: "personnel:2", birthdaySemantic: semantic("03.02.1990") }],
      },
      result: matchingResult_(),
    };
    _systemStatusFingerprintAssert_(SystemStatusFingerprints_.evaluateTransitionEvidence("computed.personnel_helpers", evidence).eligibleForReceipt);
    evidence.transition.expectedRows[0].birthdaySemantic = semantic("04.02.1990");
    evidence.transition.postRows[0].birthdaySemantic = semantic("04.02.1990 р. н.");
    var coordinated = SystemStatusFingerprints_.evaluateTransitionEvidence("computed.personnel_helpers", evidence);
    _systemStatusFingerprintEqual_(coordinated.status, "failed");
    _systemStatusFingerprintAssert_(coordinated.reasonCodes.indexOf("birthday_semantic_changed") !== -1);
    evidence.transition.expectedRows[0].birthdaySemantic = semantic("03.02.1990");
    evidence.transition.postRows[0].birthdaySemantic = semantic("03.02.1990 р. н.");
    evidence.transition.postRows[0].birthdaySemantic = semantic("04.02.1990");
    _systemStatusFingerprintEqual_(SystemStatusFingerprints_.evaluateTransitionEvidence("computed.personnel_helpers", evidence).status, "failed");
    evidence.transition.postRows[0].birthdaySemantic = "";
    _systemStatusFingerprintEqual_(SystemStatusFingerprints_.evaluateTransitionEvidence("computed.personnel_helpers", evidence).status, "failed");
    evidence.transition.postRows[0] = { rowKey: "", birthdaySemantic: semantic("03.02.1990") };
    _systemStatusFingerprintEqual_(SystemStatusFingerprints_.evaluateTransitionEvidence("computed.personnel_helpers", evidence).status, "failed");
    evidence.transition.postRows = [{ rowKey: "personnel:2", birthdaySemantic: semantic("03.02.1990") }];
    evidence.immutable.postFingerprint = "other-input-changed";
    _systemStatusFingerprintEqual_(SystemStatusFingerprints_.evaluateTransitionEvidence("computed.personnel_helpers", evidence).status, "failed");
  });

  _systemStatusFingerprintCheck_(report, "vacation monthly transition is atomic", function () {
    var binding = {
      stageId: "computed.vacation_monthly_sync",
      target: "07",
      scopeFingerprint: proofDigest_("c"),
      runId: "run-07-1",
    };
    var transition = {
      available: true,
      priorRows: [{ cellKey: "07:R2:C3", cellValue: "", cellDisplay: "", validationAllowed: ["В"], note: "", dateRaw: 1, dateDisplay: "01.07", callsign: "A", fml: "B" }],
      expectedRows: [{ cellKey: "07:R2:C3", cellValue: "В", cellDisplay: "В", validationAllowed: ["В"], note: "", dateRaw: 1, dateDisplay: "01.07", callsign: "A", fml: "B" }],
      postRows: [{ cellKey: "07:R2:C3", cellValue: "В", cellDisplay: "В", validationAllowed: ["В"], note: "", dateRaw: 1, dateDisplay: "01.07", callsign: "A", fml: "B" }],
      binding: binding,
      targetCells: structuredProof_(binding, "a", "b"),
      metadata: structuredProof_(binding, "c", "d"),
      pendingPlan: structuredProof_(binding, "e", "f"),
      conflicts: structuredProof_(binding, "a", "b"),
    };
    var targetDigest = SystemStatusFingerprints_.digestCanonical(transition.expectedRows).digest;
    transition.targetCells = Object.assign({}, binding, {
      priorFingerprint: SystemStatusFingerprints_.digestCanonical(transition.priorRows).digest,
      expectedFingerprint: targetDigest,
      postFingerprint: SystemStatusFingerprints_.digestCanonical(transition.postRows).digest,
    });
    var evidence = { expectedBinding: binding, immutable: stableImmutable_(), transition: transition, result: matchingResult_() };
    _systemStatusFingerprintAssert_(SystemStatusFingerprints_.evaluateTransitionEvidence("computed.vacation_monthly_sync", evidence).eligibleForReceipt);
    ["targetCells", "metadata", "pendingPlan", "conflicts"].forEach(function (field) {
      var original = transition[field];
      delete transition[field];
      _systemStatusFingerprintEqual_(SystemStatusFingerprints_.evaluateTransitionEvidence("computed.vacation_monthly_sync", evidence).status, "unknown", field);
      transition[field] = original;
    });
    transition.postRows[0].note = "unexpected";
    _systemStatusFingerprintEqual_(SystemStatusFingerprints_.evaluateTransitionEvidence("computed.vacation_monthly_sync", evidence).status, "failed");
    transition.postRows[0].note = "";
    transition.metadata.runId = "wrong-run";
    _systemStatusFingerprintEqual_(SystemStatusFingerprints_.evaluateTransitionEvidence("computed.vacation_monthly_sync", evidence).status, "failed");
    transition.metadata.runId = binding.runId;
    transition.pendingPlan.target = "08";
    _systemStatusFingerprintEqual_(SystemStatusFingerprints_.evaluateTransitionEvidence("computed.vacation_monthly_sync", evidence).status, "failed");
    transition.pendingPlan.target = binding.target;
    transition.conflicts.postFingerprint = proofDigest_("f");
    _systemStatusFingerprintEqual_(SystemStatusFingerprints_.evaluateTransitionEvidence("computed.vacation_monthly_sync", evidence).status, "failed");
    transition.conflicts.postFingerprint = transition.conflicts.expectedFingerprint;
    transition.metadata.postFingerprint = "corrupt";
    _systemStatusFingerprintEqual_(SystemStatusFingerprints_.evaluateTransitionEvidence("computed.vacation_monthly_sync", evidence).status, "unknown");
    transition.metadata = structuredProof_(binding, "c", "d");
    transition.postRows[0].cellKey = "";
    _systemStatusFingerprintEqual_(SystemStatusFingerprints_.evaluateTransitionEvidence("computed.vacation_monthly_sync", evidence).status, "failed");
    transition.postRows[0].cellKey = "07:R2:C3";
    transition.postRows.push(Object.assign({}, transition.postRows[0]));
    _systemStatusFingerprintEqual_(SystemStatusFingerprints_.evaluateTransitionEvidence("computed.vacation_monthly_sync", evidence).status, "failed");
    transition.postRows.pop();
    transition.expectedRows.push({ cellKey: "extra" });
    _systemStatusFingerprintEqual_(SystemStatusFingerprints_.evaluateTransitionEvidence("computed.vacation_monthly_sync", evidence).status, "failed");
    transition.expectedRows.pop();
    transition.priorRows.push({ cellKey: "other" });
    transition.expectedRows.push({ cellKey: "other" });
    transition.postRows.unshift({ cellKey: "other" });
    _systemStatusFingerprintEqual_(SystemStatusFingerprints_.evaluateTransitionEvidence("computed.vacation_monthly_sync", evidence).status, "failed");
  });

  _systemStatusFingerprintCheck_(report, "structured proof states distinguish unknown from failed", function () {
    var stageId = "computed.vacation_monthly_sync";
    [
      { name: "missing binding", expected: "unknown", mutate: function (value) { delete value.transition.binding; } },
      { name: "missing binding field", expected: "unknown", mutate: function (value) { delete value.transition.binding.runId; } },
      { name: "malformed binding digest", expected: "unknown", mutate: function (value) { value.transition.binding.scopeFingerprint = "corrupt"; } },
      { name: "wrong binding stage", expected: "failed", mutate: function (value) { value.transition.binding.stageId = "computed.assignment_car"; } },
      { name: "wrong binding target", expected: "failed", mutate: function (value) { value.transition.binding.target = "08"; } },
      { name: "wrong binding scope", expected: "failed", mutate: function (value) { value.transition.binding.scopeFingerprint = proofDigest_("f"); } },
      { name: "wrong binding run", expected: "failed", mutate: function (value) { value.transition.binding.runId = "other-run"; } },
      { name: "missing proof", expected: "unknown", mutate: function (value) { delete value.transition.metadata; } },
      { name: "missing proof field", expected: "unknown", mutate: function (value) { delete value.transition.metadata.runId; } },
      { name: "malformed proof digest", expected: "unknown", mutate: function (value) { value.transition.metadata.postFingerprint = "bad"; } },
      { name: "wrong proof stage", expected: "failed", mutate: function (value) { value.transition.metadata.stageId = "computed.assignment_car"; } },
      { name: "wrong proof target", expected: "failed", mutate: function (value) { value.transition.metadata.target = "08"; } },
      { name: "wrong proof scope", expected: "failed", mutate: function (value) { value.transition.metadata.scopeFingerprint = proofDigest_("f"); } },
      { name: "wrong proof run", expected: "failed", mutate: function (value) { value.transition.metadata.runId = "other-run"; } },
      { name: "well-formed proof mismatch", expected: "failed", mutate: function (value) { value.transition.metadata.postFingerprint = proofDigest_("f"); } },
    ].forEach(function (testCase) {
      var value = _systemStatusMonthlyStructuredEvidence_();
      testCase.mutate(value);
      var decision = SystemStatusFingerprints_.evaluateTransitionEvidence(stageId, value);
      _systemStatusFingerprintEqual_(decision.status, testCase.expected, testCase.name);
    });
  });

  function identityMatrixFixture_(stageId) {
    var policy = SystemStatusFingerprints_.transitionPolicies[stageId];
    var keyField = policy.rowKeyField;
    var row = function (key) {
      var value = {};
      value[keyField] = key;
      policy.writableFields.forEach(function (field) { value[field] = "value-" + key; });
      policy.preservedFields.forEach(function (field) {
        if (field !== keyField) value[field] = ["keep-" + key];
      });
      return value;
    };
    return {
      immutable: stableImmutable_(),
      transition: {
        available: true,
        priorRows: [row("k1"), row("k2")],
        expectedRows: [row("k1"), row("k2")],
        postRows: [row("k1"), row("k2")],
      },
      result: matchingResult_(),
    };
  }

  [
    "computed.assignment_car",
    "computed.assignment_weapon",
    "computed.vacation_monthly_sync",
  ].forEach(function (stageId) {
    _systemStatusFingerprintCheck_(report, stageId + " full identity mutation matrix", function () {
      var keyField = SystemStatusFingerprints_.transitionPolicies[stageId].rowKeyField;
      var cases = [
        { name: "wrong", reason: "row_set_changed", mutate: function (rows) { rows[0][keyField] = "wrong"; } },
        { name: "duplicate", reason: "row_identity_invalid", mutate: function (rows) { rows[1][keyField] = rows[0][keyField]; } },
        { name: "missing", reason: "row_identity_invalid", mutate: function (rows) { rows[0][keyField] = ""; } },
        { name: "extra", reason: "row_set_changed", mutate: function (rows) { var copy = Object.assign({}, rows[0]); copy[keyField] = "k3"; rows.push(copy); } },
        { name: "lost", reason: "row_set_changed", mutate: function (rows) { rows.pop(); } },
        { name: "reorder", reason: "row_order_changed", mutate: function (rows) { rows.reverse(); } },
      ];
      ["priorRows", "expectedRows", "postRows"].forEach(function (arrayName) {
        cases.forEach(function (testCase) {
          var evidence = identityMatrixFixture_(stageId);
          testCase.mutate(evidence.transition[arrayName]);
          var decision = SystemStatusFingerprints_.evaluateTransitionEvidence(stageId, evidence);
          _systemStatusFingerprintEqual_(decision.status, "failed", stageId + " " + arrayName + " " + testCase.name);
          _systemStatusFingerprintAssert_(
            decision.reasonCodes.indexOf(testCase.reason) !== -1,
            stageId + " " + arrayName + " " + testCase.name + " reason=" + decision.reasonCodes.join(","),
          );
        });
      });
    });
  });

  _systemStatusFingerprintCheck_(report, "JOURNAL and SUMMARY preserve non-target slices", function () {
    var journalPrior = { targetMonth: "07", headers: ["Місяць", "Код"], rows: [["06", "old"], ["07", "old"]] };
    var journalPost = { targetMonth: "07", headers: ["Місяць", "Код"], rows: [["06", "old"], ["07", "new"]] };
    var journal = { immutable: stableImmutable_(), transition: { available: true, prior: journalPrior, expected: journalPost, post: journalPost }, result: matchingResult_() };
    _systemStatusFingerprintAssert_(SystemStatusFingerprints_.evaluateTransitionEvidence("month_journal.journal_slice", journal).eligibleForReceipt);
    journal.transition.post = { targetMonth: "07", headers: ["Місяць", "Код"], rows: [["06", "changed"], ["07", "new"]] };
    _systemStatusFingerprintEqual_(SystemStatusFingerprints_.evaluateTransitionEvidence("month_journal.journal_slice", journal).status, "failed");

    var summaryPrior = { targetMonth: "07", headers: ["Місяць", "A", "A", "Підсумок"], rows: [["06", 1, 2, 3], ["07", 4, 5, 9]] };
    var summaryPost = { targetMonth: "07", headers: ["Місяць", "A", "A", "B", "Підсумок"], rows: [["06", 1, 2, "", 3], ["07", 7, 8, 1, 16]] };
    var summary = { immutable: stableImmutable_(), transition: { available: true, prior: summaryPrior, expected: summaryPost, post: summaryPost }, result: matchingResult_() };
    _systemStatusFingerprintAssert_(SystemStatusFingerprints_.evaluateTransitionEvidence("month_journal.summary_slice", summary).eligibleForReceipt);
    summary.transition.post = { targetMonth: "07", headers: ["Місяць", "A", "B", "Підсумок"], rows: [["06", 1, "", 3], ["07", 7, 1, 16]] };
    _systemStatusFingerprintEqual_(SystemStatusFingerprints_.evaluateTransitionEvidence("month_journal.summary_slice", summary).status, "failed");
  });

  _systemStatusFingerprintCheck_(report, "transition evidence fails closed", function () {
    var evidence = { immutable: stableImmutable_(), transition: { available: false }, result: matchingResult_() };
    _systemStatusFingerprintEqual_(SystemStatusFingerprints_.evaluateTransitionEvidence("computed.assignment_car", evidence).status, "unknown");
    evidence.immutable.postFingerprint = "changed";
    _systemStatusFingerprintEqual_(SystemStatusFingerprints_.evaluateTransitionEvidence("computed.assignment_car", evidence).status, "failed");
    ["missing", "corrupt", "budget_exceeded"].forEach(function (state) {
      _systemStatusFingerprintEqual_(SystemStatusFingerprints_.evaluateTransitionEvidence("computed.assignment_car", { evidenceState: state }).status, "unknown");
    });
  });

  _systemStatusFingerprintCheck_(report, "writer lock contexts forbid nesting", function () {
    _systemStatusFingerprintEqual_(SystemStatusFingerprints_.writerLockContract.currentRuntime.daily.state, "unlocked_direct_writer");
    _systemStatusFingerprintEqual_(SystemStatusFingerprints_.writerLockContract.currentRuntime.public.state, "locked_by_workflow_orchestrator");
    _systemStatusFingerprintAssert_(SystemStatusFingerprints_.evaluateWriterLockContext("public", { documentLockHeld: true, lockOwner: "workflow_orchestrator", nestedAcquisitionAttempted: false, sharedCoreAcquiresLock: false }).eligible);
    _systemStatusFingerprintAssert_(SystemStatusFingerprints_.evaluateWriterLockContext("daily", { documentLockHeld: true, lockOwner: "daily_caller", nestedAcquisitionAttempted: false, sharedCoreAcquiresLock: false }).eligible);
    _systemStatusFingerprintEqual_(SystemStatusFingerprints_.evaluateWriterLockContext("public", null).status, "unknown");
    _systemStatusFingerprintEqual_(SystemStatusFingerprints_.evaluateWriterLockContext("public", { documentLockHeld: true, lockOwner: "workflow_orchestrator", nestedAcquisitionAttempted: true }).status, "failed");
    _systemStatusFingerprintEqual_(SystemStatusFingerprints_.evaluateWriterLockContext("daily", { documentLockHeld: false, lockOwner: "daily_caller" }).status, "failed");
  });

  _systemStatusFingerprintCheck_(report, "fingerprint output privacy", function () {
    var fingerprint = SystemStatusFingerprints_.buildStageSourceFingerprint(
      "computed.personnel_helpers",
      { fml: "Приватна Особа", callsign: "Секрет", phone: "+380671234567" },
    );
    var serialized = JSON.stringify(fingerprint);
    ["Приватна", "Секрет", "+380"].forEach(function (forbidden) {
      _systemStatusFingerprintAssert_(serialized.indexOf(forbidden) === -1, "Fingerprint output leaked " + forbidden);
    });
  });

  return report;
}

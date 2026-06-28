/**
 * UseCases.PanelHelpers.gs — shared SEND_PANEL helpers (PR5 extraction).
 */

function _withPanelHelperTrace_(helperName, fn) {
  if (typeof _traceDebugEnabled_ === "function" && !_traceDebugEnabled_()) {
    return fn();
  }
  if (typeof traceUseCase_ !== "function") {
    return fn();
  }

  var traceId = typeof _traceId_ === "function" ? _traceId_() : "";
  var started = Date.now();
  var baseMeta = {
    traceId: traceId,
    caller: "PanelHelpers",
    domain: "SendPanel",
    area: "UseCases.PanelHelpers",
    runtimePhase: "post-helpers",
    severity: "debug",
    samplingRate: 1,
  };

  try {
    var result = fn();
    traceUseCase_(
      helperName,
      Object.assign({}, baseMeta, {
        ok: true,
        ms: Date.now() - started,
      }),
    );
    return result;
  } catch (err) {
    traceUseCase_(
      helperName,
      Object.assign({}, baseMeta, {
        ok: false,
        ms: Date.now() - started,
        severity: "error",
        err: err && err.message ? String(err.message) : String(err),
      }),
    );
    throw err;
  }
}

function _stage7RowsToChangeList_(rows, type) {
  return _withPanelHelperTrace_("_stage7RowsToChangeList_", function () {
    return stage7AsArray_(rows).map(function (item) {
    return {
      type: type || "row",
      row: item.row,
      fml: item.fml || "",
      code: item.code || "",
      status: item.status || "",
    };
    });
  });
}

function _stage7GroupContiguousRows_(rows) {
  return _withPanelHelperTrace_("_stage7GroupContiguousRows_", function () {
  const sorted = [
    ...new Set(stage7AsArray_(rows).map(Number).filter(Number.isFinite)),
  ].sort(function (a, b) {
    return a - b;
  });
  const groups = [];
  sorted.forEach(function (row) {
    const last = groups[groups.length - 1];
    if (!last || row !== last.end + 1) {
      groups.push({ start: row, end: row, rows: [row] });
      return;
    }
    last.end = row;
    last.rows.push(row);
  });
  return groups;
  });
}

function _stage7ApplyPanelState_(rowNumbers, sentValue, statusText) {
  return _withPanelHelperTrace_("_stage7ApplyPanelState_", function () {
  const panel = DataAccess_.getSheet("SEND_PANEL", null, true);
  const schema = SheetSchemas_.get("SEND_PANEL");
  const groups = _stage7GroupContiguousRows_(rowNumbers);

  groups.forEach(function (group) {
    const count = group.rows.length;
    if (statusText !== null && statusText !== undefined) {
      panel.getRange(group.start, schema.columns.status, count, 1).setValues(
        group.rows.map(function () {
          return [statusText];
        }),
      );
    }
    if (sentValue !== null && sentValue !== undefined) {
      const mark = sentValue
        ? getSendPanelSentMark_()
        : getSendPanelUnsentMark_();
      panel.getRange(group.start, schema.columns.sent, count, 1).setValues(
        group.rows.map(function () {
          return [mark];
        }),
      );
    }
  });

  return SendPanelRepository_.readRows();
  });
}

function _stage7GetPanelReadyRows_() {
  return _withPanelHelperTrace_("_stage7GetPanelReadyRows_", function () {
    return SendPanelRepository_.readRows().filter(function (item) {
      return shouldTreatRowAsReadyToOpen_(item);
    });
  });
}

function _stage7AVerifyPanelStatuses_(rows, expectedStatus, expectedSent) {
  return _withPanelHelperTrace_("_stage7AVerifyPanelStatuses_", function () {
  const selected = SendPanelRepository_.readRows().filter(function (item) {
    return stage7AsArray_(rows).map(Number).indexOf(Number(item.row)) !== -1;
  });
  const expectStatus =
    expectedStatus !== null &&
    expectedStatus !== undefined &&
    expectedStatus !== "";
  const expectSent = expectedSent !== null && expectedSent !== undefined;
  const mismatches = selected.filter(function (item) {
    if (
      expectStatus &&
      String(item.status || "") !== String(expectedStatus || "")
    )
      return true;
    if (expectSent && !!item.sent !== !!expectedSent) return true;
    return false;
  });
  return {
    ok: mismatches.length === 0,
    verifiedRows: selected.length,
    mismatchCount: mismatches.length,
    partial: mismatches.length > 0,
    warnings: mismatches.length
      ? [
          `Післяопераційна перевірка виявила ${mismatches.length} невідповідностей`,
        ]
      : [],
  };
  });
}

function _stage7AVerifySendPanelBuild_(execution) {
  return _withPanelHelperTrace_("_stage7AVerifySendPanelBuild_", function () {
  const result = (execution && execution.result) || {};
  const rows = stage7AsArray_(result.rows);
  const stats = result.stats || SendPanelRepository_.buildStats(rows);
  return {
    ok: rows.length > 0 || !!result.persisted,
    rows: rows.length,
    stats: stats,
    partial: false,
    warnings: [],
  };
  });
}

function _stage7BuildSendPanelWarnings_(stats) {
  return _withPanelHelperTrace_("_stage7BuildSendPanelWarnings_", function () {
  const safeStats = stats || {};
  const errorCount = Number(safeStats.errorCount || 0);
  const warnings = [];

  if (errorCount > 0) {
    warnings.push(
      `У панелі надсилання є рядки, не готові до відправки: ${errorCount}`,
    );
  }

  return warnings;
  });
}

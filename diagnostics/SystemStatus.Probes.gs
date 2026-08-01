/**
 * SystemStatus.Probes.gs — SS-1 read-only domain probes.
 *
 * Every live probe catches its own failure. The returned objects are internal
 * evidence only; SystemStatusFoundation_ is the only presentation boundary.
 */

function _systemStatusProbeNow_() {
  return new Date().toISOString();
}

function _systemStatusRunProbe_(probeId, sectionId, callback) {
  var checkedAt = _systemStatusProbeNow_();
  try {
    var result = callback() || {};
    return Object.assign(
      {
        probeId: probeId,
        id: sectionId,
        status: "healthy",
        freshness: "not_applicable",
        reasonCodes: [],
        metrics: {},
        actionIds: [],
        checkedAt: checkedAt,
        retryable: false,
      },
      result,
      { probeId: probeId, id: sectionId, checkedAt: checkedAt },
    );
  } catch (error) {
    return {
      probeId: probeId,
      id: sectionId,
      status: "unavailable",
      freshness: "unknown",
      reasonCodes: ["collector_failed"],
      metrics: {},
      actionIds: [],
      checkedAt: checkedAt,
      retryable: true,
      internalError: error,
    };
  }
}

function _systemStatusCountArray_(value) {
  return Array.isArray(value) ? value.length : 0;
}

function _systemStatusProbePersonnel_() {
  return _systemStatusRunProbe_("personnel", "key_data", function () {
    if (
      typeof PersonnelRepository_ !== "object" ||
      !PersonnelRepository_ ||
      typeof PersonnelRepository_.getReadOnlyStatus !== "function"
    ) {
      throw new Error("personnel read-only helper unavailable");
    }
    var data = PersonnelRepository_.getReadOnlyStatus();
    var reasons = [];
    var status = "healthy";
    if (!data.available) {
      status = "critical";
      reasons.push("source_unavailable");
    }
    if (Number(data.schemaIssueCount || 0) > 0) {
      status = "critical";
      reasons.push("schema_issues");
    }
    if (Number(data.duplicateActiveCallsigns || 0) > 0) {
      status = "critical";
      reasons.push("data_issues");
    } else if (data.available && Number(data.activeRecords || 0) === 0) {
      status = "attention";
      reasons.push("data_issues");
    }
    return {
      status: status,
      reasonCodes: reasons,
      metrics: {
        activePersonnel: data.activeRecords,
        schemaIssues: data.schemaIssueCount,
        duplicateActiveCallsigns: data.duplicateActiveCallsigns,
      },
      raw: data,
    };
  });
}

function _systemStatusProbePhones_() {
  return _systemStatusRunProbe_("phones", "key_data", function () {
    if (typeof getPhonesReadOnlyStatus_ !== "function") {
      throw new Error("canonical phone read-only helper unavailable");
    }
    var data = getPhonesReadOnlyStatus_();
    if (!data.available) {
      return {
        status: "unavailable",
        freshness: "unknown",
        reasonCodes: ["source_unavailable"],
        retryable: true,
        metrics: { phoneRecords: 0, dataIssues: 0 },
      };
    }
    var valid = Number(data.validRecords || 0);
    var invalid = Number(data.invalidRecords || 0);
    var mismatches = Number(data.mapIndexMismatches || 0);
    return {
      status: mismatches > 0 ? "critical" : invalid > 0 || valid === 0 ? "attention" : "healthy",
      reasonCodes: mismatches > 0 || invalid > 0 || valid === 0 ? ["data_issues"] : [],
      metrics: { phoneRecords: valid, dataIssues: invalid + mismatches },
      raw: data,
    };
  });
}

function _systemStatusProbeVacations_() {
  return _systemStatusRunProbe_("vacations", "key_data", function () {
    if (
      typeof VacationsRepository_ !== "object" ||
      !VacationsRepository_ ||
      typeof VacationsRepository_.listAll !== "function"
    ) {
      throw new Error("vacation repository unavailable");
    }
    var sheetName =
      typeof VacationsRepository_.getSourceSheetName === "function"
        ? VacationsRepository_.getSourceSheetName()
        : "VACATIONS";
    var sheet = getWasbSpreadsheet_().getSheetByName(sheetName);
    if (!sheet) {
      return {
        status: "unavailable",
        freshness: "unknown",
        reasonCodes: ["source_unavailable"],
        retryable: true,
        metrics: { vacationRecords: 0, dataIssues: 0 },
      };
    }
    var rows = VacationsRepository_.listAll() || [];
    var invalid = rows.filter(function (item) {
      if (!item || item.active === false) return false;
      return !item.startDate || !item.endDate || !(item.fml || item.personKey || item.callsign);
    }).length;
    return {
      status: invalid > 0 ? "critical" : "healthy",
      reasonCodes: invalid > 0 ? ["data_issues"] : [],
      metrics: { vacationRecords: rows.length, dataIssues: invalid },
      raw: { available: true, records: rows.length, invalidRecords: invalid },
    };
  });
}

function _systemStatusMergeKeyData_(personnel, phones, vacations) {
  var items = [personnel, phones, vacations];
  var reasons = [];
  items.forEach(function (item) {
    (item.reasonCodes || []).forEach(function (code) {
      if (reasons.indexOf(code) === -1) reasons.push(code);
    });
  });
  var status = reduceSystemStatusOverall_(items.map(function (item) { return item.status; }));
  return {
    id: "key_data",
    status: status,
    freshness: "unknown",
    reasonCodes: reasons,
    metrics: {
      activePersonnel: personnel.metrics.activePersonnel || 0,
      phoneRecords: phones.metrics.phoneRecords || 0,
      vacationRecords: vacations.metrics.vacationRecords || 0,
      dataIssues:
        Number(personnel.metrics.schemaIssues || 0) +
        Number(personnel.metrics.duplicateActiveCallsigns || 0) +
        Number(phones.metrics.dataIssues || 0) +
        Number(vacations.metrics.dataIssues || 0),
    },
    actionIds: ["materialize_computed_data", "clear_phone_cache"],
    checkedAt: _systemStatusProbeNow_(),
    retryable: items.some(function (item) { return item.retryable === true; }),
    probes: items,
  };
}

function _systemStatusProbeKeyData_() {
  return _systemStatusMergeKeyData_(
    _systemStatusProbePersonnel_(),
    _systemStatusProbePhones_(),
    _systemStatusProbeVacations_(),
  );
}

function _systemStatusSummarizeVacationSignals_(pending, audit) {
  var checks = audit && Array.isArray(audit.checks) ? audit.checks : [];
  var critical = checks.filter(function (check) {
    var severity = String((check && check.severity) || "").toUpperCase();
    return severity === "ERROR" || severity === "CRITICAL";
  }).length;
  var warnings = checks.filter(function (check) {
    return String((check && check.severity) || "").toUpperCase() === "WARNING";
  }).length;
  var pendingConflicts = _systemStatusCountArray_(pending && pending.conflicts);
  var pendingRemovals = _systemStatusCountArray_(pending && pending.removals);
  var unresolved =
    _systemStatusCountArray_(pending && pending.unresolved) +
    _systemStatusCountArray_(pending && pending.invalid) +
    _systemStatusCountArray_(pending && pending.unsupported);
  var status = critical > 0 || unresolved > 0 ? "critical" : "healthy";
  if (status === "healthy" && (warnings > 0 || pendingConflicts > 0 || pendingRemovals > 0 || !pending)) {
    status = "attention";
  }
  var reasons = [];
  if (critical > 0 || unresolved > 0) reasons.push("data_issues");
  if (pendingConflicts > 0 || pendingRemovals > 0) reasons.push("pending_review");
  reasons.push("pending_check_unknown");
  return {
    status: status,
    freshness: "unknown",
    reasonCodes: reasons,
    metrics: {
      plannerCritical: critical + unresolved,
      plannerWarnings: warnings,
      pendingConflicts: pendingConflicts,
      pendingRemovals: pendingRemovals,
    },
  };
}

function _systemStatusProbeVacationConflicts_() {
  return _systemStatusRunProbe_("vacation_conflicts", "vacation_conflicts", function () {
    var rows = VacationsRepository_.listAll();
    var audit = VacationPlannerService_.buildScheduleAudit(rows);
    var pending = VacationMonthlySync_.getPendingPlan();
    return Object.assign(_systemStatusSummarizeVacationSignals_(pending, audit), {
      actionIds: ["check_vacation_conflicts"],
      retryable: true,
    });
  });
}

function _systemStatusClassifyInventory_(data) {
  var source = data && typeof data === "object" ? data : {};
  var reasons = [];
  var status = "healthy";
  if (!source.configured) {
    status = "attention";
    reasons.push("not_configured");
  }
  if (!source.available) {
    status = status === "attention" ? "attention" : "unavailable";
    reasons.push("source_unavailable");
  }
  if (source.stale) {
    status = status === "unavailable" ? status : "attention";
    reasons.push("stale_index");
  }
  if (Number(source.incompletePastMonths || 0) > 0 || Number(source.missingFiles || 0) > 0) {
    status = status === "unavailable" ? status : "attention";
    reasons.push("incomplete_history");
  }
  if (Number(source.duplicateFiles || 0) > 0 && status === "healthy") status = "attention";
  var hasScanEvidence = source.scanTruncated === true || source.scanTruncated === false;
  if (source.scanTruncated === true) {
    if (status !== "unavailable") status = "attention";
    reasons.push("scan_truncated");
  } else if (!hasScanEvidence) {
    if (status !== "unavailable") status = "attention";
    reasons.push("scan_evidence_unknown");
  }
  return {
    status: status,
    freshness: !hasScanEvidence
      ? "unknown"
      : source.stale
        ? "stale"
        : source.lastSyncedAt
          ? "current"
          : "unknown",
    reasonCodes: reasons,
    metrics: {
      completePastMonths: source.completePastMonths || 0,
      incompletePastMonths: source.incompletePastMonths || 0,
      missingFiles: source.missingFiles || 0,
      duplicateFiles: source.duplicateFiles || 0,
      lastSyncedAt: source.lastSyncedAt || "",
    },
  };
}

function _systemStatusProbeInventory_() {
  return _systemStatusRunProbe_("inventory_reconciliation", "inventory_reconciliation", function () {
    if (
      typeof InventoryReconciliation_ !== "object" ||
      !InventoryReconciliation_ ||
      typeof InventoryReconciliation_.getReadOnlyStatus !== "function"
    ) {
      throw new Error("inventory read-only helper unavailable");
    }
    return Object.assign(
      _systemStatusClassifyInventory_(InventoryReconciliation_.getReadOnlyStatus()),
      { actionIds: ["open_inventory_reconciliation"], retryable: true },
    );
  });
}

function _systemStatusClassifyTemporaryProperty_(data) {
  var source = data && typeof data === "object" ? data : {};
  if (!source.exists || !source.modern) {
    return {
      status: source.exists ? "attention" : "unavailable",
      freshness: "unknown",
      reasonCodes: [source.exists ? "schema_issues" : "source_unavailable"],
      metrics: { outstandingRecords: 0, persons: 0 },
    };
  }
  var outstanding = Number(source.outstandingRecords || 0);
  return {
    status: outstanding > 0 ? "attention" : "healthy",
    freshness: "not_applicable",
    reasonCodes: outstanding > 0 ? ["outstanding_items"] : [],
    metrics: {
      outstandingRecords: outstanding,
      persons: source.persons || 0,
    },
  };
}

function _systemStatusProbeTemporaryProperty_() {
  return _systemStatusRunProbe_("temporary_property", "temporary_property", function () {
    if (
      typeof TemporaryPropertyRegister_ !== "object" ||
      !TemporaryPropertyRegister_ ||
      typeof TemporaryPropertyRegister_.getReadOnlyStatus !== "function"
    ) {
      throw new Error("temporary property read-only helper unavailable");
    }
    return Object.assign(
      _systemStatusClassifyTemporaryProperty_(TemporaryPropertyRegister_.getReadOnlyStatus()),
      { retryable: true },
    );
  });
}

function _systemStatusSummarizeManagedTriggers_(definitions, triggers, compatibilityPolicy) {
  var expected = (Array.isArray(definitions) ? definitions : []).map(function (item) {
    return String((item && item.handler) || "");
  }).filter(Boolean);
  var counts = {};
  var eventCounts = {};
  (Array.isArray(triggers) ? triggers : []).forEach(function (trigger) {
    var handler = "";
    var eventType = "";
    try {
      handler = String(
        trigger && typeof trigger.getHandlerFunction === "function"
          ? trigger.getHandlerFunction()
          : trigger && trigger.handler,
      );
      eventType = String(
        trigger && typeof trigger.getEventType === "function"
          ? trigger.getEventType()
          : trigger && trigger.eventType,
      );
    } catch (_) {}
    if (!handler) return;
    counts[handler] = (counts[handler] || 0) + 1;
    eventCounts[handler + "\n" + eventType] =
      (eventCounts[handler + "\n" + eventType] || 0) + 1;
  });
  var missing = expected.filter(function (handler) { return !counts[handler]; }).length;
  var duplicates = expected.reduce(function (sum, handler) {
    return sum + Math.max(Number(counts[handler] || 0) - 1, 0);
  }, 0);
  var legacy =
    compatibilityPolicy && Array.isArray(compatibilityPolicy.legacyInstallable)
      ? compatibilityPolicy.legacyInstallable
      : [];
  legacy.forEach(function (rule) {
    var handler = String((rule && rule.handler) || "");
    var eventType = String((rule && rule.eventType) || "");
    var maxCount = Math.max(Number((rule && rule.maxCount) || 0), 0);
    duplicates += Math.max(Number(eventCounts[handler + "\n" + eventType] || 0) - maxCount, 0);
  });
  var compatibleHandlers = legacy.map(function (rule) {
    return String((rule && rule.handler) || "");
  });
  var compatiblePairs = {};
  legacy.forEach(function (rule) {
    compatiblePairs[
      String((rule && rule.handler) || "") + "\n" +
      String((rule && rule.eventType) || "")
    ] = true;
  });
  var wrongLegacyPairs = Object.keys(eventCounts).reduce(function (sum, pair) {
    var handler = pair.split("\n")[0];
    if (compatibleHandlers.indexOf(handler) === -1 || compatiblePairs[pair]) return sum;
    return sum + Number(eventCounts[pair] || 0);
  }, 0);
  var unexpected = Object.keys(counts).filter(function (handler) {
    return (
      expected.indexOf(handler) === -1 &&
      compatibleHandlers.indexOf(handler) === -1 &&
      (/^stage7Job/.test(handler) || /^stage7SecurityAudit/.test(handler))
    );
  }).length + wrongLegacyPairs;
  var status = missing > 0 || duplicates > 0 ? "critical" : unexpected > 0 ? "attention" : "healthy";
  var reasons = [];
  if (missing > 0) reasons.push("missing_triggers");
  if (duplicates > 0) reasons.push("duplicate_triggers");
  if (unexpected > 0) reasons.push("unexpected_triggers");
  return {
    status: status,
    freshness: "not_applicable",
    reasonCodes: reasons,
    metrics: { missing: missing, duplicates: duplicates, unexpected: unexpected },
  };
}

function _systemStatusProbeManagedTriggers_() {
  return _systemStatusRunProbe_("managed_triggers", "managed_triggers", function () {
    if (
      typeof Stage7Triggers_ !== "object" ||
      !Stage7Triggers_ ||
      typeof Stage7Triggers_.listManagedDefinitions !== "function"
    ) {
      throw new Error("managed trigger registry unavailable");
    }
    return _systemStatusSummarizeManagedTriggers_(
      Stage7Triggers_.listManagedDefinitions(),
      ScriptApp.getProjectTriggers(),
      _getStage7TriggerCompatibilityPolicy_(),
    );
  });
}

function _systemStatusSummarizeRequiredSettings_(spreadsheetId, ownerDiagnostics) {
  var id = String(spreadsheetId || "").trim();
  var owner = ownerDiagnostics && typeof ownerDiagnostics === "object" ? ownerDiagnostics : {};
  var missing = 0;
  var invalid = 0;
  if (!id) missing++;
  else if (!/^[A-Za-z0-9_-]{20,}$/.test(id)) invalid++;
  if (!owner.configured) missing++;
  else if (!owner.looksLikeEmail) invalid++;
  var status = missing > 0 || invalid > 0 ? "critical" : "healthy";
  var reasons = [];
  if (missing > 0) reasons.push("missing_required_settings");
  if (invalid > 0) reasons.push("invalid_required_settings");
  return {
    status: status,
    freshness: "not_applicable",
    reasonCodes: reasons,
    metrics: { configured: 2 - missing - invalid, missing: missing, invalid: invalid },
  };
}

function _systemStatusProbeLaunchSettings_() {
  return _systemStatusRunProbe_("launch_settings", "launch_settings", function () {
    return _systemStatusSummarizeRequiredSettings_(
      getWasbSpreadsheetId_(),
      getWasbOwnerEmailDiagnostics_(),
    );
  });
}

function _systemStatusSummarizeAccessDiagnostics_(diagnostics) {
  var data = diagnostics && typeof diagnostics === "object" ? diagnostics : {};
  var schema = data.schema || {};
  var integrity = data.dataIntegrity || {};
  var schemaIssues = (!schema.exists ? 1 : 0) + _systemStatusCountArray_(schema.missingHeaders);
  var accessIssues =
    _systemStatusCountArray_(integrity.duplicateEmails) +
    _systemStatusCountArray_(integrity.duplicateCurrentKeys) +
    _systemStatusCountArray_(integrity.duplicatePrevKeys) +
    _systemStatusCountArray_(integrity.currentEqualsPrev) +
    _systemStatusCountArray_(integrity.prevCollidesWithCurrent) +
    _systemStatusCountArray_(integrity.emptyIdentifierWithActiveRole) +
    _systemStatusCountArray_(integrity.invalidRoleValues) +
    _systemStatusCountArray_(integrity.invalidEnabledValues);
  return { schemaIssues: schemaIssues, accessIssues: accessIssues };
}

function _systemStatusCombineAccessDataQuality_(access, personnel) {
  var accessData = access && typeof access === "object" ? access : {};
  var personnelData = personnel && typeof personnel === "object" ? personnel : {};
  var duplicateCallsigns = Number(
    personnelData.metrics && personnelData.metrics.duplicateActiveCallsigns || 0,
  );
  var personnelSchemaIssues = Number(
    personnelData.metrics && personnelData.metrics.schemaIssues || 0,
  );
  var schemaIssues = Number(accessData.schemaIssues || 0) + personnelSchemaIssues;
  var accessIssues = Number(accessData.accessIssues || 0);
  var personnelDataIssues = Number(
    personnelData.metrics && personnelData.metrics.dataIssues || 0,
  );
  var accessStatus = accessIssues > 0 || schemaIssues > 0 || duplicateCallsigns > 0
    ? "critical"
    : "healthy";
  var status = reduceSystemStatusOverall_([accessStatus, personnelData.status]);
  var reasons = [];
  if (accessStatus === "critical" || personnelDataIssues > 0) reasons.push("data_issues");
  (personnelData.reasonCodes || []).forEach(function (reason) {
    if (reasons.indexOf(reason) === -1) reasons.push(reason);
  });
  return {
    status: status,
    freshness: personnelData.freshness === "unknown" ? "unknown" : "not_applicable",
    reasonCodes: reasons,
    metrics: {
      accessIssues: accessIssues,
      duplicateActiveCallsigns: duplicateCallsigns,
      schemaIssues: schemaIssues,
      dataIssues: personnelDataIssues,
    },
    actionIds: ["run_diagnostics"],
    retryable: personnelData.retryable === true,
  };
}

function _systemStatusProbeAccessDataQuality_() {
  return _systemStatusRunProbe_("access_data_quality", "access_data_quality", function () {
    if (
      typeof AccessControl_ !== "object" ||
      !AccessControl_ ||
      typeof AccessControl_.runAccessDiagnostics !== "function"
    ) {
      throw new Error("access diagnostics unavailable");
    }
    var access = _systemStatusSummarizeAccessDiagnostics_(
      AccessControl_.runAccessDiagnostics(),
    );
    var personnel = _systemStatusProbePersonnel_();
    return _systemStatusCombineAccessDataQuality_(access, personnel);
  });
}

function _systemStatusProbeCurrentMonthJournal_() {
  return {
    probeId: "current_month_journal",
    id: "current_month_journal",
    status: "unavailable",
    freshness: "unknown",
    reasonCodes: ["freshness_pending"],
    metrics: {},
    actionIds: ["materialize_current_month_journal"],
    checkedAt: _systemStatusProbeNow_(),
    retryable: false,
  };
}

const SystemStatusProbes_ = Object.freeze({
  personnel: _systemStatusProbePersonnel_,
  phones: _systemStatusProbePhones_,
  vacations: _systemStatusProbeVacations_,
  keyData: _systemStatusProbeKeyData_,
  currentMonthJournal: _systemStatusProbeCurrentMonthJournal_,
  vacationConflicts: _systemStatusProbeVacationConflicts_,
  inventoryReconciliation: _systemStatusProbeInventory_,
  temporaryProperty: _systemStatusProbeTemporaryProperty_,
  managedTriggers: _systemStatusProbeManagedTriggers_,
  launchSettings: _systemStatusProbeLaunchSettings_,
  accessDataQuality: _systemStatusProbeAccessDataQuality_,
  runSafelyForTests: _systemStatusRunProbe_,
  mergeKeyDataForTests: _systemStatusMergeKeyData_,
  summarizeVacationSignalsForTests: _systemStatusSummarizeVacationSignals_,
  classifyInventoryForTests: _systemStatusClassifyInventory_,
  classifyTemporaryPropertyForTests: _systemStatusClassifyTemporaryProperty_,
  summarizeManagedTriggersForTests: _systemStatusSummarizeManagedTriggers_,
  summarizeRequiredSettingsForTests: _systemStatusSummarizeRequiredSettings_,
  summarizeAccessDiagnosticsForTests: _systemStatusSummarizeAccessDiagnostics_,
  combineAccessDataQualityForTests: _systemStatusCombineAccessDataQuality_,
});

/**
 * SS-2A: read-only extraction primitives and pure stage-scoped fingerprints.
 *
 * This module intentionally does not call PropertiesService or any materializer.
 * Property/config/clock values are injected through an execution context. Runtime
 * receipt persistence and production cache invalidation belong to SS-2B.
 * Runtime operationScope / trustedContextMap construction lives in
 * SystemStatus.Runtime.gs (SS-2B); this module stays pure/evaluator-only.
 */

var SYSTEM_STATUS_FINGERPRINT_ALGORITHM_VERSION_ =
  "ss2a-canonical-sha256-stream-v1";
var SYSTEM_STATUS_FINGERPRINT_DEFAULT_CHUNK_BYTES_ = 4096;
var SYSTEM_STATUS_FINGERPRINT_MAX_CHUNK_BYTES_ = 8192;
var SYSTEM_STATUS_FINGERPRINT_MAX_PROJECTION_BYTES_ = 2000000;
var SYSTEM_STATUS_FINGERPRINT_MANIFEST_VERSION_ = "ss2a9-executable-projection-v10";
var SYSTEM_STATUS_FINGERPRINT_SIGNATURE_VERSION_ = "ss2a9-stage-signatures-v10";
var SYSTEM_STATUS_FINGERPRINT_RECEIPT_VERSION_ = "ss2b-stage-receipt-v1";

var SYSTEM_STATUS_FINGERPRINT_STAGE_VERSIONS_ = Object.freeze({
  "computed.personnel_helpers": "personnel-helpers-v6",
  "computed.phones_result": "phones-result-v2",
  "computed.birthday_result": "birthday-result-v2",
  "computed.monthly_callsigns": "monthly-callsigns-v3",
  "computed.assignment_car": "assignment-car-v6",
  "computed.assignment_weapon": "assignment-weapon-v6",
  "computed.vacation_computed": "vacation-computed-v4",
  "computed.vacation_schedule": "vacation-schedule-v3",
  "computed.vacation_monthly_sync": "vacation-monthly-sync-v10",
  "computed.send_panel_status": "send-panel-status-v3",
  "computed.operation_summary": "computed-operation-summary-v5",
  "month_journal.target_resolution": "month-target-v3",
  "month_journal.source_projection": "month-source-v2",
  "month_journal.journal_slice": "journal-slice-v3",
  "month_journal.summary_slice": "summary-slice-v3",
  "month_journal.non_target_preservation": "month-preservation-v3",
  "month_journal.operation_summary": "month-operation-summary-v3",
});

var SYSTEM_STATUS_FINGERPRINT_STAGE_POLICY_ = Object.freeze({
  "computed.personnel_helpers": { policy: "required", skipWhen: "never" },
  "computed.phones_result": { policy: "required", skipWhen: "never" },
  "computed.birthday_result": { policy: "required", skipWhen: "never" },
  "computed.monthly_callsigns": {
    policy: "required",
    skipWhen: "no_target_months",
  },
  "computed.assignment_car": {
    policy: "optional",
    skipWhen: "target_missing_or_empty",
  },
  "computed.assignment_weapon": {
    policy: "optional",
    skipWhen: "target_missing_or_empty",
  },
  "computed.vacation_computed": {
    policy: "optional",
    skipWhen: "vacation_source_not_legacy",
  },
  "computed.vacation_schedule": {
    policy: "optional",
    skipWhen: "module_unavailable",
  },
  "computed.vacation_monthly_sync": {
    policy: "optional",
    skipWhen: "no_target_month",
  },
  "computed.send_panel_status": {
    policy: "optional",
    skipWhen: "target_missing",
  },
  "month_journal.target_resolution": { policy: "required", skipWhen: "never" },
  "month_journal.source_projection": { policy: "required", skipWhen: "never" },
  "month_journal.journal_slice": { policy: "required", skipWhen: "never" },
  "month_journal.summary_slice": { policy: "required", skipWhen: "never" },
  "month_journal.non_target_preservation": {
    policy: "required",
    skipWhen: "never",
  },
});

var SystemStatusFingerprints_ = (function () {
  function _dependency_(id, kind, readModes, fields, ignoredFields, options) {
    var opts = options || {};
    return Object.freeze({
      id: id,
      kind: kind,
      sheet: String(opts.sheet || ""),
      range: String(opts.range || ""),
      readModes: Object.freeze((readModes || []).slice()),
      fields: Object.freeze((fields || []).map(function (field) {
        return Object.freeze([String(field[0]), String(field[1] || "identity")]);
      })),
      order: String(opts.order || "semantic"),
      duplicates: String(opts.duplicates || "preserve"),
      ignoreEmptyTail: opts.ignoreEmptyTail === true,
      ignoredFields: Object.freeze((ignoredFields || []).slice()),
      required: opts.required !== false,
      presence: "missing_or_unavailable_is_not_empty",
      evidenceRole: String(opts.evidenceRole || "immutable_input"),
    });
  }

  function _rangeDependency_(id, sheet, range, modes, fields, ignored, evidenceRole) {
    return _dependency_(id, "range", modes, fields, ignored, {
      sheet: sheet,
      range: range,
      ignoreEmptyTail: true,
      evidenceRole: evidenceRole,
    });
  }

  function _injectedDependency_(id, fields, ignored, evidenceRole, options) {
    var opts = options || {};
    return _dependency_(id, "injected", ["injected"], fields, ignored, {
      evidenceRole: evidenceRole,
      ignoreEmptyTail: opts.ignoreEmptyTail === true,
    });
  }

  var commonIgnored = ["formatting", "technical", "emptyTail"];
  var SYSTEM_STATUS_FINGERPRINT_EXECUTABLE_MANIFEST_ = Object.freeze({
    "computed.personnel_helpers": Object.freeze({
      source: Object.freeze([
        _rangeDependency_("personnel", "PERSONNEL", "named_source_columns", ["values", "display"], [["fml", "space_text"], ["lastName", "text"], ["firstName", "text"], ["patronymic", "text"], ["callsign", "text"], ["phone", "text"], ["phone2", "text"], ["rank", "text"], ["title", "text"]], ["birthdayRaw", "birthdayDisplay", "position", "status", "template", "formatting", "technical", "emptyTail"]),
        _injectedDependency_("personnelBirthdayPrior", [["rowKey", "text"], ["birthdaySemantic", "birthday_day"]], ["birthdayRaw", "birthdayDisplay", "formatting", "emptyTail"], "mutable_target_prior_state", { ignoreEmptyTail: true }),
        _injectedDependency_("clock", [["clockDay", "date_day"], ["timezone", "text"]], []),
      ]),
      result: Object.freeze([_rangeDependency_("personnelDerived", "PERSONNEL", "birthday_age_days", ["display"], [["birthday", "text"], ["age", "text"], ["daysUntilBirthday", "text"]], commonIgnored)]),
    }),
    "computed.phones_result": Object.freeze({
      source: Object.freeze([_injectedDependency_("personnelRows", [["callsign", "text"], ["phone", "text"], ["phone2", "text"]], ["formatting"])]),
      result: Object.freeze([_rangeDependency_("phones", "PHONES", "A1:C_managed", ["display"], [["callsign", "text"], ["phone", "text"], ["phone2", "text"]], commonIgnored)]),
    }),
    "computed.birthday_result": Object.freeze({
      source: Object.freeze([_injectedDependency_("personnelBirthdayRows", [["callsign", "text"], ["birthday", "identity"], ["clockDay", "date_day"], ["timezone", "text"]], ["formatting"])]),
      result: Object.freeze([_rangeDependency_("birthday", "BIRTHDAY", "A1:D_managed", ["display"], [["callsign", "text"], ["birthday", "text"], ["age", "text"], ["daysUntilBirthday", "text"]], commonIgnored)]),
    }),
    "computed.monthly_callsigns": Object.freeze({
      source: Object.freeze([_injectedDependency_("monthlyCallsignInput", [["callsign", "text"], ["lastName", "text"], ["monthlySyncMode", "text"], ["monthSheet", "text"], ["includeHistory", "boolean"], ["mode", "text"], ["activeMonthProperty", "text"], ["clockMonth", "text"], ["targetSheet", "text"], ["layoutGeometry", "text"]], ["formatting"])]),
      result: Object.freeze([_rangeDependency_("monthlyCallsigns", "target_months", "callsign_column", ["display"], [["month", "text"], ["callsign", "text"]], commonIgnored)]),
    }),
    "computed.assignment_car": Object.freeze({
      source: Object.freeze([
        _injectedDependency_("carPersonnel", [["fml", "space_text"], ["callsign", "text"], ["phone", "text"], ["phone2", "text"]], ["formatting"]),
        _injectedDependency_("carPriorState", [["rowKey", "text"], ["ownerFml", "space_text"], ["helperCallsign", "text"]], ["formatting"], "mutable_target_prior_state"),
        _injectedDependency_("carPreservation", [["rowKey", "text"], ["columnsBtoG", "identity"]], ["formatting"], "preservation_baseline"),
      ]),
      result: Object.freeze([_rangeDependency_("car", "CAR", "A2:H", ["display"], [["ownerFml", "space_text"], ["helperCallsign", "text"]], ["columnsBtoG", "formatting", "emptyTail"])]),
    }),
    "computed.assignment_weapon": Object.freeze({
      source: Object.freeze([
        _injectedDependency_("weaponPersonnel", [["fml", "space_text"], ["lastName", "text"], ["firstName", "text"], ["patronymic", "text"], ["rank", "text"], ["title", "text"], ["phone", "text"], ["callsign", "text"]], ["formatting"]),
        _injectedDependency_("weaponPriorState", [["rowKey", "text"], ["lastName", "text"], ["firstName", "text"], ["patronymic", "text"], ["rank", "text"], ["phone", "text"], ["callsign", "text"]], ["formatting"], "mutable_target_prior_state"),
        _injectedDependency_("weaponPreservation", [["rowKey", "text"], ["columnsFtoZ", "identity"]], ["formatting"], "preservation_baseline"),
      ]),
      result: Object.freeze([_rangeDependency_("weapon", "WEAPON", "A2:E_and_AA", ["display"], [["lastName", "text"], ["firstName", "text"], ["patronymic", "text"], ["rank", "text"], ["phone", "text"], ["callsign", "text"]], ["columnsFtoZ", "formatting", "emptyTail"])]),
    }),
    "computed.vacation_computed": Object.freeze({
      source: Object.freeze([_injectedDependency_("vacationComputedInput", [["sourceMode", "text"], ["fml", "space_text"], ["startRaw", "identity"], ["startDisplay", "text"], ["vacationNumber", "text"], ["travel", "text"], ["clockDay", "date_day"], ["timezone", "text"]], ["computedColumns", "formatting", "emptyTail"])]),
      result: Object.freeze([_rangeDependency_("vacationComputed", "VACATIONS", "C_EG_I", ["values", "display"], [["endDate", "identity"], ["active", "boolean"], ["notify", "boolean"], ["daysLeft", "number"], ["intervalCheck", "text"]], commonIgnored)]),
    }),
    "computed.vacation_schedule": Object.freeze({
      source: Object.freeze([
        _injectedDependency_("vacationScheduleContext", [["sourceMode", "text"], ["scheduleYearProperty", "number"], ["clockDay", "date_day"], ["timezone", "text"], ["currentYear", "number"], ["rules", "identity"], ["options", "identity"], ["sheets", "identity"], ["sourceRange", "text"]], []),
        _rangeDependency_("vacationScheduleSource", "active_vacation_source", "repository_fields", ["values", "display"], [["recordId", "text"], ["personKey", "text"], ["fml", "space_text"], ["callsign", "text"], ["startRaw", "identity"], ["startTyped", "identity"], ["endRaw", "identity"], ["endTyped", "identity"], ["vacationType", "text"], ["vacationNumber", "text"], ["travel", "text"], ["status", "text"], ["active", "boolean"], ["monthlyCode", "text"], ["factCode", "text"]], commonIgnored),
        _rangeDependency_("vacationSchedulePersonnel", "PERSONNEL", "repository_rows", ["values", "display"], [["active", "boolean"], ["statusCanonical", "text"], ["status", "text"], ["personKey", "text"], ["fml", "space_text"], ["callsign", "text"]], commonIgnored),
        _rangeDependency_("vacationScheduleMonths", "months_01_12", "layout_codes_identity_dates", ["values", "display"], [["month", "text"], ["codes", "identity"], ["callsign", "text"], ["fml", "space_text"], ["dateRaw", "identity"], ["dateDisplay", "text"]], commonIgnored),
        _rangeDependency_("vacationRightPanel", "legacy_vacation_source", "manual_detector", ["display"], [["hasData", "boolean"], ["manualFields", "identity"]], ["formatting"]),
      ]),
      result: Object.freeze([_rangeDependency_("vacationScheduleResult", "VACATION_SCHEDULE_AND_CHECK", "full_outputs", ["values", "display"], [["headers", "identity"], ["scheduleRows", "identity"], ["checkRows", "identity"]], commonIgnored)]),
    }),
    "computed.vacation_monthly_sync": Object.freeze({
      source: Object.freeze([
        _injectedDependency_("vacationMonthlyContext", [["monthSheet", "text"], ["activeMonthProperty", "text"], ["clockMonth", "text"], ["targetSheet", "text"], ["exceptionsSnapshot", "identity"]], []),
        _injectedDependency_("vacationMonthlyMetadataPrior", [["metadataSnapshot", "identity"]], ["rawEntries", "pii"], "mutable_target_prior_state"),
        _rangeDependency_("vacationMonthlySource", "active_vacation_source", "repository_fields", ["values", "display"], [["recordId", "text"], ["personKey", "text"], ["personId", "text"], ["fml", "space_text"], ["callsign", "text"], ["startRaw", "identity"], ["startTyped", "identity"], ["endRaw", "identity"], ["endTyped", "identity"], ["active", "boolean"], ["status", "text"], ["monthlyCode", "text"], ["factCode", "text"], ["vacationType", "text"], ["vacationNumber", "text"]], commonIgnored),
        _rangeDependency_("vacationMonthlyPersonnel", "PERSONNEL", "id_callsign_fml_lookup", ["values", "display"], [["id", "text"], ["personKey", "text"], ["callsign", "text"], ["fml", "space_text"], ["lastName", "text"], ["firstName", "text"], ["patronymic", "text"]], ["status", "active", "position", "template", "formatting", "technical", "emptyTail"]),
        _rangeDependency_("vacationMonthlyTarget", "target_month", "code_matrix_dates_identity", ["values", "display", "validations", "notes"], [["cellKey", "text"], ["cellValue", "identity"], ["cellDisplay", "text"], ["validationAllowed", "identity"], ["note", "text"], ["dateRaw", "identity"], ["dateDisplay", "text"], ["callsign", "text"], ["fml", "space_text"]], ["formatting"], "mutable_target_prior_state"),
      ]),
      result: Object.freeze([_injectedDependency_("vacationMonthlyEvidence", [["stageId", "text"], ["target", "text"], ["scopeFingerprint", "text"], ["runId", "text"], ["targetCells", "identity"], ["metadata", "identity"], ["pendingPlan", "identity"], ["conflicts", "identity"]], ["rawRows", "pii", "propertyValues", "exceptionText"])]),
    }),
    "computed.send_panel_status": Object.freeze({
      source: Object.freeze([_rangeDependency_("sendPanelInputs", "SEND_PANEL", "A:D_data_rows", ["display"], [["fml", "text"], ["phone", "text"], ["code", "text"], ["tasks", "text"]], ["columnsEtoG", "formatting", "emptyTail"])]),
      result: Object.freeze([_rangeDependency_("sendPanelStatus", "SEND_PANEL", "E_data_rows", ["display"], [["status", "text"]], ["columnsFtoG", "formatting", "emptyTail"])]),
    }),
    "computed.operation_summary": Object.freeze({
      source: Object.freeze([
        _injectedDependency_("computedStageEvidence", [["stageId", "text"], ["attempted", "boolean"], ["resultPresent", "boolean"], ["status", "text"]], ["rawResult", "scope", "scopeKnown", "skipPredicateSatisfied"]),
        _injectedDependency_("computedCanonicalScopes", [["stageId", "text"], ["skipWhen", "text"], ["scope", "identity"]], ["evidenceScope", "callerSkipBoolean"]),
      ]),
      result: Object.freeze([_injectedDependency_("computedRunSummary", [["status", "text"], ["isFullSuccess", "boolean"], ["decision", "identity"], ["reasonCodes", "identity"], ["unknownStageIds", "identity"], ["failedStageIds", "identity"], ["hasUnknownEvidence", "boolean"], ["hasConfirmedFailure", "boolean"]], ["rawStages"])]),
    }),
    "month_journal.target_resolution": Object.freeze({
      source: Object.freeze([_injectedDependency_("monthTargetContext", [["monthSheet", "text"], ["month", "text"], ["activeMonthProperty", "text"], ["clockMonth", "text"], ["targetSheet", "text"], ["existingSheetNames", "identity"], ["activeSheetName", "text"]], ["formatting"])]),
      result: Object.freeze([_injectedDependency_("monthTargetResult", [["targetMonth", "text"], ["sheetExists", "boolean"]], [])]),
    }),
    "month_journal.source_projection": Object.freeze({
      source: Object.freeze([
        _rangeDependency_("monthSource", "target_month", "layout_codes_dates_callsign_notes", ["values", "display"], [["code", "text"], ["dateRaw", "identity"], ["dateDisplay", "text"], ["callsign", "text"], ["note", "text"], ["layoutGeometry", "identity"], ["headerAliases", "identity"]], ["formatting", "outsideLayout", "emptyCode", "emptyCallsign"]),
        _rangeDependency_("dictSum", "DICT_SUM", "full_data_range", ["display"], [["headerAliases", "identity"], ["code", "text"], ["label", "text"], ["order", "number"], ["showZero", "boolean"]], ["formatting", "emptyTail"]),
        _rangeDependency_("dict", "DICT", "canonical_fields", ["display"], [["code", "text"], ["label", "text"], ["place", "text"], ["task", "text"]], ["formatting", "emptyTail"]),
        _rangeDependency_("monthPersonnel", "PERSONNEL", "repository_rows", ["values", "display"], [["callsign", "text"], ["fml", "space_text"], ["rank", "text"], ["title", "text"], ["position", "text"], ["status", "text"]], commonIgnored),
        _injectedDependency_("monthSourceContext", [["dateRow", "number"], ["timezone", "text"]], []),
      ]),
      result: Object.freeze([_injectedDependency_("journalRows", [["month", "text"], ["date", "text"], ["dayNumber", "number"], ["callsign", "text"], ["fml", "space_text"], ["rank", "text"], ["position", "text"], ["code", "text"], ["shortLabel", "text"], ["serviceType", "text"], ["place", "text"], ["task", "text"], ["note", "text"], ["sourceRow", "number"], ["unknownCode", "boolean"]], ["formatting"])]),
    }),
    "month_journal.journal_slice": Object.freeze({
      source: Object.freeze([_injectedDependency_("journalTransition", [["journalRows", "identity"]], []), _rangeDependency_("journalBefore", "JOURNAL", "headers_and_all_rows", ["display"], [["headers", "identity"], ["month", "text"], ["row", "identity"]], ["formatting", "emptyTail"], "mutable_target_prior_state")]),
      result: Object.freeze([_rangeDependency_("journalAfter", "JOURNAL", "canonical_headers_and_target_slice", ["display"], [["headers", "identity"], ["month", "text"], ["date", "text"], ["callsign", "text"], ["fml", "space_text"], ["rank", "text"], ["position", "text"], ["code", "text"], ["shortLabel", "text"], ["serviceType", "text"], ["place", "text"], ["task", "text"], ["note", "text"], ["source", "text"]], ["formatting", "nonTargetRows", "emptyTail"])]),
    }),
    "month_journal.summary_slice": Object.freeze({
      source: Object.freeze([_injectedDependency_("summaryTransition", [["journalRows", "identity"]], []), _rangeDependency_("summaryDictSum", "DICT_SUM", "full_data_range", ["display"], [["headerAliases", "identity"], ["code", "text"], ["label", "text"], ["order", "number"], ["showZero", "boolean"]], ["formatting", "emptyTail"]), _rangeDependency_("summaryBefore", "SUMMARY", "headers_and_all_rows", ["values", "display"], [["headers", "identity"], ["month", "text"], ["row", "identity"]], ["formatting", "emptyTail"], "mutable_target_prior_state")]),
      result: Object.freeze([_rangeDependency_("summaryAfter", "SUMMARY", "global_headers_and_target_slice", ["values", "display"], [["headers", "identity"], ["month", "text"], ["callsign", "text"], ["fml", "space_text"], ["rank", "text"], ["position", "text"], ["codeColumns", "identity"], ["other", "number"], ["total", "number"]], ["formatting", "nonTargetRows", "emptyTail"])]),
    }),
    "month_journal.non_target_preservation": Object.freeze({
      source: Object.freeze([_injectedDependency_("preservationReads", [["beforeJournalHeaders", "identity"], ["beforeJournalRows", "identity"], ["afterJournalHeaders", "identity"], ["afterJournalRows", "identity"], ["beforeSummaryHeaders", "identity"], ["beforeSummaryRows", "identity"], ["afterSummaryHeaders", "identity"], ["afterSummaryRows", "identity"]], ["targetRows", "formatting"], "preservation_baseline")]),
      result: Object.freeze([_injectedDependency_("preservationResult", [["journalStable", "boolean"], ["summaryStable", "boolean"], ["headersChanged", "boolean"], ["ambiguous", "boolean"]], ["rawRows"])]),
    }),
    "month_journal.operation_summary": Object.freeze({
      source: Object.freeze([_injectedDependency_("monthStageEvidence", [["stageId", "text"], ["attempted", "boolean"], ["resultPresent", "boolean"], ["status", "text"]], ["rawResult", "scope", "scopeKnown", "skipPredicateSatisfied"])]),
      result: Object.freeze([_injectedDependency_("monthRunSummary", [["status", "text"], ["isFullSuccess", "boolean"], ["decision", "identity"], ["reasonCodes", "identity"], ["unknownStageIds", "identity"], ["failedStageIds", "identity"], ["hasUnknownEvidence", "boolean"], ["hasConfirmedFailure", "boolean"]], ["rawStages"])]),
    }),
  });

  function _stageCost_(maxSpreadsheetCalls, maxRangeReads, maxCells, maxBytes) {
    return Object.freeze({
      maxSpreadsheetCalls: maxSpreadsheetCalls,
      maxRangeReads: maxRangeReads,
      maxCells: maxCells,
      maxBytes: maxBytes,
      maxProjectionBytes: Math.min(
        maxBytes || SYSTEM_STATUS_FINGERPRINT_MAX_PROJECTION_BYTES_,
        SYSTEM_STATUS_FINGERPRINT_MAX_PROJECTION_BYTES_,
      ),
    });
  }

  var SYSTEM_STATUS_FINGERPRINT_STAGE_COSTS_ = Object.freeze({
    "computed.personnel_helpers": _stageCost_(6, 3, 992, 120000),
    "computed.phones_result": _stageCost_(3, 2, 99, 24000),
    "computed.birthday_result": _stageCost_(4, 2, 132, 32000),
    "computed.monthly_callsigns": _stageCost_(48, 38, 1152, 160000),
    "computed.assignment_car": _stageCost_(5, 2, 1600, 180000),
    "computed.assignment_weapon": _stageCost_(8, 4, 1200, 180000),
    "computed.vacation_computed": _stageCost_(5, 3, 1170, 140000),
    "computed.vacation_schedule": _stageCost_(80, 56, 16000, 1200000),
    "computed.vacation_monthly_sync": _stageCost_(14, 10, 4600, 560000),
    "computed.send_panel_status": _stageCost_(5, 3, 1400, 180000),
    "computed.operation_summary": _stageCost_(0, 0, 0, 16000),
    "month_journal.target_resolution": _stageCost_(4, 0, 0, 8000),
    "month_journal.source_projection": _stageCost_(15, 11, 4200, 480000),
    "month_journal.journal_slice": _stageCost_(8, 4, 8500, 900000),
    "month_journal.summary_slice": _stageCost_(9, 5, 8500, 900000),
    "month_journal.non_target_preservation": _stageCost_(0, 0, 0, 1800000),
    "month_journal.operation_summary": _stageCost_(0, 0, 0, 16000),
  });

  var SYSTEM_STATUS_FINGERPRINT_TRANSITION_POLICIES_ = Object.freeze({
    "computed.assignment_car": Object.freeze({
      mode: "cell_patch",
      rowKeyField: "rowKey",
      reorderPolicy: "reject",
      writableFields: Object.freeze(["ownerFml", "helperCallsign"]),
      preservedFields: Object.freeze(["rowKey", "columnsBtoG"]),
    }),
    "computed.assignment_weapon": Object.freeze({
      mode: "cell_patch",
      rowKeyField: "rowKey",
      reorderPolicy: "reject",
      writableFields: Object.freeze([
        "lastName", "firstName", "patronymic", "rank", "phone", "callsign",
      ]),
      preservedFields: Object.freeze(["rowKey", "columnsFtoZ"]),
    }),
    "computed.vacation_monthly_sync": Object.freeze({
      mode: "vacation_monthly_atomic",
      rowKeyField: "cellKey",
      reorderPolicy: "reject",
      writableFields: Object.freeze(["cellValue", "cellDisplay"]),
      preservedFields: Object.freeze([
        "cellKey", "validationAllowed", "note", "dateRaw", "dateDisplay",
        "callsign", "fml",
      ]),
      structuredProofs: Object.freeze([
        "targetCells", "metadata", "pendingPlan", "conflicts",
      ]),
      missingProofState: "unknown",
      presentMismatchState: "failed",
      expectedBindingSource: "trusted_execution_context",
      expectedBindingArgument: "trustedExecutionContext",
      expectedBindingBuilder: "buildExpectedBindingFromTrustedContext",
      derivedFromEvidenceAllowed: false,
      evidenceExpectedBindingUsed: false,
      evidenceTrustedContextUsed: false,
      stageWrapperTrustedContextArgument: "trustedExecutionContext",
      operationWrapperTrustedContextArgument: "trustedContextMap",
      structuredStatusPropagation: true,
      digestValidationBeforeComparison: true,
    }),
    "month_journal.journal_slice": Object.freeze({
      mode: "target_slice_replace",
      remapNonTargetByHeader: false,
    }),
    "month_journal.summary_slice": Object.freeze({
      mode: "target_slice_replace",
      remapNonTargetByHeader: true,
    }),
    "month_journal.non_target_preservation": Object.freeze({
      mode: "preservation_only",
    }),
    "computed.personnel_helpers": Object.freeze({
      mode: "birthday_semantic_patch",
      rowKeyField: "rowKey",
      reorderPolicy: "reject",
      writableFields: Object.freeze(["birthdaySemantic"]),
      preservedFields: Object.freeze(["rowKey"]),
      semanticInvariant: "prior_equals_expected_equals_post",
      emptySemanticState: "eligible_noop",
      invalidSemanticState: "failed",
    }),
  });

  var SYSTEM_STATUS_FINGERPRINT_WRITER_LOCK_CONTRACT_ = Object.freeze({
    currentRuntime: Object.freeze({
      public: Object.freeze({
        caller: "apiStage7MaterializeComputedData",
        writer: "materializeAllComputedData_",
        state: "locked_by_workflow_orchestrator",
      }),
      daily: Object.freeze({
        caller: "checkVacationsAndBirthdays",
        writer: "materializeAllComputedData_",
        state: "locked_by_daily_caller",
        workflowWrite: false,
        workflowLock: false,
        dailyCallerAcquiresDocumentLock: true,
      }),
    }),
    requiredSs2bIntegration: Object.freeze({
      public: Object.freeze({
        acquisition: "already_locked",
        lockOwner: "workflow_orchestrator",
        sharedCoreAcquiresLock: false,
        nestedAcquireAllowed: false,
      }),
      daily: Object.freeze({
        acquisition: "acquire_document_lock",
        lockOwner: "daily_caller",
        sharedCoreAcquiresLock: false,
        nestedAcquireAllowed: false,
      }),
    }),
  });

  function _dependencyWithRole_(dependency, role) {
    return Object.freeze(Object.assign({}, dependency, {
      evidenceRole: String(role || dependency.evidenceRole || "immutable_input"),
    }));
  }

  var executableRegistry = {};
  Object.keys(SYSTEM_STATUS_FINGERPRINT_EXECUTABLE_MANIFEST_).forEach(function (stageId) {
    var dependencies = SYSTEM_STATUS_FINGERPRINT_EXECUTABLE_MANIFEST_[stageId];
    executableRegistry[stageId] = Object.freeze({
      source: dependencies.source,
      result: Object.freeze(dependencies.result.map(function (dependency) {
        return _dependencyWithRole_(dependency, "result");
      })),
      cost: SYSTEM_STATUS_FINGERPRINT_STAGE_COSTS_[stageId],
      transitionPolicy: SYSTEM_STATUS_FINGERPRINT_TRANSITION_POLICIES_[stageId] ||
        Object.freeze({ mode: "immutable_only" }),
    });
  });
  var SYSTEM_STATUS_FINGERPRINT_EXECUTABLE_REGISTRY_ = Object.freeze(executableRegistry);

  function _hasOwn_(value, key) {
    return Object.prototype.hasOwnProperty.call(value || {}, key);
  }

  function _codeUnitCompare_(left, right) {
    var a = String(left);
    var b = String(right);
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  }

  function _utf8Bytes_(value) {
    var text = String(value || "");
    var bytes = [];
    for (var i = 0; i < text.length; i++) {
      var code = text.charCodeAt(i);
      if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
        var low = text.charCodeAt(i + 1);
        if (low >= 0xdc00 && low <= 0xdfff) {
          code = 0x10000 + ((code - 0xd800) << 10) + (low - 0xdc00);
          i++;
        }
      }
      if (code < 0x80) {
        bytes.push(code);
      } else if (code < 0x800) {
        bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
      } else if (code < 0x10000) {
        bytes.push(
          0xe0 | (code >> 12),
          0x80 | ((code >> 6) & 0x3f),
          0x80 | (code & 0x3f),
        );
      } else {
        bytes.push(
          0xf0 | (code >> 18),
          0x80 | ((code >> 12) & 0x3f),
          0x80 | ((code >> 6) & 0x3f),
          0x80 | (code & 0x3f),
        );
      }
    }
    return bytes;
  }

  function _rotr_(value, bits) {
    return (value >>> bits) | (value << (32 - bits));
  }

  function _sha256_() {
    var state = [
      0x6a09e667,
      0xbb67ae85,
      0x3c6ef372,
      0xa54ff53a,
      0x510e527f,
      0x9b05688c,
      0x1f83d9ab,
      0x5be0cd19,
    ];
    var constants = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b,
      0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01,
      0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7,
      0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
      0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152,
      0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
      0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc,
      0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
      0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08,
      0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f,
      0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
      0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ];
    var buffer = [];
    var lengthBytes = 0;

    function process_(block) {
      var words = new Array(64);
      for (var i = 0; i < 16; i++) {
        var offset = i * 4;
        words[i] =
          ((block[offset] << 24) |
            (block[offset + 1] << 16) |
            (block[offset + 2] << 8) |
            block[offset + 3]) |
          0;
      }
      for (var j = 16; j < 64; j++) {
        var w15 = words[j - 15];
        var w2 = words[j - 2];
        var s0 = _rotr_(w15, 7) ^ _rotr_(w15, 18) ^ (w15 >>> 3);
        var s1 = _rotr_(w2, 17) ^ _rotr_(w2, 19) ^ (w2 >>> 10);
        words[j] = (words[j - 16] + s0 + words[j - 7] + s1) | 0;
      }
      var a = state[0];
      var b = state[1];
      var c = state[2];
      var d = state[3];
      var e = state[4];
      var f = state[5];
      var g = state[6];
      var h = state[7];
      for (var k = 0; k < 64; k++) {
        var big1 = _rotr_(e, 6) ^ _rotr_(e, 11) ^ _rotr_(e, 25);
        var choose = (e & f) ^ (~e & g);
        var temp1 = (h + big1 + choose + constants[k] + words[k]) | 0;
        var big0 = _rotr_(a, 2) ^ _rotr_(a, 13) ^ _rotr_(a, 22);
        var majority = (a & b) ^ (a & c) ^ (b & c);
        var temp2 = (big0 + majority) | 0;
        h = g;
        g = f;
        f = e;
        e = (d + temp1) | 0;
        d = c;
        c = b;
        b = a;
        a = (temp1 + temp2) | 0;
      }
      state[0] = (state[0] + a) | 0;
      state[1] = (state[1] + b) | 0;
      state[2] = (state[2] + c) | 0;
      state[3] = (state[3] + d) | 0;
      state[4] = (state[4] + e) | 0;
      state[5] = (state[5] + f) | 0;
      state[6] = (state[6] + g) | 0;
      state[7] = (state[7] + h) | 0;
    }

    function updateBytes_(bytes) {
      lengthBytes += bytes.length;
      for (var i = 0; i < bytes.length; i++) {
        buffer.push(bytes[i] & 0xff);
        if (buffer.length === 64) {
          process_(buffer);
          buffer = [];
        }
      }
    }

    function finishHex_() {
      var bitHigh = Math.floor(lengthBytes / 0x20000000);
      var bitLow = (lengthBytes << 3) >>> 0;
      buffer.push(0x80);
      while (buffer.length % 64 !== 56) buffer.push(0);
      buffer.push(
        (bitHigh >>> 24) & 0xff,
        (bitHigh >>> 16) & 0xff,
        (bitHigh >>> 8) & 0xff,
        bitHigh & 0xff,
        (bitLow >>> 24) & 0xff,
        (bitLow >>> 16) & 0xff,
        (bitLow >>> 8) & 0xff,
        bitLow & 0xff,
      );
      while (buffer.length) {
        process_(buffer.slice(0, 64));
        buffer = buffer.slice(64);
      }
      return state
        .map(function (word) {
          return ("00000000" + (word >>> 0).toString(16)).slice(-8);
        })
        .join("");
    }

    return { updateBytes: updateBytes_, finishHex: finishHex_ };
  }

  function _digestCanonical_(value, options) {
    var opts = options || {};
    var chunkBytes = Number(opts.chunkBytes) ||
      SYSTEM_STATUS_FINGERPRINT_DEFAULT_CHUNK_BYTES_;
    var maxBytes = Number(opts.maxProjectionBytes) ||
      SYSTEM_STATUS_FINGERPRINT_MAX_PROJECTION_BYTES_;
    if (chunkBytes < 64 || chunkBytes > SYSTEM_STATUS_FINGERPRINT_MAX_CHUNK_BYTES_) {
      throw new Error("Fingerprint chunkBytes outside SS-2A bounds");
    }
    var sha = _sha256_();
    var pending = [];
    var counters = { bytes: 0, chunks: 0, maxChunkBytes: 0 };
    var seen = [];

    function flush_(force) {
      while (pending.length >= chunkBytes || (force && pending.length)) {
        var size = force ? Math.min(chunkBytes, pending.length) : chunkBytes;
        var chunk = pending.slice(0, size);
        pending = pending.slice(size);
        sha.updateBytes(chunk);
        counters.bytes += chunk.length;
        counters.chunks++;
        counters.maxChunkBytes = Math.max(counters.maxChunkBytes, chunk.length);
      }
    }

    function write_(text) {
      var bytes = _utf8Bytes_(text);
      if (counters.bytes + pending.length + bytes.length > maxBytes) {
        throw new Error("Fingerprint projection-byte budget exceeded");
      }
      pending = pending.concat(bytes);
      flush_(false);
    }

    function visit_(item) {
      if (item === null) {
        write_("z;");
        return;
      }
      if (item instanceof Date) {
        if (isNaN(item.getTime())) throw new Error("Invalid Date in fingerprint projection");
        write_("d" + String(item.getTime()) + ";");
        return;
      }
      var type = typeof item;
      if (type === "string") {
        var stringBytes = _utf8Bytes_(item);
        write_("s" + stringBytes.length + ":");
        if (counters.bytes + pending.length + stringBytes.length > maxBytes) {
          throw new Error("Fingerprint projection-byte budget exceeded");
        }
        pending = pending.concat(stringBytes);
        flush_(false);
        write_(";");
        return;
      }
      if (type === "number") {
        if (!isFinite(item)) throw new Error("Non-finite number in fingerprint projection");
        write_("n" + String(Object.is(item, -0) ? 0 : item) + ";");
        return;
      }
      if (type === "boolean") {
        write_(item ? "b1;" : "b0;");
        return;
      }
      if (type === "undefined" || type === "function" || type === "symbol") {
        throw new Error("Unsupported value in fingerprint projection: " + type);
      }
      if (seen.indexOf(item) !== -1) throw new Error("Cyclic fingerprint projection");
      seen.push(item);
      if (Array.isArray(item)) {
        write_("a" + item.length + "[");
        for (var i = 0; i < item.length; i++) visit_(item[i]);
        write_("]");
      } else {
        var keys = Object.keys(item).sort(_codeUnitCompare_);
        write_("o" + keys.length + "{");
        for (var j = 0; j < keys.length; j++) {
          visit_(keys[j]);
          visit_(item[keys[j]]);
        }
        write_("}");
      }
      seen.pop();
    }

    visit_(value);
    flush_(true);
    return {
      digest: "sha256:" + sha.finishHex(),
      bytes: counters.bytes,
      chunks: counters.chunks,
      maxChunkBytes: counters.maxChunkBytes,
    };
  }

  function _normalize_(value, normalizer) {
    var name = String(normalizer || "identity");
    if (name === "identity") return value == null ? "" : value;
    if (name === "text") return String(value == null ? "" : value).trim();
    if (name === "space_text") {
      return String(value == null ? "" : value).trim().replace(/\s+/g, " ");
    }
    if (name === "upper_key") {
      return String(value == null ? "" : value).trim().replace(/\s+/g, " ").toUpperCase();
    }
    if (name === "phone") {
      var digits = String(value == null ? "" : value).replace(/\D/g, "");
      return digits ? "+" + digits : "";
    }
    if (name === "number") {
      if (value === "" || value === null || typeof value === "undefined") return "";
      var number = Number(value);
      return isFinite(number) ? number : "";
    }
    if (name === "boolean") {
      if (value === "" || value === null || typeof value === "undefined") return "";
      return value === true || String(value).toLowerCase() === "true";
    }
    if (name === "date_day") {
      if (value instanceof Date && !isNaN(value.getTime())) {
        return [value.getFullYear(), value.getMonth() + 1, value.getDate()]
          .map(function (part, index) {
            return index === 0 ? String(part) : String(part).padStart(2, "0");
          })
          .join("-");
      }
      return String(value == null ? "" : value).trim();
    }
    if (name === "birthday_day") return _birthdaySemanticDay_(value);
    throw new Error("Unknown fingerprint normalizer: " + name);
  }

  function _birthdaySemanticDay_(value) {
    if (value instanceof Date && !isNaN(value.getTime())) {
      return {
        state: "valid",
        day: [value.getFullYear(), value.getMonth() + 1, value.getDate()]
        .map(function (part, index) {
          return index === 0 ? String(part) : String(part).padStart(2, "0");
        })
        .join("-"),
      };
    }
    var text = String(value == null ? "" : value).trim();
    text = text.replace(/\s*р\.?\s*н\.?\s*$/i, "").trim();
    while (/р\.$/.test(text)) text = text.replace(/р\.$/, "").trim();
    if (!text) return { state: "empty", day: "" };
    var match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (!match) {
      var ua = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
      if (ua) match = [ua[0], ua[3], ua[2], ua[1]];
    }
    if (!match) return { state: "invalid", day: "" };
    var year = Number(match[1]);
    var month = Number(match[2]);
    var day = Number(match[3]);
    var date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      return { state: "invalid", day: "" };
    }
    return {
      state: "valid",
      day: String(year).padStart(4, "0") + "-" +
        String(month).padStart(2, "0") + "-" + String(day).padStart(2, "0"),
    };
  }

  function _validBirthdaySemantic_(value) {
    if (!value || typeof value !== "object") return false;
    if (value.state === "empty") return value.day === "";
    if (value.state === "invalid") return value.day === "";
    return value.state === "valid" && _validCalendarDay_(value.day);
  }

  function _validCalendarDay_(value) {
    var match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return false;
    var year = Number(match[1]);
    var month = Number(match[2]);
    var day = Number(match[3]);
    var date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 &&
      date.getDate() === day;
  }

  function _semanticEmpty_(value) {
    return value && typeof value === "object" &&
      value.state === "empty" && value.day === "";
  }

  function _rowEmpty_(row) {
    return Object.keys(row || {}).every(function (key) {
      var value = row[key];
      return value === "" || value === null || typeof value === "undefined" ||
        _semanticEmpty_(value);
    });
  }

  function projectRows_(input, policy) {
    var source = input || {};
    var spec = policy || {};
    var fields = Array.isArray(spec.fields) ? spec.fields : [];
    var rows = Array.isArray(source.rows) ? source.rows : [];
    var projected = rows.map(function (row) {
      var out = {};
      fields.forEach(function (field) {
        var raw = Array.isArray(row) ? row[Number(field.index)] : row && row[field.name];
        out[field.name] = _normalize_(raw, field.normalizer);
      });
      return out;
    });
    if (spec.ignoreEmptyTail === true) {
      while (projected.length && _rowEmpty_(projected[projected.length - 1])) {
        projected.pop();
      }
    }
    if (spec.order === "stable_key") {
      var keyFields = Array.isArray(spec.stableKeyFields) ? spec.stableKeyFields : [];
      projected.sort(function (left, right) {
        var a = keyFields.map(function (key) { return String(left[key] || ""); }).join("\u0000");
        var b = keyFields.map(function (key) { return String(right[key] || ""); }).join("\u0000");
        return _codeUnitCompare_(a, b);
      });
    }
    if (spec.duplicates === "reject") {
      var seenKeys = {};
      var duplicateFields = spec.stableKeyFields || [];
      projected.forEach(function (row) {
        var key = duplicateFields.map(function (field) { return String(row[field] || ""); }).join("\u0000");
        if (_hasOwn_(seenKeys, key)) throw new Error("Duplicate stable key in fingerprint projection");
        seenKeys[key] = true;
      });
    }
    return {
      schemaVersion: String(spec.schemaVersion || "projection-v1"),
      order: String(spec.order || "semantic"),
      duplicates: String(spec.duplicates || "preserve"),
      headers: Array.isArray(source.headers)
        ? source.headers.map(function (value) { return String(value == null ? "" : value).trim(); })
        : [],
      context: source.context || {},
      rows: projected,
    };
  }

  function _stageVersion_(stageId) {
    var id = String(stageId || "");
    var version = SYSTEM_STATUS_FINGERPRINT_STAGE_VERSIONS_[id];
    if (!version) throw new Error("Unknown fingerprint stage: " + id);
    return version;
  }

  function buildFingerprint_(stageId, kind, projection, options) {
    var payload = {
      algorithm: SYSTEM_STATUS_FINGERPRINT_ALGORITHM_VERSION_,
      stageId: String(stageId || ""),
      stageVersion: _stageVersion_(stageId),
      kind: String(kind || "source"),
      projection: projection,
    };
    var hashed = _digestCanonical_(payload, options || {});
    return {
      stageId: payload.stageId,
      stageVersion: payload.stageVersion,
      algorithmVersion: payload.algorithm,
      kind: payload.kind,
      fingerprint: hashed.digest,
      bytesHashed: hashed.bytes,
      chunkCount: hashed.chunks,
      maxChunkBytes: hashed.maxChunkBytes,
    };
  }

  function projectMonthSlice_(input) {
    var source = input || {};
    var target = String(source.targetMonth || "").trim();
    var headers = (source.headers || []).map(function (value) {
      return String(value == null ? "" : value).trim();
    });
    var monthIndex = Number(source.monthColumnIndex) || 0;
    var rows = Array.isArray(source.rows) ? source.rows : [];
    var targetRows = [];
    var nonTargetRows = [];
    rows.forEach(function (row) {
      var copy = (row || []).slice(0, headers.length);
      while (copy.length < headers.length) copy.push("");
      var hasValue = copy.some(function (value) {
        return String(value == null ? "" : value).trim() !== "";
      });
      if (!hasValue) return;
      if (String(copy[monthIndex] || "").trim() === target) targetRows.push(copy);
      else nonTargetRows.push(copy);
    });
    return {
      headers: headers,
      targetMonth: target,
      monthColumnIndex: monthIndex,
      targetRows: targetRows,
      nonTargetRows: nonTargetRows,
    };
  }

  function buildMonthResultFingerprint_(stageId, input, options) {
    var projected = projectMonthSlice_(input);
    return buildFingerprint_(stageId, "result", {
      headers: projected.headers,
      targetMonth: projected.targetMonth,
      targetRows: projected.targetRows,
    }, options);
  }

  function _preservationHeaderKey_(value) {
    return String(value == null ? "" : value)
      .trim()
      .toLowerCase()
      .replace(/[’'`"ʼ]/g, "")
      .replace(/\s+/g, " ");
  }

  function _preservationHeaderIdentities_(headers) {
    var counts = {};
    return (headers || []).map(function (header) {
      var key = _preservationHeaderKey_(header);
      counts[key] = (counts[key] || 0) + 1;
      return key ? key + "#" + counts[key] : "";
    });
  }

  function _remapPreservationRows_(projection, unionHeaders) {
    var headers = projection.headers || [];
    var indexByHeader = {};
    _preservationHeaderIdentities_(headers).forEach(function (key, index) {
      if (key) indexByHeader[key] = index;
    });
    return (projection.nonTargetRows || []).map(function (row) {
      return unionHeaders.map(function (key) {
        var index = indexByHeader[key];
        return typeof index === "number" && row[index] != null ? row[index] : "";
      });
    });
  }

  function simulateMonthPreservation_(beforeInput, afterInput, options) {
    var before = projectMonthSlice_(beforeInput);
    var after = projectMonthSlice_(afterInput);
    var opts = options || {};
    var beforeEvidence = { headers: before.headers, rows: before.nonTargetRows };
    var afterEvidence = { headers: after.headers, rows: after.nonTargetRows };
    if (opts.remapByHeaderName === true) {
      var union = _preservationHeaderIdentities_(before.headers)
        .concat(_preservationHeaderIdentities_(after.headers))
        .filter(function (value, index, values) {
          return value && values.indexOf(value) === index;
        })
        .sort(_codeUnitCompare_);
      beforeEvidence = {
        canonicalHeaders: union,
        rows: _remapPreservationRows_(before, union),
      };
      afterEvidence = {
        canonicalHeaders: union,
        rows: _remapPreservationRows_(after, union),
      };
    }
    var beforeHash = _digestCanonical_(beforeEvidence, opts);
    var afterHash = _digestCanonical_(afterEvidence, opts);
    var headersChanged =
      _digestCanonical_(before.headers, opts).digest !==
      _digestCanonical_(after.headers, opts).digest;
    return {
      stable: beforeHash.digest === afterHash.digest,
      headersChanged: headersChanged,
      beforeFingerprint: beforeHash.digest,
      afterFingerprint: afterHash.digest,
    };
  }

  function createExecutionContext_(options) {
    var opts = options || {};
    if (!opts.adapter || typeof opts.adapter.readRange !== "function") {
      throw new Error("Fingerprint execution context requires adapter.readRange");
    }
    return {
      adapter: opts.adapter,
      spreadsheetId: String(opts.spreadsheetId || "active"),
      injected: opts.injected || {},
      limits: {
        maxSpreadsheetCalls: Number(opts.maxSpreadsheetCalls) || 96,
        maxRangeReads: Number(opts.maxRangeReads) || 64,
        maxCellsRead: Number(opts.maxCellsRead) || 40000,
        maxBytesRead: Number(opts.maxBytesRead) || 4000000,
        maxProjectionBytes: Number(opts.maxProjectionBytes) ||
          SYSTEM_STATUS_FINGERPRINT_MAX_PROJECTION_BYTES_,
        maxProjectionBytesTotal: Number(opts.maxProjectionBytesTotal) || 4000000,
      },
      cache: {},
      counters: {
        spreadsheetCalls: 0,
        rangeReads: 0,
        cacheHits: 0,
        cacheMisses: 0,
        cellsRead: 0,
        bytesRead: 0,
        projectionBytes: 0,
        injectedReads: 0,
      },
    };
  }

  function _cloneValue_(value) {
    if (value === null || typeof value !== "object") return value;
    if (value instanceof Date) return new Date(value.getTime());
    if (Array.isArray(value)) {
      return value.map(function (item) { return _cloneValue_(item); });
    }
    var out = {};
    Object.keys(value).forEach(function (key) {
      out[key] = _cloneValue_(value[key]);
    });
    return out;
  }

  function _freezeValue_(value) {
    if (!value || typeof value !== "object") return value;
    Object.keys(value).forEach(function (key) { _freezeValue_(value[key]); });
    return Object.freeze(value);
  }

  function _rangeCacheKey_(context, request) {
    return [
      context.spreadsheetId,
      String(request.sheet || ""),
      String(request.range || ""),
      String(request.readMode || "values"),
      String(request.projectionVersion || "v1"),
    ].map(function (part) {
      var text = String(part);
      return String(text.length) + ":" + text;
    }).join("");
  }

  function _evidenceError_(code, dependencyId) {
    var error = new Error(String(code || "evidence_unavailable"));
    error.evidenceCode = String(code || "evidence_unavailable");
    error.dependencyId = String(dependencyId || "");
    return error;
  }

  function readRange_(context, request) {
    var ctx = context || {};
    var req = request || {};
    var key = _rangeCacheKey_(ctx, req);
    if (_hasOwn_(ctx.cache, key)) {
      ctx.counters.cacheHits++;
      return _cloneValue_(ctx.cache[key]);
    }
    var spreadsheetCalls = Number(req.spreadsheetCalls) || 1;
    var rangeReads = Number(req.rangeReads) || 1;
    if (ctx.counters.spreadsheetCalls + spreadsheetCalls > ctx.limits.maxSpreadsheetCalls) {
      throw new Error("Fingerprint Spreadsheet-call budget exceeded");
    }
    if (ctx.counters.rangeReads + rangeReads > ctx.limits.maxRangeReads) {
      throw new Error("Fingerprint range-read budget exceeded");
    }
    ctx.counters.spreadsheetCalls += spreadsheetCalls;
    ctx.counters.rangeReads += rangeReads;
    ctx.counters.cacheMisses++;
    var rawValue;
    try {
      rawValue = ctx.adapter.readRange({
        spreadsheetId: ctx.spreadsheetId,
        sheet: String(req.sheet || ""),
        range: String(req.range || ""),
        readMode: String(req.readMode || "values"),
        projectionVersion: String(req.projectionVersion || "v1"),
      });
    } catch (_) {
      throw _evidenceError_("adapter_read_failed", req.dependencyId);
    }
    var value;
    if (Array.isArray(rawValue)) {
      value = rawValue;
    } else if (
      rawValue && typeof rawValue === "object" && rawValue.available === true &&
      Array.isArray(rawValue.rows)
    ) {
      value = rawValue.rows;
    } else {
      throw _evidenceError_("range_unavailable", req.dependencyId);
    }
    var rows = Array.isArray(value) ? value : [];
    var cells = rows.reduce(function (sum, row) {
      return sum + (Array.isArray(row) ? row.length : Object.keys(row || {}).length || 1);
    }, 0);
    var bytes = _utf8Bytes_(JSON.stringify(value == null ? null : value)).length;
    if (ctx.counters.cellsRead + cells > ctx.limits.maxCellsRead) {
      throw new Error("Fingerprint cell-read budget exceeded");
    }
    if (ctx.counters.bytesRead + bytes > ctx.limits.maxBytesRead) {
      throw new Error("Fingerprint byte-read budget exceeded");
    }
    ctx.counters.cellsRead += cells;
    ctx.counters.bytesRead += bytes;
    ctx.cache[key] = _freezeValue_(_cloneValue_(value));
    return _cloneValue_(ctx.cache[key]);
  }

  function readInjected_(context, key) {
    var ctx = context || {};
    var name = String(key || "");
    ctx.counters.injectedReads++;
    return _hasOwn_(ctx.injected, name) ? _cloneValue_(ctx.injected[name]) : null;
  }

  function _projectDependencyRows_(value, dependency, mode) {
    var rows = Array.isArray(value) ? value : [value || {}];
    return projectRows_({ rows: rows }, {
      schemaVersion: dependency.id + "-" + mode + "-v1",
      order: dependency.order,
      duplicates: dependency.duplicates,
      ignoreEmptyTail: dependency.ignoreEmptyTail,
      fields: dependency.fields.map(function (field, index) {
        return { name: field[0], index: index, normalizer: field[1] };
      }),
    });
  }

  function buildStageProjection_(stageId, kind, context, bindings, evidenceRole) {
    var id = String(stageId || "");
    var projectionKind = kind === "result" ? "result" : "source";
    var stage = SYSTEM_STATUS_FINGERPRINT_EXECUTABLE_REGISTRY_[id];
    if (!stage) throw new Error("Unknown executable fingerprint stage: " + id);
    var role = String(evidenceRole || "");
    var dependencies = (stage[projectionKind] || []).filter(function (dependency) {
      return !role || dependency.evidenceRole === role;
    });
    var resolvedBindings = bindings || {};
    return {
      manifestVersion: SYSTEM_STATUS_FINGERPRINT_MANIFEST_VERSION_,
      stageId: id,
      kind: projectionKind,
      evidenceRole: role || "all",
      dependencies: dependencies.map(function (dependency) {
        var valuesByMode = {};
        dependency.readModes.forEach(function (mode) {
          var value;
          if (dependency.kind === "range") {
            if (!_hasOwn_(resolvedBindings, dependency.id)) {
              if (dependency.required) {
                throw _evidenceError_("binding_missing", dependency.id);
              }
              valuesByMode[mode] = { available: false, optional: true };
              return;
            }
            var binding = resolvedBindings[dependency.id] || {};
            value = readRange_(context, {
              sheet: String(binding.sheet || dependency.sheet),
              range: String(binding.range || dependency.range),
              readMode: mode,
              projectionVersion: _stageVersion_(id) + ":" + dependency.id,
              spreadsheetCalls: binding.spreadsheetCalls,
              rangeReads: binding.rangeReads,
              dependencyId: dependency.id,
            });
          } else {
            if (!_hasOwn_(context.injected, dependency.id)) {
              if (dependency.required) {
                throw _evidenceError_("injected_missing", dependency.id);
              }
              valuesByMode[mode] = { available: false, optional: true };
              return;
            }
            value = readInjected_(context, dependency.id);
          }
          valuesByMode[mode] = _projectDependencyRows_(value, dependency, mode);
        });
        return {
          dependencyId: dependency.id,
          kind: dependency.kind,
          readModes: dependency.readModes.slice(),
          fields: dependency.fields.map(function (field) { return field.slice(); }),
          order: dependency.order,
          duplicates: dependency.duplicates,
          ignoredFields: dependency.ignoredFields.slice(),
          required: dependency.required,
          presence: dependency.presence,
          evidenceRole: dependency.evidenceRole,
          valuesByMode: valuesByMode,
        };
      }),
    };
  }

  function _counterSnapshot_(context) {
    var counters = context.counters || {};
    return {
      spreadsheetCalls: Number(counters.spreadsheetCalls) || 0,
      rangeReads: Number(counters.rangeReads) || 0,
      cellsRead: Number(counters.cellsRead) || 0,
      bytesRead: Number(counters.bytesRead) || 0,
      projectionBytes: Number(counters.projectionBytes) || 0,
    };
  }

  function _assertStageDeltas_(before, after, limits) {
    var configured = limits || {};
    [
      ["spreadsheetCalls", "maxSpreadsheetCalls"],
      ["rangeReads", "maxRangeReads"],
      ["cellsRead", "maxCells"],
      ["bytesRead", "maxBytes"],
      ["projectionBytes", "maxProjectionBytes"],
    ].forEach(function (pair) {
      if (!_hasOwn_(configured, pair[1])) return;
      if (after[pair[0]] - before[pair[0]] > Number(configured[pair[1]])) {
        throw _evidenceError_("stage_budget_" + pair[0], "");
      }
    });
  }

  function _effectiveStageLimits_(declared, requested) {
    var base = declared || {};
    var lower = requested || {};
    var out = {};
    ["maxSpreadsheetCalls", "maxRangeReads", "maxCells", "maxBytes", "maxProjectionBytes"]
      .forEach(function (key) {
        var contractValue = Number(base[key]);
        var requestedValue = Number(lower[key]);
        out[key] = isFinite(requestedValue) && requestedValue >= 0
          ? Math.min(contractValue, requestedValue)
          : contractValue;
      });
    return out;
  }

  function buildStageEvidence_(stageId, kind, context, bindings, options) {
    var opts = options || {};
    var before = _counterSnapshot_(context);
    var id = String(stageId || "");
    var projectionKind = kind === "result" ? "result" : "source";
    var stage = SYSTEM_STATUS_FINGERPRINT_EXECUTABLE_REGISTRY_[id];
    if (!stage) throw new Error("Unknown executable fingerprint stage: " + id);
    var stageLimits = _effectiveStageLimits_(stage.cost, opts.stageLimits);
    try {
      var projection = buildStageProjection_(
        id,
        projectionKind,
        context,
        bindings,
        opts.evidenceRole,
      );
      var requestedProjectionLimit = Number(opts.maxProjectionBytes);
      var fingerprint = buildFingerprint_(id, projectionKind, projection, {
        chunkBytes: opts.chunkBytes,
        maxProjectionBytes: Math.min(
          isFinite(requestedProjectionLimit) && requestedProjectionLimit >= 0
            ? requestedProjectionLimit
            : stageLimits.maxProjectionBytes,
          stageLimits.maxProjectionBytes,
          context.limits.maxProjectionBytes,
        ),
      });
      if (context.counters.projectionBytes + fingerprint.bytesHashed > context.limits.maxProjectionBytesTotal) {
        throw _evidenceError_("operation_budget_projectionBytes", "");
      }
      context.counters.projectionBytes += fingerprint.bytesHashed;
      var after = _counterSnapshot_(context);
      _assertStageDeltas_(before, after, stageLimits);
      return fingerprint;
    } catch (error) {
      var code = error && error.evidenceCode
        ? String(error.evidenceCode)
        : /budget/i.test(String(error && error.message || ""))
          ? "budget_exceeded"
          : "projection_error";
      return {
        stageId: id,
        stageVersion: _stageVersion_(id),
        algorithmVersion: SYSTEM_STATUS_FINGERPRINT_ALGORITHM_VERSION_,
        kind: projectionKind,
        status: code.indexOf("missing") !== -1 || code.indexOf("unavailable") !== -1 ||
          code.indexOf("read_failed") !== -1
          ? "unavailable"
          : "error",
        reason: code,
        dependencyId: error && error.dependencyId ? String(error.dependencyId) : "",
        fingerprint: null,
      };
    }
  }

  function simulateCacheInvalidation_(entries, writes) {
    var list = Array.isArray(entries) ? entries : [];
    var mutations = Array.isArray(writes) ? writes : [];
    var invalidated = [];
    list.forEach(function (entry) {
      var hit = mutations.some(function (write) {
        if (String(write.spreadsheetId || "") !== String(entry.spreadsheetId || "")) return false;
        if (String(write.sheet || "") !== String(entry.sheet || "")) return false;
        if (write.globalRewrite === true) return true;
        var affected = Array.isArray(write.affectedProjectionIds)
          ? write.affectedProjectionIds
          : [];
        return affected.indexOf(entry.projectionId) !== -1;
      });
      if (hit) invalidated.push(entry.cacheKey);
    });
    return invalidated.sort(_codeUnitCompare_);
  }

  function simulateSourceStability_(input) {
    var value = input || {};
    var pre = String(value.preFingerprint || "");
    var post = String(value.postFingerprint || "");
    var preOrigin = String(value.preReadOrigin || "live");
    var postOrigin = String(value.postReadOrigin || "live");
    var requiredAvailable = value.preRequiredAvailable === true &&
      value.postRequiredAvailable === true;
    var stable = requiredAvailable && !!pre && pre === post &&
      preOrigin === "live" && postOrigin === "live";
    return {
      stable: stable,
      reason: stable
        ? "stable"
        : !requiredAvailable
          ? "required_dependency_unavailable"
          : preOrigin !== "live" || postOrigin !== "live"
          ? "non_live_read"
          : !pre || !post
            ? "missing_fingerprint"
            : "source_changed",
    };
  }

  function _transitionDecision_(stageId, status, reasonCodes) {
    return {
      stageId: String(stageId || ""),
      eligibleForReceipt: status === "eligible",
      status: status,
      reasonCodes: (reasonCodes || []).slice(),
    };
  }

  function _canonicalEqual_(left, right) {
    return _digestCanonical_(left, {
      maxProjectionBytes: SYSTEM_STATUS_FINGERPRINT_MAX_PROJECTION_BYTES_,
    }).digest === _digestCanonical_(right, {
      maxProjectionBytes: SYSTEM_STATUS_FINGERPRINT_MAX_PROJECTION_BYTES_,
    }).digest;
  }

  function _evaluateCellPatch_(stageId, transition, policy) {
    var value = transition && typeof transition === "object" ? transition : null;
    if (!value || value.available !== true) {
      return _transitionDecision_(stageId, "unknown", ["transition_evidence_unavailable"]);
    }
    if (value.ambiguous === true) {
      return _transitionDecision_(stageId, "failed", ["transition_ambiguous"]);
    }
    var priorRows = value.priorRows;
    var expectedRows = value.expectedRows;
    var postRows = value.postRows;
    if (!Array.isArray(priorRows) || !Array.isArray(expectedRows) || !Array.isArray(postRows)) {
      return _transitionDecision_(stageId, "unknown", ["transition_rows_missing"]);
    }
    var keyField = String(policy.rowKeyField || "rowKey");
    var priorIndex = _indexTransitionRows_(priorRows, keyField);
    var expectedIndex = _indexTransitionRows_(expectedRows, keyField);
    var postIndex = _indexTransitionRows_(postRows, keyField);
    if (!priorIndex.ok || !expectedIndex.ok || !postIndex.ok) {
      return _transitionDecision_(stageId, "failed", ["row_identity_invalid"]);
    }
    if (!_canonicalEqual_(priorIndex.keys, expectedIndex.keys) ||
        !_canonicalEqual_(priorIndex.keys, postIndex.keys)) {
      return _transitionDecision_(stageId, "failed", ["row_set_changed"]);
    }
    if (policy.reorderPolicy === "reject" &&
        (!_canonicalEqual_(priorIndex.orderedKeys, expectedIndex.orderedKeys) ||
          !_canonicalEqual_(priorIndex.orderedKeys, postIndex.orderedKeys))) {
      return _transitionDecision_(stageId, "failed", ["row_order_changed"]);
    }
    for (var i = 0; i < priorIndex.keys.length; i++) {
      var key = priorIndex.keys[i];
      var before = priorIndex.byKey["$" + key];
      var expected = expectedIndex.byKey["$" + key];
      var after = postIndex.byKey["$" + key];
      if (policy.mode === "birthday_semantic_patch") {
        var priorDay = before.birthdaySemantic;
        var expectedDay = expected.birthdaySemantic;
        var postDay = after.birthdaySemantic;
        if (!_validBirthdaySemantic_(priorDay) || !_validBirthdaySemantic_(expectedDay) ||
            !_validBirthdaySemantic_(postDay) || priorDay.state === "invalid" ||
            expectedDay.state === "invalid" || postDay.state === "invalid") {
          return _transitionDecision_(stageId, "failed", ["birthday_semantic_invalid"]);
        }
        if (!_canonicalEqual_(priorDay, expectedDay) || !_canonicalEqual_(priorDay, postDay)) {
          return _transitionDecision_(stageId, "failed", ["birthday_semantic_changed"]);
        }
      }
      for (var w = 0; w < policy.writableFields.length; w++) {
        var writable = policy.writableFields[w];
        if (!_canonicalEqual_(after[writable], expected[writable])) {
          return _transitionDecision_(stageId, "failed", ["unexpected_target_transition"]);
        }
      }
      for (var p = 0; p < policy.preservedFields.length; p++) {
        var preserved = policy.preservedFields[p];
        if (!_canonicalEqual_(after[preserved], before[preserved])) {
          return _transitionDecision_(stageId, "failed", ["preservation_failed"]);
        }
      }
    }
    return _transitionDecision_(stageId, "eligible", []);
  }

  function _indexTransitionRows_(rows, keyField) {
    var byKey = {};
    var orderedKeys = [];
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i] && typeof rows[i] === "object" ? rows[i] : {};
      var key = String(row[keyField] == null ? "" : row[keyField]).trim();
      var mapKey = "$" + key;
      if (!key || _hasOwn_(byKey, mapKey)) return { ok: false, byKey: {}, keys: [], orderedKeys: [] };
      byKey[mapKey] = row;
      orderedKeys.push(key);
    }
    return {
      ok: true,
      byKey: byKey,
      orderedKeys: orderedKeys,
      keys: orderedKeys.slice().sort(_codeUnitCompare_),
    };
  }

  function _validDigest_(value) {
    return /^sha256:[0-9a-f]{64}$/.test(String(value || ""));
  }

  function _buildExpectedBindingFromTrustedContext_(stageId, trustedExecutionContext) {
    var trusted = trustedExecutionContext && typeof trustedExecutionContext === "object"
      ? trustedExecutionContext
      : null;
    if (!trusted) {
      return { status: "unknown", reason: "trusted_context_unavailable", binding: null };
    }
    var invocation = trusted.canonicalInvocation;
    var lockContext = trusted.lockContext;
    if (trusted.source !== "canonical_operation_invocation_and_lock_context" ||
        !invocation || typeof invocation !== "object" ||
        !lockContext || typeof lockContext !== "object" ||
        !String(invocation.operation || "") || !String(invocation.stageId || "") ||
        !String(invocation.target || "") || !_validDigest_(invocation.scopeFingerprint) ||
        !String(invocation.runId || "") ||
        typeof lockContext.documentLockHeld !== "boolean" ||
        !String(lockContext.lockOwner || "")) {
      return { status: "unknown", reason: "trusted_context_malformed", binding: null };
    }
    var expectedOperation = String(stageId || "").split(".")[0];
    if (String(invocation.operation) !== expectedOperation ||
        String(invocation.stageId) !== String(stageId || "")) {
      return { status: "failed", reason: "trusted_context_mismatch", binding: null };
    }
    if (lockContext.documentLockHeld !== true) {
      return { status: "failed", reason: "trusted_context_lock_mismatch", binding: null };
    }
    return {
      status: "eligible",
      reason: "trusted_context_valid",
      binding: Object.freeze({
        stageId: String(invocation.stageId),
        target: String(invocation.target),
        scopeFingerprint: String(invocation.scopeFingerprint),
        runId: String(invocation.runId),
      }),
    };
  }

  function _evaluateStructuredMonthlyProofs_(stageId, transition, policy, expectedBinding) {
    var binding = transition && transition.binding;
    if (!binding || typeof binding !== "object") {
      return _transitionDecision_(stageId, "unknown", ["structured_binding_unavailable"]);
    }
    if (!_hasOwn_(binding, "stageId") || !_hasOwn_(binding, "target") ||
        !_hasOwn_(binding, "scopeFingerprint") || !_hasOwn_(binding, "runId") ||
        !String(binding.stageId || "") || !String(binding.target || "") ||
        !String(binding.runId || "") || !_validDigest_(binding.scopeFingerprint)) {
      return _transitionDecision_(stageId, "unknown", ["structured_binding_malformed"]);
    }
    if (String(binding.stageId) !== stageId) {
      return _transitionDecision_(stageId, "failed", ["structured_binding_mismatch"]);
    }
    if (!expectedBinding || typeof expectedBinding !== "object" ||
        !String(expectedBinding.stageId || "") || !String(expectedBinding.target || "") ||
        !_validDigest_(expectedBinding.scopeFingerprint) || !String(expectedBinding.runId || "")) {
      return _transitionDecision_(stageId, "unknown", ["expected_binding_unavailable"]);
    }
    if (String(binding.stageId) !== String(expectedBinding.stageId) ||
        String(binding.target) !== String(expectedBinding.target) ||
        String(binding.scopeFingerprint) !== String(expectedBinding.scopeFingerprint) ||
        String(binding.runId) !== String(expectedBinding.runId)) {
      return _transitionDecision_(stageId, "failed", ["structured_binding_mismatch"]);
    }
    for (var i = 0; i < policy.structuredProofs.length; i++) {
      var proofName = policy.structuredProofs[i];
      var proof = transition[proofName];
      if (!proof || typeof proof !== "object") {
        return _transitionDecision_(stageId, "unknown", ["structured_proof_unavailable"]);
      }
      var requiredProofFields = [
        "stageId", "target", "scopeFingerprint", "runId",
        "expectedFingerprint", "postFingerprint",
      ];
      if (proofName !== "conflicts") requiredProofFields.push("priorFingerprint");
      var proofMalformed = requiredProofFields.some(function (field) {
        return !_hasOwn_(proof, field) || !String(proof[field] || "");
      });
      if (proofMalformed || !_validDigest_(proof.scopeFingerprint) ||
          !_validDigest_(proof.expectedFingerprint) ||
          !_validDigest_(proof.postFingerprint) ||
          (proofName !== "conflicts" && !_validDigest_(proof.priorFingerprint))) {
        return _transitionDecision_(stageId, "unknown", ["structured_proof_malformed"]);
      }
      if (String(proof.stageId || "") !== String(binding.stageId) ||
          String(proof.target || "") !== String(binding.target) ||
          String(proof.scopeFingerprint || "") !== String(binding.scopeFingerprint) ||
          String(proof.runId || "") !== String(binding.runId)) {
        return _transitionDecision_(stageId, "failed", ["structured_proof_scope_mismatch"]);
      }
      if (String(proof.expectedFingerprint) !== String(proof.postFingerprint)) {
        return _transitionDecision_(stageId, "failed", ["structured_proof_mismatch"]);
      }
      if (proofName === "targetCells") {
        var expectedRowsDigest = _digestCanonical_(transition.expectedRows, {
          maxProjectionBytes: SYSTEM_STATUS_FINGERPRINT_MAX_PROJECTION_BYTES_,
        }).digest;
        var postRowsDigest = _digestCanonical_(transition.postRows, {
          maxProjectionBytes: SYSTEM_STATUS_FINGERPRINT_MAX_PROJECTION_BYTES_,
        }).digest;
        var priorRowsDigest = _digestCanonical_(transition.priorRows, {
          maxProjectionBytes: SYSTEM_STATUS_FINGERPRINT_MAX_PROJECTION_BYTES_,
        }).digest;
        if (proof.priorFingerprint !== priorRowsDigest ||
            proof.expectedFingerprint !== expectedRowsDigest ||
            proof.postFingerprint !== postRowsDigest) {
          return _transitionDecision_(stageId, "failed", ["target_proof_not_bound"]);
        }
      }
    }
    return _transitionDecision_(stageId, "eligible", []);
  }

  function _evaluateMonthSliceTransition_(stageId, transition, policy) {
    var value = transition && typeof transition === "object" ? transition : null;
    if (!value || value.available !== true || !value.prior || !value.post || !value.expected) {
      return _transitionDecision_(stageId, "unknown", ["transition_evidence_unavailable"]);
    }
    if (value.ambiguous === true) {
      return _transitionDecision_(stageId, "failed", ["transition_ambiguous"]);
    }
    var postProjection = projectMonthSlice_(value.post);
    var expectedProjection = projectMonthSlice_(value.expected);
    if (
      postProjection.targetMonth !== expectedProjection.targetMonth ||
      !_canonicalEqual_(postProjection.headers, expectedProjection.headers) ||
      !_canonicalEqual_(postProjection.targetRows, expectedProjection.targetRows)
    ) {
      return _transitionDecision_(stageId, "failed", ["unexpected_target_transition"]);
    }
    var preservation = simulateMonthPreservation_(value.prior, value.post, {
      remapByHeaderName: policy.remapNonTargetByHeader === true,
    });
    if (!preservation.stable) {
      return _transitionDecision_(stageId, "failed", ["preservation_failed"]);
    }
    return _transitionDecision_(stageId, "eligible", []);
  }

  function _evaluateTransitionEvidenceCore_(stageId, evidence, trustedExecutionContext) {
    var id = String(stageId || "");
    var stage = SYSTEM_STATUS_FINGERPRINT_EXECUTABLE_REGISTRY_[id];
    if (!stage) return _transitionDecision_(id, "unknown", ["stage_unknown"]);
    var policy = stage.transitionPolicy || { mode: "immutable_only" };
    var trustedBinding = null;
    if (policy.mode === "vacation_monthly_atomic") {
      var trustedBuild = _buildExpectedBindingFromTrustedContext_(
        id, trustedExecutionContext,
      );
      if (trustedBuild.status !== "eligible") {
        return _transitionDecision_(id, trustedBuild.status, [trustedBuild.reason]);
      }
      trustedBinding = trustedBuild.binding;
    }
    var value = evidence && typeof evidence === "object" ? evidence : {};
    if (value.evidenceState === "missing" || value.evidenceState === "corrupt" ||
        value.evidenceState === "budget_exceeded") {
      return _transitionDecision_(id, "unknown", [String(value.evidenceState)]);
    }

    var hasImmutable = stage.source.some(function (dependency) {
      return dependency.evidenceRole === "immutable_input" && dependency.required;
    });
    if (hasImmutable) {
      var immutable = value.immutable;
      if (!immutable || typeof immutable !== "object") {
        return _transitionDecision_(id, "unknown", ["immutable_evidence_unavailable"]);
      }
      var stability = simulateSourceStability_(immutable);
      if (!stability.stable) {
        return _transitionDecision_(
          id,
          stability.reason === "source_changed" ? "failed" : "unknown",
          [stability.reason],
        );
      }
    }

    var transitionDecision = _transitionDecision_(id, "eligible", []);
    if (policy.mode === "cell_patch" || policy.mode === "birthday_semantic_patch" ||
        policy.mode === "vacation_monthly_atomic") {
      transitionDecision = _evaluateCellPatch_(id, value.transition, policy);
    } else if (policy.mode === "target_slice_replace") {
      transitionDecision = _evaluateMonthSliceTransition_(id, value.transition, policy);
    } else if (policy.mode === "preservation_only") {
      var preservation = value.preservation;
      if (!preservation || preservation.available !== true) {
        transitionDecision = _transitionDecision_(id, "unknown", ["preservation_evidence_unavailable"]);
      } else if (preservation.ambiguous === true || preservation.stable !== true) {
        transitionDecision = _transitionDecision_(id, "failed", [
          preservation.ambiguous === true ? "transition_ambiguous" : "preservation_failed",
        ]);
      }
    }
    if (!transitionDecision.eligibleForReceipt) return transitionDecision;

    if (policy.mode === "vacation_monthly_atomic") {
      var structuredDecision = _evaluateStructuredMonthlyProofs_(
        id, value.transition, policy, trustedBinding,
      );
      if (!structuredDecision.eligibleForReceipt) return structuredDecision;
    }

    var result = value.result;
    if (!result || result.available !== true || !result.fingerprint || !result.expectedFingerprint) {
      return _transitionDecision_(id, "unknown", ["result_evidence_unavailable"]);
    }
    if (String(result.fingerprint) !== String(result.expectedFingerprint)) {
      return _transitionDecision_(id, "failed", ["result_mismatch"]);
    }
    return _transitionDecision_(id, "eligible", []);
  }

  function evaluateTransitionEvidence_(stageId, evidence, trustedExecutionContext) {
    try {
      return _evaluateTransitionEvidenceCore_(
        stageId, evidence, trustedExecutionContext,
      );
    } catch (error) {
      return _transitionDecision_(String(stageId || ""), "unknown", [
        error && /budget/i.test(String(error.message || error))
          ? "budget_exceeded"
          : "transition_evidence_corrupt",
      ]);
    }
  }

  function evaluateWriterLockContext_(writerPath, context) {
    var path = String(writerPath || "");
    var contract = SYSTEM_STATUS_FINGERPRINT_WRITER_LOCK_CONTRACT_.requiredSs2bIntegration[path];
    if (!contract) return { eligible: false, status: "unknown", reason: "writer_path_unknown" };
    if (!context || typeof context !== "object") {
      return { eligible: false, status: "unknown", reason: "lock_context_missing" };
    }
    var value = context;
    if (value.documentLockHeld !== true) {
      return { eligible: false, status: "failed", reason: "document_lock_not_held" };
    }
    if (value.nestedAcquisitionAttempted === true || value.sharedCoreAcquiresLock === true) {
      return { eligible: false, status: "failed", reason: "nested_lock_forbidden" };
    }
    if (String(value.lockOwner || "") !== contract.lockOwner) {
      return { eligible: false, status: "failed", reason: "lock_owner_mismatch" };
    }
    return { eligible: true, status: "eligible", reason: "lock_context_valid" };
  }

  function simulatePostWriteReread_(input) {
    var value = input || {};
    var invalidated = Array.isArray(value.invalidatedCacheKeys)
      ? value.invalidatedCacheKeys
      : [];
    var required = Array.isArray(value.requiredCacheKeys)
      ? value.requiredCacheKeys
      : [];
    var allInvalidated = required.every(function (key) {
      return invalidated.indexOf(key) !== -1;
    });
    return {
      eligibleForCommit: allInvalidated && value.postReadOrigin === "live" &&
        value.insideCriticalSection === true,
      allInvalidated: allInvalidated,
      postReadOrigin: String(value.postReadOrigin || "unknown"),
      insideCriticalSection: value.insideCriticalSection === true,
    };
  }

  function evaluateVersionCompatibility_(stageId, evidence) {
    var id = String(stageId || "");
    var value = evidence && typeof evidence === "object" ? evidence : {};
    var expected = {
      receiptVersion: SYSTEM_STATUS_FINGERPRINT_RECEIPT_VERSION_,
      manifestVersion: SYSTEM_STATUS_FINGERPRINT_MANIFEST_VERSION_,
      signatureVersion: SYSTEM_STATUS_FINGERPRINT_SIGNATURE_VERSION_,
      algorithmVersion: SYSTEM_STATUS_FINGERPRINT_ALGORITHM_VERSION_,
      stageVersion: _stageVersion_(id),
    };
    var mismatches = Object.keys(expected).filter(function (key) {
      return String(value[key] || "") !== String(expected[key]);
    });
    return {
      stageId: id,
      compatible: mismatches.length === 0,
      freshness: mismatches.length ? "unknown" : "comparable",
      reason: mismatches.length ? "version_mismatch" : "versions_match",
      mismatchedFields: mismatches,
      readTimeMigrationAllowed: false,
      mutationAllowed: false,
    };
  }

  function _validCalendarMonthToken_(value) {
    return /^(0[1-9]|1[0-2])$/.test(String(value || ""));
  }

  function _validVacationSourceMode_(value) {
    return value === "legacy" || value === "requests";
  }

  function _validNonNegativeInt_(value) {
    return typeof value === "number" &&
      isFinite(value) &&
      Math.floor(value) === value &&
      value >= 0;
  }

  function _skipPredicate_(name, scope) {
    var data = scope || {};
    if (name === "never") return false;
    if (name === "no_target_months") return Number(data.targetMonthCount) === 0;
    if (name === "target_missing_or_empty") {
      return data.targetExists === false || data.targetRowCount === 0;
    }
    if (name === "vacation_source_not_legacy") {
      return data.vacationSourceMode === "requests";
    }
    if (name === "module_unavailable") return data.moduleAvailable === false;
    if (name === "no_target_month") return data.targetMonth === "";
    if (name === "target_missing") return data.targetExists === false;
    return false;
  }

  function _canonicalScopeDecision_(stageId, policy, canonicalScope, trustedExecutionContext) {
    var skipWhen = String(policy && policy.skipWhen || "never");
    if (skipWhen === "never") {
      return { status: "eligible", skip: false, reasonCodes: [] };
    }
    if (!canonicalScope || typeof canonicalScope !== "object" || Array.isArray(canonicalScope)) {
      return {
        status: "unknown",
        skip: false,
        reasonCodes: [canonicalScope == null
          ? "canonical_scope_unavailable"
          : "canonical_scope_malformed"],
      };
    }
    var scope = canonicalScope;
    var valid = false;
    if (skipWhen === "no_target_months") {
      valid = _hasOwn_(scope, "targetMonthCount") &&
        _validNonNegativeInt_(scope.targetMonthCount);
    } else if (skipWhen === "target_missing_or_empty") {
      valid = _hasOwn_(scope, "targetExists") &&
        typeof scope.targetExists === "boolean" &&
        _hasOwn_(scope, "targetRowCount") &&
        _validNonNegativeInt_(scope.targetRowCount) &&
        (scope.targetExists === true || scope.targetRowCount === 0);
    } else if (skipWhen === "vacation_source_not_legacy") {
      valid = _hasOwn_(scope, "vacationSourceMode") &&
        typeof scope.vacationSourceMode === "string" &&
        _validVacationSourceMode_(scope.vacationSourceMode);
    } else if (skipWhen === "module_unavailable") {
      valid = _hasOwn_(scope, "moduleAvailable") &&
        typeof scope.moduleAvailable === "boolean";
    } else if (skipWhen === "no_target_month") {
      valid = _hasOwn_(scope, "targetMonth") &&
        typeof scope.targetMonth === "string" &&
        (scope.targetMonth === "" || _validCalendarMonthToken_(scope.targetMonth));
    } else if (skipWhen === "target_missing") {
      valid = _hasOwn_(scope, "targetExists") &&
        typeof scope.targetExists === "boolean";
    }
    if (!valid) {
      return {
        status: "unknown",
        skip: false,
        reasonCodes: ["canonical_scope_malformed"],
      };
    }
    var skip = _skipPredicate_(skipWhen, scope);
    if (stageId === "computed.vacation_monthly_sync" && skip &&
        !trustedExecutionContext) {
      return {
        status: "unknown",
        skip: false,
        reasonCodes: ["canonical_scope_trusted_context_unavailable"],
      };
    }
    if (stageId === "computed.vacation_monthly_sync" && trustedExecutionContext) {
      var trusted = trustedExecutionContext;
      var invocation = trusted && trusted.canonicalInvocation;
      if (trusted.source !== "canonical_operation_invocation_and_lock_context" ||
          !invocation || typeof invocation !== "object" ||
          String(invocation.operation || "") !== "computed" ||
          String(invocation.stageId || "") !== stageId ||
          typeof invocation.target !== "string") {
        if (skip) {
          return {
            status: "unknown",
            skip: false,
            reasonCodes: ["canonical_scope_trusted_context_malformed"],
          };
        }
      } else if (String(invocation.target) !== String(scope.targetMonth)) {
        return {
          status: "failed",
          skip: false,
          reasonCodes: ["canonical_scope_trusted_target_conflict"],
        };
      }
    }
    return {
      status: "eligible",
      skip: skip,
      reasonCodes: skip ? ["skip_predicate_satisfied"] : [],
    };
  }

  function _stageResultDecision_(stageId, result, trustedExecutionContext) {
    var value = result;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return _transitionDecision_(stageId, "failed", ["stage_result_malformed"]);
    }
    var success = false;
    if (stageId === "computed.monthly_callsigns") {
      success = value.ok !== false && (!value.mode || value.mode !== "all" || value.failedCount === 0);
    } else if (stageId === "computed.vacation_schedule") {
      success = value.threw !== true && value.resultObjectPresent === true;
    } else if (stageId === "computed.vacation_monthly_sync") {
      if (value.ok === false) {
        return _transitionDecision_(stageId, "failed", ["stage_result_predicate_failed"]);
      }
      return evaluateTransitionEvidence_(
        stageId, value.transitionEvidence, trustedExecutionContext,
      );
    } else if (stageId === "computed.send_panel_status") {
      success = value.ok === true;
    } else if (stageId === "month_journal.target_resolution") {
      success = _validCalendarMonthToken_(value.targetMonth) && value.sheetExists === true;
    } else if (stageId === "month_journal.source_projection") {
      success = value.available === true;
    } else if (stageId === "month_journal.non_target_preservation") {
      success = value.stable === true && value.ambiguous !== true;
    } else {
      success = value.ok === true || value.success === true;
    }
    return _transitionDecision_(
      stageId,
      success ? "eligible" : "failed",
      success ? [] : ["stage_result_predicate_failed"],
    );
  }

  function evaluateStage_(stageId, evidence, canonicalScope, trustedExecutionContext) {
    var id = String(stageId || "");
    var policy = SYSTEM_STATUS_FINGERPRINT_STAGE_POLICY_[id];
    if (!policy) throw new Error("Unknown stage success policy: " + id);
    var input = evidence && typeof evidence === "object" &&
      (_hasOwn_(evidence, "attempted") || _hasOwn_(evidence, "resultPresent") ||
        _hasOwn_(evidence, "result"))
      ? evidence
      : { result: evidence };
    var attempted = input.attempted === true;
    var resultPresent = input.resultPresent === true;
    var scopeDecision = _canonicalScopeDecision_(
      id, policy, canonicalScope, trustedExecutionContext,
    );
    if (scopeDecision.status !== "eligible") {
      var scopeFailure = _transitionDecision_(
        id, scopeDecision.status, scopeDecision.reasonCodes,
      );
      return {
        stageId: id,
        policy: policy.policy,
        required: policy.policy === "required",
        optional: policy.policy === "optional",
        scopeKnown: false,
        attempted: attempted,
        resultPresent: resultPresent,
        skipPredicateSatisfied: false,
        status: scopeFailure.status,
        success: false,
        decision: scopeFailure,
        reasonCodes: scopeFailure.reasonCodes.slice(),
      };
    }
    if (scopeDecision.skip) {
      return {
        stageId: id,
        policy: policy.policy,
        required: policy.policy === "required",
        optional: policy.policy === "optional",
        scopeKnown: true,
        attempted: false,
        resultPresent: false,
        skipPredicateSatisfied: true,
        status: "skipped",
        success: true,
        decision: _transitionDecision_(id, "eligible", ["skip_predicate_satisfied"]),
        reasonCodes: ["skip_predicate_satisfied"],
      };
    }
    var decision;
    if (!attempted) {
      decision = _transitionDecision_(id, "failed", ["stage_not_attempted"]);
    } else if (!resultPresent) {
      decision = _transitionDecision_(id, "failed", ["stage_result_unavailable"]);
    } else {
      decision = _stageResultDecision_(id, input.result, trustedExecutionContext);
    }
    var success = decision.status === "eligible" && decision.eligibleForReceipt === true;
    return {
      stageId: id,
      policy: policy.policy,
      required: policy.policy === "required",
      optional: policy.policy === "optional",
      scopeKnown: true,
      attempted: attempted,
      resultPresent: resultPresent,
      skipPredicateSatisfied: false,
      status: success ? "success" : decision.status,
      success: success,
      decision: decision,
      reasonCodes: decision.reasonCodes.slice(),
    };
  }

  function _operationStageScope_(operationScope, stageId) {
    var scope = operationScope && typeof operationScope === "object"
      ? operationScope
      : null;
    if (!scope) return null;
    if (scope.stages && typeof scope.stages === "object" &&
        _hasOwn_(scope.stages, stageId)) {
      return scope.stages[stageId];
    }
    return _hasOwn_(scope, stageId) ? scope[stageId] : null;
  }

  function _operationTrustedContext_(trustedContextMap, stageId) {
    var trusted = trustedContextMap && typeof trustedContextMap === "object"
      ? trustedContextMap
      : null;
    if (!trusted) return null;
    if (trusted.canonicalInvocation && trusted.lockContext) return trusted;
    return _hasOwn_(trusted, stageId) ? trusted[stageId] : null;
  }

  function evaluateOperation_(operation, stageInputs, operationScope, trustedContextMap) {
    var prefix = String(operation || "") + ".";
    var inputs = stageInputs || {};
    var evaluated = [];
    Object.keys(SYSTEM_STATUS_FINGERPRINT_STAGE_POLICY_)
      .filter(function (stageId) { return stageId.indexOf(prefix) === 0; })
      .sort(_codeUnitCompare_)
      .forEach(function (stageId) {
        var input = _hasOwn_(inputs, stageId) ? inputs[stageId] : null;
        evaluated.push(evaluateStage_(
          stageId,
          input,
          _operationStageScope_(operationScope, stageId),
          _operationTrustedContext_(trustedContextMap, stageId),
        ));
      });
    var attempted = evaluated.filter(function (item) { return item.status !== "skipped"; });
    var failed = attempted.filter(function (item) { return item.status === "failed"; });
    var unknown = attempted.filter(function (item) { return item.status === "unknown"; });
    var succeeded = attempted.filter(function (item) { return item.status === "success"; });
    var status = !failed.length && !unknown.length && attempted.length
        ? "full"
        : succeeded.length
          ? "partial"
          : failed.length
            ? "failed"
            : unknown.length
              ? "unknown"
              : "skipped";
    var operationReasonCodes = [];
    attempted.forEach(function (item) {
      (item.reasonCodes || []).forEach(function (reasonCode) {
        operationReasonCodes.push(item.stageId + ":" + reasonCode);
      });
    });
    var decisionStatus = failed.length
      ? "failed"
      : unknown.length
        ? "unknown"
        : status === "full"
          ? "eligible"
          : "skipped";
    var decision = _transitionDecision_(
      String(operation || "") + ".operation_summary",
      decisionStatus,
      operationReasonCodes,
    );
    return {
      operation: String(operation || ""),
      status: status,
      isFullSuccess: status === "full",
      decision: decision,
      reasonCodes: decision.reasonCodes.slice(),
      unknownStageIds: unknown.map(function (item) { return item.stageId; }),
      failedStageIds: failed.map(function (item) { return item.stageId; }),
      hasUnknownEvidence: unknown.length > 0,
      hasConfirmedFailure: failed.length > 0,
      stages: evaluated,
    };
  }

  return Object.freeze({
    algorithmVersion: SYSTEM_STATUS_FINGERPRINT_ALGORITHM_VERSION_,
    stageVersions: SYSTEM_STATUS_FINGERPRINT_STAGE_VERSIONS_,
    stagePolicy: SYSTEM_STATUS_FINGERPRINT_STAGE_POLICY_,
    executableManifest: SYSTEM_STATUS_FINGERPRINT_EXECUTABLE_REGISTRY_,
    transitionPolicies: SYSTEM_STATUS_FINGERPRINT_TRANSITION_POLICIES_,
    writerLockContract: SYSTEM_STATUS_FINGERPRINT_WRITER_LOCK_CONTRACT_,
    compatibilityVersions: Object.freeze({
      receiptVersion: SYSTEM_STATUS_FINGERPRINT_RECEIPT_VERSION_,
      manifestVersion: SYSTEM_STATUS_FINGERPRINT_MANIFEST_VERSION_,
      signatureVersion: SYSTEM_STATUS_FINGERPRINT_SIGNATURE_VERSION_,
      algorithmVersion: SYSTEM_STATUS_FINGERPRINT_ALGORITHM_VERSION_,
    }),
    codeUnitCompare: _codeUnitCompare_,
    normalizeBirthdaySemantic: _birthdaySemanticDay_,
    buildExpectedBindingFromTrustedContext: _buildExpectedBindingFromTrustedContext_,
    digestCanonical: _digestCanonical_,
    projectRows: projectRows_,
    buildStageSourceFingerprint: function (stageId, projection, options) {
      return buildFingerprint_(stageId, "source", projection, options);
    },
    buildStageResultFingerprint: function (stageId, projection, options) {
      return buildFingerprint_(stageId, "result", projection, options);
    },
    buildStageProjection: buildStageProjection_,
    buildStageSourceFingerprintFromContext: function (stageId, context, bindings, options) {
      return buildStageEvidence_(stageId, "source", context, bindings, options);
    },
    buildStageResultFingerprintFromContext: function (stageId, context, bindings, options) {
      return buildStageEvidence_(stageId, "result", context, bindings, options);
    },
    buildStageImmutableFingerprintFromContext: function (stageId, context, bindings, options) {
      return buildStageEvidence_(stageId, "source", context, bindings, Object.assign({}, options || {}, {
        evidenceRole: "immutable_input",
      }));
    },
    buildStagePriorStateFingerprintFromContext: function (stageId, context, bindings, options) {
      return buildStageEvidence_(stageId, "source", context, bindings, Object.assign({}, options || {}, {
        evidenceRole: "mutable_target_prior_state",
      }));
    },
    buildStagePreservationFingerprintFromContext: function (stageId, context, bindings, options) {
      return buildStageEvidence_(stageId, "source", context, bindings, Object.assign({}, options || {}, {
        evidenceRole: "preservation_baseline",
      }));
    },
    projectMonthSlice: projectMonthSlice_,
    buildMonthResultFingerprint: buildMonthResultFingerprint_,
    simulateMonthPreservation: simulateMonthPreservation_,
    createExecutionContext: createExecutionContext_,
    readRange: readRange_,
    readInjected: readInjected_,
    simulateCacheInvalidation: simulateCacheInvalidation_,
    simulateSourceStability: simulateSourceStability_,
    evaluateTransitionEvidence: evaluateTransitionEvidence_,
    evaluateWriterLockContext: evaluateWriterLockContext_,
    simulatePostWriteReread: simulatePostWriteReread_,
    evaluateVersionCompatibility: evaluateVersionCompatibility_,
    evaluateStage: evaluateStage_,
    evaluateOperation: evaluateOperation_,
  });
})();

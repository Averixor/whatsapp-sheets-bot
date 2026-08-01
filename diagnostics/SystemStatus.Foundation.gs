/**
 * SystemStatus.Foundation.gs — SS-1 versioned contract, status reducer and
 * presentation allowlist. This module is internal; public API/routing is SS-3.
 */

const SYSTEM_STATUS_CONTRACT_VERSION_ = 1;

const SYSTEM_STATUS_SECTION_IDS_ = Object.freeze([
  "key_data",
  "current_month_journal",
  "vacation_conflicts",
  "inventory_reconciliation",
  "temporary_property",
  "managed_triggers",
  "launch_settings",
  "access_data_quality",
]);

const SYSTEM_STATUS_STATUSES_ = Object.freeze([
  "healthy",
  "attention",
  "critical",
  "unavailable",
]);

const SYSTEM_STATUS_FRESHNESS_ = Object.freeze([
  "current",
  "stale",
  "unknown",
  "not_applicable",
]);

const SYSTEM_STATUS_ACTION_IDS_ = Object.freeze([
  "materialize_computed_data",
  "materialize_current_month_journal",
  "clear_phone_cache",
  "run_diagnostics",
  "check_vacation_conflicts",
  "open_inventory_reconciliation",
]);

const SYSTEM_STATUS_PRESENTATION_ALLOWLIST_ = Object.freeze({
  snapshot: Object.freeze([
    "generatedAt",
    "overall",
    "summary",
    "sections",
    "actions",
  ]),
  summary: Object.freeze([
    "healthy",
    "attention",
    "critical",
    "unavailable",
  ]),
  section: Object.freeze([
    "id",
    "title",
    "status",
    "summary",
    "details",
    "checkedAt",
    "freshness",
    "metrics",
    "actionIds",
    "retryable",
  ]),
  metric: Object.freeze(["label", "value", "tone"]),
  action: Object.freeze([
    "id",
    "label",
    "minimumRole",
    "requiresConfirmation",
  ]),
});

const SYSTEM_STATUS_ACTION_POLICY_ = Object.freeze({
  materialize_computed_data: Object.freeze({
    minimumRole: "maintainer",
    requiresConfirmation: true,
    label: "Оновити обчислювані дані",
  }),
  materialize_current_month_journal: Object.freeze({
    minimumRole: "maintainer",
    requiresConfirmation: true,
    label: "Оновити журнал поточного місяця",
  }),
  clear_phone_cache: Object.freeze({
    minimumRole: "sysadmin",
    requiresConfirmation: true,
    label: "Очистити кеш телефонів",
  }),
  run_diagnostics: Object.freeze({
    minimumRole: "maintainer",
    requiresConfirmation: false,
    label: "Запустити діагностику",
  }),
  check_vacation_conflicts: Object.freeze({
    minimumRole: "maintainer",
    requiresConfirmation: false,
    label: "Перевірити конфлікти відпусток",
  }),
  open_inventory_reconciliation: Object.freeze({
    minimumRole: "maintainer",
    requiresConfirmation: false,
    label: "Перейти до звірки майна",
  }),
});

const SYSTEM_STATUS_PRESENTATION_COPY_ = Object.freeze({
  summaries: Object.freeze({
    healthy: "Порушень не виявлено.",
    attention: "Є дані, що потребують уваги.",
    critical: "Виявлено критичну проблему.",
    unavailable: "Перевірку тимчасово не вдалося виконати.",
  }),
  reasons: Object.freeze({
    collector_failed: "Перевірку тимчасово не вдалося виконати.",
    source_unavailable: "Джерело даних недоступне.",
    schema_issues: "Структура даних потребує виправлення.",
    data_issues: "Знайдено суттєві порушення даних.",
    pending_review: "Є конфлікти, що очікують рішення.",
    pending_check_unknown: "Актуальність перевірки конфліктів невідома.",
    not_configured: "Модуль ще не налаштовано.",
    stale_index: "Дані звірки потрібно оновити.",
    scan_truncated: "Останню звірку завершено не повністю.",
    scan_evidence_unknown: "Повноту останньої звірки не підтверджено.",
    incomplete_history: "Є незавершені минулі періоди.",
    outstanding_items: "Є незакриті записи тимчасової видачі.",
    missing_triggers: "Частина автоматичних запусків відсутня.",
    duplicate_triggers: "Знайдено дублікати автоматичних запусків.",
    unexpected_triggers: "Знайдено невідомі керовані запуски.",
    missing_required_settings: "Не задано обов'язкові налаштування запуску.",
    invalid_required_settings: "Обов'язкові налаштування мають некоректний формат.",
    freshness_pending: "Дані про актуальність поки недоступні.",
  }),
  sections: Object.freeze({
    key_data: Object.freeze({
      title: "Ключові дані",
      actions: Object.freeze(["materialize_computed_data", "clear_phone_cache"]),
      metrics: Object.freeze({
        activePersonnel: Object.freeze({ label: "Активних записів", type: "count" }),
        phoneRecords: Object.freeze({ label: "Телефонних записів", type: "count" }),
        vacationRecords: Object.freeze({ label: "Записів відпусток", type: "count" }),
        dataIssues: Object.freeze({ label: "Порушень даних", type: "count", tone: "warning" }),
      }),
    }),
    current_month_journal: Object.freeze({
      title: "Журнал поточного місяця",
      actions: Object.freeze(["materialize_current_month_journal"]),
      metrics: Object.freeze({}),
    }),
    vacation_conflicts: Object.freeze({
      title: "Відпустки: конфлікти",
      actions: Object.freeze(["check_vacation_conflicts"]),
      metrics: Object.freeze({
        plannerCritical: Object.freeze({ label: "Критичних порушень", type: "count", tone: "critical" }),
        plannerWarnings: Object.freeze({ label: "Попереджень", type: "count", tone: "warning" }),
        pendingConflicts: Object.freeze({ label: "Конфліктів на розгляді", type: "count", tone: "warning" }),
        pendingRemovals: Object.freeze({ label: "Видалень на розгляді", type: "count", tone: "warning" }),
      }),
    }),
    inventory_reconciliation: Object.freeze({
      title: "Звірка майна",
      actions: Object.freeze(["open_inventory_reconciliation"]),
      metrics: Object.freeze({
        completePastMonths: Object.freeze({ label: "Завершених минулих місяців", type: "count" }),
        incompletePastMonths: Object.freeze({ label: "Незавершених минулих місяців", type: "count", tone: "warning" }),
        missingFiles: Object.freeze({ label: "Відсутніх документів", type: "count", tone: "warning" }),
        duplicateFiles: Object.freeze({ label: "Дублів документів", type: "count", tone: "warning" }),
        lastSyncedAt: Object.freeze({ label: "Остання синхронізація", type: "date" }),
      }),
    }),
    temporary_property: Object.freeze({
      title: "Тимчасово видане майно",
      actions: Object.freeze([]),
      metrics: Object.freeze({
        outstandingRecords: Object.freeze({ label: "Незакритих записів", type: "count", tone: "warning" }),
        persons: Object.freeze({ label: "Осіб з незакритим майном", type: "count" }),
      }),
    }),
    managed_triggers: Object.freeze({
      title: "Керовані автоматичні запуски",
      actions: Object.freeze([]),
      metrics: Object.freeze({
        missing: Object.freeze({ label: "Відсутніх запусків", type: "count", tone: "critical" }),
        duplicates: Object.freeze({ label: "Дублів запусків", type: "count", tone: "critical" }),
        unexpected: Object.freeze({ label: "Невідомих запусків", type: "count", tone: "warning" }),
      }),
    }),
    launch_settings: Object.freeze({
      title: "Налаштування запуску",
      actions: Object.freeze([]),
      metrics: Object.freeze({
        configured: Object.freeze({ label: "Налаштовано", type: "count" }),
        missing: Object.freeze({ label: "Не задано", type: "count", tone: "critical" }),
        invalid: Object.freeze({ label: "Некоректних значень", type: "count", tone: "critical" }),
      }),
    }),
    access_data_quality: Object.freeze({
      title: "Доступ і якість даних",
      actions: Object.freeze(["run_diagnostics"]),
      metrics: Object.freeze({
        accessIssues: Object.freeze({ label: "Порушень доступу", type: "count", tone: "critical" }),
        duplicateActiveCallsigns: Object.freeze({ label: "Дублів активних позивних", type: "count", tone: "critical" }),
        schemaIssues: Object.freeze({ label: "Порушень структури", type: "count", tone: "critical" }),
        dataIssues: Object.freeze({ label: "Інших порушень даних", type: "count", tone: "warning" }),
      }),
    }),
  }),
});

function _systemStatusHasValue_(values, value) {
  return values.indexOf(value) !== -1;
}

function _systemStatusSafeIso_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return value.toISOString();
  var text = String(value || "").trim();
  if (!text) return null;
  var parsed = new Date(text);
  return isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function _systemStatusNormalizeCount_(value) {
  var number = Number(value);
  if (!isFinite(number) || number < 0) return 0;
  return Math.floor(number);
}

/**
 * A critical confirmed state always wins. An unavailable section raises an
 * otherwise healthy snapshot to attention; only an entirely unavailable set
 * reduces to unavailable.
 */
function reduceSystemStatusOverall_(statuses) {
  var items = Array.isArray(statuses) ? statuses : [];
  if (!items.length) return "unavailable";
  var normalized = items.map(function (status) {
    return _systemStatusHasValue_(SYSTEM_STATUS_STATUSES_, status)
      ? status
      : "unavailable";
  });
  if (normalized.indexOf("critical") !== -1) return "critical";
  if (normalized.indexOf("attention") !== -1) return "attention";
  if (normalized.indexOf("unavailable") !== -1) {
    return normalized.every(function (status) {
      return status === "unavailable";
    })
      ? "unavailable"
      : "attention";
  }
  return "healthy";
}

function _systemStatusMapMetric_(key, value, definition) {
  if (!definition) return null;
  if (definition.type === "date") {
    var iso = _systemStatusSafeIso_(value);
    if (!iso) return null;
    return {
      label: definition.label,
      value: iso,
      tone: definition.tone || "neutral",
    };
  }
  if (definition.type !== "count") return null;
  return {
    label: definition.label,
    value: _systemStatusNormalizeCount_(value),
    tone: definition.tone || "neutral",
  };
}

function mapSystemStatusSectionForPresentation_(rawSection) {
  var raw = rawSection && typeof rawSection === "object" ? rawSection : {};
  var id = _systemStatusHasValue_(SYSTEM_STATUS_SECTION_IDS_, raw.id)
    ? raw.id
    : "";
  if (!id) return null;

  var sectionCopy = SYSTEM_STATUS_PRESENTATION_COPY_.sections[id];
  var status = _systemStatusHasValue_(SYSTEM_STATUS_STATUSES_, raw.status)
    ? raw.status
    : "unavailable";
  var freshness = _systemStatusHasValue_(SYSTEM_STATUS_FRESHNESS_, raw.freshness)
    ? raw.freshness
    : "unknown";
  var reasons = [];
  (Array.isArray(raw.reasonCodes) ? raw.reasonCodes : []).forEach(function (code) {
    var message = SYSTEM_STATUS_PRESENTATION_COPY_.reasons[String(code || "")];
    if (message && reasons.indexOf(message) === -1) reasons.push(message);
  });

  var rawMetrics = raw.metrics && typeof raw.metrics === "object" ? raw.metrics : {};
  var metrics = [];
  Object.keys(sectionCopy.metrics).forEach(function (key) {
    if (!Object.prototype.hasOwnProperty.call(rawMetrics, key)) return;
    var mapped = _systemStatusMapMetric_(key, rawMetrics[key], sectionCopy.metrics[key]);
    if (mapped) metrics.push(mapped);
  });

  var requestedActions = Array.isArray(raw.actionIds) ? raw.actionIds : [];
  var actionIds = sectionCopy.actions.filter(function (actionId) {
    return requestedActions.indexOf(actionId) !== -1;
  });

  return {
    id: id,
    title: sectionCopy.title,
    status: status,
    summary: SYSTEM_STATUS_PRESENTATION_COPY_.summaries[status],
    details: reasons,
    checkedAt: _systemStatusSafeIso_(raw.checkedAt),
    freshness: freshness,
    metrics: metrics,
    actionIds: actionIds,
    retryable: raw.retryable === true,
  };
}

function mapSystemStatusActionForPresentation_(actionId) {
  var id = String(actionId || "");
  if (!_systemStatusHasValue_(SYSTEM_STATUS_ACTION_IDS_, id)) return null;
  var policy = SYSTEM_STATUS_ACTION_POLICY_[id];
  return {
    id: id,
    label: policy.label,
    minimumRole: policy.minimumRole,
    requiresConfirmation: policy.requiresConfirmation === true,
  };
}

function mapSystemStatusSnapshotForPresentation_(rawSnapshot) {
  var raw = rawSnapshot && typeof rawSnapshot === "object" ? rawSnapshot : {};
  var rawSections = Array.isArray(raw.sections) ? raw.sections : [];
  var sections = SYSTEM_STATUS_SECTION_IDS_.map(function (sectionId) {
    var matches = rawSections.filter(function (section) {
      return section && typeof section === "object" && section.id === sectionId;
    });
    var source =
      matches.length === 1
        ? matches[0]
        : {
            id: sectionId,
            status: "unavailable",
            freshness: "unknown",
            reasonCodes: ["collector_failed"],
            actionIds: [],
            retryable: true,
          };
    return mapSystemStatusSectionForPresentation_(source);
  });
  var summary = { healthy: 0, attention: 0, critical: 0, unavailable: 0 };
  sections.forEach(function (section) {
    summary[section.status]++;
  });
  var actionIds = [];
  sections.forEach(function (section) {
    section.actionIds.forEach(function (actionId) {
      if (actionIds.indexOf(actionId) === -1) actionIds.push(actionId);
    });
  });
  var actions = actionIds.map(mapSystemStatusActionForPresentation_).filter(Boolean);
  return {
    generatedAt: _systemStatusSafeIso_(raw.generatedAt) || new Date().toISOString(),
    overall: reduceSystemStatusOverall_(sections.map(function (section) { return section.status; })),
    summary: summary,
    sections: sections,
    actions: actions,
  };
}

const SystemStatusFoundation_ = Object.freeze({
  version: SYSTEM_STATUS_CONTRACT_VERSION_,
  sectionIds: SYSTEM_STATUS_SECTION_IDS_,
  statuses: SYSTEM_STATUS_STATUSES_,
  freshness: SYSTEM_STATUS_FRESHNESS_,
  actionIds: SYSTEM_STATUS_ACTION_IDS_,
  presentationAllowlist: SYSTEM_STATUS_PRESENTATION_ALLOWLIST_,
  reduceOverall: reduceSystemStatusOverall_,
  mapSection: mapSystemStatusSectionForPresentation_,
  mapAction: mapSystemStatusActionForPresentation_,
  mapSnapshot: mapSystemStatusSnapshotForPresentation_,
  presentationCopyForTests: SYSTEM_STATUS_PRESENTATION_COPY_,
});

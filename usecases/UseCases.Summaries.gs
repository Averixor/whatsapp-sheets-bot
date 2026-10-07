/**
 * UseCases.Summaries.gs — day / detailed summary use cases (PR7 domain split).
 */

var UseCasesSummaries_ = (function () {
  function buildDaySummary(options) {
    const payload =
      typeof options === "string"
        ? { date: options }
        : Object.assign({}, options || {});
    return WorkflowOrchestrator_.run({
      scenario: "buildDaySummary",
      payload: payload,
      write: false,
      lock: false,
      validate: function (input) {
        const info = validateDatePayload_(input, "date");
        if (
          typeof AccessEnforcement_ === "object" &&
          AccessEnforcement_.assertCanUseDaySummary
        ) {
          AccessEnforcement_.assertCanUseDaySummary(
            info.payload.dateStr || info.payload.date || "",
          );
        }
        return { payload: info.payload, warnings: [] };
      },
      execute: function (input) {
        const summary = SummaryRepository_.buildDaySummary(
          input.dateStr || input.date,
        );
        return {
          success: true,
          message: "Зведення сформовано",
          result: {
            summary: summary.summary,
            date: summary.date,
            sheet: summary.sheet,
          },
          changes: [],
          affectedSheets: [summary.sheet],
          affectedEntities: [],
          appliedChangesCount: 0,
          skippedChangesCount: 0,
          partial: false,
        };
      },
    });
  }

  function buildDetailedSummary(options) {
    const payload =
      typeof options === "string"
        ? { date: options }
        : Object.assign({}, options || {});
    return WorkflowOrchestrator_.run({
      scenario: "buildDetailedSummary",
      payload: payload,
      write: false,
      lock: false,
      validate: function (input) {
        const info = validateDatePayload_(input, "date");
        if (
          typeof AccessEnforcement_ === "object" &&
          AccessEnforcement_.assertCanUseDetailedSummary
        ) {
          AccessEnforcement_.assertCanUseDetailedSummary(
            info.payload.dateStr || info.payload.date || "",
          );
        }
        return { payload: info.payload, warnings: [] };
      },
      execute: function (input) {
        const summary = SummaryRepository_.buildDetailedSummary(
          input.dateStr || input.date,
        );
        return {
          success: true,
          message: "Детальне зведення сформовано",
          result: {
            summary: summary.summary,
            date: summary.date,
            peopleCount: summary.peopleCount,
            sheet: summary.sheet,
          },
          changes: [],
          affectedSheets: [summary.sheet],
          affectedEntities: [],
          appliedChangesCount: 0,
          skippedChangesCount: 0,
          partial: false,
        };
      },
    });
  }

  return {
    buildDaySummary: buildDaySummary,
    buildDetailedSummary: buildDetailedSummary,
  };
})();

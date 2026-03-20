
# Spreadsheet Action API

## Canonical entrypoints
- `apiPreviewSelectionMessage`
- `apiPreviewMultipleMessages`
- `apiPreviewGroupedMessages`
- `apiPrepareRangeMessages`
- `apiBuildCommanderSummaryPreview`
- `apiBuildCommanderSummaryLink`
- `apiLogPreparedMessages`
- `apiRunSelectionDiagnostics`

## Contract
Every action returns the unified stage response and prepared payload suitable for presenter-only dialogs.

## Menu wrappers
`Actions.gs` must stay thin and only call the canonical API.

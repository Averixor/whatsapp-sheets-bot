# Use case dependency map (initial)

Format: `UseCase → helpers → repositories → orchestrator → client adapter`

## SendPanel

```
generateSendPanelForDate
  → _stage7BuildSendPanelWarnings_ (UseCases.PanelHelpers.gs)
  → _stage7AVerifySendPanelBuild_
  → SendPanelRepository_.preview / .rebuild
  → WorkflowOrchestrator_.run
  → adaptStage4PanelResponse (Js.Core.html)
```

```
getSendPanelData
  → SendPanelRepository_.readRows / .buildStats
  → WorkflowOrchestrator_.run
  → adaptStage4PanelResponse
```

```
markPanelRowsAsSent / markPanelRowsAsUnsent / sendPendingRows
  → _stage7RowsToChangeList_ / _stage7AVerifyPanelStatuses_ (UseCases.PanelHelpers.gs)
  → _stage7ApplyPanelState_ / _stage7GroupContiguousRows_ (shared panel write cluster)
  → SendPanelRepository_.mark*
  → WorkflowOrchestrator_.run
  → adaptStage4PanelResponse
```

## Calendar

```
loadCalendarDay
  → PersonsRepository_ / month sheet reads
  → WorkflowOrchestrator_.run
  → Stage7Api.getSidebarData (Js.Api.html)
```

```
openPersonCard
  → PersonCards / PersonsRepository_
  → WorkflowOrchestrator_.run
  → Js.Actions / Js.Render.Results
```

## Summaries

```
buildDaySummary / buildDetailedSummary
  → SummaryRepository_
  → WorkflowOrchestrator_.run
  → adaptStage4SummaryResponse (Js.Core.html)
```

## Maintenance

```
runMaintenanceScenario
  → runFullDiagnostics_ / cache / triggers (by scenario type)
  → WorkflowOrchestrator_.run
  → adaptStage4UtilityResponse
```

## MonthOps

```
switchBotToMonth / createNextMonth
  → _stage7CreateNextMonthCore_ (UseCases.MonthOps.gs)
  → validateMonthSwitch_ / setBotMonthSheetName_
  → WorkflowOrchestrator_.run
  → Js.State / sidebar month refresh
```

## Access (Phase 2 — document only)

```
apiStage7DebugAccess
  → AccessControl.* / AccessEnforcement_
  → Js.Security.html (applyAccessPolicyUI)
```

_Update this map when PR7+ domain PRs land; diff in PR descriptions._

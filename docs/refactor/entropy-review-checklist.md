# Quarterly entropy review checklist

Owner + backup, ~2 hours each quarter. Output: `docs/refactor/entropy-review-YYYY-QN.md`.

## Checks

| Check | Look for | Action |
|-------|----------|--------|
| Remonolithization | `.gs` / `Js.*.html` > 850 lines and growing | Plan split PR or document exception |
| Dead shims | `DeprecatedRegistry.gs`, zero callers | Thin or schedule sunset |
| Stale tracing | Critical use cases missing `traceUseCase_` | Fix wrappers / domains |
| Stale canary | Missing production edge cases | Refresh canary dataset |
| Unused facade methods | Snapshot vs `RoutingRegistry` | Remove or document bound ref |
| Old rollback tags | Tags > 6 months | Archive in RUNBOOK |
| Snapshot drift | Facade / access baselines | Re-baseline structural PR |
| Label compliance | PRs missing blast-radius labels | Process reminder |
| Transport cleanup | `USE_NEW_API_PATH` telemetry `gsRun` usage | Plan 3e-cleanup when zero |

## Gate

Block new `blast-radius-high` PR if last entropy review > 90 days overdue.

## Subset

Canary parity review is part of this checklist (not a duplicate process).

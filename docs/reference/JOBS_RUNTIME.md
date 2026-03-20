# Jobs Runtime

## Scope
The active Stage 5 Final jobs runtime layer covers:
- managed trigger installation and listing
- per-job runtime status
- last run / last success / last failure
- bounded execution history
- append-only operational log mirrored to `JOB_RUNTIME_LOG`

## Captured fields
- job name
- start/end time
- duration
- source
- dry-run flag
- operation id
- message
- error

## Canonical entrypoints
- `apiInstallStage5Jobs()`
- `apiListStage5Jobs()`
- `apiRunStage5Job(jobName, options)`
- `apiListStage5JobRuntime()`
- `JobRuntime_.buildRuntimeReport()`

## Compatibility note
Historical Stage 4-named maintenance routes may still call into the same runtime layer, but the canonical maintenance facade is `Stage5MaintenanceApi.gs`.

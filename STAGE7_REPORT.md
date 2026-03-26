# STAGE7_REPORT — Stage 7.1.1 Final Stabilized Repair Baseline

## Що зроблено

> Цей merged Stage 7.1 зібрано на базі технічно сильнішого lifecycle/hardening шару пізнішої збірки та повнішого diagnostics/smoke baseline ранньої збірки, без відкату ключових reliability-покращень.

### 1. Lifecycle критичних операцій
- Додано `OperationRepository.gs` як sheet-backed lifecycle repository.
- Критичні write-операції тепер працюють через `WorkflowOrchestrator_` з:
  - canonical `OperationId`
  - fingerprint deduplication
  - `OPS_LOG`
  - `ACTIVE_OPERATIONS`
  - `CHECKPOINTS`
  - heartbeat / stale detection / repair metadata

### 2. Repair flow
- Додано maintenance API:
  - `apiStage5ListPendingRepairs`
  - `apiStage5GetOperationDetails`
  - `apiStage5RunRepair`
  - `apiStage5RunLifecycleRetentionCleanup`
- Repair запускається як нова операція з `ParentOperationId`.
- Старий інцидент не переписується; у ньому фіксуються resolution fields.

### 3. Runtime decomposition
- `JavaScript.html` більше не містить монолітного runtime.
- Активний runtime збирається через include chain:
  - `Js.Core.html`
  - `Js.State.html`
  - `Js.Api.html`
  - `Js.Render.html`
  - `Js.Diagnostics.html`
  - `Js.Helpers.html`
  - `Js.Events.html`
  - `Js.Actions.html`

### 4. Sidebar-first evolution
- Додано sidebar maintenance flow `Pending Repairs`.
- Доступні дії:
  - список pending repairs
  - перегляд деталей операції
  - запуск repair зі sidebar

### 5. Trigger / maintenance
- Додано `stage7JobDetectStaleOperations()`.
- Install jobs тепер ставить time-driven stale detector на 15 хвилин.
- Cleanup flow виконує retention cleanup для `OPS_LOG` hot storage.
- Додано окремий lifecycle retention cleanup flow для `OPS_LOG`, `ACTIVE_OPERATIONS` і `CHECKPOINTS`.

## Службові аркуші
- `OPS_LOG`
- `ACTIVE_OPERATIONS`
- `CHECKPOINTS`

## Важливі примітки
- Stage 4 compatibility facade збережено.
- Stage 5 maintenance naming збережено.
- Бізнес-логіка доменних сценаріїв не переписувалась; hardening накладено поверх baseline.
- Dry-run сценарії не забивають service sheets як реальні committed execution records.

## Відомі межі поточної реалізації
- Batch/checkpoint integration реалізована на orchestration-рівні; окремі доменні сценарії ще можна поглибити до більш granular checkpointing.
- Repair replay покриває головні критичні сценарії baseline; екзотичні maintenance branches можуть потребувати окремого routing розширення.


## Що додатково увійшло в merged 7.1 поверх первинного 7.1
- За основу взято Stage 7 lifecycle / repair / stale-detector шар і збережено стабільний sidebar/runtime baseline зі Stage 6 Final lineage.
- Виправлено execution bug у maintenance-сценарії `restartBot`, де callback використовував `context` поза власною сигнатурою.
- Посилено policy заморожування фінальних lifecycle-записів: статус фінальної операції більше не можна потай переписати через `transitionStatus(...)`.
- `saveCheckpoint(...)` тепер оновлює не лише `OPS_LOG`, а й active heartbeat / expiry, щоб довгі операції не виглядали мертвими між батчами.
- Retention cleanup розширено на `CHECKPOINTS` з ротацією в `CHECKPOINTS_YYYY_MM`.
- Додано окремий job `stage7JobLifecycleRetentionCleanup()` і maintenance flow `cleanupLifecycleRetention`.
- Прибрано службові `.bak` хвости з фінальної збірки та вирівняно metadata / diagnostics / smoke tests під маркер Stage 7.1.

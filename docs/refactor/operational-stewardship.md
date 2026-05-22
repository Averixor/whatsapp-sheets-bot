# WASB operational stewardship

Doctrine ownership for refactor guardrails, canary, and quarterly entropy recovery.

## Current assignment

| Role | Assignee | Since |
|------|----------|-------|
| **Owner** | *(primary maintainer — update on handoff)* | 2026-05-22 |
| **Backup owner** | *(secondary maintainer — update on handoff)* | 2026-05-22 |

> **Fill assignee names before Phase 2** — placeholders are intentional until handoff.

Owner owns the canary spreadsheet Script Property (`WASB_CANARY_SPREADSHEET_ID`), approves emergency exceptions (E1–E4), and signs off on `blast-radius-high` merges outside freeze windows.

Backup owner covers owner absence, may approve E1–E4 with mandatory post-mortem, and must run one full canary smoke before accepting ownership.

## Roles

| Role | Responsibility |
|------|----------------|
| **Owner** | Primary steward; approves emergency exceptions; owns canary spreadsheet ID |
| **Backup owner** | Covers absence; may approve E1–E4 with post-mortem; runs handoff smoke |

## Cadence

| Cadence | Activity |
|---------|----------|
| Monthly (~30 min) | Stewardship checklist below |
| Quarterly (~2 h) | Entropy review (`docs/refactor/entropy-review-checklist.md`) + canary parity refresh → output `docs/refactor/entropy-review-YYYY-QN.md` |

## Rotation policy

- Owner rotation: **every 12 months** or when the primary maintainer changes
- Handoff checklist:
  1. Transfer canary Script Properties and spreadsheet editor access
  2. Run full canary smoke (panel, calendar, person card, access debug, maintenance shallow)
  3. Confirm `scripts/snapshots/*` baselines committed and `npm run ci` green
  4. Update assignee names in this doc and `RUNBOOK.md` §19
- Backup must run **one full canary smoke** before accepting ownership

## Monthly checklist

- [ ] Last canary parity review < 90 days
- [ ] Facade / access snapshots committed; CI green
- [ ] Open `blast-radius-high` PRs have rollback tags
- [ ] Tracing `samplingRate` sane on production (no log spam)
- [ ] No emergency exceptions open > 14 days

## Freeze window

No `blast-radius-high` or `rollback-required` merges:

- Friday after 16:00 (local) through Monday 10:00
- Active operations days (send-panel peak, month rollover, vacation reminders)
- Any period marked as freeze in `RUNBOOK.md`

Allowed during freeze: PR1–PR4, CI-only, docs, canary refresh (not structural surgery).

## Emergency exception protocol

Doctrine strict by design. Documented escape hatch — not ad-hoc.

| Type | Allows | Still required |
|------|--------|----------------|
| **E1 — Hotfix** | `Type: feature` PR during freeze | Rollback tag, canary smoke, owner approval |
| **E2 — Mixed PR** | fix + structural in one PR | Split commits, post-mortem within 7 days |
| **E3 — Transport bypass** | `USE_NEW_API_PATH` rollback or hotpatch | Envelope audit after revert, telemetry review |
| **E4 — Freeze bypass** | merge `blast-radius-high` during freeze | Owner + backup sign-off, rollback tag mandatory |

Workflow: open issue `EMERGENCY: [E1–E4] — description` → owner approves (backup if unavailable) → PR prefix `[EMERGENCY-E1]` + blast-radius label → merge minimum scope → post-mortem within 7 days → normalize within 14 days (`docs/refactor/emergency-log.md`).

Max **2 open exceptions** without closed post-mortem.

## Bridge flags

| Flag | Owner | Registry |
|------|-------|----------|
| `USE_NEW_API_PATH` | WASB refactor steward (primary maintainer per table above) | `contracts/bridge-flags.registry.json` |

CI: `node scripts/verify-bridge-flags.mjs` (WARN after `sunsetTarget`; `BRIDGE_STRICT=1` for high-risk merges).

## Related artifacts

- `RUNBOOK.md` §19 (stewardship summary) and §20 (canary)
- `contracts/bridge-flags.registry.json`, `docs/refactor/snapshot-governance.md`
- `docs/refactor/usecase-dependency-map.md`
- `docs/refactor/entropy-review-checklist.md`
- `docs/refactor/entropy-review-2026-Q2.md` (latest quarterly output)
- `scripts/snapshots/stage7-usecases-facade.json`
- `scripts/snapshots/access-debug-baseline.json`
- `scripts/bootstrap-access-baseline.mjs` — opt-in merge of canary `apiStage7DebugAccess()` capture

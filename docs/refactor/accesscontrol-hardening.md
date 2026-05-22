# AccessControl hardening doctrine (Phase 2)

Structural migration only — no RBAC semantics change without explicit feature PR.

## Domains to preserve

| Domain | Files |
|--------|-------|
| RBAC roles | `AccessControl.Core.gs` |
| Auth resolution | `AccessControl.AuthResolver.gs` |
| Sheet I/O | `AccessControl.SheetRepository.gs` |
| Enforcement | `AccessEnforcement.gs` |
| Policy tests | `AccessPolicyChecks.gs` |
| Client RBAC | `Js.Security.html` |
| Redaction | `SecurityRedaction.gs` |
| Bootstrap | `AccessControl.PublicApi.gs` |

## Prerequisites status (2026-05-22)

| Artifact | Path | Status |
|----------|------|--------|
| Roles × actions matrix | `docs/refactor/access-roles-actions-matrix.md` | Committed |
| Access debug baseline | `scripts/snapshots/access-debug-baseline.json` | Schema baseline committed; live `descriptor` from canary before first structural PR |
| Hardening doctrine | This file | Committed |
| Rollback tag | `wasb-pre-phase2-access` | Documented in `RUNBOOK.md` §19 — create before first Phase 2 structural merge |

## Migration rules

1. Complete prerequisites: roles matrix, `access-debug-baseline.json`, rollback tag `wasb-pre-phase2-access`
2. One structural concern per PR (repository → resolver → enforcement → client)
3. Canary smoke: guest / operator / admin on `apiStage7DebugAccess` and panel/calendar flows
4. Baseline diff required before merge

## Out of scope for structural PRs

- New roles or permission bits
- Envelope shape changes
- Removing legacy aliases

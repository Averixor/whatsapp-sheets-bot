# WASB P2 Refactor Candidates

**Status:** post-release / non-blocking  
**Release baseline:** WASB production release CLOSED  
**Purpose:** reduce complexity in the largest stable modules without changing public API contracts.

## Summary

The current largest WASB-owned modules are:

| Module | Lines | Domain | Priority |
|--------|------:|--------|----------|
| `access/AccessEnforcement.gs` | 1609 | RBAC / security enforcement | P2 |
| `access/AccessControl.AuthResolver.gs` | 1560 | identity / login / bind | P2 |
| `smoke/SmokeTests.gs` | 1490 | regression and smoke tests | P2 |

Together they contain 4659 lines, roughly 10% of the GAS codebase across domain folders.
This is not a release blocker; the production release is CLOSED.

## Refactor Principles

- Do not change public API entrypoints.
- Do not change GAS global function names used by menus, triggers, CI, or `clasp run`.
- Preserve `AccessEnforcement_` compatibility unless intentionally migrated.
- Run full `npm run ci` after each split.
- Prefer mechanical split first, behavior changes later.
- Keep commits small and reversible.

## Candidate 1 — AccessEnforcement.gs

Current role:

- RBAC role hierarchy.
- Server-side guards.
- System actor / trigger context.
- Access descriptor.
- Security audit hooks.

Suggested split:

| New file | Responsibility |
|----------|----------------|
| `AccessEnforcement.Core.gs` | roles, role comparison, common asserts |
| `AccessEnforcement.ApiGuards.gs` | API guard helpers |
| `AccessEnforcement.SystemActor.gs` | system trigger context |
| `AccessEnforcement.Descriptor.gs` | access descriptor / client-safe metadata |
| `AccessEnforcement.Triggers.gs` | `stage7SecurityAuditOnEdit` / `stage7SecurityAuditOnChange` |

**Risk:** medium. Many call sites may reference `AccessEnforcement_`.

## Candidate 2 — AccessControl.AuthResolver.gs

Current role:

- Resolve subject.
- Login / self-bind.
- Current key handling.
- Temporary password flow.
- Public descriptor response.

Suggested split:

| New file | Responsibility |
|----------|----------------|
| `AccessControl.AuthResolver.Subject.gs` | subject resolution and lookup |
| `AccessControl.AuthResolver.Login.gs` | login, bind, temporary password |
| `AccessControl.AuthResolver.Descriptor.gs` | public descriptor / safe response |
| `AccessControl.AuthResolver.Keys.gs` | current key and hash handling |

**Risk:** low-medium. Functions are already named and separable.

## Candidate 3 — SmokeTests.gs

Current role:

- `runSmokeTests`
- Stage 4 / Stage 5 scenario tests
- Regression suite wrappers
- Inline checks

Suggested split:

| New file | Responsibility |
|----------|----------------|
| `SmokeTests.Core.gs` | shared helpers and assertions |
| `SmokeTests.Stage4.gs` | Stage 4 checks |
| `SmokeTests.Stage5.gs` | Stage 5 checks |
| `SmokeTests.Regression.gs` | regression suite |
| `SmokeTests.Production.gs` | production smoke wrappers |

**Risk:** low. Test code only, but entrypoints must stay stable.

## Required Checks After Each Step

```bash
npm run ci
git diff --check
npx clasp push
```

Important entrypoints that must remain stable:

- `runSmokeTests`
- `runStage4ScenarioTests`
- `runStage5ScenarioTests`
- `runRegressionTestSuite`
- `apiRunStage7RegressionTests`
- `apiRunSmokeChecks` (remote smoke; historical alias `apiRunProductionSmokeChecks`)

## Not in Scope

- No business behavior changes.
- No role policy changes.
- No ACCESS schema migration.
- No sidebar UX changes.
- No production workbook data cleanup.

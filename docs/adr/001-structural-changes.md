# ADR-001: Structural changes must preserve API contracts and server-side guards

## Status

Accepted

## Date

2026-06-18

## Context

WASB has grown from a compact Apps Script project into a multi-domain operational system with access control, reports, vacations, personnel cards, sidebar UI, workbook governance, and CI checks.

The current repository may remain mostly flat for some time, but maintainers may move files into domain folders (`reports/`, `vacations/` — see [ADR-002](../adr/002-domain-folder-map.md)), split large modules, or merge small modules.

These changes are useful only if they remain mechanical. The main risk is silent degradation:

- a new `api*` endpoint appears in code but is not added to the access contract;
- a public endpoint loses its server-side guard;
- a file is moved and governance scripts stop seeing it;
- a refactor accidentally changes role behavior;
- a merge hides security boundaries between access, enforcement, UI, and data layers.

B₁ introduced recursive governance scanning and contract parity checks. A₁ introduced a troubleshooting decision tree for maintainers.

This ADR fixes the rule that connects both parts.

## Decision

Structural changes in WASB are safe only when they are mechanical.

A move, split, or merge is considered mechanical only if it preserves:

- existing public `api*` entrypoints;
- access API contract parity;
- server-side guard behavior;
- role and permission behavior;
- workbook behavior;
- existing CI expectations;
- documented maintainer routes.

If a change modifies public API surface, access rules, guard behavior, role policy, workbook contract, or user-visible behavior, it is not a refactor. It is a functional change and must be reviewed separately.

### Core rule

Move/split/merge is allowed as a mechanical change.

Changing security surface, endpoint contract, guard behavior, role policy, or workbook behavior is a functional change.

## Required checks for structural changes

Before merging any structural change, the maintainer must verify:

```bash
npm run ci
```

If the change touches workbook/report logic:

```bash
npm run ci:workbook
```

If the change touches vacations:

```bash
npm run ci:vacations
```

If the change touches access, endpoint governance, or server-side API:

```bash
npm run ci
```

The following invariants must stay true:

- every `api*` endpoint in code is either public or explicitly excluded;
- every public endpoint in the contract exists in code;
- every excluded endpoint has a reason;
- excluded endpoints do not duplicate public endpoints;
- every governed server-side endpoint keeps the required guard marker;
- recursive scan sees moved files;
- CI remains green after move/split/merge.

## Allowed structural changes

The following changes are allowed when CI remains green and behavior is unchanged:

- moving `.gs` files into domain folders;
- moving `.html` fragments into client folders;
- splitting a large module into smaller files with the same public behavior;
- extracting helper functions without changing endpoint behavior;
- renaming private helper files when all references are updated;
- updating documentation links after file moves;
- updating governance path resolution after file moves.

Examples:

```text
Report_DailySimple.gs
  → reports/Report_DailySimple.gs
AccessControl.AuthResolver.gs
  → access/AccessControl.AuthResolver.gs
Js.Render.Panel.html
  → ui/Js.Render.Panel.html
```

These are structural changes only if public API behavior and guards remain unchanged.

## Changes that are not mechanical

The following changes are functional and require separate review:

- adding a new public `api*` endpoint;
- removing an existing public endpoint;
- changing who can call an endpoint;
- changing `AccessControl_*` role resolution;
- changing `AccessEnforcement_*` assertions;
- removing, weakening, or bypassing a server-side guard;
- changing ACCESS bootstrap behavior;
- changing PERSONNEL key semantics;
- changing formula block expectations;
- changing vacation policy rules;
- changing report labels or report order;
- changing user-visible behavior in sidebar actions.

These changes may still be valid, but they must not be hidden inside a refactor PR.

## Merge / split principles

### Split when

A module should be split when:

- it has multiple clear responsibilities;
- the split creates clearer domain boundaries;
- public behavior can remain unchanged;
- CI can prove endpoint and guard parity;
- the split can be done in small steps.

Preferred split examples (see also [p2-candidates.md](../refactor/p2-candidates.md)):

- `AccessControl.AuthResolver.gs`
- `AccessControl.SheetRepository.gs`
- `AccessEnforcement.gs` (domain guards vs descriptor vs system actor)

### Do not merge when

A module should not be merged if it would blur important boundaries:

- authentication vs authorization;
- access control vs access enforcement;
- UI visibility vs server-side permission;
- report data reading vs report rendering;
- workbook data vs runtime policy.

Security-related modules should prefer clear separation over fewer files.

### Merge only when

A merge is acceptable only if:

- both modules are small;
- they belong to the same domain;
- they have the same reason to change;
- no security boundary is weakened;
- no public endpoint behavior changes;
- CI remains green.

## AccessControl rule

`AccessControl_*` and `AccessEnforcement_*` are high-risk areas.

Changes in these modules must be treated conservatively.

A structural change in access code is allowed only when:

- endpoint contract parity remains green;
- guard markers remain green;
- behavior is unchanged;
- troubleshooting routes remain accurate ([RUNBOOK.md](../../RUNBOOK.md) §9, [developer-guide.md](../developer-guide.md));
- no role policy is changed inside the same PR.

Do not combine access refactor with feature work.

## PR checklist

Before opening a PR with structural changes, answer:

1. Is this only a move/split/merge?
2. Did any `api*` endpoint change?
3. Did any server-side guard change?
4. Did any role or permission behavior change?
5. Did any workbook/report/vacation behavior change?
6. Did recursive governance still find all moved files?
7. Is `npm run ci` green?
8. Are docs/links updated if paths changed?

If any answer from 2–5 is “yes”, the PR is not purely structural.

## Recommended PR shape

Good:

- PR 1: make governance recursive
- PR 2: move `Report_*` files into `reports/`
- PR 3: update Developer Guide links
- PR 4: add new report behavior

Bad:

One PR:

- move access files
- change role policy
- add api endpoint
- update sidebar
- change report output

The bad version makes regressions difficult to isolate.

## Deployment note

`clasp push` is not part of CI and requires the correct authorized production remote.

Before production deploy:

```bash
npm run ci
npx clasp push
```

Only run `clasp push` when the active clasp project is confirmed.

## Consequences

### Positive consequences

- maintainers can safely reorganize the repository;
- CI protects against missing `api*` endpoints;
- guard behavior remains explicit;
- future folder structure changes become lower risk;
- troubleshooting documentation stays aligned with governance.

### Tradeoffs

- refactor PRs must stay smaller;
- access changes require more discipline;
- some quick changes will need to be split into separate commits or PRs;
- CI and contracts become mandatory, not optional.

## Summary

WASB may change its physical structure, but it must not silently change its operational contract.

Folders are allowed. Splits are allowed. Mechanical cleanup is allowed.

Silent changes to access, guards, endpoint contracts, or workbook behavior are not allowed.

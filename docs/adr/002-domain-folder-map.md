# ADR-002: Domain folder map for Apps Script modules

## Status

Accepted

## Date

2026-06-18

## Context

WASB has ~125 `.gs` and ~33 `.html` runtime files. Runtime files now live in purpose-named folders instead of a flat repository root. [ADR-001](./001-structural-changes.md) allows **mechanical** moves when API contracts, guards, and CI stay green.

Pilot `reports/` (#23, #28) and clasp nested-push fixes (#25–#29) proved the pipeline. The next domain moves must follow a fixed map and checklist so PRs stay mechanical—not mixed with CI repair debates, merge proposals, or clasp regressions.

See [module-map.md](../module-map.md) for the live folder table.

## Decision

Move domain-owned `.gs` files into stable top-level folders **without renaming, merging, or behavior changes**.

Each domain move is one PR: `git mv` + governance/doc path updates + CI green.

### Phases

| Phase | Folders | When |
| ----- | ------- | ---- |
| **1** | `reports/`, `vacations/`, `sendpanel/`, `maintenance/`, `diagnostics/` | Done |
| **2** | `access/`, `personnel/` | Done |
| **3** | `ui/` | Done — HTML `include()` chain reviewed and basename-compatible |
| **4** | `api/`, `core/`, `data/`, `sheets/`, `usecases/`, `ui-server/`, `security/`, `operations/`, `smoke/` | Done — root runtime files removed |

HTML (`Js.Vacations.html`, `VacationSidebar.html`, `Sidebar.html`, …) lives in `ui/` after Phase 3. Runtime callers may still pass legacy basenames such as `include("Sidebar")`.

### Invariants (every move PR)

- No basename changes (GAS global namespace unchanged).
- No file merges during structural moves.
- No revert to root-only `!*.gs` / `!*.html` in `.claspignore` (drops nested `reports/` and future folders).
- After nested allowlist, re-exclude: `node_modules/**`, `.git/**`, `_backup*/**` (see #29).
- Full `npm run ci` plus domain CI when applicable (e.g. `npm run ci:vacations`).
- `npx clasp status` before push — correct script project; new folder in **Tracked**; no `node_modules/*.gs|html`.
- Docs updated in the **same PR** as the move (`module-map.md`, ARCHITECTURE paths, domain docs).

### Per-PR checklist

```bash
git diff --stat                    # mv + docs + verify paths only
npm run ci
npm run ci:<domain>              # when listed in module-map
npx clasp status                 # folder present; node_modules absent from tracked
npm run deploy:smoke             # before production clasp push
```

## Out of scope

- Merging `AccessControl.*` or `Js.Security.*`
- Security/client layer restructuring
- Repository rename (`whatsapp-sheets-bot` → …)
- Functional changes hidden inside move PRs
- `npm audit fix --force`

Merge/split of large modules: separate ADR/review per [ADR-001](./001-structural-changes.md) and [p2-candidates.md](../refactor/p2-candidates.md).

## Consequences

- Root file count drops toward ~40–60 without reducing total module count.
- `readRepoFileByBasename` / recursive CI scans remain basename-first; verify scripts with hardcoded `path.join(repoRoot, …)` must be updated in the same PR as the move (known: `verify-vacation-planner.mjs`).
- Phase 3 (`ui/`) keeps `JavaScript.html` include order unchanged and uses basename-compatible `include()` resolution.

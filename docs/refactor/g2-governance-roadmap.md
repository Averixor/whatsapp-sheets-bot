# G2 governance roadmap (implemented)

G1 landed executable contracts under `contracts/` and refactored CI scripts to consume them. **G2 adds structural client-layer enforcement** — no runtime GAS changes.

## Deliverables (status)

| Item | Status | Purpose |
|------|--------|---------|
| [`contracts/client-layers.contract.json`](../../contracts/client-layers.contract.json) | **done** | Client layer graph + forbidden cross-layer references |
| [`scripts/verify-client-deps.mjs`](../../scripts/verify-client-deps.mjs) | **done** | Acyclic dependency enforcement across `Js.*.html` |
| [`contracts/envelope-migration.contract.json`](../../contracts/envelope-migration.contract.json) | **done** | Version bump rules + backward-compat gate |
| XSS sanitizer-sink migration | **done** | `migrationNotes` / `preferredSinks` in `xss-policy.contract.json`; WARN on new non-sink patterns |

## Layer graph

```
core (Js.Core, Js.State, Js.Api)
  ↑
render (Js.Render.Panel, Js.Render.Calendar, Js.Render.Results)
  ↑
features (Js.Diagnostics, Js.Security, Js.Helpers, Js.Events, Js.Actions)
```

- **core** → no upward deps
- **render** → core only (+ `SidebarApp` onclick bridge from features)
- **features** → core + render

Enforced by `npm run ci` → `node scripts/verify-client-deps.mjs`.

## Sequencing (after G2)

1. **PR4** — real test split (needs G1 snapshot governance)
2. **Phase 2** — SheetRepository extract (needs G1 + access baseline discipline)

## Out of scope (unchanged)

- AccessControl / test monolith surgery
- Full envelope semantic versioning migration implementation (rules documented; dedicated PR when version bumps)

See also: `RUNBOOK.md` §19, `docs/refactor/operational-stewardship.md`.

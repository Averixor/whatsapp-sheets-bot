# Snapshot governance

Executable rules for any change under `scripts/snapshots/`. Contracts define shape; snapshots hold captured state.

## Source of truth

| Artifact | Role |
|----------|------|
| `contracts/*.contract.json` | Schema, policy, registry |
| `scripts/snapshots/*.json` | Live facade / access capture |
| `contracts/SNAPSHOT_CHANGELOG.md` | Append-only audit log |

## PR requirements

| Requirement | Detail |
|-------------|--------|
| Labels | `structural-only` + `blast-radius-medium` or higher |
| Separate diff | No snapshot change mixed with feature code |
| Changelog | New dated section in `contracts/SNAPSHOT_CHANGELOG.md` naming each touched file |
| Review | Explicit `paramOrder` / `paramCount` diff in PR description |
| Metadata | Each mutated snapshot must set `reviewedAt` and `changeReason` |
| Canary | Smoke affected API paths before merge |
| Rollback tag | Required if facade contract changes |

## CI enforcement

`node scripts/verify-snapshot-governance.mjs` (in `npm run ci`):

1. Compares `scripts/snapshots/*.json` to `main` (or `CI_BASE_SHA`)
2. On change → requires matching `SNAPSHOT_CHANGELOG.md` entry (date + filename)
3. On change → requires `reviewedAt` and `changeReason` in the JSON

## Bootstrap (not default CI)

Missing `stage7-usecases-facade.json` **fails** `verify-usecase-facade.mjs`.

Explicit one-time write:

```powershell
node scripts/bootstrap-facade-snapshot.mjs
# append contracts/SNAPSHOT_CHANGELOG.md, then commit snapshot in its own PR
```

Overwrite only with `FORCE_BOOTSTRAP=1` and `CHANGE_REASON=...`.

## Bridge strict mode

For `blast-radius-high` merges past bridge sunset: `BRIDGE_STRICT=1 node scripts/verify-bridge-flags.mjs` (exit 1 on WARN). Documented in `contracts/bridge-flags.registry.json`.

## Related

- `docs/refactor/operational-stewardship.md`
- `RUNBOOK.md` §19
- `contracts/facade.contract.json`, `contracts/access.contract.json`

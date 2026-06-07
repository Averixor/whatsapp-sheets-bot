# WASB documentation index

Markdown files are excluded from `clasp push` by `.claspignore`. Keep operational
truth in the documents below; do not add one-off audits or production workbook
snapshots to the repository.

| File                                              | Source-of-truth responsibility                            |
| ------------------------------------------------- | --------------------------------------------------------- |
| [README.md](../README.md)                         | Project overview, quick start, documentation map          |
| [ARCHITECTURE.md](../ARCHITECTURE.md)             | Runtime layers, data flow, canonical APIs                 |
| [RUNBOOK.md](../RUNBOOK.md)                       | Bootstrap, deployment, production checks, troubleshooting |
| [SECURITY.md](../SECURITY.md)                     | Identity, RBAC, lockout, protected data                   |
| [CHANGELOG.md](../CHANGELOG.md)                   | Durable release history                                   |
| [WASB_RELEASE_AUDIT.md](../WASB_RELEASE_AUDIT.md) | Production release verdict (CLOSED 2026-06-07)            |
| [CONTRIBUTING.md](../CONTRIBUTING.md)             | Local workflow, CI, change policy                         |
| [AGENTS.md](../AGENTS.md)                         | Automation-agent instructions                             |
| [vacation-planner.md](./vacation-planner.md)      | Vacation planner workflow, source blocks, and rules       |

## Refactor Planning

| File                                            | Purpose                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------ |
| [p2-candidates.md](./refactor/p2-candidates.md) | Post-release, non-blocking candidates for mechanical module splits |

Machine-readable policy belongs in [`contracts/`](../contracts/). Snapshot
changes are governed by `scripts/verify-snapshot-governance.mjs` and must be
recorded in [`contracts/SNAPSHOT_CHANGELOG.md`](../contracts/SNAPSHOT_CHANGELOG.md).

Production status is recorded in
[`WASB_RELEASE_AUDIT.md`](../WASB_RELEASE_AUDIT.md) (**CLOSED** 2026-06-07).
Re-verify with current evidence when redeploying: `npm run ci`, `clasp status`,
manual `apiRunProductionSmokeChecks()` in GAS, and GAS diagnostics.

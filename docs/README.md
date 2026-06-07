# WASB documentation index

Markdown files are excluded from `clasp push` by `.claspignore`. Keep operational
truth in the documents below; do not add one-off audits or production workbook
snapshots to the repository.

| File | Source-of-truth responsibility |
|------|--------------------------------|
| [README.md](../README.md) | Project overview, quick start, documentation map |
| [ARCHITECTURE.md](../ARCHITECTURE.md) | Runtime layers, data flow, canonical APIs |
| [RUNBOOK.md](../RUNBOOK.md) | Bootstrap, deployment, production checks, troubleshooting |
| [SECURITY.md](../SECURITY.md) | Identity, RBAC, lockout, protected data |
| [CHANGELOG.md](../CHANGELOG.md) | Durable release history |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Local workflow, CI, change policy |
| [AGENTS.md](../AGENTS.md) | Automation-agent instructions |

Machine-readable policy belongs in [`contracts/`](../contracts/). Snapshot
changes are governed by `scripts/verify-snapshot-governance.mjs` and must be
recorded in [`contracts/SNAPSHOT_CHANGELOG.md`](../contracts/SNAPSHOT_CHANGELOG.md).

Production status is verified from current evidence (`npm run ci`, `clasp
status`, `npm run gas:smoke`, GAS diagnostics), not maintained in a static audit
document.

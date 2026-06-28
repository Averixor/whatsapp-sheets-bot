# WASB documentation index

Markdown files are excluded from `clasp push` by `.claspignore`. GAS runtime
`.gs` modules live in domain folders; all `.html` client files live in `ui/`.
The repository root holds manifests, tooling, and documentation only.
Keep operational truth in the documents below; do not add one-off audits or production workbook
snapshots to the repository.

| File                                                             | Source-of-truth responsibility                              |
| ---------------------------------------------------------------- | ----------------------------------------------------------- |
| [README.md](../README.md)                                        | Project overview, quick start, documentation map            |
| [ARCHITECTURE.md](../ARCHITECTURE.md)                            | Runtime layers, data flow, canonical APIs                   |
| [RUNBOOK.md](../RUNBOOK.md)                                      | Bootstrap, deployment, production checks, troubleshooting   |
| [developer-guide.md](./developer-guide.md)                       | First-week map: layers, safe zones, how to think about changes |
| [adr/README.md](./adr/README.md)                                 | Architecture Decision Records (structural change rules)       |
| [module-map.md](./module-map.md)                                 | Domain folders: where modules live, which CI guards them      |
| [adr/003-working-domain-layout.md](./adr/003-working-domain-layout.md) | Working domain folder agreement (not final architecture)   |
| [SECURITY.md](../SECURITY.md)                                    | Identity, RBAC, lockout, protected data                     |
| [CHANGELOG.md](../CHANGELOG.md)                                  | Durable release history                                     |
| [WASB_RELEASE_AUDIT.md](../WASB_RELEASE_AUDIT.md)                | Production release verdict (CLOSED 2026-06-07)              |
| [CONTRIBUTING.md](../CONTRIBUTING.md)                            | Local workflow, CI, change policy                           |
| [AGENTS.md](../AGENTS.md)                                        | Automation-agent instructions                               |
| [vacation-planner.md](./vacation-planner.md)                     | Vacation planner, concurrent rules, mini-calendar UX        |
| [daily-summary-architecture.md](./daily-summary-architecture.md) | Short/detailed day summary modules, formula block, UI flow  |
| [format-rules-governance.md](./format-rules-governance.md)       | Manual conditional-format registry and rebuild protection   |
| [user-facing-copy.md](./user-facing-copy.md)                     | UX copy: UA UI text, no technical names in user-facing strings; enforced by `verify-user-facing-copy.mjs` |
| [project-files-complete.txt](./project-files-complete.txt)       | Canonical depth-first file tree (governance map); refresh with `npm run map:project-files` |

## Refactor Planning

| File                                            | Purpose                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------ |
| [p2-candidates.md](./refactor/p2-candidates.md) | Post-release, non-blocking candidates for mechanical module splits |

Machine-readable policy belongs in [`contracts/`](../contracts/). Snapshot
changes are governed by `scripts/verify-snapshot-governance.mjs` and must be
recorded in [`contracts/SNAPSHOT_CHANGELOG.md`](../contracts/SNAPSHOT_CHANGELOG.md).

**Reference data table:** Code and docs are kept in sync with the provided
"Книга Взводу Охорони.xlsx" (PERSONNEL: split names + **Callsign** column L; month **06** compact B=Позивний;
monthly schedule key: **Callsign** — the xlsx may label the column Позивний/ПОЗИВНИЙ). See RUNBOOK §14 and recent CHANGELOG.

Production status is recorded in
[`WASB_RELEASE_AUDIT.md`](../WASB_RELEASE_AUDIT.md) (**CLOSED** 2026-06-07).
Re-verify with current evidence when redeploying: `npm run ci`, `clasp status`,
`npm run deploy:smoke` (`apiRunSmokeChecks`), or `apiRunStage7RegressionTests()` in GAS diagnostics.

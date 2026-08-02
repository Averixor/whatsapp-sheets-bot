# Branch archive

Pointers to former working branches after consolidation into `main`.
Lightweight git tags `archive/<sanitized-branch-name>` preserve tip SHAs for recovery.

| Branch | Tip (short) | Tip (full) | Date (author) | Status | Note |
| ------ | ----------- | ---------- | ------------- | ------ | ---- |
| `fix/inventory-month-status-dedup` | `b7db519` | `b7db5196ca31a634f03ec86ea0f669eea6903569` | 2026-07-18 | merged into main | Merge commit `a3c8319`; pushed to `origin/main`. |
| `fix/materialize-dict-from-dict-sum` | `9234477` | `923447744df9ff055d2d537ead3137161cdd12a4` | 2026-06-19 | merged into main | Same patch as `ee73e0e` already on main; merge `47ce1b0` kept main `verify-workbook-contract.mjs`. |
| `docs/markdownlint-cleanup` | `c3cac89` | `c3cac8923014304b7bd649662a27df07b589da64` | 2026-07-12 | merged into main | Fully contained; landed via PR #50 / `395c702`. |
| `feat/materialize-computed-data-api` | `1108673` | `110867369461c4f79651cd1cd12e40c963789e5e` | 2026-06-19 | merged into main | Fully contained in main history. |
| `refactor/domain-folders-phase1` | `c1b30d1` | `c1b30d16b9c458a86c151fa60c004a33e72ccda1` | 2026-06-19 | superseded | Experimental WIP; domain layout superseded by ADR-003 / current `docs/module-map.md`. Merge skipped to avoid reverse renames. |
| `agent/fix-inventory-reconciliation` | — | — | — | archived (gone) | Historical; no local/remote ref at archive time; work already on main. |

## Recovery

```bash
git show archive/fix-inventory-month-status-dedup
git checkout -b restore/fix-inventory-month-status-dedup archive/fix-inventory-month-status-dedup
```

Archived on 2026-07-18 during branch consolidation into `main`.

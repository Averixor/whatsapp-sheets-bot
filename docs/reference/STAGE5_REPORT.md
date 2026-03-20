# STAGE5_REPORT

> Reference report for the stabilized Stage 5 baseline preserved inside the Stage 6 Final release.

## What RC2 stabilized
- public diagnostics wording moved away from Stage 4.2 framing
- `Sidebar.html` switched to template-safe `includeTemplate('JavaScript')`
- `JavaScript.html` became the honest monolithic runtime
- `Js.*.html` stopped pretending to be production-active
- canonical maintenance entrypoints were fixed around `Stage5MaintenanceApi.gs`

## What remains true in RC4
The Stage 5 baseline still provides:
- stable application API surface
- spreadsheet / manual action API
- maintenance / diagnostics / jobs API naming lineage
- monolithic sidebar runtime policy
- compatibility facade preservation

## Why this file is reference-only
This document describes the **baseline lineage**, not the active release wording.

Current release identity:
- `Stage 6 Final`

See also:
- `STAGE6_FINAL_REPORT.md`
- `docs/reference/STAGE6A_REPORT.md`

# CodeQL coverage for WASB (open follow-up)

Status: **open task** — no production GAS deploy required.

## Why this exists

WASB runtime is mostly Google Apps Script (`.gs`) plus HtmlService (`.html`)
and Node tooling (`.mjs`). GitHub CodeQL’s published JavaScript extractor
list includes `.mjs` and `.html`, but **not** `.gs`.

Therefore audits must distinguish three independent results:

| Result | Meaning |
| ------ | ------- |
| Local / GitHub **CI** green | Static contracts, copy, governance, Node checks passed |
| **CodeQL** green | Analyzed languages in `.github/workflows/codeql.yml` produced no blocking alerts |
| **GAS `.gs` security review** | AccessControl, APIs, PII paths, and other server modules were actually inspected |

A green CI or CodeQL run **does not** automatically confirm the third.

Current workflow: [`.github/workflows/codeql.yml`](../.github/workflows/codeql.yml)
(`actions` + `javascript-typescript`, `build-mode: none`).

## Open checklist

1. **Inspect the latest CodeQL Analysis logs** (JavaScript/TypeScript job) and
   record which paths entered the database (especially under `ui/`, `scripts/`,
   and whether any `.gs` appears at all).
2. **Research a supported way** to include `.gs` in analysis **without**
   renaming or rewriting production GAS sources (for example temporary CI-only
   copies, extractor options, or an upstream-supported extension mapping). Do
   **not** land unverified workflow parameters until coverage is proven in logs.
3. **If full `.gs` inclusion is not feasible**, document the decision:
   - keep CodeQL for `.mjs`, `.html`, and GitHub Actions;
   - rely on existing Node static/regression checks (`scripts/verify-*.mjs`,
     `scripts/audit-*.mjs`), GAS `tests/` / `smoke/`, and manual review for
     high-risk `.gs` (AccessControl, Stage7 APIs, personnel/phone paths).

## Out of scope for this task

- Changing WASB business logic
- Production `clasp` / GAS deployment
- Treating CodeQL as a substitute for access/RBAC contracts in `SECURITY.md`

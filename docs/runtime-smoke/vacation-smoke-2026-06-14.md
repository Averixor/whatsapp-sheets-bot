# Vacation runtime smoke — 2026-06-14

Result: PASSED via isolated Apps Script smoke project browser run.

Scope:
- VACATION_REQUESTS opt-in source
- unique request ID
- stable PersonKey identity
- Proposed / Approved / Applied separation
- VacationEngine reminder filtering
- PERSONNEL ↔ plan ↔ month-sheet audit
- Calculation_OS isolation
- cleanup harness

Environment:
- Smoke Apps Script project only
- Production GAS project not touched
- Production spreadsheet not touched

Notes:
- Terminal Execution API remained blocked by Google permission/OAuth for the new smoke project.
- Browser GAS run was used for runtime validation.

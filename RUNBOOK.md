# RUNBOOK — Stage 7.1 Reliability Hardened Baseline

## Purpose
This runbook describes the practical operating rules for the active Stage 7.1 baseline.

## Safe operating sequence
1. Open the sidebar from the custom menu.
2. Verify the active month and the target date.
3. Regenerate `SEND_PANEL` only when needed.
4. Open WhatsApp chats through the single named sender tab/window.
5. Confirm sent rows manually so sheet state matches reality.
6. Use diagnostics before and after structural changes.
7. Use reconciliation in preview/dry-run first when inconsistencies are reported.

## Maintenance guardrails
- Do not rewrite domain business logic while fixing metadata or diagnostics alignment.
- Prefer canonical Stage 4/5/7 entrypoints over compatibility wrappers.
- Use dry-run for repair / reconciliation / risky write scenarios whenever supported.
- Keep `.clasp.json` local and out of version control.

## Release identity
- Active release: `Stage 7.1 — Reliability Hardened Baseline`
- Active release report: `STAGE7_REPORT.md`
- Canonical runtime: `JavaScript.html` via `Sidebar.html -> includeTemplate('JavaScript')`

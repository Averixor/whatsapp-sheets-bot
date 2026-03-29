# Changelog

## 2026-03-29 — Security / access cleanup pass
- fixed a broken archive state where `AccessControl.gs` and `AccessEnforcement.gs` had been overwritten by `WorkflowOrchestrator.gs`
- finalized strict user-key identity as the default mode
- added explicit emergency migration bridge by email, disabled by default
- improved automatic `user_key_current` / `user_key_prev` rotation handling
- extended access enforcement for send panel, working actions, day summary, detailed summary, and role-gated maintenance actions
- expanded alert logging structure and violation reporting
- aligned UI role hiding with server role checks through centralized client policy
- cleaned up access diagnostics in the `🧑‍💻` block
- consolidated active documentation to 4 main docs + this changelog
- moved historical reports into `_extras/history/`
- kept GAS packaging friendly

## 2026-03-29 — Previous access hardening baseline
See `_extras/history/TZ_EXECUTION_REPORT_2026-03-29.md` and the other archived notes for the detailed intermediate trail.

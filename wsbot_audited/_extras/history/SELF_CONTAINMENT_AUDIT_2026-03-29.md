# Self-containment audit — 2026-03-29

Base chosen: archive `30.zip`.

Why this base:
- it is the newer revision;
- it keeps a reusable named WhatsApp sender tab (`WA_SENDER_WINDOW`);
- it adds duplicate-open guard and single/batch send locks;
- it is better aligned with the user's requirement to avoid duplicate windows and broken send flows.

Merged/fixed on top of the base:
1. Restored missing helper `getSendPanelWhatsAppTarget_()`.
2. Restored legacy public API wrappers removed from the final-clean baseline, so diagnostics and old callers resolve cleanly.
3. Restored alias `_pickTestCallsign()` -> `_pickTestCallsign_()` for smoke tests.
4. Kept named WhatsApp sender tab reuse, but added `_blank` fallback if the browser blocks the named target.

Static audit summary:
- syntax check: PASS
- packaged static checks: PASS
- Api.run / gsRun literal method calls resolved: PASS
- routing registry public API methods resolved: PASS
- SidebarApp onclick references resolved: PASS

Important limitation:
- this audit is static/offline and does not execute against the real spreadsheet, triggers, permissions or browser popup policy. Final live verification still should be done inside the bound Apps Script project.

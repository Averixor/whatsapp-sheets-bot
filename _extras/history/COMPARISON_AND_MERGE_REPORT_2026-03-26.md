# Comparison and merge report — 2026-03-26

## Input archives
1. `whatsapp-sheets-bot-main_reworked_stage7_v3_repairfix.zip`
2. `whatsapp-sheets-bot-main_reworked_stage7_v3_repairfix_FIXED_STAGE7_FINAL.zip`
3. `whatsapp-sheets-bot-main_stage7_1_1_final_stabilized_repair.zip`

## Verdict
No single archive is the clean winner.

- `...reworked_stage7_v3_repairfix.zip` is the weakest of the three because it lacks later fixes and added stabilization docs.
- `...FIXED_STAGE7_FINAL.zip` contains important UI/runtime and no-`eval` fixes, but it is not the most advanced server-side baseline.
- `...stage7_1_1_final_stabilized_repair.zip` is the strongest server-side baseline, but it regressed some already-fixed items from `...FIXED_STAGE7_FINAL.zip`.

## Why there is no single winner
### `stage7_1_1_final_stabilized_repair.zip` strengths
- Newer metadata baseline `7.1.1-final-stabilized-repair`.
- Broader canonical phone-index migration (`loadPhonesIndex_`, `findPhone_`, repository/service call sites).
- Better timezone normalization path.
- Additional domain tests for canonical lookup and `{{name}}` templates.

### `stage7_1_1_final_stabilized_repair.zip` regressions versus `FIXED_STAGE7_FINAL.zip`
- `Diagnostics.gs` reintroduced `eval(...)`-based symbol resolution.
- `SmokeTests.gs` reintroduced `eval(...)`-based function detection.
- Client send-flow runtime files (`Js.Core.html`, `Js.Render.html`, `Js.State.html`) did not include the stabilized chained-timeout/cancel flow from `FIXED_STAGE7_FINAL.zip`.
- Some maintenance cache-clearing paths did not clear the new phone-index cache key.
- Several stabilization docs from `FIXED_STAGE7_FINAL.zip` were missing.

## What was merged into the final archive
Base: `whatsapp-sheets-bot-main_stage7_1_1_final_stabilized_repair.zip`

Pulled from `...FIXED_STAGE7_FINAL.zip`:
- `Js.Core.html`
- `Js.Render.html`
- `Js.State.html`
- `SmokeTests.gs`
- `CANONICAL_APIS_STAGE7_FINAL_STABILIZED.md`
- `CHANGELOG_STAGE7_FINAL_STABILIZED.md`
- `COMPATIBILITY_ALIASES_STAGE7_FINAL_STABILIZED.md`
- `STABILIZATION_CHECK_REPORT_STAGE7_FINAL.md`

Manual merge repairs applied:
- `Diagnostics.gs`: removed `eval(...)` regression while preserving Stage 7.1.1 diagnostics additions.
- `Utils.gs`: `clearPhoneCache()` now clears flat/index/profile phone cache generations.
- `UseCases.gs`: maintenance cache-clearing paths now clear flat/index/profile phone cache generations.

## Verification performed
- ZIP structure preserved.
- All `.gs` files pass static `node --check` syntax validation.
- All embedded `<script>` blocks in `.html` files pass static `node --check` syntax validation.
- Final archive assembled as a new merged ZIP.

## Final output name
`whatsapp-sheets-bot-main_STAGE7_BEST_MERGED_2026-03-26.zip`

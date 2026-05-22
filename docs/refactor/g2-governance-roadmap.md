# G2 governance roadmap (post-G1)

G1 landed executable contracts under `contracts/` and refactored CI scripts to consume them. **G2 is structural enforcement only** — no runtime GAS changes in the G2 PR itself.

## Planned deliverables

| Item | Purpose |
|------|---------|
| [`contracts/client-layers.contract.json`](../contracts/client-layers.contract.json) *(planned)* | Client layer graph + forbidden cross-layer references |
| [`scripts/verify-client-deps.mjs`](../scripts/verify-client-deps.mjs) *(planned)* | Acyclic dependency enforcement across `Js.*.html` |
| Envelope `version` migration rules | Backward-compat gate when `envelope.contract.json` version bumps |
| XSS sanitizer-sink migration | Reduce `SAFE_EXPR` growth; route new HTML through `sanitizerSinks` in `xss-policy.contract.json` |

## Sequencing (after G1 merge)

1. **G2 PR** — client-layers contract + `verify-client-deps.mjs`
2. **PR4** — real test split (needs G1 snapshot governance)
3. **Phase 2** — SheetRepository extract (needs G1 + access baseline discipline)

## Out of scope for G2 doc-only note

- AccessControl / test monolith surgery
- Envelope semantic versioning migration implementation (rules only until dedicated PR)

See also: `wasb_g1_governance` plan G2 preview table in project planning artifacts.

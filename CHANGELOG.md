# Changelog

## 2026-08-02 — Resize month schedule formulas on create / capacity change

- After callsign capacity expand/shrink, rewrite schedule-bound A1 formula ranges so they match the current code grid (`rewriteMonthlyScheduleFormulasToCodeRange_`), same spirit as CF schedule remap.
- Both create paths (Stage-7 MonthOps + legacy MonthSheets) pass source-month bounds, allow trailing capacity shrink, then remap formulas before vacation sync / CF restore.
- Covers lower summary-block spans (`$C$2:$AG$32`, `INDEX`/`ROWS`/`COUNT` day headers) and same-row day COUNTIF ranges; skips `PERSONNEL!` / `DICT_SUM!` refs.

## 2026-08-02 — Exact CF replace after month create syncs

- **Follow-up to #57:** after callsign + vacation sync, both create paths call `replaceConditionalFormatRulesFromSheet_` (exact clone + schedule-bound range remap / dedupe) instead of A1-only copy + separate extend.
- **Hard fail:** create-next-month paths throw if CF restore fails (no silent drop); Stage-7 returns `conditionalFormatSync`.
- **Kept from #57:** no `PASTE_CONDITIONAL_FORMATTING` on row expand; `extendConditionalFormatRulesThroughRow_` for capacity growth; data-validation re-copy via `_copyMonthSheetDataValidationsFromSource_`.

## 2026-08-02 — Restore month CF + data validation on create

- **Root cause:** monthly callsign row expand used `PASTE_CONDITIONAL_FORMATTING`, which corrupts/drops sheet-level conditional format rules on real workbooks (observed loss of ~13 CF rules + related borders when creating the next month).
- **Fix:** stop CF paste on row expand; extend existing CF ranges via `extendConditionalFormatRulesThroughRow_`; after `createNextMonth` / `createNextMonthSheet`, restore source-month CF rules + data validations with `_ensureNewMonthSheetKeepsSourceRules_`.
- **Kept:** `Sheet.copyTo` month creation, Callsign → Last name display, format + data-validation paste for new capacity rows.

## 2026-08-02 — System status foundation (feature branch)

- **Code:** `diagnostics/SystemStatus.Foundation.gs`, `SystemStatus.Probes.gs`, `SystemStatus.Fingerprints.gs`, `SystemStatus.Runtime.gs` plus contracts `contracts/system-status.contract.json` / `contracts/system-status-fingerprints.contract.json`.
- **CI:** `scripts/verify-system-status-foundation.mjs`, `scripts/verify-system-status-fingerprints.mjs`.
- **Scope:** internal foundation (SS-1/SS-2); not yet a sidebar/public Stage7 surface (SS-3).
- **Docs:** `docs/module-map.md` Diagnostics row updated on this branch only.
- **SS-2A9:** closed canonical-scope semantic domains (`vacationSourceMode` enum `legacy|requests`, target month `01`–`12` coherence, fail-closed malformed scope before skip); adversarial verify/GAS repros retained over earlier main fingerprint projection.
- **SS-2B:** runtime construction of typed per-stage `operationScope` + `trustedContextMap` (`SystemStatusRuntime_`); wired through `materializeAllComputedData_` for public WorkflowOrchestrator and daily `checkVacationsAndBirthdays` (document lock); Foundation/regression exercise constructed scopes via `evaluateOperation`; fingerprints contract v12 with `runtimeConstructionImplemented: true`.

## 2026-07-31 — Unified JOURNAL / SUMMARY (all months)

- **Sheets:** per-month `ЖУРНАЛ_MM` / `ПІДСУМОК_MM` superseded by English tabs **`JOURNAL`** and **`SUMMARY`** (column **Місяць**; full person summary only — no short-summary sheet).
- **Sidebar / `apiStage7MaterializeMonthJournal()`:** replaces only the active bot month’s slice; past months stay intact.
- **`apiStage7MaterializeAllMonthJournals({ nextCursor?, monthsPerCall? })`:** chunked bootstrap (default 3 months/call); **не підключено до UI** (`uiAllowed: false`); **призначено для GAS editor** (public `api*` + maintainer). Continuation fields are inside the Stage7 envelope (`response.data.result.done` / `nextCursor` / `batchMonths` / `cursor`), not top-level.
- **SUMMARY merge:** existing data rows read with `getValues()` (numeric counters stay numbers); headers may use `getDisplayValues()`.
- **API payload:** slim client responses (no `journalRows`); sheet writes remain full.
- **Legacy:** old `ЖУРНАЛ_*` / `ПІДСУМОК_*` tabs are not auto-deleted.

## 2026-07-11 — Docs synced to inventory reconciliation and runtime chain

- **ARCHITECTURE.md:** client `activeRuntimeChain` (Modals, Vacations partials, VacationSync, InventoryReconciliation); §7.3 WEAPON; new §7.4 inventory reconciliation.
- **SECURITY.md:** `drive.readonly` OAuth scope; sysadmin UA maintenance action keys (`відновлення`, `захист аркушів`, `тригери`).
- **README.md / docs index / module-map / developer-guide / AGENTS.md / CONTRIBUTING.md / RUNBOOK.md §24:** inventory reconciliation and vacation monthly sync cross-links.

## 2026-07-11 — Inventory reconciliation module

- **Workbook:** dynamic green/pale-pink month status formatting for `INVENTORY_RECONCILIATION`; current and future incomplete months stay neutral.
- **Drive index:** recursive read-only scan, service/month filename matching, duplicate detection, hidden `INVENTORY_RECONCILIATION_FILES` storage, and cell notes with document links.
- **Sidebar:** new **Звірка** section with month progress, service/file list, selected-cell opening, folder configuration, manual synchronization, and 15-minute stale auto-sync.
- **Governance:** routes, RBAC, runtime metadata, client includes, OAuth scope contract, and project-file map updated.

Historical record of changes. For the current operational truth, use `README.md`, `RUNBOOK.md`, `ARCHITECTURE.md`, `CONTRIBUTING.md`, `AGENTS.md`, and the active contracts / verify scripts.

## 2026-07-10 — Stage 7.1 governance diagnostics alignment

- **Diagnostics:** health/release checks no longer show "Як виправити" hints when status is OK.
- **Metadata:** `activeRuntimeChain`, `getClientRuntimeContract_().runtimeModules`, and release bundle index now include `Js.Modals.html` and `Js.VacationSync.html`.
- **CI:** `verify-client-includes.mjs` cross-checks `ProjectMetadata.gs` active runtime chain against `client-includes.contract.json`.

## 2026-07-10 — Full docs/code audit alignment

- **PERSONNEL Status self-heal:** `personnel-status.contract.json` and `PersonnelRepository.gs` now target reference column **Q** (17), matching `reference-workbook-layout.contract.json` (column P is `OSH 4`).
- **Docs:** fixed stale Callsign/Email column letters in `AGENTS.md`, `.cursor/rules/personnel-data-keys.mdc`, `docs/README.md`, and `README.md` (Status self-heal column).
- **Docs:** removed duplicate `/ WEAPON` typos in `ARCHITECTURE.md`, `docs/module-map.md`, `docs/developer-guide.md`, `docs/README.md`, and `RUNBOOK.md`.
- **CI:** `verify-reference-workbook-layout.mjs` and `verify-personnel-status-contract.mjs` cross-check Status column parity across contracts.

## 2026-07-31 — Month journal active-month vs all-months split

- **Sidebar / `apiStage7MaterializeMonthJournal()`:** refresh only the active bot month (fallback: open `01`–`12` tab).
- **`apiStage7MaterializeAllMonthJournals()`:** maintainer bootstrap for every existing month sheet `01`–`12` (**не підключено до UI**, `uiAllowed: false`; **призначено для GAS editor**; public `api*` + maintainer). Continuation in `response.data.result.*`.
- **Write fix:** `getRange` height uses `rows.length` (not end-row).
- **Docs:** Stage7 API lists in `README.md`, `RUNBOOK.md`, `AGENTS.md`, `ARCHITECTURE.md`, `docs/developer-guide.md` mention both APIs.

## 2026-07-03 — Docs and governance synced to current code

- **Docs:** aligned `README.md`, `RUNBOOK.md`, `ARCHITECTURE.md`, `CONTRIBUTING.md`, `AGENTS.md`, `docs/README.md`, `docs/developer-guide.md`, `docs/module-map.md`, and ADR summaries with the current Stage 7 codebase.
- **Current features documented:** derived month journal `ЖУРНАЛ_MM` / `ПІДСУМОК_MM`, optional `PHONE_DIRECTORY` / `CAR` / `WEAPON` reference sheets, and `PERSONNEL.Status` runtime self-heal.
- **Governance:** extracted declarative contracts for month journal and reference repositories; updated verifiers to read those contracts instead of hardcoded expectations.
- **Release status docs:** marked `WASB_RELEASE_AUDIT.md` as historical snapshot rather than current readiness truth.

## 2026-07-03 — Month journal, reference sheets, and PERSONNEL Status self-heal

- **`reports/MonthJournalMaterialize.gs`** + sidebar/API/governance wiring: derived `ЖУРНАЛ_MM` and `ПІДСУМОК_MM` per month sheet (`01`..`12`) via `apiStage7MaterializeMonthJournal()`.
- **`data/DictionaryRepository.gs` / `ReferenceSheetsRepository_`**: optional `PHONE_DIRECTORY`, `CAR`, and `WEAPON` repositories with sidebar views and maintainer access.
- **`personnel/PersonnelRepository.gs` / `personnel/PersonnelMaterialize.gs`**: missing `Status` header is auto-created and validated before PERSONNEL materialize flows continue.
- **UI:** `PHONE_DIRECTORY` WhatsApp buttons normalized to fixed-width `WA`; unavailable numbers render as inactive `Н/Д` badges.

## 2026-06-20 — Reference workbook layout contract ("Книга Взводу Охорони.xlsx")

- **Contract:** `contracts/reference-workbook-layout.contract.json` — headers for PERSONNEL, PHONES, BIRTHDAY, DICT, DICT_SUM, month `02`/`06`, VACATIONS extracted from the reference xlsx.
- **Code:** `PersonnelRepository.gs` — aliases `ID v/s` → `ID_VS`, ignore `Cells`; comments corrected: reference uses **Email column L** and **Callsign column M**, not TEMPLATE.
- **Docs:** `RUNBOOK.md` §14, `AGENTS.md`, `README.md`, `docs/README.md`, `.cursor/rules/personnel-data-keys.mdc` aligned with the reference file.
- **CI:** `scripts/verify-reference-workbook-layout.mjs` guards contract vs aliases and docs.

## 2026-06-13 — Sync to reference workbook "Книга Взводу Охорони.xlsx"

- **Code:** PersonnelRepository now fully supports the physical PERSONNEL layout from the reference xlsx:
  - Split name columns `Last name` / `First name` / `Patronymic` → synthesized `FML`
  - **`Email` column L** and **`Callsign` column M** hold working email/callsign values (reference has no TEMPLATE column)
  - Aliases extended for split names and `ID v/s`; FML requirement relaxed when name parts present
  - Monthly sheets in the xlsx use `ПОЗИВНИЙ` (Callsign) + `П.І.Б.` / codes — compatible with existing SheetSchemas / lookup by Callsign
- **Docs:** Updated `README.md`, `RUNBOOK.md` §14, `AGENTS.md`, `CHANGELOG.md` to describe logical vs physical columns, reference xlsx support, and post-sync state. All documents aligned with project + the provided table.
- **Verification:** `npm run ci` (guardrails for personnel-status, workbook, recipient, client, etc.) re-checked after changes.
- No new modules; only targeted extensions inside existing reading logic. `apiStage7ClearPhoneCache()` still mandatory after PERSONNEL changes.

## 2026-06-09 — Public API RBAC and deployment separation

- **Security:** fail-closed RBAC on personnel callsigns, birthday links,
  reconciliation, sidebar data, send-panel entrypoints, summaries, and
  spreadsheet action APIs; guest bootstrap no longer reads personnel or
  commander-recipient data.
- **Governance:** `contracts/access-api.contract.json` v3 and
  `verify-access-api-governance.mjs` cover all 68 public/canonical APIs, all
  client `Api.run` calls, role/guard markers, explicit non-public entrypoints,
  routing metadata, bundle-file existence, and deployment manifests.
- **Metadata:** removed ghost `Js.Render.html` / `Stage7CompatConfig.gs`
  references and registered bootstrap, pending/fast sent, quick-health, and
  calendar compatibility routes.
- **Operations:** production Execution API is `MYSELF`; remote smoke uses a
  separate non-production project, `appsscript.smoke.json`, and
  `apiRunSmokeChecks`. `GasRuntimeSmoke.gs` is excluded from production push.
- **Post-deploy:** `apiStage7ClearPhoneCache()` is mandatory after every
  production deploy and after PERSONNEL/PHONES changes.

## 2026-06-07 — PERSONNEL Status dropdown aligned with production workbook

- **`PersonnelRepository.gs`**: 9-value dropdown (`В наявності` … `СЗЧ`); default
  `В наявності`; inactive `Вибув` + `СЗЧ`; legacy `Дієвий`/`Відрядження`/EN on read
- **`contracts/personnel-status.contract.json`**, **`scripts/verify-personnel-status-contract.mjs`**: CI governance
- Docs: **`README.md`**, **`ARCHITECTURE.md`**, **`RUNBOOK.md`**, **`AGENTS.md`**, **`SheetSchemas.gs`**, **`DomainTests.gs`**

- aligned `README.md`, `ARCHITECTURE.md`, `RUNBOOK.md`, `SECURITY.md`,
  `CONTRIBUTING.md`, and `AGENTS.md` with the current code and 17-check CI suite
- reduced documentation to maintained operational sources plus `docs/README.md`
- removed one-off audit snapshots, completed refactor notes, and the unused
  generic code-of-conduct document
- moved release-status verification to current evidence: CI, clasp status,
  separate smoke project, and GAS diagnostics

## 2026-05-29 — Remote GAS runtime smoke (clasp run)

- **`GasRuntimeSmoke.gs`**: `apiRunProductionSmokeChecks()` — policy, normalize, client signal, health, migration flag
- **`appsscript.json`**: `executionApi.access: ANYONE` for remote execution
- **`package.json`**: `gas:smoke`, `deploy:prod`
- **`AGENTS.md`**, **`RUNBOOK.md`**: production runtime smoke flow and expectations

## 2026-05-29 — P2 Node/scopes/XSS governance

- **`.nvmrc`**, **`package.json` `engines.node`**, **`scripts/verify-node-version.mjs`**: Node 24 precheck (`npm run precheck`) before CI
- **`contracts/oauth-scopes.contract.json`**, **`scripts/verify-oauth-scopes.mjs`**: OAuth scope audit; removed unused `documents` + full `drive` from **`appsscript.json`**
- **`contracts/xss-policy.contract.json` v2**: explicit `reviewedAllowlist` groups with full SAFE_EXPR coverage

## 2026-05-29 — ACCESS temp password hash-only storage

- **`AccessControl.Core.gs`**: `WASB_ACCESS_TEMP_PASSWORD_PLAIN_LOOKUP` migration flag; `sanitizeAccessSecretFieldUpdates_` / `resolveAccessTemporaryPasswordPlainForPersist_` strip plaintext unless flag is on
- **`AccessControl.AuthResolver.gs`**: key request persists hash/salt only; returns plaintext once in response (`temporaryPasswordShowOnce`)
- **`AccessControl.SheetRepository.gs`**: hash-only writes in `_ensureTemporaryAccessPasswordForRow_`; normalize scrubs legacy `temporary_password_plain` when migration flag is off
- **`Js.Security.Forms.html`**: show one-time temp code in login modal after key request
- **`AccessPolicyChecks.gs`**: asserts plain lookup off by default and plaintext not persisted
- **`AccessEnforcement.gs`**, **`Stage7ServerApi.gs`**: safe `apiStage7ReportClientAccessSignal`; `apiStage7ReportAccessViolation` sysadmin-only
- **`contracts/access-api.contract.json`**, **`scripts/verify-access-api-governance.mjs`**: CI governance for access API surface
- **`ProjectMetadata.gs`**: `PROJECT_STAGE7_ACCESS_API_ROLE_POLICY_`; deprecated `apiStage7BindCurrentKeyToCallsign` removed from canonical map
- **`SECURITY.md`**, **`README.md`**, **`RUNBOOK.md`**: documented hash-only policy and migration flag

## 2026-05-31 — system trigger access + maintenance job restore

- **`AccessEnforcement.gs`**: shared `buildSystemTriggerAccessDescriptor`, exported `isSystemTriggerContext`; `assertCanRunLeaveBirthdayCheck` allows admin/sysadmin/owner or full system trigger context
- **`Triggers.gs`**: centralized `_applySystemTriggerContext_()` for all managed time-based jobs
- **`UseCases.Maintenance.gs`**: restored `runMaintenanceScenario` execute/sync (fixes broken `executeMaintenanceScenario_` reference that blocked health/cache/retention trigger jobs)
- **`ARCHITECTURE.md`**, **`SECURITY.md`**, **`RUNBOOK.md`**: documented system actor, managed trigger registry, and troubleshooting for headless guest false positives

## 2026-05-21 — documentation aligned with codebase

- expanded **`ACCESS`** schema docs to match `SHEET_HEADERS` in `AccessControl.Core.gs` (32 columns, `registration_status` values)
- documented Script properties (`WASB_SPREADSHEET_ID`, `WASB_OWNER_EMAIL`, migration bridge) in **`README.md`**, **`RUNBOOK.md`**, **`SECURITY.md`**, **`ARCHITECTURE.md`**
- removed hardcoded spreadsheet IDs from docs and debug helpers; resolver is **`getWasbSpreadsheet_()`** via Script properties
- corrected **`RUNBOOK.md`**: no `_extras/` folder; bootstrap entrypoints mapped to source files
- updated **`ARCHITECTURE.md`**: `Styles.html` bundle, `ProjectRequests` APIs, script properties section

## 2026-05-17 — Stage 7.1 production release CLOSED

- Production-реліз WASB Stage 7.1 закрито.
- Підтверджено: Git working tree clean, GitHub main up-to-date, GAS pushed.
- CI локально: `ci-gas-sanity` OK, `audit-function-graph` OK, `MISSING: none`.
- GAS validation: project test pack PASS, Access diagnostics PASS, protections apply OK.
- Виправлено й підтверджено envelope `dryRun`: `data.result.dryRun=false`, `data.meta.dryRun=false`, top-level `dryRun=false`.

## 2026-05-15 — optional business sheets documentation

- documented auto-seeding of **`Дані` / `Проєкти` / `Заявки`** (sidebar bootstrap, empty-sheet-only rule, template rows) in **`RUNBOOK.md`** §20, **`ARCHITECTURE.md`**, **`README.md`**, **`CONTRIBUTING.md`**
- aligned inline comments in **`Stage7ServerApi.gs`** and **`ProjectRequests.gs`** with the same behaviour

## 2026-05-08 — Stage 7.1.5 maintenance

- dropped unused `script.external_request` OAuth scope from `appsscript.json`
- person card and calendar sidebars use default X-Frame-Options (no `ALLOWALL`)
- documented `setHtml()` contract in the client (`Js.Core.html`)
- aligned bundle metadata, smoke assertions, and diagnostics baseline markers to **7.1.5**
- added GitHub Actions workflow and `npm run ci` to catch accidental shell text pasted into `.gs` files

## 2026-04-05 — access and sidebar stabilization

- separated the read-only access descriptor path from mutating login/bind behavior
- aligned the sidebar bootstrap with lightweight access and startup routes
- introduced/used lightweight access descriptor and sidebar bootstrap endpoints for faster first load
- documented the identifier + callsign self-bind flow as the normal unregistered-user path
- clarified that `ACCESS` stores key hashes, not raw keys
- cleaned the documentation set and excluded one-off historical notes from the compact GAS import ZIP

## 2026-03-29 — Stage 7.1.2 final-clean baseline

- established the Stage 7.1.2 final-clean release identity
- reduced active documentation to maintained operational sources
- kept historical reports outside the active runtime docs path
- preserved compatibility facades while marking them as non-canonical
- aligned release naming, metadata, diagnostics wording, and runtime packaging

## 2026-03-29 — security and access hardening

- finalized strict user-key identity as the default mode
- added controlled automatic promotion from previous key hash to current key hash
- kept an explicit emergency migration bridge by email, disabled by default
- hardened viewer permissions so a viewer may open only their own card and not the detailed summary
- separated maintenance/admin/sysadmin/owner access by real server-side permissions
- improved access diagnostics and role-aware sidebar reporting

## 2026-03-26 to 2026-03-29 — stabilization and canonicalization trail

Intermediate reports, merge notes, canonicalization audits, and one-off delivery notes are intentionally kept outside this compact GAS import ZIP.

# Changelog

## 2026-05-29 — ACCESS temp password hash-only storage

- **`AccessControl.Core.gs`**: `WASB_ACCESS_TEMP_PASSWORD_PLAIN_LOOKUP` migration flag; `sanitizeAccessSecretFieldUpdates_` / `resolveAccessTemporaryPasswordPlainForPersist_` strip plaintext unless flag is on
- **`AccessControl.AuthResolver.gs`**: key request persists hash/salt only; returns plaintext once in response (`temporaryPasswordShowOnce`)
- **`AccessControl.SheetRepository.gs`**: hash-only writes in `_ensureTemporaryAccessPasswordForRow_`; normalize scrubs legacy `temporary_password_plain` when migration flag is off
- **`Js.Security.Forms.html`**: show one-time temp code in login modal after key request
- **`AccessPolicyChecks.gs`**: asserts plain lookup off by default and plaintext not persisted
- **`AccessEnforcement.gs`**, **`Stage7ServerApi.gs`**: safe `apiStage7ReportClientAccessSignal`; `apiStage7ReportAccessViolation` sysadmin-only
- **`contracts/access-api.contract.json`**, **`scripts/verify-access-api-governance.mjs`**: CI governance for access API surface
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
- marked **`WASB_REPAIR_NOTES.md`** as historical; **`WASB_RELEASE_AUDIT.md`** metrics refreshed

## 2026-05-17 — Stage 7.1 production release CLOSED

- Production-реліз WASB Stage 7.1 закрито.
- Підтверджено: Git working tree clean, GitHub main up-to-date, GAS pushed.
- CI локально: `ci-gas-sanity` OK, `audit-function-graph` OK, `MISSING: none`.
- GAS validation: project test pack PASS, Access diagnostics PASS, protections apply OK.
- Виправлено й підтверджено envelope `dryRun`: `data.result.dryRun=false`, `data.meta.dryRun=false`, top-level `dryRun=false`.
- Додано `WASB_RELEASE_AUDIT.md` як фінальний audit/status-документ релізу.

## 2026-05-15 — optional business sheets documentation

- documented auto-seeding of **`Дані` / `Проєкти` / `Заявки`** (sidebar bootstrap, empty-sheet-only rule, template rows) in **`RUNBOOK.md`** §18, **`ARCHITECTURE.md`**, **`README.md`**, **`CONTRIBUTING.md`**
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
- reduced active root documentation to five operational markdown files
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

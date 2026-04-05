# Changelog

## 2026-04-05 — access and sidebar stabilization
- separated the read-only access descriptor path from mutating login/bind behavior
- aligned the sidebar bootstrap with lightweight access and startup routes
- introduced/used lightweight access descriptor and sidebar bootstrap endpoints for faster first load
- documented the identifier + callsign self-bind flow as the normal unregistered-user path
- clarified that `ACCESS` stores key hashes, not raw keys
- cleaned the documentation set and archived root-level one-off notes under `_extras/history/`

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
Intermediate reports, merge notes, canonicalization audits, and one-off delivery notes were archived under `_extras/history/`.

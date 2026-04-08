# _extras index

`_extras/` contains **non-runtime** materials.
Nothing here is required for normal GAS execution unless you deliberately use a local helper script.

## Structure
- `history/` — archived reports, old transition notes, patch notes, delivery notes, and one-off documentation
- `tools/` — local validation helpers such as syntax and static checks
- `backups/` — non-runtime backup fragments

## Rules
- do not import `_extras/` into the GAS web editor as runtime code
- do not keep active operational docs duplicated here when they already live in the repository root
- put one-off reports and migration-era writeups into `history/`
- keep active docs in the root only

## What was cleaned up
The root and `_extras/` previously contained duplicate or transitional documentation.
The active documentation set is now intentionally small and lives in the repository root.
Historical material remains preserved in `history/` for traceability.

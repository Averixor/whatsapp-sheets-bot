# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

WASB is a Google Apps Script (GAS) bundle bound to a Google Spreadsheet. There is no standalone backend or frontend server — the entire runtime lives inside the Google Apps Script environment. Local development is limited to static analysis, linting, and deployment via `clasp`.

### Running lint/CI checks

```bash
npm run check    # alias for full CI
npm run ci
```

This runs all static analysis scripts (GAS sanity, clasp patterns, language/copy guards, workbook and domain contracts, function graph audit, client verification, XSS audit, envelope compat, usecase facade, snapshot governance, bridge flags, access API governance, OAuth scopes, jsconfig verification). All checks are Node.js-based and do not require any Google credentials or network access.

Individual subscripts: `npm run ci:gas`, `npm run ci:client`, `npm run ci:copy`, `npm run ci:language`, `npm run ci:workbook`, `npm run ci:materialize`, `npm run ci:vacations`, `npm run ci:recipients`, `npm run ci:personnel-status`, `npm run ci:format-rules`, `npm run ci:access-autofill`, `npm run audit:functions`.

### Terminal deploy commands

| Command | What it does |
| -------- | ------------- |
| `npm run check` / `check:all` | Full local CI (= `npm run ci`) |
| `npm run c` | Refresh file map + full CI |
| `npm run deploy:prod` | Full CI + `npx clasp push` (production) |
| `npm run push:remote` | `git push` + `clasp push` — **no CI**; tree must be committed |
| `npm run gas` | Node version check + `clasp push` only — **not** full CI |
| `npm run gh -- "msg"` | Commit (if dirty) + `git push` |
| `npm run ship` / `go -- "msg"` | `c` + `gas` + `gh` — map, CI, GAS push, GitHub |
| `npm run gas:open` | Open GAS editor (`npx clasp open-script`, clasp 3.x) |
| `npm run gas:push` / `gas:status` | Production clasp helpers |


### Node.js version

CI and local dev recommend **Node.js 24** (`.github/workflows/ci.yml`, `.nvmrc`). `package.json` `engines.node` is **`>=24`** with no upper cap — Node 25, 26, … pass `npm run precheck` unless you add an explicit `<` / `<=` in engines. `npm run ci` runs precheck first (`scripts/verify-node-version.mjs`).

```bash
nvm use    # reads .nvmrc (24)
npm run ci
```

The `/exec-daemon/node` binary (Node 22) takes precedence in PATH by default. If running commands manually, ensure `$NVM_DIR/versions/node/v24.16.0/bin` is first in PATH, or source nvm and run `nvm use 24`.

### No local application runtime

This project cannot be "run" locally in the traditional sense. There is no dev server, no build step, and no Docker setup. The application runs exclusively inside Google's Apps Script + Sheets environment. Deployment is done via `clasp push` which requires Google OAuth login (`clasp login`).

### Testing

- **Local (automated):** `npm run ci` — **32** verify scripts (+ `precheck`), no Google credentials.
- **Remote (manual):** `apiRunStage7RegressionTests()` or `runSmokeTests()` in the GAS editor.

Documentation index: [`docs/README.md`](./docs/README.md). Verify release status
from current CI, `npm run gas:status`, and GAS diagnostics.

### Production deploy

After local CI and deploy:

```bash
npm run check
npm run deploy:prod
apiStage7MaterializeComputedData()  # after PERSONNEL / PHONES / VACATIONS / birthday / Status edits
apiStage7MaterializeMonthJournal({ monthSheet: "07" })  # if month-derived journal sheets must be refreshed
apiStage7ClearPhoneCache()          # run in the production GAS editor after deploy
```

Or: `npm run push:remote` after commit (git + clasp, no second CI run).

**If `clasp push` fails:**

1. Run `clasp login` and confirm `.clasp.json` scriptId matches the target project.
2. Confirm production `appsscript.json` remains `"executionApi": { "access": "MYSELF" }`.

### Repository map (`docs/project-files-complete.txt`)

Before structural edits, treat **`docs/project-files-complete.txt`** as the canonical
file tree of the repo (depth-first, excludes `.git/`, `node_modules/`, and local
`.clasp*.json` binding files).

**Agent / contributor rules:**

- Before changes: skim the map to pick the correct **existing domain module** — do not add files when an existing folder already owns the concern.
- **Client UI:** `ui/Js.*.html`, `ui/Js.Render.*.html`, `ui/Js.Security*.html` first.
- **Server HTML / dialogs:** `ui-server/`.
- **Styles:** `ui/Styles*.html` only.
- Do not mix unrelated JS, GAS, and CSS in one change unless the task requires it.
- Do **not** move files between domain folders without updating **`contracts/`**, **`docs/module-map.md`**, and release audit notes when applicable.
- After **create / delete / rename / move** of any tracked file: refresh the map (see below) and include it in the same PR/commit.

**Refresh the map:**

```bash
npm run map:project-files
git diff -- docs/project-files-complete.txt
```

**Pre-release gate:**

```bash
git status --short
git diff -- docs/project-files-complete.txt
npm run release:check    # same as npm run ci; includes verify-project-files-map
```

Manual alternative (requires `tree`): see **`RUNBOOK.md` §12**.

### Structural moves (ADR-002)

Domain folders (`reports/`, `vacations/`, `core/`, `ui/`, …) are mechanical moves only. Working layout: [`docs/adr/003-working-domain-layout.md`](./docs/adr/003-working-domain-layout.md), live table [`docs/module-map.md`](./docs/module-map.md). Before a folder PR: run domain CI, update verify scripts that hardcode paths, `npx clasp status`.

### PERSONNEL keys (do not regress)

- Monthly schedule row key: **Callsign**; personal fields from `PERSONNEL` by Callsign (fallback **FML**).
- **ID Army+** is optional data, not a required system key.
- **Position** is not a person key.
- **Status** (UA only in sheet): dropdown — `В наявності`, `У відрядженні`, `Вибув`, `Відпустка`, `Лікарняний`, `Тимчасовий`, `Гусачівка`, `БЗВП`, `СЗЧ`.
  Runtime-active: all except `Вибув` and `СЗЧ`; empty = `В наявності`. Legacy
  (`Дієвий`, `Active`, `Відрядження`, EN) mapped on read only.
- Final (logical) headers: `ID | FML | … | Unit | Status`. Physical in reference "Книга Взводу Охорони.xlsx": `Cells`, `ID v/s`, split `Last name` / `First name` / `Patronymic` (FML synthesized), **`Email` in column L**, **`Callsign` in column M**, `Rank`, `OSH 4`, **`Status` in column Q** — see `contracts/reference-workbook-layout.contract.json`. `TEMPLATE` is legacy-only (not in reference file). Code reads by **header names only** (aliases cover variants). See `RUNBOOK.md` §14.
- Missing `Status` header is self-healed at runtime (reference column **Q** when free, otherwise next safe column) before validation/materialize paths proceed.
- After every production deploy or PERSONNEL edits: run **`apiStage7MaterializeComputedData()`** when derived columns may be stale; run **`apiStage7ClearPhoneCache()`** for phone cache invalidation (mandatory after deploy). If month fact/history sheets are used, refresh them separately with **`apiStage7MaterializeMonthJournal()`**.
- See `.cursor/rules/personnel-data-keys.mdc`.

### Daily summaries (do not regress)

- **Short summary** reads the lower **formula block** on month sheets (`01`…`12`);
  do not reintroduce manual PERSONNEL/DICT_SUM counting for short summary.
- Modules: `reports/Report_SummaryData.gs`, `reports/Report_DailySimple.gs`, `reports/Report_DailyDetailed.gs`,
  `reports/Summaries.gs` (legacy `buildDaySummaryForColumn_` only delegates).
- Output order includes **`За штатом`** first; labels in report text must have **no `_`**.
- **UI:** sidebar buttons **Зведення дня** / **Детальне зведення** only; top menu =
  `WASB` → `Відкрити панель` (no `Звіти` menu).
- Design doc: [`docs/daily-summary-architecture.md`](./docs/daily-summary-architecture.md).
- Local contract: `scripts/verify-workbook-contract.mjs`.

### Vacation planner and mini-calendar (do not regress)

- Concurrent load: **max 3** normal; **4** only as short overload ≤3 consecutive days; **5+** always error.
- Rules source: `vacations/VacationPlannerConfig.gs` (`MAX_CONCURRENT`, `OVERLOAD_*`, `MIN_VACATION_DAYS`, `MIN_DAYS_GAP`, `MIN_START_GAP_DAYS`).
- Mini-calendar cells: day number + divider + count only (no names in grid).
- Footer summary: **Проблемних дат** / **Навантажених днів** only (no static rule lines).
- Navigation ◀/▶ must pass explicit `{ year, month }` to `loadMonthCalendar` (see `ui/Js.Vacations.Actions.html`).
- Modules: `vacations/VacationMonthCalendar.gs`, `vacations/Vacation_Suggestions.gs`, `vacations/VacationMonthlySync.gs`, `ui/Js.Vacations.*.html` partials, `ui/Js.VacationSync.html`.
- Design doc: [`docs/vacation-planner.md`](./docs/vacation-planner.md).
- Local contract: `scripts/verify-vacation-planner.mjs`, `scripts/verify-vacation-monthly-sync.mjs` (`npm run ci:vacations`).

### Inventory reconciliation (do not regress)

- Sheets: `INVENTORY_RECONCILIATION` (visible), `INVENTORY_RECONCILIATION_FILES` (hidden index).
- Drive folder id: Script Property `WASB_INVENTORY_RECONCILIATION_FOLDER_ID`; OAuth scope `drive.readonly` required.
- Modules: `inventory/InventoryReconciliation.gs`, `ui/Js.InventoryReconciliation.html`, `ui/Styles_35_InventoryReconciliation.html`.
- Design doc: [`docs/inventory-reconciliation.md`](./docs/inventory-reconciliation.md).

### User-facing copy (do not regress)

- Sidebar, menus, dialogs, health UI: **Ukrainian only**, no technical sheet keys (`SEND_PANEL`, `PERSONNEL`, …) in strings users see.
- Physical tab names in `CONFIG` / `SheetSchemas_` may stay technical until a dedicated sheet-rename migration.
- Policy: [`docs/user-facing-copy.md`](./docs/user-facing-copy.md). CI: `verify-no-russian-text.mjs`, `verify-user-facing-copy.mjs` (`npm run ci:language`, `npm run ci:copy`).

### Key gotchas

- The `&&` chain in `npm run ci` may fail under restricted `cmd.exe` on Windows; use individual `node scripts/...` commands as fallback.
- `npx clasp push` / `npm run gas push` requires prior `clasp login` and a `.clasp.json` (not committed to the repo for security). Prefer `npx clasp` over a global `clasp` so the version matches `package-lock.json` (`@google/clasp@3.3.0`).
- **Do not run** `npm audit fix --force` — it toggles `@google/clasp` between 2.x and 3.x without fixing transitive `uuid` advisories and can introduce a **high** clasp CVE on older versions.
- Script properties (`WASB_SPREADSHEET_ID`, `WASB_OWNER_EMAIL`) must be set in GAS Project Settings for headless/trigger execution.

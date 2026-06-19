# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

WASB is a Google Apps Script (GAS) bundle bound to a Google Spreadsheet. There is no standalone backend or frontend server — the entire runtime lives inside the Google Apps Script environment. Local development is limited to static analysis, linting, and deployment via `clasp`.

### Running lint/CI checks

```bash
npm run ci
```

This runs all static analysis scripts (GAS sanity, clasp patterns, language/copy guards, workbook and domain contracts, function graph audit, client verification, XSS audit, envelope compat, usecase facade, snapshot governance, bridge flags, access API governance, OAuth scopes, jsconfig verification). All checks are Node.js-based and do not require any Google credentials or network access.

Individual subscripts: `npm run ci:gas`, `npm run ci:client`, `npm run ci:copy`, `npm run ci:language`, `npm run audit:functions`.

### Node.js version

CI requires **Node.js 24** (matching `.github/workflows/ci.yml` and `.nvmrc`). `npm run ci` runs `npm run precheck` first (`scripts/verify-node-version.mjs`).

```bash
nvm use    # reads .nvmrc (24)
npm run ci
```

The `/exec-daemon/node` binary (Node 22) takes precedence in PATH by default. If running commands manually, ensure `$NVM_DIR/versions/node/v24.16.0/bin` is first in PATH, or source nvm and run `nvm use 24`.

### No local application runtime

This project cannot be "run" locally in the traditional sense. There is no dev server, no build step, and no Docker setup. The application runs exclusively inside Google's Apps Script + Sheets environment. Deployment is done via `clasp push` which requires Google OAuth login (`clasp login`).

### Testing

- **Local (automated):** `npm run ci` — **24** verify scripts (+ `precheck`), no Google credentials.
- **Remote smoke (separate non-production project):** `npm run deploy:smoke` — `apiRunSmokeChecks` via `.clasp.smoke.json`.
- **Remote (manual):** `apiRunStage7RegressionTests()` in GAS editor.

Documentation index: [`docs/README.md`](./docs/README.md). Verify release status
from current CI, clasp status, remote smoke, and GAS diagnostics.

### Production runtime smoke

After local CI and deploy:

```bash
fish_add_path $HOME/.local/node-v24.16.0/bin   # if Node 22 is default
npm run ci
npx clasp push
apiStage7ClearPhoneCache() # run in the production GAS editor
```

Or one command: `npm run deploy:prod` (local CI + production push). Run
`npm run deploy:smoke` separately against the non-production smoke project.

**Expectations** (`apiRunSmokeChecks` result):

- `ok === true`
- `checks.migrationFlag !== 'true'` (null/empty is OK)
- `checks.clientSignal` — envelope `success: true`; inner result: `emailSent: false`, `alertLogged: true` (typically at `data.result`)

**If `clasp run` fails with permission/API errors:**

1. Enable **Google Apps Script API** in [Google Cloud Console](https://console.cloud.google.com/) for the clasp OAuth project.
2. Run `clasp login` and confirm `.clasp.json` scriptId matches the target project.
3. Confirm `appsscript.smoke.json` contains `"executionApi": { "access": "ANYONE" }`.
4. Confirm production `appsscript.json` remains `"executionApi": { "access": "MYSELF" }`.
5. Re-run `npm run gas:smoke:push`, then create or refresh an **API executable** deployment in the smoke project if the Apps Script UI prompts for it.

### Structural moves (ADR-002)

Domain folders (`reports/`, `vacations/`, `core/`, `ui/`, …) are mechanical moves only. Working layout: [`docs/adr/003-working-domain-layout.md`](./docs/adr/003-working-domain-layout.md), live table [`docs/module-map.md`](./docs/module-map.md). Before a folder PR: run domain CI, update verify scripts that hardcode paths, `npx clasp status`.

### PERSONNEL keys (do not regress)

- Monthly schedule row key: **Callsign**; personal fields from `PERSONNEL` by Callsign (fallback **FML**).
- **ID** (Армія+) is optional data, not a required system key.
- **Position** is not a person key.
- **Status** (UA only in sheet): dropdown — `В наявності`, `У відрядженні`,
  `Вибув`, `Відпустка`, `Лікарняний`, `Тимчасовий`, `Гусачівка`, `БЗВП`, `СЗЧ`.
  Runtime-active: all except `Вибув` and `СЗЧ`; empty = `В наявності`. Legacy
  (`Дієвий`, `Active`, `Відрядження`, EN) mapped on read only.
- Final (logical) headers: `ID | FML | … | Unit | Status`. Physical in reference "Книга Взводу Охорони.xlsx": split `Last name` / `First name` / `Patronymic` (FML synthesized), `TEMPLATE` as callsign value, `OSH 4`, `Rank`. Code reads by **header names only** (aliases cover variants). See `RUNBOOK.md` §14.
- After every production deploy or PERSONNEL edits: run **`apiStage7ClearPhoneCache()`** in GAS (mandatory).
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
- Navigation ◀/▶ must pass explicit `{ year, month }` to `loadMonthCalendar` (see `ui/Js.Vacations.html`).
- Modules: `vacations/VacationMonthCalendar.gs`, `vacations/Vacation_Suggestions.gs`, `ui/Js.Vacations.html`.
- Design doc: [`docs/vacation-planner.md`](./docs/vacation-planner.md).
- Local contract: `scripts/verify-vacation-planner.mjs` (`npm run ci:vacations`).

### User-facing copy (do not regress)

- Sidebar, menus, dialogs, health UI: **Ukrainian only**, no technical sheet keys (`SEND_PANEL`, `PERSONNEL`, …) in strings users see.
- Physical tab names in `CONFIG` / `SheetSchemas_` may stay technical until a dedicated sheet-rename migration.
- Policy: [`docs/user-facing-copy.md`](./docs/user-facing-copy.md). CI: `verify-no-russian-text.mjs`, `verify-user-facing-copy.mjs` (`npm run ci:language`, `npm run ci:copy`).

### Key gotchas

- The `&&` chain in `npm run ci` may fail under restricted `cmd.exe` on Windows; use individual `node scripts/...` commands as fallback.
- `npx clasp push` / `npm run gas push` requires prior `clasp login` and a `.clasp.json` (not committed to the repo for security). Prefer `npx clasp` over a global `clasp` so the version matches `package-lock.json` (`@google/clasp@3.3.0`).
- **Do not run** `npm audit fix --force` — it toggles `@google/clasp` between 2.x and 3.x without fixing transitive `uuid` advisories and can introduce a **high** clasp CVE on older versions.
- Script properties (`WASB_SPREADSHEET_ID`, `WASB_OWNER_EMAIL`) must be set in GAS Project Settings for headless/trigger execution.

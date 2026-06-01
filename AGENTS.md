# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

WASB is a Google Apps Script (GAS) bundle bound to a Google Spreadsheet. There is no standalone backend or frontend server — the entire runtime lives inside the Google Apps Script environment. Local development is limited to static analysis, linting, and deployment via `clasp`.

### Running lint/CI checks

```bash
npm run ci
```

This runs all static analysis scripts (GAS sanity, function graph audit, client verification, XSS audit, envelope compat, usecase facade, snapshot governance, bridge flags, access API governance, OAuth scopes, jsconfig verification). All checks are Node.js-based and do not require any Google credentials or network access.

Individual subscripts: `npm run ci:gas`, `npm run ci:client`, `npm run audit:functions`.

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

- **Local (automated):** `npm run ci` — all static checks pass without credentials.
- **Remote (automated after push):** `npm run gas:smoke` — runs `apiRunProductionSmokeChecks` in Google Apps Script via `clasp run` (requires Apps Script API, `clasp login`, and `executionApi.access: ANYONE` in `appsscript.json`).
- **Remote (manual):** Apps Script editor entrypoints such as `apiRunStage7RegressionTests()` when deeper regression is needed.

### Production runtime smoke

After local CI and deploy:

```bash
fish_add_path $HOME/.local/node-v24.16.0/bin   # if Node 22 is default
npm run ci
clasp push
npm run gas:smoke
```

Or one command: `npm run deploy:prod`

**Expectations** (`apiRunProductionSmokeChecks` result):

- `ok === true`
- `checks.migrationFlag !== 'true'` (null/empty is OK)
- `checks.clientSignal` — envelope `success: true`; inner result: `emailSent: false`, `alertLogged: true` (typically at `data.result`)

**If `clasp run` fails with permission/API errors:**

1. Enable **Google Apps Script API** in [Google Cloud Console](https://console.cloud.google.com/) for the clasp OAuth project.
2. Run `clasp login` and confirm `.clasp.json` scriptId matches the target project.
3. Confirm `appsscript.json` contains `"executionApi": { "access": "ANYONE" }`.
4. Re-run `clasp push`, then create or refresh an **API executable** deployment if the Apps Script UI prompts for it.

### PERSONNEL keys (do not regress)

- Monthly schedule row key: **Callsign**; personal fields from `PERSONNEL` by Callsign (fallback **FML**).
- **ID** (Армія+) is optional data, not a required system key.
- **Position** is not a person key.
- **Status** column: Active / Transferred / Removed / Temp — runtime uses active rows only; duplicate active Callsign = health FAIL.
- Final headers: `ID | FML | … | Unit | Status` — see `RUNBOOK.md` §15a.
- After deploy or PERSONNEL edits: run **`apiStage7ClearPhoneCache()`** in GAS (mandatory).
- See `.cursor/rules/personnel-data-keys.mdc`.

### Key gotchas

- The `&&` chain in `npm run ci` may fail under restricted `cmd.exe` on Windows; use individual `node scripts/...` commands as fallback.
- `clasp push` requires prior `clasp login` and a `.clasp.json` (not committed to the repo for security).
- Script properties (`WASB_SPREADSHEET_ID`, `WASB_OWNER_EMAIL`) must be set in GAS Project Settings for headless/trigger execution.

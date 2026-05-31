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
- **Remote (manual):** After `clasp push`, run GAS-side entrypoints in the Apps Script editor (e.g. `apiRunStage7RegressionTests()`, `apiStage7QuickHealthCheck()`). These require a configured Google Spreadsheet with the ACCESS sheet populated.

### Key gotchas

- The `&&` chain in `npm run ci` may fail under restricted `cmd.exe` on Windows; use individual `node scripts/...` commands as fallback.
- `clasp push` requires prior `clasp login` and a `.clasp.json` (not committed to the repo for security).
- Script properties (`WASB_SPREADSHEET_ID`, `WASB_OWNER_EMAIL`) must be set in GAS Project Settings for headless/trigger execution.

# Contributing

Thank you for helping improve this project.

This repository contains a Google Apps Script and Google Sheets automation project. Changes should be careful, focused, testable, and easy to review.

## Local workflow (source of truth)

Use Node.js 24 (`.nvmrc`) and the repository-pinned dependencies:

```bash
npm ci
npm run ci
npx clasp status
```

Run individual npm scripts only when diagnosing a specific failed check.

### Commit messages

Use short descriptive messages such as `fix access registration expiry` or
`docs: align operational runbook`. A version-only message such as `7` is not
descriptive enough.

### Apps Script deployment

**Pushing to GitHub does not update Google Apps Script.** Deploy explicitly:

```bash
npx clasp status
npx clasp push
npm run gas:smoke
```

Or run `npm run deploy:prod` for CI + push + remote smoke.

### Script Properties (spreadsheet binding)

For **headless** runs (time-driven triggers, executions without an open spreadsheet UI), set in **Apps Script → Project settings → Script properties**:

- **`WASB_SPREADSHEET_ID`** — the target Google Sheet ID.

If this property is empty, `getWasbSpreadsheet_()` falls back to **`SpreadsheetApp.getActiveSpreadsheet()`** when a container spreadsheet is active. Pure headless execution without property and without context will throw a clear error—set the property for production triggers.

### Optional business sheets (`Дані` / `Проєкти` / `Заявки`)

Sidebar bootstrap can create and seed these sheets (headers + one template row) when they are missing or completely empty. Behaviour, column lists, and caveats are documented in **`RUNBOOK.md` §20**. If you change **`ensure*`** helpers, update that section and **`ARCHITECTURE.md`** (§7) so docs stay accurate.

### PERSONNEL / PHONES / birthday cache

After changing **PERSONNEL**, **PHONES**, phone index logic, or birthday behavior, clear the script cache that backs profiles:

- Run **`apiStage7ClearPhoneCache()`** in the Apps Script editor (maintenance API).

Then in the spreadsheet: close the sidebar → open it again → open a person card and confirm **ДН** and phone fields.

## GitHub Actions CI

The repository runs a lightweight CI workflow on push and pull requests to **`main`** (also **`workflow_dispatch`**).

It runs the complete `npm run ci` contract suite: GAS sanity, workbook and
recipient contracts, function graph, client parsing/layers/XSS, response
envelope, facade/snapshot/bridge governance, access API policy, OAuth scopes,
and jsconfig verification.

The workflow does **not** deploy to Apps Script. Deployment stays local
(`npx clasp push` / `npm run deploy:prod`). No Google secrets.

## Basic workflow (contributors)

1. Use a branch for non-trivial work when possible.
2. Make focused edits.
3. Run **`npm run ci`** before pushing.
4. Commit with an appropriate message (see above).
5. Open a pull request when collaboration is needed.

## Local setup

Install dependencies:

```powershell
npm install
```

Check project state:

```powershell
git status
clasp status
```

## Code guidelines

- Keep changes focused and reviewable.
- Avoid duplicate helper functions.
- Do not introduce global name collisions.
- Prefer small named helpers over large mixed-purpose functions.
- Preserve existing behavior unless the change explicitly requires otherwise.
- Do not remove diagnostics or safety checks without explaining why.
- Keep Google Apps Script V8 compatibility in mind.
- Avoid changing unrelated files.
- Do not rename public functions unless compatibility aliases are added.

## File organization

Use logical separation:

- Access control logic should stay in Access Control files.
- Diagnostics should stay in Diagnostics files.
- UI HTML and JavaScript should stay in the relevant HTML modules.
- Repository and data access logic should stay in repository files.
- Shared helpers should be placed in common utility files instead of being duplicated.
- Compatibility shims should stay small and clearly named.

Before adding a new file, check whether the code belongs in an existing module.

## Security rules

Never commit:

- API keys
- Tokens
- Passwords
- Private `.clasp.json` deployment data
- Personal data
- Private spreadsheet data
- Operational or sensitive information
- Real logs containing private identifiers

If sensitive data is committed accidentally, remove it immediately and rotate the exposed secret.

## Pull request expectations

A pull request should include:

- What changed.
- Why it changed.
- How it was tested.
- Any known risks or limitations.
- Screenshots or logs if the change affects UI or diagnostics.

## Testing notes

Apps Script errors often appear only at runtime in Google’s environment.

After `clasp push`, run smoke or diagnostics from the editor when relevant (see `RUNBOOK.md` — Post-deploy checks).

## Documentation

Update documentation when changing:

- Setup steps
- Deployment steps
- Access control behavior
- Security behavior
- Public functions
- Diagnostics
- Configuration files
- Project workflow
- **`SHEET_HEADERS` / ACCESS schema** — keep **`README.md`**, **`RUNBOOK.md`**, **`ARCHITECTURE.md`** in sync
- **Script properties** — keep **`README.md`**, **`RUNBOOK.md` §14**, **`SECURITY.md`**, **`CONTRIBUTING.md`** aligned with `DataAccess.gs`

## Review principles

Good contributions are:

- Small enough to review.
- Clear about intent.
- Safe for existing behavior.
- Free of secrets and sensitive data.
- Tested or clearly marked as untested.

Large rewrites should be split into smaller steps whenever possible.

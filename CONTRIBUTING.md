# Contributing

Thank you for helping improve this project.

This repository contains a Google Apps Script and Google Sheets automation project. Changes should be careful, focused, testable, and easy to review.

## Local workflow (source of truth)

The maintainers’ machine often uses **PowerShell profile aliases** (`wcheck`, `wpush`, `wstatus`). In environments where those aliases are missing (for example Cursor without your profile), use the **fallback** commands in the next section—the checks are the same; only the wrapper differs.

### Primary workflow (aliases available)

```powershell
Set-Location "C:\Users\User\Desktop\whatsapp-sheets-bot"

wcheck
wpush -Message "7"
```

**`wcheck`** (project-specific alias) should run, in substance:

- `node scripts/ci-gas-sanity.mjs` — scans `.gs` for accidental pasted shell text, validates `appsscript.json` scopes, etc.
- `node scripts/audit-function-graph.mjs` — ensures menu/trigger/client-bound function names exist (`MISSING: none`).

**`wpush -Message "7"`** (project-specific alias) should, in substance:

- `git status`
- the same Node checks as above
- `git add` / `git commit` / `git push origin main`
- `clasp status` and `clasp push` so **GitHub and Apps Script both** get the update.

### Fallback workflow (no `wcheck` / `wpush`)

```powershell
Set-Location "C:\Users\User\Desktop\whatsapp-sheets-bot"

node .\scripts\ci-gas-sanity.mjs
node .\scripts\audit-function-graph.mjs

git status
git add .
git commit -m "7"
git push origin main

clasp status
clasp push
```

Equivalent via **npm** (runs Node directly, no `cmd.exe` required):

```powershell
npm run ci
```

Or stepwise:

```powershell
npm run ci:gas
npm run audit:functions
```

If `npm run ci` fails only because of a disabled **Command Prompt** / broken **npm script shell**, run the two `node ...` lines above manually—they are the canonical checks.

### Commit message policy (release line on `main`)

For the current release line, the commit message for release-style commits should be exactly the version string, for example:

```text
7
```

Do **not** use vague release commits such as `fix`, `update`, `final`, or `test` when cutting a versioned drop to `main`. For **non-release** feature branches, short descriptive messages remain fine.

### Apps Script deployment

**Pushing to GitHub does not update Google Apps Script.** After `git push`:

```powershell
clasp status
clasp push
```

### Script Properties (spreadsheet binding)

For **headless** runs (time-driven triggers, executions without an open spreadsheet UI), set in **Apps Script → Project settings → Script properties**:

- **`WASB_SPREADSHEET_ID`** — the target Google Sheet ID.

If this property is empty, `getWasbSpreadsheet_()` falls back to **`SpreadsheetApp.getActiveSpreadsheet()`** when a container spreadsheet is active. Pure headless execution without property and without context will throw a clear error—set the property for production triggers.

### PHONES sheet / birthday (ДН) cache

After changing the **PHONES** sheet layout, phone index logic, or birthday column behavior, clear the script cache that backs phone profiles:

- Run **`apiStage7ClearPhoneCache()`** in the Apps Script editor (maintenance API).

Then in the spreadsheet: close the sidebar → open it again → open a person card and confirm **ДН** and phone fields.

## Basic workflow (contributors)

1. Use a branch for non-trivial work when possible.
2. Make focused edits.
3. Run **`wcheck`** or **`npm run ci`** (or the two `node` commands) before pushing.
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

## Commit messages (non-release work)

For everyday development (not version cuts to `main`), use short descriptive messages, for example:

```text
fix access self-registration autofill
refactor stage7 diagnostics helpers
```

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

## Review principles

Good contributions are:

- Small enough to review.
- Clear about intent.
- Safe for existing behavior.
- Free of secrets and sensitive data.
- Tested or clearly marked as untested.

Large rewrites should be split into smaller steps whenever possible.

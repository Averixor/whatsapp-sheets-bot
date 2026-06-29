# Contributing

Thank you for helping improve this project.

This repository contains a Google Apps Script and Google Sheets automation project. Changes should be careful, focused, testable, and easy to review.

New maintainers: start with [`docs/developer-guide.md`](./docs/developer-guide.md) (system layers, first-week safe zones). File locations: [`docs/module-map.md`](./docs/module-map.md). Incident routing: [`RUNBOOK.md`](./RUNBOOK.md) §9. Structural changes: [`docs/adr/README.md`](./docs/adr/README.md).

## Local workflow (source of truth)

Use Node.js 24 (`.nvmrc`) and the repository-pinned dependencies:

```bash
npm ci
npm run check    # full CI (alias: npm run ci)
```

Run individual npm scripts only when diagnosing a specific failed check.

### Terminal commands (maintainers)

| Command | What it does |
| -------- | ------------- |
| `npm run check` | Full local CI |
| `npm run c` | Refresh `docs/project-files-complete.txt` + full CI |
| `npm run deploy:prod` | Full CI + production `clasp push` |
| `npm run push:remote` | `git push` + `clasp push` — **no CI**; commit first |
| `npm run gas` | Node version gate + `clasp push` only — **not** full CI |
| `npm run gh -- "msg"` | Commit (if needed) + push to GitHub |
| `npm run ship -- "msg"` | `c` + `gas` + `gh` |
| `npm run release -- "msg"` | CI + commit + git push + clasp + optional smoke |
| `npm run gas:open` | Open GAS editor (`clasp open-script`) |
| `npm run gas:status` | List files tracked for clasp push |

**One production project:** local `.clasp.json` only (from `.clasp.example.json`). Smoke configs are optional for a separate test GAS. `.clasp.smoke.runtime.json` is not used — delete if present.

### Commit messages

Use short descriptive messages such as `fix access registration expiry` or
`docs: align operational runbook`. A version-only message such as `7` is not
descriptive enough.

### Apps Script deployment

**Pushing to GitHub does not update Google Apps Script.** Deploy explicitly:

```bash
npm run gas:status
npm run gas:push
```

Confirm **Tracked files** includes all domain `**/*.gs` and `ui/**/*.html`, and excludes `tests/`, `node_modules/`, `*.md`. See [`docs/module-map.md`](./docs/module-map.md) and [ADR-003](docs/adr/003-working-domain-layout.md).

Or run `npm run deploy:prod` for CI + production push, or `npm run push:remote` after commit for git + clasp without re-running CI. Production keeps `executionApi.access = MYSELF`; it does not run remote smoke.

For remote smoke, configure `.clasp.smoke.json` from
`.clasp.smoke.example.json` with a separate non-production Apps Script project,
then run `npm run deploy:smoke`.

### Script Properties (spreadsheet binding)

For **headless** runs (time-driven triggers, executions without an open spreadsheet UI), set in **Apps Script → Project settings → Script properties**:

- **`WASB_SPREADSHEET_ID`** — the target Google Sheet ID.

If this property is empty, `getWasbSpreadsheet_()` falls back to **`SpreadsheetApp.getActiveSpreadsheet()`** when a container spreadsheet is active. Pure headless execution without property and without context will throw a clear error—set the property for production triggers.

### Optional business sheets (`Дані` / `Проєкти` / `Заявки`)

Sidebar bootstrap can create and seed these sheets (headers + one template row) when they are missing or completely empty. Behaviour, column lists, and caveats are documented in **`RUNBOOK.md` §20**. If you change **`ensure*`** helpers, update that section and **`ARCHITECTURE.md`** (§7) so docs stay accurate.

### PERSONNEL / PHONES / birthday cache

After every production deploy, and after changing **PERSONNEL**, **PHONES**,
phone index logic, or birthday behavior:

- Run **`apiStage7MaterializeComputedData()`** when derived columns (Birthday `DD.MM.YYYY р.н.`, Age, Days until birthday) may be stale.
- Run **`apiStage7ClearPhoneCache()`** in the Apps Script editor (maintenance API).

Then in the spreadsheet: close the sidebar → open it again → open a person card and confirm **ДН** and phone fields.

## GitHub Actions CI

The repository runs a lightweight CI workflow on push and pull requests to **`main`** (also **`workflow_dispatch`**).

It runs the complete `npm run ci` contract suite (**30** verify scripts after `precheck`): GAS sanity, clasp patterns, **Ukrainian/Russian language** and **user-facing copy** guards, reference workbook layout, workbook and monthly callsign contracts, send-panel bounds, materialize / age-birthday countdown, vacation planner,
recipient contracts, personnel-status and format-rules contracts, function graph, client
parsing/layers/XSS, response envelope, facade/snapshot/bridge governance, access
API policy and hotfixes, OAuth scopes, project file map, and jsconfig verification.

Shortcuts: `npm run ci:copy`, `npm run ci:language`, `npm run ci:vacations`, `npm run ci:workbook`, `npm run ci:materialize`.

The workflow does **not** deploy to Apps Script. Deployment stays local
(`npm run push:remote` / `npm run deploy:prod` / `npm run gas:push`). No Google secrets.

### Local secrets (never commit)

| File | In git? | Purpose |
| ------ | -------- | -------- |
| `.clasp.json` | no | Production scriptId |
| `.clasp.smoke.json` | no | Optional smoke project |
| `.clasp.example.json` | yes | Template |
| `.clasp.smoke.example.json` | yes | Smoke template |

`.gitignore` and `.cursorignore` hide local clasp bindings from git and from Cursor AI indexing.

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
npm run gas:status
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
Use [`docs/project-files-complete.txt`](docs/project-files-complete.txt) as the
repository file map (depth-first tree). After creating, deleting, or moving files,
run **`npm run map:project-files`** and commit the updated map in the same change.

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
- **Daily summaries** — keep **`docs/daily-summary-architecture.md`**, **`ARCHITECTURE.md` §7.1**, **`RUNBOOK.md` §22** aligned when changing `reports/Report_*.gs`, `reports/Summaries.gs`, or sidebar summary flow
- **User-facing copy** — keep **`docs/user-facing-copy.md`** aligned when changing sidebar labels, menus, dialogs, health messages, or sheet titles shown to users; run **`npm run ci:copy`** after UI text edits
- **Script properties** — keep **`README.md`**, **`RUNBOOK.md` §15**, **`SECURITY.md`**, **`CONTRIBUTING.md`** aligned with `data/DataAccess.gs`
- **Repository file map** — refresh **`docs/project-files-complete.txt`** with **`npm run map:project-files`** whenever files are added, removed, or moved; CI enforces freshness via **`verify-project-files-map.mjs`**

## Review principles

Good contributions are:

- Small enough to review.
- Clear about intent.
- Safe for existing behavior.
- Free of secrets and sensitive data.
- Tested or clearly marked as untested.

Large rewrites should be split into smaller steps whenever possible.

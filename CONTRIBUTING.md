# Contributing

Thank you for helping improve this project.

This repository contains a Google Apps Script and Google Sheets automation project. Changes should be careful, focused, testable, and easy to review.

## Basic Workflow

1. Create a separate branch for your change.
2. Make focused edits.
3. Run formatting and checks where available.
4. Commit with a clear message.
5. Open a pull request.

## Local Setup

Install dependencies:

```powershell
npm install
```

Check project status:

```powershell
git status
clasp status
```

## Recommended Checks

Before submitting changes, run the available checks:

```powershell
npm run format:check
npm run lint
```

If a command is not available in your local setup, explain that in the pull request.

## Apps Script / clasp Workflow

When working with Google Apps Script files, check both Git and Apps Script state before pushing:

```powershell
git status
clasp status
```

Normal release flow:

```powershell
git add .
git commit -m "<version>"
git push origin main
clasp push
```

For this project, the commit message should match the current project version when following the release workflow.

Example:

```powershell
git commit -m "7.1.2"
```

## Code Guidelines

- Keep changes focused and reviewable.
- Avoid duplicate helper functions.
- Do not introduce global name collisions.
- Prefer small named helpers over large mixed-purpose functions.
- Preserve existing behavior unless the change explicitly requires otherwise.
- Do not remove diagnostics or safety checks without explaining why.
- Keep Google Apps Script V8 compatibility in mind.
- Avoid changing unrelated files.
- Do not rename public functions unless compatibility aliases are added.

## File Organization

Use logical separation:

- Access control logic should stay in Access Control files.
- Diagnostics should stay in Diagnostics files.
- UI HTML and JavaScript should stay in the relevant HTML modules.
- Repository and data access logic should stay in repository files.
- Shared helpers should be placed in common utility files instead of being duplicated.
- Compatibility shims should stay small and clearly named.

Before adding a new file, check whether the code belongs in an existing module.

## Security Rules

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

## Pull Request Expectations

A pull request should include:

- What changed.
- Why it changed.
- How it was tested.
- Any known risks or limitations.
- Screenshots or logs if the change affects UI or diagnostics.

## Commit Messages

Use clear commit messages.

For release workflow commits, use the current version number:

```text
7.1.2
```

For normal development commits, use a short descriptive message:

```text
fix access self-registration autofill
refactor stage7 diagnostics helpers
update dependabot config
```

## Testing Notes

For Apps Script changes, test carefully because some errors only appear inside the Google Apps Script runtime.

Useful local checks:

```powershell
git status
clasp status
clasp push
```

After pushing to Apps Script, run the relevant smoke tests or manual diagnostics from the Apps Script editor where applicable.

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

## Review Principles

Good contributions are:

- Small enough to review.
- Clear about intent.
- Safe for existing behavior.
- Free of secrets and sensitive data.
- Tested or clearly marked as untested.

Large rewrites should be split into smaller steps whenever possible.

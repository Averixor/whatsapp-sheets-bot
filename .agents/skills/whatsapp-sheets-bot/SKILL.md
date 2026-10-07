---
name: whatsapp-sheets-bot-conventions
description: Development conventions and patterns for whatsapp-sheets-bot (GAS V8 + Sheets, Node CI/tooling). Prefer AGENTS.md and .cursor/rules over generic framework habits.
---

# Whatsapp Sheets Bot Conventions

## Overview

WASB is a Google Apps Script V8 project bound to Google Sheets.

The repository combines:

- Google Apps Script runtime code in `.gs`
- HtmlService client code in `.html`
- Node.js tooling and CI in `.mjs`
- JSON contracts in `contracts/`
- runtime tests in `tests/` and `smoke/`
- repository rules and operational documentation

Do not treat WASB as a TypeScript, npm application, or conventional bundled frontend project.

When generated guidance conflicts with `AGENTS.md`, `.cursor/rules/*`, `contracts/*`, `docs/module-map.md`, current code, or CI — curated repository rules and contracts take precedence.

## Tech Stack

- **Runtime**: Google Apps Script V8
- **Primary runtime files**: `.gs`
- **Client**: HtmlService HTML / JavaScript
- **Local tooling**: Node.js 24+ / `.mjs`
- **Deployment**: `clasp`
- **Data store**: Google Sheets
- **Contracts**: JSON files in `contracts/`
- **CI**: Node-based static, contract, regression, and governance checks

## When to Use This Skill

Use this skill when:

- modifying WASB runtime code
- adding or changing CI checks
- creating GAS APIs or use cases
- changing Sheets schemas or materialization
- changing sidebar/client code
- adding tests or smoke checks
- creating commits
- working with `clasp` or repository automation

## Repository Architecture

WASB uses domain-oriented folders rather than a traditional `src/` tree.

Important areas include:

- `core/`
- `api/`
- `access/`
- `personnel/`
- `sheets/`
- `reports/`
- `vacations/`
- `sendpanel/`
- `inventory/`
- `diagnostics/`
- `maintenance/`
- `usecases/`
- `ui/`
- `tests/`
- `smoke/`
- `scripts/`
- `contracts/`

Before introducing a new abstraction, inspect neighboring files and `docs/module-map.md`.

## Google Apps Script Runtime

`.gs` files execute in the shared Google Apps Script global namespace.

Do not introduce ESM `import` / `export` syntax into `.gs` runtime files.

Prefer existing project conventions:

```javascript
function exampleAction_(input) {
  // private/internal helper
}

function apiExampleAction(input) {
  // public API entrypoint
}
```

Private/internal helpers commonly use a trailing underscore.

Public API governance must follow the existing repository contracts and CI checks.

## Node Tooling

Node tooling lives mainly under `scripts/`.

Use ESM for `.mjs`.

Use Node built-in module specifiers:

```javascript
import fs from "node:fs";
import path from "node:path";
```

For repository-owned modules, use relative imports:

```javascript
import { loadContract, repoRoot } from "./lib/load-contract.mjs";
```

Reusable Node helpers should normally use named exports.

Do not apply Node import/export conventions to GAS `.gs` files.

## File Naming

Follow the convention of the subsystem.

### GAS runtime

Usually PascalCase or dotted PascalCase:

- `PersonnelRepository.gs`
- `AccessControl.Core.gs`
- `Diagnostics.Health.gs`
- `UseCases.MonthOps.gs`

### Node tooling

Use kebab-case:

- `verify-monthly-callsign-sync.mjs`
- `verify-user-facing-copy.mjs`
- `ops-gas.mjs`

### Client modules

Follow the existing UI conventions:

- `Js.Security.Exports.html`
- `Js.Vacations.Render.Problems.html`
- `Styles_*.html`

### Contracts

Use established kebab-case contract names:

- `personnel-status.contract.json`
- `reference-workbook-layout.contract.json`

Do not impose one filename convention across the entire repository.

## Testing and Verification

Testing is split by execution environment.

### GAS runtime tests

Use: `tests/*.gs`

### Runtime smoke tests

Use: `smoke/*.gs`

### Local static / contract / regression checks

Use the existing patterns:

- `scripts/verify-*.mjs`
- `scripts/audit-*.mjs`

### Contracts

Expected invariants and schemas belong in: `contracts/*.json`

Do not create `__tests__/` unless the repository architecture is deliberately changed.

After relevant changes, run the focused check first and then:

```bash
npm run ci
```

For changes that affect the project file map:

```bash
npm run c
```

## Commit Conventions

Use Conventional Commit-style subjects.

Common prefixes include:

- `fix:` — behavior or runtime correction
- `chore:` — tooling, CI, configuration, maintenance
- `docs:` — documentation-only change
- `refactor:` — structural change without intended behavior change
- `test:` — test or verification-only change
- `feat:` — new user-visible or runtime capability

Examples:

```text
fix: harden birthday engine
chore: integrate CSpell into CI
docs: clarify personnel data rules
```

Keep one logical task per commit.

Do not force every commit to use `fix:`.

## Git Safety

Follow `.cursor/rules/git-safety.mdc`.

Important principles:

- inspect branch and working tree before mutating Git state
- do not mix unrelated changes in one commit
- do not use mass staging when unrelated changes exist
- isolate overlapping tasks in separate worktrees
- do not automatically rebase published/shared branches
- do not deploy production GAS as an implicit side effect of ordinary Git synchronization
- production deployment requires an explicit action

Repository automation must obey the same rules.

## PERSONNEL Identity

Follow `.cursor/rules/personnel-data-keys.mdc`.

Important invariants:

- Callsign is the practical primary key for monthly schedule lookup
- FML is the fallback person lookup
- ID Армія+ is optional data, not a stable system key
- Position is not a person key
- PERSONNEL is read by headers, not hard-coded physical column letters
- duplicate active Callsign values are a critical data condition

## Monthly Callsign Rule

Follow `.cursor/rules/monthly-callsign-sync.mdc`.

Display callsign resolution is:

**Callsign → Last name → First name**

Do not use TEMPLATE as a display fallback.

Preserve PERSONNEL row position when synchronizing monthly sheets.

Do not collapse empty personnel slots.

Do not use `PASTE_CONDITIONAL_FORMATTING` while expanding monthly personnel rows.

## User-facing Copy

Follow `.cursor/rules/user-facing-copy.mdc` and `docs/user-facing-copy.md`.

User-visible text must be Ukrainian and understandable without internal system knowledge.

Do not expose raw internal names such as:

- `SEND_PANEL`
- `PERSONNEL`
- `DICT_SUM`
- `CONFIG`
- `LOGS`

Technical identifiers remain valid in code, tests, logs, contracts, and developer documentation.

## Deployment

Production GAS uses `clasp`.

Use repository commands rather than ad-hoc `clasp` calls when possible.

Production `.clasp.json` is local and must not be committed.

The repository rejects placeholder production bindings.

Do not assume a successful local CI replaces runtime smoke testing in the live Google Apps Script environment.

## Core Principle

Prefer existing repository contracts, CI gates, domain rules, and neighboring implementation patterns over generic framework conventions.

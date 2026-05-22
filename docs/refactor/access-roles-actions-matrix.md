# Access roles × SidebarApp actions

Matrix for Phase 2 AccessControl migration. Role hierarchy from `AccessControl.Core.gs` (`ROLE_ORDER`).

| Role | generate panel | mark sent | calendar | person card | summaries | maintenance | admin debug |
|------|----------------|-----------|----------|-------------|-----------|-------------|-------------|
| guest | deny | deny | read* | deny | deny | deny | deny |
| viewer | deny | deny | own card* | own* | deny | deny | deny |
| operator | allow* | allow* | allow | allow* | allow* | limited | deny |
| maintainer | allow | allow | allow | allow | allow | extended | limited |
| admin | allow | allow | allow | allow | allow | allow | allow |
| sysadmin | allow | allow | allow | allow | allow | full | allow |
| owner | allow | allow | allow | allow | allow | allow | allow |

\*Subject to date/sheet scope and `AccessEnforcement_` rules.

## Source of truth (code)

- `AccessControl.Core.gs` — `ROLE_VALUES`, `ROLE_ORDER`, `ROLE_METADATA`
- `AccessEnforcement.gs` — server asserts (`assertCanUseSendPanel`, `assertCanOpenPersonCard`, …)
- `Js.Security.html` — `assertActionAccess_`, `applyAccessPolicyUI`
- `scripts/snapshots/access-debug-baseline.json` — schema + canary capture target

## Phase 2 gate

1. Export live `apiStage7DebugAccess()` from canary into `access-debug-baseline.json` → `descriptor`
2. Diff baseline after each AccessControl structural PR
3. See `docs/refactor/accesscontrol-hardening.md`

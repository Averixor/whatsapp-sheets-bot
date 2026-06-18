# Conditional format rules governance

WASB treats every conditional-formatting rule as protected user data unless it
exactly matches a repository-owned WASB rule. Unknown rules are never deleted
automatically.

## Registry

`FORMAT_RULES_REGISTRY` is a system sheet created by
`apiScanManualFormatRules()`, a preserve-safe rebuild, or system-sheet repair.
It stores one row per stable rule fingerprint and keeps the user's decisions
when a later scan refreshes technical fields.

The important decision columns are:

- `Decision`: `Preserve`, `Adopt`, `Temporary`, `Ignore`, or `DeleteAllowed`.
- `Relevance`: lifecycle description; it does not grant deletion permission.
- `MovePolicy`: controls range remapping during a rebuild.
- `AdoptToCode`: marks an approved permanent rule for JSON export.
- `ExpiresAt`: expiry for a temporary rule. Expiry is reported but never causes
  automatic deletion.
- `Comment`: free-form user note preserved by repeat scans.

`DeleteAllowed` is the only decision that allows WASB to remove a rule.
`Ignore` means automation must leave the existing rule alone; it is not
permission to delete it.

Newly discovered rules default to `KeepOriginalRange`. A monthly sheet can
contain rules outside the schedule matrix, so WASB never assumes that a rule
should follow a schedule merely because the sheet is named `01` through `12`.

## Scan And Apply

Run `apiScanManualFormatRules()` as a maintainer before a risky rebuild. It
scans every sheet, registers `MANUAL`, `UNKNOWN`, and `ADOPTED` rules, updates
`LastSeenAt`, and does not duplicate unchanged fingerprints.

Run `apiApplyFormatRulesRegistry()` as a maintainer to restore reconstructable
registry rules and apply approved deletions. Existing rules remain protected
unless their registry row explicitly says `DeleteAllowed`.

Preserve-safe rebuilds take a native snapshot before destructive formatting,
run the rebuild, then restore protected rules above exact WASB-managed rules.
Current protected paths include vacation outputs, `SEND_PANEL`, and the
detailed-summary output sheet (`DAILY_SUMMARIES`, `Report_DailyDetailed.gs`
`createDetailedSheet_`). Monthly-sheet creation copies the source sheet
and does not clear its formatting.

## Move Policies

- `KeepOriginalRange`: restore the original A1 range.
- `RemapWithSheet`: extend range edges that previously touched the sheet edge.
- `RemapWithSchedule`: extend the rule from its original start cell to the
  rebuilt monthly schedule boundary.
- `RemapWithVacationCalendar`: extend the rule from its original start cell to
  the rebuilt `VACATION_SCHEDULE` boundary.
- `DoNotMove`: restore the original A1 range without remapping.

`RemapWithSheet` changes only edges that reached the corresponding old sheet
edge. The schedule-specific policies are explicit permission to follow the full
rebuilt schedule or vacation calendar.

## Adopt A Permanent Rule

1. Scan the workbook.
2. Set `Decision = Adopt`, `Relevance = Permanent`, and `AdoptToCode = TRUE`.
3. Run `apiExportAdoptedFormatRules()` as `sysadmin`.
4. Review the returned JSON and add approved definitions to
   `WASB_ADOPTED_CONDITIONAL_FORMAT_RULES_` in
   `ConditionalFormatAdoptedRules.gs`.
5. Run `npm run ci`.

Apps Script runtime never rewrites its own `.gs` files. A rule is classified as
`WASB_MANAGED` or repository `ADOPTED` only after an exact code-contract match.
Setting `Decision = Adopt` approves export, but the rule remains `MANUAL` until
the reviewed definition is added to `ConditionalFormatAdoptedRules.gs`.

## Before Rebuild

For manual operational rebuilds, scan first, review new `UNKNOWN` rows, set any
required move policies, and then run the rebuild. Even without a prior scan,
preserve-safe rebuilds register and protect unknown rules before clearing
formatting.

Phase 1 protects conditional-formatting rules. Auditing static cell formatting
such as backgrounds, borders, alignment, and number formats remains a separate
phase 2 snapshot feature.

# WASB Security

## Identity
Primary identity is `Session.getTemporaryActiveUserKey()`.

This is not a password. It is a per-user, per-script temporary identifier issued by Google Apps Script and rotated roughly every 30 days.

## Role restrictions
### guest
- safe-only view
- no cards
- no summaries
- no send panel
- no maintenance/system blocks

### viewer
- sees personnel list
- may open only their own card
- cannot open the detailed summary
- cannot send
- cannot access maintenance/system actions

### operator
- cards, summaries, send panel, routine work actions

### maintainer
- operator rights
- diagnostics, operational inspection, pending repairs view

### admin
- maintainer rights
- access management, logs, administrative controls

### sysadmin
- admin rights
- protections, triggers, repair, cache/system maintenance

### owner
- full access

## Access violations
Violations are written to:
- `ALERTS_LOG`
- `AUDIT_LOG`
- `LOG`

Email notifications are sent on a best-effort basis to roles:
- `admin`
- `sysadmin`
- `owner`

## Protected sheets
- `ACCESS`
- `OPS_LOG`
- `ACTIVE_OPERATIONS`
- `CHECKPOINTS`
- `AUDIT_LOG`
- `JOB_RUNTIME_LOG`
- `ALERTS_LOG`

## Direct spreadsheet edits
`onEdit` / `onChange` auditing is best-effort only because GAS does not always provide a reliable edit actor for every event type.

## Rotation policy
The access descriptor exposes:
- current role
- registration state
- current key availability
- strict / migration mode
- current key source
- `last_seen_at`
- `last_rotated_at`

The project auto-rotates from `user_key_prev` to `user_key_current` when it detects a valid rotated key.

## Operational security rule
Do not store business logic in UI visibility alone.
Every dangerous action must be guarded on the server.
This bundle enforces that for:
- person cards
- detailed summary
- send panel / send actions
- maintenance/admin/sysadmin operations

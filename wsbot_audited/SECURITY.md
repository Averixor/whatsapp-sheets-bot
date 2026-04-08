# WASB Security

## 1. Identity model
### Primary identity
WASB uses `Session.getTemporaryActiveUserKey()` as the primary session identity.

Important properties of this identity:
- it is issued by Google Apps Script
- it is temporary and rotates periodically
- it is not a password
- the project stores **hashes** of that value in `ACCESS`

### Why hashes matter here
The access sheet stores:
- `user_key_current_hash`
- `user_key_prev_hash`

The raw key is not the operational database value. Normal operation should work without asking users to manage or paste keys manually.

## 2. Access resolution order
The current access descriptor resolves in this order:
1. current key hash match
2. previous key hash match
3. emergency email bridge, only if explicitly enabled
4. bootstrap-owner mode, only when access has not been configured yet
5. otherwise guest / denied state according to policy

## 3. Login and self-bind flow
Self-bind is a controlled exception for unregistered but legitimate users.

Current flow:
1. user opens the sidebar
2. current key is checked
3. if unregistered and allowed to self-bind, the user enters **email or phone + callsign**
4. server verifies the pair against `ACCESS`
5. server binds the current key hash to the approved record

### Security intent
- sidebar load is **not** treated as a failed login attempt by itself
- pressing **Login** is the real login attempt
- lockouts apply to repeated failed self-bind login attempts
- access resolution and access mutation are separate concerns

## 4. Role model and boundaries
Role order:
`guest < viewer < operator < maintainer < admin < sysadmin < owner`

### guest
- safe-only mode
- no person cards
- no summaries
- no send-panel actions
- no maintenance/system actions

### viewer
- may see the personnel list
- may open only their own card
- may not open the detailed summary
- may not send
- may not access maintenance/system blocks

### operator
- operational work role
- person cards
- summaries
- send-panel routine actions

### maintainer
- operator rights
- diagnostics
- operational inspection
- pending repairs visibility

### admin
- maintainer rights
- access management
- logs and administrative controls

### sysadmin
- admin rights
- protections
- triggers
- repair actions
- cache/system maintenance

### owner
- full access

## 5. Server-side enforcement rule
UI visibility is not a security boundary.
All dangerous actions must be enforced on the server.

This repository applies server-side checks to at least:
- person cards
- detailed summary
- send-panel and send actions
- maintenance/admin/sysadmin operations
- repair and lifecycle-maintenance actions

## 6. Lockouts and failure handling
### ACCESS-level fields
- `failed_attempts`
- `locked_until_ms`

### Self-bind login protection
Repeated failed login attempts by identifier + callsign can trigger a timed login block.

Operationally this means:
- repeated bad identifier/callsign pairs should not be infinite retries
- a temporary block should tell the user how long remains
- support contact information should remain visible

## 7. Rotation policy
The access descriptor exposes:
- current role
- registration state
- key availability
- strict vs migration mode
- key source
- `last_seen_at`
- `last_rotated_at`

### Automatic promotion
If the current session key matches `user_key_prev_hash`, the system may promote it into `user_key_current_hash` and update rotation metadata.

This is what makes Google’s temporary key rotation survivable without re-registering everyone by hand every cycle.

## 8. Emergency migration bridge
Script property:
- `WASB_ACCESS_MIGRATION_EMAIL_BRIDGE = true`

Rules:
- default state: **off**
- use only during a short migration window
- do not leave enabled as the normal identity model
- disable again immediately after key registration is complete

## 9. Alerts, audit, and notifications
Violations and security-relevant events are written on a best-effort basis to:
- `ALERTS_LOG`
- `AUDIT_LOG`
- `LOG`

Notification recipients are normally derived from privileged roles such as:
- `admin`
- `sysadmin`
- `owner`

Email delivery is **best-effort only** and must not be treated as a guaranteed incident-delivery channel.

## 10. Protected sheets
Protected or security-sensitive sheets include:
- `ACCESS`
- `OPS_LOG`
- `ACTIVE_OPERATIONS`
- `CHECKPOINTS`
- `AUDIT_LOG`
- `JOB_RUNTIME_LOG`
- `ALERTS_LOG`

## 11. Direct spreadsheet edits
`onEdit` / `onChange` auditing is best-effort only.
GAS does not always provide a reliable edit actor for every event type.

That means:
- edit auditing is useful
- edit auditing is not a perfect forensic source
- server-side guarded actions remain the primary control layer

## 12. Security operating rules
- do not grant by UI visibility alone
- do not leave the migration bridge on in daily operation
- do not use role guesswork as a recovery method
- do not bypass the server API for dangerous actions
- do not treat historical compatibility wrappers as the security boundary

## 13. Minimum admin checklist
Before calling security “good enough”, confirm:
- access resolves by key for expected users
- viewer cannot open someone else’s card
- viewer cannot open the detailed summary
- privileged routes reject insufficient roles on the server
- service sheets exist and protections are applied
- quick health and diagnostics do not report security drift

# ACCESS: viewer restrictions update (2026-03-29)

New column:
- `person_callsign` — for `viewer` role, set the exact callsign of the person's own card.

Behavior:
- `viewer` can open only the card whose callsign matches `person_callsign`.
- `viewer` cannot open detailed summary.
- `operator`, `admin`, `sysadmin` can open any card and use detailed summary.
- unauthorized attempts are logged to `ALERTS_LOG` and emailed to enabled `admin/sysadmin` emails from `ACCESS`.

Recommended row format:
- `role`: viewer / operator / admin / sysadmin
- `enabled`: TRUE / FALSE
- `person_callsign`: exact callsign for viewer rows
- `user_key_current`: required for user-key access
- `user_key_prev`: optional previous key during rotation

# SCHEMA

## Критичні службові листи
- `LOG`
- `AUDIT_LOG`
- `JOB_RUNTIME_LOG`
- `OPS_LOG`
- `ACTIVE_OPERATIONS`
- `CHECKPOINTS`
- `ALERTS_LOG`
- `ACCESS`
- `SEND_PANEL`

## ACCESS
| column | meaning |
|---|---|
| email | email користувача |
| role | viewer / operator / admin / sysadmin |
| enabled | TRUE/FALSE |
| note | примітка |

## Retention
- `LOG`: 60 днів за замовчуванням
- `AUDIT_LOG`: 180 днів за замовчуванням

# WASB — документація репозиторію (не GAS bundle)

Ці файли **не завантажуються** в Apps Script editor. Вони для maintainers у Git.

## Кореневі operational docs (див. `README.md` → Documentation map)

| Файл | Призначення |
|------|-------------|
| [README.md](../README.md) | Огляд, quick start, map |
| [ARCHITECTURE.md](../ARCHITECTURE.md) | Шари runtime, API, data flow |
| [RUNBOOK.md](../RUNBOOK.md) | Bootstrap, ACCESS, deploy, troubleshooting |
| [SECURITY.md](../SECURITY.md) | Identity, roles, lockout |
| [CHANGELOG.md](../CHANGELOG.md) | Історія релізів |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | CI, commit policy, clasp |
| [AGENTS.md](../AGENTS.md) | Інструкції для Cursor / CI |

## Аудит і release-status (Git only)

| Файл | Призначення |
|------|-------------|
| [WASB_RELEASE_AUDIT.md](../WASB_RELEASE_AUDIT.md) | **Короткий** production status (PASS / BLOCKED / CLOSED) |
| [WASB_FULL_TECH_AUDIT_2026-06-03.md](../WASB_FULL_TECH_AUDIT_2026-06-03.md) | Повний технічний аудит **коду** |
| [WASB_WORKBOOK_AUDIT_2026-06-07.md](../WASB_WORKBOOK_AUDIT_2026-06-07.md) | Аудит **production-книги** «Взводу Охорони» |

Оновлюйте **release audit** після smoke; workbook audit — після змін у структурі книги.

## Governance (`docs/refactor/`)

| Файл | Статус | Призначення |
|------|--------|-------------|
| [operational-stewardship.md](./refactor/operational-stewardship.md) | active | Owner/backup, cadence, emergency E1–E4 |
| [snapshot-governance.md](./refactor/snapshot-governance.md) | active | Contract snapshots, CI |
| [entropy-review-checklist.md](./refactor/entropy-review-checklist.md) | active | Шаблон quarterly review |
| [entropy-review-2026-Q2.md](./refactor/entropy-review-2026-Q2.md) | snapshot | Останній quarterly output |
| [access-roles-actions-matrix.md](./refactor/access-roles-actions-matrix.md) | active | RBAC matrix |
| [accesscontrol-hardening.md](./refactor/accesscontrol-hardening.md) | reference | Phase 2 AccessControl doctrine |
| [usecase-dependency-map.md](./refactor/usecase-dependency-map.md) | reference | UseCase → repo call chains |
| [emergency-log.md](./refactor/emergency-log.md) | template | Post-mortem log (порожній = OK) |

Machine-readable contracts: [`contracts/`](../contracts/).

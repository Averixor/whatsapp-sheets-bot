# SECURITY

## Що додано
- RBAC через `AccessControl.gs` з ролями `viewer`, `operator`, `admin`.
- Тимчасовий `bootstrap-admin` режим для першого запуску, якщо ACCESS ще не налаштовано.
- Маскування телефонів/повідомлень/wa.me лінків у LOG та AUDIT_LOG.
- API для застосування захисту службових листів.
- Retention cleanup для LOG та AUDIT_LOG.
- Alerts/backoff для повторних job failures і quota-like errors.

## ACCESS
1. Виконайте `bootstrapWapbAccessSheet()` один раз, якщо лист `ACCESS` ще не створений.
2. Заповніть лист `ACCESS` колонками: `email`, `role`, `enabled`, `note`.
3. Після заповнення лише `admin` зможе запускати maintenance-операції.

## Службові листи
API `apiStage5ApplyProtections({ dryRun: false })` або кнопка в сайдбарі застосовує protection до:
- LOG
- AUDIT_LOG
- JOB_RUNTIME_LOG
- OPS_LOG
- ACTIVE_OPERATIONS
- CHECKPOINTS
- ALERTS_LOG
- ACCESS
- SEND_PANEL

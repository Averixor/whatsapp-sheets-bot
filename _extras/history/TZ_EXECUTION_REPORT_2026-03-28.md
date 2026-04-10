# Виконання ТЗ від 2026-03-28

## Реалізовано
- P-01: RBAC для maintenance/admin дій.
- P-02: Redaction логів та audit trail.
- P-03: Spreadsheet protection для службових листів.
- P-06/P-07: Alerts + backoff для repeated job failures / quota-like errors.
- P-11/P-14: додано `SECURITY.md`, `SCHEMA.md`, оновлено metadata release.
- P-15: lifecycle retention cleanup тепер включає LOG та AUDIT_LOG.

## Свідомо не мінялося
- Основна бізнес-логіка SEND_PANEL, summaries, cards, vacations.
- Поведінка одноразового/іменованого WhatsApp sender tab не переведена на `_blank`, щоб не ламати поточний UX та user flow.

## Нові API
- `apiStage5GetAccessDescriptor()`
- `apiStage5ApplyProtections(options)`
- `apiStage5BootstrapAccessSheet()`

## Перший запуск
1. Відкрити сайдбар.
2. За потреби виконати `bootstrapWasbAccessSheet()`.
3. Заповнити `ACCESS`.
4. Натиснути `🛡 Захистити службові листи`.

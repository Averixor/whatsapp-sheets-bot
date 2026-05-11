# WASB RaportsModule — ideal merge

Ця збірка обʼєднує два варіанти інтеграції RAPORTS APP:

- ядро, seed-дані та окремі листи `RAPORTS_*` взято з `raports_integrated_v1`;
- кнопку `Рапорти` у сайдбарі, HTML-форму та API-адаптер додано з UI-варіанта;
- `appsscript.json` містить scopes для `DocumentApp`/`DriveApp`;
- `onOpen()` викликає окреме меню `Рапорти`.

## Перший запуск

1. `clasp push`
2. Оновити Google Sheet.
3. Меню `Рапорти` → `Створити/оновити листи Raports`.
4. Меню `Рапорти` → `Створити базовий Google Docs шаблон`.
5. Відкрити сайдбар → `Рапорти` → згенерувати тестовий рапорт.

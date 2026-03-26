# Resolver hotfix — 2026-03-26

Исправлен ложный FAIL в Diagnostics.gs / SmokeTests.gs.

Суть проблемы:
- после удаления eval диагностический resolver искал глобальные Stage4/Repository symbols через globalThis;
- в Google Apps Script такие `const ..._` объекты могут не резолвиться через globalThis;
- из-за этого существующие модули (`DataAccess_`, `Stage4UseCases_`, `WorkflowOrchestrator_` и др.) ошибочно помечались как отсутствующие.

Что изменено:
- добавлен явный resolver известных Stage4 / repository symbols;
- добавлено корректное разрешение вложенных путей вида `Stage4UseCases_.listMonths`;
- smoke-тесты переведены на тот же принцип без возврата к eval.

Бизнес-логика не менялась.

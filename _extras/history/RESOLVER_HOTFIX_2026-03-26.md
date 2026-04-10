# Resolver hotfix — 2026-03-26

Исправлен ложный FAIL в Diagnostics.gs / SmokeTests.gs.

Суть проблемы:
- после удаления eval диагностический resolver искал глобальные Stage7/Repository symbols через globalThis;
- в Google Apps Script такие `const ..._` объекты могут не резолвиться через globalThis;
- из-за этого существующие модули (`DataAccess_`, `Stage7UseCases_`, `WorkflowOrchestrator_` и др.) ошибочно помечались как отсутствующие.

Что изменено:
- добавлен явный resolver известных Stage7 / repository symbols;
- добавлено корректное разрешение вложенных путей вида `Stage7UseCases_.listMonths`;
- smoke-тесты переведены на тот же принцип без возврата к eval.

Бизнес-логика не менялась.

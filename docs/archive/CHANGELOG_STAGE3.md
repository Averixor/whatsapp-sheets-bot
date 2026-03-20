# CHANGELOG_STAGE3.md

## Hybrid build

### Взято из базового сильного stage 3 варианта
- `Stage3ServerApi.gs` как canonical public API
- `ServerResponse.gs` с нормализацией контрактов
- `DataAccess.gs` как явный DAL
- repository-слой (`PersonsRepository_`, `SendPanelRepository_`, и т.д.)
- client-side service layer в `JavaScript.html`
- `DeprecatedRegistry.gs`

### Усилено идеями из второго архива
- richer schema metadata в `SheetSchemas.gs`
- helper getters для schema/header access
- header integrity validation
- отдельный `PUBLIC_API_STAGE3.md`
- расширенный smoke/scenario test pack

### Что сознательно НЕ переносилось как canonical
- возврат к старым public фасадам вместо `api*` слоя
- урезанный вариант `ServerResponse.gs`
- более слабый `DataAccess.gs` без явного DAL-объекта

### Известные ограничения
- часть legacy-бизнес-логики всё ещё использует прямые обращения к листу;
- старые wrapper-функции сохранены ради совместимости, но не должны становиться базой для новой логики;
- `PersonCalendar.html` и ряд старых экранов не переписаны радикально, чтобы не ломать UX.

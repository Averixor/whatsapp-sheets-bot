# Compatibility aliases / wrappers

- `findPhoneByRole_()` → compatibility wrapper over canonical `findPhone_({ role })` with limited fallback search.
- `buildPayloadForCell_(sheet, row, col, phonesMap, dictMap)` → compatibility adapter over object-contract payload builder.
- `cacheKeyPhones_()/cacheKeyDict_()/cacheKeyDictSum_()/cacheKeyTemplates_()` now delegate to centralized cache-key policy.
- Legacy flat keys remain present in `loadPhonesMap_()` output for compatibility readers, but canonical readers should use nested indices and/or `findPhone_()`.

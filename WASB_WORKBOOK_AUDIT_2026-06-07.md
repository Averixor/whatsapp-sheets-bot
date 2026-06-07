# WASB — аудит проєкту та робочої книги «Книга Взводу Охорони»

**Дата аудиту:** 2026-06-07  
**Еталонна книга:** `/home/averixor/Завантажене/Книга Взводу Охорони.xlsx`  
**Репозиторій:** `whatsapp-sheets-bot` / WASB, гілка `main` @ `5f7eab2`  
**Пов’язані документи:** [WASB_FULL_TECH_AUDIT_2026-06-03.md](./WASB_FULL_TECH_AUDIT_2026-06-03.md), [WASB_RELEASE_AUDIT.md](./WASB_RELEASE_AUDIT.md), [docs/README.md](./docs/README.md)

---

## 1. Резюме

| Область | Оцінка | Висновок |
|---------|--------|----------|
| Відповідність коду книзі (PERSONNEL / 06 / PHONES) | **9/10** | Compact-лист `06` і 29 осіб узгоджені з CI-контрактом |
| Якість даних у книзі | **7.5/10** | Є mixed-case Callsign, legacy-аркуші, дубль BIRTHDAY |
| Архітектура WASB | **8.5/10** | Stage7, RBAC, contracts, domain tests |
| Операційна готовність | **7/10** | Книга жива в prod; smoke через clasp — BLOCKED |
| **Загалом** | **8.0/10** | Код і книга сумісні; реліз формально не CLOSED через smoke |

**Вердикт:** «Книга Взводу Охорони» — **production-книга** взводу охорони 1 батальйону БпАК. WASB уже розгорнутий (ACCESS, SEND_PANEL, JOB_RUNTIME, AUDIT). Активний місячний графік — **compact `06`**, особовий склад — **29 осіб** у PERSONNEL/PHONES/`06` (рядки 2–30). Код репозиторію під цю геометрію **підходить**.

---

## 2. Робоча книга — загальний профіль

| Метрика | Значення |
|---------|----------|
| Аркушів | **28** |
| Активний місяць (send-panel) | **06** (06.06.2026 у SEND_PANEL) |
| Особовий склад (PERSONNEL) | **29** рядків |
| PHONES | **29** рядків (Callsign-first) |
| Місячні аркуші | `02`, `03`, `04`, `05`, `06` |
| Проєкти (sidebar заявки) | **10** активних у `Проєкти` |
| ACCESS (enabled) | **2** користувачі |

### Класифікація аркушів

| Категорія | Аркуші |
|-----------|--------|
| **Операційні (щоденні)** | `06`, `SEND_PANEL`, `PHONES`, `PERSONNEL`, `DICT`, `DICT_SUM` |
| **Місячні / історія** | `02`, `03`, `04`, `05`, `Рафік` |
| **Відпустки / ДН** | `VACATIONS`, `VACATION_SCHEDULE`, `BIRTHDAY` |
| **Заявки / дані** | `Дані`, `Заявки`, `Проєкти` |
| **Службові WASB** | `ACCESS`, `TEMPLATES`, `TEST_RESULTS` |
| **Журнали / ops** | `LOG`, `AUDIT_LOG`, `OPS_LOG`, `CHECKPOINTS`, `ALERTS_LOG`, `JOB_RUNTIME_LOG`, `ACTIVE_OPERATIONS` |
| **Legacy / ручні** | `UNSEMICONSMAN` |

---

## 3. PERSONNEL — ключі та статуси

### Заголовки (факт у книзі)

```text
ID | FML | Birthday | Age | Days until birthday | Phone | Phone 2 | Callsign |
TEMPLATE | Rank | Position | OSH 4 | Unit | Status
```

**Відповідність коду:** `PersonnelRepository.gs` читає **за назвами заголовків**; aliases `Phone 2`, `Rank`, `TEMPLATE`, `OSH 4` підтримуються. **Callsign** — основний ключ для графіка і lookup; **ID** — опційне поле Армія+.

### Розподіл Status (29 осіб)

| Status у книзі | Кількість | Runtime (код) |
|----------------|-----------|---------------|
| В наявності | 16 | active |
| Відкомандерований | 8 | active |
| Гусачівка | 3 | active |
| Відпустка | 2 | active |

**Примітка:** у книзі **немає** класичних `Дієвий` / `Тимчасовий` / `Відрядження` / `Вибув` — використовуються **операційні статуси підрозділу**. Код їх підтримує через `PERSONNEL_ACTIVE_STATUSES_` (`PersonnelRepository.gs`). Порожній Status трактується як `Дієвий`.

### Callsign — якість даних

| Перевірка | Результат |
|-----------|-----------|
| Дублі Callsign серед active | **немає** |
| PERSONNEL ↔ PHONES | **повне покриття** (29/29) |
| Mixed-case Callsign | **8 записів:** `Авдошин`, `Гречко`, `Петренчук`, `Піпа`, `Размахнін`, `Салким`, `Чубейко`, `Шапка` |

**Рекомендація (дані, не код):** уніфікувати регістр Callsign у книзі або свідомо залишити як є — **автонормалізація І/и в коді свідомо не робиться**. Після правок PERSONNEL — `apiStage7ClearPhoneCache()`.

### BIRTHDAY

Окремий лист `BIRTHDAY` (29 рядків) **дублює** поля Birthday/Age з PERSONNEL. Код використовує PERSONNEL як source of truth; BIRTHDAY — legacy/довідковий, не критичний для sidebar.

---

## 4. Місячний аркуш `06` (compact layout)

### Геометрія (факт)

| Елемент | Позиція | Значення |
|---------|---------|----------|
| Заголовок дат | рядок 1, з col C | Excel serial dates (46174…) |
| Позивний | col **B** | «Позивний» у B1 |
| БР / BR days | col **A** | число днів БР |
| Коди розташування | з col **C** | Black, БР, Резерв, Відпус, 1УРБпАК, … |
| Діапазон даних | **рядки 2–30** | **29 позивних** |
| Підсумкові рядки | **34–41** | За_списком=29, В_наявності=16, … |
| Footer-коди | **42–44** | БЗВП, Лікарняний, СЗЧ |

**Останні 3 позивні (рядки 28–30):** СОНЕЧКО, Шапка, Чубейко.

### Відповідність коду

| Контракт / модуль | Очікування | Книга |
|-------------------|------------|-------|
| `detectMonthlyLayoutFromSheet_` | layout `compact` | ✅ B=Callsign, dates з C |
| `verify-workbook-contract.mjs` | `C2:AF30`, personnel=**29** | ✅ 29 рядків B2:B30 |
| `Summaries.gs` / footer | footer не рахується в «Особовий склад» | ✅ summary з рядка 34 |
| Персональні поля | з PERSONNEL по Callsign | ✅ FML/Phone не в compact-колонках |

### Legacy-аркуші `02`–`05`

| Аркуш | Стиль | Коментар |
|-------|-------|----------|
| `02` | змішаний / старий | ID у col A, мало колонок |
| `03`–`04` | standard-like | Position, FML у рядку, телефон не завжди в A |
| `05` | **standard** (повний) | ТЕЛЕФОН, ПОЗИВНИЙ, ПОСАДА, ПІБ, дати з col H |
| `06` | **compact** (активний) | source of truth для бота |

Код підтримує **обидва** layout через `SheetSchemas.gs`; для prod-операцій використовується **`06`**.

### DICT / DICT_SUM

**DICT_SUM** (23 коди): Black, Roland, БР, Евак, 1РБпАК, 2РБпАК, 1УРБпАК, 2УРБпАК, КП, Резерв, … — з полем **Порядок** (Queue).

**DICT** — розширені тексти (Вид служби, Місце, Завдання) для send-panel / summaries.

Коди в `06` (`Black`, `БР`, `Гусачі`, `Відпус`, `1УРБпАК`, `Евак`) **покриваються** словниками.

---

## 5. PHONES, SEND_PANEL, комунікації

### PHONES

```text
Callsign | Phone | Phone 2
```

29 записів; формат `+380…`. Відповідає callsign-first policy у `SheetSchemas` / `Stage7PhoneDictPayloadShims`.

### SEND_PANEL

- **29** рядків повідомлень
- Метадані: «Активний місяць: 06 | Дата панелі: 06.06.2026»
- WhatsApp-посилання генеруються через `buildWhatsAppWebLink_` → `web.whatsapp.com/send`

### Recipient routing (sidebar)

- Bootstrap: `commanderRole`, `commanderRecipients`
- UI: select «Отримувач»
- Commander / birthday / vacation flows — **FIXED** (див. release audit)
- Особисті WA бійцю / імениннику — на телефон особи, не на commander override

---

## 6. ACCESS, безпека, журнали

### ACCESS (enabled)

| role | person_callsign | email (скорочено) |
|------|-----------------|-------------------|
| owner | ШАХТАР | ryabinin.sergei.alekseevich@… |
| operator | ВО | vzvod.ohoroni.sova@… |

Лист ACCESS — повна Stage7-схема (32 колонки): hashes, lockout, registration, temporary password columns.

### Журнали (ознаки активної prod-експлуатації)

| Лист | Записів (approx) | Призначення |
|------|------------------|-------------|
| JOB_RUNTIME_LOG | ~500 | scheduled jobs (stale ops, cache, …) |
| AUDIT_LOG | ~95 | audit trail |
| OPS_LOG / CHECKPOINTS | десятки–сотні | lifecycle / repair |
| ALERTS_LOG | 8 | access violations (guest, protected ACCESS edit) |
| LOG | ~103 | send / operational log |

**ALERTS_LOG** фіксує спроби guest на `checkVacationsAndBirthdays` та редагування захищеного ACCESS — enforcement працює.

---

## 7. Проєкт WASB — стан кодової бази

| Метрика | Значення |
|---------|----------|
| `.gs` файлів | 112 |
| Top-level функцій | 1061 |
| Bound entrypoints | 81 (0 missing) |
| CI скриптів | **15** |
| Client symbols (deps contract) | 226 |
| Domain tests | `DomainTests.gs` (~560 рядків, PR #13–#14) |

### CI (`npm run ci`) — PASS

У т.ч.: workbook contract, **recipient contract**, access API governance 17/17, XSS, envelope, facade, OAuth 6 scopes.

### Архітектура (скорочено)

```text
Sidebar (HtmlService)
  → Stage7ServerApi / Stage7MaintenanceApi
  → UseCases / WorkflowOrchestrator
  → PersonnelRepository, SheetSchemas, SendPanel*, Summaries*
  → Google Sheets (ця книга)
```

### Недавні UI/ops hotfix (закриті)

- Dark theme select/options
- Recipient routing (commander / birthday / vacation)
- Sticky back header (`5cd9181`)
- Access banner: «Режим доступу» (не «Статус» — без колізії з PERSONNEL)

---

## 8. Матриця «книга ↔ код»

| Підсистема | Книга | Код | Статус |
|------------|-------|-----|--------|
| PERSONNEL headers | EN + OSH 4 | header aliases | ✅ |
| PERSONNEL Status values | В наявності, … | PERSONNEL_ACTIVE_STATUSES_ | ✅ |
| Compact month 06 | B=Callsign, C+=dates | SheetSchemas compact | ✅ |
| Personnel count 06 | 29 (rows 2–30) | verify-workbook-contract | ✅ |
| PHONES | Callsign first | SheetSchemas.phones | ✅ |
| DICT_SUM Queue | Порядок | DictionaryRepository | ✅ |
| Projects / Requests | Проєкти, Заявки | ProjectRequests.gs | ✅ |
| ACCESS RBAC | owner + operator | AccessEnforcement | ✅ |
| Send-panel WA links | SEND_PANEL | web.whatsapp.com | ✅ |
| Mixed-case Callsign | 8 rows | exact match lookup | ⚠️ дані |
| Legacy sheets 02–05 | є | detectMonthlyLayout | ⚠️ не active month |
| BIRTHDAY sheet | дубль | PERSONNEL primary | ℹ️ legacy |
| VACATIONS headers | дубль колонок FML | VacationsRepository | ⚠️ перевірити UI |
| Рафік | pivot-style 967 rows | не canonical | ℹ️ archive |
| UNSEMICONSMAN | ручний roster | не WASB core | ℹ️ ignore |

---

## 9. Ризики та рекомендації

### P1 — реліз

1. **`apiRunProductionSmokeChecks()`** — один раз у GAS UI (власник)
2. **`npm run gas:smoke`** — PASS → оновити [WASB_RELEASE_AUDIT.md](./WASB_RELEASE_AUDIT.md) на CLOSED

### P2 — дані в книзі (без змін коду)

3. Уніфікувати **Callsign** (8 mixed-case) — або залишити з операційною дисципліною введення
4. Після змін PERSONNEL — **`apiStage7ClearPhoneCache()`**
5. Перевірити **VACATIONS** — подвоєні заголовки колонок (legacy import)

### P3 — супровід

6. Архівувати / приховати **02–05** як read-only, якщо canonical лише `06`
7. **BIRTHDAY** — поступово вивести з щоденного обігу (PERSONNEL достатньо)
8. Commit messages `"7"` → conventional commits

### Не робити

- Не плутати **Status** (PERSONNEL) і **Режим доступу** (ACCESS role) у UI/docs
- Не вимагати **ID** для sidebar / графіка / телефонів
- Не використовувати **Position** як ключ людини

---

## 10. Перевірки після deploy (checklist)

```text
[ ] Sidebar bootstrap < 20s
[ ] Банер: «Режим доступу: …»
[ ] Лист 06: зведення дня → «Особовий склад — 29»
[ ] «Отримувач» → commander WA link → web.whatsapp.com
[ ] Sticky «← Назад» на довгих result-екранах
[ ] apiStage7QuickHealthCheck() — без критичних FAIL
[ ] apiRunProductionSmokeChecks() — ok: true
```

---

## 11. Фінальний вердикт

```text
Книга «Взводу Охорони» + WASB код — СУМІСНІ (compact 06, 29 осіб)
Operational UI blockers — CLOSED
Production release — HOTFIX DEPLOYED, SMOKE BLOCKED
Final verdict — NOT CLOSED YET (лише Apps Script smoke authorization)
```

**Оцінка пари «проєкт + книга»:** **8.0/10** — готово до щоденної роботи; формальне закриття релізу — після production smoke.

---

*Аудит згенеровано локальним аналізом xlsx + `npm run ci` + вихідного коду репозиторію. Не замінює `apiStage7HealthCheck()` / `apiRunStage7RegressionTests()` у production GAS.*

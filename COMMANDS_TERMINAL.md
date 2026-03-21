# TERMINAL COMMANDS — WAPB

Пошаговая шпаргалка для работы с проектом из терминала VS Code.

Проект:

`C:\Users\User\Desktop\whatsapp-sheets-bot`

---

## Оглавление

1. [Открытие проекта](#1-открытие-проекта)
2. [Самый безопасный старт](#2-самый-безопасный-старт)
3. [Загрузка project shell](#3-загрузка-project-shell)
4. [Проверка, что окружение реально работает](#4-проверка-что-окружение-реально-работает)
5. [Быстрые команды](#5-быстрые-команды)
6. [Команды, которыми работаешь каждый день](#6-команды-которыми-работаешь-каждый-день)
7. [Правильный порядок работы с начала до конца](#7-правильный-порядок-работы-с-начала-до-конца)
8. [Если shell не загрузился](#8-если-shell-не-загрузился)
9. [Если команды не найдены](#9-если-команды-не-найдены)
10. [Если что-то не работает](#10-если-что-то-не-работает)
11. [Работа с Git](#11-работа-с-git)
12. [Работа с GAS](#12-работа-с-gas)
13. [Работа с Node / npm / clasp](#13-работа-с-node--npm--clasp)
14. [Проверка перед закрытием VS Code](#14-проверка-перед-закрытием-vs-code)
15. [Что нельзя делать](#15-что-нельзя-делать)
16. [Короткая шпаргалка](#16-короткая-шпаргалка)

---

## 1. Открытие проекта

После открытия VS Code:

1. Открой папку проекта  
   `C:\Users\User\Desktop\whatsapp-sheets-bot`

2. Открой терминал PowerShell

3. Если терминал открылся не в папке проекта, перейди вручную:

```powershell
cd "C:\Users\User\Desktop\whatsapp-sheets-bot"
```

---

## 2. Самый безопасный старт

Это рекомендуемый старт почти всегда.

```powershell
# === САМЫЙ БЕЗОПАСНЫЙ СТАРТ (рекомендуется всегда) ===
cd "C:\Users\User\Desktop\whatsapp-sheets-bot"
$PSVersionTable.PSVersion
. .\dev-shell.ps1
project-health
clasp whoami
gas-status
git-status-short
```

Что это даёт:

- показывает версию PowerShell
- загружает `dev-shell.ps1`
- проверяет окружение проекта
- проверяет авторизацию clasp
- показывает статус GAS
- показывает короткий статус Git

### Проверка версии PowerShell

Сразу после открытия терминала полезно выполнить:

```powershell
$PSVersionTable.PSVersion
```

Предпочтительно, чтобы `Major` был `7`.

Если видишь `5`, это ещё не приговор, но:
- сначала запусти `project-health`
- если начинаются странности, открой `pwsh` и работай уже там

Пример:

```powershell
pwsh
```

---

## 3. Загрузка project shell

Главная команда после открытия терминала:

```powershell
. .\dev-shell.ps1
```

Важно: это команда **с точкой, пробелом и путём**.  
Она загружает dev-среду в **текущую сессию PowerShell**.

Если всё нормально, должен появиться баннер:

```text
WAPB DEV ENV LOADED
```

---

## 4. Проверка, что окружение реально работает

Сразу после загрузки shell выполни:

```powershell
Get-Command gas-status
Get-Command gas-pull
Get-Command gas-push
Get-Command project-health
```

Потом выполни:

```powershell
project-health
```

И отдельно полезно проверить авторизацию clasp:

```powershell
clasp whoami
```

Если `clasp whoami` падает, попробуй:

```powershell
clasp logout
clasp login
clasp whoami
```

---

## 5. Быстрые команды

| Что нужно | Команда |
|---|---|
| Загрузить shell | `. .\dev-shell.ps1` |
| Проверить всё | `project-health` |
| Проверить auth clasp | `clasp whoami` |
| Подтянуть из GAS | `gas-pull` |
| Отправить в GAS | `gas-push` |
| Отправить только если есть изменения | `gas-push-smart` |
| Короткий статус Git | `git-status-short` |
| Сохранить в Git | `git-save "update"` |
| Сохранить и отправить на GitHub | `git-sync "update"` |
| Полный цикл | `deploy-all "update"` |

---

## 6. Команды, которыми работаешь каждый день

### Проверка состояния

```powershell
project-health
```

### Проверка авторизации clasp

```powershell
clasp whoami
```

### Короткий статус Git

```powershell
git-status-short
```

### Статус GAS

```powershell
gas-status
```

### Подтянуть изменения из GAS

```powershell
gas-pull
```

### Отправить изменения в GAS

```powershell
gas-push
```

### Отправить в GAS только при наличии изменений

```powershell
gas-push-smart
```

### Сохранить изменения в Git

```powershell
git-save "update"
```

### Сохранить и отправить на GitHub

```powershell
git-sync "update"
```

### Полный цикл

```powershell
deploy-all "update"
```

### Быстрый WIP-коммит с датой

```powershell
git-save "WIP $(Get-Date -Format yyyy-MM-dd_HH-mm)"
```

### Быстрый WIP-коммит + push на GitHub

```powershell
git-sync "WIP $(Get-Date -Format yyyy-MM-dd_HH-mm)"
```

### Полный WIP-цикл

```powershell
deploy-all "WIP $(Get-Date -Format yyyy-MM-dd_HH-mm)"
```

---

## 7. Правильный порядок работы с начала до конца

### Сценарий A — обычный старт работы

```powershell
cd "C:\Users\User\Desktop\whatsapp-sheets-bot"
$PSVersionTable.PSVersion
. .\dev-shell.ps1
project-health
clasp whoami
gas-status
git-status-short
```

### Сценарий B — если работаешь после правок в GAS editor

```powershell
gas-pull
git-status-short
```

### Сценарий C — после локальных правок в VS Code

```powershell
gas-push-smart
git-save "update"
project-health
```

### Сценарий D — если нужно сразу отправить и в GitHub, и в GAS

```powershell
git-sync "update"
gas-push-smart
project-health
```

### Сценарий E — закончить рабочую сессию

```powershell
git-status-short
gas-status
project-health
```

Если есть несохранённые изменения:

```powershell
git-save "final update"
gas-push-smart
project-health
```

### Самый короткий рабочий цикл

```powershell
cd "C:\Users\User\Desktop\whatsapp-sheets-bot"
. .\dev-shell.ps1
gas-pull
gas-push-smart
git-save "update"
project-health
```

---

## 8. Если shell не загрузился

Если после открытия терминала команды вроде `gas-status` не работают, выполни вручную:

```powershell
cd "C:\Users\User\Desktop\whatsapp-sheets-bot"
. .\dev-shell.ps1
```

Потом проверь:

```powershell
Get-Command gas-status
Get-Command project-health
```

---

## 9. Если команды не найдены

Если PowerShell пишет:

```text
The term 'gas-status' is not recognized...
```

это значит, что `dev-shell.ps1` **не был загружен в текущую сессию**.

Исправление:

```powershell
. .\dev-shell.ps1
```

Потом:

```powershell
gas-status
project-health
```

---

## 10. Если что-то не работает

### Базовая диагностика

```powershell
$PSVersionTable.PSVersion
Get-Command clasp, node, npmps, git | Select-Object Name, CommandType, Version, Source, Path
project-health
```

Это покажет:

- какая версия PowerShell запущена
- откуда реально берутся `clasp`, `node`, `npmps`, `git`
- полные пути к исполняемым файлам, где это возможно
- нет ли конфликта путей
- живо ли окружение проекта

### Если clasp не видит аккаунт

```powershell
clasp whoami
```

Если ошибка:

```powershell
clasp logout
clasp login
clasp whoami
```

### Если проблема с кодировкой

Проверка:

```powershell
[Console]::OutputEncoding
```

Временно на одну сессию можно поставить UTF-8:

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
```

---

## 11. Работа с Git

### Проверить статус

```powershell
git-status-short
```

или обычной командой:

```powershell
git status --short
```

### Сохранить изменения в локальный Git

```powershell
git-save "message"
```

Пример:

```powershell
git-save "fix sidebar send panel"
```

Что делает:

- `git add .`
- `git commit -m "message"`

### Сохранить и отправить на GitHub

```powershell
git-sync "message"
```

Пример:

```powershell
git-sync "stage 7.1 diagnostics cleanup"
```

Что делает:

- `git add .`
- `git commit -m "message"`
- `git push`

### Полезные обычные команды Git

```powershell
git status
git add .
git commit -m "message"
git push
git pull
git log --oneline -10
```

---

## 12. Работа с GAS

### Проверить статус GAS

```powershell
gas-status
```

или:

```powershell
clasp status
```

### Подтянуть код из GAS

```powershell
gas-pull
```

или:

```powershell
clasp pull
```

Использовать, если:

- код менялся в Google Apps Script editor
- нужно подтянуть актуальное облачное состояние в локальную папку

### Отправить код в GAS

```powershell
gas-push
```

или:

```powershell
clasp push
```

Использовать, если:

- ты изменил `.gs`, `.html`, `appsscript.json` в VS Code
- нужно отправить это в Google Apps Script

### Отправить только если реально есть изменения

```powershell
gas-push-smart
```

### Открыть проект GAS в браузере

```powershell
gas-open
```

### Авто-push watcher

```powershell
gas-watch
```

или напрямую:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\watch-sync-simple.ps1
```

Что делает:

- каждые несколько секунд проверяет изменения
- при изменениях выполняет `clasp push`

Как остановить:

```text
Ctrl + C
```

---

## 13. Работа с Node / npm / clasp

### Проверка версий

```powershell
git --version
node -v
npmps -v
clasp --version
```

### Почему используется `npmps`, а не обычный `npm`

Обычный `npm` в этой системе не используется напрямую, потому что Windows-обёртка `npm.cmd` может упираться в `cmd.exe`.

Используется:

```powershell
npmps
```

Примеры:

```powershell
npmps -v
npmps install
npmps config get script-shell
```

### Почему используется функция `clasp`, а не `clasp.cmd`

Обычный `clasp.cmd` тоже может упираться в `cmd.exe`.

Используется функция:

```powershell
clasp
```

Примеры:

```powershell
clasp --version
clasp status
clasp pull
clasp push
clasp whoami
```

---

## 14. Проверка перед закрытием VS Code

Перед закрытием полезно выполнить:

```powershell
gas-status
git-status-short
project-health
```

Если есть изменения, сохранить их:

```powershell
git-save "final update"
gas-push-smart
project-health
```

Если всё чисто — можно закрывать VS Code.

---

## 15. Что нельзя делать

### Неправильно

Нельзя вставлять в терминал строки вида:

```powershell
PS C:\Users\User\Desktop\whatsapp-sheets-bot> gas-status
```

Нельзя вставлять в терминал текст ошибок:

```text
At line:1 char:1
+ gas-status
...
```

Нельзя вставлять **весь `.md`-файл целиком** в терминал.

Нельзя запускать `clasp push` / `gas-push`, если перед этим не сделал `gas-pull` после правок в Google Apps Script editor.  
Иначе можно тупо перезаписать облачные изменения локальной версией.

Нельзя считать, что `&&` будет вести себя одинаково во всех версиях PowerShell.  
Для этой шпаргалки безопаснее писать команды отдельными строками.

### Правильно

В терминал вставляются только **сами команды**, например:

```powershell
gas-status
```

или:

```powershell
. .\dev-shell.ps1
```

---

## 16. Короткая шпаргалка

```powershell
# === СТАРТ ===
cd "C:\Users\User\Desktop\whatsapp-sheets-bot"
$PSVersionTable.PSVersion
. .\dev-shell.ps1
project-health
clasp whoami

# === РАБОТА ===
gas-pull
gas-push-smart
git-save "update"

# === ФИНИШ ===
git-status-short
gas-status
project-health
```

---

## Финальное правило

Если не уверен, что делать:

```powershell
cd "C:\Users\User\Desktop\whatsapp-sheets-bot"
$PSVersionTable.PSVersion
. .\dev-shell.ps1
project-health
```

После этого уже видно:

- жива ли среда
- виден ли Git
- виден ли Node
- работает ли clasp
- авторизован ли clasp
- чист ли Git-статус
- видит ли проект GAS-файлы
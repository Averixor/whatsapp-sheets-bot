---
name: Push birthday PR
overview: Опублікувати `fix/birthday-countdown-days` (`47d36f9`) на origin і відкрити PR у `main` з перевіркою 5 файлів; worktree не видаляти.
todos:
  - id: push-branch
    content: git push -u origin fix/birthday-countdown-days + status/branch/log checks
    status: completed
  - id: create-pr
    content: gh pr create into main; verify 5 files; return PR URL
    status: completed
isProject: false
---

# Push + PR: birthday countdown days

## Контекст

Worktree: [`/home/serghii/git/worktrees/wasb-birthday-countdown-days`](/home/serghii/git/worktrees/wasb-birthday-countdown-days)  
Гілка: `fix/birthday-countdown-days` @ `47d36f9`  
Base: `origin/main` (не попереду; rebase не потрібен)  
SRC dirty tree (`fix/birthday-year-suffix`) не чіпати.

## Кроки

### 1. Push feature-гілки

```bash
cd /home/serghii/git/worktrees/wasb-birthday-countdown-days
git push -u origin fix/birthday-countdown-days
```

Перевірка:

```bash
git status --short
git branch -vv
git log --oneline --decorate -3
```

Очікування: clean tree; tracking `origin/fix/birthday-countdown-days`; HEAD = `47d36f9`.

### 2. PR у `main`

```bash
gh pr create --base main --head fix/birthday-countdown-days \
  --title "fix: показувати до дня народження загальну кількість днів" \
  --body "$(cat <<'EOF'
## Summary
- Колонка Days until birthday показує повні дні до наступного ДН як \`N дн.\` (або \`Сьогодні\`), замість \`N м.\` / \`N д.\`.
- Оновлено CI-контракт і DomainTests; RUNBOOK / CHANGELOG узгоджені з каноном.

## Test plan
- [ ] \`npm run ci\` (локально вже зелений на worktree)
- [ ] Після merge/deploy: \`apiStage7MaterializeComputedData()\`
- [ ] У PR diff рівно 5 файлів: PersonnelMaterialize, verify-age-birthday-countdown, DomainTests, RUNBOOK, CHANGELOG

EOF
)"
```

Після створення: звірити `gh pr view --json files` / URL — лише ті 5 файлів; дочекатися CI на PR.

### 3. Заборонено на цьому кроці

- Видаляти worktree
- Push/amend у SRC або `fix/birthday-year-suffix`
- Force-push
- Merge PR без вашого окремого OK

## Після підтвердження плану

Виконати §1–2 і повернути URL PR.
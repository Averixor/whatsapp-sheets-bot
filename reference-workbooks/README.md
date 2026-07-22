# Reference workbooks (local)

Optional Excel files used as design references and manual layout checks. They are **not** required for `npm run ci` — header contracts live in `contracts/reference-workbook-layout.contract.json` and related JSON.

Place local copies here when comparing against production sheets:

| File | Purpose |
| ---- | ------- |
| `Книга Взводу Охорони*.xlsx` | Main squad workbook; source for PERSONNEL / month sheet layout (see RUNBOOK §14) |
| `oblik_maina_profesiinyi_dyzain(1).xlsx` | Temporary property register design reference only — live data stays in the bound Google Sheet |

Do not commit production snapshots without an explicit release decision. See [`docs/README.md`](../docs/README.md).

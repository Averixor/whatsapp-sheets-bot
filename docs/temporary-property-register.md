# Temporary property register

## Purpose

The register tracks property issued for temporary use, partial and full returns, outstanding balances, kit completeness, and fuel details. It replaces the former sectioned five-column sheet with a normalized row model that can be filtered and read safely by Apps Script.

## Sheets

### `Property_issued_for_temporary_u`

Working columns:

`Позивний | Пост / об'єкт | Вид майна | Найменування / модель | Видано | Од. обліку | Дата видачі | Повернуто | Дата повернення | Залишок | Статус | Вид палива | Об'єм палива, л | Комплектність / примітка | ID запису | ID комплекту | Батьківський ID | Тип рядка | Код майна | Авто-рядок`

The first fourteen columns are operational. Columns O:T are technical relationship fields and must not be manually rewritten unless a repair is being performed.

### `PROPERTY_CATALOG`

Defines each selectable category/model, unit of account, whether it is a kit, whether fuel fields are required, and display order. The category dropdown is global; the model dropdown is rebuilt for the selected category.

### `PROPERTY_KITS`

Defines components by parent catalog code. For example:

- `Motorola DP4400e` → adapter to spider + spider;
- `Motorola R7aН` → antenna + additional battery;
- universal radio charger → charging cup + power supply;
- `Starlink Gen 2` → cable + router + platform;
- `Буревій РВ М7` → charging cable;
- `Dell Vostro 3501` → charging cable.

The main asset remains the parent row; accessories are generated as linked component rows immediately below it.

## Edit behaviour

`TemporaryPropertyRegister_.handleEdit(e)` is called from the project `onEdit(e)` router.
The handler uses the spreadsheet supplied by the edit event, so dependent dropdowns
continue to work in a simple trigger even when `WASB_SPREADSHEET_ID` is configured.

- Changing a category clears the previous model and applies the category-specific model dropdown.
- Choosing a model fills unit, catalog code, record type, and default quantity.
- Choosing a kit creates or synchronizes component rows.
- Changing issued or returned quantity recalculates balance and status.
- A return date is supplied automatically when a positive returned quantity is entered without a date.
- A fully returned parent with an outstanding component receives `НЕПОВНИЙ КОМПЛЕКТ`.

## Fuel

`Каністра з паливом` is counted in pieces. Fuel type and actual volume are recorded separately. Different fuel types or different per-can volumes should be entered as separate main rows.

## Migration and setup

Run once:

```javascript
apiSetupTemporaryPropertyRegister()
```

For a safe repeat refresh without migration, use the spreadsheet menu
`WASB → Оновити облік майна` or run:

```javascript
apiRefreshTemporaryPropertyRegister()
```

The setup function seeds both reference sheets, verifies the working header, backs up a legacy register, migrates recognized records, creates component rows, applies validation and formatting, and returns a migration report.

## Person cards

`PersonsRepository_` reads outstanding records by callsign and `PersonCards.gs` renders parent property and component balances in the **Тимчасово видане майно** section.

## Verification

Run:

```bash
npm run ci:workbook
```

The verifier checks the header contract, catalog seed, mandatory kit composition, legacy aliases, and status calculations.

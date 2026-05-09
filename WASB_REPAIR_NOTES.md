# WASB repair package

Built from the uploaded current archive with targeted recovery from the uploaded backup archive.

Main changes:
- Restored bound project metadata in `.clasp.json` with `parentId` for the spreadsheet.
- Added stable spreadsheet resolver `getWasbSpreadsheet_()` using spreadsheet ID `1v8ixM67nG_Bfy5NzcDZbmSjwVOYbkN02ibfP6YqI384` with active-spreadsheet fallback.
- Switched core data access and ACCESS repository to the stable spreadsheet resolver.
- Converted ACCESS header display to English canonical headers.
- Kept Ukrainian/Russian header aliases for backward compatibility while writing English headers.
- Applied ACCESS data validations to full data columns for `role`, `enabled`, `self_bind_allowed`, and `registration_status`.
- Increased ACCESS validation span from 30 rows to 1000 rows.
- Converted system sheet repair registry headers to English.
- Converted SheetSchemas labels to English.
- Reworked `smokeTestAccessControl_()` into safe step-by-step smoke diagnostics; skips schema bootstrap when ACCESS schema already exists and required headers are present.

Then run:
- `refreshAccessSheetUi`
- `smokeTestAccessControl_`
- full package tests

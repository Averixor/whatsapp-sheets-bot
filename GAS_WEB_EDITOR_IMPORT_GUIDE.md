# GAS WEB EDITOR IMPORT GUIDE

This package is prepared for work **without VS Code**.

## What you need
- Your Google Spreadsheet
- Access to **Extensions → Apps Script**
- This archive extracted on your computer

## Recommended import sequence
1. Open the target Google Spreadsheet.
2. Open **Extensions → Apps Script**.
3. Create or open the target Apps Script project.
4. In the Apps Script editor, replace the manifest with the contents of `appsscript.json`.
5. Create files in the editor with the **same names** as the `.gs` and `.html` files from this archive.
6. Copy the contents of each local file into the matching Apps Script file.
7. Save the project.
8. Reload the spreadsheet and run the custom menu / sidebar flow.

## Important notes
- This package does **not require VS Code**.
- This package does **not require local Node / npm / clasp** for normal editing in the Apps Script web editor.
- No `.clasp` files are required for the web editor workflow, and none are included in this archive.
- The business logic and file split are preserved from the repaired Stage 7.1 baseline.
- The safest way is to copy files with the exact same names.

## Minimum required source set
Use all `.gs` files, all `.html` files, and `appsscript.json`.

## After import
Run diagnostics from the project menu/sidebar and make sure the sidebar opens correctly before real operational use.

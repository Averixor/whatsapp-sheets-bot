/**
 * ExternalSpreadsheetMigration.gs — idempotent copy of 17 service sheets
 * from the main workbook into dedicated Spreadsheets. Does not delete source tabs.
 */

var EXTERNAL_MIGRATION_PLACEHOLDERS_ = Object.freeze([
  "Аркуш1",
  "Sheet1",
  "Лист1",
  "Sheet 1",
]);

function _extMigTrim_(value) {
  return String(value == null ? "" : value).trim();
}

function _extMigIsPlaceholderName_(name) {
  return EXTERNAL_MIGRATION_PLACEHOLDERS_.indexOf(_extMigTrim_(name)) !== -1;
}

function _extMigMainSpreadsheet_() {
  var id =
    typeof getExternalMigrationSourceSpreadsheetId_ === "function"
      ? getExternalMigrationSourceSpreadsheetId_()
      : typeof WASB_MAIN_WORKBOOK_ID_ !== "undefined"
        ? WASB_MAIN_WORKBOOK_ID_
        : "";
  if (!id) {
    throw new Error("Не задано ID основної книги для міграції");
  }
  return SpreadsheetApp.openById(id);
}

function _extMigUsedBounds_(sheet) {
  if (!sheet) return { rows: 0, cols: 0 };
  var lastRow = Number(sheet.getLastRow()) || 0;
  var lastCol = Number(sheet.getLastColumn()) || 0;
  return { rows: lastRow, cols: lastCol };
}

function _extMigNonEmptyCount_(sheet) {
  var bounds = _extMigUsedBounds_(sheet);
  if (!bounds.rows || !bounds.cols) return 0;
  var values = sheet.getRange(1, 1, bounds.rows, bounds.cols).getValues();
  var count = 0;
  values.forEach(function (row) {
    (row || []).forEach(function (cell) {
      if (cell !== "" && cell !== null && typeof cell !== "undefined") count += 1;
    });
  });
  return count;
}

function _extMigHeaderPreview_(sheet) {
  var bounds = _extMigUsedBounds_(sheet);
  if (!bounds.cols) return [];
  return sheet
    .getRange(1, 1, 1, Math.min(bounds.cols, 24))
    .getDisplayValues()[0]
    .map(function (cell) {
      return _extMigTrim_(cell);
    });
}

function _extMigScanFormulas_(sheet) {
  var bounds = _extMigUsedBounds_(sheet);
  var hits = [];
  if (!bounds.rows || !bounds.cols) return hits;
  var formulas = sheet.getRange(1, 1, bounds.rows, bounds.cols).getFormulas();
  var re = /(=.*(!|IMPORTRANGE|INDIRECT|QUERY|FILTER|VLOOKUP|XLOOKUP))/i;
  formulas.forEach(function (row, r) {
    (row || []).forEach(function (formula, c) {
      var text = String(formula || "");
      if (!text) return;
      if (re.test(text) || text.indexOf("!") !== -1) {
        hits.push({
          a1: sheet.getRange(r + 1, c + 1).getA1Notation(),
          formula: text.slice(0, 240),
        });
      }
    });
  });
  return hits;
}

function _extMigFindSourceSheet_(mainSs, logicalName) {
  return mainSs.getSheetByName(logicalName) || null;
}

function _extMigListArchiveSheets_(mainSs, prefix) {
  return mainSs.getSheets().filter(function (sheet) {
    return new RegExp("^" + prefix + "_\\d{4}_\\d{2}$").test(sheet.getName());
  });
}

function _extMigTargetWorkingSheet_(targetSs, canonicalName) {
  var exact = targetSs.getSheetByName(canonicalName);
  if (exact) return exact;
  var sheets = targetSs.getSheets();
  if (sheets.length === 1 && _extMigIsPlaceholderName_(sheets[0].getName())) {
    return sheets[0];
  }
  return null;
}

function _extMigDestLooksEmpty_(sheet) {
  if (!sheet) return true;
  if (_extMigIsPlaceholderName_(sheet.getName()) && (Number(sheet.getLastRow()) || 0) <= 1) {
    var count = _extMigNonEmptyCount_(sheet);
    return count <= 1;
  }
  return _extMigNonEmptyCount_(sheet) === 0;
}

function _extMigHash_(text) {
  if (typeof _externalStableHash_ === "function") {
    return _externalStableHash_(text);
  }
  return String(text || "");
}

function _extMigSheetFingerprint_(sheet, name) {
  var bounds = _extMigUsedBounds_(sheet);
  var count = _extMigNonEmptyCount_(sheet);
  var headers = _extMigHeaderPreview_(sheet).join("|");
  var raw = [
    name || (sheet && typeof sheet.getName === "function" ? sheet.getName() : ""),
    bounds.rows,
    bounds.cols,
    count,
    headers,
  ].join("\n");
  return {
    name: name || "",
    rows: bounds.rows,
    cols: bounds.cols,
    nonEmpty: count,
    headers: headers,
    fingerprint: _extMigHash_(raw),
  };
}

function _extMigParity_(sourceSheet, destSheet) {
  var sourceBounds = _extMigUsedBounds_(sourceSheet);
  var destBounds = _extMigUsedBounds_(destSheet);
  var sourceCount = _extMigNonEmptyCount_(sourceSheet);
  var destCount = destSheet ? _extMigNonEmptyCount_(destSheet) : 0;
  var sourceHeaders = _extMigHeaderPreview_(sourceSheet).join("|");
  var destHeaders = destSheet ? _extMigHeaderPreview_(destSheet).join("|") : "";
  var equal =
    !!destSheet &&
    sourceBounds.rows === destBounds.rows &&
    sourceBounds.cols === destBounds.cols &&
    sourceCount === destCount &&
    sourceHeaders === destHeaders;
  return {
    sourceRows: sourceBounds.rows,
    sourceCols: sourceBounds.cols,
    targetRows: destBounds.rows,
    targetCols: destBounds.cols,
    sourceNonEmpty: sourceCount,
    targetNonEmpty: destCount,
    headersMatch: sourceHeaders === destHeaders,
    equal: equal,
  };
}

function _extMigCopySheet_(sourceSheet, targetSs, destName) {
  var copied = sourceSheet.copyTo(targetSs);
  var existing = targetSs.getSheetByName(destName);
  if (existing && existing.getSheetId() !== copied.getSheetId()) {
    if (_extMigDestLooksEmpty_(existing) || _extMigIsPlaceholderName_(existing.getName())) {
      targetSs.deleteSheet(existing);
    } else if (existing.getName() === destName) {
      targetSs.deleteSheet(copied);
      throw new Error(
        'Цільовий аркуш "' + destName + '" уже містить дані — копіювання зупинено',
      );
    }
  }
  copied.setName(destName);
  return copied;
}

function _extMigInspectEntry_(mainSs, entry) {
  var logicalName = entry.logicalName;
  var source = _extMigFindSourceSheet_(mainSs, logicalName);
  var report = {
    logicalName: logicalName,
    spreadsheetId: entry.spreadsheetId,
    workingSheet: entry.sheetName,
    sourceFound: !!source,
    targetOpened: false,
    targetSheetName: "",
    targetWasPlaceholder: false,
    formulas: [],
    archives: [],
    parity: null,
    action: "skip",
    conflict: false,
    message: "",
  };
  if (!source) {
    report.action = "missing_source";
    report.message = "Немає вихідного аркуша в основній книзі";
    return report;
  }
  report.formulas = _extMigScanFormulas_(source);
  var targetSs = null;
  try {
    targetSs = SpreadsheetApp.openById(entry.spreadsheetId);
    report.targetOpened = true;
  } catch (error) {
    report.action = "target_inaccessible";
    report.message = error && error.message ? String(error.message) : String(error);
    return report;
  }
  var dest = _extMigTargetWorkingSheet_(targetSs, entry.sheetName);
  report.targetSheetName = dest ? dest.getName() : "";
  report.targetWasPlaceholder = !!(dest && _extMigIsPlaceholderName_(dest.getName()));
  report.parity = _extMigParity_(source, dest);
  if (report.parity.equal) {
    report.action = "already_migrated";
    report.message = "Дані вже збігаються";
  } else if (!dest || _extMigDestLooksEmpty_(dest)) {
    report.action = "copy";
    report.message = "Потрібне копіювання used range / sheet";
  } else {
    report.action = "conflict";
    report.conflict = true;
    report.message =
      "Ціль уже містить дані, які не збігаються з source — без wipe";
  }
  if (logicalName === "OPS_LOG" || logicalName === "CHECKPOINTS") {
    _extMigListArchiveSheets_(mainSs, logicalName).forEach(function (archive) {
      var destArchive = targetSs.getSheetByName(archive.getName());
      var archiveParity = _extMigParity_(archive, destArchive);
      var sourceFp = _extMigSheetFingerprint_(archive, archive.getName());
      var targetFp = _extMigSheetFingerprint_(destArchive, archive.getName());
      report.archives.push({
        name: archive.getName(),
        sourceRows: archiveParity.sourceRows,
        targetRows: archiveParity.targetRows,
        sourceFingerprint: sourceFp.fingerprint,
        targetFingerprint: targetFp.fingerprint,
        action: archiveParity.equal
          ? "already_migrated"
          : destArchive && !_extMigDestLooksEmpty_(destArchive) && !archiveParity.equal
            ? "conflict"
            : "copy",
      });
    });
  }
  return report;
}

function _extMigCollectSheetFingerprints_(mainSs, entries, tables) {
  var sheets = [];
  (entries || []).forEach(function (entry, index) {
    var row = (tables || [])[index] || {};
    var source = _extMigFindSourceSheet_(mainSs, entry.logicalName);
    var targetSs = null;
    try {
      targetSs = SpreadsheetApp.openById(entry.spreadsheetId);
    } catch (_) {}
    var dest = targetSs
      ? _extMigTargetWorkingSheet_(targetSs, entry.sheetName)
      : null;
    var sourceFp = _extMigSheetFingerprint_(source, entry.logicalName);
    var targetFp = _extMigSheetFingerprint_(dest, entry.logicalName);
    sheets.push(sourceFp);
    sheets.push(targetFp);
    (row.archives || []).forEach(function (archive) {
      var archiveSource = mainSs.getSheetByName(archive.name);
      var archiveDest = targetSs ? targetSs.getSheetByName(archive.name) : null;
      sheets.push(_extMigSheetFingerprint_(archiveSource, archive.name));
      sheets.push(_extMigSheetFingerprint_(archiveDest, archive.name));
    });
  });
  return sheets;
}

function _extMigBuildReceipt_(preview, pass) {
  var mainSs = _extMigMainSpreadsheet_();
  var entries =
    typeof listExternalSpreadsheetEntries_ === "function"
      ? listExternalSpreadsheetEntries_()
      : [];
  var sheetRecords = _extMigCollectSheetFingerprints_(
    mainSs,
    entries,
    preview && preview.tables,
  );
  var sourceParts = [];
  var targetParts = [];
  sheetRecords.forEach(function (item, idx) {
    if (idx % 2 === 0) sourceParts.push(item.fingerprint);
    else targetParts.push(item.fingerprint);
  });
  return {
    status: pass ? "PASS" : "FAIL",
    checkedAt: new Date().toISOString(),
    sourceSpreadsheetId:
      typeof getExternalMigrationSourceSpreadsheetId_ === "function"
        ? getExternalMigrationSourceSpreadsheetId_()
        : WASB_MAIN_WORKBOOK_ID_,
    registryHash:
      typeof getExternalRegistryHash_ === "function"
        ? getExternalRegistryHash_()
        : "",
    resources: entries.length,
    sourceFingerprint: _extMigHash_(sourceParts.join("|")),
    targetFingerprint: _extMigHash_(targetParts.join("|")),
    sheets: sheetRecords,
  };
}

function _extMigArchivesOk_(tables) {
  return !(tables || []).some(function (row) {
    return (row.archives || []).some(function (item) {
      return item.action !== "already_migrated";
    });
  });
}

function _extMigWriteParity_(preview) {
  var pass =
    !!preview &&
    preview.ok !== false &&
    Number(preview.conflictCount || 0) === 0 &&
    Number(preview.copyCount || 0) === 0 &&
    Number(preview.alreadyMigrated || 0) === 17 &&
    _extMigArchivesOk_(preview.tables);
  var receipt = _extMigBuildReceipt_(preview, pass);
  if (typeof writeExternalMigrationReceipt_ === "function") {
    writeExternalMigrationReceipt_(receipt);
  }
  preview.parity = pass ? "pass" : "fail";
  preview.receipt = receipt;
  return preview;
}

function previewExternalSpreadsheetMigration_() {
  var modeBefore =
    typeof getExternalStorageMode_ === "function"
      ? getExternalStorageMode_()
      : "legacy";
  var mainSs = _extMigMainSpreadsheet_();
  var entries =
    typeof listExternalSpreadsheetEntries_ === "function"
      ? listExternalSpreadsheetEntries_()
      : [];
  var rows = entries.map(function (entry) {
    return _extMigInspectEntry_(mainSs, entry);
  });
  var conflicts = rows.filter(function (row) {
    return row.conflict || (row.archives || []).some(function (item) {
      return item.action === "conflict";
    });
  });
  var formulaHits = rows.filter(function (row) {
    return row.formulas && row.formulas.length;
  });
  var preview = {
    ok: conflicts.length === 0,
    dryRun: true,
    mainWorkbookId:
      typeof getExternalMigrationSourceSpreadsheetId_ === "function"
        ? getExternalMigrationSourceSpreadsheetId_()
        : mainSs.getId(),
    storageMode: modeBefore,
    tables: rows,
    conflictCount: conflicts.length,
    formulaSheetCount: formulaHits.length,
    copyCount: rows.filter(function (row) {
      return row.action === "copy";
    }).length,
    alreadyMigrated: rows.filter(function (row) {
      return row.action === "already_migrated";
    }).length,
  };
  _extMigWriteParity_(preview);
  preview.storageModeAfter =
    typeof getExternalStorageMode_ === "function"
      ? getExternalStorageMode_()
      : modeBefore;
  return preview;
}

function applyExternalSpreadsheetMigration_() {
  var modeBefore =
    typeof getExternalStorageMode_ === "function"
      ? getExternalStorageMode_()
      : "legacy";
  var preview = previewExternalSpreadsheetMigration_();
  if (!preview.ok) {
    preview.applied = false;
    preview.message =
      "Копіювання зупинено через розбіжність. Виправте вручну й повторіть перевірку.";
    preview.storageMode = modeBefore;
    preview.storageModeAfter =
      typeof getExternalStorageMode_ === "function"
        ? getExternalStorageMode_()
        : modeBefore;
    return preview;
  }
  var mainSs = _extMigMainSpreadsheet_();
  var applied = [];
  preview.tables.forEach(function (row) {
    if (row.action !== "copy" && row.action !== "already_migrated") {
      applied.push(row);
      return;
    }
    if (row.action === "already_migrated" && !(row.archives || []).some(function (item) {
      return item.action === "copy";
    })) {
      row.appliedAction = "skip";
      applied.push(row);
      return;
    }
    var source = _extMigFindSourceSheet_(mainSs, row.logicalName);
    var targetSs = SpreadsheetApp.openById(row.spreadsheetId);
    if (row.action === "copy") {
      _extMigCopySheet_(source, targetSs, row.workingSheet);
      row.appliedAction = "copied";
    } else {
      row.appliedAction = "skip";
    }
    (row.archives || []).forEach(function (archive) {
      if (archive.action !== "copy") return;
      var archiveSource = mainSs.getSheetByName(archive.name);
      if (!archiveSource) return;
      _extMigCopySheet_(archiveSource, targetSs, archive.name);
      archive.appliedAction = "copied";
    });
    if (row.logicalName === "INVENTORY_RECONCILIATION_FILES") {
      var filesSheet = targetSs.getSheetByName(row.workingSheet);
      if (filesSheet && !filesSheet.isSheetHidden()) filesSheet.hideSheet();
      if (typeof protectInventoryReconciliationIndexSheet_ === "function") {
        protectInventoryReconciliationIndexSheet_(filesSheet);
      }
    }
    applied.push(row);
  });
  preview.dryRun = false;
  preview.applied = true;
  preview.tables = applied;
  var postPreview = previewExternalSpreadsheetMigration_();
  preview.parity = postPreview.parity;
  preview.receipt = postPreview.receipt;
  preview.storageMode = modeBefore;
  preview.storageModeAfter =
    typeof getExternalStorageMode_ === "function"
      ? getExternalStorageMode_()
      : modeBefore;
  if (typeof _auditExternalMigrationEvent_ === "function") {
    _auditExternalMigrationEvent_("external-migration-apply", {
      copyCount: Number(preview.copyCount || 0),
      alreadyMigrated: Number(preview.alreadyMigrated || 0),
    });
  }
  return preview;
}

function _finalizeExternalSpreadsheetMigrationBody_() {
  var mode =
    typeof getExternalStorageMode_ === "function"
      ? getExternalStorageMode_()
      : "legacy";
  if (mode === "external") {
    return {
      ok: true,
      skipped: true,
      reason: "already_external",
      message: "Міграцію вже завершено.",
      storageMode: mode,
      storageModeAfter: mode,
      applied: false,
    };
  }
  if (mode !== "migration") {
    return {
      ok: false,
      skipped: true,
      reason: "mode_not_migration",
      message: "Завершення дозволене лише під час міграції.",
      storageMode: mode,
      storageModeAfter: mode,
      applied: false,
    };
  }
  if (typeof setExternalCutoverInProgress_ === "function") {
    setExternalCutoverInProgress_(true);
  }
  try {
    var applied = applyExternalSpreadsheetMigration_();
    if (!applied || applied.ok === false || applied.applied === false) {
      return {
        ok: false,
        skipped: false,
        reason: "apply_failed",
        message:
          (applied && applied.message) ||
          "Завершення зупинено: копіювання не завершилося",
        storageMode: mode,
        storageModeAfter: getExternalStorageMode_(),
        applied: false,
        tables: applied && applied.tables,
        receipt: applied && applied.receipt,
      };
    }
    var fresh = previewExternalSpreadsheetMigration_();
    var fingerprintsMatch =
      fresh.receipt &&
      fresh.receipt.sourceFingerprint &&
      fresh.receipt.sourceFingerprint === fresh.receipt.targetFingerprint;
    var pass =
      fresh.ok !== false &&
      Number(fresh.conflictCount || 0) === 0 &&
      Number(fresh.copyCount || 0) === 0 &&
      Number(fresh.alreadyMigrated || 0) === 17 &&
      _extMigArchivesOk_(fresh.tables) &&
      fingerprintsMatch;
    if (!pass) {
      if (fresh.receipt) {
        fresh.receipt.status = "FAIL";
        if (typeof writeExternalMigrationReceipt_ === "function") {
          writeExternalMigrationReceipt_(fresh.receipt);
        }
      }
      return {
        ok: false,
        skipped: false,
        reason: "parity_mismatch",
        message: "Перевірка не збіглася — режим лишається міграцією.",
        storageMode: mode,
        storageModeAfter: getExternalStorageMode_(),
        applied: true,
        tables: fresh.tables,
        receipt: fresh.receipt,
        conflictCount: fresh.conflictCount,
        copyCount: fresh.copyCount,
      };
    }
    setExternalStorageMode_("external", { fromFinalizer: true });
    if (typeof _auditExternalMigrationEvent_ === "function") {
      _auditExternalMigrationEvent_("external-migration-finalize", {
        reason: "cutover",
      });
    }
    return {
      ok: true,
      skipped: false,
      reason: "cutover",
      message: "Перехід виконано. Production працює із зовнішніми таблицями.",
      storageMode: mode,
      storageModeAfter: getExternalStorageMode_(),
      applied: true,
      tables: fresh.tables,
      receipt: fresh.receipt,
    };
  } finally {
    if (typeof setExternalCutoverInProgress_ === "function") {
      setExternalCutoverInProgress_(false);
    }
  }
}

function _extMigActionStatus_(action, conflict) {
  if (conflict || action === "conflict") return "CONFLICT";
  if (action === "already_migrated") return "PASS";
  if (action === "copy") return "COPY";
  if (
    action === "missing_source" ||
    action === "target_inaccessible" ||
    action === "skip"
  ) {
    return action === "skip" ? "COPY" : "ERROR";
  }
  return "ERROR";
}

function _extMigTargetState_(row) {
  if (!row) return "unknown";
  if (row.conflict) return "conflict";
  if (!row.targetOpened) return "inaccessible";
  if (row.targetWasPlaceholder) return "placeholder";
  if (row.action === "already_migrated") return "matches";
  if (row.action === "copy") return "empty_or_copy";
  if (!row.sourceFound) return "missing_source";
  return String(row.action || "unknown");
}

function toExternalMigrationPreviewDto_(report) {
  var src = report && typeof report === "object" ? report : {};
  var tables = Array.isArray(src.tables) ? src.tables : [];
  var resources = tables.map(function (row) {
    var parity = row.parity || {};
    var status = _extMigActionStatus_(row.action, row.conflict);
    return {
      name: String(row.logicalName || ""),
      displayName:
        typeof getExternalLogicalDisplayName_ === "function"
          ? getExternalLogicalDisplayName_(row.logicalName)
          : String(row.logicalName || ""),
      status: status,
      action: String(row.action || ""),
      message: String(row.message || ""),
      sourceRows: Number(parity.sourceRows || 0),
      targetRows: Number(parity.targetRows || 0),
      targetState: _extMigTargetState_(row),
    };
  });
  var archives = [];
  tables.forEach(function (row) {
    (row.archives || []).forEach(function (item) {
      var status = _extMigActionStatus_(item.action, item.action === "conflict");
      archives.push({
        owner: String(row.logicalName || ""),
        name: String(item.name || ""),
        displayName:
          typeof getExternalLogicalDisplayName_ === "function"
            ? getExternalLogicalDisplayName_(item.name)
            : String(item.name || ""),
        status: status,
        action: String(item.action || ""),
        message:
          status === "CONFLICT"
            ? "Архів не збігається з джерелом"
            : String(item.action || ""),
        sourceRows: Number(item.sourceRows || 0),
        targetRows: Number(item.targetRows || 0),
      });
    });
  });
  var pass = resources.filter(function (item) {
    return item.status === "PASS";
  }).length;
  var conflicts =
    Number(src.conflictCount || 0) ||
    resources.filter(function (item) {
      return item.status === "CONFLICT";
    }).length +
      archives.filter(function (item) {
        return item.status === "CONFLICT";
      }).length;
  var errors = resources.filter(function (item) {
    return item.status === "ERROR";
  }).length;
  var receipt = src.receipt && typeof src.receipt === "object" ? src.receipt : {};
  var parityStatus =
    receipt.status === "PASS" || src.parity === "pass" ? "PASS" : "FAIL";
  return {
    ok: src.ok !== false && conflicts === 0 && errors === 0,
    mode: String(src.storageModeAfter || src.storageMode || ""),
    parityStatus: parityStatus,
    totals: {
      resources: resources.length,
      pass: pass,
      conflicts: conflicts,
      errors: errors,
      copy: Number(src.copyCount || 0),
      alreadyMigrated: Number(src.alreadyMigrated || 0),
    },
    resources: resources,
    archives: archives,
    message: String(src.message || ""),
    storageMode: String(src.storageMode || ""),
    storageModeAfter: String(src.storageModeAfter || ""),
    applied: src.applied === true,
    skipped: src.skipped === true,
    reason: String(src.reason || ""),
    checkedAt: String(receipt.checkedAt || ""),
  };
}

function finalizeExternalSpreadsheetMigration_() {
  var runner = function () {
    _externalMutationLockDepth_ =
      (typeof _externalMutationLockDepth_ === "number"
        ? _externalMutationLockDepth_
        : 0) + 1;
    try {
      return _finalizeExternalSpreadsheetMigrationBody_();
    } finally {
      _externalMutationLockDepth_ = Math.max(
        0,
        (typeof _externalMutationLockDepth_ === "number"
          ? _externalMutationLockDepth_
          : 1) - 1,
      );
    }
  };
  if (typeof withScriptLock_ === "function") {
    return withScriptLock_(runner, 120000);
  }
  return runner();
}

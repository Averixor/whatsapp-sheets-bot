/**
 * InventoryReconciliation.gs — звірка служб, кольорові статуси та прив'язка файлів Google Drive.
 */

const InventoryReconciliation_ = (function () {
  const DEFAULTS = Object.freeze({
    SHEET_NAME: "INVENTORY_RECONCILIATION",
    INDEX_SHEET_NAME: "INVENTORY_RECONCILIATION_FILES",
    FOLDER_PROPERTY: "WASB_INVENTORY_RECONCILIATION_FOLDER_ID",
    HEADER_ROW: 1,
    FIRST_SERVICE_ROW: 2,
    FIRST_MONTH_COLUMN: 2,
    MONTH_COUNT: 12,
    COMPLETE_COLOR: "#D9EAD3",
    INCOMPLETE_COLOR: "#F4CCCC",
    MAX_SCAN_DEPTH: 5,
    MAX_SCANNED_FILES: 2500,
    AUTO_SYNC_TTL_MS: 15 * 60 * 1000,
  });

  const SCAN_TRUNCATION_REASON = Object.freeze({
    FILES: "files",
    DEPTH: "depth",
  });

  const MONTH_NAMES = Object.freeze([
    "Січень",
    "Лютий",
    "Березень",
    "Квітень",
    "Травень",
    "Червень",
    "Липень",
    "Серпень",
    "Вересень",
    "Жовтень",
    "Листопад",
    "Грудень",
  ]);

  const INDEX_HEADERS = Object.freeze([
    "year",
    "month",
    "service_code",
    "service_name",
    "file_id",
    "file_name",
    "url",
    "mime_type",
    "modified_at",
    "synced_at",
    "duplicate_count",
    "status",
  ]);

  const KNOWN_SERVICE_ALIASES = Object.freeze({
    "СІІЗ": ["СІІЗ", "SIIZ", "SIZ"],
    "ЕТС": ["ЕТС", "ETS"],
    "СВТ": ["СВТ", "SVT"],
    "СЗББР": ["СЗББР", "SZBBR"],
    "СЗУ": ["СЗУ", "SZU"],
    "ВС": ["ВС", "VS"],
    "МС": ["МС", "MS"],
    "ОВТТАМСВ": ["ОВТ ТА МСВ", "ОВТ_МСВ", "ОВТ-МСВ", "OVT MSV", "OVT_MSV", "OVT-MSV"],
    "САППО": ["САППО", "SAPPO"],
  });

  function config_() {
    return {
      sheetName:
        typeof CONFIG === "object" && CONFIG && CONFIG.INVENTORY_RECONCILIATION_SHEET
          ? CONFIG.INVENTORY_RECONCILIATION_SHEET
          : DEFAULTS.SHEET_NAME,
      indexSheetName:
        typeof CONFIG === "object" && CONFIG && CONFIG.INVENTORY_RECONCILIATION_FILES_SHEET
          ? CONFIG.INVENTORY_RECONCILIATION_FILES_SHEET
          : DEFAULTS.INDEX_SHEET_NAME,
      folderProperty:
        typeof CONFIG === "object" && CONFIG && CONFIG.INVENTORY_RECONCILIATION_FOLDER_PROP_KEY
          ? CONFIG.INVENTORY_RECONCILIATION_FOLDER_PROP_KEY
          : DEFAULTS.FOLDER_PROPERTY,
    };
  }

  function spreadsheet_() {
    return getWasbSpreadsheet_();
  }

  function sheet_() {
    const name = config_().sheetName;
    const sheet = spreadsheet_().getSheetByName(name);
    if (!sheet) {
      throw new Error('Аркуш звірки "' + name + '" не знайдено');
    }
    return sheet;
  }

  function normalizeTokens_(value) {
    return String(value || "")
      .toUpperCase()
      .replace(/[’'`]/g, "")
      .replace(/[^A-ZА-ЯІЇЄҐ0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function compactKey_(value) {
    return normalizeTokens_(value).replace(/\s+/g, "");
  }

  function extractServiceCode_(label) {
    const text = String(label || "").trim();
    const match = text.match(/\(([^()]*)\)\s*:?\s*$/);
    return match ? String(match[1] || "").trim() : text;
  }

  function aliasesForService_(service) {
    const code = String(service.code || "").trim();
    const key = compactKey_(code);
    const aliases = [code];
    const known = KNOWN_SERVICE_ALIASES[key] || [];
    known.forEach(function (alias) {
      aliases.push(alias);
    });
    return aliases
      .map(normalizeTokens_)
      .filter(Boolean)
      .filter(function (value, index, all) {
        return all.indexOf(value) === index;
      });
  }

  function containsAlias_(value, alias) {
    const haystack = " " + normalizeTokens_(value) + " ";
    const needle = " " + normalizeTokens_(alias) + " ";
    return needle.trim() && haystack.indexOf(needle) !== -1;
  }

  function parseYear_(title) {
    const match = String(title || "").match(/\b(20\d{2})\b/);
    return match ? Number(match[1]) : Number(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy"));
  }

  function parseMonthFromText_(value) {
    const text = String(value || "");
    const numeric = text.match(/(?:^|\D)(0[1-9]|1[0-2])(?:\D|$)/);
    if (numeric) return Number(numeric[1]);

    const normalized = normalizeTokens_(text);
    for (let i = 0; i < MONTH_NAMES.length; i++) {
      if (normalized.indexOf(normalizeTokens_(MONTH_NAMES[i])) !== -1) return i + 1;
    }
    return 0;
  }

  function parseYearFromText_(value) {
    const match = String(value || "").match(/\b(20\d{2})\b/);
    return match ? Number(match[1]) : 0;
  }

  function getLayout_() {
    const target = sheet_();
    const maxRows = Math.max(target.getLastRow(), DEFAULTS.FIRST_SERVICE_ROW);
    const values = target
      .getRange(DEFAULTS.HEADER_ROW, 1, maxRows, DEFAULTS.FIRST_MONTH_COLUMN + DEFAULTS.MONTH_COUNT - 1)
      .getValues();

    const services = [];
    let blankRow = 0;
    for (let row = DEFAULTS.FIRST_SERVICE_ROW; row <= values.length; row++) {
      const name = String(values[row - 1][0] || "").trim();
      if (!name) {
        if (services.length && !blankRow) blankRow = row;
        continue;
      }
      if (blankRow) {
        throw new Error("На аркуші звірки знайдено порожній рядок між службами");
      }
      const code = extractServiceCode_(name);
      services.push({
        row: row,
        name: name,
        code: code,
        aliases: aliasesForService_({ code: code, name: name }),
      });
    }

    if (!services.length) {
      throw new Error("На аркуші звірки не знайдено служб");
    }

    const year = parseYear_(values[0] && values[0][0]);
    const months = [];
    for (let index = 0; index < DEFAULTS.MONTH_COUNT; index++) {
      const column = DEFAULTS.FIRST_MONTH_COLUMN + index;
      months.push({
        month: index + 1,
        column: column,
        label: String((values[0] && values[0][column - 1]) || MONTH_NAMES[index] || ""),
      });
    }

    return {
      sheet: target,
      year: year,
      firstServiceRow: DEFAULTS.FIRST_SERVICE_ROW,
      lastServiceRow: services[services.length - 1].row,
      services: services,
      months: months,
      values: values,
    };
  }

  function isFutureMonth_(year, month, now) {
    const currentYear = Number(Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy"));
    const currentMonth = Number(Utilities.formatDate(now, Session.getScriptTimeZone(), "MM"));
    return year > currentYear || (year === currentYear && month > currentMonth);
  }

  function isPastMonth_(year, month, now) {
    const currentYear = Number(Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy"));
    const currentMonth = Number(Utilities.formatDate(now, Session.getScriptTimeZone(), "MM"));
    return year < currentYear || (year === currentYear && month < currentMonth);
  }

  function readMonthChecks_(layout, monthInfo) {
    return layout.sheet
      .getRange(layout.firstServiceRow, monthInfo.column, layout.services.length, 1)
      .getValues()
      .map(function (row) {
        return row[0] === true;
      });
  }

  /**
   * Pure month status for formatting and dashboard panel.
   * @param {{future:boolean,past:boolean,checksComplete:boolean,filesComplete:boolean}} opts
   * @return {{status:string,color:string|null,complete:boolean,checksComplete:boolean,filesComplete:boolean}}
   */
  function computeMonthStatus_(opts) {
    const future = !!opts.future;
    const past = !!opts.past;
    const checksComplete = !!opts.checksComplete;
    const filesComplete = !!opts.filesComplete;
    const complete = checksComplete && filesComplete;
    let color = null;
    let status = "current";

    if (past && complete) {
      color = DEFAULTS.COMPLETE_COLOR;
      status = "complete";
    } else if (past && !filesComplete) {
      color = DEFAULTS.INCOMPLETE_COLOR;
      status = "missing_files";
    } else if (past) {
      color = DEFAULTS.INCOMPLETE_COLOR;
      status = "incomplete";
    } else if (future) {
      status = "future";
    }

    return {
      status: status,
      color: color,
      complete: complete,
      checksComplete: checksComplete,
      filesComplete: filesComplete,
    };
  }

  function applyFormatting() {
    const layout = getLayout_();
    const index = indexMap_();
    const now = new Date();
    const result = [];

    layout.months.forEach(function (monthInfo) {
      const checks = readMonthChecks_(layout, monthInfo);
      const checksComplete = checks.length > 0 && checks.every(function (value) { return value; });
      const filesComplete = layout.services.every(function (service) {
        const key = layout.year + "|" + monthInfo.month + "|" + compactKey_(service.code);
        return !!(index[key] && index[key].url);
      });
      const computed = computeMonthStatus_({
        future: isFutureMonth_(layout.year, monthInfo.month, now),
        past: isPastMonth_(layout.year, monthInfo.month, now),
        checksComplete: checksComplete,
        filesComplete: filesComplete,
      });

      layout.sheet
        .getRange(DEFAULTS.HEADER_ROW, monthInfo.column, layout.lastServiceRow, 1)
        .setBackground(computed.color);

      result.push({
        month: monthInfo.month,
        complete: computed.complete,
        checksComplete: computed.checksComplete,
        filesComplete: computed.filesComplete,
        checked: checks.filter(Boolean).length,
        total: checks.length,
        status: computed.status,
      });
    });

    return {
      success: true,
      year: layout.year,
      months: result,
    };
  }

  function handleEdit(e) {
    try {
      if (!e || !e.range) return false;
      const range = e.range;
      const target = range.getSheet();
      if (!target || target.getName() !== config_().sheetName) return false;

      const layout = getLayout_();
      const rowStart = range.getRow();
      const rowEnd = rowStart + range.getNumRows() - 1;
      const colStart = range.getColumn();
      const colEnd = colStart + range.getNumColumns() - 1;
      const intersectsRows = rowEnd >= layout.firstServiceRow && rowStart <= layout.lastServiceRow;
      const intersectsColumns =
        colEnd >= DEFAULTS.FIRST_MONTH_COLUMN &&
        colStart <= DEFAULTS.FIRST_MONTH_COLUMN + DEFAULTS.MONTH_COUNT - 1;
      if (!intersectsRows || !intersectsColumns) return false;

      applyFormatting();
      return true;
    } catch (error) {
      try {
        Logger.log("InventoryReconciliation_.handleEdit: " + (error && error.message ? error.message : error));
      } catch (_) {}
      return false;
    }
  }

  function parseFolderId_(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    const urlMatch = text.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (urlMatch) return urlMatch[1];
    const idMatch = text.match(/^[a-zA-Z0-9_-]{10,}$/);
    return idMatch ? idMatch[0] : "";
  }

  function getFolderId_() {
    return String(
      PropertiesService.getScriptProperties().getProperty(config_().folderProperty) || "",
    ).trim();
  }

  function folderDescriptor_() {
    const folderId = getFolderId_();
    if (!folderId) {
      return { configured: false, id: "", name: "", url: "" };
    }
    try {
      const folder = DriveApp.getFolderById(folderId);
      return {
        configured: true,
        id: folderId,
        name: folder.getName(),
        url: "https://drive.google.com/drive/folders/" + folderId,
      };
    } catch (error) {
      return {
        configured: false,
        id: folderId,
        name: "",
        url: "",
        error: "Немає доступу до налаштованої папки Google Drive",
      };
    }
  }

  function setFolder(value) {
    const folderId = parseFolderId_(value);
    if (!folderId) {
      throw new Error("Вкажіть коректне посилання або ідентифікатор папки Google Drive");
    }
    const folder = DriveApp.getFolderById(folderId);
    const name = folder.getName();
    PropertiesService.getScriptProperties().setProperty(config_().folderProperty, folderId);
    return {
      configured: true,
      id: folderId,
      name: name,
      url: "https://drive.google.com/drive/folders/" + folderId,
    };
  }

  function ensureIndexSheet_() {
    const ss = spreadsheet_();
    const name = config_().indexSheetName;
    let indexSheet = ss.getSheetByName(name);
    if (!indexSheet) indexSheet = ss.insertSheet(name);

    const currentHeaders = indexSheet.getRange(1, 1, 1, INDEX_HEADERS.length).getValues()[0];
    const headerMismatch = INDEX_HEADERS.some(function (header, index) {
      return String(currentHeaders[index] || "") !== header;
    });
    if (headerMismatch) {
      indexSheet.clearContents();
      indexSheet.getRange(1, 1, 1, INDEX_HEADERS.length).setValues([INDEX_HEADERS.slice()]);
      indexSheet.getRange(1, 1, 1, INDEX_HEADERS.length).setFontWeight("bold");
      indexSheet.setFrozenRows(1);
    }
    if (!indexSheet.isSheetHidden()) indexSheet.hideSheet();
    if (typeof protectInventoryReconciliationIndexSheet_ === "function") {
      protectInventoryReconciliationIndexSheet_(indexSheet);
    }
    return indexSheet;
  }

  function markScanTruncated_(scanState, reason) {
    scanState.truncated = true;
    if (reason === SCAN_TRUNCATION_REASON.DEPTH) scanState.truncatedByDepth = true;
    else if (reason === SCAN_TRUNCATION_REASON.FILES) scanState.truncatedByFiles = true;
  }

  function walkFolder_(folder, pathParts, depth, collector, scanState) {
    if (depth > DEFAULTS.MAX_SCAN_DEPTH) {
      markScanTruncated_(scanState, SCAN_TRUNCATION_REASON.DEPTH);
      return;
    }
    if (collector.length >= DEFAULTS.MAX_SCANNED_FILES) {
      markScanTruncated_(scanState, SCAN_TRUNCATION_REASON.FILES);
      return;
    }

    const files = folder.getFiles();
    while (files.hasNext() && collector.length < DEFAULTS.MAX_SCANNED_FILES) {
      const file = files.next();
      collector.push({
        id: file.getId(),
        name: file.getName(),
        url: file.getUrl(),
        mimeType: file.getMimeType(),
        modifiedAt: file.getLastUpdated(),
        path: pathParts.join(" / "),
      });
    }
    if (files.hasNext()) markScanTruncated_(scanState, SCAN_TRUNCATION_REASON.FILES);

    const folders = folder.getFolders();
    while (folders.hasNext() && collector.length < DEFAULTS.MAX_SCANNED_FILES) {
      const child = folders.next();
      walkFolder_(child, pathParts.concat([child.getName()]), depth + 1, collector, scanState);
    }
    if (folders.hasNext()) markScanTruncated_(scanState, SCAN_TRUNCATION_REASON.FILES);
  }

  function scoreCandidate_(file, service, month, year) {
    const fileMonth = parseMonthFromText_(file.name);
    if (fileMonth !== month) return -1;

    const fileYear = parseYearFromText_(file.name + " " + file.path);
    if (fileYear && fileYear !== year) return -1;

    let fileAliasMatch = false;
    let pathAliasMatch = false;
    service.aliases.forEach(function (alias) {
      if (containsAlias_(file.name, alias)) fileAliasMatch = true;
      if (containsAlias_(file.path, alias)) pathAliasMatch = true;
    });
    if (!fileAliasMatch && !pathAliasMatch) return -1;

    let score = 0;
    if (fileAliasMatch) score += 100;
    if (pathAliasMatch) score += 70;
    if (fileYear === year) score += 20;
    if (/pdf/i.test(file.mimeType || "")) score += 3;
    return score;
  }

  function chooseFiles_(files, layout) {
    const selected = {};
    layout.services.forEach(function (service) {
      layout.months.forEach(function (monthInfo) {
        const key = layout.year + "|" + monthInfo.month + "|" + compactKey_(service.code);
        const candidates = files
          .map(function (file) {
            return { file: file, score: scoreCandidate_(file, service, monthInfo.month, layout.year) };
          })
          .filter(function (item) { return item.score >= 0; })
          .sort(function (a, b) {
            if (b.score !== a.score) return b.score - a.score;
            return b.file.modifiedAt.getTime() - a.file.modifiedAt.getTime();
          });
        selected[key] = {
          service: service,
          month: monthInfo.month,
          candidates: candidates,
          file: candidates.length ? candidates[0].file : null,
        };
      });
    });
    return selected;
  }

  function writeIndex_(layout, selected) {
    const indexSheet = ensureIndexSheet_();
    const now = new Date();
    const rows = [];

    layout.services.forEach(function (service) {
      layout.months.forEach(function (monthInfo) {
        const key = layout.year + "|" + monthInfo.month + "|" + compactKey_(service.code);
        const item = selected[key] || { file: null, candidates: [] };
        const file = item.file;
        rows.push([
          layout.year,
          monthInfo.month,
          service.code,
          service.name,
          file ? file.id : "",
          file ? file.name : "",
          file ? file.url : "",
          file ? file.mimeType : "",
          file ? file.modifiedAt : "",
          now,
          Math.max(0, (item.candidates || []).length - 1),
          file ? "linked" : "missing",
        ]);
      });
    });

    indexSheet.clearContents();
    indexSheet.getRange(1, 1, 1, INDEX_HEADERS.length).setValues([INDEX_HEADERS.slice()]);
    indexSheet.getRange(1, 1, 1, INDEX_HEADERS.length).setFontWeight("bold");
    if (rows.length) {
      indexSheet.getRange(2, 1, rows.length, INDEX_HEADERS.length).setValues(rows);
      indexSheet.getRange(2, 9, rows.length, 2).setNumberFormat("yyyy-mm-dd hh:mm:ss");
    }
    indexSheet.setFrozenRows(1);
    if (!indexSheet.isSheetHidden()) indexSheet.hideSheet();
    return rows;
  }

  function indexMap_() {
    const indexSheet = spreadsheet_().getSheetByName(config_().indexSheetName);
    if (!indexSheet || indexSheet.getLastRow() < 2) return {};
    const values = indexSheet
      .getRange(2, 1, indexSheet.getLastRow() - 1, INDEX_HEADERS.length)
      .getValues();
    const map = {};
    values.forEach(function (row) {
      const key = Number(row[0]) + "|" + Number(row[1]) + "|" + compactKey_(row[2]);
      map[key] = {
        year: Number(row[0]),
        month: Number(row[1]),
        serviceCode: String(row[2] || ""),
        serviceName: String(row[3] || ""),
        fileId: String(row[4] || ""),
        fileName: String(row[5] || ""),
        url: String(row[6] || ""),
        mimeType: String(row[7] || ""),
        modifiedAt: row[8] instanceof Date ? row[8].toISOString() : String(row[8] || ""),
        syncedAt: row[9] instanceof Date ? row[9].toISOString() : String(row[9] || ""),
        duplicateCount: Number(row[10] || 0),
        status: String(row[11] || ""),
      };
    });
    return map;
  }

  function lastIndexSync_() {
    const indexSheet = spreadsheet_().getSheetByName(config_().indexSheetName);
    if (!indexSheet || indexSheet.getLastRow() < 2) {
      return { value: null, timestamp: 0, iso: "" };
    }
    const value = indexSheet.getRange(2, 10).getValue();
    const date = value instanceof Date ? value : new Date(value || 0);
    const timestamp = date && !isNaN(date.getTime()) ? date.getTime() : 0;
    return {
      value: timestamp ? date : null,
      timestamp: timestamp,
      iso: timestamp ? date.toISOString() : "",
    };
  }

  function autoSyncState_() {
    const last = lastIndexSync_();
    const stale = !last.timestamp || Date.now() - last.timestamp >= DEFAULTS.AUTO_SYNC_TTL_MS;
    return {
      stale: stale,
      lastSyncedAt: last.iso,
      ttlMinutes: Math.round(DEFAULTS.AUTO_SYNC_TTL_MS / 60000),
    };
  }

  function applyNotes_(layout, index) {
    const notes = layout.services.map(function (service) {
      return layout.months.map(function (monthInfo) {
        const key = layout.year + "|" + monthInfo.month + "|" + compactKey_(service.code);
        const item = index[key];
        if (!item || !item.url) return "Файл звірки не знайдено";
        return "Документ звірки: " + item.fileName + "\n" + item.url;
      });
    });
    layout.sheet
      .getRange(layout.firstServiceRow, DEFAULTS.FIRST_MONTH_COLUMN, layout.services.length, DEFAULTS.MONTH_COUNT)
      .setNotes(notes);
  }

  function syncFiles() {
    const lock = LockService.getDocumentLock();
    lock.waitLock(30000);
    try {
      const layout = getLayout_();
      const folderId = getFolderId_();
      if (!folderId) {
        throw new Error("Папку звірок Google Drive ще не налаштовано");
      }
      const root = DriveApp.getFolderById(folderId);
      const files = [];
      const scanState = { truncated: false, truncatedByFiles: false, truncatedByDepth: false };
      walkFolder_(root, [root.getName()], 0, files, scanState);
      const selected = chooseFiles_(files, layout);
      const rows = writeIndex_(layout, selected);
      const index = indexMap_();
      applyNotes_(layout, index);
      const formatting = applyFormatting();
      const linked = rows.filter(function (row) { return row[6]; }).length;
      const duplicates = rows.reduce(function (sum, row) { return sum + Number(row[10] || 0); }, 0);

      return {
        success: true,
        scannedFiles: files.length,
        linkedFiles: linked,
        missingFiles: rows.length - linked,
        duplicateFiles: duplicates,
        truncated: !!scanState.truncated,
        truncatedByFiles: !!scanState.truncatedByFiles,
        truncatedByDepth: !!scanState.truncatedByDepth,
        folder: folderDescriptor_(),
        formatting: formatting,
        dashboard: getDashboard({ skipFormatting: true, skipAutoSync: true }),
      };
    } finally {
      lock.releaseLock();
    }
  }

  function monthStatus_(layout, monthInfo, checks, index, now) {
    const checksComplete = checks.length > 0 && checks.every(function (value) { return value; });
    const services = layout.services.map(function (service, serviceIndex) {
      const key = layout.year + "|" + monthInfo.month + "|" + compactKey_(service.code);
      const file = index[key] || null;
      return {
        row: service.row,
        column: monthInfo.column,
        cell: layout.sheet.getRange(service.row, monthInfo.column).getA1Notation(),
        serviceCode: service.code,
        serviceName: service.name,
        checked: checks[serviceIndex] === true,
        file: file,
      };
    });
    const filesComplete = services.length > 0 && services.every(function (item) {
      return !!(item.file && item.file.url);
    });
    const computed = computeMonthStatus_({
      future: isFutureMonth_(layout.year, monthInfo.month, now),
      past: isPastMonth_(layout.year, monthInfo.month, now),
      checksComplete: checksComplete,
      filesComplete: filesComplete,
    });

    return {
      month: monthInfo.month,
      monthCode: String(monthInfo.month).padStart(2, "0"),
      name: MONTH_NAMES[monthInfo.month - 1],
      label: monthInfo.label,
      status: computed.status,
      complete: computed.complete,
      checksComplete: computed.checksComplete,
      filesComplete: computed.filesComplete,
      checked: checks.filter(Boolean).length,
      total: checks.length,
      linked: services.filter(function (item) { return item.file && item.file.url; }).length,
      services: services,
    };
  }

  function getDashboard(options) {
    const opts = options || {};
    const folderId = getFolderId_();
    const initialSync = autoSyncState_();
    let autoSyncError = "";

    if (!opts.skipAutoSync && opts.autoSync !== false && folderId && initialSync.stale) {
      try {
        return syncFiles().dashboard;
      } catch (error) {
        autoSyncError = error && error.message ? error.message : String(error || "");
      }
    }

    if (!opts.skipFormatting) applyFormatting();
    const layout = getLayout_();
    const index = indexMap_();
    const now = new Date();
    const months = layout.months.map(function (monthInfo) {
      return monthStatus_(layout, monthInfo, readMonthChecks_(layout, monthInfo), index, now);
    });
    const folder = folderDescriptor_();
    const syncState = autoSyncState_();

    return {
      success: true,
      sheetName: layout.sheet.getName(),
      year: layout.year,
      serviceCount: layout.services.length,
      folder: folder,
      sync: {
        automatic: true,
        stale: syncState.stale,
        lastSyncedAt: syncState.lastSyncedAt,
        ttlMinutes: syncState.ttlMinutes,
        error: autoSyncError,
      },
      months: months,
      summary: {
        completeMonths: months.filter(function (month) { return month.status === "complete"; }).length,
        incompleteMonths: months.filter(function (month) { return month.status === "incomplete"; }).length,
        linkedFiles: months.reduce(function (sum, month) { return sum + month.linked; }, 0),
        expectedFiles: layout.services.length * DEFAULTS.MONTH_COUNT,
      },
    };
  }

  function getSelected() {
    const ss = spreadsheet_();
    const activeSheet = ss.getActiveSheet();
    const activeRange = activeSheet ? activeSheet.getActiveRange() : null;
    if (!activeSheet || activeSheet.getName() !== config_().sheetName || !activeRange) {
      return { success: false, error: "Оберіть клітинку служби та місяця на аркуші звірки" };
    }

    const layout = getLayout_();
    const row = activeRange.getRow();
    const column = activeRange.getColumn();
    if (
      row < layout.firstServiceRow ||
      row > layout.lastServiceRow ||
      column < DEFAULTS.FIRST_MONTH_COLUMN ||
      column >= DEFAULTS.FIRST_MONTH_COLUMN + DEFAULTS.MONTH_COUNT
    ) {
      return { success: false, error: "Оберіть клітинку з позначкою звірки" };
    }

    const service = layout.services[row - layout.firstServiceRow];
    const month = column - DEFAULTS.FIRST_MONTH_COLUMN + 1;
    const index = indexMap_();
    const key = layout.year + "|" + month + "|" + compactKey_(service.code);
    const file = index[key] || null;
    return {
      success: true,
      year: layout.year,
      month: month,
      monthName: MONTH_NAMES[month - 1],
      serviceCode: service.code,
      serviceName: service.name,
      checked: layout.sheet.getRange(row, column).getValue() === true,
      cell: activeRange.getA1Notation(),
      file: file,
    };
  }

  return Object.freeze({
    applyFormatting: applyFormatting,
    handleEdit: handleEdit,
    getDashboard: getDashboard,
    getSelected: getSelected,
    setFolder: setFolder,
    syncFiles: syncFiles,
  });
})();

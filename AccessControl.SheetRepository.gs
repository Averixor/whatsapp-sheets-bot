  // ==================== SHEET OPERATIONS (HEADER-BASED SAFE READS/WRITES) ====================

  function _getSheet_(createIfMissing) {
    if (_sheetCache && _sheetCache.getParent()) {
      return _sheetCache;
    }

    const ss = SpreadsheetApp.getActive();
    let sh = ss.getSheetByName(ACCESS_SHEET);
    if (!sh && createIfMissing) {
      sh = ss.insertSheet(ACCESS_SHEET);
      Logger.log('[AccessControl] Created ACCESS sheet');
      _invalidateAccessCaches_({ resetSheet: true });
    }
    if (sh) _ensureSheetSchema_(sh);
    _sheetCache = sh || null;
    return _sheetCache;
  }

  function _getHeaderMap_(sh) {
    const lastColumn = Math.max(sh.getLastColumn(), SHEET_HEADERS.length);
    const headers = sh.getRange(1, 1, 1, lastColumn).getValues()[0];
    const map = {};
    for (let i = 0; i < headers.length; i++) {
      const key = String(headers[i] || '').trim().toLowerCase();
      if (key) map[key] = i + 1;
    }
    return map;
  }

  function _ensureSheetSchema_(sh) {
    const lastColumn = Math.max(sh.getLastColumn(), 1);
    const existingHeaders = sh.getLastRow() >= 1
      ? sh.getRange(1, 1, 1, lastColumn).getValues()[0].map(function (v) { return String(v || '').trim(); })
      : [];

    let changed = false;

    if (!existingHeaders.length || existingHeaders.every(function (v) { return !v; })) {
      sh.getRange(1, 1, 1, SHEET_HEADERS.length).setValues([SHEET_HEADERS]);
      changed = true;
    } else {
      const existingMap = {};
      existingHeaders.forEach(function (v, idx) {
        const normalized = String(v || '').trim().toLowerCase();
        if (normalized) existingMap[normalized] = idx + 1;
      });

      SHEET_HEADERS.forEach(function (header) {
        if (existingMap[header]) return;
        const targetColumn = sh.getLastColumn() + 1;
        sh.insertColumnAfter(sh.getLastColumn());
        sh.getRange(1, targetColumn).setValue(header);
        changed = true;
      });
    }

    if (changed || sh.getFrozenRows() < 1) {
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), SHEET_HEADERS.length))
        .setFontWeight('bold')
        .setBackground('#e8eaed');
    }

    _applyRoleValidation_(sh);
    _applyEmailValidation_(sh);
    _applyEnabledValidation_(sh);
  }

  function _buildRoleValidationRule_() {
    return SpreadsheetApp.newDataValidation()
      .requireValueInList(ROLE_VALUES.slice(), true)
      .setAllowInvalid(false)
      .setHelpText('Оберіть роль: ' + ROLE_VALUES.join(', '))
      .build();
  }

  function _applyRoleValidation_(sh) {
    const headerMap = _getHeaderMap_(sh);
    const roleCol = headerMap.role;
    if (!roleCol) return;
    sh.getRange(2, roleCol, MAX_SHEET_ROWS - 1, 1).setDataValidation(_buildRoleValidationRule_());
  }

  function _applyEmailValidation_(sh) {
    const headerMap = _getHeaderMap_(sh);
    const emailCol = headerMap.email;
    if (!emailCol) return;
    const rule = SpreadsheetApp.newDataValidation()
      .requireTextIsEmail()
      .setAllowInvalid(false)
      .setHelpText('Введіть коректну email адресу')
      .build();
    sh.getRange(2, emailCol, MAX_SHEET_ROWS - 1, 1).setDataValidation(rule);
  }

  function _applyEnabledValidation_(sh) {
    const headerMap = _getHeaderMap_(sh);
    const enabledCol = headerMap.enabled;
    if (!enabledCol) return;
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['TRUE', 'FALSE'], true)
      .setAllowInvalid(false)
      .setHelpText('TRUE - активний, FALSE - заблокований адміністратором')
      .build();
    sh.getRange(2, enabledCol, MAX_SHEET_ROWS - 1, 1).setDataValidation(rule);
  }

  function _syncRoleNoteForRow_(sh, rowNumber) {
    if (!sh || rowNumber < 2) return;
    const headerMap = _getHeaderMap_(sh);
    const roleCol = headerMap.role;
    const noteCol = headerMap.note;
    if (!roleCol || !noteCol) return;
    const rawRole = String(sh.getRange(rowNumber, roleCol).getValue() || '').trim();
    if (!rawRole) return;
    sh.getRange(rowNumber, noteCol).setValue(getRoleNoteTemplate_(rawRole));
  }

  function _rowToEntry_(row, rowNumber, headerMap) {
    function read(header) {
      const column = headerMap[header];
      if (!column) return '';
      return row[column - 1];
    }

    return {
      email: normalizeEmail_(read('email')),
      phone: normalizePhone_(read('phone')),
      role: normalizeRole_(read('role')),
      enabled: isEnabledValue_(read('enabled')),
      note: String(read('note') || ''),
      displayName: String(read('display_name') || ''),
      personCallsign: normalizeCallsign_(read('person_callsign')),
      selfBindAllowed: isSelfBindAllowedValue_(read('self_bind_allowed'), read('role')),
      userKeyCurrentHash: normalizeStoredHash_(read('user_key_current_hash')),
      userKeyPrevHash: normalizeStoredHash_(read('user_key_prev_hash')),
      lastSeenAt: String(read('last_seen_at') || ''),
      lastRotatedAt: String(read('last_rotated_at') || ''),
      failedAttempts: parseInt(read('failed_attempts') || '0', 10) || 0,
      lockedUntilMs: parseInt(read('locked_until_ms') || '0', 10) || 0,
      source: ACCESS_SHEET,
      sheetRow: rowNumber
    };
  }

  function _readSheetEntries_() {
    if (_entriesCache) return _entriesCache.slice();

    const sh = _getSheet_(false);
    if (!sh || sh.getLastRow() < 2) {
      _entriesCache = [];
      return [];
    }

    const headerMap = _getHeaderMap_(sh);
    const rowCount = sh.getLastRow() - 1;
    const colCount = sh.getLastColumn();
    const values = sh.getRange(2, 1, rowCount, colCount).getValues();
    const result = [];
    for (let i = 0; i < values.length; i++) {
      result.push(_rowToEntry_(values[i], i + 2, headerMap));
    }
    _entriesCache = result;
    return result.slice();
  }

  function _getEntryBySheetRow_(sheetRow) {
    const sh = _getSheet_(false);
    if (!sh || !sheetRow || sheetRow < 2 || sheetRow > sh.getLastRow()) return null;
    const headerMap = _getHeaderMap_(sh);
    const colCount = sh.getLastColumn();
    const row = sh.getRange(sheetRow, 1, 1, colCount).getValues()[0];
    return _rowToEntry_(row, sheetRow, headerMap);
  }

  function _readRawSheetEntries_() {
    const sh = _getSheet_(false);
    if (!sh || sh.getLastRow() < 2) return [];
    const headerMap = _getHeaderMap_(sh);
    const rowCount = sh.getLastRow() - 1;
    const colCount = sh.getLastColumn();
    const values = sh.getRange(2, 1, rowCount, colCount).getValues();
    const result = [];
    for (let i = 0; i < values.length; i++) {
      result.push({
        rawRow: values[i],
        rowNumber: i + 2,
        headerMap: headerMap
      });
    }
    return result;
  }

  function _setEntryField_(sheetRow, header, value) {
    const sh = _getSheet_(false);
    if (!sh || !sheetRow || sheetRow < 2) return false;
    const headerMap = _getHeaderMap_(sh);
    const column = headerMap[header];
    if (!column) {
      Logger.log(`[AccessControl] Header "${header}" not found, cannot update field.`);
      return false;
    }
    sh.getRange(sheetRow, column).setValue(value);
    _invalidateAccessCaches_();
    return true;
  }

  function _setEntryFields_(sheetRow, updatesByHeader) {
    const sh = _getSheet_(false);
    if (!sh || !sheetRow || sheetRow < 2) return false;
    const headerMap = _getHeaderMap_(sh);
    for (const [header, value] of Object.entries(updatesByHeader)) {
      const column = headerMap[header];
      if (!column) {
        Logger.log(`[AccessControl] Header "${header}" not found, skipping field update.`);
        continue;
      }
      sh.getRange(sheetRow, column).setValue(value);
    }
    _invalidateAccessCaches_();
    return true;
  }

  function _writeEntryByHeaderMap_(sheetRow, entry) {
    const updates = {};
    if (entry.email !== undefined) updates.email = entry.email;
    if (entry.phone !== undefined) updates.phone = normalizePhone_(entry.phone);
    if (entry.role !== undefined) updates.role = normalizeRole_(entry.role);
    if (entry.enabled !== undefined) updates.enabled = entry.enabled ? 'TRUE' : 'FALSE';
    if (entry.note !== undefined) updates.note = entry.note;
    if (entry.displayName !== undefined) updates.display_name = entry.displayName;
    if (entry.personCallsign !== undefined) updates.person_callsign = normalizeCallsign_(entry.personCallsign);
    if (entry.selfBindAllowed !== undefined) updates.self_bind_allowed = entry.selfBindAllowed ? 'TRUE' : 'FALSE';
    if (entry.userKeyCurrentHash !== undefined) updates.user_key_current_hash = entry.userKeyCurrentHash;
    if (entry.userKeyPrevHash !== undefined) updates.user_key_prev_hash = entry.userKeyPrevHash;
    if (entry.lastSeenAt !== undefined) updates.last_seen_at = entry.lastSeenAt;
    if (entry.lastRotatedAt !== undefined) updates.last_rotated_at = entry.lastRotatedAt;
    if (entry.failedAttempts !== undefined) updates.failed_attempts = entry.failedAttempts;
    if (entry.lockedUntilMs !== undefined) updates.locked_until_ms = entry.lockedUntilMs;

    return _setEntryFields_(sheetRow, updates);
  }

  function _updateEntryFields_(sheetRow, updates) {
    const sh = _getSheet_(false);
    if (!sh || !sheetRow || sheetRow < 2) return null;

    const headerMap = _getHeaderMap_(sh);
    const colCount = sh.getLastColumn();
    const currentRow = sh.getRange(sheetRow, 1, 1, colCount).getValues()[0];
    const currentEntry = _rowToEntry_(currentRow, sheetRow, headerMap);

    const mapped = Object.assign({}, currentEntry);

    if (Object.prototype.hasOwnProperty.call(updates, 'email')) mapped.email = normalizeEmail_(updates.email);
    if (Object.prototype.hasOwnProperty.call(updates, 'phone')) mapped.phone = normalizePhone_(updates.phone);
    if (Object.prototype.hasOwnProperty.call(updates, 'role')) mapped.role = normalizeRole_(updates.role);
    if (Object.prototype.hasOwnProperty.call(updates, 'enabled')) mapped.enabled = !!updates.enabled;
    if (Object.prototype.hasOwnProperty.call(updates, 'note')) mapped.note = String(updates.note || '');
    if (Object.prototype.hasOwnProperty.call(updates, 'display_name')) mapped.displayName = String(updates.display_name || '');
    if (Object.prototype.hasOwnProperty.call(updates, 'displayName')) mapped.displayName = String(updates.displayName || '');
    if (Object.prototype.hasOwnProperty.call(updates, 'person_callsign')) mapped.personCallsign = normalizeCallsign_(updates.person_callsign);
    if (Object.prototype.hasOwnProperty.call(updates, 'personCallsign')) mapped.personCallsign = normalizeCallsign_(updates.personCallsign);
    if (Object.prototype.hasOwnProperty.call(updates, 'self_bind_allowed')) mapped.selfBindAllowed = isSelfBindAllowedValue_(updates.self_bind_allowed, mapped.role);
    if (Object.prototype.hasOwnProperty.call(updates, 'selfBindAllowed')) mapped.selfBindAllowed = !!updates.selfBindAllowed;
    if (Object.prototype.hasOwnProperty.call(updates, 'user_key_current_hash')) mapped.userKeyCurrentHash = normalizeStoredHash_(updates.user_key_current_hash);
    if (Object.prototype.hasOwnProperty.call(updates, 'user_key_prev_hash')) mapped.userKeyPrevHash = normalizeStoredHash_(updates.user_key_prev_hash);
    if (Object.prototype.hasOwnProperty.call(updates, 'last_seen_at')) mapped.lastSeenAt = String(updates.last_seen_at || '');
    if (Object.prototype.hasOwnProperty.call(updates, 'last_rotated_at')) mapped.lastRotatedAt = String(updates.last_rotated_at || '');
    if (Object.prototype.hasOwnProperty.call(updates, 'failed_attempts')) mapped.failedAttempts = parseInt(updates.failed_attempts || '0', 10) || 0;
    if (Object.prototype.hasOwnProperty.call(updates, 'locked_until_ms')) mapped.lockedUntilMs = parseInt(updates.locked_until_ms || '0', 10) || 0;

    _writeEntryByHeaderMap_(sheetRow, mapped);
    return mapped;
  }


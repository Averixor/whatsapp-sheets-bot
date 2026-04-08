  // ==================== VALIDATION & DIAGNOSTICS ====================

  function validateAccessSheet() {
    const entries = _readSheetEntries_();
    const rawEntries = _readRawSheetEntries_();
    const issues = [];

    const emailRows = {};
    const currentKeyRows = {};
    const prevKeyRows = {};

    entries.forEach(function (entry, index) {
      const rowNum = index + 2;

      if (entry.email) {
        if (!emailRows[entry.email]) emailRows[entry.email] = [];
        emailRows[entry.email].push(rowNum);
      }
      if (entry.userKeyCurrentHash) {
        if (!currentKeyRows[entry.userKeyCurrentHash]) currentKeyRows[entry.userKeyCurrentHash] = [];
        currentKeyRows[entry.userKeyCurrentHash].push(rowNum);
      }
      if (entry.userKeyPrevHash) {
        if (!prevKeyRows[entry.userKeyPrevHash]) prevKeyRows[entry.userKeyPrevHash] = [];
        prevKeyRows[entry.userKeyPrevHash].push(rowNum);
      }
    });

    entries.forEach(function (entry, index) {
      const rowNum = index + 2;

      if (entry.email) {
        if (!entry.email.includes('@')) {
          issues.push('Рядок ' + rowNum + ': некоректний email "' + entry.email + '"');
        }
        if ((emailRows[entry.email] || []).length > 1) {
          issues.push('Рядок ' + rowNum + ': дубль email "' + entry.email + '" (рядки ' + emailRows[entry.email].join(', ') + ')');
        }
      }

      if (entry.userKeyCurrentHash && (currentKeyRows[entry.userKeyCurrentHash] || []).length > 1) {
        issues.push('Рядок ' + rowNum + ': дубль current_key (рядки ' + currentKeyRows[entry.userKeyCurrentHash].join(', ') + ')');
      }

      if (entry.userKeyPrevHash && (prevKeyRows[entry.userKeyPrevHash] || []).length > 1) {
        issues.push('Рядок ' + rowNum + ': дубль prev_key (рядки ' + prevKeyRows[entry.userKeyPrevHash].join(', ') + ')');
      }

      if (entry.userKeyCurrentHash && entry.userKeyPrevHash && entry.userKeyCurrentHash === entry.userKeyPrevHash) {
        issues.push('Рядок ' + rowNum + ': current_key === prev_key');
      }

      if (entry.userKeyPrevHash && currentKeyRows[entry.userKeyPrevHash] && currentKeyRows[entry.userKeyPrevHash].length) {
        issues.push('Рядок ' + rowNum + ': prev_key збігається з current_key рядків ' + currentKeyRows[entry.userKeyPrevHash].join(', '));
      }

      if (entry.userKeyCurrentHash && prevKeyRows[entry.userKeyCurrentHash] && prevKeyRows[entry.userKeyCurrentHash].length) {
        issues.push('Рядок ' + rowNum + ': current_key збігається з prev_key рядків ' + prevKeyRows[entry.userKeyCurrentHash].join(', '));
      }
    });

    for (const raw of rawEntries) {
      const rowNum = raw.rowNumber;

      const roleCol = raw.headerMap.role;
      const rawRole = roleCol ? String(raw.rawRow[roleCol - 1] || '').trim().toLowerCase() : '';
      if (rawRole && !ROLE_VALUES.includes(rawRole)) {
        issues.push('Рядок ' + rowNum + ': некоректна роль "' + rawRole + '"');
      }

      const enabledCol = raw.headerMap.enabled;
      const rawEnabled = enabledCol ? String(raw.rawRow[enabledCol - 1] || '').trim().toLowerCase() : 'true';
      const isValidEnabled = ['true', 'false', '1', '0', 'yes', 'no', 'так', 'ні', ''].includes(rawEnabled);
      if (!isValidEnabled) {
        issues.push('Рядок ' + rowNum + ': некоректне значення enabled "' + rawEnabled + '"');
      }
    }

    return { valid: issues.length === 0, issues: issues };
  }

  function runAccessDiagnostics() {
    const policy = _getAccessPolicy_();
    const entries = _readSheetEntries_();
    const rawEntries = _readRawSheetEntries_();
    const sh = _getSheet_(false);
    const headerMap = sh ? _getHeaderMap_(sh) : {};

    const diagnostics = {
      schema: {
        exists: !!sh,
        headersPresent: SHEET_HEADERS.every(h => headerMap[h] !== undefined),
        missingHeaders: SHEET_HEADERS.filter(h => headerMap[h] === undefined),
        headersCanonical: sh ? sh.getRange(1, 1, 1, SHEET_HEADERS.length).getValues()[0].every((v, i) => v === SHEET_HEADERS[i]) : false
      },
      dataIntegrity: {
        duplicateEmails: [],
        duplicateCurrentKeys: [],
        duplicatePrevKeys: [],
        currentEqualsPrev: [],
        prevCollidesWithCurrent: [],
        emptyIdentifierWithActiveRole: [],
        invalidRoleValues: [],
        invalidEnabledValues: [],
        brokenLockedUntil: []
      },
      policy: {
        strictUserKeyMode: policy.strictUserKeyMode,
        migrationModeEnabled: policy.migrationModeEnabled,
        bootstrapAllowed: policy.bootstrapAllowed,
        adminConfigured: policy.adminConfigured,
        accessSheetPresent: policy.accessSheetPresent
      },
      runtime: {
        registeredKeysCount: entries.filter(e => e.userKeyCurrentHash || e.userKeyPrevHash).length,
        lockedUsersCount: entries.filter(e => _isTimedLocked_(e)).length,
        adminDisabledUsersCount: entries.filter(e => _isAdminDisabled_(e)).length,
        usersWithoutCurrentKey: entries.filter(e => !e.userKeyCurrentHash).length,
        usersWithOnlyIdentifierAccess: entries.filter(e => !e.userKeyCurrentHash && !e.userKeyPrevHash && (e.email || e.phone)).length,
        selfBindableUsersCount: entries.filter(e => e.enabled && e.selfBindAllowed && !!normalizeCallsign_(e.personCallsign)).length
      }
    };

    const emailMap = new Map();
    const currentKeyMap = new Map();
    const prevKeyMap = new Map();
    entries.forEach((e, idx) => {
      const row = idx + 2;
      if (e.email) {
        if (!emailMap.has(e.email)) emailMap.set(e.email, []);
        emailMap.get(e.email).push(row);
      }
      if (e.userKeyCurrentHash) {
        if (!currentKeyMap.has(e.userKeyCurrentHash)) currentKeyMap.set(e.userKeyCurrentHash, []);
        currentKeyMap.get(e.userKeyCurrentHash).push(row);
      }
      if (e.userKeyPrevHash) {
        if (!prevKeyMap.has(e.userKeyPrevHash)) prevKeyMap.set(e.userKeyPrevHash, []);
        prevKeyMap.get(e.userKeyPrevHash).push(row);
      }
    });

    entries.forEach((e, idx) => {
      const row = idx + 2;

      if (e.email && emailMap.get(e.email).length > 1) diagnostics.dataIntegrity.duplicateEmails.push({ email: e.email, rows: emailMap.get(e.email) });
      if (e.userKeyCurrentHash && currentKeyMap.get(e.userKeyCurrentHash).length > 1) diagnostics.dataIntegrity.duplicateCurrentKeys.push({ hash: e.userKeyCurrentHash, rows: currentKeyMap.get(e.userKeyCurrentHash) });
      if (e.userKeyPrevHash && prevKeyMap.get(e.userKeyPrevHash).length > 1) diagnostics.dataIntegrity.duplicatePrevKeys.push({ hash: e.userKeyPrevHash, rows: prevKeyMap.get(e.userKeyPrevHash) });
      if (e.userKeyCurrentHash && e.userKeyPrevHash && e.userKeyCurrentHash === e.userKeyPrevHash) diagnostics.dataIntegrity.currentEqualsPrev.push(row);
      if (e.userKeyPrevHash && currentKeyMap.has(e.userKeyPrevHash)) diagnostics.dataIntegrity.prevCollidesWithCurrent.push({ row: row, prevHash: e.userKeyPrevHash, collidesWithRows: currentKeyMap.get(e.userKeyPrevHash) });
      if (!e.email && !e.phone && e.role !== 'guest') diagnostics.dataIntegrity.emptyIdentifierWithActiveRole.push(row);
      if (e.lockedUntilMs && e.lockedUntilMs < _nowMs_() && e.lockedUntilMs > 0) diagnostics.dataIntegrity.brokenLockedUntil.push({ row: row, lockedUntilMs: e.lockedUntilMs });
    });

    for (const raw of rawEntries) {
      const rowNum = raw.rowNumber;

      const roleCol = raw.headerMap.role;
      const rawRole = roleCol ? String(raw.rawRow[roleCol - 1] || '').trim().toLowerCase() : '';
      if (rawRole && !ROLE_VALUES.includes(rawRole)) {
        diagnostics.dataIntegrity.invalidRoleValues.push({ row: rowNum, role: rawRole });
      }

      const enabledCol = raw.headerMap.enabled;
      const rawEnabled = enabledCol ? String(raw.rawRow[enabledCol - 1] || '').trim().toLowerCase() : 'true';
      const isValidEnabled = ['true', 'false', '1', '0', 'yes', 'no', 'так', 'ні', ''].includes(rawEnabled);
      if (!isValidEnabled) {
        diagnostics.dataIntegrity.invalidEnabledValues.push({ row: rowNum, enabled: rawEnabled });
      }
    }

    return diagnostics;
  }

  function getReadinessStatus() {
    const diag = runAccessDiagnostics();
    const policy = _getAccessPolicy_();

    const critical = [];
    const warnings = [];

    if (!diag.schema.exists) critical.push('ACCESS sheet missing');
    if (!diag.schema.headersPresent) critical.push('Missing headers: ' + diag.schema.missingHeaders.join(', '));
    if (diag.dataIntegrity.duplicateEmails.length) critical.push('Duplicate emails found');
    if (diag.dataIntegrity.duplicateCurrentKeys.length) critical.push('Duplicate current keys found');
    if (diag.dataIntegrity.invalidRoleValues.length) critical.push('Invalid role values found');
    if (!policy.adminConfigured && diag.schema.exists && diag.runtime.registeredKeysCount > 0) {
      warnings.push('No admin configured, but ACCESS has keys. Bootstrap will NOT activate.');
    }
    if (diag.runtime.usersWithoutCurrentKey > 0) {
      warnings.push(diag.runtime.usersWithoutCurrentKey + ' users have no current key');
    }

    return {
      ready: critical.length === 0,
      criticalIssues: critical,
      warnings: warnings,
      summary: {
        totalUsers: diag.runtime.registeredKeysCount,
        locked: diag.runtime.lockedUsersCount,
        adminDisabled: diag.runtime.adminDisabledUsersCount,
        mode: policy.strictUserKeyMode ? 'strict' : 'migration',
        bootstrapAvailable: policy.bootstrapAllowed
      }
    };
  }


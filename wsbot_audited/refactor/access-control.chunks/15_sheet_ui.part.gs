  // ==================== SHEET UI ====================

  function bootstrapSheet() {
    const existed = !!_getSheet_(false);
    const sh = _getSheet_(true);
    _applyRoleValidation_(sh);
    _applyEmailValidation_(sh);
    _applyEnabledValidation_(sh);
    _invalidateAccessCaches_();
    return {
      success: true,
      sheet: ACCESS_SHEET,
      created: !existed,
      headers: SHEET_HEADERS.slice(),
      roleValues: ROLE_VALUES.slice()
    };
  }

  function refreshAccessSheetUi() {
    const sh = _getSheet_(true);
    _applyRoleValidation_(sh);
    _applyEmailValidation_(sh);
    _applyEnabledValidation_(sh);
    _invalidateAccessCaches_();
    return {
      success: true,
      sheet: ACCESS_SHEET,
      message: 'ACCESS schema updated',
      roleValues: ROLE_VALUES.slice()
    };
  }

  function handleAccessSheetEdit(e) {
    const range = e && e.range ? e.range : null;
    if (!range) return;

    const sh = range.getSheet();
    if (!sh || sh.getName() !== ACCESS_SHEET) return;

    const row = range.getRow();
    const column = range.getColumn();
    if (row < 2 || row > MAX_SHEET_ROWS) return;

    const headerMap = _getHeaderMap_(sh);
    const roleCol = headerMap.role;
    const emailCol = headerMap.email;

    if (roleCol && column === roleCol && range.getNumColumns() === 1 && range.getNumRows() === 1) {
      const rawRole = String(range.getValue() || '').trim();
      if (rawRole) range.setValue(normalizeRole_(rawRole));
      _syncRoleNoteForRow_(sh, row);
    }

    if (emailCol && column === emailCol && range.getNumColumns() === 1 && range.getNumRows() === 1) {
      const email = normalizeEmail_(range.getValue());
      if (email && email.indexOf('@') === -1) {
        range.setValue('');
        SpreadsheetApp.getActive().toast('Некоректний email', 'Помилка', 3);
      }
    }

    _invalidateAccessCaches_();
  }


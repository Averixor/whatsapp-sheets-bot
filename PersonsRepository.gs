/**
 * PersonsRepository.gs — canonical доступ до даних бойців із місячних листів.
 */

var PersonsRepository_ = PersonsRepository_ || (function() {
  function normalizeDateStr(dateStr) {
    const safe = String(dateStr || '').trim();
    return assertUaDateString_(safe);
  }

  function getSheetByDate(dateStr) {
    const safeDate = normalizeDateStr(dateStr);
    const d = DateUtils_.parseUaDate(safeDate);
    const ss = SpreadsheetApp.getActive();
    if (d) {
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const sh = ss.getSheetByName(mm);
      if (sh) return sh;
    }
    return getBotSheet_();
  }

  function getPrevMonthSheetByDate(dateStr) {
    const safeDate = normalizeDateStr(dateStr);
    const d = DateUtils_.parseUaDate(safeDate);
    if (!d) return null;
    const ss = SpreadsheetApp.getActive();
    const prev = new Date(d);
    prev.setMonth(prev.getMonth() - 1);
    const mm = String(prev.getMonth() + 1).padStart(2, '0');
    return ss.getSheetByName(mm);
  }

  function getDateContext(dateStr, explicitSheet) {
    const safeDate = normalizeDateStr(dateStr);
    const sheet = explicitSheet || getSheetByDate(safeDate);
    const col = findTodayColumn_(sheet, safeDate);
    if (col === -1) {
      throw buildContextError_('PersonsRepository_.getDateContext', {
        sheet: sheet ? sheet.getName() : '',
        date: safeDate
      }, `Дата ${safeDate} не знайдена у шапці листа`);
    }
    return {
      sheet: sheet,
      dateStr: safeDate,
      col: col
    };
  }

  function getMonthlyRows(sheet) {
    const sh = sheet || getBotSheet_();
    const schema = SheetSchemas_.get('MONTHLY');
    const matrix = schema.matrix;
    const rowCount = matrix.endRow - matrix.startRow + 1;
    const width = Math.max(
      schema.columns.phone,
      schema.columns.callsign,
      schema.columns.position,
      schema.columns.oshs,
      schema.columns.rank,
      schema.columns.brDays,
      schema.columns.fio
    );

    const values = sh.getRange(matrix.startRow, 1, rowCount, width).getDisplayValues();
    return values.map(function(row, idx) {
      return {
        phone: String(row[schema.columns.phone - 1] || '').trim(),
        callsign: String(row[schema.columns.callsign - 1] || '').trim(),
        position: String(row[schema.columns.position - 1] || '').trim(),
        oshs: String(row[schema.columns.oshs - 1] || '').trim(),
        rank: String(row[schema.columns.rank - 1] || '').trim(),
        brDays: String(row[schema.columns.brDays - 1] || '').trim(),
        fio: String(row[schema.columns.fio - 1] || '').trim(),
        _meta: {
          rowNumber: matrix.startRow + idx,
          sheetName: sh.getName()
        }
      };
    });
  }

  function findRowByCallsign(callsign, sheet) {
    const key = _normCallsignKey_(callsign);
    return getMonthlyRows(sheet).find(function(item) {
      return _normCallsignKey_(item.callsign) === key;
    }) || null;
  }

  function findRowByFio(fio, sheet) {
    const key = _normFio_(fio);
    return getMonthlyRows(sheet).find(function(item) {
      return _normFio_(item.fio) === key;
    }) || null;
  }

  function getPayloadByRow(rowNumber, dateStr, sheet) {
    const ctx = getDateContext(dateStr, sheet);
    return buildPayloadForCell_(
      ctx.sheet,
      Number(rowNumber),
      Number(ctx.col),
      DictionaryRepository_.getPhonesIndex(),
      DictionaryRepository_.getDictMap()
    );
  }

  function getPersonByCallsign(callsign, dateStr) {
    const safeDate = normalizeDateStr(dateStr);
    const sheet = getSheetByDate(safeDate);
    const item = findRowByCallsign(callsign, sheet);
    if (!item) {
      throw new Error(`Позивний "${callsign}" не знайдено`);
    }

    const payload = getPayloadByRow(item._meta.rowNumber, safeDate, sheet);
    const profile = DictionaryRepository_.getProfileByCallsign(item.callsign) || DictionaryRepository_.getProfileByFio(item.fio) || null;
    const phone = item.phone || payload.phone || DictionaryRepository_.getPhoneByFio(item.fio) || DictionaryRepository_.getPhoneByCallsign(item.callsign) || DictionaryRepository_.getPhoneByRole(item.callsign) || '';
    const prevSheet = getPrevMonthSheetByDate(safeDate);
    const prevRow = prevSheet ? findRowByCallsign(item.callsign, prevSheet) : null;

    return {
      callsign: item.callsign,
      fio: item.fio,
      rank: item.rank,
      position: item.position,
      oshs: item.oshs,
      phone: phone,
      birthday: profile && profile.birthday ? profile.birthday : '',
      brDaysThisMonth: item.brDays || '0',
      brDaysPrevMonth: prevRow ? (prevRow.brDays || '0') : '0',
      todayGroup: getPersonGroupForDate_(sheet, item._meta.rowNumber, safeDate),
      dateStr: safeDate,
      sheet: sheet.getName(),
      row: item._meta.rowNumber,
      col: payload.col,
      message: payload.message || '',
      waLink: payload.link || '',
      nextVacation: VacationsRepository_.getNextForFio(item.fio, safeDate),
      vac: VacationsRepository_.getCurrentForFio(item.fio, safeDate),
      phoneDisplay: _formatPhoneDisplay_(phone)
    };
  }

  function getSidebarPersonnel(dateStr) {
    const ctx = getDateContext(dateStr);
    const ref = ctx.sheet.getRange(CONFIG.CODE_RANGE_A1);
    const startRow = ref.getRow();
    const numRows = ref.getNumRows();
    const codes = ctx.sheet.getRange(startRow, ctx.col, numRows, 1).getDisplayValues();
    const fios = ctx.sheet.getRange(startRow, CONFIG.FIO_COL, numRows, 1).getDisplayValues();

    const personnel = [];
    for (let i = 0; i < numRows; i++) {
      const code = String(codes[i][0] || '').trim();
      const fio = String(fios[i][0] || '').trim();
      if (!code || !fio) continue;

      try {
        const payload = getPayloadByRow(startRow + i, ctx.dateStr, ctx.sheet);
        personnel.push({
          fio: payload.fio,
          phone: payload.phone,
          code: payload.code,
          service: payload.service,
          place: payload.place,
          tasks: payload.tasks,
          message: payload.message,
          link: payload.link,
          date: payload.reportDateStr,
          row: startRow + i,
          col: ctx.col,
          status: 'ready'
        });
      } catch (e) {
        personnel.push({
          fio: fio,
          phone: '—',
          code: code,
          service: '—',
          place: '—',
          tasks: '—',
          message: '',
          link: '',
          date: ctx.dateStr,
          row: startRow + i,
          col: ctx.col,
          status: 'error',
          error: e && e.message ? e.message : String(e)
        });
      }
    }

    return {
      month: ctx.sheet.getName(),
      date: ctx.dateStr,
      personnel: personnel
    };
  }

  function getAnyCallsign(sheet) {
    const rows = getMonthlyRows(sheet || getBotSheet_());
    const first = rows.find(function(item) { return !!String(item.callsign || '').trim(); });
    return first ? first.callsign : '';
  }

  function getAvailableDates(sheet) {
    const sh = sheet || getBotSheet_();
    const matrix = SheetSchemas_.get('MONTHLY').matrix;
    const width = matrix.endCol - matrix.startCol + 1;
    const values = sh.getRange(Number(CONFIG.DATE_ROW) || 1, matrix.startCol, 1, width).getDisplayValues()[0];
    const dates = [];
    const seen = Object.create(null);

    values.forEach(function(value) {
      const raw = String(value || '').trim();
      if (!raw) return;
      try {
        const normalized = DateUtils_.normalizeDate(raw, raw);
        if (/^\d{2}\.\d{2}\.\d{4}$/.test(normalized) && !seen[normalized]) {
          seen[normalized] = true;
          dates.push(normalized);
        }
      } catch (_) {
        // Пропускаємо порожні/сміттєві значення у рядку дат замість падіння всього smoke-suite.
      }
    });

    return dates;
  }

  return {
    normalizeDateStr: normalizeDateStr,
    getSheetByDate: getSheetByDate,
    getPrevMonthSheetByDate: getPrevMonthSheetByDate,
    getDateContext: getDateContext,
    getMonthlyRows: getMonthlyRows,
    findRowByCallsign: findRowByCallsign,
    findRowByFio: findRowByFio,
    getPayloadByRow: getPayloadByRow,
    getPersonByCallsign: getPersonByCallsign,
    getSidebarPersonnel: getSidebarPersonnel,
    getAnyCallsign: getAnyCallsign,
    getAvailableDates: getAvailableDates
  };
})();
